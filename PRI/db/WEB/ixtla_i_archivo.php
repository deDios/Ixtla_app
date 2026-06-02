<?php
// db/WEB/ixtla_i_archivo.php

declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
date_default_timezone_set('America/Mexico_City');

/* ============================================================
   CORS
   ============================================================ */

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

$allowed_origins = [
    'https://ixtla-app.com',
    'https://www.ixtla-app.com'
];

if (in_array($origin, $allowed_origins, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Vary: Origin");
}

header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400");
header("X-Content-Type-Options: nosniff");
header("Referrer-Policy: no-referrer");
header("Content-Type: application/json; charset=utf-8");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* ============================================================
   HELPERS
   ============================================================ */

function json_response(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function internal_error(string $message): void
{
    error_log('[IXTLA_I_ARCHIVO] ' . $message);

    json_response([
        "ok" => false,
        "error" => "Error interno del servidor"
    ], 500);
}

function read_json_body(): array
{
    $raw = file_get_contents("php://input");

    if (!$raw || trim($raw) === '') {
        json_response([
            "ok" => false,
            "error" => "Body JSON requerido"
        ], 400);
    }

    $in = json_decode($raw, true);

    if (!is_array($in)) {
        json_response([
            "ok" => false,
            "error" => "JSON inválido"
        ], 400);
    }

    return $in;
}

function db(): mysqli
{
    $path = realpath("/home/site/wwwroot/db/conn/conn_db_2.php");

    if (!$path || !file_exists($path)) {
        internal_error("No se encontró conn_db_2.php en /home/site/wwwroot/db/conn/conn_db_2.php");
    }

    include_once $path;

    if (!function_exists('conectar')) {
        internal_error("No existe la función conectar() en conn_db_2.php");
    }

    $con = conectar();

    if (!$con instanceof mysqli) {
        internal_error("conectar() no regresó una conexión mysqli válida");
    }

    $con->set_charset('utf8mb4');
    $con->query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    $con->query("SET time_zone='-06:00'");

    return $con;
}

function uuidv4(): string
{
    $data = random_bytes(16);

    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);

    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function value_or_null(array $arr, string $key): mixed
{
    if (!array_key_exists($key, $arr)) {
        return null;
    }

    if ($arr[$key] === '') {
        return null;
    }

    return $arr[$key];
}

function bind_dynamic(mysqli_stmt $stmt, string $types, array &$params): void
{
    if ($types === '' || empty($params)) {
        return;
    }

    $refs = [];
    $refs[] = $types;

    foreach ($params as $key => &$value) {
        $refs[] = &$value;
    }

    call_user_func_array([$stmt, 'bind_param'], $refs);
}

function str_clean(array $in, string $key): string
{
    return isset($in[$key]) ? trim((string)$in[$key]) : '';
}

function nullable_int_from_row(array $row, string $key): ?int
{
    return isset($row[$key]) && $row[$key] !== null ? (int)$row[$key] : null;
}

function bool_int_from_input(array $in, string $key, int $default): int
{
    if (!array_key_exists($key, $in) || $in[$key] === '') {
        return $default;
    }

    return ((int)$in[$key]) === 1 ? 1 : 0;
}


function sanitize_storage_name(string $name, string $fallbackExt = 'jpg'): string
{
    $clean = trim($name);

    $clean = preg_replace('/[^\w.\-]/u', '_', $clean) ?? '';
    $clean = preg_replace('/_+/', '_', $clean) ?? '';
    $clean = trim($clean, '._-');

    if ($clean === '') {
        $clean = 'archivo_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $fallbackExt;
    }

    if (!preg_match('/\.[a-zA-Z0-9]{2,5}$/', $clean)) {
        $clean .= '.' . $fallbackExt;
    }

    return $clean;
}

function extension_from_mime(string $mime): string
{
    return match (strtolower($mime)) {
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/jpeg', 'image/jpg' => 'jpg',
        default => 'jpg',
    };
}

/**
 * Convierte un Data URL base64 a archivo físico y devuelve la ruta pública.
 *
 * El frontend puede seguir mandando url_archivo como:
 * data:image/jpeg;base64,/9j/...
 *
 * En BD ya no se guarda el string gigante; solo se guarda:
 * /PRI/uploads/personas/{id}/archivo.jpg
 */
function guardar_data_url_archivo(array &$in, string $data_url, string $nombre_storage, string $entidad_tipo, int $entidad_id): string
{
    if (!preg_match('/^data:(image\/jpeg|image\/jpg|image\/png|image\/webp);base64,(.+)$/s', $data_url, $match)) {
        json_response([
            "ok" => false,
            "error" => "Data URL de imagen inválido"
        ], 400);
    }

    $mime = strtolower($match[1]);
    $base64 = preg_replace('/\s+/', '', $match[2]) ?? '';

    $binary = base64_decode($base64, true);

    if ($binary === false) {
        json_response([
            "ok" => false,
            "error" => "No se pudo decodificar la imagen"
        ], 400);
    }

    $sizeBytes = strlen($binary);
    $maxBytes = 2 * 1024 * 1024; // 2MB ya decodificado

    if ($sizeBytes <= 0) {
        json_response([
            "ok" => false,
            "error" => "La imagen está vacía"
        ], 400);
    }

    if ($sizeBytes > $maxBytes) {
        json_response([
            "ok" => false,
            "error" => "La imagen excede el peso máximo permitido"
        ], 400);
    }

    $extension = extension_from_mime($mime);
    $safeName = sanitize_storage_name($nombre_storage, $extension);

    // Si el nombre venía con extensión distinta al MIME real, mantenemos el nombre limpio
    // pero normalizamos la extensión para evitar inconsistencias.
    $safeName = preg_replace('/\.[a-zA-Z0-9]{2,5}$/', '.' . $extension, $safeName) ?? $safeName;

    $projectRoot = dirname(__DIR__, 2); // /home/site/wwwroot/PRI
    $relativeDir = '/uploads/personas/' . $entidad_id;
    $storageDir = $projectRoot . $relativeDir;
    $publicDir = '/PRI' . $relativeDir;

    if (!is_dir($storageDir)) {
        if (!mkdir($storageDir, 0755, true) && !is_dir($storageDir)) {
            internal_error("No se pudo crear el directorio de archivos: $storageDir");
        }
    }

    $fullPath = $storageDir . '/' . $safeName;

    if (file_put_contents($fullPath, $binary, LOCK_EX) === false) {
        internal_error("No se pudo guardar el archivo físico: $fullPath");
    }

    // Completa/normaliza metadatos para que el insert quede consistente.
    $in['nombre_storage'] = $safeName;
    $in['mime_type'] = $mime;
    $in['extension'] = $extension;
    $in['tamano_bytes'] = $sizeBytes;

    if (!array_key_exists('sha256_hash', $in) || trim((string)$in['sha256_hash']) === '') {
        $in['sha256_hash'] = hash('sha256', $binary);
    }

    return $publicDir . '/' . $safeName;
}

/* ============================================================
   FORMATTER
   ============================================================ */

function archivo_row(array $row): array
{
    return [
        "archivo_id" => (int)$row['archivo_id'],
        "uuid" => $row['uuid'],

        "entidad_tipo" => $row['entidad_tipo'],
        "entidad_id" => (int)$row['entidad_id'],
        "uso_archivo" => $row['uso_archivo'],

        "nombre_original" => $row['nombre_original'],
        "nombre_storage" => $row['nombre_storage'],
        "url_archivo" => $row['url_archivo'],
        "url_thumbnail" => $row['url_thumbnail'],

        "mime_type" => $row['mime_type'],
        "extension" => $row['extension'],
        "tamano_bytes" => nullable_int_from_row($row, 'tamano_bytes'),
        "sha256_hash" => $row['sha256_hash'],

        "version_no" => (int)$row['version_no'],
        "es_actual" => (int)$row['es_actual'],
        "reemplaza_archivo_id" => nullable_int_from_row($row, 'reemplaza_archivo_id'),
        "privado" => (int)$row['privado'],

        "uploaded_by" => nullable_int_from_row($row, 'uploaded_by'),
        "uploaded_by_usuario" => [
            "usuario_id" => nullable_int_from_row($row, 'uploaded_by'),
            "username" => $row['uploaded_by_username'],
            "nombre" => $row['uploaded_by_nombre'],
            "apellido_paterno" => $row['uploaded_by_apellido_paterno'],
            "apellido_materno" => $row['uploaded_by_apellido_materno'],
            "nombre_completo" => trim(
                (string)$row['uploaded_by_nombre'] . ' ' .
                    (string)$row['uploaded_by_apellido_paterno'] . ' ' .
                    (string)$row['uploaded_by_apellido_materno']
            )
        ],

        "uploaded_at" => $row['uploaded_at'],
        "updated_at" => $row['updated_at'],
        "updated_by" => nullable_int_from_row($row, 'updated_by')
    ];
}

/* ============================================================
   CONSULTA RESPUESTA
   ============================================================ */

function get_archivo_full(mysqli $con, int $archivo_id): array
{
    $sql = "
        SELECT
            a.*,

            u.username AS uploaded_by_username,
            u.nombre AS uploaded_by_nombre,
            u.apellido_paterno AS uploaded_by_apellido_paterno,
            u.apellido_materno AS uploaded_by_apellido_materno

        FROM archivo a

        LEFT JOIN usuario u
            ON u.usuario_id = a.uploaded_by
           AND u.deleted_at IS NULL

        WHERE a.archivo_id = ?
          AND a.deleted_at IS NULL
        LIMIT 1
    ";

    $st = $con->prepare($sql);
    $st->bind_param("i", $archivo_id);
    $st->execute();

    $row = $st->get_result()->fetch_assoc();

    $st->close();

    if (!$row) {
        internal_error("Archivo insertado pero no encontrado. archivo_id=$archivo_id");
    }

    return archivo_row($row);
}

/* ============================================================
   VALIDACIONES
   ============================================================ */

function validar_entidad_relacionada(mysqli $con, string $entidad_tipo, int $entidad_id): void
{
    $map = [
        "PERSONA" => [
            "tabla" => "persona",
            "pk" => "persona_id"
        ],
        "USUARIO" => [
            "tabla" => "usuario",
            "pk" => "usuario_id"
        ],
        "PARTICIPACION" => [
            "tabla" => "persona_participacion",
            "pk" => "participacion_id"
        ]
    ];

    if (!isset($map[$entidad_tipo])) {
        json_response([
            "ok" => false,
            "error" => "entidad_tipo inválido"
        ], 400);
    }

    $tabla = $map[$entidad_tipo]["tabla"];
    $pk = $map[$entidad_tipo]["pk"];

    $sql = "
        SELECT 1
        FROM $tabla
        WHERE $pk = ?
          AND deleted_at IS NULL
        LIMIT 1
    ";

    $st = $con->prepare($sql);
    $st->bind_param("i", $entidad_id);
    $st->execute();

    $exists = (bool)$st->get_result()->fetch_assoc();

    $st->close();

    if (!$exists) {
        json_response([
            "ok" => false,
            "error" => "La entidad relacionada no existe"
        ], 404);
    }
}

function validar_usuario_si_existe(mysqli $con, ?int $usuario_id, string $campo): void
{
    if ($usuario_id === null || $usuario_id <= 0) {
        return;
    }

    $sql = "
        SELECT 1
        FROM usuario
        WHERE usuario_id = ?
          AND deleted_at IS NULL
        LIMIT 1
    ";

    $st = $con->prepare($sql);
    $st->bind_param("i", $usuario_id);
    $st->execute();

    $exists = (bool)$st->get_result()->fetch_assoc();

    $st->close();

    if (!$exists) {
        json_response([
            "ok" => false,
            "error" => "$campo no existe en usuario"
        ], 400);
    }
}

function validar_archivo_reemplazo_si_existe(mysqli $con, ?int $archivo_id): void
{
    if ($archivo_id === null || $archivo_id <= 0) {
        return;
    }

    $sql = "
        SELECT 1
        FROM archivo
        WHERE archivo_id = ?
          AND deleted_at IS NULL
        LIMIT 1
    ";

    $st = $con->prepare($sql);
    $st->bind_param("i", $archivo_id);
    $st->execute();

    $exists = (bool)$st->get_result()->fetch_assoc();

    $st->close();

    if (!$exists) {
        json_response([
            "ok" => false,
            "error" => "reemplaza_archivo_id no existe en archivo"
        ], 400);
    }
}

/* ============================================================
   INSERT
   ============================================================ */

function insertar_archivo(mysqli $con, array $in): array
{
    $entidad_tipo = strtoupper(str_clean($in, 'entidad_tipo'));
    $uso_archivo = strtoupper(str_clean($in, 'uso_archivo'));

    $entidad_id = isset($in['entidad_id']) ? (int)$in['entidad_id'] : 0;

    $nombre_storage = str_clean($in, 'nombre_storage');
    $url_archivo = str_clean($in, 'url_archivo');

    $entidadesValidas = ['PERSONA', 'USUARIO', 'PARTICIPACION'];

    $usosValidos = [
        'INE_FRENTE',
        'INE_REVERSO',
        'FOTO_PERSONA',
        'FOTO_USUARIO',
        'COMPROBANTE_DOMICILIO',
        'FIRMA',
        'DOCUMENTO_AFILIACION',
        'EVIDENCIA',
        'OTRO'
    ];

    if (!in_array($entidad_tipo, $entidadesValidas, true)) {
        json_response([
            "ok" => false,
            "error" => "entidad_tipo inválido"
        ], 400);
    }

    if ($entidad_id <= 0) {
        json_response([
            "ok" => false,
            "error" => "Falta parámetro obligatorio: entidad_id"
        ], 400);
    }

    if (!in_array($uso_archivo, $usosValidos, true)) {
        json_response([
            "ok" => false,
            "error" => "uso_archivo inválido"
        ], 400);
    }

    if ($nombre_storage === '') {
        json_response([
            "ok" => false,
            "error" => "Falta parámetro obligatorio: nombre_storage"
        ], 400);
    }

    if ($url_archivo === '') {
        json_response([
            "ok" => false,
            "error" => "Falta parámetro obligatorio: url_archivo"
        ], 400);
    }

    if (str_starts_with($url_archivo, 'data:image/')) {
        $url_archivo = guardar_data_url_archivo(
            $in,
            $url_archivo,
            $nombre_storage,
            $entidad_tipo,
            $entidad_id
        );

        $nombre_storage = str_clean($in, 'nombre_storage');
    }

    validar_entidad_relacionada($con, $entidad_tipo, $entidad_id);

    $uploaded_by = null;

    if (array_key_exists('uploaded_by', $in) && $in['uploaded_by'] !== '' && $in['uploaded_by'] !== null) {
        $uploaded_by = (int)$in['uploaded_by'];
        validar_usuario_si_existe($con, $uploaded_by, 'uploaded_by');
    }

    $updated_by = null;

    if (array_key_exists('updated_by', $in) && $in['updated_by'] !== '' && $in['updated_by'] !== null) {
        $updated_by = (int)$in['updated_by'];
        validar_usuario_si_existe($con, $updated_by, 'updated_by');
    }

    $reemplaza_archivo_id = null;

    if (array_key_exists('reemplaza_archivo_id', $in) && $in['reemplaza_archivo_id'] !== '' && $in['reemplaza_archivo_id'] !== null) {
        $reemplaza_archivo_id = (int)$in['reemplaza_archivo_id'];
        validar_archivo_reemplazo_si_existe($con, $reemplaza_archivo_id);
    }

    $uuid = str_clean($in, 'uuid') !== ''
        ? str_clean($in, 'uuid')
        : uuidv4();

    $es_actual = bool_int_from_input($in, 'es_actual', 1);
    $privado = bool_int_from_input($in, 'privado', 1);

    if (isset($in['version_no']) && (int)$in['version_no'] > 0) {
        $version_no = (int)$in['version_no'];
    } else {
        $st = $con->prepare("
            SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version
            FROM archivo
            WHERE entidad_tipo = ?
              AND entidad_id = ?
              AND uso_archivo = ?
              AND deleted_at IS NULL
        ");

        $st->bind_param("sis", $entidad_tipo, $entidad_id, $uso_archivo);
        $st->execute();

        $vr = $st->get_result()->fetch_assoc();

        $st->close();

        $version_no = (int)($vr['next_version'] ?? 1);
    }

    if ($es_actual === 1) {
        $st = $con->prepare("
            UPDATE archivo
            SET
                es_actual = 0,
                updated_by = ?
            WHERE entidad_tipo = ?
              AND entidad_id = ?
              AND uso_archivo = ?
              AND deleted_at IS NULL
        ");

        $st->bind_param("isis", $updated_by, $entidad_tipo, $entidad_id, $uso_archivo);
        $st->execute();
        $st->close();
    }

    $columns = [
        "uuid",
        "entidad_tipo",
        "entidad_id",
        "uso_archivo",
        "nombre_storage",
        "url_archivo",
        "version_no",
        "es_actual",
        "privado"
    ];

    $placeholders = ["?", "?", "?", "?", "?", "?", "?", "?", "?"];

    $params = [
        $uuid,
        $entidad_tipo,
        $entidad_id,
        $uso_archivo,
        $nombre_storage,
        $url_archivo,
        $version_no,
        $es_actual,
        $privado
    ];

    $types = "ssisssiii";

    $map = [
        "nombre_original" => "s",
        "url_thumbnail" => "s",
        "mime_type" => "s",
        "extension" => "s",
        "tamano_bytes" => "i",
        "sha256_hash" => "s"
    ];

    foreach ($map as $field => $type) {
        if (!array_key_exists($field, $in)) {
            continue;
        }

        $columns[] = $field;
        $placeholders[] = "?";
        $params[] = value_or_null($in, $field);
        $types .= $type;
    }

    if ($reemplaza_archivo_id !== null) {
        $columns[] = "reemplaza_archivo_id";
        $placeholders[] = "?";
        $params[] = $reemplaza_archivo_id;
        $types .= "i";
    }

    if ($uploaded_by !== null) {
        $columns[] = "uploaded_by";
        $placeholders[] = "?";
        $params[] = $uploaded_by;
        $types .= "i";
    }

    if ($updated_by !== null) {
        $columns[] = "updated_by";
        $placeholders[] = "?";
        $params[] = $updated_by;
        $types .= "i";
    }

    $sql = "
        INSERT INTO archivo (
            " . implode(", ", $columns) . "
        )
        VALUES (
            " . implode(", ", $placeholders) . "
        )
    ";

    $st = $con->prepare($sql);
    bind_dynamic($st, $types, $params);
    $st->execute();

    $archivo_id = (int)$con->insert_id;

    $st->close();

    return get_archivo_full($con, $archivo_id);
}

/* ============================================================
   MAIN
   ============================================================ */

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        json_response([
            "ok" => false,
            "error" => "Método no permitido. Usa POST."
        ], 405);
    }

    $in = read_json_body();
    $con = db();

    $con->begin_transaction();

    try {
        $data = insertar_archivo($con, $in);
        $con->commit();
    } catch (Throwable $e) {
        $con->rollback();
        throw $e;
    }

    $con->close();

    json_response([
        "ok" => true,
        "message" => "Archivo creado correctamente",
        "data" => $data
    ], 201);
} catch (mysqli_sql_exception $e) {
    if (isset($con) && $con instanceof mysqli) {
        try {
            $con->close();
        } catch (Throwable $ignored) {
        }
    }

    $code = (int)$e->getCode();
    $msg = $e->getMessage();

    error_log('[IXTLA_I_ARCHIVO][SQL] ' . $msg);

    if ($code === 1062) {
        $campo = "único";

        if (stripos($msg, "uuid") !== false) {
            $campo = "uuid";
        }

        json_response([
            "ok" => false,
            "error" => "Duplicado en campo $campo",
            "code" => $code
        ], 409);
    }

    if ($code === 1452) {
        json_response([
            "ok" => false,
            "error" => "FK inválida. Revisa reemplaza_archivo_id, uploaded_by o updated_by",
            "code" => $code
        ], 400);
    }

    if ($code === 1265 || $code === 1406 || $code === 1366) {
        json_response([
            "ok" => false,
            "error" => "Dato inválido o demasiado largo para algún campo",
            "code" => $code
        ], 400);
    }

    json_response([
        "ok" => false,
        "error" => "No se pudo crear el archivo",
        "code" => $code
    ], 500);
} catch (Throwable $e) {
    if (isset($con) && $con instanceof mysqli) {
        try {
            $con->close();
        } catch (Throwable $ignored) {
        }
    }

    error_log('[IXTLA_I_ARCHIVO][ERROR] ' . $e->getMessage());

    json_response([
        "ok" => false,
        "error" => "Error interno del servidor"
    ], 500);
}
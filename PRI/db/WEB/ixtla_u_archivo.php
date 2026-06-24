<?php
// db/WEB/ixtla_u_archivo.php

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
  error_log('[IXTLA_U_ARCHIVO] ' . $message);

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

function bool_int_from_input(array $in, string $key): int
{
  return ((int)$in[$key]) === 1 ? 1 : 0;
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
    "updated_by" => nullable_int_from_row($row, 'updated_by'),

    "deleted_at" => $row['deleted_at'],
    "deleted_by" => nullable_int_from_row($row, 'deleted_by')
  ];
}

/* ============================================================
   CONSULTA RESPUESTA
   ============================================================ */

function get_archivo_full(mysqli $con, int $archivo_id, bool $include_deleted = false): array
{
  $whereDeleted = $include_deleted ? "" : "AND a.deleted_at IS NULL";

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
          $whereDeleted
        LIMIT 1
    ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $archivo_id);
  $st->execute();

  $row = $st->get_result()->fetch_assoc();

  $st->close();

  if (!$row) {
    json_response([
      "ok" => false,
      "error" => "Archivo no encontrado"
    ], 404);
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

function validar_catalogos_archivo(array $in): void
{
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

  if (array_key_exists('entidad_tipo', $in)) {
    $entidad_tipo = strtoupper(trim((string)$in['entidad_tipo']));

    if (!in_array($entidad_tipo, $entidadesValidas, true)) {
      json_response([
        "ok" => false,
        "error" => "entidad_tipo inválido"
      ], 400);
    }
  }

  if (array_key_exists('uso_archivo', $in)) {
    $uso_archivo = strtoupper(trim((string)$in['uso_archivo']));

    if (!in_array($uso_archivo, $usosValidos, true)) {
      json_response([
        "ok" => false,
        "error" => "uso_archivo inválido"
      ], 400);
    }
  }
}

/* ============================================================
   UPDATE
   ============================================================ */

function actualizar_archivo(mysqli $con, array $in): array
{
  $archivo_id = isset($in['archivo_id'])
    ? (int)$in['archivo_id']
    : (isset($in['id']) ? (int)$in['id'] : 0);

  if ($archivo_id <= 0) {
    json_response([
      "ok" => false,
      "error" => "Falta parámetro obligatorio: archivo_id"
    ], 400);
  }

  validar_catalogos_archivo($in);

  $current = get_archivo_full($con, $archivo_id, false);

  $next_entidad_tipo = array_key_exists('entidad_tipo', $in)
    ? strtoupper(trim((string)$in['entidad_tipo']))
    : $current['entidad_tipo'];

  $next_entidad_id = array_key_exists('entidad_id', $in) && $in['entidad_id'] !== '' && $in['entidad_id'] !== null
    ? (int)$in['entidad_id']
    : (int)$current['entidad_id'];

  $next_uso_archivo = array_key_exists('uso_archivo', $in)
    ? strtoupper(trim((string)$in['uso_archivo']))
    : $current['uso_archivo'];

  if ($next_entidad_id <= 0) {
    json_response([
      "ok" => false,
      "error" => "entidad_id inválido"
    ], 400);
  }

  validar_entidad_relacionada($con, $next_entidad_tipo, $next_entidad_id);

  $updated_by = null;

  if (array_key_exists('updated_by', $in) && $in['updated_by'] !== '' && $in['updated_by'] !== null) {
    $updated_by = (int)$in['updated_by'];
    validar_usuario_si_existe($con, $updated_by, 'updated_by');
  }

  $deleted_by = null;

  if (array_key_exists('deleted_by', $in) && $in['deleted_by'] !== '' && $in['deleted_by'] !== null) {
    $deleted_by = (int)$in['deleted_by'];
    validar_usuario_si_existe($con, $deleted_by, 'deleted_by');
  }

  $reemplaza_archivo_id = null;

  if (array_key_exists('reemplaza_archivo_id', $in) && $in['reemplaza_archivo_id'] !== '' && $in['reemplaza_archivo_id'] !== null) {
    $reemplaza_archivo_id = (int)$in['reemplaza_archivo_id'];

    if ($reemplaza_archivo_id === $archivo_id) {
      json_response([
        "ok" => false,
        "error" => "Un archivo no puede reemplazarse a sí mismo"
      ], 400);
    }

    validar_archivo_reemplazo_si_existe($con, $reemplaza_archivo_id);
  }

  /*
      Si se marca este archivo como actual, desmarcamos los demás
      del grupo final entidad_tipo + entidad_id + uso_archivo.
    */
  $next_es_actual = array_key_exists('es_actual', $in)
    ? bool_int_from_input($in, 'es_actual')
    : (int)$current['es_actual'];

  if ($next_es_actual === 1) {
    $st = $con->prepare("
            UPDATE archivo
            SET
                es_actual = 0,
                updated_by = ?
            WHERE entidad_tipo = ?
              AND entidad_id = ?
              AND uso_archivo = ?
              AND archivo_id <> ?
              AND deleted_at IS NULL
        ");

    $st->bind_param(
      "isisi",
      $updated_by,
      $next_entidad_tipo,
      $next_entidad_id,
      $next_uso_archivo,
      $archivo_id
    );

    $st->execute();
    $st->close();
  }

  $map = [
    "entidad_tipo" => "s",
    "entidad_id" => "i",
    "uso_archivo" => "s",
    "nombre_original" => "s",
    "nombre_storage" => "s",
    "url_archivo" => "s",
    "url_thumbnail" => "s",
    "mime_type" => "s",
    "extension" => "s",
    "tamano_bytes" => "i",
    "sha256_hash" => "s",
    "version_no" => "i",
    "es_actual" => "i",
    "privado" => "i",
    "deleted_at" => "s"
  ];

  $set = [];
  $params = [];
  $types = "";

  foreach ($map as $field => $type) {
    if (!array_key_exists($field, $in)) {
      continue;
    }

    $set[] = "$field = ?";

    if (in_array($field, ['entidad_tipo', 'uso_archivo'], true)) {
      $params[] = strtoupper(trim((string)$in[$field]));
    } elseif (in_array($field, ['es_actual', 'privado'], true)) {
      $params[] = bool_int_from_input($in, $field);
    } else {
      $params[] = value_or_null($in, $field);
    }

    $types .= $type;
  }

  if ($reemplaza_archivo_id !== null) {
    $set[] = "reemplaza_archivo_id = ?";
    $params[] = $reemplaza_archivo_id;
    $types .= "i";
  } elseif (array_key_exists('reemplaza_archivo_id', $in) && ($in['reemplaza_archivo_id'] === '' || $in['reemplaza_archivo_id'] === null)) {
    $set[] = "reemplaza_archivo_id = NULL";
  }

  if ($updated_by !== null) {
    $set[] = "updated_by = ?";
    $params[] = $updated_by;
    $types .= "i";
  }

  if ($deleted_by !== null) {
    $set[] = "deleted_by = ?";
    $params[] = $deleted_by;
    $types .= "i";
  } elseif (array_key_exists('deleted_by', $in) && ($in['deleted_by'] === '' || $in['deleted_by'] === null)) {
    $set[] = "deleted_by = NULL";
  }

  if (!$set) {
    json_response([
      "ok" => false,
      "error" => "No hay campos para actualizar"
    ], 400);
  }

  $params[] = $archivo_id;
  $types .= "i";

  $sql = "
        UPDATE archivo
        SET " . implode(", ", $set) . "
        WHERE archivo_id = ?
    ";

  $st = $con->prepare($sql);
  bind_dynamic($st, $types, $params);
  $st->execute();
  $st->close();

  $include_deleted = array_key_exists('deleted_at', $in) && $in['deleted_at'] !== '' && $in['deleted_at'] !== null;

  return get_archivo_full($con, $archivo_id, $include_deleted);
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
    $data = actualizar_archivo($con, $in);
    $con->commit();
  } catch (Throwable $e) {
    $con->rollback();
    throw $e;
  }

  $con->close();

  json_response([
    "ok" => true,
    "message" => "Archivo actualizado correctamente",
    "data" => $data
  ]);
} catch (mysqli_sql_exception $e) {
  if (isset($con) && $con instanceof mysqli) {
    try {
      $con->close();
    } catch (Throwable $ignored) {
    }
  }

  $code = (int)$e->getCode();
  $msg = $e->getMessage();

  error_log('[IXTLA_U_ARCHIVO][SQL] ' . $msg);

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
      "error" => "FK inválida. Revisa reemplaza_archivo_id, updated_by o deleted_by",
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
    "error" => "No se pudo actualizar el archivo",
    "code" => $code
  ], 500);
} catch (Throwable $e) {
  if (isset($con) && $con instanceof mysqli) {
    try {
      $con->close();
    } catch (Throwable $ignored) {
    }
  }

  error_log('[IXTLA_U_ARCHIVO][ERROR] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error interno del servidor"
  ], 500);
}

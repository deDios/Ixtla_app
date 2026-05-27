<?php
// db/WEB/ixtla_c_persona_participacion.php

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

function json_response(array $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function internal_error(string $message): void {
    error_log('[IXTLA_C_PERSONA_PARTICIPACION] ' . $message);

    json_response([
        "ok" => false,
        "error" => "Error interno del servidor"
    ], 500);
}

function read_json_body(): array {
    $raw = file_get_contents("php://input");

    if (!$raw || trim($raw) === '') {
        return [];
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

function db(): mysqli {
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

    return $con;
}

function bind_dynamic(mysqli_stmt $stmt, string $types, array &$params): void {
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

function str_clean(array $in, string $key): string {
    return isset($in[$key]) ? trim((string)$in[$key]) : '';
}

function int_or_null(array $in, string $key): ?int {
    if (!isset($in[$key]) || $in[$key] === '') {
        return null;
    }

    $value = (int)$in[$key];

    return $value > 0 ? $value : null;
}

function nullable_int_from_row(array $row, string $key): ?int {
    return isset($row[$key]) && $row[$key] !== null ? (int)$row[$key] : null;
}

/* ============================================================
   FORMATTER
   ============================================================ */

function participacion_row(array $row): array {
    return [
        "participacion_id" => (int)$row['participacion_id'],
        "folio" => $row['folio'],

        "persona_id" => (int)$row['persona_id'],
        "persona" => [
            "persona_id" => (int)$row['persona_id'],
            "nombres" => $row['persona_nombres'],
            "apellido_paterno" => $row['persona_apellido_paterno'],
            "apellido_materno" => $row['persona_apellido_materno'],
            "nombre_completo" => trim(
                (string)$row['persona_nombres'] . ' ' .
                (string)$row['persona_apellido_paterno'] . ' ' .
                (string)$row['persona_apellido_materno']
            ),
            "telefono" => $row['persona_telefono'],
            "whatsapp" => $row['persona_whatsapp'],
            "email" => $row['persona_email']
        ],

        "tipo_participacion" => $row['tipo_participacion'],
        "participacion_origen_id" => nullable_int_from_row($row, 'participacion_origen_id'),

        "estatus_id" => (int)$row['estatus_id'],
        "estatus" => [
            "estatus_id" => (int)$row['estatus_id'],
            "codigo" => $row['estatus_codigo'],
            "nombre" => $row['estatus_nombre']
        ],

        "territorio_id" => nullable_int_from_row($row, 'territorio_id'),
        "territorio" => [
            "territorio_id" => nullable_int_from_row($row, 'territorio_id'),
            "codigo" => $row['territorio_codigo'],
            "nombre" => $row['territorio_nombre'],
            "tipo" => $row['territorio_tipo'],
            "municipio" => $row['territorio_municipio'],
            "estado" => $row['territorio_estado']
        ],

        "usuario_responsable_id" => nullable_int_from_row($row, 'usuario_responsable_id'),
        "usuario_responsable" => [
            "usuario_id" => nullable_int_from_row($row, 'usuario_responsable_id'),
            "username" => $row['usuario_responsable_username'],
            "nombre" => $row['usuario_responsable_nombre'],
            "apellido_paterno" => $row['usuario_responsable_apellido_paterno'],
            "apellido_materno" => $row['usuario_responsable_apellido_materno'],
            "nombre_completo" => trim(
                (string)$row['usuario_responsable_nombre'] . ' ' .
                (string)$row['usuario_responsable_apellido_paterno'] . ' ' .
                (string)$row['usuario_responsable_apellido_materno']
            )
        ],

        "fuente_captura" => $row['fuente_captura'],
        "fecha_registro" => $row['fecha_registro'],
        "fecha_afiliacion" => $row['fecha_afiliacion'],
        "numero_afiliacion" => $row['numero_afiliacion'],
        "observaciones" => $row['observaciones'],
        "activo" => (int)$row['activo'],

        "created_at" => $row['created_at'],
        "created_by" => nullable_int_from_row($row, 'created_by'),
        "updated_at" => $row['updated_at'],
        "updated_by" => nullable_int_from_row($row, 'updated_by')
    ];
}

/* ============================================================
   SQL BASE
   ============================================================ */

function base_select(): string {
    return "
        SELECT
            pp.*,

            e.codigo AS estatus_codigo,
            e.nombre AS estatus_nombre,

            t.codigo AS territorio_codigo,
            t.nombre AS territorio_nombre,
            t.tipo AS territorio_tipo,
            t.municipio AS territorio_municipio,
            t.estado AS territorio_estado,

            u.username AS usuario_responsable_username,
            u.nombre AS usuario_responsable_nombre,
            u.apellido_paterno AS usuario_responsable_apellido_paterno,
            u.apellido_materno AS usuario_responsable_apellido_materno,

            p.nombres AS persona_nombres,
            p.apellido_paterno AS persona_apellido_paterno,
            p.apellido_materno AS persona_apellido_materno,
            p.telefono AS persona_telefono,
            p.whatsapp AS persona_whatsapp,
            p.email AS persona_email

        FROM persona_participacion pp

        INNER JOIN persona p
            ON p.persona_id = pp.persona_id
           AND p.deleted_at IS NULL

        INNER JOIN cat_estatus e
            ON e.estatus_id = pp.estatus_id

        LEFT JOIN territorio t
            ON t.territorio_id = pp.territorio_id
           AND t.deleted_at IS NULL

        LEFT JOIN usuario u
            ON u.usuario_id = pp.usuario_responsable_id
           AND u.deleted_at IS NULL
    ";
}

function base_count(): string {
    return "
        FROM persona_participacion pp

        INNER JOIN persona p
            ON p.persona_id = pp.persona_id
           AND p.deleted_at IS NULL

        INNER JOIN cat_estatus e
            ON e.estatus_id = pp.estatus_id

        LEFT JOIN territorio t
            ON t.territorio_id = pp.territorio_id
           AND t.deleted_at IS NULL

        LEFT JOIN usuario u
            ON u.usuario_id = pp.usuario_responsable_id
           AND u.deleted_at IS NULL
    ";
}

/* ============================================================
   CONSULTAS
   ============================================================ */

function consultar_participacion_por_id(mysqli $con, int $participacion_id): array {
    $sql = base_select() . "
        WHERE pp.participacion_id = ?
          AND pp.deleted_at IS NULL
        LIMIT 1
    ";

    $st = $con->prepare($sql);
    $st->bind_param("i", $participacion_id);
    $st->execute();

    $row = $st->get_result()->fetch_assoc();
    $st->close();

    if (!$row) {
        json_response([
            "ok" => false,
            "error" => "Participación no encontrada"
        ], 404);
    }

    return participacion_row($row);
}

function consultar_participaciones(mysqli $con, array $in): array {
    $persona_id = int_or_null($in, 'persona_id');
    $estatus_id = int_or_null($in, 'estatus_id');
    $territorio_id = int_or_null($in, 'territorio_id');
    $usuario_responsable_id = int_or_null($in, 'usuario_responsable_id');

    $tipo_participacion = str_clean($in, 'tipo_participacion');
    $fuente_captura = str_clean($in, 'fuente_captura');

    $q = str_clean($in, 'q');

    if ($q === '') {
        $q = str_clean($in, 'search');
    }

    $activo = null;

    if (array_key_exists('activo', $in) && $in['activo'] !== '') {
        $activo = (int)$in['activo'];
        $activo = $activo === 1 ? 1 : 0;
    }

    $page = isset($in['page']) ? max(1, (int)$in['page']) : 1;

    $pageSize = 50;

    if (isset($in['page_size'])) {
        $pageSize = (int)$in['page_size'];
    } elseif (isset($in['limit'])) {
        $pageSize = (int)$in['limit'];
    }

    $pageSize = max(1, min(500, $pageSize));
    $offset = ($page - 1) * $pageSize;

    $where = [
        "pp.deleted_at IS NULL"
    ];

    $params = [];
    $types = "";

    if ($persona_id !== null) {
        $where[] = "pp.persona_id = ?";
        $params[] = $persona_id;
        $types .= "i";
    }

    if ($tipo_participacion !== '') {
        $where[] = "pp.tipo_participacion = ?";
        $params[] = $tipo_participacion;
        $types .= "s";
    }

    if ($estatus_id !== null) {
        $where[] = "pp.estatus_id = ?";
        $params[] = $estatus_id;
        $types .= "i";
    }

    if ($territorio_id !== null) {
        $where[] = "pp.territorio_id = ?";
        $params[] = $territorio_id;
        $types .= "i";
    }

    if ($usuario_responsable_id !== null) {
        $where[] = "pp.usuario_responsable_id = ?";
        $params[] = $usuario_responsable_id;
        $types .= "i";
    }

    if ($fuente_captura !== '') {
        $where[] = "pp.fuente_captura = ?";
        $params[] = $fuente_captura;
        $types .= "s";
    }

    if ($activo !== null) {
        $where[] = "pp.activo = ?";
        $params[] = $activo;
        $types .= "i";
    }

    if ($q !== '') {
        $like = "%$q%";

        $where[] = "(
            pp.folio LIKE ?
            OR pp.tipo_participacion LIKE ?
            OR pp.fuente_captura LIKE ?
            OR pp.numero_afiliacion LIKE ?
            OR pp.observaciones LIKE ?

            OR p.nombres LIKE ?
            OR p.apellido_paterno LIKE ?
            OR p.apellido_materno LIKE ?
            OR CONCAT_WS(' ', p.nombres, p.apellido_paterno, p.apellido_materno) LIKE ?
            OR p.telefono LIKE ?
            OR p.whatsapp LIKE ?
            OR p.email LIKE ?

            OR e.codigo LIKE ?
            OR e.nombre LIKE ?

            OR t.codigo LIKE ?
            OR t.nombre LIKE ?
            OR t.municipio LIKE ?
            OR t.estado LIKE ?

            OR u.username LIKE ?
            OR u.nombre LIKE ?
            OR u.apellido_paterno LIKE ?
            OR u.apellido_materno LIKE ?
            OR CONCAT_WS(' ', u.nombre, u.apellido_paterno, u.apellido_materno) LIKE ?
        )";

        for ($i = 0; $i < 23; $i++) {
            $params[] = $like;
            $types .= "s";
        }
    }

    $whereSql = implode(" AND ", $where);

    $countSql = "
        SELECT COUNT(*) AS total
        " . base_count() . "
        WHERE $whereSql
    ";

    $countParams = $params;
    $countTypes = $types;

    $stCount = $con->prepare($countSql);

    if ($countTypes !== '') {
        bind_dynamic($stCount, $countTypes, $countParams);
    }

    $stCount->execute();
    $totalRow = $stCount->get_result()->fetch_assoc();
    $stCount->close();

    $total = (int)($totalRow['total'] ?? 0);

    $sql = base_select() . "
        WHERE $whereSql
        ORDER BY
            COALESCE(pp.fecha_registro, pp.created_at) DESC,
            pp.participacion_id DESC
        LIMIT ? OFFSET ?
    ";

    $listParams = $params;
    $listTypes = $types . "ii";

    $listParams[] = $pageSize;
    $listParams[] = $offset;

    $st = $con->prepare($sql);
    bind_dynamic($st, $listTypes, $listParams);
    $st->execute();

    $rs = $st->get_result();

    $data = [];

    while ($row = $rs->fetch_assoc()) {
        $data[] = participacion_row($row);
    }

    $st->close();

    return [
        "meta" => [
            "page" => $page,
            "page_size" => $pageSize,
            "total" => $total,
            "total_pages" => $pageSize > 0 ? (int)ceil($total / $pageSize) : 0
        ],
        "data" => $data
    ];
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

    $participacion_id = null;

    if (isset($in['participacion_id'])) {
        $participacion_id = (int)$in['participacion_id'];
    } elseif (isset($in['id'])) {
        $participacion_id = (int)$in['id'];
    }

    $con = db();

    if ($participacion_id && $participacion_id > 0) {
        $data = consultar_participacion_por_id($con, $participacion_id);

        $con->close();

        json_response([
            "ok" => true,
            "data" => $data
        ]);
    }

    $result = consultar_participaciones($con, $in);

    $con->close();

    json_response([
        "ok" => true,
        "meta" => $result["meta"],
        "data" => $result["data"]
    ]);

} catch (mysqli_sql_exception $e) {
    if (isset($con) && $con instanceof mysqli) {
        try {
            $con->close();
        } catch (Throwable $ignored) {}
    }

    error_log('[IXTLA_C_PERSONA_PARTICIPACION][SQL] ' . $e->getMessage());

    json_response([
        "ok" => false,
        "error" => "Error al consultar participaciones"
    ], 500);

} catch (Throwable $e) {
    if (isset($con) && $con instanceof mysqli) {
        try {
            $con->close();
        } catch (Throwable $ignored) {}
    }

    error_log('[IXTLA_C_PERSONA_PARTICIPACION][ERROR] ' . $e->getMessage());

    json_response([
        "ok" => false,
        "error" => "Error interno del servidor"
    ], 500);
}
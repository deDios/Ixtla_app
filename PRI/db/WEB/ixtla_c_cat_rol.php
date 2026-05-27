<?php
// db/WEB/ixtla_c_cat_rol.php

declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
date_default_timezone_set('America/Mexico_City');

/* ============================================================
   CORS / SEGURIDAD
   Mismas reglas base que ixtla_admin_service.php
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
    error_log('[IXTLA_C_CAT_ROL] ' . $message);

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

/* ============================================================
   FORMATTER
   ============================================================ */

function rol_row(array $row): array {
    return [
        "rol_id" => (int)$row['rol_id'],
        "codigo" => $row['codigo'],
        "nombre" => $row['nombre'],
        "descripcion" => $row['descripcion'],
        "nivel_jerarquico" => (int)$row['nivel_jerarquico'],
        "activo" => (int)$row['activo'],
        "created_at" => $row['created_at'],
        "updated_at" => $row['updated_at']
    ];
}

/* ============================================================
   CONSULTAS
   ============================================================ */

function consultar_rol_por_id(mysqli $con, int $rol_id): array {
    $sql = "
        SELECT *
        FROM cat_rol
        WHERE rol_id = ?
        LIMIT 1
    ";

    $st = $con->prepare($sql);
    $st->bind_param("i", $rol_id);
    $st->execute();

    $row = $st->get_result()->fetch_assoc();
    $st->close();

    if (!$row) {
        json_response([
            "ok" => false,
            "error" => "Rol no encontrado"
        ], 404);
    }

    return rol_row($row);
}

function consultar_rol_por_codigo(mysqli $con, string $codigo): array {
    $sql = "
        SELECT *
        FROM cat_rol
        WHERE codigo COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
        LIMIT 1
    ";

    $st = $con->prepare($sql);
    $st->bind_param("s", $codigo);
    $st->execute();

    $row = $st->get_result()->fetch_assoc();
    $st->close();

    if (!$row) {
        json_response([
            "ok" => false,
            "error" => "Rol no encontrado"
        ], 404);
    }

    return rol_row($row);
}

function consultar_roles(mysqli $con, array $in): array {
    $q = str_clean($in, 'q');

    if ($q === '') {
        $q = str_clean($in, 'search');
    }

    $nivel_jerarquico = int_or_null($in, 'nivel_jerarquico');

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

    $where = ["1 = 1"];
    $params = [];
    $types = "";

    if ($activo !== null) {
        $where[] = "activo = ?";
        $params[] = $activo;
        $types .= "i";
    }

    if ($nivel_jerarquico !== null) {
        $where[] = "nivel_jerarquico = ?";
        $params[] = $nivel_jerarquico;
        $types .= "i";
    }

    if ($q !== '') {
        $like = "%$q%";

        $where[] = "(
            codigo LIKE ?
            OR nombre LIKE ?
            OR descripcion LIKE ?
        )";

        for ($i = 0; $i < 3; $i++) {
            $params[] = $like;
            $types .= "s";
        }
    }

    $whereSql = implode(" AND ", $where);

    $countSql = "
        SELECT COUNT(*) AS total
        FROM cat_rol
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

    $sql = "
        SELECT *
        FROM cat_rol
        WHERE $whereSql
        ORDER BY nivel_jerarquico ASC, rol_id ASC
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
        $data[] = rol_row($row);
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

    $rol_id = null;

    if (isset($in['rol_id'])) {
        $rol_id = (int)$in['rol_id'];
    } elseif (isset($in['id'])) {
        $rol_id = (int)$in['id'];
    }

    $codigo = '';

    if (isset($in['codigo'])) {
        $codigo = strtoupper(trim((string)$in['codigo']));
    }

    $con = db();

    if ($rol_id && $rol_id > 0) {
        $data = consultar_rol_por_id($con, $rol_id);

        $con->close();

        json_response([
            "ok" => true,
            "data" => $data
        ]);
    }

    if ($codigo !== '') {
        $data = consultar_rol_por_codigo($con, $codigo);

        $con->close();

        json_response([
            "ok" => true,
            "data" => $data
        ]);
    }

    $result = consultar_roles($con, $in);

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

    error_log('[IXTLA_C_CAT_ROL][SQL] ' . $e->getMessage());

    json_response([
        "ok" => false,
        "error" => "Error al consultar roles"
    ], 500);

} catch (Throwable $e) {
    if (isset($con) && $con instanceof mysqli) {
        try {
            $con->close();
        } catch (Throwable $ignored) {}
    }

    error_log('[IXTLA_C_CAT_ROL][ERROR] ' . $e->getMessage());

    json_response([
        "ok" => false,
        "error" => "Error interno del servidor"
    ], 500);
}
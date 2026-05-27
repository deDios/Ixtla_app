<?php
// db/WEB/ixtla_c_territorio.php

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
  error_log('[IXTLA_C_TERRITORIO] ' . $message);

  json_response([
    "ok" => false,
    "error" => "Error interno del servidor"
  ], 500);
}

function read_json_body(): array
{
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

  return $con;
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

function int_or_null(array $in, string $key): ?int
{
  if (!isset($in[$key]) || $in[$key] === '') {
    return null;
  }

  $value = (int)$in[$key];

  return $value > 0 ? $value : null;
}

function nullable_int_from_row(array $row, string $key): ?int
{
  return isset($row[$key]) && $row[$key] !== null ? (int)$row[$key] : null;
}

/* ============================================================
   FORMATTER
   ============================================================ */

function territorio_row(array $row): array
{
  return [
    "territorio_id" => (int)$row['territorio_id'],
    "territorio_padre_id" => nullable_int_from_row($row, 'territorio_padre_id'),

    "tipo" => $row['tipo'],
    "codigo" => $row['codigo'],
    "nombre" => $row['nombre'],

    "municipio" => $row['municipio'],
    "estado" => $row['estado'],
    "distrito_local" => $row['distrito_local'],
    "distrito_federal" => $row['distrito_federal'],

    "activo" => (int)$row['activo'],

    "padre" => [
      "territorio_id" => nullable_int_from_row($row, 'padre_id'),
      "tipo" => $row['padre_tipo'],
      "codigo" => $row['padre_codigo'],
      "nombre" => $row['padre_nombre']
    ],

    "created_at" => $row['created_at'],
    "created_by" => nullable_int_from_row($row, 'created_by'),
    "updated_at" => $row['updated_at'],
    "updated_by" => nullable_int_from_row($row, 'updated_by')
  ];
}

/* ============================================================
   SQL BASE
   ============================================================ */

function base_select(): string
{
  return "
        SELECT
            t.*,

            p.territorio_id AS padre_id,
            p.tipo AS padre_tipo,
            p.codigo AS padre_codigo,
            p.nombre AS padre_nombre

        FROM territorio t

        LEFT JOIN territorio p
            ON p.territorio_id = t.territorio_padre_id
           AND p.deleted_at IS NULL
    ";
}

function base_count(): string
{
  return "
        FROM territorio t

        LEFT JOIN territorio p
            ON p.territorio_id = t.territorio_padre_id
           AND p.deleted_at IS NULL
    ";
}

/* ============================================================
   CONSULTAS AUXILIARES
   ============================================================ */

function get_secciones_zona(mysqli $con, int $zona_id, ?int $activo = null): array
{
  $where = [
    "t.territorio_padre_id = ?",
    "t.tipo = 'SECCION'",
    "t.deleted_at IS NULL"
  ];

  $params = [$zona_id];
  $types = "i";

  if ($activo !== null) {
    $where[] = "t.activo = ?";
    $params[] = $activo;
    $types .= "i";
  }

  $sql = base_select() . "
        WHERE " . implode(" AND ", $where) . "
        ORDER BY t.codigo ASC, t.nombre ASC
    ";

  $st = $con->prepare($sql);
  bind_dynamic($st, $types, $params);
  $st->execute();

  $rs = $st->get_result();

  $items = [];

  while ($row = $rs->fetch_assoc()) {
    $items[] = territorio_row($row);
  }

  $st->close();

  return $items;
}

/* ============================================================
   CONSULTAS
   ============================================================ */

function consultar_territorio_por_id(mysqli $con, int $territorio_id, bool $include_secciones, ?int $activo_secciones): array
{
  $sql = base_select() . "
        WHERE t.territorio_id = ?
          AND t.deleted_at IS NULL
        LIMIT 1
    ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $territorio_id);
  $st->execute();

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    json_response([
      "ok" => false,
      "error" => "Territorio no encontrado"
    ], 404);
  }

  $data = territorio_row($row);

  if ($include_secciones && $data['tipo'] === 'ZONA') {
    $data['secciones'] = get_secciones_zona($con, (int)$data['territorio_id'], $activo_secciones);
  }

  return $data;
}

function consultar_territorio_por_codigo(mysqli $con, string $codigo, bool $include_secciones, ?int $activo_secciones): array
{
  $sql = base_select() . "
        WHERE t.codigo COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
          AND t.deleted_at IS NULL
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
      "error" => "Territorio no encontrado"
    ], 404);
  }

  $data = territorio_row($row);

  if ($include_secciones && $data['tipo'] === 'ZONA') {
    $data['secciones'] = get_secciones_zona($con, (int)$data['territorio_id'], $activo_secciones);
  }

  return $data;
}

function consultar_territorios(mysqli $con, array $in): array
{
  $territorio_padre_id = int_or_null($in, 'territorio_padre_id');

  $tipo = strtoupper(str_clean($in, 'tipo'));
  $codigo = str_clean($in, 'codigo');

  $q = str_clean($in, 'q');

  if ($q === '') {
    $q = str_clean($in, 'search');
  }

  $include_secciones = !empty($in['include_secciones']);

  $activo = null;

  if (array_key_exists('activo', $in) && $in['activo'] !== '') {
    $activo = (int)$in['activo'];
    $activo = $activo === 1 ? 1 : 0;
  }

  $activo_secciones = null;

  if (array_key_exists('activo_secciones', $in) && $in['activo_secciones'] !== '') {
    $activo_secciones = (int)$in['activo_secciones'];
    $activo_secciones = $activo_secciones === 1 ? 1 : 0;
  } elseif ($activo !== null) {
    $activo_secciones = $activo;
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
    "t.deleted_at IS NULL"
  ];

  $params = [];
  $types = "";

  if ($tipo !== '') {
    $where[] = "t.tipo = ?";
    $params[] = $tipo;
    $types .= "s";
  }

  if ($territorio_padre_id !== null) {
    $where[] = "t.territorio_padre_id = ?";
    $params[] = $territorio_padre_id;
    $types .= "i";
  }

  if ($activo !== null) {
    $where[] = "t.activo = ?";
    $params[] = $activo;
    $types .= "i";
  }

  if ($q !== '') {
    $like = "%$q%";

    $where[] = "(
            t.codigo LIKE ?
            OR t.nombre LIKE ?
            OR t.municipio LIKE ?
            OR t.estado LIKE ?
            OR t.distrito_local LIKE ?
            OR t.distrito_federal LIKE ?
            OR p.codigo LIKE ?
            OR p.nombre LIKE ?
        )";

    for ($i = 0; $i < 8; $i++) {
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
            FIELD(t.tipo, 'ZONA', 'SECCION'),
            t.codigo ASC,
            t.nombre ASC
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
    $item = territorio_row($row);

    if ($include_secciones && $item['tipo'] === 'ZONA') {
      $item['secciones'] = get_secciones_zona($con, (int)$item['territorio_id'], $activo_secciones);
    }

    $data[] = $item;
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

  $territorio_id = null;

  if (isset($in['territorio_id'])) {
    $territorio_id = (int)$in['territorio_id'];
  } elseif (isset($in['id'])) {
    $territorio_id = (int)$in['id'];
  }

  $codigo = str_clean($in, 'codigo');
  $include_secciones = !empty($in['include_secciones']);

  $activo_secciones = null;

  if (array_key_exists('activo_secciones', $in) && $in['activo_secciones'] !== '') {
    $activo_secciones = (int)$in['activo_secciones'];
    $activo_secciones = $activo_secciones === 1 ? 1 : 0;
  } elseif (array_key_exists('activo', $in) && $in['activo'] !== '') {
    $activo_secciones = (int)$in['activo'];
    $activo_secciones = $activo_secciones === 1 ? 1 : 0;
  }

  $con = db();

  if ($territorio_id && $territorio_id > 0) {
    $data = consultar_territorio_por_id($con, $territorio_id, $include_secciones, $activo_secciones);

    $con->close();

    json_response([
      "ok" => true,
      "data" => $data
    ]);
  }

  if ($codigo !== '') {
    $data = consultar_territorio_por_codigo($con, $codigo, $include_secciones, $activo_secciones);

    $con->close();

    json_response([
      "ok" => true,
      "data" => $data
    ]);
  }

  $result = consultar_territorios($con, $in);

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
    } catch (Throwable $ignored) {
    }
  }

  error_log('[IXTLA_C_TERRITORIO][SQL] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error al consultar territorios"
  ], 500);
} catch (Throwable $e) {
  if (isset($con) && $con instanceof mysqli) {
    try {
      $con->close();
    } catch (Throwable $ignored) {
    }
  }

  error_log('[IXTLA_C_TERRITORIO][ERROR] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error interno del servidor"
  ], 500);
}

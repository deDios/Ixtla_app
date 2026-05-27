<?php
// db/WEB/ixtla_c_bitacora_registro.php

declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
date_default_timezone_set('America/Mexico_City');

/* ============================================================
   CORS / SEGURIDAD
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
  error_log('[IXTLA_C_BITACORA_REGISTRO] ' . $message);

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

function decode_json_field(mixed $value): mixed
{
  if ($value === null || $value === '') {
    return null;
  }

  if (!is_string($value)) {
    return $value;
  }

  $decoded = json_decode($value, true);

  return json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
}

function normalize_date_start(string $value): string
{
  $value = trim($value);

  if ($value === '') {
    return '';
  }

  return strlen($value) === 10 ? $value . " 00:00:00" : $value;
}

function normalize_date_end(string $value): string
{
  $value = trim($value);

  if ($value === '') {
    return '';
  }

  return strlen($value) === 10 ? $value . " 23:59:59" : $value;
}

/* ============================================================
   FORMATTER
   ============================================================ */

function bitacora_row(array $row): array
{
  return [
    "bitacora_id" => (int)$row['bitacora_id'],
    "tabla_nombre" => $row['tabla_nombre'],
    "registro_id" => (int)$row['registro_id'],
    "accion" => $row['accion'],
    "descripcion" => $row['descripcion'],

    "valores_anteriores" => decode_json_field($row['valores_anteriores']),
    "valores_nuevos" => decode_json_field($row['valores_nuevos']),

    "realizado_por" => nullable_int_from_row($row, 'realizado_por'),
    "realizado_por_usuario" => [
      "usuario_id" => nullable_int_from_row($row, 'realizado_por'),
      "username" => $row['realizado_por_username'],
      "nombre" => $row['realizado_por_nombre'],
      "apellido_paterno" => $row['realizado_por_apellido_paterno'],
      "apellido_materno" => $row['realizado_por_apellido_materno'],
      "nombre_completo" => trim(
        (string)$row['realizado_por_nombre'] . ' ' .
          (string)$row['realizado_por_apellido_paterno'] . ' ' .
          (string)$row['realizado_por_apellido_materno']
      )
    ],

    "realizado_at" => $row['realizado_at'],
    "ip_origen" => $row['ip_origen'],
    "user_agent" => $row['user_agent']
  ];
}

/* ============================================================
   SQL BASE
   ============================================================ */

function base_select(): string
{
  return "
        SELECT
            b.*,

            u.username AS realizado_por_username,
            u.nombre AS realizado_por_nombre,
            u.apellido_paterno AS realizado_por_apellido_paterno,
            u.apellido_materno AS realizado_por_apellido_materno

        FROM bitacora_registro b

        LEFT JOIN usuario u
            ON u.usuario_id = b.realizado_por
           AND u.deleted_at IS NULL
    ";
}

function base_count(): string
{
  return "
        FROM bitacora_registro b

        LEFT JOIN usuario u
            ON u.usuario_id = b.realizado_por
           AND u.deleted_at IS NULL
    ";
}

/* ============================================================
   CONSULTAS
   ============================================================ */

function consultar_bitacora_por_id(mysqli $con, int $bitacora_id): array
{
  $sql = base_select() . "
        WHERE b.bitacora_id = ?
        LIMIT 1
    ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $bitacora_id);
  $st->execute();

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    json_response([
      "ok" => false,
      "error" => "Registro de bitácora no encontrado"
    ], 404);
  }

  return bitacora_row($row);
}

function consultar_bitacora(mysqli $con, array $in): array
{
  $tabla_nombre = str_clean($in, 'tabla_nombre');
  $accion = str_clean($in, 'accion');

  $registro_id = int_or_null($in, 'registro_id');
  $realizado_por = int_or_null($in, 'realizado_por');

  $fecha_inicio = normalize_date_start(str_clean($in, 'fecha_inicio'));
  $fecha_fin = normalize_date_end(str_clean($in, 'fecha_fin'));

  $q = str_clean($in, 'q');

  if ($q === '') {
    $q = str_clean($in, 'search');
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

  if ($tabla_nombre !== '') {
    $where[] = "b.tabla_nombre = ?";
    $params[] = $tabla_nombre;
    $types .= "s";
  }

  if ($registro_id !== null) {
    $where[] = "b.registro_id = ?";
    $params[] = $registro_id;
    $types .= "i";
  }

  if ($accion !== '') {
    $where[] = "b.accion = ?";
    $params[] = $accion;
    $types .= "s";
  }

  if ($realizado_por !== null) {
    $where[] = "b.realizado_por = ?";
    $params[] = $realizado_por;
    $types .= "i";
  }

  if ($fecha_inicio !== '') {
    $where[] = "b.realizado_at >= ?";
    $params[] = $fecha_inicio;
    $types .= "s";
  }

  if ($fecha_fin !== '') {
    $where[] = "b.realizado_at <= ?";
    $params[] = $fecha_fin;
    $types .= "s";
  }

  if ($q !== '') {
    $like = "%$q%";

    $where[] = "(
            b.tabla_nombre LIKE ?
            OR b.accion LIKE ?
            OR b.descripcion LIKE ?
            OR b.ip_origen LIKE ?
            OR b.user_agent LIKE ?
            OR u.username LIKE ?
            OR u.nombre LIKE ?
            OR u.apellido_paterno LIKE ?
            OR u.apellido_materno LIKE ?
            OR CONCAT_WS(' ', u.nombre, u.apellido_paterno, u.apellido_materno) LIKE ?
        )";

    for ($i = 0; $i < 10; $i++) {
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
            b.realizado_at DESC,
            b.bitacora_id DESC
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
    $data[] = bitacora_row($row);
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

  $bitacora_id = null;

  if (isset($in['bitacora_id'])) {
    $bitacora_id = (int)$in['bitacora_id'];
  } elseif (isset($in['id'])) {
    $bitacora_id = (int)$in['id'];
  }

  $con = db();

  if ($bitacora_id && $bitacora_id > 0) {
    $data = consultar_bitacora_por_id($con, $bitacora_id);

    $con->close();

    json_response([
      "ok" => true,
      "data" => $data
    ]);
  }

  $result = consultar_bitacora($con, $in);

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

  error_log('[IXTLA_C_BITACORA_REGISTRO][SQL] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error al consultar bitácora"
  ], 500);
} catch (Throwable $e) {
  if (isset($con) && $con instanceof mysqli) {
    try {
      $con->close();
    } catch (Throwable $ignored) {
    }
  }

  error_log('[IXTLA_C_BITACORA_REGISTRO][ERROR] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error interno del servidor"
  ], 500);
}

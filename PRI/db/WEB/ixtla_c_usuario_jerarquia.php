<?php
// db/WEB/ixtla_c_usuario_jerarquia.php

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
  error_log('[IXTLA_C_USUARIO_JERARQUIA] ' . $message);

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
  $con->query("SET time_zone='-06:00'");

  return $con;
}

function bind_params(mysqli_stmt $stmt, string $types, array &$params): void
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

function int_or_null(array $in, string $key): ?int
{
  if (!isset($in[$key]) || $in[$key] === '') {
    return null;
  }

  $value = (int)$in[$key];

  return $value > 0 ? $value : null;
}

function str_clean(array $in, string $key): string
{
  return isset($in[$key]) ? trim((string)$in[$key]) : '';
}

function nullable_int_from_row(array $row, string $key): ?int
{
  return isset($row[$key]) && $row[$key] !== null ? (int)$row[$key] : null;
}

/* ============================================================
   FORMATTERS
   ============================================================ */

function usuario_min_row(array $row, string $prefix): array
{
  $nombreCompleto = trim(
    (string)($row[$prefix . '_nombre'] ?? '') . ' ' .
      (string)($row[$prefix . '_apellido_paterno'] ?? '') . ' ' .
      (string)($row[$prefix . '_apellido_materno'] ?? '')
  );

  return [
    "usuario_id" => nullable_int_from_row($row, $prefix . '_usuario_id'),
    "uuid" => $row[$prefix . '_uuid'] ?? null,
    "username" => $row[$prefix . '_username'] ?? null,
    "persona_id" => nullable_int_from_row($row, $prefix . '_persona_id'),
    "rol_id" => nullable_int_from_row($row, $prefix . '_rol_id'),
    "nombre" => $row[$prefix . '_nombre'] ?? null,
    "apellido_paterno" => $row[$prefix . '_apellido_paterno'] ?? null,
    "apellido_materno" => $row[$prefix . '_apellido_materno'] ?? null,
    "nombre_completo" => $nombreCompleto,
    "email" => $row[$prefix . '_email'] ?? null,
    "telefono" => $row[$prefix . '_telefono'] ?? null,
    "estatus_id" => nullable_int_from_row($row, $prefix . '_estatus_id')
  ];
}

function jerarquia_row(array $row): array
{
  return [
    "usuario_jerarquia_id" => (int)$row['usuario_jerarquia_id'],
    "usuario_padre_id" => (int)$row['usuario_padre_id'],
    "usuario_hijo_id" => (int)$row['usuario_hijo_id'],
    "fecha_inicio" => $row['fecha_inicio'],
    "fecha_fin" => $row['fecha_fin'],
    "activo" => (int)$row['activo'],

    "padre" => usuario_min_row($row, 'padre'),
    "hijo" => usuario_min_row($row, 'hijo'),

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
      uj.usuario_jerarquia_id,
      uj.usuario_padre_id,
      uj.usuario_hijo_id,
      uj.fecha_inicio,
      uj.fecha_fin,
      uj.activo,
      uj.created_at,
      uj.created_by,
      uj.updated_at,
      uj.updated_by,

      up.usuario_id AS padre_usuario_id,
      up.uuid AS padre_uuid,
      up.username AS padre_username,
      up.persona_id AS padre_persona_id,
      up.rol_id AS padre_rol_id,
      up.nombre AS padre_nombre,
      up.apellido_paterno AS padre_apellido_paterno,
      up.apellido_materno AS padre_apellido_materno,
      up.email AS padre_email,
      up.telefono AS padre_telefono,
      up.estatus_id AS padre_estatus_id,

      uh.usuario_id AS hijo_usuario_id,
      uh.uuid AS hijo_uuid,
      uh.username AS hijo_username,
      uh.persona_id AS hijo_persona_id,
      uh.rol_id AS hijo_rol_id,
      uh.nombre AS hijo_nombre,
      uh.apellido_paterno AS hijo_apellido_paterno,
      uh.apellido_materno AS hijo_apellido_materno,
      uh.email AS hijo_email,
      uh.telefono AS hijo_telefono,
      uh.estatus_id AS hijo_estatus_id

    FROM usuario_jerarquia uj

    INNER JOIN usuario up
      ON up.usuario_id = uj.usuario_padre_id
     AND up.deleted_at IS NULL

    INNER JOIN usuario uh
      ON uh.usuario_id = uj.usuario_hijo_id
     AND uh.deleted_at IS NULL
  ";
}

/* ============================================================
   CONSULTAS
   ============================================================ */

function consultar_jerarquia_por_id(mysqli $con, int $usuario_jerarquia_id): array
{
  $sql = base_select() . "
    WHERE uj.usuario_jerarquia_id = ?
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $usuario_jerarquia_id);
  $st->execute();

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    json_response([
      "ok" => false,
      "error" => "Relación de jerarquía no encontrada"
    ], 404);
  }

  return jerarquia_row($row);
}

function consultar_jerarquias(mysqli $con, array $in): array
{
  $q = str_clean($in, 'q');

  if ($q === '') {
    $q = str_clean($in, 'search');
  }

  $usuario_padre_id = int_or_null($in, 'usuario_padre_id');
  $usuario_hijo_id = int_or_null($in, 'usuario_hijo_id');
  $created_by = int_or_null($in, 'created_by');
  $updated_by = int_or_null($in, 'updated_by');

  $activo = null;

  if (array_key_exists('activo', $in) && $in['activo'] !== '') {
    $activo = ((int)$in['activo']) === 1 ? 1 : 0;
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

  $where = [];
  $params = [];
  $types = "";

  if ($usuario_padre_id !== null) {
    $where[] = "uj.usuario_padre_id = ?";
    $params[] = $usuario_padre_id;
    $types .= "i";
  }

  if ($usuario_hijo_id !== null) {
    $where[] = "uj.usuario_hijo_id = ?";
    $params[] = $usuario_hijo_id;
    $types .= "i";
  }

  if ($activo !== null) {
    $where[] = "uj.activo = ?";
    $params[] = $activo;
    $types .= "i";
  }

  if ($created_by !== null) {
    $where[] = "uj.created_by = ?";
    $params[] = $created_by;
    $types .= "i";
  }

  if ($updated_by !== null) {
    $where[] = "uj.updated_by = ?";
    $params[] = $updated_by;
    $types .= "i";
  }

  if ($q !== '') {
    $like = "%$q%";

    $where[] = "(
      up.username LIKE ?
      OR up.nombre LIKE ?
      OR up.apellido_paterno LIKE ?
      OR up.apellido_materno LIKE ?
      OR CONCAT_WS(' ', up.nombre, up.apellido_paterno, up.apellido_materno) LIKE ?
      OR up.email LIKE ?
      OR up.telefono LIKE ?

      OR uh.username LIKE ?
      OR uh.nombre LIKE ?
      OR uh.apellido_paterno LIKE ?
      OR uh.apellido_materno LIKE ?
      OR CONCAT_WS(' ', uh.nombre, uh.apellido_paterno, uh.apellido_materno) LIKE ?
      OR uh.email LIKE ?
      OR uh.telefono LIKE ?
    )";

    for ($i = 0; $i < 14; $i++) {
      $params[] = $like;
      $types .= "s";
    }
  }

  $whereSql = !empty($where)
    ? "WHERE " . implode(" AND ", $where)
    : "";

  $countSql = "
    SELECT COUNT(*) AS total
    FROM usuario_jerarquia uj

    INNER JOIN usuario up
      ON up.usuario_id = uj.usuario_padre_id
     AND up.deleted_at IS NULL

    INNER JOIN usuario uh
      ON uh.usuario_id = uj.usuario_hijo_id
     AND uh.deleted_at IS NULL

    $whereSql
  ";

  $stCount = $con->prepare($countSql);

  if ($types !== '') {
    $countParams = $params;
    bind_params($stCount, $types, $countParams);
  }

  $stCount->execute();
  $totalRow = $stCount->get_result()->fetch_assoc();
  $stCount->close();

  $total = (int)($totalRow['total'] ?? 0);

  $sql = base_select() . "
    $whereSql
    ORDER BY
      uj.activo DESC,
      uj.fecha_inicio DESC,
      uj.usuario_jerarquia_id DESC
    LIMIT ? OFFSET ?
  ";

  $listParams = $params;
  $listTypes = $types . "ii";

  $listParams[] = $pageSize;
  $listParams[] = $offset;

  $st = $con->prepare($sql);
  bind_params($st, $listTypes, $listParams);
  $st->execute();

  $rs = $st->get_result();

  $data = [];

  while ($row = $rs->fetch_assoc()) {
    $data[] = jerarquia_row($row);
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

  $usuario_jerarquia_id = null;

  if (isset($in['usuario_jerarquia_id'])) {
    $usuario_jerarquia_id = (int)$in['usuario_jerarquia_id'];
  } elseif (isset($in['id'])) {
    $usuario_jerarquia_id = (int)$in['id'];
  }

  $con = db();

  if ($usuario_jerarquia_id && $usuario_jerarquia_id > 0) {
    $data = consultar_jerarquia_por_id($con, $usuario_jerarquia_id);
    $con->close();

    json_response([
      "ok" => true,
      "data" => $data
    ]);
  }

  $result = consultar_jerarquias($con, $in);
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

  error_log('[IXTLA_C_USUARIO_JERARQUIA][SQL] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error de base de datos"
  ], 500);
} catch (Throwable $e) {
  if (isset($con) && $con instanceof mysqli) {
    try {
      $con->close();
    } catch (Throwable $ignored) {
    }
  }

  error_log('[IXTLA_C_USUARIO_JERARQUIA][ERR] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error interno del servidor"
  ], 500);
}
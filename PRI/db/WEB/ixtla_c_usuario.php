<?php
// db/WEB/ixtla_c_usuario.php

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
  error_log('[IXTLA_C_USUARIO] ' . $message);

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

function upper_clean(array $in, string $key): string
{
  return isset($in[$key]) ? strtoupper(trim((string)$in[$key])) : '';
}

function nullable_int_from_row(array $row, string $key): ?int
{
  return isset($row[$key]) && $row[$key] !== null ? (int)$row[$key] : null;
}

/* ============================================================
   FORMATTER
   ============================================================ */

function usuario_row(array $row): array
{
  $nombreCompleto = trim(
    (string)$row['nombre'] . ' ' .
      (string)$row['apellido_paterno'] . ' ' .
      (string)$row['apellido_materno']
  );

  $personaNombreCompleto = trim(
    (string)($row['persona_nombres'] ?? '') . ' ' .
      (string)($row['persona_apellido_paterno'] ?? '') . ' ' .
      (string)($row['persona_apellido_materno'] ?? '')
  );

  return [
    "usuario_id" => (int)$row['usuario_id'],
    "uuid" => $row['uuid'],
    "username" => $row['username'],
    "persona_id" => nullable_int_from_row($row, 'persona_id'),

    "rol_id" => (int)$row['rol_id'],
    "rol" => [
      "rol_id" => (int)$row['rol_id'],
      "codigo" => $row['rol_codigo'],
      "nombre" => $row['rol_nombre'],
      "nivel_jerarquico" => nullable_int_from_row($row, 'nivel_jerarquico')
    ],

    "nombre" => $row['nombre'],
    "apellido_paterno" => $row['apellido_paterno'],
    "apellido_materno" => $row['apellido_materno'],
    "nombre_completo" => $nombreCompleto,
    "email" => $row['email'],
    "telefono" => $row['telefono'],

    "estatus_id" => (int)$row['estatus_id'],
    "estatus" => [
      "estatus_id" => (int)$row['estatus_id'],
      "codigo" => $row['estatus_codigo'],
      "nombre" => $row['estatus_nombre']
    ],

    "ultimo_login_at" => $row['ultimo_login_at'],
    "ultimo_login_ip" => $row['ultimo_login_ip'],
    "requiere_cambio_password" => (int)$row['requiere_cambio_password'],
    "intentos_fallidos" => (int)$row['intentos_fallidos'],
    "bloqueado_hasta" => $row['bloqueado_hasta'],
    "token_version" => (int)$row['token_version'],

    "persona" => [
      "persona_id" => nullable_int_from_row($row, 'persona_id'),
      "uuid" => $row['persona_uuid'],
      "nombres" => $row['persona_nombres'],
      "apellido_paterno" => $row['persona_apellido_paterno'],
      "apellido_materno" => $row['persona_apellido_materno'],
      "nombre_completo" => $personaNombreCompleto !== '' ? $personaNombreCompleto : null,
      "telefono" => $row['persona_telefono'],
      "whatsapp" => $row['persona_whatsapp'],
      "email" => $row['persona_email'],
      "estatus_id" => nullable_int_from_row($row, 'persona_estatus_id')
    ],

    "created_at" => $row['created_at'],
    "created_by" => nullable_int_from_row($row, 'created_by'),
    "updated_at" => $row['updated_at'],
    "updated_by" => nullable_int_from_row($row, 'updated_by'),
    "deleted_at" => $row['deleted_at'],
    "deleted_by" => nullable_int_from_row($row, 'deleted_by')
  ];
}

/* ============================================================
   SQL BASE
   ============================================================ */

function base_select(): string
{
  return "
    SELECT
      u.usuario_id,
      u.uuid,
      u.username,
      u.persona_id,
      u.rol_id,
      u.nombre,
      u.apellido_paterno,
      u.apellido_materno,
      u.email,
      u.telefono,
      u.estatus_id,
      u.ultimo_login_at,
      u.ultimo_login_ip,
      u.requiere_cambio_password,
      u.intentos_fallidos,
      u.bloqueado_hasta,
      u.token_version,
      u.created_at,
      u.created_by,
      u.updated_at,
      u.updated_by,
      u.deleted_at,
      u.deleted_by,

      r.codigo AS rol_codigo,
      r.nombre AS rol_nombre,
      r.nivel_jerarquico,

      e.codigo AS estatus_codigo,
      e.nombre AS estatus_nombre,

      p.uuid AS persona_uuid,
      p.nombres AS persona_nombres,
      p.apellido_paterno AS persona_apellido_paterno,
      p.apellido_materno AS persona_apellido_materno,
      p.telefono AS persona_telefono,
      p.whatsapp AS persona_whatsapp,
      p.email AS persona_email,
      p.estatus_id AS persona_estatus_id

    FROM usuario u

    INNER JOIN cat_rol r
      ON r.rol_id = u.rol_id

    INNER JOIN cat_estatus e
      ON e.estatus_id = u.estatus_id

    LEFT JOIN persona p
      ON p.persona_id = u.persona_id
     AND p.deleted_at IS NULL
  ";
}

/* ============================================================
   CONSULTAS
   ============================================================ */

function consultar_usuario_detalle(mysqli $con, string $whereSql, string $types, array $params): array
{
  $sql = base_select() . "
    WHERE $whereSql
    LIMIT 1
  ";

  $st = $con->prepare($sql);

  if ($types !== '') {
    bind_params($st, $types, $params);
  }

  $st->execute();

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    json_response([
      "ok" => false,
      "error" => "Usuario no encontrado"
    ], 404);
  }

  return usuario_row($row);
}

function consultar_usuarios(mysqli $con, array $in): array
{
  $q = str_clean($in, 'q');

  if ($q === '') {
    $q = str_clean($in, 'search');
  }

  $persona_id = int_or_null($in, 'persona_id');
  $rol_id = int_or_null($in, 'rol_id');
  $estatus_id = int_or_null($in, 'estatus_id');
  $created_by = int_or_null($in, 'created_by');
  $updated_by = int_or_null($in, 'updated_by');

  $rol_codigo = upper_clean($in, 'rol_codigo');
  $estatus_codigo = upper_clean($in, 'estatus_codigo');

  $include_deleted = isset($in['include_deleted']) && (int)$in['include_deleted'] === 1;

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

  if (!$include_deleted) {
    $where[] = "u.deleted_at IS NULL";
  }

  if ($persona_id !== null) {
    $where[] = "u.persona_id = ?";
    $params[] = $persona_id;
    $types .= "i";
  }

  if ($rol_id !== null) {
    $where[] = "u.rol_id = ?";
    $params[] = $rol_id;
    $types .= "i";
  }

  if ($rol_codigo !== '') {
    $where[] = "r.codigo = ?";
    $params[] = $rol_codigo;
    $types .= "s";
  }

  if ($estatus_id !== null) {
    $where[] = "u.estatus_id = ?";
    $params[] = $estatus_id;
    $types .= "i";
  }

  if ($estatus_codigo !== '') {
    $where[] = "e.codigo = ?";
    $params[] = $estatus_codigo;
    $types .= "s";
  }

  if ($created_by !== null) {
    $where[] = "u.created_by = ?";
    $params[] = $created_by;
    $types .= "i";
  }

  if ($updated_by !== null) {
    $where[] = "u.updated_by = ?";
    $params[] = $updated_by;
    $types .= "i";
  }

  if ($q !== '') {
    $like = "%$q%";

    $where[] = "(
      u.username LIKE ?
      OR u.nombre LIKE ?
      OR u.apellido_paterno LIKE ?
      OR u.apellido_materno LIKE ?
      OR CONCAT_WS(' ', u.nombre, u.apellido_paterno, u.apellido_materno) LIKE ?
      OR u.email LIKE ?
      OR u.telefono LIKE ?

      OR p.nombres LIKE ?
      OR p.apellido_paterno LIKE ?
      OR p.apellido_materno LIKE ?
      OR CONCAT_WS(' ', p.nombres, p.apellido_paterno, p.apellido_materno) LIKE ?
      OR p.email LIKE ?
      OR p.telefono LIKE ?
      OR p.whatsapp LIKE ?
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
    FROM usuario u

    INNER JOIN cat_rol r
      ON r.rol_id = u.rol_id

    INNER JOIN cat_estatus e
      ON e.estatus_id = u.estatus_id

    LEFT JOIN persona p
      ON p.persona_id = u.persona_id
     AND p.deleted_at IS NULL

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
      r.nivel_jerarquico ASC,
      u.created_at DESC,
      u.usuario_id DESC
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
    $data[] = usuario_row($row);
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

  $usuario_id = null;

  if (isset($in['usuario_id'])) {
    $usuario_id = (int)$in['usuario_id'];
  } elseif (isset($in['id'])) {
    $usuario_id = (int)$in['id'];
  }

  $uuid = str_clean($in, 'uuid');
  $username = str_clean($in, 'username');
  $email = str_clean($in, 'email');

  $con = db();

  if ($usuario_id && $usuario_id > 0) {
    $data = consultar_usuario_detalle(
      $con,
      "u.usuario_id = ? AND u.deleted_at IS NULL",
      "i",
      [$usuario_id]
    );

    $con->close();

    json_response([
      "ok" => true,
      "data" => $data
    ]);
  }

  if ($uuid !== '') {
    $data = consultar_usuario_detalle(
      $con,
      "u.uuid = ? AND u.deleted_at IS NULL",
      "s",
      [$uuid]
    );

    $con->close();

    json_response([
      "ok" => true,
      "data" => $data
    ]);
  }

  if ($username !== '') {
    $data = consultar_usuario_detalle(
      $con,
      "u.username COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci AND u.deleted_at IS NULL",
      "s",
      [$username]
    );

    $con->close();

    json_response([
      "ok" => true,
      "data" => $data
    ]);
  }

  if ($email !== '') {
    $data = consultar_usuario_detalle(
      $con,
      "u.email COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci AND u.deleted_at IS NULL",
      "s",
      [$email]
    );

    $con->close();

    json_response([
      "ok" => true,
      "data" => $data
    ]);
  }

  $result = consultar_usuarios($con, $in);

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

  error_log('[IXTLA_C_USUARIO][SQL] ' . $e->getMessage());

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

  error_log('[IXTLA_C_USUARIO][ERR] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error interno del servidor"
  ], 500);
}
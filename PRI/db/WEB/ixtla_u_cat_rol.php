<?php
// db/WEB/ixtla_u_cat_rol.php

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

header("Access-Control-Allow-Methods: POST, PUT, PATCH, OPTIONS");
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
  error_log('[IXTLA_U_CAT_ROL] ' . $message);

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

/* ============================================================
   FORMATTER
   ============================================================ */

function rol_row(array $row): array
{
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

function obtener_rol(mysqli $con, int $rol_id): array
{
  $st = $con->prepare("
    SELECT *
    FROM cat_rol
    WHERE rol_id = ?
    LIMIT 1
  ");

  $st->bind_param("i", $rol_id);
  $st->execute();

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    internal_error("Rol actualizado pero no encontrado. rol_id=$rol_id");
  }

  return rol_row($row);
}

/* ============================================================
   UPDATE
   ============================================================ */

function actualizar_rol(mysqli $con, array $in): array
{
  $rol_id = isset($in['rol_id'])
    ? (int)$in['rol_id']
    : (isset($in['id']) ? (int)$in['id'] : 0);

  if ($rol_id <= 0) {
    json_response([
      "ok" => false,
      "error" => "Falta parámetro obligatorio: rol_id"
    ], 400);
  }

  $check = $con->prepare("
    SELECT rol_id
    FROM cat_rol
    WHERE rol_id = ?
    LIMIT 1
  ");

  $check->bind_param("i", $rol_id);
  $check->execute();

  $exists = $check->get_result()->fetch_assoc();
  $check->close();

  if (!$exists) {
    json_response([
      "ok" => false,
      "error" => "Rol no encontrado"
    ], 404);
  }

  if (array_key_exists('codigo', $in)) {
    $codigo = strtoupper(trim((string)$in['codigo']));

    if ($codigo === '') {
      json_response([
        "ok" => false,
        "error" => "codigo inválido"
      ], 400);
    }

    $in['codigo'] = $codigo;
  }

  if (array_key_exists('nombre', $in)) {
    $nombre = trim((string)$in['nombre']);

    if ($nombre === '') {
      json_response([
        "ok" => false,
        "error" => "nombre inválido"
      ], 400);
    }

    $in['nombre'] = $nombre;
  }

  if (array_key_exists('nivel_jerarquico', $in)) {
    $nivel = (int)$in['nivel_jerarquico'];

    if ($nivel <= 0) {
      json_response([
        "ok" => false,
        "error" => "nivel_jerarquico inválido"
      ], 400);
    }

    $in['nivel_jerarquico'] = $nivel;
  }

  if (array_key_exists('activo', $in)) {
    $in['activo'] = ((int)$in['activo']) === 1 ? 1 : 0;
  }

  $map = [
    "codigo" => "s",
    "nombre" => "s",
    "descripcion" => "s",
    "nivel_jerarquico" => "i",
    "activo" => "i"
  ];

  $set = [];
  $params = [];
  $types = "";

  foreach ($map as $field => $type) {
    if (!array_key_exists($field, $in)) {
      continue;
    }

    $set[] = "$field = ?";
    $params[] = value_or_null($in, $field);
    $types .= $type;
  }

  if (empty($set)) {
    json_response([
      "ok" => false,
      "error" => "No hay campos para actualizar"
    ], 400);
  }

  $params[] = $rol_id;
  $types .= "i";

  $sql = "
    UPDATE cat_rol
    SET " . implode(", ", $set) . "
    WHERE rol_id = ?
  ";

  $st = $con->prepare($sql);
  bind_dynamic($st, $types, $params);
  $st->execute();
  $st->close();

  return obtener_rol($con, $rol_id);
}

/* ============================================================
   MAIN
   ============================================================ */

try {
  if (!in_array(($_SERVER['REQUEST_METHOD'] ?? ''), ['POST', 'PUT', 'PATCH'], true)) {
    json_response([
      "ok" => false,
      "error" => "Método no permitido. Usa POST, PUT o PATCH."
    ], 405);
  }

  $in = read_json_body();
  $con = db();

  $con->begin_transaction();

  try {
    $data = actualizar_rol($con, $in);
    $con->commit();
  } catch (Throwable $e) {
    $con->rollback();
    throw $e;
  }

  $con->close();

  json_response([
    "ok" => true,
    "message" => "Rol actualizado correctamente",
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

  error_log('[IXTLA_U_CAT_ROL][SQL] ' . $msg);

  if ($code === 1062) {
    json_response([
      "ok" => false,
      "error" => "Duplicado en campo codigo",
      "duplicate_field" => "codigo"
    ], 409);
  }

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

  error_log('[IXTLA_U_CAT_ROL][ERR] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error interno del servidor"
  ], 500);
}
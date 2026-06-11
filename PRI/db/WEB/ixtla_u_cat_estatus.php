<?php
// db/WEB/ixtla_u_cat_estatus.php

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
  error_log('[IXTLA_U_CAT_ESTATUS] ' . $message);

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

function normalize_bool_int(mixed $value): int
{
  if (is_bool($value)) {
    return $value ? 1 : 0;
  }

  return ((int)$value) === 1 ? 1 : 0;
}

/* ============================================================
   FORMATTER
   ============================================================ */

function estatus_response(mysqli $con, int $estatus_id): array
{
  $sql = "
    SELECT *
    FROM cat_estatus
    WHERE estatus_id = ?
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $estatus_id);
  $st->execute();

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    return [];
  }

  return [
    "estatus_id" => (int)$row['estatus_id'],
    "codigo" => $row['codigo'],
    "nombre" => $row['nombre'],
    "descripcion" => $row['descripcion'],
    "activo" => (int)$row['activo'],
    "created_at" => $row['created_at'],
    "updated_at" => $row['updated_at']
  ];
}

function validar_estatus(mysqli $con, int $estatus_id): void
{
  $sql = "
    SELECT estatus_id
    FROM cat_estatus
    WHERE estatus_id = ?
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $estatus_id);
  $st->execute();

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    json_response([
      "ok" => false,
      "error" => "Estatus no encontrado"
    ], 404);
  }
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

  $estatus_id = 0;

  if (isset($in['estatus_id'])) {
    $estatus_id = (int)$in['estatus_id'];
  } elseif (isset($in['id'])) {
    $estatus_id = (int)$in['id'];
  }

  if ($estatus_id <= 0) {
    json_response([
      "ok" => false,
      "error" => "Falta parámetro obligatorio: estatus_id"
    ], 400);
  }

  $con = db();

  validar_estatus($con, $estatus_id);

  $map = [
    "codigo" => "s",
    "nombre" => "s",
    "descripcion" => "s",
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

    if ($field === 'codigo') {
      $params[] = strtoupper(trim((string)$in[$field]));
    } elseif ($field === 'nombre') {
      $params[] = trim((string)$in[$field]);
    } elseif ($field === 'activo') {
      $params[] = normalize_bool_int($in[$field]);
    } else {
      $params[] = value_or_null($in, $field);
    }

    $types .= $type;
  }

  if (empty($set)) {
    $con->close();

    json_response([
      "ok" => false,
      "error" => "No hay campos para actualizar"
    ], 400);
  }

  if (array_key_exists('codigo', $in) && trim((string)$in['codigo']) === '') {
    $con->close();

    json_response([
      "ok" => false,
      "error" => "codigo no puede quedar vacío"
    ], 400);
  }

  if (array_key_exists('nombre', $in) && trim((string)$in['nombre']) === '') {
    $con->close();

    json_response([
      "ok" => false,
      "error" => "nombre no puede quedar vacío"
    ], 400);
  }

  $params[] = $estatus_id;
  $types .= "i";

  $con->begin_transaction();

  $sql = "
    UPDATE cat_estatus
    SET " . implode(", ", $set) . "
    WHERE estatus_id = ?
  ";

  $st = $con->prepare($sql);
  bind_dynamic($st, $types, $params);
  $st->execute();
  $st->close();

  $data = estatus_response($con, $estatus_id);

  $con->commit();
  $con->close();

  json_response([
    "ok" => true,
    "data" => $data
  ]);
} catch (mysqli_sql_exception $e) {
  if (isset($con) && $con instanceof mysqli) {
    try {
      $con->rollback();
      $con->close();
    } catch (Throwable $ignored) {
    }
  }

  if ((int)$e->getCode() === 1062) {
    json_response([
      "ok" => false,
      "error" => "Duplicado en campo codigo"
    ], 409);
  }

  error_log('[IXTLA_U_CAT_ESTATUS][SQL] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "No se pudo actualizar el estatus"
  ], 500);
} catch (Throwable $e) {
  if (isset($con) && $con instanceof mysqli) {
    try {
      $con->rollback();
      $con->close();
    } catch (Throwable $ignored) {
    }
  }

  error_log('[IXTLA_U_CAT_ESTATUS][ERROR] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error interno del servidor"
  ], 500);
}

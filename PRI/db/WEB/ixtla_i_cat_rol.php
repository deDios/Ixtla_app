<?php
// db/WEB/ixtla_i_cat_rol.php

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
  error_log('[IXTLA_I_CAT_ROL] ' . $message);

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

function str_clean(array $in, string $key): string
{
  return isset($in[$key]) ? trim((string)$in[$key]) : '';
}

function upper_clean(array $in, string $key): string
{
  return isset($in[$key]) ? strtoupper(trim((string)$in[$key])) : '';
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
    internal_error("Rol insertado pero no encontrado. rol_id=$rol_id");
  }

  return rol_row($row);
}

/* ============================================================
   INSERT
   ============================================================ */

function insertar_rol(mysqli $con, array $in): array
{
  $codigo = upper_clean($in, 'codigo');
  $nombre = str_clean($in, 'nombre');

  $nivel_jerarquico = isset($in['nivel_jerarquico'])
    ? (int)$in['nivel_jerarquico']
    : 0;

  if ($codigo === '') {
    json_response([
      "ok" => false,
      "error" => "Falta parámetro obligatorio: codigo"
    ], 400);
  }

  if ($nombre === '') {
    json_response([
      "ok" => false,
      "error" => "Falta parámetro obligatorio: nombre"
    ], 400);
  }

  if ($nivel_jerarquico <= 0) {
    json_response([
      "ok" => false,
      "error" => "Falta parámetro obligatorio o inválido: nivel_jerarquico"
    ], 400);
  }

  $descripcion = value_or_null($in, 'descripcion');

  $activo = array_key_exists('activo', $in)
    ? (((int)$in['activo']) === 1 ? 1 : 0)
    : 1;

  $st = $con->prepare("
    INSERT INTO cat_rol (
      codigo,
      nombre,
      descripcion,
      nivel_jerarquico,
      activo
    )
    VALUES (?, ?, ?, ?, ?)
  ");

  $st->bind_param(
    "sssii",
    $codigo,
    $nombre,
    $descripcion,
    $nivel_jerarquico,
    $activo
  );

  $st->execute();

  $rol_id = (int)$con->insert_id;

  $st->close();

  return obtener_rol($con, $rol_id);
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
    $data = insertar_rol($con, $in);
    $con->commit();
  } catch (Throwable $e) {
    $con->rollback();
    throw $e;
  }

  $con->close();

  json_response([
    "ok" => true,
    "message" => "Rol creado correctamente",
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

  error_log('[IXTLA_I_CAT_ROL][SQL] ' . $msg);

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

  error_log('[IXTLA_I_CAT_ROL][ERR] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error interno del servidor"
  ], 500);
}
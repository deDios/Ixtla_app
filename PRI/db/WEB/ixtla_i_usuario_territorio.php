<?php
// db/WEB/ixtla_i_usuario_territorio.php

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
  error_log('[IXTLA_I_USUARIO_TERRITORIO] ' . $message);

  json_response([
    'ok' => false,
    'error' => 'Error interno del servidor'
  ], 500);
}

function read_json_body(): array
{
  $raw = file_get_contents('php://input');

  if (!$raw || trim($raw) === '') {
    json_response([
      'ok' => false,
      'error' => 'Body JSON requerido'
    ], 400);
  }

  $in = json_decode($raw, true);

  if (!is_array($in)) {
    json_response([
      'ok' => false,
      'error' => 'JSON inválido'
    ], 400);
  }

  return $in;
}

function db(): mysqli
{
  $path = realpath('/home/site/wwwroot/db/conn/conn_db_2.php');

  if (!$path || !file_exists($path)) {
    internal_error('No se encontró conn_db_2.php en /home/site/wwwroot/db/conn/conn_db_2.php');
  }

  include_once $path;

  if (!function_exists('conectar')) {
    internal_error('No existe la función conectar() en conn_db_2.php');
  }

  $con = conectar();

  if (!$con instanceof mysqli) {
    internal_error('conectar() no regresó una conexión mysqli válida');
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

function nullable_int_from_row(array $row, string $key): ?int
{
  return isset($row[$key]) && $row[$key] !== null ? (int)$row[$key] : null;
}

function str_clean(array $in, string $key): string
{
  return isset($in[$key]) ? trim((string)$in[$key]) : '';
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

function usuario_territorio_row(array $row): array
{
  return [
    'usuario_territorio_id' => (int)$row['usuario_territorio_id'],
    'usuario_id' => (int)$row['usuario_id'],
    'territorio_id' => (int)$row['territorio_id'],
    'usuario' => [
      'usuario_id' => (int)$row['usuario_id'],
      'username' => $row['username'],
      'nombre' => $row['usuario_nombre'],
      'apellido_paterno' => $row['usuario_apellido_paterno'],
      'apellido_materno' => $row['usuario_apellido_materno'],
      'email' => $row['usuario_email'],
      'rol_codigo' => $row['rol_codigo'],
      'rol_nombre' => $row['rol_nombre']
    ],
    'territorio' => [
      'territorio_id' => (int)$row['territorio_id'],
      'territorio_padre_id' => nullable_int_from_row($row, 'territorio_padre_id'),
      'tipo' => $row['territorio_tipo'],
      'codigo' => $row['territorio_codigo'],
      'nombre' => $row['territorio_nombre'],
      'municipio' => $row['territorio_municipio'],
      'estado' => $row['territorio_estado'],
      'distrito_local' => $row['territorio_distrito_local'],
      'distrito_federal' => $row['territorio_distrito_federal'],
      'zona' => [
        'territorio_id' => nullable_int_from_row($row, 'zona_id'),
        'codigo' => $row['zona_codigo'],
        'nombre' => $row['zona_nombre']
      ]
    ],
    'fecha_inicio' => $row['fecha_inicio'],
    'fecha_fin' => $row['fecha_fin'],
    'activo' => (int)$row['activo'],
    'created_at' => $row['created_at'],
    'created_by' => nullable_int_from_row($row, 'created_by'),
    'updated_at' => $row['updated_at'],
    'updated_by' => nullable_int_from_row($row, 'updated_by')
  ];
}

function obtener_usuario_territorio(mysqli $con, int $usuario_territorio_id): array
{
  $sql = "
    SELECT
      ut.*, 
      u.username,
      u.nombre AS usuario_nombre,
      u.apellido_paterno AS usuario_apellido_paterno,
      u.apellido_materno AS usuario_apellido_materno,
      u.email AS usuario_email,
      r.codigo AS rol_codigo,
      r.nombre AS rol_nombre,
      t.territorio_padre_id,
      t.tipo AS territorio_tipo,
      t.codigo AS territorio_codigo,
      t.nombre AS territorio_nombre,
      t.municipio AS territorio_municipio,
      t.estado AS territorio_estado,
      t.distrito_local AS territorio_distrito_local,
      t.distrito_federal AS territorio_distrito_federal,
      z.territorio_id AS zona_id,
      z.codigo AS zona_codigo,
      z.nombre AS zona_nombre
    FROM usuario_territorio ut
    INNER JOIN usuario u
      ON u.usuario_id = ut.usuario_id
     AND u.deleted_at IS NULL
    INNER JOIN cat_rol r
      ON r.rol_id = u.rol_id
    INNER JOIN territorio t
      ON t.territorio_id = ut.territorio_id
     AND t.deleted_at IS NULL
    LEFT JOIN territorio z
      ON z.territorio_id = t.territorio_padre_id
     AND z.deleted_at IS NULL
    WHERE ut.usuario_territorio_id = ?
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param('i', $usuario_territorio_id);
  $st->execute();

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    internal_error("Relación usuario-territorio insertada pero no encontrada. usuario_territorio_id=$usuario_territorio_id");
  }

  return usuario_territorio_row($row);
}

/* ============================================================
   VALIDACIONES
   ============================================================ */

function validar_usuario_existe(mysqli $con, int $usuario_id): void
{
  $st = $con->prepare("
    SELECT usuario_id
    FROM usuario
    WHERE usuario_id = ?
      AND deleted_at IS NULL
    LIMIT 1
  ");

  $st->bind_param('i', $usuario_id);
  $st->execute();

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    json_response([
      'ok' => false,
      'error' => 'usuario_id inválido'
    ], 400);
  }
}

function validar_territorio_existe(mysqli $con, int $territorio_id): void
{
  $st = $con->prepare("
    SELECT territorio_id
    FROM territorio
    WHERE territorio_id = ?
      AND deleted_at IS NULL
    LIMIT 1
  ");

  $st->bind_param('i', $territorio_id);
  $st->execute();

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    json_response([
      'ok' => false,
      'error' => 'territorio_id inválido'
    ], 400);
  }
}

/* ============================================================
   INSERT
   ============================================================ */

function insertar_usuario_territorio(mysqli $con, array $in): array
{
  $usuario_id = isset($in['usuario_id']) ? (int)$in['usuario_id'] : 0;
  $territorio_id = isset($in['territorio_id']) ? (int)$in['territorio_id'] : 0;

  if ($usuario_id <= 0) {
    json_response([
      'ok' => false,
      'error' => 'Falta parámetro obligatorio: usuario_id'
    ], 400);
  }

  if ($territorio_id <= 0) {
    json_response([
      'ok' => false,
      'error' => 'Falta parámetro obligatorio: territorio_id'
    ], 400);
  }

  validar_usuario_existe($con, $usuario_id);
  validar_territorio_existe($con, $territorio_id);

  $fecha_inicio = str_clean($in, 'fecha_inicio');
  if ($fecha_inicio === '') {
    $fecha_inicio = date('Y-m-d');
  }

  $fecha_fin = value_or_null($in, 'fecha_fin');
  $activo = array_key_exists('activo', $in)
    ? normalize_bool_int($in['activo'])
    : 1;

  $created_by = array_key_exists('created_by', $in) && $in['created_by'] !== null && (int)$in['created_by'] > 0
    ? (int)$in['created_by']
    : null;

  $st = $con->prepare("
    INSERT INTO usuario_territorio (
      usuario_id,
      territorio_id,
      fecha_inicio,
      fecha_fin,
      activo,
      created_by
    )
    VALUES (?, ?, ?, ?, ?, ?)
  ");

  $st->bind_param(
    'iissii',
    $usuario_id,
    $territorio_id,
    $fecha_inicio,
    $fecha_fin,
    $activo,
    $created_by
  );

  $st->execute();

  $usuario_territorio_id = (int)$con->insert_id;
  $st->close();

  return obtener_usuario_territorio($con, $usuario_territorio_id);
}

/* ============================================================
   MAIN
   ============================================================ */

try {
  if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_response([
      'ok' => false,
      'error' => 'Método no permitido. Usa POST.'
    ], 405);
  }

  $in = read_json_body();
  $con = db();

  $con->begin_transaction();

  try {
    $data = insertar_usuario_territorio($con, $in);
    $con->commit();
  } catch (Throwable $e) {
    $con->rollback();
    throw $e;
  }

  $con->close();

  json_response([
    'ok' => true,
    'message' => 'Relación usuario-territorio creada correctamente',
    'data' => $data
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

  error_log('[IXTLA_I_USUARIO_TERRITORIO][SQL] ' . $msg);

  if ($code === 1062) {
    json_response([
      'ok' => false,
      'error' => 'Ese usuario ya tiene asignado ese territorio'
    ], 409);
  }

  if ($code === 1452) {
    json_response([
      'ok' => false,
      'error' => 'FK inválida. Revisa usuario_id o territorio_id'
    ], 400);
  }

  json_response([
    'ok' => false,
    'error' => 'Error de base de datos'
  ], 500);
} catch (Throwable $e) {
  if (isset($con) && $con instanceof mysqli) {
    try {
      $con->close();
    } catch (Throwable $ignored) {
    }
  }

  error_log('[IXTLA_I_USUARIO_TERRITORIO][ERR] ' . $e->getMessage());

  json_response([
    'ok' => false,
    'error' => 'Error interno del servidor'
  ], 500);
}
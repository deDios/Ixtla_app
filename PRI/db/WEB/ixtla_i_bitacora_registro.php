<?php
// db/WEB/ixtla_i_bitacora_registro.php

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
  header('Vary: Origin');
}

header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Content-Type: application/json; charset=utf-8');

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
  error_log('[IXTLA_I_BITACORA_REGISTRO] ' . $message);

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

function bind_dynamic(mysqli_stmt $stmt, string $types, array &$params): void
{
  if ($types === '' || empty($params)) {
    return;
  }

  $refs = [];
  $refs[] = $types;

  foreach ($params as &$value) {
    $refs[] = &$value;
  }

  call_user_func_array([$stmt, 'bind_param'], $refs);
}

function value_or_null(array $in, string $key): mixed
{
  if (!array_key_exists($key, $in)) {
    return null;
  }

  if ($in[$key] === '') {
    return null;
  }

  return $in[$key];
}

function str_clean(array $in, string $key): string
{
  return isset($in[$key]) ? trim((string)$in[$key]) : '';
}

function nullable_int_from_row(array $row, string $key): ?int
{
  return isset($row[$key]) && $row[$key] !== null ? (int)$row[$key] : null;
}

function client_ip(): string
{
  $xff = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';

  if ($xff !== '') {
    $parts = explode(',', $xff);
    return trim($parts[0]);
  }

  return $_SERVER['REMOTE_ADDR'] ?? '';
}

function user_agent_value(): string
{
  return substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 1000);
}

/* ============================================================
   FORMATTER
   ============================================================ */

function decode_json_field(?string $value): mixed
{
  if ($value === null || $value === '') {
    return null;
  }

  $decoded = json_decode($value, true);

  return json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
}

function bitacora_row(array $row): array
{
  return [
    'bitacora_id' => (int)$row['bitacora_id'],
    'tabla_nombre' => $row['tabla_nombre'],
    'registro_id' => (int)$row['registro_id'],
    'accion' => $row['accion'],
    'descripcion' => $row['descripcion'],
    'valores_anteriores' => decode_json_field($row['valores_anteriores']),
    'valores_nuevos' => decode_json_field($row['valores_nuevos']),
    'realizado_por' => nullable_int_from_row($row, 'realizado_por'),
    'realizado_por_usuario' => [
      'usuario_id' => nullable_int_from_row($row, 'realizado_por'),
      'username' => $row['realizado_por_username'],
      'nombre' => $row['realizado_por_nombre'],
      'apellido_paterno' => $row['realizado_por_apellido_paterno'],
      'apellido_materno' => $row['realizado_por_apellido_materno'],
      'nombre_completo' => trim(
        (string)$row['realizado_por_nombre'] . ' ' .
        (string)$row['realizado_por_apellido_paterno'] . ' ' .
        (string)$row['realizado_por_apellido_materno']
      )
    ],
    'realizado_at' => $row['realizado_at'],
    'ip_origen' => $row['ip_origen'],
    'user_agent' => $row['user_agent']
  ];
}

function obtener_bitacora(mysqli $con, int $bitacora_id): array
{
  $sql = '
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
    WHERE b.bitacora_id = ?
    LIMIT 1
  ';

  $st = $con->prepare($sql);
  $st->bind_param('i', $bitacora_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    internal_error("Bitácora insertada pero no encontrada. bitacora_id=$bitacora_id");
  }

  return bitacora_row($row);
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

  $tabla_nombre = str_clean($in, 'tabla_nombre');
  $registro_id = isset($in['registro_id']) ? (int)$in['registro_id'] : 0;
  $accion = strtoupper(str_clean($in, 'accion'));

  $acciones_validas = [
    'INSERT',
    'UPDATE',
    'DELETE',
    'LOGIN',
    'UPLOAD_FILE',
    'REPLACE_FILE',
    'CHANGE_STATUS',
    'VALIDATE',
    'REJECT'
  ];

  if ($tabla_nombre === '') {
    json_response([
      'ok' => false,
      'error' => 'Falta parámetro obligatorio: tabla_nombre'
    ], 400);
  }

  if ($registro_id <= 0) {
    json_response([
      'ok' => false,
      'error' => 'Falta parámetro obligatorio: registro_id'
    ], 400);
  }

  if (!in_array($accion, $acciones_validas, true)) {
    json_response([
      'ok' => false,
      'error' => 'Acción inválida',
      'permitidos' => $acciones_validas
    ], 400);
  }

  $descripcion = value_or_null($in, 'descripcion');

  $valores_anteriores = null;
  if (array_key_exists('valores_anteriores', $in) && $in['valores_anteriores'] !== null) {
    $valores_anteriores = json_encode($in['valores_anteriores'], JSON_UNESCAPED_UNICODE);
  }

  $valores_nuevos = null;
  if (array_key_exists('valores_nuevos', $in) && $in['valores_nuevos'] !== null) {
    $valores_nuevos = json_encode($in['valores_nuevos'], JSON_UNESCAPED_UNICODE);
  }

  $realizado_por = array_key_exists('realizado_por', $in) && $in['realizado_por'] !== null
    ? (int)$in['realizado_por']
    : null;

  $ip_origen = value_or_null($in, 'ip_origen');
  if ($ip_origen === null) {
    $ip_origen = client_ip();
  }

  $user_agent = value_or_null($in, 'user_agent');
  if ($user_agent === null) {
    $user_agent = user_agent_value();
  }

  $con = db();
  $con->begin_transaction();

  try {
    $sql = '
      INSERT INTO bitacora_registro (
        tabla_nombre,
        registro_id,
        accion,
        descripcion,
        valores_anteriores,
        valores_nuevos,
        realizado_por,
        ip_origen,
        user_agent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ';

    $st = $con->prepare($sql);

    $params = [
      $tabla_nombre,
      $registro_id,
      $accion,
      $descripcion,
      $valores_anteriores,
      $valores_nuevos,
      $realizado_por,
      $ip_origen,
      $user_agent
    ];

    $types = 'sissssiss';

    bind_dynamic($st, $types, $params);
    $st->execute();

    $bitacora_id = (int)$con->insert_id;
    $st->close();

    $data = obtener_bitacora($con, $bitacora_id);

    $con->commit();

    json_response([
      'ok' => true,
      'data' => $data
    ], 201);
  } catch (mysqli_sql_exception $e) {
    $con->rollback();

    if ((int)$e->getCode() === 1452) {
      json_response([
        'ok' => false,
        'error' => 'FK inválida. Revisa realizado_por',
        'detail' => $e->getMessage(),
        'code' => (int)$e->getCode()
      ], 400);
    }

    throw $e;
  } finally {
    $con->close();
  }
} catch (mysqli_sql_exception $e) {
  internal_error('MySQL: ' . $e->getMessage() . ' | code=' . $e->getCode());
} catch (Throwable $e) {
  internal_error($e->getMessage());
}

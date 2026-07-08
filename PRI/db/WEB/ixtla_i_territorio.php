<?php
// db/WEB/ixtla_i_territorio.php

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
  error_log('[IXTLA_I_TERRITORIO] ' . $message);

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

function str_clean(array $in, string $key): string
{
  return isset($in[$key]) ? trim((string)$in[$key]) : '';
}

function nullable_int_from_row(array $row, string $key): ?int
{
  return isset($row[$key]) && $row[$key] !== null ? (int)$row[$key] : null;
}

function normalize_bool_int(mixed $value): int
{
  if (is_bool($value)) {
    return $value ? 1 : 0;
  }

  return ((int)$value) === 1 ? 1 : 0;
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

/* ============================================================
   FORMATTER
   ============================================================ */

function territorio_row(array $row): array
{
  return [
    'territorio_id' => (int)$row['territorio_id'],
    'territorio_padre_id' => nullable_int_from_row($row, 'territorio_padre_id'),
    'tipo' => $row['tipo'],
    'codigo' => $row['codigo'],
    'nombre' => $row['nombre'],
    'municipio' => $row['municipio'],
    'estado' => $row['estado'],
    'distrito_local' => $row['distrito_local'],
    'distrito_federal' => $row['distrito_federal'],
    'activo' => (int)$row['activo'],
    'padre' => [
      'territorio_id' => nullable_int_from_row($row, 'padre_id'),
      'tipo' => $row['padre_tipo'],
      'codigo' => $row['padre_codigo'],
      'nombre' => $row['padre_nombre']
    ],
    'created_at' => $row['created_at'],
    'created_by' => nullable_int_from_row($row, 'created_by'),
    'updated_at' => $row['updated_at'],
    'updated_by' => nullable_int_from_row($row, 'updated_by')
  ];
}

function obtener_territorio(mysqli $con, int $territorio_id): array
{
  $sql = "
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
    WHERE t.territorio_id = ?
      AND t.deleted_at IS NULL
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param('i', $territorio_id);
  $st->execute();

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    internal_error("Territorio insertado pero no encontrado. territorio_id=$territorio_id");
  }

  return territorio_row($row);
}

/* ============================================================
   INSERT
   ============================================================ */

function validar_padre_seccion(mysqli $con, int $territorio_padre_id): void
{
  $st = $con->prepare("
    SELECT territorio_id
    FROM territorio
    WHERE territorio_id = ?
      AND tipo = 'ZONA'
      AND deleted_at IS NULL
    LIMIT 1
  ");

  $st->bind_param('i', $territorio_padre_id);
  $st->execute();

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    json_response([
      'ok' => false,
      'error' => 'territorio_padre_id inválido. La sección debe pertenecer a una ZONA existente'
    ], 400);
  }
}

function insertar_territorio(mysqli $con, array $in): array
{
  $tipo = strtoupper(str_clean($in, 'tipo'));
  $nombre = str_clean($in, 'nombre');

  if (!in_array($tipo, ['ZONA', 'SECCION'], true)) {
    json_response([
      'ok' => false,
      'error' => 'tipo inválido. Usa ZONA o SECCION'
    ], 400);
  }

  if ($nombre === '') {
    json_response([
      'ok' => false,
      'error' => 'Falta parámetro obligatorio: nombre'
    ], 400);
  }

  $territorio_padre_id = array_key_exists('territorio_padre_id', $in) && $in['territorio_padre_id'] !== null && $in['territorio_padre_id'] !== ''
    ? (int)$in['territorio_padre_id']
    : null;

  if ($tipo === 'SECCION' && ($territorio_padre_id === null || $territorio_padre_id <= 0)) {
    json_response([
      'ok' => false,
      'error' => 'Las secciones requieren territorio_padre_id'
    ], 400);
  }

  if ($tipo === 'ZONA') {
    $territorio_padre_id = null;
  } else {
    validar_padre_seccion($con, (int)$territorio_padre_id);
  }

  $columns = ['tipo', 'nombre'];
  $placeholders = ['?', '?'];
  $params = [$tipo, $nombre];
  $types = 'ss';

  if ($territorio_padre_id !== null) {
    $columns[] = 'territorio_padre_id';
    $placeholders[] = '?';
    $params[] = $territorio_padre_id;
    $types .= 'i';
  }

  $optionalMap = [
    'codigo' => 's',
    'municipio' => 's',
    'estado' => 's',
    'distrito_local' => 's',
    'distrito_federal' => 's',
    'activo' => 'i',
    'created_by' => 'i'
  ];

  foreach ($optionalMap as $field => $type) {
    if (!array_key_exists($field, $in)) {
      continue;
    }

    $columns[] = $field;
    $placeholders[] = '?';

    if ($field === 'activo') {
      $params[] = normalize_bool_int($in[$field]);
    } else {
      $params[] = value_or_null($in, $field);
    }

    $types .= $type;
  }

  $sql = "
    INSERT INTO territorio (
      " . implode(', ', $columns) . "
    ) VALUES (
      " . implode(', ', $placeholders) . "
    )
  ";

  $st = $con->prepare($sql);
  bind_dynamic($st, $types, $params);
  $st->execute();

  $territorio_id = (int)$con->insert_id;
  $st->close();

  return obtener_territorio($con, $territorio_id);
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
    $data = insertar_territorio($con, $in);
    $con->commit();
  } catch (Throwable $e) {
    $con->rollback();
    throw $e;
  }

  $con->close();

  json_response([
    'ok' => true,
    'message' => 'Territorio creado correctamente',
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

  error_log('[IXTLA_I_TERRITORIO][SQL] ' . $msg);

  if ($code === 1452) {
    json_response([
      'ok' => false,
      'error' => 'FK inválida. Revisa territorio_padre_id'
    ], 400);
  }

  if ($code === 1062) {
    json_response([
      'ok' => false,
      'error' => 'Duplicado en campo único'
    ], 409);
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

  error_log('[IXTLA_I_TERRITORIO][ERR] ' . $e->getMessage());

  json_response([
    'ok' => false,
    'error' => 'Error interno del servidor'
  ], 500);
}

<?php
// db/WEB/ixtla_u_territorio.php

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
  error_log('[IXTLA_U_TERRITORIO] ' . $message);

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
    'updated_by' => nullable_int_from_row($row, 'updated_by'),
    'deleted_at' => $row['deleted_at'],
    'deleted_by' => nullable_int_from_row($row, 'deleted_by')
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
    internal_error("Territorio actualizado pero no encontrado. territorio_id=$territorio_id");
  }

  return territorio_row($row);
}

/* ============================================================
   UPDATE
   ============================================================ */

function validar_padre_seccion(mysqli $con, int $territorio_id, int $territorio_padre_id): void
{
  if ($territorio_padre_id === $territorio_id) {
    json_response([
      'ok' => false,
      'error' => 'Un territorio no puede ser padre de sí mismo'
    ], 400);
  }

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

function actualizar_territorio(mysqli $con, array $in): array
{
  $territorio_id = isset($in['territorio_id'])
    ? (int)$in['territorio_id']
    : (isset($in['id']) ? (int)$in['id'] : 0);

  if ($territorio_id <= 0) {
    json_response([
      'ok' => false,
      'error' => 'Falta parámetro obligatorio: territorio_id'
    ], 400);
  }

  $check = $con->prepare("
    SELECT *
    FROM territorio
    WHERE territorio_id = ?
      AND deleted_at IS NULL
    LIMIT 1
  ");

  $check->bind_param('i', $territorio_id);
  $check->execute();

  $current = $check->get_result()->fetch_assoc();
  $check->close();

  if (!$current) {
    json_response([
      'ok' => false,
      'error' => 'Territorio no encontrado'
    ], 404);
  }

  if (array_key_exists('tipo', $in)) {
    $tipoValidar = strtoupper(trim((string)$in['tipo']));

    if (!in_array($tipoValidar, ['ZONA', 'SECCION'], true)) {
      json_response([
        'ok' => false,
        'error' => 'tipo inválido. Usa ZONA o SECCION'
      ], 400);
    }

    $in['tipo'] = $tipoValidar;
  }

  if (array_key_exists('nombre', $in) && trim((string)$in['nombre']) === '') {
    json_response([
      'ok' => false,
      'error' => 'nombre inválido'
    ], 400);
  }

  $nuevoTipo = array_key_exists('tipo', $in)
    ? strtoupper(trim((string)$in['tipo']))
    : (string)$current['tipo'];

  $nuevoPadre = array_key_exists('territorio_padre_id', $in)
    ? ($in['territorio_padre_id'] === null || $in['territorio_padre_id'] === '' ? null : (int)$in['territorio_padre_id'])
    : nullable_int_from_row($current, 'territorio_padre_id');

  if ($nuevoTipo === 'ZONA') {
    $nuevoPadre = null;
  }

  if ($nuevoTipo === 'SECCION') {
    if ($nuevoPadre === null || $nuevoPadre <= 0) {
      json_response([
        'ok' => false,
        'error' => 'Las secciones requieren territorio_padre_id'
      ], 400);
    }

    validar_padre_seccion($con, $territorio_id, $nuevoPadre);
  }

  $map = [
    'territorio_padre_id' => 'i',
    'tipo' => 's',
    'codigo' => 's',
    'nombre' => 's',
    'municipio' => 's',
    'estado' => 's',
    'distrito_local' => 's',
    'distrito_federal' => 's',
    'activo' => 'i',
    'updated_by' => 'i',
    'deleted_at' => 's',
    'deleted_by' => 'i'
  ];

  $set = [];
  $params = [];
  $types = '';

  foreach ($map as $field => $type) {
    if (!array_key_exists($field, $in)) {
      continue;
    }

    $set[] = "$field = ?";

    if ($field === 'tipo') {
      $params[] = $nuevoTipo;
    } elseif ($field === 'territorio_padre_id') {
      $params[] = $nuevoPadre;
    } elseif ($field === 'activo') {
      $params[] = normalize_bool_int($in[$field]);
    } else {
      $params[] = value_or_null($in, $field);
    }

    $types .= $type;
  }

  if (array_key_exists('tipo', $in) && $nuevoTipo === 'ZONA' && !array_key_exists('territorio_padre_id', $in)) {
    $set[] = 'territorio_padre_id = ?';
    $params[] = null;
    $types .= 'i';
  }

  if (empty($set)) {
    json_response([
      'ok' => false,
      'error' => 'No hay campos para actualizar'
    ], 400);
  }

  $params[] = $territorio_id;
  $types .= 'i';

  $sql = "
    UPDATE territorio
    SET " . implode(', ', $set) . "
    WHERE territorio_id = ?
  ";

  $st = $con->prepare($sql);
  bind_dynamic($st, $types, $params);
  $st->execute();
  $st->close();

  return obtener_territorio($con, $territorio_id);
}

/* ============================================================
   MAIN
   ============================================================ */

try {
  if (!in_array(($_SERVER['REQUEST_METHOD'] ?? ''), ['POST', 'PUT', 'PATCH'], true)) {
    json_response([
      'ok' => false,
      'error' => 'Método no permitido. Usa POST, PUT o PATCH.'
    ], 405);
  }

  $in = read_json_body();
  $con = db();

  $con->begin_transaction();

  try {
    $data = actualizar_territorio($con, $in);
    $con->commit();
  } catch (Throwable $e) {
    $con->rollback();
    throw $e;
  }

  $con->close();

  json_response([
    'ok' => true,
    'message' => 'Territorio actualizado correctamente',
    'data' => $data
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

  error_log('[IXTLA_U_TERRITORIO][SQL] ' . $msg);

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

  error_log('[IXTLA_U_TERRITORIO][ERR] ' . $e->getMessage());

  json_response([
    'ok' => false,
    'error' => 'Error interno del servidor'
  ], 500);
}
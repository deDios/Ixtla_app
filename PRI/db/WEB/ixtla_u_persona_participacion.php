<?php
// db/WEB/ixtla_u_persona_participacion.php

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

header('Access-Control-Allow-Methods: POST, PUT, PATCH, OPTIONS');
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
  error_log('[IXTLA_U_PERSONA_PARTICIPACION] ' . $message);

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

/* ============================================================
   VALIDACIONES
   ============================================================ */

function validar_enum_tipo(string $tipo): string
{
  $tipo = strtoupper(trim($tipo));

  if (!in_array($tipo, ['SIMPATIZANTE', 'AFILIADO'], true)) {
    json_response([
      'ok' => false,
      'error' => 'tipo_participacion inválido. Usa SIMPATIZANTE o AFILIADO'
    ], 400);
  }

  return $tipo;
}

function validar_enum_fuente(?string $fuente): ?string
{
  if ($fuente === null || $fuente === '') {
    return $fuente;
  }

  $fuente = strtoupper(trim($fuente));
  $validas = ['PORTAL', 'BRIGADA', 'IMPORTACION', 'FORMULARIO_WEB', 'OTRO'];

  if (!in_array($fuente, $validas, true)) {
    json_response([
      'ok' => false,
      'error' => 'fuente_captura inválida',
      'permitidos' => $validas
    ], 400);
  }

  return $fuente;
}

function validar_persona_existe(mysqli $con, int $persona_id): void
{
  $st = $con->prepare('
    SELECT persona_id
    FROM persona
    WHERE persona_id = ?
      AND deleted_at IS NULL
    LIMIT 1
  ');

  $st->bind_param('i', $persona_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    json_response([
      'ok' => false,
      'error' => 'persona_id inválido o no encontrado'
    ], 400);
  }
}

function validar_participacion_origen(mysqli $con, int $participacion_id, int $participacion_origen_id): void
{
  if ($participacion_origen_id === $participacion_id) {
    json_response([
      'ok' => false,
      'error' => 'participacion_origen_id no puede ser igual a participacion_id'
    ], 400);
  }

  $st = $con->prepare('
    SELECT participacion_id
    FROM persona_participacion
    WHERE participacion_id = ?
      AND deleted_at IS NULL
    LIMIT 1
  ');

  $st->bind_param('i', $participacion_origen_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    json_response([
      'ok' => false,
      'error' => 'participacion_origen_id inválido o no encontrado'
    ], 400);
  }
}

/* ============================================================
   FORMATTER
   ============================================================ */

function participacion_row(array $row): array
{
  return [
    'participacion_id' => (int)$row['participacion_id'],
    'folio' => $row['folio'],

    'persona_id' => (int)$row['persona_id'],
    'persona' => [
      'persona_id' => (int)$row['persona_id'],
      'nombres' => $row['persona_nombres'],
      'apellido_paterno' => $row['persona_apellido_paterno'],
      'apellido_materno' => $row['persona_apellido_materno'],
      'nombre_completo' => trim(
        (string)$row['persona_nombres'] . ' ' .
        (string)$row['persona_apellido_paterno'] . ' ' .
        (string)$row['persona_apellido_materno']
      ),
      'telefono' => $row['persona_telefono'],
      'whatsapp' => $row['persona_whatsapp'],
      'email' => $row['persona_email']
    ],

    'tipo_participacion' => $row['tipo_participacion'],
    'participacion_origen_id' => nullable_int_from_row($row, 'participacion_origen_id'),

    'estatus_id' => (int)$row['estatus_id'],
    'estatus' => [
      'estatus_id' => (int)$row['estatus_id'],
      'codigo' => $row['estatus_codigo'],
      'nombre' => $row['estatus_nombre']
    ],

    'territorio_id' => nullable_int_from_row($row, 'territorio_id'),
    'territorio' => [
      'territorio_id' => nullable_int_from_row($row, 'territorio_id'),
      'codigo' => $row['territorio_codigo'],
      'nombre' => $row['territorio_nombre'],
      'tipo' => $row['territorio_tipo'],
      'municipio' => $row['territorio_municipio'],
      'estado' => $row['territorio_estado']
    ],

    'usuario_responsable_id' => nullable_int_from_row($row, 'usuario_responsable_id'),
    'usuario_responsable' => [
      'usuario_id' => nullable_int_from_row($row, 'usuario_responsable_id'),
      'username' => $row['usuario_responsable_username'],
      'nombre' => $row['usuario_responsable_nombre'],
      'apellido_paterno' => $row['usuario_responsable_apellido_paterno'],
      'apellido_materno' => $row['usuario_responsable_apellido_materno'],
      'nombre_completo' => trim(
        (string)$row['usuario_responsable_nombre'] . ' ' .
        (string)$row['usuario_responsable_apellido_paterno'] . ' ' .
        (string)$row['usuario_responsable_apellido_materno']
      )
    ],

    'fuente_captura' => $row['fuente_captura'],
    'fecha_registro' => $row['fecha_registro'],
    'fecha_afiliacion' => $row['fecha_afiliacion'],
    'numero_afiliacion' => $row['numero_afiliacion'],
    'observaciones' => $row['observaciones'],
    'activo' => (int)$row['activo'],

    'created_at' => $row['created_at'],
    'created_by' => nullable_int_from_row($row, 'created_by'),
    'updated_at' => $row['updated_at'],
    'updated_by' => nullable_int_from_row($row, 'updated_by')
  ];
}

function obtener_participacion(mysqli $con, int $participacion_id): array
{
  $sql = '
    SELECT
      pp.*,

      e.codigo AS estatus_codigo,
      e.nombre AS estatus_nombre,

      t.codigo AS territorio_codigo,
      t.nombre AS territorio_nombre,
      t.tipo AS territorio_tipo,
      t.municipio AS territorio_municipio,
      t.estado AS territorio_estado,

      u.username AS usuario_responsable_username,
      u.nombre AS usuario_responsable_nombre,
      u.apellido_paterno AS usuario_responsable_apellido_paterno,
      u.apellido_materno AS usuario_responsable_apellido_materno,

      p.nombres AS persona_nombres,
      p.apellido_paterno AS persona_apellido_paterno,
      p.apellido_materno AS persona_apellido_materno,
      p.telefono AS persona_telefono,
      p.whatsapp AS persona_whatsapp,
      p.email AS persona_email

    FROM persona_participacion pp
    INNER JOIN persona p
      ON p.persona_id = pp.persona_id
     AND p.deleted_at IS NULL
    INNER JOIN cat_estatus e
      ON e.estatus_id = pp.estatus_id
    LEFT JOIN territorio t
      ON t.territorio_id = pp.territorio_id
     AND t.deleted_at IS NULL
    LEFT JOIN usuario u
      ON u.usuario_id = pp.usuario_responsable_id
     AND u.deleted_at IS NULL
    WHERE pp.participacion_id = ?
      AND pp.deleted_at IS NULL
    LIMIT 1
  ';

  $st = $con->prepare($sql);
  $st->bind_param('i', $participacion_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    internal_error("Participación actualizada pero no encontrada. participacion_id=$participacion_id");
  }

  return participacion_row($row);
}

/* ============================================================
   UPDATE
   ============================================================ */

function actualizar_participacion(mysqli $con, array $in): array
{
  $participacion_id = isset($in['participacion_id'])
    ? (int)$in['participacion_id']
    : (isset($in['id']) ? (int)$in['id'] : 0);

  if ($participacion_id <= 0) {
    json_response([
      'ok' => false,
      'error' => 'Falta parámetro obligatorio: participacion_id'
    ], 400);
  }

  $st = $con->prepare('
    SELECT participacion_id
    FROM persona_participacion
    WHERE participacion_id = ?
      AND deleted_at IS NULL
    LIMIT 1
  ');

  $st->bind_param('i', $participacion_id);
  $st->execute();
  $exists = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$exists) {
    json_response([
      'ok' => false,
      'error' => 'Participación no encontrada'
    ], 404);
  }

  $map = [
    'folio' => 's',
    'persona_id' => 'i',
    'tipo_participacion' => 's',
    'participacion_origen_id' => 'i',
    'estatus_id' => 'i',
    'territorio_id' => 'i',
    'usuario_responsable_id' => 'i',
    'fuente_captura' => 's',
    'fecha_registro' => 's',
    'fecha_afiliacion' => 's',
    'numero_afiliacion' => 's',
    'observaciones' => 's',
    'activo' => 'i',
    'updated_by' => 'i'
  ];

  if (array_key_exists('tipo_participacion', $in)) {
    $in['tipo_participacion'] = validar_enum_tipo((string)$in['tipo_participacion']);
  }

  if (array_key_exists('fuente_captura', $in)) {
    $in['fuente_captura'] = validar_enum_fuente(value_or_null($in, 'fuente_captura'));
  }

  if (array_key_exists('persona_id', $in)) {
    $persona_id = int_or_null($in, 'persona_id');

    if ($persona_id === null) {
      json_response([
        'ok' => false,
        'error' => 'persona_id inválido'
      ], 400);
    }

    validar_persona_existe($con, $persona_id);
    $in['persona_id'] = $persona_id;
  }

  if (array_key_exists('participacion_origen_id', $in)) {
    $participacion_origen_id = int_or_null($in, 'participacion_origen_id');
    $in['participacion_origen_id'] = $participacion_origen_id;

    if ($participacion_origen_id !== null) {
      validar_participacion_origen($con, $participacion_id, $participacion_origen_id);
    }
  }

  if (array_key_exists('activo', $in)) {
    $in['activo'] = normalize_bool_int($in['activo']);
  }

  if (array_key_exists('folio', $in)) {
    $in['folio'] = str_clean($in, 'folio');
  }

  if (array_key_exists('fecha_registro', $in)) {
    $in['fecha_registro'] = value_or_null($in, 'fecha_registro');
  }

  if (array_key_exists('fecha_afiliacion', $in)) {
    $in['fecha_afiliacion'] = value_or_null($in, 'fecha_afiliacion');
  }

  if (array_key_exists('numero_afiliacion', $in)) {
    $in['numero_afiliacion'] = value_or_null($in, 'numero_afiliacion');
  }

  if (array_key_exists('observaciones', $in)) {
    $in['observaciones'] = value_or_null($in, 'observaciones');
  }

  if (array_key_exists('territorio_id', $in)) {
    $in['territorio_id'] = int_or_null($in, 'territorio_id');
  }

  if (array_key_exists('usuario_responsable_id', $in)) {
    $in['usuario_responsable_id'] = int_or_null($in, 'usuario_responsable_id');
  }

  if (array_key_exists('estatus_id', $in)) {
    $estatus_id = int_or_null($in, 'estatus_id');

    if ($estatus_id === null) {
      json_response([
        'ok' => false,
        'error' => 'estatus_id inválido'
      ], 400);
    }

    $in['estatus_id'] = $estatus_id;
  }

  if (array_key_exists('updated_by', $in)) {
    $updated_by = int_or_null($in, 'updated_by');

    if ($updated_by === null) {
      json_response([
        'ok' => false,
        'error' => 'updated_by inválido'
      ], 400);
    }

    $in['updated_by'] = $updated_by;
  }

  $set = [];
  $params = [];
  $types = '';

  foreach ($map as $field => $type) {
    if (array_key_exists($field, $in)) {
      $set[] = "$field = ?";
      $params[] = value_or_null($in, $field);
      $types .= $type;
    }
  }

  if (empty($set)) {
    json_response([
      'ok' => false,
      'error' => 'No hay campos para actualizar'
    ], 400);
  }

  $params[] = $participacion_id;
  $types .= 'i';

  $con->begin_transaction();

  try {
    $sql = '
      UPDATE persona_participacion
      SET ' . implode(', ', $set) . '
      WHERE participacion_id = ?
        AND deleted_at IS NULL
    ';

    $st = $con->prepare($sql);
    bind_dynamic($st, $types, $params);
    $st->execute();
    $st->close();

    $data = obtener_participacion($con, $participacion_id);

    $con->commit();

    return $data;
  } catch (mysqli_sql_exception $e) {
    $con->rollback();

    if ((int)$e->getCode() === 1062) {
      $campo = 'único';
      $msg = $e->getMessage();

      if (stripos($msg, 'folio') !== false) {
        $campo = 'folio';
      } elseif (stripos($msg, 'uq_persona_tipo_participacion') !== false) {
        $campo = 'persona_id + tipo_participacion';
      } elseif (stripos($msg, 'uq_numero_afiliacion') !== false) {
        $campo = 'numero_afiliacion';
      }

      json_response([
        'ok' => false,
        'error' => "Duplicado en campo $campo",
        'detail' => $msg,
        'code' => (int)$e->getCode()
      ], 409);
    }

    if ((int)$e->getCode() === 1452) {
      json_response([
        'ok' => false,
        'error' => 'FK inválida. Revisa persona_id, estatus_id, territorio_id, usuario_responsable_id o participacion_origen_id',
        'detail' => $e->getMessage(),
        'code' => (int)$e->getCode()
      ], 400);
    }

    throw $e;
  }
}

/* ============================================================
   MAIN
   ============================================================ */

try {
  $method = $_SERVER['REQUEST_METHOD'] ?? '';

  if (!in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
    json_response([
      'ok' => false,
      'error' => 'Método no permitido. Usa POST, PUT o PATCH.'
    ], 405);
  }

  $in = read_json_body();
  $con = db();

  try {
    $data = actualizar_participacion($con, $in);
  } finally {
    $con->close();
  }

  json_response([
    'ok' => true,
    'data' => $data
  ]);
} catch (mysqli_sql_exception $e) {
  internal_error('MySQL: ' . $e->getMessage() . ' | code=' . $e->getCode());
} catch (Throwable $e) {
  internal_error($e->getMessage());
}

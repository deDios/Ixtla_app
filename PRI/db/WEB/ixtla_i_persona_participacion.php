<?php
// db/WEB/ixtla_i_persona_participacion.php

declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
date_default_timezone_set('America/Mexico_City');

/* ============================================================
   CORS / HEADERS
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
  error_log('[IXTLA_I_PERSONA_PARTICIPACION] ' . $message);

  json_response([
    'ok' => false,
    'error' => 'Error interno del servidor'
  ], 500);
}

function read_json_body(): array
{
  $raw = file_get_contents('php://input');

  if (!$raw || trim($raw) === '') {
    return [];
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

function generar_folio(string $tipo): string
{
  $prefix = $tipo === 'AFILIADO' ? 'AFI' : 'SIM';

  return $prefix . '-' . date('Ymd-His') . '-' . strtoupper(bin2hex(random_bytes(3)));
}

function nullable_int_from_row(array $row, string $key): ?int
{
  return isset($row[$key]) && $row[$key] !== null ? (int)$row[$key] : null;
}

function validar_enum_fuente(?string $fuente): void
{
  if ($fuente === null || $fuente === '') {
    return;
  }

  $validas = [
    'PORTAL',
    'BRIGADA',
    'IMPORTACION',
    'FORMULARIO_WEB',
    'OTRO'
  ];

  if (!in_array($fuente, $validas, true)) {
    json_response([
      'ok' => false,
      'error' => 'fuente_captura inválida',
      'permitidos' => $validas
    ], 400);
  }
}

function validar_persona(mysqli $con, int $persona_id): array
{
  $sql = "
    SELECT
      persona_id,
      nombres,
      apellido_paterno,
      apellido_materno,
      seccion_id,
      capturado_por,
      estatus_id
    FROM persona
    WHERE persona_id = ?
      AND deleted_at IS NULL
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param('i', $persona_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    json_response([
      'ok' => false,
      'error' => 'Persona no encontrada'
    ], 404);
  }

  return $row;
}

function participacion_response(mysqli $con, int $participacion_id): array
{
  $sql = "
    SELECT
      pp.participacion_id,
      pp.folio,
      pp.persona_id,
      pp.tipo_participacion,
      pp.participacion_origen_id,
      pp.estatus_id,
      pp.territorio_id,
      pp.usuario_responsable_id,
      pp.fuente_captura,
      pp.fecha_registro,
      pp.fecha_afiliacion,
      pp.numero_afiliacion,
      pp.observaciones,
      pp.activo,
      pp.created_at,
      pp.created_by,
      pp.updated_at,
      pp.updated_by,

      e.codigo AS estatus_codigo,
      e.nombre AS estatus_nombre,

      t.codigo AS territorio_codigo,
      t.nombre AS territorio_nombre,
      t.tipo AS territorio_tipo,

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
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param('i', $participacion_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    return [];
  }

  $personaNombre = trim(
    (string)$row['persona_nombres'] . ' ' .
      (string)$row['persona_apellido_paterno'] . ' ' .
      (string)$row['persona_apellido_materno']
  );

  $responsableNombre = trim(
    (string)($row['usuario_responsable_nombre'] ?? '') . ' ' .
      (string)($row['usuario_responsable_apellido_paterno'] ?? '') . ' ' .
      (string)($row['usuario_responsable_apellido_materno'] ?? '')
  );

  return [
    'participacion_id' => (int)$row['participacion_id'],
    'folio' => $row['folio'],
    'persona_id' => (int)$row['persona_id'],
    'tipo_participacion' => $row['tipo_participacion'],
    'participacion_origen_id' => nullable_int_from_row($row, 'participacion_origen_id'),

    'estatus_id' => (int)$row['estatus_id'],
    'estatus' => [
      'codigo' => $row['estatus_codigo'],
      'nombre' => $row['estatus_nombre'],
    ],

    'territorio_id' => nullable_int_from_row($row, 'territorio_id'),
    'territorio' => [
      'codigo' => $row['territorio_codigo'],
      'nombre' => $row['territorio_nombre'],
      'tipo' => $row['territorio_tipo'],
    ],

    'usuario_responsable_id' => nullable_int_from_row($row, 'usuario_responsable_id'),
    'usuario_responsable' => [
      'username' => $row['usuario_responsable_username'],
      'nombre' => $row['usuario_responsable_nombre'],
      'apellido_paterno' => $row['usuario_responsable_apellido_paterno'],
      'apellido_materno' => $row['usuario_responsable_apellido_materno'],
      'nombre_completo' => $responsableNombre,
    ],

    'persona' => [
      'nombres' => $row['persona_nombres'],
      'apellido_paterno' => $row['persona_apellido_paterno'],
      'apellido_materno' => $row['persona_apellido_materno'],
      'nombre_completo' => $personaNombre,
      'telefono' => $row['persona_telefono'],
      'whatsapp' => $row['persona_whatsapp'],
      'email' => $row['persona_email'],
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
    'updated_by' => nullable_int_from_row($row, 'updated_by'),
  ];
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

  $persona_id = int_or_null($in, 'persona_id') ?? 0;
  $tipo_participacion = strtoupper(str_clean($in, 'tipo_participacion'));

  if ($persona_id <= 0) {
    json_response([
      'ok' => false,
      'error' => 'Falta parámetro obligatorio: persona_id'
    ], 400);
  }

  if (!in_array($tipo_participacion, ['SIMPATIZANTE', 'AFILIADO'], true)) {
    json_response([
      'ok' => false,
      'error' => 'tipo_participacion inválido. Usa SIMPATIZANTE o AFILIADO'
    ], 400);
  }

  $fuente_captura = str_clean($in, 'fuente_captura');
  if ($fuente_captura === '') {
    $fuente_captura = 'PORTAL';
  }

  validar_enum_fuente($fuente_captura);

  $con = db();

  $persona = validar_persona($con, $persona_id);

  $folio = str_clean($in, 'folio');
  if ($folio === '') {
    $folio = generar_folio($tipo_participacion);
  }

  $estatus_id = int_or_null($in, 'estatus_id') ?? 4;

  $territorio_id = int_or_null($in, 'territorio_id');

  if ($territorio_id === null) {
    $territorio_id = isset($persona['seccion_id']) && $persona['seccion_id'] !== null
      ? (int)$persona['seccion_id']
      : null;
  }

  $usuario_responsable_id = int_or_null($in, 'usuario_responsable_id');

  if ($usuario_responsable_id === null) {
    $usuario_responsable_id = isset($persona['capturado_por']) && $persona['capturado_por'] !== null
      ? (int)$persona['capturado_por']
      : null;
  }

  $fecha_registro = str_clean($in, 'fecha_registro');
  if ($fecha_registro === '') {
    $fecha_registro = date('Y-m-d H:i:s');
  }

  $activo = array_key_exists('activo', $in) ? (int)$in['activo'] : 1;
  $activo = $activo === 1 ? 1 : 0;

  $created_by = int_or_null($in, 'created_by');
  if ($created_by === null) {
    $created_by = $usuario_responsable_id;
  }

  $columns = [
    'folio',
    'persona_id',
    'tipo_participacion',
    'estatus_id',
    'fuente_captura',
    'fecha_registro',
    'activo'
  ];

  $placeholders = [
    '?',
    '?',
    '?',
    '?',
    '?',
    '?',
    '?'
  ];

  $params = [
    $folio,
    $persona_id,
    $tipo_participacion,
    $estatus_id,
    $fuente_captura,
    $fecha_registro,
    $activo
  ];

  $types = 'sisissi';

  if ($territorio_id !== null) {
    $columns[] = 'territorio_id';
    $placeholders[] = '?';
    $params[] = $territorio_id;
    $types .= 'i';
  }

  if ($usuario_responsable_id !== null) {
    $columns[] = 'usuario_responsable_id';
    $placeholders[] = '?';
    $params[] = $usuario_responsable_id;
    $types .= 'i';
  }

  $participacion_origen_id = int_or_null($in, 'participacion_origen_id');
  if ($participacion_origen_id !== null) {
    $columns[] = 'participacion_origen_id';
    $placeholders[] = '?';
    $params[] = $participacion_origen_id;
    $types .= 'i';
  }

  $fecha_afiliacion = str_clean($in, 'fecha_afiliacion');
  if ($fecha_afiliacion !== '') {
    $columns[] = 'fecha_afiliacion';
    $placeholders[] = '?';
    $params[] = $fecha_afiliacion;
    $types .= 's';
  }

  $numero_afiliacion = str_clean($in, 'numero_afiliacion');
  if ($numero_afiliacion !== '') {
    $columns[] = 'numero_afiliacion';
    $placeholders[] = '?';
    $params[] = $numero_afiliacion;
    $types .= 's';
  }

  $observaciones = str_clean($in, 'observaciones');
  if ($observaciones !== '') {
    $columns[] = 'observaciones';
    $placeholders[] = '?';
    $params[] = $observaciones;
    $types .= 's';
  }

  if ($created_by !== null) {
    $columns[] = 'created_by';
    $placeholders[] = '?';
    $params[] = $created_by;
    $types .= 'i';
  }

  $sql = "
    INSERT INTO persona_participacion (
      " . implode(', ', $columns) . "
    ) VALUES (
      " . implode(', ', $placeholders) . "
    )
  ";

  $con->begin_transaction();

  try {
    $st = $con->prepare($sql);
    bind_dynamic($st, $types, $params);
    $st->execute();

    $participacion_id = (int)$con->insert_id;
    $st->close();

    $data = participacion_response($con, $participacion_id);

    $con->commit();
    $con->close();

    json_response([
      'ok' => true,
      'message' => 'Participación creada correctamente',
      'data' => $data
    ]);
  } catch (mysqli_sql_exception $e) {
    $con->rollback();

    $code = (int)$e->getCode();
    $detail = $e->getMessage();

    try {
      $con->close();
    } catch (Throwable $ignored) {
    }

    if ($code === 1062) {
      $campo = 'único';

      if (stripos($detail, 'folio') !== false) {
        $campo = 'folio';
      } elseif (stripos($detail, 'uq_persona_tipo_participacion') !== false) {
        $campo = 'persona_id + tipo_participacion';
      } elseif (stripos($detail, 'uq_numero_afiliacion') !== false) {
        $campo = 'numero_afiliacion';
      }

      json_response([
        'ok' => false,
        'error' => "Duplicado en campo $campo",
        'detail' => $detail,
        'code' => $code
      ], 409);
    }

    if ($code === 1452) {
      json_response([
        'ok' => false,
        'error' => 'FK inválida. Revisa persona_id, estatus_id, territorio_id, usuario_responsable_id o participacion_origen_id',
        'detail' => $detail,
        'code' => $code
      ], 400);
    }

    json_response([
      'ok' => false,
      'error' => 'No se pudo crear la participación',
      'detail' => $detail,
      'code' => $code
    ], 500);
  }
} catch (Throwable $e) {
  error_log('[IXTLA_I_PERSONA_PARTICIPACION][ERROR] ' . $e->getMessage());

  json_response([
    'ok' => false,
    'error' => 'Error interno del servidor',
    'detail' => $e->getMessage()
  ], 500);
}

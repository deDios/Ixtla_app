<?php
// db/WEB/ixtla_i_persona.php

declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
date_default_timezone_set('America/Mexico_City');

/* ============================================================
   CONFIG
   ============================================================ */

$DATA_SECRET = getenv('IXTLA_DATA_SECRET')
  ?: getenv('IXTLA_JWT_SECRET')
  ?: 'c6028c94e5ab1473f2dc40a327cd2faf5041afa364155b9778f4353a35b6f973b1b526619f9c1dbb561926df1fa0de68e97f297206c36ced85b8a39388112343';

if (strlen($DATA_SECRET) < 64) {
  http_response_code(500);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode([
    "ok" => false,
    "error" => "Configuración de seguridad incompleta"
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

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
  error_log('[IXTLA_I_PERSONA] ' . $message);

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

function uuidv4(): string
{
  $data = random_bytes(16);

  $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
  $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);

  return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
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

function sensitive_clean(mixed $value): string
{
  return strtoupper(trim((string)$value));
}

function sensitive_hash(mixed $value): ?string
{
  $clean = sensitive_clean($value);

  if ($clean === '') {
    return null;
  }

  return hash('sha256', $clean);
}

function sensitive_encrypt(mixed $value, string $secret): ?string
{
  $clean = sensitive_clean($value);

  if ($clean === '') {
    return null;
  }

  $key = hash('sha256', $secret, true);
  $iv = random_bytes(12);
  $tag = '';

  $cipher = openssl_encrypt(
    $clean,
    'aes-256-gcm',
    $key,
    OPENSSL_RAW_DATA,
    $iv,
    $tag
  );

  if ($cipher === false) {
    throw new Exception('No se pudo cifrar dato sensible');
  }

  return base64_encode($iv . $tag . $cipher);
}

function sensitive_decrypt(mixed $encoded, string $secret): ?string
{
  if ($encoded === null || $encoded === '') {
    return null;
  }

  $raw = base64_decode((string)$encoded, true);

  if ($raw === false || strlen($raw) < 29) {
    return null;
  }

  $key = hash('sha256', $secret, true);

  $iv = substr($raw, 0, 12);
  $tag = substr($raw, 12, 16);
  $cipher = substr($raw, 28);

  $plain = openssl_decrypt(
    $cipher,
    'aes-256-gcm',
    $key,
    OPENSSL_RAW_DATA,
    $iv,
    $tag
  );

  return $plain === false ? null : $plain;
}


/* ============================================================
   DUPLICADOS
   ============================================================ */

function get_duplicate_field_from_sql(string $sqlMessage): ?string
{
  if (stripos($sqlMessage, 'uq_persona_curp_hash') !== false) {
    return 'curp_hash';
  }

  if (stripos($sqlMessage, 'uq_persona_clave_elector_hash') !== false) {
    return 'clave_elector_hash';
  }

  return null;
}

function get_duplicate_label(string $field): string
{
  return match ($field) {
    'curp_hash' => 'CURP',
    'clave_elector_hash' => 'Clave de elector',
    default => 'Dato único',
  };
}

function get_hash_from_input_for_duplicate(array $in, string $field): ?string
{
  if ($field === 'curp_hash') {
    if (array_key_exists('curp_hash', $in) && trim((string)$in['curp_hash']) !== '') {
      return trim((string)$in['curp_hash']);
    }

    return sensitive_hash($in['curp'] ?? '');
  }

  if ($field === 'clave_elector_hash') {
    if (array_key_exists('clave_elector_hash', $in) && trim((string)$in['clave_elector_hash']) !== '') {
      return trim((string)$in['clave_elector_hash']);
    }

    return sensitive_hash($in['clave_elector'] ?? '');
  }

  return null;
}

function persona_duplicada_row(array $row): array
{
  $capturadorNombre = trim(
    (string)($row['capturado_por_nombre'] ?? '') . ' ' .
      (string)($row['capturado_por_apellido_paterno'] ?? '') . ' ' .
      (string)($row['capturado_por_apellido_materno'] ?? '')
  );

  $personaNombre = trim(
    (string)($row['nombres'] ?? '') . ' ' .
      (string)($row['apellido_paterno'] ?? '') . ' ' .
      (string)($row['apellido_materno'] ?? '')
  );

  return [
    "persona_id" => (int)$row['persona_id'],
    "uuid" => $row['uuid'],
    "nombre_completo" => $personaNombre,
    "nombres" => $row['nombres'],
    "apellido_paterno" => $row['apellido_paterno'],
    "apellido_materno" => $row['apellido_materno'],
    "seccion_id" => nullable_int_from_row($row, 'seccion_id'),
    "telefono" => $row['telefono'],
    "whatsapp" => $row['whatsapp'],
    "email" => $row['email'],
    "estatus_id" => (int)$row['estatus_id'],
    "capturado_por" => nullable_int_from_row($row, 'capturado_por'),
    "capturado_por_usuario" => [
      "usuario_id" => nullable_int_from_row($row, 'capturado_por'),
      "username" => $row['capturado_por_username'],
      "nombre" => $row['capturado_por_nombre'],
      "apellido_paterno" => $row['capturado_por_apellido_paterno'],
      "apellido_materno" => $row['capturado_por_apellido_materno'],
      "nombre_completo" => $capturadorNombre,
    ],
    "fecha_captura" => $row['fecha_captura'],
    "created_at" => $row['created_at'],
    "updated_at" => $row['updated_at'],
  ];
}

function buscar_persona_duplicada(mysqli $con, array $in, string $sqlMessage): ?array
{
  $field = get_duplicate_field_from_sql($sqlMessage);

  if ($field === null) {
    return null;
  }

  $hash = get_hash_from_input_for_duplicate($in, $field);

  if ($hash === null || trim((string)$hash) === '') {
    return [
      "duplicate_field" => $field,
      "duplicate_label" => get_duplicate_label($field),
      "existing_persona" => null,
    ];
  }

  $sql = "
    SELECT
      p.persona_id,
      p.uuid,
      p.nombres,
      p.apellido_paterno,
      p.apellido_materno,
      p.seccion_id,
      p.telefono,
      p.whatsapp,
      p.email,
      p.estatus_id,
      p.capturado_por,
      p.fecha_captura,
      p.created_at,
      p.updated_at,

      u.username AS capturado_por_username,
      u.nombre AS capturado_por_nombre,
      u.apellido_paterno AS capturado_por_apellido_paterno,
      u.apellido_materno AS capturado_por_apellido_materno

    FROM persona p
    LEFT JOIN usuario u
      ON u.usuario_id = p.capturado_por
     AND u.deleted_at IS NULL
    WHERE p.$field = ?
      AND p.deleted_at IS NULL
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param('s', $hash);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();

  return [
    "duplicate_field" => $field,
    "duplicate_label" => get_duplicate_label($field),
    "existing_persona" => $row ? persona_duplicada_row($row) : null,
  ];
}

function cerrar_conexion_si_abierta(mixed $con): void
{
  if ($con instanceof mysqli) {
    try {
      $con->close();
    } catch (Throwable $ignored) {
    }
  }
}


/* ============================================================
   PARTICIPACIÓN RED
   ============================================================ */

function normalizar_tipo_participacion(mixed $value): ?string
{
  $tipo = strtoupper(trim((string)$value));

  if ($tipo === '') {
    return null;
  }

  return match ($tipo) {
    'AFILIADO' => 'AFILIADO',
    'SIMPATIZANTE' => 'SIMPATIZANTE',
    default => null,
  };
}

function generar_folio_participacion(string $tipo, int $persona_id): string
{
  $prefix = $tipo === 'AFILIADO' ? 'AFI' : 'SIM';
  return 'RED-' . $prefix . '-' . $persona_id . '-' . date('YmdHis') . '-' . strtoupper(bin2hex(random_bytes(2)));
}

function int_input_or_null(array $in, array $keys): ?int
{
  foreach ($keys as $key) {
    if (array_key_exists($key, $in) && $in[$key] !== '' && (int)$in[$key] > 0) {
      return (int)$in[$key];
    }
  }

  return null;
}

function str_input_or_null(array $in, array $keys): ?string
{
  foreach ($keys as $key) {
    if (array_key_exists($key, $in)) {
      $value = trim((string)$in[$key]);
      return $value !== '' ? $value : null;
    }
  }

  return null;
}

function fuente_captura_or_null(mixed $value): ?string
{
  $fuente = strtoupper(trim((string)$value));

  if ($fuente === '') {
    return null;
  }

  return in_array($fuente, ['PORTAL', 'BRIGADA', 'IMPORTACION', 'FORMULARIO_WEB', 'OTRO'], true)
    ? $fuente
    : null;
}

function obtener_participaciones_activas(mysqli $con, int $persona_id): array
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

      ce.codigo AS estatus_codigo,
      ce.nombre AS estatus_nombre,

      t.codigo AS territorio_codigo,
      t.nombre AS territorio_nombre,
      t.tipo AS territorio_tipo,

      u.username AS responsable_username,
      u.nombre AS responsable_nombre,
      u.apellido_paterno AS responsable_apellido_paterno,
      u.apellido_materno AS responsable_apellido_materno

    FROM persona_participacion pp

    LEFT JOIN cat_estatus ce
      ON ce.estatus_id = pp.estatus_id

    LEFT JOIN territorio t
      ON t.territorio_id = pp.territorio_id
     AND t.deleted_at IS NULL

    LEFT JOIN usuario u
      ON u.usuario_id = pp.usuario_responsable_id
     AND u.deleted_at IS NULL

    WHERE pp.persona_id = ?
      AND pp.deleted_at IS NULL
      AND pp.activo = 1

    ORDER BY
      CASE pp.tipo_participacion
        WHEN 'AFILIADO' THEN 2
        WHEN 'SIMPATIZANTE' THEN 1
        ELSE 0
      END DESC,
      pp.fecha_registro DESC,
      pp.participacion_id DESC
  ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $persona_id);
  $st->execute();

  $rs = $st->get_result();
  $data = [];

  while ($row = $rs->fetch_assoc()) {
    $responsableNombre = trim(
      (string)($row['responsable_nombre'] ?? '') . ' ' .
        (string)($row['responsable_apellido_paterno'] ?? '') . ' ' .
        (string)($row['responsable_apellido_materno'] ?? '')
    );

    $data[] = [
      "participacion_id" => (int)$row['participacion_id'],
      "folio" => $row['folio'],
      "persona_id" => (int)$row['persona_id'],
      "tipo_participacion" => $row['tipo_participacion'],
      "participacion_origen_id" => nullable_int_from_row($row, 'participacion_origen_id'),
      "estatus_id" => (int)$row['estatus_id'],
      "estatus" => [
        "codigo" => $row['estatus_codigo'],
        "nombre" => $row['estatus_nombre']
      ],
      "territorio_id" => nullable_int_from_row($row, 'territorio_id'),
      "territorio" => [
        "territorio_id" => nullable_int_from_row($row, 'territorio_id'),
        "codigo" => $row['territorio_codigo'],
        "nombre" => $row['territorio_nombre'],
        "tipo" => $row['territorio_tipo']
      ],
      "usuario_responsable_id" => nullable_int_from_row($row, 'usuario_responsable_id'),
      "usuario_responsable" => [
        "usuario_id" => nullable_int_from_row($row, 'usuario_responsable_id'),
        "username" => $row['responsable_username'],
        "nombre" => $row['responsable_nombre'],
        "apellido_paterno" => $row['responsable_apellido_paterno'],
        "apellido_materno" => $row['responsable_apellido_materno'],
        "nombre_completo" => $responsableNombre
      ],
      "fuente_captura" => $row['fuente_captura'],
      "fecha_registro" => $row['fecha_registro'],
      "fecha_afiliacion" => $row['fecha_afiliacion'],
      "numero_afiliacion" => $row['numero_afiliacion'],
      "observaciones" => $row['observaciones'],
      "activo" => (int)$row['activo'],
      "created_at" => $row['created_at'],
      "created_by" => nullable_int_from_row($row, 'created_by'),
      "updated_at" => $row['updated_at'],
      "updated_by" => nullable_int_from_row($row, 'updated_by')
    ];
  }

  $st->close();

  return $data;
}

function obtener_participacion_resumen(mysqli $con, int $persona_id): array
{
  $participaciones = obtener_participaciones_activas($con, $persona_id);

  $principal = $participaciones[0] ?? null;

  $tieneSimpatizante = false;
  $tieneAfiliado = false;

  foreach ($participaciones as $participacion) {
    if (($participacion['tipo_participacion'] ?? '') === 'SIMPATIZANTE') {
      $tieneSimpatizante = true;
    }

    if (($participacion['tipo_participacion'] ?? '') === 'AFILIADO') {
      $tieneAfiliado = true;
    }
  }

  return [
    "actual" => $principal,
    "tipo_actual" => $principal['tipo_participacion'] ?? null,
    "tiene_simpatizante_activo" => $tieneSimpatizante,
    "tiene_afiliado_activo" => $tieneAfiliado,
    "participaciones_activas" => count($participaciones),
    "activas" => $participaciones
  ];
}

function buscar_participacion_sin_filtrar_activo(mysqli $con, int $persona_id, string $tipo): ?array
{
  $sql = "
    SELECT participacion_id, activo, deleted_at
    FROM persona_participacion
    WHERE persona_id = ?
      AND tipo_participacion = ?
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("is", $persona_id, $tipo);
  $st->execute();

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  return $row ?: null;
}

function activar_o_insertar_participacion(mysqli $con, int $persona_id, string $tipo, array $in, ?int $usuarioActor = null): void
{
  $existente = buscar_participacion_sin_filtrar_activo($con, $persona_id, $tipo);

  $estatusId = int_input_or_null($in, ['participacion_estatus_id', 'estatus_participacion_id']) ?? 4;
  $territorioId = int_input_or_null($in, ['participacion_territorio_id', 'territorio_id', 'seccion_id']);
  $responsableId = int_input_or_null($in, ['usuario_responsable_id', 'capturado_por', 'created_by', 'updated_by']) ?? $usuarioActor;
  $fuenteCaptura = fuente_captura_or_null($in['fuente_captura'] ?? null);
  $fechaAfiliacion = $tipo === 'AFILIADO'
    ? str_input_or_null($in, ['fecha_afiliacion'])
    : null;
  $numeroAfiliacion = $tipo === 'AFILIADO'
    ? str_input_or_null($in, ['numero_afiliacion'])
    : null;
  $observaciones = str_input_or_null($in, ['observaciones_participacion']);

  if ($existente) {
    $set = [
      "activo = 1",
      "deleted_at = NULL",
      "deleted_by = NULL",
      "estatus_id = ?"
    ];

    $params = [$estatusId];
    $types = "i";

    if ($territorioId !== null) {
      $set[] = "territorio_id = ?";
      $params[] = $territorioId;
      $types .= "i";
    }

    if ($responsableId !== null) {
      $set[] = "usuario_responsable_id = ?";
      $params[] = $responsableId;
      $types .= "i";
    }

    if ($fuenteCaptura !== null) {
      $set[] = "fuente_captura = ?";
      $params[] = $fuenteCaptura;
      $types .= "s";
    }

    if ($fechaAfiliacion !== null) {
      $set[] = "fecha_afiliacion = ?";
      $params[] = $fechaAfiliacion;
      $types .= "s";
    }

    if ($numeroAfiliacion !== null) {
      $set[] = "numero_afiliacion = ?";
      $params[] = $numeroAfiliacion;
      $types .= "s";
    }

    if ($observaciones !== null) {
      $set[] = "observaciones = ?";
      $params[] = $observaciones;
      $types .= "s";
    }

    if ($usuarioActor !== null) {
      $set[] = "updated_by = ?";
      $params[] = $usuarioActor;
      $types .= "i";
    }

    $params[] = (int)$existente['participacion_id'];
    $types .= "i";

    $sql = "
      UPDATE persona_participacion
      SET " . implode(", ", $set) . "
      WHERE participacion_id = ?
    ";

    $st = $con->prepare($sql);
    bind_dynamic($st, $types, $params);
    $st->execute();
    $st->close();

    return;
  }

  $folio = generar_folio_participacion($tipo, $persona_id);
  $createdBy = $usuarioActor;

  $sql = "
    INSERT INTO persona_participacion (
      folio,
      persona_id,
      tipo_participacion,
      estatus_id,
      territorio_id,
      usuario_responsable_id,
      fuente_captura,
      fecha_afiliacion,
      numero_afiliacion,
      observaciones,
      activo,
      created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  ";

  $params = [
    $folio,
    $persona_id,
    $tipo,
    $estatusId,
    $territorioId,
    $responsableId,
    $fuenteCaptura,
    $fechaAfiliacion,
    $numeroAfiliacion,
    $observaciones,
    $createdBy
  ];

  $types = "sisiiissssi";

  $st = $con->prepare($sql);
  bind_dynamic($st, $types, $params);
  $st->execute();
  $st->close();
}

function desactivar_participacion(mysqli $con, int $persona_id, string $tipo, ?int $usuarioActor = null): void
{
  $existente = buscar_participacion_sin_filtrar_activo($con, $persona_id, $tipo);

  if (!$existente) {
    return;
  }

  $sql = "
    UPDATE persona_participacion
    SET activo = 0,
        updated_by = ?
    WHERE participacion_id = ?
  ";

  $participacionId = (int)$existente['participacion_id'];
  $st = $con->prepare($sql);
  $st->bind_param("ii", $usuarioActor, $participacionId);
  $st->execute();
  $st->close();
}

function sincronizar_participaciones_persona(mysqli $con, int $persona_id, array $in, ?int $usuarioActor = null, bool $usarDefaultSimpatizante = false): void
{
  $tipo = null;

  if (array_key_exists('tipo_participacion', $in)) {
    $tipo = normalizar_tipo_participacion($in['tipo_participacion']);
  } elseif (array_key_exists('participacion', $in)) {
    $tipo = normalizar_tipo_participacion($in['participacion']);
  } elseif ($usarDefaultSimpatizante) {
    $tipo = 'SIMPATIZANTE';
  }

  if ($tipo === null) {
    return;
  }

  if ($tipo === 'AFILIADO') {
    activar_o_insertar_participacion($con, $persona_id, 'SIMPATIZANTE', $in, $usuarioActor);
    activar_o_insertar_participacion($con, $persona_id, 'AFILIADO', $in, $usuarioActor);
    return;
  }

  activar_o_insertar_participacion($con, $persona_id, 'SIMPATIZANTE', $in, $usuarioActor);
  desactivar_participacion($con, $persona_id, 'AFILIADO', $usuarioActor);
}

/* ============================================================
   FORMATTER
   ============================================================ */

function persona_row(array $row): array
{
  global $DATA_SECRET;

  $curp = sensitive_decrypt($row['curp_enc'] ?? null, $DATA_SECRET);
  $clave_elector = sensitive_decrypt($row['clave_elector_enc'] ?? null, $DATA_SECRET);

  return [
    "persona_id" => (int)$row['persona_id'],
    "uuid" => $row['uuid'],

    "nombres" => $row['nombres'],
    "apellido_paterno" => $row['apellido_paterno'],
    "apellido_materno" => $row['apellido_materno'],
    "nombre_completo" => trim(
      (string)$row['nombres'] . ' ' .
        (string)$row['apellido_paterno'] . ' ' .
        (string)$row['apellido_materno']
    ),

    "fecha_nacimiento" => $row['fecha_nacimiento'],
    "sexo" => $row['sexo'],

    "curp" => $curp,
    "clave_elector" => $clave_elector,

    "curp_hash" => $row['curp_hash'],
    "clave_elector_hash" => $row['clave_elector_hash'],
    "ocr_hash" => $row['ocr_hash'],
    "cic_hash" => $row['cic_hash'],
    "idmex_hash" => $row['idmex_hash'],

    "seccion_id" => nullable_int_from_row($row, 'seccion_id'),
    "anio_registro" => nullable_int_from_row($row, 'anio_registro'),
    "emision" => nullable_int_from_row($row, 'emision'),
    "vigencia_inicio" => $row['vigencia_inicio'],
    "vigencia_fin" => $row['vigencia_fin'],

    "domicilio_texto" => $row['domicilio_texto'],
    "calle" => $row['calle'],
    "numero_exterior" => $row['numero_exterior'],
    "numero_interior" => $row['numero_interior'],
    "colonia" => $row['colonia'],
    "localidad" => $row['localidad'],
    "municipio" => $row['municipio'],
    "estado" => $row['estado'],
    "codigo_postal" => $row['codigo_postal'],

    "telefono" => $row['telefono'],
    "whatsapp" => $row['whatsapp'],
    "email" => $row['email'],

    "acepta_tratamiento_datos" => (int)$row['acepta_tratamiento_datos'],
    "acepta_datos_sensibles" => (int)$row['acepta_datos_sensibles'],
    "acepta_contacto_whatsapp" => (int)$row['acepta_contacto_whatsapp'],
    "aviso_privacidad_version" => $row['aviso_privacidad_version'],
    "fecha_consentimiento" => $row['fecha_consentimiento'],

    "estatus_id" => (int)$row['estatus_id'],
    "capturado_por" => nullable_int_from_row($row, 'capturado_por'),

    "fecha_captura" => $row['fecha_captura'],
    "observaciones" => $row['observaciones'],

    "created_at" => $row['created_at'],
    "created_by" => nullable_int_from_row($row, 'created_by'),
    "updated_at" => $row['updated_at'],
    "updated_by" => nullable_int_from_row($row, 'updated_by')
  ];
}

/* ============================================================
   INSERT
   ============================================================ */

function insertar_persona(mysqli $con, array $in): array
{
  $nombres = str_clean($in, 'nombres');

  if ($nombres === '') {
    json_response([
      "ok" => false,
      "error" => "Falta parámetro obligatorio: nombres"
    ], 400);
  }

  $estatus_id = isset($in['estatus_id']) && (int)$in['estatus_id'] > 0
    ? (int)$in['estatus_id']
    : 1;

  $capturado_por = isset($in['capturado_por']) && (int)$in['capturado_por'] > 0
    ? (int)$in['capturado_por']
    : null;

  $created_by = isset($in['created_by']) && (int)$in['created_by'] > 0
    ? (int)$in['created_by']
    : $capturado_por;

  global $DATA_SECRET;

  $curp = sensitive_clean($in['curp'] ?? '');
  $clave_elector = sensitive_clean($in['clave_elector'] ?? '');

  if ($curp !== '') {
    $in['curp_hash'] = sensitive_hash($curp);
    $in['curp_enc'] = sensitive_encrypt($curp, $DATA_SECRET);
  }

  if ($clave_elector !== '') {
    $in['clave_elector_hash'] = sensitive_hash($clave_elector);
    $in['clave_elector_enc'] = sensitive_encrypt($clave_elector, $DATA_SECRET);
  }

  $columns = [
    "uuid",
    "nombres",
    "estatus_id"
  ];

  $placeholders = [
    "?",
    "?",
    "?"
  ];

  $params = [
    uuidv4(),
    $nombres,
    $estatus_id
  ];

  $types = "ssi";

  if ($capturado_por !== null) {
    $columns[] = "capturado_por";
    $placeholders[] = "?";
    $params[] = $capturado_por;
    $types .= "i";
  }

  if ($created_by !== null) {
    $columns[] = "created_by";
    $placeholders[] = "?";
    $params[] = $created_by;
    $types .= "i";
  }

  $map = [
    "apellido_paterno" => "s",
    "apellido_materno" => "s",
    "fecha_nacimiento" => "s",
    "sexo" => "s",

    "curp_hash" => "s",
    "curp_enc" => "s",
    "clave_elector_hash" => "s",
    "clave_elector_enc" => "s",
    "ocr_hash" => "s",
    "cic_hash" => "s",
    "idmex_hash" => "s",

    "seccion_id" => "i",
    "anio_registro" => "i",
    "emision" => "i",
    "vigencia_inicio" => "s",
    "vigencia_fin" => "s",

    "domicilio_texto" => "s",
    "calle" => "s",
    "numero_exterior" => "s",
    "numero_interior" => "s",
    "colonia" => "s",
    "localidad" => "s",
    "municipio" => "s",
    "estado" => "s",
    "codigo_postal" => "s",

    "telefono" => "s",
    "whatsapp" => "s",
    "email" => "s",

    "acepta_tratamiento_datos" => "i",
    "acepta_datos_sensibles" => "i",
    "acepta_contacto_whatsapp" => "i",
    "aviso_privacidad_version" => "s",
    "fecha_consentimiento" => "s",

    "observaciones" => "s"
  ];

  foreach ($map as $field => $type) {
    if (!array_key_exists($field, $in)) {
      continue;
    }

    $columns[] = $field;
    $placeholders[] = "?";

    if (in_array($field, [
      "acepta_tratamiento_datos",
      "acepta_datos_sensibles",
      "acepta_contacto_whatsapp"
    ], true)) {
      $params[] = normalize_bool_int($in[$field]);
    } else {
      $params[] = value_or_null($in, $field);
    }

    $types .= $type;
  }

  $sql = "
        INSERT INTO persona (
            " . implode(", ", $columns) . "
        )
        VALUES (
            " . implode(", ", $placeholders) . "
        )
    ";

  $st = $con->prepare($sql);
  bind_dynamic($st, $types, $params);
  $st->execute();

  $persona_id = (int)$con->insert_id;

  $st->close();

  sincronizar_participaciones_persona($con, $persona_id, $in, $created_by, true);

  $st = $con->prepare("
        SELECT *
        FROM persona
        WHERE persona_id = ?
        LIMIT 1
    ");

  $st->bind_param("i", $persona_id);
  $st->execute();

  $row = $st->get_result()->fetch_assoc();

  $st->close();

  if (!$row) {
    internal_error("Persona insertada pero no encontrada. persona_id=$persona_id");
  }

  $data = persona_row($row);
  $data["participacion"] = obtener_participacion_resumen($con, $persona_id);

  return $data;
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
    $data = insertar_persona($con, $in);
    $con->commit();
  } catch (Throwable $e) {
    $con->rollback();
    throw $e;
  }

  $con->close();

  json_response([
    "ok" => true,
    "message" => "Persona creada correctamente",
    "data" => $data
  ], 201);
} catch (mysqli_sql_exception $e) {
  $code = (int)$e->getCode();
  $msg = $e->getMessage();

  error_log('[IXTLA_I_PERSONA][SQL] ' . $msg);

  if ($code === 1062) {
    $campo = "único";
    $duplicateData = null;

    if (stripos($msg, "uq_persona_curp_hash") !== false) {
      $campo = "curp_hash";
    } elseif (stripos($msg, "uq_persona_clave_elector_hash") !== false) {
      $campo = "clave_elector_hash";
    } elseif (stripos($msg, "uuid") !== false) {
      $campo = "uuid";
    }

    if (isset($con) && $con instanceof mysqli && in_array($campo, ['curp_hash', 'clave_elector_hash'], true)) {
      try {
        $duplicateData = buscar_persona_duplicada($con, $in ?? [], $msg);
      } catch (Throwable $lookupError) {
        error_log('[IXTLA_I_PERSONA][DUPLICATE_LOOKUP] ' . $lookupError->getMessage());
      }
    }

    cerrar_conexion_si_abierta($con ?? null);

    json_response([
      "ok" => false,
      "error" => in_array($campo, ['curp_hash', 'clave_elector_hash'], true)
        ? "La persona ya se encuentra registrada"
        : "Duplicado en campo $campo",
      "message" => in_array($campo, ['curp_hash', 'clave_elector_hash'], true)
        ? "La persona ya se encuentra registrada"
        : "Duplicado en campo $campo",
      "code" => $code,
      "duplicate" => in_array($campo, ['curp_hash', 'clave_elector_hash'], true),
      "duplicate_field" => $duplicateData['duplicate_field'] ?? $campo,
      "duplicate_label" => $duplicateData['duplicate_label'] ?? $campo,
      "existing_persona" => $duplicateData['existing_persona'] ?? null
    ], 409);
  }

  cerrar_conexion_si_abierta($con ?? null);

  if ($code === 1452) {
    json_response([
      "ok" => false,
      "error" => "FK inválida. Revisa estatus_id, seccion_id, capturado_por o created_by",
      "code" => $code
    ], 400);
  }

  if ($code === 1265 || $code === 1406 || $code === 1366) {
    json_response([
      "ok" => false,
      "error" => "Dato inválido o demasiado largo para algún campo",
      "code" => $code
    ], 400);
  }

  json_response([
    "ok" => false,
    "error" => "No se pudo crear la persona",
    "code" => $code
  ], 500);
} catch (Throwable $e) {
  cerrar_conexion_si_abierta($con ?? null);

  error_log('[IXTLA_I_PERSONA][ERROR] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error interno del servidor"
  ], 500);
}

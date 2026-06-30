<?php
// db/WEB/ixtla_u_persona.php

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
    "error" => "Configuracion de seguridad incompleta"
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
  error_log('[IXTLA_U_PERSONA] ' . $message);

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
      "error" => "JSON invalido"
    ], 400);
  }

  return $in;
}

function db(): mysqli
{
  $path = realpath("/home/site/wwwroot/db/conn/conn_db_2.php");

  if (!$path || !file_exists($path)) {
    internal_error("No se encontro conn_db_2.php en /home/site/wwwroot/db/conn/conn_db_2.php");
  }

  include_once $path;

  if (!function_exists('conectar')) {
    internal_error("No existe la funcion conectar() en conn_db_2.php");
  }

  $con = conectar();

  if (!$con instanceof mysqli) {
    internal_error("conectar() no regreso una conexion mysqli valida");
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
   PARTICIPACION RED
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

function normalize_rol_codigo(array $in): string
{
  $rol = trim((string)($in['rol_codigo'] ?? ''));

  if ($rol === '' && isset($in['rol']) && is_array($in['rol'])) {
    $rol = trim((string)($in['rol']['codigo'] ?? ''));
  }

  return strtoupper($rol);
}

function is_red_home_person_edit_context(array $in): bool
{
  return strtoupper(trim((string)($in['update_context'] ?? ''))) === 'RED_HOME_PERSON_EDIT';
}

function filter_red_home_person_edit_input(array $in): array
{
  if (!is_red_home_person_edit_context($in)) {
    return $in;
  }

  $allowedKeys = [
    'persona_id',
    'id',
    'seccion_id',
    'domicilio_texto',
    'telefono',
    'whatsapp',
    'email',
    'observaciones',
    'estatus_id',
    'tipo_participacion',
    'participacion_estatus_id',
    'updated_by',
    'usuario_id',
    'usuario_responsable_id',
    'rol_codigo',
    'rol_id',
    'update_context',
    'fuente_captura',
  ];

  $filtered = [];

  foreach ($allowedKeys as $key) {
    if (array_key_exists($key, $in)) {
      $filtered[$key] = $in[$key];
    }
  }

  return $filtered;
}

function assert_red_home_person_edit_permission(mysqli $con, array $in, int $persona_id): void
{
  if (!is_red_home_person_edit_context($in)) {
    return;
  }

  $rolCodigo = normalize_rol_codigo($in);
  $resumen = obtener_participacion_resumen($con, $persona_id);
  $tipo = strtoupper(trim((string)($resumen["tipo_actual"] ?? $resumen["actual"]["tipo_participacion"] ?? "SIMPATIZANTE")));

  $allowed = false;

  if ($rolCodigo === 'ADMIN' || $rolCodigo === 'COORD_GENERAL') {
    $allowed = true;
  } elseif (in_array($rolCodigo, ['COORD_ZONA', 'COORD_SECCION'], true)) {
    $allowed = $tipo !== 'AFILIADO';
  }

  if ($allowed) {
    return;
  }

  json_response([
    'ok' => false,
    'error' => 'No tienes permiso para editar este registro.'
  ], 403);
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
    "tipo_actual" => $principal["tipo_participacion"] ?? null,
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

  $estatusId = int_input_or_null($in, ["participacion_estatus_id", "estatus_participacion_id"]) ?? 4;
  $territorioId = int_input_or_null($in, ['participacion_territorio_id', 'territorio_id', 'seccion_id']);
  $responsableId = int_input_or_null($in, ["usuario_responsable_id", "capturado_por", "created_by", "updated_by"]) ?? $usuarioActor;
  $fuenteCaptura = fuente_captura_or_null($in["fuente_captura"] ?? null);
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

  $curp = sensitive_decrypt($row["curp_enc"] ?? null, $DATA_SECRET);
  $clave_elector = sensitive_decrypt($row["clave_elector_enc"] ?? null, $DATA_SECRET);

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
   UPDATE
   ============================================================ */

function actualizar_persona(mysqli $con, array $in): array
{
  global $DATA_SECRET;

  $persona_id = isset($in['persona_id'])
    ? (int)$in['persona_id']
    : (isset($in['id']) ? (int)$in['id'] : 0);

  if ($persona_id <= 0) {
    json_response([
      "ok" => false,
      "error" => "Falta parametro obligatorio: persona_id"
    ], 400);
  }

  $check = $con->prepare("
    SELECT persona_id
    FROM persona
    WHERE persona_id = ?
      AND deleted_at IS NULL
    LIMIT 1
  ");

  $check->bind_param("i", $persona_id);
  $check->execute();
  $exists = $check->get_result()->fetch_assoc();
  $check->close();

  if (!$exists) {
    json_response([
      "ok" => false,
      "error" => "Persona no encontroada"
    ], 404);
  }

  assert_red_home_person_edit_permission($con, $in, $persona_id);
  $in = filter_red_home_person_edit_input($in);

  /*
    Si el front manda curp o clave_elector, el endpoint genera:
    - *_hash para duplicados/busqueda
    - *_enc para poder consultar el dato despues

    Si manda curp: "" o clave_elector: "", se limpian hash y enc.
  */

  if (array_key_exists('curp', $in)) {
    $curp = sensitive_clean($in['curp']);

    $in['curp_hash'] = $curp !== ''
      ? sensitive_hash($curp)
      : null;

    $in['curp_enc'] = $curp !== ''
      ? sensitive_encrypt($curp, $DATA_SECRET)
      : null;
  }

  if (array_key_exists('clave_elector', $in)) {
    $clave_elector = sensitive_clean($in['clave_elector']);

    $in['clave_elector_hash'] = $clave_elector !== ''
      ? sensitive_hash($clave_elector)
      : null;

    $in['clave_elector_enc'] = $clave_elector !== ''
      ? sensitive_encrypt($clave_elector, $DATA_SECRET)
      : null;
  }

  $map = [
    "nombres" => "s",
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

    "estatus_id" => "i",
    "observaciones" => "s"
  ];

  $set = [];
  $params = [];
  $types = "";

  foreach ($map as $field => $type) {
    if (!array_key_exists($field, $in)) {
      continue;
    }

    $set[] = "$field = ?";

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

  if (isset($in['updated_by']) && (int)$in['updated_by'] > 0) {
    $set[] = "updated_by = ?";
    $params[] = (int)$in['updated_by'];
    $types .= "i";
  }

  if (empty($set)) {
    json_response([
      "ok" => false,
      "error" => "No hay campos para actualizar"
    ], 400);
  }

  $params[] = $persona_id;
  $types .= "i";

  $sql = "
    UPDATE persona
    SET " . implode(", ", $set) . "
    WHERE persona_id = ?
      AND deleted_at IS NULL
  ";

  $st = $con->prepare($sql);
  bind_dynamic($st, $types, $params);
  $st->execute();
  $st->close();

  $usuarioActor = isset($in['updated_by']) && (int)$in['updated_by'] > 0
    ? (int)$in['updated_by']
    : null;

  sincronizar_participaciones_persona($con, $persona_id, $in, $usuarioActor, false);

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
    internal_error("Persona actualizada pero no encontroada. persona_id=$persona_id");
  }

  $data = persona_row($row);
  $data["participacion"] = obtener_participacion_resumen($con, $persona_id);

  return $data;
}

/* ============================================================
   MAIN
   ============================================================ */

try {
  if (!in_array(($_SERVER['REQUEST_METHOD'] ?? ''), ['POST', 'PUT', 'PATCH'], true)) {
    json_response([
      "ok" => false,
      "error" => "Metodo no permitido. Usa POST, PUT o PATCH."
    ], 405);
  }

  $in = read_json_body();
  $con = db();

  $con->begin_transaction();

  try {
    $data = actualizar_persona($con, $in);
    $con->commit();
  } catch (Throwable $e) {
    $con->rollback();
    throw $e;
  }

  $con->close();

  json_response([
    "ok" => true,
    "message" => "Persona actualizada correctamente",
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

  error_log('[IXTLA_U_PERSONA][SQL] ' . $msg);

  if ($code === 1062) {
    $campo = "unico";

    if (stripos($msg, "uq_persona_curp_hash") !== false) {
      $campo = "CURP";
    } elseif (stripos($msg, "uq_persona_clave_elector_hash") !== false) {
      $campo = "Clave de elector";
    } elseif (stripos($msg, "uuid") !== false) {
      $campo = "uuid";
    }

    json_response([
      "ok" => false,
      "error" => "Duplicado en campo $campo",
      "code" => $code
    ], 409);
  }

  if ($code === 1452) {
    json_response([
      "ok" => false,
      "error" => "FK invalida. Revisa estatus_id, seccion_id o updated_by",
      "code" => $code
    ], 400);
  }

  if ($code === 1265 || $code === 1406 || $code === 1366) {
    json_response([
      "ok" => false,
      "error" => "Dato invalido o demasiado largo para algun campo",
      "code" => $code
    ], 400);
  }

  json_response([
    "ok" => false,
    "error" => "No se pudo actualizar la persona",
    "code" => $code
  ], 500);
} catch (Throwable $e) {
  if (isset($con) && $con instanceof mysqli) {
    try {
      $con->close();
    } catch (Throwable $ignored) {
    }
  }

  error_log('[IXTLA_U_PERSONA][ERROR] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error interno del servidor"
  ], 500);
}


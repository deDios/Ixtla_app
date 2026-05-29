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

  return persona_row($row);
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
  if (isset($con) && $con instanceof mysqli) {
    try {
      $con->close();
    } catch (Throwable $ignored) {
    }
  }

  $code = (int)$e->getCode();
  $msg = $e->getMessage();

  error_log('[IXTLA_I_PERSONA][SQL] ' . $msg);

  if ($code === 1062) {
    $campo = "único";

    if (stripos($msg, "uq_persona_curp_hash") !== false) {
      $campo = "curp_hash";
    } elseif (stripos($msg, "uq_persona_clave_elector_hash") !== false) {
      $campo = "clave_elector_hash";
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
  if (isset($con) && $con instanceof mysqli) {
    try {
      $con->close();
    } catch (Throwable $ignored) {
    }
  }

  error_log('[IXTLA_I_PERSONA][ERROR] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error interno del servidor"
  ], 500);
}

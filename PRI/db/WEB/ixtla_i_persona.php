<?php
// db\WEB\ixtla_i_persona.php

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === 'https://ixtla-app.com' || $origin === 'https://www.ixtla-app.com') {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
}

header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('America/Mexico_City');

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) {
  include $path;
} else {
  http_response_code(500);
  die(json_encode(["ok" => false, "error" => "No se encontró conn_db.php en $path"], JSON_UNESCAPED_UNICODE));
}

$in = json_decode(file_get_contents("php://input"), true) ?? [];

function uuidv4(): string {
  $data = random_bytes(16);
  $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
  $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
  return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function value_or_null(array $arr, string $key) {
  if (!array_key_exists($key, $arr)) return null;
  if ($arr[$key] === '') return null;
  return $arr[$key];
}

function bind_dynamic(mysqli_stmt $st, string $types, array &$params): void {
  $refs = [];
  $refs[] = $types;
  foreach ($params as $k => &$v) {
    $refs[] = &$v;
  }
  call_user_func_array([$st, 'bind_param'], $refs);
}

$nombres = isset($in['nombres']) ? trim((string)$in['nombres']) : '';

if ($nombres === '') {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Falta parámetro obligatorio: nombres"], JSON_UNESCAPED_UNICODE));
}

$con = conectar();
if (!$con) {
  http_response_code(500);
  die(json_encode(["ok" => false, "error" => "No se pudo conectar a la base de datos"], JSON_UNESCAPED_UNICODE));
}

$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

$uuid = uuidv4();

$estatus_id = isset($in['estatus_id']) ? (int)$in['estatus_id'] : 1;
$capturado_por = isset($in['capturado_por']) ? (int)$in['capturado_por'] : null;
$created_by = isset($in['created_by']) ? (int)$in['created_by'] : $capturado_por;

$columns = ["uuid", "nombres", "estatus_id"];
$placeholders = ["?", "?", "?"];
$params = [$uuid, $nombres, $estatus_id];
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
  "clave_elector_hash" => "s",
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
  if (array_key_exists($field, $in)) {
    $columns[] = $field;
    $placeholders[] = "?";
    $params[] = value_or_null($in, $field);
    $types .= $type;
  }
}

$con->begin_transaction();

try {
  $sql = "
    INSERT INTO persona (
      " . implode(", ", $columns) . "
    ) VALUES (
      " . implode(", ", $placeholders) . "
    )
  ";

  $st = $con->prepare($sql);
  bind_dynamic($st, $types, $params);

  if (!$st->execute()) {
    $code = $st->errno;
    $err = $st->error;
    $st->close();
    throw new Exception($err, $code);
  }

  $persona_id = (int)$con->insert_id;
  $st->close();

  $con->commit();

} catch (Exception $e) {
  $con->rollback();

  $code = $e->getCode();
  $msg = $e->getMessage();

  $con->close();

  if ($code == 1062) {
    $campo = "único";

    if (stripos($msg, "uq_persona_curp_hash") !== false) {
      $campo = "curp_hash";
    } elseif (stripos($msg, "uq_persona_clave_elector_hash") !== false) {
      $campo = "clave_elector_hash";
    } elseif (stripos($msg, "uuid") !== false) {
      $campo = "uuid";
    }

    http_response_code(409);
    die(json_encode([
      "ok" => false,
      "error" => "Duplicado en campo $campo",
      "detail" => $msg,
      "code" => $code
    ], JSON_UNESCAPED_UNICODE));
  }

  if ($code == 1452) {
    http_response_code(400);
    die(json_encode([
      "ok" => false,
      "error" => "FK inválida. Revisa estatus_id o seccion_id",
      "detail" => $msg,
      "code" => $code
    ], JSON_UNESCAPED_UNICODE));
  }

  http_response_code(500);
  die(json_encode([
    "ok" => false,
    "error" => "No se pudo crear la persona",
    "detail" => $msg,
    "code" => $code
  ], JSON_UNESCAPED_UNICODE));
}

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
$con->close();

echo json_encode([
  "ok" => true,
  "data" => [
    "persona_id" => (int)$row['persona_id'],
    "uuid" => $row['uuid'],
    "nombres" => $row['nombres'],
    "apellido_paterno" => $row['apellido_paterno'],
    "apellido_materno" => $row['apellido_materno'],
    "fecha_nacimiento" => $row['fecha_nacimiento'],
    "sexo" => $row['sexo'],
    "seccion_id" => isset($row['seccion_id']) ? (int)$row['seccion_id'] : null,
    "telefono" => $row['telefono'],
    "whatsapp" => $row['whatsapp'],
    "email" => $row['email'],
    "estatus_id" => (int)$row['estatus_id'],
    "fecha_captura" => $row['fecha_captura'],
    "created_at" => $row['created_at']
  ]
], JSON_UNESCAPED_UNICODE);
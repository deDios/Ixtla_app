<?php
// db\WEB\ixtla_i_archivo.php

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

function archivo_response(mysqli $con, int $archivo_id): array {
  $sql = "
    SELECT
      a.*,
      u.username AS uploaded_by_username,
      u.nombre AS uploaded_by_nombre,
      u.apellido_paterno AS uploaded_by_apellido_paterno,
      u.apellido_materno AS uploaded_by_apellido_materno
    FROM archivo a
    LEFT JOIN usuario u
      ON u.usuario_id = a.uploaded_by
    WHERE a.archivo_id = ?
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $archivo_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) return [];

  return [
    "archivo_id" => (int)$row['archivo_id'],
    "uuid" => $row['uuid'],
    "entidad_tipo" => $row['entidad_tipo'],
    "entidad_id" => (int)$row['entidad_id'],
    "uso_archivo" => $row['uso_archivo'],

    "nombre_original" => $row['nombre_original'],
    "nombre_storage" => $row['nombre_storage'],
    "url_archivo" => $row['url_archivo'],
    "url_thumbnail" => $row['url_thumbnail'],

    "mime_type" => $row['mime_type'],
    "extension" => $row['extension'],
    "tamano_bytes" => isset($row['tamano_bytes']) ? (int)$row['tamano_bytes'] : null,
    "sha256_hash" => $row['sha256_hash'],

    "version_no" => (int)$row['version_no'],
    "es_actual" => (int)$row['es_actual'],
    "reemplaza_archivo_id" => isset($row['reemplaza_archivo_id']) ? (int)$row['reemplaza_archivo_id'] : null,
    "privado" => (int)$row['privado'],

    "uploaded_by" => isset($row['uploaded_by']) ? (int)$row['uploaded_by'] : null,
    "uploaded_by_usuario" => [
      "username" => $row['uploaded_by_username'],
      "nombre" => $row['uploaded_by_nombre'],
      "apellido_paterno" => $row['uploaded_by_apellido_paterno'],
      "apellido_materno" => $row['uploaded_by_apellido_materno']
    ],

    "uploaded_at" => $row['uploaded_at'],
    "updated_at" => $row['updated_at'],
    "updated_by" => isset($row['updated_by']) ? (int)$row['updated_by'] : null
  ];
}

$entidad_tipo = isset($in['entidad_tipo']) ? trim((string)$in['entidad_tipo']) : '';
$entidad_id = isset($in['entidad_id']) ? (int)$in['entidad_id'] : 0;
$uso_archivo = isset($in['uso_archivo']) ? trim((string)$in['uso_archivo']) : '';
$nombre_storage = isset($in['nombre_storage']) ? trim((string)$in['nombre_storage']) : '';
$url_archivo = isset($in['url_archivo']) ? trim((string)$in['url_archivo']) : '';

$entidadesValidas = ['PERSONA', 'USUARIO', 'PARTICIPACION'];
$usosValidos = [
  'INE_FRENTE',
  'INE_REVERSO',
  'FOTO_PERSONA',
  'FOTO_USUARIO',
  'COMPROBANTE_DOMICILIO',
  'FIRMA',
  'DOCUMENTO_AFILIACION',
  'EVIDENCIA',
  'OTRO'
];

if (!in_array($entidad_tipo, $entidadesValidas, true)) {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "entidad_tipo inválido"], JSON_UNESCAPED_UNICODE));
}

if ($entidad_id <= 0) {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Falta parámetro obligatorio: entidad_id"], JSON_UNESCAPED_UNICODE));
}

if (!in_array($uso_archivo, $usosValidos, true)) {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "uso_archivo inválido"], JSON_UNESCAPED_UNICODE));
}

if ($nombre_storage === '') {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Falta parámetro obligatorio: nombre_storage"], JSON_UNESCAPED_UNICODE));
}

if ($url_archivo === '') {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Falta parámetro obligatorio: url_archivo"], JSON_UNESCAPED_UNICODE));
}

$uuid = isset($in['uuid']) && trim((string)$in['uuid']) !== ''
  ? trim((string)$in['uuid'])
  : uuidv4();

$es_actual = array_key_exists('es_actual', $in) ? (int)$in['es_actual'] : 1;
$privado = array_key_exists('privado', $in) ? (int)$in['privado'] : 1;

$con = conectar();
if (!$con) {
  http_response_code(500);
  die(json_encode(["ok" => false, "error" => "No se pudo conectar a la base de datos"], JSON_UNESCAPED_UNICODE));
}

$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

/*
  Validación ligera de entidad.
  Como archivo.entidad_id es polimórfico, no hay FK directa.
*/
$tablaEntidad = null;
$campoEntidad = null;

if ($entidad_tipo === 'PERSONA') {
  $tablaEntidad = 'persona';
  $campoEntidad = 'persona_id';
} elseif ($entidad_tipo === 'USUARIO') {
  $tablaEntidad = 'usuario';
  $campoEntidad = 'usuario_id';
} elseif ($entidad_tipo === 'PARTICIPACION') {
  $tablaEntidad = 'persona_participacion';
  $campoEntidad = 'participacion_id';
}

$checkSql = "SELECT 1 FROM $tablaEntidad WHERE $campoEntidad = ? AND deleted_at IS NULL LIMIT 1";
$st = $con->prepare($checkSql);
$st->bind_param("i", $entidad_id);
$st->execute();
$exists = $st->get_result()->fetch_row();
$st->close();

if (!$exists) {
  $con->close();
  http_response_code(404);
  die(json_encode(["ok" => false, "error" => "La entidad relacionada no existe"], JSON_UNESCAPED_UNICODE));
}

/*
  Si no viene version_no, se calcula con base en la entidad + uso.
*/
if (isset($in['version_no']) && (int)$in['version_no'] > 0) {
  $version_no = (int)$in['version_no'];
} else {
  $st = $con->prepare("
    SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version
    FROM archivo
    WHERE entidad_tipo = ?
      AND entidad_id = ?
      AND uso_archivo = ?
      AND deleted_at IS NULL
  ");
  $st->bind_param("sis", $entidad_tipo, $entidad_id, $uso_archivo);
  $st->execute();
  $vr = $st->get_result()->fetch_assoc();
  $st->close();

  $version_no = (int)$vr['next_version'];
}

$con->begin_transaction();

try {
  /*
    Si este archivo será actual, desmarcamos otros actuales del mismo uso.
  */
  if ($es_actual === 1) {
    $st = $con->prepare("
      UPDATE archivo
      SET es_actual = 0
      WHERE entidad_tipo = ?
        AND entidad_id = ?
        AND uso_archivo = ?
        AND deleted_at IS NULL
    ");
    $st->bind_param("sis", $entidad_tipo, $entidad_id, $uso_archivo);

    if (!$st->execute()) {
      $code = $st->errno;
      $err = $st->error;
      $st->close();
      throw new Exception($err, $code);
    }

    $st->close();
  }

  $columns = [
    "uuid",
    "entidad_tipo",
    "entidad_id",
    "uso_archivo",
    "nombre_storage",
    "url_archivo",
    "version_no",
    "es_actual",
    "privado"
  ];

  $placeholders = ["?", "?", "?", "?", "?", "?", "?", "?", "?"];

  $params = [
    $uuid,
    $entidad_tipo,
    $entidad_id,
    $uso_archivo,
    $nombre_storage,
    $url_archivo,
    $version_no,
    $es_actual,
    $privado
  ];

  $types = "ssisssiii";

  $map = [
    "nombre_original" => "s",
    "url_thumbnail" => "s",
    "mime_type" => "s",
    "extension" => "s",
    "tamano_bytes" => "i",
    "sha256_hash" => "s",
    "reemplaza_archivo_id" => "i",
    "uploaded_by" => "i"
  ];

  foreach ($map as $field => $type) {
    if (array_key_exists($field, $in)) {
      $columns[] = $field;
      $placeholders[] = "?";
      $params[] = value_or_null($in, $field);
      $types .= $type;
    }
  }

  $sql = "
    INSERT INTO archivo (
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

  $archivo_id = (int)$con->insert_id;
  $st->close();

  $data = archivo_response($con, $archivo_id);

  $con->commit();

} catch (Exception $e) {
  $con->rollback();

  $code = $e->getCode();
  $msg = $e->getMessage();

  $con->close();

  if ($code == 1062) {
    $campo = "único";

    if (stripos($msg, "uuid") !== false) {
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
      "error" => "FK inválida. Revisa reemplaza_archivo_id o uploaded_by",
      "detail" => $msg,
      "code" => $code
    ], JSON_UNESCAPED_UNICODE));
  }

  http_response_code(500);
  die(json_encode([
    "ok" => false,
    "error" => "No se pudo crear el archivo",
    "detail" => $msg,
    "code" => $code
  ], JSON_UNESCAPED_UNICODE));
}

$con->close();

echo json_encode([
  "ok" => true,
  "data" => $data
], JSON_UNESCAPED_UNICODE);
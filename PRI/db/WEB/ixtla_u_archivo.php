<?php
// db\WEB\ixtla_u_archivo.php

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
    "updated_by" => isset($row['updated_by']) ? (int)$row['updated_by'] : null,
    "deleted_at" => $row['deleted_at'] ?? null,
    "deleted_by" => isset($row['deleted_by']) ? (int)$row['deleted_by'] : null
  ];
}

$archivo_id = isset($in['archivo_id']) ? (int)$in['archivo_id'] : (isset($in['id']) ? (int)$in['id'] : 0);

if ($archivo_id <= 0) {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Falta parámetro obligatorio: archivo_id"], JSON_UNESCAPED_UNICODE));
}

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

if (array_key_exists('entidad_tipo', $in)) {
  $entidad_tipo_validar = trim((string)$in['entidad_tipo']);
  if (!in_array($entidad_tipo_validar, $entidadesValidas, true)) {
    http_response_code(400);
    die(json_encode(["ok" => false, "error" => "entidad_tipo inválido"], JSON_UNESCAPED_UNICODE));
  }
}

if (array_key_exists('uso_archivo', $in)) {
  $uso_archivo_validar = trim((string)$in['uso_archivo']);
  if (!in_array($uso_archivo_validar, $usosValidos, true)) {
    http_response_code(400);
    die(json_encode(["ok" => false, "error" => "uso_archivo inválido"], JSON_UNESCAPED_UNICODE));
  }
}

$con = conectar();
if (!$con) {
  http_response_code(500);
  die(json_encode(["ok" => false, "error" => "No se pudo conectar a la base de datos"], JSON_UNESCAPED_UNICODE));
}

$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

$st = $con->prepare("
  SELECT *
  FROM archivo
  WHERE archivo_id = ?
    AND deleted_at IS NULL
  LIMIT 1
");

$st->bind_param("i", $archivo_id);
$st->execute();
$current = $st->get_result()->fetch_assoc();
$st->close();

if (!$current) {
  $con->close();
  http_response_code(404);
  die(json_encode(["ok" => false, "error" => "Archivo no encontrado"], JSON_UNESCAPED_UNICODE));
}

$map = [
  "entidad_tipo" => "s",
  "entidad_id" => "i",
  "uso_archivo" => "s",
  "nombre_original" => "s",
  "nombre_storage" => "s",
  "url_archivo" => "s",
  "url_thumbnail" => "s",
  "mime_type" => "s",
  "extension" => "s",
  "tamano_bytes" => "i",
  "sha256_hash" => "s",
  "version_no" => "i",
  "es_actual" => "i",
  "reemplaza_archivo_id" => "i",
  "privado" => "i",
  "updated_by" => "i",
  "deleted_at" => "s",
  "deleted_by" => "i"
];

$set = [];
$params = [];
$types = "";

foreach ($map as $field => $type) {
  if (array_key_exists($field, $in)) {
    $set[] = "$field = ?";
    $params[] = value_or_null($in, $field);
    $types .= $type;
  }
}

if (!$set) {
  $con->close();
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "No hay campos para actualizar"], JSON_UNESCAPED_UNICODE));
}

$con->begin_transaction();

try {
  /*
    Si se marca este archivo como actual, desmarcamos los demás
    del mismo grupo entidad_tipo + entidad_id + uso_archivo.
  */
  if (array_key_exists('es_actual', $in) && (int)$in['es_actual'] === 1) {
    $entidad_tipo = array_key_exists('entidad_tipo', $in) ? trim((string)$in['entidad_tipo']) : $current['entidad_tipo'];
    $entidad_id = array_key_exists('entidad_id', $in) ? (int)$in['entidad_id'] : (int)$current['entidad_id'];
    $uso_archivo = array_key_exists('uso_archivo', $in) ? trim((string)$in['uso_archivo']) : $current['uso_archivo'];

    $st = $con->prepare("
      UPDATE archivo
      SET es_actual = 0
      WHERE entidad_tipo = ?
        AND entidad_id = ?
        AND uso_archivo = ?
        AND archivo_id <> ?
        AND deleted_at IS NULL
    ");

    $st->bind_param("sisi", $entidad_tipo, $entidad_id, $uso_archivo, $archivo_id);

    if (!$st->execute()) {
      $code = $st->errno;
      $err = $st->error;
      $st->close();
      throw new Exception($err, $code);
    }

    $st->close();
  }

  $params[] = $archivo_id;
  $types .= "i";

  $sql = "
    UPDATE archivo
    SET " . implode(", ", $set) . "
    WHERE archivo_id = ?
  ";

  $st = $con->prepare($sql);
  bind_dynamic($st, $types, $params);

  if (!$st->execute()) {
    $code = $st->errno;
    $err = $st->error;
    $st->close();
    throw new Exception($err, $code);
  }

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
    "error" => "No se pudo actualizar el archivo",
    "detail" => $msg,
    "code" => $code
  ], JSON_UNESCAPED_UNICODE));
}

$con->close();

echo json_encode([
  "ok" => true,
  "data" => $data
], JSON_UNESCAPED_UNICODE);
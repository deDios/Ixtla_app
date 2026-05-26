<?php
// db\WEB\ixtla_u_cat_estatus.php

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

function estatus_response(mysqli $con, int $estatus_id): array {
  $st = $con->prepare("
    SELECT *
    FROM cat_estatus
    WHERE estatus_id = ?
    LIMIT 1
  ");

  $st->bind_param("i", $estatus_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) return [];

  return [
    "estatus_id" => (int)$row['estatus_id'],
    "codigo" => $row['codigo'],
    "nombre" => $row['nombre'],
    "descripcion" => $row['descripcion'],
    "activo" => (int)$row['activo'],
    "created_at" => $row['created_at'],
    "updated_at" => $row['updated_at']
  ];
}

$estatus_id = isset($in['estatus_id']) ? (int)$in['estatus_id'] : (isset($in['id']) ? (int)$in['id'] : 0);

if ($estatus_id <= 0) {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Falta parámetro obligatorio: estatus_id"], JSON_UNESCAPED_UNICODE));
}

$con = conectar();
if (!$con) {
  http_response_code(500);
  die(json_encode(["ok" => false, "error" => "No se pudo conectar a la base de datos"], JSON_UNESCAPED_UNICODE));
}

$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

$st = $con->prepare("
  SELECT estatus_id
  FROM cat_estatus
  WHERE estatus_id = ?
  LIMIT 1
");

$st->bind_param("i", $estatus_id);
$st->execute();
$exists = $st->get_result()->fetch_assoc();
$st->close();

if (!$exists) {
  $con->close();
  http_response_code(404);
  die(json_encode(["ok" => false, "error" => "Estatus no encontrado"], JSON_UNESCAPED_UNICODE));
}

$map = [
  "codigo" => "s",
  "nombre" => "s",
  "descripcion" => "s",
  "activo" => "i"
];

$set = [];
$params = [];
$types = "";

foreach ($map as $field => $type) {
  if (array_key_exists($field, $in)) {
    $set[] = "$field = ?";

    if ($field === 'codigo') {
      $value = strtoupper(trim((string)$in[$field]));
      $params[] = $value;
    } else {
      $params[] = value_or_null($in, $field);
    }

    $types .= $type;
  }
}

if (!$set) {
  $con->close();
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "No hay campos para actualizar"], JSON_UNESCAPED_UNICODE));
}

$params[] = $estatus_id;
$types .= "i";

$con->begin_transaction();

try {
  $sql = "
    UPDATE cat_estatus
    SET " . implode(", ", $set) . "
    WHERE estatus_id = ?
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

  $data = estatus_response($con, $estatus_id);

  $con->commit();

} catch (Exception $e) {
  $con->rollback();

  $code = $e->getCode();
  $msg = $e->getMessage();

  $con->close();

  if ($code == 1062) {
    http_response_code(409);
    die(json_encode([
      "ok" => false,
      "error" => "Duplicado en campo codigo",
      "detail" => $msg,
      "code" => $code
    ], JSON_UNESCAPED_UNICODE));
  }

  http_response_code(500);
  die(json_encode([
    "ok" => false,
    "error" => "No se pudo actualizar el estatus",
    "detail" => $msg,
    "code" => $code
  ], JSON_UNESCAPED_UNICODE));
}

$con->close();

echo json_encode([
  "ok" => true,
  "data" => $data
], JSON_UNESCAPED_UNICODE);
<?php
// db\WEB\ixtla_i_territorio.php

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

function territorio_response(mysqli $con, int $territorio_id): array {
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
    WHERE t.territorio_id = ?
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $territorio_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) return [];

  return [
    "territorio_id" => (int)$row['territorio_id'],
    "territorio_padre_id" => isset($row['territorio_padre_id']) ? (int)$row['territorio_padre_id'] : null,
    "tipo" => $row['tipo'],
    "codigo" => $row['codigo'],
    "nombre" => $row['nombre'],
    "municipio" => $row['municipio'],
    "estado" => $row['estado'],
    "distrito_local" => $row['distrito_local'],
    "distrito_federal" => $row['distrito_federal'],
    "activo" => (int)$row['activo'],
    "padre" => [
      "territorio_id" => isset($row['padre_id']) ? (int)$row['padre_id'] : null,
      "tipo" => $row['padre_tipo'],
      "codigo" => $row['padre_codigo'],
      "nombre" => $row['padre_nombre']
    ],
    "created_at" => $row['created_at'],
    "created_by" => isset($row['created_by']) ? (int)$row['created_by'] : null,
    "updated_at" => $row['updated_at'],
    "updated_by" => isset($row['updated_by']) ? (int)$row['updated_by'] : null
  ];
}

$tipo = isset($in['tipo']) ? strtoupper(trim((string)$in['tipo'])) : '';
$nombre = isset($in['nombre']) ? trim((string)$in['nombre']) : '';

if (!in_array($tipo, ['ZONA', 'SECCION'], true)) {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "tipo inválido. Usa ZONA o SECCION"], JSON_UNESCAPED_UNICODE));
}

if ($nombre === '') {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Falta parámetro obligatorio: nombre"], JSON_UNESCAPED_UNICODE));
}

$territorio_padre_id = array_key_exists('territorio_padre_id', $in) && $in['territorio_padre_id'] !== null
  ? (int)$in['territorio_padre_id']
  : null;

if ($tipo === 'SECCION' && (!$territorio_padre_id || $territorio_padre_id <= 0)) {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Las secciones requieren territorio_padre_id"], JSON_UNESCAPED_UNICODE));
}

if ($tipo === 'ZONA') {
  $territorio_padre_id = null;
}

$con = conectar();
if (!$con) {
  http_response_code(500);
  die(json_encode(["ok" => false, "error" => "No se pudo conectar a la base de datos"], JSON_UNESCAPED_UNICODE));
}

$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

/* Validar zona padre si es sección */
if ($tipo === 'SECCION') {
  $st = $con->prepare("
    SELECT territorio_id
    FROM territorio
    WHERE territorio_id = ?
      AND tipo = 'ZONA'
      AND deleted_at IS NULL
    LIMIT 1
  ");

  $st->bind_param("i", $territorio_padre_id);
  $st->execute();
  $padre = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$padre) {
    $con->close();
    http_response_code(400);
    die(json_encode(["ok" => false, "error" => "territorio_padre_id inválido. La sección debe pertenecer a una ZONA existente"], JSON_UNESCAPED_UNICODE));
  }
}

$columns = ["tipo", "nombre"];
$placeholders = ["?", "?"];
$params = [$tipo, $nombre];
$types = "ss";

if ($territorio_padre_id !== null) {
  $columns[] = "territorio_padre_id";
  $placeholders[] = "?";
  $params[] = $territorio_padre_id;
  $types .= "i";
}

$map = [
  "codigo" => "s",
  "municipio" => "s",
  "estado" => "s",
  "distrito_local" => "s",
  "distrito_federal" => "s",
  "activo" => "i",
  "created_by" => "i"
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
    INSERT INTO territorio (
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

  $territorio_id = (int)$con->insert_id;
  $st->close();

  $data = territorio_response($con, $territorio_id);

  $con->commit();

} catch (Exception $e) {
  $con->rollback();

  $code = $e->getCode();
  $msg = $e->getMessage();

  $con->close();

  if ($code == 1452) {
    http_response_code(400);
    die(json_encode([
      "ok" => false,
      "error" => "FK inválida. Revisa territorio_padre_id",
      "detail" => $msg,
      "code" => $code
    ], JSON_UNESCAPED_UNICODE));
  }

  http_response_code(500);
  die(json_encode([
    "ok" => false,
    "error" => "No se pudo crear el territorio",
    "detail" => $msg,
    "code" => $code
  ], JSON_UNESCAPED_UNICODE));
}

$con->close();

echo json_encode([
  "ok" => true,
  "data" => $data
], JSON_UNESCAPED_UNICODE);
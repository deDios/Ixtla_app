<?php
// db\WEB\ixtla_u_territorio.php

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
    "updated_by" => isset($row['updated_by']) ? (int)$row['updated_by'] : null,
    "deleted_at" => $row['deleted_at'],
    "deleted_by" => isset($row['deleted_by']) ? (int)$row['deleted_by'] : null
  ];
}

$territorio_id = isset($in['territorio_id']) ? (int)$in['territorio_id'] : (isset($in['id']) ? (int)$in['id'] : 0);

if ($territorio_id <= 0) {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Falta parámetro obligatorio: territorio_id"], JSON_UNESCAPED_UNICODE));
}

if (array_key_exists('tipo', $in)) {
  $tipoValidar = strtoupper(trim((string)$in['tipo']));
  if (!in_array($tipoValidar, ['ZONA', 'SECCION'], true)) {
    http_response_code(400);
    die(json_encode(["ok" => false, "error" => "tipo inválido. Usa ZONA o SECCION"], JSON_UNESCAPED_UNICODE));
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
  FROM territorio
  WHERE territorio_id = ?
    AND deleted_at IS NULL
  LIMIT 1
");

$st->bind_param("i", $territorio_id);
$st->execute();
$current = $st->get_result()->fetch_assoc();
$st->close();

if (!$current) {
  $con->close();
  http_response_code(404);
  die(json_encode(["ok" => false, "error" => "Territorio no encontrado"], JSON_UNESCAPED_UNICODE));
}

$nuevoTipo = array_key_exists('tipo', $in)
  ? strtoupper(trim((string)$in['tipo']))
  : $current['tipo'];

$nuevoPadre = array_key_exists('territorio_padre_id', $in)
  ? ($in['territorio_padre_id'] === null ? null : (int)$in['territorio_padre_id'])
  : (isset($current['territorio_padre_id']) ? (int)$current['territorio_padre_id'] : null);

if ($nuevoTipo === 'ZONA') {
  $nuevoPadre = null;
}

if ($nuevoTipo === 'SECCION') {
  if (!$nuevoPadre || $nuevoPadre <= 0) {
    $con->close();
    http_response_code(400);
    die(json_encode(["ok" => false, "error" => "Las secciones requieren territorio_padre_id"], JSON_UNESCAPED_UNICODE));
  }

  if ($nuevoPadre === $territorio_id) {
    $con->close();
    http_response_code(400);
    die(json_encode(["ok" => false, "error" => "Un territorio no puede ser padre de sí mismo"], JSON_UNESCAPED_UNICODE));
  }

  $st = $con->prepare("
    SELECT territorio_id
    FROM territorio
    WHERE territorio_id = ?
      AND tipo = 'ZONA'
      AND deleted_at IS NULL
    LIMIT 1
  ");

  $st->bind_param("i", $nuevoPadre);
  $st->execute();
  $padre = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$padre) {
    $con->close();
    http_response_code(400);
    die(json_encode(["ok" => false, "error" => "territorio_padre_id inválido. La sección debe pertenecer a una ZONA existente"], JSON_UNESCAPED_UNICODE));
  }
}

$map = [
  "territorio_padre_id" => "i",
  "tipo" => "s",
  "codigo" => "s",
  "nombre" => "s",
  "municipio" => "s",
  "estado" => "s",
  "distrito_local" => "s",
  "distrito_federal" => "s",
  "activo" => "i",
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

    if ($field === 'tipo') {
      $params[] = strtoupper(trim((string)$in[$field]));
    } elseif ($field === 'territorio_padre_id') {
      $params[] = $nuevoPadre;
    } else {
      $params[] = value_or_null($in, $field);
    }

    $types .= $type;
  }
}

/* Si cambió a ZONA, forzamos padre NULL aunque no venga territorio_padre_id */
if (array_key_exists('tipo', $in) && $nuevoTipo === 'ZONA' && !array_key_exists('territorio_padre_id', $in)) {
  $set[] = "territorio_padre_id = ?";
  $params[] = null;
  $types .= "i";
}

if (!$set) {
  $con->close();
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "No hay campos para actualizar"], JSON_UNESCAPED_UNICODE));
}

$params[] = $territorio_id;
$types .= "i";

$con->begin_transaction();

try {
  $sql = "
    UPDATE territorio
    SET " . implode(", ", $set) . "
    WHERE territorio_id = ?
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
    "error" => "No se pudo actualizar el territorio",
    "detail" => $msg,
    "code" => $code
  ], JSON_UNESCAPED_UNICODE));
}

$con->close();

echo json_encode([
  "ok" => true,
  "data" => $data
], JSON_UNESCAPED_UNICODE);
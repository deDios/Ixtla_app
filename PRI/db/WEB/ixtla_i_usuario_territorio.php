<?php
// db\WEB\ixtla_i_usuario_territorio.php

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

function usuario_territorio_response(mysqli $con, int $usuario_territorio_id): array {
  $sql = "
    SELECT
      ut.*,

      u.username,
      u.nombre AS usuario_nombre,
      u.apellido_paterno AS usuario_apellido_paterno,
      u.apellido_materno AS usuario_apellido_materno,
      u.email AS usuario_email,

      r.codigo AS rol_codigo,
      r.nombre AS rol_nombre,

      t.territorio_padre_id,
      t.tipo AS territorio_tipo,
      t.codigo AS territorio_codigo,
      t.nombre AS territorio_nombre,
      t.municipio AS territorio_municipio,
      t.estado AS territorio_estado,
      t.distrito_local AS territorio_distrito_local,
      t.distrito_federal AS territorio_distrito_federal,

      z.territorio_id AS zona_id,
      z.codigo AS zona_codigo,
      z.nombre AS zona_nombre

    FROM usuario_territorio ut
    INNER JOIN usuario u
      ON u.usuario_id = ut.usuario_id
    INNER JOIN cat_rol r
      ON r.rol_id = u.rol_id
    INNER JOIN territorio t
      ON t.territorio_id = ut.territorio_id
    LEFT JOIN territorio z
      ON z.territorio_id = t.territorio_padre_id
    WHERE ut.usuario_territorio_id = ?
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $usuario_territorio_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) return [];

  return [
    "usuario_territorio_id" => (int)$row['usuario_territorio_id'],
    "usuario_id" => (int)$row['usuario_id'],
    "territorio_id" => (int)$row['territorio_id'],

    "usuario" => [
      "usuario_id" => (int)$row['usuario_id'],
      "username" => $row['username'],
      "nombre" => $row['usuario_nombre'],
      "apellido_paterno" => $row['usuario_apellido_paterno'],
      "apellido_materno" => $row['usuario_apellido_materno'],
      "email" => $row['usuario_email'],
      "rol_codigo" => $row['rol_codigo'],
      "rol_nombre" => $row['rol_nombre']
    ],

    "territorio" => [
      "territorio_id" => (int)$row['territorio_id'],
      "territorio_padre_id" => isset($row['territorio_padre_id']) ? (int)$row['territorio_padre_id'] : null,
      "tipo" => $row['territorio_tipo'],
      "codigo" => $row['territorio_codigo'],
      "nombre" => $row['territorio_nombre'],
      "municipio" => $row['territorio_municipio'],
      "estado" => $row['territorio_estado'],
      "distrito_local" => $row['territorio_distrito_local'],
      "distrito_federal" => $row['territorio_distrito_federal'],
      "zona" => [
        "territorio_id" => isset($row['zona_id']) ? (int)$row['zona_id'] : null,
        "codigo" => $row['zona_codigo'],
        "nombre" => $row['zona_nombre']
      ]
    ],

    "fecha_inicio" => $row['fecha_inicio'],
    "fecha_fin" => $row['fecha_fin'],
    "activo" => (int)$row['activo'],
    "created_at" => $row['created_at'],
    "created_by" => isset($row['created_by']) ? (int)$row['created_by'] : null,
    "updated_at" => $row['updated_at'],
    "updated_by" => isset($row['updated_by']) ? (int)$row['updated_by'] : null
  ];
}

$usuario_id = isset($in['usuario_id']) ? (int)$in['usuario_id'] : 0;
$territorio_id = isset($in['territorio_id']) ? (int)$in['territorio_id'] : 0;

if ($usuario_id <= 0) {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Falta parámetro obligatorio: usuario_id"], JSON_UNESCAPED_UNICODE));
}

if ($territorio_id <= 0) {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Falta parámetro obligatorio: territorio_id"], JSON_UNESCAPED_UNICODE));
}

$fecha_inicio = isset($in['fecha_inicio']) && trim((string)$in['fecha_inicio']) !== ''
  ? trim((string)$in['fecha_inicio'])
  : date('Y-m-d');

$fecha_fin = value_or_null($in, 'fecha_fin');
$activo = array_key_exists('activo', $in) ? (int)$in['activo'] : 1;
$created_by = array_key_exists('created_by', $in) && $in['created_by'] !== null ? (int)$in['created_by'] : null;

$con = conectar();
if (!$con) {
  http_response_code(500);
  die(json_encode(["ok" => false, "error" => "No se pudo conectar a la base de datos"], JSON_UNESCAPED_UNICODE));
}

$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

/* Validar usuario */
$st = $con->prepare("
  SELECT usuario_id
  FROM usuario
  WHERE usuario_id = ?
    AND deleted_at IS NULL
  LIMIT 1
");
$st->bind_param("i", $usuario_id);
$st->execute();
$usuario = $st->get_result()->fetch_assoc();
$st->close();

if (!$usuario) {
  $con->close();
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "usuario_id inválido"], JSON_UNESCAPED_UNICODE));
}

/* Validar territorio */
$st = $con->prepare("
  SELECT territorio_id
  FROM territorio
  WHERE territorio_id = ?
    AND deleted_at IS NULL
  LIMIT 1
");
$st->bind_param("i", $territorio_id);
$st->execute();
$territorio = $st->get_result()->fetch_assoc();
$st->close();

if (!$territorio) {
  $con->close();
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "territorio_id inválido"], JSON_UNESCAPED_UNICODE));
}

$con->begin_transaction();

try {
  $sql = "
    INSERT INTO usuario_territorio (
      usuario_id,
      territorio_id,
      fecha_inicio,
      fecha_fin,
      activo,
      created_by
    )
    VALUES (?, ?, ?, ?, ?, ?)
  ";

  $st = $con->prepare($sql);
  $st->bind_param(
    "iissii",
    $usuario_id,
    $territorio_id,
    $fecha_inicio,
    $fecha_fin,
    $activo,
    $created_by
  );

  if (!$st->execute()) {
    $code = $st->errno;
    $err = $st->error;
    $st->close();
    throw new Exception($err, $code);
  }

  $usuario_territorio_id = (int)$con->insert_id;
  $st->close();

  $data = usuario_territorio_response($con, $usuario_territorio_id);

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
      "error" => "Ese usuario ya tiene asignado ese territorio",
      "detail" => $msg,
      "code" => $code
    ], JSON_UNESCAPED_UNICODE));
  }

  if ($code == 1452) {
    http_response_code(400);
    die(json_encode([
      "ok" => false,
      "error" => "FK inválida. Revisa usuario_id o territorio_id",
      "detail" => $msg,
      "code" => $code
    ], JSON_UNESCAPED_UNICODE));
  }

  http_response_code(500);
  die(json_encode([
    "ok" => false,
    "error" => "No se pudo crear la relación usuario-territorio",
    "detail" => $msg,
    "code" => $code
  ], JSON_UNESCAPED_UNICODE));
}

$con->close();

echo json_encode([
  "ok" => true,
  "data" => $data
], JSON_UNESCAPED_UNICODE);
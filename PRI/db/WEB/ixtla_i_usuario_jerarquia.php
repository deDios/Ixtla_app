<?php
// db\WEB\ixtla_i_usuario_jerarquia.php

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

function jerarquia_response(mysqli $con, int $usuario_jerarquia_id): array {
  $sql = "
    SELECT
      uj.*,

      up.usuario_id AS padre_usuario_id,
      up.username AS padre_username,
      up.nombre AS padre_nombre,
      up.apellido_paterno AS padre_apellido_paterno,
      up.apellido_materno AS padre_apellido_materno,
      up.email AS padre_email,
      rp.codigo AS padre_rol_codigo,
      rp.nombre AS padre_rol_nombre,

      uh.usuario_id AS hijo_usuario_id,
      uh.username AS hijo_username,
      uh.nombre AS hijo_nombre,
      uh.apellido_paterno AS hijo_apellido_paterno,
      uh.apellido_materno AS hijo_apellido_materno,
      uh.email AS hijo_email,
      rh.codigo AS hijo_rol_codigo,
      rh.nombre AS hijo_rol_nombre

    FROM usuario_jerarquia uj
    INNER JOIN usuario up
      ON up.usuario_id = uj.usuario_padre_id
    INNER JOIN usuario uh
      ON uh.usuario_id = uj.usuario_hijo_id
    INNER JOIN cat_rol rp
      ON rp.rol_id = up.rol_id
    INNER JOIN cat_rol rh
      ON rh.rol_id = uh.rol_id
    WHERE uj.usuario_jerarquia_id = ?
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $usuario_jerarquia_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) return [];

  return [
    "usuario_jerarquia_id" => (int)$row['usuario_jerarquia_id'],
    "usuario_padre_id" => (int)$row['usuario_padre_id'],
    "usuario_hijo_id" => (int)$row['usuario_hijo_id'],
    "padre" => [
      "usuario_id" => (int)$row['padre_usuario_id'],
      "username" => $row['padre_username'],
      "nombre" => $row['padre_nombre'],
      "apellido_paterno" => $row['padre_apellido_paterno'],
      "apellido_materno" => $row['padre_apellido_materno'],
      "email" => $row['padre_email'],
      "rol_codigo" => $row['padre_rol_codigo'],
      "rol_nombre" => $row['padre_rol_nombre']
    ],
    "hijo" => [
      "usuario_id" => (int)$row['hijo_usuario_id'],
      "username" => $row['hijo_username'],
      "nombre" => $row['hijo_nombre'],
      "apellido_paterno" => $row['hijo_apellido_paterno'],
      "apellido_materno" => $row['hijo_apellido_materno'],
      "email" => $row['hijo_email'],
      "rol_codigo" => $row['hijo_rol_codigo'],
      "rol_nombre" => $row['hijo_rol_nombre']
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

$usuario_padre_id = isset($in['usuario_padre_id']) ? (int)$in['usuario_padre_id'] : 0;
$usuario_hijo_id = isset($in['usuario_hijo_id']) ? (int)$in['usuario_hijo_id'] : 0;

if ($usuario_padre_id <= 0) {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Falta parámetro obligatorio: usuario_padre_id"], JSON_UNESCAPED_UNICODE));
}

if ($usuario_hijo_id <= 0) {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Falta parámetro obligatorio: usuario_hijo_id"], JSON_UNESCAPED_UNICODE));
}

if ($usuario_padre_id === $usuario_hijo_id) {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Un usuario no puede reportarse a sí mismo"], JSON_UNESCAPED_UNICODE));
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

/* Validar usuario padre */
$st = $con->prepare("
  SELECT usuario_id
  FROM usuario
  WHERE usuario_id = ?
    AND deleted_at IS NULL
  LIMIT 1
");
$st->bind_param("i", $usuario_padre_id);
$st->execute();
$padre = $st->get_result()->fetch_assoc();
$st->close();

if (!$padre) {
  $con->close();
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "usuario_padre_id inválido"], JSON_UNESCAPED_UNICODE));
}

/* Validar usuario hijo */
$st = $con->prepare("
  SELECT usuario_id
  FROM usuario
  WHERE usuario_id = ?
    AND deleted_at IS NULL
  LIMIT 1
");
$st->bind_param("i", $usuario_hijo_id);
$st->execute();
$hijo = $st->get_result()->fetch_assoc();
$st->close();

if (!$hijo) {
  $con->close();
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "usuario_hijo_id inválido"], JSON_UNESCAPED_UNICODE));
}

$con->begin_transaction();

try {
  $sql = "
    INSERT INTO usuario_jerarquia (
      usuario_padre_id,
      usuario_hijo_id,
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
    $usuario_padre_id,
    $usuario_hijo_id,
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

  $usuario_jerarquia_id = (int)$con->insert_id;
  $st->close();

  $data = jerarquia_response($con, $usuario_jerarquia_id);

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
      "error" => "Ya existe esa relación jerárquica",
      "detail" => $msg,
      "code" => $code
    ], JSON_UNESCAPED_UNICODE));
  }

  if ($code == 1452) {
    http_response_code(400);
    die(json_encode([
      "ok" => false,
      "error" => "FK inválida. Revisa usuario_padre_id o usuario_hijo_id",
      "detail" => $msg,
      "code" => $code
    ], JSON_UNESCAPED_UNICODE));
  }

  if ($code == 3819 || stripos($msg, 'chk_jerarquia_no_mismo_usuario') !== false) {
    http_response_code(400);
    die(json_encode([
      "ok" => false,
      "error" => "Un usuario no puede reportarse a sí mismo",
      "detail" => $msg,
      "code" => $code
    ], JSON_UNESCAPED_UNICODE));
  }

  http_response_code(500);
  die(json_encode([
    "ok" => false,
    "error" => "No se pudo crear la jerarquía",
    "detail" => $msg,
    "code" => $code
  ], JSON_UNESCAPED_UNICODE));
}

$con->close();

echo json_encode([
  "ok" => true,
  "data" => $data
], JSON_UNESCAPED_UNICODE);
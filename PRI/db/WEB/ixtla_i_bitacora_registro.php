<?php
// db\WEB\ixtla_i_bitacora_registro.php

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

function client_ip(): string {
  $xff = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';

  if ($xff !== '') {
    $parts = explode(',', $xff);
    return trim($parts[0]);
  }

  return $_SERVER['REMOTE_ADDR'] ?? '';
}

function user_agent(): string {
  return substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 1000);
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

function bitacora_response(mysqli $con, int $bitacora_id): array {
  $sql = "
    SELECT
      b.*,
      u.username AS realizado_por_username,
      u.nombre AS realizado_por_nombre,
      u.apellido_paterno AS realizado_por_apellido_paterno,
      u.apellido_materno AS realizado_por_apellido_materno
    FROM bitacora_registro b
    LEFT JOIN usuario u
      ON u.usuario_id = b.realizado_por
    WHERE b.bitacora_id = ?
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $bitacora_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) return [];

  $anteriores = null;
  $nuevos = null;

  if ($row['valores_anteriores'] !== null && $row['valores_anteriores'] !== '') {
    $tmp = json_decode($row['valores_anteriores'], true);
    $anteriores = json_last_error() === JSON_ERROR_NONE ? $tmp : $row['valores_anteriores'];
  }

  if ($row['valores_nuevos'] !== null && $row['valores_nuevos'] !== '') {
    $tmp = json_decode($row['valores_nuevos'], true);
    $nuevos = json_last_error() === JSON_ERROR_NONE ? $tmp : $row['valores_nuevos'];
  }

  return [
    "bitacora_id" => (int)$row['bitacora_id'],
    "tabla_nombre" => $row['tabla_nombre'],
    "registro_id" => (int)$row['registro_id'],
    "accion" => $row['accion'],
    "descripcion" => $row['descripcion'],
    "valores_anteriores" => $anteriores,
    "valores_nuevos" => $nuevos,
    "realizado_por" => isset($row['realizado_por']) ? (int)$row['realizado_por'] : null,
    "realizado_por_usuario" => [
      "username" => $row['realizado_por_username'],
      "nombre" => $row['realizado_por_nombre'],
      "apellido_paterno" => $row['realizado_por_apellido_paterno'],
      "apellido_materno" => $row['realizado_por_apellido_materno']
    ],
    "realizado_at" => $row['realizado_at'],
    "ip_origen" => $row['ip_origen'],
    "user_agent" => $row['user_agent']
  ];
}

$tabla_nombre = isset($in['tabla_nombre']) ? trim((string)$in['tabla_nombre']) : '';
$registro_id = isset($in['registro_id']) ? (int)$in['registro_id'] : 0;
$accion = isset($in['accion']) ? trim((string)$in['accion']) : '';

$accionesValidas = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'UPLOAD_FILE',
  'REPLACE_FILE',
  'CHANGE_STATUS',
  'VALIDATE',
  'REJECT'
];

if ($tabla_nombre === '') {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Falta parámetro obligatorio: tabla_nombre"], JSON_UNESCAPED_UNICODE));
}

if ($registro_id <= 0) {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Falta parámetro obligatorio: registro_id"], JSON_UNESCAPED_UNICODE));
}

if (!in_array($accion, $accionesValidas, true)) {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Acción inválida"], JSON_UNESCAPED_UNICODE));
}

$descripcion = value_or_null($in, 'descripcion');

$valores_anteriores = null;
if (array_key_exists('valores_anteriores', $in) && $in['valores_anteriores'] !== null) {
  $valores_anteriores = json_encode($in['valores_anteriores'], JSON_UNESCAPED_UNICODE);
}

$valores_nuevos = null;
if (array_key_exists('valores_nuevos', $in) && $in['valores_nuevos'] !== null) {
  $valores_nuevos = json_encode($in['valores_nuevos'], JSON_UNESCAPED_UNICODE);
}

$realizado_por = array_key_exists('realizado_por', $in) && $in['realizado_por'] !== null
  ? (int)$in['realizado_por']
  : null;

$ip_origen = value_or_null($in, 'ip_origen');
if ($ip_origen === null) {
  $ip_origen = client_ip();
}

$ua = value_or_null($in, 'user_agent');
if ($ua === null) {
  $ua = user_agent();
}

$con = conectar();
if (!$con) {
  http_response_code(500);
  die(json_encode(["ok" => false, "error" => "No se pudo conectar a la base de datos"], JSON_UNESCAPED_UNICODE));
}

$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

$con->begin_transaction();

try {
  $sql = "
    INSERT INTO bitacora_registro (
      tabla_nombre,
      registro_id,
      accion,
      descripcion,
      valores_anteriores,
      valores_nuevos,
      realizado_por,
      ip_origen,
      user_agent
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ";

  $st = $con->prepare($sql);

  $params = [
    $tabla_nombre,
    $registro_id,
    $accion,
    $descripcion,
    $valores_anteriores,
    $valores_nuevos,
    $realizado_por,
    $ip_origen,
    $ua
  ];

  $types = "sissssiss";

  bind_dynamic($st, $types, $params);

  if (!$st->execute()) {
    $code = $st->errno;
    $err = $st->error;
    $st->close();
    throw new Exception($err, $code);
  }

  $bitacora_id = (int)$con->insert_id;
  $st->close();

  $data = bitacora_response($con, $bitacora_id);

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
      "error" => "FK inválida. Revisa realizado_por",
      "detail" => $msg,
      "code" => $code
    ], JSON_UNESCAPED_UNICODE));
  }

  http_response_code(500);
  die(json_encode([
    "ok" => false,
    "error" => "No se pudo registrar la bitácora",
    "detail" => $msg,
    "code" => $code
  ], JSON_UNESCAPED_UNICODE));
}

$con->close();

echo json_encode([
  "ok" => true,
  "data" => $data
], JSON_UNESCAPED_UNICODE);
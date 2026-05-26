<?php
// db\WEB\ixtla_c_bitacora_registro.php

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

$bitacora_id  = isset($in['bitacora_id']) ? (int)$in['bitacora_id'] : (isset($in['id']) ? (int)$in['id'] : null);
$tabla_nombre = isset($in['tabla_nombre']) ? trim((string)$in['tabla_nombre']) : '';
$registro_id  = isset($in['registro_id']) ? (int)$in['registro_id'] : null;
$accion       = isset($in['accion']) ? trim((string)$in['accion']) : '';
$realizado_por = isset($in['realizado_por']) ? (int)$in['realizado_por'] : null;

$fecha_inicio = isset($in['fecha_inicio']) ? trim((string)$in['fecha_inicio']) : '';
$fecha_fin    = isset($in['fecha_fin']) ? trim((string)$in['fecha_fin']) : '';

$q = isset($in['q']) ? trim((string)$in['q']) : '';

$page = isset($in['page']) ? max(1, (int)$in['page']) : 1;
$pageSize = isset($in['page_size']) ? max(1, min(500, (int)$in['page_size'])) : 50;
$offset = ($page - 1) * $pageSize;

$con = conectar();
if (!$con) {
  http_response_code(500);
  die(json_encode(["ok" => false, "error" => "No se pudo conectar a la base de datos"], JSON_UNESCAPED_UNICODE));
}

$con->set_charset('utf8mb4');

function bind_dynamic(mysqli_stmt $st, string $types, array &$params): void {
  $refs = [];
  $refs[] = $types;

  foreach ($params as $k => &$v) {
    $refs[] = &$v;
  }

  call_user_func_array([$st, 'bind_param'], $refs);
}

function decode_json_field($value) {
  if ($value === null || $value === '') {
    return null;
  }

  $decoded = json_decode($value, true);
  return json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
}

function bitacora_row(array $row): array {
  return [
    "bitacora_id" => (int)$row['bitacora_id'],
    "tabla_nombre" => $row['tabla_nombre'],
    "registro_id" => (int)$row['registro_id'],
    "accion" => $row['accion'],
    "descripcion" => $row['descripcion'],

    "valores_anteriores" => decode_json_field($row['valores_anteriores']),
    "valores_nuevos" => decode_json_field($row['valores_nuevos']),

    "realizado_por" => isset($row['realizado_por']) ? (int)$row['realizado_por'] : null,
    "realizado_por_usuario" => [
      "username" => $row['realizado_por_username'] ?? null,
      "nombre" => $row['realizado_por_nombre'] ?? null,
      "apellido_paterno" => $row['realizado_por_apellido_paterno'] ?? null,
      "apellido_materno" => $row['realizado_por_apellido_materno'] ?? null
    ],

    "realizado_at" => $row['realizado_at'],
    "ip_origen" => $row['ip_origen'],
    "user_agent" => $row['user_agent']
  ];
}

$baseSelect = "
  SELECT
    b.*,
    u.username AS realizado_por_username,
    u.nombre AS realizado_por_nombre,
    u.apellido_paterno AS realizado_por_apellido_paterno,
    u.apellido_materno AS realizado_por_apellido_materno
  FROM bitacora_registro b
  LEFT JOIN usuario u
    ON u.usuario_id = b.realizado_por
";

if ($bitacora_id && $bitacora_id > 0) {
  $sql = $baseSelect . "
    WHERE b.bitacora_id = ?
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $bitacora_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();
  $con->close();

  if (!$row) {
    http_response_code(404);
    die(json_encode(["ok" => false, "error" => "Registro de bitácora no encontrado"], JSON_UNESCAPED_UNICODE));
  }

  echo json_encode(["ok" => true, "data" => bitacora_row($row)], JSON_UNESCAPED_UNICODE);
  exit;
}

$where = ["1 = 1"];
$types = "";
$params = [];

if ($tabla_nombre !== '') {
  $where[] = "b.tabla_nombre = ?";
  $types .= "s";
  $params[] = $tabla_nombre;
}

if ($registro_id !== null && $registro_id > 0) {
  $where[] = "b.registro_id = ?";
  $types .= "i";
  $params[] = $registro_id;
}

if ($accion !== '') {
  $where[] = "b.accion = ?";
  $types .= "s";
  $params[] = $accion;
}

if ($realizado_por !== null && $realizado_por > 0) {
  $where[] = "b.realizado_por = ?";
  $types .= "i";
  $params[] = $realizado_por;
}

if ($fecha_inicio !== '') {
  $where[] = "b.realizado_at >= ?";
  $types .= "s";
  $params[] = $fecha_inicio . (strlen($fecha_inicio) === 10 ? " 00:00:00" : "");
}

if ($fecha_fin !== '') {
  $where[] = "b.realizado_at <= ?";
  $types .= "s";
  $params[] = $fecha_fin . (strlen($fecha_fin) === 10 ? " 23:59:59" : "");
}

if ($q !== '') {
  $like = "%$q%";
  $where[] = "(
    b.tabla_nombre LIKE ?
    OR b.descripcion LIKE ?
    OR b.ip_origen LIKE ?
    OR b.user_agent LIKE ?
    OR u.username LIKE ?
    OR u.nombre LIKE ?
  )";

  for ($i = 0; $i < 6; $i++) {
    $types .= "s";
    $params[] = $like;
  }
}

$sql = "
  $baseSelect
  WHERE " . implode(" AND ", $where) . "
  ORDER BY b.realizado_at DESC, b.bitacora_id DESC
  LIMIT ? OFFSET ?
";

$types .= "ii";
$params[] = $pageSize;
$params[] = $offset;

$st = $con->prepare($sql);
bind_dynamic($st, $types, $params);
$st->execute();
$rs = $st->get_result();

$data = [];
while ($row = $rs->fetch_assoc()) {
  $data[] = bitacora_row($row);
}

$st->close();

$countSql = "
  SELECT COUNT(*) AS total
  FROM bitacora_registro b
  LEFT JOIN usuario u
    ON u.usuario_id = b.realizado_por
  WHERE " . implode(" AND ", $where) . "
";

$countParams = $params;
array_pop($countParams);
array_pop($countParams);

$countTypes = substr($types, 0, -2);

$st = $con->prepare($countSql);

if ($countTypes !== '') {
  bind_dynamic($st, $countTypes, $countParams);
}

$st->execute();
$totalRow = $st->get_result()->fetch_assoc();
$total = (int)$totalRow['total'];
$st->close();

$con->close();

echo json_encode([
  "ok" => true,
  "meta" => [
    "page" => $page,
    "page_size" => $pageSize,
    "total" => $total
  ],
  "data" => $data
], JSON_UNESCAPED_UNICODE);
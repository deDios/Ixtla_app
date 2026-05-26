<?php
// db\WEB\ixtla_c_cat_estatus.php

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

$estatus_id = isset($in['estatus_id']) ? (int)$in['estatus_id'] : (isset($in['id']) ? (int)$in['id'] : null);
$codigo = isset($in['codigo']) ? strtoupper(trim((string)$in['codigo'])) : '';
$activo = array_key_exists('activo', $in) ? (int)$in['activo'] : null;
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

function estatus_row(array $row): array {
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

/* === Detalle por ID === */
if ($estatus_id && $estatus_id > 0) {
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
  $con->close();

  if (!$row) {
    http_response_code(404);
    die(json_encode(["ok" => false, "error" => "Estatus no encontrado"], JSON_UNESCAPED_UNICODE));
  }

  echo json_encode(["ok" => true, "data" => estatus_row($row)], JSON_UNESCAPED_UNICODE);
  exit;
}

/* === Detalle por código === */
if ($codigo !== '') {
  $st = $con->prepare("
    SELECT *
    FROM cat_estatus
    WHERE codigo COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
    LIMIT 1
  ");

  $st->bind_param("s", $codigo);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();
  $con->close();

  if (!$row) {
    http_response_code(404);
    die(json_encode(["ok" => false, "error" => "Estatus no encontrado"], JSON_UNESCAPED_UNICODE));
  }

  echo json_encode(["ok" => true, "data" => estatus_row($row)], JSON_UNESCAPED_UNICODE);
  exit;
}

/* === Listado === */
$where = ["1 = 1"];
$types = "";
$params = [];

if ($activo !== null) {
  $where[] = "activo = ?";
  $types .= "i";
  $params[] = $activo;
}

if ($q !== '') {
  $like = "%$q%";
  $where[] = "(
    codigo LIKE ?
    OR nombre LIKE ?
    OR descripcion LIKE ?
  )";

  for ($i = 0; $i < 3; $i++) {
    $types .= "s";
    $params[] = $like;
  }
}

$sql = "
  SELECT *
  FROM cat_estatus
  WHERE " . implode(" AND ", $where) . "
  ORDER BY estatus_id ASC
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
  $data[] = estatus_row($row);
}

$st->close();

/* Total */
$countSql = "
  SELECT COUNT(*) AS total
  FROM cat_estatus
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
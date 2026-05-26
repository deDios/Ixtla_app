<?php
// db\WEB\ixtla_c_territorio.php

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

$territorio_id = isset($in['territorio_id']) ? (int)$in['territorio_id'] : (isset($in['id']) ? (int)$in['id'] : null);
$territorio_padre_id = isset($in['territorio_padre_id']) ? (int)$in['territorio_padre_id'] : null;
$tipo = isset($in['tipo']) ? strtoupper(trim((string)$in['tipo'])) : '';
$codigo = isset($in['codigo']) ? trim((string)$in['codigo']) : '';
$activo = array_key_exists('activo', $in) ? (int)$in['activo'] : null;
$q = isset($in['q']) ? trim((string)$in['q']) : '';
$include_secciones = !empty($in['include_secciones']);

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

function territorio_row(array $row): array {
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
      "tipo" => $row['padre_tipo'] ?? null,
      "codigo" => $row['padre_codigo'] ?? null,
      "nombre" => $row['padre_nombre'] ?? null
    ],

    "created_at" => $row['created_at'],
    "created_by" => isset($row['created_by']) ? (int)$row['created_by'] : null,
    "updated_at" => $row['updated_at'],
    "updated_by" => isset($row['updated_by']) ? (int)$row['updated_by'] : null
  ];
}

function get_secciones_zona(mysqli $con, int $zona_id): array {
  $st = $con->prepare("
    SELECT
      t.*,
      p.territorio_id AS padre_id,
      p.tipo AS padre_tipo,
      p.codigo AS padre_codigo,
      p.nombre AS padre_nombre
    FROM territorio t
    LEFT JOIN territorio p
      ON p.territorio_id = t.territorio_padre_id
    WHERE t.territorio_padre_id = ?
      AND t.tipo = 'SECCION'
      AND t.deleted_at IS NULL
    ORDER BY t.codigo ASC, t.nombre ASC
  ");

  $st->bind_param("i", $zona_id);
  $st->execute();
  $rs = $st->get_result();

  $items = [];
  while ($row = $rs->fetch_assoc()) {
    $items[] = territorio_row($row);
  }

  $st->close();
  return $items;
}

$baseSelect = "
  SELECT
    t.*,
    p.territorio_id AS padre_id,
    p.tipo AS padre_tipo,
    p.codigo AS padre_codigo,
    p.nombre AS padre_nombre
  FROM territorio t
  LEFT JOIN territorio p
    ON p.territorio_id = t.territorio_padre_id
";

/* === Detalle por ID === */
if ($territorio_id && $territorio_id > 0) {
  $sql = $baseSelect . "
    WHERE t.territorio_id = ?
      AND t.deleted_at IS NULL
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $territorio_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    $con->close();
    http_response_code(404);
    die(json_encode(["ok" => false, "error" => "Territorio no encontrado"], JSON_UNESCAPED_UNICODE));
  }

  $data = territorio_row($row);

  if ($include_secciones && $data['tipo'] === 'ZONA') {
    $data['secciones'] = get_secciones_zona($con, (int)$data['territorio_id']);
  }

  $con->close();

  echo json_encode(["ok" => true, "data" => $data], JSON_UNESCAPED_UNICODE);
  exit;
}

/* === Detalle por código === */
if ($codigo !== '') {
  $sql = $baseSelect . "
    WHERE t.codigo COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
      AND t.deleted_at IS NULL
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("s", $codigo);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    $con->close();
    http_response_code(404);
    die(json_encode(["ok" => false, "error" => "Territorio no encontrado"], JSON_UNESCAPED_UNICODE));
  }

  $data = territorio_row($row);

  if ($include_secciones && $data['tipo'] === 'ZONA') {
    $data['secciones'] = get_secciones_zona($con, (int)$data['territorio_id']);
  }

  $con->close();

  echo json_encode(["ok" => true, "data" => $data], JSON_UNESCAPED_UNICODE);
  exit;
}

/* === Listado === */
$where = ["t.deleted_at IS NULL"];
$types = "";
$params = [];

if ($tipo !== '') {
  $where[] = "t.tipo = ?";
  $types .= "s";
  $params[] = $tipo;
}

if ($territorio_padre_id !== null && $territorio_padre_id > 0) {
  $where[] = "t.territorio_padre_id = ?";
  $types .= "i";
  $params[] = $territorio_padre_id;
}

if ($activo !== null) {
  $where[] = "t.activo = ?";
  $types .= "i";
  $params[] = $activo;
}

if ($q !== '') {
  $like = "%$q%";
  $where[] = "(
    t.codigo LIKE ?
    OR t.nombre LIKE ?
    OR t.municipio LIKE ?
    OR t.estado LIKE ?
    OR t.distrito_local LIKE ?
    OR t.distrito_federal LIKE ?
  )";

  for ($i = 0; $i < 6; $i++) {
    $types .= "s";
    $params[] = $like;
  }
}

$sql = "
  $baseSelect
  WHERE " . implode(" AND ", $where) . "
  ORDER BY
    FIELD(t.tipo, 'ZONA', 'SECCION'),
    t.codigo ASC,
    t.nombre ASC
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
  $item = territorio_row($row);

  if ($include_secciones && $item['tipo'] === 'ZONA') {
    $item['secciones'] = get_secciones_zona($con, (int)$item['territorio_id']);
  }

  $data[] = $item;
}

$st->close();

/* Total */
$countSql = "
  SELECT COUNT(*) AS total
  FROM territorio t
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
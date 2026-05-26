<?php
// db\WEB\ixtla_c_usuario_jerarquia.php

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

$usuario_jerarquia_id = isset($in['usuario_jerarquia_id']) ? (int)$in['usuario_jerarquia_id'] : (isset($in['id']) ? (int)$in['id'] : null);
$usuario_padre_id = isset($in['usuario_padre_id']) ? (int)$in['usuario_padre_id'] : null;
$usuario_hijo_id = isset($in['usuario_hijo_id']) ? (int)$in['usuario_hijo_id'] : null;
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

function jerarquia_row(array $row): array {
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

$baseSelect = "
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
";

/* Detalle por ID */
if ($usuario_jerarquia_id && $usuario_jerarquia_id > 0) {
  $sql = $baseSelect . "
    WHERE uj.usuario_jerarquia_id = ?
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $usuario_jerarquia_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();
  $con->close();

  if (!$row) {
    http_response_code(404);
    die(json_encode(["ok" => false, "error" => "Jerarquía no encontrada"], JSON_UNESCAPED_UNICODE));
  }

  echo json_encode(["ok" => true, "data" => jerarquia_row($row)], JSON_UNESCAPED_UNICODE);
  exit;
}

/* Listado */
$where = ["up.deleted_at IS NULL", "uh.deleted_at IS NULL"];
$types = "";
$params = [];

if ($usuario_padre_id !== null && $usuario_padre_id > 0) {
  $where[] = "uj.usuario_padre_id = ?";
  $types .= "i";
  $params[] = $usuario_padre_id;
}

if ($usuario_hijo_id !== null && $usuario_hijo_id > 0) {
  $where[] = "uj.usuario_hijo_id = ?";
  $types .= "i";
  $params[] = $usuario_hijo_id;
}

if ($activo !== null) {
  $where[] = "uj.activo = ?";
  $types .= "i";
  $params[] = $activo;
}

if ($q !== '') {
  $like = "%$q%";
  $where[] = "(
    up.username LIKE ?
    OR up.nombre LIKE ?
    OR up.apellido_paterno LIKE ?
    OR up.apellido_materno LIKE ?
    OR up.email LIKE ?
    OR uh.username LIKE ?
    OR uh.nombre LIKE ?
    OR uh.apellido_paterno LIKE ?
    OR uh.apellido_materno LIKE ?
    OR uh.email LIKE ?
  )";

  for ($i = 0; $i < 10; $i++) {
    $types .= "s";
    $params[] = $like;
  }
}

$sql = "
  $baseSelect
  WHERE " . implode(" AND ", $where) . "
  ORDER BY uj.created_at DESC, uj.usuario_jerarquia_id DESC
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
  $data[] = jerarquia_row($row);
}

$st->close();

/* Total */
$countSql = "
  SELECT COUNT(*) AS total
  FROM usuario_jerarquia uj
  INNER JOIN usuario up
    ON up.usuario_id = uj.usuario_padre_id
  INNER JOIN usuario uh
    ON uh.usuario_id = uj.usuario_hijo_id
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
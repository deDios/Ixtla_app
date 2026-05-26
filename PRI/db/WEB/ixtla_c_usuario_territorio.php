<?php
// db\WEB\ixtla_c_usuario_territorio.php

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

$usuario_territorio_id = isset($in['usuario_territorio_id']) ? (int)$in['usuario_territorio_id'] : (isset($in['id']) ? (int)$in['id'] : null);
$usuario_id = isset($in['usuario_id']) ? (int)$in['usuario_id'] : null;
$territorio_id = isset($in['territorio_id']) ? (int)$in['territorio_id'] : null;
$tipo_territorio = isset($in['tipo_territorio']) ? strtoupper(trim((string)$in['tipo_territorio'])) : '';
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

function usuario_territorio_row(array $row): array {
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

$baseSelect = "
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
";

/* Detalle por ID */
if ($usuario_territorio_id && $usuario_territorio_id > 0) {
  $sql = $baseSelect . "
    WHERE ut.usuario_territorio_id = ?
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $usuario_territorio_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();
  $con->close();

  if (!$row) {
    http_response_code(404);
    die(json_encode(["ok" => false, "error" => "Relación usuario-territorio no encontrada"], JSON_UNESCAPED_UNICODE));
  }

  echo json_encode(["ok" => true, "data" => usuario_territorio_row($row)], JSON_UNESCAPED_UNICODE);
  exit;
}

/* Listado */
$where = [
  "u.deleted_at IS NULL",
  "t.deleted_at IS NULL"
];

$types = "";
$params = [];

if ($usuario_id !== null && $usuario_id > 0) {
  $where[] = "ut.usuario_id = ?";
  $types .= "i";
  $params[] = $usuario_id;
}

if ($territorio_id !== null && $territorio_id > 0) {
  $where[] = "ut.territorio_id = ?";
  $types .= "i";
  $params[] = $territorio_id;
}

if ($tipo_territorio !== '') {
  if (!in_array($tipo_territorio, ['ZONA', 'SECCION'], true)) {
    $con->close();
    http_response_code(400);
    die(json_encode(["ok" => false, "error" => "tipo_territorio inválido. Usa ZONA o SECCION"], JSON_UNESCAPED_UNICODE));
  }

  $where[] = "t.tipo = ?";
  $types .= "s";
  $params[] = $tipo_territorio;
}

if ($activo !== null) {
  $where[] = "ut.activo = ?";
  $types .= "i";
  $params[] = $activo;
}

if ($q !== '') {
  $like = "%$q%";
  $where[] = "(
    u.username LIKE ?
    OR u.nombre LIKE ?
    OR u.apellido_paterno LIKE ?
    OR u.apellido_materno LIKE ?
    OR u.email LIKE ?
    OR t.codigo LIKE ?
    OR t.nombre LIKE ?
    OR t.municipio LIKE ?
    OR t.estado LIKE ?
  )";

  for ($i = 0; $i < 9; $i++) {
    $types .= "s";
    $params[] = $like;
  }
}

$sql = "
  $baseSelect
  WHERE " . implode(" AND ", $where) . "
  ORDER BY ut.created_at DESC, ut.usuario_territorio_id DESC
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
  $data[] = usuario_territorio_row($row);
}

$st->close();

/* Total */
$countSql = "
  SELECT COUNT(*) AS total
  FROM usuario_territorio ut
  INNER JOIN usuario u
    ON u.usuario_id = ut.usuario_id
  INNER JOIN territorio t
    ON t.territorio_id = ut.territorio_id
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
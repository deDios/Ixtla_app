<?php
// db\WEB\ixtla_c_usuario.php

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

$usuario_id = isset($in['usuario_id']) ? (int)$in['usuario_id'] : (isset($in['id']) ? (int)$in['id'] : null);
$uuid = isset($in['uuid']) ? trim((string)$in['uuid']) : '';
$username = isset($in['username']) ? trim((string)$in['username']) : '';
$email = isset($in['email']) ? trim((string)$in['email']) : '';
$persona_id = isset($in['persona_id']) ? (int)$in['persona_id'] : null;
$rol_id = isset($in['rol_id']) ? (int)$in['rol_id'] : null;
$rol_codigo = isset($in['rol_codigo']) ? strtoupper(trim((string)$in['rol_codigo'])) : '';
$estatus_id = isset($in['estatus_id']) ? (int)$in['estatus_id'] : null;
$estatus_codigo = isset($in['estatus_codigo']) ? strtoupper(trim((string)$in['estatus_codigo'])) : '';
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

function usuario_row(array $row): array {
  return [
    "usuario_id" => (int)$row['usuario_id'],
    "uuid" => $row['uuid'],
    "username" => $row['username'],
    "persona_id" => isset($row['persona_id']) ? (int)$row['persona_id'] : null,

    "rol_id" => (int)$row['rol_id'],
    "rol" => [
      "codigo" => $row['rol_codigo'],
      "nombre" => $row['rol_nombre'],
      "nivel_jerarquico" => isset($row['nivel_jerarquico']) ? (int)$row['nivel_jerarquico'] : null
    ],

    "nombre" => $row['nombre'],
    "apellido_paterno" => $row['apellido_paterno'],
    "apellido_materno" => $row['apellido_materno'],
    "email" => $row['email'],
    "telefono" => $row['telefono'],

    "estatus_id" => (int)$row['estatus_id'],
    "estatus" => [
      "codigo" => $row['estatus_codigo'],
      "nombre" => $row['estatus_nombre']
    ],

    "ultimo_login_at" => $row['ultimo_login_at'],
    "ultimo_login_ip" => $row['ultimo_login_ip'],
    "requiere_cambio_password" => (int)$row['requiere_cambio_password'],
    "intentos_fallidos" => (int)$row['intentos_fallidos'],
    "bloqueado_hasta" => $row['bloqueado_hasta'],
    "token_version" => (int)$row['token_version'],

    "persona" => [
      "nombres" => $row['persona_nombres'] ?? null,
      "apellido_paterno" => $row['persona_apellido_paterno'] ?? null,
      "apellido_materno" => $row['persona_apellido_materno'] ?? null,
      "telefono" => $row['persona_telefono'] ?? null,
      "whatsapp" => $row['persona_whatsapp'] ?? null,
      "email" => $row['persona_email'] ?? null
    ],

    "created_at" => $row['created_at'],
    "created_by" => isset($row['created_by']) ? (int)$row['created_by'] : null,
    "updated_at" => $row['updated_at'],
    "updated_by" => isset($row['updated_by']) ? (int)$row['updated_by'] : null
  ];
}

$baseSelect = "
  SELECT
    u.usuario_id,
    u.uuid,
    u.username,
    u.persona_id,
    u.rol_id,
    u.nombre,
    u.apellido_paterno,
    u.apellido_materno,
    u.email,
    u.telefono,
    u.estatus_id,
    u.ultimo_login_at,
    u.ultimo_login_ip,
    u.requiere_cambio_password,
    u.intentos_fallidos,
    u.bloqueado_hasta,
    u.token_version,
    u.created_at,
    u.created_by,
    u.updated_at,
    u.updated_by,

    r.codigo AS rol_codigo,
    r.nombre AS rol_nombre,
    r.nivel_jerarquico,

    e.codigo AS estatus_codigo,
    e.nombre AS estatus_nombre,

    p.nombres AS persona_nombres,
    p.apellido_paterno AS persona_apellido_paterno,
    p.apellido_materno AS persona_apellido_materno,
    p.telefono AS persona_telefono,
    p.whatsapp AS persona_whatsapp,
    p.email AS persona_email

  FROM usuario u
  INNER JOIN cat_rol r
    ON r.rol_id = u.rol_id
  INNER JOIN cat_estatus e
    ON e.estatus_id = u.estatus_id
  LEFT JOIN persona p
    ON p.persona_id = u.persona_id
";

/* Detalle por ID */
if ($usuario_id && $usuario_id > 0) {
  $sql = $baseSelect . "
    WHERE u.usuario_id = ?
      AND u.deleted_at IS NULL
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $usuario_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();
  $con->close();

  if (!$row) {
    http_response_code(404);
    die(json_encode(["ok" => false, "error" => "Usuario no encontrado"], JSON_UNESCAPED_UNICODE));
  }

  echo json_encode(["ok" => true, "data" => usuario_row($row)], JSON_UNESCAPED_UNICODE);
  exit;
}

/* Detalle por UUID */
if ($uuid !== '') {
  $sql = $baseSelect . "
    WHERE u.uuid = ?
      AND u.deleted_at IS NULL
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("s", $uuid);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();
  $con->close();

  if (!$row) {
    http_response_code(404);
    die(json_encode(["ok" => false, "error" => "Usuario no encontrado"], JSON_UNESCAPED_UNICODE));
  }

  echo json_encode(["ok" => true, "data" => usuario_row($row)], JSON_UNESCAPED_UNICODE);
  exit;
}

/* Detalle por username */
if ($username !== '') {
  $sql = $baseSelect . "
    WHERE u.username COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
      AND u.deleted_at IS NULL
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("s", $username);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();
  $con->close();

  if (!$row) {
    http_response_code(404);
    die(json_encode(["ok" => false, "error" => "Usuario no encontrado"], JSON_UNESCAPED_UNICODE));
  }

  echo json_encode(["ok" => true, "data" => usuario_row($row)], JSON_UNESCAPED_UNICODE);
  exit;
}

/* Detalle por email */
if ($email !== '') {
  $sql = $baseSelect . "
    WHERE u.email COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
      AND u.deleted_at IS NULL
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("s", $email);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();
  $con->close();

  if (!$row) {
    http_response_code(404);
    die(json_encode(["ok" => false, "error" => "Usuario no encontrado"], JSON_UNESCAPED_UNICODE));
  }

  echo json_encode(["ok" => true, "data" => usuario_row($row)], JSON_UNESCAPED_UNICODE);
  exit;
}

/* Listado */
$where = ["u.deleted_at IS NULL"];
$types = "";
$params = [];

if ($persona_id !== null && $persona_id > 0) {
  $where[] = "u.persona_id = ?";
  $types .= "i";
  $params[] = $persona_id;
}

if ($rol_id !== null && $rol_id > 0) {
  $where[] = "u.rol_id = ?";
  $types .= "i";
  $params[] = $rol_id;
}

if ($rol_codigo !== '') {
  $where[] = "r.codigo = ?";
  $types .= "s";
  $params[] = $rol_codigo;
}

if ($estatus_id !== null && $estatus_id > 0) {
  $where[] = "u.estatus_id = ?";
  $types .= "i";
  $params[] = $estatus_id;
}

if ($estatus_codigo !== '') {
  $where[] = "e.codigo = ?";
  $types .= "s";
  $params[] = $estatus_codigo;
}

if ($q !== '') {
  $like = "%$q%";
  $where[] = "(
    u.username LIKE ?
    OR u.nombre LIKE ?
    OR u.apellido_paterno LIKE ?
    OR u.apellido_materno LIKE ?
    OR u.email LIKE ?
    OR u.telefono LIKE ?
  )";

  for ($i = 0; $i < 6; $i++) {
    $types .= "s";
    $params[] = $like;
  }
}

$sql = "
  $baseSelect
  WHERE " . implode(" AND ", $where) . "
  ORDER BY r.nivel_jerarquico ASC, u.created_at DESC, u.usuario_id DESC
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
  $data[] = usuario_row($row);
}

$st->close();

/* Total */
$countSql = "
  SELECT COUNT(*) AS total
  FROM usuario u
  INNER JOIN cat_rol r
    ON r.rol_id = u.rol_id
  INNER JOIN cat_estatus e
    ON e.estatus_id = u.estatus_id
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
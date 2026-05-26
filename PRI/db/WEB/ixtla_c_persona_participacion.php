<?php
// db\WEB\ixtla_c_persona_participacion.php

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

$participacion_id = isset($in['participacion_id']) ? (int)$in['participacion_id'] : (isset($in['id']) ? (int)$in['id'] : null);
$persona_id = isset($in['persona_id']) ? (int)$in['persona_id'] : null;
$tipo_participacion = isset($in['tipo_participacion']) ? trim((string)$in['tipo_participacion']) : null;
$estatus_id = isset($in['estatus_id']) ? (int)$in['estatus_id'] : null;
$territorio_id = isset($in['territorio_id']) ? (int)$in['territorio_id'] : null;
$usuario_responsable_id = isset($in['usuario_responsable_id']) ? (int)$in['usuario_responsable_id'] : null;
$fuente_captura = isset($in['fuente_captura']) ? trim((string)$in['fuente_captura']) : null;
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

function participacion_row(array $row): array {
  return [
    "participacion_id" => (int)$row['participacion_id'],
    "folio" => $row['folio'],
    "persona_id" => (int)$row['persona_id'],
    "tipo_participacion" => $row['tipo_participacion'],
    "participacion_origen_id" => isset($row['participacion_origen_id']) ? (int)$row['participacion_origen_id'] : null,

    "estatus_id" => (int)$row['estatus_id'],
    "estatus" => [
      "codigo" => $row['estatus_codigo'],
      "nombre" => $row['estatus_nombre']
    ],

    "territorio_id" => isset($row['territorio_id']) ? (int)$row['territorio_id'] : null,
    "territorio" => [
      "codigo" => $row['territorio_codigo'],
      "nombre" => $row['territorio_nombre'],
      "tipo" => $row['territorio_tipo'],
      "municipio" => $row['territorio_municipio'],
      "estado" => $row['territorio_estado']
    ],

    "usuario_responsable_id" => isset($row['usuario_responsable_id']) ? (int)$row['usuario_responsable_id'] : null,
    "usuario_responsable" => [
      "username" => $row['usuario_responsable_username'],
      "nombre" => $row['usuario_responsable_nombre'],
      "apellido_paterno" => $row['usuario_responsable_apellido_paterno'],
      "apellido_materno" => $row['usuario_responsable_apellido_materno']
    ],

    "persona" => [
      "nombres" => $row['persona_nombres'],
      "apellido_paterno" => $row['persona_apellido_paterno'],
      "apellido_materno" => $row['persona_apellido_materno'],
      "telefono" => $row['persona_telefono'],
      "whatsapp" => $row['persona_whatsapp'],
      "email" => $row['persona_email']
    ],

    "fuente_captura" => $row['fuente_captura'],
    "fecha_registro" => $row['fecha_registro'],
    "fecha_afiliacion" => $row['fecha_afiliacion'],
    "numero_afiliacion" => $row['numero_afiliacion'],
    "observaciones" => $row['observaciones'],
    "activo" => (int)$row['activo'],

    "created_at" => $row['created_at'],
    "created_by" => isset($row['created_by']) ? (int)$row['created_by'] : null,
    "updated_at" => $row['updated_at'],
    "updated_by" => isset($row['updated_by']) ? (int)$row['updated_by'] : null
  ];
}

$baseSelect = "
  SELECT
    pp.*,

    e.codigo AS estatus_codigo,
    e.nombre AS estatus_nombre,

    t.codigo AS territorio_codigo,
    t.nombre AS territorio_nombre,
    t.tipo AS territorio_tipo,
    t.municipio AS territorio_municipio,
    t.estado AS territorio_estado,

    u.username AS usuario_responsable_username,
    u.nombre AS usuario_responsable_nombre,
    u.apellido_paterno AS usuario_responsable_apellido_paterno,
    u.apellido_materno AS usuario_responsable_apellido_materno,

    p.nombres AS persona_nombres,
    p.apellido_paterno AS persona_apellido_paterno,
    p.apellido_materno AS persona_apellido_materno,
    p.telefono AS persona_telefono,
    p.whatsapp AS persona_whatsapp,
    p.email AS persona_email

  FROM persona_participacion pp
  INNER JOIN persona p
    ON p.persona_id = pp.persona_id
  INNER JOIN cat_estatus e
    ON e.estatus_id = pp.estatus_id
  LEFT JOIN territorio t
    ON t.territorio_id = pp.territorio_id
  LEFT JOIN usuario u
    ON u.usuario_id = pp.usuario_responsable_id
";

if ($participacion_id && $participacion_id > 0) {
  $sql = $baseSelect . "
    WHERE pp.participacion_id = ?
      AND pp.deleted_at IS NULL
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $participacion_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();
  $con->close();

  if (!$row) {
    http_response_code(404);
    die(json_encode(["ok" => false, "error" => "Participación no encontrada"], JSON_UNESCAPED_UNICODE));
  }

  echo json_encode(["ok" => true, "data" => participacion_row($row)], JSON_UNESCAPED_UNICODE);
  exit;
}

$where = ["pp.deleted_at IS NULL"];
$types = "";
$params = [];

if ($persona_id !== null && $persona_id > 0) {
  $where[] = "pp.persona_id = ?";
  $types .= "i";
  $params[] = $persona_id;
}

if ($tipo_participacion !== null && $tipo_participacion !== '') {
  $where[] = "pp.tipo_participacion = ?";
  $types .= "s";
  $params[] = $tipo_participacion;
}

if ($estatus_id !== null && $estatus_id > 0) {
  $where[] = "pp.estatus_id = ?";
  $types .= "i";
  $params[] = $estatus_id;
}

if ($territorio_id !== null && $territorio_id > 0) {
  $where[] = "pp.territorio_id = ?";
  $types .= "i";
  $params[] = $territorio_id;
}

if ($usuario_responsable_id !== null && $usuario_responsable_id > 0) {
  $where[] = "pp.usuario_responsable_id = ?";
  $types .= "i";
  $params[] = $usuario_responsable_id;
}

if ($fuente_captura !== null && $fuente_captura !== '') {
  $where[] = "pp.fuente_captura = ?";
  $types .= "s";
  $params[] = $fuente_captura;
}

if ($activo !== null) {
  $where[] = "pp.activo = ?";
  $types .= "i";
  $params[] = $activo;
}

if ($q !== '') {
  $like = "%$q%";
  $where[] = "(
    pp.folio LIKE ?
    OR pp.numero_afiliacion LIKE ?
    OR p.nombres LIKE ?
    OR p.apellido_paterno LIKE ?
    OR p.apellido_materno LIKE ?
    OR p.telefono LIKE ?
    OR p.whatsapp LIKE ?
    OR p.email LIKE ?
  )";

  for ($i = 0; $i < 8; $i++) {
    $types .= "s";
    $params[] = $like;
  }
}

$sql = "
  $baseSelect
  WHERE " . implode(" AND ", $where) . "
  ORDER BY pp.fecha_registro DESC, pp.participacion_id DESC
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
  $data[] = participacion_row($row);
}

$st->close();

/* Total */
$countSql = "
  SELECT COUNT(*) AS total
  FROM persona_participacion pp
  INNER JOIN persona p
    ON p.persona_id = pp.persona_id
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
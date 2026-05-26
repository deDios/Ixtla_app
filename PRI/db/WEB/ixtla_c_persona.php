<?php
// db\WEB\ixtla_c_persona.php

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

$persona_id = isset($in['persona_id']) ? (int)$in['persona_id'] : (isset($in['id']) ? (int)$in['id'] : null);
$q = isset($in['q']) ? trim((string)$in['q']) : '';
$seccion_id = isset($in['seccion_id']) ? (int)$in['seccion_id'] : null;
$estatus_id = isset($in['estatus_id']) ? (int)$in['estatus_id'] : null;
$telefono = isset($in['telefono']) ? trim((string)$in['telefono']) : '';
$email = isset($in['email']) ? trim((string)$in['email']) : '';

$page = isset($in['page']) ? max(1, (int)$in['page']) : 1;
$pageSize = isset($in['page_size']) ? max(1, min(500, (int)$in['page_size'])) : 50;
$offset = ($page - 1) * $pageSize;

$con = conectar();
if (!$con) {
  http_response_code(500);
  die(json_encode(["ok" => false, "error" => "No se pudo conectar a la base de datos"], JSON_UNESCAPED_UNICODE));
}

$con->set_charset('utf8mb4');

function persona_row(array $row): array {
  return [
    "persona_id" => (int)$row['persona_id'],
    "uuid" => $row['uuid'],
    "nombres" => $row['nombres'],
    "apellido_paterno" => $row['apellido_paterno'],
    "apellido_materno" => $row['apellido_materno'],
    "fecha_nacimiento" => $row['fecha_nacimiento'],
    "sexo" => $row['sexo'],

    "curp_hash" => $row['curp_hash'],
    "clave_elector_hash" => $row['clave_elector_hash'],
    "ocr_hash" => $row['ocr_hash'],
    "cic_hash" => $row['cic_hash'],
    "idmex_hash" => $row['idmex_hash'],

    "seccion_id" => isset($row['seccion_id']) ? (int)$row['seccion_id'] : null,
    "anio_registro" => isset($row['anio_registro']) ? (int)$row['anio_registro'] : null,
    "emision" => isset($row['emision']) ? (int)$row['emision'] : null,
    "vigencia_inicio" => $row['vigencia_inicio'],
    "vigencia_fin" => $row['vigencia_fin'],

    "domicilio_texto" => $row['domicilio_texto'],
    "calle" => $row['calle'],
    "numero_exterior" => $row['numero_exterior'],
    "numero_interior" => $row['numero_interior'],
    "colonia" => $row['colonia'],
    "localidad" => $row['localidad'],
    "municipio" => $row['municipio'],
    "estado" => $row['estado'],
    "codigo_postal" => $row['codigo_postal'],

    "telefono" => $row['telefono'],
    "whatsapp" => $row['whatsapp'],
    "email" => $row['email'],

    "acepta_tratamiento_datos" => (int)$row['acepta_tratamiento_datos'],
    "acepta_datos_sensibles" => (int)$row['acepta_datos_sensibles'],
    "acepta_contacto_whatsapp" => (int)$row['acepta_contacto_whatsapp'],
    "aviso_privacidad_version" => $row['aviso_privacidad_version'],
    "fecha_consentimiento" => $row['fecha_consentimiento'],

    "estatus_id" => (int)$row['estatus_id'],
    "estatus" => [
      "codigo" => $row['estatus_codigo'],
      "nombre" => $row['estatus_nombre']
    ],

    "territorio" => [
      "seccion" => [
        "territorio_id" => isset($row['seccion_territorio_id']) ? (int)$row['seccion_territorio_id'] : null,
        "codigo" => $row['seccion_codigo'],
        "nombre" => $row['seccion_nombre'],
        "tipo" => $row['seccion_tipo']
      ],
      "zona" => [
        "territorio_id" => isset($row['zona_id']) ? (int)$row['zona_id'] : null,
        "codigo" => $row['zona_codigo'],
        "nombre" => $row['zona_nombre']
      ]
    ],

    "capturado_por" => isset($row['capturado_por']) ? (int)$row['capturado_por'] : null,
    "fecha_captura" => $row['fecha_captura'],
    "observaciones" => $row['observaciones'],
    "created_at" => $row['created_at'],
    "created_by" => isset($row['created_by']) ? (int)$row['created_by'] : null,
    "updated_at" => $row['updated_at'],
    "updated_by" => isset($row['updated_by']) ? (int)$row['updated_by'] : null
  ];
}

$baseSelect = "
  SELECT
    p.*,
    e.codigo AS estatus_codigo,
    e.nombre AS estatus_nombre,
    t.territorio_id AS seccion_territorio_id,
    t.codigo AS seccion_codigo,
    t.nombre AS seccion_nombre,
    t.tipo AS seccion_tipo,
    z.territorio_id AS zona_id,
    z.codigo AS zona_codigo,
    z.nombre AS zona_nombre
  FROM persona p
  INNER JOIN cat_estatus e ON e.estatus_id = p.estatus_id
  LEFT JOIN territorio t ON t.territorio_id = p.seccion_id
  LEFT JOIN territorio z ON z.territorio_id = t.territorio_padre_id
";

if ($persona_id && $persona_id > 0) {
  $sql = $baseSelect . "
    WHERE p.persona_id = ?
      AND p.deleted_at IS NULL
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $persona_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();
  $con->close();

  if (!$row) {
    http_response_code(404);
    die(json_encode(["ok" => false, "error" => "Persona no encontrada"], JSON_UNESCAPED_UNICODE));
  }

  echo json_encode(["ok" => true, "data" => persona_row($row)], JSON_UNESCAPED_UNICODE);
  exit;
}

$where = ["p.deleted_at IS NULL"];
$types = "";
$params = [];

if ($q !== '') {
  $like = "%$q%";
  $where[] = "(
    p.nombres LIKE ?
    OR p.apellido_paterno LIKE ?
    OR p.apellido_materno LIKE ?
    OR p.email LIKE ?
    OR p.telefono LIKE ?
    OR p.whatsapp LIKE ?
    OR p.municipio LIKE ?
    OR p.estado LIKE ?
    OR p.colonia LIKE ?
  )";

  for ($i = 0; $i < 9; $i++) {
    $types .= "s";
    $params[] = $like;
  }
}

if ($seccion_id !== null && $seccion_id > 0) {
  $where[] = "p.seccion_id = ?";
  $types .= "i";
  $params[] = $seccion_id;
}

if ($estatus_id !== null && $estatus_id > 0) {
  $where[] = "p.estatus_id = ?";
  $types .= "i";
  $params[] = $estatus_id;
}

if ($telefono !== '') {
  $where[] = "(p.telefono = ? OR p.whatsapp = ?)";
  $types .= "ss";
  $params[] = $telefono;
  $params[] = $telefono;
}

if ($email !== '') {
  $where[] = "p.email = ?";
  $types .= "s";
  $params[] = $email;
}

$sql = "
  SELECT SQL_CALC_FOUND_ROWS *
  FROM (
    $baseSelect
    WHERE " . implode(" AND ", $where) . "
  ) AS x
  ORDER BY x.fecha_captura DESC, x.persona_id DESC
  LIMIT ? OFFSET ?
";

$types .= "ii";
$params[] = $pageSize;
$params[] = $offset;

$st = $con->prepare($sql);

if ($types !== '') {
  $refs = [];
  $refs[] = $types;
  foreach ($params as $k => &$v) {
    $refs[] = &$v;
  }
  call_user_func_array([$st, 'bind_param'], $refs);
}

$st->execute();
$rs = $st->get_result();

$data = [];
while ($row = $rs->fetch_assoc()) {
  $data[] = persona_row($row);
}

$st->close();

$totalRow = $con->query("SELECT FOUND_ROWS() AS total")->fetch_assoc();
$total = (int)$totalRow['total'];

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
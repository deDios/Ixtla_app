<?php
// DB/WEB/ixtla01_c_retro.php

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = [
  'https://ixtla-app.com',
  'https://www.ixtla-app.com'
];

if (in_array($origin, $allowed, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Access-Control-Allow-Credentials: true");
  header("Vary: Origin");
}

header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept");
header("Content-Type: application/json; charset=utf-8");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) {
  include $path;
} else {
  http_response_code(500);
  die(json_encode([
    "ok" => false,
    "error" => "No se encontró conn_db.php"
  ]));
}

$in = $_GET;

$id               = isset($in['id']) ? (int)$in['id'] : null;
$requerimiento_id = isset($in['requerimiento_id']) ? (int)$in['requerimiento_id'] : null;
$status           = isset($in['status']) && $in['status'] !== '' ? (int)$in['status'] : null;
$calificacion     = isset($in['calificacion']) && $in['calificacion'] !== '' ? (int)$in['calificacion'] : null;

$page     = isset($in['page']) ? max(1, (int)$in['page']) : 1;
$pageSize = isset($in['page_size']) ? max(1, min(500, (int)$in['page_size'])) : 50;
$offset   = ($page - 1) * $pageSize;

$con = conectar();
if (!$con) {
  http_response_code(500);
  die(json_encode([
    "ok" => false,
    "error" => "No se pudo conectar a la base de datos"
  ]));
}

$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

/* =========================
   BASE SELECT / FROM
   ========================= */
$baseSelect = "
SELECT
  r.*,
  req.folio,
  req.contacto_telefono,
  d.nombre AS departamento_nombre,
  t.nombre AS tramite_nombre,
  CONCAT(e.nombre, ' ', e.apellidos) AS asignado_nombre_completo
";

$baseFrom = "
FROM retro_ciudadana r
INNER JOIN requerimiento req ON req.id = r.requerimiento_id
INNER JOIN departamento d ON d.id = req.departamento_id
INNER JOIN tramite t ON t.id = req.tramite_id
LEFT JOIN empleado e ON e.id = req.asignado_a
";

/* =========================
   CONSULTA INDIVIDUAL
   ========================= */
if ($id) {
  $sql = $baseSelect . $baseFrom . " WHERE r.id = ? LIMIT 1";

  $stmt = $con->prepare($sql);
  if (!$stmt) {
    http_response_code(500);
    die(json_encode([
      "ok" => false,
      "error" => "Error al preparar consulta individual"
    ]));
  }

  $stmt->bind_param("i", $id);
  $stmt->execute();
  $row = $stmt->get_result()->fetch_assoc();

  if ($row) {
    $row['id'] = (int)$row['id'];
    $row['requerimiento_id'] = (int)$row['requerimiento_id'];
    $row['status'] = (int)$row['status'];
    $row['calificacion'] = $row['calificacion'] !== null ? (int)$row['calificacion'] : null;
  }

  $stmt->close();
  $con->close();

  if (!$row) {
    http_response_code(404);
    echo json_encode([
      "ok" => false,
      "error" => "No encontrado"
    ]);
    exit;
  }

  echo json_encode([
    "ok" => true,
    "data" => $row
  ]);
  exit;
}

/* =========================
   LISTADO FILTRADO
   ========================= */
$where  = [];
$params = [];
$types  = "";

if ($requerimiento_id !== null) {
  $where[] = "r.requerimiento_id = ?";
  $params[] = $requerimiento_id;
  $types .= "i";
}

if ($status !== null) {
  $where[] = "r.status = ?";
  $params[] = $status;
  $types .= "i";
}

if ($calificacion !== null) {
  $where[] = "r.calificacion = ?";
  $params[] = $calificacion;
  $types .= "i";
}

$sql = "SELECT SQL_CALC_FOUND_ROWS
          r.*,
          req.folio,
          req.contacto_telefono,
          d.nombre AS departamento_nombre,
          t.nombre AS tramite_nombre,
          CONCAT(e.nombre, ' ', e.apellidos) AS asignado_nombre_completo
        " . $baseFrom;

if (count($where)) {
  $sql .= " WHERE " . implode(" AND ", $where);
}

$sql .= " ORDER BY r.id DESC LIMIT ? OFFSET ?";

$params[] = $pageSize;
$params[] = $offset;
$types   .= "ii";

$stmt = $con->prepare($sql);
if (!$stmt) {
  http_response_code(500);
  die(json_encode([
    "ok" => false,
    "error" => "Error al preparar consulta de listado"
  ]));
}

$stmt->bind_param($types, ...$params);
$stmt->execute();
$rs = $stmt->get_result();

$data = [];
while ($row = $rs->fetch_assoc()) {
  $row['id'] = (int)$row['id'];
  $row['requerimiento_id'] = (int)$row['requerimiento_id'];
  $row['status'] = (int)$row['status'];
  $row['calificacion'] = $row['calificacion'] !== null ? (int)$row['calificacion'] : null;
  $data[] = $row;
}

$stmt->close();

$tot = $con->query("SELECT FOUND_ROWS() AS t")->fetch_assoc();
$con->close();

echo json_encode([
  "ok" => true,
  "meta" => [
    "page" => $page,
    "page_size" => $pageSize,
    "total" => (int)$tot['t']
  ],
  "data" => $data
]);
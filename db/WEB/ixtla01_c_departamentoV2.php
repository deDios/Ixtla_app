<?php
/* =========================================================
  es la misma consulta que ixtla01_c_departamento.php pero con conteo total real y paginacion
  para que sea mas facil montar la view admin.
  db\WEB\ixtla01_c_departamentoV2.php
   ========================================================= */
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

header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
$reqHeaders = $_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'] ?? '';
if ($reqHeaders) {
  header("Access-Control-Allow-Headers: $reqHeaders");
} else {
  header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept");
}
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
  die(json_encode([
    "ok" => false,
    "error" => "No se encontró conexion.php"
  ]));
}

$input = json_decode(file_get_contents("php://input"), true) ?? [];

$id       = isset($input['id']) ? (int)$input['id'] : null;
$q        = isset($input['q']) ? trim((string)$input['q']) : null;
$status   = array_key_exists('status', $input) ? (int)$input['status'] : null;
$page     = isset($input['page']) ? max(1, (int)$input['page']) : 1;
$per_page = isset($input['per_page']) ? min(200, max(1, (int)$input['per_page'])) : 50;
$all      = isset($input['all']) ? (bool)$input['all'] : false;

$con = conectar();
if (!$con) {
  http_response_code(500);
  die(json_encode([
    "ok" => false,
    "error" => "No se pudo conectar"
  ]));
}

$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

$baseSelect = "
SELECT d.*,
       e1.nombre AS director_nombre,
       e1.apellidos AS director_apellidos,
       e2.nombre AS primera_nombre,
       e2.apellidos AS primera_apellidos
FROM departamento d
LEFT JOIN empleado e1 ON d.director = e1.id
LEFT JOIN empleado e2 ON d.primera_linea = e2.id
";

$baseCount = "
SELECT COUNT(*) AS total
FROM departamento d
";

if ($id) {
  $sql = $baseSelect . " WHERE d.id = ? LIMIT 1";
  $st = $con->prepare($sql);

  if (!$st) {
    http_response_code(500);
    echo json_encode([
      "ok" => false,
      "error" => "Error al preparar consulta de detalle"
    ]);
    $con->close();
    exit;
  }

  $st->bind_param("i", $id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();
  $con->close();

  if (!$row) {
    echo json_encode([
      "ok" => false,
      "error" => "No se encontró el departamento"
    ]);
    exit;
  }

  $row['id'] = (int)$row['id'];
  $row['status'] = (int)$row['status'];
  $row['director'] = isset($row['director']) ? (int)$row['director'] : null;
  $row['primera_linea'] = isset($row['primera_linea']) ? (int)$row['primera_linea'] : null;
  $row['created_by'] = isset($row['created_by']) ? (int)$row['created_by'] : null;
  $row['updated_by'] = isset($row['updated_by']) ? (int)$row['updated_by'] : null;

  echo json_encode([
    "ok" => true,
    "data" => $row
  ]);
  exit;
}

$where  = [];
$params = [];
$types  = "";

if ($q !== null && $q !== "") {
  $where[] = "(d.nombre LIKE CONCAT('%',?,'%') OR d.descripcion LIKE CONCAT('%',?,'%'))";
  $params[] = $q;
  $params[] = $q;
  $types .= "ss";
}

if ($status !== null) {
  $where[] = "d.status = ?";
  $params[] = $status;
  $types .= "i";
}

$whereSql = count($where) ? " WHERE " . implode(" AND ", $where) : "";

/* =========================================================
   TOTAL REAL
   ========================================================= */
$total = 0;
$countSql = $baseCount . $whereSql;
$countSt = $con->prepare($countSql);

if (!$countSt) {
  http_response_code(500);
  echo json_encode([
    "ok" => false,
    "error" => "Error al preparar conteo"
  ]);
  $con->close();
  exit;
}

if ($types !== "") {
  $countSt->bind_param($types, ...$params);
}

$countSt->execute();
$countRow = $countSt->get_result()->fetch_assoc();
$countSt->close();

$total = isset($countRow['total']) ? (int)$countRow['total'] : 0;
$total_pages = $all ? 1 : max(1, (int)ceil($total / $per_page));

if (!$all && $page > $total_pages) {
  $page = $total_pages;
}

$sql = $baseSelect . $whereSql . " ORDER BY d.created_at DESC";

$queryParams = $params;
$queryTypes  = $types;

if (!$all) {
  $offset = ($page - 1) * $per_page;
  $sql .= " LIMIT ? OFFSET ?";
  $queryParams[] = $per_page;
  $queryParams[] = $offset;
  $queryTypes .= "ii";
}

$st = $con->prepare($sql);

if (!$st) {
  http_response_code(500);
  echo json_encode([
    "ok" => false,
    "error" => "Error al preparar listado"
  ]);
  $con->close();
  exit;
}

if ($queryTypes !== "") {
  $st->bind_param($queryTypes, ...$queryParams);
}

$st->execute();
$rs = $st->get_result();

$data = [];
while ($row = $rs->fetch_assoc()) {
  $row['id'] = (int)$row['id'];
  $row['status'] = (int)$row['status'];
  $row['director'] = isset($row['director']) ? (int)$row['director'] : null;
  $row['primera_linea'] = isset($row['primera_linea']) ? (int)$row['primera_linea'] : null;
  $row['created_by'] = isset($row['created_by']) ? (int)$row['created_by'] : null;
  $row['updated_by'] = isset($row['updated_by']) ? (int)$row['updated_by'] : null;
  $data[] = $row;
}

$st->close();
$con->close();

$response = [
  "ok" => true,
  "count" => count($data),
  "total" => $total,
  "data" => $data,
];

if (!$all) {
  $response["page"] = $page;
  $response["per_page"] = $per_page;
  $response["total_pages"] = $total_pages;
} else {
  $response["page"] = 1;
  $response["per_page"] = $total;
  $response["total_pages"] = 1;
}

echo json_encode($response);
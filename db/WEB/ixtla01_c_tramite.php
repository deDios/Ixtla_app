<?php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === 'https://ixtla-app.com' || $origin === 'https://www.ixtla-app.com') {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400");
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }


header('Content-Type: application/json');
date_default_timezone_set('America/Mexico_City');

$path = realpath("/home/site/wwwroot/db/conn/conexion.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php"])); }

$input = json_decode(file_get_contents("php://input"), true) ?? [];

$id             = isset($input['id']) ? (int)$input['id'] : null;
$q              = isset($input['q']) ? trim($input['q']) : null;
$estatus        = isset($input['estatus']) ? (int)$input['estatus'] : null;
$departamento_id= isset($input['departamento_id']) ? (int)$input['departamento_id'] : null;
$page           = isset($input['page']) ? max(1,(int)$input['page']) : 1;
$per_page       = isset($input['per_page']) ? min(200,max(1,(int)$input['per_page'])) : 50;
$all            = isset($input['all']) ? (bool)$input['all'] : false;

$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar"]));
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

$base = "
SELECT t.*,
       d.nombre AS departamento_nombre
FROM tramite t
JOIN departamento d ON d.id = t.departamento_id
";

if ($id) {
  $sql = $base . " WHERE t.id=? LIMIT 1";
  $st = $con->prepare($sql);
  $st->bind_param("i", $id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close(); $con->close();

  if (!$row) { echo json_encode(["ok"=>false,"error"=>"No encontrado"]); exit; }
  $row['id'] = (int)$row['id'];
  $row['departamento_id'] = (int)$row['departamento_id'];
  $row['estatus'] = (int)$row['estatus'];
  echo json_encode(["ok"=>true,"data"=>$row]); exit;
}

$where = [];
$params = [];
$types  = "";

if ($q !== null && $q !== "") {
  $where[] = "(t.nombre LIKE CONCAT('%',?,'%') OR t.descripcion LIKE CONCAT('%',?,'%'))";
  $params[] = $q; $params[] = $q; $types .= "ss";
}
if ($estatus !== null) {
  $where[] = "t.estatus = ?";
  $params[] = $estatus; $types .= "i";
}
if ($departamento_id !== null) {
  $where[] = "t.departamento_id = ?";
  $params[] = $departamento_id; $types .= "i";
}

$sql = $base . (count($where) ? " WHERE ".implode(" AND ", $where) : "") .
       " ORDER BY t.created_at DESC";

if (!$all) {
  $offset = ($page - 1) * $per_page;
  $sql .= " LIMIT ? OFFSET ?";
  $params[] = $per_page; $types .= "i";
  $params[] = $offset;   $types .= "i";
}

$st = $con->prepare($sql);
if ($types !== "") { $st->bind_param($types, ...$params); }
$st->execute();
$rs = $st->get_result();

$data = [];
while ($row = $rs->fetch_assoc()) {
  $row['id'] = (int)$row['id'];
  $row['departamento_id'] = (int)$row['departamento_id'];
  $row['estatus'] = (int)$row['estatus'];
  $data[] = $row;
}
$st->close(); $con->close();

$resp = ["ok"=>true, "count"=>count($data), "data"=>$data];
if (!$all) { $resp["page"] = $page; $resp["per_page"] = $per_page; }
echo json_encode($resp);

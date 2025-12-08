<?php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

$allowlist = [
  'https://ixtla-app.com',
  'https://www.ixtla-app.com',
];

if (in_array($origin, $allowlist, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Access-Control-Allow-Credentials: true");
  header("Vary: Origin");
}

header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400");

// Preflight
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('America/Mexico_City');

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method !== 'GET' && $method !== 'POST') {
  http_response_code(405);
  echo json_encode(["ok"=>false,"error"=>"Método no permitido, usa GET o POST"]);
  exit;
}



/* Respuestas normales: si origin permitido, habilita CORS */
if ($origin && in_array($origin, $ALLOWED, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
  header("Access-Control-Expose-Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After");
}

header('Content-Type: application/json');
date_default_timezone_set('America/Mexico_City');

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php"])); }


$input = json_decode(file_get_contents("php://input"), true) ?? [];

$id       = isset($input['id']) ? (int)$input['id'] : null;
$q        = isset($input['q']) ? trim($input['q']) : null;
$status   = isset($input['status']) ? (int)$input['status'] : null;
$page     = isset($input['page']) ? max(1,(int)$input['page']) : 1;
$per_page = isset($input['per_page']) ? min(200,max(1,(int)$input['per_page'])) : 50;
$all      = isset($input['all']) ? (bool)$input['all'] : false;

$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar"]));
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

$baseSelect = "
SELECT d.*,
       e1.nombre AS director_nombre, e1.apellidos AS director_apellidos,
       e2.nombre AS primera_nombre,  e2.apellidos AS primera_apellidos
FROM departamento d
LEFT JOIN empleado e1 ON d.director = e1.id
LEFT JOIN empleado e2 ON d.primera_linea = e2.id
";

if ($id) {
    $sql = $baseSelect . " WHERE d.id = ? LIMIT 1";
    $st  = $con->prepare($sql);
    $st->bind_param("i", $id);
    $st->execute();
    $row = $st->get_result()->fetch_assoc();
    $st->close(); $con->close();

    if (!$row) { echo json_encode(["ok"=>false,"error"=>"No se encontrado"]); exit; }
    $row['id'] = (int)$row['id']; $row['status'] = (int)$row['status'];
    echo json_encode(["ok"=>true,"data"=>$row]); exit;
}

$where  = [];
$params = [];
$types  = "";

if ($q !== null && $q !== "") {
    $where[] = "(d.nombre LIKE CONCAT('%',?,'%') OR d.descripcion LIKE CONCAT('%',?,'%'))";
    $params[] = $q; $params[] = $q; $types .= "ss";
}
if ($status !== null) {
    $where[] = "d.status = ?";
    $params[] = $status; $types .= "i";
}

$sql = $baseSelect . (count($where) ? " WHERE ".implode(" AND ", $where) : "") . " ORDER BY d.created_at DESC";

if (!$all) {
    $offset = ($page - 1) * $per_page;
    $sql   .= " LIMIT ? OFFSET ?";
    $params[] = $per_page; $types .= "i";
    $params[] = $offset;   $types .= "i";
}

$st = $con->prepare($sql);
if ($types !== "") {
    $st->bind_param($types, ...$params);
}
$st->execute();
$rs = $st->get_result();

$data = [];
while ($row = $rs->fetch_assoc()) {
    $row['id'] = (int)$row['id'];
    $row['status'] = (int)$row['status'];
    $data[] = $row;
}
$st->close(); $con->close();

$resp = ["ok"=>true, "count"=>count($data), "data"=>$data];
if (!$all) { $resp["page"] = $page; $resp["per_page"] = $per_page; }

echo json_encode($resp);


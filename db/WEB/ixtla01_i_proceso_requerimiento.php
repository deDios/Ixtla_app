<?php
// i_proceso_requerimiento.php
// Inserta un nuevo registro en proceso_requerimiento

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

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  http_response_code(405);
  echo json_encode(["ok"=>false,"error"=>"Método no permitido, usa POST"]);
  exit;
}

// Conexión DB
$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }
else {
  http_response_code(500);
  die(json_encode(["ok"=>false,"error"=>"No se encontró conn_db.php en $path"]));
}

$in = json_decode(file_get_contents("php://input"), true) ?? [];

// Campos de entrada
$requerimiento_id = isset($in['requerimiento_id']) ? (int)$in['requerimiento_id'] : null;

// empleado_id puede venir null
$empleado_id = array_key_exists('empleado_id',$in) && $in['empleado_id'] !== '' && $in['empleado_id'] !== null
  ? (int)$in['empleado_id']
  : null;

$descripcion = array_key_exists('descripcion',$in) ? trim($in['descripcion']) : null;
$status      = isset($in['status']) ? (int)$in['status'] : 1;
$created_by  = isset($in['created_by']) ? (int)$in['created_by'] : null;
$updated_by  = $created_by; // inicializamos igual

// Validaciones mínimas
if (!$requerimiento_id || !$created_by) {
  http_response_code(400);
  echo json_encode([
    "ok"=>false,
    "error"=>"Faltan datos obligatorios: requerimiento_id, created_by"
  ]);
  exit;
}

$con = conectar();
if (!$con) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]);
  exit;
}
$con->set_charset('utf8mb4');

// Insert
$sql = "INSERT INTO proceso_requerimiento
        (requerimiento_id, empleado_id, descripcion, status, created_by, updated_by)
        VALUES (?,?,?,?,?,?)";

$stmt = $con->prepare($sql);
if (!$stmt) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"Error en prepare"]);
  $con->close();
  exit;
}

// tipos: i (int), s (string)
$stmt->bind_param(
  "iissii",
  $requerimiento_id,
  $empleado_id,
  $descripcion,
  $status,
  $created_by,
  $updated_by
);

$okExec = $stmt->execute();
if (!$okExec) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"No se pudo insertar"]);
  $stmt->close();
  $con->close();
  exit;
}

$newId = $con->insert_id;
$stmt->close();

// Recuperar registro recién insertado (con nombre del empleado)
$q2 = $con->prepare("
  SELECT
    p.id,
    p.requerimiento_id,
    p.empleado_id,
    e.nombre AS empleado_nombre,
    e.apellidos AS empleado_apellidos,
    p.descripcion,
    p.status,
    p.created_at,
    p.updated_at,
    p.created_by,
    p.updated_by
  FROM proceso_requerimiento p
  LEFT JOIN empleado e ON e.id = p.empleado_id
  WHERE p.id = ?
  LIMIT 1
");
$q2->bind_param("i", $newId);
$q2->execute();
$row = $q2->get_result()->fetch_assoc();
$q2->close();

$con->close();

http_response_code(201);

if ($row) {
  $row['id']               = (int)$row['id'];
  $row['requerimiento_id'] = (int)$row['requerimiento_id'];
  $row['empleado_id']      = $row['empleado_id'] !== null ? (int)$row['empleado_id'] : null;
  $row['status']           = (int)$row['status'];
  $row['created_by']       = $row['created_by'] !== null ? (int)$row['created_by'] : null;
  $row['updated_by']       = $row['updated_by'] !== null ? (int)$row['updated_by'] : null;
}

echo json_encode([
  "ok"=>true,
  "data"=>$row
]);

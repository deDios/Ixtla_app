<?php
// u_proceso_requerimiento.php
// Actualiza un registro de proceso_requerimiento

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

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method !== 'PUT' && $method !== 'PATCH') {
  http_response_code(405);
  echo json_encode(["ok"=>false,"error"=>"Método no permitido, usa PUT o PATCH"]);
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

// Requeridos
$id         = isset($in['id']) ? (int)$in['id'] : null;
$updated_by = isset($in['updated_by']) ? (int)$in['updated_by'] : null;

// Opcionales
$descripcion = array_key_exists('descripcion',$in) ? trim($in['descripcion']) : null;
$status      = array_key_exists('status',$in) ? (int)$in['status'] : null;

// empleado_id puede venir null explícito
$empleado_id_present = array_key_exists('empleado_id',$in);
$empleado_id = $empleado_id_present && $in['empleado_id'] !== '' && $in['empleado_id'] !== null
  ? (int)$in['empleado_id']
  : null;

if (!$id || !$updated_by) {
  http_response_code(400);
  echo json_encode([
    "ok"=>false,
    "error"=>"Faltan datos obligatorios: id, updated_by"
  ]);
  exit;
}

// Construimos UPDATE dinámico
$setParts = [];
$types    = "";
$params   = [];

// descripcion
if ($descripcion !== null && $descripcion !== "") {
  $setParts[] = "descripcion=?";
  $types     .= "s";
  $params[]  =& $descripcion;
}

// status
if ($status !== null) {
  $setParts[] = "status=?";
  $types     .= "i";
  $params[]  =& $status;
}

// empleado_id (si vino en el JSON)
if ($empleado_id_present) {
  $setParts[] = "empleado_id=?";
  $types     .= "i";
  $params[]  =& $empleado_id;
}

// siempre actualizamos updated_by
$setParts[] = "updated_by=?";
$types     .= "i";
$params[]  =& $updated_by;

// armamos SQL
$sql = "UPDATE proceso_requerimiento
        SET ".implode(", ", $setParts)."
        WHERE id=?";

$types   .= "i";
$params[] =& $id;

// Ejecutar
$con = conectar();
if (!$con) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]);
  exit;
}
$con->set_charset('utf8mb4');

$stmt = $con->prepare($sql);
if (!$stmt) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"Error en prepare"]);
  $con->close();
  exit;
}

call_user_func_array([$stmt,'bind_param'], array_merge([$types], $params));

$okExec   = $stmt->execute();
$affected = $stmt->affected_rows;
$stmt->close();

if (!$okExec) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"No se pudo actualizar"]);
  $con->close();
  exit;
}

// Validar existencia (por si affected_rows=0 pero tampoco existe)
$qCheck = $con->prepare("SELECT id FROM proceso_requerimiento WHERE id=? LIMIT 1");
$qCheck->bind_param("i", $id);
$qCheck->execute();
$exists = $qCheck->get_result()->fetch_assoc();
$qCheck->close();

if (!$exists) {
  http_response_code(404);
  echo json_encode(["ok"=>false,"error"=>"No encontrado"]);
  $con->close();
  exit;
}

// Traer registro actualizado
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
$q2->bind_param("i", $id);
$q2->execute();
$row = $q2->get_result()->fetch_assoc();
$q2->close();

$con->close();

if ($row) {
  $row['id']               = (int)$row['id'];
  $row['requerimiento_id'] = (int)$row['requerimiento_id'];
  $row['empleado_id']      = $row['empleado_id'] !== null ? (int)$row['empleado_id'] : null;
  $row['status']           = (int)$row['status'];
  $row['created_by']       = $row['created_by'] !== null ? (int)$row['created_by'] : null;
  $row['updated_by']       = $row['updated_by'] !== null ? (int)$row['updated_by'] : null;
  $row['empleado_display'] = trim(($row['empleado_nombre'] ?? '').' '.($row['empleado_apellidos'] ?? ''));
}

echo json_encode([
  "ok"=>true,
  "data"=>$row,
  "meta"=>[
    "affected_rows"=>$affected
  ]
]);

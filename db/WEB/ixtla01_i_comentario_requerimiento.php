<?php
// i_comentario_requerimiento.php
// Inserta un nuevo comentario en comentario_requerimiento

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

// Conexion DB
$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }
else {
  http_response_code(500);
  die(json_encode(["ok"=>false,"error"=>"No se encontró conn_db.php en $path"]));
}

$in = json_decode(file_get_contents("php://input"), true) ?? [];

// Campos de entrada
$requerimiento_id = isset($in['requerimiento_id']) ? (int)$in['requerimiento_id'] : null;

// empleado_id puede venir null o no venir
$empleado_id = array_key_exists('empleado_id',$in) && $in['empleado_id'] !== '' && $in['empleado_id'] !== null
  ? (int)$in['empleado_id']
  : null;

$comentario  = isset($in['comentario']) ? trim($in['comentario']) : '';
$status      = isset($in['status']) ? (int)$in['status'] : 1;
$created_by  = isset($in['created_by']) ? (int)$in['created_by'] : null;
// de inicio dejamos updated_by = created_by
$updated_by  = $created_by;

// Validaciones mínimas
if (!$requerimiento_id || $comentario === '' || !$created_by) {
  http_response_code(400);
  echo json_encode([
    "ok"=>false,
    "error"=>"Faltan datos obligatorios: requerimiento_id, comentario, created_by"
  ]);
  exit;
}

// Conectar
$con = conectar();
if (!$con) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]);
  exit;
}
$con->set_charset('utf8mb4');

// Insert
$sql = "INSERT INTO comentario_requerimiento
        (requerimiento_id, empleado_id, comentario, status, created_by, updated_by)
        VALUES (?,?,?,?,?,?)";

$stmt = $con->prepare($sql);
if (!$stmt) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"Error en prepare"]);
  $con->close();
  exit;
}

// Tipos: i = int, s = string
// requerimiento_id (i)
// empleado_id      (i) puede ser null
// comentario       (s)
// status           (i)
// created_by       (i)
// updated_by       (i)
$stmt->bind_param(
  "iisiii",
  $requerimiento_id,
  $empleado_id,
  $comentario,
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

// Recuperar registro recién insertado
$q2 = $con->prepare("
  SELECT id,
         requerimiento_id,
         empleado_id,
         comentario,
         status,
         created_at,
         updated_at,
         created_by,
         updated_by
  FROM comentario_requerimiento
  WHERE id = ?
  LIMIT 1
");
$q2->bind_param("i", $newId);
$q2->execute();
$row = $q2->get_result()->fetch_assoc();
$q2->close();

$con->close();

http_response_code(201);
echo json_encode([
  "ok"=>true,
  "data"=>$row
]);

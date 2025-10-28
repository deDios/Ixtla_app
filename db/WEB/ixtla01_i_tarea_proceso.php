<?php
// i_tarea_proceso.php
// Crea una nueva tarea en tarea_proceso

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

// === Inputs obligatorios / opcionales ===
$proceso_id   = isset($in['proceso_id']) ? (int)$in['proceso_id'] : null;

$asignado_a = array_key_exists('asignado_a',$in) && $in['asignado_a'] !== '' && $in['asignado_a'] !== null
  ? (int)$in['asignado_a']
  : null;

$titulo      = isset($in['titulo']) ? trim($in['titulo']) : '';
$descripcion = array_key_exists('descripcion',$in) ? trim($in['descripcion']) : null;

$esfuerzo    = isset($in['esfuerzo']) ? (int)$in['esfuerzo'] : null;

$fecha_inicio = array_key_exists('fecha_inicio',$in) && $in['fecha_inicio'] !== '' ? trim($in['fecha_inicio']) : null;
$fecha_fin    = array_key_exists('fecha_fin',$in)    && $in['fecha_fin']    !== '' ? trim($in['fecha_fin'])    : null;

$status     = isset($in['status']) ? (int)$in['status'] : 1;
$created_by = isset($in['created_by']) ? (int)$in['created_by'] : null;
$updated_by = $created_by;

// Validación mínima
if (!$proceso_id || $titulo === '' || $esfuerzo === null || $created_by === null) {
  http_response_code(400);
  echo json_encode([
    "ok"=>false,
    "error"=>"Faltan datos obligatorios: proceso_id, titulo, esfuerzo, created_by"
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
$sql = "INSERT INTO tarea_proceso
        (proceso_id, asignado_a, titulo, descripcion, esfuerzo, fecha_inicio, fecha_fin, status, created_by, updated_by)
        VALUES (?,?,?,?,?,?,?,?,?,?)";

$stmt = $con->prepare($sql);
if (!$stmt) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"Error en prepare"]);
  $con->close();
  exit;
}

// Tipos: i=int, s=string
// proceso_id (i)
// asignado_a (i)
// titulo (s)
// descripcion (s)
// esfuerzo (i)
// fecha_inicio (s)
// fecha_fin (s)
// status (i)
// created_by (i)
// updated_by (i)
$stmt->bind_param(
  "iississiii",
  $proceso_id,
  $asignado_a,
  $titulo,
  $descripcion,
  $esfuerzo,
  $fecha_inicio,
  $fecha_fin,
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

// Traemos la tarea recién creada con datos del asignado
$q2 = $con->prepare("
  SELECT
    t.id,
    t.proceso_id,
    t.asignado_a,
    e.nombre AS asignado_nombre,
    e.apellidos AS asignado_apellidos,
    t.titulo,
    t.descripcion,
    t.esfuerzo,
    t.fecha_inicio,
    t.fecha_fin,
    t.status,
    t.created_at,
    t.updated_at,
    t.created_by,
    t.updated_by
  FROM tarea_proceso t
  LEFT JOIN empleado e ON e.id = t.asignado_a
  WHERE t.id = ?
  LIMIT 1
");
$q2->bind_param("i", $newId);
$q2->execute();
$row = $q2->get_result()->fetch_assoc();
$q2->close();

$con->close();

http_response_code(201);

if ($row) {
  $row['id']          = (int)$row['id'];
  $row['proceso_id']  = (int)$row['proceso_id'];
  $row['asignado_a']  = $row['asignado_a'] !== null ? (int)$row['asignado_a'] : null;
  $row['esfuerzo']    = (int)$row['esfuerzo'];
  $row['status']      = (int)$row['status'];
  $row['created_by']  = $row['created_by'] !== null ? (int)$row['created_by'] : null;
  $row['updated_by']  = $row['updated_by'] !== null ? (int)$row['updated_by'] : null;
  $row['asignado_display'] = trim(($row['asignado_nombre'] ?? '').' '.($row['asignado_apellidos'] ?? ''));
}

echo json_encode([
  "ok"=>true,
  "data"=>$row
]);

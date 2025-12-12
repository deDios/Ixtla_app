<?php
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
$titulo_present = array_key_exists('titulo',$in);
$titulo         = $titulo_present ? trim($in['titulo']) : null;

$descripcion_present = array_key_exists('descripcion',$in);
$descripcion         = $descripcion_present ? trim($in['descripcion']) : null;

$esfuerzo_present = array_key_exists('esfuerzo',$in);
$esfuerzo         = $esfuerzo_present ? (int)$in['esfuerzo'] : null;

// asignado_a puede venir null explícito
$asignado_a_present = array_key_exists('asignado_a',$in);
$asignado_a         = $asignado_a_present && $in['asignado_a'] !== '' && $in['asignado_a'] !== null
  ? (int)$in['asignado_a']
  : null;

// fecha_inicio/fin también pueden venir null explícito
$fecha_inicio_present = array_key_exists('fecha_inicio',$in);
$fecha_inicio         = $fecha_inicio_present && $in['fecha_inicio'] !== '' && $in['fecha_inicio'] !== null
  ? trim($in['fecha_inicio'])
  : null;

$fecha_fin_present = array_key_exists('fecha_fin',$in);
$fecha_fin         = $fecha_fin_present && $in['fecha_fin'] !== '' && $in['fecha_fin'] !== null
  ? trim($in['fecha_fin'])
  : null;

$status_present = array_key_exists('status',$in);
$status         = $status_present ? (int)$in['status'] : null;

if (!$id || !$updated_by) {
  http_response_code(400);
  echo json_encode([
    "ok"=>false,
    "error"=>"Faltan datos obligatorios: id, updated_by"
  ]);
  exit;
}

$setParts = [];
$types    = "";
$params   = [];

// titulo
if ($titulo_present) {
  $setParts[] = "titulo=?";
  $types     .= "s";
  $params[]  =& $titulo;
}

// descripcion
if ($descripcion_present) {
  $setParts[] = "descripcion=?";
  $types     .= "s";
  $params[]  =& $descripcion;
}

// esfuerzo
if ($esfuerzo_present) {
  $setParts[] = "esfuerzo=?";
  $types     .= "i";
  $params[]  =& $esfuerzo;
}

// asignado_a
if ($asignado_a_present) {
  $setParts[] = "asignado_a=?";
  $types     .= "i";
  $params[]  =& $asignado_a;
}

// fecha_inicio
if ($fecha_inicio_present) {
  $setParts[] = "fecha_inicio=?";
  $types     .= "s";
  $params[]  =& $fecha_inicio;
}

// fecha_fin
if ($fecha_fin_present) {
  $setParts[] = "fecha_fin=?";
  $types     .= "s";
  $params[]  =& $fecha_fin;
}

// status
if ($status_present) {
  $setParts[] = "status=?";
  $types     .= "i";
  $params[]  =& $status;
}

// siempre guardamos quién actualizó
$setParts[] = "updated_by=?";
$types     .= "i";
$params[]  =& $updated_by;

$sql = "UPDATE tarea_proceso
        SET ".implode(", ", $setParts)."
        WHERE id=?";

$types   .= "i";
$params[] =& $id;

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

// bind dinámico
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

// Validar que exista
$qCheck = $con->prepare("SELECT id FROM tarea_proceso WHERE id=? LIMIT 1");
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

// Traer tarea actualizada
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
$q2->bind_param("i", $id);
$q2->execute();
$row = $q2->get_result()->fetch_assoc();
$q2->close();

$con->close();

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
  "data"=>$row,
  "meta"=>[
    "affected_rows"=>$affected
  ]
]);

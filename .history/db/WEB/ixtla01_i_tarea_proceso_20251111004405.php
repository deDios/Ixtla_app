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

header('Content-Type: application/json; charset=utf-8');
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
  echo json_encode(["ok"=>false,"error"=>"No se encontró conn_db.php en $path"]);
  exit;
}

$raw = file_get_contents("php://input");
$in = json_decode($raw, true);
if (!is_array($in)) $in = [];

// === Inputs obligatorios / opcionales ===
$proceso_id   = isset($in['proceso_id']) ? (int)$in['proceso_id'] : null;

$asignado_a = (array_key_exists('asignado_a',$in) && $in['asignado_a'] !== '' && $in['asignado_a'] !== null)
  ? (int)$in['asignado_a'] : null;

$titulo      = isset($in['titulo']) ? trim((string)$in['titulo']) : '';
$descripcion = array_key_exists('descripcion',$in) ? trim((string)$in['descripcion']) : null;

$esfuerzo    = isset($in['esfuerzo']) ? (int)$in['esfuerzo'] : null;

// Normalizamos fechas: "" → null; validamos formato simple (YYYY-MM-DD HH:mm:ss o YYYY-MM-DD)
$fecha_inicio = (array_key_exists('fecha_inicio',$in) && $in['fecha_inicio'] !== '') ? trim((string)$in['fecha_inicio']) : null;
$fecha_fin    = (array_key_exists('fecha_fin',   $in) && $in['fecha_fin']    !== '') ? trim((string)$in['fecha_fin'])    : null;

$validDate = function($s) {
  if ($s === null) return true;
  // Acepta "YYYY-MM-DD" o "YYYY-MM-DD HH:mm:ss"
  return (bool)preg_match('/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/', $s);
};

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
if (!$validDate($fecha_inicio) || !$validDate($fecha_fin)) {
  http_response_code(422);
  echo json_encode([
    "ok"=>false,
    "error"=>"Formato de fecha inválido. Usa 'YYYY-MM-DD' o 'YYYY-MM-DD HH:mm:ss'."
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

// --- Armado de SQL con NULL literal para fechas/descripcion/asignado si vienen nulos ---
$sql = "INSERT INTO tarea_proceso
  (proceso_id, asignado_a, titulo, descripcion, esfuerzo, fecha_inicio, fecha_fin, status, created_by, updated_by)
  VALUES (
    ?, " . ($asignado_a === null ? "NULL" : "?") . ", ?, " . ($descripcion === null ? "NULL" : "?") . ",
    ?, " . ($fecha_inicio === null ? "NULL" : "?") . ", " . ($fecha_fin === null ? "NULL" : "?") . ",
    ?, ?, ?
  )";

// Construimos los tipos/params dinámicamente, bindeando solo lo que NO es null
$types = "i";         // proceso_id
$params = [$proceso_id];

if ($asignado_a !== null) { $types .= "i"; $params[] = $asignado_a; }

$types .= "s";        // titulo
$params[] = $titulo;

if ($descripcion !== null) { $types .= "s"; $params[] = $descripcion; }

$types .= "i";        // esfuerzo
$params[] = $esfuerzo;

if ($fecha_inicio !== null) { $types .= "s"; $params[] = $fecha_inicio; }
if ($fecha_fin    !== null) { $types .= "s"; $params[] = $fecha_fin; }

$types .= "iii";      // status, created_by, updated_by
$params[] = $status;
$params[] = $created_by;
$params[] = $updated_by;

$stmt = $con->prepare($sql);
if (!$stmt) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"Error en prepare","detail"=>$con->error]);
  $con->close();
  exit;
}

// bind dinámico
$stmt->bind_param($types, ...$params);

$okExec = $stmt->execute();
if (!$okExec) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"No se pudo insertar","detail"=>$stmt->error]);
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
if ($q2) {
  $q2->bind_param("i", $newId);
  $q2->execute();
  $row = $q2->get_result()->fetch_assoc();
  $q2->close();
} else {
  $row = null;
}

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
], JSON_UNESCAPED_UNICODE);

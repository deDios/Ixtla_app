<?php
// --- CORS robusto (poner ANTES de cualquier output) ---
$allowed = [
  'https://ixtla-app.com',
  'https://www.ixtla-app.com',
  'https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host   = ($_SERVER['REQUEST_SCHEME'] ?? 'https') . '://' . ($_SERVER['HTTP_HOST'] ?? '');

// Preferir Origin si viene; si no, considerar el host (same-origin)
$reflect = '';
if ($origin && in_array($origin, $allowed, true)) {
  $reflect = $origin;
} elseif ($host && in_array($host, $allowed, true)) {
  $reflect = $host;
}
if ($reflect) {
  header("Access-Control-Allow-Origin: $reflect");
  header("Vary: Origin");
}

header("Access-Control-Allow-Credentials: true"); // si usas cookies/sesión
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400");

// Responder preflight siempre con los headers ya puestos
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}
// --- fin CORS ---

header('Content-Type: application/json'); date_default_timezone_set('America/Mexico_City');

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conn_db.php en $path"])); }

$in = json_decode(file_get_contents("php://input"), true) ?? [];

$requerimiento_id = isset($in['requerimiento_id']) ? (int)$in['requerimiento_id'] : null;
$empleado_id      = isset($in['empleado_id']) ? (int)$in['empleado_id'] : null; // opcional
$tipo             = isset($in['tipo']) ? (int)$in['tipo'] : null;               // 1=Cancelación,2=Pausa
$comentario       = isset($in['comentario']) ? trim($in['comentario']) : null;
$created_by       = isset($in['created_by']) ? (int)$in['created_by'] : null;
$status           = isset($in['status']) ? (int)$in['status'] : 1;

if (!$requerimiento_id || !$tipo || !$comentario || !$created_by) {
  http_response_code(400);
  echo json_encode(["ok"=>false,"error"=>"Faltan datos obligatorios: requerimiento_id, tipo, comentario, created_by"]); exit;
}
if (!in_array($tipo,[1,2],true)) {
  http_response_code(422); echo json_encode(["ok"=>false,"error"=>"tipo debe ser 1 (Cancelación) o 2 (Pausa)"]); exit;
}

$con = conectar(); if (!$con) { echo json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]); exit; }
$con->set_charset('utf8mb4');

$sql = "INSERT INTO comentario_cancelacion_pausa
          (requerimiento_id, empleado_id, tipo, comentario, status, created_by)
        VALUES (?,?,?,?,?,?)";
$stmt = $con->prepare($sql);
$stmt->bind_param("iiisii", $requerimiento_id, $empleado_id, $tipo, $comentario, $status, $created_by);

if (!$stmt->execute()) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"Error al insertar: ".$stmt->error]); $stmt->close(); $con->close(); exit;
}
$new_id = $stmt->insert_id; $stmt->close();

$q = $con->prepare("SELECT * FROM comentario_cancelacion_pausa WHERE id=? LIMIT 1");
$q->bind_param("i",$new_id); $q->execute(); $row = $q->get_result()->fetch_assoc(); $q->close(); $con->close();

echo json_encode(["ok"=>true,"data"=>$row], JSON_UNESCAPED_UNICODE);

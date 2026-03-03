<?php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = ['https://ixtla-app.com', 'https://www.ixtla-app.com'];

if (in_array($origin, $allowed, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Access-Control-Allow-Credentials: true");
  header("Vary: Origin");
}
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }

$in = json_decode(file_get_contents("php://input"), true) ?? [];

$requerimiento_id = isset($in['requerimiento_id']) ? (int)$in['requerimiento_id'] : null;
$status           = isset($in['status']) ? (int)$in['status'] : 1;
$comentario       = isset($in['comentario']) ? trim($in['comentario']) : null;
$calificacion     = isset($in['calificacion']) ? (int)$in['calificacion'] : null;
$link             = isset($in['link']) ? trim($in['link']) : null;

if (!$requerimiento_id) {
    echo json_encode(["ok" => false, "error" => "requerimiento_id es requerido"]);
    exit;
}

$con = conectar();
$sql = "INSERT INTO retro_ciudadana (requerimiento_id, status, comentario, calificacion, link) VALUES (?, ?, ?, ?, ?)";
$stmt = $con->prepare($sql);
$stmt->bind_param("iisis", $requerimiento_id, $status, $comentario, $calificacion, $link);

if ($stmt->execute()) {
    echo json_encode(["ok" => true, "id" => $con->insert_id]);
} else {
    echo json_encode(["ok" => false, "error" => $con->error]);
}
$stmt->close();
$con->close();
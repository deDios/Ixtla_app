<?php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = ['https://ixtla-app.com', 'https://www.ixtla-app.com'];

if (in_array($origin, $allowed, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Access-Control-Allow-Credentials: true");
  header("Vary: Origin");
}
header("Access-Control-Allow-Methods: PUT, PATCH, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }

$in = json_decode(file_get_contents("php://input"), true) ?? [];
$id = isset($in['id']) ? (int)$in['id'] : null;

if (!$id) {
    echo json_encode(["ok" => false, "error" => "ID requerido para actualizar"]);
    exit;
}

$con = conectar();

// Usamos COALESCE para solo actualizar lo que se envíe
$sql = "UPDATE retro_ciudadana SET 
        status = COALESCE(?, status), 
        comentario = COALESCE(?, comentario), 
        calificacion = COALESCE(?, calificacion), 
        link = COALESCE(?, link) 
        WHERE id = ?";

$status       = isset($in['status']) ? (int)$in['status'] : null;
$comentario   = isset($in['comentario']) ? $in['comentario'] : null;
$calificacion = isset($in['calificacion']) ? (int)$in['calificacion'] : null;
$link         = isset($in['link']) ? $in['link'] : null;

if ($status !== null && !in_array($status, [0, 1, 2, 3], true)) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "status de retroalimentacion no valido"]);
    exit;
}
if ($calificacion !== null && !in_array($calificacion, [1, 2, 3, 4], true)) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "calificacion debe estar entre 1 y 4"]);
    exit;
}

$stmt = $con->prepare($sql);
$stmt->bind_param("isisi", $status, $comentario, $calificacion, $link, $id);

if ($stmt->execute()) {
    echo json_encode(["ok" => true, "msg" => "Registro actualizado"]);
} else {
    echo json_encode(["ok" => false, "error" => $con->error]);
}
$stmt->close();
$con->close();

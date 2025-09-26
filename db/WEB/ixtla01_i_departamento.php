<?php
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

$path = realpath("/home/site/wwwroot/db/conn/conexion.php");
if ($path && file_exists($path)) {
    include $path;
} else {
    http_response_code(500);
    die(json_encode(["ok"=>false, "error"=>"No se encontró conexion.php en $path"]));
}

$input = json_decode(file_get_contents("php://input"), true) ?? [];

$required = ['nombre','descripcion','director','primera_linea'];
foreach ($required as $k) {
    if (!isset($input[$k]) || $input[$k] === '') {
        http_response_code(400);
        die(json_encode(["ok"=>false, "error"=>"Falta parámetro obligatorio: $k"]));
    }
}

$nombre        = trim($input['nombre']);
$descripcion   = trim($input['descripcion']);
$director      = (int)$input['director'];
$primera_linea = (int)$input['primera_linea'];
$status        = isset($input['status']) ? (int)$input['status'] : 1;
$created_by    = isset($input['created_by']) ? (int)$input['created_by'] : null;

$con = conectar();
if (!$con) die(json_encode(["ok"=>false, "error"=>"No se pudo conectar a la base de datos"]));
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

$sql = "INSERT INTO departamento (nombre, descripcion, director, primera_linea, status, created_by)
        VALUES (?,?,?,?,?,?)";
$stmt = $con->prepare($sql);
$created_by_param = $created_by; // permite NULL
$stmt->bind_param("ssiiii", $nombre, $descripcion, $director, $primera_linea, $status, $created_by_param);

if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(["ok"=>false, "error"=>"Error al insertar: ".$stmt->error]);
    $stmt->close(); $con->close(); exit;
}

$new_id = $stmt->insert_id;
$stmt->close();

$q = $con->prepare("SELECT * FROM departamento WHERE id=? LIMIT 1");
$q->bind_param("i", $new_id);
$q->execute();
$res = $q->get_result()->fetch_assoc();
$q->close(); $con->close();

$res['id'] = (int)$res['id'];
$res['status'] = (int)$res['status'];
echo json_encode(["ok"=>true, "data"=>$res]);

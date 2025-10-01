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

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php"])); }

$input = json_decode(file_get_contents("php://input"), true) ?? [];
if (!isset($input['id'])) {
    http_response_code(400);
    die(json_encode(["ok"=>false,"error"=>"Falta parámetro obligatorio: id"]));
}


$id            = (int)$input['id'];
$nombre        = $input['nombre']        ?? null;
$descripcion   = $input['descripcion']   ?? null;
$director      = isset($input['director']) ? (int)$input['director'] : null;
$primera_linea = isset($input['primera_linea']) ? (int)$input['primera_linea'] : null;
$status        = isset($input['status']) ? (int)$input['status'] : null;
$updated_by    = isset($input['updated_by']) ? (int)$input['updated_by'] : null;

$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar"]));
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

$sql = "UPDATE departamento SET
          nombre        = COALESCE(?, nombre),
          descripcion   = COALESCE(?, descripcion),
          director      = COALESCE(?, director),
          primera_linea = COALESCE(?, primera_linea),
          status        = COALESCE(?, status),
          updated_by    = COALESCE(?, updated_by),
          updated_at    = CURRENT_TIMESTAMP
        WHERE id = ?";

$st = $con->prepare($sql);
$st->bind_param(
    "ssiiiii",
    $nombre, $descripcion, $director, $primera_linea, $status, $updated_by, $id
);

if (!$st->execute()) {
    http_response_code(500);
    echo json_encode(["ok"=>false,"error"=>"Error al actualizar: ".$st->error]);
    $st->close(); $con->close(); exit;
}
$st->close();

/* Devolver registro actualizado */
$q = $con->prepare("SELECT * FROM departamento WHERE id=? LIMIT 1");
$q->bind_param("i", $id);
$q->execute();
$row = $q->get_result()->fetch_assoc();
$q->close(); $con->close();

if (!$row) { echo json_encode(["ok"=>false,"error"=>"No encontrado tras actualizar"]); exit; }

$row['id'] = (int)$row['id']; $row['status'] = (int)$row['status'];
echo json_encode(["ok"=>true, "data"=>$row]);

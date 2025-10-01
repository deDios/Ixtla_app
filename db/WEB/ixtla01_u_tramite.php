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

$id              = (int)$input['id'];
$departamento_id = isset($input['departamento_id']) ? (int)$input['departamento_id'] : null;
$nombre          = $input['nombre']        ?? null;
$descripcion     = $input['descripcion']   ?? null;
$estatus         = isset($input['estatus']) ? (int)$input['estatus'] : null;
$updated_by      = isset($input['updated_by']) ? (int)$input['updated_by'] : null;

$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar"]));
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

/* (Opcional) validar departamento si viene en la actualización */
if ($departamento_id !== null) {
  $val = $con->prepare("SELECT 1 FROM departamento WHERE id=? LIMIT 1");
  $val->bind_param("i", $departamento_id);
  $val->execute();
  if (!$val->get_result()->fetch_row()) {
    http_response_code(400);
    echo json_encode(["ok"=>false,"error"=>"El departamento_id no existe"]); 
    $val->close(); $con->close(); exit;
  }
  $val->close();
}

$sql = "UPDATE tramite SET
          departamento_id = COALESCE(?, departamento_id),
          nombre          = COALESCE(?, nombre),
          descripcion     = COALESCE(?, descripcion),
          estatus         = COALESCE(?, estatus),
          updated_by      = COALESCE(?, updated_by),
          updated_at      = CURRENT_TIMESTAMP
        WHERE id = ?";

$st = $con->prepare($sql);
$st->bind_param("issiii", $departamento_id, $nombre, $descripcion, $estatus, $updated_by, $id);

if (!$st->execute()) {
  $err = $st->error; $code = $st->errno;
  $st->close(); $con->close();
  if ($code == 1062) { // dup UK dep+nombre
    http_response_code(409);
    die(json_encode(["ok"=>false,"error"=>"Ya existe un trámite con ese nombre en ese departamento"]));
  }
  http_response_code(500);
  die(json_encode(["ok"=>false,"error"=>"Error al actualizar: $err"]));
}
$st->close();

/* Devolver registro actualizado */
$q = $con->prepare("
  SELECT t.*, d.nombre AS departamento_nombre
  FROM tramite t
  JOIN departamento d ON d.id = t.departamento_id
  WHERE t.id=? LIMIT 1
");
$q->bind_param("i", $id);
$q->execute();
$row = $q->get_result()->fetch_assoc();
$q->close(); $con->close();

if (!$row) { echo json_encode(["ok"=>false,"error"=>"No encontrado tras actualizar"]); exit; }

$row['id'] = (int)$row['id'];
$row['departamento_id'] = (int)$row['departamento_id'];
$row['estatus'] = (int)$row['estatus'];

echo json_encode(["ok"=>true,"data"=>$row]);

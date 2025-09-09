<?php
header('Content-Type: application/json');
date_default_timezone_set('America/Mexico_City');

$path = realpath("/home/site/wwwroot/db/conn/conexion.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php en $path"])); }

$input = json_decode(file_get_contents("php://input"), true) ?? [];

$required = ['departamento_id','nombre','descripcion'];
foreach ($required as $k) {
  if (!isset($input[$k]) || $input[$k] === '') {
    http_response_code(400);
    die(json_encode(["ok"=>false,"error"=>"Falta parámetro obligatorio: $k"]));
  }
}

$departamento_id = (int)$input['departamento_id'];
$nombre          = trim($input['nombre']);
$descripcion     = trim($input['descripcion']);
$estatus         = isset($input['estatus']) ? (int)$input['estatus'] : 1; // 1=activo
$created_by      = isset($input['created_by']) ? (int)$input['created_by'] : null;

$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]));
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

/* (Opcional) validar existencia del departamento para mensaje más claro */
$val = $con->prepare("SELECT 1 FROM departamento WHERE id=? LIMIT 1");
$val->bind_param("i", $departamento_id);
$val->execute();
if (!$val->get_result()->fetch_row()) {
  http_response_code(400);
  echo json_encode(["ok"=>false,"error"=>"El departamento_id no existe"]); 
  $val->close(); $con->close(); exit;
}
$val->close();

$sql = "INSERT INTO tramite (departamento_id, nombre, descripcion, estatus, created_by)
        VALUES (?,?,?,?,?)";
$stmt = $con->prepare($sql);
$stmt->bind_param("issii", $departamento_id, $nombre, $descripcion, $estatus, $created_by);

if (!$stmt->execute()) {
  $err = $stmt->error;
  $code = $stmt->errno;
  $stmt->close(); $con->close();
  // 1062 = duplicate key (por UK departamento_id+nombre)
  if ($code == 1062) {
    http_response_code(409);
    die(json_encode(["ok"=>false,"error"=>"Ya existe un trámite con ese nombre en ese departamento"]));
  }
  http_response_code(500);
  die(json_encode(["ok"=>false,"error"=>"Error al insertar: $err"]));
}

$new_id = $stmt->insert_id;
$stmt->close();

/* Devolver registro insertado */
$q = $con->prepare("
  SELECT t.*, d.nombre AS departamento_nombre
  FROM tramite t
  JOIN departamento d ON d.id = t.departamento_id
  WHERE t.id=? LIMIT 1
");
$q->bind_param("i", $new_id);
$q->execute();
$row = $q->get_result()->fetch_assoc();
$q->close(); $con->close();

$row['id'] = (int)$row['id'];
$row['departamento_id'] = (int)$row['departamento_id'];
$row['estatus'] = (int)$row['estatus'];

echo json_encode(["ok"=>true,"data"=>$row]);

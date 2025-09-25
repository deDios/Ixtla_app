<?php
header('Content-Type: application/json');
date_default_timezone_set('America/Mexico_City');

$path = realpath("/home/site/wwwroot/db/conn/conexion.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php en $path"])); }

$in = json_decode(file_get_contents("php://input"), true) ?? [];

/* Requeridos mínimos */
$required = ['nombre','mensaje'];
foreach ($required as $k) {
  if (!isset($in[$k]) || trim($in[$k])==='') {
    http_response_code(400);
    die(json_encode(["ok"=>false,"error"=>"Falta parámetro obligatorio: $k"]));
  }
}

/* Inputs */
$nombre        = trim($in['nombre']);
$apellidos     = isset($in['apellidos']) ? trim($in['apellidos']) : null;
$email         = isset($in['email']) ? trim($in['email']) : null;
$telefono      = isset($in['telefono']) ? trim($in['telefono']) : null;
$asunto        = isset($in['asunto']) ? trim($in['asunto']) : null;
$mensaje       = trim($in['mensaje']);

$estatus       = isset($in['estatus']) ? (int)$in['estatus'] : 0;  // 0 nuevo
$canal         = isset($in['canal'])   ? (int)$in['canal']   : 1;  // 1 Web
$origen_ip     = $in['origen_ip']  ?? ($_SERVER['REMOTE_ADDR'] ?? null);
$user_agent    = $in['user_agent'] ?? ($_SERVER['HTTP_USER_AGENT'] ?? null);
$status        = isset($in['status']) ? (int)$in['status'] : 1;
$created_by    = isset($in['created_by']) ? (int)$in['created_by'] : null;

$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]));
$con->set_charset('utf8mb4');

/* INSERT */
$sql = "INSERT INTO contacto_duda (
  nombre, apellidos, email, telefono, asunto, mensaje,
  estatus, canal, origen_ip, user_agent, status, created_by
) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)";

$stmt = $con->prepare($sql);
$stmt->bind_param(
  "ssssss i i ss i i",
  // ↑ solo referencia visual; abajo va sin espacios:
  // "ssssssiissii"
  $nombre, $apellidos, $email, $telefono, $asunto, $mensaje,
  $estatus, $canal, $origen_ip, $user_agent, $status, $created_by
);
// string real de tipos:
$stmt->bind_param(
  "ssssssiissii",
  $nombre, $apellidos, $email, $telefono, $asunto, $mensaje,
  $estatus, $canal, $origen_ip, $user_agent, $status, $created_by
);

if (!$stmt->execute()) {
  $err=$stmt->error; $code=$stmt->errno;
  $stmt->close(); $con->close();
  // 3819/4025 -> CHECK (estatus/canal)
  if ($code==3819 || $code==4025) { http_response_code(400); die(json_encode(["ok"=>false,"error"=>"Valor inválido en estatus/canal","code"=>$code])); }
  http_response_code(500); die(json_encode(["ok"=>false,"error"=>"Error al insertar: $err","code"=>$code]));
}

$new_id = $stmt->insert_id;
$stmt->close();

/* Regresar registro */
$q = $con->prepare("SELECT * FROM contacto_duda WHERE id=? LIMIT 1");
$q->bind_param("i", $new_id);
$q->execute();
$res = $q->get_result()->fetch_assoc();
$q->close(); $con->close();

$res['id']=(int)$res['id']; $res['estatus']=(int)$res['estatus']; $res['canal']=(int)$res['canal']; $res['status']=(int)$res['status'];
http_response_code(201);
echo json_encode(["ok"=>true,"data"=>$res]);

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
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php en $path"])); }

$in = json_decode(file_get_contents("php://input"), true) ?? [];
if (!isset($in['id']) || (int)$in['id']<=0) {
  http_response_code(400); die(json_encode(["ok"=>false,"error"=>"Falta parámetro obligatorio: id"]));
}

$id          = (int)$in['id'];
$nombre      = array_key_exists('nombre',$in) ? trim($in['nombre']) : null;
$apellidos   = array_key_exists('apellidos',$in) ? trim($in['apellidos']) : null;
$email       = array_key_exists('email',$in) ? trim($in['email']) : null;
$telefono    = array_key_exists('telefono',$in) ? trim($in['telefono']) : null;
$asunto      = array_key_exists('asunto',$in) ? trim($in['asunto']) : null;
$mensaje     = array_key_exists('mensaje',$in) ? trim($in['mensaje']) : null;

$estatus     = array_key_exists('estatus',$in) ? (int)$in['estatus'] : null;
$canal       = array_key_exists('canal',$in) ? (int)$in['canal'] : null;
$origen_ip   = array_key_exists('origen_ip',$in) ? trim($in['origen_ip']) : null;
$user_agent  = array_key_exists('user_agent',$in) ? trim($in['user_agent']) : null;
$status      = array_key_exists('status',$in) ? (int)$in['status'] : null;
$updated_by  = array_key_exists('updated_by',$in) ? (int)$in['updated_by'] : null;

$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]));
$con->set_charset('utf8mb4');

/* SET dinámico */
$set=[]; $types=""; $params=[];
if ($nombre !== null)     { $set[]="nombre=?";      $types.="s"; $params[]=&$nombre; }
if ($apellidos !== null)  { $set[]="apellidos=?";   $types.="s"; $params[]=&$apellidos; }
if ($email !== null)      { $set[]="email=?";       $types.="s"; $params[]=&$email; }
if ($telefono !== null)   { $set[]="telefono=?";    $types.="s"; $params[]=&$telefono; }
if ($asunto !== null)     { $set[]="asunto=?";      $types.="s"; $params[]=&$asunto; }
if ($mensaje !== null)    { $set[]="mensaje=?";     $types.="s"; $params[]=&$mensaje; }
if ($estatus !== null)    { $set[]="estatus=?";     $types.="i"; $params[]=&$estatus; }
if ($canal !== null)      { $set[]="canal=?";       $types.="i"; $params[]=&$canal; }
if ($origen_ip !== null)  { $set[]="origen_ip=?";   $types.="s"; $params[]=&$origen_ip; }
if ($user_agent !== null) { $set[]="user_agent=?";  $types.="s"; $params[]=&$user_agent; }
if ($status !== null)     { $set[]="status=?";      $types.="i"; $params[]=&$status; }
if ($updated_by !== null) { $set[]="updated_by=?";  $types.="i"; $params[]=&$updated_by; }

if (!$set) { $con->close(); echo json_encode(["ok"=>true,"msg"=>"Nada por actualizar"]); exit; }

$sql = "UPDATE contacto_duda SET ".implode(", ", $set)." WHERE id=?";
$types.="i"; $params[]=&$id;

$stmt = $con->prepare($sql);
call_user_func_array([$stmt,'bind_param'], array_merge([$types], $params));
if (!$stmt->execute()) {
  $err=$stmt->error; $code=$stmt->errno;
  $stmt->close(); $con->close();
  if ($code==3819 || $code==4025) { http_response_code(400); die(json_encode(["ok"=>false,"error"=>"Valor inválido en estatus/canal","code"=>$code])); }
  http_response_code(500); die(json_encode(["ok"=>false,"error"=>"Error al actualizar: $err","code"=>$code]));
}
$stmt->close();

/* Devuelve registro actualizado */
$q=$con->prepare("SELECT * FROM contacto_duda WHERE id=? LIMIT 1");
$q->bind_param("i", $id);
$q->execute();
$res=$q->get_result()->fetch_assoc();
$q->close(); $con->close();

if (!$res) { http_response_code(404); die(json_encode(["ok"=>false,"error"=>"No encontrado"])); }
$res['id']=(int)$res['id']; $res['estatus']=(int)$res['estatus']; $res['canal']=(int)$res['canal']; $res['status']=(int)$res['status'];

echo json_encode(["ok"=>true,"data"=>$res]);

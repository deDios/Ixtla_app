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
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php en $path"])); }

$in = json_decode(file_get_contents("php://input"), true) ?? [];
if (!isset($in['id']) || (int)$in['id']<=0) {
  http_response_code(400); die(json_encode(["ok"=>false,"error"=>"Falta parámetro obligatorio: id"]));
}

$id           = (int)$in['id'];
$titulo       = array_key_exists('titulo',$in) ? trim($in['titulo']) : null;
$descripcion  = array_key_exists('descripcion',$in) ? trim($in['descripcion']) : null;
$fecha_evento = array_key_exists('fecha_evento',$in) ? (trim($in['fecha_evento'])!=='' ? trim($in['fecha_evento']) : null) : null;
$estatus      = array_key_exists('estatus',$in) ? (int)$in['estatus'] : null;
$status       = array_key_exists('status',$in) ? (int)$in['status'] : null;
$updated_by   = array_key_exists('updated_by',$in) ? (int)$in['updated_by'] : null;

$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]));
$con->set_charset('utf8mb4');

$set=[]; $types=""; $params=[];
if ($titulo !== null)      { $set[]="titulo=?";       $types.="s"; $params[]=&$titulo; }
if ($descripcion !== null) { $set[]="descripcion=?";  $types.="s"; $params[]=&$descripcion; }
if (array_key_exists('fecha_evento',$in)) { $set[]="fecha_evento=?"; $types.="s"; $params[]=&$fecha_evento; }
if ($estatus !== null)     { $set[]="estatus=?";      $types.="i"; $params[]=&$estatus; }
if ($status !== null)      { $set[]="status=?";       $types.="i"; $params[]=&$status; }
if ($updated_by !== null)  { $set[]="updated_by=?";   $types.="i"; $params[]=&$updated_by; }

if (!$set) { $con->close(); echo json_encode(["ok"=>true,"msg"=>"Nada por actualizar"]); exit; }

$sql = "UPDATE noticia SET ".implode(", ", $set)." WHERE id=?";
$types.="i"; $params[]=&$id;

$stmt = $con->prepare($sql);
call_user_func_array([$stmt,'bind_param'], array_merge([$types], $params));
if (!$stmt->execute()) {
  $code=$stmt->errno; $err=$stmt->error;
  $stmt->close(); $con->close();
  if ($code == 3819 || $code == 4025) { http_response_code(400); die(json_encode(["ok"=>false,"error"=>"Valor de 'estatus' inválido","code"=>$code])); }
  http_response_code(500); die(json_encode(["ok"=>false,"error"=>"Error al actualizar: $err","code"=>$code]));
}
$stmt->close();

/* Devuelve registro actualizado */
$q = $con->prepare("SELECT * FROM noticia WHERE id=? LIMIT 1");
$q->bind_param("i",$id);
$q->execute();
$res = $q->get_result()->fetch_assoc();
$q->close(); $con->close();

if (!$res) { http_response_code(404); die(json_encode(["ok"=>false,"error"=>"No encontrado"])); }
$res['id']=(int)$res['id']; $res['estatus']=(int)$res['estatus']; $res['status']=(int)$res['status'];
echo json_encode(["ok"=>true,"data"=>$res]);

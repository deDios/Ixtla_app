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

$path = realpath("/home/site/wwwroot/db/conn/conexion.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php en $path"])); }

$in = json_decode(file_get_contents("php://input"), true) ?? [];
if (!isset($in['id']) || (int)$in['id']<=0) {
  http_response_code(400); die(json_encode(["ok"=>false,"error"=>"Falta parámetro obligatorio: id"]));
}
$id         = (int)$in['id'];
$cp         = array_key_exists('cp',$in) ? trim($in['cp']) : null;
$colonia    = array_key_exists('colonia',$in) ? trim($in['colonia']) : null;
$estatus    = array_key_exists('estatus',$in) ? (int)$in['estatus'] : null;
$updated_by = array_key_exists('updated_by',$in) ? (int)$in['updated_by'] : null;

$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]));
$con->set_charset('utf8mb4');

/* Construir SET dinámico */
$set = []; $types=""; $params=[];
if ($cp !== null)      { $set[]="cp=?";       $types.="s"; $params[]=&$cp; }
if ($colonia !== null) { $set[]="colonia=?";  $types.="s"; $params[]=&$colonia; }
if ($estatus !== null) { $set[]="estatus=?";  $types.="i"; $params[]=&$estatus; }
if ($updated_by !== null) { $set[]="updated_by=?"; $types.="i"; $params[]=&$updated_by; }
/* updated_at se actualiza solo por ON UPDATE */

if (!$set) { $con->close(); echo json_encode(["ok"=>true,"msg"=>"Nada por actualizar"]); exit; }

$sql = "UPDATE cp_colonia SET ".implode(", ", $set)." WHERE id=?";
$types.="i"; $params[]=&$id;

$stmt = $con->prepare($sql);
call_user_func_array([$stmt,'bind_param'], array_merge([$types], $params));
if (!$stmt->execute()) {
  $code = $stmt->errno; $err = $stmt->error;
  $stmt->close(); $con->close();
  if ($code == 1062) { http_response_code(409); die(json_encode(["ok"=>false,"error"=>"Ya existe ese par cp+colonia"])); }
  if ($code == 3819 || $code == 4025) { http_response_code(400); die(json_encode(["ok"=>false,"error"=>"Formato de CP inválido"])); }
  http_response_code(500); die(json_encode(["ok"=>false,"error"=>"Error al actualizar: $err","code"=>$code]));
}
$stmt->close();

/* Devolver registro actualizado */
$q = $con->prepare("SELECT * FROM cp_colonia WHERE id=? LIMIT 1");
$q->bind_param("i",$id);
$q->execute();
$res = $q->get_result()->fetch_assoc();
$q->close(); $con->close();

if (!$res) { http_response_code(404); die(json_encode(["ok"=>false,"error"=>"No encontrado"])); }
$res['id']=(int)$res['id']; $res['estatus']=(int)$res['estatus'];
echo json_encode(["ok"=>true,"data"=>$res]);

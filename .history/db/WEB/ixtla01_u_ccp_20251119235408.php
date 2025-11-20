<?php
// u_ccp.php  (update comentario_cancelacion_pausa; soft delete con status=0)
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === 'https://ixtla-app.com' || $origin === 'https://www.ixtla-app.com') {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400");
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

header('Content-Type: application/json'); date_default_timezone_set('America/Mexico_City');
$method = $_SERVER['REQUEST_METHOD'] ?? ''; if ($method!=='PUT' && $method!=='PATCH') { http_response_code(405); echo json_encode(["ok"=>false,"error"=>"Usa PUT o PATCH"]); exit; }

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conn_db.php en $path"])); }

$in = json_decode(file_get_contents("php://input"), true) ?? [];

$id         = isset($in['id']) ? (int)$in['id'] : null;
$updated_by = isset($in['updated_by']) ? (int)$in['updated_by'] : null;

$set = []; $types=""; $params=[];

if (array_key_exists('empleado_id',$in)) { $empleado_id = ($in['empleado_id']!=='' && $in['empleado_id']!==null)?(int)$in['empleado_id']:null; $set[]="empleado_id=?"; $types.="i"; $params[]=&$empleado_id; }
if (array_key_exists('tipo',$in)) { $tipo=(int)$in['tipo']; if(!in_array($tipo,[1,2],true)){ http_response_code(422); echo json_encode(["ok"=>false,"error"=>"tipo debe ser 1 o 2"]); exit; } $set[]="tipo=?"; $types.="i"; $params[]=&$tipo; }
if (array_key_exists('comentario',$in)) { $comentario = trim((string)$in['comentario']); $set[]="comentario=?"; $types.="s"; $params[]=&$comentario; }
if (array_key_exists('status',$in)) { $status=(int)$in['status']; $set[]="status=?"; $types.="i"; $params[]=&$status; } // 0 = borrado lógico

if (!$id || !$updated_by) { http_response_code(400); echo json_encode(["ok"=>false,"error"=>"Faltan id y/o updated_by"]); exit; }

$set[]="updated_by=?"; $types.="i"; $params[]=&$updated_by;

$sql = "UPDATE comentario_cancelacion_pausa SET ".implode(", ",$set)." WHERE id=?";
$types.="i"; $params[]=&$id;

$con = conectar(); if (!$con) { echo json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]); exit; }
$con->set_charset('utf8mb4');

$stmt = $con->prepare($sql);
call_user_func_array([$stmt,'bind_param'], array_merge([$types], $params));
if (!$stmt->execute()) { http_response_code(500); echo json_encode(["ok"=>false,"error"=>"No se pudo actualizar"]); $stmt->close(); $con->close(); exit; }
$affected = $stmt->affected_rows; $stmt->close();

/* traer registro actualizado */
$q = $con->prepare("SELECT * FROM comentario_cancelacion_pausa WHERE id=? LIMIT 1");
$q->bind_param("i",$id); $q->execute(); $row = $q->get_result()->fetch_assoc(); $q->close(); $con->close();

if (!$row) { http_response_code(404); echo json_encode(["ok"=>false,"error"=>"No encontrado"]); exit; }
echo json_encode(["ok"=>true,"data"=>$row,"meta"=>["affected_rows"=>$affected]]);

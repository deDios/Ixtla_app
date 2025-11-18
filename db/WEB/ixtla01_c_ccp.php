<?php
// c_ccp.php  (consulta comentario_cancelacion_pausa)
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === 'https://ixtla-app.com' || $origin === 'https://www.ixtla-app.com') {
  header("Access-Control-Allow-Origin: $origin"); header("Vary: Origin");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400");
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

header('Content-Type: application/json'); date_default_timezone_set('America/Mexico_City');

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conn_db.php en $path"])); }

$in = json_decode(file_get_contents("php://input"), true) ?? [];
$id               = isset($in['id']) ? (int)$in['id'] : null;
$requerimiento_id = isset($in['requerimiento_id']) ? (int)$in['requerimiento_id'] : null;
$empleado_id      = isset($in['empleado_id']) ? (int)$in['empleado_id'] : null;
$tipo             = isset($in['tipo']) ? (int)$in['tipo'] : null;     // 1,2
$status           = isset($in['status']) ? (int)$in['status'] : null; // 1 activo, 0 borrado

$page = isset($in['page']) ? max(1,(int)$in['page']) : 1;
$per  = isset($in['per_page']) ? max(1,min(200,(int)$in['per_page'])) : 50;
$off  = ($page-1)*$per;

$con = conectar(); if (!$con) { echo json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]); exit; }
$con->set_charset('utf8mb4');

/* Detalle por id */
if ($id) {
  $q = $con->prepare("SELECT * FROM comentario_cancelacion_pausa WHERE id=? LIMIT 1");
  $q->bind_param("i",$id); $q->execute(); $row = $q->get_result()->fetch_assoc(); $q->close(); $con->close();
  if (!$row) { http_response_code(404); echo json_encode(["ok"=>false,"error"=>"No encontrado"]); exit; }
  echo json_encode(["ok"=>true,"data"=>$row]); exit;
}

/* Listado */
$where=[]; $types=""; $params=[];
if ($requerimiento_id !== null) { $where[]="requerimiento_id=?"; $types.="i"; $params[]=&$requerimiento_id; }
if ($empleado_id !== null)      { $where[]="empleado_id=?";      $types.="i"; $params[]=&$empleado_id; }
if ($tipo !== null)             { $where[]="tipo=?";             $types.="i"; $params[]=&$tipo; }
if ($status !== null)           { $where[]="status=?";           $types.="i"; $params[]=&$status; }

$sql = "SELECT SQL_CALC_FOUND_ROWS * FROM comentario_cancelacion_pausa";
if ($where) $sql .= " WHERE ".implode(" AND ", $where);
$sql .= " ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?";
$types.="ii"; $params[]=&$per; $params[]=&$off;

$st = $con->prepare($sql);
call_user_func_array([$st,'bind_param'], array_merge([$types], $params));
$st->execute();
$rs = $st->get_result(); $rows=[];
while ($r = $rs->fetch_assoc()) $rows[] = $r;
$st->close();

$total = (int)($con->query("SELECT FOUND_ROWS() AS t")->fetch_assoc()['t'] ?? 0);
$con->close();

echo json_encode(["ok"=>true,"meta"=>["page"=>$page,"per_page"=>$per,"total"=>$total],"data"=>$rows], JSON_UNESCAPED_UNICODE);

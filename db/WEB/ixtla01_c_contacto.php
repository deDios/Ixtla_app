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


$id        = isset($in['id']) ? (int)$in['id'] : null;
$q         = isset($in['q']) ? trim($in['q']) : null;
$email     = isset($in['email']) ? trim($in['email']) : null;
$estatus   = isset($in['estatus']) ? (int)$in['estatus'] : null;
$canal     = isset($in['canal']) ? (int)$in['canal'] : null;
$status    = isset($in['status']) ? (int)$in['status'] : null;
$date_from = isset($in['date_from']) && trim($in['date_from'])!=='' ? trim($in['date_from']) : null;
$date_to   = isset($in['date_to'])   && trim($in['date_to'])  !=='' ? trim($in['date_to'])   : null;

$page      = isset($in['page']) ? max(1,(int)$in['page']) : 1;
$pageSize  = isset($in['page_size']) ? max(1,min(500,(int)$in['page_size'])) : 50;
$offset    = ($page-1)*$pageSize;

$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]));
$con->set_charset('utf8mb4');

/* 1) Por id */
if ($id) {
  $q1 = $con->prepare("SELECT * FROM contacto_duda WHERE id=? LIMIT 1");
  $q1->bind_param("i", $id);
  $q1->execute();
  $row = $q1->get_result()->fetch_assoc();
  $q1->close(); $con->close();

  if (!$row) { echo json_encode(["ok"=>false,"error"=>"No encontrado"]); exit; }
  $row['id']=(int)$row['id']; $row['estatus']=(int)$row['estatus']; $row['canal']=(int)$row['canal']; $row['status']=(int)$row['status'];
  echo json_encode(["ok"=>true,"data"=>$row]); exit;
}

/* 2) Listado con filtros */
$where=[]; $types=""; $params=[];
if ($q!==null && $q!=='') {
  $like = "%".$q."%";
  $where[]="(nombre LIKE ? OR apellidos LIKE ? OR asunto LIKE ? OR mensaje LIKE ?)";
  $types.="ssss"; $params[]=&$like; $params[]=&$like; $params[]=&$like; $params[]=&$like;
}
if ($email!==null && $email!=='') { $where[]="email=?"; $types.="s"; $params[]=&$email; }
if ($estatus!==null) { $where[]="estatus=?"; $types.="i"; $params[]=&$estatus; }
if ($canal!==null)   { $where[]="canal=?";   $types.="i"; $params[]=&$canal; }
if ($status!==null)  { $where[]="status=?";  $types.="i"; $params[]=&$status; }
if ($date_from!==null) { $where[]="created_at >= ?"; $types.="s"; $params[]=&$date_from; }
if ($date_to!==null)   { $where[]="created_at <= ?"; $types.="s"; $params[]=&$date_to; }

$sql = "SELECT SQL_CALC_FOUND_ROWS * FROM contacto_duda";
if ($where) { $sql .= " WHERE ".implode(" AND ", $where); }
$sql .= " ORDER BY created_at DESC LIMIT ? OFFSET ?";
$types.="ii"; $params[]=&$pageSize; $params[]=&$offset;

$stmt=$con->prepare($sql);
call_user_func_array([$stmt,'bind_param'], array_merge([$types], $params));
$stmt->execute();
$rs=$stmt->get_result();

$data=[];
while ($r=$rs->fetch_assoc()) {
  $r['id']=(int)$r['id']; $r['estatus']=(int)$r['estatus']; $r['canal']=(int)$r['canal']; $r['status']=(int)$r['status'];
  $data[]=$r;
}
$stmt->close();

/* total */
$tot = $con->query("SELECT FOUND_ROWS() AS t")->fetch_assoc();
$total=(int)$tot['t'];
$con->close();

echo json_encode(["ok"=>true,"meta"=>["page"=>$page,"page_size"=>$pageSize,"total"=>$total],"data"=>$data]);

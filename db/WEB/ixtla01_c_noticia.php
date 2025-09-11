<?php
header('Content-Type: application/json');
date_default_timezone_set('America/Mexico_City');

$path = realpath("/home/site/wwwroot/db/conn/conexion.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php en $path"])); }

$in = json_decode(file_get_contents("php://input"), true) ?? [];

$id        = isset($in['id']) ? (int)$in['id'] : null;
$q         = isset($in['q']) ? trim($in['q']) : null;
$estatus   = isset($in['estatus']) ? (int)$in['estatus'] : null;
$status    = isset($in['status']) ? (int)$in['status'] : null;
$date_from = isset($in['date_from']) && trim($in['date_from'])!=='' ? trim($in['date_from']) : null; // 'YYYY-MM-DD'
$date_to   = isset($in['date_to'])   && trim($in['date_to'])!==''   ? trim($in['date_to'])   : null;

$all       = isset($in['all']) ? (int)$in['all'] : 0;
$page      = isset($in['page']) ? max(1,(int)$in['page']) : 1;
$pageSize  = isset($in['page_size']) ? max(1,min(500,(int)$in['page_size'])) : 50;
$offset    = ($page-1)*$pageSize;

$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]));
$con->set_charset('utf8mb4');

/* 1) Por id */
if ($id) {
  $q1 = $con->prepare("SELECT * FROM noticia WHERE id=? LIMIT 1");
  $q1->bind_param("i", $id);
  $q1->execute();
  $row = $q1->get_result()->fetch_assoc();
  $q1->close(); $con->close();

  if (!$row) { echo json_encode(["ok"=>false,"error"=>"No encontrado"]); exit; }
  $row['id']=(int)$row['id']; $row['estatus']=(int)$row['estatus']; $row['status']=(int)$row['status'];
  echo json_encode(["ok"=>true,"data"=>$row]); exit;
}

/* 2) Listado con filtros */
$where=[]; $types=""; $params=[];

/* Texto: busca en título o descripción */
if ($q !== null && $q !== '') {
  $like = "%".$q."%";
  $where[] = "(titulo LIKE ? OR descripcion LIKE ?)";
  $types .= "ss"; $params[]=&$like; $params[]=&$like;
}

/* Estatus / status */
if ($estatus !== null) { $where[]="estatus=?"; $types.="i"; $params[]=&$estatus; }
if ($status  !== null) { $where[]="status=?";  $types.="i"; $params[]=&$status;  }

/* Rango de fechas (fecha_evento) */
if ($date_from !== null) { $where[]="(fecha_evento IS NOT NULL AND fecha_evento >= ?)"; $types.="s"; $params[]=&$date_from; }
if ($date_to   !== null) { $where[]="(fecha_evento IS NOT NULL AND fecha_evento <= ?)"; $types.="s"; $params[]=&$date_to; }

$sql = "SELECT SQL_CALC_FOUND_ROWS * FROM noticia";
if ($where) { $sql .= " WHERE ".implode(" AND ", $where); }
$sql .= " ORDER BY COALESCE(fecha_evento, '0000-00-00') DESC, created_at DESC LIMIT ? OFFSET ?";
$types .= "ii"; $params[]=&$pageSize; $params[]=&$offset;

$stmt = $con->prepare($sql);
call_user_func_array([$stmt,'bind_param'], array_merge([$types], $params));
$stmt->execute();
$rs = $stmt->get_result();

$data=[];
while ($r = $rs->fetch_assoc()) {
  $r['id']=(int)$r['id']; $r['estatus']=(int)$r['estatus']; $r['status']=(int)$r['status'];
  $data[]=$r;
}
$stmt->close();

/* total */
$tot = $con->query("SELECT FOUND_ROWS() AS t")->fetch_assoc();
$total = (int)$tot['t'];
$con->close();

echo json_encode(["ok"=>true,"meta"=>["page"=>$page,"page_size"=>$pageSize,"total"=>$total],"data"=>$data]);

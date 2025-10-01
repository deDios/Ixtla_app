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

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php en $path"])); }


$in = json_decode(file_get_contents("php://input"), true) ?? [];
$id      = isset($in['id']) ? (int)$in['id'] : null;
$cp      = isset($in['cp']) ? trim($in['cp']) : null;
$q       = isset($in['q'])  ? trim($in['q'])  : null;
$estatus = isset($in['estatus']) ? (int)$in['estatus'] : null;
$all     = isset($in['all']) ? (int)$in['all'] : 0;

$page     = isset($in['page']) ? max(1,(int)$in['page']) : 1;
$pageSize = isset($in['page_size']) ? max(1,min(500,(int)$in['page_size'])) : 100;
$offset   = ($page-1)*$pageSize;

$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]));
$con->set_charset('utf8mb4');

/* 1) Por id (uno) */
if ($id) {
  $q1 = $con->prepare("SELECT * FROM cp_colonia WHERE id=? LIMIT 1");
  $q1->bind_param("i",$id);
  $q1->execute();
  $row = $q1->get_result()->fetch_assoc();
  $q1->close(); $con->close();

  if (!$row) { echo json_encode(["ok"=>false,"error"=>"No encontrado"]); exit; }
  $row['id'] = (int)$row['id']; $row['estatus']=(int)$row['estatus'];
  echo json_encode(["ok"=>true,"data"=>$row]); exit;
}

/* 2) Armado dinámico para listas */
$where = [];
$params = [];
$types  = "";

/* Filtros */
if ($cp !== null && $cp !== '') { $where[] = "cp = ?"; $types.="s"; $params[]=&$cp; }
if ($q  !== null && $q  !== '') { $like = "%".$q."%"; $where[] = "colonia LIKE ?"; $types.="s"; $params[]=&$like; }
if ($estatus !== null)          { $where[] = "estatus = ?"; $types.="i"; $params[]=&$estatus; }

$sql = "SELECT SQL_CALC_FOUND_ROWS * FROM cp_colonia";
if ($where) { $sql .= " WHERE ".implode(" AND ", $where); }
$sql .= " ORDER BY cp, colonia LIMIT ? OFFSET ?";
$types .= "ii";
$params[]=&$pageSize; $params[]=&$offset;

$stmt = $con->prepare($sql);
call_user_func_array([$stmt, 'bind_param'], array_merge([$types], $params));
$stmt->execute();
$rs = $stmt->get_result();
$data = [];
while ($r = $rs->fetch_assoc()) {
  $r['id']=(int)$r['id']; $r['estatus']=(int)$r['estatus'];
  $data[]=$r;
}
$stmt->close();

/* total */
$tot = $con->query("SELECT FOUND_ROWS() AS t")->fetch_assoc();
$total = (int)$tot['t'];
$con->close();

echo json_encode([
  "ok"=>true,
  "meta"=>["page"=>$page,"page_size"=>$pageSize,"total"=>$total],
  "data"=>$data
]);

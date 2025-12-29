<?php
header('Content-Type: application/json');
require_once __DIR__.'/../conn/conn_db.php';
$con = conectar(); $con->set_charset('utf8mb4');

$depto = isset($_GET['departamento_id']) ? (int)$_GET['departamento_id'] : null;
$month = $_GET['month'] ?? '';

$where = [];
$params = []; $types = '';

if ($depto) { $where[] = "r.departamento_id = ?"; $types .= 'i'; $params[] = &$depto; }
if ($month && preg_match('/^\d{4}-\d{2}$/',$month)) {
  $where[] = "DATE_FORMAT(r.created_at,'%Y-%m') = ?";
  $types .= 's'; $params[] = &$month;
}

$sql = "SELECT r.tramite, COUNT(*) AS total
        FROM requerimiento r".
        ($where ? " WHERE ".implode(" AND ", $where) : "").
       " GROUP BY r.tramite
         ORDER BY total DESC";

$stmt = $con->prepare($sql);
if ($types) { call_user_func_array([$stmt,'bind_param'], array_merge([$types], $params)); }
$stmt->execute(); $rs = $stmt->get_result();

$out = [];
while ($row = $rs->fetch_assoc()) {
  $out[] = ["tramite"=>$row['tramite'], "total"=>(int)$row['total']];
}
echo json_encode(["data"=>$out]);

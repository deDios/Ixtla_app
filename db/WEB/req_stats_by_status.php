<?php
header('Content-Type: application/json');
require_once __DIR__.'/../conn/conn_db.php';
$con = conectar(); $con->set_charset('utf8mb4');

$depto = isset($_GET['departamento_id']) ? (int)$_GET['departamento_id'] : null;
$month = $_GET['month'] ?? ''; // YYYY-MM

$where = [];
$params = []; $types = '';

if ($depto) { $where[] = "r.departamento_id = ?"; $types .= 'i'; $params[] = &$depto; }
if ($month && preg_match('/^\d{4}-\d{2}$/',$month)) {
  $where[] = "DATE_FORMAT(r.created_at,'%Y-%m') = ?";
  $types .= 's'; $params[] = &$month;
}

$sql = "SELECT r.estatus, COUNT(*) as total
        FROM requerimiento r".
        ($where ? " WHERE ".implode(" AND ", $where) : "").
       " GROUP BY r.estatus";

$stmt = $con->prepare($sql);
if ($types) { call_user_func_array([$stmt,'bind_param'], array_merge([$types], $params)); }
$stmt->execute(); $rs = $stmt->get_result();

$map = array_fill(0,7,0);
while ($row = $rs->fetch_assoc()) { $map[(int)$row['estatus']] = (int)$row['total']; }
echo json_encode($map);

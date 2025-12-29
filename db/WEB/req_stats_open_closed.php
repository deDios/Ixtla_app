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

$openList  = "0,1,2,3,4";
$closedList= "5,6";

$sql = "SELECT
          SUM(CASE WHEN r.estatus IN ($openList)  THEN 1 ELSE 0 END) AS abiertos,
          SUM(CASE WHEN r.estatus IN ($closedList) THEN 1 ELSE 0 END) AS cerrados
        FROM requerimiento r".
        ($where ? " WHERE ".implode(" AND ", $where) : "");

$stmt = $con->prepare($sql);
if ($types) { call_user_func_array([$stmt,'bind_param'], array_merge([$types], $params)); }
$stmt->execute(); $row = $stmt->get_result()->fetch_assoc();

echo json_encode([
  "abiertos" => (int)($row['abiertos'] ?? 0),
  "cerrados" => (int)($row['cerrados'] ?? 0)
]);

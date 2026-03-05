<?php
// /db/web/req_stats_by_tramite_v2.php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = ['https://ixtla-app.com', 'https://www.ixtla-app.com'];

if (in_array($origin, $allowed, true)) { header("Access-Control-Allow-Origin: $origin"); header("Access-Control-Allow-Credentials: true"); header("Vary: Origin"); }
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept");
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; } else { http_response_code(500); die(json_encode(["ok"=>false])); }

$in = json_decode(file_get_contents("php://input"), true) ?: [];

$dept_id = isset($in['departamento_id']) && $in['departamento_id'] !== "" ? (int)$in['departamento_id'] : null;
$estatus = isset($in['estatus']) && $in['estatus'] !== "" && $in['estatus'] !== null ? (int)$in['estatus'] : null;

$monthInput = isset($in['month']) && $in['month'] !== "" ? $in['month'] : [];
$months = is_array($monthInput) ? $monthInput : explode(',', $monthInput);
$months = array_filter($months);

$con = conectar(); $con->set_charset('utf8mb4');

$where = ["r.status = 1"];
$types = ""; $params = [];

if ($dept_id !== null) { $where[] = "r.departamento_id = ?"; $types .= "i"; $params[] = &$dept_id; }
if ($estatus !== null) { $where[] = "r.estatus = ?"; $types .= "i"; $params[] = &$estatus; }

if (!empty($months)) {
    $placeholders = implode(',', array_fill(0, count($months), '?'));
    $where[] = "DATE_FORMAT(r.created_at, '%Y-%m') IN ($placeholders)";
    foreach ($months as &$m) { $types .= "s"; $params[] = &$m; }
}

$whereClause = implode(" AND ", $where);
$openList   = "0,1,2,3,4";
$closedList = "5,6";

$sql = "SELECT COALESCE(t.nombre, '—') AS tramite,
               SUM(CASE WHEN r.estatus IN ($openList) THEN 1 ELSE 0 END) AS abiertos,
               SUM(CASE WHEN r.estatus IN ($closedList) THEN 1 ELSE 0 END) AS cerrados,
               COUNT(*) AS total
        FROM requerimiento r
        LEFT JOIN tramite t ON t.id = r.tramite_id
        WHERE $whereClause
        GROUP BY COALESCE(t.nombre,'—') 
        ORDER BY total DESC, tramite ASC";

$stmt = $con->prepare($sql);
if ($types !== "") { call_user_func_array([$stmt, 'bind_param'], array_merge([$types], $params)); }
$stmt->execute();
$rs = $stmt->get_result();

$out = [];
while ($row = $rs->fetch_assoc()) {
  $out[] = [ "tramite" => $row["tramite"], "abiertos" => (int)$row["abiertos"], "cerrados" => (int)$row["cerrados"], "total" => (int)$row["total"] ];
}
$stmt->close(); $con->close();

echo json_encode(["ok"=>true, "data"=>$out]);
?>
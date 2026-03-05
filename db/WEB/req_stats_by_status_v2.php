<?php
// /db/web/req_stats_by_status_v2.php
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
$tramite = isset($in['tramite']) && $in['tramite'] !== "" && $in['tramite'] !== null ? $in['tramite'] : null;

$monthInput = isset($in['month']) && $in['month'] !== "" ? $in['month'] : [];
$months = is_array($monthInput) ? $monthInput : explode(',', $monthInput);
$months = array_filter($months);

$con = conectar(); $con->set_charset('utf8mb4');

$where = ["status = 1"];
$types = ""; $params = [];

if ($dept_id !== null) { $where[] = "departamento_id = ?"; $types .= "i"; $params[] = &$dept_id; }
if ($tramite !== null) { 
    $where[] = "tramite_id IN (SELECT id FROM tramite WHERE nombre = ?)"; 
    $types .= "s"; $params[] = &$tramite; 
}

if (!empty($months)) {
    $placeholders = implode(',', array_fill(0, count($months), '?'));
    $where[] = "DATE_FORMAT(created_at, '%Y-%m') IN ($placeholders)";
    foreach ($months as &$m) { $types .= "s"; $params[] = &$m; }
}

$whereClause = implode(" AND ", $where);

$sql = "SELECT estatus, COUNT(*) as total FROM requerimiento WHERE $whereClause GROUP BY estatus";

$stmt = $con->prepare($sql);
if ($types !== "") { call_user_func_array([$stmt, 'bind_param'], array_merge([$types], $params)); }
$stmt->execute(); 
$rs = $stmt->get_result();

$map = array_fill(0,7,0);
while ($row = $rs->fetch_assoc()) { $map[(int)$row['estatus']] = (int)$row['total']; }

$stmt->close(); $con->close();
echo json_encode($map);
?>
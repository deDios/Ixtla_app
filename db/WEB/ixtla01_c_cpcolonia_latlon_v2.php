<?php
// /db/web/ixtla01_c_cpcolonia_latlon_v2.php
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
$tramite = isset($in['tramite']) && $in['tramite'] !== "" && $in['tramite'] !== null ? $in['tramite'] : null;

$monthInput = isset($in['month']) && $in['month'] !== "" ? $in['month'] : [];
$months = is_array($monthInput) ? $monthInput : explode(',', $monthInput);
$months = array_filter($months);

$con = conectar(); $con->set_charset('utf8mb4');

$rWhere = ["r.status = 1"];
$rTypes = ""; $rParams = [];

if ($dept_id !== null) { $rWhere[] = "r.departamento_id = ?"; $rTypes .= "i"; $rParams[] = &$dept_id; }
if ($estatus !== null) { $rWhere[] = "r.estatus = ?"; $rTypes .= "i"; $rParams[] = &$estatus; }
if ($tramite !== null) { 
    $rWhere[] = "r.tramite_id IN (SELECT id FROM tramite WHERE nombre = ?)"; 
    $rTypes .= "s"; $rParams[] = &$tramite; 
}
if (!empty($months)) {
    $placeholders = implode(',', array_fill(0, count($months), '?'));
    $rWhere[] = "DATE_FORMAT(r.created_at, '%Y-%m') IN ($placeholders)";
    foreach ($months as &$m) { $rTypes .= "s"; $rParams[] = &$m; }
}

$whereClause = implode(" AND ", $rWhere);

// Subconsulta agrupada
$subSql = "SELECT r.contacto_cp, UPPER(TRIM(r.contacto_colonia)) AS col_norm, COUNT(*) AS total
           FROM requerimiento r WHERE $whereClause GROUP BY r.contacto_cp, col_norm";

// Join con el catálogo (Solo devolvemos donde sí hay datos)
$sql = "SELECT c.id, c.cp, c.colonia, c.lat, c.lon, t.total
        FROM cp_colonia c
        INNER JOIN ($subSql) t ON t.contacto_cp = c.cp AND t.col_norm = UPPER(TRIM(c.colonia))
        WHERE c.estatus = 1
        ORDER BY t.total DESC";

$stmt = $con->prepare($sql);
if ($rTypes !== "") { call_user_func_array([$stmt, 'bind_param'], array_merge([$rTypes], $rParams)); }
$stmt->execute();
$rs = $stmt->get_result();

$data = [];
while ($r = $rs->fetch_assoc()) {
  $data[] = [
    'id' => (int)$r['id'], 'cp' => $r['cp'], 'colonia' => $r['colonia'],
    'total' => (int)$r['total'], 'lat' => (float)$r['lat'], 'lon' => (float)$r['lon']
  ];
}

$stmt->close(); $con->close();
echo json_encode(["ok"=>true, "data"=>$data]);
?>
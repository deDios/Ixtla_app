<?php
// web/ixtla01_c_cpcolonia_latlon.php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === 'https://ixtla-app.com' || $origin === 'https://www.ixtla-app.com') {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
}
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400");
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

header('Content-Type: application/json');

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if (!$path || !file_exists($path)) { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conn_db.php"])); }
include $path;

$inRaw = file_get_contents("php://input");
$in    = json_decode($inRaw, true);
if (!is_array($in)) {
  // Soportar GET también (útil para pruebas)
  $in = [
    "departamento_id" => isset($_GET["departamento_id"]) ? (int)$_GET["departamento_id"] : null,
    "month"           => isset($_GET["month"]) ? trim($_GET["month"]) : null
  ];
}

$departamento_id = isset($in['departamento_id']) && $in['departamento_id'] !== '' ? (int)$in['departamento_id'] : null;
$month           = isset($in['month']) ? trim($in['month']) : null; // "YYYY-MM" o null

$con = conectar();
if (!$con) { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se pudo conectar a la BD"])); }
$con->set_charset('utf8mb4');

/*
  La unión usa:
  - r.contacto_cp    con c.cp
  - r.contacto_colonia = c.colonia (comparación insensible a mayúsculas/acentos)
  Si tu dato en requerimiento trae variantes, podemos relajar a sólo CP.
*/

$where = [];
$types = "";
$params = [];

// Filtro por departamento
if ($departamento_id !== null) {
  $where[] = "r.departamento_id = ?";
  $types  .= "i";
  $params[] = &$departamento_id;
}

// Filtro por mes YYYY-MM en created_at
if ($month) {
  // Primer y último día del mes
  $start = $month . "-01 00:00:00";
  $end   = date("Y-m-t 23:59:59", strtotime($month . "-01"));
  $where[] = "r.created_at BETWEEN ? AND ?";
  $types  .= "ss";
  $params[] = &$start;
  $params[] = &$end;
}

// Armado SQL
$sql = "
  SELECT
    c.cp,
    c.colonia,
    c.lat, c.lon,
    COUNT(*) AS total
  FROM requerimiento r
  JOIN cp_colonia c
    ON c.cp = r.contacto_cp
   AND c.colonia COLLATE utf8mb4_0900_ai_ci = r.contacto_colonia COLLATE utf8mb4_0900_ai_ci
";

if ($where) { $sql .= " WHERE " . implode(" AND ", $where); }

$sql .= "
  GROUP BY c.cp, c.colonia, c.lat, c.lon
  HAVING c.lat IS NOT NULL AND c.lon IS NOT NULL
  ORDER BY total DESC, c.cp, c.colonia
  LIMIT 10000
";

$stmt = $con->prepare($sql);
if ($types) {
  // bind variadic
  $bind = array_merge([$types], $params);
  call_user_func_array([$stmt, 'bind_param'], $bind);
}
$stmt->execute();
$rs = $stmt->get_result();

$data = [];
while ($r = $rs->fetch_assoc()) {
  $data[] = [
    "cp"      => $r["cp"],
    "colonia" => $r["colonia"],
    "lat"     => $r["lat"] !== null ? (float)$r["lat"] : null,
    "lon"     => $r["lon"] !== null ? (float)$r["lon"] : null,
    "total"   => (int)$r["total"]
  ];
}
$stmt->close();
$con->close();

echo json_encode(["ok"=>true, "data"=>$data]);

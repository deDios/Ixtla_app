<?php
// /db/web/req_stats_by_cpcolonia.php
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
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php en $path"])); }

$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]));
$con->set_charset('utf8mb4');

/**
 * Ajusta estos nombres/columnas a tu modelo real:
 * - TABLA_REQUERIMIENTOS: tabla fuente de requerimientos
 * - columnas: cp (char5), colonia (varchar), departamento_id (int), created_at/datetime
 */
define('TABLA_REQUERIMIENTOS', 'requerimiento'); // <-- cámbiala si tu tabla se llama distinto
$colCp    = 'cp';
$colCol   = 'colonia';
$colDept  = 'departamento_id';
$colFecha = 'created_at'; // fecha de creación (para filtrar por mes)

// Parámetros (acepta GET o POST JSON)
$in = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $body = json_decode(file_get_contents('php://input'), true);
  if (is_array($body)) $in = $body;
}
foreach ($_GET as $k=>$v) { $in[$k] = $v; }

$departamento_id = isset($in['departamento_id']) && $in['departamento_id'] !== '' ? (int)$in['departamento_id'] : null;
$month = isset($in['month']) ? trim($in['month']) : ''; // "YYYY-MM"

// Construcción dinámica
$where  = [];
$params = [];
$types  = '';

if ($departamento_id !== null) {
  $where[] = "$colDept = ?";
  $types  .= 'i';
  $params[] = &$departamento_id;
}

if ($month !== '') {
  // rango de mes: [YYYY-MM-01 , YYYY-MM-01 + 1 mes)
  $start = $month . '-01';
  // fin (primer día del mes siguiente)
  $end   = date('Y-m-d', strtotime($start . ' +1 month'));
  $where[] = "$colFecha >= ? AND $colFecha < ?";
  $types  .= 'ss';
  $params[] = &$start;
  $params[] = &$end;
}

/**
 * Normalizamos la clave de agrupación:
 * - Usamos colonia si viene no vacía; si no, usamos CP.
 * - Upper/trim para empatar con tu catálogo y el JS.
 */
$sql = "
  SELECT
    UPPER(TRIM(CASE
      WHEN $colCol IS NOT NULL AND $colCol <> '' THEN $colCol
      ELSE $colCp
    END)) AS colonia_key,
    MAX(NULLIF(TRIM($colCol), '')) AS colonia,
    MAX(NULLIF(TRIM($colCp),  '')) AS cp,
    COUNT(*) AS total
  FROM " . TABLA_REQUERIMIENTOS . "
";
if ($where) $sql .= " WHERE " . implode(" AND ", $where);
$sql .= " GROUP BY colonia_key ORDER BY total DESC";

$stmt = $con->prepare($sql);
if ($types !== '') {
  call_user_func_array([$stmt,'bind_param'], array_merge([$types], $params));
}
$stmt->execute();
$rs = $stmt->get_result();

$data = [];
while ($r = $rs->fetch_assoc()) {
  $data[] = [
    "colonia" => $r['colonia'] ?: $r['colonia_key'],
    "cp"      => $r['cp'] ?: null,
    "total"   => (int)$r['total']
  ];
}
$stmt->close();
$con->close();

echo json_encode([
  "ok"   => true,
  "data" => $data
]);

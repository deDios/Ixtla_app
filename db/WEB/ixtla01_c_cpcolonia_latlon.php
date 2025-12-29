<?php
// --- CORS básico ---
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

// --- Conexión ---
$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); echo json_encode(["ok"=>false,"error"=>"No se encontró conn_db.php en $path"]); exit; }

$con = conectar();
if (!$con) { http_response_code(500); echo json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]); exit; }
$con->set_charset('utf8mb4');

// --- Entrada: soporta GET y POST (útil para pruebas) ---
$in = [];
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'POST') {
  $in = json_decode(file_get_contents("php://input"), true) ?? [];
} else {
  $in['departamento_id'] = $_GET['departamento_id'] ?? null;
  $in['month']           = $_GET['month'] ?? null;         // "YYYY-MM" o vacío = todos
  $in['only_with_data']  = $_GET['only_with_data'] ?? null; // 1 = solo colonias con datos
  $in['page']            = $_GET['page'] ?? null;
  $in['page_size']       = $_GET['page_size'] ?? null;
  $in['debug']           = $_GET['debug'] ?? null;          // opcional
}
$debug = !empty($in['debug']);

// --- Normalización de filtros ---
$departamento_id = (isset($in['departamento_id']) && $in['departamento_id'] !== '' && $in['departamento_id'] !== null)
  ? (int)$in['departamento_id'] : null;

$rawMonth = isset($in['month']) ? trim((string)$in['month']) : '';
$month = ($rawMonth === '' || strtolower($rawMonth) === 'all' || $rawMonth === '*') ? null : $rawMonth;

$only_with_data = isset($in['only_with_data']) ? (int)$in['only_with_data'] : 0;
$page     = isset($in['page']) ? max(1,(int)$in['page']) : 1;
$pageSize = isset($in['page_size']) ? max(1,min(10000,(int)$in['page_size'])) : 10000;
$offset   = ($page-1)*$pageSize;

// --- Rango de fechas si month = YYYY-MM ---
$dateStart = null; $dateEnd = null;
if ($month && preg_match('/^\d{4}-\d{2}$/', $month)) {
  $dateStart = $month . "-01";
  $dt = DateTime::createFromFormat('Y-m-d', $dateStart);
  if ($dt) { $dt->modify('last day of this month'); $dateEnd = $dt->format('Y-m-d 23:59:59'); }
}

// --- WHERE del subquery (tabla requerimiento) ---
$rWhere = []; $rTypes = ''; $rBind = [];
if ($departamento_id !== null) { $rWhere[] = "r.departamento_id = ?"; $rTypes .= 'i'; $rBind[] = &$departamento_id; }
if ($dateStart && $dateEnd)    { $rWhere[] = "r.created_at BETWEEN ? AND ?"; $rTypes .= 'ss'; $rBind[] = &$dateStart; $rBind[] = &$dateEnd; }

// --- Subconsulta: totales por CP/colonia normalizada (COLUMNAS CORRECTAS) ---
$subSql =
  "SELECT
     r.contacto_cp,
     UPPER(TRIM(r.contacto_colonia)) AS col_norm,
     COUNT(*) AS total
   FROM requerimiento r" .
   (count($rWhere) ? " WHERE ".implode(" AND ", $rWhere) : "") .
  " GROUP BY r.contacto_cp, col_norm";

// --- Tipo de JOIN contra catálogo cp_colonia ---
// LEFT: todas las colonias del catálogo (sin datos = total 0)
// INNER: solo colonias con datos
$joinType = $only_with_data ? "INNER" : "LEFT";

// --- SELECT principal ---
$sql =
  "SELECT
     c.id, c.cp, c.colonia, c.lat, c.lon,
     COALESCE(t.total, 0) AS total
   FROM cp_colonia c
   $joinType JOIN ($subSql) t
     ON t.contacto_cp = c.cp
    AND t.col_norm = UPPER(TRIM(c.colonia))
   WHERE c.estatus = 1
   ORDER BY c.cp, c.colonia
   LIMIT ? OFFSET ?";

$stmt = $con->prepare($sql);
if (!$stmt) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"Prepare failed","sql_error"=>$con->error]);
  exit;
}

// --- Bind dinámico: primero los del subquery, luego paginación ---
$types = $rTypes . "ii";
$pageSizeI = (int)$pageSize; $offsetI = (int)$offset;

$params = []; 
$params[] = &$types;
foreach ($rBind as &$p) { $params[] = &$p; }
$params[] = &$pageSizeI; 
$params[] = &$offsetI;

if (!call_user_func_array([$stmt, 'bind_param'], $params)) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"bind_param failed"]);
  exit;
}

if (!$stmt->execute()) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"Execute failed","stmt_error"=>$stmt->error]);
  exit;
}

$rs = $stmt->get_result();
if ($rs === false) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"get_result() no disponible. Habilita mysqlnd o usa bind_result()."]);
  exit;
}

$data = [];
while ($r = $rs->fetch_assoc()) {
  $r['id']    = (int)$r['id'];
  $r['total'] = (int)$r['total'];
  $r['lat']   = isset($r['lat']) ? (float)$r['lat'] : null;
  $r['lon']   = isset($r['lon']) ? (float)$r['lon'] : null;
  $data[] = $r;
}
$stmt->close();

// --- Conteo total para paginación ---
$countSql =
  "SELECT COUNT(*) AS cnt
   FROM cp_colonia c
   $joinType JOIN ($subSql) t
     ON t.contacto_cp = c.cp
    AND t.col_norm = UPPER(TRIM(c.colonia))
   WHERE c.estatus = 1";

$cStmt = $con->prepare($countSql);
if (!$cStmt) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"Prepare count failed","sql_error"=>$con->error]);
  exit;
}
$cTypes = $rTypes; // mismos filtros del subquery
if ($cTypes) {
  $cParams = []; $cParams[] = &$cTypes;
  foreach ($rBind as &$p) { $cParams[] = &$p; }
  if (!call_user_func_array([$cStmt, 'bind_param'], $cParams)) {
    http_response_code(500);
    echo json_encode(["ok"=>false,"error"=>"bind_param count failed"]);
    exit;
  }
}
if (!$cStmt->execute()) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"Execute count failed","stmt_error"=>$cStmt->error]);
  exit;
}
$cRes = $cStmt->get_result();
$total = 0;
if ($cRes && ($row = $cRes->fetch_assoc())) { $total = (int)($row['cnt'] ?? 0); }
$cStmt->close();

$con->close();

// --- Salida ---
$out = [
  "ok"=>true,
  "meta"=>[
    "page"=>$page,
    "page_size"=>$pageSize,
    "total"=>$total,
    "filters"=>[
      "departamento_id"=>$departamento_id,
      "month"=>$month ?? "ALL",
      "only_with_data"=>$only_with_data
    ]
  ],
  "data"=>$data
];

// Modo debug opcional: devuelve también SQL renderizado (sin parámetros)
if ($debug) {
  $out["_debug"] = [
    "sql_main"  => $sql,
    "sql_count" => $countSql,
    "sub_sql"   => $subSql,
    "bind_types"=> $rTypes,
    "bind_vals" => array_map(function($x){ return is_scalar($x)?$x:'[ref]'; }, $rBind),
  ];
}

echo json_encode($out);

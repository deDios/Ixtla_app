<?php
// /db/web/ixtla01_c_cpcolonia_latlon_retro.php

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = ['https://ixtla-app.com', 'https://www.ixtla-app.com'];

if (in_array($origin, $allowed, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Access-Control-Allow-Credentials: true");
  header("Vary: Origin");
}

header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept");
header("Content-Type: application/json; charset=utf-8");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) {
  include $path;
} else {
  http_response_code(500);
  die(json_encode([
    "ok" => false,
    "error" => "No se encontró conn_db.php"
  ]));
}

$in = json_decode(file_get_contents("php://input"), true) ?: [];

/*
|--------------------------------------------------------------------------
| Filtros esperados
|--------------------------------------------------------------------------
| departamento_id : int|null
| estatus         : int|null   -> estatus del requerimiento
| tramite         : string|null
| month           : string|array|null  (ej: "2026-03" o ["2026-02","2026-03"])
| retro_status    : int|null   -> status de retro_ciudadana
| calificacion    : int|null   -> calificacion de retro_ciudadana
| req_status      : int|null   -> status lógico del requerimiento (default 1)
| search          : string|null
|--------------------------------------------------------------------------
*/

$dept_id       = isset($in['departamento_id']) && $in['departamento_id'] !== "" ? (int)$in['departamento_id'] : null;
$estatus       = isset($in['estatus']) && $in['estatus'] !== "" && $in['estatus'] !== null ? (int)$in['estatus'] : null;
$tramite       = isset($in['tramite']) && $in['tramite'] !== "" && $in['tramite'] !== null ? trim($in['tramite']) : null;

$retro_status  = isset($in['retro_status']) && $in['retro_status'] !== "" && $in['retro_status'] !== null ? (int)$in['retro_status'] : null;
$calificacion  = isset($in['calificacion']) && $in['calificacion'] !== "" && $in['calificacion'] !== null ? (int)$in['calificacion'] : null;

$search        = isset($in['search']) && $in['search'] !== "" && $in['search'] !== null
  ? trim($in['search'])
  : null;

/*
| req_status:
| status "activo" del requerimiento. Si no se manda, usamos 1 por default
| para replicar el comportamiento del dashboard actual.
*/
$req_status    = isset($in['req_status']) && $in['req_status'] !== "" && $in['req_status'] !== null ? (int)$in['req_status'] : 1;

$monthInput = isset($in['month']) && $in['month'] !== "" ? $in['month'] : [];
$months = is_array($monthInput) ? $monthInput : explode(',', $monthInput);
$months = array_values(array_filter(array_map('trim', $months)));

$con = conectar();
if (!$con) {
  http_response_code(500);
  die(json_encode([
    "ok" => false,
    "error" => "No se pudo conectar a la base de datos"
  ]));
}

$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

/* =========================
   ARMADO DINÁMICO DE WHERE
   ========================= */
$where = ["r.status = ?"];
$types = "i";
$params = [$req_status];

if ($dept_id !== null) {
  $where[] = "r.departamento_id = ?";
  $types .= "i";
  $params[] = $dept_id;
}

if ($estatus !== null) {
  $where[] = "r.estatus = ?";
  $types .= "i";
  $params[] = $estatus;
}

if ($tramite !== null) {
  $where[] = "r.tramite_id IN (SELECT id FROM tramite WHERE nombre = ?)";
  $types .= "s";
  $params[] = $tramite;
}

if ($retro_status !== null) {
  $where[] = "rc.status = ?";
  $types .= "i";
  $params[] = $retro_status;
}

if ($calificacion !== null) {
  $where[] = "rc.calificacion = ?";
  $types .= "i";
  $params[] = $calificacion;
}

if (!empty($months)) {
  $placeholders = implode(',', array_fill(0, count($months), '?'));
  $where[] = "DATE_FORMAT(r.created_at, '%Y-%m') IN ($placeholders)";
  foreach ($months as $m) {
    $types .= "s";
    $params[] = $m;
  }
}

if ($search !== null) {
  $where[] = "(
    CAST(r.id AS CHAR) LIKE ?
    OR COALESCE(r.contacto_telefono, '') LIKE ?
    OR COALESCE(r.contacto_colonia, '') LIKE ?
    OR COALESCE(tr.nombre, '') LIKE ?
    OR COALESCE(d.nombre, '') LIKE ?
    OR COALESCE(rc.comentario, '') LIKE ?
  )";

  $like = "%" . $search . "%";
  $types .= "ssssss";
  $params[] = $like;
  $params[] = $like;
  $params[] = $like;
  $params[] = $like;
  $params[] = $like;
  $params[] = $like;
}

$whereClause = implode(" AND ", $where);

/* =========================
   SUBCONSULTA AGRUPADA
   SOLO REQUERIMIENTOS CON RETRO
   ========================= */
$subSql = "
  SELECT
    r.contacto_cp,
    UPPER(TRIM(r.contacto_colonia)) AS col_norm,
    COUNT(*) AS total
  FROM retro_ciudadana rc
  INNER JOIN requerimiento r ON r.id = rc.requerimiento_id
  LEFT JOIN tramite tr ON tr.id = r.tramite_id
  LEFT JOIN departamento d ON d.id = r.departamento_id
  WHERE $whereClause
    AND r.contacto_cp IS NOT NULL
    AND r.contacto_cp <> ''
    AND r.contacto_colonia IS NOT NULL
    AND TRIM(r.contacto_colonia) <> ''
  GROUP BY r.contacto_cp, col_norm
";

/* =========================
   JOIN CON CATÁLOGO
   ========================= */
$sql = "
  SELECT
    c.id,
    c.cp,
    c.colonia,
    c.lat,
    c.lon,
    t.total
  FROM cp_colonia c
  INNER JOIN ($subSql) t
    ON t.contacto_cp = c.cp
   AND t.col_norm = UPPER(TRIM(c.colonia))
  WHERE c.estatus = 1
  ORDER BY t.total DESC
";

$stmt = $con->prepare($sql);

if (!$stmt) {
  http_response_code(500);
  die(json_encode([
    "ok" => false,
    "error" => "Error al preparar la consulta",
    "sql_error" => $con->error
  ]));
}

if ($types !== "") {
  $bindParams = [];
  $bindParams[] = $types;

  foreach ($params as $k => $v) {
    $bindParams[] = &$params[$k];
  }

  call_user_func_array([$stmt, 'bind_param'], $bindParams);
}

$stmt->execute();
$rs = $stmt->get_result();

$data = [];
while ($r = $rs->fetch_assoc()) {
  $data[] = [
    'id'      => (int)$r['id'],
    'cp'      => $r['cp'],
    'colonia' => $r['colonia'],
    'total'   => (int)$r['total'],
    'lat'     => (float)$r['lat'],
    'lon'     => (float)$r['lon']
  ];
}

$stmt->close();
$con->close();

echo json_encode([
  "ok" => true,
  "data" => $data
]);
?>
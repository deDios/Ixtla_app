<?php
// c_tarea_proceso.php
// Consulta tareas de proceso (detalle o listado filtrado/paginado)

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

$allowlist = [
  'https://ixtla-app.com',
  'https://www.ixtla-app.com',
];

if (in_array($origin, $allowlist, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Access-Control-Allow-Credentials: true");
  header("Vary: Origin");
}

header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400");

// Preflight
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('America/Mexico_City');

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method !== 'GET' && $method !== 'POST') {
  http_response_code(405);
  echo json_encode(["ok"=>false,"error"=>"Método no permitido, usa GET o POST"]);
  exit;
}

header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('America/Mexico_City');

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method !== 'GET' && $method !== 'POST') {
  http_response_code(405);
  echo json_encode(["ok"=>false,"error"=>"Método no permitido, usa GET o POST"]);
  exit;
}

// Conexión DB
$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }
else {
  http_response_code(500);
  die(json_encode(["ok"=>false,"error"=>"No se encontró conn_db.php en $path"]));
}

// Inputs
if ($method === 'GET') {
  $in = $_GET;
} else {
  $in = json_decode(file_get_contents("php://input"), true) ?? [];
}

$id          = isset($in['id']) ? (int)$in['id'] : null;
$proceso_id  = isset($in['proceso_id']) && $in['proceso_id'] !== '' ? (int)$in['proceso_id'] : null;
$asignado_a  = isset($in['asignado_a']) && $in['asignado_a'] !== '' ? (int)$in['asignado_a'] : null;
$status      = isset($in['status']) && $in['status'] !== '' ? (int)$in['status'] : null;
$date_from   = isset($in['date_from']) && trim($in['date_from'])!=='' ? trim($in['date_from']) : null;
$date_to     = isset($in['date_to'])   && trim($in['date_to'])  !=='' ? trim($in['date_to'])   : null;

$page     = isset($in['page']) ? max(1,(int)$in['page']) : 1;
$pageSize = isset($in['page_size']) ? max(1,min(500,(int)$in['page_size'])) : 50;
$offset   = ($page-1)*$pageSize;

$con = conectar();
if (!$con) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]);
  exit;
}
$con->set_charset('utf8mb4');


// =====================
// 1) Consulta individual
// =====================
if ($id) {
  $sqlOne = "
    SELECT
      t.id,
      t.proceso_id,
      t.asignado_a,
      e.nombre AS asignado_nombre,
      e.apellidos AS asignado_apellidos,
      t.titulo,
      t.descripcion,
      t.esfuerzo,
      t.fecha_inicio,
      t.fecha_fin,
      t.status,
      t.created_at,
      t.updated_at,
      t.created_by,
      t.updated_by
    FROM tarea_proceso t
    LEFT JOIN empleado e ON e.id = t.asignado_a
    WHERE t.id = ?
    LIMIT 1
  ";

  $q1 = $con->prepare($sqlOne);
  if (!$q1) {
    http_response_code(500);
    echo json_encode(["ok"=>false,"error"=>"Error en prepare"]);
    $con->close();
    exit;
  }

  $q1->bind_param("i", $id);
  $q1->execute();
  $row = $q1->get_result()->fetch_assoc();
  $q1->close();
  $con->close();

  if (!$row) {
    http_response_code(404);
    echo json_encode(["ok"=>false,"error"=>"No encontrado"]);
    exit;
  }

  $row['id']          = (int)$row['id'];
  $row['proceso_id']  = (int)$row['proceso_id'];
  $row['asignado_a']  = $row['asignado_a'] !== null ? (int)$row['asignado_a'] : null;
  $row['esfuerzo']    = (int)$row['esfuerzo'];
  $row['status']      = (int)$row['status'];
  $row['created_by']  = $row['created_by'] !== null ? (int)$row['created_by'] : null;
  $row['updated_by']  = $row['updated_by'] !== null ? (int)$row['updated_by'] : null;
  $row['asignado_display'] = trim(($row['asignado_nombre'] ?? '').' '.($row['asignado_apellidos'] ?? ''));

  echo json_encode(["ok"=>true,"data"=>$row]);
  exit;
}


// =====================
// 2) Listado filtrado
// =====================
$where  = [];
$types  = "";
$params = [];

// Filtrar por proceso
if ($proceso_id !== null) {
  $where[]  = "t.proceso_id = ?";
  $types   .= "i";
  $params[] =& $proceso_id;
}

// Filtrar por responsable
if ($asignado_a !== null) {
  $where[]  = "t.asignado_a = ?";
  $types   .= "i";
  $params[] =& $asignado_a;
}

// Filtrar por status (1=activa, 0=baja lógica)
if ($status !== null) {
  $where[]  = "t.status = ?";
  $types   .= "i";
  $params[] =& $status;
}

// Rango de creación
if ($date_from !== null) {
  $where[]  = "t.created_at >= ?";
  $types   .= "s";
  $params[] =& $date_from;
}

if ($date_to !== null) {
  $where[]  = "t.created_at <= ?";
  $types   .= "s";
  $params[] =& $date_to;
}

$sql = "
  SELECT SQL_CALC_FOUND_ROWS
    t.id,
    t.proceso_id,
    t.asignado_a,
    e.nombre AS asignado_nombre,
    e.apellidos AS asignado_apellidos,
    t.titulo,
    t.descripcion,
    t.esfuerzo,
    t.fecha_inicio,
    t.fecha_fin,
    t.status,
    t.created_at,
    t.updated_at,
    t.created_by,
    t.updated_by
  FROM tarea_proceso t
  LEFT JOIN empleado e ON e.id = t.asignado_a
";

if ($where) {
  $sql .= " WHERE ".implode(" AND ", $where);
}

// Orden cronológico por fecha_inicio si existe, si no por created_at
$sql .= " ORDER BY
            COALESCE(t.fecha_inicio, t.created_at) ASC
          LIMIT ? OFFSET ?";

$types   .= "ii";
$params[] =& $pageSize;
$params[] =& $offset;

$stmt = $con->prepare($sql);
if (!$stmt) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"Error en prepare"]);
  $con->close();
  exit;
}

call_user_func_array([$stmt,'bind_param'], array_merge([$types], $params));

$stmt->execute();
$rs = $stmt->get_result();

$data = [];
while ($r = $rs->fetch_assoc()) {
  $r['id']          = (int)$r['id'];
  $r['proceso_id']  = (int)$r['proceso_id'];
  $r['asignado_a']  = $r['asignado_a'] !== null ? (int)$r['asignado_a'] : null;
  $r['esfuerzo']    = (int)$r['esfuerzo'];
  $r['status']      = (int)$r['status'];
  $r['created_by']  = $r['created_by'] !== null ? (int)$r['created_by'] : null;
  $r['updated_by']  = $r['updated_by'] !== null ? (int)$r['updated_by'] : null;

  $r['asignado_display'] = trim(($r['asignado_nombre'] ?? '').' '.($r['asignado_apellidos'] ?? ''));
  $data[] = $r;
}
$stmt->close();

$tot   = $con->query("SELECT FOUND_ROWS() AS t")->fetch_assoc();
$total = isset($tot['t']) ? (int)$tot['t'] : 0;

$con->close();

echo json_encode([
  "ok"=>true,
  "meta"=>[
    "page"=>$page,
    "page_size"=>$pageSize,
    "total"=>$total
  ],
  "data"=>$data
]);

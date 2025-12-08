<?php
// c_proceso_requerimiento.php
// Consulta de proceso_requerimiento (detalle o listado filtrado/paginado)

/* ===== CORS (poner literalmente al inicio del archivo) ===== */
$origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
$method  = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$ALLOWED = ['https://ixtla-app.com','https://www.ixtla-app.com'];

/* Preflight */
if ($method === 'OPTIONS') {
  if ($origin && in_array($origin, $ALLOWED, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Vary: Origin");
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS'); // solo lo que usas aquí
    header('Access-Control-Allow-Headers: Content-Type, Accept, X-Requested-With, Idempotency-Key, X-TRACE-LABEL');
    header('Access-Control-Max-Age: 86400');
    http_response_code(204);
  } else {
    // Origin no permitido => no revelar CORS. Puedes usar 403 explícito si prefieres:
    http_response_code(403);
  }
  exit;
}

// Conexión DB
$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }
else {
  http_response_code(500);
  die(json_encode(["ok"=>false,"error"=>"No se encontró conn_db.php en $path"]));
}

// Body vs querystring
if ($method === 'GET') {
  $in = $_GET;
} else {
  $in = json_decode(file_get_contents("php://input"), true) ?? [];
}

// Inputs / filtros
$id               = isset($in['id']) ? (int)$in['id'] : null;

$requerimiento_id = isset($in['requerimiento_id']) && $in['requerimiento_id'] !== ''
                      ? (int)$in['requerimiento_id']
                      : null;

$empleado_id      = isset($in['empleado_id']) && $in['empleado_id'] !== ''
                      ? (int)$in['empleado_id']
                      : null;

$status           = isset($in['status']) && $in['status'] !== ''
                      ? (int)$in['status']
                      : null;

$date_from        = isset($in['date_from']) && trim($in['date_from'])!==''
                      ? trim($in['date_from'])
                      : null;

$date_to          = isset($in['date_to']) && trim($in['date_to'])!==''
                      ? trim($in['date_to'])
                      : null;

// Paginación
$page      = isset($in['page']) ? max(1,(int)$in['page']) : 1;
$pageSize  = isset($in['page_size']) ? max(1,min(500,(int)$in['page_size'])) : 50;
$offset    = ($page-1)*$pageSize;

// Conectar
$con = conectar();
if (!$con) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]);
  exit;
}
$con->set_charset('utf8mb4');

// =========================
// 1) Consulta individual
// =========================
if ($id) {
  $sqlOne = "
    SELECT
      p.id,
      p.requerimiento_id,
      p.empleado_id,
      e.nombre AS empleado_nombre,
      e.apellidos AS empleado_apellidos,
      p.descripcion,
      p.status,
      p.created_at,
      p.updated_at,
      p.created_by,
      p.updated_by
    FROM proceso_requerimiento p
    LEFT JOIN empleado e ON e.id = p.empleado_id
    WHERE p.id = ?
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

  $row['id']               = (int)$row['id'];
  $row['requerimiento_id'] = (int)$row['requerimiento_id'];
  $row['empleado_id']      = $row['empleado_id'] !== null ? (int)$row['empleado_id'] : null;
  $row['status']           = (int)$row['status'];
  $row['created_by']       = $row['created_by'] !== null ? (int)$row['created_by'] : null;
  $row['updated_by']       = $row['updated_by'] !== null ? (int)$row['updated_by'] : null;
  $row['empleado_display'] = trim(($row['empleado_nombre'] ?? '').' '.($row['empleado_apellidos'] ?? ''));

  echo json_encode(["ok"=>true,"data"=>$row]);
  exit;
}

// =========================
// 2) Listado filtrado
// =========================
$where   = [];
$types   = "";
$params  = [];

// requerimiento_id
if ($requerimiento_id !== null) {
  $where[]   = "p.requerimiento_id = ?";
  $types    .= "i";
  $params[]  =& $requerimiento_id;
}

// empleado_id
if ($empleado_id !== null) {
  $where[]   = "p.empleado_id = ?";
  $types    .= "i";
  $params[]  =& $empleado_id;
}

// status (1 activo / 0 baja lógica)
if ($status !== null) {
  $where[]   = "p.status = ?";
  $types    .= "i";
  $params[]  =& $status;
}

// rango de fechas
if ($date_from !== null) {
  $where[]   = "p.created_at >= ?";
  $types    .= "s";
  $params[]  =& $date_from;
}
if ($date_to !== null) {
  $where[]   = "p.created_at <= ?";
  $types    .= "s";
  $params[]  =& $date_to;
}

$sql = "
  SELECT SQL_CALC_FOUND_ROWS
    p.id,
    p.requerimiento_id,
    p.empleado_id,
    e.nombre AS empleado_nombre,
    e.apellidos AS empleado_apellidos,
    p.descripcion,
    p.status,
    p.created_at,
    p.updated_at,
    p.created_by,
    p.updated_by
  FROM proceso_requerimiento p
  LEFT JOIN empleado e ON e.id = p.empleado_id
";

if ($where) {
  $sql .= " WHERE ".implode(" AND ", $where);
}

// timeline ordenado por fecha ascendente
$sql .= " ORDER BY p.created_at ASC LIMIT ? OFFSET ?";

$types    .= "ii";
$params[]  =& $pageSize;
$params[]  =& $offset;

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
  $r['id']               = (int)$r['id'];
  $r['requerimiento_id'] = (int)$r['requerimiento_id'];
  $r['empleado_id']      = $r['empleado_id'] !== null ? (int)$r['empleado_id'] : null;
  $r['status']           = (int)$r['status'];
  $r['created_by']       = $r['created_by'] !== null ? (int)$r['created_by'] : null;
  $r['updated_by']       = $r['updated_by'] !== null ? (int)$r['updated_by'] : null;
  $r['empleado_display'] = trim(($r['empleado_nombre'] ?? '').' '.($r['empleado_apellidos'] ?? ''));
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

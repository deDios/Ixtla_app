<?php
// c_comentario_requerimiento.php
// Consulta comentarios de requerimientos (detalle o listado con filtros)

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
date_default_timezone_set('America/Mexico_City');

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method !== 'POST' && $method !== 'GET') {
  http_response_code(405);
  echo json_encode(["ok"=>false,"error"=>"Método no permitido, usa POST o GET"]);
  exit;
}

// Conexión DB
$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }
else {
  http_response_code(500);
  die(json_encode(["ok"=>false,"error"=>"No se encontró conn_db.php en $path"]));
}

// Para GET permitimos querystring, para POST leemos body JSON
if ($method === 'GET') {
  $in = $_GET;
} else {
  $in = json_decode(file_get_contents("php://input"), true) ?? [];
}

// ====== Inputs / filtros ======
$id                = isset($in['id']) ? (int)$in['id'] : null;

$requerimiento_id  = isset($in['requerimiento_id']) && $in['requerimiento_id'] !== ''
                      ? (int)$in['requerimiento_id']
                      : null;

$empleado_id       = isset($in['empleado_id']) && $in['empleado_id'] !== ''
                      ? (int)$in['empleado_id']
                      : null;

$status            = isset($in['status']) && $in['status'] !== ''
                      ? (int)$in['status']
                      : null;

$date_from         = isset($in['date_from']) && trim($in['date_from'])!==''
                      ? trim($in['date_from'])
                      : null;

$date_to           = isset($in['date_to']) && trim($in['date_to'])!==''
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


// =======================================================
// 1) Consulta individual por id
// =======================================================
if ($id) {
  $sqlOne = "
    SELECT
      c.id,
      c.requerimiento_id,
      c.empleado_id,
      e.nombre  AS empleado_nombre,
      e.apellidos AS empleado_apellidos,
      c.comentario,
      c.status,
      c.created_at,
      c.updated_at,
      c.created_by,
      c.updated_by
    FROM comentario_requerimiento c
    LEFT JOIN empleado e ON e.id = c.empleado_id
    WHERE c.id = ?
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

  // casteos numéricos
  $row['id']               = (int)$row['id'];
  $row['requerimiento_id'] = (int)$row['requerimiento_id'];
  $row['empleado_id']      = $row['empleado_id'] !== null ? (int)$row['empleado_id'] : null;
  $row['status']           = (int)$row['status'];
  $row['created_by']       = $row['created_by'] !== null ? (int)$row['created_by'] : null;
  $row['updated_by']       = $row['updated_by'] !== null ? (int)$row['updated_by'] : null;

  echo json_encode(["ok"=>true,"data"=>$row]);
  exit;
}


// =======================================================
// 2) Listado con filtros (timeline / historial)
// =======================================================

$where   = [];
$types   = "";
$params  = [];

// Filtrar por requerimiento_id (normalmente obligatorio en timeline)
if ($requerimiento_id !== null) {
  $where[]  = "c.requerimiento_id = ?";
  $types   .= "i";
  $params[] = &$requerimiento_id;
}

// Filtrar por empleado específico
if ($empleado_id !== null) {
  $where[]  = "c.empleado_id = ?";
  $types   .= "i";
  $params[] = &$empleado_id;
}

// Filtrar por status (1 = activo, 0 = inactivo/borrado lógico)
if ($status !== null) {
  $where[]  = "c.status = ?";
  $types   .= "i";
  $params[] = &$status;
}

// Rango de fecha de creación
// date_from => created_at >= date_from
if ($date_from !== null) {
  $where[]  = "c.created_at >= ?";
  $types   .= "s";
  $params[] = &$date_from;
}

// date_to => created_at <= date_to
if ($date_to !== null) {
  $where[]  = "c.created_at <= ?";
  $types   .= "s";
  $params[] = &$date_to;
}

// Base query
$sql = "
  SELECT SQL_CALC_FOUND_ROWS
    c.id,
    c.requerimiento_id,
    c.empleado_id,
    e.nombre    AS empleado_nombre,
    e.apellidos AS empleado_apellidos,
    c.comentario,
    c.status,
    c.created_at,
    c.updated_at,
    c.created_by,
    c.updated_by
  FROM comentario_requerimiento c
  LEFT JOIN empleado e ON e.id = c.empleado_id
";

// WHERE dinámico
if ($where) {
  $sql .= " WHERE ".implode(" AND ", $where);
}

// Timeline ordenado cronológicamente
$sql .= " ORDER BY c.created_at ASC LIMIT ? OFFSET ?";

// Agregamos paginación a los bind params
$types   .= "ii";
$params[] = &$pageSize;
$params[] = &$offset;

$stmt = $con->prepare($sql);
if (!$stmt) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"Error en prepare"]);
  $con->close();
  exit;
}

// bind_param dinámico
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
  // puedes también armar el "empleado_display" si quieres listo para UI
  $r['empleado_display'] = trim(($r['empleado_nombre'] ?? '').' '.($r['empleado_apellidos'] ?? ''));
  $data[] = $r;
}
$stmt->close();

// total filas sin LIMIT
$tot = $con->query("SELECT FOUND_ROWS() AS t")->fetch_assoc();
$total = isset($tot['t']) ? (int)$tot['t'] : 0;

$con->close();

// Respuesta final
echo json_encode([
  "ok"=>true,
  "meta"=>[
    "page"=>$page,
    "page_size"=>$pageSize,
    "total"=>$total
  ],
  "data"=>$data
]);

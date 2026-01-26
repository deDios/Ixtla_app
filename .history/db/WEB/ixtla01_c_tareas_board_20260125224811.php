<?php
// ixtla01_c_tareas_board.php
// consulta con joins: tarea_proceso + proceso_requerimiento + requerimiento + depto + tramite (+ empleados)
// Devuelve tareas con contexto para evitar lag en la view

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = [
  'https://ixtla-app.com',
  'https://www.ixtla-app.com'
];

if (in_array($origin, $allowed, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Access-Control-Allow-Credentials: true");
  header("Vary: Origin");
}

header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
$reqHeaders = $_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'] ?? '';
if ($reqHeaders) {
  header("Access-Control-Allow-Headers: $reqHeaders");
} else {
  header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept");
}
header("Access-Control-Max-Age: 86400");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Conexion DB
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

// =========================
// Inputs / filtros
// =========================

// Identificadores
$id               = isset($in['id']) ? (int)$in['id'] : null;
$proceso_id       = isset($in['proceso_id']) && $in['proceso_id'] !== '' ? (int)$in['proceso_id'] : null;
$requerimiento_id = isset($in['requerimiento_id']) && $in['requerimiento_id'] !== '' ? (int)$in['requerimiento_id'] : null;
$departamento_id  = isset($in['departamento_id']) && $in['departamento_id'] !== '' ? (int)$in['departamento_id'] : null;
$tramite_id       = isset($in['tramite_id']) && $in['tramite_id'] !== '' ? (int)$in['tramite_id'] : null;

// Responsable de la tarea
$asignado_a       = isset($in['asignado_a']) && $in['asignado_a'] !== '' ? (int)$in['asignado_a'] : null;

// Status de workflow de tarea (1..5)
$task_status      = isset($in['task_status']) && $in['task_status'] !== '' ? (int)$in['task_status'] : null;

// Estatus del requerimiento (para lock / filtros)
$req_estatus      = isset($in['req_estatus']) && $in['req_estatus'] !== '' ? (int)$in['req_estatus'] : null;

// Búsqueda
$q               = isset($in['q']) ? trim((string)$in['q']) : null;

// Rango de fechas (sobre created_at de tarea)
$date_from       = isset($in['date_from']) && trim($in['date_from'])!=='' ? trim($in['date_from']) : null;
$date_to         = isset($in['date_to']) && trim($in['date_to'])!=='' ? trim($in['date_to']) : null;

// Paginación
$page     = isset($in['page']) ? max(1,(int)$in['page']) : 1;
$pageSize = isset($in['page_size']) ? max(1,min(500,(int)$in['page_size'])) : 50;
$offset   = ($page-1)*$pageSize;

// Orden (ASC / DESC)
$order = strtoupper(trim((string)($in['order'] ?? 'ASC')));
if ($order !== 'ASC' && $order !== 'DESC') $order = 'ASC';

// Conectar
$con = conectar();
if (!$con) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]);
  exit;
}
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

// =========================
// 1) Consulta individual
// =========================
$baseSelect = "
  SELECT SQL_CALC_FOUND_ROWS
    t.id AS tarea_id,
    t.proceso_id,
    p.requerimiento_id,

    -- Contexto del requerimiento
    r.folio,
    r.departamento_id,
    d.nombre AS departamento_nombre,
    r.tramite_id,
    tr.nombre AS tramite_nombre,
    r.estatus AS requerimiento_estatus,
    r.prioridad AS requerimiento_prioridad,
    r.canal AS requerimiento_canal,

    -- Tarea
    t.asignado_a,
    et.nombre AS tarea_asignado_nombre,
    et.apellidos AS tarea_asignado_apellidos,
    t.titulo,
    t.descripcion,
    t.esfuerzo,
    t.fecha_inicio,
    t.fecha_fin,
    t.status AS task_status,
    t.created_at,
    t.updated_at,
    t.created_by,
    t.updated_by,

    -- Proceso 
    p.empleado_id AS proceso_empleado_id,
    ep.nombre AS proceso_empleado_nombre,
    ep.apellidos AS proceso_empleado_apellidos,
    p.descripcion AS proceso_descripcion,
    p.status AS proceso_status,
    p.created_at AS proceso_created_at,
    p.updated_at AS proceso_updated_at

  FROM tarea_proceso t
  JOIN proceso_requerimiento p ON p.id = t.proceso_id
  JOIN requerimiento r ON r.id = p.requerimiento_id
  JOIN departamento d ON d.id = r.departamento_id
  JOIN tramite tr ON tr.id = r.tramite_id
  LEFT JOIN empleado et ON et.id = t.asignado_a
  LEFT JOIN empleado ep ON ep.id = p.empleado_id
";

// If id (tarea)
if ($id) {
  $sql = $baseSelect . " WHERE t.id = ? LIMIT 1";
  $stmt = $con->prepare($sql);
  if (!$stmt) {
    http_response_code(500);
    echo json_encode(["ok"=>false,"error"=>"Error en prepare"]);
    $con->close();
    exit;
  }
  $stmt->bind_param("i", $id);
  $stmt->execute();
  $row = $stmt->get_result()->fetch_assoc();
  $stmt->close();
  $con->close();

  if (!$row) {
    http_response_code(404);
    echo json_encode(["ok"=>false,"error"=>"No encontrado"]);
    exit;
  }

  // Normalizaciones minimas
  $row['tarea_id'] = (int)$row['tarea_id'];
  $row['proceso_id'] = (int)$row['proceso_id'];
  $row['requerimiento_id'] = (int)$row['requerimiento_id'];
  $row['departamento_id'] = (int)$row['departamento_id'];
  $row['tramite_id'] = (int)$row['tramite_id'];
  $row['requerimiento_estatus'] = (int)$row['requerimiento_estatus'];
  $row['task_status'] = (int)$row['task_status'];
  $row['asignado_a'] = $row['asignado_a'] !== null ? (int)$row['asignado_a'] : null;

  $row['tarea_asignado_display'] = trim(($row['tarea_asignado_nombre'] ?? '').' '.($row['tarea_asignado_apellidos'] ?? ''));
  $row['proceso_empleado_display'] = trim(($row['proceso_empleado_nombre'] ?? '').' '.($row['proceso_empleado_apellidos'] ?? ''));

  echo json_encode(["ok"=>true,"data"=>$row]);
  exit;
}

// =========================
// 2) Listado filtrado
// =========================
$where = [];
$types = "";
$params = [];

// filtros por ids
if ($proceso_id !== null)       { $where[]="t.proceso_id = ?";       $types.="i"; $params[]=&$proceso_id; }
if ($requerimiento_id !== null) { $where[]="p.requerimiento_id = ?"; $types.="i"; $params[]=&$requerimiento_id; }
if ($departamento_id !== null)  { $where[]="r.departamento_id = ?";  $types.="i"; $params[]=&$departamento_id; }
if ($tramite_id !== null)       { $where[]="r.tramite_id = ?";       $types.="i"; $params[]=&$tramite_id; }

// responsable
if ($asignado_a !== null)       { $where[]="t.asignado_a = ?";       $types.="i"; $params[]=&$asignado_a; }

// workflow status (1..5)
if ($task_status !== null)      { $where[]="t.status = ?";           $types.="i"; $params[]=&$task_status; }

// estatus del requerimiento
if ($req_estatus !== null)      { $where[]="r.estatus = ?";          $types.="i"; $params[]=&$req_estatus; }

// fechas sobre created_at de tarea
if ($date_from !== null)        { $where[]="t.created_at >= ?";      $types.="s"; $params[]=&$date_from; }
if ($date_to !== null)          { $where[]="t.created_at <= ?";      $types.="s"; $params[]=&$date_to; }

// búsqueda
if ($q !== null && $q !== "") {
  $where[]="(
    t.titulo LIKE CONCAT('%',?,'%')
    OR t.descripcion LIKE CONCAT('%',?,'%')
    OR r.folio LIKE CONCAT('%',?,'%')
    OR r.asunto LIKE CONCAT('%',?,'%')
    OR r.descripcion LIKE CONCAT('%',?,'%')
    OR r.contacto_nombre LIKE CONCAT('%',?,'%')
  )";
  $types.="ssssss";
  $params[]=&$q; $params[]=&$q; $params[]=&$q; $params[]=&$q; $params[]=&$q; $params[]=&$q;
}

$sql = $baseSelect;
if ($where) $sql .= " WHERE ".implode(" AND ", $where);

// Orden parecido al endpoint de tareas: fecha_inicio si existe, si no created_at
$sql .= " ORDER BY COALESCE(t.fecha_inicio, t.created_at) $order LIMIT ? OFFSET ?";

$types.="ii";
$params[]=&$pageSize;
$params[]=&$offset;

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
  $r['tarea_id'] = (int)$r['tarea_id'];
  $r['proceso_id'] = (int)$r['proceso_id'];
  $r['requerimiento_id'] = (int)$r['requerimiento_id'];
  $r['departamento_id'] = (int)$r['departamento_id'];
  $r['tramite_id'] = (int)$r['tramite_id'];
  $r['requerimiento_estatus'] = (int)$r['requerimiento_estatus'];
  $r['task_status'] = (int)$r['task_status'];

  $r['asignado_a'] = $r['asignado_a'] !== null ? (int)$r['asignado_a'] : null;
  $r['proceso_empleado_id'] = $r['proceso_empleado_id'] !== null ? (int)$r['proceso_empleado_id'] : null;

  $r['tarea_asignado_display'] = trim(($r['tarea_asignado_nombre'] ?? '').' '.($r['tarea_asignado_apellidos'] ?? ''));
  $r['proceso_empleado_display'] = trim(($r['proceso_empleado_nombre'] ?? '').' '.($r['proceso_empleado_apellidos'] ?? ''));

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

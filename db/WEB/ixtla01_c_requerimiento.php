<?php
//db\WEB\ixtla01_c_requerimiento.php
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



header('Content-Type: application/json');
date_default_timezone_set('America/Mexico_City');

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php"])); }

$in = json_decode(file_get_contents("php://input"), true) ?? [];


$id             = isset($in['id']) ? (int)$in['id'] : null;
$folio          = isset($in['folio']) ? trim($in['folio']) : null;

$departamento_id= isset($in['departamento_id']) ? (int)$in['departamento_id'] : null;
$tramite_id     = isset($in['tramite_id']) ? (int)$in['tramite_id'] : null;
$asignado_a     = isset($in['asignado_a']) ? (int)$in['asignado_a'] : null;

$estatus  = isset($in['estatus']) ? (int)$in['estatus'] : null;
$prioridad= isset($in['prioridad']) ? (int)$in['prioridad'] : null;
$canal    = isset($in['canal']) ? (int)$in['canal'] : null;

$q = isset($in['q']) ? trim($in['q']) : null;

$created_from = isset($in['created_from']) ? trim($in['created_from']) : null; // 'YYYY-MM-DD'
$created_to   = isset($in['created_to'])   ? trim($in['created_to'])   : null;

$page     = isset($in['page']) ? max(1,(int)$in['page']) : 1;
$per_page = isset($in['per_page']) ? min(200,max(1,(int)$in['per_page'])) : 50;
$all      = isset($in['all']) ? (bool)$in['all'] : false;

$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar"]));
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

$base = "
SELECT r.*,
       d.nombre AS departamento_nombre,
       t.nombre AS tramite_nombre,
       CONCAT(e.nombre,' ',e.apellidos) AS asignado_nombre_completo,
       e.puesto AS asignado_puesto,
       ed.nombre AS asignado_departamento_nombre,
       CASE r.estatus
         WHEN 0 THEN 'Solicitud'
         WHEN 1 THEN 'Revisión'
         WHEN 2 THEN 'Asignación'
         WHEN 3 THEN 'En proceso'
         WHEN 4 THEN 'Pausado'
         WHEN 5 THEN 'Cancelado'
         WHEN 6 THEN 'Finalizado'
         ELSE 'Sin estatus'
       END AS estatus_nombre,
       COALESCE(cm.comentarios_total, 0) AS comentarios_total,
       cm.ultimo_comentario_at,
       COALESCE(pm.procesos_total, 0) AS procesos_total,
       pm.ultimo_proceso_at,
       COALESCE(tm.tareas_total, 0) AS tareas_total,
       COALESCE(tm.tareas_abiertas, 0) AS tareas_abiertas
FROM requerimiento r
JOIN departamento d ON d.id = r.departamento_id
JOIN tramite t      ON t.id = r.tramite_id
LEFT JOIN empleado e ON e.id = r.asignado_a
LEFT JOIN departamento ed ON ed.id = e.departamento_id
LEFT JOIN (
  SELECT requerimiento_id, COUNT(*) AS comentarios_total, MAX(created_at) AS ultimo_comentario_at
  FROM comentario_requerimiento WHERE status = 1 GROUP BY requerimiento_id
) cm ON cm.requerimiento_id = r.id
LEFT JOIN (
  SELECT requerimiento_id, COUNT(*) AS procesos_total, MAX(created_at) AS ultimo_proceso_at
  FROM proceso_requerimiento WHERE status = 1 GROUP BY requerimiento_id
) pm ON pm.requerimiento_id = r.id
LEFT JOIN (
  SELECT p.requerimiento_id, COUNT(tp.id) AS tareas_total,
         SUM(CASE WHEN tp.status <> 5 THEN 1 ELSE 0 END) AS tareas_abiertas
  FROM proceso_requerimiento p
  JOIN tarea_proceso tp ON tp.proceso_id = p.id
  WHERE p.status = 1
  GROUP BY p.requerimiento_id
) tm ON tm.requerimiento_id = r.id
";

if ($id || $folio) {
  if ($id) {
    $sql = $base . " WHERE r.id=? LIMIT 1";
    $st = $con->prepare($sql);
    $st->bind_param("i",$id);
  } else {
    $sql = $base . " WHERE r.folio=? LIMIT 1";
    $st = $con->prepare($sql);
    $st->bind_param("s",$folio);
  }
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close(); $con->close();

  if (!$row) { echo json_encode(["ok"=>false,"error"=>"No encontrado"]); exit; }
  $row['id'] = (int)$row['id'];
  $row['departamento_id'] = (int)$row['departamento_id'];
  $row['tramite_id'] = (int)$row['tramite_id'];
  $row['asignado_a'] = isset($row['asignado_a']) ? (int)$row['asignado_a'] : null;
  $row['prioridad'] = (int)$row['prioridad'];
  $row['estatus'] = (int)$row['estatus'];
  $row['canal'] = (int)$row['canal'];
  $row['status'] = (int)$row['status'];
  $row['comentarios_total'] = (int)$row['comentarios_total'];
  $row['procesos_total'] = (int)$row['procesos_total'];
  $row['tareas_total'] = (int)$row['tareas_total'];
  $row['tareas_abiertas'] = (int)$row['tareas_abiertas'];
  echo json_encode(["ok"=>true,"data"=>$row]); exit;
}

/* Lista con filtros */
$where = [];
$params = [];
$types  = "";

if ($departamento_id !== null) { $where[]="r.departamento_id=?"; $params[]=$departamento_id; $types.="i"; }
if ($tramite_id      !== null) { $where[]="r.tramite_id=?";      $params[]=$tramite_id;      $types.="i"; }
if ($asignado_a      !== null) { $where[]="r.asignado_a=?";      $params[]=$asignado_a;      $types.="i"; }
if ($estatus         !== null) { $where[]="r.estatus=?";         $params[]=$estatus;         $types.="i"; }
if ($prioridad       !== null) { $where[]="r.prioridad=?";       $params[]=$prioridad;       $types.="i"; }
if ($canal           !== null) { $where[]="r.canal=?";           $params[]=$canal;           $types.="i"; }
if ($q !== null && $q !== "") {
  $where[]="(r.asunto LIKE CONCAT('%',?,'%') OR r.descripcion LIKE CONCAT('%',?,'%') OR r.contacto_nombre LIKE CONCAT('%',?,'%'))";
  $params[]=$q; $params[]=$q; $params[]=$q; $types.="sss";
}
if ($created_from) { $where[]="DATE(r.created_at) >= ?"; $params[]=$created_from; $types.="s"; }
if ($created_to)   { $where[]="DATE(r.created_at) <= ?"; $params[]=$created_to;   $types.="s"; }

$sql = $base . (count($where) ? " WHERE ".implode(" AND ", $where) : "") .
       " ORDER BY r.created_at DESC";

if (!$all) {
  $offset = ($page - 1) * $per_page;
  $sql .= " LIMIT ? OFFSET ?";
  $params[] = $per_page; $types.="i";
  $params[] = $offset;   $types.="i";
}

$st = $con->prepare($sql);
if ($types !== "") { $st->bind_param($types, ...$params); }
$st->execute();
$rs = $st->get_result();

$data=[];
while ($row = $rs->fetch_assoc()) {
  $row['id'] = (int)$row['id'];
  $row['departamento_id'] = (int)$row['departamento_id'];
  $row['tramite_id'] = (int)$row['tramite_id'];
  $row['asignado_a'] = isset($row['asignado_a']) ? (int)$row['asignado_a'] : null;
  $row['prioridad'] = (int)$row['prioridad'];
  $row['estatus'] = (int)$row['estatus'];
  $row['canal'] = (int)$row['canal'];
  $row['status'] = (int)$row['status'];
  $row['comentarios_total'] = (int)$row['comentarios_total'];
  $row['procesos_total'] = (int)$row['procesos_total'];
  $row['tareas_total'] = (int)$row['tareas_total'];
  $row['tareas_abiertas'] = (int)$row['tareas_abiertas'];
  $data[] = $row;
}
$st->close(); $con->close();

$resp = ["ok"=>true, "count"=>count($data), "data"=>$data];
if (!$all) { $resp["page"]=$page; $resp["per_page"]=$per_page; }
echo json_encode($resp);

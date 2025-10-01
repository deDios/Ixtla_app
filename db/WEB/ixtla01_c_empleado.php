<?php
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

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php en $path"])); }

$in = json_decode(file_get_contents("php://input"), true) ?? [];

$id               = isset($in['id']) ? (int)$in['id'] : null;
$q                = isset($in['q']) ? trim($in['q']) : null;
$departamento_id  = isset($in['departamento_id']) ? (int)$in['departamento_id'] : null;
$rol_codigo       = isset($in['rol_codigo']) ? trim($in['rol_codigo']) : null;
$status_empleado  = isset($in['status_empleado']) ? (int)$in['status_empleado'] : null;
$status_cuenta    = isset($in['status_cuenta']) ? (int)$in['status_cuenta'] : null;

$page     = isset($in['page']) ? max(1,(int)$in['page']) : 1;
$pageSize = isset($in['page_size']) ? max(1,min(500,(int)$in['page_size'])) : 50;
$offset   = ($page-1) * $pageSize;

$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]));
$con->set_charset('utf8mb4');

/* === Detalle por id === */
if ($id) {
  // Empleado + cuenta
  $sql = "
    SELECT e.*, c.id AS cuenta_id, c.username, c.reporta_a, c.debe_cambiar_pw,
           c.intentos_fallidos, c.status AS status_cuenta, c.ultima_sesion
    FROM empleado e
    LEFT JOIN empleado_cuenta c ON c.empleado_id = e.id
    WHERE e.id = ? LIMIT 1";
  $st = $con->prepare($sql);
  $st->bind_param("i",$id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) { $con->close(); echo json_encode(["ok"=>false,"error"=>"No encontrado"]); exit; }

  // Roles (si hay cuenta)
  $roles = [];
  if (!empty($row['cuenta_id'])) {
    $st = $con->prepare("
      SELECT r.id, r.codigo, r.nombre
      FROM empleado_rol er
      JOIN rol r ON r.id = er.rol_id
      WHERE er.empleado_cuenta_id = ?
      ORDER BY r.codigo
    ");
    $st->bind_param("i", $row['cuenta_id']);
    $st->execute();
    $rs = $st->get_result();
    while ($r = $rs->fetch_assoc()) { $r['id']=(int)$r['id']; $roles[] = $r; }
    $st->close();
  }

  // Casts y armado
  $emp = [
    "id" => (int)$row['id'],
    "nombre" => $row['nombre'],
    "apellidos" => $row['apellidos'],
    "email" => $row['email'],
    "telefono" => $row['telefono'],
    "puesto" => $row['puesto'],
    "departamento_id" => isset($row['departamento_id']) ? (int)$row['departamento_id'] : null,
    "status" => (int)$row['status'],
    "created_at" => $row['created_at'],
    "updated_at" => $row['updated_at'],
    "created_by" => isset($row['created_by']) ? (int)$row['created_by'] : null,
    "updated_by" => isset($row['updated_by']) ? (int)$row['updated_by'] : null,
    "cuenta" => $row['cuenta_id'] ? [
      "id" => (int)$row['cuenta_id'],
      "username" => $row['username'],
      "reporta_a" => isset($row['reporta_a']) ? (int)$row['reporta_a'] : null,
      "debe_cambiar_pw" => (int)$row['debe_cambiar_pw'],
      "intentos_fallidos" => (int)$row['intentos_fallidos'],
      "status" => (int)$row['status_cuenta'],
      "ultima_sesion" => $row['ultima_sesion'],
      "roles" => $roles
    ] : null
  ];

  $con->close();
  echo json_encode(["ok"=>true,"data"=>$emp]); exit;
}

/* === Listado con filtros y paginación === */
$where=[]; $types=""; $params=[];

if ($q !== null && $q !== '') {
  $like = "%".$q."%";
  $where[]="(e.nombre LIKE ? OR e.apellidos LIKE ? OR e.email LIKE ? OR e.puesto LIKE ? OR c.username LIKE ?)";
  $types.="sssss"; $params[]=&$like; $params[]=&$like; $params[]=&$like; $params[]=&$like; $params[]=&$like;
}
if ($departamento_id !== null) { $where[]="e.departamento_id = ?"; $types.="i"; $params[]=&$departamento_id; }
if ($status_empleado !== null) { $where[]="e.status = ?";         $types.="i"; $params[]=&$status_empleado; }
if ($status_cuenta !== null)   { $where[]="c.status = ?";         $types.="i"; $params[]=&$status_cuenta; }
if ($rol_codigo !== null && $rol_codigo!=='') {
  // Filtra por rol: requiere join a er/r
  $where[]="EXISTS (
    SELECT 1 FROM empleado_cuenta c2
    JOIN empleado_rol er2 ON er2.empleado_cuenta_id = c2.id
    JOIN rol r2 ON r2.id = er2.rol_id
    WHERE c2.empleado_id = e.id AND r2.codigo = ?
  )";
  $types.="s"; $params[]=&$rol_codigo;
}

$sql = "
  SELECT SQL_CALC_FOUND_ROWS
         e.*, c.id AS cuenta_id, c.username, c.reporta_a, c.debe_cambiar_pw,
         c.intentos_fallidos, c.status AS status_cuenta, c.ultima_sesion
  FROM empleado e
  LEFT JOIN empleado_cuenta c ON c.empleado_id = e.id";
if ($where) $sql .= " WHERE ".implode(" AND ", $where);
$sql .= " ORDER BY e.created_at DESC, e.id DESC LIMIT ? OFFSET ?";

$types .= "ii"; $params[]=&$pageSize; $params[]=&$offset;

$st = $con->prepare($sql);
call_user_func_array([$st,'bind_param'], array_merge([$types], $params));
$st->execute();
$rs = $st->get_result();

$rows=[]; $empleadoIds=[];
while ($r = $rs->fetch_assoc()) {
  $empleadoIds[] = (int)$r['id'];
  $rows[] = $r;
}
$st->close();

/* total */
$tot = $con->query("SELECT FOUND_ROWS() AS t")->fetch_assoc();
$total = (int)$tot['t'];

/* Cargar roles en batch */
$cuentaIds = array_values(array_filter(array_map(function($x){ return $x['cuenta_id'] ?? null; }, $rows)));
$rolesByCuenta = [];
if (count($cuentaIds) > 0) {
  $place = implode(",", array_fill(0, count($cuentaIds), "?"));
  $types = str_repeat("i", count($cuentaIds));
  $sqlR = "
    SELECT er.empleado_cuenta_id, r.id, r.codigo, r.nombre
    FROM empleado_rol er
    JOIN rol r ON r.id = er.rol_id
    WHERE er.empleado_cuenta_id IN ($place)
    ORDER BY r.codigo";
  $st = $con->prepare($sqlR);
  call_user_func_array([$st,'bind_param'], array_merge([$types], $cuentaIds));
  $st->execute();
  $rs = $st->get_result();
  while ($rr = $rs->fetch_assoc()) {
    $key = (int)$rr['empleado_cuenta_id'];
    $rr['id'] = (int)$rr['id'];
    if (!isset($rolesByCuenta[$key])) $rolesByCuenta[$key] = [];
    $rolesByCuenta[$key][] = ["id"=>$rr['id'], "codigo"=>$rr['codigo'], "nombre"=>$rr['nombre']];
  }
  $st->close();
}
$con->close();

/* Armar salida */
$data=[];
foreach ($rows as $row) {
  $emp = [
    "id" => (int)$row['id'],
    "nombre" => $row['nombre'],
    "apellidos" => $row['apellidos'],
    "email" => $row['email'],
    "telefono" => $row['telefono'],
    "puesto" => $row['puesto'],
    "departamento_id" => isset($row['departamento_id']) ? (int)$row['departamento_id'] : null,
    "status" => (int)$row['status'],
    "created_at" => $row['created_at'],
    "updated_at" => $row['updated_at'],
    "created_by" => isset($row['created_by']) ? (int)$row['created_by'] : null,
    "updated_by" => isset($row['updated_by']) ? (int)$row['updated_by'] : null,
    "cuenta" => $row['cuenta_id'] ? [
      "id" => (int)$row['cuenta_id'],
      "username" => $row['username'],
      "reporta_a" => isset($row['reporta_a']) ? (int)$row['reporta_a'] : null,
      "debe_cambiar_pw" => (int)$row['debe_cambiar_pw'],
      "intentos_fallidos" => (int)$row['intentos_fallidos'],
      "status" => (int)$row['status_cuenta'],
      "ultima_sesion" => $row['ultima_sesion'],
      "roles" => $rolesByCuenta[(int)$row['cuenta_id']] ?? []
    ] : null
  ];
  $data[] = $emp;
}

echo json_encode([
  "ok"=>true,
  "meta"=>["page"=>$page,"page_size"=>$pageSize,"total"=>$total],
  "data"=>$data
]);

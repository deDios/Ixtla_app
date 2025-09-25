<?php
header('Content-Type: application/json');
date_default_timezone_set('America/Mexico_City');

$path = realpath("/home/site/wwwroot/db/conn/conexion.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php en $path"])); }

$in = json_decode(file_get_contents("php://input"), true) ?? [];

/* ----- Requeridos ----- */
$required = ['nombre','apellidos','email','puesto','username','password','roles'];
foreach ($required as $k) {
  if (!isset($in[$k]) || (is_string($in[$k]) && trim($in[$k])==='') || ($k==='roles' && !is_array($in[$k]))) {
    http_response_code(400);
    die(json_encode(["ok"=>false,"error"=>"Falta parámetro obligatorio o formato inválido: $k"]));
  }
}

/* ----- Inputs ----- */
$nombre        = trim($in['nombre']);
$apellidos     = trim($in['apellidos']);
$email         = trim($in['email']);
$telefono      = isset($in['telefono']) ? trim($in['telefono']) : null;
$puesto        = trim($in['puesto']);
$departamento_id = array_key_exists('departamento_id',$in) && $in['departamento_id']!==null ? (int)$in['departamento_id'] : null;

$username      = trim($in['username']);
$password      = $in['password'];  // texto plano ENTRANTE (se hace hash aquí)
$reporta_a     = array_key_exists('reporta_a',$in) && $in['reporta_a']!==null ? (int)$in['reporta_a'] : null;

$roles_codigos = $in['roles'];      // array de strings, ej: ["JEFE","ANALISTA"]
$debe_cambiar_pw = isset($in['debe_cambiar_pw']) ? (int)$in['debe_cambiar_pw'] : 0;

$status_emp    = isset($in['status_empleado']) ? (int)$in['status_empleado'] : 1;
$status_cta    = isset($in['status_cuenta'])   ? (int)$in['status_cuenta']   : 1;

$created_by    = isset($in['created_by']) ? (int)$in['created_by'] : null;

/* ----- Conexión ----- */
$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]));
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

/* ----- Validaciones previas ligeras ----- */
/* (Opcional) verificar que reporta_a exista si viene */
if ($reporta_a !== null) {
  $st = $con->prepare("SELECT 1 FROM empleado WHERE id=? LIMIT 1");
  $st->bind_param("i", $reporta_a);
  $st->execute();
  if (!$st->get_result()->fetch_row()) {
    $st->close(); $con->close();
    http_response_code(400);
    die(json_encode(["ok"=>false,"error"=>"El empleado al que reporta no existe (reporta_a)"]));
  }
  $st->close();
}

/* Mapear roles codigos -> ids */
if (!is_array($roles_codigos) || count($roles_codigos)===0) {
  $con->close();
  http_response_code(400);
  die(json_encode(["ok"=>false,"error"=>"roles debe ser un arreglo no vacío"]));
}
$place = implode(",", array_fill(0, count($roles_codigos), "?"));
$types = str_repeat("s", count($roles_codigos));
$sqlRoles = "SELECT id, codigo FROM rol WHERE codigo IN ($place) AND status=1";
$st = $con->prepare($sqlRoles);
call_user_func_array([$st,'bind_param'], array_merge([$types], $roles_codigos));
$st->execute();
$res = $st->get_result();
$roles_ids = [];
while ($r = $res->fetch_assoc()) { $roles_ids[$r['codigo']] = (int)$r['id']; }
$st->close();
if (count($roles_ids) !== count($roles_codigos)) {
  $faltantes = array_values(array_diff($roles_codigos, array_keys($roles_ids)));
  $con->close();
  http_response_code(400);
  die(json_encode(["ok"=>false,"error"=>"Roles no válidos o inactivos","faltan"=>$faltantes]));
}

/* Hash de contraseña */
$hash = password_hash($password, PASSWORD_BCRYPT);
if (!$hash) { $con->close(); http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se pudo generar el hash de la contraseña"])); }

/* ----- Transacción ----- */
$con->begin_transaction();

try {
  /* 1) Insertar empleado */
  if ($departamento_id === null) {
    $sqlEmp = "INSERT INTO empleado (nombre, apellidos, email, telefono, puesto, departamento_id, status, created_by)
               VALUES (?,?,?,?,?,NULL,?,?)";
    $st = $con->prepare($sqlEmp);
    $st->bind_param("sssssis", $nombre,$apellidos,$email,$telefono,$puesto,$status_emp,$created_by);
  } else {
    $sqlEmp = "INSERT INTO empleado (nombre, apellidos, email, telefono, puesto, departamento_id, status, created_by)
               VALUES (?,?,?,?,?,?,?,?)";
    $st = $con->prepare($sqlEmp);
    $st->bind_param("sssssiii", $nombre,$apellidos,$email,$telefono,$puesto,$departamento_id,$status_emp,$created_by);
  }

  if (!$st->execute()) {
    $code=$st->errno; $err=$st->error; $st->close();
    throw new Exception("EMP: $err", $code);
  }
  $empleado_id = $st->insert_id;
  $st->close();

  /* 2) Insertar cuenta (credenciales + jerarquía) */
  if ($reporta_a === null) {
    $sqlCta = "INSERT INTO empleado_cuenta
      (empleado_id, username, password_hash, reporta_a, debe_cambiar_pw, intentos_fallidos, status, created_by)
      VALUES (?, ?, ?, NULL, ?, 0, ?, ?)";
    $st = $con->prepare($sqlCta);
    $st->bind_param("issiii", $empleado_id, $username, $hash, $debe_cambiar_pw, $status_cta, $created_by);
  } else {
    $sqlCta = "INSERT INTO empleado_cuenta
      (empleado_id, username, password_hash, reporta_a, debe_cambiar_pw, intentos_fallidos, status, created_by)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)";
    $st = $con->prepare($sqlCta);
    $st->bind_param("issiiii", $empleado_id, $username, $hash, $reporta_a, $debe_cambiar_pw, $status_cta, $created_by);
  }

  if (!$st->execute()) {
    $code=$st->errno; $err=$st->error; $st->close();
    throw new Exception("CTA: $err", $code);
  }
  $cuenta_id = $st->insert_id;
  $st->close();

  /* 3) Insertar roles (N a N) */
  $sqlER = "INSERT INTO empleado_rol (empleado_cuenta_id, rol_id, created_by) VALUES (?,?,?)";
  $st = $con->prepare($sqlER);
  foreach ($roles_codigos as $cod) {
    $rid = $roles_ids[$cod];
    $st->bind_param("iii", $cuenta_id, $rid, $created_by);
    if (!$st->execute()) {
      $code=$st->errno; $err=$st->error; $st->close();
      throw new Exception("ROL: $err", $code);
    }
  }
  $st->close();

  $con->commit();

} catch (Exception $e) {
  $con->rollback();
  $code = $e->getCode();
  $msg  = $e->getMessage();
  $con->close();

  // Mapear errores comunes
  if ($code == 1062) { // duplicado email/username
    $campo = (stripos($msg,'uk_empleado_email')!==false) ? 'email' :
             ((stripos($msg,'uk_cuenta_username')!==false) ? 'username' : 'único');
    http_response_code(409);
    die(json_encode(["ok"=>false,"error"=>"Duplicado en campo $campo","detail"=>$msg,"code"=>$code]));
  }
  if ($code == 1452) { // FK
    http_response_code(400);
    die(json_encode(["ok"=>false,"error"=>"FK inválida (departamento_id / reporta_a / rol_id)","detail"=>$msg,"code"=>$code]));
  }
  http_response_code(500);
  die(json_encode(["ok"=>false,"error"=>"No se pudo crear el empleado","detail"=>$msg,"code"=>$code]));
}

/* ----- Respuesta enriquecida ----- */
$con = conectar();
$con->set_charset('utf8mb4');

/* empleado */
$qe = $con->prepare("SELECT * FROM empleado WHERE id=? LIMIT 1");
$qe->bind_param("i", $empleado_id);
$qe->execute();
$emp = $qe->get_result()->fetch_assoc();
$qe->close();

/* cuenta */
$qc = $con->prepare("
  SELECT c.*, CONCAT(e2.nombre,' ',e2.apellidos) AS reporta_a_nombre
  FROM empleado_cuenta c
  LEFT JOIN empleado e2 ON e2.id = c.reporta_a
  WHERE c.id=? LIMIT 1
");
$qc->bind_param("i", $cuenta_id);
$qc->execute();
$cta = $qc->get_result()->fetch_assoc();
$qc->close();

/* roles */
$qr = $con->prepare("
  SELECT r.id, r.codigo, r.nombre
  FROM empleado_rol er
  JOIN rol r ON r.id = er.rol_id
  WHERE er.empleado_cuenta_id=?
  ORDER BY r.codigo
");
$qr->bind_param("i", $cuenta_id);
$qr->execute();
$rs = $qr->get_result();
$roles = [];
while ($row = $rs->fetch_assoc()) { $roles[] = $row; }
$qr->close();
$con->close();

/* casts */
$emp['id']=(int)$emp['id']; $emp['status']=(int)$emp['status'];
$cta['id']=(int)$cta['id']; $cta['empleado_id']=(int)$cta['empleado_id'];
$cta['reporta_a'] = isset($cta['reporta_a']) ? (int)$cta['reporta_a'] : null;
$cta['debe_cambiar_pw']=(int)$cta['debe_cambiar_pw']; $cta['intentos_fallidos']=(int)$cta['intentos_fallidos'];
$cta['status']=(int)$cta['status'];
foreach ($roles as &$r){ $r['id']=(int)$r['id']; }

echo json_encode([
  "ok"=>true,
  "data"=>[
    "empleado"=>$emp,
    "cuenta"=>$cta,
    "roles"=>$roles
  ]
]);

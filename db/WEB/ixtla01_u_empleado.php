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
if (!isset($in['id']) || (int)$in['id']<=0) {
  http_response_code(400); die(json_encode(["ok"=>false,"error"=>"Falta parámetro obligatorio: id"]));
}

$id = (int)$in['id'];

$emp_nombre   = array_key_exists('nombre',$in) ? trim($in['nombre']) : null;
$emp_apellidos= array_key_exists('apellidos',$in) ? trim($in['apellidos']) : null;
$emp_email    = array_key_exists('email',$in) ? trim($in['email']) : null;
$emp_tel      = array_key_exists('telefono',$in) ? trim($in['telefono']) : null;
$emp_puesto   = array_key_exists('puesto',$in) ? trim($in['puesto']) : null;
$emp_depto    = array_key_exists('departamento_id',$in) ? ( ($in['departamento_id']===null) ? null : (int)$in['departamento_id'] ) : null;
$emp_status   = array_key_exists('status_empleado',$in) ? (int)$in['status_empleado'] : null;

$cta_username = array_key_exists('username',$in) ? trim($in['username']) : null;
$cta_reporta  = array_key_exists('reporta_a',$in) ? ( ($in['reporta_a']===null) ? null : (int)$in['reporta_a'] ) : null;
$cta_dc_pw    = array_key_exists('debe_cambiar_pw',$in) ? (int)$in['debe_cambiar_pw'] : null;
$cta_status   = array_key_exists('status_cuenta',$in) ? (int)$in['status_cuenta'] : null;
$new_password = array_key_exists('password',$in) ? $in['password'] : null;

$roles_codigos = array_key_exists('roles',$in) ? $in['roles'] : null; // array de strings o null
$updated_by    = array_key_exists('updated_by',$in) ? (int)$in['updated_by'] : null;

$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]));
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

/* Obtener cuenta_id si existe (puede no haber) */
$st = $con->prepare("SELECT c.id AS cuenta_id FROM empleado e LEFT JOIN empleado_cuenta c ON c.empleado_id=e.id WHERE e.id=? LIMIT 1");
$st->bind_param("i",$id);
$st->execute();
$base = $st->get_result()->fetch_assoc();
$st->close();
$cuenta_id = $base ? (int)$base['cuenta_id'] : null;

$con->begin_transaction();
try {
  /* --- Update empleado (dinámico) --- */
  $set=[]; $types=""; $params=[];
  if ($emp_nombre !== null)   { $set[]="nombre=?";       $types.="s"; $params[]=&$emp_nombre; }
  if ($emp_apellidos !== null){ $set[]="apellidos=?";    $types.="s"; $params[]=&$emp_apellidos; }
  if ($emp_email !== null)    { $set[]="email=?";        $types.="s"; $params[]=&$emp_email; }
  if ($emp_tel !== null)      { $set[]="telefono=?";     $types.="s"; $params[]=&$emp_tel; }
  if ($emp_puesto !== null)   { $set[]="puesto=?";       $types.="s"; $params[]=&$emp_puesto; }
  if (array_key_exists('departamento_id',$in)) { $set[]="departamento_id=?"; $types.="i"; $params[]=&$emp_depto; }
  if ($emp_status !== null)   { $set[]="status=?";       $types.="i"; $params[]=&$emp_status; }
  if ($updated_by !== null)   { $set[]="updated_by=?";   $types.="i"; $params[]=&$updated_by; }

  if ($set) {
    $sql = "UPDATE empleado SET ".implode(", ", $set)." WHERE id=?";
    $types.="i"; $params[]=&$id;
    $st = $con->prepare($sql);
    call_user_func_array([$st,'bind_param'], array_merge([$types], $params));
    if (!$st->execute()) { $code=$st->errno; $err=$st->error; $st->close(); throw new Exception("EMP: $err", $code); }
    $st->close();
  }

  /* --- Update/insert cuenta --- */
  $doCuenta = $cta_username!==null || array_key_exists('reporta_a',$in) || $cta_dc_pw!==null || $cta_status!==null || $new_password!==null;
  if ($doCuenta) {
    // Si no hay cuenta, crearla con valores mínimos (username requerido si no existía)
    if (!$cuenta_id) {
      if ($cta_username===null) throw new Exception("CTA: Para crear cuenta, envía 'username'", 4001);
      $hash = $new_password ? password_hash($new_password, PASSWORD_BCRYPT) : password_hash(bin2hex(random_bytes(6)), PASSWORD_BCRYPT);
      // Insert
      $sql = "INSERT INTO empleado_cuenta (empleado_id, username, password_hash, reporta_a, debe_cambiar_pw, intentos_fallidos, status, created_by)
              VALUES (?, ?, ?, ?, ?, 0, ?, ?)";
      $st = $con->prepare($sql);
      $rep = $cta_reporta; $dcp = $cta_dc_pw ?? 0; $stc = $cta_status ?? 1; $cb = $updated_by;
      $st->bind_param("issiiii", $id, $cta_username, $hash, $rep, $dcp, $stc, $cb);
      if (!$st->execute()) { $code=$st->errno; $err=$st->error; $st->close(); throw new Exception("CTA-NEW: $err", $code); }
      $cuenta_id = $st->insert_id;
      $st->close();
    } else {
      // Update dinámico de cuenta
      $set=[]; $types=""; $params=[];
      if ($cta_username !== null) { $set[]="username=?";       $types.="s"; $params[]=&$cta_username; }
      if (array_key_exists('reporta_a',$in)) { $set[]="reporta_a=?"; $types.="i"; $params[]=&$cta_reporta; }
      if ($cta_dc_pw !== null)   { $set[]="debe_cambiar_pw=?"; $types.="i"; $params[]=&$cta_dc_pw; }
      if ($cta_status !== null)  { $set[]="status=?";          $types.="i"; $params[]=&$cta_status; }
      if ($updated_by !== null)  { $set[]="updated_by=?";      $types.="i"; $params[]=&$updated_by; }
      if ($new_password !== null){
        $hash = password_hash($new_password, PASSWORD_BCRYPT);
        if (!$hash) throw new Exception("No se pudo hashear password", 5001);
        $set[]="password_hash=?"; $types.="s"; $params[]=&$hash;
        // (opcional) puedes setear debe_cambiar_pw=0 aquí si deseas
      }
      if ($set) {
        $sql = "UPDATE empleado_cuenta SET ".implode(", ", $set)." WHERE id=?";
        $types.="i"; $params[]=&$cuenta_id;
        $st = $con->prepare($sql);
        call_user_func_array([$st,'bind_param'], array_merge([$types], $params));
        if (!$st->execute()) { $code=$st->errno; $err=$st->error; $st->close(); throw new Exception("CTA-UPD: $err", $code); }
        $st->close();
      }
    }
  }

  /* --- Reemplazo de roles si viene 'roles' --- */
  if (is_array($roles_codigos)) {
    // Mapear a ids activos
    if (count($roles_codigos)===0) {
      // Vaciar roles
      if ($cuenta_id) {
        $st = $con->prepare("DELETE FROM empleado_rol WHERE empleado_cuenta_id=?");
        $st->bind_param("i",$cuenta_id);
        if (!$st->execute()) { $code=$st->errno; $err=$st->error; $st->close(); throw new Exception("ROL-DEL: $err", $code); }
        $st->close();
      }
    } else {
      $place = implode(",", array_fill(0, count($roles_codigos), "?"));
      $types = str_repeat("s", count($roles_codigos));
      $st = $con->prepare("SELECT id, codigo FROM rol WHERE codigo IN ($place) AND status=1");
      call_user_func_array([$st,'bind_param'], array_merge([$types], $roles_codigos));
      $st->execute();
      $rs = $st->get_result();
      $roles_ids = [];
      while ($r = $rs->fetch_assoc()) $roles_ids[$r['codigo']] = (int)$r['id'];
      $st->close();
      if (count($roles_ids) !== count($roles_codigos)) {
        $faltantes = array_values(array_diff($roles_codigos, array_keys($roles_ids)));
        throw new Exception("Roles no válidos o inactivos: ".implode(",", $faltantes), 4002);
      }
      if (!$cuenta_id) throw new Exception("No existe cuenta para asignar roles (crea cuenta primero)", 4003);

      // Reemplazo
      $st = $con->prepare("DELETE FROM empleado_rol WHERE empleado_cuenta_id=?");
      $st->bind_param("i",$cuenta_id);
      if (!$st->execute()) { $code=$st->errno; $err=$st->error; $st->close(); throw new Exception("ROL-CLR: $err", $code); }
      $st->close();

      $st = $con->prepare("INSERT INTO empleado_rol (empleado_cuenta_id, rol_id, created_by) VALUES (?,?,?)");
      foreach ($roles_codigos as $cod) {
        $rid = $roles_ids[$cod];
        $st->bind_param("iii", $cuenta_id, $rid, $updated_by);
        if (!$st->execute()) { $code=$st->errno; $err=$st->error; $st->close(); throw new Exception("ROL-INS: $err", $code); }
      }
      $st->close();
    }
  }

  $con->commit();

} catch (Exception $e) {
  $con->rollback();
  $code=$e->getCode(); $msg=$e->getMessage(); $con->close();

  if ($code == 1062) {
    $campo = (stripos($msg,'uk_empleado_email')!==false) ? 'email' :
             ((stripos($msg,'uk_cuenta_username')!==false) ? 'username' : 'único');
    http_response_code(409);
    die(json_encode(["ok"=>false,"error"=>"Duplicado en campo $campo","detail"=>$msg,"code"=>$code]));
  }
  if ($code == 1452) { // FK
    http_response_code(400);
    die(json_encode(["ok"=>false,"error"=>"FK inválida (departamento_id / reporta_a / rol_id)","detail"=>$msg,"code"=>$code]));
  }
  if (in_array($code,[4001,4002,4003,5001])) {
    http_response_code(400);
    die(json_encode(["ok"=>false,"error"=>$msg,"code"=>$code]));
  }
  http_response_code(500);
  die(json_encode(["ok"=>false,"error"=>"No se pudo actualizar","detail"=>$msg,"code"=>$code]));
}

/* === Devolver registro actualizado con cuenta y roles === */
$con = conectar();
$con->set_charset('utf8mb4');

$st = $con->prepare("
  SELECT e.*, c.id AS cuenta_id, c.username, c.reporta_a, c.debe_cambiar_pw,
         c.intentos_fallidos, c.status AS status_cuenta, c.ultima_sesion
  FROM empleado e
  LEFT JOIN empleado_cuenta c ON c.empleado_id=e.id
  WHERE e.id=? LIMIT 1");
$st->bind_param("i",$id);
$st->execute();
$row = $st->get_result()->fetch_assoc();
$st->close();

$roles=[];
if (!empty($row['cuenta_id'])) {
  $st = $con->prepare("
    SELECT r.id, r.codigo, r.nombre
    FROM empleado_rol er
    JOIN rol r ON r.id = er.rol_id
    WHERE er.empleado_cuenta_id=?
    ORDER BY r.codigo");
  $st->bind_param("i", $row['cuenta_id']);
  $st->execute();
  $rs = $st->get_result();
  while ($r = $rs->fetch_assoc()) { $r['id']=(int)$r['id']; $roles[]=$r; }
  $st->close();
}
$con->close();

$data = [
  "empleado"=>[
    "id"=>(int)$row['id'],
    "nombre"=>$row['nombre'],
    "apellidos"=>$row['apellidos'],
    "email"=>$row['email'],
    "telefono"=>$row['telefono'],
    "puesto"=>$row['puesto'],
    "departamento_id"=> isset($row['departamento_id'])?(int)$row['departamento_id']:null,
    "status"=>(int)$row['status'],
    "created_at"=>$row['created_at'],
    "updated_at"=>$row['updated_at'],
    "created_by"=> isset($row['created_by'])?(int)$row['created_by']:null,
    "updated_by"=> isset($row['updated_by'])?(int)$row['updated_by']:null
  ],
  "cuenta"=> $row['cuenta_id'] ? [
    "id"=>(int)$row['cuenta_id'],
    "username"=>$row['username'],
    "reporta_a"=> isset($row['reporta_a'])?(int)$row['reporta_a']:null,
    "debe_cambiar_pw"=>(int)$row['debe_cambiar_pw'],
    "intentos_fallidos"=>(int)$row['intentos_fallidos'],
    "status"=>(int)$row['status_cuenta'],
    "ultima_sesion"=>$row['ultima_sesion'],
    "roles"=>$roles
  ] : null
];

echo json_encode(["ok"=>true,"data"=>$data]);

<?php
// --- CORS mínimo (ajusta si tienes un cors.php global)
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

// --- Config de seguridad (puedes ajustar)
const MAX_INTENTOS = 5;         // intentos antes de bloqueo
const BLOQUEO_MIN  = 15;        // minutos de bloqueo

// --- Conexión
$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php en $path"])); }

// --- Leer body
$in = json_decode(file_get_contents("php://input"), true) ?? [];
if (!isset($in['username']) || !isset($in['password'])) {
  http_response_code(400);
  die(json_encode(["ok"=>false, "error"=>"Faltan parámetros: username y password"]));
}
$username = trim($in['username']);
$password = (string)$in['password'];

// --- DB
$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]));
$con->set_charset('utf8mb4');

// --- Buscar cuenta (activa) + empleado (activo)
$sql = "
  SELECT
    c.id            AS cuenta_id,
    c.empleado_id,
    c.username,
    c.password_hash,
    c.reporta_a,
    c.debe_cambiar_pw,
    c.intentos_fallidos,
    c.bloqueado_hasta,
    c.status        AS status_cuenta,
    c.ultima_sesion,
    e.id            AS emp_id,
    e.nombre,
    e.apellidos,
    e.email,
    e.telefono,
    e.puesto,
    e.departamento_id,
    e.status        AS status_empleado
  FROM empleado_cuenta c
  JOIN empleado e ON e.id = c.empleado_id
  WHERE c.username = ?
  LIMIT 1";
$st = $con->prepare($sql);
$st->bind_param("s", $username);
$st->execute();
$acc = $st->get_result()->fetch_assoc();
$st->close();

// --- Si no existe o está inactiva la cuenta/empleado
if (!$acc || (int)$acc['status_cuenta'] !== 1 || (int)$acc['status_empleado'] !== 1) {
  http_response_code(401);
  $con->close();
  die(json_encode(["ok"=>false, "error"=>"Usuario o contraseña inválidos"]));
}

// --- Revisar bloqueo temporal
$now = new DateTimeImmutable('now');
if (!empty($acc['bloqueado_hasta'])) {
  $until = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $acc['bloqueado_hasta']);
  if ($until && $until > $now) {
    $mins = (int)ceil(($until->getTimestamp() - $now->getTimestamp()) / 60);
    http_response_code(423); // Locked
    $con->close();
    die(json_encode([
      "ok"=>false,
      "error"=>"Cuenta temporalmente bloqueada",
      "locked_until"=>$acc['bloqueado_hasta'],
      "minutes_left"=>$mins
    ]));
  }
}

// --- Verificar password
$ok = password_verify($password, $acc['password_hash'] ?? '');
if (!$ok) {
  // Intento fallido: aumenta contador y bloquea si excede
  $fallidos = (int)$acc['intentos_fallidos'] + 1;
  if ($fallidos >= MAX_INTENTOS) {
    $upd = $con->prepare("
      UPDATE empleado_cuenta
      SET intentos_fallidos = 0,
          bloqueado_hasta = DATE_ADD(NOW(), INTERVAL ? MINUTE)
      WHERE id=?");
    $mins = BLOQUEO_MIN; $cid = (int)$acc['cuenta_id'];
    $upd->bind_param("ii", $mins, $cid);
    $upd->execute(); $upd->close();

    http_response_code(423); // Locked
    $con->close();
    die(json_encode([
      "ok"=>false,
      "error"=>"Cuenta bloqueada por múltiples intentos fallidos",
      "locked_until"=>"NOW()+".BLOQUEO_MIN."m",
      "max_attempts"=>MAX_INTENTOS
    ]));
  } else {
    $upd = $con->prepare("
      UPDATE empleado_cuenta
      SET intentos_fallidos = ?
      WHERE id=?");
    $cid = (int)$acc['cuenta_id'];
    $upd->bind_param("ii", $fallidos, $cid);
    $upd->execute(); $upd->close();

    http_response_code(401);
    $con->close();
    die(json_encode([
      "ok"=>false,
      "error"=>"Usuario o contraseña inválidos",
      "attempts_left"=> (MAX_INTENTOS - $fallidos)
    ]));
  }
}

// --- Login exitoso: reset intentos, limpia bloqueo, marca última sesión
$upd = $con->prepare("
  UPDATE empleado_cuenta
  SET intentos_fallidos = 0,
      bloqueado_hasta = NULL,
      ultima_sesion = NOW()
  WHERE id=?");
$cid = (int)$acc['cuenta_id'];
$upd->bind_param("i", $cid);
$upd->execute(); $upd->close();

// --- Cargar roles
$roles = [];
$qr = $con->prepare("
  SELECT r.id, r.codigo, r.nombre
  FROM empleado_rol er
  JOIN rol r ON r.id = er.rol_id
  WHERE er.empleado_cuenta_id=?
  ORDER BY r.codigo");
$qr->bind_param("i", $cid);
$qr->execute();
$rs = $qr->get_result();
while ($r = $rs->fetch_assoc()) {
  $r['id'] = (int)$r['id'];
  $roles[] = $r;
}
$qr->close();

// --- (Opcional) checar si debe cambiar contraseña
$debe_cambiar = (int)$acc['debe_cambiar_pw'] === 1;

// --- Armar respuesta (sin exponer hash)
$data = [
  "empleado" => [
    "id"              => (int)$acc['emp_id'],
    "nombre"          => $acc['nombre'],
    "apellidos"       => $acc['apellidos'],
    "email"           => $acc['email'],
    "telefono"        => $acc['telefono'],
    "puesto"          => $acc['puesto'],
    "departamento_id" => isset($acc['departamento_id']) ? (int)$acc['departamento_id'] : null,
    "status"          => (int)$acc['status_empleado']
  ],
  "cuenta" => [
    "id"              => (int)$acc['cuenta_id'],
    "username"        => $acc['username'],
    "reporta_a"       => isset($acc['reporta_a']) ? (int)$acc['reporta_a'] : null,
    "debe_cambiar_pw" => $debe_cambiar,
    "status"          => (int)$acc['status_cuenta'],
    "ultima_sesion"   => date('Y-m-d H:i:s')
  ],
  "roles" => $roles
];

$con->close();
echo json_encode(["ok"=>true, "data"=>$data]);

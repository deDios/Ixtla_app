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

$path = realpath("/home/site/wwwroot/db/conn/conexion.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php en $path"])); }

$in = json_decode(file_get_contents("php://input"), true) ?? [];

/* Requeridos */
$required = ['cp','colonia'];
foreach ($required as $k) {
  if (!isset($in[$k]) || trim($in[$k]) === '') {
    http_response_code(400);
    die(json_encode(["ok"=>false,"error"=>"Falta parámetro obligatorio: $k"]));
  }
}

/* Inputs */
$cp        = trim($in['cp']);
$colonia   = trim($in['colonia']);
$estatus   = isset($in['estatus']) ? (int)$in['estatus'] : 1;
$created_by= isset($in['created_by']) ? (int)$in['created_by'] : null;

/* Conexión */
$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]));
$con->set_charset('utf8mb4');

/* INSERT */
$sql = "INSERT INTO cp_colonia (cp, colonia, estatus, created_by) VALUES (?,?,?,?)";
$stmt = $con->prepare($sql);
$stmt->bind_param("ssii", $cp, $colonia, $estatus, $created_by);

if (!$stmt->execute()) {
  $code = $stmt->errno; $err = $stmt->error;
  $stmt->close(); $con->close();
  if ($code == 1062) { http_response_code(409); die(json_encode(["ok"=>false,"error"=>"Ya existe ese par cp+colonia"])); }
  if ($code == 3819 || $code == 4025) { http_response_code(400); die(json_encode(["ok"=>false,"error"=>"Formato de CP inválido"])); }
  http_response_code(500); die(json_encode(["ok"=>false,"error"=>"Error al insertar: $err","code"=>$code]));
}

$new_id = $stmt->insert_id;
$stmt->close();

/* SELECT del nuevo */
$q = $con->prepare("SELECT * FROM cp_colonia WHERE id=? LIMIT 1");
$q->bind_param("i", $new_id);
$q->execute();
$res = $q->get_result()->fetch_assoc();
$q->close(); $con->close();

/* Casts */
$res['id'] = (int)$res['id'];
$res['estatus'] = (int)$res['estatus'];
echo json_encode(["ok"=>true,"data"=>$res]);

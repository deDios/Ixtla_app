<?php
header('Content-Type: application/json');

$path = realpath("/home/site/wwwroot/db/conn/conexion.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php en $path"])); }

$in = json_decode(file_get_contents("php://input"), true) ?? [];

/* Requeridos mínimos (sin validar FKs aquí) */
$required = ['departamento_id','tramite_id','asunto','descripcion','contacto_nombre'];
foreach ($required as $k) {
  if (!isset($in[$k]) || $in[$k] === '') {
    http_response_code(400);
    die(json_encode(["ok"=>false,"error"=>"Falta parámetro obligatorio: $k"]));
  }
}

/* Inputs */
$departamento_id = (int)$in['departamento_id'];
$tramite_id      = (int)$in['tramite_id'];
$asignado_a      = isset($in['asignado_a']) ? (int)$in['asignado_a'] : null;

$asunto       = trim($in['asunto']);
$descripcion  = trim($in['descripcion']);

$prioridad = isset($in['prioridad']) ? (int)$in['prioridad'] : 2;   // 1=Alta, 2=Media, 3=Baja
$estatus   = isset($in['estatus'])   ? (int)$in['estatus']   : 0;   // 0 Abierta
$canal     = isset($in['canal'])     ? (int)$in['canal']     : 1;   // 1 Web

$contacto_nombre   = trim($in['contacto_nombre']);
$contacto_email    = isset($in['contacto_email']) ? trim($in['contacto_email']) : null;
$contacto_telefono = isset($in['contacto_telefono']) ? trim($in['contacto_telefono']) : null;
$contacto_calle    = isset($in['contacto_calle']) ? trim($in['contacto_calle']) : null;
$contacto_colonia  = isset($in['contacto_colonia']) ? trim($in['contacto_colonia']) : null;
$contacto_cp       = isset($in['contacto_cp']) ? trim($in['contacto_cp']) : null; // CHAR(5)
$fecha_limite      = isset($in['fecha_limite']) ? trim($in['fecha_limite']) : null;
$created_by        = isset($in['created_by']) ? (int)$in['created_by'] : null;

/* DB */
$con = conectar();
if (!$con) { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"])); }
$con->set_charset('utf8mb4');

/* INSERT: folio definitivo dentro del INSERT */
$sql = "INSERT INTO requerimiento (
          folio, departamento_id, tramite_id, asignado_a,
          asunto, descripcion, prioridad, estatus, canal,
          contacto_nombre, contacto_email, contacto_telefono,
          contacto_calle, contacto_colonia, contacto_cp,
          fecha_limite, status, created_by
        ) VALUES (
          CONCAT('REQ-', UUID_SHORT()), ?,?,?, ?,?, ?,?, ?, ?,?,?, ?,?,?, ?, 1, ?
        )";

$stmt = $con->prepare($sql);
$stmt->bind_param(
  "iiissiiissssssssi",
  $departamento_id, $tramite_id, $asignado_a,
  $asunto, $descripcion, $prioridad, $estatus, $canal,
  $contacto_nombre, $contacto_email, $contacto_telefono,
  $contacto_calle, $contacto_colonia, $contacto_cp,
  $fecha_limite, $created_by
);

if (!$stmt->execute()) {
  $code = $stmt->errno; $err = $stmt->error;
  $stmt->close(); $con->close();

  // Si falla FK, MySQL regresa 1452 (puedes mapear a 400 si quieres)
  if ($code == 1452) { http_response_code(400); die(json_encode(["ok"=>false,"error"=>"Violación de FK","code"=>$code])); }

  http_response_code(500);
  die(json_encode(["ok"=>false,"error"=>"Error al insertar: $err","code"=>$code]));
}

$new_id = $stmt->insert_id;
$stmt->close();

/* Devolver registro (simple) */
$q = $con->prepare("SELECT * FROM requerimiento WHERE id=? LIMIT 1");
$q->bind_param("i",$new_id);
$q->execute();
$res = $q->get_result()->fetch_assoc();
$q->close(); $con->close();

$res['id']=(int)$res['id'];
$res['departamento_id']=(int)$res['departamento_id'];
$res['tramite_id']=(int)$res['tramite_id'];
$res['prioridad']=(int)$res['prioridad'];
$res['estatus']=(int)$res['estatus'];
$res['canal']=(int)$res['canal'];
$res['status']=(int)$res['status'];

http_response_code(201);
echo json_encode(["ok"=>true,"data"=>$res]);

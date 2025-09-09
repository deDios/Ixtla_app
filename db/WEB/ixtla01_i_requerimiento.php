<?php
header('Content-Type: application/json');
date_default_timezone_set('America/Mexico_City');

$path = realpath("/home/site/wwwroot/db/conn/conexion.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php en $path"])); }

$in = json_decode(file_get_contents("php://input"), true) ?? [];

/* Requeridos mínimos */
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

$prioridad = isset($in['prioridad']) ? (int)$in['prioridad'] : 2;   // 1=Alta,2=Media,3=Baja
$estatus   = isset($in['estatus'])   ? (int)$in['estatus']   : 0;   // 0 Abierta
$canal     = isset($in['canal'])     ? (int)$in['canal']     : 1;   // 1 Web

$contacto_nombre   = trim($in['contacto_nombre']);
$contacto_email    = isset($in['contacto_email']) ? trim($in['contacto_email']) : null;
$contacto_telefono = isset($in['contacto_telefono']) ? trim($in['contacto_telefono']) : null;
$contacto_calle    = isset($in['contacto_calle']) ? trim($in['contacto_calle']) : null;
$contacto_colonia  = isset($in['contacto_colonia']) ? trim($in['contacto_colonia']) : null;
$contacto_cp       = isset($in['contacto_cp']) ? trim($in['contacto_cp']) : null; // CHAR(5) recomendado

$fecha_limite = isset($in['fecha_limite']) ? trim($in['fecha_limite']) : null;    // 'YYYY-MM-DD'
$created_by   = isset($in['created_by']) ? (int)$in['created_by'] : null;

/* Conexión */
$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]));
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

/* Validaciones FKs */
$st = $con->prepare("SELECT 1 FROM departamento WHERE id=? LIMIT 1");
$st->bind_param("i",$departamento_id);
$st->execute();
if (!$st->get_result()->fetch_row()) {
  $st->close(); $con->close();
  http_response_code(400);
  die(json_encode(["ok"=>false,"error"=>"departamento_id no existe"]));
}
$st->close();

$st = $con->prepare("SELECT departamento_id FROM tramite WHERE id=? LIMIT 1");
$st->bind_param("i",$tramite_id);
$st->execute();
$r = $st->get_result()->fetch_assoc();
$st->close();
if (!$r) {
  $con->close();
  http_response_code(400);
  die(json_encode(["ok"=>false,"error"=>"tramite_id no existe"]));
}
if ((int)$r['departamento_id'] !== $departamento_id) {
  $con->close();
  http_response_code(400);
  die(json_encode(["ok"=>false,"error"=>"El tramite_id no pertenece al departamento_id enviado"]));
}
if ($asignado_a !== null) {
  $st = $con->prepare("SELECT 1 FROM empleado WHERE id=? LIMIT 1");
  $st->bind_param("i",$asignado_a);
  $st->execute();
  if (!$st->get_result()->fetch_row()) {
    $st->close(); $con->close();
    http_response_code(400);
    die(json_encode(["ok"=>false,"error"=>"asignado_a no existe"]));
  }
  $st->close();
}

/* Transacción: insert -> generar folio -> devolver registro */
$con->begin_transaction();

$sql = "INSERT INTO requerimiento (
          folio, departamento_id, tramite_id, asignado_a,
          asunto, descripcion, prioridad, estatus, canal,
          contacto_nombre, contacto_email, contacto_telefono,
          contacto_calle, contacto_colonia, contacto_cp,
          fecha_limite, status, created_by
        ) VALUES (
          '',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?
        )";

$st = $con->prepare($sql);
$st->bind_param(
  "iiissiiissssssssi",
  $departamento_id, $tramite_id, $asignado_a,
  $asunto, $descripcion, $prioridad, $estatus, $canal,
  $contacto_nombre, $contacto_email, $contacto_telefono,
  $contacto_calle, $contacto_colonia, $contacto_cp,
  $fecha_limite, $created_by
);

if (!$st->execute()) {
  $err = $st->error; $st->close(); $con->rollback(); $con->close();
  http_response_code(500);
  die(json_encode(["ok"=>false,"error"=>"Error al insertar: $err"]));
}

$new_id = $st->insert_id;
$st->close();

/* Folio amigable: REQ-0000000001 */
$st = $con->prepare("UPDATE requerimiento SET folio = CONCAT('REQ-', LPAD(?,10,'0')) WHERE id=?");
$st->bind_param("ii", $new_id, $new_id);
if (!$st->execute()) {
  $err = $st->error; $st->close(); $con->rollback(); $con->close();
  http_response_code(500);
  die(json_encode(["ok"=>false,"error"=>"Error al generar folio: $err"]));
}
$st->close();

$con->commit();

/* Recuperar registro enriquecido */
$q = $con->prepare("
  SELECT r.*,
         d.nombre AS departamento_nombre,
         t.nombre AS tramite_nombre,
         CONCAT(e.nombre,' ',e.apellidos) AS asignado_nombre_completo
  FROM requerimiento r
  JOIN departamento d ON d.id = r.departamento_id
  JOIN tramite t      ON t.id = r.tramite_id
  LEFT JOIN empleado e ON e.id = r.asignado_a
  WHERE r.id=? LIMIT 1
");
$q->bind_param("i",$new_id);
$q->execute();
$row = $q->get_result()->fetch_assoc();
$q->close(); $con->close();

if ($row) {
  $row['id'] = (int)$row['id'];
  $row['departamento_id'] = (int)$row['departamento_id'];
  $row['tramite_id'] = (int)$row['tramite_id'];
  $row['asignado_a'] = isset($row['asignado_a']) ? (int)$row['asignado_a'] : null;
  $row['prioridad'] = (int)$row['prioridad'];
  $row['estatus'] = (int)$row['estatus'];
  $row['canal'] = (int)$row['canal'];
  $row['status'] = (int)$row['status'];
}

echo json_encode(["ok"=>true,"data"=>$row]);

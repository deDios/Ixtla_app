<?php
header('Content-Type: application/json');
date_default_timezone_set('America/Mexico_City');

$path = realpath("/home/site/wwwroot/db/conn/conexion.php");
if ($path && file_exists($path)) { include $path; }
else {
  http_response_code(500);
  die(json_encode(["ok"=>false, "error"=>"No se encontró conexion.php en $path"]));
}

$in = json_decode(file_get_contents("php://input"), true) ?? [];

/* Requeridos mínimos según tu DDL actual */
$required = ['departamento_id','tramite_id','asunto','descripcion','contacto_nombre'];
foreach ($required as $k) {
  if (!isset($in[$k]) || $in[$k] === '') {
    http_response_code(400);
    die(json_encode(["ok"=>false, "error"=>"Falta parámetro obligatorio: $k"]));
  }
}

/* Inputs */
$folio            = (isset($in['folio']) && trim($in['folio']) !== '') ? trim($in['folio']) : null;
$departamento_id  = (int)$in['departamento_id'];
$tramite_id       = (int)$in['tramite_id'];
$asignado_a       = isset($in['asignado_a']) ? (int)$in['asignado_a'] : null;

$asunto           = trim($in['asunto']);
$descripcion      = trim($in['descripcion']);

$prioridad        = isset($in['prioridad']) ? (int)$in['prioridad'] : 2;
$estatus          = isset($in['estatus'])   ? (int)$in['estatus']   : 0;
$canal            = isset($in['canal'])     ? (int)$in['canal']     : 1;

$contacto_nombre  = trim($in['contacto_nombre']);
$contacto_email   = isset($in['contacto_email']) ? trim($in['contacto_email']) : null;
$contacto_tel     = isset($in['contacto_telefono']) ? trim($in['contacto_telefono']) : null;
$contacto_calle   = isset($in['contacto_calle']) ? trim($in['contacto_calle']) : null;
$contacto_colonia = isset($in['contacto_colonia']) ? trim($in['contacto_colonia']) : null;
$contacto_cp      = isset($in['contacto_cp']) ? trim($in['contacto_cp']) : null;

$fecha_limite     = isset($in['fecha_limite']) ? trim($in['fecha_limite']) : null;
$status           = isset($in['status']) ? (int)$in['status'] : 1;
$created_by       = isset($in['created_by']) ? (int)$in['created_by'] : null;

$con = conectar();
if (!$con) die(json_encode(["ok"=>false, "error"=>"No se pudo conectar a la base de datos"]));
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

/* INSERT simple (18 columnas/18 placeholders) */
$sql = "INSERT INTO requerimiento (
  folio, departamento_id, tramite_id, asignado_a,
  asunto, descripcion, prioridad, estatus, canal,
  contacto_nombre, contacto_email, contacto_telefono,
  contacto_calle, contacto_colonia, contacto_cp,
  fecha_limite, status, created_by
) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

$stmt = $con->prepare($sql);

/* 18 tipos para 18 variables, en el mismo orden */
$stmt->bind_param(
  "siiissiiisssssssii",
  $folio,            // s
  $departamento_id,  // i
  $tramite_id,       // i
  $asignado_a,       // i (puede ser NULL)
  $asunto,           // s
  $descripcion,      // s
  $prioridad,        // i
  $estatus,          // i
  $canal,            // i
  $contacto_nombre,  // s
  $contacto_email,   // s
  $contacto_tel,     // s
  $contacto_calle,   // s
  $contacto_colonia, // s
  $contacto_cp,      // s
  $fecha_limite,     // s
  $status,           // i
  $created_by        // i
);

if (!$stmt->execute()) {
  http_response_code(500);
  echo json_encode(["ok"=>false, "error"=>"Error al insertar: ".$stmt->error]);
  $stmt->close(); $con->close(); exit;
}

$new_id = $stmt->insert_id;
$stmt->close();

/* SELECT del registro recién creado (sin JOINs) */
$q = $con->prepare("SELECT * FROM requerimiento WHERE id=? LIMIT 1");
$q->bind_param("i", $new_id);
$q->execute();
$res = $q->get_result()->fetch_assoc();
$q->close(); $con->close();

/* Cast básicos */
$res['id']              = (int)$res['id'];
$res['departamento_id'] = (int)$res['departamento_id'];
$res['tramite_id']      = (int)$res['tramite_id'];
$res['prioridad']       = (int)$res['prioridad'];
$res['estatus']         = (int)$res['estatus'];
$res['canal']           = (int)$res['canal'];
$res['status']          = (int)$res['status'];

echo json_encode(["ok"=>true, "data"=>$res]);

<?php
// db/WEB/ixtla01_upd_requerimiento.php

// ===========================
// CORS
// ===========================
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === 'https://ixtla-app.com' || $origin === 'https://www.ixtla-app.com') {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400");
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

header('Content-Type: application/json');
date_default_timezone_set('America/Mexico_City');

// ===========================
// Conexión
// ===========================
$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) {
  include $path;
} else {
  http_response_code(500);
  die(json_encode(["ok"=>false,"error"=>"No se encontró la conexión a la BD"]));
}

$in = json_decode(file_get_contents("php://input"), true) ?? [];

// id obligatorio
if (!isset($in['id'])) {
  http_response_code(400);
  die(json_encode(["ok"=>false,"error"=>"Falta 'id'"]));
}

$id = (int)$in['id'];

// ===========================
// Inputs opcionales
// ===========================
$departamento_id = array_key_exists('departamento_id',$in) ? (int)$in['departamento_id'] : null;
$tramite_id      = array_key_exists('tramite_id',$in)      ? (int)$in['tramite_id']      : null;
$asignado_a      = array_key_exists('asignado_a',$in)      ? (int)$in['asignado_a']      : null;

$asunto       = $in['asunto']       ?? null;
$descripcion  = $in['descripcion']  ?? null;
$prioridad    = isset($in['prioridad']) ? (int)$in['prioridad'] : null;
$estatus      = isset($in['estatus'])   ? (int)$in['estatus']   : null;
$canal        = isset($in['canal'])     ? (int)$in['canal']     : null;

$contacto_nombre   = $in['contacto_nombre']   ?? null;
$contacto_email    = $in['contacto_email']    ?? null;
$contacto_telefono = $in['contacto_telefono'] ?? null;
$contacto_calle    = $in['contacto_calle']    ?? null;
$contacto_colonia  = $in['contacto_colonia']  ?? null;
$contacto_cp       = $in['contacto_cp']       ?? null;

// estas son las fechas que ahora vamos a usar
$fecha_limite = $in['fecha_limite'] ?? null;  // fecha de inicio
$cerrado_en   = $in['cerrado_en']   ?? null;  // fecha de fin

if ($fecha_limite === '') $fecha_limite = null;
if ($cerrado_en === '')   $cerrado_en   = null;

$clear_cerrado = isset($in['clear_cerrado']) ? (bool)$in['clear_cerrado'] : false;
$updated_by    = isset($in['updated_by']) ? (int)$in['updated_by'] : null;

// ===========================
// Abrir conexión
// ===========================
$con = conectar();
if (!$con) {
  die(json_encode(["ok"=>false,"error"=>"No se pudo conectar a la BD"]));
}
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

// ===========================
// Obtener estado actual
// ===========================
$st = $con->prepare("SELECT departamento_id, tramite_id, estatus, fecha_limite, cerrado_en FROM requerimiento WHERE id=?");
$st->bind_param("i",$id);
$st->execute();
$curr = $st->get_result()->fetch_assoc();
$st->close();

if (!$curr) {
  $con->close();
  echo json_encode(["ok"=>false,"error"=>"Requerimiento no encontrado"]);
  exit;
}

// ===========================
// Validaciones tramite / departamento
// ===========================
if ($tramite_id !== null) {
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

  $tra_dep = (int)$r['departamento_id'];

  if ($departamento_id !== null && $departamento_id !== $tra_dep) {
    $con->close();
    http_response_code(400);
    die(json_encode(["ok"=>false,"error"=>"El tramite_id no coincide con el departamento"]));
  }

  if ($departamento_id === null) {
    $departamento_id = $tra_dep;
  }
}

if ($departamento_id !== null) {
  $st = $con->prepare("SELECT 1 FROM departamento WHERE id=? LIMIT 1");
  $st->bind_param("i",$departamento_id);
  $st->execute();
  if (!$st->get_result()->fetch_row()) {
    $st->close(); $con->close();
    http_response_code(400);
    die(json_encode(["ok"=>false,"error"=>"departamento_id no existe"]));
  }
  $st->close();
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

// ===========================
// Lógica de fechas segun estatus
// ===========================
//
// Estatus (según front):
// 0 Solicitud
// 1 Revisión
// 2 Asignación
// 3 En proceso
// 4 Pausado
// 5 Cancelado
// 6 Finalizado
//
// - fecha_limite = fecha inicio del proceso
// - cerrado_en   = fecha fin (solo finalizado)
// ===========================

$set_cierre_automatico   = false;

// Si el estatus se mueve, aplicamos reglas
if ($estatus !== null) {
  // Cuando pasa a EN PROCESO (3) y no nos mandan fecha_limite,
  // seteamos "fecha inicio" con el NOW del servidor.
  if ($estatus === 3 && $fecha_limite === null) {
    $fecha_limite = date('Y-m-d H:i:s'); // equivalente a NOW() pero desde PHP con la TZ ya puesta
  }

  // Cuando pasa a FINALIZADO (6) y no viene cerrado_en ni se pidió limpiar
  if ($estatus === 6 && $cerrado_en === null && !$clear_cerrado) {
    $set_cierre_automatico = true; // usaremos CURRENT_TIMESTAMP en el UPDATE
  }
}

// ===========================
// Armado del UPDATE
// ===========================
$sql = "UPDATE requerimiento SET
          departamento_id = COALESCE(?, departamento_id),
          tramite_id      = COALESCE(?, tramite_id),
          asignado_a      = COALESCE(?, asignado_a),
          asunto          = COALESCE(?, asunto),
          descripcion     = COALESCE(?, descripcion),
          prioridad       = COALESCE(?, prioridad),
          estatus         = COALESCE(?, estatus),
          canal           = COALESCE(?, canal),
          contacto_nombre   = COALESCE(?, contacto_nombre),
          contacto_email    = COALESCE(?, contacto_email),
          contacto_telefono = COALESCE(?, contacto_telefono),
          contacto_calle    = COALESCE(?, contacto_calle),
          contacto_colonia  = COALESCE(?, contacto_colonia),
          contacto_cp       = COALESCE(?, contacto_cp),
          fecha_limite      = COALESCE(?, fecha_limite),
          updated_by        = COALESCE(?, updated_by),
          updated_at        = CURRENT_TIMESTAMP";

$params = [];
$types  = "";

// bind de los campos anteriores
$params[] = $departamento_id; $types .= "i";
$params[] = $tramite_id;      $types .= "i";
$params[] = $asignado_a;      $types .= "i";
$params[] = $asunto;          $types .= "s";
$params[] = $descripcion;     $types .= "s";
$params[] = $prioridad;       $types .= "i";
$params[] = $estatus;         $types .= "i";
$params[] = $canal;           $types .= "i";
$params[] = $contacto_nombre;   $types .= "s";
$params[] = $contacto_email;    $types .= "s";
$params[] = $contacto_telefono; $types .= "s";
$params[] = $contacto_calle;    $types .= "s";
$params[] = $contacto_colonia;  $types .= "s";
$params[] = $contacto_cp;       $types .= "s";
$params[] = $fecha_limite;      $types .= "s";
$params[] = $updated_by;        $types .= "i";

// ====== Lógica final para cerrado_en ======
if ($clear_cerrado) {
  // forzar NULL (reapertura, etc.)
  $sql .= ", cerrado_en = NULL";
} elseif ($cerrado_en !== null) {
  // si el cliente manda una fecha, se respeta
  $sql .= ", cerrado_en = ?";
  $params[] = $cerrado_en;
  $types   .= "s";
} elseif ($set_cierre_automatico) {
  // si pasó a estatus 6 y no mandó nada, ponemos CURRENT_TIMESTAMP
  $sql .= ", cerrado_en = CURRENT_TIMESTAMP";
}

$sql .= " WHERE id = ?";

$params[] = $id;
$types   .= "i";

// ===========================
// Ejecutar
// ===========================
$st = $con->prepare($sql);
$st->bind_param($types, ...$params);

if (!$st->execute()) {
  $err = $st->error;
  $st->close(); $con->close();
  http_response_code(500);
  die(json_encode(["ok"=>false,"error"=>"Error al actualizar: $err"]));
}
$st->close();

// ===========================
// Devolver registro actualizado
// ===========================
$q = $con->prepare("
  SELECT r.*,
         d.nombre AS departamento_nombre,
         t.nombre AS tramite_nombre,
         CONCAT(e.nombre,' ',e.apellidos) AS asignado_nombre_completo
  FROM requerimiento r
  LEFT JOIN departamento d ON d.id = r.departamento_id
  LEFT JOIN tramite t      ON t.id = r.tramite_id
  LEFT JOIN empleado e     ON e.id = r.asignado_a
  WHERE r.id = ?
  LIMIT 1
");
$q->bind_param("i",$id);
$q->execute();
$row = $q->get_result()->fetch_assoc();
$q->close();
$con->close();

if (!$row) {
  echo json_encode(["ok"=>false,"error"=>"No encontrado tras actualizar"]);
  exit;
}

// normalizar numéricos básicos
$row['id']              = (int)$row['id'];
$row['departamento_id'] = (int)$row['departamento_id'];
$row['tramite_id']      = (int)$row['tramite_id'];
$row['asignado_a']      = isset($row['asignado_a']) ? (int)$row['asignado_a'] : null;
$row['prioridad']       = (int)$row['prioridad'];
$row['estatus']         = (int)$row['estatus'];
$row['canal']           = (int)$row['canal'];
if (isset($row['status'])) {
  $row['status'] = (int)$row['status'];
}

echo json_encode(["ok"=>true,"data"=>$row]);

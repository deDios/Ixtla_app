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
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php"])); }

$in = json_decode(file_get_contents("php://input"), true) ?? [];
if (!isset($in['id'])) {
  http_response_code(400);
  die(json_encode(["ok"=>false,"error"=>"Falta parámetro obligatorio: id"]));
}

$id  = (int)$in['id'];


/* Inputs opcionales */
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

$fecha_limite = $in['fecha_limite'] ?? null;
$cerrado_en   = $in['cerrado_en']   ?? null; // puedes enviar timestamp ISO o dejar que lo asigne
$clear_cerrado= isset($in['clear_cerrado']) ? (bool)$in['clear_cerrado'] : false;

$updated_by   = isset($in['updated_by']) ? (int)$in['updated_by'] : null;

$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar"]));
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

/* Cargar estado actual */
$st = $con->prepare("SELECT departamento_id, tramite_id, estatus, cerrado_en FROM requerimiento WHERE id=?");
$st->bind_param("i",$id);
$st->execute();
$curr = $st->get_result()->fetch_assoc();
$st->close();
if (!$curr) { $con->close(); echo json_encode(["ok"=>false,"error"=>"No encontrado"]); exit; }

$dep_final = $curr['departamento_id'];
$tra_final = $curr['tramite_id'];

/* Validaciones y coherencia dep/trámite */
if ($tramite_id !== null) {
  $st = $con->prepare("SELECT departamento_id FROM tramite WHERE id=? LIMIT 1");
  $st->bind_param("i",$tramite_id);
  $st->execute();
  $r = $st->get_result()->fetch_assoc();
  $st->close();
  if (!$r) { $con->close(); http_response_code(400); die(json_encode(["ok"=>false,"error"=>"tramite_id no existe"])); }
  $tra_dep = (int)$r['departamento_id'];

  if ($departamento_id !== null && $departamento_id !== $tra_dep) {
    $con->close();
    http_response_code(400);
    die(json_encode(["ok"=>false,"error"=>"El tramite_id no pertenece al departamento_id enviado"]));
  }
  // si no mandó departamento_id, ajustamos al del trámite
  if ($departamento_id === null) { $departamento_id = $tra_dep; }

  $dep_final = $departamento_id;
  $tra_final = $tramite_id;
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

/* Lógica de cerrado_en */
$set_cierre_automatico = false;
if ($estatus !== null) {
  if (in_array($estatus, [2,3], true) && $cerrado_en === null && !$clear_cerrado) {
    $set_cierre_automatico = true;
  }
}

/* Armado del UPDATE */
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

/* Bind ordenado con lo anterior */
$params[] = $departamento_id; $types.="i";
$params[] = $tramite_id;      $types.="i";
$params[] = $asignado_a;      $types.="i";
$params[] = $asunto;          $types.="s";
$params[] = $descripcion;     $types.="s";
$params[] = $prioridad;       $types.="i";
$params[] = $estatus;         $types.="i";
$params[] = $canal;           $types.="i";
$params[] = $contacto_nombre;   $types.="s";
$params[] = $contacto_email;    $types.="s";
$params[] = $contacto_telefono; $types.="s";
$params[] = $contacto_calle;    $types.="s";
$params[] = $contacto_colonia;  $types.="s";
$params[] = $contacto_cp;       $types.="s";
$params[] = $fecha_limite;      $types.="s";
$params[] = $updated_by;        $types.="i";

/* cerrado_en: tres casos */
if ($clear_cerrado) {
  $sql .= ", cerrado_en = NULL";
} elseif ($cerrado_en !== null) {
  $sql .= ", cerrado_en = ?";
  $params[] = $cerrado_en; $types.="s";
} elseif ($set_cierre_automatico) {
  $sql .= ", cerrado_en = CURRENT_TIMESTAMP";
}

$sql .= " WHERE id = ?";

$params[] = $id; $types.="i";

$st = $con->prepare($sql);
$st->bind_param($types, ...$params);

if (!$st->execute()) {
  $err = $st->error; $st->close(); $con->close();
  http_response_code(500);
  die(json_encode(["ok"=>false,"error"=>"Error al actualizar: $err"]));
}
$st->close();

/* Devolver registro actualizado */
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
$q->bind_param("i",$id);
$q->execute();
$row = $q->get_result()->fetch_assoc();
$q->close(); $con->close();

if (!$row) { echo json_encode(["ok"=>false,"error"=>"No encontrado tras actualizar"]); exit; }

$row['id'] = (int)$row['id'];
$row['departamento_id'] = (int)$row['departamento_id'];
$row['tramite_id'] = (int)$row['tramite_id'];
$row['asignado_a'] = isset($row['asignado_a']) ? (int)$row['asignado_a'] : null;
$row['prioridad'] = (int)$row['prioridad'];
$row['estatus'] = (int)$row['estatus'];
$row['canal'] = (int)$row['canal'];
$row['status'] = (int)$row['status'];

echo json_encode(["ok"=>true,"data"=>$row]);

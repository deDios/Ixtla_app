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

/* Requeridos mínimos (acorde al DDL con NOT NULL) */
$required = ['departamento_id','tramite_id','asunto','descripcion','contacto_nombre'];
foreach ($required as $k) {
  if (!isset($in[$k]) || $in[$k] === '') {
    http_response_code(400);
    die(json_encode(["ok"=>false, "error"=>"Falta parámetro obligatorio: $k"]));
  }
}

/* Inputs */
$departamento_id  = (int)$in['departamento_id'];
$tramite_id       = (int)$in['tramite_id'];
$asignado_a       = isset($in['asignado_a']) ? (int)$in['asignado_a'] : null;

$asunto           = trim($in['asunto']);
$descripcion      = trim($in['descripcion']);

$prioridad        = isset($in['prioridad']) ? (int)$in['prioridad'] : 2;  // 1-3
$estatus          = isset($in['estatus'])   ? (int)$in['estatus']   : 0;  // 0-4
$canal            = isset($in['canal'])     ? (int)$in['canal']     : 1;  // 1-4

$contacto_nombre  = trim($in['contacto_nombre']);
$contacto_email   = isset($in['contacto_email']) ? trim($in['contacto_email']) : null;
$contacto_tel     = isset($in['contacto_telefono']) ? trim($in['contacto_telefono']) : null;
$contacto_calle   = isset($in['contacto_calle']) ? trim($in['contacto_calle']) : null;
$contacto_colonia = isset($in['contacto_colonia']) ? trim($in['contacto_colonia']) : null;
$contacto_cp      = isset($in['contacto_cp']) ? trim($in['contacto_cp']) : null;

$fecha_limite     = isset($in['fecha_limite']) ? trim($in['fecha_limite']) : null;
$status           = isset($in['status']) ? (int)$in['status'] : 1;
$created_by       = isset($in['created_by']) ? (int)$in['created_by'] : null;

/* Conexión */
$con = conectar();
if (!$con) die(json_encode(["ok"=>false, "error"=>"No se pudo conectar a la base de datos"]));
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

/* ===== Validaciones de integridad (FKs) ===== */

/* 1) Departamento existe */
$st = $con->prepare("SELECT 1 FROM departamento WHERE id=? LIMIT 1");
$st->bind_param("i", $departamento_id);
$st->execute();
if (!$st->get_result()->fetch_row()) {
  $st->close(); $con->close();
  http_response_code(400);
  die(json_encode(["ok"=>false, "error"=>"departamento_id no existe"]));
}
$st->close();

/* 2) Trámite existe y pertenece al departamento */
$st = $con->prepare("SELECT departamento_id FROM tramite WHERE id=? LIMIT 1");
$st->bind_param("i", $tramite_id);
$st->execute();
$row_t = $st->get_result()->fetch_assoc();
$st->close();

if (!$row_t) {
  $con->close();
  http_response_code(400);
  die(json_encode(["ok"=>false, "error"=>"tramite_id no existe"]));
}
if ((int)$row_t['departamento_id'] !== $departamento_id) {
  $con->close();
  http_response_code(400);
  die(json_encode(["ok"=>false, "error"=>"El tramite_id no pertenece al departamento_id enviado"]));
}

/* 3) Empleado (asignado_a) si viene */
if ($asignado_a !== null) {
  $st = $con->prepare("SELECT 1 FROM empleado WHERE id=? LIMIT 1");
  $st->bind_param("i", $asignado_a);
  $st->execute();
  if (!$st->get_result()->fetch_row()) {
    $st->close(); $con->close();
    http_response_code(400);
    die(json_encode(["ok"=>false, "error"=>"asignado_a no existe"]));
  }
  $st->close();
}

/* ===== Transacción: INSERT con folio temporal único -> UPDATE a folio final ===== */
$con->begin_transaction();

/* Importante:
   - folio tiene UNIQUE y NOT NULL.
   - Evitamos colisión insertando primero un folio temporal único (TMP-UUID_SHORT()).
   - Luego actualizamos a REQ-0000000001 basado en id. */
$sql = "INSERT INTO requerimiento (
  folio, departamento_id, tramite_id, asignado_a,
  asunto, descripcion, prioridad, estatus, canal,
  contacto_nombre, contacto_email, contacto_telefono,
  contacto_calle, contacto_colonia, contacto_cp,
  fecha_limite, status, created_by
) VALUES (CONCAT('TMP-', UUID_SHORT()), ?,?,?, ?,?, ?,?, ?, ?,?,?, ?,?,?, ?, ?, ?)";

$st = $con->prepare($sql);
$st->bind_param(
  "iiissiiisssssssii",
  $departamento_id, $tramite_id, $asignado_a,
  $asunto, $descripcion, $prioridad, $estatus, $canal,
  $contacto_nombre, $contacto_email, $contacto_tel,
  $contacto_calle, $contacto_colonia, $contacto_cp,
  $fecha_limite, $status, $created_by
);

if (!$st->execute()) {
  $err = $st->error; $code = $st->errno;
  $st->close(); $con->rollback(); $con->close();
  // 1452 = FK; 3819/4025 = CHECK; 1062 = UNIQUE
  http_response_code(400);
  die(json_encode(["ok"=>false, "error"=>"Error al insertar", "detail"=>$err, "code"=>$code]));
}
$new_id = $st->insert_id;
$st->close();

/* Folio final: REQ-0000000001 */
$st = $con->prepare("UPDATE requerimiento SET folio = CONCAT('REQ-', LPAD(?,10,'0')) WHERE id=?");
$st->bind_param("ii", $new_id, $new_id);
if (!$st->execute()) {
  $err = $st->error; $code = $st->errno;
  $st->close(); $con->rollback(); $con->close();
  http_response_code(500);
  die(json_encode(["ok"=>false, "error"=>"Error al generar folio", "detail"=>$err, "code"=>$code]));
}
$st->close();

$con->commit();

/* ===== Recuperar registro para respuesta ===== */
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
$q->bind_param("i", $new_id);
$q->execute();
$res = $q->get_result()->fetch_assoc();
$q->close();

/* ---------- Envío de WhatsApp (no bloqueante) ---------- */
function to_e164_mx($tel) {
  $d = preg_replace('/\D+/', '', (string)$tel);
  if (preg_match('/^52\d{10}$/', $d)) return $d;        // ya viene con 52
  if (preg_match('/^\d{10}$/', $d))   return '52'.$d;   // agrega 52
  if (preg_match('/^\d{11,15}$/', $d)) return $d;       // otros países ya en E.164
  return null;
}

$wa = ["called" => false];

if ($res && !empty($res['contacto_telefono'])) {
  $to = to_e164_mx($res['contacto_telefono']);
  if ($to) {
    $waPayload = [
      "to"       => $to,
      "template" => "req_01",       // tu plantilla con {{1}}
      "lang"     => "es_MX",
      "params"   => [$res['folio']] // {{1}} = folio
    ];

    $waUrl = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/send_wapp_template_01.php";
    $ch = curl_init($waUrl);
    curl_setopt_array($ch, [
      CURLOPT_HTTPHEADER     => ["Content-Type: application/json"],
      CURLOPT_POST           => true,
      CURLOPT_POSTFIELDS     => json_encode($waPayload, JSON_UNESCAPED_UNICODE),
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_CONNECTTIMEOUT => 2,   // no se quede colgado
      CURLOPT_TIMEOUT        => 5
    ]);
    $waResp = curl_exec($ch);
    $waCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $waErr  = curl_error($ch);
    curl_close($ch);

    $wa["called"]    = true;
    $wa["http_code"] = $waCode ?: null;
    $wa["error"]     = $waErr ?: null;
    // Opcional: parsea si tu sender responde JSON con success/message_id
    $waDecoded = json_decode($waResp, true);
    if (is_array($waDecoded)) $wa["response"] = $waDecoded;
  } else {
    $wa["skipped"] = "Telefono no válido para E.164";
  }
}

$con->close();

/* Cast numéricos para data */
if ($res) {
  $res['id']              = (int)$res['id'];
  $res['departamento_id'] = (int)$res['departamento_id'];
  $res['tramite_id']      = (int)$res['tramite_id'];
  $res['asignado_a']      = isset($res['asignado_a']) ? (int)$res['asignado_a'] : null;
  $res['prioridad']       = (int)$res['prioridad'];
  $res['estatus']         = (int)$res['estatus'];
  $res['canal']           = (int)$res['canal'];
  $res['status']          = (int)$res['status'];
}

http_response_code(201);
echo json_encode(["ok"=>true, "data"=>$res, "wa"=>$wa], JSON_UNESCAPED_UNICODE);

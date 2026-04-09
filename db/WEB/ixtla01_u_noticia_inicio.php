<?php
/* =========================================================
   Actualizar noticia de inicio
   db/WEB/ixtla01_u_noticia_inicio.php
   ========================================================= */

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

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { 
  include $path; 
} else { 
  http_response_code(500); 
  die(json_encode(["ok" => false, "error" => "No se encontró conexion.php"])); 
}

$input = json_decode(file_get_contents("php://input"), true) ?? [];

if (!isset($input['id']) || (int)$input['id'] <= 0) {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Falta parámetro obligatorio: id"]));
}

$id             = (int)$input['id'];
$titulo         = array_key_exists('titulo', $input) ? trim((string)$input['titulo']) : null;
$pie_de_pagina  = array_key_exists('pie_de_pagina', $input)
  ? (trim((string)$input['pie_de_pagina']) !== '' ? trim((string)$input['pie_de_pagina']) : null)
  : null;
$descripcion    = array_key_exists('descripcion', $input) ? trim((string)$input['descripcion']) : null;
$status         = array_key_exists('status', $input) ? (int)$input['status'] : null;
$updated_by     = array_key_exists('updated_by', $input) ? (int)$input['updated_by'] : null;

$con = conectar();
if (!$con) {
  die(json_encode(["ok" => false, "error" => "No se pudo conectar"]));
}
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

/* Validar status si viene */
if ($status !== null && !in_array($status, [0, 1], true)) {
  http_response_code(400);
  $con->close();
  die(json_encode(["ok" => false, "error" => "Valor de 'status' inválido"]));
}

/* Validar updated_by si viene */
if ($updated_by !== null) {
  $val = $con->prepare("SELECT 1 FROM empleado WHERE id = ? LIMIT 1");
  if (!$val) {
    http_response_code(500);
    $con->close();
    die(json_encode(["ok" => false, "error" => "Error al preparar validación de updated_by"]));
  }

  $val->bind_param("i", $updated_by);
  $val->execute();

  if (!$val->get_result()->fetch_row()) {
    http_response_code(400);
    $val->close();
    $con->close();
    die(json_encode(["ok" => false, "error" => "El updated_by no existe"]));
  }
  $val->close();
}

$sql = "UPDATE noticia_inicio SET
          titulo         = COALESCE(?, titulo),
          pie_de_pagina  = COALESCE(?, pie_de_pagina),
          descripcion    = COALESCE(?, descripcion),
          status         = COALESCE(?, status),
          updated_by     = COALESCE(?, updated_by),
          updated_at     = CURRENT_TIMESTAMP
        WHERE id = ?";

$st = $con->prepare($sql);
if (!$st) {
  http_response_code(500);
  $con->close();
  die(json_encode(["ok" => false, "error" => "Error al preparar actualización"]));
}

$st->bind_param("sssiii", $titulo, $pie_de_pagina, $descripcion, $status, $updated_by, $id);

if (!$st->execute()) {
  $err = $st->error;
  $code = $st->errno;
  $st->close();
  $con->close();

  http_response_code(500);
  die(json_encode([
    "ok" => false,
    "error" => "Error al actualizar: $err",
    "code" => $code
  ]));
}
$st->close();

/* Devolver registro actualizado */
$q = $con->prepare("
  SELECT n.*
  FROM noticia_inicio n
  WHERE n.id = ? LIMIT 1
");

if (!$q) {
  http_response_code(500);
  $con->close();
  die(json_encode(["ok" => false, "error" => "Error al preparar consulta del registro actualizado"]));
}

$q->bind_param("i", $id);
$q->execute();
$row = $q->get_result()->fetch_assoc();
$q->close();
$con->close();

if (!$row) {
  echo json_encode(["ok" => false, "error" => "No encontrado tras actualizar"]);
  exit;
}

$row['id'] = (int)$row['id'];
$row['status'] = (int)$row['status'];
$row['creado_por'] = (int)$row['creado_por'];
$row['updated_by'] = isset($row['updated_by']) ? (int)$row['updated_by'] : null;

echo json_encode(["ok" => true, "data" => $row]);
<?php
/* =========================================================
   Insertar noticia de inicio
   db/WEB/ixtla01_i_noticia_inicio.php
   ========================================================= */

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
if ($path && file_exists($path)) { 
  include $path; 
} else { 
  http_response_code(500); 
  die(json_encode(["ok" => false, "error" => "No se encontró conexion.php en $path"])); 
}

$input = json_decode(file_get_contents("php://input"), true) ?? [];

/* Requeridos */
$required = ['titulo', 'descripcion', 'creado_por'];
foreach ($required as $k) {
  if (!isset($input[$k]) || trim((string)$input[$k]) === '') {
    http_response_code(400);
    die(json_encode(["ok" => false, "error" => "Falta parámetro obligatorio: $k"]));
  }
}

/* Inputs */
$titulo         = trim((string)$input['titulo']);
$pie_de_pagina  = isset($input['pie_de_pagina']) && trim((string)$input['pie_de_pagina']) !== ''
  ? trim((string)$input['pie_de_pagina'])
  : null;
$descripcion    = trim((string)$input['descripcion']);
$status         = isset($input['status']) ? (int)$input['status'] : 1;
$creado_por     = (int)$input['creado_por'];

$con = conectar();
if (!$con) {
  die(json_encode(["ok" => false, "error" => "No se pudo conectar a la base de datos"]));
}
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

/* Validar status */
if (!in_array($status, [0, 1], true)) {
  http_response_code(400);
  $con->close();
  die(json_encode(["ok" => false, "error" => "Valor de 'status' inválido"]));
}

/* Validar existencia de creado_por */
$val = $con->prepare("SELECT 1 FROM empleado WHERE id = ? LIMIT 1");
if (!$val) {
  http_response_code(500);
  $con->close();
  die(json_encode(["ok" => false, "error" => "Error al preparar validación de creado_por"]));
}

$val->bind_param("i", $creado_por);
$val->execute();

if (!$val->get_result()->fetch_row()) {
  http_response_code(400);
  $val->close();
  $con->close();
  die(json_encode(["ok" => false, "error" => "El creado_por no existe"]));
}
$val->close();

/* Insert */
$sql = "INSERT INTO noticia_inicio (titulo, pie_de_pagina, descripcion, status, creado_por)
        VALUES (?, ?, ?, ?, ?)";
$stmt = $con->prepare($sql);

if (!$stmt) {
  http_response_code(500);
  $con->close();
  die(json_encode(["ok" => false, "error" => "Error al preparar inserción"]));
}

$stmt->bind_param("sssii", $titulo, $pie_de_pagina, $descripcion, $status, $creado_por);

if (!$stmt->execute()) {
  $err = $stmt->error;
  $code = $stmt->errno;
  $stmt->close();
  $con->close();

  http_response_code(500);
  die(json_encode([
    "ok" => false,
    "error" => "Error al insertar: $err",
    "code" => $code
  ]));
}

$new_id = $stmt->insert_id;
$stmt->close();

/* Devolver registro insertado */
$q = $con->prepare("
  SELECT n.*
  FROM noticia_inicio n
  WHERE n.id = ? LIMIT 1
");

if (!$q) {
  http_response_code(500);
  $con->close();
  die(json_encode(["ok" => false, "error" => "Error al preparar consulta del nuevo registro"]));
}

$q->bind_param("i", $new_id);
$q->execute();
$row = $q->get_result()->fetch_assoc();
$q->close();
$con->close();

if (!$row) {
  http_response_code(500);
  die(json_encode(["ok" => false, "error" => "No se pudo recuperar la noticia insertada"]));
}

$row['id'] = (int)$row['id'];
$row['status'] = (int)$row['status'];
$row['creado_por'] = (int)$row['creado_por'];
$row['updated_by'] = isset($row['updated_by']) ? (int)$row['updated_by'] : null;

http_response_code(201);
echo json_encode(["ok" => true, "data" => $row]);
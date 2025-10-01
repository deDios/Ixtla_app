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
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php en $path"])); }

$in = json_decode(file_get_contents("php://input"), true) ?? [];

/* Requeridos mínimos */
$required = ['titulo','descripcion'];
foreach ($required as $k) {
  if (!isset($in[$k]) || trim($in[$k]) === '') {
    http_response_code(400);
    die(json_encode(["ok"=>false,"error"=>"Falta parámetro obligatorio: $k"]));
  }
}

/* Inputs */
$titulo        = trim($in['titulo']);
$descripcion   = trim($in['descripcion']);
$fecha_evento  = isset($in['fecha_evento']) && trim($in['fecha_evento']) !== '' ? trim($in['fecha_evento']) : null; // 'YYYY-MM-DD' o null
$estatus       = isset($in['estatus']) ? (int)$in['estatus'] : 0;   // 0 borrador, 1 publicada, 2 archivada
$status        = isset($in['status'])  ? (int)$in['status']  : 1;   // 1 activo
$created_by    = isset($in['created_by']) ? (int)$in['created_by'] : null;

$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]));
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

/* INSERT */
$sql = "INSERT INTO noticia (titulo, descripcion, fecha_evento, estatus, status, created_by)
        VALUES (?,?,?,?,?,?)";
$stmt = $con->prepare($sql);
$stmt->bind_param("sssiii", $titulo, $descripcion, $fecha_evento, $estatus, $status, $created_by);

if (!$stmt->execute()) {
  $code = $stmt->errno; $err = $stmt->error;
  $stmt->close(); $con->close();
  // 3819/4025 = CHECK (estatus inválido)
  if ($code == 3819 || $code == 4025) { http_response_code(400); die(json_encode(["ok"=>false,"error"=>"Valor de 'estatus' inválido","code"=>$code])); }
  http_response_code(500); die(json_encode(["ok"=>false,"error"=>"Error al insertar: $err","code"=>$code]));
}

$new_id = $stmt->insert_id;
$stmt->close();

/* SELECT del nuevo */
$q = $con->prepare("SELECT * FROM noticia WHERE id=? LIMIT 1");
$q->bind_param("i", $new_id);
$q->execute();
$res = $q->get_result()->fetch_assoc();
$q->close(); $con->close();

$res['id']     = (int)$res['id'];
$res['estatus']= (int)$res['estatus'];
$res['status'] = (int)$res['status'];

http_response_code(201);
echo json_encode(["ok"=>true,"data"=>$res]);

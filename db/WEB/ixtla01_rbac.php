<?php
// DB/WEB/ixtla01_rbac.php

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = [
  'https://ixtla-app.com',
  'https://www.ixtla-app.com'
];

if (in_array($origin, $allowed, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Access-Control-Allow-Credentials: true");
  header("Vary: Origin");
}

header("Access-Control-Allow-Methods: POST, OPTIONS");

$reqHeaders = $_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'] ?? '';
if ($reqHeaders) {
  header("Access-Control-Allow-Headers: $reqHeaders");
} else {
  header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept");
}

header("Access-Control-Max-Age: 86400");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('America/Mexico_City');

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) {
  include $path;
} else {
  http_response_code(500);
  die(json_encode([
    "ok" => false,
    "error" => "No se encontró conn_db.php"
  ]));
}

$tools = realpath("/home/site/wwwroot/db/WEB/tools_105277.php");
if ($tools && file_exists($tools)) {
  require_once $tools;
} else {
  http_response_code(500);
  die(json_encode([
    "ok" => false,
    "error" => "No se encontró tools_105277.php"
  ]));
}

$input = json_decode(file_get_contents("php://input"), true) ?? [];

$empleadoId = isset($input['empleado_id']) ? (int)$input['empleado_id'] : 0;

if ($empleadoId <= 0) {
  http_response_code(400);
  echo json_encode([
    "ok" => false,
    "error" => "empleado_id es requerido y debe ser un entero válido"
  ]);
  exit;
}

$con = conectar();
if (!$con) {
  http_response_code(500);
  echo json_encode([
    "ok" => false,
    "error" => "No se pudo conectar a la base de datos"
  ]);
  exit;
}

$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

try {
  $rbac = rbac_compute_by_empleado_id($con, $empleadoId, [
    "presidencia_dept_ids" => [6]
  ]);

  if (!$rbac) {
    http_response_code(404);
    echo json_encode([
      "ok" => false,
      "error" => "Empleado no encontrado"
    ]);
    $con->close();
    exit;
  }

  echo json_encode([
    "ok" => true,
    "data" => $rbac
  ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode([
    "ok" => false,
    "error" => "Error interno al calcular RBAC",
    "detail" => $e->getMessage()
  ], JSON_UNESCAPED_UNICODE);
} finally {
  $con->close();
}
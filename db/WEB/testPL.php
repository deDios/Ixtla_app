<?php
//pequeño test para obtener al PL de cada departamento
// DB/WEB/testPL.php
header("Content-Type: application/json; charset=utf-8");

require_once __DIR__ . "/../conn/conn_db.php";   // conexion a la db
require_once __DIR__ . "/tools.php";     // gepplbydepartamento

/**
 * Lee JSON del body
 */
$raw = file_get_contents("php://input");
$in = json_decode($raw, true);

if (!is_array($in)) {
  http_response_code(400);
  echo json_encode([
    "ok" => false,
    "error" => "Body JSON inválido",
    "raw" => $raw
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

$departamentoId = isset($in["departamento_id"]) ? (int)$in["departamento_id"] : 0;
if ($departamentoId <= 0) {
  http_response_code(400);
  echo json_encode([
    "ok" => false,
    "error" => "Falta departamento_id (int > 0)"
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

// Abre conexión 
$con = conectar(); 

$pl = getPLByDepartamento($con, $departamentoId);

// Opcional: cerrar conexión
// $con->close();

echo json_encode([
  "ok" => true,
  "departamento_id" => $departamentoId,
  "pl" => $pl
], JSON_UNESCAPED_UNICODE);
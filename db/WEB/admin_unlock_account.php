<?php
header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('America/Mexico_City');

require_once __DIR__ . '/../conn/conn_db.php';
$con = conectar(); if (!$con) { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"DB down"])); }
$con->set_charset('utf8mb4');

/* TODO: Verifica rol ADMIN en sesión */

$in = json_decode(file_get_contents('php://input'), true) ?? [];
$username  = isset($in['username']) ? trim($in['username']) : '';

if ($username==='') {
  http_response_code(400);
  die(json_encode(["ok"=>false,"error"=>"username es requerido"]));
}

$sql = "
  UPDATE empleado_cuenta
  SET intentos_fallidos = 0,
      bloqueado_hasta   = NULL,
      updated_at        = NOW()
  WHERE username = ?
  LIMIT 1";
$st = $con->prepare($sql);
$st->bind_param("s", $username);
$st->execute();

$rows = $st->affected_rows;
$st->close(); $con->close();

if ($rows === 1) echo json_encode(["ok"=>true, "message"=>"Cuenta desbloqueada"]);
else { http_response_code(404); echo json_encode(["ok"=>false,"error"=>"Usuario no encontrado"]); }

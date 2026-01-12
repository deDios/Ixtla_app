<?php
header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('America/Mexico_City');

require_once __DIR__ . '/../conn/conn_db.php'; // ajusta la ruta
$con = conectar(); if (!$con) { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"DB down"])); }
$con->set_charset('utf8mb4');

/* TODO: Verifica que el usuario en sesión tenga rol ADMIN */

$in = json_decode(file_get_contents('php://input'), true) ?? [];
$username   = isset($in['username']) ? trim($in['username']) : '';
$newPw      = isset($in['new_password']) ? (string)$in['new_password'] : '';
$updatedBy  = isset($in['updated_by']) ? (int)$in['updated_by'] : null; // id del admin

if ($username==='' || $newPw==='') {
  http_response_code(400);
  die(json_encode(["ok"=>false,"error"=>"username y new_password son requeridos"]));
}

/* Política mínima de contraseña (puedes ampliar) */
if (strlen($newPw) < 8) {
  http_response_code(400);
  die(json_encode(["ok"=>false,"error"=>"La contraseña debe tener al menos 8 caracteres"]));
}

$hash = password_hash($newPw, PASSWORD_DEFAULT);

$sql = "
  UPDATE empleado_cuenta
  SET password_hash     = ?,
      debe_cambiar_pw   = 1,
      intentos_fallidos = 0,
      bloqueado_hasta   = NULL,
      updated_at        = NOW(),
      updated_by        = ?
  WHERE username = ? AND status = 1
  LIMIT 1";
$st = $con->prepare($sql);
$st->bind_param("sis", $hash, $updatedBy, $username);
$st->execute();

$rows = $st->affected_rows;
$st->close(); $con->close();

if ($rows === 1) echo json_encode(["ok"=>true, "message"=>"Password reseteada. El usuario deberá cambiarla al iniciar sesión."]);
else { http_response_code(404); echo json_encode(["ok"=>false,"error"=>"Usuario no encontrado o inactivo"]); }

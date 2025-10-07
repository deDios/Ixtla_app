<?php
header('Content-Type: application/json; charset=utf-8');
$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && is_file($path)) { include_once $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conn_db.php en $path"])); }
if (!function_exists('conectar')) { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"conectar() no definida"])); }

$con = conectar(); $con->set_charset('utf8mb4');

$in = json_decode(file_get_contents('php://input'), true) ?: [];
$conv_id = (int)($in['conversation_id'] ?? 0);
$text    = trim($in['text'] ?? '');
if (!$conv_id || $text==='') { http_response_code(400); die(json_encode(["ok"=>false,"error"=>"Datos incompletos"])); }

$st=$con->prepare("SELECT c.id, c.last_incoming_at, ct.wa_phone FROM conversations c JOIN contacts ct ON ct.id=c.contact_id WHERE c.id=?");
$st->bind_param('i',$conv_id); $st->execute(); $row=$st->get_result()->fetch_assoc(); $st->close();
if (!$row) { http_response_code(404); die(json_encode(["ok"=>false,"error"=>"Conversación no encontrada"])); }

$within24 = false;
if (!empty($row['last_incoming_at'])) $within24 = (time()-strtotime($row['last_incoming_at'])) <= 24*3600;
if (!$within24) { http_response_code(409); die(json_encode(["ok"=>false,"needs_template"=>true,"msg"=>"Ventana cerrada. Usa plantilla."])); }

$payload = ["to"=>$row['wa_phone'], "text"=>["body"=>$text, "preview_url"=>false]];
$url = "https://TU_DOMINIO/db/WEB/send_wapp_text.php";

$ch=curl_init($url);
curl_setopt_array($ch,[
  CURLOPT_HTTPHEADER=>["Content-Type: application/json"],
  CURLOPT_POST=>true,
  CURLOPT_POSTFIELDS=>json_encode($payload, JSON_UNESCAPED_UNICODE),
  CURLOPT_RETURNTRANSFER=>true,
  CURLOPT_TIMEOUT=>20
]);
$resp=curl_exec($ch); $http=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
$obj=json_decode($resp,true)?:[]; $ok=!empty($obj['success']);
if(!$ok){ http_response_code($http?:500); die(json_encode(["ok"=>false,"error"=>$obj['error']??'falló envío'])); }

$mid=$obj['message_id']??null; $raw=json_encode($obj,JSON_UNESCAPED_UNICODE);
$st=$con->prepare("INSERT INTO messages(conversation_id,direction,wa_message_id,msg_type,text,raw_json) VALUES(?, 'out', ?, 'text', ?, ?)");
$st->bind_param('isss',$conv_id,$mid,$text,$raw); $st->execute(); $st->close();

$con->query("UPDATE conversations SET last_outgoing_at=NOW(), updated_at=NOW() WHERE id={$conv_id}");
echo json_encode(["ok"=>true,"message_id"=>$mid], JSON_UNESCAPED_UNICODE);

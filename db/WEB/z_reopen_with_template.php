<?php
header('Content-Type: application/json; charset=utf-8');
$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && is_file($path)) { include_once $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conn_db.php en $path"])); }
if (!function_exists('conectar')) { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"conectar() no definida"])); }

$con = conectar(); $con->set_charset('utf8mb4');

$in=json_decode(file_get_contents('php://input'),true)?:[];
$conv_id=(int)($in['conversation_id']??0);
$tpl=$in['template']??'req_01';
$params=$in['params']??[];

$st=$con->prepare("SELECT c.id, ct.wa_phone FROM conversations c JOIN contacts ct ON ct.id=c.contact_id WHERE c.id=?");
$st->bind_param('i',$conv_id); $st->execute(); $row=$st->get_result()->fetch_assoc(); $st->close();
if(!$row){ http_response_code(404); die(json_encode(["ok"=>false,"error"=>"Conversación no encontrada"])); }

$payload=["to"=>$row['wa_phone'],"template"=>$tpl,"lang"=>"es_MX","params"=>$params];
$url="https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/send_wapp_template_01.php";

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
if(!$ok){ http_response_code($http?:500); die(json_encode(["ok"=>false,"error"=>$obj['error']??'falló plantilla'])); }

$mid=$obj['message_id']??null; $txt="(tpl:$tpl) ".implode(' | ',$params); $raw=json_encode($obj,JSON_UNESCAPED_UNICODE);
$st=$con->prepare("INSERT INTO messages(conversation_id,direction,wa_message_id,msg_type,text,raw_json) VALUES(?, 'out', ?, 'template', ?, ?)");
$st->bind_param('isss',$conv_id,$mid,$txt,$raw); $st->execute(); $st->close();

echo json_encode(["ok"=>true,"message_id"=>$mid], JSON_UNESCAPED_UNICODE);

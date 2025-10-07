<?php
header('Content-Type: application/json; charset=utf-8');

// Pega tus credenciales reales:
const TOKEN = 'EAAJkMnC6uM0BPqQCodL4nN6rzpdfZBQrALZAtgZAWWLoa1RfDvCAnWw3oO44bSpCUzijKQiIPlpu4ecbY0uRxlfO8BTJs1PBPvBhLGP4RVZCt07YZCMAcahYL1Yiaw2gCRdZBb1og7YzDa4cG9BBFQj5XBd05MzQ8jiLaAOyWhVRBxUZCSW9IuvYyjfReKUAgZDZD';
const PHONE_NUMBER_ID = '782524058283433';


$in=json_decode(file_get_contents('php://input'),true)?:[];
$wamid=$in['wa_message_id']??null;
if(!$wamid){ http_response_code(400); die(json_encode(["ok"=>false,"error"=>"Falta wa_message_id"])); }

$url="https://graph.facebook.com/v20.0/".PHONE_NUMBER_ID."/messages";
$payload=["messaging_product"=>"whatsapp","status"=>"read","message_id"=>$wamid];

$ch=curl_init($url);
curl_setopt_array($ch,[
  CURLOPT_HTTPHEADER=>[
    "Authorization: Bearer ".TOKEN,
    "Content-Type: application/json"
  ],
  CURLOPT_POST=>true,
  CURLOPT_POSTFIELDS=>json_encode($payload),
  CURLOPT_RETURNTRANSFER=>true,
  CURLOPT_TIMEOUT=>15
]);
$r=curl_exec($ch); $http=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
echo json_encode(["ok"=>($http>=200&&$http<300)]);

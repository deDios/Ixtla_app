<?php
header('Content-Type: application/json; charset=utf-8');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === 'https://ixtla-app.com' || $origin === 'https://www.ixtla-app.com') {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400");
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

// Pega tus credenciales reales:
const TOKEN = 'EAAJkMnC6uM0BPt4PJyZBBLzp47PMRhRlKa6zvbvIH5fIPWLwfGysAeTbR0XVqN2SPP2ImmerKXE3kvQos9IJZA4IM8oyENM1MgB0iIbTHZAB1UFeGJs6K35EmFZA4zHHUt788Q2zntuFC84PeyzTgeMO0tVbSpQCBHeizsueV4eXDtZBzUtkMDxZBiWLMUvAZDZD';
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

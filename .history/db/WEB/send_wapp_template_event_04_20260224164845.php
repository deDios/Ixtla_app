<?php
//db\WEB\send_wapp_template_event_04.php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === 'https://ixtla-app.com' || $origin === 'https://www.ixtla-app.com') {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400");
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }


const WHATSAPP_TOKEN = 'EAAJkMnC6uM0BPt4PJyZBBLzp47PMRhRlKa6zvbvIH5fIPWLwfGysAeTbR0XVqN2SPP2ImmerKXE3kvQos9IJZA4IM8oyENM1MgB0iIbTHZAB1UFeGJs6K35EmFZA4zHHUt788Q2zntuFC84PeyzTgeMO0tVbSpQCBHeizsueV4eXDtZBzUtkMDxZBiWLMUvAZDZD';
const WHATSAPP_PHONE_NUMBER_ID = '782524058283433'; 

header("Content-Type: application/json; charset=utf-8");

$raw = file_get_contents("php://input");
$input = $raw ? json_decode($raw, true) : $_POST;


$to       = trim($input["to"] ?? "");
$template = trim($input["template"] ?? "");
$lang     = trim($input["lang"] ?? "es_MX");
$params   = $input["params"] ?? []; 


$errors = [];

if (!WHATSAPP_TOKEN) {
  $errors[] = "Falta WHATSAPP_TOKEN (define la constante en el archivo).";
}
if (!WHATSAPP_PHONE_NUMBER_ID) {
  $errors[] = "Falta WHATSAPP_PHONE_NUMBER_ID (define la constante en el archivo).";
}

// Validaciones de entrada
if (!$to)       $errors[] = "El campo 'to' es obligatorio (formato E.164, solo dígitos).";
if (!$template) $errors[] = "El campo 'template' es obligatorio.";

$to_digits = preg_replace('/\D+/', '', $to);
if ($to_digits !== $to) {
  $to = $to_digits; 
}
if (!preg_match('/^\d{10,15}$/', $to)) {
  $errors[] = "El teléfono debe estar en E.164 sin signos: ej. 52133XXXXXXXX (10 a 15 dígitos).";
}

if ($template && !preg_match('/^[a-z0-9_]+$/', $template)) {
  $errors[] = "Nombre de plantilla inválido. Usa minúsculas, números y '_' (ej: crear_requerimeinto).";
}

if ($errors) {
  http_response_code(400);
  echo json_encode(["success" => false, "errors" => $errors], JSON_UNESCAPED_UNICODE);
  exit;
}

$bodyParams = [];
foreach ((array)$params as $p) {
  $bodyParams[] = ["type" => "text", "text" => strval($p)];
}

// Arma el payload para WhatsApp
$payload = [
  "messaging_product" => "whatsapp",
  "to" => $to,
  "type" => "template",
  "template" => [
    "name" => $template,            
    "language" => ["code" => $lang] // "es_MX"
  ]
];

if (!empty($bodyParams)) {
  $payload["template"]["components"] = [[
    "type" => "body",
    "parameters" => $bodyParams
  ]];
}

// Llamada a la API de WhatsApp
$url = "https://graph.facebook.com/v20.0/" . WHATSAPP_PHONE_NUMBER_ID . "/messages";
$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer " . WHATSAPP_TOKEN,
    "Content-Type: application/json",
    "Accept: application/json"
  ],
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 30
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

// Procesa la respuesta 
$respObj    = json_decode($response, true);
$messageId  = $respObj["messages"][0]["id"] ?? null;
$graphError = $respObj["error"]["message"] ?? null;
$fbtrace    = $respObj["error"]["fbtrace_id"] ?? null;


if (isset($respObj['error']['code']) && $respObj['error']['code'] === 131030) {
  $respObj['hint'] = 'Agrega el número destino en WhatsApp > Getting Started > Add phone number (allowed recipients) o usa un número real en producción.';
}

$out = [
  "success"      => ($httpCode >= 200 && $httpCode < 300),
  "http_code"    => $httpCode,
  "message_id"   => $messageId,
  "error"        => $curlErr ?: $graphError,
  "fbtrace_id"   => $fbtrace,
  "response"     => $respObj,
  "sent_payload" => $payload   
];

http_response_code($httpCode ?: 200);
echo json_encode($out, JSON_UNESCAPED_UNICODE);

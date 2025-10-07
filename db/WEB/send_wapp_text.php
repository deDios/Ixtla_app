<?php
// db/WEB/send_wapp_text.php
// Envia mensajes de TEXTO (no plantilla) por WhatsApp Cloud API.
// Acepta JSON por POST. Formatos admitidos:
//  A) {"to":"52XXXXXXXXXX","text":"Hola!"}
//  B) {"to":"52XXXXXXXXXX","type":"text","text":{"body":"Hola!","preview_url":false}, "reply_to":"wamid...."}

// === Configuración (reemplaza por la tuya) ===
const WHATSAPP_TOKEN = 'EAAJkMnC6uM0BPRno6FCIX5qa02D434WAZA8RgWUHf7t1Ue5D6bmMNEI1zShDUfk9JEPrWRd6adPIdqUfJGkyOz8l9yDOZBdMDJFMR5WmLGQRe8z4e2ZCPKgxzbMt2oZAQSxasnzTngkh7MOLn8cAPOrw7ibN4zptaXeB86xMomKyqgfzXiudgIKCHlH2UAZDZD';
const WHATSAPP_PHONE_NUMBER_ID = '782524058283433'; 

// ----------------- utilidades -----------------
function json_out($code, $arr) {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}

// Normaliza a E.164 básico (solo dígitos); si vienen 10 dígitos, asume MX y antepone 52
function to_e164($tel) {
  $d = preg_replace('/\D+/', '', (string)$tel);
  if ($d === '') return null;
  if (preg_match('/^\d{10}$/', $d)) return '52'.$d;        // MX local → +52
  if (preg_match('/^\d{11,15}$/', $d)) return $d;          // ya con país
  return null;
}

// ----------------- leer entrada -----------------
$raw = file_get_contents('php://input');
$in  = json_decode($raw, true) ?: [];

// Permitir ambos formatos
$to     = $in['to']   ?? '';
$text   = $in['text'] ?? null;

// Si text viene como string, úsalo; si viene como objeto {body}, tómalo
if (is_string($text)) {
  $bodyText = trim($text);
} elseif (is_array($text) && isset($text['body'])) {
  $bodyText = trim((string)$text['body']);
} else {
  // también aceptamos "type":"text","text":{"body":...}
  $bodyText = trim((string)($in['text']['body'] ?? ''));
}

// Opcional: responder a un mensaje específico (marca de reply)
$reply_to = $in['reply_to'] ?? null;

// Validaciones mínimas
if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
  json_out(500, ["success"=>false,"error"=>"Faltan credenciales del WhatsApp API"]);
}

$to_e164 = to_e164($to);
if (!$to_e164) {
  json_out(400, ["success"=>false,"error"=>"Teléfono inválido. Usa E.164 (ej. 52XXXXXXXXXX)"]);
}
if ($bodyText === '') {
  json_out(400, ["success"=>false,"error"=>"El texto a enviar está vacío"]);
}
if (mb_strlen($bodyText) > 4096) { // límite razonable
  json_out(400, ["success"=>false,"error"=>"El mensaje excede 4096 caracteres"]);
}

// ----------------- construir payload -----------------
$payload = [
  "messaging_product" => "whatsapp",
  "recipient_type"    => "individual",
  "to"                => $to_e164,
  "type"              => "text",
  "text"              => [
    "preview_url" => isset($in['text']['preview_url']) ? (bool)$in['text']['preview_url'] : false,
    "body"        => $bodyText
  ]
];

// Si viene reply_to, adjunta contexto
if (!empty($reply_to)) {
  $payload["context"] = [ "message_id" => $reply_to ];
}

// ----------------- llamada a Graph -----------------
$url = "https://graph.facebook.com/v20.0/".WHATSAPP_PHONE_NUMBER_ID."/messages";

$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer ".WHATSAPP_TOKEN,
    "Content-Type: application/json",
    "Accept: application/json",
  ],
  CURLOPT_POST           => true,
  CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT        => 20,
]);
$response = curl_exec($ch);
$http     = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$cerr     = curl_error($ch);
curl_close($ch);

$resp = json_decode($response, true);
$out  = [
  "success"    => ($http >= 200 && $http < 300),
  "http_code"  => $http,
  "message_id" => $resp["messages"][0]["id"] ?? null,
  "error"      => $cerr ?: ($resp["error"]["message"] ?? null),
  "response"   => $resp,
  "sent_payload" => $payload, // útil para depurar; quítalo en prod si quieres
];

json_out($http ?: 200, $out);

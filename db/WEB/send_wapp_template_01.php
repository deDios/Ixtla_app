<?php
// send_wapp_template.php  (SIN variables de entorno)
// Reemplaza estos valores con los de tu app/WABA:
const WHATSAPP_TOKEN = 'EAAJkMnC6uM0BPRno6FCIX5qa02D434WAZA8RgWUHf7t1Ue5D6bmMNEI1zShDUfk9JEPrWRd6adPIdqUfJGkyOz8l9yDOZBdMDJFMR5WmLGQRe8z4e2ZCPKgxzbMt2oZAQSxasnzTngkh7MOLn8cAPOrw7ibN4zptaXeB86xMomKyqgfzXiudgIKCHlH2UAZDZD';
const WHATSAPP_PHONE_NUMBER_ID = '866871219834623'; // p. ej. "8668712XXXXXXXX"

// Este endpoint recibe JSON por POST, por ejemplo:
// {
//   "to": "52133XXXXXXX",
//   "template": "crear_requerimeinto",
//   "lang": "es_MX",
//   "params": ["REQ-000123"]   // valores para {{1}}, {{2}}, ...
// }

header("Content-Type: application/json; charset=utf-8");

// Lee el cuerpo de la petición (JSON) o, si no hay, usa $_POST.
$raw = file_get_contents("php://input");
$input = $raw ? json_decode($raw, true) : $_POST;

// Campos de entrada
$to       = $input["to"]       ?? "";
$template = $input["template"] ?? "";        // OJO: usa el NOMBRE EXACTO de tu plantilla
$lang     = $input["lang"]     ?? "es_MX";
$params   = $input["params"]   ?? [];        // Array con los valores de {{1}}, {{2}}, ...

// Validaciones mínimas
$errors = [];
if (!WHATSAPP_TOKEN) {
  $errors[] = "Falta WHATSAPP_TOKEN (edita el archivo).";
}
if (!WHATSAPP_PHONE_NUMBER_ID) {
  $errors[] = "Falta WHATSAPP_PHONE_NUMBER_ID (edita el archivo).";
}
if (!$to)       $errors[] = "El campo 'to' es obligatorio (E.164, ej. 52133XXXXXXX).";
if (!$template) $errors[] = "El campo 'template' es obligatorio.";

if ($errors) {
  http_response_code(400);
  echo json_encode(["success"=>false,"errors"=>$errors], JSON_UNESCAPED_UNICODE);
  exit;
}

// Construye los 'parameters' del body según el arreglo 'params'
$bodyParams = [];
foreach ($params as $p) {
  $bodyParams[] = ["type"=>"text","text"=>strval($p)];
}

// Arma el payload para WhatsApp
$payload = [
  "messaging_product" => "whatsapp",
  "to" => $to,
  "type" => "template",
  "template" => [
    "name" => $template,                    // ej. "crear_requerimeinto"
    "language" => ["code" => $lang]         // ej. "es_MX"
  ]
];

// Solo agrega "components" si hay parámetros (si tu plantilla no tiene {{}} no los envíes)
if (!empty($bodyParams)) {
  $payload["template"]["components"] = [[
    "type" => "body",
    "parameters" => $bodyParams
  ]];
}

// Llamada a la API de WhatsApp
$url = "https://graph.facebook.com/v20.0/".WHATSAPP_PHONE_NUMBER_ID."/messages";

$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer ".WHATSAPP_TOKEN,
    "Content-Type: application/json"
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

// Intenta extraer el ID del mensaje si la API respondió OK
$respObj = json_decode($response, true);
$messageId = $respObj["messages"][0]["id"] ?? null;

$out = [
  "success"    => ($httpCode >= 200 && $httpCode < 300),
  "http_code"  => $httpCode,
  "message_id" => $messageId,
  "error"      => $curlErr ?: ($respObj["error"]["message"] ?? null),
  "response"   => $respObj
];

http_response_code($httpCode ?: 200);
echo json_encode($out, JSON_UNESCAPED_UNICODE);

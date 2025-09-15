<?php

const WHATSAPP_TOKEN = 'EAAJkMnC6uM0BPRno6FCIX5qa02D434WAZA8RgWUHf7t1Ue5D6bmMNEI1zShDUfk9JEPrWRd6adPIdqUfJGkyOz8l9yDOZBdMDJFMR5WmLGQRe8z4e2ZCPKgxzbMt2oZAQSxasnzTngkh7MOLn8cAPOrw7ibN4zptaXeB86xMomKyqgfzXiudgIKCHlH2UAZDZD';
const WHATSAPP_PHONE_NUMBER_ID = '866871219834623'; // ej. "8668712XXXXXXXX"

header("Content-Type: application/json; charset=utf-8");

// Lee el cuerpo de la petición (JSON) o, si no hay, usa $_POST
$raw = file_get_contents("php://input");
$input = $raw ? json_decode($raw, true) : $_POST;

// Campos de entrada (con trim)
$to       = trim($input["to"] ?? "");
$template = trim($input["template"] ?? "");
$lang     = trim($input["lang"] ?? "es_MX");
$params   = $input["params"] ?? []; // valores para {{1}}, {{2}}, ...

$errors = [];

// Validaciones de credenciales
if (!WHATSAPP_TOKEN) {
  $errors[] = "Falta WHATSAPP_TOKEN (define la constante en el archivo).";
}
if (!WHATSAPP_PHONE_NUMBER_ID) {
  $errors[] = "Falta WHATSAPP_PHONE_NUMBER_ID (define la constante en el archivo).";
}

// Validaciones de entrada
if (!$to)       $errors[] = "El campo 'to' es obligatorio (formato E.164, solo dígitos).";
if (!$template) $errors[] = "El campo 'template' es obligatorio.";

// Normaliza teléfono a dígitos y valida rango E.164 (10–15 dígitos)
$to_digits = preg_replace('/\D+/', '', $to);
if ($to_digits !== $to) {
  $to = $to_digits; // limpia espacios, +, guiones, etc.
}
if (!preg_match('/^\d{10,15}$/', $to)) {
  $errors[] = "El teléfono debe estar en E.164 sin signos: ej. 52133XXXXXXXX (10 a 15 dígitos).";
}

// Valida el nombre de la plantilla (minúsculas, números, guion bajo)
if ($template && !preg_match('/^[a-z0-9_]+$/', $template)) {
  $errors[] = "Nombre de plantilla inválido. Usa minúsculas, números y '_' (ej: crear_requerimeinto).";
}

// Si hay errores, responde 400 con detalle
if ($errors) {
  http_response_code(400);
  echo json_encode(["success" => false, "errors" => $errors], JSON_UNESCAPED_UNICODE);
  exit;
}

// Construye parameters del BODY según 'params' (si tu plantilla tiene {{}})
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
    "name" => $template,            // ej. "crear_requerimeinto" (exacto)
    "language" => ["code" => $lang] // ej. "es_MX"
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

// Procesa la respuesta de Meta
$respObj    = json_decode($response, true);
$messageId  = $respObj["messages"][0]["id"] ?? null;
$graphError = $respObj["error"]["message"] ?? null;
$fbtrace    = $respObj["error"]["fbtrace_id"] ?? null;

// Hint útil si estás en modo "allowed recipients"
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
  "sent_payload" => $payload   // útil para verificar template.name/lang/params exactos
];

http_response_code($httpCode ?: 200);
echo json_encode($out, JSON_UNESCAPED_UNICODE);

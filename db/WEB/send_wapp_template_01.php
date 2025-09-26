<?php
/**
 * Enviar plantilla de WhatsApp (Cloud API)
 * - Valida que la plantilla exista en el WABA y que soporte el idioma solicitado
 * - Valida (si es posible) el número de variables del body
 */

header("Content-Type: application/json; charset=utf-8");

// ======== CONFIG =========
const WHATSAPP_TOKEN           = 'EAAJkMnC6uM0BPRno6FCIX5qa02D434WAZA8RgWUHf7t1Ue5D6bmMNEI1zShDUfk9JEPrWRd6adPIdqUfJGkyOz8l9yDOZBdMDJFMR5WmLGQRe8z4e2ZCPKgxzbMt2oZAQSxasnzTngkh7MOLn8cAPOrw7ibN4zptaXeB86xMomKyqgfzXiudgIKCHlH2UAZDZD'; // rota tu token
const WHATSAPP_PHONE_NUMBER_ID = '782524058283433';
const WHATSAPP_WABA_ID         = '1656720685715852';    // <- PON AQUÍ TU WABA_ID
const GRAPH_VER                = 'v21.0';                   // usar la última estable
// =========================

// ------- helpers -------
function http_get_json($url, $headers = [], $timeout = 25) {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER     => $headers,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => $timeout,
  ]);
  $res  = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err  = curl_error($ch);
  curl_close($ch);
  return [$code, $err, json_decode($res, true) ?: $res];
}

function json_out($statusCode, $payload) {
  http_response_code($statusCode);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  exit;
}

/**
 * Obtiene la definición de una plantilla por nombre desde el WABA.
 * Devuelve [ok(bool), data(array), error(string)]
 */
function wa_get_template_by_name($token, $wabaId, $name) {
  $fields = 'name,status,languages,components{type,format,example}';
  $url = "https://graph.facebook.com/".GRAPH_VER."/{$wabaId}/message_templates"
       . "?name=" . urlencode($name)
       . "&fields={$fields}";
  [$code, $err, $body] = http_get_json($url, ["Authorization: Bearer {$token}"]);
  if ($err) return [false, null, "curl_error: {$err}"];
  if ($code < 200 || $code >= 300) {
    return [false, $body, "Graph error ({$code}) al consultar plantilla"];
  }
  $data = is_array($body) && isset($body['data'][0]) ? $body['data'][0] : null;
  if (!$data) return [false, $body, "La plantilla '{$name}' no existe en el WABA"];
  return [true, $data, null];
}

/**
 * Intenta calcular cuántas variables requiere el BODY de la plantilla.
 * Meta suele devolver: components[...]['example']['body_text'] = [[ "Ej1", "Ej2", ... ]]
 */
function expected_body_params($tpl) {
  if (!is_array($tpl['components'] ?? null)) return null;
  foreach ($tpl['components'] as $c) {
    $type = strtolower($c['type'] ?? '');
    if ($type === 'body' && isset($c['example']['body_text'][0]) && is_array($c['example']['body_text'][0])) {
      return count($c['example']['body_text'][0]);
    }
  }
  return null; // desconocido
}

// ------- input -------
$raw   = file_get_contents("php://input");
$input = $raw ? json_decode($raw, true) : $_POST;

$to       = trim($input["to"] ?? "");
$template = strtolower(trim($input["template"] ?? "")); // normalizado
$lang     = trim($input["lang"] ?? "es_MX");
$params   = $input["params"] ?? [];

$errors = [];

// Validación config
if (!WHATSAPP_TOKEN)            $errors[] = "Falta WHATSAPP_TOKEN.";
if (!WHATSAPP_PHONE_NUMBER_ID)  $errors[] = "Falta WHATSAPP_PHONE_NUMBER_ID.";
if (!WHATSAPP_WABA_ID)          $errors[] = "Falta WHATSAPP_WABA_ID.";

// Validación de entrada
if (!$to)        $errors[] = "El campo 'to' es obligatorio.";
if (!$template)  $errors[] = "El campo 'template' es obligatorio.";

if ($template && !preg_match('/^[a-z0-9_]+$/', $template)) {
  $errors[] = "Nombre de plantilla inválido. Usa minúsculas, números y '_' (ej: req_01).";
}

// Normaliza teléfono: acepta con o sin '+', devolvemos solo dígitos
$to_digits = preg_replace('/\D+/', '', $to);
$to = $to_digits;
if (!preg_match('/^\d{10,15}$/', $to)) {
  $errors[] = "El teléfono debe estar en formato internacional (solo dígitos), ej. 5213312345678.";
}

if ($errors) json_out(400, ["success"=>false, "errors"=>$errors]);

// ------- consulta plantilla en Graph para validar idioma y variables -------
list($tplOk, $tplData, $tplErr) = wa_get_template_by_name(WHATSAPP_TOKEN, WHATSAPP_WABA_ID, $template);
if (!$tplOk) {
  json_out(400, [
    "success" => false,
    "error"   => $tplErr,
    "graph"   => $tplData
  ]);
}

$langs = $tplData['languages'] ?? [];
if (!in_array($lang, $langs, true)) {
  json_out(400, [
    "success"=>false,
    "error"=>"La plantilla '{$template}' no tiene traducción '{$lang}'. Idiomas disponibles: ".implode(',', $langs),
    "template"=>$tplData
  ]);
}

// Valida número esperado de variables del BODY (si es inferible)
$expectedBody = expected_body_params($tplData); // puede ser null si no se puede inferir
if ($expectedBody !== null && intval($expectedBody) !== count((array)$params)) {
  json_out(400, [
    "success"=>false,
    "error"=>"La plantilla '{$template}' en '{$lang}' espera {$expectedBody} parámetro(s) en el BODY y se enviaron ".count((array)$params).".",
    "hint"=>"Ajusta 'params' para coincidir con el número de variables del BODY."
  ]);
}

// ------- arma payload -------
$bodyParams = [];
foreach ((array)$params as $p) {
  $bodyParams[] = ["type" => "text", "text" => strval($p)];
}

$payload = [
  "messaging_product" => "whatsapp",
  "to"                => $to,               // solo dígitos funciona con Cloud API
  "type"              => "template",
  "template"          => [
    "name"     => $template,
    "language" => ["code" => $lang]
  ]
];

$components = [];
if (!empty($bodyParams)) {
  $components[] = ["type"=>"body", "parameters"=>$bodyParams];
}
if (!empty($components)) {
  $payload["template"]["components"] = $components;
}

// ------- llamada a Graph -------
$url = "https://graph.facebook.com/".GRAPH_VER."/".WHATSAPP_PHONE_NUMBER_ID."/messages";
$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_HTTPHEADER     => [
    "Authorization: Bearer ".WHATSAPP_TOKEN,
    "Content-Type: application/json",
    "Accept: application/json"
  ],
  CURLOPT_POST           => true,
  CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT        => 30
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

$respObj    = json_decode($response, true);
$messageId  = $respObj["messages"][0]["id"] ?? null;
$graphError = $respObj["error"]["message"] ?? null;
$fbtrace    = $respObj["error"]["fbtrace_id"] ?? null;

// Hint útil si es el error de “destinatario no permitido” en modo test
if (isset($respObj['error']['code']) && $respObj['error']['code'] === 131030) {
  $respObj['hint'] = 'Agrega el teléfono destino en la lista de “test recipients” o usa un número real en producción.';
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

json_out($httpCode ?: 200, $out);

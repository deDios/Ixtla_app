<?php
/**
 * send_wapp_template_event_04.php
 * requiere 3 params: [folio, estado, motivo]
 */

declare(strict_types=1);
header("Content-Type: application/json; charset=utf-8");

/* CORS  */
$allowedOrigins = [
  "https://ixtla-app.com",
  "https://www.ixtla-app.com",
];

$origin = $_SERVER["HTTP_ORIGIN"] ?? "";
if ($origin && in_array($origin, $allowedOrigins, true)) {
  header("Access-Control-Allow-Origin: {$origin}");
  header("Access-Control-Allow-Credentials: true");
  header("Vary: Origin");
}
header("Access-Control-Allow-Headers: Content-Type, Accept");
header("Access-Control-Allow-Methods: POST, OPTIONS");

if (($_SERVER["REQUEST_METHOD"] ?? "") === "OPTIONS") {
  http_response_code(204);
  exit;
}

// Config 
const WA_ACCESS_TOKEN = 'EAAJkMnC6uM0BPt4PJyZBBLzp47PMRhRlKa6zvbvIH5fIPWLwfGysAeTbR0XVqN2SPP2ImmerKXE3kvQos9IJZA4IM8oyENM1MgB0iIbTHZAB1UFeGJs6K35EmFZA4zHHUt788Q2zntuFC84PeyzTgeMO0tVbSpQCBHeizsueV4eXDtZBzUtkMDxZBiWLMUvAZDZD';
const WA_PHONE_NUMBER_ID = '782524058283433'; 
const WA_TEMPLATE_NAME   = 'event_04';

function readInput(): array {
  $raw = file_get_contents("php://input");
  if ($raw !== false && trim($raw) !== "") {
    $json = json_decode($raw, true);
    if (is_array($json)) return $json;
  }
  return $_POST ?? [];
}

function onlyDigits(string $s): string {
  return preg_replace("/\\D+/", "", $s) ?? "";
}

function sendJSON(int $status, array $payload): void {
  http_response_code($status);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function waEndpoint(): string {
  return "https://graph.facebook.com/v20.0/" . WA_PHONE_NUMBER_ID . "/messages";
}

/* =========================
 * Main
 * ========================= */
$in = readInput();

$toRaw  = (string)($in["to"] ?? "");
$lang   = (string)($in["lang"] ?? "es_MX");
$params = $in["params"] ?? null;

// Soporta params como string JSON
if (is_string($params)) {
  $try = json_decode($params, true);
  if (is_array($try)) $params = $try;
}

// Validaciones (igual estilo template_01)
$errors = [];

if (WA_PHONE_NUMBER_ID === "REEMPLAZA_PHONE_NUMBER_ID") {
  $errors[] = "Config: WA_PHONE_NUMBER_ID no configurado.";
}
if (WA_ACCESS_TOKEN === "REEMPLAZA_ACCESS_TOKEN") {
  $errors[] = "Config: WA_ACCESS_TOKEN no configurado.";
}

// Sanitizar teléfono
$to = onlyDigits($toRaw);
if (!$to) $errors[] = 'Campo "to" requerido.';
if ($to && !preg_match("/^\\d{10,15}$/", $to)) {
  $errors[] = 'El campo "to" debe tener entre 10 y 15 dígitos (solo números).';
}

$lang = trim($lang) ?: "es_MX";

// Params: event_04 requiere EXACTAMENTE 3 parametros
if (!is_array($params)) {
  $errors[] = 'Campo "params" debe ser un arreglo.';
} else {
  if (count($params) !== 3) {
    $errors[] = "event_04 requiere exactamente 3 params: [folio, estado, motivo].";
  }
}

if ($errors) {
  sendJSON(400, [
    "ok" => false,
    "errors" => $errors,
    "debug" => [
      "to_raw" => $toRaw,
      "to_sanitized" => $to,
      "lang" => $lang,
      "template" => WA_TEMPLATE_NAME,
      "params_count" => is_array($params) ? count($params) : null,
    ],
  ]);
}

// Construir body parameters 
$bodyParams = [];
foreach ($params as $p) {
  $bodyParams[] = [
    "type" => "text",
    "text" => (string)$p,
  ];
}

// Payload WhatsApp Cloud API
$payload = [
  "messaging_product" => "whatsapp",
  "to" => $to,
  "type" => "template",
  "template" => [
    "name" => WA_TEMPLATE_NAME,
    "language" => ["code" => $lang],
    "components" => [
      [
        "type" => "body",
        "parameters" => $bodyParams,
      ],
    ],
  ],
];

// cURL
$ch = curl_init(waEndpoint());
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer " . trim(WA_ACCESS_TOKEN),
    "Content-Type: application/json",
    "Accept: application/json",
  ],
  CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
  CURLOPT_TIMEOUT => 25,
]);

$resp = curl_exec($ch);
$errno = curl_errno($ch);
$cerr  = $errno ? curl_error($ch) : null;
$code  = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$decoded = null;
if (is_string($resp) && $resp !== "") {
  $decoded = json_decode($resp, true);
}
if (!is_array($decoded)) $decoded = ["raw" => $resp];

$success = ($errno === 0) && ($code >= 200 && $code < 300);

$hint = null;
if (isset($decoded["error"]["code"]) && (int)$decoded["error"]["code"] === 131030) {
  $hint = "Parece modo pruebas: agrega el número destino como tester/allowed recipient en Meta.";
}

sendJSON(200, [
  "ok" => $success,
  "success" => $success,
  "http_code" => $code,
  "message_id" => $decoded["messages"][0]["id"] ?? null,
  "error" => $cerr ?: ($decoded["error"]["message"] ?? null),
  "fbtrace_id" => $decoded["error"]["fbtrace_id"] ?? null,
  "hint" => $hint,
  "sent_payload" => $payload,
  "response" => $decoded,
]);
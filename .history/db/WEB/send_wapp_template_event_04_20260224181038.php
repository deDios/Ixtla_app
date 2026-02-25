<?php
/**
 *
 * Espera JSON (recomendado) o form-data:
 * {
 *   "to": "5213312345678",
 *   "lang": "es_MX",
 *   "params": ["REQ-00000000001", "pausa", "Motivo ..."]
 * }
 */

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

// CORS 
$allowedOrigins = [
  'https://ixtla-app.com',
  'https://www.ixtla-app.com',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && in_array($origin, $allowedOrigins, true)) {
  header("Access-Control-Allow-Origin: {$origin}");
  header('Access-Control-Allow-Credentials: true');
  header('Vary: Origin');
}
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

// ========================
// Config WhatsApp Cloud API
// ========================
const WHATSAPP_TOKEN = 'EAAJkMnC6uM0BPt4PJyZBBLzp47PMRhRlKa6zvbvIH5fIPWLwfGysAeTbR0XVqN2SPP2ImmerKXE3kvQos9IJZA4IM8oyENM1MgB0iIbTHZAB1UFeGJs6K35EmFZA4zHHUt788Q2zntuFC84PeyzTgeMO0tVbSpQCBHeizsueV4eXDtZBzUtkMDxZBiWLMUvAZDZD';
const WHATSAPP_PHONE_NUMBER_ID = '782524058283433'; 

// Template fijo para este archivo
const WA_TEMPLATE_NAME   = 'event_04';

// Endpoint Graph
function wa_endpoint(): string {
  return 'https://graph.facebook.com/v20.0/' . WA_PHONE_NUMBER_ID . '/messages';
}

// ========================
// Helpers
// ========================
function read_input(): array {
  $raw = file_get_contents('php://input');
  if ($raw !== false && trim($raw) !== '') {
    $json = json_decode($raw, true);
    if (is_array($json)) return $json;
  }
  // fallback form-data / x-www-form-urlencoded
  return $_POST ?? [];
}

/**
 * Sanitiza: deja solo dígitos.
 * NO agrega lada país; solo valida 10-15 dígitos como en tu sender actual.
 */
function sanitize_phone(?string $to): string {
  $to = (string)($to ?? '');
  return preg_replace('/\D+/', '', $to) ?? '';
}

function bad_request(array $errors, array $extra = []): void {
  http_response_code(400);
  echo json_encode(array_merge([
    'ok' => false,
    'errors' => $errors,
  ], $extra), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function curl_post_json(string $url, array $payload): array {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => [
      'Authorization: Bearer ' . WA_ACCESS_TOKEN,
      'Content-Type: application/json',
      'Accept: application/json',
    ],
    CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    CURLOPT_TIMEOUT        => 25,
  ]);

  $resp = curl_exec($ch);
  $errno = curl_errno($ch);
  $err   = $errno ? curl_error($ch) : null;
  $code  = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  $decoded = null;
  if (is_string($resp) && $resp !== '') {
    $decoded = json_decode($resp, true);
  }
  if (!is_array($decoded)) $decoded = ['raw' => $resp];

  return [
    'http_code' => $code,
    'curl_errno' => $errno,
    'curl_error' => $err,
    'response' => $decoded,
  ];
}

// ========================
// Main
// ========================
$in = read_input();

// Input esperado
$toRaw = $in['to'] ?? '';
$lang  = $in['lang'] ?? 'es_MX';
$params = $in['params'] ?? null;

// Soporta que params venga como JSON string
if (is_string($params)) {
  $try = json_decode($params, true);
  if (is_array($try)) $params = $try;
}

$errors = [];

// Validar WA config
if (WA_PHONE_NUMBER_ID === 'REEMPLAZA_PHONE_NUMBER_ID') {
  $errors[] = 'Config: WA_PHONE_NUMBER_ID no configurado.';
}
if (WA_ACCESS_TOKEN === 'REEMPLAZA_ACCESS_TOKEN') {
  $errors[] = 'Config: WA_ACCESS_TOKEN no configurado.';
}

// Validar teléfono
$to = sanitize_phone((string)$toRaw);
if ($to === '') $errors[] = 'Campo "to" requerido.';
if ($to !== '' && !preg_match('/^\d{10,15}$/', $to)) {
  $errors[] = 'El campo "to" debe tener entre 10 y 15 dígitos (solo números).';
}

// Validar lang
$lang = trim((string)$lang);
if ($lang === '') $lang = 'es_MX';

// Validar params: event_04 requiere 3 variables ({{1}}, {{2}}, {{3}})
if (!is_array($params)) {
  $errors[] = 'Campo "params" debe ser un arreglo.';
} else {
  // Forzamos 3 params exactos (para que falle rápido y claro)
  if (count($params) !== 3) {
    $errors[] = 'El template event_04 requiere exactamente 3 params: [folio, estado, motivo].';
  }
}

if ($errors) {
  bad_request($errors, [
    'debug' => [
      'to_raw' => $toRaw,
      'to_sanitized' => $to,
      'lang' => $lang,
      'template' => WA_TEMPLATE_NAME,
      'params_count' => is_array($params) ? count($params) : null,
    ],
  ]);
}

// Construir parameters del body en el orden
$bodyParams = [];
foreach ($params as $p) {
  $bodyParams[] = [
    'type' => 'text',
    'text' => (string)$p,
  ];
}

$payload = [
  'messaging_product' => 'whatsapp',
  'to' => $to,
  'type' => 'template',
  'template' => [
    'name' => WA_TEMPLATE_NAME,
    'language' => ['code' => $lang],
    'components' => [
      [
        'type' => 'body',
        'parameters' => $bodyParams,
      ],
    ],
  ],
];

$result = curl_post_json(wa_endpoint(), $payload);

$success = ($result['curl_errno'] === 0) && ($result['http_code'] >= 200 && $result['http_code'] < 300);

// Extra: detectar error 131030 (modo dev / allowed recipients)
$hint = null;
if (isset($result['response']['error']['code']) && (int)$result['response']['error']['code'] === 131030) {
  $hint = 'Parece modo pruebas: el número destino debe estar agregado como tester/allowed recipient en Meta.';
}

echo json_encode([
  'ok' => $success,
  'success' => $success,
  'http_code' => $result['http_code'],
  'message_id' => $result['response']['messages'][0]['id'] ?? null,
  'error' => $result['curl_error'] ?: ($result['response']['error']['message'] ?? null),
  'fbtrace_id' => $result['response']['error']['fbtrace_id'] ?? null,
  'hint' => $hint,
  'sent_payload' => $payload,
  'response' => $result['response'],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
<?php
/**
 * send_wapp_template_event_12.php
 * este event es para notificar al ciudadano
 * que su requerimiento fue finalizado y redirigirlo
 * a la retroalimentacion mediante boton dinamico
 * requiere 2 params: [folio, requerimiento_id]
 */

declare(strict_types=1);
header("Content-Type: application/json; charset=utf-8");

/* =========================
 * CORS
 * ========================= */
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

/* =========================
 * Config
 * ========================= */
const WA_ACCESS_TOKEN = 'EAAJkMnC6uM0BPt4PJyZBBLzp47PMRhRlKa6zvbvIH5fIPWLwfGysAeTbR0XVqN2SPP2ImmerKXE3kvQos9IJZA4IM8oyENM1MgB0iIbTHZAB1UFeGJs6K35EmFZA4zHHUt788Q2zntuFC84PeyzTgeMO0tVbSpQCBHeizsueV4eXDtZBzUtkMDxZBiWLMUvAZDZD';
const WA_PHONE_NUMBER_ID = '782524058283433'; 
const WA_TEMPLATE_NAME   = 'event_12';
const RETRO_ENDPOINT_BASE = 'https://ixtla-app.com/db/WEB/ixtla01_c_retro.php';

/* =========================
 * Helpers
 * ========================= */
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

function httpGetJson(string $url, int $timeout = 20): array {
  $ch = curl_init($url);

  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPGET => true,
    CURLOPT_HTTPHEADER => [
      "Accept: application/json",
    ],
    CURLOPT_TIMEOUT => $timeout,
  ]);

  $resp  = curl_exec($ch);
  $errno = curl_errno($ch);
  $cerr  = $errno ? curl_error($ch) : null;
  $code  = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  $decoded = null;
  if (is_string($resp) && $resp !== "") {
    $decoded = json_decode($resp, true);
  }
  if (!is_array($decoded)) $decoded = ["raw" => $resp];

  return [
    "ok" => ($errno === 0) && ($code >= 200 && $code < 300),
    "http_code" => $code,
    "error" => $cerr ?: ($decoded["error"] ?? null),
    "response" => $decoded,
  ];
}

/* =========================
 * Main
 * ========================= */
$in = readInput();

$toRaw  = (string)($in["to"] ?? "");
$lang   = (string)($in["lang"] ?? "es_MX");
$params = $in["params"] ?? null;

// params string JSON
if (is_string($params)) {
  $try = json_decode($params, true);
  if (is_array($try)) $params = $try;
}

$errors = [];

// Validar config
if (WA_PHONE_NUMBER_ID === "REEMPLAZA_PHONE_NUMBER_ID" || trim(WA_PHONE_NUMBER_ID) === "") {
  $errors[] = "Config: WA_PHONE_NUMBER_ID no configurado.";
}
if (WA_ACCESS_TOKEN === "REEMPLAZA_ACCESS_TOKEN" || trim(WA_ACCESS_TOKEN) === "") {
  $errors[] = "Config: WA_ACCESS_TOKEN no configurado.";
}

// Sanitizar telefono
$to = onlyDigits($toRaw);
if (!$to) $errors[] = 'Campo "to" requerido.';
if ($to && !preg_match("/^\\d{10,15}$/", $to)) {
  $errors[] = 'El campo "to" debe tener entre 10 y 15 dígitos (solo números).';
}

$lang = trim($lang) ?: "es_MX";

// Params: event_12 requiere EXACTAMENTE 2 parametros
$folio = "";
$requerimientoId = 0;

if (!is_array($params)) {
  $errors[] = 'Campo "params" debe ser un arreglo.';
} else {
  if (count($params) !== 2) {
    $errors[] = "event_12 requiere exactamente 2 params: [folio, requerimiento_id].";
  } else {
    $folio = trim((string)($params[0] ?? ""));
    $requerimientoId = (int)($params[1] ?? 0);

    if ($folio === "") {
      $errors[] = 'El param[0] "folio" es requerido.';
    }

    if ($requerimientoId <= 0) {
      $errors[] = 'El param[1] "requerimiento_id" debe ser un entero mayor a 0.';
    }
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
      "folio" => $folio,
      "requerimiento_id" => $requerimientoId,
    ],
  ]);
}

/* =========================
 * Consultar retro para obtener link
 * ========================= */
$retroUrl = RETRO_ENDPOINT_BASE . "?requerimiento_id=" . urlencode((string)$requerimientoId);
$retroReq = httpGetJson($retroUrl);

if (!$retroReq["ok"]) {
  sendJSON(502, [
    "ok" => false,
    "error" => "No se pudo consultar el endpoint de retro.",
    "retro_http_code" => $retroReq["http_code"],
    "retro_error" => $retroReq["error"],
    "retro_url" => $retroUrl,
    "retro_response" => $retroReq["response"],
  ]);
}

$retroResponse = $retroReq["response"];
$retroData = $retroResponse["data"] ?? null;

if (!is_array($retroData) || count($retroData) === 0) {
  sendJSON(404, [
    "ok" => false,
    "error" => "No se encontraron retroalimentaciones para el requerimiento.",
    "retro_url" => $retroUrl,
    "retro_response" => $retroResponse,
  ]);
}

$retroActual = $retroData[0] ?? null;
$retroLink = is_array($retroActual) ? trim((string)($retroActual["link"] ?? "")) : "";

if ($retroLink === "") {
  sendJSON(404, [
    "ok" => false,
    "error" => "La retroalimentacion mas reciente no contiene un link valido.",
    "retro_url" => $retroUrl,
    "retro_actual" => $retroActual,
  ]);
}

/* =========================
 * Extraer solo el valor dinamico del boton
 * Base del boton en Meta:
 * https://ixtla-app.com/VIEWS/retroCiudadana.php?folio=
 * Por lo tanto solo debemos mandar el valor de "folio"
 * ========================= */
$parsedUrl = parse_url($retroLink);
$query = $parsedUrl["query"] ?? "";
parse_str($query, $queryParams);

$folioBoton = trim((string)($queryParams["folio"] ?? ""));

if ($folioBoton === "") {
  sendJSON(404, [
    "ok" => false,
    "error" => "No se pudo extraer el parametro folio desde el link de retro.",
    "retro_url" => $retroUrl,
    "retro_link" => $retroLink,
    "retro_actual" => $retroActual,
  ]);
}

/* =========================
 * Construir body parameters
 * ========================= */
$bodyParams = [
  [
    "type" => "text",
    "text" => $folio,
  ],
];

/* =========================
 * Construir button parameters
 * ========================= */
$buttonParams = [
  [
    "type" => "text",
    "text" => $folioBoton,
  ],
];

/* =========================
 * Payload
 * ========================= */
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
      [
        "type" => "button",
        "sub_type" => "url",
        "index" => "0",
        "parameters" => $buttonParams,
      ],
    ],
  ],
];

/* =========================
 * cURL
 * ========================= */
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

$resp  = curl_exec($ch);
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
  "retro_url" => $retroUrl,
  "retro_link_original" => $retroLink,
  "button_param_usado" => $folioBoton,
  "sent_payload" => $payload,
  "response" => $decoded,
]);
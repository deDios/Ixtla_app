<?php
// webpublic_proxy.php — Proxy firmador HMAC para el frontend


//hice este archivo temporalmente para validar el canal 2 y no me marcara errores.

// Solo POST y JSON
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  http_response_code(405);
  header('Allow: POST');
  exit('{"ok":false,"error":"Método no permitido"}');
}

$ct = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($ct, 'application/json') === false) {
  http_response_code(415);
  exit('{"ok":false,"error":"Content-Type debe ser application/json"}');
}

// Lee body con un límite defensivo
$raw = file_get_contents('php://input', false, null, 0, 64*1024 + 1);
if ($raw === false || $raw === '') {
  http_response_code(400);
  exit('{"ok":false,"error":"Body vacío"}');
}
if (strlen($raw) > 64*1024) {
  http_response_code(413);
  exit('{"ok":false,"error":"Payload demasiado grande"}');
}

// Secreto desde entorno (DEBE existir aquí)
$app    = 'webpublic';
$secret = getenv('API_SECRET_'.$app);
if (!$secret) {
  http_response_code(500);
  exit('{"ok":false,"error":"Falta API_SECRET en el proxy"}');
}

// ===== CTX fijo para este proxy (para el CANAL 2) =====
$ctx = 'canal2';

// Construye firma: TS.METHOD.PATH.BODY (PATH EXACTO del endpoint real)
$ts     = (string) time();
$method = 'POST';
$path   = '/db/WEB/ixtla01_in_requerimiento.php'; // Debe coincidir EXACTO
$base = $ts.'.'.$method.'.'.$path.'.'.$ctx.'.'.$raw;
$sig  = base64_encode(hash_hmac('sha256', $base, $secret, true));

// URL del API
$api = 'https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net'.$path;

// Reenvía Idempotency-Key si el frontend lo manda (opcional)
$headers = [
  'Content-Type: application/json',
  'Accept: application/json',
  'X-TS: '.$ts,
  'X-APP: '.$app,
  'X-CTX: '.$ctx,  
  'X-SIG: '.$sig,
  // 'X-RL-BSS: r0K2z-P6iG-9vP9wP', // opcional
];
if (!empty($_SERVER['HTTP_IDEMPOTENCY_KEY'])) {
  $headers[] = 'Idempotency-Key: '.$_SERVER['HTTP_IDEMPOTENCY_KEY'];
}

$ch = curl_init($api);
curl_setopt_array($ch, [
  CURLOPT_POST           => true,
  CURLOPT_POSTFIELDS     => $raw,
  CURLOPT_HTTPHEADER     => $headers,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CONNECTTIMEOUT => 5,
  CURLOPT_TIMEOUT        => 15,
]);

$resp = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err  = curl_error($ch);
curl_close($ch);

header('Content-Type: application/json');
http_response_code($code ?: 502);
echo $resp !== false ? $resp : json_encode([
  'ok'    => false,
  'error' => 'Proxy: fallo al contactar API',
  'detail'=> $err
], JSON_UNESCAPED_UNICODE);
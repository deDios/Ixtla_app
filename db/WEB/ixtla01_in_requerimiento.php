<?php
require_once __DIR__.'/_logger.php';
$__t0 = microtime(true);
api_log('start', 'ixtla01_in_requerimiento', [
  "content_type" => $_SERVER['CONTENT_TYPE'] ?? null
]);

/* ===== CORS (poner literalmente al inicio del archivo) ===== */
$origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
$ALLOWED = [
  'https://ixtla-app.com',
  'https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net'
];
$originOK = $origin && in_array($origin, $ALLOWED, true);
/* ------------------------------ */

if ($originOK) {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
  header("Access-Control-Expose-Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After");
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  if ($originOK) {
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Accept, X-Requested-With, Idempotency-Key, X-RL-BSS, X-TS, X-APP, X-SIG');
    header('Access-Control-Max-Age: 86400');
  }
  http_response_code(204);
  exit;
}

/* ===== Bloqueo por User-Agent (denegar Python) ===== */
$ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
$UA_DENY_PATTERNS = [
  '/\bpython-requests\b/i',
  '/\brequests\/[\d.]+\b/i',
  '/\bpython-urllib\/[\d.]+\b/i',
  '/\bpython\b/i',
];
$UA_ALLOW_EXACT = [
  // 'MiBotSeguro/1.0',
];

$deny_ua = false;
if ($ua !== '') {
  foreach ($UA_ALLOW_EXACT as $ok) {
    if (strcasecmp($ua, $ok) === 0) { $deny_ua = false; break; }
  }
  if (!$deny_ua) {
    foreach ($UA_DENY_PATTERNS as $re) {
      if (preg_match($re, $ua)) { $deny_ua = true; break; }
    }
  }
}

if ($deny_ua) {
  api_log('403','ua_blocked', [
    'ua'      => $ua,
    'client'  => $_SERVER['HTTP_X_FORWARDED_FOR'] ?? ($_SERVER['REMOTE_ADDR'] ?? null),
    'reason'  => 'UA matches denylist',
  ]);
  if ($originOK) { header("Access-Control-Allow-Origin: $origin"); } // CORS en 403
  header('Content-Type: application/json');
  http_response_code(403);
  echo json_encode(['ok'=>false,'error'=>'Acceso denegado (UA)']);
  exit;
}

/* ------------------------------ */

/* ===== Content-Type y tamaño ===== */
header('Content-Type: application/json');
date_default_timezone_set('America/Mexico_City');

/* Método permitido */
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  http_response_code(405);
  die(json_encode(["ok"=>false,"error"=>"Método no permitido"]));
}

/* ====== RATE LIMIT por IP ====== */
/* IP helper: usa XFF solo si el remoto es proxy de confianza (Azure/privadas) */

/* Nota: esta versión soporta IPv4 y hace un mejor esfuerzo con IPv6.
   Si tus clientes son mayormente IPv4, esto es suficiente para rate-limit. */

function __ip_in_cidr(string $ip, string $cidr): bool {
  [$subnet, $mask] = explode('/', $cidr) + [null, null];
  if ($mask === null) return $ip === $subnet;
  $mask = (int)$mask;
  if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) && filter_var($subnet, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
    return (ip2long($ip) & ~((1 << (32 - $mask)) - 1)) === (ip2long($subnet) & ~((1 << (32 - $mask)) - 1));
  }
  return false;
}

function __parse_ip_from_token(string $token): string {
  $t = trim($token, " \t\n\r\0\x0B\"'");
  if ($t !== '' && $t[0] === '[') { // [IPv6]:port
    $end = strpos($t, ']');
    if ($end !== false) return substr($t, 1, $end - 1);
  }
  if (substr_count($t, ':') === 1 && preg_match('/^\d{1,3}(\.\d{1,3}){3}:\d+$/', $t)) {
    return explode(':', $t, 2)[0]; // IPv4:port
  }
  if (strpos($t, ':') !== false && !filter_var($t, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
    $pos = strrpos($t, ':');
    if ($pos !== false) {
      $maybe = substr($t, 0, $pos);
      if (filter_var($maybe, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) return $maybe;
    }
  }
  return $t;
}

function __rl_ip(): string {
  $remote = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

  // Proxies confiables (Azure 169.254.0.0/16, redes privadas, CGNAT)
  $trusted = [
    '127.0.0.1/32',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '169.254.0.0/16',
    '100.64.0.0/10',
  ];

  $isTrusted = false;
  foreach ($trusted as $cidr) { if (__ip_in_cidr($remote, $cidr)) { $isTrusted = true; break; } }

  $xff = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
  if ($isTrusted && $xff) {
    $parts = array_map('trim', explode(',', $xff));
    if (!empty($parts[0])) {
      $first = __parse_ip_from_token($parts[0]);
      if (filter_var($first, FILTER_VALIDATE_IP)) return $first; // IP cliente real
    }
  }
  return $remote;
}

function __rl_get(string $key) {
  if (function_exists('apcu_enabled') && apcu_enabled()) {
    $ok=false; $v=apcu_fetch($key,$ok); return $ok ? $v : null;
  }
  $f="/tmp/rl_".hash('sha256',$key);
  if(!is_file($f)) return null;
  $raw=@file_get_contents($f); if($raw===false) return null;
  $row=@json_decode($raw,true); if(!is_array($row)) return null;
  if(!empty($row['_exp']) && $row['_exp']<time()){ @unlink($f); return null; }
  return $row;
}
function __rl_set(string $key, $val, int $ttl): void {
  if (function_exists('apcu_enabled') && apcu_enabled()) { apcu_store($key,$val,$ttl); return; }
  $f="/tmp/rl_".hash('sha256',$key); $val['_exp']=time()+$ttl;
  @file_put_contents($f,json_encode($val),LOCK_EX);
}

function rate_limit_or_die(
  string $bucket, int $windowSec=30, int $maxHits=5,
  int $banSec=3600, array $whitelist=[]
): void {
  $ip = __rl_ip();
  if (in_array($ip,$whitelist,true)) return;

  $now=time(); $winId=intdiv($now,$windowSec); $key="rl:$bucket:$ip";
  $d=__rl_get($key) ?: ['win'=>$winId,'cnt'=>0,'ban_until'=>0];

  if(!empty($d['ban_until']) && $d['ban_until']>$now){
    if (!function_exists('api_log')) { @include __DIR__.'/_logger.php'; }
    api_log('429','rate_limit_exceeded', ['bucket'=>$bucket,'ip'=>$ip,'reason'=>'ban_active']);
    $retry=$d['ban_until']-$now;
    header('Retry-After: '.$retry);
    http_response_code(429);
    echo json_encode(['ok'=>false,'error'=>'Too Many Requests','retry_after'=>$retry],JSON_UNESCAPED_UNICODE);
    exit;
  }

  if($d['win']!==$winId){ $d['win']=$winId; $d['cnt']=0; }
  $d['cnt']++;

  header('X-RateLimit-Limit: '.$maxHits);
  header('X-RateLimit-Remaining: '.max(0,$maxHits-$d['cnt']));
  header('X-RateLimit-Reset: '.(($winId+1)*$windowSec));

  if($d['cnt']>$maxHits){
    $d['ban_until']=$now+$banSec;
    __rl_set($key,$d,max($windowSec,$banSec));
    if (!function_exists('api_log')) { @include __DIR__.'/_logger.php'; }
    api_log('429','rate_limit_exceeded', ['bucket'=>$bucket,'ip'=>$ip,'reason'=>'over_limit','cnt'=>$d['cnt'],'limit'=>$maxHits]);
    header('Retry-After: '.$banSec);
    http_response_code(429);
    echo json_encode(['ok'=>false,'error'=>'Too Many Requests','retry_after'=>$banSec],JSON_UNESCAPED_UNICODE);
    exit;
  }

  __rl_set($key,$d,max($windowSec,$banSec));
}

/* → Aplica límite ANTES de leer body/validar content-type */

/* ===== GeoIP sin librerías: consulta API pública y cachea ===== */
if (!defined('GEO_FAIL_CLOSED')) {
  // true = si la API de GeoIP falla, bloquea; false = si falla, deja pasar (fail-open)
  define('GEO_FAIL_CLOSED', false);
}

function __ip_country_via_http(?string $ip): ?string {
  if (!$ip || !filter_var($ip, FILTER_VALIDATE_IP)) return null;

  // No consultar IPs privadas/reservadas
  if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
    return null;
  }

  $ck = 'geoip_cc_http:'.$ip;

  // Cache APCu
  if (function_exists('apcu_enabled') && apcu_enabled()) {
    $ok = false; $cc = apcu_fetch($ck, $ok);
    if ($ok && is_string($cc)) { if ($cc === '??') return null; return $cc; }
  }

  // Usar HTTPS (ipwho.is)
  $url = "https://ipwho.is/".rawurlencode($ip)."?fields=country_code";

  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 1,
    CURLOPT_TIMEOUT        => 2,
    CURLOPT_USERAGENT      => 'geoip-check/1.0',
  ]);
  $resp = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  if ($code >= 200 && $code < 300 && $resp) {
    $j  = json_decode($resp, true);
    $cc = isset($j['country_code']) ? strtoupper((string)$j['country_code']) : null;
    if ($cc) {
      if (function_exists('apcu_enabled') && apcu_enabled()) apcu_store($ck, $cc, 86400); // 1 día
      return $cc;
    }
  }

  // Negative-cache cuando la API no respondió bien
  if (function_exists('apcu_enabled') && apcu_enabled()) apcu_store($ck, '??', 600); // 10 min

  // Si quieres bloquear cuando la API falle, devolvemos 'XX' (el caller decide)
  return GEO_FAIL_CLOSED ? 'XX' : null;
}


/* === Quarantine list por IP/CIDR (bloqueo duro antes de RL/DB) === */
$QUARANTINE = [
  '173.239.0.0/16',
  '212.102.0.0/16',
  '84.17.0.0/16',
  '146.70.0.0/16',
  '188.214.0.0/16',
  '102.129.0.0/16',
];

function __ip_in_list(string $ip, array $cidrs): bool {
  foreach ($cidrs as $c) {
    if (__ip_in_cidr($ip, $c)) return true;
  }
  return false;
}

$__client_ip = __rl_ip();
if (__ip_in_list($__client_ip, $QUARANTINE)) {
  api_log('403','quarantine_block', [
    'ip'  => $__client_ip,
    'xff' => $_SERVER['HTTP_X_FORWARDED_FOR'] ?? null,
  ]);
  header('Content-Type: application/json');
  http_response_code(403);
  echo json_encode(['ok'=>false,'error'=>'Forbidden']);
  exit;
}
/* === fin quarantine list === */

/* === Geo-bloqueo (API pública): solo México === */
$__client_ip = $__client_ip ?? __rl_ip();
$__cc = __ip_country_via_http($__client_ip);

// Bloquea si país ≠ MX, o si GEO_FAIL_CLOSED está activo y la API falló (XX)
if ( ($__cc === 'XX') || ($__cc !== null && $__cc !== 'MX') ) {
  api_log('403','geo_block_http', [
    'ip'      => $__client_ip,
    'country' => $__cc,
    'xff'     => $_SERVER['HTTP_X_FORWARDED_FOR'] ?? null,
    'ua'      => $_SERVER['HTTP_USER_AGENT'] ?? null
  ]);
  header('Content-Type: application/json');
  http_response_code(403);
  echo json_encode(['ok'=>false,'error'=>'Solo disponible en México']);
  exit;
}


/* → Aplica límite ANTES de leer body/validar content-type */
$RL_WHITELIST = [];
$RL_BYPASS_HEADER = 'HTTP_X_RL_BSS';
$RL_BYPASS_SECRET = 'r0K2z-P6iG-9vP9wP'; // c
$__skip_rl = isset($_SERVER[$RL_BYPASS_HEADER]) && hash_equals($RL_BYPASS_SECRET, $_SERVER[$RL_BYPASS_HEADER]);
if (!$__skip_rl) {
  rate_limit_or_die(
    bucket: 'requerimiento_api',
    windowSec: 60,   // ventana de 60 seg
    maxHits: 2,      // 2 req / 60s (≈10/min)
    banSec: 2629746,    // ban de 1 mes
    whitelist: $RL_WHITELIST
  );
}

/* Ahora sí valida Content-Type y body */
$ct = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($ct, 'application/json') === false) {
  http_response_code(415);
  die(json_encode(["ok"=>false,"error"=>"Content-Type debe ser application/json"]));
}
$raw = file_get_contents("php://input", false, null, 0, 64*1024 + 1);
if ($raw === false || strlen($raw) === 0) { http_response_code(400); die(json_encode(["ok"=>false,"error"=>"Body vacío"])); }
if (strlen($raw) > 64*1024) { http_response_code(413); die(json_encode(["ok"=>false,"error"=>"Payload demasiado grande"])); }

/* ===== CSRF/Origen o HMAC obligatorio =====
   - Si viene Origin y NO está en ALLOWED → 403
   - Si NO hay Origin/Referer permitido → exigir HMAC (X-TS/X-APP/X-SIG) */
$ref        = $_SERVER['HTTP_REFERER'] ?? '';
$refererOK  = false;
if ($ref) {
  foreach ($ALLOWED as $base) {
    if (stripos($ref, rtrim($base,'/').'/') === 0) { $refererOK = true; break; }
  }
}

if (isset($_SERVER['HTTP_ORIGIN']) && !$originOK) {
  http_response_code(403);
  echo json_encode(['ok'=>false,'error'=>'Origin no permitido']);
  exit;
}

// Forzar firma SIEMPRE para POST
$requiresSig = true;

if ($requiresSig) {
  $ts  = $_SERVER['HTTP_X_TS']  ?? '';
  $app = $_SERVER['HTTP_X_APP'] ?? '';   // ej. "webpublic"
  $sig = $_SERVER['HTTP_X_SIG'] ?? '';

  $secret = $app ? getenv('API_SECRET_'.$app) : null;

  if (!$ts || !$sig || !$secret) {
    http_response_code(403);
    echo json_encode(['ok'=>false,'error'=>'Falta firma (X-TS/X-APP/X-SIG)']);
    exit;
  }
  if (!ctype_digit($ts) || abs(time() - (int)$ts) > 300) {
    http_response_code(403);
    echo json_encode(['ok'=>false,'error'=>'Timestamp inválido/expirado']);
    exit;
  }
  $base = $ts.'.'.$raw;
  $calc = base64_encode(hash_hmac('sha256', $base, $secret, true));
  if (!hash_equals($calc, $sig)) {
    http_response_code(403);
    echo json_encode(['ok'=>false,'error'=>'Firma inválida']);
    exit;
  }
}

/* Decodifica JSON (mejor explícito si falla) */
$in = json_decode($raw, true);
if (!is_array($in)) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'JSON inválido']);
  exit;
}

/* ===== Conexión ===== */
$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false, "error"=>"No se encontró conexion.php en $path"])); }
$con = conectar();
if (!$con) die(json_encode(["ok"=>false, "error"=>"No se pudo conectar a la base de datos"]));
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

/* ===== Idempotencia (servidor) ===== */
$idemp = $_SERVER['HTTP_IDEMPOTENCY_KEY'] ?? null;
if ($idemp) {
  $con->query("CREATE TABLE IF NOT EXISTS api_idempotency (
    idempotency_key VARBINARY(64) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB");
  $ix = $con->prepare("INSERT IGNORE INTO api_idempotency(idempotency_key) VALUES(?)");
  $ix->bind_param("s", $idemp);
  $ix->execute(); $aff = $ix->affected_rows; $ix->close();
  if ($aff === 0) { http_response_code(208); die(json_encode(["ok"=>true,"warning"=>"Idempotencia: ya procesado"])); }
}

/* ===== Allowlist de parámetros & requeridos ===== */
$allowed = [
  'departamento_id','tramite_id','asunto','descripcion',
  'contacto_nombre','contacto_email','contacto_telefono',
  'contacto_calle','contacto_colonia','contacto_cp'
];
foreach ($in as $k=>$v) {
  if (!in_array($k, $allowed, true)) {
    http_response_code(400);
    die(json_encode(["ok"=>false,"error"=>"Parámetro no permitido: $k"]));
  }
}
$required = ['departamento_id','tramite_id','asunto','descripcion','contacto_nombre'];
foreach ($required as $k) {
  if (!isset($in[$k]) || trim((string)$in[$k]) === '') {
    http_response_code(400);
    die(json_encode(["ok"=>false, "error"=>"Falta parámetro obligatorio: $k"]));
  }
}

/* ===== Inputs (solo permitidos) ===== */
$departamento_id  = (int)$in['departamento_id'];
$tramite_id       = (int)$in['tramite_id'];
$asunto           = trim((string)$in['asunto']);
$descripcion      = trim((string)$in['descripcion']);
$contacto_nombre  = trim((string)($in['contacto_nombre'] ?? ''));
$contacto_email   = isset($in['contacto_email']) ? trim((string)$in['contacto_email']) : null;
$contacto_tel     = isset($in['contacto_telefono']) ? preg_replace('/\D+/', '', (string)$in['contacto_telefono']) : null;
$contacto_calle   = isset($in['contacto_calle']) ? trim((string)$in['contacto_calle']) : null;
$contacto_colonia = isset($in['contacto_colonia']) ? trim((string)$in['contacto_colonia']) : null;
$contacto_cp      = isset($in['contacto_cp']) ? trim((string)$in['contacto_cp']) : null;

/* Defaults sensibles SOLO en servidor */
$prioridad  = 2; $estatus = 0; $canal = 1; $status = 1;
$asignado_a = null; $created_by = null; $fecha_limite = null;

/* Saneos básicos */
if (mb_strlen($asunto) > 200)       $asunto = mb_substr($asunto, 0, 200);
if (mb_strlen($descripcion) > 1000) $descripcion = mb_substr($descripcion, 0, 1000);
if ($contacto_email && !filter_var($contacto_email, FILTER_VALIDATE_EMAIL)) $contacto_email = null;
if ($contacto_cp && !preg_match('/^[0-9]{5}$/', $contacto_cp)) $contacto_cp = null;

/* ===== Honeypot / Shadow-drop para payloads repetidos o de prueba ===== */
/* Detecta nombres/emails/teléfonos típicos de pruebas y repeticiones.
   Si coincide, NO inserta, loguea y responde 201 con un folio falso. */

function __shadow_drop_honeypot(?string $nombre=null, ?string $email=null, ?string $tel=null): void {
  $n = mb_strtolower(trim((string)$nombre));
  $e = mb_strtolower(trim((string)$email));
  $t = preg_replace('/\D+/', '', (string)$tel);

  // Listas de valores “dummy” comunes
  $BAD_NAMES  = ['john doe','juan perez','paco valenzuela','john  doe']; // puedes agregar más
  $BAD_EMAILS = ['email@gmail.com','test@test.com','correo@correo.com','prueba@prueba.com'];
  $BAD_TELS   = ['1234567890','0000000000','3333333333','1111111111'];

  // Heurísticas simples
  $looks_bad =
      ($n !== '' && in_array($n, $BAD_NAMES, true))
   || ($e !== '' && in_array($e, $BAD_EMAILS, true))
   || ($t !== '' && in_array($t, $BAD_TELS, true))
   // nombre excesivamente corto o genérico
   || ($n !== '' && mb_strlen($n) < 4)
   // email local-part muy genérico
   || ($e !== '' && preg_match('/^(email|test|correo|prueba)@/i', $e))
   // teléfono con menos de 10 dígitos en MX
   || ($t !== '' && strlen($t) < 10);

  // Firma de repetición exacta (misma terna) para activar shadow-ban
  $sig = $n.'|'.$e.'|'.$t;
  $k   = 'hp_sig:'.hash('sha256', $sig);
  $cnt = 0;

  if (function_exists('apcu_enabled') && apcu_enabled()) {
    $ok = false; $val = apcu_fetch($k, $ok);
    if ($ok && is_array($val) && isset($val['c'])) $cnt = (int)$val['c'];
    $cnt++;
    apcu_store($k, ['c'=>$cnt,'at'=>time()], 3600); // recuerda por 1h
  }

  // Disparadores:
  //  - contenido sospechoso
  //  - o repetido >=2 veces exacto en 1h
  if ($looks_bad || $cnt >= 2) {
    // Folio falso con 10 dígitos
    try {
      $fake = str_pad((string)random_int(1, 9999999999), 10, '0', STR_PAD_LEFT);
    } catch (Throwable $__) {
      $fake = str_pad((string)mt_rand(1, 9999999999), 10, '0', STR_PAD_LEFT);
    }
    $fakeFolio = 'REQ-'.$fake;

    // Log para auditoría
    if (!function_exists('api_log')) { @include __DIR__.'/_logger.php'; }
    api_log('200','shadow_drop', [
      'reason' => $looks_bad ? 'honeypot_values' : 'repeat_signature',
      'name'   => $n ?: null,
      'email'  => $e ?: null,
      'tel'    => $t ?: null,
      'count'  => $cnt
    ]);

    // Respuesta “OK” sin tocar la base
    http_response_code(201);
    header('Content-Type: application/json');
    echo json_encode([
      'ok'   => true,
      'data' => [
        'folio' => $fakeFolio,
        // Devolvemos el eco mínimo para que el caller “crea” que fue exitoso.
      ],
      'wa' => ['skipped' => 'shadow_drop']
    ], JSON_UNESCAPED_UNICODE);
    exit; // <- importantísimo
  }
}

/* === Invoca el honeypot antes de cualquier operación de BD === */
__shadow_drop_honeypot($contacto_nombre, $contacto_email, $contacto_tel);


/* ===== Validaciones FK ===== */
$st = $con->prepare("SELECT 1 FROM departamento WHERE id=? LIMIT 1");
$st->bind_param("i", $departamento_id);
$st->execute();
if (!$st->get_result()->fetch_row()) {
  $st->close(); $con->close();
  http_response_code(400);
  die(json_encode(["ok"=>false, "error"=>"departamento_id no existe"]));
}
$st->close();

$st = $con->prepare("SELECT departamento_id FROM tramite WHERE id=? LIMIT 1");
$st->bind_param("i", $tramite_id);
$st->execute();
$row_t = $st->get_result()->fetch_assoc();
$st->close();

if (!$row_t) {
  $con->close();
  http_response_code(400);
  die(json_encode(["ok"=>false, "error"=>"tramite_id no existe"]));
}
if ((int)$row_t['departamento_id'] !== $departamento_id) {
  $con->close();
  http_response_code(400);
  die(json_encode(["ok"=>false, "error"=>"El tramite_id no pertenece al departamento_id enviado"]));
}

/* ===== Transacción: INSERT -> UPDATE folio ===== */
$con->begin_transaction();

$sql = "INSERT INTO requerimiento (
  folio, departamento_id, tramite_id, asignado_a,
  asunto, descripcion, prioridad, estatus, canal,
  contacto_nombre, contacto_email, contacto_telefono,
  contacto_calle, contacto_colonia, contacto_cp,
  fecha_limite, status, created_by
) VALUES (CONCAT('TMP-', UUID_SHORT()), ?,?,?, ?,?, ?,?, ?, ?,?,?, ?,?,?, ?, ?, ?)";

$st = $con->prepare($sql);
$st->bind_param(
  "iiissiiisssssssii",
  $departamento_id, $tramite_id, $asignado_a,
  $asunto, $descripcion, $prioridad, $estatus, $canal,
  $contacto_nombre, $contacto_email, $contacto_tel,
  $contacto_calle, $contacto_colonia, $contacto_cp,
  $fecha_limite, $status, $created_by
);

if (!$st->execute()) {
  $err = $st->error; $code = $st->errno;
  $st->close(); $con->rollback(); $con->close();
  http_response_code(400);
  die(json_encode(["ok"=>false, "error"=>"Error al insertar"])); // no exponer detalle
}
$new_id = $st->insert_id;
$st->close();

$st = $con->prepare("UPDATE requerimiento SET folio = CONCAT('REQ-', LPAD(?,10,'0')) WHERE id=?");
$st->bind_param("ii", $new_id, $new_id);
if (!$st->execute()) {
  $st->close(); $con->rollback(); $con->close();
  http_response_code(500);
  die(json_encode(["ok"=>false, "error"=>"Error al generar folio"]));
}
$st->close();
$con->commit();

/* ===== Recuperar registro para respuesta ===== */
$q = $con->prepare("
  SELECT r.*,
         d.nombre AS departamento_nombre,
         t.nombre AS tramite_nombre,
         CONCAT(e.nombre,' ',e.apellidos) AS asignado_nombre_completo
  FROM requerimiento r
  JOIN departamento d ON d.id = r.departamento_id
  JOIN tramite t      ON t.id = r.tramite_id
  LEFT JOIN empleado e ON e.id = r.asignado_a
  WHERE r.id=? LIMIT 1
");
$q->bind_param("i", $new_id);
$q->execute();
$res = $q->get_result()->fetch_assoc();
$q->close();

/* ---------- Envío de WhatsApp (igual que tenías) ---------- */
function to_e164_mx($tel) {
  $d = preg_replace('/\D+/', '', (string)$tel);
  $d = preg_replace('/^(?:044|045|01)/', '', $d);
  if (preg_match('/^52\d{10}$/', $d)) return $d;
  if (preg_match('/^\d{10}$/', $d))   return '52'.$d;
  if (preg_match('/^\d{11,15}$/', $d)) return $d;
  return null;
}
$wa = ["called" => false];
if ($res && !empty($res['contacto_telefono'])) {
  $to = to_e164_mx($res['contacto_telefono']);
  if ($to) {
    $tplName   = "req_01";
    $langCode  = "es_MX";
    $paramsArr = [$res['folio']];
    $paramsJson= json_encode($paramsArr, JSON_UNESCAPED_UNICODE);
    $waPayload = ["to"=>$to, "template"=>$tplName, "lang"=>$langCode, "params"=>$paramsArr];
    $waUrl = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/send_wapp_template_01.php";

    $ch = curl_init($waUrl);
    curl_setopt_array($ch, [
      CURLOPT_HTTPHEADER     => ["Content-Type: application/json"],
      CURLOPT_POST           => true,
      CURLOPT_POSTFIELDS     => json_encode($waPayload, JSON_UNESCAPED_UNICODE),
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_CONNECTTIMEOUT => 2,
      CURLOPT_TIMEOUT        => 5
    ]);
    $waResp = curl_exec($ch);
    $waCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $waErr  = curl_error($ch);
    curl_close($ch);

    $wa["called"]    = true;
    $wa["http_code"] = $waCode ?: null;
    $wa["error"]     = $waErr ?: null;
    $waDecoded = json_decode($waResp, true);
    if (is_array($waDecoded)) $wa["response"] = $waDecoded;

    $ok       = is_array($waDecoded) && !empty($waDecoded['success']);
    $httpCode = $waCode ?: ($waDecoded['http_code'] ?? 0);
    $msgId    = $waDecoded['message_id'] ?? null;
    $errTxt   = $waErr ?: ($waDecoded['error'] ?? null);
    $provResp = is_array($waDecoded) ? json_encode($waDecoded, JSON_UNESCAPED_UNICODE) : null;

    $dedupe = hash('sha256', implode('|', [ $res['id'] ?? '0', $to, $tplName, $paramsJson ]));

    $status   = $ok ? 'sent' : 'queued';
    $attempts = $ok ? 1 : 0;
    $sentAt   = $ok ? date('Y-m-d H:i:s') : null;

    $stmt = $con->prepare("
      INSERT INTO wa_outbox
        (req_id, to_phone, template_name, lang_code, params_json,
         status, attempts, next_attempt_at, wa_message_id, last_error, dedupe_key, sent_at)
      VALUES (?,?,?,?,?, ?,?, NOW(), ?,?,?, ?)
      ON DUPLICATE KEY UPDATE
        status       = VALUES(status),
        wa_message_id= COALESCE(VALUES(wa_message_id), wa_outbox.wa_message_id),
        last_error   = VALUES(last_error),
        updated_at   = CURRENT_TIMESTAMP,
        sent_at      = COALESCE(VALUES(sent_at), wa_outbox.sent_at)
    ");
    $stmt->bind_param("isssssissss", $res['id'], $to, $tplName, $langCode, $paramsJson, $status, $attempts, $msgId, $errTxt, $dedupe, $sentAt);
    $stmt->execute();
    $outboxId = $stmt->insert_id;
    $stmt->close();

    if (!$outboxId) {
      $g = $con->prepare("SELECT id FROM wa_outbox WHERE dedupe_key=? LIMIT 1");
      $g->bind_param("s", $dedupe);
      $g->execute();
      $row = $g->get_result()->fetch_assoc();
      $outboxId = $row['id'] ?? null;
      $g->close();
    }

    if ($outboxId) {
      $upd = $con->prepare("UPDATE wa_outbox SET attempts = attempts + 1 WHERE id=?");
      $upd->bind_param("i", $outboxId);
      $upd->execute();
      $upd->close();

      $g2 = $con->prepare("SELECT attempts FROM wa_outbox WHERE id=?");
      $g2->bind_param("i", $outboxId);
      $g2->execute();
      $attemptRow = $g2->get_result()->fetch_assoc();
      $g2->close();
      $tryNo = (int)($attemptRow['attempts'] ?? 1);
    } else { $tryNo = 1; }

    $stmt = $con->prepare("
      INSERT INTO wa_log (outbox_id, req_id, try_no, http_code, provider_message_id, provider_response, error_text)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->bind_param("isiisss", $outboxId, $res['id'], $tryNo, $httpCode, $msgId, $provResp, $errTxt);
    $stmt->execute();
    $stmt->close();

    if ($ok && $outboxId) {
      $stmt = $con->prepare("UPDATE wa_outbox SET status='sent', wa_message_id=COALESCE(?, wa_message_id), sent_at=COALESCE(?, sent_at) WHERE id=?");
      $stmt->bind_param("ssi", $msgId, $sentAt, $outboxId);
      $stmt->execute(); $stmt->close();
    }
  } else { $wa["skipped"] = "Telefono no válido para E.164"; }
}

$con->close();

/* Cast numéricos para data */
if ($res) {
  $res['id']              = (int)$res['id'];
  $res['departamento_id'] = (int)$res['departamento_id'];
  $res['tramite_id']      = (int)$res['tramite_id'];
  $res['asignado_a']      = isset($res['asignado_a']) ? (int)$res['asignado_a'] : null;
  $res['prioridad']       = (int)$res['prioridad'];
  $res['estatus']         = (int)$res['estatus'];
  $res['canal']           = (int)$res['canal'];
  $res['status']          = (int)$res['status'];
}

api_log('ok', 'requerimiento_creado', [
  "elapsed_ms" => round((microtime(true) - $__t0) * 1000),
  "req_id"     => $new_id ?? null,
  "folio"      => $res['folio'] ?? null
]);

http_response_code(201);
echo json_encode(["ok"=>true, "data"=>$res, "wa"=>$wa], JSON_UNESCAPED_UNICODE);

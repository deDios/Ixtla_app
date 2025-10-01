<?php
/* ===== CORS (poner literalmente al inicio del archivo) ===== */
$origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
$ALLOWED = ['https://ixtla-app.com','https://www.ixtla-app.com'];
$originOK = $origin && in_array($origin, $ALLOWED, true);

if ($originOK) {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
  // headers que el front podrá LEER en la respuesta del POST
  header("Access-Control-Expose-Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After");
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  if ($originOK) {
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    // Debe incluir EXACTAMENTE los headers que enviará tu fetch()
    header('Access-Control-Allow-Headers: Content-Type, Accept, X-Requested-With, Idempotency-Key, X-Trace-Label, X_TRACE_LABEL, X_Trace_Label');
    header('Access-Control-Max-Age: 86400');
  }
  http_response_code(204);
  exit;
}

/* ===== Content-Type y tamaño ===== */
header('Content-Type: application/json');
date_default_timezone_set('America/Mexico_City');

/* Método permitido */
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  http_response_code(405);
  die(json_encode(["ok"=>false,"error"=>"Método no permitido"]));
}

/* ====== RATE LIMIT por IP (5/min, ban 30 min) ====== */
/* IP helper: usa XFF solo si el remoto es proxy de confianza */
function __ip_in_cidr(string $ip, string $cidr): bool {
  [$subnet, $mask] = explode('/', $cidr) + [null, null];
  if ($mask === null) return $ip === $subnet;
  $mask = (int)$mask;
  return (ip2long($ip) & ~((1 << (32 - $mask)) - 1)) === (ip2long($subnet) & ~((1 << (32 - $mask)) - 1));
}
function __rl_ip(): string {
  $remote = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
  $trusted = ['127.0.0.1/32','10.0.0.0/8','172.16.0.0/12','192.168.0.0/16']; // proxies internos
  $isTrusted = false;
  foreach ($trusted as $cidr) { if (__ip_in_cidr($remote, $cidr)) { $isTrusted = true; break; } }
  $xff = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
  if ($isTrusted && $xff) {
    $parts = array_map('trim', explode(',', $xff));
    if (!empty($parts[0])) return $parts[0];
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
  string $bucket, int $windowSec=60, int $maxHits=5,
  int $banSec=1800, array $whitelist=[]
): void {
  $ip = __rl_ip();
  if (in_array($ip,$whitelist,true)) return;

  $now=time(); $winId=intdiv($now,$windowSec); $key="rl:$bucket:$ip";
  $d=__rl_get($key) ?: ['win'=>$winId,'cnt'=>0,'ban_until'=>0];

  if(!empty($d['ban_until']) && $d['ban_until']>$now){
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
    header('Retry-After: '.$banSec);
    http_response_code(429);
    echo json_encode(['ok'=>false,'error'=>'Too Many Requests','retry_after'=>$banSec],JSON_UNESCAPED_UNICODE);
    exit;
  }

  __rl_set($key,$d,max($windowSec,$banSec));
}

/* → Aplica límite ANTES de leer body/validar content-type */

/* ① Whitelist de desarrollo (agrega tus IPs/rede(s)) */
$RL_WHITELIST = [
];

/* ② (Opcional) Bypass con header secreto para Postman/frontend confiable */
$RL_BYPASS_HEADER = 'HTTP_X-Trace-Label';
$RL_BYPASS_SECRET = 'Zf7wL2qH9tM4vC1xR8yN3pK6dT0aB5uJ2mG7eS4rV9cQ1nX5kD8hP3wL6yT0sA5mG2eR8vC1'; // cámbialo por uno fuerte

$__skip_rl = isset($_SERVER[$RL_BYPASS_HEADER]) && hash_equals($RL_BYPASS_SECRET, $_SERVER[$RL_BYPASS_HEADER]);

if (!$__skip_rl) {
  rate_limit_or_die(
    bucket: 'requerimiento_api',
    windowSec: 10,   // ventana de 10 seg
    maxHits: 2,     // 2 req/min antes de ban
    banSec: 3600,     // ban de 1 hr
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

$in = json_decode($raw, true) ?? [];

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
  die(json_encode(["ok"=>false, "error"=>"Error al insertar", "detail"=>$err, "code"=>$code]));
}
$new_id = $st->insert_id;
$st->close();

$st = $con->prepare("UPDATE requerimiento SET folio = CONCAT('REQ-', LPAD(?,10,'0')) WHERE id=?");
$st->bind_param("ii", $new_id, $new_id);
if (!$st->execute()) {
  $err = $st->error; $code = $st->errno;
  $st->close(); $con->rollback(); $con->close();
  http_response_code(500);
  die(json_encode(["ok"=>false, "error"=>"Error al generar folio", "detail"=>$err, "code"=>$code]));
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

http_response_code(201);
echo json_encode(["ok"=>true, "data"=>$res, "wa"=>$wa], JSON_UNESCAPED_UNICODE); 

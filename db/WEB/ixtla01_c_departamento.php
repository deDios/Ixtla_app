<?php
/* ===== CORS (poner literalmente al inicio del archivo) ===== */
$origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
$method  = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$ALLOWED = ['https://ixtla-app.com','https://www.ixtla-app.com'];

/* Preflight */
if ($method === 'OPTIONS') {
  if ($origin && in_array($origin, $ALLOWED, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Vary: Origin");
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS'); // solo lo que usas aquí
    header('Access-Control-Allow-Headers: Content-Type, Accept, X-Requested-With, Idempotency-Key, X-TRACE-LABEL');
    header('Access-Control-Max-Age: 86400');
    http_response_code(204);
  } else {
    // Origin no permitido => no revelar CORS. Puedes usar 403 explícito si prefieres:
    http_response_code(403);
  }
  exit;
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
$RL_BYPASS_HEADER = 'HTTP_X-RL-BS';
$RL_BYPASS_SECRET = 'r0K2z-F6iG-9vP9wP'; // cámbialo por uno fuerte

$__skip_rl = isset($_SERVER[$RL_BYPASS_HEADER]) && hash_equals($RL_BYPASS_SECRET, $_SERVER[$RL_BYPASS_HEADER]);

if (!$__skip_rl) {
  rate_limit_or_die(
    bucket: 'requerimiento_api',
    windowSec: 10,   // ventana de 10 seg
    maxHits: 10,     // 2 req/min antes de ban
    banSec: 3600,     // ban de 1 hr
    whitelist: $RL_WHITELIST
  );
}

/* Respuestas normales: si origin permitido, habilita CORS */
if ($origin && in_array($origin, $ALLOWED, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
  header("Access-Control-Expose-Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After");
}

header('Content-Type: application/json');
date_default_timezone_set('America/Mexico_City');

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php"])); }


$input = json_decode(file_get_contents("php://input"), true) ?? [];

$id       = isset($input['id']) ? (int)$input['id'] : null;
$q        = isset($input['q']) ? trim($input['q']) : null;
$status   = isset($input['status']) ? (int)$input['status'] : null;
$page     = isset($input['page']) ? max(1,(int)$input['page']) : 1;
$per_page = isset($input['per_page']) ? min(200,max(1,(int)$input['per_page'])) : 50;
$all      = isset($input['all']) ? (bool)$input['all'] : false;

$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar"]));
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

$baseSelect = "
SELECT d.*,
       e1.nombre AS director_nombre, e1.apellidos AS director_apellidos,
       e2.nombre AS primera_nombre,  e2.apellidos AS primera_apellidos
FROM departamento d
LEFT JOIN empleado e1 ON d.director = e1.id
LEFT JOIN empleado e2 ON d.primera_linea = e2.id
";

if ($id) {
    $sql = $baseSelect . " WHERE d.id = ? LIMIT 1";
    $st  = $con->prepare($sql);
    $st->bind_param("i", $id);
    $st->execute();
    $row = $st->get_result()->fetch_assoc();
    $st->close(); $con->close();

    if (!$row) { echo json_encode(["ok"=>false,"error"=>"No se encontrado"]); exit; }
    $row['id'] = (int)$row['id']; $row['status'] = (int)$row['status'];
    echo json_encode(["ok"=>true,"data"=>$row]); exit;
}

$where  = [];
$params = [];
$types  = "";

if ($q !== null && $q !== "") {
    $where[] = "(d.nombre LIKE CONCAT('%',?,'%') OR d.descripcion LIKE CONCAT('%',?,'%'))";
    $params[] = $q; $params[] = $q; $types .= "ss";
}
if ($status !== null) {
    $where[] = "d.status = ?";
    $params[] = $status; $types .= "i";
}

$sql = $baseSelect . (count($where) ? " WHERE ".implode(" AND ", $where) : "") . " ORDER BY d.created_at DESC";

if (!$all) {
    $offset = ($page - 1) * $per_page;
    $sql   .= " LIMIT ? OFFSET ?";
    $params[] = $per_page; $types .= "i";
    $params[] = $offset;   $types .= "i";
}

$st = $con->prepare($sql);
if ($types !== "") {
    $st->bind_param($types, ...$params);
}
$st->execute();
$rs = $st->get_result();

$data = [];
while ($row = $rs->fetch_assoc()) {
    $row['id'] = (int)$row['id'];
    $row['status'] = (int)$row['status'];
    $data[] = $row;
}
$st->close(); $con->close();

$resp = ["ok"=>true, "count"=>count($data), "data"=>$data];
if (!$all) { $resp["page"] = $page; $resp["per_page"] = $per_page; }

echo json_encode($resp);

<?php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === 'https://ixtla-app.com' || $origin === 'https://www.ixtla-app.com') {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400");
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }


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
$RL_BYPASS_HEADER = 'HTTP_X-RL-BS';
$RL_BYPASS_SECRET = 'r0K2z-F6iG-9vP9wP'; // cámbialo por uno fuerte

$__skip_rl = isset($_SERVER[$RL_BYPASS_HEADER]) && hash_equals($RL_BYPASS_SECRET, $_SERVER[$RL_BYPASS_HEADER]);

if (!$__skip_rl) {
  rate_limit_or_die(
    bucket: 'requerimiento_api',
    windowSec: 10,   // ventana de 10 seg
    maxHits: 9,     // 2 req/min antes de ban
    banSec: 3600,     // ban de 1 hr
    whitelist: $RL_WHITELIST
  );
}


header('Content-Type: application/json');
date_default_timezone_set('America/Mexico_City');

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php"])); }

$in = json_decode(file_get_contents("php://input"), true) ?? [];


$id             = isset($in['id']) ? (int)$in['id'] : null;
$folio          = isset($in['folio']) ? trim($in['folio']) : null;

$departamento_id= isset($in['departamento_id']) ? (int)$in['departamento_id'] : null;
$tramite_id     = isset($in['tramite_id']) ? (int)$in['tramite_id'] : null;
$asignado_a     = isset($in['asignado_a']) ? (int)$in['asignado_a'] : null;

$estatus  = isset($in['estatus']) ? (int)$in['estatus'] : null;
$prioridad= isset($in['prioridad']) ? (int)$in['prioridad'] : null;
$canal    = isset($in['canal']) ? (int)$in['canal'] : null;

$q = isset($in['q']) ? trim($in['q']) : null;

$created_from = isset($in['created_from']) ? trim($in['created_from']) : null; // 'YYYY-MM-DD'
$created_to   = isset($in['created_to'])   ? trim($in['created_to'])   : null;

$page     = isset($in['page']) ? max(1,(int)$in['page']) : 1;
$per_page = isset($in['per_page']) ? min(200,max(1,(int)$in['per_page'])) : 50;
$all      = isset($in['all']) ? (bool)$in['all'] : false;

$con = conectar();
if (!$con) die(json_encode(["ok"=>false,"error"=>"No se pudo conectar"]));
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

$base = "
SELECT r.*,
       d.nombre AS departamento_nombre,
       t.nombre AS tramite_nombre,
       CONCAT(e.nombre,' ',e.apellidos) AS asignado_nombre_completo
FROM requerimiento r
JOIN departamento d ON d.id = r.departamento_id
JOIN tramite t      ON t.id = r.tramite_id
LEFT JOIN empleado e ON e.id = r.asignado_a
";

if ($id || $folio) {
  if ($id) {
    $sql = $base . " WHERE r.id=? LIMIT 1";
    $st = $con->prepare($sql);
    $st->bind_param("i",$id);
  } else {
    $sql = $base . " WHERE r.folio=? LIMIT 1";
    $st = $con->prepare($sql);
    $st->bind_param("s",$folio);
  }
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close(); $con->close();

  if (!$row) { echo json_encode(["ok"=>false,"error"=>"No encontrado"]); exit; }
  $row['id'] = (int)$row['id'];
  $row['departamento_id'] = (int)$row['departamento_id'];
  $row['tramite_id'] = (int)$row['tramite_id'];
  $row['asignado_a'] = isset($row['asignado_a']) ? (int)$row['asignado_a'] : null;
  $row['prioridad'] = (int)$row['prioridad'];
  $row['estatus'] = (int)$row['estatus'];
  $row['canal'] = (int)$row['canal'];
  $row['status'] = (int)$row['status'];
  echo json_encode(["ok"=>true,"data"=>$row]); exit;
}

/* Lista con filtros */
$where = [];
$params = [];
$types  = "";

if ($departamento_id !== null) { $where[]="r.departamento_id=?"; $params[]=$departamento_id; $types.="i"; }
if ($tramite_id      !== null) { $where[]="r.tramite_id=?";      $params[]=$tramite_id;      $types.="i"; }
if ($asignado_a      !== null) { $where[]="r.asignado_a=?";      $params[]=$asignado_a;      $types.="i"; }
if ($estatus         !== null) { $where[]="r.estatus=?";         $params[]=$estatus;         $types.="i"; }
if ($prioridad       !== null) { $where[]="r.prioridad=?";       $params[]=$prioridad;       $types.="i"; }
if ($canal           !== null) { $where[]="r.canal=?";           $params[]=$canal;           $types.="i"; }
if ($q !== null && $q !== "") {
  $where[]="(r.asunto LIKE CONCAT('%',?,'%') OR r.descripcion LIKE CONCAT('%',?,'%') OR r.contacto_nombre LIKE CONCAT('%',?,'%'))";
  $params[]=$q; $params[]=$q; $params[]=$q; $types.="sss";
}
if ($created_from) { $where[]="DATE(r.created_at) >= ?"; $params[]=$created_from; $types.="s"; }
if ($created_to)   { $where[]="DATE(r.created_at) <= ?"; $params[]=$created_to;   $types.="s"; }

$sql = $base . (count($where) ? " WHERE ".implode(" AND ", $where) : "") .
       " ORDER BY r.created_at DESC";

if (!$all) {
  $offset = ($page - 1) * $per_page;
  $sql .= " LIMIT ? OFFSET ?";
  $params[] = $per_page; $types.="i";
  $params[] = $offset;   $types.="i";
}

$st = $con->prepare($sql);
if ($types !== "") { $st->bind_param($types, ...$params); }
$st->execute();
$rs = $st->get_result();

$data=[];
while ($row = $rs->fetch_assoc()) {
  $row['id'] = (int)$row['id'];
  $row['departamento_id'] = (int)$row['departamento_id'];
  $row['tramite_id'] = (int)$row['tramite_id'];
  $row['asignado_a'] = isset($row['asignado_a']) ? (int)$row['asignado_a'] : null;
  $row['prioridad'] = (int)$row['prioridad'];
  $row['estatus'] = (int)$row['estatus'];
  $row['canal'] = (int)$row['canal'];
  $row['status'] = (int)$row['status'];
  $data[] = $row;
}
$st->close(); $con->close();

$resp = ["ok"=>true, "count"=>count($data), "data"=>$data];
if (!$all) { $resp["page"]=$page; $resp["per_page"]=$per_page; }
echo json_encode($resp);

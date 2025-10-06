<?php
// db/WEB/ixtla01_ins_requerimiento_img.php

header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('America/Mexico_City');

/* ===== CORS ===== */
$allowlist = [
  'https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net',
  'https://ixtla-app.com',
  'https://www.ixtla-app.com',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowlist, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Trace-Label');
header('Access-Control-Max-Age: 600');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

/* ===== Método ===== */
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  http_response_code(405);
  echo json_encode(["ok"=>false,"error"=>"Método no permitido"]); exit;
}

/* ===== Rate limit (5 por minuto, ban 30 min) ===== */
function __ip_in_cidr(string $ip, string $cidr): bool {
  [$subnet, $mask] = explode('/', $cidr) + [null, null];
  if ($mask === null) return $ip === $subnet;
  $mask = (int)$mask;
  return (ip2long($ip) & ~((1 << (32 - $mask)) - 1)) === (ip2long($subnet) & ~((1 << (32 - $mask)) - 1));
}
function __rl_ip(): string {
  $remote = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
  $trusted = ['127.0.0.1/32','10.0.0.0/8','172.16.0.0/12','192.168.0.0/16'];
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
  if (function_exists('apcu_enabled') && apcu_enabled()) { $ok=false; $v=apcu_fetch($key,$ok); return $ok?$v:null; }
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
function rate_limit_or_die(string $bucket, int $windowSec=60, int $maxHits=5, int $banSec=1800, array $whitelist=[]): void {
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
rate_limit_or_die('requerimiento_upload');

/* ===== Content-Type: multipart/form-data ===== */
$ct = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($ct, 'multipart/form-data') === false) {
  http_response_code(415);
  echo json_encode(["ok"=>false,"error"=>"Content-Type debe ser multipart/form-data"]); exit;
}

/* ===== Conexión BD ===== */
$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); echo json_encode(["ok"=>false,"error"=>"No se encontró conn_db.php"]); exit; }
$con = conectar();
if(!$con){ http_response_code(500); echo json_encode(["ok"=>false,"error"=>"No se pudo conectar BD"]); exit; }
$con->set_charset('utf8mb4');
@$con->query("SET time_zone='-06:00'");

/* ===== Config ===== */
$MAX_FILES    = 3;
$MAX_BYTES    = 1 * 1024 * 1024; // 1 MB por archivo
$ALLOWED_MIME = ['image/jpeg','image/png','image/webp','image/heic','image/heif'];
$EXT_FOR_MIME = [
  'image/jpeg' => 'jpg',
  'image/png'  => 'png',
  'image/webp' => 'webp',
  'image/heic' => 'heic',
  'image/heif' => 'heif',
];

/* ===== Entrada ===== */
$folio     = isset($_POST['folio'])  ? strtoupper(trim($_POST['folio'])) : null;
$statusRaw = isset($_POST['status']) ? trim($_POST['status'])            : null;

if (!$folio || !preg_match('/^REQ-\d{10}$/', $folio)) {
  http_response_code(400); echo json_encode(["ok"=>false,"error"=>"Folio inválido. Formato: REQ-0000000000"]); exit;
}
if ($statusRaw === null || !preg_match('/^-?\d+$/', $statusRaw)) {
  http_response_code(400); echo json_encode(["ok"=>false,"error"=>"Status inválido (0..6)."]); exit;
}
$status = (int)$statusRaw;
if ($status < 0 || $status > 6) { http_response_code(400); echo json_encode(["ok"=>false,"error"=>"Status inválido (0..6)."]); exit; }

/* ===== Validar folio en BD ===== */
$st = $con->prepare("SELECT id FROM requerimiento WHERE folio=? LIMIT 1");
$st->bind_param("s",$folio);
$st->execute();
$exists = $st->get_result()->fetch_row();
$st->close();
if(!$exists){
  http_response_code(404); echo json_encode(["ok"=>false,"error"=>"Folio no encontrado"]); exit;
}

/* ===== Helpers ===== */
function php_upload_err_msg($code){
  return match((int)$code){
    UPLOAD_ERR_INI_SIZE   => 'El archivo excede upload_max_filesize del servidor.',
    UPLOAD_ERR_FORM_SIZE  => 'El archivo excede MAX_FILE_SIZE del formulario.',
    UPLOAD_ERR_PARTIAL    => 'El archivo se subió parcialmente.',
    UPLOAD_ERR_NO_FILE    => 'No se subió ningún archivo.',
    UPLOAD_ERR_NO_TMP_DIR => 'Falta carpeta temporal.',
    UPLOAD_ERR_CANT_WRITE => 'No se pudo escribir el archivo en disco.',
    UPLOAD_ERR_EXTENSION  => 'Una extensión de PHP detuvo la subida.',
    default               => 'Error de carga desconocido.'
  };
}
function normalize_files_array($filesInput){
  $files=[]; if(isset($filesInput['name']) && is_array($filesInput['name'])){
    $count=count($filesInput['name']);
    for($i=0;$i<$count;$i++){
      $files[]=[
        'name'=>$filesInput['name'][$i]??'',
        'type'=>$filesInput['type'][$i]??'',
        'tmp_name'=>$filesInput['tmp_name'][$i]??'',
        'error'=>$filesInput['error'][$i]??UPLOAD_ERR_NO_FILE,
        'size'=>$filesInput['size'][$i]??0,
      ];
    }
  } elseif(isset($filesInput['name'])) { $files[]=$filesInput; }
  return $files;
}
function ensure_dir($path,$perm=0775){
  if (is_dir($path)) return;
  $old=umask(0); @mkdir($path,$perm,true); umask($old);
  if (!is_dir($path)) throw new RuntimeException("No se pudo crear carpeta: $path");
}
function sanitize_filename($name){
  $n=preg_replace('/[^\w.\-]+/u','_',$name);
  return trim($n,'._-') ?: 'file';
}

/* ===== Archivos ===== */
$files=[];
if (isset($_FILES['files'])) $files=array_merge($files, normalize_files_array($_FILES['files']));
if (isset($_FILES['file']))  $files=array_merge($files, normalize_files_array($_FILES['file']));
if (empty($files)) { http_response_code(400); echo json_encode(["ok"=>false,"error"=>"No se recibieron archivos. Usa 'files' o 'file' (multipart/form-data)."]); exit; }
if (count($files) > $MAX_FILES) { http_response_code(400); echo json_encode(["ok"=>false,"error"=>"Máximo {$MAX_FILES} archivos por solicitud."]); exit; }

/* ===== Paths ===== */
$webroot = realpath("/home/site/wwwroot");
if (!$webroot) { http_response_code(500); echo json_encode(["ok"=>false,"error"=>"No se pudo resolver webroot"]); exit; }
$baseAssets = $webroot . DIRECTORY_SEPARATOR . "ASSETS" . DIRECTORY_SEPARATOR . "requerimientos";
$reqDir     = $baseAssets . DIRECTORY_SEPARATOR . $folio;
$stepDir    = $reqDir . DIRECTORY_SEPARATOR . (string)$status;

try { ensure_dir($baseAssets); ensure_dir($reqDir); ensure_dir($stepDir); }
catch(Throwable $e){ http_response_code(500); echo json_encode(["ok"=>false,"error"=>$e->getMessage()]); exit; }

$publicBase = 'https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net';
$baseUrl    = rtrim($publicBase,'/')."/ASSETS/requerimientos/{$folio}/".(string)$status."/";

/* ===== Proceso ===== */
$finfo  = new finfo(FILEINFO_MIME_TYPE);
$saved  = [];
$failed = [];

foreach ($files as $f) {
  $name = $f['name'] ?? '';
  $size = $f['size'] ?? 0;
  $tmp  = $f['tmp_name'] ?? '';
  $err  = $f['error'] ?? UPLOAD_ERR_NO_FILE;

  if ($err !== UPLOAD_ERR_OK) { $failed[]=["name"=>$name,"error"=>php_upload_err_msg($err)]; continue; }
  if (!is_uploaded_file($tmp)) { $failed[]=["name"=>$name,"error"=>"Archivo no válido (tmp)."]; continue; }
  if ($size <= 0 || $size > $MAX_BYTES) { $failed[]=["name"=>$name,"error"=>"Tamaño inválido (máx. ".($MAX_BYTES/1024/1024)." MB)."]; continue; }

  $mime = $finfo->file($tmp) ?: ($f['type'] ?? '');
  if (!in_array($mime, $ALLOWED_MIME, true)) { $failed[]=["name"=>$name,"error"=>"Tipo no permitido ($mime). Solo JPG/PNG/WebP/HEIC/HEIF."]; continue; }

  $ext  = $EXT_FOR_MIME[$mime] ?? 'bin';
  $base = sanitize_filename(pathinfo($name, PATHINFO_FILENAME));
  $uniq = date('YmdHis')."_".bin2hex(random_bytes(4));
  $final= "{$base}_{$uniq}.{$ext}";

  $destPath = $stepDir . DIRECTORY_SEPARATOR . $final;
  $destUrl  = $baseUrl . rawurlencode($final);

  if (!@move_uploaded_file($tmp, $destPath)) { $failed[]=["name"=>$name,"error"=>"No se pudo mover el archivo."]; continue; }
  @chmod($destPath, 0664);

  $saved[] = ["name"=>$final,"url"=>$destUrl,"path"=>$destPath,"size"=>$size,"mime"=>$mime,"status_dir"=>(string)$status];
}

/* ===== Respuesta ===== */
$ok = count($saved) > 0;
if (!$ok) {
  // Si todos fallaron por tamaño → 413; si no, 400.
  $hasSize = false;
  foreach ($failed as $ff) { if (str_contains($ff['error'] ?? '', 'Tamaño inválido')) { $hasSize = true; break; } }
  http_response_code($hasSize ? 413 : 400);
} else {
  http_response_code(200);
}

echo json_encode([
  "ok"     => $ok,
  "folio"  => $folio,
  "status" => (int)$status,
  "saved"  => $saved,
  "failed" => $failed,
  "limits" => [
    "max_files"    => $MAX_FILES,
    "max_mb"       => $MAX_BYTES/1024/1024,
    "allowed_mime" => $ALLOWED_MIME
  ]
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

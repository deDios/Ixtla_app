<?php
// db/WEB/ixtla01_u_usuario_avatar.php
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

/* ===== Rate limit (5/min, ban 30min) ===== */
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
  if ($isTrusted && $xff) { $parts = array_map('trim', explode(',', $xff)); if (!empty($parts[0])) return $parts[0]; }
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
function rate_limit_or_die(string $bucket, int $windowSec=60, int $maxHits=5, int $banSec=1800): void {
  $ip = __rl_ip();
  $now=time(); $winId=intdiv($now,$windowSec); $key="rl:$bucket:$ip";
  $d=__rl_get($key) ?: ['win'=>$winId,'cnt'=>0,'ban_until'=>0];
  if(!empty($d['ban_until']) && $d['ban_until']>$now){
    $retry=$d['ban_until']-$now; header('Retry-After: '.$retry);
    http_response_code(429); echo json_encode(['ok'=>false,'error'=>'Too Many Requests','retry_after'=>$retry]); exit;
  }
  if($d['win']!==$winId){ $d['win']=$winId; $d['cnt']=0; }
  $d['cnt']++;
  header('X-RateLimit-Limit: '.$maxHits);
  header('X-RateLimit-Remaining: '.max(0,$maxHits-$d['cnt']));
  header('X-RateLimit-Reset: '.(($winId+1)*$windowSec));
  if($d['cnt']>$maxHits){ $d['ban_until']=$now+$banSec; __rl_set($key,$d,max($windowSec,$banSec));
    header('Retry-After: '.$banSec); http_response_code(429);
    echo json_encode(['ok'=>false,'error'=>'Too Many Requests','retry_after'=>$banSec]); exit; }
  __rl_set($key,$d,max($windowSec,$banSec));
}
rate_limit_or_die('usuario_avatar');

/* ===== Content-Type ===== */
$ct = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($ct, 'multipart/form-data') === false) {
  http_response_code(415);
  echo json_encode(["ok"=>false,"error"=>"Content-Type debe ser multipart/form-data"]); exit;
}

/* ===== Entrada ===== */
$uid = isset($_POST['usuario_id']) ? (int)$_POST['usuario_id'] : 0;
$file = $_FILES['avatar'] ?? null;
if ($uid <= 0) { http_response_code(400); echo json_encode(["ok"=>false,"error"=>"usuario_id inválido"]); exit; }
if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
  http_response_code(400); echo json_encode(["ok"=>false,"error"=>"No se recibió archivo 'avatar'"]); exit;
}

/* ===== Límite y tipos ===== */
$MAX_BYTES    = 1 * 1024 * 1024; // 1 MB
$ALLOWED_MIME = ['image/jpeg','image/png','image/webp','image/heic','image/heif'];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime  = $finfo->file($file['tmp_name']) ?: ($file['type'] ?? '');
if (!in_array($mime, $ALLOWED_MIME, true)) {
  http_response_code(415);
  echo json_encode(["ok"=>false,"error"=>"Tipo no permitido. Usa JPG/PNG/WEBP/HEIC/HEIF"]); exit;
}

/* ===== Paths ===== */
$webroot = realpath("/home/site/wwwroot");
if (!$webroot) { http_response_code(500); echo json_encode(["ok"=>false,"error"=>"No se pudo resolver webroot"]); exit; }
$destDir = $webroot . "/ASSETS/user/userImgs";
if (!is_dir($destDir)) { @mkdir($destDir, 0775, true); }
if (!is_dir($destDir)) { http_response_code(500); echo json_encode(["ok"=>false,"error"=>"No se pudo crear carpeta destino"]); exit; }

$filename = "img_{$uid}.png";
$destPath = $destDir . "/" . $filename;
$publicBase = rtrim('https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net','/');
$publicUrl  = $publicBase . "/ASSETS/user/userImgs/" . rawurlencode($filename);

/* ===== Cargar imagen (Imagick → GD fallback) ===== */
function load_as_gd(string $tmp, string $mime) {
  if (extension_loaded('imagick')) {
    try {
      $im = new Imagick();
      $im->readImage($tmp);
      $im->setImageColorspace(Imagick::COLORSPACE_RGB);
      $im->setImageAlphaChannel(Imagick::ALPHACHANNEL_ACTIVATE);
      $im->setImageFormat('png');
      $blob = $im->getImageBlob();
      $gd = imagecreatefromstring($blob);
      $im->clear(); $im->destroy();
      if ($gd) return $gd;
    } catch(Throwable $e){ /* fallback GD */ }
  }
  switch ($mime) {
    case 'image/jpeg': return @imagecreatefromjpeg($tmp);
    case 'image/png':  return @imagecreatefrompng($tmp);
    case 'image/webp': return function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($tmp) : false;
    default: return false; // HEIC/HEIF sin Imagick no es posible
  }
}

$src = load_as_gd($file['tmp_name'], $mime);
if (!$src) { http_response_code(415); echo json_encode(["ok"=>false,"error"=>"No se pudo leer la imagen (instala Imagick para HEIC/HEIF/WEBP)"]); exit; }

/* ===== Corregir orientación EXIF (solo JPEG) ===== */
if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
  $exif = @exif_read_data($file['tmp_name']);
  $ori = isset($exif['Orientation']) ? (int)$exif['Orientation'] : 1;
  if ($ori > 1 && function_exists('imagerotate')) {
    if ($ori === 3)      { $src = imagerotate($src, 180, 0); }
    elseif ($ori === 6)  { $src = imagerotate($src, -90, 0); }
    elseif ($ori === 8)  { $src = imagerotate($src, 90, 0); }
  }
}

/* ===== Normalización: caja máxima y reducción si > 1MB ===== */
$maxBox      = 1024;   // primer normalización
$minBox      = 256;    // no bajar de aquí
$scaleStep   = 0.85;   // 15% por iteración
$pngLevel    = 9;      // compresión PNG (0..9)
$w = imagesx($src); $h = imagesy($src);
$factor = min(1.0, $maxBox / max($w,$h));
$tw = max(1, (int)round($w * $factor));
$th = max(1, (int)round($h * $factor));

function save_png_to_tmp($im, $level) {
  $tmp = tempnam(sys_get_temp_dir(), 'ava_');
  imagealphablending($im, false);
  imagesavealpha($im, true);
  imagepng($im, $tmp, $level);
  return $tmp;
}
function resample_to_size($src, $tw, $th) {
  $dst = imagecreatetruecolor($tw, $th);
  imagealphablending($dst, false);
  imagesavealpha($dst, true);
  $transparent = imagecolorallocatealpha($dst, 0, 0, 0, 127);
  imagefilledrectangle($dst, 0, 0, $tw, $th, $transparent);
  imagecopyresampled($dst, $src, 0, 0, 0, 0, $tw, $th, imagesx($src), imagesy($src));
  return $dst;
}

/* primer render */
$work = resample_to_size($src, $tw, $th);
$tmpPng = save_png_to_tmp($work, $pngLevel);
$size = filesize($tmpPng);

/* si excede 1MB → reducir dimensiones iterativamente */
while ($size > $MAX_BYTES && max($tw,$th) > $minBox) {
  $tw = max($minBox, (int)floor($tw * $scaleStep));
  $th = max($minBox, (int)floor($th * $scaleStep));
  imagedestroy($work);
  $work = resample_to_size($src, $tw, $th);
  @unlink($tmpPng);
  $tmpPng = save_png_to_tmp($work, $pngLevel);
  $size = filesize($tmpPng);
}

/* Si aún así no baja, error amigable */
if ($size > $MAX_BYTES) {
  @unlink($tmpPng); imagedestroy($work); imagedestroy($src);
  http_response_code(413);
  echo json_encode(["ok"=>false,"error"=>"No se pudo comprimir la imagen a ≤ 1MB. Intenta con una imagen más pequeña."]); exit;
}

/* ===== Guardar destino (y limpiar variantes anteriores) ===== */
@unlink($destDir . "/img_{$uid}.jpg");
@unlink($destDir . "/img_{$uid}.webp");
@unlink($destDir . "/img_{$uid}.png"); // reemplazo si ya existía

if (!@rename($tmpPng, $destPath)) {
  // fallback copiar
  if (!@copy($tmpPng, $destPath)) {
    @unlink($tmpPng); imagedestroy($work); imagedestroy($src);
    http_response_code(500); echo json_encode(["ok"=>false,"error"=>"No se pudo escribir el archivo en disco"]); exit;
  }
  @unlink($tmpPng);
}
@chmod($destPath, 0664);
imagedestroy($work); imagedestroy($src);

/* ===== (Opcional) Actualizar columna avatar_url =====
include realpath("/home/site/wwwroot/db/conn/conn_db.php");
$con = conectar(); if ($con) { $con->set_charset('utf8mb4');
  $url = $publicUrl; $stmt = $con->prepare("UPDATE usuario SET avatar_url=? WHERE id=?");
  if ($stmt) { $stmt->bind_param("si",$url,$uid); $stmt->execute(); $stmt->close(); }
}
*/

/* ===== Respuesta ===== */
http_response_code(200);
echo json_encode([
  "ok"   => true,
  "id"   => $uid,
  "url"  => $publicUrl,
  "size" => $size,
  "mime" => "image/png"
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

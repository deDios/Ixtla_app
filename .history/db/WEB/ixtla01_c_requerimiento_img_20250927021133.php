<?php
/*  ixtla01_c_requerimiento_media.php
    Lista evidencias (imágenes/archivos) por requerimiento/estatus.
    Entrada (POST JSON o querystring):
      { "folio": "REQ-0000000084", "status": 3, "page": 1, "per_page": 50 }
    Si no envías "status", lista 0..6.
*/

header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('America/Mexico_City');

/* ---------- CORS ---------- */
$allowlist = [
  'https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowlist, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
}
header('Access-Control-Allow-Methods: POST, OPTIONS, GET');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 600');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

/* ---------- Helpers ---------- */
function json_out($obj, $code = 200) {
  http_response_code($code);
  echo json_encode($obj, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}
function read_input() {
  // Permite POST JSON o params por querystring (GET de prueba)
  $in = [];
  if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    if ($raw) {
      $j = json_decode($raw, true);
      if (is_array($j)) $in = $j;
    }
    // fallback a multipart/x-www-form-urlencoded
    if (!$in && !empty($_POST)) $in = $_POST;
  } else {
    $in = $_GET;
  }
  return $in ?: [];
}
function is_intlike($v) { return is_numeric($v) && preg_match('/^-?\d+$/', (string)$v); }

/* ---------- Entrada ---------- */
$in = read_input();

$folio  = isset($in['folio'])  ? strtoupper(trim($in['folio'])) : null;
$status = array_key_exists('status',$in) && $in['status'] !== '' ? (int)$in['status'] : null;
$page   = isset($in['page'])     && is_intlike($in['page'])     ? max(1, (int)$in['page']) : 1;
$per    = isset($in['per_page']) && is_intlike($in['per_page']) ? max(1, min(200,(int)$in['per_page'])) : 100;

if (!$folio || !preg_match('/^REQ-\d{10}$/', $folio)) {
  json_out(["ok"=>false,"error"=>"Folio inválido. Formato esperado: REQ-0000000000"], 400);
}
if ($status !== null && ($status < 0 || $status > 6)) {
  json_out(["ok"=>false,"error"=>"Status inválido. Usa 0..6 o no envíes 'status' para todos."], 400);
}

/* ---------- Proyecto / Paths ---------- */
$webroot = realpath("/home/site/wwwroot");
if (!$webroot) json_out(["ok"=>false,"error"=>"No se pudo resolver webroot"], 500);

$baseAssets = $webroot . DIRECTORY_SEPARATOR . "ASSETS" . DIRECTORY_SEPARATOR . "requerimientos";
$reqDir     = $baseAssets . DIRECTORY_SEPARATOR . $folio;

$publicBase = 'https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net';
$baseUrl    = rtrim($publicBase, '/') . "/ASSETS/requerimientos/{$folio}/";

if (!is_dir($reqDir)) {
  // Si la carpeta no existe, no hay evidencias aún
  json_out(["ok"=>true,"folio"=>$folio,"status"=>$status,"count"=>0,"data"=>[]]);
}

/* ---------- Recolector ---------- */
$finfo = function_exists('finfo_open') ? new finfo(FILEINFO_MIME_TYPE) : null;
$rows  = [];

$steps = $status === null ? range(0,6) : [$status];

foreach ($steps as $st) {
  $dir = $reqDir . DIRECTORY_SEPARATOR . (string)$st;
  if (!is_dir($dir)) continue;

  $it = @scandir($dir);
  if ($it === false) continue;

  foreach ($it as $fn) {
    if ($fn === '.' || $fn === '..' || $fn === 'status.txt') continue;

    $path = $dir . DIRECTORY_SEPARATOR . $fn;
    if (!is_file($path)) continue;

    $url  = $baseUrl . $st . "/" . rawurlencode($fn);
    $size = @filesize($path) ?: 0;
    $mt   = @filemtime($path) ?: time();

    // Detecta mime
    $mime = 'application/octet-stream';
    if ($finfo) {
      $det = @finfo_file($finfo, $path);
      if ($det) $mime = $det;
    } else {
      // fallback por extensión
      $ext = strtolower(pathinfo($fn, PATHINFO_EXTENSION));
      $map = [
        'jpg'=>'image/jpeg','jpeg'=>'image/jpeg','png'=>'image/png','webp'=>'image/webp',
        'heic'=>'image/heic','heif'=>'image/heif','gif'=>'image/gif','pdf'=>'application/pdf'
      ];
      if (isset($map[$ext])) $mime = $map[$ext];
    }

    $rows[] = [
      "status"      => (int)$st,
      "name"        => $fn,
      "url"         => $url,
      "size"        => (int)$size,
      "mime"        => $mime,
      "modified_at" => date('Y-m-d H:i:s', $mt),
    ];
  }
}

/* ---------- Orden y paginación ---------- */
usort($rows, function($a,$b){
  // más recientes primero por modified_at, luego por name
  $d = strcmp($b['modified_at'], $a['modified_at']);
  if ($d !== 0) return $d;
  return strcmp($a['name'], $b['name']);
});

$total = count($rows);
if ($total === 0) {
  json_out(["ok"=>true,"folio"=>$folio,"status"=>$status,"count"=>0,"data"=>[],"page"=>$page,"per_page"=>$per]);
}

// Paginar si hace falta
$offset = ($page - 1) * $per;
$chunk  = array_slice($rows, $offset, $per);

/* ---------- Respuesta ---------- */
json_out([
  "ok"       => true,
  "folio"    => $folio,
  "status"   => $status,      
  "count"    => $total,
  "page"     => $page,
  "per_page" => $per,
  "data"     => $chunk
]);

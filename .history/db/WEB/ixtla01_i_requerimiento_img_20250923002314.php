<?php
header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('America/Mexico_City');

$allowlist = [
  'https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowlist, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 600');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$path = realpath("/home/site/wwwroot/db/conn/conexion.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); echo json_encode(["ok"=>false,"error"=>"No se encontró conexion.php"]); exit; }

/* ---------- Config ---------- */
$MAX_FILES   = 3;                           // max. archivos por request
$MAX_BYTES   = 30 * 1024 * 1024;            // 30 MB por archivo
$ALLOWED_MIME = ['image/jpeg','image/png']; // alineado a tu front (solo JPG/PNG)
$EXT_FOR_MIME = ['image/jpeg'=>'jpg','image/png'=>'png'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(["ok"=>false,"error"=>"Método no permitido"]); exit;
}

$folio     = isset($_POST['folio'])  ? strtoupper(trim($_POST['folio'])) : null;
$statusRaw = isset($_POST['status']) ? trim($_POST['status'])            : null;

if (!$folio || !preg_match('/^REQ-\d{10}$/', $folio)) {
  http_response_code(400);
  echo json_encode(["ok"=>false,"error"=>"Folio inválido. Formato esperado: REQ-0000000000"]); exit;
}

// ---- PATCH: Validar status 0..6 con cast a int (antes solo 0..4 con regex)
if ($statusRaw === null || !preg_match('/^-?\d+$/', $statusRaw)) {
  http_response_code(400);
  echo json_encode(["ok"=>false,"error"=>"Status inválido. Debe ser un número entre 0 y 6."]); exit;
}
$status = (int)$statusRaw;
if ($status < 0 || $status > 6) {
  http_response_code(400);
  echo json_encode(["ok"=>false,"error"=>"Status inválido. Usa 0,1,2,3,4,5,6"]); exit;
}

function normalize_files_array($filesInput) {
  $files = [];
  if (isset($filesInput['name']) && is_array($filesInput['name'])) {
    $count = count($filesInput['name']);
    for ($i=0; $i<$count; $i++) {
      $files[] = [
        'name'     => $filesInput['name'][$i] ?? '',
        'type'     => $filesInput['type'][$i] ?? '',
        'tmp_name' => $filesInput['tmp_name'][$i] ?? '',
        'error'    => $filesInput['error'][$i] ?? UPLOAD_ERR_NO_FILE,
        'size'     => $filesInput['size'][$i] ?? 0,
      ];
    }
  } elseif (isset($filesInput['name'])) {
    $files[] = $filesInput;
  }
  return $files;
}

$files = [];
if (isset($_FILES['files'])) $files = array_merge($files, normalize_files_array($_FILES['files']));
if (isset($_FILES['file']))  $files = array_merge($files, normalize_files_array($_FILES['file']));
if (empty($files)) {
  http_response_code(400);
  echo json_encode(["ok"=>false,"error"=>"No se recibieron archivos. Usa campo 'files' (multiparte)."]); exit;
}

if (count($files) > $MAX_FILES) {
  http_response_code(400);
  echo json_encode(["ok"=>false,"error"=>"Máximo {$MAX_FILES} archivos por solicitud."]); exit;
}

$webroot = realpath("/home/site/wwwroot");
if (!$webroot) { http_response_code(500); echo json_encode(["ok"=>false,"error"=>"No se pudo resolver webroot"]); exit; }

$baseAssets = $webroot . DIRECTORY_SEPARATOR . "ASSETS" . DIRECTORY_SEPARATOR . "requerimientos";
$reqDir     = $baseAssets . DIRECTORY_SEPARATOR . $folio;
$stepDir    = $reqDir . DIRECTORY_SEPARATOR . (string)$status;

function ensure_dir($path, $perm = 0775) {
  if (is_dir($path)) return ["created"=>false,"path"=>$path];
  $old = umask(0);
  $ok  = @mkdir($path, $perm, true);
  umask($old);
  if (!$ok && !is_dir($path)) throw new RuntimeException("No se pudo crear carpeta: $path");
  return ["created"=>true,"path"=>$path];
}
function sanitize_filename($name) {
  $n = preg_replace('/[^\w.\-]+/u', '_', $name);
  return trim($n, '._-') ?: 'file';
}

try {
  ensure_dir($baseAssets);
  ensure_dir($reqDir);
  ensure_dir($stepDir);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>$e->getMessage()]); exit;
}

$publicBase = 'https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net';
$baseUrl    = rtrim($publicBase, '/') . "/ASSETS/requerimientos/{$folio}/" . (string)$status . "/";

$finfo  = new finfo(FILEINFO_MIME_TYPE);
$saved  = [];
$failed = [];

foreach ($files as $idx => $f) {
  $name = $f['name'] ?? '';
  $size = $f['size'] ?? 0;
  $tmp  = $f['tmp_name'] ?? '';
  $err  = $f['error'] ?? UPLOAD_ERR_NO_FILE;

  if ($err !== UPLOAD_ERR_OK) {
    $failed[] = ["name"=>$name, "error"=>"Error de carga (code $err)"];
    continue;
  }

  if (!is_uploaded_file($tmp)) {
    $failed[] = ["name"=>$name, "error"=>"Archivo no válido (tmp)."];
    continue;
  }

  if ($size <= 0 || $size > $MAX_BYTES) {
    $failed[] = ["name"=>$name, "error"=>"Tamaño inválido (máx. ".($MAX_BYTES/1024/1024)." MB)."];
    continue;
  }

  $mime = $finfo->file($tmp) ?: ($f['type'] ?? '');
  if (!in_array($mime, $ALLOWED_MIME, true)) {
    $failed[] = ["name"=>$name, "error"=>"Tipo no permitido ($mime). Solo JPG/PNG."];
    continue;
  }

  $ext  = $EXT_FOR_MIME[$mime] ?? 'bin';
  $base = sanitize_filename(pathinfo($name, PATHINFO_FILENAME));
  $uniq = date('YmdHis')."_".bin2hex(random_bytes(4));
  $final = "{$base}_{$uniq}.{$ext}";

  $destPath = $stepDir . DIRECTORY_SEPARATOR . $final;
  $destUrl  = $baseUrl . rawurlencode($final);

  if (!@move_uploaded_file($tmp, $destPath)) {
    $failed[] = ["name"=>$name, "error"=>"No se pudo mover el archivo."];
    continue;
  }

  @chmod($destPath, 0664);

  $saved[] = [
    "name" => $final,
    "url"  => $destUrl,
    "path" => $destPath,
    "size" => $size,
    "mime" => $mime,
    "status_dir" => (string)$status
  ];
}

/* ---------- Respuesta ---------- */
$ok = count($saved) > 0;
$http = $ok ? 200 : 400;
http_response_code($http);

echo json_encode([
  "ok" => $ok,
  "folio" => $folio,
  "status" => (int)$status,
  "saved" => $saved,
  "failed" => $failed,
  "limits" => [
    "max_files" => $MAX_FILES,
    "max_mb" => $MAX_BYTES / 1024 / 1024,
    "allowed_mime" => $ALLOWED_MIME
  ]
]);

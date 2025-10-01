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
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 600');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }


/* ---------- Proyecto ---------- */
$path = realpath("/home/site/wwwroot/db/conn/conexion.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php"])); }

/* ---------- Entrada ---------- */
$inRaw = file_get_contents("php://input");
$in = json_decode($inRaw, true);
if (!is_array($in)) $in = [];

$folio = isset($in['folio']) ? strtoupper(trim($in['folio'])) : null;
if (!$folio || !preg_match('/^REQ-\d{10}$/', $folio)) {
  http_response_code(400);
  die(json_encode(["ok"=>false,"error"=>"Folio inválido. Formato esperado: REQ-0000000000"]));
}

/* Opcionales NUEVOS (no rompen compat): */
$createStatusTxt = array_key_exists('create_status_txt', $in) ? (bool)$in['create_status_txt'] : true;
$forceStatusTxt  = array_key_exists('force_status_txt',  $in) ? (bool)$in['force_status_txt']  : false;

/* ---------- Mapeo de estatus (NUEVO) ---------- */
$STATUS_LABELS = [
  0 => 'solicitud',
  1 => 'revision',
  2 => 'asignacion',
  3 => 'enProceso',
  4 => 'pausado',
  5 => 'cancelado',
  6 => 'finalizado',
];

/* ---------- Paths ---------- */
$webroot = realpath("/home/site/wwwroot");
if (!$webroot) { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se pudo resolver webroot"])); }

$baseAssets = $webroot . DIRECTORY_SEPARATOR . "ASSETS" . DIRECTORY_SEPARATOR . "requerimientos";
$reqDir     = $baseAssets . DIRECTORY_SEPARATOR . $folio;

/* ---------- Helpers ---------- */
function ensure_dir($path, $perm = 0775) {
  if (is_dir($path)) return ["path"=>$path, "created"=>false];
  $old = umask(0);
  $ok = @mkdir($path, $perm, true);
  umask($old);
  if (!$ok && !is_dir($path)) throw new RuntimeException("No se pudo crear carpeta: $path");
  return ["path"=>$path, "created"=>true];
}

/* ---------- Inventario previo ---------- */
$exists_before = [
  "assets_base" => is_dir($baseAssets),
  "req_dir"     => is_dir($reqDir),
  "step0"       => is_dir($reqDir . DIRECTORY_SEPARATOR . "0"),
  "step1"       => is_dir($reqDir . DIRECTORY_SEPARATOR . "1"),
  "step2"       => is_dir($reqDir . DIRECTORY_SEPARATOR . "2"),
  "step3"       => is_dir($reqDir . DIRECTORY_SEPARATOR . "3"),
  "step4"       => is_dir($reqDir . DIRECTORY_SEPARATOR . "4"),
  // NUEVOS pasos:
  "step5"       => is_dir($reqDir . DIRECTORY_SEPARATOR . "5"),
  "step6"       => is_dir($reqDir . DIRECTORY_SEPARATOR . "6"),
];

/* ---------- Creación ---------- */
try {
  $created = [];
  $created[] = ensure_dir($baseAssets);
  $created[] = ensure_dir($reqDir);

  // Ampliado a 0..6
  for ($i = 0; $i <= 6; $i++) {
    $stepDir = $reqDir . DIRECTORY_SEPARATOR . (string)$i;
    $created[] = ensure_dir($stepDir);

    // NUEVO: crear/actualizar status.txt si está habilitado
    if ($createStatusTxt) {
      $label = $STATUS_LABELS[$i] ?? ("step-".$i);
      $statusFile = $stepDir . DIRECTORY_SEPARATOR . 'status.txt';
      if (!file_exists($statusFile) || $forceStatusTxt) {
        $ok = @file_put_contents($statusFile, $label . PHP_EOL);
        if ($ok === false) {
          throw new RuntimeException("No se pudo escribir status.txt para el paso $i");
        }
        $created[] = ["path"=>$statusFile, "created"=>true, "label"=>$label];
      } else {
        $created[] = ["path"=>$statusFile, "created"=>false, "label"=>$label];
      }
    }
  }

  $publicBase = 'https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net';
  $baseUrl = rtrim($publicBase, '/') . "/ASSETS/requerimientos/{$folio}/";

  $exists_all =
    is_dir($baseAssets) &&
    is_dir($reqDir) &&
    is_dir($reqDir . DIRECTORY_SEPARATOR . "0") &&
    is_dir($reqDir . DIRECTORY_SEPARATOR . "1") &&
    is_dir($reqDir . DIRECTORY_SEPARATOR . "2") &&
    is_dir($reqDir . DIRECTORY_SEPARATOR . "3") &&
    is_dir($reqDir . DIRECTORY_SEPARATOR . "4") &&
    is_dir($reqDir . DIRECTORY_SEPARATOR . "5") &&
    is_dir($reqDir . DIRECTORY_SEPARATOR . "6");

  // Armado de paths/urls (incluye 0..6)
  $paths = ["root" => $reqDir];
  $urls  = ["root" => $baseUrl];
  for ($i = 0; $i <= 6; $i++) {
    $paths["step".$i] = $reqDir . DIRECTORY_SEPARATOR . (string)$i;
    $urls["step".$i]  = $baseUrl . $i . "/";
  }

  echo json_encode([
    "ok" => true,
    "folio" => $folio,
    "exists_before" => $exists_before,
    "exists_all" => $exists_all,
    "paths" => $paths,
    "urls"  => $urls,
    "status_labels" => $STATUS_LABELS, // expuesto por conveniencia
    "created" => $created
  ]);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>$e->getMessage()]);
}

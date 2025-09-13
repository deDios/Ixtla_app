<?php

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

$path = realpath("/home/site/wwwroot/db/conn/conexion.php");
if ($path && file_exists($path)) { include $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conexion.php"])); }

$in = json_decode(file_get_contents("php://input"), true) ?? [];
$folio = isset($in['folio']) ? strtoupper(trim($in['folio'])) : null;

if (!$folio || !preg_match('/^REQ-\d{10}$/', $folio)) {
  http_response_code(400);
  die(json_encode(["ok"=>false,"error"=>"Folio inválido. Formato esperado: REQ-0000000000"]));
}

$webroot = realpath("/home/site/wwwroot");
if (!$webroot) { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se pudo resolver webroot"])); }

$baseAssets = $webroot . DIRECTORY_SEPARATOR . "ASSETS" . DIRECTORY_SEPARATOR . "requerimientos";
$reqDir     = $baseAssets . DIRECTORY_SEPARATOR . $folio;
$reporteDir = $reqDir . DIRECTORY_SEPARATOR . "reporte";

function ensure_dir($path, $perm = 0775) {
  if (is_dir($path)) return ["path"=>$path, "created"=>false];
  $ok = @mkdir($path, $perm, true);
  if (!$ok && !is_dir($path)) throw new RuntimeException("No se pudo crear carpeta: $path");
  return ["path"=>$path, "created"=>true];
}

$exists_before = [
  "assets_base" => is_dir($baseAssets),
  "req_dir"     => is_dir($reqDir),
  "reporte_dir" => is_dir($reporteDir),
  "step0"       => is_dir($reporteDir . DIRECTORY_SEPARATOR . "0"),
  "step1"       => is_dir($reporteDir . DIRECTORY_SEPARATOR . "1"),
  "step2"       => is_dir($reporteDir . DIRECTORY_SEPARATOR . "2"),
  "step3"       => is_dir($reporteDir . DIRECTORY_SEPARATOR . "3"),
  "step4"       => is_dir($reporteDir . DIRECTORY_SEPARATOR . "4"),
];

try {
  $created = [];
  $created[] = ensure_dir($baseAssets);
  $created[] = ensure_dir($reqDir);
  $created[] = ensure_dir($reporteDir);
  for ($i = 0; $i <= 4; $i++) {
    $created[] = ensure_dir($reporteDir . DIRECTORY_SEPARATOR . (string)$i);
  }

  $publicBase = 'https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net';
  $baseUrl = rtrim($publicBase, '/') . "/ASSETS/requerimientos/{$folio}/reporte/";

  $exists_all =
    is_dir($baseAssets) &&
    is_dir($reqDir) &&
    is_dir($reporteDir) &&
    is_dir($reporteDir . DIRECTORY_SEPARATOR . "0") &&
    is_dir($reporteDir . DIRECTORY_SEPARATOR . "1") &&
    is_dir($reporteDir . DIRECTORY_SEPARATOR . "2") &&
    is_dir($reporteDir . DIRECTORY_SEPARATOR . "3") &&
    is_dir($reporteDir . DIRECTORY_SEPARATOR . "4");

  echo json_encode([
    "ok" => true,
    "folio" => $folio,
    "exists_before" => $exists_before,
    "exists_all" => $exists_all,
    "paths" => [
      "root"  => $reporteDir,
      "step0" => $reporteDir . DIRECTORY_SEPARATOR . "0",
      "step1" => $reporteDir . DIRECTORY_SEPARATOR . "1",
      "step2" => $reporteDir . DIRECTORY_SEPARATOR . "2",
      "step3" => $reporteDir . DIRECTORY_SEPARATOR . "3",
      "step4" => $reporteDir . DIRECTORY_SEPARATOR . "4",
    ],
    "urls" => [
      "root"  => $baseUrl,
      "step0" => $baseUrl . "0/",
      "step1" => $baseUrl . "1/",
      "step2" => $baseUrl . "2/",
      "step3" => $baseUrl . "3/",
      "step4" => $baseUrl . "4/",
    ],
    "created" => $created
  ]);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>$e->getMessage()]);
}

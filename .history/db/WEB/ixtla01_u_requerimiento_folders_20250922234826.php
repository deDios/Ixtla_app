<?php
// ... cabeceras, CORS y helpers idénticos a tu archivo actual ...

// --- Input ---
$in = read_json_body();
$folio = strtoupper(trim($in['folio'] ?? ''));

// NUEVO: pasos 0..6 por defecto
$steps = $in['steps'] ?? [0,1,2,3,4,5,6];

$createThumbs   = (bool)($in['create_thumbs'] ?? false);
$dryRun         = (bool)($in['dry_run'] ?? false);
$createIndex    = (bool)($in['create_index'] ?? true);
// NUEVO: activar status.txt por defecto
$createStatusTxt = (bool)($in['create_status_txt'] ?? true);

// Validaciones
if ($folio === '') jerr(400, 'Falta el "folio".');
if (!preg_match('/^REQ-\d{10}$/', $folio)) jerr(400, 'Formato inválido de folio. Esperado REQ-##########.');
if (!is_array($steps) || empty($steps)) jerr(400, 'El arreglo "steps" debe contener al menos un valor.');

$steps = array_values(array_unique(array_map('intval', $steps)));
foreach ($steps as $s) {
  if ($s < 0 || $s > 64) jerr(400, 'Valor de step fuera de rango razonable (0..64).');
}

// NUEVO: etiquetas por paso (usa exactamente tus strings)
$STATUS_LABELS = [
  0 => 'solicitud',
  1 => 'revision',
  2 => 'asignacion',
  3 => 'enProceso',
  4 => 'pausado',
  5 => 'cancelado',
  6 => 'finalizado',
];

// --- Paths ---
$wwwroot = realpath('/home/site/wwwroot');
if (!$wwwroot) jerr(500, 'No se pudo resolver webroot.');
$assetsBase = $wwwroot . '/ASSETS/requerimientos';
$reqDir     = $assetsBase . '/' . $folio;

$existsBefore = [
  'assets_base' => is_dir($assetsBase),
  'req_dir'     => is_dir($reqDir),
];
foreach ($steps as $s) {
  $existsBefore["step{$s}"] = is_dir($reqDir . '/' . $s);
}

// --- Dry run ---
if ($dryRun) {
  $baseUrl = get_base_url() . '/ASSETS/requerimientos/' . rawurlencode($folio) . '/';
  $urls = ['root' => $baseUrl];
  foreach ($steps as $s) {
    $urls["step{$s}"] = $baseUrl . $s . '/';
  }
  echo json_encode([
    'ok' => true,
    'folio' => $folio,
    'dry_run' => true,
    'paths' => ['assets_base' => $assetsBase, 'req_dir' => $reqDir],
    'exists_before' => $existsBefore,
    'urls' => $urls,
    'message' => 'Dry run: no se crearon carpetas.'
  ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}

// --- Creación ---
$created = [];
$anyCreated = false;

if (!safe_mkdir($assetsBase)) jerr(500, 'No se pudo crear ASSETS/requerimientos.');
$created[] = ['path' => $assetsBase, 'created' => !$existsBefore['assets_base']];
$anyCreated = $anyCreated || !$existsBefore['assets_base'];

if (!safe_mkdir($reqDir)) jerr(500, "No se pudo crear carpeta del folio: $folio.");
$created[] = ['path' => $reqDir, 'created' => !$existsBefore['req_dir']];
$anyCreated = $anyCreated || !$existsBefore['req_dir'];
if ($createIndex) put_index_html($reqDir);

foreach ($steps as $s) {
  $stepDir = $reqDir . '/' . $s;
  $existed = is_dir($stepDir);
  if (!safe_mkdir($stepDir)) jerr(500, "No se pudo crear carpeta del paso: $s.");
  $created[] = ['path' => $stepDir, 'created' => !$existed];
  $anyCreated = $anyCreated || !$existed;
  if ($createIndex) put_index_html($stepDir);

  // NUEVO: crear status.txt con la etiqueta
  if ($createStatusTxt) {
    $label = $STATUS_LABELS[$s] ?? ("step-".$s);
    $statusFile = $stepDir . '/status.txt';
    if (!file_exists($statusFile)) {
      @file_put_contents($statusFile, $label . PHP_EOL);
      $created[] = ['path' => $statusFile, 'created' => true, 'label' => $label];
    } else {
      // si ya existe, no lo reescribimos (idempotencia)
      $created[] = ['path' => $statusFile, 'created' => false, 'label' => $label];
    }
  }

  if ($createThumbs) {
    $thumbs = $stepDir . '/thumbs';
    $existedT = is_dir($thumbs);
    if (!safe_mkdir($thumbs)) jerr(500, "No se pudo crear carpeta thumbs del paso: $s.");
    $created[] = ['path' => $thumbs, 'created' => !$existedT];
    $anyCreated = $anyCreated || !$existedT;
    if ($createIndex) put_index_html($thumbs);
  }
}

// --- Resultado ---
$existsAfter = [
  'assets_base' => is_dir($assetsBase),
  'req_dir'     => is_dir($reqDir),
];
foreach ($steps as $s) {
  $existsAfter["step{$s}"] = is_dir($reqDir . '/' . $s);
}

$baseUrl = get_base_url() . '/ASSETS/requerimientos/' . rawurlencode($folio) . '/';
$urls = ['root' => $baseUrl];
foreach ($steps as $s) {
  $urls["step{$s}"] = $baseUrl . $s . '/';
}

http_response_code($anyCreated ? 201 : 200);
echo json_encode([
  'ok' => true,
  'folio' => $folio,
  'steps' => $steps,
  'paths' => ['assets_base' => $assetsBase, 'req_dir' => $reqDir],
  'exists_before' => $existsBefore,
  'exists_after'  => $existsAfter,
  'created'       => $created,
  'urls'          => $urls,
  'status_labels' => $STATUS_LABELS,
  'message' => $anyCreated ? 'Carpetas y status.txt creados/asegurados.' : 'Ya existía todo.'
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

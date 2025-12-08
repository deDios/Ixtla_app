<?php
// db/WEB/ixtla01_c_requerimiento_img.php
//
// Endpoint para listar evidencias de un requerimiento.
//
//   Soporta:
//   - Imagenes (files) guardadas en /ASSETS/requerimientos/<folio>/<status>/
//   - Enlaces (links) almacenados en links.json dentro de cada carpeta de status.
//
// - Entrada (POST JSON o querystring):
//   - folio  (string, obligatorio, formato REQ-0000000000)
//   - status (int, opcional, 0..6; si no se envía, recorre 0..6)
//   - page   (int, opcional, paginación, default 1)
//   - per_page (int, opcional, 1..200, default 100)
//
// - Salida (JSON):
//   {
//     "ok": true,
//     "folio": "REQ-0000000000",
//     "status": null | 0..6,
//     "count": <total>,
//     "page": 1,
//     "per_page": 100,
//     "data": [
//       {
//         "status": 2,
//         "name": "foto_202501010000_abc.png",
//         "url": "https://.../ASSETS/requerimientos/REQ.../2/foto_...png",
//         "size": 12345,
//         "mime": "image/png",
//         "modified_at": "2025-01-01 12:00:00",
//         "kind": "file",    // archivo físico
//         "estatus": 1       // siempre 1 para archivos (activos)
//       },
//       {
//         "status": 2,
//         "name": "Carpeta Drive",
//         "url": "https://drive.google.com/...",
//         "size": 0,
//         "mime": "text/x-url",
//         "modified_at": "2025-01-01 12:05:00",
//         "kind": "link",    // enlace (link) tomado de links.json
//         "link_id": 1,      // id interno del link en links.json
//         "estatus": 1       // 1 = activo, 0 = inactivo (los inactivos no se regresan)
//       }
//     ]
//   }

header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('America/Mexico_City');

/* ---------- CORS ---------- */
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = [
  'https://ixtla-app.com',
  'https://www.ixtla-app.com'
];

if (in_array($origin, $allowed, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Access-Control-Allow-Credentials: true");
  header("Vary: Origin");
}

header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
$reqHeaders = $_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'] ?? '';
if ($reqHeaders) {
  header("Access-Control-Allow-Headers: $reqHeaders");
} else {
  header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept");
}

header("Access-Control-Max-Age: 86400");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

/* ---------- Helpers básicos ---------- */
function json_out($obj, $code = 200)
{
    http_response_code($code);
    echo json_encode($obj, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Lee la entrada:
 * - Si es POST con JSON → intenta decodificarlo.
 * - Si no, usa $_POST.
 * - Para GET → usa $_GET (útil en pruebas manuales).
 */
function read_input()
{
    $in = [];
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        if ($raw) {
            $j = json_decode($raw, true);
            if (is_array($j)) {
                $in = $j;
            }
        }
        // fallback a form-data o x-www-form-urlencoded
        if (!$in && !empty($_POST)) {
            $in = $_POST;
        }
    } else {
        $in = $_GET;
    }
    return $in ?: [];
}

/** Valida valores "parecidos a entero" (ej. "3", "-1") */
function is_intlike($v)
{
    return is_numeric($v) && preg_match('/^-?\d+$/', (string)$v);
}

/* ---------- Entrada ---------- */
$in = read_input();

$folio  = isset($in['folio']) ? strtoupper(trim($in['folio'])) : null;
$status = array_key_exists('status', $in) && $in['status'] !== '' ? (int)$in['status'] : null;
$page   = isset($in['page']) && is_intlike($in['page']) ? max(1, (int)$in['page']) : 1;
$per    = isset($in['per_page']) && is_intlike($in['per_page']) ? max(1, min(200, (int)$in['per_page'])) : 100;

if (!$folio || !preg_match('/^REQ-\d{10}$/', $folio)) {
    json_out(["ok" => false, "error" => "Folio inválido. Formato esperado: REQ-0000000000"], 400);
}
if ($status !== null && ($status < 0 || $status > 6)) {
    json_out(["ok" => false, "error" => "Status inválido. Usa 0..6 o no envíes 'status' para todos."], 400);
}

/* ---------- Paths de proyecto ---------- */
$webroot = realpath("/home/site/wwwroot");
if (!$webroot) {
    json_out(["ok" => false, "error" => "No se pudo resolver webroot"], 500);
}

$baseAssets = $webroot . DIRECTORY_SEPARATOR . "ASSETS" . DIRECTORY_SEPARATOR . "requerimientos";
$reqDir     = $baseAssets . DIRECTORY_SEPARATOR . $folio;

$publicBase = 'https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net';
$baseUrl    = rtrim($publicBase, '/') . "/ASSETS/requerimientos/{$folio}/";

if (!is_dir($reqDir)) {
    // Si la carpeta no existe, no hay evidencias aún
    json_out([
        "ok"    => true,
        "folio" => $folio,
        "status"=> $status,
        "count" => 0,
        "data"  => [],
        "page"  => $page,
        "per_page" => $per,
    ]);
}

/* ---------- Recolector de evidencias ---------- */
/**
 * $rows contendrá tanto archivos físicos como links:
 *  - kind = "file" → archivo de imagen u otro tipo
 *  - kind = "link" → enlace tomado de links.json
 */
$finfo = function_exists('finfo_open') ? new finfo(FILEINFO_MIME_TYPE) : null;
$rows  = [];

// Si no se envía status, se recorren todas las carpetas 0..6
$steps = $status === null ? range(0, 6) : [$status];

foreach ($steps as $st) {
    $dir = $reqDir . DIRECTORY_SEPARATOR . (string)$st;
    if (!is_dir($dir)) {
        continue;
    }

    $it = @scandir($dir);
    if ($it === false) {
        continue;
    }

    /* ----- 1) Archivos físicos (imágenes, pdf, etc.) ----- */
    foreach ($it as $fn) {
        // Ignoramos carpetas especiales y archivos de control
        if ($fn === '.' || $fn === '..' || $fn === 'status.txt' || $fn === 'links.json') {
            continue;
        }

        $path = $dir . DIRECTORY_SEPARATOR . $fn;
        if (!is_file($path)) {
            continue;
        }

        $url  = $baseUrl . $st . "/" . rawurlencode($fn);
        $size = @filesize($path) ?: 0;
        $mt   = @filemtime($path) ?: time();

        // Detecta mime
        $mime = 'application/octet-stream';
        if ($finfo) {
            $det = @finfo_file($finfo, $path);
            if ($det) {
                $mime = $det;
            }
        } else {
            // Fallback por extensión
            $ext = strtolower(pathinfo($fn, PATHINFO_EXTENSION));
            $map = [
                'jpg'  => 'image/jpeg',
                'jpeg' => 'image/jpeg',
                'png'  => 'image/png',
                'webp' => 'image/webp',
                'heic' => 'image/heic',
                'heif' => 'image/heif',
                'gif'  => 'image/gif',
                'pdf'  => 'application/pdf',
            ];
            if (isset($map[$ext])) {
                $mime = $map[$ext];
            }
        }

        $rows[] = [
            "status"      => (int)$st,
            "name"        => $fn,
            "url"         => $url,
            "size"        => (int)$size,
            "mime"        => $mime,
            "modified_at" => date('Y-m-d H:i:s', $mt),
            "kind"        => "file",  // archivo físico
            "estatus"     => 1,       // archivos se consideran siempre activos
        ];
    }

    /* ----- 2) Links desde links.json (opcional) ----- */
    $linksPath = $dir . DIRECTORY_SEPARATOR . "links.json";
    if (is_file($linksPath)) {
        $rawLinks = @file_get_contents($linksPath);
        $j = $rawLinks ? @json_decode($rawLinks, true) : null;

        // Se espera estructura:
        // {
        //   "folio": "REQ-0000000000",
        //   "status": 2,
        //   "links": [
        //      {"id":1, "url":"...", "label":"...", "estatus":1, "created_at":"2025-01-01 12:00:00"},
        //      ...
        //   ]
        // }
        if (is_array($j) && isset($j['links']) && is_array($j['links'])) {
            foreach ($j['links'] as $link) {
                $estatus = isset($link['estatus']) ? (int)$link['estatus'] : 1;
                // Sólo regresamos links activos (estatus = 1)
                if ($estatus !== 1) {
                    continue;
                }

                $linkUrl   = isset($link['url'])   ? (string)$link['url']   : '';
                $linkLabel = isset($link['label']) ? (string)$link['label'] : $linkUrl;
                if (!$linkUrl) {
                    continue; // link mal formado, lo ignoramos
                }

                $createdAt = isset($link['created_at']) && $link['created_at']
                    ? (string)$link['created_at']
                    : date('Y-m-d H:i:s');

                $rows[] = [
                    "status"      => (int)$st,
                    "name"        => $linkLabel,              // nombre amigable para UI
                    "url"         => $linkUrl,                // URL real (Drive, Mega, etc.)
                    "size"        => 0,                       // sin tamaño local
                    "mime"        => "text/x-url",            // MIME distintivo para enlaces
                    "modified_at" => $createdAt,
                    "kind"        => "link",                  // marca este registro como LINK
                    "link_id"     => isset($link['id']) ? (int)$link['id'] : null,
                    "estatus"     => $estatus,                // 1 = activo
                ];
            }
        }
    }
}

/* ---------- Orden y paginación ---------- */
usort($rows, function ($a, $b) {
    // más recientes primero por modified_at, luego por name
    $d = strcmp($b['modified_at'], $a['modified_at']);
    if ($d !== 0) {
        return $d;
    }
    return strcmp($a['name'], $b['name']);
});

$total = count($rows);
if ($total === 0) {
    json_out([
        "ok"       => true,
        "folio"    => $folio,
        "status"   => $status,
        "count"    => 0,
        "data"     => [],
        "page"     => $page,
        "per_page" => $per,
    ]);
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
    "data"     => $chunk,
]);
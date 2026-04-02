<?php
/**
 * ixtla01_c_media.php
 *
 * Endpoint genérico para consultar media.
 *
 * Soporta:
 * - listar todos los archivos de una carpeta
 * - opcionalmente pedir una variante por nombre base:
 *   file_name = icon | card | banner | etc.
 *
 * Ejemplo:
 * {
 *   "bucket": "media",
 *   "target_dir": "tramites/15"
 * }
 *
 * o bien:
 * {
 *   "bucket": "media",
 *   "target_dir": "tramites/15",
 *   "file_name": "icon"
 * }
 */

declare(strict_types=1);

/* =========================================================
 * CONFIG
 * ========================================================= */

$BUCKETS = [
    'media'          => '/ASSETS/media/',
    'requerimientos' => '/ASSETS/requerimientos/',
];

$ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

$EXTENSION_TO_MIME = [
    'jpg'  => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png'  => 'image/png',
    'webp' => 'image/webp',
    'heic' => 'image/heic',
    'heif' => 'image/heif',
];

/* =========================================================
 * HELPERS
 * ========================================================= */

function jsonResponse(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function sanitizePathSegment(string $value): string
{
    $value = trim($value);
    $value = str_replace('\\', '/', $value);
    $value = preg_replace('#/+#', '/', $value);
    $value = trim($value, '/');

    if ($value === '' || $value === '.' || $value === '..' || str_contains($value, '../')) {
        return '';
    }

    $value = preg_replace('/[^a-zA-Z0-9_\-\/]/', '', $value);

    return trim((string)$value, '/');
}

function sanitizeFileBaseName(string $value): string
{
    $value = trim($value);
    $value = pathinfo($value, PATHINFO_FILENAME);
    $value = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $value);
    $value = preg_replace('/_+/', '_', $value);
    $value = trim((string)$value, '_-');

    return $value;
}

function normalizeRow(
    string $absolutePath,
    string $fileName,
    string $publicDir,
    array $extensionToMime
): array {
    $extension = strtolower((string)pathinfo($fileName, PATHINFO_EXTENSION));
    $baseName  = pathinfo($fileName, PATHINFO_FILENAME);

    return [
        'base_name'   => $baseName,
        'extension'   => $extension,
        'name'        => $fileName,
        'url'         => $publicDir . $fileName,
        'mime'        => $extensionToMime[$extension] ?? 'application/octet-stream',
        'size'        => filesize($absolutePath) ?: 0,
        'modified_at' => date('Y-m-d H:i:s', filemtime($absolutePath) ?: time()),
        'timestamp'   => filemtime($absolutePath) ?: 0,
    ];
}

/* =========================================================
 * MAIN
 * ========================================================= */

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        jsonResponse([
            'ok' => false,
            'error' => 'Método no permitido. Usa POST.',
        ], 405);
    }

    $raw = file_get_contents('php://input');
    $json = json_decode($raw ?: '', true);

    if (!is_array($json)) {
        jsonResponse([
            'ok' => false,
            'error' => 'Payload JSON inválido.',
        ], 400);
    }

    $bucket   = trim((string)($json['bucket'] ?? ''));
    $targetDir = sanitizePathSegment((string)($json['target_dir'] ?? ''));
    $fileName = sanitizeFileBaseName((string)($json['file_name'] ?? ''));

    if ($bucket === '' || !isset($BUCKETS[$bucket])) {
        jsonResponse([
            'ok' => false,
            'error' => 'Bucket no permitido.',
        ], 400);
    }

    if ($targetDir === '') {
        jsonResponse([
            'ok' => false,
            'error' => 'target_dir es obligatorio.',
        ], 400);
    }

    $publicBaseDir = rtrim($BUCKETS[$bucket], '/') . '/';
    $publicDir = $publicBaseDir . $targetDir . '/';

    $absoluteDir = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), DIRECTORY_SEPARATOR)
        . str_replace('/', DIRECTORY_SEPARATOR, $publicDir);

    if (!is_dir($absoluteDir)) {
        jsonResponse([
            'ok' => true,
            'data' => [],
            'current' => null,
            'meta' => [
                'bucket' => $bucket,
                'target_dir' => $targetDir,
                'file_name' => $fileName !== '' ? $fileName : null,
                'count' => 0,
            ],
        ]);
    }

    $rows = [];
    $files = scandir($absoluteDir) ?: [];

    foreach ($files as $file) {
        if ($file === '.' || $file === '..') {
            continue;
        }

        $absolutePath = $absoluteDir . DIRECTORY_SEPARATOR . $file;
        if (!is_file($absolutePath)) {
            continue;
        }

        $extension = strtolower((string)pathinfo($file, PATHINFO_EXTENSION));
        if (!in_array($extension, $ALLOWED_EXTENSIONS, true)) {
            continue;
        }

        $baseName = pathinfo($file, PATHINFO_FILENAME);
        if ($fileName !== '' && $baseName !== $fileName) {
            continue;
        }

        $rows[] = normalizeRow($absolutePath, $file, $publicDir, $EXTENSION_TO_MIME);
    }

    usort($rows, function (array $a, array $b): int {
        $t = ($b['timestamp'] ?? 0) <=> ($a['timestamp'] ?? 0);
        if ($t !== 0) {
            return $t;
        }
        return strcmp((string)$a['name'], (string)$b['name']);
    });

    $current = $rows[0] ?? null;

    $rows = array_map(function (array $row): array {
        unset($row['timestamp']);
        return $row;
    }, $rows);

    if (is_array($current)) {
        unset($current['timestamp']);
    }

    jsonResponse([
        'ok' => true,
        'data' => $rows,
        'current' => $current,
        'meta' => [
            'bucket' => $bucket,
            'target_dir' => $targetDir,
            'file_name' => $fileName !== '' ? $fileName : null,
            'count' => count($rows),
        ],
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'ok' => false,
        'error' => $e->getMessage(),
    ], 500);
}
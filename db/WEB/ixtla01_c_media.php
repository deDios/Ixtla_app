<?php
/**
 * ixtla01_c_media.php
 *
 * Endpoint genérico para consultar archivos dentro de una carpeta de media.
 *
 * OBJETIVO
 * --------
 * Permitir que frontend consulte qué archivos existen dentro de:
 *   - un bucket permitido
 *   - una carpeta relativa
 *
 * EJEMPLO DE REQUEST
 * ------------------
 * POST JSON
 * {
 *   "bucket": "media",
 *   "target_dir": "tramites/15"
 * }
 *
 * EJEMPLO DE RESPUESTA
 * --------------------
 * {
 *   "ok": true,
 *   "data": [
 *     {
 *       "name": "icon.png",
 *       "url": "/ASSETS/media/tramites/15/icon.png",
 *       "size": 12345,
 *       "modified_at": "2026-03-31 12:00:00"
 *     }
 *   ]
 * }
 */

declare(strict_types=1);

$BUCKETS = [
    'media'          => '/ASSETS/media/',
    'requerimientos' => '/ASSETS/requerimientos/',
];

function jsonResponse(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function sanitizePathSegment(string $value): string
{
    $value = trim($value);
    $value = str_replace('\\', '/', $value);
    $value = preg_replace('#/+#', '/', $value);
    $value = trim($value, '/');

    if ($value === '.' || $value === '..' || str_contains($value, '../')) {
        return '';
    }

    $value = preg_replace('/[^a-zA-Z0-9_\-\/]/', '', $value);

    return trim($value, '/');
}

try {
    $raw = file_get_contents('php://input');
    $json = json_decode($raw, true);

    if (!is_array($json)) {
        jsonResponse([
            'ok' => false,
            'error' => 'Payload JSON inválido.',
        ], 400);
    }

    $bucket = trim((string)($json['bucket'] ?? ''));
    $targetDir = sanitizePathSegment((string)($json['target_dir'] ?? ''));

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

    $absoluteDir = rtrim($_SERVER['DOCUMENT_ROOT'], DIRECTORY_SEPARATOR)
        . str_replace('/', DIRECTORY_SEPARATOR, $publicDir);

    if (!is_dir($absoluteDir)) {
        jsonResponse([
            'ok' => true,
            'data' => [],
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

        $rows[] = [
            'name' => $file,
            'url' => $publicDir . $file,
            'size' => filesize($absolutePath) ?: 0,
            'modified_at' => date('Y-m-d H:i:s', filemtime($absolutePath) ?: time()),
        ];
    }

    usort($rows, function ($a, $b) {
        return strcmp($b['modified_at'], $a['modified_at']);
    });

    jsonResponse([
        'ok' => true,
        'data' => $rows,
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'ok' => false,
        'error' => $e->getMessage(),
    ], 500);
}
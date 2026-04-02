<?php

/**
 * ixtla01_in_media.php
 *
 * Endpoint genérico para subir/reemplazar media.
 *
 * Flujo:
 * - recibe bucket, target_dir, file_name, replace y file
 * - detecta MIME real
 * - genera la extensión segura según MIME
 * - si replace=1, elimina cualquier archivo previo con el mismo nombre base
 *   sin importar la extensión (.jpg, .png, .webp, .heic, .heif, etc.)
 * - guarda el nuevo archivo y responde con metadata
 */

declare(strict_types=1);

/* =========================================================
 * CONFIG
 * ========================================================= */

$BUCKETS = [
    'media'                 => '/ASSETS/media/',
    'requerimientos'        => '/ASSETS/requerimientos/',
    'departamentos_modulos' => '/ASSETS/departamentos/modulosAssets/',
];

$ALLOWED_MIME = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
    'image/heic' => 'heic',
    'image/heif' => 'heif',
];

$MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

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

function badRequest(string $message, array $extra = []): void
{
    jsonResponse([
        'ok' => false,
        'error' => $message,
        'meta' => $extra,
    ], 400);
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

function boolFromMixed(mixed $value): bool
{
    $normalized = strtolower(trim((string)$value));
    return in_array($normalized, ['1', 'true', 'yes', 'si'], true);
}

function ensureDirectory(string $dir): void
{
    if (is_dir($dir)) {
        return;
    }

    if (!mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('No se pudo crear el directorio destino.');
    }
}

function guessMimeAndExtension(string $tmpPath, array $allowedMime): array
{
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = $finfo ? (finfo_file($finfo, $tmpPath) ?: '') : '';
    if ($finfo) {
        finfo_close($finfo);
    }

    if (!isset($allowedMime[$mime])) {
        throw new RuntimeException("Tipo de archivo no permitido: {$mime}");
    }

    return [$mime, $allowedMime[$mime]];
}

function removeFilesWithSameBaseName(string $dir, string $baseName): array
{
    $deleted = [];
    $pattern = rtrim($dir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $baseName . '.*';

    foreach (glob($pattern) ?: [] as $existingFile) {
        if (!is_file($existingFile)) {
            continue;
        }

        if (@unlink($existingFile)) {
            $deleted[] = basename($existingFile);
        }
    }

    return $deleted;
}

function fileExistsWithSameBaseName(string $dir, string $baseName): bool
{
    $pattern = rtrim($dir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $baseName . '.*';
    foreach (glob($pattern) ?: [] as $existingFile) {
        if (is_file($existingFile)) {
            return true;
        }
    }
    return false;
}

function buildUniqueFileNameByBaseName(string $dir, string $baseName, string $extension): array
{
    $i = 0;

    do {
        $candidateBase = $i === 0 ? $baseName : "{$baseName}_{$i}";
        $candidateName = $candidateBase . '.' . $extension;
        $absolutePath = rtrim($dir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $candidateName;
        $hasSameBase = fileExistsWithSameBaseName($dir, $candidateBase);

        if (!$hasSameBase && !is_file($absolutePath)) {
            return [$candidateBase, $candidateName, $absolutePath];
        }

        $i++;
    } while ($i < 10000);

    throw new RuntimeException('No se pudo generar un nombre único para el archivo.');
}

/* =========================================================
 * MAIN
 * ========================================================= */

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        badRequest('Método no permitido. Usa POST.');
    }

    if (!isset($_FILES['file'])) {
        badRequest('No se recibió el archivo en el campo `file`.');
    }

    $bucket    = trim((string)($_POST['bucket'] ?? ''));
    $targetDir = sanitizePathSegment((string)($_POST['target_dir'] ?? ''));
    $fileName  = sanitizeFileBaseName((string)($_POST['file_name'] ?? ''));
    $replace   = boolFromMixed($_POST['replace'] ?? '0');

    if ($bucket === '') {
        badRequest('El campo `bucket` es obligatorio.');
    }

    if (!isset($BUCKETS[$bucket])) {
        badRequest('Bucket no permitido.', ['bucket' => $bucket]);
    }

    if ($targetDir === '') {
        badRequest('El campo `target_dir` es obligatorio y debe ser una ruta relativa válida.');
    }

    if ($fileName === '') {
        badRequest('El campo `file_name` es obligatorio.');
    }

    $file = $_FILES['file'];

    if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
        badRequest('El archivo recibido no es válido.');
    }

    if ((int)($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        badRequest('Error al subir el archivo.', [
            'upload_error' => (int)($file['error'] ?? UPLOAD_ERR_NO_FILE),
        ]);
    }

    if ((int)($file['size'] ?? 0) <= 0) {
        badRequest('El archivo está vacío.');
    }

    if ((int)$file['size'] > $MAX_FILE_SIZE) {
        badRequest('El archivo excede el tamaño máximo permitido.', [
            'max_bytes' => $MAX_FILE_SIZE,
            'received_bytes' => (int)$file['size'],
        ]);
    }

    [$mime, $extension] = guessMimeAndExtension($file['tmp_name'], $ALLOWED_MIME);

    $publicBaseDir = rtrim($BUCKETS[$bucket], '/') . '/';
    $publicDir = $publicBaseDir . $targetDir . '/';

    $absoluteDir = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), DIRECTORY_SEPARATOR)
        . str_replace('/', DIRECTORY_SEPARATOR, $publicDir);

    if ($absoluteDir === '' || $absoluteDir === DIRECTORY_SEPARATOR) {
        throw new RuntimeException('No se pudo resolver el directorio destino.');
    }

    ensureDirectory($absoluteDir);

    $deleted = [];
    if ($replace) {
        $deleted = removeFilesWithSameBaseName($absoluteDir, $fileName);
        $finalBaseName = $fileName;
        $finalName = $finalBaseName . '.' . $extension;
        $absolutePath = $absoluteDir . DIRECTORY_SEPARATOR . $finalName;
    } else {
        [$finalBaseName, $finalName, $absolutePath] = buildUniqueFileNameByBaseName(
            $absoluteDir,
            $fileName,
            $extension
        );
    }

    $publicUrl = $publicDir . $finalName;

    if (!move_uploaded_file($file['tmp_name'], $absolutePath)) {
        throw new RuntimeException('No se pudo mover el archivo al destino final.');
    }

    clearstatcache(true, $absolutePath);

    jsonResponse([
        'ok' => true,
        'data' => [
            'bucket'      => $bucket,
            'target_dir'  => $targetDir,
            'base_name'   => $finalBaseName,
            'extension'   => $extension,
            'name'        => $finalName,
            'url'         => $publicUrl,
            'mime'        => $mime,
            'size'        => filesize($absolutePath) ?: (int)$file['size'],
            'replace'     => $replace,
            'deleted'     => $deleted,
            'modified_at' => date('Y-m-d H:i:s', filemtime($absolutePath) ?: time()),
        ],
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'ok' => false,
        'error' => $e->getMessage(),
    ], 500);
}

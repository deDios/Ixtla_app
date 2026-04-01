<?php
/**
 * ixtla01_in_media.php
 *
 * Endpoint genérico para subir archivos de media al sistema.
 *
 * OBJETIVO
 * --------
 * Permitir que distintos módulos (trámites, requerimientos, carrusel, etc.)
 * suban archivos indicando:
 *   - bucket: raíz lógica permitida
 *   - target_dir: carpeta relativa donde guardar
 *   - file_name: nombre base del archivo
 *   - replace: si debe reemplazar archivos previos con el mismo nombre base
 *
 * IMPORTANTE
 * ----------
 * 1) NO se aceptan rutas absolutas arbitrarias.
 * 2) El cliente solo manda una ruta RELATIVA.
 * 3) El backend resuelve esa ruta contra buckets permitidos.
 * 4) Si replace=1, se eliminan archivos previos con el mismo nombre base
 *    sin importar la extensión.
 *
 * EJEMPLO DE REQUEST
 * ------------------
 * multipart/form-data
 *
 * bucket=media
 * target_dir=tramites/15 (el "15" es el ID del trámite, por ejemplo)
 * file_name=icon         (ya sea icon o card sera para las tarjetas en las 
 *                        listas de tramites.)
 * replace=1
 * file=[archivo]
 *
 * EJEMPLO DE RESPUESTA
 * --------------------
 * {
 *   "ok": true,
 *   "data": {
 *     "bucket": "media",
 *     "target_dir": "tramites/15",
 *     "name": "icon.png",
 *     "url": "/ASSETS/media/tramites/15/icon.png",
 *     "mime": "image/png",
 *     "size": 123456,
 *     "replace": true
 *   }
 * }
 */

declare(strict_types=1);

/* =========================================================
 * CONFIG
 * ========================================================= */

/**
 * Buckets permitidos.
 *
 * La clave es lo que manda frontend en `bucket`.
 * El valor es la ruta pública base.
 *
 * Puedes agregar más buckets después:
 * - carrusel
 * - banners
 * - departamentos
 * - etc.
 */
$BUCKETS = [
    'media'           => '/ASSETS/media/',
    'requerimientos'  => '/ASSETS/requerimientos/',
];

/**
 * Tipos MIME permitidos.
 * Aquí puedes ampliar si luego aceptan video o PDF.
 */
$ALLOWED_MIME = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
    'image/heic' => 'heic',
    'image/heif' => 'heif',
];

/**
 * Límite máximo por archivo.
 * Por ahora 10 MB para pruebas.
 * Luego lo ajustan según el tipo de media.
 */
$MAX_FILE_SIZE = 10 * 1024 * 1024;

/* =========================================================
 * HELPERS
 * ========================================================= */

function jsonResponse(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
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

    // Bloquea traversal
    if ($value === '.' || $value === '..' || str_contains($value, '../')) {
        return '';
    }

    // Solo permite letras, números, guion, guion bajo y slash
    $value = preg_replace('/[^a-zA-Z0-9_\-\/]/', '', $value);

    return trim($value, '/');
}

function sanitizeFileBaseName(string $value): string
{
    $value = trim($value);

    // Quita extensión si la mandaron por error
    $value = pathinfo($value, PATHINFO_FILENAME);

    // Solo caracteres seguros
    $value = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $value);
    $value = preg_replace('/_+/', '_', $value);
    $value = trim($value, '_-');

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
        throw new RuntimeException("No se pudo crear el directorio destino.");
    }
}

function guessMimeAndExtension(string $tmpPath, array $allowedMime): array
{
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $tmpPath) ?: '';
    finfo_close($finfo);

    if (!isset($allowedMime[$mime])) {
        throw new RuntimeException("Tipo de archivo no permitido: {$mime}");
    }

    return [$mime, $allowedMime[$mime]];
}

function removeFilesWithSameBaseName(string $dir, string $baseName): void
{
    $pattern = rtrim($dir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $baseName . '.*';
    foreach (glob($pattern) ?: [] as $existingFile) {
        if (is_file($existingFile)) {
            @unlink($existingFile);
        }
    }
}

/* =========================================================
 * MAIN
 * ========================================================= */

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
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

    if ((int)$file['error'] !== UPLOAD_ERR_OK) {
        badRequest('Error al subir el archivo.', ['upload_error' => $file['error']]);
    }

    if ((int)$file['size'] <= 0) {
        badRequest('El archivo está vacío.');
    }

    if ((int)$file['size'] > $MAX_FILE_SIZE) {
        badRequest('El archivo excede el tamaño máximo permitido.', [
            'max_bytes' => $MAX_FILE_SIZE,
            'received_bytes' => (int)$file['size'],
        ]);
    }

    [$mime, $extension] = guessMimeAndExtension($file['tmp_name'], $ALLOWED_MIME);

    /**
     * Construcción segura del destino final.
     *
     * Ejemplo:
     * bucket=media
     * target_dir=tramites/15
     *
     * Resultado público:
     * /ASSETS/media/tramites/15/
     */
    $publicBaseDir = rtrim($BUCKETS[$bucket], '/') . '/';
    $publicDir = $publicBaseDir . $targetDir . '/';

    /**
     * DOCUMENT_ROOT + ruta pública
     * Esto asume que /ASSETS cuelga del document root del proyecto.
     */
    $absoluteDir = rtrim($_SERVER['DOCUMENT_ROOT'], DIRECTORY_SEPARATOR)
        . str_replace('/', DIRECTORY_SEPARATOR, $publicDir);

    ensureDirectory($absoluteDir);

    /**
     * Si replace=1:
     * elimina cualquier archivo previo con el mismo nombre base,
     * aunque tenga otra extensión.
     *
     * Ejemplo:
     * icon.png
     * icon.jpg
     * icon.webp
     */
    if ($replace) {
        removeFilesWithSameBaseName($absoluteDir, $fileName);
    }

    /**
     * Nombre final:
     * file_name + extensión detectada por MIME real.
     *
     * Esto evita confiar ciegamente en la extensión original del usuario.
     */
    $finalName = $fileName . '.' . $extension;
    $absolutePath = $absoluteDir . DIRECTORY_SEPARATOR . $finalName;
    $publicUrl = $publicDir . $finalName;

    /**
     * Si replace=0 y ya existe un archivo con ese mismo nombre,
     * generamos un sufijo incremental.
     */
    if (!$replace && is_file($absolutePath)) {
        $i = 1;
        do {
            $candidate = $fileName . '_' . $i . '.' . $extension;
            $absolutePath = $absoluteDir . DIRECTORY_SEPARATOR . $candidate;
            $publicUrl = $publicDir . $candidate;
            $finalName = $candidate;
            $i++;
        } while (is_file($absolutePath));
    }

    if (!move_uploaded_file($file['tmp_name'], $absolutePath)) {
        throw new RuntimeException('No se pudo mover el archivo al destino final.');
    }

    jsonResponse([
        'ok' => true,
        'data' => [
            'bucket'     => $bucket,
            'target_dir' => $targetDir,
            'name'       => $finalName,
            'url'        => $publicUrl,
            'mime'       => $mime,
            'size'       => filesize($absolutePath) ?: (int)$file['size'],
            'replace'    => $replace,
        ],
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'ok' => false,
        'error' => $e->getMessage(),
    ], 500);
}
<?php
// PRI\DB\WEB\validar_ine_ocr.php

declare(strict_types=1);

ini_set("display_errors", "0");
ini_set("log_errors", "1");
error_reporting(E_ALL);

ob_start();

function jsonResponse(array $data, int $statusCode = 200): void
{
    while (ob_get_level() > 0) {
        ob_end_clean();
    }

    http_response_code($statusCode);
    header("Content-Type: application/json; charset=utf-8");

    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    jsonResponse([
        "ok" => false,
        "error" => "Método no permitido. Usa POST."
    ], 405);
}

$raw = file_get_contents("php://input");

if ($raw === false || trim($raw) === "") {
    jsonResponse([
        "ok" => false,
        "error" => "Body vacío."
    ], 400);
}

/*
 * Límite de JSON completo.
 * Si desde JS comprimimos a ~900KB, base64 crecerá aprox 33%.
 * 2.5MB da margen sin aceptar payloads enormes.
 */
if (strlen($raw) > 2.5 * 1024 * 1024) {
    jsonResponse([
        "ok" => false,
        "error" => "La petición es demasiado grande. Reduce la imagen antes de enviarla.",
        "meta" => [
            "raw_size_kb" => round(strlen($raw) / 1024, 2),
            "max_size_kb" => 2560
        ]
    ], 413);
}

$payload = json_decode($raw, true);

if (!is_array($payload)) {
    jsonResponse([
        "ok" => false,
        "error" => "JSON inválido.",
        "json_error" => json_last_error_msg()
    ], 400);
}

$side = strtolower(trim((string)($payload["side"] ?? "")));
$imageDataUrl = (string)($payload["image"] ?? "");

if (!in_array($side, ["front", "back"], true)) {
    jsonResponse([
        "ok" => false,
        "error" => "El campo side debe ser front o back."
    ], 400);
}

if ($imageDataUrl === "") {
    jsonResponse([
        "ok" => false,
        "error" => "El campo image es obligatorio."
    ], 400);
}

$matches = [];

if (!preg_match('/^data:image\/(jpeg|jpg|png|webp);base64,/i', $imageDataUrl, $matches)) {
    jsonResponse([
        "ok" => false,
        "error" => "La imagen debe venir como Data URL base64 válido: jpeg, jpg, png o webp."
    ], 400);
}

$mimeExt = strtolower($matches[1]);

$extension = match ($mimeExt) {
    "jpeg", "jpg" => "jpg",
    "png" => "png",
    "webp" => "webp",
    default => "jpg"
};

$imageBase64 = preg_replace('/^data:image\/(jpeg|jpg|png|webp);base64,/i', '', $imageDataUrl);

if (!is_string($imageBase64) || $imageBase64 === "") {
    jsonResponse([
        "ok" => false,
        "error" => "No se pudo extraer el base64 de la imagen."
    ], 400);
}

$imageBinary = base64_decode($imageBase64, true);

if ($imageBinary === false) {
    jsonResponse([
        "ok" => false,
        "error" => "La imagen no contiene base64 válido."
    ], 400);
}

$imageSizeBytes = strlen($imageBinary);

/*
 * Límite real de archivo.
 * Si PRIMedia comprime a 900KB, debería pasar sin problema.
 */
if ($imageSizeBytes > 1.5 * 1024 * 1024) {
    jsonResponse([
        "ok" => false,
        "error" => "La imagen procesada sigue siendo demasiado grande.",
        "meta" => [
            "image_size_kb" => round($imageSizeBytes / 1024, 2),
            "max_size_kb" => 1536
        ]
    ], 413);
}

$tempDir = __DIR__ . "/../../tmp/validacion_ine";

if (!is_dir($tempDir)) {
    if (!mkdir($tempDir, 0775, true) && !is_dir($tempDir)) {
        jsonResponse([
            "ok" => false,
            "error" => "No se pudo crear la carpeta temporal."
        ], 500);
    }
}

$fileName = "ine_validacion_" .
    $side . "_" .
    date("Ymd_His") . "_" .
    bin2hex(random_bytes(4)) .
    "." . $extension;

$imagePath = $tempDir . "/" . $fileName;

if (file_put_contents($imagePath, $imageBinary) === false) {
    jsonResponse([
        "ok" => false,
        "error" => "No se pudo guardar la imagen temporal."
    ], 500);
}

/*
 * Script Python de validación visual.
 * Ajusta el nombre si tu script tiene otro path.
 */
$pythonScript = __DIR__ . "/../../PY/validar_foto_ine.py";

/*
 * En algunos servidores puede ser:
 * python
 * python3
 * py
 * /home/site/wwwroot/venv/bin/python
 */
$pythonBin = "python3";

if (!file_exists($pythonScript)) {
    @unlink($imagePath);

    jsonResponse([
        "ok" => false,
        "error" => "No existe el script Python de validación.",
        "meta" => [
            "python_script" => $pythonScript
        ]
    ], 500);
}

$cmd = escapeshellcmd($pythonBin) . " " .
    escapeshellarg($pythonScript) . " " .
    escapeshellarg($imagePath) . " " .
    escapeshellarg($side);

$descriptors = [
    0 => ["pipe", "r"],
    1 => ["pipe", "w"],
    2 => ["pipe", "w"],
];

$process = proc_open($cmd, $descriptors, $pipes);

if (!is_resource($process)) {
    @unlink($imagePath);

    jsonResponse([
        "ok" => false,
        "error" => "No se pudo ejecutar el proceso de validación."
    ], 500);
}

fclose($pipes[0]);

$output = stream_get_contents($pipes[1]);
$errorOutput = stream_get_contents($pipes[2]);

fclose($pipes[1]);
fclose($pipes[2]);

$statusCode = proc_close($process);

@unlink($imagePath);

if ($statusCode !== 0) {
    jsonResponse([
        "ok" => false,
        "error" => "Falló la validación visual.",
        "detail" => trim((string)$errorOutput),
        "raw" => trim((string)$output),
        "meta" => [
            "code" => $statusCode,
            "side" => $side,
            "image_size_kb" => round($imageSizeBytes / 1024, 2),
            "extension" => $extension
        ]
    ], 500);
}

$result = json_decode((string)$output, true);

if (!is_array($result)) {
    jsonResponse([
        "ok" => false,
        "error" => "Python no respondió JSON válido.",
        "raw" => trim((string)$output),
        "stderr" => trim((string)$errorOutput)
    ], 500);
}

jsonResponse([
    "ok" => true,
    "data" => $result,
    "meta" => [
        "side" => $side,
        "extension" => $extension,
        "image_size_kb" => round($imageSizeBytes / 1024, 2)
    ]
]);

<?php
// PRI\db\WEB\validar_ine_ocr.php
declare(strict_types=1);

ini_set("display_errors", "0");
ini_set("log_errors", "1");
error_reporting(E_ALL);

function jsonResponse(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    jsonResponse([
        "ok" => false,
        "error" => "Método no permitido"
    ], 405);
}

$raw = file_get_contents("php://input");
$payload = json_decode($raw, true);

if (!is_array($payload)) {
    jsonResponse([
        "ok" => false,
        "error" => "JSON inválido"
    ], 400);
}

$side = strtolower(trim((string)($payload["side"] ?? "")));
$imageDataUrl = (string)($payload["image"] ?? "");

if (!in_array($side, ["front", "back"], true)) {
    jsonResponse([
        "ok" => false,
        "error" => "El campo side debe ser front o back"
    ], 400);
}

if (!preg_match('/^data:image\/(jpeg|jpg|png|webp);base64,/i', $imageDataUrl)) {
    jsonResponse([
        "ok" => false,
        "error" => "La imagen debe venir como Data URL base64 válido."
    ], 400);
}

if (strlen($imageDataUrl) > 12 * 1024 * 1024) {
    jsonResponse([
        "ok" => false,
        "error" => "La imagen es demasiado grande."
    ], 400);
}

$imageBase64 = preg_replace('/^data:image\/(jpeg|jpg|png|webp);base64,/i', '', $imageDataUrl);
$imageBinary = base64_decode($imageBase64, true);

if ($imageBinary === false) {
    jsonResponse([
        "ok" => false,
        "error" => "Base64 inválido"
    ], 400);
}

$tempDir = __DIR__ . "/../../tmp/validacion_ine";

if (!is_dir($tempDir)) {
    mkdir($tempDir, 0775, true);
}

$fileName = "ine_validacion_" . $side . "_" . date("Ymd_His") . "_" . bin2hex(random_bytes(4)) . ".jpg";
$imagePath = $tempDir . "/" . $fileName;

if (file_put_contents($imagePath, $imageBinary) === false) {
    jsonResponse([
        "ok" => false,
        "error" => "No se pudo guardar la imagen temporal"
    ], 500);
}

$pythonScript = __DIR__ . "/../../PY/validar_foto_ine.py";
$pythonBin = "python3";

if (!file_exists($pythonScript)) {
    @unlink($imagePath);

    jsonResponse([
        "ok" => false,
        "error" => "No existe el script Python de validación",
        "path" => $pythonScript
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
        "error" => "No se pudo ejecutar la validación"
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
        "error" => "Falló la validación visual",
        "detail" => trim($errorOutput),
        "raw" => $output
    ], 500);
}

$result = json_decode($output, true);

if (!is_array($result)) {
    jsonResponse([
        "ok" => false,
        "error" => "Python no respondió JSON válido",
        "raw" => $output
    ], 500);
}

jsonResponse([
    "ok" => true,
    "data" => $result
]);
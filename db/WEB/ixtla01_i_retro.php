<?php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = ['https://ixtla-app.com', 'https://www.ixtla-app.com'];

if (in_array($origin, $allowed, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Access-Control-Allow-Credentials: true");
  header("Vary: Origin");
}
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }

$in = json_decode(file_get_contents("php://input"), true) ?? [];

$parseIntField = static function (array $payload, string $key, ?int $default = null): ?int {
    if (!array_key_exists($key, $payload) || $payload[$key] === null || $payload[$key] === '') return $default;
    $value = $payload[$key];
    if (is_int($value)) return $value;
    if (is_string($value) && preg_match('/^-?\d+$/', trim($value)) === 1) return (int) trim($value);
    throw new InvalidArgumentException("$key debe ser un entero");
};
$requerimiento_id = null;
$status           = 1;
$comentario       = isset($in['comentario']) ? trim($in['comentario']) : null;
$calificacion     = null;
$link             = isset($in['link']) ? trim($in['link']) : null;
try {
    $requerimiento_id = $parseIntField($in, 'requerimiento_id');
    $status = $parseIntField($in, 'status', 1) ?? 1;
    $calificacion = $parseIntField($in, 'calificacion');
} catch (InvalidArgumentException $e) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => $e->getMessage()]);
    exit;
}

// La vista crea la invitacion inicial con 0 para indicar que aun no hay calificacion.
if ($calificacion === 0) {
    $calificacion = null;
}

if (!$requerimiento_id) {
    echo json_encode(["ok" => false, "error" => "requerimiento_id es requerido"]);
    exit;
}
if (!in_array($status, [0, 1, 2, 3], true)) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "status de retroalimentacion no valido"]);
    exit;
}
if ($calificacion !== null && !in_array($calificacion, [1, 2, 3, 4], true)) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "calificacion debe estar entre 1 y 4"]);
    exit;
}

$con = conectar();
$sql = "INSERT INTO retro_ciudadana (requerimiento_id, status, comentario, calificacion, link) VALUES (?, ?, ?, ?, ?)";
$stmt = $con->prepare($sql);
$stmt->bind_param("iisis", $requerimiento_id, $status, $comentario, $calificacion, $link);

if ($stmt->execute()) {
    echo json_encode(["ok" => true, "id" => $con->insert_id]);
} else {
    echo json_encode(["ok" => false, "error" => $con->error]);
}
$stmt->close();
$con->close();

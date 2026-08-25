<?php

function geo_json(int $status, array $payload): void {
  http_response_code($status);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function geo_bootstrap(array $methods): array {
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  $allowed = [
    'https://ixtla-app.com',
    'https://www.ixtla-app.com',
    'https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net',
  ];
  if (in_array($origin, $allowed, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
  }
  header('Content-Type: application/json; charset=utf-8');
  header('Access-Control-Allow-Methods: '.implode(', ', array_merge($methods, ['OPTIONS'])));
  header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept');
  header('Access-Control-Max-Age: 86400');
  header('Cache-Control: no-store');

  $method = $_SERVER['REQUEST_METHOD'] ?? '';
  if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
  }
  if (!in_array($method, $methods, true)) {
    header('Allow: '.implode(', ', $methods));
    geo_json(405, ['ok' => false, 'error' => 'Método no permitido']);
  }

  $input = [];
  if ($method === 'GET') {
    $input = $_GET;
  } else {
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'application/json') === false) {
      geo_json(415, ['ok' => false, 'error' => 'Content-Type debe ser application/json']);
    }
    $raw = file_get_contents('php://input', false, null, 0, 32769);
    if ($raw === false || $raw === '') geo_json(400, ['ok' => false, 'error' => 'Body JSON vacío']);
    if (strlen($raw) > 32768) geo_json(413, ['ok' => false, 'error' => 'Payload demasiado grande']);
    $input = json_decode($raw, true);
    if (!is_array($input) || json_last_error() !== JSON_ERROR_NONE) {
      geo_json(400, ['ok' => false, 'error' => 'JSON inválido']);
    }
  }

  $connectionPath = realpath('/home/site/wwwroot/db/conn/conn_db.php');
  if (!$connectionPath) $connectionPath = realpath(__DIR__.'/../conn/conn_db.php');
  if (!$connectionPath) geo_json(500, ['ok' => false, 'error' => 'No se encontró la configuración de base de datos']);
  require_once $connectionPath;
  $con = conectar();
  if (!$con) geo_json(500, ['ok' => false, 'error' => 'No se pudo conectar a la base de datos']);
  $con->set_charset('utf8mb4');
  return [$con, $input];
}

function geo_nullable_string(array $in, string $key, int $maxLength): ?string {
  if (!array_key_exists($key, $in) || $in[$key] === null) return null;
  $value = trim((string)$in[$key]);
  if ($value === '') return null;
  if (mb_strlen($value, 'UTF-8') > $maxLength) {
    geo_json(422, ['ok' => false, 'error' => "$key excede $maxLength caracteres"]);
  }
  return $value;
}

function geo_cast_row(array $row): array {
  foreach (['id', 'requerimiento_id', 'validada', 'status', 'updated_by'] as $key) {
    if (array_key_exists($key, $row)) $row[$key] = $row[$key] === null ? null : (int)$row[$key];
  }
  foreach (['latitud', 'longitud', 'precision_metros'] as $key) {
    if (array_key_exists($key, $row)) $row[$key] = $row[$key] === null ? null : (float)$row[$key];
  }
  return $row;
}

function geo_select_by_id(mysqli $con, int $id): ?array {
  $stmt = $con->prepare('SELECT id, requerimiento_id, latitud, longitud, precision_metros, direccion, cp_colonia_geo, validada, status, created_at, updated_by, updated_at FROM requerimiento_geolocalizacion WHERE id=? LIMIT 1');
  if (!$stmt) geo_json(500, ['ok' => false, 'error' => 'No se pudo preparar la consulta']);
  $stmt->bind_param('i', $id);
  if (!$stmt->execute()) geo_json(500, ['ok' => false, 'error' => 'No se pudo consultar la geolocalización']);
  $row = $stmt->get_result()->fetch_assoc() ?: null;
  $stmt->close();
  return $row ? geo_cast_row($row) : null;
}

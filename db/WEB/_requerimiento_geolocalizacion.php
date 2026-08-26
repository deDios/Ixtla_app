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

function geo_session_identity(mysqli $con): array {
  $raw = $_COOKIE['ix_emp'] ?? '';
  $payload = $raw !== '' ? json_decode((string)base64_decode($raw, true), true) : null;
  if (!is_array($payload)) geo_json(401, ['ok' => false, 'error' => 'Sesión requerida']);

  if (isset($payload['exp']) && is_numeric($payload['exp'])) {
    $nowMs = (int)round(microtime(true) * 1000);
    if ($nowMs > (int)$payload['exp']) geo_json(401, ['ok' => false, 'error' => 'La sesión expiró']);
  }

  $empleadoId = (int)($payload['empleado_id'] ?? $payload['id_empleado'] ?? 0);
  $cuentaId = (int)($payload['cuenta_id'] ?? $payload['id_cuenta'] ?? $payload['id_usuario'] ?? 0);
  if ($empleadoId < 1 || $cuentaId < 1) geo_json(401, ['ok' => false, 'error' => 'Sesión inválida']);

  $stmt = $con->prepare('SELECT e.id AS empleado_id, e.departamento_id, c.id AS cuenta_id FROM empleado_cuenta c JOIN empleado e ON e.id=c.empleado_id WHERE c.id=? AND c.empleado_id=? AND c.status=1 AND e.status=1 LIMIT 1');
  if (!$stmt) geo_json(500, ['ok' => false, 'error' => 'No se pudo comprobar la sesión']);
  $stmt->bind_param('ii', $cuentaId, $empleadoId);
  if (!$stmt->execute()) geo_json(500, ['ok' => false, 'error' => 'No se pudo comprobar la sesión']);
  $identity = $stmt->get_result()->fetch_assoc();
  $stmt->close();
  if (!$identity) geo_json(401, ['ok' => false, 'error' => 'Sesión no válida']);

  return [
    'empleado_id' => (int)$identity['empleado_id'],
    'cuenta_id' => (int)$identity['cuenta_id'],
    'departamento_id' => $identity['departamento_id'] === null ? null : (int)$identity['departamento_id'],
  ];
}

function geo_require_validation_permission(mysqli $con, int $geoId): array {
  $identity = geo_session_identity($con);
  $empleadoId = $identity['empleado_id'];
  $cuentaId = $identity['cuenta_id'];

  $roles = [];
  $stmt = $con->prepare('SELECT UPPER(r.codigo) AS codigo FROM empleado_rol er JOIN rol r ON r.id=er.rol_id WHERE er.empleado_cuenta_id=?');
  if (!$stmt) geo_json(500, ['ok' => false, 'error' => 'No se pudieron comprobar los permisos']);
  $stmt->bind_param('i', $cuentaId);
  if (!$stmt->execute()) geo_json(500, ['ok' => false, 'error' => 'No se pudieron comprobar los permisos']);
  $result = $stmt->get_result();
  while ($row = $result->fetch_assoc()) $roles[] = (string)$row['codigo'];
  $stmt->close();

  $stmt = $con->prepare('SELECT rg.requerimiento_id, r.departamento_id, d.director, d.primera_linea FROM requerimiento_geolocalizacion rg JOIN requerimiento r ON r.id=rg.requerimiento_id LEFT JOIN departamento d ON d.id=r.departamento_id WHERE rg.id=? LIMIT 1');
  if (!$stmt) geo_json(500, ['ok' => false, 'error' => 'No se pudo comprobar el requerimiento']);
  $stmt->bind_param('i', $geoId);
  if (!$stmt->execute()) geo_json(500, ['ok' => false, 'error' => 'No se pudo comprobar el requerimiento']);
  $scope = $stmt->get_result()->fetch_assoc();
  $stmt->close();
  if (!$scope) geo_json(404, ['ok' => false, 'error' => 'Geolocalización no encontrada']);

  $isAdmin = in_array('ADMIN', $roles, true);
  $isPresidencia = (int)$identity['departamento_id'] === 6;
  $isDirector = (int)($scope['director'] ?? 0) === $empleadoId;
  $isPrimeraLinea = (int)($scope['primera_linea'] ?? 0) === $empleadoId;
  $sameDept = (int)$identity['departamento_id'] === (int)$scope['departamento_id'];
  $directorRole = in_array('DIRECTOR', $roles, true) && $sameDept;
  $primeraRole = count(array_intersect(['PRIMERA_LINEA', 'PRIMERA LINEA', 'PL'], $roles)) > 0 && $sameDept;

  if (!$isAdmin && !$isPresidencia && !$isDirector && !$isPrimeraLinea && !$directorRole && !$primeraRole) {
    geo_json(403, ['ok' => false, 'error' => 'No tienes permiso para validar esta geolocalización']);
  }

  return $identity;
}

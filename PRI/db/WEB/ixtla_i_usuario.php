<?php
// db\WEB\ixtla_i_usuario.php

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === 'https://ixtla-app.com' || $origin === 'https://www.ixtla-app.com') {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
}

header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('America/Mexico_City');

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) {
  include $path;
} else {
  http_response_code(500);
  die(json_encode(["ok" => false, "error" => "No se encontró conn_db.php en $path"], JSON_UNESCAPED_UNICODE));
}

$in = json_decode(file_get_contents("php://input"), true) ?? [];

function uuidv4(): string {
  $data = random_bytes(16);
  $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
  $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
  return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function value_or_null(array $arr, string $key) {
  if (!array_key_exists($key, $arr)) return null;
  if ($arr[$key] === '') return null;
  return $arr[$key];
}

function bind_dynamic(mysqli_stmt $st, string $types, array &$params): void {
  $refs = [];
  $refs[] = $types;

  foreach ($params as $k => &$v) {
    $refs[] = &$v;
  }

  call_user_func_array([$st, 'bind_param'], $refs);
}

function usuario_response(mysqli $con, int $usuario_id): array {
  $sql = "
    SELECT
      u.usuario_id,
      u.uuid,
      u.username,
      u.persona_id,
      u.rol_id,
      u.nombre,
      u.apellido_paterno,
      u.apellido_materno,
      u.email,
      u.telefono,
      u.estatus_id,
      u.ultimo_login_at,
      u.ultimo_login_ip,
      u.requiere_cambio_password,
      u.intentos_fallidos,
      u.bloqueado_hasta,
      u.token_version,
      u.created_at,
      u.created_by,
      u.updated_at,
      u.updated_by,

      r.codigo AS rol_codigo,
      r.nombre AS rol_nombre,
      r.nivel_jerarquico,

      e.codigo AS estatus_codigo,
      e.nombre AS estatus_nombre

    FROM usuario u
    INNER JOIN cat_rol r
      ON r.rol_id = u.rol_id
    INNER JOIN cat_estatus e
      ON e.estatus_id = u.estatus_id
    WHERE u.usuario_id = ?
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $usuario_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) return [];

  return [
    "usuario_id" => (int)$row['usuario_id'],
    "uuid" => $row['uuid'],
    "username" => $row['username'],
    "persona_id" => isset($row['persona_id']) ? (int)$row['persona_id'] : null,
    "rol_id" => (int)$row['rol_id'],
    "rol" => [
      "codigo" => $row['rol_codigo'],
      "nombre" => $row['rol_nombre'],
      "nivel_jerarquico" => (int)$row['nivel_jerarquico']
    ],
    "nombre" => $row['nombre'],
    "apellido_paterno" => $row['apellido_paterno'],
    "apellido_materno" => $row['apellido_materno'],
    "email" => $row['email'],
    "telefono" => $row['telefono'],
    "estatus_id" => (int)$row['estatus_id'],
    "estatus" => [
      "codigo" => $row['estatus_codigo'],
      "nombre" => $row['estatus_nombre']
    ],
    "ultimo_login_at" => $row['ultimo_login_at'],
    "ultimo_login_ip" => $row['ultimo_login_ip'],
    "requiere_cambio_password" => (int)$row['requiere_cambio_password'],
    "intentos_fallidos" => (int)$row['intentos_fallidos'],
    "bloqueado_hasta" => $row['bloqueado_hasta'],
    "token_version" => (int)$row['token_version'],
    "created_at" => $row['created_at'],
    "created_by" => isset($row['created_by']) ? (int)$row['created_by'] : null,
    "updated_at" => $row['updated_at'],
    "updated_by" => isset($row['updated_by']) ? (int)$row['updated_by'] : null
  ];
}

$username = array_key_exists('username', $in) ? trim((string)$in['username']) : null;
$nombre = isset($in['nombre']) ? trim((string)$in['nombre']) : '';
$email = isset($in['email']) ? trim((string)$in['email']) : '';
$password = isset($in['password']) ? (string)$in['password'] : '';

if ($nombre === '') {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Falta parámetro obligatorio: nombre"], JSON_UNESCAPED_UNICODE));
}

if ($email === '') {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Falta parámetro obligatorio: email"], JSON_UNESCAPED_UNICODE));
}

if ($password === '') {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Falta parámetro obligatorio: password"], JSON_UNESCAPED_UNICODE));
}

if (strlen($password) < 8) {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "La contraseña debe tener al menos 8 caracteres"], JSON_UNESCAPED_UNICODE));
}

$rol_id = isset($in['rol_id']) ? (int)$in['rol_id'] : 0;
$rol_codigo = isset($in['rol_codigo']) ? strtoupper(trim((string)$in['rol_codigo'])) : '';

if ($rol_id <= 0 && $rol_codigo === '') {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Falta rol_id o rol_codigo"], JSON_UNESCAPED_UNICODE));
}

$uuid = isset($in['uuid']) && trim((string)$in['uuid']) !== ''
  ? trim((string)$in['uuid'])
  : uuidv4();

$persona_id = array_key_exists('persona_id', $in) && $in['persona_id'] !== null
  ? (int)$in['persona_id']
  : null;

$estatus_id = isset($in['estatus_id']) ? (int)$in['estatus_id'] : 4;
$requiere_cambio_password = array_key_exists('requiere_cambio_password', $in) ? (int)$in['requiere_cambio_password'] : 0;
$created_by = array_key_exists('created_by', $in) && $in['created_by'] !== null ? (int)$in['created_by'] : null;

$hash = password_hash($password, PASSWORD_DEFAULT);
if (!$hash) {
  http_response_code(500);
  die(json_encode(["ok" => false, "error" => "No se pudo generar el hash de la contraseña"], JSON_UNESCAPED_UNICODE));
}

$con = conectar();
if (!$con) {
  http_response_code(500);
  die(json_encode(["ok" => false, "error" => "No se pudo conectar a la base de datos"], JSON_UNESCAPED_UNICODE));
}

$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

/* Resolver rol por código si aplica */
if ($rol_id <= 0 && $rol_codigo !== '') {
  $st = $con->prepare("
    SELECT rol_id
    FROM cat_rol
    WHERE codigo = ?
      AND activo = 1
    LIMIT 1
  ");

  $st->bind_param("s", $rol_codigo);
  $st->execute();
  $rol = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$rol) {
    $con->close();
    http_response_code(400);
    die(json_encode(["ok" => false, "error" => "rol_codigo inválido o inactivo"], JSON_UNESCAPED_UNICODE));
  }

  $rol_id = (int)$rol['rol_id'];
}

/* Validar persona si viene */
if ($persona_id !== null && $persona_id > 0) {
  $st = $con->prepare("
    SELECT persona_id
    FROM persona
    WHERE persona_id = ?
      AND deleted_at IS NULL
    LIMIT 1
  ");

  $st->bind_param("i", $persona_id);
  $st->execute();
  $persona = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$persona) {
    $con->close();
    http_response_code(400);
    die(json_encode(["ok" => false, "error" => "persona_id inválido"], JSON_UNESCAPED_UNICODE));
  }
}

$con->begin_transaction();

try {
  $columns = [
    "uuid",
    "rol_id",
    "nombre",
    "email",
    "password_hash",
    "estatus_id",
    "requiere_cambio_password"
  ];

  $placeholders = ["?", "?", "?", "?", "?", "?", "?"];

  $params = [
    $uuid,
    $rol_id,
    $nombre,
    $email,
    $hash,
    $estatus_id,
    $requiere_cambio_password
  ];

  $types = "sisssii";

  $map = [
    "username" => "s",
    "persona_id" => "i",
    "apellido_paterno" => "s",
    "apellido_materno" => "s",
    "telefono" => "s",
    "ultimo_login_at" => "s",
    "ultimo_login_ip" => "s",
    "intentos_fallidos" => "i",
    "bloqueado_hasta" => "s",
    "token_version" => "i",
    "created_by" => "i"
  ];

  foreach ($map as $field => $type) {
    if (array_key_exists($field, $in)) {
      $columns[] = $field;
      $placeholders[] = "?";
      $params[] = value_or_null($in, $field);
      $types .= $type;
    }
  }

  $sql = "
    INSERT INTO usuario (
      " . implode(", ", $columns) . "
    ) VALUES (
      " . implode(", ", $placeholders) . "
    )
  ";

  $st = $con->prepare($sql);
  bind_dynamic($st, $types, $params);

  if (!$st->execute()) {
    $code = $st->errno;
    $err = $st->error;
    $st->close();
    throw new Exception($err, $code);
  }

  $usuario_id = (int)$con->insert_id;
  $st->close();

  $data = usuario_response($con, $usuario_id);

  $con->commit();

} catch (Exception $e) {
  $con->rollback();

  $code = $e->getCode();
  $msg = $e->getMessage();

  $con->close();

  if ($code == 1062) {
    $campo = "único";

    if (stripos($msg, "uq_usuario_email") !== false) {
      $campo = "email";
    } elseif (stripos($msg, "uq_usuario_persona") !== false) {
      $campo = "persona_id";
    } elseif (stripos($msg, "uq_usuario_username") !== false) {
      $campo = "username";
    } elseif (stripos($msg, "uuid") !== false) {
      $campo = "uuid";
    }

    http_response_code(409);
    die(json_encode([
      "ok" => false,
      "error" => "Duplicado en campo $campo",
      "detail" => $msg,
      "code" => $code
    ], JSON_UNESCAPED_UNICODE));
  }

  if ($code == 1452) {
    http_response_code(400);
    die(json_encode([
      "ok" => false,
      "error" => "FK inválida. Revisa persona_id, rol_id o estatus_id",
      "detail" => $msg,
      "code" => $code
    ], JSON_UNESCAPED_UNICODE));
  }

  http_response_code(500);
  die(json_encode([
    "ok" => false,
    "error" => "No se pudo crear el usuario",
    "detail" => $msg,
    "code" => $code
  ], JSON_UNESCAPED_UNICODE));
}

$con->close();

echo json_encode([
  "ok" => true,
  "data" => $data
], JSON_UNESCAPED_UNICODE);
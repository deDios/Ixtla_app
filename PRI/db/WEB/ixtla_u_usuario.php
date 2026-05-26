<?php
// db\WEB\ixtla_u_usuario.php

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
      u.deleted_at,
      u.deleted_by,

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
    "updated_by" => isset($row['updated_by']) ? (int)$row['updated_by'] : null,
    "deleted_at" => $row['deleted_at'],
    "deleted_by" => isset($row['deleted_by']) ? (int)$row['deleted_by'] : null
  ];
}

$usuario_id = isset($in['usuario_id']) ? (int)$in['usuario_id'] : (isset($in['id']) ? (int)$in['id'] : 0);

if ($usuario_id <= 0) {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Falta parámetro obligatorio: usuario_id"], JSON_UNESCAPED_UNICODE));
}

$con = conectar();
if (!$con) {
  http_response_code(500);
  die(json_encode(["ok" => false, "error" => "No se pudo conectar a la base de datos"], JSON_UNESCAPED_UNICODE));
}

$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

$st = $con->prepare("
  SELECT *
  FROM usuario
  WHERE usuario_id = ?
    AND deleted_at IS NULL
  LIMIT 1
");

$st->bind_param("i", $usuario_id);
$st->execute();
$current = $st->get_result()->fetch_assoc();
$st->close();

if (!$current) {
  $con->close();
  http_response_code(404);
  die(json_encode(["ok" => false, "error" => "Usuario no encontrado"], JSON_UNESCAPED_UNICODE));
}

/* Resolver rol_codigo si viene */
if (isset($in['rol_codigo']) && trim((string)$in['rol_codigo']) !== '' && !isset($in['rol_id'])) {
  $rol_codigo = strtoupper(trim((string)$in['rol_codigo']));

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

  $in['rol_id'] = (int)$rol['rol_id'];
}

/* Validar persona si viene */
if (array_key_exists('persona_id', $in) && $in['persona_id'] !== null && $in['persona_id'] !== '') {
  $persona_id = (int)$in['persona_id'];

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

$map = [
  "username" => "s",
  "persona_id" => "i",
  "rol_id" => "i",
  "nombre" => "s",
  "apellido_paterno" => "s",
  "apellido_materno" => "s",
  "email" => "s",
  "telefono" => "s",
  "estatus_id" => "i",
  "ultimo_login_at" => "s",
  "ultimo_login_ip" => "s",
  "requiere_cambio_password" => "i",
  "intentos_fallidos" => "i",
  "bloqueado_hasta" => "s",
  "updated_by" => "i",
  "deleted_at" => "s",
  "deleted_by" => "i"
];

$set = [];
$params = [];
$types = "";

foreach ($map as $field => $type) {
  if (array_key_exists($field, $in)) {
    $set[] = "$field = ?";
    $params[] = value_or_null($in, $field);
    $types .= $type;
  }
}

/* Password especial */
if (array_key_exists('password', $in) && trim((string)$in['password']) !== '') {
  $password = (string)$in['password'];

  if (strlen($password) < 8) {
    $con->close();
    http_response_code(400);
    die(json_encode(["ok" => false, "error" => "La contraseña debe tener al menos 8 caracteres"], JSON_UNESCAPED_UNICODE));
  }

  $hash = password_hash($password, PASSWORD_DEFAULT);

  if (!$hash) {
    $con->close();
    http_response_code(500);
    die(json_encode(["ok" => false, "error" => "No se pudo generar el hash de la contraseña"], JSON_UNESCAPED_UNICODE));
  }

  $set[] = "password_hash = ?";
  $params[] = $hash;
  $types .= "s";

  $set[] = "token_version = token_version + 1";
}

if (!$set) {
  $con->close();
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "No hay campos para actualizar"], JSON_UNESCAPED_UNICODE));
}

$params[] = $usuario_id;
$types .= "i";

$con->begin_transaction();

try {
  $sql = "
    UPDATE usuario
    SET " . implode(", ", $set) . "
    WHERE usuario_id = ?
  ";

  $st = $con->prepare($sql);
  bind_dynamic($st, $types, $params);

  if (!$st->execute()) {
    $code = $st->errno;
    $err = $st->error;
    $st->close();
    throw new Exception($err, $code);
  }

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
    "error" => "No se pudo actualizar el usuario",
    "detail" => $msg,
    "code" => $code
  ], JSON_UNESCAPED_UNICODE));
}

$con->close();

echo json_encode([
  "ok" => true,
  "data" => $data
], JSON_UNESCAPED_UNICODE);
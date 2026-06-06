<?php
// db/WEB/ixtla_i_usuario.php

declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
date_default_timezone_set('America/Mexico_City');

/* ============================================================
   CORS
   ============================================================ */

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

$allowed_origins = [
  'https://ixtla-app.com',
  'https://www.ixtla-app.com'
];

if (in_array($origin, $allowed_origins, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
}

header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400");
header("X-Content-Type-Options: nosniff");
header("Referrer-Policy: no-referrer");
header("Content-Type: application/json; charset=utf-8");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

/* ============================================================
   HELPERS
   ============================================================ */

function json_response(array $data, int $status = 200): void
{
  http_response_code($status);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function internal_error(string $message): void
{
  error_log('[IXTLA_I_USUARIO] ' . $message);

  json_response([
    "ok" => false,
    "error" => "Error interno del servidor"
  ], 500);
}

function read_json_body(): array
{
  $raw = file_get_contents("php://input");

  if (!$raw || trim($raw) === '') {
    json_response([
      "ok" => false,
      "error" => "Body JSON requerido"
    ], 400);
  }

  $in = json_decode($raw, true);

  if (!is_array($in)) {
    json_response([
      "ok" => false,
      "error" => "JSON inválido"
    ], 400);
  }

  return $in;
}

function db(): mysqli
{
  $path = realpath("/home/site/wwwroot/db/conn/conn_db_2.php");

  if (!$path || !file_exists($path)) {
    internal_error("No se encontró conn_db_2.php en /home/site/wwwroot/db/conn/conn_db_2.php");
  }

  include_once $path;

  if (!function_exists('conectar')) {
    internal_error("No existe la función conectar() en conn_db_2.php");
  }

  $con = conectar();

  if (!$con instanceof mysqli) {
    internal_error("conectar() no regresó una conexión mysqli válida");
  }

  $con->set_charset('utf8mb4');
  $con->query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
  $con->query("SET time_zone='-06:00'");

  return $con;
}

function uuidv4(): string
{
  $data = random_bytes(16);

  $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
  $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);

  return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function value_or_null(array $arr, string $key): mixed
{
  if (!array_key_exists($key, $arr)) {
    return null;
  }

  if ($arr[$key] === '') {
    return null;
  }

  return $arr[$key];
}

function bind_dynamic(mysqli_stmt $stmt, string $types, array &$params): void
{
  if ($types === '' || empty($params)) {
    return;
  }

  $refs = [];
  $refs[] = $types;

  foreach ($params as $key => &$value) {
    $refs[] = &$value;
  }

  call_user_func_array([$stmt, 'bind_param'], $refs);
}

function str_clean(array $in, string $key): string
{
  return isset($in[$key]) ? trim((string)$in[$key]) : '';
}

function nullable_int_from_row(array $row, string $key): ?int
{
  return isset($row[$key]) && $row[$key] !== null ? (int)$row[$key] : null;
}

/* ============================================================
   FORMATTER
   ============================================================ */

function usuario_row(array $row): array
{
  $nombreCompleto = trim(
    (string)$row['nombre'] . ' ' .
      (string)$row['apellido_paterno'] . ' ' .
      (string)$row['apellido_materno']
  );

  $personaNombreCompleto = trim(
    (string)($row['persona_nombres'] ?? '') . ' ' .
      (string)($row['persona_apellido_paterno'] ?? '') . ' ' .
      (string)($row['persona_apellido_materno'] ?? '')
  );

  return [
    "usuario_id" => (int)$row['usuario_id'],
    "uuid" => $row['uuid'],
    "username" => $row['username'],
    "persona_id" => nullable_int_from_row($row, 'persona_id'),

    "rol_id" => (int)$row['rol_id'],
    "rol" => [
      "rol_id" => (int)$row['rol_id'],
      "codigo" => $row['rol_codigo'],
      "nombre" => $row['rol_nombre'],
      "nivel_jerarquico" => nullable_int_from_row($row, 'nivel_jerarquico')
    ],

    "nombre" => $row['nombre'],
    "apellido_paterno" => $row['apellido_paterno'],
    "apellido_materno" => $row['apellido_materno'],
    "nombre_completo" => $nombreCompleto,
    "email" => $row['email'],
    "telefono" => $row['telefono'],

    "estatus_id" => (int)$row['estatus_id'],
    "estatus" => [
      "estatus_id" => (int)$row['estatus_id'],
      "codigo" => $row['estatus_codigo'],
      "nombre" => $row['estatus_nombre']
    ],

    "ultimo_login_at" => $row['ultimo_login_at'],
    "ultimo_login_ip" => $row['ultimo_login_ip'],
    "requiere_cambio_password" => (int)$row['requiere_cambio_password'],
    "intentos_fallidos" => (int)$row['intentos_fallidos'],
    "bloqueado_hasta" => $row['bloqueado_hasta'],
    "token_version" => (int)$row['token_version'],

    "persona" => [
      "persona_id" => nullable_int_from_row($row, 'persona_id'),
      "uuid" => $row['persona_uuid'],
      "nombres" => $row['persona_nombres'],
      "apellido_paterno" => $row['persona_apellido_paterno'],
      "apellido_materno" => $row['persona_apellido_materno'],
      "nombre_completo" => $personaNombreCompleto !== '' ? $personaNombreCompleto : null,
      "telefono" => $row['persona_telefono'],
      "whatsapp" => $row['persona_whatsapp'],
      "email" => $row['persona_email'],
      "estatus_id" => nullable_int_from_row($row, 'persona_estatus_id')
    ],

    "created_at" => $row['created_at'],
    "created_by" => nullable_int_from_row($row, 'created_by'),
    "updated_at" => $row['updated_at'],
    "updated_by" => nullable_int_from_row($row, 'updated_by'),
    "deleted_at" => $row['deleted_at'],
    "deleted_by" => nullable_int_from_row($row, 'deleted_by')
  ];
}

/* ============================================================
   SQL BASE
   ============================================================ */

function base_select(): string
{
  return "
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
      e.nombre AS estatus_nombre,

      p.uuid AS persona_uuid,
      p.nombres AS persona_nombres,
      p.apellido_paterno AS persona_apellido_paterno,
      p.apellido_materno AS persona_apellido_materno,
      p.telefono AS persona_telefono,
      p.whatsapp AS persona_whatsapp,
      p.email AS persona_email,
      p.estatus_id AS persona_estatus_id

    FROM usuario u

    INNER JOIN cat_rol r
      ON r.rol_id = u.rol_id

    INNER JOIN cat_estatus e
      ON e.estatus_id = u.estatus_id

    LEFT JOIN persona p
      ON p.persona_id = u.persona_id
     AND p.deleted_at IS NULL
  ";
}

function obtener_usuario(mysqli $con, int $usuario_id): array
{
  $sql = base_select() . "
    WHERE u.usuario_id = ?
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $usuario_id);
  $st->execute();

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    internal_error("Usuario insertado pero no encontrado. usuario_id=$usuario_id");
  }

  return usuario_row($row);
}

/* ============================================================
   VALIDACIONES
   ============================================================ */

function resolver_rol_id(mysqli $con, array $in): int
{
  $rol_id = isset($in['rol_id']) ? (int)$in['rol_id'] : 0;
  $rol_codigo = isset($in['rol_codigo'])
    ? strtoupper(trim((string)$in['rol_codigo']))
    : '';

  if ($rol_id <= 0 && $rol_codigo === '') {
    json_response([
      "ok" => false,
      "error" => "Falta rol_id o rol_codigo"
    ], 400);
  }

  if ($rol_id > 0) {
    $st = $con->prepare("
      SELECT rol_id
      FROM cat_rol
      WHERE rol_id = ?
        AND activo = 1
      LIMIT 1
    ");

    $st->bind_param("i", $rol_id);
    $st->execute();

    $rol = $st->get_result()->fetch_assoc();
    $st->close();

    if (!$rol) {
      json_response([
        "ok" => false,
        "error" => "rol_id inválido o inactivo"
      ], 400);
    }

    return $rol_id;
  }

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
    json_response([
      "ok" => false,
      "error" => "rol_codigo inválido o inactivo"
    ], 400);
  }

  return (int)$rol['rol_id'];
}

function validar_persona(mysqli $con, ?int $persona_id): void
{
  if ($persona_id === null || $persona_id <= 0) {
    return;
  }

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
    json_response([
      "ok" => false,
      "error" => "persona_id inválido"
    ], 400);
  }
}

/* ============================================================
   INSERT
   ============================================================ */

function insertar_usuario(mysqli $con, array $in): array
{
  $username = array_key_exists('username', $in)
    ? trim((string)$in['username'])
    : null;

  $nombre = str_clean($in, 'nombre');
  $email = str_clean($in, 'email');
  $password = isset($in['password']) ? (string)$in['password'] : '';

  if ($nombre === '') {
    json_response([
      "ok" => false,
      "error" => "Falta parámetro obligatorio: nombre"
    ], 400);
  }

  if ($email === '') {
    json_response([
      "ok" => false,
      "error" => "Falta parámetro obligatorio: email"
    ], 400);
  }

  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response([
      "ok" => false,
      "error" => "Email inválido"
    ], 400);
  }

  if ($password === '') {
    json_response([
      "ok" => false,
      "error" => "Falta parámetro obligatorio: password"
    ], 400);
  }

  if (strlen($password) < 8) {
    json_response([
      "ok" => false,
      "error" => "La contraseña debe tener al menos 8 caracteres"
    ], 400);
  }

  $rol_id = resolver_rol_id($con, $in);

  $uuid = isset($in['uuid']) && trim((string)$in['uuid']) !== ''
    ? trim((string)$in['uuid'])
    : uuidv4();

  $persona_id = array_key_exists('persona_id', $in) && $in['persona_id'] !== null && $in['persona_id'] !== ''
    ? (int)$in['persona_id']
    : null;

  validar_persona($con, $persona_id);

  $estatus_id = isset($in['estatus_id']) && (int)$in['estatus_id'] > 0
    ? (int)$in['estatus_id']
    : 4;

  $requiere_cambio_password = array_key_exists('requiere_cambio_password', $in)
    ? (((int)$in['requiere_cambio_password']) === 1 ? 1 : 0)
    : 0;

  $created_by = array_key_exists('created_by', $in) && $in['created_by'] !== null && (int)$in['created_by'] > 0
    ? (int)$in['created_by']
    : null;

  $hash = password_hash($password, PASSWORD_DEFAULT);

  if (!$hash) {
    internal_error("No se pudo generar el hash de la contraseña");
  }

  $columns = [
    "uuid",
    "rol_id",
    "nombre",
    "email",
    "password_hash",
    "estatus_id",
    "requiere_cambio_password"
  ];

  $placeholders = [
    "?",
    "?",
    "?",
    "?",
    "?",
    "?",
    "?"
  ];

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

  $optionalMap = [
    "username" => "s",
    "persona_id" => "i",
    "apellido_paterno" => "s",
    "apellido_materno" => "s",
    "telefono" => "s",
    "ultimo_login_at" => "s",
    "ultimo_login_ip" => "s",
    "intentos_fallidos" => "i",
    "bloqueado_hasta" => "s",
    "token_version" => "i"
  ];

  foreach ($optionalMap as $field => $type) {
    if (!array_key_exists($field, $in)) {
      continue;
    }

    $columns[] = $field;
    $placeholders[] = "?";

    if ($field === 'username') {
      $params[] = $username !== '' ? $username : null;
    } else {
      $params[] = value_or_null($in, $field);
    }

    $types .= $type;
  }

  if ($created_by !== null) {
    $columns[] = "created_by";
    $placeholders[] = "?";
    $params[] = $created_by;
    $types .= "i";
  }

  $sql = "
    INSERT INTO usuario (
      " . implode(", ", $columns) . "
    )
    VALUES (
      " . implode(", ", $placeholders) . "
    )
  ";

  $st = $con->prepare($sql);
  bind_dynamic($st, $types, $params);
  $st->execute();

  $usuario_id = (int)$con->insert_id;

  $st->close();

  return obtener_usuario($con, $usuario_id);
}

/* ============================================================
   MAIN
   ============================================================ */

try {
  if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_response([
      "ok" => false,
      "error" => "Método no permitido. Usa POST."
    ], 405);
  }

  $in = read_json_body();
  $con = db();

  $con->begin_transaction();

  try {
    $data = insertar_usuario($con, $in);
    $con->commit();
  } catch (Throwable $e) {
    $con->rollback();
    throw $e;
  }

  $con->close();

  json_response([
    "ok" => true,
    "message" => "Usuario creado correctamente",
    "data" => $data
  ], 201);
} catch (mysqli_sql_exception $e) {
  if (isset($con) && $con instanceof mysqli) {
    try {
      $con->close();
    } catch (Throwable $ignored) {
    }
  }

  $code = (int)$e->getCode();
  $msg = $e->getMessage();

  error_log('[IXTLA_I_USUARIO][SQL] ' . $msg);

  if ($code === 1062) {
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

    json_response([
      "ok" => false,
      "error" => "Duplicado en campo $campo",
      "duplicate_field" => $campo
    ], 409);
  }

  if ($code === 1452) {
    json_response([
      "ok" => false,
      "error" => "FK inválida. Revisa persona_id, rol_id o estatus_id"
    ], 400);
  }

  json_response([
    "ok" => false,
    "error" => "Error de base de datos"
  ], 500);
} catch (Throwable $e) {
  if (isset($con) && $con instanceof mysqli) {
    try {
      $con->close();
    } catch (Throwable $ignored) {
    }
  }

  error_log('[IXTLA_I_USUARIO][ERR] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error interno del servidor"
  ], 500);
}
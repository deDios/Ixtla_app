<?php
// db/WEB/ixtla_u_usuario.php

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

header("Access-Control-Allow-Methods: POST, PUT, PATCH, OPTIONS");
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
  error_log('[IXTLA_U_USUARIO] ' . $message);

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
    internal_error("Usuario actualizado pero no encontrado. usuario_id=$usuario_id");
  }

  return usuario_row($row);
}

/* ============================================================
   VALIDACIONES
   ============================================================ */

function resolver_rol_id_si_viene(mysqli $con, array &$in): void
{
  if (
    isset($in['rol_codigo']) &&
    trim((string)$in['rol_codigo']) !== '' &&
    !array_key_exists('rol_id', $in)
  ) {
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
      json_response([
        "ok" => false,
        "error" => "rol_codigo inválido o inactivo"
      ], 400);
    }

    $in['rol_id'] = (int)$rol['rol_id'];
  }

  if (array_key_exists('rol_id', $in) && $in['rol_id'] !== null && $in['rol_id'] !== '') {
    $rol_id = (int)$in['rol_id'];

    if ($rol_id <= 0) {
      json_response([
        "ok" => false,
        "error" => "rol_id inválido"
      ], 400);
    }

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
  }
}

function validar_persona_si_viene(mysqli $con, array $in): void
{
  if (!array_key_exists('persona_id', $in)) {
    return;
  }

  if ($in['persona_id'] === null || $in['persona_id'] === '') {
    return;
  }

  $persona_id = (int)$in['persona_id'];

  if ($persona_id <= 0) {
    json_response([
      "ok" => false,
      "error" => "persona_id inválido"
    ], 400);
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

function validar_estatus_si_viene(mysqli $con, array $in): void
{
  if (!array_key_exists('estatus_id', $in)) {
    return;
  }

  if ($in['estatus_id'] === null || $in['estatus_id'] === '') {
    json_response([
      "ok" => false,
      "error" => "estatus_id inválido"
    ], 400);
  }

  $estatus_id = (int)$in['estatus_id'];

  if ($estatus_id <= 0) {
    json_response([
      "ok" => false,
      "error" => "estatus_id inválido"
    ], 400);
  }

  $st = $con->prepare("
    SELECT estatus_id
    FROM cat_estatus
    WHERE estatus_id = ?
    LIMIT 1
  ");

  $st->bind_param("i", $estatus_id);
  $st->execute();

  $estatus = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$estatus) {
    json_response([
      "ok" => false,
      "error" => "estatus_id inválido"
    ], 400);
  }
}

/* ============================================================
   UPDATE
   ============================================================ */

function actualizar_usuario(mysqli $con, array $in): array
{
  $usuario_id = isset($in['usuario_id'])
    ? (int)$in['usuario_id']
    : (isset($in['id']) ? (int)$in['id'] : 0);

  if ($usuario_id <= 0) {
    json_response([
      "ok" => false,
      "error" => "Falta parámetro obligatorio: usuario_id"
    ], 400);
  }

  $check = $con->prepare("
    SELECT usuario_id
    FROM usuario
    WHERE usuario_id = ?
      AND deleted_at IS NULL
    LIMIT 1
  ");

  $check->bind_param("i", $usuario_id);
  $check->execute();

  $current = $check->get_result()->fetch_assoc();
  $check->close();

  if (!$current) {
    json_response([
      "ok" => false,
      "error" => "Usuario no encontrado"
    ], 404);
  }

  resolver_rol_id_si_viene($con, $in);
  validar_persona_si_viene($con, $in);
  validar_estatus_si_viene($con, $in);

  if (array_key_exists('email', $in)) {
    $email = str_clean($in, 'email');

    if ($email === '') {
      json_response([
        "ok" => false,
        "error" => "Email inválido"
      ], 400);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
      json_response([
        "ok" => false,
        "error" => "Email inválido"
      ], 400);
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
    if (!array_key_exists($field, $in)) {
      continue;
    }

    $set[] = "$field = ?";

    if ($field === 'requiere_cambio_password') {
      $params[] = ((int)$in[$field]) === 1 ? 1 : 0;
    } elseif ($field === 'intentos_fallidos') {
      $params[] = max(0, (int)$in[$field]);
    } else {
      $params[] = value_or_null($in, $field);
    }

    $types .= $type;
  }

  /*
    Soft delete práctico:
    Si mandas deleted_by pero no deleted_at, se asigna NOW().
  */

  if (
    array_key_exists('deleted_by', $in) &&
    (int)$in['deleted_by'] > 0 &&
    !array_key_exists('deleted_at', $in)
  ) {
    $set[] = "deleted_at = NOW()";
  }

  /*
    Restaurar usuario:
    Si mandas deleted_at: null, también puedes mandar deleted_by: null.
  */

  if (array_key_exists('password', $in) && trim((string)$in['password']) !== '') {
    $password = (string)$in['password'];

    if (strlen($password) < 8) {
      json_response([
        "ok" => false,
        "error" => "La contraseña debe tener al menos 8 caracteres"
      ], 400);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);

    if (!$hash) {
      internal_error("No se pudo generar el hash de la contraseña");
    }

    $set[] = "password_hash = ?";
    $params[] = $hash;
    $types .= "s";

    $set[] = "token_version = token_version + 1";
  }

  if (empty($set)) {
    json_response([
      "ok" => false,
      "error" => "No hay campos para actualizar"
    ], 400);
  }

  $params[] = $usuario_id;
  $types .= "i";

  $sql = "
    UPDATE usuario
    SET " . implode(", ", $set) . "
    WHERE usuario_id = ?
  ";

  $st = $con->prepare($sql);
  bind_dynamic($st, $types, $params);
  $st->execute();
  $st->close();

  return obtener_usuario($con, $usuario_id);
}

/* ============================================================
   MAIN
   ============================================================ */

try {
  if (!in_array(($_SERVER['REQUEST_METHOD'] ?? ''), ['POST', 'PUT', 'PATCH'], true)) {
    json_response([
      "ok" => false,
      "error" => "Método no permitido. Usa POST, PUT o PATCH."
    ], 405);
  }

  $in = read_json_body();
  $con = db();

  $con->begin_transaction();

  try {
    $data = actualizar_usuario($con, $in);
    $con->commit();
  } catch (Throwable $e) {
    $con->rollback();
    throw $e;
  }

  $con->close();

  json_response([
    "ok" => true,
    "message" => "Usuario actualizado correctamente",
    "data" => $data
  ]);
} catch (mysqli_sql_exception $e) {
  if (isset($con) && $con instanceof mysqli) {
    try {
      $con->close();
    } catch (Throwable $ignored) {
    }
  }

  $code = (int)$e->getCode();
  $msg = $e->getMessage();

  error_log('[IXTLA_U_USUARIO][SQL] ' . $msg);

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

  error_log('[IXTLA_U_USUARIO][ERR] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error interno del servidor"
  ], 500);
}
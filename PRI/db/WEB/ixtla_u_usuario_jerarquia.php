<?php
// db/WEB/ixtla_u_usuario_jerarquia.php

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
  error_log('[IXTLA_U_USUARIO_JERARQUIA] ' . $message);

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

function nullable_int_from_row(array $row, string $key): ?int
{
  return isset($row[$key]) && $row[$key] !== null ? (int)$row[$key] : null;
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

/* ============================================================
   FORMATTERS
   ============================================================ */

function usuario_min_row(array $row, string $prefix): array
{
  $nombreCompleto = trim(
    (string)($row[$prefix . '_nombre'] ?? '') . ' ' .
    (string)($row[$prefix . '_apellido_paterno'] ?? '') . ' ' .
    (string)($row[$prefix . '_apellido_materno'] ?? '')
  );

  return [
    "usuario_id" => nullable_int_from_row($row, $prefix . '_usuario_id'),
    "uuid" => $row[$prefix . '_uuid'] ?? null,
    "username" => $row[$prefix . '_username'] ?? null,
    "persona_id" => nullable_int_from_row($row, $prefix . '_persona_id'),
    "rol_id" => nullable_int_from_row($row, $prefix . '_rol_id'),
    "nombre" => $row[$prefix . '_nombre'] ?? null,
    "apellido_paterno" => $row[$prefix . '_apellido_paterno'] ?? null,
    "apellido_materno" => $row[$prefix . '_apellido_materno'] ?? null,
    "nombre_completo" => $nombreCompleto,
    "email" => $row[$prefix . '_email'] ?? null,
    "telefono" => $row[$prefix . '_telefono'] ?? null,
    "estatus_id" => nullable_int_from_row($row, $prefix . '_estatus_id')
  ];
}

function jerarquia_row(array $row): array
{
  return [
    "usuario_jerarquia_id" => (int)$row['usuario_jerarquia_id'],
    "usuario_padre_id" => (int)$row['usuario_padre_id'],
    "usuario_hijo_id" => (int)$row['usuario_hijo_id'],
    "fecha_inicio" => $row['fecha_inicio'],
    "fecha_fin" => $row['fecha_fin'],
    "activo" => (int)$row['activo'],

    "padre" => usuario_min_row($row, 'padre'),
    "hijo" => usuario_min_row($row, 'hijo'),

    "created_at" => $row['created_at'],
    "created_by" => nullable_int_from_row($row, 'created_by'),
    "updated_at" => $row['updated_at'],
    "updated_by" => nullable_int_from_row($row, 'updated_by')
  ];
}

/* ============================================================
   SQL BASE
   ============================================================ */

function base_select(): string
{
  return "
    SELECT
      uj.usuario_jerarquia_id,
      uj.usuario_padre_id,
      uj.usuario_hijo_id,
      uj.fecha_inicio,
      uj.fecha_fin,
      uj.activo,
      uj.created_at,
      uj.created_by,
      uj.updated_at,
      uj.updated_by,

      up.usuario_id AS padre_usuario_id,
      up.uuid AS padre_uuid,
      up.username AS padre_username,
      up.persona_id AS padre_persona_id,
      up.rol_id AS padre_rol_id,
      up.nombre AS padre_nombre,
      up.apellido_paterno AS padre_apellido_paterno,
      up.apellido_materno AS padre_apellido_materno,
      up.email AS padre_email,
      up.telefono AS padre_telefono,
      up.estatus_id AS padre_estatus_id,

      uh.usuario_id AS hijo_usuario_id,
      uh.uuid AS hijo_uuid,
      uh.username AS hijo_username,
      uh.persona_id AS hijo_persona_id,
      uh.rol_id AS hijo_rol_id,
      uh.nombre AS hijo_nombre,
      uh.apellido_paterno AS hijo_apellido_paterno,
      uh.apellido_materno AS hijo_apellido_materno,
      uh.email AS hijo_email,
      uh.telefono AS hijo_telefono,
      uh.estatus_id AS hijo_estatus_id

    FROM usuario_jerarquia uj

    INNER JOIN usuario up
      ON up.usuario_id = uj.usuario_padre_id
     AND up.deleted_at IS NULL

    INNER JOIN usuario uh
      ON uh.usuario_id = uj.usuario_hijo_id
     AND uh.deleted_at IS NULL
  ";
}

function obtener_jerarquia(mysqli $con, int $usuario_jerarquia_id): array
{
  $sql = base_select() . "
    WHERE uj.usuario_jerarquia_id = ?
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $usuario_jerarquia_id);
  $st->execute();

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    internal_error("Jerarquía actualizada pero no encontrada. usuario_jerarquia_id=$usuario_jerarquia_id");
  }

  return jerarquia_row($row);
}

function validar_usuario_existe(mysqli $con, int $usuario_id, string $label): void
{
  $st = $con->prepare("
    SELECT usuario_id
    FROM usuario
    WHERE usuario_id = ?
      AND deleted_at IS NULL
    LIMIT 1
  ");

  $st->bind_param("i", $usuario_id);
  $st->execute();

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    json_response([
      "ok" => false,
      "error" => "$label no encontrado"
    ], 404);
  }
}

/* ============================================================
   UPDATE
   ============================================================ */

function actualizar_usuario_jerarquia(mysqli $con, array $in): array
{
  $usuario_jerarquia_id = isset($in['usuario_jerarquia_id'])
    ? (int)$in['usuario_jerarquia_id']
    : (isset($in['id']) ? (int)$in['id'] : 0);

  if ($usuario_jerarquia_id <= 0) {
    json_response([
      "ok" => false,
      "error" => "Falta parámetro obligatorio: usuario_jerarquia_id"
    ], 400);
  }

  $check = $con->prepare("
    SELECT
      usuario_jerarquia_id,
      usuario_padre_id,
      usuario_hijo_id
    FROM usuario_jerarquia
    WHERE usuario_jerarquia_id = ?
    LIMIT 1
  ");

  $check->bind_param("i", $usuario_jerarquia_id);
  $check->execute();

  $exists = $check->get_result()->fetch_assoc();
  $check->close();

  if (!$exists) {
    json_response([
      "ok" => false,
      "error" => "Relación de jerarquía no encontrada"
    ], 404);
  }

  $usuario_padre_actual = (int)$exists['usuario_padre_id'];
  $usuario_hijo_actual = (int)$exists['usuario_hijo_id'];

  $usuario_padre_id = array_key_exists('usuario_padre_id', $in)
    ? (int)$in['usuario_padre_id']
    : $usuario_padre_actual;

  $usuario_hijo_id = array_key_exists('usuario_hijo_id', $in)
    ? (int)$in['usuario_hijo_id']
    : $usuario_hijo_actual;

  if ($usuario_padre_id <= 0) {
    json_response([
      "ok" => false,
      "error" => "usuario_padre_id inválido"
    ], 400);
  }

  if ($usuario_hijo_id <= 0) {
    json_response([
      "ok" => false,
      "error" => "usuario_hijo_id inválido"
    ], 400);
  }

  if ($usuario_padre_id === $usuario_hijo_id) {
    json_response([
      "ok" => false,
      "error" => "El usuario padre y el usuario hijo no pueden ser el mismo"
    ], 400);
  }

  if (array_key_exists('usuario_padre_id', $in)) {
    validar_usuario_existe($con, $usuario_padre_id, "Usuario padre");
  }

  if (array_key_exists('usuario_hijo_id', $in)) {
    validar_usuario_existe($con, $usuario_hijo_id, "Usuario hijo");
  }

  /*
    Si cambia padre o hijo, validamos que no choque con el UNIQUE:
    uq_usuario_jerarquia(usuario_padre_id, usuario_hijo_id)
  */

  if (
    $usuario_padre_id !== $usuario_padre_actual ||
    $usuario_hijo_id !== $usuario_hijo_actual
  ) {
    $dup = $con->prepare("
      SELECT usuario_jerarquia_id
      FROM usuario_jerarquia
      WHERE usuario_padre_id = ?
        AND usuario_hijo_id = ?
        AND usuario_jerarquia_id <> ?
      LIMIT 1
    ");

    $dup->bind_param("iii", $usuario_padre_id, $usuario_hijo_id, $usuario_jerarquia_id);
    $dup->execute();

    $duplicate = $dup->get_result()->fetch_assoc();
    $dup->close();

    if ($duplicate) {
      json_response([
        "ok" => false,
        "error" => "Ya existe una relación de jerarquía con ese usuario padre e hijo",
        "duplicate_field" => "usuario_padre_id_usuario_hijo_id",
        "existing_id" => (int)$duplicate['usuario_jerarquia_id']
      ], 409);
    }
  }

  $map = [
    "usuario_padre_id" => "i",
    "usuario_hijo_id" => "i",
    "fecha_inicio" => "s",
    "fecha_fin" => "s",
    "activo" => "i"
  ];

  $set = [];
  $params = [];
  $types = "";

  foreach ($map as $field => $type) {
    if (!array_key_exists($field, $in)) {
      continue;
    }

    $set[] = "$field = ?";

    if ($field === 'activo') {
      $params[] = ((int)$in[$field]) === 1 ? 1 : 0;
    } else {
      $params[] = value_or_null($in, $field);
    }

    $types .= $type;
  }

  if (isset($in['updated_by']) && (int)$in['updated_by'] > 0) {
    $set[] = "updated_by = ?";
    $params[] = (int)$in['updated_by'];
    $types .= "i";
  }

  /*
    Regla práctica:
    Si mandan activo = 0 y no mandan fecha_fin, cerramos la relación con fecha actual.
  */

  if (
    array_key_exists('activo', $in) &&
    ((int)$in['activo']) === 0 &&
    !array_key_exists('fecha_fin', $in)
  ) {
    $set[] = "fecha_fin = ?";
    $params[] = date('Y-m-d');
    $types .= "s";
  }

  /*
    Si mandan activo = 1 y no mandan fecha_fin, limpiamos fecha_fin para reabrir relación.
  */

  if (
    array_key_exists('activo', $in) &&
    ((int)$in['activo']) === 1 &&
    !array_key_exists('fecha_fin', $in)
  ) {
    $set[] = "fecha_fin = NULL";
  }

  if (empty($set)) {
    json_response([
      "ok" => false,
      "error" => "No hay campos para actualizar"
    ], 400);
  }

  $params[] = $usuario_jerarquia_id;
  $types .= "i";

  $sql = "
    UPDATE usuario_jerarquia
    SET " . implode(", ", $set) . "
    WHERE usuario_jerarquia_id = ?
  ";

  $st = $con->prepare($sql);
  bind_dynamic($st, $types, $params);
  $st->execute();
  $st->close();

  return obtener_jerarquia($con, $usuario_jerarquia_id);
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
    $data = actualizar_usuario_jerarquia($con, $in);
    $con->commit();
  } catch (Throwable $e) {
    $con->rollback();
    throw $e;
  }

  $con->close();

  json_response([
    "ok" => true,
    "message" => "Relación de jerarquía actualizada correctamente",
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

  error_log('[IXTLA_U_USUARIO_JERARQUIA][SQL] ' . $msg);

  if ($code === 1062) {
    json_response([
      "ok" => false,
      "error" => "Ya existe una relación de jerarquía con ese usuario padre e hijo",
      "duplicate_field" => "usuario_padre_id_usuario_hijo_id"
    ], 409);
  }

  if ($code === 1452) {
    json_response([
      "ok" => false,
      "error" => "No se pudo actualizar la relación porque uno de los usuarios no existe"
    ], 400);
  }

  if ($code === 3819 || stripos($msg, 'chk_jerarquia_no_mismo_usuario') !== false) {
    json_response([
      "ok" => false,
      "error" => "El usuario padre y el usuario hijo no pueden ser el mismo"
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

  error_log('[IXTLA_U_USUARIO_JERARQUIA][ERR] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error interno del servidor"
  ], 500);
}
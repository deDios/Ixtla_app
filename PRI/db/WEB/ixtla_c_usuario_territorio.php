<?php
// db/WEB/ixtla_c_usuario_territorio.php

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
  error_log('[IXTLA_C_USUARIO_TERRITORIO] ' . $message);

  json_response([
    "ok" => false,
    "error" => "Error interno del servidor"
  ], 500);
}

function read_json_body(): array
{
  $raw = file_get_contents("php://input");

  if (!$raw || trim($raw) === '') {
    return [];
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

function str_clean(array $in, string $key): string
{
  return isset($in[$key]) ? trim((string)$in[$key]) : '';
}

function int_or_null(array $in, string $key): ?int
{
  if (!isset($in[$key]) || $in[$key] === '') {
    return null;
  }

  $value = (int)$in[$key];

  return $value > 0 ? $value : null;
}

function nullable_int_from_row(array $row, string $key): ?int
{
  return isset($row[$key]) && $row[$key] !== null ? (int)$row[$key] : null;
}

/* ============================================================
   FORMATTER
   ============================================================ */

function usuario_territorio_row(array $row): array
{
  return [
    "usuario_territorio_id" => (int)$row['usuario_territorio_id'],
    "usuario_id" => (int)$row['usuario_id'],
    "territorio_id" => (int)$row['territorio_id'],

    "usuario" => [
      "usuario_id" => (int)$row['usuario_id'],
      "username" => $row['username'],
      "nombre" => $row['usuario_nombre'],
      "apellido_paterno" => $row['usuario_apellido_paterno'],
      "apellido_materno" => $row['usuario_apellido_materno'],
      "nombre_completo" => trim(
        (string)$row['usuario_nombre'] . ' ' .
          (string)$row['usuario_apellido_paterno'] . ' ' .
          (string)$row['usuario_apellido_materno']
      ),
      "email" => $row['usuario_email'],
      "rol" => [
        "codigo" => $row['rol_codigo'],
        "nombre" => $row['rol_nombre']
      ]
    ],

    "territorio" => [
      "territorio_id" => (int)$row['territorio_id'],
      "territorio_padre_id" => nullable_int_from_row($row, 'territorio_padre_id'),
      "tipo" => $row['territorio_tipo'],
      "codigo" => $row['territorio_codigo'],
      "nombre" => $row['territorio_nombre'],
      "municipio" => $row['territorio_municipio'],
      "estado" => $row['territorio_estado'],
      "distrito_local" => $row['territorio_distrito_local'],
      "distrito_federal" => $row['territorio_distrito_federal'],
      "zona" => [
        "territorio_id" => nullable_int_from_row($row, 'zona_id'),
        "codigo" => $row['zona_codigo'],
        "nombre" => $row['zona_nombre']
      ]
    ],

    "fecha_inicio" => $row['fecha_inicio'],
    "fecha_fin" => $row['fecha_fin'],
    "activo" => (int)$row['activo'],

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
            ut.*,

            u.username,
            u.nombre AS usuario_nombre,
            u.apellido_paterno AS usuario_apellido_paterno,
            u.apellido_materno AS usuario_apellido_materno,
            u.email AS usuario_email,

            r.codigo AS rol_codigo,
            r.nombre AS rol_nombre,

            t.territorio_padre_id,
            t.tipo AS territorio_tipo,
            t.codigo AS territorio_codigo,
            t.nombre AS territorio_nombre,
            t.municipio AS territorio_municipio,
            t.estado AS territorio_estado,
            t.distrito_local AS territorio_distrito_local,
            t.distrito_federal AS territorio_distrito_federal,

            z.territorio_id AS zona_id,
            z.codigo AS zona_codigo,
            z.nombre AS zona_nombre

        FROM usuario_territorio ut

        INNER JOIN usuario u
            ON u.usuario_id = ut.usuario_id
           AND u.deleted_at IS NULL

        INNER JOIN cat_rol r
            ON r.rol_id = u.rol_id

        INNER JOIN territorio t
            ON t.territorio_id = ut.territorio_id
           AND t.deleted_at IS NULL

        LEFT JOIN territorio z
            ON z.territorio_id = t.territorio_padre_id
           AND z.deleted_at IS NULL
    ";
}

function base_count(): string
{
  return "
        FROM usuario_territorio ut

        INNER JOIN usuario u
            ON u.usuario_id = ut.usuario_id
           AND u.deleted_at IS NULL

        INNER JOIN cat_rol r
            ON r.rol_id = u.rol_id

        INNER JOIN territorio t
            ON t.territorio_id = ut.territorio_id
           AND t.deleted_at IS NULL

        LEFT JOIN territorio z
            ON z.territorio_id = t.territorio_padre_id
           AND z.deleted_at IS NULL
    ";
}

/* ============================================================
   CONSULTAS
   ============================================================ */

function consultar_usuario_territorio_por_id(mysqli $con, int $usuario_territorio_id): array
{
  $sql = base_select() . "
        WHERE ut.usuario_territorio_id = ?
        LIMIT 1
    ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $usuario_territorio_id);
  $st->execute();

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    json_response([
      "ok" => false,
      "error" => "Relación usuario-territorio no encontrada"
    ], 404);
  }

  return usuario_territorio_row($row);
}

function consultar_usuario_territorios(mysqli $con, array $in): array
{
  $usuario_id = int_or_null($in, 'usuario_id');
  $territorio_id = int_or_null($in, 'territorio_id');

  $tipo_territorio = strtoupper(str_clean($in, 'tipo_territorio'));

  $q = str_clean($in, 'q');

  if ($q === '') {
    $q = str_clean($in, 'search');
  }

  $activo = null;

  if (array_key_exists('activo', $in) && $in['activo'] !== '') {
    $activo = (int)$in['activo'];
    $activo = $activo === 1 ? 1 : 0;
  }

  $solo_vigentes = !empty($in['solo_vigentes']);

  $page = isset($in['page']) ? max(1, (int)$in['page']) : 1;

  $pageSize = 50;

  if (isset($in['page_size'])) {
    $pageSize = (int)$in['page_size'];
  } elseif (isset($in['limit'])) {
    $pageSize = (int)$in['limit'];
  }

  $pageSize = max(1, min(500, $pageSize));
  $offset = ($page - 1) * $pageSize;

  $where = ["1 = 1"];
  $params = [];
  $types = "";

  if ($usuario_id !== null) {
    $where[] = "ut.usuario_id = ?";
    $params[] = $usuario_id;
    $types .= "i";
  }

  if ($territorio_id !== null) {
    $where[] = "ut.territorio_id = ?";
    $params[] = $territorio_id;
    $types .= "i";
  }

  if ($tipo_territorio !== '') {
    if (!in_array($tipo_territorio, ['ZONA', 'SECCION'], true)) {
      json_response([
        "ok" => false,
        "error" => "tipo_territorio inválido. Usa ZONA o SECCION"
      ], 400);
    }

    $where[] = "t.tipo = ?";
    $params[] = $tipo_territorio;
    $types .= "s";
  }

  if ($activo !== null) {
    $where[] = "ut.activo = ?";
    $params[] = $activo;
    $types .= "i";
  }

  if ($solo_vigentes) {
    $where[] = "ut.activo = 1";
    $where[] = "ut.fecha_fin IS NULL";
  }

  if ($q !== '') {
    $like = "%$q%";

    $where[] = "(
            u.username LIKE ?
            OR u.nombre LIKE ?
            OR u.apellido_paterno LIKE ?
            OR u.apellido_materno LIKE ?
            OR CONCAT_WS(' ', u.nombre, u.apellido_paterno, u.apellido_materno) LIKE ?
            OR u.email LIKE ?
            OR r.codigo LIKE ?
            OR r.nombre LIKE ?

            OR t.codigo LIKE ?
            OR t.nombre LIKE ?
            OR t.municipio LIKE ?
            OR t.estado LIKE ?
            OR t.distrito_local LIKE ?
            OR t.distrito_federal LIKE ?

            OR z.codigo LIKE ?
            OR z.nombre LIKE ?
        )";

    for ($i = 0; $i < 16; $i++) {
      $params[] = $like;
      $types .= "s";
    }
  }

  $whereSql = implode(" AND ", $where);

  $countSql = "
        SELECT COUNT(*) AS total
        " . base_count() . "
        WHERE $whereSql
    ";

  $countParams = $params;
  $countTypes = $types;

  $stCount = $con->prepare($countSql);

  if ($countTypes !== '') {
    bind_dynamic($stCount, $countTypes, $countParams);
  }

  $stCount->execute();
  $totalRow = $stCount->get_result()->fetch_assoc();
  $stCount->close();

  $total = (int)($totalRow['total'] ?? 0);

  $sql = base_select() . "
        WHERE $whereSql
        ORDER BY
            ut.activo DESC,
            ut.fecha_inicio DESC,
            ut.usuario_territorio_id DESC
        LIMIT ? OFFSET ?
    ";

  $listParams = $params;
  $listTypes = $types . "ii";

  $listParams[] = $pageSize;
  $listParams[] = $offset;

  $st = $con->prepare($sql);
  bind_dynamic($st, $listTypes, $listParams);
  $st->execute();

  $rs = $st->get_result();

  $data = [];

  while ($row = $rs->fetch_assoc()) {
    $data[] = usuario_territorio_row($row);
  }

  $st->close();

  return [
    "meta" => [
      "page" => $page,
      "page_size" => $pageSize,
      "total" => $total,
      "total_pages" => $pageSize > 0 ? (int)ceil($total / $pageSize) : 0
    ],
    "data" => $data
  ];
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

  $usuario_territorio_id = null;

  if (isset($in['usuario_territorio_id'])) {
    $usuario_territorio_id = (int)$in['usuario_territorio_id'];
  } elseif (isset($in['id'])) {
    $usuario_territorio_id = (int)$in['id'];
  }

  $con = db();

  if ($usuario_territorio_id && $usuario_territorio_id > 0) {
    $data = consultar_usuario_territorio_por_id($con, $usuario_territorio_id);

    $con->close();

    json_response([
      "ok" => true,
      "data" => $data
    ]);
  }

  $result = consultar_usuario_territorios($con, $in);

  $con->close();

  json_response([
    "ok" => true,
    "meta" => $result["meta"],
    "data" => $result["data"]
  ]);
} catch (mysqli_sql_exception $e) {
  if (isset($con) && $con instanceof mysqli) {
    try {
      $con->close();
    } catch (Throwable $ignored) {
    }
  }

  error_log('[IXTLA_C_USUARIO_TERRITORIO][SQL] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error al consultar relación usuario-territorio"
  ], 500);
} catch (Throwable $e) {
  if (isset($con) && $con instanceof mysqli) {
    try {
      $con->close();
    } catch (Throwable $ignored) {
    }
  }

  error_log('[IXTLA_C_USUARIO_TERRITORIO][ERROR] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error interno del servidor"
  ], 500);
}

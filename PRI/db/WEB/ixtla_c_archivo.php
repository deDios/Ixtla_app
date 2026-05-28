<?php
// db/WEB/ixtla_c_archivo.php

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
  error_log('[IXTLA_C_ARCHIVO] ' . $message);

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

function bool_filter_or_null(array $in, string $key): ?int
{
  if (!array_key_exists($key, $in) || $in[$key] === '') {
    return null;
  }

  return ((int)$in[$key]) === 1 ? 1 : 0;
}

/* ============================================================
   FORMATTER
   ============================================================ */

function archivo_row(array $row): array
{
  return [
    "archivo_id" => (int)$row['archivo_id'],
    "uuid" => $row['uuid'],

    "entidad_tipo" => $row['entidad_tipo'],
    "entidad_id" => (int)$row['entidad_id'],
    "uso_archivo" => $row['uso_archivo'],

    "nombre_original" => $row['nombre_original'],
    "nombre_storage" => $row['nombre_storage'],
    "url_archivo" => $row['url_archivo'],
    "url_thumbnail" => $row['url_thumbnail'],

    "mime_type" => $row['mime_type'],
    "extension" => $row['extension'],
    "tamano_bytes" => nullable_int_from_row($row, 'tamano_bytes'),
    "sha256_hash" => $row['sha256_hash'],

    "version_no" => (int)$row['version_no'],
    "es_actual" => (int)$row['es_actual'],
    "reemplaza_archivo_id" => nullable_int_from_row($row, 'reemplaza_archivo_id'),
    "privado" => (int)$row['privado'],

    "uploaded_by" => nullable_int_from_row($row, 'uploaded_by'),
    "uploaded_by_usuario" => [
      "usuario_id" => nullable_int_from_row($row, 'uploaded_by'),
      "username" => $row['uploaded_by_username'],
      "nombre" => $row['uploaded_by_nombre'],
      "apellido_paterno" => $row['uploaded_by_apellido_paterno'],
      "apellido_materno" => $row['uploaded_by_apellido_materno'],
      "nombre_completo" => trim(
        (string)$row['uploaded_by_nombre'] . ' ' .
          (string)$row['uploaded_by_apellido_paterno'] . ' ' .
          (string)$row['uploaded_by_apellido_materno']
      )
    ],

    "uploaded_at" => $row['uploaded_at'],
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
            a.*,

            u.username AS uploaded_by_username,
            u.nombre AS uploaded_by_nombre,
            u.apellido_paterno AS uploaded_by_apellido_paterno,
            u.apellido_materno AS uploaded_by_apellido_materno

        FROM archivo a

        LEFT JOIN usuario u
            ON u.usuario_id = a.uploaded_by
           AND u.deleted_at IS NULL
    ";
}

function base_count(): string
{
  return "
        FROM archivo a

        LEFT JOIN usuario u
            ON u.usuario_id = a.uploaded_by
           AND u.deleted_at IS NULL
    ";
}

/* ============================================================
   CONSULTAS
   ============================================================ */

function consultar_archivo_por_id(mysqli $con, int $archivo_id): array
{
  $sql = base_select() . "
        WHERE a.archivo_id = ?
          AND a.deleted_at IS NULL
        LIMIT 1
    ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $archivo_id);
  $st->execute();

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    json_response([
      "ok" => false,
      "error" => "Archivo no encontrado"
    ], 404);
  }

  return archivo_row($row);
}

function consultar_archivo_por_uuid(mysqli $con, string $uuid): array
{
  $sql = base_select() . "
        WHERE a.uuid = ?
          AND a.deleted_at IS NULL
        LIMIT 1
    ";

  $st = $con->prepare($sql);
  $st->bind_param("s", $uuid);
  $st->execute();

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    json_response([
      "ok" => false,
      "error" => "Archivo no encontrado"
    ], 404);
  }

  return archivo_row($row);
}

function consultar_archivos(mysqli $con, array $in): array
{
  $entidad_tipo = str_clean($in, 'entidad_tipo');
  $uso_archivo = str_clean($in, 'uso_archivo');
  $sha256_hash = str_clean($in, 'sha256_hash');

  $entidad_id = int_or_null($in, 'entidad_id');
  $uploaded_by = int_or_null($in, 'uploaded_by');

  $es_actual = bool_filter_or_null($in, 'es_actual');
  $privado = bool_filter_or_null($in, 'privado');

  $q = str_clean($in, 'q');

  if ($q === '') {
    $q = str_clean($in, 'search');
  }

  $page = isset($in['page']) ? max(1, (int)$in['page']) : 1;

  $pageSize = 50;

  if (isset($in['page_size'])) {
    $pageSize = (int)$in['page_size'];
  } elseif (isset($in['limit'])) {
    $pageSize = (int)$in['limit'];
  }

  $pageSize = max(1, min(500, $pageSize));
  $offset = ($page - 1) * $pageSize;

  $where = [
    "a.deleted_at IS NULL"
  ];

  $params = [];
  $types = "";

  if ($entidad_tipo !== '') {
    $where[] = "a.entidad_tipo = ?";
    $params[] = $entidad_tipo;
    $types .= "s";
  }

  if ($entidad_id !== null) {
    $where[] = "a.entidad_id = ?";
    $params[] = $entidad_id;
    $types .= "i";
  }

  if ($uso_archivo !== '') {
    $where[] = "a.uso_archivo = ?";
    $params[] = $uso_archivo;
    $types .= "s";
  }

  if ($es_actual !== null) {
    $where[] = "a.es_actual = ?";
    $params[] = $es_actual;
    $types .= "i";
  }

  if ($privado !== null) {
    $where[] = "a.privado = ?";
    $params[] = $privado;
    $types .= "i";
  }

  if ($uploaded_by !== null) {
    $where[] = "a.uploaded_by = ?";
    $params[] = $uploaded_by;
    $types .= "i";
  }

  if ($sha256_hash !== '') {
    $where[] = "a.sha256_hash = ?";
    $params[] = $sha256_hash;
    $types .= "s";
  }

  if ($q !== '') {
    $like = "%$q%";

    $where[] = "(
            a.nombre_original LIKE ?
            OR a.nombre_storage LIKE ?
            OR a.url_archivo LIKE ?
            OR a.url_thumbnail LIKE ?
            OR a.mime_type LIKE ?
            OR a.extension LIKE ?
            OR a.entidad_tipo LIKE ?
            OR a.uso_archivo LIKE ?
            OR u.username LIKE ?
            OR u.nombre LIKE ?
            OR u.apellido_paterno LIKE ?
            OR u.apellido_materno LIKE ?
            OR CONCAT_WS(' ', u.nombre, u.apellido_paterno, u.apellido_materno) LIKE ?
        )";

    for ($i = 0; $i < 13; $i++) {
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
            a.uploaded_at DESC,
            a.archivo_id DESC
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
    $data[] = archivo_row($row);
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

  $archivo_id = null;

  if (isset($in['archivo_id'])) {
    $archivo_id = (int)$in['archivo_id'];
  } elseif (isset($in['id'])) {
    $archivo_id = (int)$in['id'];
  }

  $uuid = str_clean($in, 'uuid');

  $con = db();

  if ($archivo_id && $archivo_id > 0) {
    $data = consultar_archivo_por_id($con, $archivo_id);

    $con->close();

    json_response([
      "ok" => true,
      "data" => $data
    ]);
  }

  if ($uuid !== '') {
    $data = consultar_archivo_por_uuid($con, $uuid);

    $con->close();

    json_response([
      "ok" => true,
      "data" => $data
    ]);
  }

  $result = consultar_archivos($con, $in);

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

  error_log('[IXTLA_C_ARCHIVO][SQL] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error al consultar archivos"
  ], 500);
} catch (Throwable $e) {
  if (isset($con) && $con instanceof mysqli) {
    try {
      $con->close();
    } catch (Throwable $ignored) {
    }
  }

  error_log('[IXTLA_C_ARCHIVO][ERROR] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error interno del servidor"
  ], 500);
}
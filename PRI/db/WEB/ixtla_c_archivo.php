<?php
// db\WEB\ixtla_c_archivo.php

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

$archivo_id = isset($in['archivo_id']) ? (int)$in['archivo_id'] : (isset($in['id']) ? (int)$in['id'] : null);
$uuid = isset($in['uuid']) ? trim((string)$in['uuid']) : '';

$entidad_tipo = isset($in['entidad_tipo']) ? trim((string)$in['entidad_tipo']) : '';
$entidad_id = isset($in['entidad_id']) ? (int)$in['entidad_id'] : null;
$uso_archivo = isset($in['uso_archivo']) ? trim((string)$in['uso_archivo']) : '';

$es_actual = array_key_exists('es_actual', $in) ? (int)$in['es_actual'] : null;
$privado = array_key_exists('privado', $in) ? (int)$in['privado'] : null;
$uploaded_by = isset($in['uploaded_by']) ? (int)$in['uploaded_by'] : null;
$sha256_hash = isset($in['sha256_hash']) ? trim((string)$in['sha256_hash']) : '';
$q = isset($in['q']) ? trim((string)$in['q']) : '';

$page = isset($in['page']) ? max(1, (int)$in['page']) : 1;
$pageSize = isset($in['page_size']) ? max(1, min(500, (int)$in['page_size'])) : 50;
$offset = ($page - 1) * $pageSize;

$con = conectar();
if (!$con) {
  http_response_code(500);
  die(json_encode(["ok" => false, "error" => "No se pudo conectar a la base de datos"], JSON_UNESCAPED_UNICODE));
}

$con->set_charset('utf8mb4');

function bind_dynamic(mysqli_stmt $st, string $types, array &$params): void {
  $refs = [];
  $refs[] = $types;

  foreach ($params as $k => &$v) {
    $refs[] = &$v;
  }

  call_user_func_array([$st, 'bind_param'], $refs);
}

function archivo_row(array $row): array {
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
    "tamano_bytes" => isset($row['tamano_bytes']) ? (int)$row['tamano_bytes'] : null,
    "sha256_hash" => $row['sha256_hash'],

    "version_no" => (int)$row['version_no'],
    "es_actual" => (int)$row['es_actual'],
    "reemplaza_archivo_id" => isset($row['reemplaza_archivo_id']) ? (int)$row['reemplaza_archivo_id'] : null,
    "privado" => (int)$row['privado'],

    "uploaded_by" => isset($row['uploaded_by']) ? (int)$row['uploaded_by'] : null,
    "uploaded_by_usuario" => [
      "username" => $row['uploaded_by_username'] ?? null,
      "nombre" => $row['uploaded_by_nombre'] ?? null,
      "apellido_paterno" => $row['uploaded_by_apellido_paterno'] ?? null,
      "apellido_materno" => $row['uploaded_by_apellido_materno'] ?? null
    ],

    "uploaded_at" => $row['uploaded_at'],
    "updated_at" => $row['updated_at'],
    "updated_by" => isset($row['updated_by']) ? (int)$row['updated_by'] : null
  ];
}

$baseSelect = "
  SELECT
    a.*,
    u.username AS uploaded_by_username,
    u.nombre AS uploaded_by_nombre,
    u.apellido_paterno AS uploaded_by_apellido_paterno,
    u.apellido_materno AS uploaded_by_apellido_materno
  FROM archivo a
  LEFT JOIN usuario u
    ON u.usuario_id = a.uploaded_by
";

if ($archivo_id && $archivo_id > 0) {
  $sql = $baseSelect . "
    WHERE a.archivo_id = ?
      AND a.deleted_at IS NULL
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $archivo_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();
  $con->close();

  if (!$row) {
    http_response_code(404);
    die(json_encode(["ok" => false, "error" => "Archivo no encontrado"], JSON_UNESCAPED_UNICODE));
  }

  echo json_encode(["ok" => true, "data" => archivo_row($row)], JSON_UNESCAPED_UNICODE);
  exit;
}

if ($uuid !== '') {
  $sql = $baseSelect . "
    WHERE a.uuid = ?
      AND a.deleted_at IS NULL
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("s", $uuid);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();
  $con->close();

  if (!$row) {
    http_response_code(404);
    die(json_encode(["ok" => false, "error" => "Archivo no encontrado"], JSON_UNESCAPED_UNICODE));
  }

  echo json_encode(["ok" => true, "data" => archivo_row($row)], JSON_UNESCAPED_UNICODE);
  exit;
}

$where = ["a.deleted_at IS NULL"];
$types = "";
$params = [];

if ($entidad_tipo !== '') {
  $where[] = "a.entidad_tipo = ?";
  $types .= "s";
  $params[] = $entidad_tipo;
}

if ($entidad_id !== null && $entidad_id > 0) {
  $where[] = "a.entidad_id = ?";
  $types .= "i";
  $params[] = $entidad_id;
}

if ($uso_archivo !== '') {
  $where[] = "a.uso_archivo = ?";
  $types .= "s";
  $params[] = $uso_archivo;
}

if ($es_actual !== null) {
  $where[] = "a.es_actual = ?";
  $types .= "i";
  $params[] = $es_actual;
}

if ($privado !== null) {
  $where[] = "a.privado = ?";
  $types .= "i";
  $params[] = $privado;
}

if ($uploaded_by !== null && $uploaded_by > 0) {
  $where[] = "a.uploaded_by = ?";
  $types .= "i";
  $params[] = $uploaded_by;
}

if ($sha256_hash !== '') {
  $where[] = "a.sha256_hash = ?";
  $types .= "s";
  $params[] = $sha256_hash;
}

if ($q !== '') {
  $like = "%$q%";
  $where[] = "(
    a.nombre_original LIKE ?
    OR a.nombre_storage LIKE ?
    OR a.url_archivo LIKE ?
    OR a.mime_type LIKE ?
    OR a.extension LIKE ?
  )";

  for ($i = 0; $i < 5; $i++) {
    $types .= "s";
    $params[] = $like;
  }
}

$sql = "
  $baseSelect
  WHERE " . implode(" AND ", $where) . "
  ORDER BY a.uploaded_at DESC, a.archivo_id DESC
  LIMIT ? OFFSET ?
";

$types .= "ii";
$params[] = $pageSize;
$params[] = $offset;

$st = $con->prepare($sql);
bind_dynamic($st, $types, $params);
$st->execute();
$rs = $st->get_result();

$data = [];
while ($row = $rs->fetch_assoc()) {
  $data[] = archivo_row($row);
}

$st->close();

$countSql = "
  SELECT COUNT(*) AS total
  FROM archivo a
  WHERE " . implode(" AND ", $where) . "
";

$countParams = $params;
array_pop($countParams);
array_pop($countParams);

$countTypes = substr($types, 0, -2);

$st = $con->prepare($countSql);

if ($countTypes !== '') {
  bind_dynamic($st, $countTypes, $countParams);
}

$st->execute();
$totalRow = $st->get_result()->fetch_assoc();
$total = (int)$totalRow['total'];
$st->close();

$con->close();

echo json_encode([
  "ok" => true,
  "meta" => [
    "page" => $page,
    "page_size" => $pageSize,
    "total" => $total
  ],
  "data" => $data
], JSON_UNESCAPED_UNICODE);
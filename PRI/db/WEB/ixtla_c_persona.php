<?php
// db/WEB/ixtla_c_persona.php

declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
date_default_timezone_set('America/Mexico_City');

/* ============================================================
   CONFIG
   ============================================================ */

$DATA_SECRET = getenv('IXTLA_DATA_SECRET')
  ?: getenv('IXTLA_JWT_SECRET')
  ?: 'c6028c94e5ab1473f2dc40a327cd2faf5041afa364155b9778f4353a35b6f973b1b526619f9c1dbb561926df1fa0de68e97f297206c36ced85b8a39388112343';

if (strlen($DATA_SECRET) < 64) {
  http_response_code(500);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode([
    "ok" => false,
    "error" => "Configuración de seguridad incompleta"
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

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
  error_log('[IXTLA_C_PERSONA] ' . $message);

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

function bind_params(mysqli_stmt $stmt, string $types, array &$params): void
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

function int_or_null(array $in, string $key): ?int
{
  if (!isset($in[$key]) || $in[$key] === '') {
    return null;
  }

  $value = (int)$in[$key];

  return $value > 0 ? $value : null;
}

function str_clean(array $in, string $key): string
{
  return isset($in[$key]) ? trim((string)$in[$key]) : '';
}

function sensitive_decrypt(mixed $encoded, string $secret): ?string
{
  if ($encoded === null || $encoded === '') {
    return null;
  }

  $raw = base64_decode((string)$encoded, true);

  if ($raw === false || strlen($raw) < 29) {
    return null;
  }

  $key = hash('sha256', $secret, true);

  $iv = substr($raw, 0, 12);
  $tag = substr($raw, 12, 16);
  $cipher = substr($raw, 28);

  $plain = openssl_decrypt(
    $cipher,
    'aes-256-gcm',
    $key,
    OPENSSL_RAW_DATA,
    $iv,
    $tag
  );

  return $plain === false ? null : $plain;
}

/* ============================================================
   FORMATTER
   ============================================================ */

function persona_row(array $row): array
{
  global $DATA_SECRET;

  $curp = sensitive_decrypt($row['curp_enc'] ?? null, $DATA_SECRET);
  $clave_elector = sensitive_decrypt($row['clave_elector_enc'] ?? null, $DATA_SECRET);

  return [
    "persona_id" => (int)$row['persona_id'],
    "uuid" => $row['uuid'],

    "nombres" => $row['nombres'],
    "apellido_paterno" => $row['apellido_paterno'],
    "apellido_materno" => $row['apellido_materno'],
    "nombre_completo" => trim(
      (string)$row['nombres'] . ' ' .
        (string)$row['apellido_paterno'] . ' ' .
        (string)$row['apellido_materno']
    ),

    "fecha_nacimiento" => $row['fecha_nacimiento'],
    "sexo" => $row['sexo'],

    "curp" => $curp,
    "clave_elector" => $clave_elector,

    "curp_hash" => $row['curp_hash'],
    "clave_elector_hash" => $row['clave_elector_hash'],
    "ocr_hash" => $row['ocr_hash'],
    "cic_hash" => $row['cic_hash'],
    "idmex_hash" => $row['idmex_hash'],

    "seccion_id" => isset($row['seccion_id']) ? (int)$row['seccion_id'] : null,
    "anio_registro" => isset($row['anio_registro']) ? (int)$row['anio_registro'] : null,
    "emision" => isset($row['emision']) ? (int)$row['emision'] : null,
    "vigencia_inicio" => $row['vigencia_inicio'],
    "vigencia_fin" => $row['vigencia_fin'],

    "domicilio_texto" => $row['domicilio_texto'],
    "calle" => $row['calle'],
    "numero_exterior" => $row['numero_exterior'],
    "numero_interior" => $row['numero_interior'],
    "colonia" => $row['colonia'],
    "localidad" => $row['localidad'],
    "municipio" => $row['municipio'],
    "estado" => $row['estado'],
    "codigo_postal" => $row['codigo_postal'],

    "telefono" => $row['telefono'],
    "whatsapp" => $row['whatsapp'],
    "email" => $row['email'],

    "acepta_tratamiento_datos" => isset($row['acepta_tratamiento_datos'])
      ? (int)$row['acepta_tratamiento_datos']
      : 0,

    "acepta_datos_sensibles" => isset($row['acepta_datos_sensibles'])
      ? (int)$row['acepta_datos_sensibles']
      : 0,

    "acepta_contacto_whatsapp" => isset($row['acepta_contacto_whatsapp'])
      ? (int)$row['acepta_contacto_whatsapp']
      : 0,

    "aviso_privacidad_version" => $row['aviso_privacidad_version'],
    "fecha_consentimiento" => $row['fecha_consentimiento'],

    "estatus_id" => isset($row['estatus_id']) ? (int)$row['estatus_id'] : null,
    "estatus" => [
      "codigo" => $row['estatus_codigo'],
      "nombre" => $row['estatus_nombre']
    ],

    "territorio" => [
      "seccion" => [
        "territorio_id" => isset($row['seccion_territorio_id'])
          ? (int)$row['seccion_territorio_id']
          : null,
        "codigo" => $row['seccion_codigo'],
        "nombre" => $row['seccion_nombre'],
        "tipo" => $row['seccion_tipo']
      ],
      "zona" => [
        "territorio_id" => isset($row['zona_id'])
          ? (int)$row['zona_id']
          : null,
        "codigo" => $row['zona_codigo'],
        "nombre" => $row['zona_nombre']
      ]
    ],

    "capturado_por" => isset($row['capturado_por'])
      ? (int)$row['capturado_por']
      : null,

    "fecha_captura" => $row['fecha_captura'],
    "observaciones" => $row['observaciones'],

    "created_at" => $row['created_at'],
    "created_by" => isset($row['created_by']) ? (int)$row['created_by'] : null,
    "updated_at" => $row['updated_at'],
    "updated_by" => isset($row['updated_by']) ? (int)$row['updated_by'] : null
  ];
}

/* ============================================================
   SQL BASE
   ============================================================ */

function base_select(): string
{
  return "
    SELECT
      p.*,

      e.codigo AS estatus_codigo,
      e.nombre AS estatus_nombre,

      s.territorio_id AS seccion_territorio_id,
      s.codigo AS seccion_codigo,
      s.nombre AS seccion_nombre,
      s.tipo AS seccion_tipo,

      z.territorio_id AS zona_id,
      z.codigo AS zona_codigo,
      z.nombre AS zona_nombre

    FROM persona p

    INNER JOIN cat_estatus e
      ON e.estatus_id = p.estatus_id

    LEFT JOIN territorio s
      ON s.territorio_id = p.seccion_id
     AND s.deleted_at IS NULL

    LEFT JOIN territorio z
      ON z.territorio_id = s.territorio_padre_id
     AND z.deleted_at IS NULL
  ";
}

/* ============================================================
   CONSULTAS
   ============================================================ */

function consultar_persona_por_id(mysqli $con, int $persona_id, ?int $capturado_por = null): array
{
  $where = [
    "p.persona_id = ?",
    "p.deleted_at IS NULL"
  ];

  $params = [$persona_id];
  $types = "i";

  if ($capturado_por !== null) {
    $where[] = "p.capturado_por = ?";
    $params[] = $capturado_por;
    $types .= "i";
  }

  $whereSql = implode(" AND ", $where);

  $sql = base_select() . "
    WHERE $whereSql
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  bind_params($st, $types, $params);
  $st->execute();

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    json_response([
      "ok" => false,
      "error" => "Persona no encontrada"
    ], 404);
  }

  return persona_row($row);
}

function consultar_personas(mysqli $con, array $in): array
{
  $q = str_clean($in, 'q');

  if ($q === '') {
    $q = str_clean($in, 'search');
  }

  $telefono = str_clean($in, 'telefono');
  $email = str_clean($in, 'email');

  $seccion_id = int_or_null($in, 'seccion_id');
  $estatus_id = int_or_null($in, 'estatus_id');
  $capturado_por = int_or_null($in, 'capturado_por');

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
    "p.deleted_at IS NULL"
  ];

  $params = [];
  $types = "";

  if ($q !== '') {
    $like = "%$q%";

    $where[] = "(
      p.nombres LIKE ?
      OR p.apellido_paterno LIKE ?
      OR p.apellido_materno LIKE ?
      OR CONCAT_WS(' ', p.nombres, p.apellido_paterno, p.apellido_materno) LIKE ?
      OR p.email LIKE ?
      OR p.telefono LIKE ?
      OR p.whatsapp LIKE ?
      OR p.domicilio_texto LIKE ?
      OR p.colonia LIKE ?
      OR p.localidad LIKE ?
      OR p.municipio LIKE ?
      OR p.estado LIKE ?
      OR s.codigo LIKE ?
      OR s.nombre LIKE ?
      OR z.codigo LIKE ?
      OR z.nombre LIKE ?
    )";

    for ($i = 0; $i < 16; $i++) {
      $params[] = $like;
      $types .= "s";
    }
  }

  if ($seccion_id !== null) {
    $where[] = "p.seccion_id = ?";
    $params[] = $seccion_id;
    $types .= "i";
  }

  if ($estatus_id !== null) {
    $where[] = "p.estatus_id = ?";
    $params[] = $estatus_id;
    $types .= "i";
  }

  if ($capturado_por !== null) {
    $where[] = "p.capturado_por = ?";
    $params[] = $capturado_por;
    $types .= "i";
  }

  if ($telefono !== '') {
    $where[] = "(p.telefono = ? OR p.whatsapp = ?)";
    $params[] = $telefono;
    $params[] = $telefono;
    $types .= "ss";
  }

  if ($email !== '') {
    $where[] = "p.email = ?";
    $params[] = $email;
    $types .= "s";
  }

  $whereSql = implode(" AND ", $where);

  $countSql = "
    SELECT COUNT(*) AS total
    FROM persona p

    LEFT JOIN territorio s
      ON s.territorio_id = p.seccion_id
     AND s.deleted_at IS NULL

    LEFT JOIN territorio z
      ON z.territorio_id = s.territorio_padre_id
     AND z.deleted_at IS NULL

    WHERE $whereSql
  ";

  $stCount = $con->prepare($countSql);

  if ($types !== '') {
    $countParams = $params;
    bind_params($stCount, $types, $countParams);
  }

  $stCount->execute();
  $totalRow = $stCount->get_result()->fetch_assoc();
  $stCount->close();

  $total = (int)($totalRow['total'] ?? 0);

  $sql = base_select() . "
    WHERE $whereSql
    ORDER BY
      COALESCE(p.fecha_captura, p.created_at) DESC,
      p.persona_id DESC
    LIMIT ? OFFSET ?
  ";

  $listParams = $params;
  $listTypes = $types . "ii";

  $listParams[] = $pageSize;
  $listParams[] = $offset;

  $st = $con->prepare($sql);
  bind_params($st, $listTypes, $listParams);
  $st->execute();

  $rs = $st->get_result();

  $data = [];

  while ($row = $rs->fetch_assoc()) {
    $data[] = persona_row($row);
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

  $persona_id = null;

  if (isset($in['persona_id'])) {
    $persona_id = (int)$in['persona_id'];
  } elseif (isset($in['id'])) {
    $persona_id = (int)$in['id'];
  }

  $capturado_por = int_or_null($in, 'capturado_por');

  $con = db();

  if ($persona_id && $persona_id > 0) {
    $data = consultar_persona_por_id($con, $persona_id, $capturado_por);

    $con->close();

    json_response([
      "ok" => true,
      "data" => $data
    ]);
  }

  $result = consultar_personas($con, $in);

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

  error_log('[IXTLA_C_PERSONA][SQL] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error al consultar personas"
  ], 500);
} catch (Throwable $e) {
  if (isset($con) && $con instanceof mysqli) {
    try {
      $con->close();
    } catch (Throwable $ignored) {
    }
  }

  error_log('[IXTLA_C_PERSONA][ERROR] ' . $e->getMessage());

  json_response([
    "ok" => false,
    "error" => "Error interno del servidor"
  ], 500);
}

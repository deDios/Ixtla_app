<?php
// db\WEB\ixtla_i_persona_participacion.php

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

function generar_folio(string $tipo): string {
  $prefix = $tipo === 'AFILIADO' ? 'AFI' : 'SIM';
  return $prefix . '-' . date('Ymd-His') . '-' . strtoupper(bin2hex(random_bytes(3)));
}

function participacion_response(mysqli $con, int $participacion_id): array {
  $sql = "
    SELECT
      pp.*,

      e.codigo AS estatus_codigo,
      e.nombre AS estatus_nombre,

      t.codigo AS territorio_codigo,
      t.nombre AS territorio_nombre,
      t.tipo AS territorio_tipo,
      t.municipio AS territorio_municipio,
      t.estado AS territorio_estado,

      u.username AS usuario_responsable_username,
      u.nombre AS usuario_responsable_nombre,
      u.apellido_paterno AS usuario_responsable_apellido_paterno,
      u.apellido_materno AS usuario_responsable_apellido_materno,

      p.nombres AS persona_nombres,
      p.apellido_paterno AS persona_apellido_paterno,
      p.apellido_materno AS persona_apellido_materno,
      p.telefono AS persona_telefono,
      p.whatsapp AS persona_whatsapp,
      p.email AS persona_email

    FROM persona_participacion pp
    INNER JOIN persona p
      ON p.persona_id = pp.persona_id
    INNER JOIN cat_estatus e
      ON e.estatus_id = pp.estatus_id
    LEFT JOIN territorio t
      ON t.territorio_id = pp.territorio_id
    LEFT JOIN usuario u
      ON u.usuario_id = pp.usuario_responsable_id
    WHERE pp.participacion_id = ?
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  $st->bind_param("i", $participacion_id);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) {
    return [];
  }

  return [
    "participacion_id" => (int)$row['participacion_id'],
    "folio" => $row['folio'],
    "persona_id" => (int)$row['persona_id'],
    "tipo_participacion" => $row['tipo_participacion'],
    "participacion_origen_id" => isset($row['participacion_origen_id']) ? (int)$row['participacion_origen_id'] : null,

    "estatus_id" => (int)$row['estatus_id'],
    "estatus" => [
      "codigo" => $row['estatus_codigo'],
      "nombre" => $row['estatus_nombre']
    ],

    "territorio_id" => isset($row['territorio_id']) ? (int)$row['territorio_id'] : null,
    "territorio" => [
      "codigo" => $row['territorio_codigo'],
      "nombre" => $row['territorio_nombre'],
      "tipo" => $row['territorio_tipo'],
      "municipio" => $row['territorio_municipio'],
      "estado" => $row['territorio_estado']
    ],

    "usuario_responsable_id" => isset($row['usuario_responsable_id']) ? (int)$row['usuario_responsable_id'] : null,
    "usuario_responsable" => [
      "username" => $row['usuario_responsable_username'],
      "nombre" => $row['usuario_responsable_nombre'],
      "apellido_paterno" => $row['usuario_responsable_apellido_paterno'],
      "apellido_materno" => $row['usuario_responsable_apellido_materno']
    ],

    "persona" => [
      "nombres" => $row['persona_nombres'],
      "apellido_paterno" => $row['persona_apellido_paterno'],
      "apellido_materno" => $row['persona_apellido_materno'],
      "telefono" => $row['persona_telefono'],
      "whatsapp" => $row['persona_whatsapp'],
      "email" => $row['persona_email']
    ],

    "fuente_captura" => $row['fuente_captura'],
    "fecha_registro" => $row['fecha_registro'],
    "fecha_afiliacion" => $row['fecha_afiliacion'],
    "numero_afiliacion" => $row['numero_afiliacion'],
    "observaciones" => $row['observaciones'],
    "activo" => (int)$row['activo'],

    "created_at" => $row['created_at'],
    "created_by" => isset($row['created_by']) ? (int)$row['created_by'] : null,
    "updated_at" => $row['updated_at'],
    "updated_by" => isset($row['updated_by']) ? (int)$row['updated_by'] : null
  ];
}

/* Requeridos */
$persona_id = isset($in['persona_id']) ? (int)$in['persona_id'] : 0;
$tipo_participacion = isset($in['tipo_participacion']) ? trim((string)$in['tipo_participacion']) : '';

if ($persona_id <= 0) {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "Falta parámetro obligatorio: persona_id"], JSON_UNESCAPED_UNICODE));
}

if (!in_array($tipo_participacion, ['SIMPATIZANTE', 'AFILIADO'], true)) {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "tipo_participacion inválido. Usa SIMPATIZANTE o AFILIADO"], JSON_UNESCAPED_UNICODE));
}

$fuente_captura = value_or_null($in, 'fuente_captura');

if ($fuente_captura !== null && !in_array($fuente_captura, ['PORTAL', 'BRIGADA', 'IMPORTACION', 'FORMULARIO_WEB', 'OTRO'], true)) {
  http_response_code(400);
  die(json_encode(["ok" => false, "error" => "fuente_captura inválida"], JSON_UNESCAPED_UNICODE));
}

$folio = isset($in['folio']) && trim((string)$in['folio']) !== ''
  ? trim((string)$in['folio'])
  : generar_folio($tipo_participacion);

$estatus_id = isset($in['estatus_id']) ? (int)$in['estatus_id'] : 4;

$con = conectar();
if (!$con) {
  http_response_code(500);
  die(json_encode(["ok" => false, "error" => "No se pudo conectar a la base de datos"], JSON_UNESCAPED_UNICODE));
}

$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

/* Validar persona */
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
  http_response_code(404);
  die(json_encode(["ok" => false, "error" => "Persona no encontrada"], JSON_UNESCAPED_UNICODE));
}

$con->begin_transaction();

try {
  $columns = [
    "folio",
    "persona_id",
    "tipo_participacion",
    "estatus_id"
  ];

  $placeholders = ["?", "?", "?", "?"];
  $params = [
    $folio,
    $persona_id,
    $tipo_participacion,
    $estatus_id
  ];
  $types = "sisi";

  $map = [
    "participacion_origen_id" => "i",
    "territorio_id" => "i",
    "usuario_responsable_id" => "i",
    "fuente_captura" => "s",
    "fecha_registro" => "s",
    "fecha_afiliacion" => "s",
    "numero_afiliacion" => "s",
    "observaciones" => "s",
    "activo" => "i",
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
    INSERT INTO persona_participacion (
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

  $participacion_id = (int)$con->insert_id;
  $st->close();

  $data = participacion_response($con, $participacion_id);

  $con->commit();

} catch (Exception $e) {
  $con->rollback();

  $code = $e->getCode();
  $msg = $e->getMessage();

  $con->close();

  if ($code == 1062) {
    $campo = "único";

    if (stripos($msg, "folio") !== false) {
      $campo = "folio";
    } elseif (stripos($msg, "uq_persona_tipo_participacion") !== false) {
      $campo = "persona_id + tipo_participacion";
    } elseif (stripos($msg, "uq_numero_afiliacion") !== false) {
      $campo = "numero_afiliacion";
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
      "error" => "FK inválida. Revisa persona_id, estatus_id, territorio_id, usuario_responsable_id o participacion_origen_id",
      "detail" => $msg,
      "code" => $code
    ], JSON_UNESCAPED_UNICODE));
  }

  http_response_code(500);
  die(json_encode([
    "ok" => false,
    "error" => "No se pudo crear la participación",
    "detail" => $msg,
    "code" => $code
  ], JSON_UNESCAPED_UNICODE));
}

$con->close();

echo json_encode([
  "ok" => true,
  "data" => $data
], JSON_UNESCAPED_UNICODE);
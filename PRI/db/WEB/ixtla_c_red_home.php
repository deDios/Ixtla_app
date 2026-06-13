<?php
// db/WEB/ixtla_c_red_home.php

/*
  Endpoint para hacerle la vida mas facil al front.

  Objetivo:
  - Resolver en servidor el universo visible por jerarquía.
  - Consultar personas desde persona, con LEFT JOIN a persona_participacion.
  - Si hay participación activa, priorizar:
    AFILIADO > SIMPATIZANTE
  - Si no hay participación, tratar temporalmente como SIMPATIZANTE.
  - Paginar en SQL.
  - Calcular métricas sin cargar todo el universo en el front.

  No requiere tablas ni columnas nuevas.
*/

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
   HELPERS GENERALES
   ============================================================ */

function json_response(array $data, int $status = 200): void
{
  http_response_code($status);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function internal_error(string $message): void
{
  error_log('[IXTLA_C_RED_HOME] ' . $message);

  json_response([
    "ok" => false,
    "error" => "Error interno del servidor"
  ], 500);
}

function read_json_body(): array
{
  $raw = file_get_contents('php://input');

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
  $path = realpath('/home/site/wwwroot/db/conn/conn_db_2.php');

  if (!$path || !file_exists($path)) {
    internal_error('No se encontró conn_db_2.php en /home/site/wwwroot/db/conn/conn_db_2.php');
  }

  include_once $path;

  if (!function_exists('conectar')) {
    internal_error('No existe la función conectar() en conn_db_2.php');
  }

  $con = conectar();

  if (!$con instanceof mysqli) {
    internal_error('conectar() no regresó una conexión mysqli válida');
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

  foreach ($params as &$value) {
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

function normalize_rol_codigo(array $in): string
{
  $rol = str_clean($in, 'rol_codigo');

  if ($rol === '' && isset($in['rol']) && is_array($in['rol'])) {
    $rol = trim((string)($in['rol']['codigo'] ?? ''));
  }

  return strtoupper($rol);
}

function get_usuario_id_from_input(array $in): int
{
  $usuario_id = int_or_null($in, 'usuario_id');

  if ($usuario_id !== null) {
    return $usuario_id;
  }

  if (isset($in['usuario']) && is_array($in['usuario'])) {
    $usuario_id = (int)($in['usuario']['usuario_id'] ?? 0);
    if ($usuario_id > 0) return $usuario_id;
  }

  return 0;
}

function can_see_all(array $in): bool
{
  $rolCodigo = normalize_rol_codigo($in);
  $rolId = int_or_null($in, 'rol_id');

  if ($rolId === null && isset($in['rol']) && is_array($in['rol'])) {
    $rolId = (int)($in['rol']['rol_id'] ?? 0);
  }

  return in_array($rolCodigo, ['ADMIN', 'COORD_GENERAL'], true)
    || in_array((int)$rolId, [1, 2], true);
}

function make_in_clause(string $field, array $ids, string &$types, array &$params): string
{
  $ids = array_values(array_unique(array_filter(array_map('intval', $ids), fn($v) => $v > 0)));

  if (empty($ids)) {
    return '1 = 0';
  }

  $placeholders = implode(',', array_fill(0, count($ids), '?'));

  foreach ($ids as $id) {
    $params[] = $id;
    $types .= 'i';
  }

  return "$field IN ($placeholders)";
}

/*
  Devuelve el usuario actual + toda su jerarquía descendiente.
  Ejemplo:
  Coordinador Zona -> Coordinadores Sección -> Promotores.
*/

function get_self_and_descendant_user_ids(mysqli $con, int $usuario_id): array
{
  if ($usuario_id <= 0) {
    return [];
  }

  $visited = [];
  $queue = [$usuario_id];

  while (!empty($queue)) {
    $current = array_shift($queue);

    if (isset($visited[$current])) {
      continue;
    }

    $visited[$current] = true;

    $sql = "
      SELECT uj.usuario_hijo_id
      FROM usuario_jerarquia uj
      INNER JOIN usuario uh
        ON uh.usuario_id = uj.usuario_hijo_id
       AND uh.deleted_at IS NULL
      WHERE uj.usuario_padre_id = ?
        AND uj.activo = 1
        AND (uj.fecha_fin IS NULL OR uj.fecha_fin >= CURDATE())
    ";

    $st = $con->prepare($sql);
    $st->bind_param('i', $current);
    $st->execute();

    $rs = $st->get_result();

    while ($row = $rs->fetch_assoc()) {
      $childId = (int)$row['usuario_hijo_id'];

      if ($childId > 0 && !isset($visited[$childId])) {
        $queue[] = $childId;
      }
    }

    $st->close();
  }

  return array_map('intval', array_keys($visited));
}

function build_scope(mysqli $con, array $in): array
{
  $usuarioId = get_usuario_id_from_input($in);
  $seeAll = can_see_all($in);

  if ($seeAll) {
    return [
      'can_see_all' => true,
      'usuario_id' => $usuarioId,
      'visible_user_ids' => [],
      'visible_user_count' => null,
    ];
  }

  if ($usuarioId <= 0) {
    json_response([
      'ok' => false,
      'error' => 'Falta usuario_id para calcular el alcance de RED'
    ], 400);
  }

  $ids = get_self_and_descendant_user_ids($con, $usuarioId);

  if (empty($ids)) {
    $ids = [$usuarioId];
  }

  return [
    'can_see_all' => false,
    'usuario_id' => $usuarioId,
    'visible_user_ids' => $ids,
    'visible_user_count' => count($ids),
  ];
}

/* ============================================================
   WHERE DINÁMICO
   ============================================================ */

function build_red_home_where(array $in, array $scope, string &$types, array &$params): string
{
  $q = str_clean($in, 'q');
  if ($q === '') {
    $q = str_clean($in, 'search');
  }

  $tipo = strtoupper(str_clean($in, 'tipo_participacion'));
  $telefono = str_clean($in, 'telefono');
  $email = str_clean($in, 'email');

  $seccion_id = int_or_null($in, 'seccion_id');
  $territorio_id = int_or_null($in, 'territorio_id');
  $estatus_id = int_or_null($in, 'estatus_id');
  $usuario_responsable_id = int_or_null($in, 'usuario_responsable_id');

  $where = [
    'p.deleted_at IS NULL'
  ];

  /*
    Fallback temporal:
    - Si la persona tiene participación activa, se usa pp.
    - Si no tiene participación activa, pp viene NULL y se trata como SIMPATIZANTE.
  */

  if (!$scope['can_see_all']) {
    $where[] = make_in_clause(
      'COALESCE(pp.usuario_responsable_id, p.capturado_por)',
      $scope['visible_user_ids'],
      $types,
      $params
    );
  }

  if ($usuario_responsable_id !== null) {
    $where[] = 'COALESCE(pp.usuario_responsable_id, p.capturado_por) = ?';
    $params[] = $usuario_responsable_id;
    $types .= 'i';
  }

  if ($tipo !== '' && in_array($tipo, ['SIMPATIZANTE', 'AFILIADO'], true)) {
    $where[] = "COALESCE(pp.tipo_participacion, 'SIMPATIZANTE') = ?";
    $params[] = $tipo;
    $types .= 's';
  }

  if ($seccion_id !== null) {
    $where[] = 'p.seccion_id = ?';
    $params[] = $seccion_id;
    $types .= 'i';
  }

  if ($territorio_id !== null) {
    $where[] = 'COALESCE(pp.territorio_id, p.seccion_id) = ?';
    $params[] = $territorio_id;
    $types .= 'i';
  }

  if ($estatus_id !== null) {
    $where[] = 'COALESCE(pp.estatus_id, p.estatus_id) = ?';
    $params[] = $estatus_id;
    $types .= 'i';
  }

  if ($telefono !== '') {
    $where[] = '(p.telefono = ? OR p.whatsapp = ?)';
    $params[] = $telefono;
    $params[] = $telefono;
    $types .= 'ss';
  }

  if ($email !== '') {
    $where[] = 'p.email = ?';
    $params[] = $email;
    $types .= 's';
  }

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
      OR pp.folio LIKE ?
      OR pp.numero_afiliacion LIKE ?
      OR ur.username LIKE ?
      OR ur.nombre LIKE ?
      OR ur.apellido_paterno LIKE ?
      OR ur.apellido_materno LIKE ?
      OR CONCAT_WS(' ', ur.nombre, ur.apellido_paterno, ur.apellido_materno) LIKE ?
    )";

    for ($i = 0; $i < 23; $i++) {
      $params[] = $like;
      $types .= 's';
    }
  }

  return implode(' AND ', $where);
}

function build_metric_scope_where(array $scope, string &$types, array &$params): string
{
  if ($scope['can_see_all']) {
    return '1 = 1';
  }

  return make_in_clause(
    'COALESCE(pp.usuario_responsable_id, p.capturado_por)',
    $scope['visible_user_ids'],
    $types,
    $params
  );
}

/* ============================================================
   SQL BASE
   ============================================================ */

function red_home_from(): string
{
  return "
    FROM persona p

    LEFT JOIN persona_participacion pp
      ON pp.persona_id = p.persona_id
     AND pp.deleted_at IS NULL
     AND pp.activo = 1
     AND NOT EXISTS (
        SELECT 1
        FROM persona_participacion pp2
        WHERE pp2.persona_id = p.persona_id
          AND pp2.deleted_at IS NULL
          AND pp2.activo = 1
          AND (
            CASE pp2.tipo_participacion
              WHEN 'AFILIADO' THEN 2
              WHEN 'SIMPATIZANTE' THEN 1
              ELSE 0
            END
          ) > (
            CASE pp.tipo_participacion
              WHEN 'AFILIADO' THEN 2
              WHEN 'SIMPATIZANTE' THEN 1
              ELSE 0
            END
          )
      )

    LEFT JOIN cat_estatus e
      ON e.estatus_id = COALESCE(pp.estatus_id, p.estatus_id)

    LEFT JOIN territorio s
      ON s.territorio_id = p.seccion_id
     AND s.deleted_at IS NULL

    LEFT JOIN territorio z
      ON z.territorio_id = s.territorio_padre_id
     AND z.deleted_at IS NULL

    LEFT JOIN territorio t
      ON t.territorio_id = COALESCE(pp.territorio_id, p.seccion_id)
     AND t.deleted_at IS NULL

    LEFT JOIN territorio tz
      ON tz.territorio_id = t.territorio_padre_id
     AND tz.deleted_at IS NULL

    LEFT JOIN usuario ur
      ON ur.usuario_id = COALESCE(pp.usuario_responsable_id, p.capturado_por)
     AND ur.deleted_at IS NULL
  ";
}

function red_home_select(): string
{
  return "
    SELECT
      p.persona_id,
      p.uuid,
      p.nombres,
      p.apellido_paterno,
      p.apellido_materno,
      p.fecha_nacimiento,
      p.sexo,
      p.curp_enc,
      p.clave_elector_enc,
      p.curp_hash,
      p.clave_elector_hash,
      p.ocr_hash,
      p.cic_hash,
      p.idmex_hash,
      p.seccion_id,
      p.anio_registro,
      p.emision,
      p.vigencia_inicio,
      p.vigencia_fin,
      p.domicilio_texto,
      p.calle,
      p.numero_exterior,
      p.numero_interior,
      p.colonia,
      p.localidad,
      p.municipio,
      p.estado,
      p.codigo_postal,
      p.telefono,
      p.whatsapp,
      p.email,
      p.acepta_tratamiento_datos,
      p.acepta_datos_sensibles,
      p.acepta_contacto_whatsapp,
      p.aviso_privacidad_version,
      p.fecha_consentimiento,
      p.estatus_id AS persona_estatus_id,
      p.capturado_por,
      p.fecha_captura,
      p.observaciones AS persona_observaciones,
      p.created_at,
      p.created_by,
      p.updated_at,
      p.updated_by,

      pp.participacion_id,
      pp.folio,
      COALESCE(pp.tipo_participacion, 'SIMPATIZANTE') AS tipo_participacion,
      pp.participacion_origen_id,
      COALESCE(pp.estatus_id, p.estatus_id) AS participacion_estatus_id,
      COALESCE(pp.territorio_id, p.seccion_id) AS territorio_id,
      COALESCE(pp.usuario_responsable_id, p.capturado_por) AS usuario_responsable_id,
      pp.fuente_captura,
      COALESCE(pp.fecha_registro, p.fecha_captura, p.created_at) AS fecha_registro,
      pp.fecha_afiliacion,
      pp.numero_afiliacion,
      pp.observaciones AS participacion_observaciones,
      COALESCE(pp.activo, 1) AS participacion_activo,
      pp.created_at AS participacion_created_at,
      pp.updated_at AS participacion_updated_at,

      e.codigo AS participacion_estatus_codigo,
      e.nombre AS participacion_estatus_nombre,

      s.territorio_id AS seccion_territorio_id,
      s.codigo AS seccion_codigo,
      s.nombre AS seccion_nombre,
      s.tipo AS seccion_tipo,

      z.territorio_id AS zona_id,
      z.codigo AS zona_codigo,
      z.nombre AS zona_nombre,

      t.territorio_id AS participacion_territorio_id,
      t.codigo AS participacion_territorio_codigo,
      t.nombre AS participacion_territorio_nombre,
      t.tipo AS participacion_territorio_tipo,

      tz.territorio_id AS participacion_zona_id,
      tz.codigo AS participacion_zona_codigo,
      tz.nombre AS participacion_zona_nombre,

      ur.username AS responsable_username,
      ur.nombre AS responsable_nombre,
      ur.apellido_paterno AS responsable_apellido_paterno,
      ur.apellido_materno AS responsable_apellido_materno,
      ur.email AS responsable_email,
      ur.telefono AS responsable_telefono
  ";
}

/* ============================================================
   FORMATTER
   ============================================================ */

function red_home_row(array $row): array
{
  global $DATA_SECRET;

  $curp = sensitive_decrypt($row['curp_enc'] ?? null, $DATA_SECRET);
  $clave_elector = sensitive_decrypt($row['clave_elector_enc'] ?? null, $DATA_SECRET);

  $nombreCompleto = trim(
    (string)$row['nombres'] . ' ' .
      (string)$row['apellido_paterno'] . ' ' .
      (string)$row['apellido_materno']
  );

  $responsableNombre = trim(
    (string)($row['responsable_nombre'] ?? '') . ' ' .
      (string)($row['responsable_apellido_paterno'] ?? '') . ' ' .
      (string)($row['responsable_apellido_materno'] ?? '')
  );

  return [
    'persona_id' => (int)$row['persona_id'],
    'uuid' => $row['uuid'],
    'nombres' => $row['nombres'],
    'apellido_paterno' => $row['apellido_paterno'],
    'apellido_materno' => $row['apellido_materno'],
    'nombre_completo' => $nombreCompleto,
    'fecha_nacimiento' => $row['fecha_nacimiento'],
    'sexo' => $row['sexo'],

    'curp' => $curp,
    'clave_elector' => $clave_elector,
    'curp_hash' => $row['curp_hash'],
    'clave_elector_hash' => $row['clave_elector_hash'],
    'ocr_hash' => $row['ocr_hash'],
    'cic_hash' => $row['cic_hash'],
    'idmex_hash' => $row['idmex_hash'],

    'seccion_id' => nullable_int_from_row($row, 'seccion_id'),
    'domicilio_texto' => $row['domicilio_texto'],
    'calle' => $row['calle'],
    'numero_exterior' => $row['numero_exterior'],
    'numero_interior' => $row['numero_interior'],
    'colonia' => $row['colonia'],
    'localidad' => $row['localidad'],
    'municipio' => $row['municipio'],
    'estado' => $row['estado'],
    'codigo_postal' => $row['codigo_postal'],
    'telefono' => $row['telefono'],
    'whatsapp' => $row['whatsapp'],
    'email' => $row['email'],

    'capturado_por' => nullable_int_from_row($row, 'capturado_por'),
    'fecha_captura' => $row['fecha_captura'],
    'created_at' => $row['created_at'],
    'created_by' => nullable_int_from_row($row, 'created_by'),
    'updated_at' => $row['updated_at'],
    'updated_by' => nullable_int_from_row($row, 'updated_by'),

    'participacion' => [
      'participacion_id' => nullable_int_from_row($row, 'participacion_id'),
      'folio' => $row['folio'],
      'tipo_participacion' => $row['tipo_participacion'] ?: 'SIMPATIZANTE',
      'tipo_actual' => $row['tipo_participacion'] ?: 'SIMPATIZANTE',
      'fallback' => empty($row['participacion_id']),
      'participacion_origen_id' => nullable_int_from_row($row, 'participacion_origen_id'),
      'estatus_id' => (int)$row['participacion_estatus_id'],
      'estatus' => [
        'codigo' => $row['participacion_estatus_codigo'],
        'nombre' => $row['participacion_estatus_nombre'],
      ],
      'territorio_id' => nullable_int_from_row($row, 'territorio_id'),
      'usuario_responsable_id' => nullable_int_from_row($row, 'usuario_responsable_id'),
      'fuente_captura' => $row['fuente_captura'],
      'fecha_registro' => $row['fecha_registro'],
      'fecha_afiliacion' => $row['fecha_afiliacion'],
      'numero_afiliacion' => $row['numero_afiliacion'],
      'observaciones' => $row['participacion_observaciones'],
      'activo' => (int)$row['participacion_activo'],
      'created_at' => $row['participacion_created_at'],
      'updated_at' => $row['participacion_updated_at'],
    ],

    'territorio' => [
      'seccion' => [
        'territorio_id' => nullable_int_from_row($row, 'seccion_territorio_id'),
        'codigo' => $row['seccion_codigo'],
        'nombre' => $row['seccion_nombre'],
        'tipo' => $row['seccion_tipo'],
      ],
      'zona' => [
        'territorio_id' => nullable_int_from_row($row, 'zona_id'),
        'codigo' => $row['zona_codigo'],
        'nombre' => $row['zona_nombre'],
      ],
      'participacion' => [
        'territorio_id' => nullable_int_from_row($row, 'participacion_territorio_id'),
        'codigo' => $row['participacion_territorio_codigo'],
        'nombre' => $row['participacion_territorio_nombre'],
        'tipo' => $row['participacion_territorio_tipo'],
        'zona' => [
          'territorio_id' => nullable_int_from_row($row, 'participacion_zona_id'),
          'codigo' => $row['participacion_zona_codigo'],
          'nombre' => $row['participacion_zona_nombre'],
        ],
      ],
    ],

    'responsable' => [
      'usuario_id' => nullable_int_from_row($row, 'usuario_responsable_id'),
      'username' => $row['responsable_username'],
      'nombre' => $row['responsable_nombre'],
      'apellido_paterno' => $row['responsable_apellido_paterno'],
      'apellido_materno' => $row['responsable_apellido_materno'],
      'nombre_completo' => $responsableNombre,
      'email' => $row['responsable_email'],
      'telefono' => $row['responsable_telefono'],
    ],

    // Campos planos para facilitar compatibilidad con el home actual.
    'tipo_participacion' => $row['tipo_participacion'],
    'estatus_id' => (int)$row['participacion_estatus_id'],
    'estatus_codigo' => $row['participacion_estatus_codigo'],
    'estatus_nombre' => $row['participacion_estatus_nombre'],
    'seccion_codigo' => $row['seccion_codigo'],
    'seccion_nombre' => $row['seccion_nombre'],
  ];
}

/* ============================================================
   CONSULTAS DASHBOARD
   ============================================================ */

function consultar_red_home(mysqli $con, array $in, array $scope): array
{
  $page = isset($in['page']) ? max(1, (int)$in['page']) : 1;

  $pageSize = 10;

  if (isset($in['page_size'])) {
    $pageSize = (int)$in['page_size'];
  } elseif (isset($in['limit'])) {
    $pageSize = (int)$in['limit'];
  }

  $pageSize = max(1, min(200, $pageSize));
  $offset = ($page - 1) * $pageSize;

  $params = [];
  $types = '';
  $whereSql = build_red_home_where($in, $scope, $types, $params);

  $countSql = "
    SELECT COUNT(*) AS total
    " . red_home_from() . "
    WHERE $whereSql
  ";

  $stCount = $con->prepare($countSql);
  $countParams = $params;
  $countTypes = $types;
  bind_dynamic($stCount, $countTypes, $countParams);
  $stCount->execute();
  $totalRow = $stCount->get_result()->fetch_assoc();
  $stCount->close();

  $total = (int)($totalRow['total'] ?? 0);

  $sql = red_home_select() . red_home_from() . "
    WHERE $whereSql
    ORDER BY
      CASE COALESCE(pp.tipo_participacion, 'SIMPATIZANTE')
        WHEN 'AFILIADO' THEN 2
        WHEN 'SIMPATIZANTE' THEN 1
        ELSE 0
      END DESC,
      COALESCE(pp.fecha_afiliacion, DATE(pp.fecha_registro), DATE(p.fecha_captura), DATE(p.created_at)) DESC,
      COALESCE(pp.fecha_registro, p.fecha_captura, p.created_at) DESC,
      COALESCE(pp.participacion_id, 0) DESC,
      p.persona_id DESC
    LIMIT ? OFFSET ?
  ";

  $listParams = $params;
  $listTypes = $types . 'ii';
  $listParams[] = $pageSize;
  $listParams[] = $offset;

  $st = $con->prepare($sql);
  bind_dynamic($st, $listTypes, $listParams);
  $st->execute();

  $rs = $st->get_result();
  $data = [];

  while ($row = $rs->fetch_assoc()) {
    $data[] = red_home_row($row);
  }

  $st->close();

  return [
    'meta' => [
      'page' => $page,
      'page_size' => $pageSize,
      'total' => $total,
      'total_pages' => $pageSize > 0 ? (int)ceil($total / $pageSize) : 0,
    ],
    'data' => $data,
  ];
}

function count_metric(mysqli $con, string $sql, string $types = '', array $params = []): int
{
  $st = $con->prepare($sql);
  bind_dynamic($st, $types, $params);
  $st->execute();
  $row = $st->get_result()->fetch_assoc();
  $st->close();

  return (int)($row['total'] ?? 0);
}

function consultar_metricas(mysqli $con, array $scope): array
{
  $typesScope = '';
  $paramsScope = [];
  $scopeWhere = build_metric_scope_where($scope, $typesScope, $paramsScope);

  $afiliadosSql = "
    SELECT COUNT(DISTINCT p.persona_id) AS total
    FROM persona p
    LEFT JOIN persona_participacion pp
      ON pp.persona_id = p.persona_id
     AND pp.deleted_at IS NULL
     AND pp.activo = 1
     AND pp.tipo_participacion = 'AFILIADO'
    WHERE p.deleted_at IS NULL
      AND pp.participacion_id IS NOT NULL
      AND $scopeWhere
  ";

  $afiliados = count_metric($con, $afiliadosSql, $typesScope, $paramsScope);

  $typesScope2 = '';
  $paramsScope2 = [];
  $scopeWhere2 = build_metric_scope_where($scope, $typesScope2, $paramsScope2);

  /*
    Simpatizantes:
    - Personas sin AFILIADO activo.
    - Incluye personas sin participación todavía.
  */
  $simpatizantesSql = "
    SELECT COUNT(DISTINCT p.persona_id) AS total
    FROM persona p
    LEFT JOIN persona_participacion pp
      ON pp.persona_id = p.persona_id
     AND pp.deleted_at IS NULL
     AND pp.activo = 1
     AND pp.tipo_participacion = 'SIMPATIZANTE'
    WHERE p.deleted_at IS NULL
      AND $scopeWhere2
      AND NOT EXISTS (
        SELECT 1
        FROM persona_participacion pp_af
        WHERE pp_af.persona_id = p.persona_id
          AND pp_af.deleted_at IS NULL
          AND pp_af.activo = 1
          AND pp_af.tipo_participacion = 'AFILIADO'
      )
  ";

  $simpatizantes = count_metric($con, $simpatizantesSql, $typesScope2, $paramsScope2);

  $promotores = contar_promotores_visibles($con, $scope);

  return [
    'afiliados' => $afiliados,
    'simpatizantes' => $simpatizantes,
    'promotores' => $promotores,
    'promotores_visibles' => $promotores,
  ];
}

function contar_promotores_visibles(mysqli $con, array $scope): int
{
  /*
    Promotores:
    - Se cuentan usuarios con rol PROMOTOR.
    - No se cuentan coordinadores.
    - Para ADMIN / COORD_GENERAL se cuentan todos los promotores activos.
    - Para los demás roles se cuentan solo los promotores dentro de su jerarquía descendiente.
  */

  if ($scope['can_see_all']) {
    $sql = "
      SELECT COUNT(DISTINCT u.usuario_id) AS total
      FROM usuario u
      INNER JOIN cat_rol r
        ON r.rol_id = u.rol_id
      WHERE u.deleted_at IS NULL
        AND r.codigo = 'PROMOTOR'
    ";

    return count_metric($con, $sql);
  }

  $visibleIds = $scope['visible_user_ids'] ?? [];

  if (empty($visibleIds)) {
    return 0;
  }

  $types = '';
  $params = [];

  $whereVisible = make_in_clause('u.usuario_id', $visibleIds, $types, $params);

  $sql = "
    SELECT COUNT(DISTINCT u.usuario_id) AS total
    FROM usuario u
    INNER JOIN cat_rol r
      ON r.rol_id = u.rol_id
    WHERE u.deleted_at IS NULL
      AND r.codigo = 'PROMOTOR'
      AND $whereVisible
  ";

  return count_metric($con, $sql, $types, $params);
}

/* ============================================================
   MAIN
   ============================================================ */

try {
  if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_response([
      'ok' => false,
      'error' => 'Método no permitido. Usa POST.'
    ], 405);
  }

  $in = read_json_body();
  $con = db();

  $scope = build_scope($con, $in);
  $result = consultar_red_home($con, $in, $scope);
  $metrics = consultar_metricas($con, $scope);

  $con->close();

  json_response([
    'ok' => true,
    'meta' => $result['meta'],
    'scope' => [
      'usuario_id' => $scope['usuario_id'],
      'rol_codigo' => normalize_rol_codigo($in),
      'can_see_all' => $scope['can_see_all'],
      'visible_user_count' => $scope['visible_user_count'],
      // Se limita para debug y evitar respuestas enormes.
      'visible_user_ids_sample' => $scope['can_see_all']
        ? []
        : array_slice($scope['visible_user_ids'], 0, 100),
    ],
    'metrics' => $metrics,
    'data' => $result['data'],
  ]);
} catch (mysqli_sql_exception $e) {
  if (isset($con) && $con instanceof mysqli) {
    try {
      $con->close();
    } catch (Throwable $ignored) {
    }
  }

  error_log('[IXTLA_C_RED_HOME][SQL] ' . $e->getMessage());

  json_response([
    'ok' => false,
    'error' => 'Error al consultar el dashboard RED'
  ], 500);
} catch (Throwable $e) {
  if (isset($con) && $con instanceof mysqli) {
    try {
      $con->close();
    } catch (Throwable $ignored) {
    }
  }

  error_log('[IXTLA_C_RED_HOME][ERROR] ' . $e->getMessage());

  json_response([
    'ok' => false,
    'error' => 'Error interno del servidor'
  ], 500);
}
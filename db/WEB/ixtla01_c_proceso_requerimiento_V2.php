<?php
/* =========================================================
   CORS (NO MODIFICAR) - EXACTO al original que pegaste
   ========================================================= */
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = [
  'https://ixtla-app.com',
  'https://www.ixtla-app.com'
];

if (in_array($origin, $allowed, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Access-Control-Allow-Credentials: true");
  header("Vary: Origin");
}

header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
$reqHeaders = $_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'] ?? '';
if ($reqHeaders) {
  header("Access-Control-Allow-Headers: $reqHeaders");
} else {
  header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept");
}

header("Access-Control-Max-Age: 86400");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

header("Content-Type: application/json; charset=utf-8");

/* =========================================================
   Helpers
   ========================================================= */
function respond($ok, $data = null, $http = 200) {
  http_response_code($http);
  echo json_encode($data ?? ["ok" => (bool)$ok], JSON_UNESCAPED_UNICODE);
  exit;
}

function read_input() {
  $ct = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
  if (stripos($ct, 'application/json') !== false) {
    $raw = file_get_contents('php://input');
    $json = json_decode($raw ?: '[]', true);
    return is_array($json) ? $json : [];
  }
  return $_POST ?: [];
}

function as_int($v, $default = null) {
  if ($v === null || $v === '') return $default;
  if (is_numeric($v)) return (int)$v;
  return $default;
}

function as_str($v, $default = null) {
  if ($v === null) return $default;
  $s = trim((string)$v);
  return $s === '' ? $default : $s;
}

/* =========================================================
   DB (PDO) - por ENV (ajusta si tu patrón es otro)
   ========================================================= */
function pdo_conn() {
  // Soporta nombres comunes en Azure / Linux env
  $host = getenv('DB_HOST') ?: getenv('MYSQL_HOST') ?: '127.0.0.1';
  $port = getenv('DB_PORT') ?: getenv('MYSQL_PORT') ?: '3306';
  $name = getenv('DB_NAME') ?: getenv('MYSQL_DATABASE') ?: '';
  $user = getenv('DB_USER') ?: getenv('MYSQL_USER') ?: '';
  $pass = getenv('DB_PASS') ?: getenv('MYSQL_PASSWORD') ?: '';

  if ($name === '' || $user === '') {
    respond(false, [
      "ok" => false,
      "error" => "DB env vars missing (DB_NAME/DB_USER). Ajusta la conexión en ixtla01_c_tarea_proceso_V2.php."
    ], 500);
  }

  $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
  $opt = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
  ];
  return new PDO($dsn, $user, $pass, $opt);
}

/* =========================================================
   Endpoint V2 - Cursor pagination + filtros
   - Orden estable: sort_ts DESC, id DESC
   - sort_ts = COALESCE(t.updated_at, t.created_at)
   ========================================================= */
try {
  $in = read_input();

  // Filtros
  $proceso_id       = as_int($in['proceso_id'] ?? null, null);
  $requerimiento_id = as_int($in['requerimiento_id'] ?? null, null);
  $asignado_a       = as_int($in['asignado_a'] ?? null, null);

  // 1 activo / 0 baja lógica (si no te pasan nada, asumimos activo)
  $status           = as_int($in['status'] ?? 1, 1);

  // Búsqueda global (titulo/descripcion)
  $q = as_str($in['q'] ?? null, null);

  // Paginación
  $page_size = as_int($in['page_size'] ?? 10, 10);
  if ($page_size < 1) $page_size = 10;
  if ($page_size > 50) $page_size = 50;

  // Cursor: { updated_at: "YYYY-MM-DD HH:MM:SS", id: 123 }
  $cursor = $in['cursor'] ?? null;
  $cur_updated = null;
  $cur_id = null;
  if (is_array($cursor)) {
    $cur_updated = as_str($cursor['updated_at'] ?? null, null);
    $cur_id = as_int($cursor['id'] ?? null, null);
  }

  $pdo = pdo_conn();

  // =======================================================
  // IMPORTANTE (VISIBILIDAD / RBAC):
  // Aquí es donde debes agregar tu regla REAL para "quién ve qué".
  // Ejemplos típicos (NO activos por defecto):
  // - filtrar por dept_id del usuario
  // - o por asignado_a = empleado_id
  // - o por requerimientos que el usuario puede ver
  // Si ya tienes esa lógica en V1, pégala aquí igual.
  // =======================================================

  $where = [];
  $params = [];

  // Baja lógica
  if ($status === 0 || $status === 1) {
    $where[] = "t.status = :status";
    $params[':status'] = $status;
  }

  if ($proceso_id !== null) {
    $where[] = "t.proceso_id = :proceso_id";
    $params[':proceso_id'] = $proceso_id;
  }

  if ($asignado_a !== null) {
    $where[] = "t.asignado_a = :asignado_a";
    $params[':asignado_a'] = $asignado_a;
  }

  // Si quieres permitir filtrar por requerimiento_id, hacemos join al proceso
  $join_proc = false;
  if ($requerimiento_id !== null) {
    $join_proc = true;
    $where[] = "pr.requerimiento_id = :requerimiento_id";
    $params[':requerimiento_id'] = $requerimiento_id;
  }

  if ($q !== null) {
    $where[] = "(t.titulo LIKE :q OR t.descripcion LIKE :q)";
    $params[':q'] = "%" . $q . "%";
  }

  // Cursor pagination (orden DESC)
  // sort_ts = COALESCE(t.updated_at, t.created_at)
  if ($cur_updated !== null && $cur_id !== null) {
    $where[] =
      "(
        COALESCE(t.updated_at, t.created_at) < :cur_updated
        OR (COALESCE(t.updated_at, t.created_at) = :cur_updated AND t.id < :cur_id)
      )";
    $params[':cur_updated'] = $cur_updated;
    $params[':cur_id'] = $cur_id;
  }

  $sqlWhere = $where ? ("WHERE " . implode(" AND ", $where)) : "";

  $sql = "
    SELECT
      t.id,
      t.proceso_id,
      t.asignado_a,
      t.titulo,
      t.descripcion,
      t.esfuerzo,
      t.fecha_inicio,
      t.fecha_fin,
      t.status,
      t.created_at,
      t.updated_at,
      t.created_by,
      t.updated_by,
      COALESCE(t.updated_at, t.created_at) AS sort_ts
      " . ($join_proc ? ", pr.requerimiento_id" : "") . "
    FROM tarea_proceso t
    " . ($join_proc ? "INNER JOIN proceso_requerimiento pr ON pr.id = t.proceso_id" : "") . "
    $sqlWhere
    ORDER BY sort_ts DESC, t.id DESC
    LIMIT :limit
  ";

  $stmt = $pdo->prepare($sql);

  // Bind params
  foreach ($params as $k => $v) {
    if (is_int($v)) $stmt->bindValue($k, $v, PDO::PARAM_INT);
    else $stmt->bindValue($k, $v, PDO::PARAM_STR);
  }
  $stmt->bindValue(':limit', $page_size, PDO::PARAM_INT);

  $stmt->execute();
  $rows = $stmt->fetchAll();

  // next_cursor si hay más
  $next_cursor = null;
  if (count($rows) === $page_size) {
    $last = $rows[count($rows) - 1];
    $next_cursor = [
      "updated_at" => $last["sort_ts"],
      "id" => (int)$last["id"]
    ];
  }

  respond(true, [
    "ok" => true,
    "count" => count($rows),
    "data" => $rows,
    "next_cursor" => $next_cursor
  ]);

} catch (Throwable $e) {
  respond(false, [
    "ok" => false,
    "error" => "Server error",
    "detail" => $e->getMessage()
  ], 500);
}
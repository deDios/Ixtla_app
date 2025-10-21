<?php
header('Content-Type: application/json; charset=utf-8');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === 'https://ixtla-app.com' || $origin === 'https://www.ixtla-app.com') {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400");
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

// DB include robusto
$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && is_file($path)) { include_once $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conn_db.php en $path"])); }
if (!function_exists('conectar')) { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"conectar() no definida"])); }

$con = conectar();
if (!$con) { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"DB down"])); }
$con->set_charset('utf8mb4');

// Parámetros
$status    = $_GET['status'] ?? 'all';
$search    = trim($_GET['search'] ?? '');
$page      = max(1, (int)($_GET['page'] ?? 1));
$pageSize  = max(1, min(100, (int)($_GET['page_size'] ?? 20)));
$offset    = ($page-1)*$pageSize;

// WHERE dinámico
$where = "1=1"; $types = ''; $params = [];
if (in_array($status, ['open','pending','closed'], true)) {
  $where .= " AND c.status = ?";
  $types .= 's'; $params[] = $status;
}
if ($search !== '') {
  $where .= " AND (ct.wa_phone LIKE CONCAT('%',?,'%') OR ct.name LIKE CONCAT('%',?,'%'))";
  $types .= 'ss'; $params[] = $search; $params[] = $search;
}

// 1) Total para paginación
$sqlCount = "SELECT COUNT(*) AS total
             FROM conversations c
             JOIN contacts ct ON ct.id=c.contact_id
             WHERE $where";
$st = $con->prepare($sqlCount);
if ($types) { $st->bind_param($types, ...$params); }
$st->execute();
$total = (int)($st->get_result()->fetch_assoc()['total'] ?? 0);
$st->close();

// 2) Datos paginados
// Si tu tabla tiene updated_at, prioriza ese campo; si no, queda el COALESCE.
$orderBy = "COALESCE(c.updated_at, c.last_incoming_at, c.created_at) DESC";

$sql = "SELECT
          c.id,
          c.status,
          c.last_incoming_at,
          c.last_outgoing_at,
          c.updated_at,
          ct.name  AS contact_name,
          ct.wa_phone
        FROM conversations c
        JOIN contacts ct ON ct.id=c.contact_id
        WHERE $where
        ORDER BY $orderBy
        LIMIT ? OFFSET ?";

$typesQ = $types . 'ii';
$paramsQ = $params; $paramsQ[] = $pageSize; $paramsQ[] = $offset;

$st = $con->prepare($sql);
$st->bind_param($typesQ, ...$paramsQ);
$st->execute();
$rows = $st->get_result()->fetch_all(MYSQLI_ASSOC);
$st->close();

echo json_encode([
  "ok"        => true,
  "data"      => $rows,
  "page"      => $page,
  "page_size" => $pageSize,
  "total"     => $total,
  "has_more"  => ($offset + $pageSize) < $total
], JSON_UNESCAPED_UNICODE);

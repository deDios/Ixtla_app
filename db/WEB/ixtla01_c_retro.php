<?php
//DB\WEB\ixtla01_c_retro.php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = ['https://ixtla-app.com', 'https://www.ixtla-app.com'];

if (in_array($origin, $allowed, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Access-Control-Allow-Credentials: true");
  header("Vary: Origin");
}
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; } else {
  http_response_code(500);
  die(json_encode(["ok"=>false,"error"=>"No se encontró conn_db.php"]));
}

$in = $_GET;
$id               = isset($in['id']) ? (int)$in['id'] : null;
$requerimiento_id = isset($in['requerimiento_id']) ? (int)$in['requerimiento_id'] : null;
$status           = isset($in['status']) && $in['status'] !== '' ? (int)$in['status'] : null;

$page     = isset($in['page']) ? max(1,(int)$in['page']) : 1;
$pageSize = isset($in['page_size']) ? max(1,min(500,(int)$in['page_size'])) : 50;
$offset   = ($page-1)*$pageSize;

$con = conectar();
$con->set_charset('utf8mb4');

// --- Consulta Individual ---
if ($id) {
    $sql = "SELECT r.*, req.folio FROM retro_ciudadana r 
            INNER JOIN requerimiento req ON req.id = r.requerimiento_id 
            WHERE r.id = ? LIMIT 1";
    $stmt = $con->prepare($sql);
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    
    if ($row) {
        $row['id'] = (int)$row['id'];
        $row['requerimiento_id'] = (int)$row['requerimiento_id'];
        $row['status'] = (int)$row['status'];
        $row['calificacion'] = $row['calificacion'] !== null ? (int)$row['calificacion'] : null;
        echo json_encode(["ok" => true, "data" => $row]);
    } else {
        http_response_code(404);
        echo json_encode(["ok" => false, "error" => "No encontrado"]);
    }
    $stmt->close();
    $con->close();
    exit;
}

// --- Listado Filtrado ---
$where = []; $types = ""; $params = [];
if ($requerimiento_id) { $where[] = "r.requerimiento_id = ?"; $types .= "i"; $params[] = &$requerimiento_id; }
if ($status !== null) { $where[] = "r.status = ?"; $types .= "i"; $params[] = &$status; }

$sql = "SELECT SQL_CALC_FOUND_ROWS r.* FROM retro_ciudadana r";
if ($where) $sql .= " WHERE " . implode(" AND ", $where);
$sql .= " ORDER BY r.id DESC LIMIT ? OFFSET ?";
$types .= "ii"; $params[] = &$pageSize; $params[] = &$offset;

$stmt = $con->prepare($sql);
call_user_func_array([$stmt, 'bind_param'], array_merge([$types], $params));
$stmt->execute();
$rs = $stmt->get_result();

$data = [];
while ($r = $rs->fetch_assoc()) {
    $r['id'] = (int)$r['id'];
    $r['requerimiento_id'] = (int)$r['requerimiento_id'];
    $r['status'] = (int)$r['status'];
    $r['calificacion'] = $r['calificacion'] !== null ? (int)$r['calificacion'] : null;
    $data[] = $r;
}

$tot = $con->query("SELECT FOUND_ROWS() AS t")->fetch_assoc();
echo json_encode([
    "ok" => true, 
    "meta" => ["page" => $page, "page_size" => $pageSize, "total" => (int)$tot['t']], 
    "data" => $data
]);
$con->close();
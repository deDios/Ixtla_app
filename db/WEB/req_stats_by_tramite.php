<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../conn/conn_db.php';
$con = conectar();
if (!$con) { http_response_code(500); echo json_encode(["ok"=>false,"error"=>"No se pudo conectar"]); exit; }
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

$in        = json_decode(file_get_contents("php://input"), true) ?? [];
$deptId    = isset($in['departamento_id']) && $in['departamento_id'] !== '' ? (int)$in['departamento_id'] : null;
$monthText = isset($in['month']) ? trim($in['month']) : null;     // "YYYY-MM" o null

$where  = [];
$params = [];
$types  = "";

/* Filtro por departamento: sobre el departamento del requerimiento */
if ($deptId !== null) {
  $where[] = "r.departamento_id = ?";
  $types  .= "i";
  $params[] = $deptId;
}

/* Filtro por mes (YYYY-MM) sobre created_at */
if ($monthText && preg_match('/^\d{4}-\d{2}$/', $monthText)) {
  $where[] = "DATE_FORMAT(r.created_at,'%Y-%m') = ?";
  $types  .= "s";
  $params[] = $monthText;
}

/* JOIN para nombre del trámite; si viene NULL, lo reportamos como '—' */
$sql = "
  SELECT
    COALESCE(t.nombre, '—') AS tramite,
    COUNT(*)                AS total
  FROM requerimiento r
  LEFT JOIN tramite t ON t.id = r.tramite_id
";
if ($where) { $sql .= " WHERE " . implode(" AND ", $where); }
$sql .= " GROUP BY COALESCE(t.nombre, '—') ORDER BY total DESC, tramite ASC";

$st = $con->prepare($sql);
if (!$st) { echo json_encode(["ok"=>false,"error"=>"Prepare failed"]); exit; }
if ($types !== "") { $st->bind_param($types, ...$params); }
$st->execute();
$rs = $st->get_result();

$out = [];
while ($row = $rs->fetch_assoc()) {
  $out[] = [
    "tramite" => $row["tramite"],
    "total"   => (int)$row["total"]
  ];
}
$st->close(); $con->close();

echo json_encode(["ok"=>true, "data"=>$out], JSON_UNESCAPED_UNICODE);

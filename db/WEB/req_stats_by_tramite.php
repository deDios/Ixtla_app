<?php
require_once __DIR__ . '/_ix_common.php';
$con = ix_cors_and_conn_or_die();

$in    = json_decode(file_get_contents("php://input"), true) ?? [];
$dept  = isset($in['departamento_id']) && $in['departamento_id'] !== '' ? (int)$in['departamento_id'] : null;
$month = isset($in['month']) ? trim($in['month']) : null;
[$d1,$d2] = month_range_or_null($month);

/* Ajusta a tu modelo real:
   - Si el nombre del trámite está en r.tramite_nombre, úsalo.
   - Si es via catálogo, se asume r.tramite_id -> tramite.nombre.
*/
$sql = "
SELECT COALESCE(t.nombre, '—') AS tramite, COUNT(*) AS total
FROM requerimiento r
LEFT JOIN tramite t ON r.tramite_id = t.id
WHERE 1=1
";
$types = ""; $params = [];

if ($dept !== null) { $sql .= " AND r.departamento_id = ?"; $types.="i"; $params[]=$dept; }
if ($d1 && $d2)     { $sql .= " AND r.created_at BETWEEN ? AND ?"; $types.="ss"; $params[]=$d1; $params[]=$d2; }

$sql .= " GROUP BY COALESCE(t.nombre, '—') ORDER BY total DESC, tramite ASC";

$st = $con->prepare($sql);
if ($types !== "") { $st->bind_param($types, ...$params); }
$st->execute();
$rs = $st->get_result();

$data = [];
while ($row = $rs->fetch_assoc()) {
  $data[] = ["tramite" => $row["tramite"], "total" => (int)$row["total"]];
}
$st->close(); $con->close();

echo json_encode(["ok"=>true, "data"=>$data], JSON_UNESCAPED_UNICODE);

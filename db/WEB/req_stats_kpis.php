<?php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = ['https://ixtla-app.com', 'https://www.ixtla-app.com'];

if (in_array($origin, $allowed, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Access-Control-Allow-Credentials: true");
  header("Vary: Origin");
}
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; } else {
  http_response_code(500);
  die(json_encode(["ok"=>false,"error"=>"No se encontró conn_db.php"]));
}

$in = json_decode(file_get_contents("php://input"), true) ?: [];
$dept_id = isset($in['departamento_id']) && $in['departamento_id'] !== "" ? (int)$in['departamento_id'] : null;

// LÓGICA PARA MÚLTIPLES MESES
$monthInput = isset($in['month']) && $in['month'] !== "" ? $in['month'] : null;
$months = [];
if (is_array($monthInput)) {
    $months = $monthInput;
} elseif (is_string($monthInput)) {
    $months = explode(',', $monthInput); // Por si viene separado por comas
}
$months = array_filter($months); // Limpiar vacíos

$con = conectar();
$con->set_charset('utf8mb4');

$where = ["status = 1"];
$types = "";
$params = [];

if ($dept_id !== null) {
    $where[] = "departamento_id = ?";
    $types .= "i";
    $params[] = &$dept_id;
}

// INYECCIÓN SEGURA PARA MÚLTIPLES MESES
if (!empty($months)) {
    $placeholders = implode(',', array_fill(0, count($months), '?'));
    $where[] = "DATE_FORMAT(created_at, '%Y-%m') IN ($placeholders)";
    foreach ($months as &$m) {
        $types .= "s";
        $params[] = &$m;
    }
}

$whereClause = implode(" AND ", $where);

// 1. Promedio Semanal
$sqlSemana = "SELECT AVG(conteo) as promedio_semanal FROM (
                SELECT COUNT(*) as conteo FROM requerimiento 
                WHERE $whereClause GROUP BY YEARWEEK(created_at, 1)
              ) as semanas";

$promedio_semanal = 0;
$stmt1 = $con->prepare($sqlSemana);
if ($stmt1) {
    if ($types !== "") call_user_func_array([$stmt1, 'bind_param'], array_merge([$types], $params));
    $stmt1->execute();
    $res1 = $stmt1->get_result()->fetch_assoc();
    $promedio_semanal = $res1 && $res1['promedio_semanal'] ? round((float)$res1['promedio_semanal'], 1) : 0;
    $stmt1->close();
}

// 2. Tiempo Promedio
$sqlTiempo = "SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, cerrado_en) / 24) as dias_promedio 
              FROM requerimiento 
              WHERE $whereClause AND cerrado_en IS NOT NULL AND estatus = 6";

$tiempo_resolucion = 0;
$stmt2 = $con->prepare($sqlTiempo);
if ($stmt2) {
    if ($types !== "") call_user_func_array([$stmt2, 'bind_param'], array_merge([$types], $params));
    $stmt2->execute();
    $res2 = $stmt2->get_result()->fetch_assoc();
    $tiempo_resolucion = $res2 && $res2['dias_promedio'] ? round((float)$res2['dias_promedio'], 1) : 0;
    $stmt2->close();
}

echo json_encode([
    "ok" => true,
    "promedio_semanal" => $promedio_semanal,
    "tiempo_resolucion" => $tiempo_resolucion
]);

$con->close();
?>
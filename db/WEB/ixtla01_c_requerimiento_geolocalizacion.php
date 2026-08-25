<?php
require_once __DIR__.'/_requerimiento_geolocalizacion.php';
[$con, $in] = geo_bootstrap(['GET', 'POST']);

$id = isset($in['id']) ? (int)$in['id'] : 0;
$requerimientoId = isset($in['requerimiento_id']) ? (int)$in['requerimiento_id'] : 0;
$includeInactive = isset($in['include_inactive']) && (int)$in['include_inactive'] === 1;
if ($id < 1 && $requerimientoId < 1) geo_json(422, ['ok' => false, 'error' => 'Envía id o requerimiento_id']);

if ($id > 0) {
  $row = geo_select_by_id($con, $id);
  $con->close();
  if (!$row || (!$includeInactive && $row['status'] !== 1)) geo_json(404, ['ok' => false, 'error' => 'Geolocalización no encontrada']);
  geo_json(200, ['ok' => true, 'data' => $row]);
}

$sql = 'SELECT id, requerimiento_id, latitud, longitud, precision_metros, direccion, cp_colonia_geo, validada, status, created_at, updated_by, updated_at FROM requerimiento_geolocalizacion WHERE requerimiento_id=?'.($includeInactive ? '' : ' AND status=1').' ORDER BY created_at DESC, id DESC';
$stmt = $con->prepare($sql);
if (!$stmt) geo_json(500, ['ok' => false, 'error' => 'No se pudo preparar la consulta']);
$stmt->bind_param('i', $requerimientoId);
if (!$stmt->execute()) geo_json(500, ['ok' => false, 'error' => 'No se pudo consultar la geolocalización']);
$rows = [];
$result = $stmt->get_result();
while ($row = $result->fetch_assoc()) $rows[] = geo_cast_row($row);
$stmt->close();
$con->close();
geo_json(200, ['ok' => true, 'data' => $rows, 'meta' => ['total' => count($rows)]]);

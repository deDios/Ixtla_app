<?php
require_once __DIR__.'/_requerimiento_geolocalizacion.php';
[$con, $in] = geo_bootstrap(['PUT', 'PATCH']);
date_default_timezone_set('America/Mexico_City');

$id = isset($in['id']) ? (int)$in['id'] : 0;
if ($id < 1) geo_json(422, ['ok' => false, 'error' => 'id es obligatorio']);
$identity = geo_require_validation_permission($con, $id);
$updatedBy = $identity['empleado_id'];

$allowed = ['latitud', 'longitud', 'precision_metros', 'presicion_metros', 'direccion', 'cp_colonia_geo', 'validada', 'status'];
$hasChange = false;
foreach ($allowed as $key) if (array_key_exists($key, $in)) { $hasChange = true; break; }
if (!$hasChange) geo_json(422, ['ok' => false, 'error' => 'No hay campos para actualizar']);

$parts = []; $types = ''; $params = [];
if (array_key_exists('latitud', $in)) {
  $value = filter_var($in['latitud'], FILTER_VALIDATE_FLOAT);
  if ($value === false || $value < -90 || $value > 90) geo_json(422, ['ok' => false, 'error' => 'latitud debe estar entre -90 y 90']);
  $parts[] = 'latitud=?'; $types .= 'd'; $params[] = $value;
}
if (array_key_exists('longitud', $in)) {
  $value = filter_var($in['longitud'], FILTER_VALIDATE_FLOAT);
  if ($value === false || $value < -180 || $value > 180) geo_json(422, ['ok' => false, 'error' => 'longitud debe estar entre -180 y 180']);
  $parts[] = 'longitud=?'; $types .= 'd'; $params[] = $value;
}
if (array_key_exists('precision_metros', $in) || array_key_exists('presicion_metros', $in)) {
  $raw = $in['precision_metros'] ?? $in['presicion_metros'];
  $value = ($raw === null || $raw === '') ? null : filter_var($raw, FILTER_VALIDATE_FLOAT);
  if ($value === false || ($value !== null && ($value < 0 || $value > 100000))) geo_json(422, ['ok' => false, 'error' => 'precision_metros no es válida']);
  $parts[] = 'precision_metros=?'; $types .= 'd'; $params[] = $value;
}
foreach ([['direccion', 255], ['cp_colonia_geo', 150]] as [$key, $max]) {
  if (array_key_exists($key, $in)) { $value = geo_nullable_string($in, $key, $max); $parts[] = "$key=?"; $types .= 's'; $params[] = $value; }
}
if (array_key_exists('status', $in)) {
  $value = (int)$in['status']; if (!in_array($value, [0, 1], true)) geo_json(422, ['ok' => false, 'error' => 'status debe ser 0 o 1']);
  $parts[] = 'status=?'; $types .= 'i'; $params[] = $value;
}
if (array_key_exists('validada', $in)) {
  $value = (int)(bool)$in['validada'];
  $parts[] = 'validada=?'; $types .= 'i'; $params[] = $value;
}
$parts[] = 'updated_by=?'; $types .= 'i'; $params[] = $updatedBy;
$types .= 'i'; $params[] = $id;
$stmt = $con->prepare('UPDATE requerimiento_geolocalizacion SET '.implode(', ', $parts).' WHERE id=?');
if (!$stmt) geo_json(500, ['ok' => false, 'error' => 'No se pudo preparar la actualización']);
$bind = [$types]; foreach ($params as $key => $value) $bind[] = &$params[$key];
call_user_func_array([$stmt, 'bind_param'], $bind);
if (!$stmt->execute()) geo_json(500, ['ok' => false, 'error' => 'No se pudo actualizar la geolocalización']);
$affected = $stmt->affected_rows; $stmt->close();
$row = geo_select_by_id($con, $id); $con->close();
if (!$row) geo_json(404, ['ok' => false, 'error' => 'Geolocalización no encontrada']);
geo_json(200, ['ok' => true, 'data' => $row, 'meta' => ['affected_rows' => $affected]]);

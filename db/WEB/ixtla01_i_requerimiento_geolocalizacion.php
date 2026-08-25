<?php
require_once __DIR__.'/_requerimiento_geolocalizacion.php';
[$con, $in] = geo_bootstrap(['POST']);
date_default_timezone_set('America/Mexico_City');

$requerimientoId = isset($in['requerimiento_id']) ? (int)$in['requerimiento_id'] : 0;
$latitud = filter_var($in['latitud'] ?? null, FILTER_VALIDATE_FLOAT);
$longitud = filter_var($in['longitud'] ?? null, FILTER_VALIDATE_FLOAT);
$precisionInput = $in['precision_metros'] ?? ($in['presicion_metros'] ?? null);
$precision = ($precisionInput === null || $precisionInput === '') ? null : filter_var($precisionInput, FILTER_VALIDATE_FLOAT);
$direccion = geo_nullable_string($in, 'direccion', 255);
$cp = geo_nullable_string($in, 'cp_colonia_geo', 150);

if ($requerimientoId < 1) geo_json(422, ['ok' => false, 'error' => 'requerimiento_id es obligatorio']);
if ($latitud === false || $latitud < -90 || $latitud > 90) geo_json(422, ['ok' => false, 'error' => 'latitud debe estar entre -90 y 90']);
if ($longitud === false || $longitud < -180 || $longitud > 180) geo_json(422, ['ok' => false, 'error' => 'longitud debe estar entre -180 y 180']);
if ($precision === false || ($precision !== null && ($precision < 0 || $precision > 100000))) geo_json(422, ['ok' => false, 'error' => 'precision_metros no es válida']);

$check = $con->prepare('SELECT id FROM requerimiento WHERE id=? LIMIT 1');
$check->bind_param('i', $requerimientoId);
$check->execute();
if (!$check->get_result()->fetch_assoc()) geo_json(404, ['ok' => false, 'error' => 'Requerimiento no encontrado']);
$check->close();

$stmt = $con->prepare('INSERT INTO requerimiento_geolocalizacion (requerimiento_id, latitud, longitud, precision_metros, direccion, cp_colonia_geo, validada, status) VALUES (?, ?, ?, ?, ?, ?, 0, 1)');
if (!$stmt) geo_json(500, ['ok' => false, 'error' => 'No se pudo preparar el registro de geolocalización']);
$stmt->bind_param('idddss', $requerimientoId, $latitud, $longitud, $precision, $direccion, $cp);
if (!$stmt->execute()) geo_json(500, ['ok' => false, 'error' => 'No se pudo registrar la geolocalización']);
$id = (int)$con->insert_id;
$stmt->close();
$row = geo_select_by_id($con, $id);
$con->close();
geo_json(201, ['ok' => true, 'data' => $row]);

<?php
declare(strict_types=1);

/** Endpoint interno para inspeccionar o refrescar el snapshot del alcance actual. */
ob_start();
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/datasets/requerimientos_snapshot.php';

ixtla_insights_bootstrap(['POST']);
$body = ixtla_insights_request_body();
$action = (string) ($body['action'] ?? 'status');
if (!in_array($action, ['status', 'refresh'], true)) {
    ixtla_insights_json(['ok' => false, 'error' => 'Accion de dataset no valida.'], 422);
}

try {
    $overview = ixtla_insights_snapshot_overview(['refresh' => $action === 'refresh']);
    ixtla_insights_json(['ok' => true, 'action' => $action, 'data' => $overview]);
} catch (Throwable $error) {
    ixtla_insights_log_error('dataset_snapshot', $error, ['action' => $action]);
    ixtla_insights_json(['ok' => false, 'error' => 'No fue posible preparar el dataset.'], 503);
}

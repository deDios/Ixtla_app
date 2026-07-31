<?php
declare(strict_types=1);

/**
 * Fuente API paginada del builder. Expone sólo registros dentro del RBAC del
 * usuario autenticado y mantiene todos los estatus operativos vigentes.
 */
ob_start();
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/datasets/requerimientos_snapshot.php';

ixtla_insights_bootstrap(['POST']);
$body = ixtla_insights_request_body();
$page = max(1, (int) ($body['page'] ?? 1));
$perPage = min(1000, max(100, (int) ($body['per_page'] ?? ixtla_insights_config()['dataset_page_size'])));

try {
    $connection = ixtla_insights_dataset_connection();
    try {
        $scope = ixtla_insights_dataset_scope($connection);
        $total = ixtla_insights_dataset_scalar(
            $connection,
            'SELECT COUNT(*) FROM requerimiento r WHERE ' . implode(' AND ', $scope['where']),
            $scope['types'],
            $scope['params']
        );
        $data = ixtla_insights_snapshot_source_page($connection, $scope, $perPage, ($page - 1) * $perPage);
    } finally {
        $connection->close();
    }
    ixtla_insights_json([
        'ok' => true,
        'dataset' => 'requirements_source_v1',
        'scope' => ['mode' => $scope['mode'], 'label' => $scope['label']],
        'page' => $page,
        'per_page' => $perPage,
        'total_records' => $total,
        'data' => $data,
    ]);
} catch (Throwable $error) {
    ixtla_insights_log_error('requirements_source', $error);
    ixtla_insights_json(['ok' => false, 'error' => 'No fue posible obtener la fuente de requerimientos.'], 503);
}

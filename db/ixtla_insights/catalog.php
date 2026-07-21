<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$config = ixtla_insights_bootstrap(['GET']);
ixtla_insights_json([
    'ok' => true,
    'catalog' => [
        'domain' => 'requerimientos',
        'widget_kinds' => ['kpi', 'bar', 'donut', 'line', 'area', 'table', 'funnel'],
        'metrics' => ['total', 'abiertos', 'finalizados', 'pausados_cancelados', 'pausados', 'cancelados', 'cerrados', 'promedio_semanal', 'tiempo_resolucion'],
        'dimensions' => ['estatus', 'tramite', 'departamento', 'fecha'],
        'periods' => ['all', 'last_7', 'last_30', 'this_month'],
    ],
]);

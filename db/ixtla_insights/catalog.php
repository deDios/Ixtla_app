<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$config = ixtla_insights_bootstrap(['GET']);
ixtla_insights_json([
    'ok' => true,
    'catalog' => [
        'domain' => 'requerimientos',
        'widget_kinds' => ['kpi', 'bar', 'donut', 'line', 'table'],
        'metrics' => ['total', 'finalizados'],
        'dimensions' => ['estatus', 'tramite', 'departamento', 'fecha'],
    ],
]);

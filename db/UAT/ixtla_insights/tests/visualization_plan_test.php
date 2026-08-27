<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/visualization_plan_contract.php';

function expect_visual_plan(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$trend = ixtla_visual_plan_normalize([
    'intent' => 'create', 'domain' => 'retroalimentaciones', 'chart' => 'line', 'metric' => 'total',
    'dimension' => 'calificacion', 'period' => 'last_30', 'comparison' => 'previous_period',
    'filters' => [['field' => 'calificacion', 'value' => 'Excelente']], 'limit' => 500,
]);
expect_visual_plan($trend['metric'] === 'retro_total', 'Debe corregir metricas incompatibles con el dominio.');
expect_visual_plan($trend['dimension'] === 'fecha', 'Una tendencia debe agruparse por fecha.');
expect_visual_plan($trend['limit'] === 50, 'Debe acotar el numero de categorias.');
$trend = ixtla_visual_plan_resolve_filters($trend);
expect_visual_plan(($trend['filters'][0]['id'] ?? null) === 4, 'Debe resolver una calificacion a su identificador permitido.');

$donut = ixtla_visual_plan_normalize([
    'intent' => 'edit', 'domain' => 'requerimientos', 'chart' => 'donut', 'metric' => 'total',
    'dimension' => 'fecha', 'period' => 'this_month', 'comparison' => '', 'filters' => [],
]);
expect_visual_plan($donut['dimension'] === 'estatus', 'Una dona no debe usar fechas como categorias.');

$comparison = ixtla_visual_plan_normalize([
    'intent' => 'create', 'domain' => 'requerimientos', 'chart' => 'bar', 'metric' => 'total',
    'dimension' => 'tramite', 'period' => 'all', 'comparison' => 'previous_period', 'filters' => [],
]);
expect_visual_plan($comparison['needs_clarification'] === true, 'Una comparacion debe tener un periodo acotado.');

echo "OK visualization plan\n";

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

$category = ixtla_visual_plan_normalize([
    'intent' => 'create', 'domain' => 'retroalimentaciones', 'chart' => 'line', 'metric' => 'total',
    'dimension' => 'calificacion', 'period' => 'last_30', 'comparison' => 'previous_period',
    'filters' => [['field' => 'calificacion', 'value' => 'Excelente']], 'limit' => 500,
]);
expect_visual_plan($category['metric'] === 'retro_total', 'Debe corregir metricas incompatibles con el dominio.');
expect_visual_plan($category['dimension'] === 'calificacion', 'Debe conservar la dimension solicitada.');
expect_visual_plan($category['chart'] === 'bar', 'Una categoria no debe representarse como linea temporal.');
expect_visual_plan($category['title'] === 'Retroalimentaciones por calificación', 'El titulo debe describir la dimension real.');
expect_visual_plan($category['limit'] === 50, 'Debe acotar el numero de categorias.');
$category = ixtla_visual_plan_resolve_filters($category);
expect_visual_plan(($category['filters'][0]['id'] ?? null) === 4, 'Debe resolver una calificacion a su identificador permitido.');

$status = ixtla_visual_plan_normalize([
    'intent' => 'create', 'domain' => 'requerimientos', 'chart' => 'line', 'metric' => 'total',
    'dimension' => 'estatus', 'period' => 'all', 'comparison' => '', 'filters' => [],
]);
expect_visual_plan($status['dimension'] === 'fecha', 'Una linea por estatus debe usar el tiempo como eje horizontal.');
expect_visual_plan($status['series_dimension'] === 'estatus', 'El estatus debe convertirse en la dimension de series.');
expect_visual_plan($status['chart'] === 'line', 'La solicitud explicita de lineas debe conservarse.');
expect_visual_plan($status['title'] === 'Tendencia de requerimientos por estatus', 'El titulo debe explicar el tiempo y las series.');
expect_visual_plan(str_contains($status['reason'], 'comparar'), 'Debe explicar la comparacion multiserie en lenguaje sencillo.');

$matrix = ixtla_visual_plan_normalize([
    'intent' => 'create', 'domain' => 'requerimientos', 'chart' => 'matrix', 'metric' => 'total',
    'dimension' => 'departamento', 'series_dimension' => 'estatus', 'date_grain' => 'month',
    'series_limit' => 20, 'period' => 'last_30', 'comparison' => '', 'filters' => [],
]);
expect_visual_plan($matrix['chart'] === 'matrix', 'Debe conservar una matriz compatible con requerimientos.');
expect_visual_plan($matrix['dimension'] === 'departamento' && $matrix['series_dimension'] === 'estatus', 'La matriz debe conservar sus dos dimensiones.');
expect_visual_plan($matrix['series_limit'] === 7, 'Debe acotar el numero de series legibles.');

$donut = ixtla_visual_plan_normalize([
    'intent' => 'edit', 'domain' => 'requerimientos', 'chart' => 'donut', 'metric' => 'total',
    'dimension' => 'fecha', 'period' => 'this_month', 'comparison' => '', 'filters' => [],
]);
expect_visual_plan($donut['dimension'] === 'fecha', 'Debe conservar la dimension temporal solicitada.');
expect_visual_plan($donut['chart'] === 'line', 'Una dona temporal debe convertirse en una linea.');
expect_visual_plan($donut['title'] === 'Tendencia de requerimientos', 'El titulo temporal debe coincidir con la consulta.');

$comparison = ixtla_visual_plan_normalize([
    'intent' => 'create', 'domain' => 'requerimientos', 'chart' => 'bar', 'metric' => 'total',
    'dimension' => 'tramite', 'period' => 'all', 'comparison' => 'previous_period', 'filters' => [],
]);
expect_visual_plan($comparison['needs_clarification'] === true, 'Una comparacion debe tener un periodo acotado.');

echo "OK visualization plan\n";

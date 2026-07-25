<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/conversation_service.php';

function expect_report(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$comparison = ixtla_insights_report_analytics_plan([
    'intent' => 'comparison',
    'metric' => 'abiertos',
    'dimension' => 'departamento',
    'period' => 'last_30',
    'filters' => [['field' => 'departamento', 'value' => 'SAMAPA']],
    'sort' => 'desc',
    'limit' => 10,
]);
expect_report($comparison['kind'] === 'table', 'Una comparación debe usar una agregación tabular.');
expect_report($comparison['metric'] === 'abiertos', 'La métrica debe conservarse en el plan de analytics.');

$trend = ixtla_insights_report_analytics_plan([
    'intent' => 'trend',
    'metric' => 'total',
    'dimension' => 'fecha',
    'period' => 'last_30',
    'filters' => [],
    'sort' => 'chronological',
    'limit' => 50,
]);
expect_report($trend['kind'] === 'line', 'Una tendencia debe usar una agregación de línea.');
expect_report($trend['dimension'] === 'fecha', 'Una tendencia debe conservar la dimensión fecha.');

$metric = ixtla_insights_report_analytics_plan([
    'intent' => 'metric_query',
    'metric' => 'tiempo_resolucion',
    'dimension' => 'estatus',
    'period' => 'all',
    'filters' => [],
    'sort' => 'desc',
    'limit' => 50,
]);
expect_report($metric['kind'] === 'kpi' && $metric['limit'] === 1, 'Una consulta de cifra debe ejecutarse como KPI.');

$normalizedComparison = ixtla_insights_normalize_report_plan([
    'intent' => 'comparison',
    'title' => 'Pendientes por departamento',
    'metric' => 'abiertos',
    'dimension' => 'departamento',
    'period' => 'last_30',
    'scope' => 'selected',
    'filters' => [
        ['field' => 'departamento', 'value' => 'SAMAPA'],
        ['field' => 'departamento', 'value' => 'Alumbrado Público'],
    ],
    'sort' => 'desc',
    'limit' => 10,
    'include_summary' => true,
], [
    ['id' => 1, 'nombre' => 'SAMAPA'],
    ['id' => 2, 'nombre' => 'Alumbrado Público'],
]);
expect_report(is_array($normalizedComparison), 'La comparación debe aceptar departamentos autorizados.');

$invalidComparison = ixtla_insights_normalize_report_plan([
    'intent' => 'comparison',
    'title' => 'Comparación incompleta',
    'metric' => 'abiertos',
    'dimension' => 'departamento',
    'period' => 'last_30',
    'scope' => 'selected',
    'filters' => [['field' => 'departamento', 'value' => 'SAMAPA']],
    'sort' => 'desc',
    'limit' => 10,
    'include_summary' => true,
], [['id' => 1, 'nombre' => 'SAMAPA']]);
expect_report($invalidComparison === null, 'Una comparación debe requerir al menos dos departamentos autorizados.');

echo "OK report plan\n";

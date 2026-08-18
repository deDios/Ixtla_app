<?php
declare(strict_types=1);

/**
 * Contratos de dominio de Ixtla Insights.
 *
 * Esta es la lista de valores que puede aceptar cualquier frontera del
 * sistema (chat, API analítica y widgets). El modelo y el navegador no son
 * una fuente de autoridad para estos valores.
 */
function ixtla_insights_catalog(): array
{
    return [
        'version' => 2,
        'domain' => 'requerimientos',
        'widget_kinds' => ['kpi', 'bar', 'donut', 'line', 'area', 'table', 'funnel'],
        'metrics' => ['total', 'abiertos', 'finalizados', 'pausados_cancelados', 'pausados', 'cancelados', 'cerrados', 'promedio_semanal', 'tiempo_resolucion'],
        'dimensions' => ['estatus', 'tramite', 'departamento', 'fecha'],
        'periods' => ['all', 'last_7', 'last_30', 'this_month'],
        'scopes' => ['all', 'selected'],
        'sorts' => ['desc', 'asc', 'chronological'],
        'filter_fields' => ['departamento', 'tramite', 'estatus'],
        'report_intents' => ['metric_query', 'breakdown', 'comparison', 'ranking', 'trend'],
        'metric_rules' => [
            'kpi_only' => ['promedio_semanal', 'tiempo_resolucion'],
            'fixed_status' => ['finalizados', 'pausados', 'cancelados', 'pausados_cancelados'],
        ],
    ];
}

function ixtla_insights_catalog_values(string $key): array
{
    $catalog = ixtla_insights_catalog();
    return is_array($catalog[$key] ?? null) ? $catalog[$key] : [];
}

function ixtla_insights_catalog_contains(string $key, string $value): bool
{
    return in_array($value, ixtla_insights_catalog_values($key), true);
}

function ixtla_insights_is_kpi_only_metric(string $metric): bool
{
    return in_array($metric, ['promedio_semanal', 'tiempo_resolucion'], true);
}

function ixtla_insights_is_fixed_status_metric(string $metric): bool
{
    return in_array($metric, ['finalizados', 'pausados', 'cancelados', 'pausados_cancelados'], true);
}

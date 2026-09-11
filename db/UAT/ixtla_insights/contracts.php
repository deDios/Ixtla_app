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
        'version' => 7,
        'domain' => 'requerimientos_y_retroalimentaciones',
        'domains' => ['requerimientos', 'retroalimentaciones'],
        'widget_kinds' => ['kpi', 'bar', 'donut', 'line', 'area', 'table', 'matrix'],
        'metrics' => ['total', 'abiertos', 'finalizados', 'pausados_cancelados', 'pausados', 'cancelados', 'cerrados', 'retro_total', 'tasa_respuesta', 'promedio_calificacion'],
        'dimensions' => ['estatus', 'tramite', 'departamento', 'fecha', 'calificacion', 'estado_retro'],
        'series_dimensions' => ['', 'estatus', 'tramite', 'departamento'],
        'date_grains' => ['day', 'week', 'month'],
        'periods' => ['all', 'this_week', 'last_7', 'last_30', 'this_month'],
        'scopes' => ['all', 'selected'],
        'sorts' => ['desc', 'asc', 'chronological'],
        'filter_fields' => ['departamento', 'tramite', 'estatus', 'calificacion', 'estado_retro'],
        'report_intents' => ['metric_query', 'breakdown', 'comparison', 'ranking', 'trend'],
        'metric_rules' => [
            'kpi_only' => [],
            'fixed_status' => ['finalizados', 'cerrados', 'pausados', 'cancelados', 'pausados_cancelados'],
        ],
        'data_semantics' => [
            'record_inclusion' => 'Registros operativos del alcance autorizado; las metricas de abiertos limitan el universo a Solicitud, Revision, Asignacion y En proceso.',
            'created_at' => 'Carga y entradas: fecha de registro.',
            'closed_at' => 'Cierres: solo estatus Finalizado.',
            'started_at' => 'Inicio de atención; no es vencimiento ni SLA.',
            'priority' => 'Legado no analítico.',
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
    return false;
}

function ixtla_insights_is_fixed_status_metric(string $metric): bool
{
    return in_array($metric, ['finalizados', 'cerrados', 'pausados', 'cancelados', 'pausados_cancelados'], true);
}

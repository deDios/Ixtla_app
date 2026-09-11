<?php
declare(strict_types=1);

/**
 * Contrato semantico compartido por perfil, datasets, herramientas y reportes.
 * Cambiar una regla incompatible exige incrementar version y schema_version.
 * Ningun valor de este contrato modifica el esquema de MySQL.
 */
function ixtla_insights_data_contract(): array
{
    return [
        'version' => 8,
        'domain' => 'requerimientos_y_retroalimentaciones',
        'profile_version' => 21,
        'snapshot' => [
            'dataset' => 'requerimientos_scope_v8',
            'schema_version' => 8,
        ],
        'periods' => [
            'all' => 'Todo el historial disponible',
            'this_week' => 'Semana en curso',
            'last_7' => 'Últimos 7 días',
            'last_30' => 'Últimos 30 días',
            'this_month' => 'Mes en curso',
        ],
        'dates' => [
            'created_at' => [
                'label' => 'Fecha de creación del requerimiento',
                'purpose' => 'Carga y entradas',
            ],
            'started_at' => [
                'label' => 'Fecha de inicio de atención',
                'source_field' => 'fecha_limite',
                'purpose' => 'Inicio de atención; nunca vencimiento ni SLA',
                'deadline' => false,
            ],
            'closed_at' => [
                'label' => 'Fecha de cierre válida de requerimientos en estatus Finalizado',
                'purpose' => 'Cierres de requerimientos finalizados',
                'required_status_ids' => [6],
            ],
        ],
        'status_groups' => [
            'active' => [0, 1, 2, 3],
            'paused' => [4],
            'cancelled' => [5],
            'finalized' => [6],
            'paused_or_cancelled' => [4, 5],
            'closed' => [6],
        ],
        'operational_attention' => [
            'mode' => 'operational_attention_only',
            'deadline_enabled' => false,
            'signals' => ['age', 'unassigned', 'status', 'recent_activity', 'open_tasks'],
        ],
        'welcome' => [
            'summary_period' => 'all',
            'trend_period' => 'last_30',
            'comparison_period' => 'previous_30',
        ],
    ];
}

/**
 * Contratos de dominio de Ixtla Insights.
 *
 * Esta es la lista de valores que puede aceptar cualquier frontera del
 * sistema (chat, API analítica y widgets). El modelo y el navegador no son
 * una fuente de autoridad para estos valores.
 */
function ixtla_insights_catalog(): array
{
    $contract = ixtla_insights_data_contract();
    return [
        'version' => $contract['version'],
        'schema_version' => $contract['snapshot']['schema_version'],
        'profile_version' => $contract['profile_version'],
        'domain' => $contract['domain'],
        'domains' => ['requerimientos', 'retroalimentaciones'],
        'widget_kinds' => ['kpi', 'bar', 'donut', 'line', 'area', 'table', 'matrix'],
        'metrics' => ['total', 'abiertos', 'finalizados', 'pausados_cancelados', 'pausados', 'cancelados', 'cerrados', 'retro_total', 'tasa_respuesta', 'promedio_calificacion'],
        'dimensions' => ['estatus', 'tramite', 'departamento', 'fecha', 'calificacion', 'estado_retro'],
        'series_dimensions' => ['', 'estatus', 'tramite', 'departamento'],
        'date_grains' => ['day', 'week', 'month'],
        'periods' => array_keys($contract['periods']),
        'scopes' => ['all', 'selected'],
        'sorts' => ['desc', 'asc', 'chronological'],
        'filter_fields' => ['departamento', 'tramite', 'estatus', 'calificacion', 'estado_retro'],
        'report_intents' => ['metric_query', 'breakdown', 'comparison', 'ranking', 'trend'],
        'metric_rules' => [
            'kpi_only' => [],
            'fixed_status' => ['finalizados', 'cerrados', 'pausados', 'cancelados', 'pausados_cancelados'],
        ],
        'data_semantics' => [
            'status_groups' => $contract['status_groups'],
            'operational_attention' => $contract['operational_attention'],
            'record_inclusion' => 'Registros operativos del alcance autorizado; las metricas de abiertos limitan el universo a Solicitud, Revision, Asignacion y En proceso.',
            'created_at' => $contract['dates']['created_at']['purpose'],
            'closed_at' => $contract['dates']['closed_at']['purpose'],
            'started_at' => $contract['dates']['started_at']['purpose'],
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

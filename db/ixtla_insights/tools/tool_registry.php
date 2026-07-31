<?php
declare(strict_types=1);

require_once __DIR__ . '/../datasets/requerimientos_dataset.php';
require_once __DIR__ . '/../datasets/requerimientos_snapshot.php';

function ixtla_insights_tool_definitions(): array
{
    return [
        [
            'type' => 'function',
            'name' => 'get_requirements_dataset_overview',
            'description' => 'Obtiene KPIs, estatus y tramites principales desde el snapshot analitico cacheado del alcance autorizado. Usa refresh=true solo si el usuario pide actualizar los datos.',
            'strict' => true,
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false, 'required' => ['refresh'],
                'properties' => ['refresh' => ['type' => 'boolean']],
            ],
        ],
        [
            'type' => 'function',
            'name' => 'search_requirements_dataset',
            'description' => 'Consulta filas reales del snapshot analitico cacheado mediante filtros cerrados. Usala para listas de requerimientos recientes, por estatus, departamento, asignacion o vencimiento. Devuelve maximo 50 filas y no incluye datos de contacto ciudadanos.',
            'strict' => true,
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false,
                'required' => ['period', 'department_id', 'status_ids', 'assignee_state', 'deadline_state', 'sort', 'limit'],
                'properties' => [
                    'period' => ['type' => 'string', 'enum' => ['all', 'last_7', 'last_30', 'this_month']],
                    'department_id' => ['type' => 'integer', 'minimum' => 0],
                    'status_ids' => ['type' => 'array', 'items' => ['type' => 'integer', 'enum' => [0, 1, 2, 3, 4, 5, 6]]],
                    'assignee_state' => ['type' => 'string', 'enum' => ['any', 'assigned', 'unassigned']],
                    'deadline_state' => ['type' => 'string', 'enum' => ['any', 'overdue', 'due_soon', 'without_due_date']],
                    'sort' => ['type' => 'string', 'enum' => ['newest', 'oldest']],
                    'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50],
                ],
            ],
        ],
        [
            'type' => 'function',
            'name' => 'aggregate_requirements_dataset',
            'description' => 'Calcula conteos y rankings desde el snapshot analitico cacheado. Agrupa los requerimientos filtrados por estatus, departamento, tramite o responsable. Usa esta herramienta para totales, comparativas y rankings normales.',
            'strict' => true,
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false,
                'required' => ['period', 'department_id', 'status_ids', 'assignee_state', 'deadline_state', 'group_by', 'sort', 'limit'],
                'properties' => [
                    'period' => ['type' => 'string', 'enum' => ['all', 'last_7', 'last_30', 'this_month']],
                    'department_id' => ['type' => 'integer', 'minimum' => 0],
                    'status_ids' => ['type' => 'array', 'items' => ['type' => 'integer', 'enum' => [0, 1, 2, 3, 4, 5, 6]]],
                    'assignee_state' => ['type' => 'string', 'enum' => ['any', 'assigned', 'unassigned']],
                    'deadline_state' => ['type' => 'string', 'enum' => ['any', 'overdue', 'due_soon', 'without_due_date']],
                    'group_by' => ['type' => 'string', 'enum' => ['status', 'department', 'tramite', 'assignee']],
                    'sort' => ['type' => 'string', 'enum' => ['asc', 'desc']],
                    'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50],
                ],
            ],
        ],
        [
            'type' => 'function',
            'name' => 'get_requirement_dataset_detail',
            'description' => 'Busca un requerimiento concreto dentro del snapshot por id o folio. Usa esta herramienta cuando el usuario escriba un folio como REQ-0000018117 o pida quien solicito un requerimiento concreto.',
            'strict' => true,
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false, 'required' => ['id', 'folio'],
                'properties' => [
                    'id' => ['type' => ['integer', 'null'], 'minimum' => 1],
                    'folio' => ['type' => ['string', 'null'], 'minLength' => 1, 'maxLength' => 80],
                ],
            ],
        ],
        [
            'type' => 'function',
            'name' => 'query_requirements_analytics',
            'description' => 'Consulta agregados reales de requerimientos: total, abiertos, finalizados o pausados/cancelados; permite desglose o ranking por departamento o trámite.',
            'strict' => true,
            'parameters' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['metric', 'group_by', 'period', 'ranking'],
                'properties' => [
                    'metric' => ['type' => 'string', 'enum' => ['total', 'open_count', 'closed_count', 'paused_cancelled_count']],
                    'group_by' => ['type' => 'string', 'enum' => ['none', 'department', 'tramite']],
                    'period' => [
                        'type' => 'object', 'additionalProperties' => false, 'required' => ['field', 'preset'],
                        'properties' => [
                            'field' => ['type' => 'string', 'enum' => ['created_at', 'closed_at']],
                            'preset' => ['type' => 'string', 'enum' => ['all', 'last_7', 'last_30', 'this_month']],
                        ],
                    ],
                    'ranking' => [
                        'type' => 'object', 'additionalProperties' => false, 'required' => ['sort', 'limit'],
                        'properties' => [
                            'sort' => ['type' => 'string', 'enum' => ['asc', 'desc']],
                            'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 25],
                        ],
                    ],
                ],
            ],
        ],
        [
            'type' => 'function',
            'name' => 'get_scope_summary',
            'description' => 'Obtiene el total real de requerimientos y su desglose por estatus dentro del alcance autorizado del usuario.',
            'strict' => true,
            'parameters' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['period'],
                'properties' => [
                    'period' => ['type' => 'string', 'enum' => ['all', 'last_7', 'last_30', 'this_month']],
                ],
            ],
        ],
        [
            'type' => 'function',
            'name' => 'get_operational_snapshot',
            'description' => 'Obtiene un reporte ejecutivo real para el alcance autorizado: total de requerimientos, desglose por estatus y trámites con mayor volumen. Úsala para diagnósticos operativos y resúmenes directivos.',
            'strict' => true,
            'parameters' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['period', 'top_tramites_limit'],
                'properties' => [
                    'period' => ['type' => 'string', 'enum' => ['all', 'last_7', 'last_30', 'this_month']],
                    'top_tramites_limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 10],
                ],
            ],
        ],
        [
            'type' => 'function',
            'name' => 'get_operational_risk_snapshot',
            'description' => 'Returns a single authorized operational risk diagnosis: statuses, active and paused requirements, unassigned work, overdue and upcoming due dates, and top procedures. Use it when the request combines multiple operational metrics or asks for priorities and recommendations.',
            'strict' => true,
            'parameters' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['period', 'top_tramites_limit', 'due_window_days'],
                'properties' => [
                    'period' => ['type' => 'string', 'enum' => ['last_7', 'last_30', 'this_month']],
                    'top_tramites_limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 10],
                    'due_window_days' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 30],
                ],
            ],
        ],
        [
            'type' => 'function',
            'name' => 'get_workload_trend_snapshot',
            'description' => 'Returns a single authorized workload analysis: current versus previous period, peak days, and the procedures contributing most to demand. Use for increases, decreases, trends, variability, or peak-day questions.',
            'strict' => true,
            'parameters' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['period', 'top_tramites_limit'],
                'properties' => [
                    'period' => ['type' => 'string', 'enum' => ['last_7', 'last_30', 'this_month']],
                    'top_tramites_limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 10],
                ],
            ],
        ],
        [
            'type' => 'function',
            'name' => 'get_backlog_risk_snapshot',
            'description' => 'Returns a single authorized backlog diagnosis: active requirements by age and priority, unassigned work, and assignees and procedures with the largest backlog. Use for blocked cases, backlog, or pending-work distribution questions.',
            'strict' => true,
            'parameters' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['top_limit'],
                'properties' => [
                    'top_limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 10],
                ],
            ],
        ],
        [
            'type' => 'function',
            'name' => 'get_backlog_aging',
            'description' => 'Obtiene la antigüedad real de los requerimientos pendientes activos del alcance autorizado, agrupada en 0-7, 8-15, 16-30 y más de 30 días.',
            'strict' => true,
            'parameters' => ['type' => 'object', 'additionalProperties' => false, 'required' => [], 'properties' => new stdClass()],
        ],
        [
            'type' => 'function',
            'name' => 'get_period_comparison',
            'description' => 'Compara el periodo actual contra el periodo inmediato anterior para total, requerimientos abiertos o finalizados dentro del alcance autorizado.',
            'strict' => true,
            'parameters' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['metric', 'period'],
                'properties' => [
                    'metric' => ['type' => 'string', 'enum' => ['total', 'open_count', 'closed_count']],
                    'period' => ['type' => 'string', 'enum' => ['last_7', 'last_30', 'this_month']],
                ],
            ],
        ],
        [
            'type' => 'function',
            'name' => 'get_requirements_trend',
            'description' => 'Obtiene una serie diaria real de requerimientos creados para analizar la tendencia de carga dentro del alcance autorizado.',
            'strict' => true,
            'parameters' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['period'],
                'properties' => [
                    'period' => ['type' => 'string', 'enum' => ['last_7', 'last_30', 'this_month']],
                ],
            ],
        ],
        [
            'type' => 'function',
            'name' => 'get_workload_breakdown',
            'description' => 'Obtiene un ranking real de carga dentro del alcance autorizado por trámite, prioridad, canal, colonia o responsable asignado. No devuelve información de contacto de ciudadanos.',
            'strict' => true,
            'parameters' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['dimension', 'period', 'limit'],
                'properties' => [
                    'dimension' => ['type' => 'string', 'enum' => ['tramite', 'priority', 'channel', 'colonia', 'assignee']],
                    'period' => ['type' => 'string', 'enum' => ['all', 'last_7', 'last_30', 'this_month']],
                    'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 20],
                ],
            ],
        ],
        [
            'type' => 'function',
            'name' => 'get_overdue_requirements',
            'description' => 'Obtiene una lista acotada de requerimientos activos con antigüedad mínima dentro del alcance autorizado. Devuelve ID, trámite, antigüedad, prioridad y responsable, sin datos de contacto ciudadanos.',
            'strict' => true,
            'parameters' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['minimum_days', 'limit'],
                'properties' => [
                    'minimum_days' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 365],
                    'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 20],
                ],
            ],
        ],
        [
            'type' => 'function',
            'name' => 'search_safe_requirement_records',
            'description' => 'Herramienta de respaldo para una pregunta operativa que no encaje en los reportes especializados. Consulta una lista pequeña de fichas reales con filtros cerrados por periodo, departamento, estatus, prioridad, asignacion y vencimiento. No devuelve asunto, descripcion ni datos de contacto ciudadanos. Usa primero las herramientas especializadas si cubren la pregunta.',
            'strict' => true,
            'parameters' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['period', 'department', 'status_ids', 'priority_ids', 'assignee_state', 'deadline_state', 'sort', 'limit'],
                'properties' => [
                    'period' => ['type' => 'string', 'enum' => ['all', 'last_7', 'last_30', 'this_month']],
                    'department' => ['type' => ['string', 'null'], 'minLength' => 1, 'maxLength' => 160],
                    'status_ids' => ['type' => 'array', 'items' => ['type' => 'integer', 'enum' => [0, 1, 2, 3, 4, 5, 6]]],
                    'priority_ids' => ['type' => 'array', 'items' => ['type' => 'integer', 'enum' => [1, 2, 3]]],
                    'assignee_state' => ['type' => 'string', 'enum' => ['any', 'assigned', 'unassigned']],
                    'deadline_state' => ['type' => 'string', 'enum' => ['any', 'overdue', 'due_soon', 'without_due_date']],
                    'sort' => ['type' => 'string', 'enum' => ['newest', 'oldest']],
                    'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 25],
                ],
            ],
        ],
        [
            'type' => 'function',
            'name' => 'list_authorized_departments',
            'description' => 'Lista los departamentos activos disponibles dentro del alcance autorizado del usuario.',
            'strict' => true,
            'parameters' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => [],
                'properties' => new stdClass(),
            ],
        ],
        [
            'type' => 'function',
            'name' => 'get_requirements_by_department',
            'description' => 'Obtiene el conteo real de requerimientos por cada departamento activo dentro del alcance autorizado del usuario.',
            'strict' => true,
            'parameters' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['period'],
                'properties' => [
                    'period' => ['type' => 'string', 'enum' => ['all', 'last_7', 'last_30', 'this_month']],
                ],
            ],
        ],
        [
            'type' => 'function',
            'name' => 'get_latest_requirement',
            'description' => 'Obtiene el requerimiento más reciente dentro del alcance autorizado, incluyendo su número, departamento, trámite y fecha de creación. Si se solicita un departamento concreto, envía su nombre exacto en department; usa null para el alcance completo autorizado.',
            'strict' => true,
            'parameters' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['department'],
                'properties' => [
                    'department' => ['type' => ['string', 'null'], 'minLength' => 1, 'maxLength' => 160],
                ],
            ],
        ],
        [
            'type' => 'function',
            'name' => 'get_resolution_time_by_department',
            'description' => 'Obtiene el promedio real de días de resolución de requerimientos finalizados por departamento, filtrado por fecha de cierre.',
            'strict' => true,
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false, 'required' => ['period'],
                'properties' => ['period' => ['type' => 'string', 'enum' => ['all', 'last_7', 'last_30', 'this_month']]],
            ],
        ],
    ];
}

function ixtla_insights_execute_tool(string $name, mixed $arguments): array
{
    $args = is_array($arguments) ? $arguments : [];
    return match ($name) {
        'get_requirements_dataset_overview' => ixtla_insights_snapshot_overview($args),
        'search_requirements_dataset' => ixtla_insights_snapshot_search($args),
        'aggregate_requirements_dataset' => ixtla_insights_snapshot_aggregate($args),
        'get_requirement_dataset_detail' => ixtla_insights_snapshot_requirement_detail($args),
        'query_requirements_analytics' => ixtla_insights_dataset_analytics_query($args),
        'get_scope_summary' => ixtla_insights_dataset_scope_summary($args),
        'get_operational_snapshot' => ixtla_insights_dataset_operational_snapshot($args),
        'get_operational_risk_snapshot' => ixtla_insights_dataset_operational_risk_snapshot($args),
        'get_workload_trend_snapshot' => ixtla_insights_dataset_workload_trend_snapshot($args),
        'get_backlog_risk_snapshot' => ixtla_insights_dataset_backlog_risk_snapshot($args),
        'get_backlog_aging' => ixtla_insights_dataset_backlog_aging(),
        'get_period_comparison' => ixtla_insights_dataset_period_comparison($args),
        'get_requirements_trend' => ixtla_insights_dataset_requirements_trend($args),
        'get_workload_breakdown' => ixtla_insights_dataset_workload_breakdown($args),
        'get_overdue_requirements' => ixtla_insights_dataset_overdue_requirements($args),
        'search_safe_requirement_records' => ixtla_insights_dataset_safe_records($args),
        'list_authorized_departments' => ixtla_insights_dataset_authorized_departments(),
        'get_requirements_by_department' => ixtla_insights_dataset_requirements_by_department($args),
        'get_latest_requirement' => ixtla_insights_dataset_latest_requirement($args),
        'get_resolution_time_by_department' => ixtla_insights_dataset_resolution_time_by_department($args),
        default => throw new InvalidArgumentException('La herramienta solicitada no está disponible.'),
    };
}

<?php
declare(strict_types=1);

require_once __DIR__ . '/../datasets/requerimientos_dataset.php';

function ixtla_insights_tool_definitions(): array
{
    return [
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
        'query_requirements_analytics' => ixtla_insights_dataset_analytics_query($args),
        'get_scope_summary' => ixtla_insights_dataset_scope_summary($args),
        'list_authorized_departments' => ixtla_insights_dataset_authorized_departments(),
        'get_requirements_by_department' => ixtla_insights_dataset_requirements_by_department($args),
        'get_latest_requirement' => ixtla_insights_dataset_latest_requirement($args),
        'get_resolution_time_by_department' => ixtla_insights_dataset_resolution_time_by_department($args),
        default => throw new InvalidArgumentException('La herramienta solicitada no está disponible.'),
    };
}

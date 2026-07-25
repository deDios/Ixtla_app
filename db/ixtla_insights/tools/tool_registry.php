<?php
declare(strict_types=1);

require_once __DIR__ . '/../datasets/requerimientos_dataset.php';

function ixtla_insights_tool_definitions(): array
{
    return [
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
    ];
}

function ixtla_insights_execute_tool(string $name, mixed $arguments): array
{
    $args = is_array($arguments) ? $arguments : [];
    return match ($name) {
        'get_scope_summary' => ixtla_insights_dataset_scope_summary($args),
        'list_authorized_departments' => ixtla_insights_dataset_authorized_departments(),
        default => throw new InvalidArgumentException('La herramienta solicitada no está disponible.'),
    };
}

<?php
declare(strict_types=1);

require_once __DIR__ . '/../datasets/requerimientos_snapshot.php';
require_once __DIR__ . '/../datasets/requirement_activity.php';

/** Registro compacto: solo herramientas vigentes para el chat. */
function ixtla_insights_tool_definitions(): array
{
    $requirementKey = [
        'id' => ['type' => ['integer', 'null'], 'minimum' => 1],
        'folio' => ['type' => ['string', 'null'], 'minLength' => 1, 'maxLength' => 80],
    ];
    $datasetFilters = [
        'period' => ['type' => 'string', 'enum' => ['all', 'last_7', 'last_30', 'this_month']],
        'department_id' => ['type' => 'integer', 'minimum' => 0],
        'assignee_id' => ['type' => 'integer', 'minimum' => 0],
        'status_ids' => ['type' => 'array', 'items' => ['type' => 'integer', 'enum' => [0, 1, 2, 3, 4, 5, 6]]],
        'assignee_state' => ['type' => 'string', 'enum' => ['any', 'assigned', 'unassigned']],
    ];
    $filterRequired = ['period', 'department_id', 'assignee_id', 'status_ids', 'assignee_state'];

    return [
        [
            'type' => 'function', 'name' => 'get_requirements_overview', 'strict' => true,
            'description' => 'Obtiene KPIs y distribuciones del alcance autorizado. Si el usuario no indica un periodo, usa all. Usala para totales, carga operativa y resumen ejecutivo; no para localizar un folio.',
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false, 'required' => ['refresh', 'period'],
                'properties' => [
                    'refresh' => ['type' => 'boolean'],
                    'period' => $datasetFilters['period'],
                ],
            ],
        ],
        [
            'type' => 'function', 'name' => 'search_requirements', 'strict' => true,
            'description' => 'Busca hasta 50 requerimientos autorizados con filtros cerrados. Si el usuario no indica un periodo, usa all. Devuelve catalogos resueltos, asignacion, fechas vigentes y conteos de comentarios, procesos y tareas; nunca contactos ni texto de comentarios ni fecha_limite.',
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false,
                'required' => [...$filterRequired, 'sort', 'limit'],
                'properties' => array_merge($datasetFilters, [
                    'sort' => ['type' => 'string', 'enum' => ['newest', 'oldest', 'most_comments']],
                    'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50],
                ]),
            ],
        ],
        [
            'type' => 'function', 'name' => 'aggregate_requirements', 'strict' => true,
            'description' => 'Agrupa requerimientos autorizados por estatus, departamento, tramite o empleado asignado. Si el usuario no indica un periodo, usa all. Usala para conteos, comparaciones y rankings.',
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false,
                'required' => [...$filterRequired, 'group_by', 'sort', 'limit'],
                'properties' => array_merge($datasetFilters, [
                    'group_by' => ['type' => 'string', 'enum' => ['status', 'department', 'tramite', 'assignee']],
                    'sort' => ['type' => 'string', 'enum' => ['asc', 'desc']],
                    'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50],
                ]),
            ],
        ],
        [
            'type' => 'function', 'name' => 'list_requirement_catalog', 'strict' => true,
            'description' => 'Lista estatus, departamentos, tramites o empleados asignados visibles en el alcance autorizado. Los empleados incluyen puesto y departamento, no datos de contacto.',
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false, 'required' => ['catalog', 'query', 'limit'],
                'properties' => [
                    'catalog' => ['type' => 'string', 'enum' => ['statuses', 'departments', 'tramites', 'assignees']],
                    'query' => ['type' => ['string', 'null'], 'maxLength' => 120],
                    'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 100],
                ],
            ],
        ],
        [
            'type' => 'function', 'name' => 'get_requirement_detail', 'strict' => true,
            'description' => 'Obtiene la ficha de un folio o id autorizado, con estatus, tramite, departamento, asignado, fechas y conteos de actividad.',
            'parameters' => ['type' => 'object', 'additionalProperties' => false, 'required' => ['id', 'folio'], 'properties' => $requirementKey],
        ],
        [
            'type' => 'function', 'name' => 'get_requirement_summary', 'strict' => true,
            'description' => 'Obtiene una ficha completa y las diez actividades recientes de un requerimiento autorizado. Usala cuando se pida un resumen general del caso.',
            'parameters' => ['type' => 'object', 'additionalProperties' => false, 'required' => ['id', 'folio'], 'properties' => $requirementKey],
        ],
        [
            'type' => 'function', 'name' => 'get_requirement_comments', 'strict' => true,
            'description' => 'Consulta comentarios activos de un requerimiento autorizado, con autor, fecha y texto sanitizado. Usala para responder que comentaron.',
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false, 'required' => ['id', 'folio', 'limit'],
                'properties' => array_merge($requirementKey, ['limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 30]]),
            ],
        ],
        [
            'type' => 'function', 'name' => 'get_requirement_tasks', 'strict' => true,
            'description' => 'Consulta tareas de un requerimiento autorizado con estado, responsable y fechas. Puede limitarse a abiertas o terminadas.',
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false, 'required' => ['id', 'folio', 'state', 'limit'],
                'properties' => array_merge($requirementKey, [
                    'state' => ['type' => 'string', 'enum' => ['any', 'open', 'completed']],
                    'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50],
                ]),
            ],
        ],
        [
            'type' => 'function', 'name' => 'get_requirement_processes', 'strict' => true,
            'description' => 'Consulta avances o procesos activos de un requerimiento autorizado, con autor, fecha y descripcion sanitizada.',
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false, 'required' => ['id', 'folio', 'limit'],
                'properties' => array_merge($requirementKey, ['limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 30]]),
            ],
        ],
        [
            'type' => 'function', 'name' => 'get_requirement_activity', 'strict' => true,
            'description' => 'Devuelve una linea de tiempo reciente de comentarios y tareas de un requerimiento autorizado. Usala para explicar que ha sucedido con el caso.',
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false, 'required' => ['id', 'folio', 'limit'],
                'properties' => array_merge($requirementKey, ['limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50]]),
            ],
        ],
    ];
}

function ixtla_insights_execute_tool(string $name, mixed $arguments): array
{
    $args = is_array($arguments) ? $arguments : [];
    return match ($name) {
        'get_requirements_overview' => ixtla_insights_snapshot_overview($args),
        'search_requirements' => ixtla_insights_snapshot_search($args),
        'aggregate_requirements' => ixtla_insights_snapshot_aggregate($args),
        'list_requirement_catalog' => ixtla_insights_snapshot_catalog($args),
        'get_requirement_detail' => ixtla_insights_snapshot_requirement_detail($args),
        'get_requirement_summary' => ixtla_insights_requirement_summary($args),
        'get_requirement_comments' => ixtla_insights_requirement_comments($args),
        'get_requirement_tasks' => ixtla_insights_requirement_tasks($args),
        'get_requirement_processes' => ixtla_insights_requirement_processes($args),
        'get_requirement_activity' => ixtla_insights_requirement_activity($args),
        default => throw new InvalidArgumentException('La herramienta solicitada no esta disponible.'),
    };
}

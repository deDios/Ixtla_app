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
        'period' => ['type' => 'string', 'enum' => ['all', 'this_week', 'last_7', 'last_30', 'this_month']],
        'department_id' => ['type' => 'integer', 'minimum' => 0],
        'department_ids' => ['type' => 'array', 'maxItems' => 50, 'items' => ['type' => 'integer', 'minimum' => 1]],
        'department_names' => ['type' => 'array', 'maxItems' => 50, 'items' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 160]],
        'assignee_id' => ['type' => 'integer', 'minimum' => 0],
        'assignee_ids' => ['type' => 'array', 'maxItems' => 50, 'items' => ['type' => 'integer', 'minimum' => 1]],
        'tramite_ids' => ['type' => 'array', 'maxItems' => 50, 'items' => ['type' => 'integer', 'minimum' => 1]],
        'status_ids' => ['type' => 'array', 'items' => ['type' => 'integer', 'enum' => [0, 1, 2, 3, 4, 5, 6]]],
        'assignee_state' => ['type' => 'string', 'enum' => ['any', 'assigned', 'unassigned']],
        'date_field' => ['type' => 'string', 'enum' => ['created_at', 'closed_at']],
        'date_from' => ['type' => ['string', 'null'], 'pattern' => '^\\d{4}-\\d{2}-\\d{2}$'],
        'date_to' => ['type' => ['string', 'null'], 'pattern' => '^\\d{4}-\\d{2}-\\d{2}$'],
    ];
    $filterRequired = ['period', 'department_id', 'department_ids', 'department_names', 'assignee_id', 'assignee_ids', 'tramite_ids', 'status_ids', 'assignee_state', 'date_field', 'date_from', 'date_to'];

    return [
        [
            'type' => 'function', 'name' => 'get_requirements_overview', 'strict' => true,
            'description' => 'Obtiene KPIs y distribuciones del alcance autorizado. Incluye comparación de 30 días, distribución diaria, días pico y trámites principales. Admite date_field, date_from y date_to para un mes o rango personalizado. Si no hay rango ni periodo explícito, usa all; no la uses para localizar un folio.',
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false, 'required' => ['refresh', 'period', 'date_field', 'date_from', 'date_to'],
                'properties' => [
                    'refresh' => ['type' => 'boolean'],
                    'period' => $datasetFilters['period'],
                    'date_field' => $datasetFilters['date_field'],
                    'date_from' => $datasetFilters['date_from'],
                    'date_to' => $datasetFilters['date_to'],
                ],
            ],
        ],
        [
            'type' => 'function', 'name' => 'search_requirements', 'strict' => true,
            'description' => 'Busca filas individuales de requerimientos autorizados. Usala para responder cuales son, mostrar folios, fechas o detalles de resultados previos. Cada fila puede incluir folio, estatus, tramite, departamento, responsable, fecha de creacion y conteos de actividad; la fecha de cierre solo aparece si el estatus actual es Finalizado. Devuelve total_matching, items, returned, has_more y next_cursor. Nunca devuelve contactos, texto de comentarios ni fecha_limite.',
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false,
                'required' => [...$filterRequired, 'sort', 'limit', 'cursor'],
                'properties' => array_merge($datasetFilters, [
                    'sort' => ['type' => 'string', 'enum' => ['newest', 'oldest', 'most_comments']],
                    'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50],
                    'cursor' => ['type' => ['string', 'null'], 'maxLength' => 160],
                ]),
            ],
        ],
        [
            'type' => 'function', 'name' => 'aggregate_requirements', 'strict' => true,
            'description' => 'Devuelve conteos agrupados por estatus, departamento, tramite, empleado asignado o fecha; no devuelve filas, folios ni fechas individuales. Usala para conteos, rankings y tendencias. Admite rangos personalizados mediante date_field, date_from y date_to.',
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false,
                'required' => [...$filterRequired, 'group_by', 'sort', 'limit'],
                'properties' => array_merge($datasetFilters, [
                    'group_by' => ['type' => 'string', 'enum' => ['status', 'department', 'tramite', 'assignee', 'date']],
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
            'description' => 'Obtiene la ficha de un folio o id autorizado, con asunto, descripcion, estatus, tramite, departamento, asignado, fecha de creacion y conteos de actividad. La fecha de cierre solo aparece si el estatus actual es Finalizado. Si primero localizaste un requerimiento mediante una busqueda y el usuario pide su informacion o detalle, llama tambien esta herramienta antes de responder.',
            'parameters' => ['type' => 'object', 'additionalProperties' => false, 'required' => ['id', 'folio'], 'properties' => $requirementKey],
        ],
        [
            'type' => 'function', 'name' => 'get_requirement_summary', 'strict' => true,
            'description' => 'Obtiene una ficha completa y las diez actividades recientes de un requerimiento autorizado. Usala cuando se pida un resumen general del caso.',
            'parameters' => ['type' => 'object', 'additionalProperties' => false, 'required' => ['id', 'folio'], 'properties' => $requirementKey],
        ],
        [
            'type' => 'function', 'name' => 'get_requirement_contact', 'strict' => true,
            'description' => 'Obtiene nombre, telefono, correo, domicilio, codigo postal y colonia del contacto o ciudadano de un unico requerimiento autorizado. Usala cuando se pidan datos del ciudadano, solicitante o contacto de un folio concreto. Nunca la uses para listados ni consultas masivas.',
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
        'get_requirement_detail' => ixtla_insights_requirement_detail($args),
        'get_requirement_summary' => ixtla_insights_requirement_summary($args),
        'get_requirement_contact' => ixtla_insights_requirement_contact($args),
        'get_requirement_comments' => ixtla_insights_requirement_comments($args),
        'get_requirement_tasks' => ixtla_insights_requirement_tasks($args),
        'get_requirement_processes' => ixtla_insights_requirement_processes($args),
        'get_requirement_activity' => ixtla_insights_requirement_activity($args),
        default => throw new InvalidArgumentException('La herramienta solicitada no esta disponible.'),
    };
}

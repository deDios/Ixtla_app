<?php
declare(strict_types=1);

require_once __DIR__ . '/../datasets/requerimientos_snapshot.php';
require_once __DIR__ . '/../datasets/requirement_activity.php';
require_once __DIR__ . '/../datasets/retroalimentaciones_dataset.php';

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
        'channel_ids' => ['type' => 'array', 'maxItems' => 2, 'items' => ['type' => 'integer', 'enum' => [1, 2]]],
        'assignee_state' => ['type' => 'string', 'enum' => ['any', 'assigned', 'unassigned']],
        'date_field' => ['type' => 'string', 'enum' => ['created_at', 'closed_at']],
        'date_from' => ['type' => ['string', 'null'], 'pattern' => '^\\d{4}-\\d{2}-\\d{2}$'],
        'date_to' => ['type' => ['string', 'null'], 'pattern' => '^\\d{4}-\\d{2}-\\d{2}$'],
    ];
    $filterRequired = ['period', 'department_id', 'department_ids', 'department_names', 'assignee_id', 'assignee_ids', 'tramite_ids', 'status_ids', 'channel_ids', 'assignee_state', 'date_field', 'date_from', 'date_to'];
    $retroFilters = [
        'status_ids' => ['type' => 'array', 'maxItems' => 4, 'items' => ['type' => 'integer', 'enum' => [0, 1, 2, 3]]],
        'rating_ids' => ['type' => 'array', 'maxItems' => 4, 'items' => ['type' => 'integer', 'enum' => [1, 2, 3, 4]]],
        'department_ids' => ['type' => 'array', 'maxItems' => 50, 'items' => ['type' => 'integer', 'minimum' => 1]],
        'tramite_ids' => ['type' => 'array', 'maxItems' => 50, 'items' => ['type' => 'integer', 'minimum' => 1]],
        'requirement_status_ids' => ['type' => 'array', 'maxItems' => 7, 'items' => ['type' => 'integer', 'enum' => [0, 1, 2, 3, 4, 5, 6]]],
        'channel_ids' => ['type' => 'array', 'maxItems' => 2, 'items' => ['type' => 'integer', 'enum' => [1, 2]]],
        'assignee_ids' => ['type' => 'array', 'maxItems' => 50, 'items' => ['type' => 'integer', 'minimum' => 1]],
        'assignee_state' => ['type' => 'string', 'enum' => ['any', 'assigned', 'unassigned']],
        'period' => ['type' => 'string', 'enum' => ['all', 'this_week', 'last_7', 'last_30', 'this_month']],
        'date_from' => ['type' => ['string', 'null'], 'pattern' => '^\\d{4}-\\d{2}-\\d{2}$'],
        'date_to' => ['type' => ['string', 'null'], 'pattern' => '^\\d{4}-\\d{2}-\\d{2}$'],
    ];
    $retroRequired = ['status_ids', 'rating_ids', 'department_ids', 'tramite_ids', 'requirement_status_ids', 'channel_ids', 'assignee_ids', 'assignee_state', 'period', 'date_from', 'date_to'];

    return [
        [
            'type' => 'function', 'name' => 'get_feedback_overview', 'strict' => true,
            'description' => 'Obtiene total de registros, requerimientos unicos, conteos por estado, tasas de respuesta general y elegible, promedio, respuestas favorables y desfavorables. period y rangos se aplican a la fecha de creacion de la retroalimentacion.',
            'parameters' => ['type' => 'object', 'additionalProperties' => false, 'required' => $retroRequired, 'properties' => $retroFilters],
        ],
        [
            'type' => 'function', 'name' => 'aggregate_feedback', 'strict' => true,
            'description' => 'Agrupa retroalimentaciones por estado, calificacion, departamento o tramite. Usala para conteos, comparaciones, distribuciones y rankings; nunca infieras satisfaccion a partir del estatus Finalizado del requerimiento.',
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false, 'required' => [...$retroRequired, 'group_by', 'limit'],
                'properties' => array_merge($retroFilters, [
                    'group_by' => ['type' => 'string', 'enum' => ['status', 'rating', 'department', 'tramite', 'assignee', 'channel', 'requirement_status', 'date']],
                    'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50],
                ]),
            ],
        ],
        [
            'type' => 'function', 'name' => 'search_feedback', 'strict' => true,
            'description' => 'Lista retroalimentaciones autorizadas con paginacion, total de coincidencias, folio, estado, calificacion, departamento, tramite, responsable, canal y estado del requerimiento. No devuelve telefono, ciudadano, enlace ni comentario libre.',
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false, 'required' => [...$retroRequired, 'limit', 'page'],
                'properties' => array_merge($retroFilters, [
                    'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50],
                    'page' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 10000],
                ]),
            ],
        ],
        [
            'type' => 'function', 'name' => 'get_feedback_detail', 'strict' => true,
            'description' => 'Obtiene la retroalimentacion mas reciente por folio o requerimiento, o una retro por su id, siempre dentro del alcance autorizado. Incluye comentario ciudadano sanitizado, estado, calificacion, contexto operativo y los datos disponibles del ciudadano: nombre, telefono, correo, calle, codigo postal y colonia. No incluye el enlace de acceso.',
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false, 'required' => ['retro_id', 'requirement_id', 'folio'],
                'properties' => [
                    'retro_id' => ['type' => ['integer', 'null'], 'minimum' => 1],
                    'requirement_id' => ['type' => ['integer', 'null'], 'minimum' => 1],
                    'folio' => ['type' => ['string', 'null'], 'minLength' => 1, 'maxLength' => 80],
                ],
            ],
        ],
        [
            'type' => 'function', 'name' => 'analyze_feedback_comments', 'strict' => true,
            'description' => 'Obtiene una muestra reciente y sanitizada de comentarios de retroalimentaciones autorizadas para responder que dicen los ciudadanos, resumir motivos, detectar temas recurrentes y mostrar ejemplos. Permite filtrar por calificacion, periodo, departamento, tramite, estatus del requerimiento, canal y responsable. No devuelve datos personales; para el contacto de un folio concreto usa get_feedback_detail.',
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false, 'required' => [...$retroRequired, 'limit'],
                'properties' => array_merge($retroFilters, [
                    'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 30],
                ]),
            ],
        ],
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
            'description' => 'Busca filas individuales de requerimientos autorizados. Usala para responder cuales son, mostrar folios, fechas, canal de origen o detalles de resultados previos. channel_ids [1] filtra Portal ciudadano y [2] Portal de empleados. Cada fila incluye una etiqueta legible channel. La fecha de cierre solo aparece si el estatus actual es Finalizado. Devuelve total_matching, items, returned, has_more y next_cursor. Nunca devuelve contactos, texto de comentarios ni fecha_limite.',
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
            'type' => 'function', 'name' => 'get_priority_requirements', 'strict' => true,
            'description' => 'Ordena los requerimientos activos que requieren mayor atencion operativa dentro del alcance autorizado. El ranking es determinista y explica sus motivos usando antiguedad, ausencia de responsable, estatus, falta de actividad reciente y tareas abiertas. No representa una clasificacion administrativa oficial y nunca usa fecha_limite.',
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false,
                'required' => [...$filterRequired, 'ranking_mode', 'limit'],
                'properties' => array_merge($datasetFilters, [
                    'ranking_mode' => ['type' => 'string', 'enum' => ['operational_attention']],
                    'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 30],
                ]),
            ],
        ],
        [
            'type' => 'function', 'name' => 'aggregate_requirements', 'strict' => true,
            'description' => 'Devuelve conteos agrupados por estatus, departamento, tramite, empleado asignado, canal de origen o fecha; no devuelve filas, folios ni fechas individuales. Usa group_by channel para comparar Portal ciudadano contra Portal de empleados. channel_ids [1] filtra Portal ciudadano y [2] Portal de empleados. Usala para conteos, rankings y tendencias. Admite rangos personalizados mediante date_field, date_from y date_to.',
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false,
                'required' => [...$filterRequired, 'group_by', 'sort', 'limit'],
                'properties' => array_merge($datasetFilters, [
                    'group_by' => ['type' => 'string', 'enum' => ['status', 'department', 'tramite', 'assignee', 'channel', 'date']],
                    'sort' => ['type' => 'string', 'enum' => ['asc', 'desc']],
                    'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50],
                ]),
            ],
        ],
        [
            'type' => 'function', 'name' => 'compare_requirement_sets', 'strict' => true,
            'description' => 'Compara dos universos completos de requerimientos dentro del mismo snapshot autorizado. Usala para comparar periodos o grupos y calcular diferencias absolutas y porcentuales. Nunca compara solamente las filas de una muestra o pagina previa.',
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false,
                'required' => ['left_label', 'right_label', 'left', 'right', 'group_by', 'date_grain', 'limit'],
                'properties' => [
                    'left_label' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 80],
                    'right_label' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 80],
                    'left' => ['type' => 'object', 'additionalProperties' => false, 'required' => $filterRequired, 'properties' => $datasetFilters],
                    'right' => ['type' => 'object', 'additionalProperties' => false, 'required' => $filterRequired, 'properties' => $datasetFilters],
                    'group_by' => ['type' => 'string', 'enum' => ['status', 'department', 'tramite', 'assignee', 'channel', 'date']],
                    'date_grain' => ['type' => 'string', 'enum' => ['day', 'week', 'month']],
                    'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50],
                ],
            ],
        ],
        [
            'type' => 'function', 'name' => 'aggregate_requirement_dimensions', 'strict' => true,
            'description' => 'Devuelve un agregado bidimensional autorizado para lineas multiserie y matrices. group_by define el eje o las filas; series_by define cada linea o columna. Para lineas usa group_by date. date_grain controla dia, semana o mes. Nunca devuelve folios ni filas individuales.',
            'parameters' => [
                'type' => 'object', 'additionalProperties' => false,
                'required' => [...$filterRequired, 'group_by', 'series_by', 'date_grain', 'category_limit', 'series_limit', 'include_other'],
                'properties' => array_merge($datasetFilters, [
                    'group_by' => ['type' => 'string', 'enum' => ['status', 'department', 'tramite', 'channel', 'date']],
                    'series_by' => ['type' => 'string', 'enum' => ['status', 'department', 'tramite', 'channel']],
                    'date_grain' => ['type' => 'string', 'enum' => ['day', 'week', 'month']],
                    'category_limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50],
                    'series_limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 7],
                    'include_other' => ['type' => 'boolean'],
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
            'description' => 'Obtiene la ficha de un folio o id autorizado, con asunto, descripcion, estatus, tramite, departamento, canal de origen, asignado, fecha de creacion y conteos de actividad. La fecha de cierre solo aparece si el estatus actual es Finalizado. Si primero localizaste un requerimiento mediante una busqueda y el usuario pide su informacion o detalle, llama tambien esta herramienta antes de responder.',
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
    ixtla_insights_validate_tool_arguments($name, $args);
    return match ($name) {
        'get_feedback_overview' => ixtla_insights_retro_overview($args),
        'aggregate_feedback' => ixtla_insights_retro_aggregate($args),
        'search_feedback' => ixtla_insights_retro_search($args),
        'get_feedback_detail' => ixtla_insights_retro_detail($args),
        'analyze_feedback_comments' => ixtla_insights_retro_comment_sample($args),
        'get_requirements_overview' => ixtla_insights_snapshot_overview($args),
        'search_requirements' => ixtla_insights_snapshot_search($args),
        'get_priority_requirements' => ixtla_insights_snapshot_priority_requirements($args),
        'aggregate_requirements' => ixtla_insights_snapshot_aggregate($args),
        'compare_requirement_sets' => ixtla_insights_snapshot_compare_sets($args),
        'aggregate_requirement_dimensions' => ixtla_insights_snapshot_aggregate_dimensions($args),
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

/** Valida en servidor el mismo contrato JSON que se entrega al modelo. */
function ixtla_insights_validate_tool_arguments(string $name, array $arguments): void
{
    $definition = null;
    foreach (ixtla_insights_tool_definitions() as $candidate) {
        if (($candidate['name'] ?? '') === $name) {
            $definition = $candidate;
            break;
        }
    }
    if (!is_array($definition)) throw new InvalidArgumentException('La herramienta solicitada no esta disponible.');
    ixtla_insights_validate_schema_value($arguments, (array) ($definition['parameters'] ?? []), 'arguments');
}

function ixtla_insights_validate_schema_value(mixed $value, array $schema, string $path): void
{
    $types = is_array($schema['type'] ?? null) ? $schema['type'] : [(string) ($schema['type'] ?? '')];
    $matchesType = static function (string $type) use ($value): bool {
        return match ($type) {
            'null' => $value === null,
            'object' => is_array($value) && !array_is_list($value),
            'array' => is_array($value) && array_is_list($value),
            'string' => is_string($value),
            'integer' => is_int($value),
            'number' => is_int($value) || is_float($value),
            'boolean' => is_bool($value),
            default => true,
        };
    };
    if (!array_filter($types, $matchesType)) {
        throw new InvalidArgumentException('El campo ' . $path . ' no tiene el tipo esperado.');
    }
    if ($value === null) return;
    if (isset($schema['enum']) && !in_array($value, (array) $schema['enum'], true)) {
        throw new InvalidArgumentException('El campo ' . $path . ' contiene un valor no permitido.');
    }
    if (is_string($value)) {
        $length = mb_strlen($value);
        if (isset($schema['minLength']) && $length < (int) $schema['minLength']) throw new InvalidArgumentException('El campo ' . $path . ' es demasiado corto.');
        if (isset($schema['maxLength']) && $length > (int) $schema['maxLength']) throw new InvalidArgumentException('El campo ' . $path . ' excede la longitud permitida.');
        if (isset($schema['pattern']) && preg_match('~' . $schema['pattern'] . '~', $value) !== 1) throw new InvalidArgumentException('El campo ' . $path . ' no tiene el formato esperado.');
    }
    if ((is_int($value) || is_float($value)) && isset($schema['minimum']) && $value < $schema['minimum']) {
        throw new InvalidArgumentException('El campo ' . $path . ' es menor al minimo permitido.');
    }
    if (is_array($value) && array_is_list($value)) {
        if (isset($schema['maxItems']) && count($value) > (int) $schema['maxItems']) throw new InvalidArgumentException('El campo ' . $path . ' contiene demasiados elementos.');
        if (is_array($schema['items'] ?? null)) {
            foreach ($value as $index => $item) ixtla_insights_validate_schema_value($item, $schema['items'], $path . '[' . $index . ']');
        }
        return;
    }
    if (is_array($value)) {
        $properties = is_array($schema['properties'] ?? null) ? $schema['properties'] : [];
        foreach ((array) ($schema['required'] ?? []) as $required) {
            if (!array_key_exists((string) $required, $value)) throw new InvalidArgumentException('Falta el campo requerido ' . $path . '.' . $required . '.');
        }
        if (($schema['additionalProperties'] ?? true) === false) {
            foreach (array_keys($value) as $key) if (!array_key_exists((string) $key, $properties)) throw new InvalidArgumentException('El campo ' . $path . '.' . $key . ' no esta permitido.');
        }
        foreach ($value as $key => $item) {
            if (isset($properties[$key]) && is_array($properties[$key])) ixtla_insights_validate_schema_value($item, $properties[$key], $path . '.' . $key);
        }
    }
}

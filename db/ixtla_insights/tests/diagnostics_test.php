<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/datasets/requerimientos_dataset.php';
require_once dirname(__DIR__) . '/tools/tool_registry.php';
require_once dirname(__DIR__) . '/question_router.php';

function expect_diagnostic(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$requestId = ixtla_insights_request_id();
expect_diagnostic((bool) preg_match('/^ix-[a-f0-9]{24}$/', $requestId), 'El request id generado debe tener un formato seguro y correlacionable.');
expect_diagnostic(ixtla_insights_request_id() === $requestId, 'El request id debe ser estable durante la solicitud.');
expect_diagnostic(ixtla_insights_default_error_code(502) === 'provider_unavailable', '502 debe clasificarse como error de proveedor.');
expect_diagnostic(ixtla_insights_default_error_code(503) === 'service_unavailable', '503 debe clasificarse como servicio no disponible.');
expect_diagnostic(ixtla_insights_default_error_code(422) === 'validation_failed', '422 debe clasificarse como validación.');

$usageSummary = ixtla_insights_usage_summary([
    ['usage' => ['input_tokens' => 120, 'output_tokens' => 30, 'total_tokens' => 150, 'input_tokens_details' => ['cached_tokens' => 20], 'output_tokens_details' => ['reasoning_tokens' => 8]]],
    ['usage' => ['input_tokens' => 80, 'output_tokens' => 40, 'total_tokens' => 120, 'output_tokens_details' => ['reasoning_tokens' => 6]]],
]);
expect_diagnostic($usageSummary === ['provider_requests' => 2, 'input_tokens' => 200, 'output_tokens' => 70, 'reasoning_tokens' => 14, 'cached_input_tokens' => 20, 'total_tokens' => 270], 'El resumen de uso debe acumular todas las respuestas del proveedor.');

$domainProfile = ixtla_insights_domain_profile();
expect_diagnostic(($domainProfile['domain'] ?? null) === 'requerimientos', 'El perfil de dominio debe describir requerimientos.');
expect_diagnostic(($domainProfile['version'] ?? null) === 2, 'El perfil de dominio debe estar versionado.');
$domainPrompt = ixtla_insights_domain_developer_prompt();
expect_diagnostic(str_contains($domainPrompt, 'get_requirement_comments'), 'El perfil debe orientar consultas de actividad bajo demanda.');
expect_diagnostic(str_contains($domainPrompt, 'alcance autorizado se resuelve en el servidor'), 'El perfil debe preservar el límite de autorización del servidor.');
expect_diagnostic(ixtla_insights_domain_metric_label('closed_count') === 'Requerimientos finalizados', 'El perfil debe centralizar las etiquetas de métricas.');
expect_diagnostic(ixtla_insights_domain_period_label('last_30') === 'Últimos 30 días', 'El perfil debe centralizar las etiquetas de periodos.');
expect_diagnostic(ixtla_insights_domain_status_label(6) === 'Finalizado', 'El perfil debe centralizar las etiquetas de estados.');
expect_diagnostic(ixtla_insights_domain_status_ids('active') === [0, 1, 2, 3], 'El perfil debe definir los estados activos.');
expect_diagnostic(ixtla_insights_dataset_active_status_condition() === 'r.estatus IN (0, 1, 2, 3)', 'Los datasets deben construir el filtro activo desde el perfil.');
expect_diagnostic(ixtla_insights_dataset_risk_period('last_30') === 'last_30', 'Los paquetes compuestos deben admitir periodos comparables.');
try {
    ixtla_insights_dataset_risk_period('all');
    expect_diagnostic(false, 'Los paquetes compuestos no deben aceptar historial ilimitado.');
} catch (InvalidArgumentException) {
    // Expected: a comparison without a bounded period is ambiguous.
}

$boundedHistory = ixtla_insights_clean_history([
    ['role' => 'user', 'content' => '111111'],
    ['role' => 'assistant', 'content' => '222222'],
    ['role' => 'user', 'content' => '333333'],
], 3, 6, 10);
expect_diagnostic(count($boundedHistory) === 2, 'El limite total de historial debe descartar primero los mensajes mas antiguos.');
expect_diagnostic(($boundedHistory[0]['content'] ?? '') === '2222', 'El historial debe ajustar el mensaje previo al espacio disponible.');
expect_diagnostic(($boundedHistory[1]['content'] ?? '') === '333333', 'El historial debe conservar completo el mensaje mas reciente.');

$responsesHistory = ixtla_insights_responses_history_input([
    ['role' => 'user', 'content' => 'Primera pregunta'],
    ['role' => 'assistant', 'content' => 'Primera respuesta'],
    ['role' => 'system', 'content' => 'No debe reenviarse'],
]);
expect_diagnostic($responsesHistory === [
    ['role' => 'user', 'content' => 'Primera pregunta'],
    ['role' => 'assistant', 'content' => 'Primera respuesta'],
], 'El historial de Responses API debe conservar mensajes textuales user/assistant sin usar input_text para assistant.');

expect_diagnostic(ixtla_insights_dataset_department_name('Alumbrado Publico') === 'Alumbrado Publico', 'El filtro de departamento debe conservar el nombre solicitado.');
expect_diagnostic(ixtla_insights_dataset_department_name(null) === null, 'La consulta global no debe requerir filtro de departamento.');

$chatToolNames = array_column(ixtla_insights_tool_definitions(), 'name');
expect_diagnostic($chatToolNames === ['get_requirements_overview', 'search_requirements', 'aggregate_requirements', 'list_requirement_catalog', 'get_requirement_detail', 'get_requirement_summary', 'get_requirement_comments', 'get_requirement_tasks', 'get_requirement_processes', 'get_requirement_activity'], 'El chat debe exponer exclusivamente herramientas vigentes y acotadas.');
$snapshotOverviewTool = array_values(array_filter(ixtla_insights_tool_definitions(), static fn (array $tool): bool => ($tool['name'] ?? '') === 'get_requirements_overview'))[0] ?? [];
expect_diagnostic(($snapshotOverviewTool['parameters']['required'] ?? []) === ['refresh', 'period'], 'El resumen del snapshot debe exigir refresh y periodo.');

$snapshotSearchTool = array_values(array_filter(ixtla_insights_tool_definitions(), static fn (array $tool): bool => ($tool['name'] ?? '') === 'search_requirements'))[0] ?? [];
expect_diagnostic(($snapshotSearchTool['parameters']['properties']['limit']['maximum'] ?? null) === 50, 'Las consultas al snapshot deben limitar las filas enviadas al modelo.');
expect_diagnostic(in_array('assignee_id', $snapshotSearchTool['parameters']['required'] ?? [], true), 'La busqueda debe permitir filtrar por empleado asignado.');
expect_diagnostic(in_array('most_comments', $snapshotSearchTool['parameters']['properties']['sort']['enum'] ?? [], true), 'La busqueda debe permitir ordenar por actividad de comentarios.');
$snapshotDetailTool = array_values(array_filter(ixtla_insights_tool_definitions(), static fn (array $tool): bool => ($tool['name'] ?? '') === 'get_requirement_detail'))[0] ?? [];
expect_diagnostic(($snapshotDetailTool['parameters']['required'] ?? []) === ['id', 'folio'], 'El detalle del snapshot debe aceptar una llave explicita.');
$snapshotAggregateTool = array_values(array_filter(ixtla_insights_tool_definitions(), static fn (array $tool): bool => ($tool['name'] ?? '') === 'aggregate_requirements'))[0] ?? [];
expect_diagnostic(($snapshotAggregateTool['parameters']['properties']['group_by']['enum'] ?? []) === ['status', 'department', 'tramite', 'assignee'], 'El snapshot solo debe agrupar por dimensiones disponibles en la fuente.');
expect_diagnostic(in_array('assignee_id', $snapshotAggregateTool['parameters']['required'] ?? [], true), 'Los agregados deben aceptar un empleado asignado concreto.');
$emptySnapshot = ixtla_insights_snapshot_assemble('test-scope', ['mode' => 'self', 'label' => 'Prueba'], []);
expect_diagnostic(($emptySnapshot['schema_version'] ?? null) === 3, 'El snapshot enriquecido debe invalidar caches de esquemas anteriores.');
expect_diagnostic(count($emptySnapshot['catalogs']['statuses'] ?? []) === 7, 'El catalogo debe listar todos los estatus aunque no existan filas en alguno.');
$commentsTool = array_values(array_filter(ixtla_insights_tool_definitions(), static fn (array $tool): bool => ($tool['name'] ?? '') === 'get_requirement_comments'))[0] ?? [];
expect_diagnostic(($commentsTool['parameters']['properties']['limit']['maximum'] ?? null) === 30, 'Los comentarios deben tener un limite estricto por llamada.');
expect_diagnostic(ixtla_insights_activity_safe_text('Escribe a persona@example.com o 3312345678') === 'Escribe a [correo oculto] o [telefono oculto]', 'Los textos operativos deben ocultar correo y telefono.');
expect_diagnostic(str_contains($domainPrompt, 'snapshot analitico'), 'El perfil debe priorizar el dataset cacheado.');
expect_diagnostic(str_contains($domainPrompt, 'combina como máximo dos herramientas'), 'El perfil debe permitir composicion acotada de herramientas.');
expect_diagnostic(!str_contains(mb_strtolower($domainPrompt), 'prioridad alta'), 'El perfil no debe reintroducir niveles de prioridad.');

expect_diagnostic((int) ixtla_insights_config()['max_tool_calls_per_turn'] === 2, 'El asistente debe conservar un límite total de dos llamadas de herramienta por turno.');

$directQuestions = [
    'Cuanto es 25% de 480?',
    'Cual es la capital de Mexico?',
    'Quien escribio Don Quijote?',
    'Dame una explicacion de que es una API.',
    'Cual es el promedio de 10, 20 y 30?',
    'Cuanto tiempo tiene un dia?',
];
foreach ($directQuestions as $directQuestion) {
    expect_diagnostic(ixtla_insights_question_intent($directQuestion) === 'direct', 'Una pregunta general o matematica debe responderse sin herramientas: ' . $directQuestion);
    expect_diagnostic(ixtla_insights_question_tool_choice($directQuestion) === 'none', 'Las herramientas deben deshabilitarse para respuestas directas: ' . $directQuestion);
}

$datasetQuestions = [
    'Cuantos requerimientos estan pendientes?',
    'Dame los folios vencidos.',
    'Cual es el estatus del REQ-204?',
    'Promedio de tiempo de cierre por departamento.',
];
foreach ($datasetQuestions as $datasetQuestion) {
    expect_diagnostic(ixtla_insights_question_intent($datasetQuestion) === 'dataset', 'Una pregunta sobre Ixtla debe habilitar el dataset: ' . $datasetQuestion);
    expect_diagnostic(ixtla_insights_question_tool_choice($datasetQuestion) === 'auto', 'Las herramientas deben ser opcionales para preguntas del dominio: ' . $datasetQuestion);
}
expect_diagnostic(
    ixtla_insights_history_has_dataset_context([['role' => 'user', 'content' => 'Cuantos requerimientos hay?']]),
    'El historial debe reconocer contexto previo del dataset.'
);
expect_diagnostic(
    ixtla_insights_question_intent('Y cuantos estan pendientes?', true) === 'dataset',
    'Un seguimiento operacional debe conservar el contexto del dataset.'
);
expect_diagnostic(
    ixtla_insights_question_intent('Que significa estar pendiente?', false) === 'direct',
    'Una palabra operacional aislada no debe bloquear una pregunta general.'
);
expect_diagnostic(
    ixtla_insights_question_intent('Que comentaron en ese requerimiento?', true) === 'dataset',
    'Los comentarios deben resolverse como seguimiento del requerimiento previo.'
);
expect_diagnostic(
    ixtla_insights_question_intent('Ayudame con una tarea de matematicas', false) === 'direct',
    'Una tarea general no debe activar herramientas municipales.'
);

$globalAccess = ixtla_insights_access_scope_from_rbac(['empleado' => ['id' => 1, 'departamento_id' => 6], 'scope' => ['global' => true]]);
expect_diagnostic($globalAccess['mode'] === 'global' && $globalAccess['allowed_department_ids'] === null, 'Un perfil global debe conservar acceso global dentro de Insights.');
expect_diagnostic(ixtla_insights_dataset_scope_query($globalAccess)['where'] === ['r.status = 1'], 'El alcance global debe excluir bajas lógicas de requerimientos.');

$departmentAccess = ixtla_insights_access_scope_from_rbac(['empleado' => ['id' => 2, 'departamento_id' => 8], 'scope' => ['department' => true]]);
expect_diagnostic($departmentAccess['mode'] === 'department' && $departmentAccess['allowed_department_ids'] === [8], 'Un perfil de departamento debe quedar limitado a su departamento.');
expect_diagnostic(ixtla_insights_dataset_scope_query($departmentAccess)['params'] === [8], 'La consulta de departamento debe enlazar exclusivamente el departamento autorizado.');
expect_diagnostic(ixtla_insights_dataset_scope_query($departmentAccess)['where'] === ['r.status = 1', 'r.departamento_id = ?'], 'La baja lógica debe aplicarse antes del alcance por departamento.');

$teamAccess = ixtla_insights_access_scope_from_rbac(['empleado' => ['id' => 3, 'departamento_id' => 9], 'scope' => ['team' => true]], [10, 11]);
expect_diagnostic($teamAccess['mode'] === 'team' && $teamAccess['team_employee_ids'] === [3, 10, 11], 'Un perfil de equipo debe incluirse a si mismo y solo a su equipo.');
expect_diagnostic(ixtla_insights_dataset_scope_query($teamAccess)['params'] === [3, 10, 11], 'La consulta de equipo no debe incluir empleados externos.');

$selfAccess = ixtla_insights_access_scope_from_rbac(['empleado' => ['id' => 4, 'departamento_id' => 10], 'scope' => []]);
expect_diagnostic($selfAccess['mode'] === 'self' && ixtla_insights_dataset_scope_query($selfAccess)['params'] === [4], 'Un perfil individual solo debe consultar requerimientos asignados a si mismo.');

echo "OK diagnostics\n";

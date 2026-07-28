<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/datasets/requerimientos_dataset.php';
require_once dirname(__DIR__) . '/tools/tool_registry.php';

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

$latestTool = array_values(array_filter(ixtla_insights_tool_definitions(), static fn (array $tool): bool => ($tool['name'] ?? '') === 'get_latest_requirement'))[0] ?? [];
expect_diagnostic(($latestTool['parameters']['required'] ?? []) === ['department'], 'La herramienta del último requerimiento debe requerir el campo department, incluso si es null.');
expect_diagnostic(($latestTool['parameters']['properties']['department']['type'] ?? []) === ['string', 'null'], 'La herramienta debe aceptar un departamento o null para el alcance completo.');

$globalAccess = ixtla_insights_access_scope_from_rbac(['empleado' => ['id' => 1, 'departamento_id' => 6], 'scope' => ['global' => true]]);
expect_diagnostic($globalAccess['mode'] === 'global' && $globalAccess['allowed_department_ids'] === null, 'Un perfil global debe conservar acceso global dentro de Insights.');

$departmentAccess = ixtla_insights_access_scope_from_rbac(['empleado' => ['id' => 2, 'departamento_id' => 8], 'scope' => ['department' => true]]);
expect_diagnostic($departmentAccess['mode'] === 'department' && $departmentAccess['allowed_department_ids'] === [8], 'Un perfil de departamento debe quedar limitado a su departamento.');
expect_diagnostic(ixtla_insights_dataset_scope_query($departmentAccess)['params'] === [8], 'La consulta de departamento debe enlazar exclusivamente el departamento autorizado.');

$teamAccess = ixtla_insights_access_scope_from_rbac(['empleado' => ['id' => 3, 'departamento_id' => 9], 'scope' => ['team' => true]], [10, 11]);
expect_diagnostic($teamAccess['mode'] === 'team' && $teamAccess['team_employee_ids'] === [3, 10, 11], 'Un perfil de equipo debe incluirse a si mismo y solo a su equipo.');
expect_diagnostic(ixtla_insights_dataset_scope_query($teamAccess)['params'] === [3, 10, 11], 'La consulta de equipo no debe incluir empleados externos.');

$selfAccess = ixtla_insights_access_scope_from_rbac(['empleado' => ['id' => 4, 'departamento_id' => 10], 'scope' => []]);
expect_diagnostic($selfAccess['mode'] === 'self' && ixtla_insights_dataset_scope_query($selfAccess)['params'] === [4], 'Un perfil individual solo debe consultar requerimientos asignados a si mismo.');

echo "OK diagnostics\n";

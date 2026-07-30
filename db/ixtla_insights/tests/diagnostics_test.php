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

$usageSummary = ixtla_insights_usage_summary([
    ['usage' => ['input_tokens' => 120, 'output_tokens' => 30, 'total_tokens' => 150, 'input_tokens_details' => ['cached_tokens' => 20], 'output_tokens_details' => ['reasoning_tokens' => 8]]],
    ['usage' => ['input_tokens' => 80, 'output_tokens' => 40, 'total_tokens' => 120, 'output_tokens_details' => ['reasoning_tokens' => 6]]],
]);
expect_diagnostic($usageSummary === ['provider_requests' => 2, 'input_tokens' => 200, 'output_tokens' => 70, 'reasoning_tokens' => 14, 'cached_input_tokens' => 20, 'total_tokens' => 270], 'El resumen de uso debe acumular todas las respuestas del proveedor.');

$domainProfile = ixtla_insights_domain_profile();
expect_diagnostic(($domainProfile['domain'] ?? null) === 'requerimientos', 'El perfil de dominio debe describir requerimientos.');
expect_diagnostic(($domainProfile['version'] ?? null) === 1, 'El perfil de dominio debe estar versionado.');
$domainPrompt = ixtla_insights_domain_developer_prompt();
expect_diagnostic(str_contains($domainPrompt, 'get_operational_snapshot'), 'El perfil debe incluir la guía para diagnósticos operativos.');
expect_diagnostic(str_contains($domainPrompt, 'get_operational_risk_snapshot'), 'El perfil debe priorizar el diagnóstico compuesto de riesgo.');
expect_diagnostic(str_contains($domainPrompt, 'get_workload_trend_snapshot'), 'El perfil debe incluir el análisis compuesto de tendencia.');
expect_diagnostic(str_contains($domainPrompt, 'get_backlog_risk_snapshot'), 'El perfil debe incluir el análisis compuesto de rezago.');
expect_diagnostic(str_contains($domainPrompt, 'alcance autorizado se resuelve en el servidor'), 'El perfil debe preservar el límite de autorización del servidor.');
expect_diagnostic(ixtla_insights_domain_metric_label('closed_count') === 'Requerimientos finalizados', 'El perfil debe centralizar las etiquetas de métricas.');
expect_diagnostic(ixtla_insights_domain_period_label('last_30') === 'Últimos 30 días', 'El perfil debe centralizar las etiquetas de periodos.');
expect_diagnostic(ixtla_insights_domain_status_label(6) === 'Finalizado', 'El perfil debe centralizar las etiquetas de estados.');
expect_diagnostic(ixtla_insights_domain_status_ids('active') === [0, 1, 2, 3], 'El perfil debe definir los estados activos.');
expect_diagnostic(ixtla_insights_domain_priority_label(3) === 'Alta', 'El perfil debe centralizar las etiquetas de prioridades.');
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

$latestTool = array_values(array_filter(ixtla_insights_tool_definitions(), static fn (array $tool): bool => ($tool['name'] ?? '') === 'get_latest_requirement'))[0] ?? [];
expect_diagnostic(($latestTool['parameters']['required'] ?? []) === ['department'], 'La herramienta del último requerimiento debe requerir el campo department, incluso si es null.');
expect_diagnostic(($latestTool['parameters']['properties']['department']['type'] ?? []) === ['string', 'null'], 'La herramienta debe aceptar un departamento o null para el alcance completo.');

$snapshotTool = array_values(array_filter(ixtla_insights_tool_definitions(), static fn (array $tool): bool => ($tool['name'] ?? '') === 'get_operational_snapshot'))[0] ?? [];
expect_diagnostic(($snapshotTool['parameters']['required'] ?? []) === ['period', 'top_tramites_limit'], 'El snapshot operativo debe exigir periodo y límite de trámites.');
expect_diagnostic(($snapshotTool['parameters']['properties']['top_tramites_limit']['maximum'] ?? null) === 10, 'El snapshot operativo debe limitar el ranking para evitar respuestas desproporcionadas.');

$riskTool = array_values(array_filter(ixtla_insights_tool_definitions(), static fn (array $tool): bool => ($tool['name'] ?? '') === 'get_operational_risk_snapshot'))[0] ?? [];
expect_diagnostic(($riskTool['parameters']['required'] ?? []) === ['period', 'top_tramites_limit', 'due_window_days'], 'El diagnóstico de riesgo debe recibir sólo sus límites explícitos.');
expect_diagnostic(($riskTool['parameters']['properties']['period']['enum'] ?? []) === ['last_7', 'last_30', 'this_month'], 'El diagnóstico de riesgo no debe aceptar historial ilimitado.');
expect_diagnostic(($riskTool['parameters']['properties']['due_window_days']['maximum'] ?? null) === 30, 'El vencimiento próximo debe tener una ventana limitada.');

$workloadSnapshotTool = array_values(array_filter(ixtla_insights_tool_definitions(), static fn (array $tool): bool => ($tool['name'] ?? '') === 'get_workload_trend_snapshot'))[0] ?? [];
expect_diagnostic(($workloadSnapshotTool['parameters']['required'] ?? []) === ['period', 'top_tramites_limit'], 'El análisis de carga debe exigir periodo y límite de trámites.');

$backlogSnapshotTool = array_values(array_filter(ixtla_insights_tool_definitions(), static fn (array $tool): bool => ($tool['name'] ?? '') === 'get_backlog_risk_snapshot'))[0] ?? [];
expect_diagnostic(($backlogSnapshotTool['parameters']['required'] ?? []) === ['top_limit'], 'El análisis de rezago debe limitar explícitamente sus rankings.');

$comparisonTool = array_values(array_filter(ixtla_insights_tool_definitions(), static fn (array $tool): bool => ($tool['name'] ?? '') === 'get_period_comparison'))[0] ?? [];
expect_diagnostic(($comparisonTool['parameters']['required'] ?? []) === ['metric', 'period'], 'La comparación de periodos debe exigir métrica y periodo.');
expect_diagnostic(($comparisonTool['parameters']['properties']['period']['enum'] ?? []) === ['last_7', 'last_30', 'this_month'], 'La comparación sólo debe aceptar periodos con intervalo previo definido.');

$trendTool = array_values(array_filter(ixtla_insights_tool_definitions(), static fn (array $tool): bool => ($tool['name'] ?? '') === 'get_requirements_trend'))[0] ?? [];
expect_diagnostic(($trendTool['parameters']['required'] ?? []) === ['period'], 'La tendencia debe exigir un periodo acotado.');
expect_diagnostic(($trendTool['parameters']['properties']['period']['enum'] ?? []) === ['last_7', 'last_30', 'this_month'], 'La tendencia no debe permitir un historial ilimitado.');

$breakdownTool = array_values(array_filter(ixtla_insights_tool_definitions(), static fn (array $tool): bool => ($tool['name'] ?? '') === 'get_workload_breakdown'))[0] ?? [];
expect_diagnostic(($breakdownTool['parameters']['properties']['dimension']['enum'] ?? []) === ['tramite', 'priority', 'channel', 'colonia', 'assignee'], 'El desglose operativo sólo debe exponer dimensiones aprobadas.');
expect_diagnostic(($breakdownTool['parameters']['properties']['limit']['maximum'] ?? null) === 20, 'El desglose operativo debe limitar la cantidad de resultados.');

$overdueTool = array_values(array_filter(ixtla_insights_tool_definitions(), static fn (array $tool): bool => ($tool['name'] ?? '') === 'get_overdue_requirements'))[0] ?? [];
expect_diagnostic(($overdueTool['parameters']['required'] ?? []) === ['minimum_days', 'limit'], 'La lista de pendientes envejecidos debe exigir límites explícitos.');

expect_diagnostic((int) ixtla_insights_config()['max_tool_calls_per_turn'] === 2, 'El asistente debe conservar un límite total de dos llamadas de herramienta por turno.');

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

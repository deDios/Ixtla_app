<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/tools/tool_registry.php';

function expect_endpoint_contract(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$endpointMethods = [
    'health.php' => 'GET', 'catalog.php' => 'GET', 'departments.php' => 'GET',
    'gpt_probe.php' => 'POST', 'welcome_report.php' => 'POST', 'plan_visualization.php' => 'POST',
    'dataset_preview.php' => 'POST', 'dataset_snapshot.php' => 'POST', 'requirements_source.php' => 'POST',
    'query_export.php' => 'POST', 'draft.php' => 'POST',
];
foreach ($endpointMethods as $file => $method) {
    $path = dirname(__DIR__) . DIRECTORY_SEPARATOR . $file;
    expect_endpoint_contract(is_file($path), 'Falta el endpoint UAT ' . $file . '.');
    $source = file_get_contents($path);
    expect_endpoint_contract(is_string($source) && str_contains($source, "ixtla_insights_bootstrap(['{$method}'])"), $file . ' debe declarar el metodo ' . $method . '.');
}
$bootstrapSource = file_get_contents(dirname(__DIR__) . '/bootstrap.php');
expect_endpoint_contract(is_string($bootstrapSource) && str_contains($bootstrapSource, "'response_mode' => 'json'"), 'Los endpoints deben responder 401 JSON en lugar de redirigir al login.');
$healthSource = file_get_contents(dirname(__DIR__) . '/health.php');
expect_endpoint_contract(is_string($healthSource) && str_contains($healthSource, "'contract_version'"), 'El health UAT debe publicar la version del contrato para diagnosticar despliegues.');
$previewSource = file_get_contents(dirname(__DIR__) . '/dataset_preview.php');
expect_endpoint_contract(is_string($previewSource) && !str_contains($previewSource, "array_column(ixtla_insights_tool_definitions()"), 'La preview no debe exponer todas las herramientas del chat.');
expect_endpoint_contract(!str_contains((string) $previewSource, "'get_requirement_contact'"), 'La preview no debe permitir herramientas de contacto o detalle.');
$requirementUpdateSource = file_get_contents(dirname(__DIR__, 3) . '/WEB/ixtla01_upd_requerimiento.php');
expect_endpoint_contract(is_string($requirementUpdateSource) && str_contains($requirementUpdateSource, 'cerrado_en solo aplica al estatus Finalizado'), 'El endpoint operativo debe impedir fechas de cierre en estados no finalizados.');
$retroUpdateSource = file_get_contents(dirname(__DIR__, 3) . '/WEB/ixtla01_u_retro.php');
expect_endpoint_contract(is_string($retroUpdateSource) && str_contains($retroUpdateSource, 'status de retroalimentacion no valido'), 'El endpoint de retro debe validar su catalogo de estados.');
$retroInsertSource = file_get_contents(dirname(__DIR__, 3) . '/WEB/ixtla01_i_retro.php');
expect_endpoint_contract(is_string($retroInsertSource) && str_contains($retroInsertSource, 'if ($calificacion === 0)'), 'La invitacion inicial debe aceptar 0 como ausencia de calificacion.');
$retroViewSource = file_get_contents(dirname(__DIR__, 4) . '/JS/UAT/requerimientoView.js');
expect_endpoint_contract(is_string($retroViewSource) && str_contains($retroViewSource, 'calificacion: 0'), 'La vista de requerimiento debe conservar el valor inicial sin calificacion.');
$homeSource = file_get_contents(dirname(__DIR__, 4) . '/JS/UAT/home.js');
expect_endpoint_contract(is_string($homeSource) && str_contains($homeSource, '/db/UAT/ixtla_insights/gpt_probe.php'), 'La vista UAT debe apuntar al endpoint UAT del asistente.');
expect_endpoint_contract(str_contains((string) $homeSource, 'data-contract-8'), 'La vista UAT debe invalidar el cache al publicar el contrato compartido.');

$aggregateArguments = [
    'period' => 'all', 'department_id' => 0, 'department_ids' => [], 'department_names' => [],
    'assignee_id' => 0, 'assignee_ids' => [], 'tramite_ids' => [], 'status_ids' => [], 'channel_ids' => [],
    'assignee_state' => 'any', 'date_field' => 'created_at', 'date_from' => null, 'date_to' => null,
    'group_by' => 'date', 'sort' => 'asc', 'limit' => 50,
];
ixtla_insights_validate_tool_arguments('aggregate_requirements', $aggregateArguments);

$dimensionArguments = $aggregateArguments;
unset($dimensionArguments['sort'], $dimensionArguments['limit']);
$dimensionArguments += [
    'series_by' => 'status', 'date_grain' => 'month', 'category_limit' => 24,
    'series_limit' => 7, 'include_other' => true,
];
ixtla_insights_validate_tool_arguments('aggregate_requirement_dimensions', $dimensionArguments);

$invalidArguments = $aggregateArguments;
$invalidArguments['department_id'] = null;
try {
    ixtla_insights_validate_tool_arguments('aggregate_requirements', $invalidArguments);
    expect_endpoint_contract(false, 'El contrato debe rechazar department_id null.');
} catch (InvalidArgumentException $error) {
    expect_endpoint_contract(str_contains($error->getMessage(), 'arguments.department_id'), 'El error debe identificar el campo incompatible.');
}

$feedbackArguments = [
    'status_ids' => [], 'rating_ids' => [], 'department_ids' => [], 'tramite_ids' => [],
    'requirement_status_ids' => [], 'channel_ids' => [], 'assignee_ids' => [], 'assignee_state' => 'any',
    'period' => 'last_30', 'date_field' => 'created_at', 'date_from' => null, 'date_to' => null, 'group_by' => 'rating', 'limit' => 10,
];
ixtla_insights_validate_tool_arguments('aggregate_feedback', $feedbackArguments);
$feedbackArguments['date_field'] = 'updated_at';
$feedbackArguments['status_ids'] = [2];
ixtla_insights_validate_tool_arguments('aggregate_feedback', $feedbackArguments);

$catalog = ixtla_insights_catalog();
$dataContract = ixtla_insights_data_contract();
expect_endpoint_contract(($catalog['version'] ?? null) === ($dataContract['version'] ?? null), 'El catalogo debe usar la version del contrato compartido.');
expect_endpoint_contract(($catalog['schema_version'] ?? null) === ($dataContract['snapshot']['schema_version'] ?? null), 'El catalogo debe publicar la version del snapshot compatible.');
expect_endpoint_contract(($catalog['profile_version'] ?? null) === ($dataContract['profile_version'] ?? null), 'El catalogo debe publicar la version del perfil compatible.');
expect_endpoint_contract(($catalog['periods'] ?? null) === array_keys($dataContract['periods']), 'El catalogo debe publicar exactamente los periodos del contrato compartido.');
expect_endpoint_contract(($catalog['data_semantics']['status_groups'] ?? null) === ($dataContract['status_groups'] ?? null), 'El catalogo debe usar los grupos de estatus del contrato compartido.');
expect_endpoint_contract(in_array('this_week', $catalog['periods'] ?? [], true), 'El catalogo debe publicar la semana en curso.');
expect_endpoint_contract(in_array('retroalimentaciones', $catalog['domains'] ?? [], true), 'El catalogo debe declarar retroalimentaciones.');
expect_endpoint_contract(in_array('promedio_calificacion', $catalog['metrics'] ?? [], true), 'El catalogo debe declarar las metricas de retroalimentacion.');
expect_endpoint_contract(in_array('matrix', $catalog['widget_kinds'] ?? [], true), 'El catalogo debe declarar matrices.');
expect_endpoint_contract(in_array('estatus', $catalog['series_dimensions'] ?? [], true), 'El catalogo debe declarar dimensiones de serie.');
expect_endpoint_contract(in_array('cerrados', $catalog['metrics'] ?? [], true), 'El catalogo debe conservar cerrados como alias de Finalizado.');
expect_endpoint_contract(!in_array('funnel', $catalog['widget_kinds'] ?? [], true), 'El catalogo no debe anunciar un formato que el planificador no ejecuta.');
expect_endpoint_contract(!in_array('promedio_semanal', $catalog['metrics'] ?? [], true) && !in_array('tiempo_resolucion', $catalog['metrics'] ?? [], true), 'El catalogo no debe anunciar metricas sin calculo en el snapshot vigente.');
expect_endpoint_contract(ixtla_insights_is_fixed_status_metric('cerrados'), 'Cerrados debe usar el estado Finalizado fijo.');

$toolNames = array_map(static fn (array $definition): string => (string) ($definition['name'] ?? ''), ixtla_insights_tool_definitions());
expect_endpoint_contract(in_array('run_analysis_plan', $toolNames, true), 'El asistente debe publicar el plan analitico generico.');
expect_endpoint_contract(!in_array('get_requirement_contact', ixtla_insights_analysis_plan_tools(), true), 'Los planes generales no deben consultar contactos.');
$welcomeSource = file_get_contents(dirname(__DIR__) . '/welcome_report.php');
expect_endpoint_contract(is_string($welcomeSource) && str_contains($welcomeSource, "'contract_version' => \$contract['version']"), 'El welcome report debe declarar el contrato compartido.');
expect_endpoint_contract(str_contains((string) $welcomeSource, "'trend_period_label'"), 'El welcome report debe etiquetar el periodo propio de la tendencia.');
$chatSource = file_get_contents(dirname(__DIR__, 4) . '/JS/UAT/insights/chat.js');
expect_endpoint_contract(is_string($chatSource) && str_contains($chatSource, 'trend_period_label'), 'La vista UAT debe mostrar el periodo entregado por el welcome report.');
expect_endpoint_contract(str_contains((string) $chatSource, 'EXPECTED_CONTRACT_VERSION = 8'), 'La vista UAT debe rechazar endpoints de una version incompatible.');
ixtla_insights_validate_tool_arguments('run_analysis_plan', [
    'steps' => [
        ['id' => 'resumen', 'tool' => 'get_requirements_overview', 'arguments' => []],
        ['id' => 'ranking', 'tool' => 'aggregate_requirements', 'arguments' => []],
    ],
]);
try {
    ixtla_insights_validate_tool_arguments('run_analysis_plan', [
        'steps' => [['id' => 'solo', 'tool' => 'get_requirements_overview', 'arguments' => []]],
    ]);
    expect_endpoint_contract(false, 'Un plan analitico debe requerir al menos dos pasos.');
} catch (InvalidArgumentException) {
    // Expected.
}

echo "OK endpoint contracts\n";

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
$previewSource = file_get_contents(dirname(__DIR__) . '/dataset_preview.php');
expect_endpoint_contract(is_string($previewSource) && !str_contains($previewSource, "array_column(ixtla_insights_tool_definitions()"), 'La preview no debe exponer todas las herramientas del chat.');
expect_endpoint_contract(!str_contains((string) $previewSource, "'get_requirement_contact'"), 'La preview no debe permitir herramientas de contacto o detalle.');

$aggregateArguments = [
    'period' => 'all', 'department_id' => 0, 'department_ids' => [], 'department_names' => [],
    'assignee_id' => 0, 'assignee_ids' => [], 'tramite_ids' => [], 'status_ids' => [], 'channel_ids' => [],
    'assignee_state' => 'any', 'date_field' => 'created_at', 'date_from' => null, 'date_to' => null,
    'group_by' => 'date', 'sort' => 'asc', 'limit' => 50,
];
ixtla_insights_validate_tool_arguments('aggregate_requirements', $aggregateArguments);

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
    'period' => 'last_30', 'date_from' => null, 'date_to' => null, 'group_by' => 'rating', 'limit' => 10,
];
ixtla_insights_validate_tool_arguments('aggregate_feedback', $feedbackArguments);

$catalog = ixtla_insights_catalog();
expect_endpoint_contract(($catalog['version'] ?? 0) >= 3, 'El catalogo debe reflejar el contrato grafico actual.');
expect_endpoint_contract(in_array('retroalimentaciones', $catalog['domains'] ?? [], true), 'El catalogo debe declarar retroalimentaciones.');
expect_endpoint_contract(in_array('promedio_calificacion', $catalog['metrics'] ?? [], true), 'El catalogo debe declarar las metricas de retroalimentacion.');

echo "OK endpoint contracts\n";

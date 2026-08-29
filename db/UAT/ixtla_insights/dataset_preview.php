<?php
declare(strict_types=1);

/**
 * visualizador interno de datasets de Insights.
 *
 * Ejecuta únicamente herramientas de lectura 
 * No acepta SQL, nombres de tablas ni filtros arbitrarios
 */
ob_start();
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/tools/tool_registry.php';

ixtla_insights_bootstrap(['POST']);
$body = ixtla_insights_request_body();
$tool = trim((string) ($body['tool'] ?? ''));
$arguments = $body['arguments'] ?? [];

if (!is_array($arguments)) {
    ixtla_insights_json(['ok' => false, 'error' => 'arguments debe ser un objeto JSON.'], 422);
}

$allowedTools = [
    'get_requirements_overview',
    'aggregate_requirements',
    'aggregate_requirement_dimensions',
    'get_feedback_overview',
    'aggregate_feedback',
];

if (!in_array($tool, $allowedTools, true)) {
    ixtla_insights_json([
        'ok' => false,
        'error' => 'El dataset solicitado no esta disponible en el visor.',
        'available_tools' => $allowedTools,
    ], 422);
}

try {
    $data = ixtla_insights_execute_tool($tool, $arguments);
    ixtla_insights_json([
        'ok' => true,
        'tool' => $tool,
        'data' => $data,
    ]);
} catch (InvalidArgumentException $error) {
    ixtla_insights_json(['ok' => false, 'error' => $error->getMessage()], 422);
} catch (Throwable $error) {
    ixtla_insights_log_error('dataset_preview', $error, ['tool' => $tool]);
    ixtla_insights_json(['ok' => false, 'error' => 'No fue posible obtener el dataset solicitado.'], 503);
}

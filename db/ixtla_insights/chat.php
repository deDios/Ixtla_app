<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../conn/conn_db.php';
define('IXTLA_INSIGHTS_ANALYTICS_LIBRARY', true);
require_once __DIR__ . '/analytics.php';
require_once __DIR__ . '/conversation_service.php';

$config = ixtla_insights_bootstrap(['POST']);
if (($config['enabled'] ?? false) !== true) {
    ixtla_insights_json([
        'ok' => false,
        'error' => 'Ixtla Insights esta deshabilitado en este entorno.',
    ], 503);
}

$body = ixtla_insights_request_body();
$question = trim((string) ($body['question'] ?? ''));
$maxCharacters = (int) ($config['max_question_characters'] ?? 800);

if ($question === '' || mb_strlen($question) > $maxCharacters) {
    ixtla_insights_json(['ok' => false, 'error' => 'La pregunta no es valida.'], 422);
}

$history = is_array($body['history'] ?? null)
    ? ixtla_insights_clean_history(
        $body['history'],
        (int) ($config['max_history_messages'] ?? 6),
        (int) ($config['max_history_characters'] ?? 400)
    )
    : [];

$con = conectar();
if (!$con instanceof mysqli) {
    ixtla_insights_json(['ok' => false, 'error' => 'No fue posible consultar el catálogo de departamentos.'], 503);
}
$con->set_charset('utf8mb4');

try {
    $departments = ixtla_insights_authorized_department_catalog($con);
    $operationalResponse = ixtla_insights_answer_operational_question($con, $question);
    if ($operationalResponse !== null) {
        $con->close();
        ixtla_insights_json($operationalResponse);
    }
    $con->close();
} catch (Throwable $error) {
    error_log('[IxtlaInsights chat] ' . $error->getMessage());
    $con->close();
    ixtla_insights_json(['ok' => false, 'error' => 'No fue posible consultar el catálogo de departamentos.'], 503);
}

$response = ixtla_insights_call_openai($config, $question, $history, $departments);
ixtla_insights_json($response);

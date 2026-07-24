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
consola_debug('chat.question_validated', [
    'question_length' => mb_strlen($question),
    'question_fingerprint' => substr(hash('sha256', $question), 0, 12),
]);

$history = is_array($body['history'] ?? null)
    ? ixtla_insights_clean_history(
        $body['history'],
        (int) ($config['max_history_messages'] ?? 6),
        (int) ($config['max_history_characters'] ?? 400)
    )
    : [];
consola_debug('chat.history_normalized', ['messages' => count($history)]);

$con = conectar();
if (!$con instanceof mysqli) {
    ixtla_insights_json(['ok' => false, 'error' => 'No fue posible consultar el catálogo de departamentos.'], 503);
}
$con->set_charset('utf8mb4');
consola_debug('chat.catalog_connection_ready');

$departments = [];
try {
    $departments = ixtla_insights_authorized_department_catalog($con);
    consola_debug('chat.departments_authorized', ['count' => count($departments)]);
    $operationalResponse = ixtla_insights_answer_operational_question($con, $question);
    if ($operationalResponse !== null) {
        consola_debug('chat.operational_response_ready');
        $con->close();
        ixtla_insights_json($operationalResponse);
    }
    $con->close();
} catch (Throwable $error) {
    ixtla_insights_log_error('chat_catalog', $error);
    $con->close();
    ixtla_insights_json(['ok' => false, 'error' => 'No fue posible consultar el catálogo de departamentos.'], 503);
}

$debugModel = (string) ($config['model'] ?? '');
consola_debug('chat.openai_requested', ['model' => $debugModel]);
$response = ixtla_insights_call_openai($config, $question, $history, $departments);
consola_debug('chat.openai_response_normalized', [
    'has_report_plan' => is_array($response['report_plan'] ?? null),
    'actions' => count(is_array($response['actions'] ?? null) ? $response['actions'] : []),
]);
if (is_array($response['report_plan'] ?? null)) {
    $reportConnection = conectar();
    if (!$reportConnection instanceof mysqli) {
        ixtla_insights_json(['ok' => false, 'error' => 'No fue posible calcular el reporte solicitado.'], 503);
    }
    $reportConnection->set_charset('utf8mb4');
    $reportConnection->query("SET time_zone='-06:00'");
    try {
        consola_debug('chat.report_execution_started');
        $response = ixtla_insights_execute_report_plan($reportConnection, $response);
        consola_debug('chat.report_execution_finished', [
            'items' => count(is_array($response['report']['items'] ?? null) ? $response['report']['items'] : []),
        ]);
        $reportConnection->close();
    } catch (InvalidArgumentException $error) {
        $reportConnection->close();
        ixtla_insights_json(['ok' => false, 'error' => $error->getMessage()], 422);
    } catch (Throwable $error) {
        ixtla_insights_log_error('report', $error);
        $reportConnection->close();
        ixtla_insights_json(['ok' => false, 'error' => 'No fue posible calcular el reporte solicitado.'], 503);
    }
}
ixtla_insights_json($response);

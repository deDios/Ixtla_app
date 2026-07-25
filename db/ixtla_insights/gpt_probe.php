<?php
declare(strict_types=1);

/**
 * Sonda mínima de OpenAI para aislar la integración del asistente.
 *
 * No carga conexión a BD, catálogo de departamentos, RBAC de métricas,
 * solo debe responder a cosas sencillas.
 */
require_once __DIR__ . '/bootstrap.php';

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

consola_debug('gpt_probe.question_validated', [
    'question_length' => mb_strlen($question),
    'question_fingerprint' => substr(hash('sha256', $question), 0, 12),
]);

// Reutiliza el contrato y transporte del proveedor. Sin departamentos, el
// modelo no puede proponer datos reales ni ejecutar una consulta posterior.
$response = ixtla_insights_call_openai($config, $question, [], []);
consola_debug('gpt_probe.answer_ready', [
    'answer_length' => mb_strlen((string) ($response['answer'] ?? '')),
]);

ixtla_insights_json([
    'ok' => true,
    'mode' => 'gpt_probe',
    'answer' => (string) ($response['answer'] ?? ''),
    'suggestions' => is_array($response['suggestions'] ?? null) ? $response['suggestions'] : [],
]);

<?php
declare(strict_types=1);

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

$history = is_array($body['history'] ?? null)
    ? ixtla_insights_clean_history($body['history'], (int) ($config['max_history_messages'] ?? 12))
    : [];

$response = ixtla_insights_call_openai($config, $question, $history);
ixtla_insights_json($response);

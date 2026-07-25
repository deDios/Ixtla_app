<?php
declare(strict_types=1);

/**
 * Sonda mínima de OpenAI para aislar la integración del asistente.
 *
 * No carga conexión a BD, catálogo de departamentos, RBAC de métricas,
 * solo debe responder a cosas sencillas.
 */
ob_start();
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

$answer = ixtla_insights_probe_openai_text($config, $question);
consola_debug('gpt_probe.answer_ready', [
    'answer_length' => mb_strlen($answer),
]);

ixtla_insights_json([
    'ok' => true,
    'mode' => 'gpt_probe',
    'answer' => $answer,
    'suggestions' => [],
]);

/**
 * Adaptador deliberadamente mínimo para comprobar PHP -> OpenAI.
 *
 * Su payload replica el patrón estable de PRI: texto de entrada, Responses
 * API y texto de salida. No comparte el contrato estructurado de chat.php
 * porque ese contrato es precisamente una de las capas que esta sonda aísla.
 */
function ixtla_insights_probe_openai_text(array $config, string $question): string
{
    if (!function_exists('curl_init')) {
        ixtla_insights_json(['ok' => false, 'error' => 'La extension cURL no esta disponible.'], 500);
    }

    $apiKey = trim((string) ($config['api_key'] ?? ''));
    $providerUrl = trim((string) ($config['provider_url'] ?? ''));
    $model = trim((string) ($config['model'] ?? ''));
    if ($apiKey === '' || $providerUrl === '' || $model === '') {
        ixtla_insights_json(['ok' => false, 'error' => 'No hay configuracion de OpenAI disponible para Insights.'], 503);
    }

    $payload = [
        'model' => $model,
        'input' => [[
            'role' => 'user',
            'content' => [[
                'type' => 'input_text',
                'text' => 'Responde en español, de forma breve y útil. No afirmes haber consultado una base de datos ni inventes cifras. Pregunta: ' . $question,
            ]],
        ]],
        'temperature' => 0,
        'max_output_tokens' => 500,
    ];
    $encodedPayload = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encodedPayload === false) {
        ixtla_insights_json(['ok' => false, 'error' => 'No fue posible preparar la solicitud de prueba.'], 500);
    }

    $curl = curl_init();
    if ($curl === false) {
        ixtla_insights_json(['ok' => false, 'error' => 'No fue posible inicializar cURL.'], 500);
    }

    consola_debug('gpt_probe.openai_request_started', [
        'model' => $model,
        'question_length' => mb_strlen($question),
    ]);
    curl_setopt_array($curl, [
        CURLOPT_URL => $providerUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => 'POST',
        CURLOPT_POSTFIELDS => $encodedPayload,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
            'Accept: application/json',
        ],
    ]);

    $startedAt = microtime(true);
    $raw = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $curlError = curl_error($curl);
    curl_close($curl);
    $latencyMs = (int) round((microtime(true) - $startedAt) * 1000);
    consola_debug('gpt_probe.openai_response_received', [
        'http_status' => $status,
        'latency_ms' => $latencyMs,
        'has_transport_error' => $curlError !== '',
    ]);

    $response = is_string($raw) ? json_decode($raw, true) : null;
    if ($status < 200 || $status >= 300 || !is_array($response)) {
        $providerError = is_array($response['error'] ?? null) ? $response['error'] : [];
        error_log(sprintf(
            '[IxtlaInsights gpt_probe][%s] http_status=%d provider_code=%s curl_error=%s',
            ixtla_insights_request_id(),
            $status,
            ixtla_insights_truncate((string) ($providerError['code'] ?? $providerError['type'] ?? ''), 80),
            ixtla_insights_truncate($curlError, 120)
        ));
        ixtla_insights_json(['ok' => false, 'error' => 'OpenAI no pudo procesar la prueba.'], 502);
    }

    ixtla_insights_log_usage($response, [
        'model' => $model,
        'latency_ms' => $latencyMs,
        'mode' => 'gpt_probe',
    ]);
    $answer = trim(ixtla_insights_openai_text($response));
    if ($answer === '') {
        ixtla_insights_json(['ok' => false, 'error' => 'OpenAI no devolvio texto para la prueba.'], 502);
    }

    return $answer;
}

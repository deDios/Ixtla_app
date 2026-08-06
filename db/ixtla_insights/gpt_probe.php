<?php
declare(strict_types=1);

/**
 * Endpoint del asistente: coordina estado conversacional, modelo y herramientas.
 * Las consultas de datos pasan exclusivamente por el registro autorizado de tools.
 */
ob_start();
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/tools/tool_registry.php';
require_once __DIR__ . '/conversation_state.php';
require_once __DIR__ . '/question_router.php';

$config = ixtla_insights_bootstrap(['POST']);
if (($config['enabled'] ?? false) !== true) {
    ixtla_insights_json([
        'ok' => false,
        'error' => 'Ixtla Insights esta deshabilitado en este entorno.',
    ], 503);
}

$body = ixtla_insights_request_body();
if (($body['action'] ?? '') === 'clear_conversation') {
    ixtla_insights_conversation_clear();
    ixtla_insights_json(['ok' => true, 'mode' => 'gpt_probe', 'cleared' => true]);
}
$question = trim((string) ($body['question'] ?? ''));
$maxCharacters = (int) $config['max_question_characters'];
if ($question === '' || mb_strlen($question) > $maxCharacters) {
    ixtla_insights_json(['ok' => false, 'error' => 'La pregunta no es valida.'], 422);
}

consola_debug('gpt_probe.question_validated', [
    'question_length' => mb_strlen($question),
    'question_fingerprint' => substr(hash('sha256', $question), 0, 12),
]);

$conversation = ixtla_insights_conversation_load($config);
$history = ixtla_insights_clean_history(
    $conversation['history'],
    (int) $config['max_history_messages'],
    (int) $config['max_history_message_characters'],
    (int) $config['max_history_total_characters']
);
consola_debug('gpt_probe.history_normalized', ['messages' => count($history)]);
consola_debug('gpt_probe.history_size', [
    'characters' => array_sum(array_map(static fn (array $message): int => mb_strlen((string) ($message['content'] ?? '')), $history)),
]);

$probeResult = ixtla_insights_probe_openai_text($config, $question, $history, ixtla_insights_conversation_context_text($conversation));
$answer = $probeResult['answer'];
ixtla_insights_conversation_append($conversation, $config, $question, $answer);
consola_debug('gpt_probe.answer_ready', [
    'answer_length' => mb_strlen($answer),
    'total_tokens' => (int) ($probeResult['usage']['total_tokens'] ?? 0),
]);

ixtla_insights_json([
    'ok' => true,
    'mode' => 'gpt_probe',
    'answer' => $answer,
    'usage' => $probeResult['usage'],
    'suggestions' => [],
]);

/**
 * Adaptador HTTP para Responses API. No acepta instrucciones ni historial del
 * navegador como fuente de autoridad; ambos se normalizan en el servidor.
 */
function ixtla_insights_probe_openai_text(array $config, string $question, array $history = [], string $conversationContext = ''): array
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

    $historyInput = ixtla_insights_responses_history_input($history);
    $hasDatasetContext = ixtla_insights_history_has_dataset_context($history);
    $requiresData = ixtla_insights_probe_requires_data($question, $hasDatasetContext);

    $payload = [
        'model' => $model,
        'input' => array_merge([
            [
            'role' => 'developer',
            'content' => [[
                'type' => 'input_text',
                'text' => ixtla_insights_domain_developer_prompt(),
            ]],
            ],
        ], $conversationContext !== '' ? [[
            'role' => 'developer',
            'content' => [['type' => 'input_text', 'text' => 'Contexto estructurado de la conversación: ' . $conversationContext]],
        ]] : [], $historyInput, [
            [
                'role' => 'user',
                'content' => [['type' => 'input_text', 'text' => $question]],
            ],
        ]),
    ];
    $payload = array_replace($payload, ixtla_insights_generation_controls($config));
    // Las preguntas generales y los cálculos no reciben definiciones de
    // funciones. Para datos internos, las herramientas quedan disponibles en
    // modo auto y el servidor sigue impidiendo respuestas sin evidencia.
    if ($requiresData) {
        $payload['tools'] = ixtla_insights_tool_definitions();
        $payload['tool_choice'] = ixtla_insights_question_tool_choice($question, $hasDatasetContext);
    }
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
        CURLOPT_TIMEOUT => (int) $config['request_timeout_seconds'],
        CURLOPT_CONNECTTIMEOUT => (int) $config['connect_timeout_seconds'],
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

    $providerResponses = [$response];
    $totalLatencyMs = $latencyMs;
    $toolCalls = ixtla_insights_probe_tool_calls($response);
    if ($toolCalls === [] && $requiresData) {
        $usage = ixtla_insights_usage_summary($providerResponses);
        ixtla_insights_log_usage_summary($usage, [
            'model' => $model,
            'latency_ms' => $totalLatencyMs,
            'mode' => 'gpt_probe',
        ]);
        return [
            'answer' => 'No se ejecutó la consulta necesaria sobre el dataset autorizado. Reformula la pregunta indicando el dato, periodo o filtro requerido; el asistente puede buscar filas, agruparlas, consultar un folio y generar un resumen desde la muestra.',
            'usage' => $usage,
        ];
    }
    $remainingToolCalls = max(0, (int) $config['max_tool_calls_per_turn']);
    $toolRound = 0;
    while ($toolCalls !== [] && $remainingToolCalls > 0) {
        $toolCalls = array_slice($toolCalls, 0, $remainingToolCalls);
        consola_debug('gpt_probe.tools_requested', ['count' => count($toolCalls), 'round' => $toolRound + 1]);
        $outputs = [];
        foreach ($toolCalls as $toolCall) {
            $arguments = json_decode((string) $toolCall['arguments'], true);
            $arguments = ixtla_insights_apply_default_period(
                (string) $toolCall['name'],
                is_array($arguments) ? $arguments : [],
                $question
            );
            try {
                $result = ixtla_insights_execute_tool((string) $toolCall['name'], $arguments);
                ixtla_insights_conversation_apply_tool((string) $toolCall['name'], $arguments);
                consola_debug('gpt_probe.tool_completed', ['tool' => (string) $toolCall['name']]);
                $output = ['ok' => true, 'data' => $result];
            } catch (Throwable $error) {
                ixtla_insights_log_error('gpt_probe_tool', $error, ['tool' => (string) $toolCall['name']]);
                $output = ['ok' => false, 'error' => 'No fue posible obtener ese dato autorizado.'];
            }
            $outputs[] = [
                'type' => 'function_call_output',
                'call_id' => (string) $toolCall['call_id'],
                'output' => json_encode($output, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ];
        }
        $remainingToolCalls -= count($toolCalls);
        $toolRound++;
        $continuationStartedAt = microtime(true);
        $response = ixtla_insights_probe_continue_after_tools($config, $response, $outputs, $remainingToolCalls > 0);
        $totalLatencyMs += (int) round((microtime(true) - $continuationStartedAt) * 1000);
        $providerResponses[] = $response;
        $toolCalls = $remainingToolCalls > 0
            ? ixtla_insights_probe_tool_calls($response, $remainingToolCalls)
            : [];
    }

    $usage = ixtla_insights_usage_summary($providerResponses);
    ixtla_insights_log_usage_summary($usage, [
        'model' => $model,
        'latency_ms' => $totalLatencyMs,
        'mode' => 'gpt_probe',
    ]);
    $answer = trim(ixtla_insights_openai_text($response));
    if ($answer === '') {
        ixtla_insights_json(['ok' => false, 'error' => 'OpenAI no devolvio texto para la prueba.'], 502);
    }

    return ['answer' => $answer, 'usage' => $usage];
}

function ixtla_insights_probe_tool_calls(array $response, ?int $limit = null): array
{
    $calls = [];
    foreach (is_array($response['output'] ?? null) ? $response['output'] : [] as $item) {
        if (($item['type'] ?? '') !== 'function_call') {
            continue;
        }
        $name = trim((string) ($item['name'] ?? ''));
        $callId = trim((string) ($item['call_id'] ?? ''));
        if ($name !== '' && $callId !== '') {
            $calls[] = ['name' => $name, 'call_id' => $callId, 'arguments' => (string) ($item['arguments'] ?? '{}')];
        }
    }
    if ($limit === null) {
        $config = ixtla_insights_config();
        $limit = (int) $config['max_tool_calls_per_turn'];
    }
    return array_slice($calls, 0, max(0, $limit));
}

function ixtla_insights_probe_continue_after_tools(array $config, array $previousResponse, array $outputs, bool $allowMoreTools = false): array
{
    $responseId = trim((string) ($previousResponse['id'] ?? ''));
    if ($responseId === '') {
        ixtla_insights_json(['ok' => false, 'error' => 'OpenAI no devolvió un identificador de respuesta.'], 502);
    }
    $payload = [
        'model' => (string) $config['model'],
        'previous_response_id' => $responseId,
        'input' => $outputs,
        'tools' => ixtla_insights_tool_definitions(),
        // Permitimos una ronda adicional cuando todavía quedan llamadas dentro
        // del límite total. Así el modelo puede completar un reporte compuesto
        // sin obligar al usuario a enviar otro mensaje.
        'tool_choice' => $allowMoreTools ? 'auto' : 'none',
    ];
    $payload = array_replace($payload, ixtla_insights_generation_controls($config));
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($body === false) {
        ixtla_insights_json(['ok' => false, 'error' => 'No fue posible continuar la consulta de datos.'], 500);
    }
    $curl = curl_init();
    if ($curl === false) {
        ixtla_insights_json(['ok' => false, 'error' => 'No fue posible inicializar cURL.'], 500);
    }
    curl_setopt_array($curl, [
        CURLOPT_URL => (string) $config['provider_url'], CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => 'POST',
        CURLOPT_POSTFIELDS => $body, CURLOPT_TIMEOUT => (int) $config['request_timeout_seconds'], CURLOPT_CONNECTTIMEOUT => (int) $config['connect_timeout_seconds'],
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . (string) $config['api_key'], 'Content-Type: application/json', 'Accept: application/json'],
    ]);
    $raw = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $curlError = curl_error($curl);
    curl_close($curl);
    $response = is_string($raw) ? json_decode($raw, true) : null;
    if ($status < 200 || $status >= 300 || !is_array($response)) {
        error_log(sprintf('[IxtlaInsights gpt_probe_tools][%s] http_status=%d curl_error=%s', ixtla_insights_request_id(), $status, ixtla_insights_truncate($curlError, 120)));
        ixtla_insights_json(['ok' => false, 'error' => 'OpenAI no pudo redactar la respuesta con los datos obtenidos.'], 502);
    }
    return $response;
}

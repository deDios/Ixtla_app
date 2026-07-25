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
require_once __DIR__ . '/tools/tool_registry.php';

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

$history = is_array($body['history'] ?? null)
    ? ixtla_insights_clean_history($body['history'], 12, 600)
    : [];
consola_debug('gpt_probe.history_normalized', ['messages' => count($history)]);

$answer = ixtla_insights_probe_openai_text($config, $question, $history);
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
function ixtla_insights_probe_openai_text(array $config, string $question, array $history = []): string
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

    $historyInput = [];
    foreach ($history as $message) {
        $role = (string) ($message['role'] ?? '');
        $content = trim((string) ($message['content'] ?? ''));
        if (!in_array($role, ['user', 'assistant'], true) || $content === '') {
            continue;
        }
        $historyInput[] = [
            'role' => $role,
            'content' => [['type' => 'input_text', 'text' => $content]],
        ];
    }

    $payload = [
        'model' => $model,
        'input' => array_merge([
            [
            'role' => 'developer',
            'content' => [[
                'type' => 'input_text',
                'text' => 'Responde en español, de forma breve y útil. Para datos actuales de requerimientos usa exclusivamente las herramientas disponibles. '
                    . 'No inventes cifras, departamentos ni resultados y no prometas consultar datos después: si la pregunta requiere datos, llama la herramienta correspondiente antes de responder. '
                    . 'Usa query_requirements_analytics como herramienta principal para totales, abiertos, finalizados, pausados/cancelados, rankings por departamento y rankings por trámite. '
                    . 'Para requerimientos finalizados usa metric closed_count y field closed_at; para los demás conteos usa created_at. '
                    . 'Para preguntas de cantidad o desglose simple por departamento también puedes usar get_requirements_by_department. Para totales o estatus usa get_scope_summary. '
                    . 'Para saber qué departamentos puede consultar la persona usa list_authorized_departments. '
                    . 'Para el último requerimiento usa get_latest_requirement. Para tiempo promedio de resolución por departamento usa get_resolution_time_by_department. '
                    . 'Si no existe una herramienta compatible, explica la limitación sin dar cifras ni identificar departamentos o requerimientos.',
            ]],
            ],
        ], $historyInput, [
            [
                'role' => 'user',
                'content' => [['type' => 'input_text', 'text' => $question]],
            ],
        ]),
        'temperature' => 0,
        'max_output_tokens' => 500,
        'tools' => ixtla_insights_tool_definitions(),
        'tool_choice' => 'auto',
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

    $toolCalls = ixtla_insights_probe_tool_calls($response);
    if ($toolCalls === [] && ixtla_insights_probe_requires_data($question)) {
        return 'No tengo una herramienta compatible para obtener ese dato con seguridad. Puedo ayudarte con totales, estatus, departamentos, trámites, el último requerimiento y tiempos promedio de resolución por departamento.';
    }
    if ($toolCalls !== []) {
        consola_debug('gpt_probe.tools_requested', ['count' => count($toolCalls)]);
        $outputs = [];
        foreach ($toolCalls as $toolCall) {
            $arguments = json_decode((string) $toolCall['arguments'], true);
            try {
                $result = ixtla_insights_execute_tool((string) $toolCall['name'], is_array($arguments) ? $arguments : []);
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
        $response = ixtla_insights_probe_continue_after_tools($config, $response, $outputs);
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

function ixtla_insights_probe_requires_data(string $question): bool
{
    $normalized = ixtla_insights_normalize_match_text($question);
    return preg_match('/\b(cuanto|cuantos|cuanta|cuantas|numero|ultimo|ultima|top|ranking|promedio|tiempo|cierre|cerrado|cerrados|finalizado|finalizados|departamento|tramite|estatus)\b/', $normalized) === 1;
}

function ixtla_insights_probe_tool_calls(array $response): array
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
    return array_slice($calls, 0, 2);
}

function ixtla_insights_probe_continue_after_tools(array $config, array $previousResponse, array $outputs): array
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
        'tool_choice' => 'none',
        'max_output_tokens' => 500,
    ];
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
        CURLOPT_POSTFIELDS => $body, CURLOPT_TIMEOUT => 60, CURLOPT_CONNECTTIMEOUT => 15,
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

<?php
declare(strict_types=1);

require_once __DIR__ . '/../../JS/UAT/auth/ix_guard.php';
require_once __DIR__ . '/../conn/ixtla_insights_config.php';

function ixtla_insights_bootstrap(array $methods = ['POST']): array
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    ix_require_session(['login_url' => '/VIEWS/UAT/login.php']);
    header('Content-Type: application/json; charset=utf-8');

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, $methods, true)) {
        ixtla_insights_json(['ok' => false, 'error' => 'Metodo no permitido.'], 405);
    }

    return ixtla_insights_config();
}

function ixtla_insights_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function ixtla_insights_request_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $body = json_decode($raw, true);
    if (!is_array($body)) {
        ixtla_insights_json(['ok' => false, 'error' => 'El cuerpo debe ser JSON valido.'], 400);
    }

    return $body;
}

function ixtla_insights_scope(): array
{
    $session = $GLOBALS['ix_session'] ?? [];

    return [
        'domain' => 'requerimientos',
        'empleado_id' => $session['empleado_id'] ?? $session['id_empleado'] ?? null,
        'cuenta_id' => $session['cuenta_id'] ?? $session['id_cuenta'] ?? $session['id_usuario'] ?? null,
    ];
}

function ixtla_insights_clean_history(array $history, int $limit, int $characters = 400): array
{
    $clean = [];
    foreach (array_slice($history, -$limit) as $message) {
        if (!is_array($message)) {
            continue;
        }

        $role = $message['role'] ?? '';
        $content = trim((string) ($message['content'] ?? ''));
        if (!in_array($role, ['user', 'assistant'], true) || $content === '') {
            continue;
        }

        $clean[] = ['role' => $role, 'content' => ixtla_insights_truncate($content, max(1, $characters))];
    }

    return $clean;
}

function ixtla_insights_truncate(string $value, int $limit): string
{
    return function_exists('mb_substr') ? mb_substr($value, 0, $limit) : substr($value, 0, $limit);
}

function ixtla_insights_openai_text(array $response): string
{
    if (is_string($response['output_text'] ?? null)) {
        return trim($response['output_text']);
    }

    foreach (($response['output'] ?? []) as $item) {
        foreach (($item['content'] ?? []) as $content) {
            if (($content['type'] ?? '') === 'output_text' && is_string($content['text'] ?? null)) {
                return trim($content['text']);
            }
        }
    }

    return '';
}

function ixtla_insights_response_schema(): array
{
    $filter = [
        'type' => 'object',
        'additionalProperties' => false,
        'required' => ['field', 'value'],
        'properties' => [
            'field' => ['type' => 'string', 'enum' => ['departamento', 'tramite', 'estatus']],
            'value' => ['type' => 'string', 'maxLength' => 120],
        ],
    ];
    $widget = [
        'type' => 'object',
        'additionalProperties' => false,
        'required' => ['kind', 'title', 'metric', 'dimension', 'filters', 'sort', 'limit', 'scope_label'],
        'properties' => [
            'kind' => ['type' => 'string', 'enum' => ['kpi', 'bar', 'donut', 'line', 'area', 'table', 'funnel']],
            'title' => ['type' => 'string', 'maxLength' => 100],
            'metric' => ['type' => 'string', 'enum' => ['total', 'abiertos', 'finalizados', 'pausados', 'cancelados', 'cerrados', 'promedio_semanal', 'tiempo_resolucion']],
            'dimension' => ['type' => 'string', 'enum' => ['estatus', 'tramite', 'departamento', 'fecha']],
            'filters' => ['type' => 'array', 'maxItems' => 3, 'items' => $filter],
            'sort' => ['type' => 'string', 'enum' => ['desc', 'asc', 'chronological']],
            'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50],
            'scope_label' => ['type' => 'string', 'maxLength' => 160],
        ],
    ];

    return [
        'type' => 'object',
        'additionalProperties' => false,
        'required' => ['answer', 'suggestions', 'actions'],
        'properties' => [
            'answer' => ['type' => 'string', 'maxLength' => 350],
            'suggestions' => [
                'type' => 'array',
                'maxItems' => 5,
                'items' => ['type' => 'string', 'maxLength' => 100],
            ],
            'actions' => [
                'type' => 'array',
                'maxItems' => 1,
                'items' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['type', 'widget'],
                    'properties' => [
                        'type' => ['type' => 'string', 'enum' => ['widget_preview']],
                        'widget' => $widget,
                    ],
                ],
            ],
        ],
    ];
}

function ixtla_insights_normalize_chat_response(array $data, array $departments = []): array
{
    $answer = trim((string) ($data['answer'] ?? ''));
    if ($answer === '') {
        $answer = 'No pude generar una respuesta para esta consulta.';
    }

    $suggestions = [];
    foreach (($data['suggestions'] ?? []) as $suggestion) {
        $text = trim((string) $suggestion);
        if ($text !== '') {
            $suggestions[] = ixtla_insights_truncate($text, 160);
        }
    }

    $actions = [];
    $unresolvedDepartments = [];
    foreach (($data['actions'] ?? []) as $action) {
        $widget = is_array($action['widget'] ?? null) ? $action['widget'] : null;
        if (($action['type'] ?? '') !== 'widget_preview' || $widget === null) {
            continue;
        }

        if (!in_array($widget['kind'] ?? '', ['kpi', 'bar', 'donut', 'line', 'area', 'table', 'funnel'], true)) {
            continue;
        }
        if (!in_array($widget['metric'] ?? '', ['total', 'abiertos', 'finalizados', 'pausados', 'cancelados', 'cerrados', 'promedio_semanal', 'tiempo_resolucion'], true)) {
            continue;
        }
        if (($widget['kind'] ?? '') !== 'kpi' && in_array($widget['metric'], ['promedio_semanal', 'tiempo_resolucion'], true)) {
            continue;
        }
        if (!in_array($widget['dimension'] ?? '', ['estatus', 'tramite', 'departamento', 'fecha'], true)) {
            continue;
        }

        $filters = [];
        foreach (($widget['filters'] ?? []) as $filter) {
            if (!is_array($filter)) {
                continue;
            }
            $field = $filter['field'] ?? '';
            $value = trim((string) ($filter['value'] ?? ''));
            if (!in_array($field, ['departamento', 'tramite', 'estatus'], true) || $value === '') {
                continue;
            }
            if ($field === 'departamento') {
                $department = ixtla_insights_resolve_department($value, $departments);
                if ($department === null) {
                    $unresolvedDepartments[] = $value;
                    continue;
                }
                $value = $department['nombre'];
            }
            $filters[] = ['field' => $field, 'value' => ixtla_insights_truncate($value, 120)];
        }
        if ($unresolvedDepartments) {
            continue;
        }
        $sort = in_array($widget['sort'] ?? '', ['desc', 'asc', 'chronological'], true) ? $widget['sort'] : 'desc';
        $limit = min(50, max(1, (int) ($widget['limit'] ?? 10)));

        $actions[] = [
            'type' => 'widget_preview',
            'widget' => [
                'kind' => $widget['kind'],
                'title' => ixtla_insights_truncate(trim((string) ($widget['title'] ?? 'Visualizacion de requerimientos')), 100),
                'metric' => $widget['metric'],
                'dimension' => $widget['dimension'],
                'filters' => array_slice($filters, 0, 3),
                'sort' => $sort,
                'limit' => $limit,
                'scope_label' => ixtla_insights_truncate(trim((string) ($widget['scope_label'] ?? 'Vista autorizada actual')), 160),
            ],
        ];
    }

    $unresolvedDepartments = array_values(array_unique($unresolvedDepartments));
    if ($unresolvedDepartments) {
        $answer = 'No generé una tabla general porque no encontré una coincidencia única para: '
            . implode(', ', array_slice($unresolvedDepartments, 0, 3))
            . '. Indica el nombre del departamento como aparece en el catálogo.';
    }

    return [
        'ok' => true,
        'mode' => 'openai',
        'answer' => ixtla_insights_truncate($answer, 350),
        'suggestions' => array_slice(array_values(array_unique($suggestions)), 0, 5),
        'actions' => array_slice($actions, 0, 1),
    ];
}

function ixtla_insights_department_catalog(mysqli $con): array
{
    $result = $con->query('SELECT id, nombre FROM departamento WHERE status = 1 AND nombre IS NOT NULL AND TRIM(nombre) <> \'\' ORDER BY nombre ASC');
    if (!$result) {
        throw new RuntimeException('No fue posible leer el catálogo de departamentos.');
    }

    $departments = [];
    while ($row = $result->fetch_assoc()) {
        $name = trim((string) ($row['nombre'] ?? ''));
        if ($name !== '') {
            $departments[] = ['id' => (int) ($row['id'] ?? 0), 'nombre' => $name];
        }
    }
    $result->free();
    return $departments;
}

function ixtla_insights_resolve_department(string $value, array $departments): ?array
{
    $needle = ixtla_insights_normalize_match_text($value);
    if ($needle === '') {
        return null;
    }

    $exact = [];
    $similar = [];
    $closest = [];
    $closestDistance = null;
    foreach ($departments as $department) {
        $name = trim((string) ($department['nombre'] ?? ''));
        $candidate = ixtla_insights_normalize_match_text($name);
        if ($candidate === '') {
            continue;
        }
        if ($candidate === $needle) {
            $exact[] = $department;
            continue;
        }
        if (str_contains($candidate, $needle) || str_contains($needle, $candidate)) {
            $similar[] = $department;
            continue;
        }

        $distance = levenshtein($needle, $candidate);
        if ($closestDistance === null || $distance < $closestDistance) {
            $closestDistance = $distance;
            $closest = [$department];
        } elseif ($distance === $closestDistance) {
            $closest[] = $department;
        }
    }

    if (count($exact) === 1) {
        return $exact[0];
    }
    if (count($similar) === 1) {
        return $similar[0];
    }

    $maximumDistance = max(2, min(6, (int) floor(strlen($needle) * 0.25)));
    return $closestDistance !== null && $closestDistance <= $maximumDistance && count($closest) === 1
        ? $closest[0]
        : null;
}

function ixtla_insights_normalize_match_text(string $value): string
{
    $value = mb_strtolower(trim($value), 'UTF-8');
    $transliterated = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    if ($transliterated !== false) {
        $value = $transliterated;
    }
    $value = preg_replace('/[^a-z0-9]+/', ' ', $value) ?? '';
    return trim(preg_replace('/\s+/', ' ', $value) ?? '');
}

function ixtla_insights_call_openai(array $config, string $question, array $history, array $departments = []): array
{
    if (!function_exists('curl_init')) {
        ixtla_insights_json(['ok' => false, 'error' => 'La extension cURL no esta disponible.'], 500);
    }

    $apiKey = trim((string) ($config['api_key'] ?? ''));
    if ($apiKey === '') {
        ixtla_insights_json(['ok' => false, 'error' => 'No hay configuracion de OpenAI disponible para Insights.'], 503);
    }

    $systemPrompt = 'Eres Ixtla Insights para requerimientos. Responde solo con el JSON definido. '
        . 'No inventes cifras, no afirmes haber consultado una base de datos y no generes SQL. '
        . 'Solo puedes proponer widgets kpi, bar, donut, line, area, table o funnel; métricas total, abiertos, finalizados, pausados, cancelados o cerrados. '
        . 'Los indicadores kpi también pueden usar promedio_semanal o tiempo_resolucion; esas dos métricas no se usan en gráficas. '
        . 'dimensiones estatus, tramite, departamento o fecha. Para rankings usa limit y sort. '
        . 'Cuando el usuario pida uno o varios departamentos, debes usar un filtro departamento por cada nombre y únicamente los nombres exactos del catálogo autorizado. '
        . 'Si no hay una coincidencia exacta o claramente única, no generes widget y pide que especifique el departamento; nunca sustituyas esa solicitud por una tabla general. '
        . 'Una solicitud de métrica, ranking, top, comparación o dashboard también requiere una acción widget_preview; para un top sin tipo de gráfica usa bar y dimension tramite. '
        . 'Si no solicitan una visualizacion, actions debe ser []. '
        . 'La respuesta debe ser breve, sin explicar razonamientos.';

    $input = [[
        'role' => 'developer',
        'content' => [['type' => 'input_text', 'text' => $systemPrompt]],
    ]];
    foreach ($history as $message) {
        $input[] = [
            'role' => $message['role'],
            'content' => [['type' => 'input_text', 'text' => $message['content']]],
        ];
    }
    $catalogText = $departments
        ? json_encode($departments, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        : '[]';
    $input[] = [
        'role' => 'user',
        'content' => [[
            'type' => 'input_text',
            'text' => "Pregunta actual: {$question}\nContexto autorizado: requerimientos visibles en la vista actual.\nCatálogo autorizado de departamentos: {$catalogText}",
        ]],
    ];

    $payload = [
        'model' => $config['model'],
        'input' => $input,
        'text' => [
            'format' => [
                'type' => 'json_schema',
                'name' => 'ixtla_insights_chat_response',
                'strict' => true,
                'schema' => ixtla_insights_response_schema(),
            ],
        ],
        'max_output_tokens' => (int) ($config['max_output_tokens'] ?? 500),
    ];

    $reasoningEffort = (string) ($config['reasoning_effort'] ?? '');
    if (in_array($reasoningEffort, ['none', 'low', 'medium', 'high', 'xhigh'], true)) {
        $payload['reasoning'] = ['effort' => $reasoningEffort];
    }

    $jsonPayload = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($jsonPayload === false) {
        ixtla_insights_json(['ok' => false, 'error' => 'No fue posible preparar la solicitud Insights.'], 500);
    }

    $curl = curl_init((string) $config['provider_url']);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $jsonPayload,
        CURLOPT_TIMEOUT => (int) ($config['request_timeout_seconds'] ?? 90),
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
            'Accept: application/json',
        ],
    ]);
    $startedAt = microtime(true);
    $raw = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);

    $response = is_string($raw) ? json_decode($raw, true) : null;
    if ($status < 200 || $status >= 300 || !is_array($response)) {
        ixtla_insights_json(['ok' => false, 'error' => 'OpenAI no pudo procesar la consulta Insights.'], 502);
    }

    ixtla_insights_log_usage($response, [
        'model' => $config['model'] ?? null,
        'latency_ms' => (int) round((microtime(true) - $startedAt) * 1000),
    ]);

    $structured = json_decode(ixtla_insights_openai_text($response), true);
    if (!is_array($structured)) {
        ixtla_insights_json(['ok' => false, 'error' => 'OpenAI devolvio una respuesta no estructurada.'], 502);
    }

    return ixtla_insights_normalize_chat_response($structured, $departments);
}

function ixtla_insights_log_usage(array $response, array $context = []): void
{
    $usage = is_array($response['usage'] ?? null) ? $response['usage'] : [];
    $outputDetails = is_array($usage['output_tokens_details'] ?? null) ? $usage['output_tokens_details'] : [];
    $record = [
        'event' => 'ixtla_insights_usage',
        'model' => $context['model'] ?? null,
        'latency_ms' => $context['latency_ms'] ?? null,
        'input_tokens' => $usage['input_tokens'] ?? null,
        'output_tokens' => $usage['output_tokens'] ?? null,
        'reasoning_tokens' => $outputDetails['reasoning_tokens'] ?? $usage['reasoning_tokens'] ?? null,
    ];
    error_log((string) json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

function ixtla_insights_forward(array $config, string $path, array $payload = [], string $method = 'POST'): array
{
    if (!function_exists('curl_init')) {
        ixtla_insights_json(['ok' => false, 'error' => 'La extension cURL no esta disponible.'], 500);
    }

    $baseUrl = rtrim((string) ($config['service_url'] ?? ''), '/');
    if ($baseUrl === '' || filter_var($baseUrl, FILTER_VALIDATE_URL) === false) {
        ixtla_insights_json(['ok' => false, 'error' => 'La URL del servicio Insights no es valida.'], 500);
    }

    $headers = ['Accept: application/json'];
    $token = trim((string) ($config['service_token'] ?? ''));
    if ($token !== '') {
        $headers[] = 'X-Ixtla-Insights-Key: ' . $token;
    }

    $curl = curl_init($baseUrl . '/' . ltrim($path, '/'));
    curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($curl, CURLOPT_TIMEOUT, (int) ($config['request_timeout_seconds'] ?? 20));
    curl_setopt($curl, CURLOPT_HTTPHEADER, $headers);

    if ($method === 'POST') {
        $headers[] = 'Content-Type: application/json';
        curl_setopt($curl, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($curl, CURLOPT_POST, true);
        curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    $raw = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);
    curl_close($curl);

    if ($raw === false) {
        ixtla_insights_json(['ok' => false, 'error' => 'No fue posible contactar el servicio Insights.', 'detail' => $error], 502);
    }

    $response = json_decode($raw, true);
    if (!is_array($response)) {
        ixtla_insights_json(['ok' => false, 'error' => 'El servicio Insights devolvio una respuesta invalida.'], 502);
    }

    return ['status' => $status > 0 ? $status : 502, 'body' => $response];
}

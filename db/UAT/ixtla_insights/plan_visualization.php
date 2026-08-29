<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/visualization_plan_contract.php';

ixtla_insights_bootstrap(['POST']);
$config = ixtla_insights_config();
$body = ixtla_insights_request_body();
$question = trim((string) ($body['question'] ?? ''));
$previous = is_array($body['previous_spec'] ?? null) ? $body['previous_spec'] : [];

if ($question === '' || mb_strlen($question) > 1200) {
    ixtla_insights_json(['ok' => false, 'error' => 'La solicitud de visualizacion no es valida.'], 422);
}
if (!function_exists('curl_init')) {
    ixtla_insights_json(['ok' => false, 'error' => 'La extension cURL no esta disponible.'], 500);
}

$apiKey = trim((string) ($config['api_key'] ?? ''));
$providerUrl = trim((string) ($config['provider_url'] ?? ''));
$model = trim((string) ($config['model'] ?? ''));
if ($apiKey === '' || $providerUrl === '' || $model === '') {
    ixtla_insights_json(['ok' => false, 'error' => 'No hay configuracion de OpenAI disponible para Insights.'], 503);
}

$schema = [
    'type' => 'object',
    'additionalProperties' => false,
    'required' => ['intent', 'domain', 'chart', 'metric', 'dimension', 'series_dimension', 'date_grain', 'series_limit', 'period', 'comparison', 'filters', 'limit', 'title', 'reason', 'needs_clarification', 'clarification_question'],
    'properties' => [
        'intent' => ['type' => 'string', 'enum' => ['create', 'edit', 'clarify', 'not_visualization']],
        'domain' => ['type' => 'string', 'enum' => ['', 'requerimientos', 'retroalimentaciones']],
        'chart' => ['type' => 'string', 'enum' => ['', 'bar', 'line', 'area', 'donut', 'table', 'matrix', 'kpi']],
        'metric' => ['type' => 'string', 'enum' => ['', 'total', 'abiertos', 'finalizados', 'pausados_cancelados', 'pausados', 'cancelados', 'retro_total', 'tasa_respuesta', 'promedio_calificacion']],
        'dimension' => ['type' => 'string', 'enum' => ['', 'estatus', 'tramite', 'departamento', 'fecha', 'calificacion', 'estado_retro']],
        'series_dimension' => ['type' => 'string', 'enum' => ['', 'estatus', 'tramite', 'departamento']],
        'date_grain' => ['type' => 'string', 'enum' => ['', 'day', 'week', 'month']],
        'series_limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 7],
        'period' => ['type' => 'string', 'enum' => ['', 'all', 'last_7', 'last_30', 'this_month']],
        'comparison' => ['type' => 'string', 'enum' => ['', 'previous_period']],
        'filters' => [
            'type' => 'array', 'maxItems' => 5,
            'items' => [
                'type' => 'object', 'additionalProperties' => false,
                'required' => ['field', 'value'],
                'properties' => [
                    'field' => ['type' => 'string', 'enum' => ['departamento', 'tramite', 'estatus', 'calificacion', 'estado_retro']],
                    'value' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 120],
                ],
            ],
        ],
        'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50],
        'title' => ['type' => 'string', 'maxLength' => 100],
        'reason' => ['type' => 'string', 'maxLength' => 220],
        'needs_clarification' => ['type' => 'boolean'],
        'clarification_question' => ['type' => 'string', 'maxLength' => 180],
    ],
];

$previous = ixtla_visual_plan_normalize($previous);
$previousJson = json_encode($previous, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
$developerPrompt = 'Eres el planificador de visualizaciones de Ixtla Insights. Convierte la solicitud en un plan JSON. '
    . 'Solo puedes usar los valores del esquema. Conserva del plan anterior todo lo que el usuario no cambie. '
    . 'Para tendencias usa line y fecha. Si el usuario pide una linea por estatus, tramite o departamento, usa fecha como dimension y esa categoria como series_dimension. '
    . 'En requerimientos, si no especifica una metrica usa total; no pidas aclaracion entre total, abiertos o finalizados. Solo usa otra metrica cuando el usuario la mencione expresamente. '
    . 'Frases como "cada departamento sea una linea" o "linea con varias dimensiones por departamento" significan dimension fecha, series_dimension departamento y metric total. '
    . 'Para rankings o comparaciones entre categorias usa bar. Para un valor unico usa kpi. Para cruzar dos categorias con valores exactos usa matrix. '
    . 'Usa donut solo para pocas categorias que forman una distribucion y nunca para fechas. '
    . 'La dimension representa lo que el usuario desea analizar y debe coincidir con el titulo: estatus, tramite y departamento son categorias; fecha es temporal. '
    . 'Una linea siempre usa fecha en dimension; sus categorias se colocan en series_dimension. Una matrix usa una categoria en dimension y otra en series_dimension. '
    . 'Usa como maximo 5 series normalmente y 7 solo para los siete estatus. Usa month para historiales largos, week para varios meses y day para periodos cortos. '
    . 'Explica reason con lenguaje sencillo: que podra entender el usuario gracias a ese formato, sin tecnicismos. '
    . 'Retroalimentaciones usa retro_total con calificacion o estado_retro; tasa_respuesta y promedio_calificacion son KPI. '
    . 'Si el usuario pide comparar contra el periodo anterior usa comparison previous_period. '
    . 'Solo si falta el tema o dominio y no existe plan anterior, marca needs_clarification y formula una sola pregunta breve. '
    . 'No inventes nombres de departamentos, tramites ni filtros. Plan anterior validado: ' . $previousJson;

$payload = [
    'model' => $model,
    'input' => [
        ['role' => 'developer', 'content' => [['type' => 'input_text', 'text' => $developerPrompt]]],
        ['role' => 'user', 'content' => [['type' => 'input_text', 'text' => $question]]],
    ],
    'text' => ['format' => ['type' => 'json_schema', 'name' => 'ixtla_visualization_plan', 'strict' => true, 'schema' => $schema]],
];
$payload = array_replace($payload, ixtla_insights_generation_controls(array_replace($config, ['max_output_tokens' => min(1200, (int) ($config['max_output_tokens'] ?? 1200))])));
$encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($encoded === false) ixtla_insights_json(['ok' => false, 'error' => 'No fue posible preparar el plan.'], 500);

$curl = curl_init();
if ($curl === false) ixtla_insights_json(['ok' => false, 'error' => 'No fue posible inicializar cURL.'], 500);
curl_setopt_array($curl, [
    CURLOPT_URL => $providerUrl, CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => 'POST', CURLOPT_POSTFIELDS => $encoded,
    CURLOPT_TIMEOUT => min(120, (int) $config['request_timeout_seconds']), CURLOPT_CONNECTTIMEOUT => (int) $config['connect_timeout_seconds'],
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json', 'Accept: application/json'],
]);
$raw = curl_exec($curl);
$status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
$curlError = curl_error($curl);
curl_close($curl);
$response = is_string($raw) ? json_decode($raw, true) : null;
if ($status < 200 || $status >= 300 || !is_array($response)) {
    ixtla_insights_log_error('plan_visualization_provider', new RuntimeException($curlError ?: 'Proveedor no disponible'), ['status' => $status]);
    ixtla_insights_json(['ok' => false, 'error' => 'No fue posible interpretar la visualizacion.'], 502);
}
$text = ixtla_insights_openai_text($response);
$plan = json_decode($text, true);
if (!is_array($plan)) ixtla_insights_json(['ok' => false, 'error' => 'El proveedor no devolvio un plan valido.'], 502);

$normalizedPlan = ixtla_visual_plan_normalize($plan);
ixtla_insights_json(['ok' => true, 'plan' => ixtla_visual_plan_resolve_filters($normalizedPlan)]);

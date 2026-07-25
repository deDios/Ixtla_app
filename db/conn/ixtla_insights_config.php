<?php
/**
 * Configuración central del asistente Ixtla Insights.
 *
 * Lee db/conn/.env. No realiza llamadas al proveedor.
 */

declare(strict_types=1);

function ixtla_insights_env_bool(mixed $value): bool
{
    return in_array(strtolower(trim((string) $value)), ['1', 'true', 'yes', 'on'], true);
}

function ixtla_insights_env_value(array $environment, string $key): string
{
    if (!array_key_exists($key, $environment)) {
        return '';
    }

    return trim((string) $environment[$key]);
}

function ixtla_insights_openai_env(): array
{
    $envPath = __DIR__ . '/.env';
    if (!is_file($envPath)) {
        return [];
    }

    // RAW conserva URLs y claves sin interpretarlas como constantes o tipos INI.
    $env = parse_ini_file($envPath, false, INI_SCANNER_RAW);
    return is_array($env) ? $env : [];
}

function ixtla_insights_config(): array
{
    $openai = ixtla_insights_openai_env();
    $apiKey = ixtla_insights_env_value($openai, 'OPENAI_API_KEY');
    $providerUrl = ixtla_insights_env_value($openai, 'OPENAI_API_URL');
    $model = ixtla_insights_env_value($openai, 'IXTLA_INSIGHTS_MODEL');
    $configured = $apiKey !== '' && $providerUrl !== '' && $model !== '';

    return [
        // El proveedor sólo se habilita cuando .env contiene toda su configuración.
        'enabled' => $configured
            && ixtla_insights_env_bool(ixtla_insights_env_value($openai, 'IXTLA_INSIGHTS_ENABLED')),
        'configured' => $configured,

        // Origenes de confianza.
        'provider' => 'openai',
        'provider_url' => $providerUrl,
        'model' => $model,
        'api_key' => $apiKey,

        // Límites del endpoint protegido de preguntas.
        'request_timeout_seconds' => 180,
        'connect_timeout_seconds' => 15,
        'max_question_characters' => 900,
        'max_history_messages' => 8,
        'max_history_characters' => 600,
        'conversation_ttl_seconds' => 3600,
        'conversation_summary_characters' => 1000,
        'max_output_tokens' => 8000,
        'temperature' => 0,
        'max_tool_calls_per_turn' => 2,
        'reasoning_effort' => 'medium',

        // Observabilidad temporal. Mantenerlo apagado en producción salvo
        // durante una investigación: los eventos se escriben en error_log.
        'debug' => ixtla_insights_env_bool(ixtla_insights_env_value($openai, 'IXTLA_INSIGHTS_DEBUG')),
        // Identifica la publicación que respondió. Debe cambiar en cada
        // despliegue (por ejemplo, el SHA corto del commit), nunca contiene secretos.
        'build_id' => ixtla_insights_env_value($openai, 'IXTLA_INSIGHTS_BUILD_ID'),

        // El asistente inicia únicamente sobre el dominio operativo actual.
        'allowed_domains' => ['requerimientos'],
        'allow_visualizations' => true,
        // Sólo permite agregaciones predefinidas y autorizadas; nunca SQL del modelo.
        'allow_database_queries' => true,

        'environment_file' => 'db/conn/.env',
    ];
}

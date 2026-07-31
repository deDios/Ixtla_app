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

        // limites del endpoint protegido de preguntas.
        'request_timeout_seconds' => 180,
        'connect_timeout_seconds' => 15,
        'max_question_characters' => 1800,
        // Contexto conversacional: los dos limites evitan que una charla larga
        // convierta cada solicitud posterior en un payload desproporcionado.
        'max_history_messages' => 40,
        'max_history_message_characters' => 1500,
        'max_history_total_characters' => 30000,
        'conversation_ttl_seconds' => 21600,
        'conversation_summary_characters' => 3000,
        'max_output_tokens' => 5000,
        'temperature' => 0,
        'max_tool_calls_per_turn' => 2,
        'reasoning_effort' => 'medium',

        // Snapshot analitico por alcance RBAC. El cache reside en servidor;
        // nunca se entrega completo al navegador ni al modelo.
        'dataset_cache_ttl_seconds' => max(60, (int) (ixtla_insights_env_value($openai, 'IXTLA_INSIGHTS_DATASET_CACHE_TTL') ?: 900)),
        'dataset_cache_dir' => ixtla_insights_env_value($openai, 'IXTLA_INSIGHTS_DATASET_CACHE_DIR') ?: (sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ixtla_insights_datasets'),
        'dataset_page_size' => min(1000, max(100, (int) (ixtla_insights_env_value($openai, 'IXTLA_INSIGHTS_DATASET_PAGE_SIZE') ?: 500))),

        // Observabilidad temporal. Mantenerlo apagado en producción salvo
        // durante una investigación: los eventos se escriben en error_log.
        'debug' => true,
        // Identifica la publicación que respondió. Debe cambiar en cada
        // despliegue (por ejemplo, el SHA corto del commit), nunca contiene secretos.
        'build_id' => ixtla_insights_env_value($openai, 'IXTLA_INSIGHTS_BUILD_ID'),

        // El asistente inicia unicamente sobre el dominio operativo actual.
        'allowed_domains' => ['requerimientos'],
        'allow_visualizations' => true,
        // Sólo permite agregaciones predefinidas y autorizadas; nunca SQL del modelo.
        'allow_database_queries' => true,

        'environment_file' => 'db/conn/.env',
    ];
}

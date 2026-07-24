<?php
/**
 * Configuración central del asistente Ixtla Insights.
 *
 * Comparte el mismo archivo .env que usa
 * PRI/extract_identificacion_openai.php. No realiza llamadas al proveedor.
 */

declare(strict_types=1);

function ixtla_insights_env_bool(mixed $value): bool
{
    return in_array(strtolower(trim((string) $value)), ['1', 'true', 'yes', 'on'], true);
}

function ixtla_insights_openai_env(): array
{
    $envPath = __DIR__ . '/../../PRI/.env';
    if (!is_file($envPath)) {
        return [];
    }

    $env = parse_ini_file($envPath);
    return is_array($env) ? $env : [];
}

function ixtla_insights_config(): array
{
    $openai = ixtla_insights_openai_env();

    return [
        // IXTLA_INSIGHTS_ENABLED=false funciona como interruptor de apagado.
        'enabled' => !empty($openai['OPENAI_API_KEY'])
            && ixtla_insights_env_bool($openai['IXTLA_INSIGHTS_ENABLED'] ?? true),

        // Origenes de confianza.
        'provider' => 'openai',
        'provider_url' => $openai['OPENAI_API_URL'] ?? 'https://api.openai.com/v1/responses',
        'model' => $openai['IXTLA_INSIGHTS_MODEL'] ?? 'gpt-5.4',
        'api_key' => $openai['OPENAI_API_KEY'] ?? null,

        // Límites del endpoint protegido de preguntas.
        'request_timeout_seconds' => 90,
        'max_question_characters' => 800,
        'max_history_messages' => 12,
        'max_history_characters' => 400,
        'max_output_tokens' => 500,
        'reasoning_effort' => 'low',

        // Observabilidad temporal. Mantenerlo apagado en producción salvo
        // durante una investigación: los eventos se escriben en error_log.
        'debug' => ixtla_insights_env_bool($openai['IXTLA_INSIGHTS_DEBUG'] ?? false),
        // Identifica la publicación que respondió. Debe cambiar en cada
        // despliegue (por ejemplo, el SHA corto del commit), nunca contiene secretos.
        'build_id' => trim((string) ($openai['IXTLA_INSIGHTS_BUILD_ID'] ?? '')),

        // El asistente inicia únicamente sobre el dominio operativo actual.
        'allowed_domains' => ['requerimientos'],
        'allow_visualizations' => true,
        // Sólo permite agregaciones predefinidas y autorizadas; nunca SQL del modelo.
        'allow_database_queries' => true,

        'reference_service' => 'PRI/extract_identificacion_openai.php',
    ];
}

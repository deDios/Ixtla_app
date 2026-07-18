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

        // Servicio local de Python. PHP es la unica capa a la que llama el navegador.
        'service_url' => $openai['IXTLA_INSIGHTS_API_URL'] ?? 'http://127.0.0.1:8011/v1/insights',
        'service_token' => $openai['IXTLA_INSIGHTS_SERVICE_TOKEN'] ?? null,

        // Límites para el futuro endpoint de preguntas.
        'request_timeout_seconds' => 90,
        'max_question_characters' => 800,
        'max_history_messages' => 12,
        'max_history_characters' => 400,
        'max_output_tokens' => 500,
        'reasoning_effort' => 'low',

        // El asistente inicia únicamente sobre el dominio operativo actual.
        'allowed_domains' => ['requerimientos'],
        'allow_visualizations' => true,
        'allow_database_queries' => false,

        'reference_service' => 'PRI/extract_identificacion_openai.php',
    ];
}

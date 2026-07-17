<?php
/**
 * Configuración central del asistente Ixtla Insights.
 *
 * Comparte el mismo archivo .env que usa
 * PRI/extract_identificacion_openai.php. No realiza llamadas al proveedor.
 */

declare(strict_types=1);

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
        // Permanece apagado hasta que exista el endpoint protegido del chat.
        'enabled' => false,

        // Origenes de confianza.
        'provider' => 'openai',
        'provider_url' => $openai['OPENAI_API_URL'] ?? 'https://api.openai.com/v1/responses',
        'model' => $openai['OPENAI_MODEL'] ?? 'gpt-4.1-mini',
        'api_key' => $openai['OPENAI_API_KEY'] ?? null,

        // Límites para el futuro endpoint de preguntas.
        'request_timeout_seconds' => 20,
        'max_question_characters' => 800,
        'max_history_messages' => 12,

        // El asistente inicia únicamente sobre el dominio operativo actual.
        'allowed_domains' => ['requerimientos'],
        'allow_visualizations' => false,
        'allow_database_queries' => false,

        'reference_service' => 'PRI/extract_identificacion_openai.php',
    ];
}

<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

/*
 * Endpoint de salud del asistente Ixtla Insights.
 *
 * Devuelve un JSON con el estado de la configuración y la disponibilidad del proveedor.
 * No realiza llamadas al proveedor ni al modelo.
 */

$config = ixtla_insights_bootstrap(['GET']);
ixtla_insights_json([
    'ok' => true,
    'service' => 'ixtla-insights-php-gateway',
    'enabled' => (bool) ($config['enabled'] ?? false),
    'provider_configured' => (bool) $config['configured'],
    'model' => $config['model'],
]);

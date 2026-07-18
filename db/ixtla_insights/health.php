<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$config = ixtla_insights_bootstrap(['GET']);
ixtla_insights_json([
    'ok' => true,
    'service' => 'ixtla-insights-php-gateway',
    'enabled' => (bool) ($config['enabled'] ?? false),
    'provider_configured' => !empty($config['api_key']),
    'model' => $config['model'],
]);

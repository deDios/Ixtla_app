<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$config = ixtla_insights_bootstrap(['GET']);
ixtla_insights_json([
    'ok' => true,
    'catalog' => ixtla_insights_catalog(),
]);

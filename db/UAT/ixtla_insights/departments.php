<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/tools/tool_registry.php';

ixtla_insights_bootstrap(['GET']);

try {
    $catalog = ixtla_insights_snapshot_catalog(['catalog' => 'departments', 'query' => null, 'limit' => 100]);
    $departments = array_values(array_map(static fn (array $item): array => [
        'id' => (int) ($item['id'] ?? 0),
        'nombre' => trim((string) ($item['name'] ?? '')),
    ], is_array($catalog['items'] ?? null) ? $catalog['items'] : []));
    $departments = array_values(array_filter($departments, static fn (array $item): bool => $item['id'] > 0 && $item['nombre'] !== ''));
    ixtla_insights_json(['ok' => true, 'departments' => $departments]);
} catch (Throwable $error) {
    ixtla_insights_log_error('visualization_departments', $error);
    ixtla_insights_json(['ok' => false, 'error' => 'No fue posible consultar los departamentos autorizados.'], 503);
}

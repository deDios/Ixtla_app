<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

ixtla_insights_bootstrap(['POST']);
session_name('ixtla_insights_draft');
session_start(['cookie_httponly' => true, 'cookie_samesite' => 'Lax']);

$body = ixtla_insights_request_body();
$action = (string) ($body['action'] ?? 'get');
$owner = (string) (ixtla_insights_scope()['empleado_id'] ?? '');
$key = 'draft:' . $owner;

if ($action === 'delete') {
    unset($_SESSION[$key]);
    ixtla_insights_json(['ok' => true, 'draft' => null]);
}
if ($action === 'get') {
    ixtla_insights_json(['ok' => true, 'draft' => $_SESSION[$key] ?? null]);
}
if ($action !== 'save' || !is_array($body['draft'] ?? null)) {
    ixtla_insights_json(['ok' => false, 'error' => 'El borrador de visualización no es válido.'], 422);
}

$raw = $body['draft'];
$mode = ixtla_insights_truncate(trim((string) ($raw['mode'] ?? 'guided')), 40);
$allowedModes = ['guided', 'free_visualization', 'kpi_kit', 'single_kpi'];
if ($mode === 'remote_visualization') $mode = 'guided';
if (!in_array($mode, $allowedModes, true)) $mode = 'guided';
$chart = trim((string) ($raw['chart'] ?? ''));
$metric = trim((string) ($raw['metric'] ?? ''));
$dimension = trim((string) ($raw['dimension'] ?? ''));
$period = trim((string) ($raw['period'] ?? ''));
if (($chart !== '' && !ixtla_insights_catalog_contains('widget_kinds', $chart))
    || ($metric !== '' && !ixtla_insights_catalog_contains('metrics', $metric))
    || ($dimension !== '' && !ixtla_insights_catalog_contains('dimensions', $dimension))
    || ($period !== '' && !ixtla_insights_catalog_contains('periods', $period))) {
    ixtla_insights_json(['ok' => false, 'error' => 'El borrador contiene valores fuera del contrato de Insights.'], 422);
}
$draft = [
    'version' => 1,
    'mode' => $mode,
    'question' => ixtla_insights_truncate(trim((string) ($raw['question'] ?? '')), 800),
    'chart' => $chart,
    'metric' => $metric,
    'dimension' => $dimension,
    'period' => $period,
    'title' => ixtla_insights_truncate(trim((string) ($raw['title'] ?? '')), 100),
    'filters' => [],
    'updated_at' => gmdate('c'),
];
foreach (is_array($raw['filters'] ?? null) ? $raw['filters'] : [] as $filter) {
    if (!is_array($filter)) continue;
    $field = trim((string) ($filter['field'] ?? ''));
    $value = ixtla_insights_truncate(trim((string) ($filter['value'] ?? '')), 120);
    if ($value !== '' && ixtla_insights_catalog_contains('filter_fields', $field)) $draft['filters'][] = ['field' => $field, 'value' => $value];
}
$draft['filters'] = array_slice($draft['filters'], 0, 50);
$_SESSION[$key] = $draft;
ixtla_insights_json(['ok' => true, 'draft' => $draft]);

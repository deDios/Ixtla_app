<?php
declare(strict_types=1);

require_once __DIR__ . '/tools/tool_registry.php';

function ixtla_visual_plan_normalize(array $plan): array
{
    $allowed = [
        'domain' => ['', 'requerimientos', 'retroalimentaciones'],
        'chart' => ['', 'bar', 'line', 'area', 'donut', 'table', 'kpi'],
        'period' => ['', 'all', 'last_7', 'last_30', 'this_month'],
        'comparison' => ['', 'previous_period'],
    ];
    foreach ($allowed as $key => $values) if (!in_array((string) ($plan[$key] ?? ''), $values, true)) $plan[$key] = '';
    $domain = (string) $plan['domain'];
    $metric = (string) ($plan['metric'] ?? '');
    $dimension = (string) ($plan['dimension'] ?? '');
    $requirementMetrics = ['total', 'abiertos', 'finalizados', 'pausados_cancelados', 'pausados', 'cancelados'];
    $feedbackMetrics = ['retro_total', 'tasa_respuesta', 'promedio_calificacion'];
    if ($domain === 'retroalimentaciones' && !in_array($metric, $feedbackMetrics, true)) $metric = 'retro_total';
    if ($domain === 'requerimientos' && !in_array($metric, $requirementMetrics, true)) $metric = 'total';
    if (in_array($metric, ['tasa_respuesta', 'promedio_calificacion'], true)) $plan['chart'] = 'kpi';
    if (in_array((string) $plan['chart'], ['line', 'area'], true)) $dimension = 'fecha';
    if ((string) $plan['chart'] === 'donut' && $dimension === 'fecha') $dimension = $domain === 'retroalimentaciones' ? 'calificacion' : 'estatus';
    $validDimensions = $domain === 'retroalimentaciones'
        ? ['calificacion', 'estado_retro', 'departamento', 'tramite', 'fecha']
        : ['estatus', 'tramite', 'departamento', 'fecha'];
    if ($domain !== '' && !in_array($dimension, $validDimensions, true)) $dimension = $domain === 'retroalimentaciones' ? 'calificacion' : 'tramite';
    $filters = [];
    foreach (is_array($plan['filters'] ?? null) ? $plan['filters'] : [] as $filter) {
        if (!is_array($filter)) continue;
        $field = (string) ($filter['field'] ?? ''); $value = trim((string) ($filter['value'] ?? ''));
        if (in_array($field, ['departamento', 'tramite', 'estatus', 'calificacion', 'estado_retro'], true) && $value !== '') {
            $filters[] = ['field' => $field, 'value' => ixtla_insights_truncate($value, 120)];
        }
    }
    $needsClarification = (bool) ($plan['needs_clarification'] ?? false);
    $clarification = ixtla_insights_truncate(trim((string) ($plan['clarification_question'] ?? '')), 180);
    if (($plan['comparison'] ?? '') === 'previous_period' && ($plan['period'] ?? '') === 'all') {
        $needsClarification = true;
        $clarification = '¿Qué periodo deseas comparar con su periodo anterior?';
    }
    return [
        'intent' => in_array((string) ($plan['intent'] ?? ''), ['create', 'edit', 'clarify', 'not_visualization'], true) ? $plan['intent'] : 'clarify',
        'domain' => $domain, 'chart' => (string) $plan['chart'], 'metric' => $metric, 'dimension' => $dimension,
        'period' => (string) $plan['period'], 'comparison' => (string) $plan['comparison'], 'filters' => array_slice($filters, 0, 5),
        'limit' => min(50, max(1, (int) ($plan['limit'] ?? 10))),
        'title' => ixtla_insights_truncate(trim((string) ($plan['title'] ?? '')), 100),
        'reason' => ixtla_insights_truncate(trim((string) ($plan['reason'] ?? '')), 220),
        'needs_clarification' => $needsClarification,
        'clarification_question' => $clarification,
    ];
}

/** Resuelve filtros descriptivos exclusivamente contra catalogos del alcance RBAC. */
function ixtla_visual_plan_resolve_filters(array $plan): array
{
    $resolved = [];
    $ambiguous = [];
    $fixedMaps = [
        'calificacion' => ['malo' => 1, 'regular' => 2, 'bueno' => 3, 'excelente' => 4],
        'estado_retro' => ['caducada' => 0, 'no contestada' => 1, 'contestada' => 2, 'inhabilitada' => 3],
    ];
    foreach ($plan['filters'] as $filter) {
        $field = (string) $filter['field'];
        $value = trim((string) $filter['value']);
        $needle = ixtla_insights_normalize_match_text($value);
        if (isset($fixedMaps[$field][$needle])) {
            $resolved[] = ['field' => $field, 'value' => $value, 'label' => $value, 'id' => $fixedMaps[$field][$needle]];
            continue;
        }
        $catalog = ['departamento' => 'departments', 'tramite' => 'tramites', 'estatus' => 'statuses'][$field] ?? '';
        if ($catalog === '') {
            $ambiguous[] = $value;
            continue;
        }
        try {
            $catalogResult = ixtla_insights_snapshot_catalog(['catalog' => $catalog, 'query' => $value, 'limit' => 20]);
        } catch (Throwable $error) {
            ixtla_insights_log_error('visualization_filter_catalog', $error, ['catalog' => $catalog]);
            $ambiguous[] = $value;
            continue;
        }
        $items = is_array($catalogResult['items'] ?? null) ? array_values($catalogResult['items']) : [];
        $exact = array_values(array_filter($items, static fn (array $item): bool =>
            ixtla_insights_normalize_match_text((string) ($item['name'] ?? '')) === $needle
        ));
        $matches = $exact !== [] ? $exact : $items;
        if (count($matches) !== 1 || !isset($matches[0]['id'])) {
            $ambiguous[] = $value;
            continue;
        }
        $resolved[] = [
            'field' => $field,
            'value' => (string) ($matches[0]['name'] ?? $value),
            'label' => (string) ($matches[0]['name'] ?? $value),
            'id' => (int) $matches[0]['id'],
        ];
    }
    $plan['filters'] = $resolved;
    if ($ambiguous !== []) {
        $plan['needs_clarification'] = true;
        $plan['clarification_question'] = 'No encontre una coincidencia unica para ' . implode(', ', $ambiguous) . '. ¿Puedes indicar el nombre exacto?';
    }
    return $plan;
}

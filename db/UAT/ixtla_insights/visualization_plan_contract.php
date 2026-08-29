<?php
declare(strict_types=1);

require_once __DIR__ . '/tools/tool_registry.php';

function ixtla_visual_plan_title(string $domain, string $chart, string $metric, string $dimension, string $seriesDimension = ''): string
{
    $metricLabels = [
        'total' => 'Requerimientos',
        'abiertos' => 'Requerimientos abiertos',
        'finalizados' => 'Requerimientos finalizados',
        'pausados_cancelados' => 'Requerimientos pausados o cancelados',
        'pausados' => 'Requerimientos pausados',
        'cancelados' => 'Requerimientos cancelados',
        'retro_total' => 'Retroalimentaciones',
        'tasa_respuesta' => 'Tasa de respuesta',
        'promedio_calificacion' => 'Promedio de calificación',
    ];
    $dimensionLabels = [
        'estatus' => 'estatus', 'tramite' => 'trámite', 'departamento' => 'departamento',
        'fecha' => 'fecha', 'calificacion' => 'calificación', 'estado_retro' => 'estado de respuesta',
    ];
    $subject = $metricLabels[$metric] ?? ($domain === 'retroalimentaciones' ? 'Retroalimentaciones' : 'Requerimientos');
    if ($chart === 'kpi') return $subject;
    if ($chart === 'matrix') return 'Matriz de ' . mb_strtolower($subject, 'UTF-8') . ' por ' . ($dimensionLabels[$dimension] ?? 'categoría') . ' y ' . ($dimensionLabels[$seriesDimension] ?? 'serie');
    if ($dimension === 'fecha') {
        $title = 'Tendencia de ' . mb_strtolower($subject, 'UTF-8');
        return $seriesDimension === '' ? $title : $title . ' por ' . ($dimensionLabels[$seriesDimension] ?? 'serie');
    }
    return $subject . ' por ' . ($dimensionLabels[$dimension] ?? 'categoría');
}

function ixtla_visual_plan_reason(string $chart, string $dimension, string $seriesDimension = ''): string
{
    $dimensionLabels = [
        'estatus' => 'estatus', 'tramite' => 'trámite', 'departamento' => 'departamento',
        'fecha' => 'fecha', 'calificacion' => 'calificación', 'estado_retro' => 'estado de respuesta',
    ];
    $group = $dimensionLabels[$dimension] ?? 'categoría';
    if ($chart === 'kpi') return 'Usé un indicador porque resume el valor principal de forma directa.';
    if ($chart === 'matrix') return 'Usé una matriz porque permite cruzar ' . $group . ' con ' . ($dimensionLabels[$seriesDimension] ?? 'otra dimensión') . ' y consultar valores exactos.';
    if ($chart === 'line') return $seriesDimension === ''
        ? 'Usé una línea porque permite seguir con claridad los cambios a través del tiempo.'
        : 'Usé varias líneas para comparar cómo cambia cada ' . ($dimensionLabels[$seriesDimension] ?? 'serie') . ' a través del tiempo.';
    if ($chart === 'area') return 'Usé un área porque permite ver la evolución y la magnitud a través del tiempo.';
    if ($chart === 'donut') return 'Usé un gráfico de pastel para mostrar qué proporción representa cada ' . $group . '.';
    if ($chart === 'table') return 'Usé una tabla para que puedas consultar los valores exactos por ' . $group . '.';
    return 'Usé barras porque facilita comparar los valores entre cada ' . $group . '.';
}

function ixtla_visual_plan_normalize(array $plan): array
{
    $allowed = [
        'domain' => ['', 'requerimientos', 'retroalimentaciones'],
        'chart' => ['', 'bar', 'line', 'area', 'donut', 'table', 'matrix', 'kpi'],
        'period' => ['', 'all', 'last_7', 'last_30', 'this_month'],
        'comparison' => ['', 'previous_period'],
        'date_grain' => ['', 'day', 'week', 'month'],
    ];
    foreach ($allowed as $key => $values) if (!in_array((string) ($plan[$key] ?? ''), $values, true)) $plan[$key] = '';
    $domain = (string) $plan['domain'];
    $metric = (string) ($plan['metric'] ?? '');
    $dimension = (string) ($plan['dimension'] ?? '');
    $seriesDimension = (string) ($plan['series_dimension'] ?? '');
    $requirementMetrics = ['total', 'abiertos', 'finalizados', 'pausados_cancelados', 'pausados', 'cancelados'];
    $feedbackMetrics = ['retro_total', 'tasa_respuesta', 'promedio_calificacion'];
    if ($domain === 'retroalimentaciones' && !in_array($metric, $feedbackMetrics, true)) $metric = 'retro_total';
    if ($domain === 'requerimientos' && !in_array($metric, $requirementMetrics, true)) $metric = 'total';
    if (in_array($metric, ['tasa_respuesta', 'promedio_calificacion'], true)) $plan['chart'] = 'kpi';
    $validDimensions = $domain === 'retroalimentaciones'
        ? ['calificacion', 'estado_retro', 'departamento', 'tramite', 'fecha']
        : ['estatus', 'tramite', 'departamento', 'fecha'];
    if ($domain !== '' && !in_array($dimension, $validDimensions, true)) $dimension = $domain === 'retroalimentaciones' ? 'calificacion' : 'tramite';
    $chart = (string) $plan['chart'];
    if ($chart === 'matrix' && $domain === 'retroalimentaciones') $chart = 'bar';
    $validSeriesDimensions = $domain === 'requerimientos' ? ['estatus', 'tramite', 'departamento'] : [];
    if (!in_array($seriesDimension, $validSeriesDimensions, true)) $seriesDimension = '';
    if ($domain !== '' && $chart === '') $chart = $dimension === 'fecha' ? 'line' : 'bar';
    // La dimensión expresa la pregunta del usuario y tiene prioridad. Ajustamos
    // el formato en vez de cambiar silenciosamente el significado del análisis.
    if ($domain !== '' && $dimension === 'fecha' && $chart === 'donut') $chart = 'line';
    if ($domain === 'requerimientos' && $dimension !== 'fecha' && in_array($chart, ['line', 'area'], true)) {
        if ($seriesDimension === '') $seriesDimension = $dimension;
        $dimension = 'fecha';
    }
    if ($domain === 'retroalimentaciones' && $dimension !== 'fecha' && in_array($chart, ['line', 'area'], true)) $chart = 'bar';
    if ($chart === 'matrix') {
        if ($dimension === 'fecha') $dimension = 'departamento';
        if ($seriesDimension === '' || $seriesDimension === $dimension) $seriesDimension = $dimension === 'estatus' ? 'departamento' : 'estatus';
    } elseif (!in_array($chart, ['line', 'area'], true)) {
        $seriesDimension = '';
    }
    if ($seriesDimension === $dimension) $seriesDimension = '';
    $dateGrain = (string) ($plan['date_grain'] ?? '');
    if ($dateGrain === '') $dateGrain = ($plan['period'] ?? '') === 'all' ? 'month' : 'day';
    $seriesLimit = min(7, max(1, (int) ($plan['series_limit'] ?? 5)));
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
    $alternatives = [];
    foreach (is_array($plan['alternatives'] ?? null) ? $plan['alternatives'] : [] as $alternative) {
        if (!is_array($alternative)) continue;
        $candidate = ixtla_visual_plan_normalize(array_merge($plan, $alternative, [
            'alternatives' => [], 'metric' => $metric, 'period' => $plan['period'] ?? '',
            'comparison' => $plan['comparison'] ?? '', 'filters' => $plan['filters'] ?? [],
        ]));
        if ($candidate['chart'] === '' || $candidate['domain'] === ''
            || ($candidate['chart'] === $chart && $candidate['dimension'] === $dimension && $candidate['series_dimension'] === $seriesDimension)) continue;
        $alternatives[] = [
            'chart' => $candidate['chart'], 'dimension' => $candidate['dimension'],
            'series_dimension' => $candidate['series_dimension'], 'date_grain' => $candidate['date_grain'],
            'series_limit' => $candidate['series_limit'], 'title' => $candidate['title'], 'reason' => $candidate['reason'],
        ];
        if (count($alternatives) >= 3) break;
    }
    return [
        'intent' => in_array((string) ($plan['intent'] ?? ''), ['create', 'edit', 'clarify', 'not_visualization'], true) ? $plan['intent'] : 'clarify',
        'domain' => $domain, 'chart' => $chart, 'metric' => $metric, 'dimension' => $dimension,
        'series_dimension' => $seriesDimension, 'date_grain' => $dateGrain, 'series_limit' => $seriesLimit,
        'period' => (string) ($plan['period'] ?? ''), 'comparison' => (string) ($plan['comparison'] ?? ''), 'filters' => array_slice($filters, 0, 5),
        'limit' => min(50, max(1, (int) ($plan['limit'] ?? 10))),
        'title' => $domain === '' ? '' : ixtla_insights_truncate(ixtla_visual_plan_title($domain, $chart, $metric, $dimension, $seriesDimension), 100),
        'reason' => $domain === '' ? '' : ixtla_insights_truncate(ixtla_visual_plan_reason($chart, $dimension, $seriesDimension), 220),
        'alternatives' => $alternatives,
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

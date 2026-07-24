<?php
declare(strict_types=1);

/**
 * Resuelve preguntas operativas que requieren cifras reales.
 *
 * El clasificador es deliberadamente conservador: si no reconoce una
 * intención con seguridad, deja la explicación al asistente de IA. Así no se
 * responde con una agregación equivocada ni con datos locales del navegador.
 */
function ixtla_insights_answer_operational_question(mysqli $con, string $question): ?array
{
    $plan = ixtla_insights_operational_question_plan($question);
    if ($plan === null) {
        return null;
    }

    $result = ixtla_insights_aggregate_requerimientos($con, $plan);
    $items = is_array($result['items'] ?? null) ? $result['items'] : [];
    $scope = trim((string) ($result['scope']['label'] ?? 'vista autorizada actual'));

    return [
        'ok' => true,
        'mode' => 'analytics',
        'answer' => ixtla_insights_operational_answer($plan, $items, (int) ($result['total'] ?? 0), $scope),
        'suggestions' => ixtla_insights_operational_suggestions($plan),
        'actions' => [],
    ];
}

function ixtla_insights_operational_question_plan(string $question): ?array
{
    $text = ixtla_insights_normalize_match_text($question);
    if ($text === '') {
        return null;
    }

    $mentionsCount = preg_match('/\b(cuantos|cuantas|cantidad|total|numero)\b/', $text) === 1;
    $mentionsRequirements = preg_match('/\b(requerimiento|requerimientos|reporte|reportes)\b/', $text) === 1;
    $mentionsDepartment = preg_match('/\b(departamento|departamentos|depto)\b/', $text) === 1;
    $mentionsEach = preg_match('/\b(cada|por)\b/', $text) === 1;
    $mentionsDisplay = preg_match('/\b(muestra|mostrar|dame|ver|lista|listado|ensena)\b/', $text) === 1;

    if ($mentionsRequirements && $mentionsDepartment && ($mentionsEach || $mentionsCount || $mentionsDisplay)) {
        return ixtla_insights_operational_plan('total', 'departamento');
    }
    if ($mentionsCount && $mentionsRequirements && preg_match('/\b(estatus|estado)\b/', $text) === 1) {
        return ixtla_insights_operational_plan('total', 'estatus');
    }
    if ($mentionsCount && $mentionsRequirements && preg_match('/\b(finalizado|finalizados)\b/', $text) === 1) {
        return ixtla_insights_operational_plan('finalizados', 'estatus', 'kpi');
    }
    if ($mentionsCount && $mentionsRequirements && preg_match('/\b(abierto|abiertos|pendiente|pendientes)\b/', $text) === 1) {
        return ixtla_insights_operational_plan('abiertos', 'estatus', 'kpi');
    }
    if ($mentionsCount && $mentionsRequirements && preg_match('/\b(pausado|pausados|cancelado|cancelados)\b/', $text) === 1) {
        return ixtla_insights_operational_plan('pausados_cancelados', 'estatus', 'kpi');
    }

    return null;
}

function ixtla_insights_operational_plan(string $metric, string $dimension, string $kind = 'table'): array
{
    return [
        'kind' => $kind,
        'metric' => $metric,
        'dimension' => $dimension,
        'period' => 'all',
        'filters' => [],
        'sort' => 'desc',
        'limit' => $kind === 'kpi' ? 1 : 50,
    ];
}

function ixtla_insights_operational_answer(array $plan, array $items, int $total, string $scope): string
{
    if (($plan['kind'] ?? '') === 'kpi') {
        return sprintf('En la %s hay %d %s.', $scope, $total, mb_strtolower(ixtla_insights_metric_label((string) $plan['metric'])));
    }

    if (!$items) {
        return sprintf('No hay requerimientos para mostrar por %s en la %s.', (string) $plan['dimension'], $scope);
    }

    $summary = [];
    foreach (array_slice($items, 0, 12) as $item) {
        $label = trim((string) ($item['label'] ?? 'Sin especificar'));
        $value = (int) ($item['value'] ?? 0);
        $summary[] = sprintf('%s: %d', $label, $value);
    }
    $heading = ($plan['dimension'] ?? '') === 'departamento'
        ? 'Requerimientos por departamento'
        : 'Requerimientos por estatus';

    return sprintf('%s en la %s: %s.', $heading, $scope, implode('; ', $summary));
}

function ixtla_insights_operational_suggestions(array $plan): array
{
    if (($plan['dimension'] ?? '') === 'departamento') {
        return [
            'Crear una gráfica de barras por departamento',
            'Mostrar requerimientos abiertos por departamento',
            'Comparar departamentos en los últimos 30 días',
        ];
    }

    return [
        'Crear una gráfica por estatus',
        'Mostrar requerimientos por departamento',
        'Crear un gráfico',
    ];
}

/**
 * Ejecuta un ReportPlan ya normalizado mediante la misma capa analítica que
 * usan los widgets. El modelo nunca obtiene acceso a SQL ni a resultados sin
 * pasar por el alcance RBAC de ixtla_insights_aggregate_requerimientos().
 */
function ixtla_insights_execute_report_plan(mysqli $con, array $response): array
{
    $reportPlan = is_array($response['report_plan'] ?? null) ? $response['report_plan'] : null;
    if ($reportPlan === null) {
        return $response;
    }

    $analyticsPlan = ixtla_insights_report_analytics_plan($reportPlan);
    $result = ixtla_insights_aggregate_requerimientos($con, $analyticsPlan);
    $response['mode'] = 'report';
    $response['answer'] = ixtla_insights_report_answer($reportPlan, $result);
    $response['report'] = [
        'title' => $reportPlan['title'],
        'intent' => $reportPlan['intent'],
        'metric' => $reportPlan['metric'],
        'dimension' => $reportPlan['dimension'],
        'period' => $reportPlan['period'],
        'scope' => $result['scope'] ?? [],
        'total' => $result['total'] ?? 0,
        'items' => $result['items'] ?? [],
    ];
    unset($response['report_plan']);
    return $response;
}

function ixtla_insights_report_analytics_plan(array $reportPlan): array
{
    $intent = (string) ($reportPlan['intent'] ?? '');
    $kind = match ($intent) {
        'metric_query' => 'kpi',
        'trend' => 'line',
        default => 'table',
    };

    return [
        'kind' => $kind,
        'metric' => $reportPlan['metric'] ?? 'total',
        'dimension' => $reportPlan['dimension'] ?? 'estatus',
        'period' => $reportPlan['period'] ?? 'all',
        'filters' => $reportPlan['filters'] ?? [],
        'sort' => $reportPlan['sort'] ?? 'desc',
        'limit' => $intent === 'metric_query' ? 1 : ($reportPlan['limit'] ?? 10),
    ];
}

function ixtla_insights_report_answer(array $reportPlan, array $result): string
{
    $scope = trim((string) ($result['scope']['label'] ?? 'vista autorizada actual'));
    $metric = mb_strtolower(ixtla_insights_metric_label((string) ($reportPlan['metric'] ?? 'total')));
    $period = ixtla_insights_report_period_label((string) ($reportPlan['period'] ?? 'all'));
    $intent = (string) ($reportPlan['intent'] ?? '');
    $items = is_array($result['items'] ?? null) ? $result['items'] : [];

    if ($intent === 'metric_query') {
        return sprintf('En la %s hay %s %s%s.', $scope, ixtla_insights_report_value($result['total'] ?? 0), $metric, $period);
    }
    if (!$items) {
        return sprintf('No encontré datos de %s%s en la %s.', $metric, $period, $scope);
    }

    $summary = [];
    foreach (array_slice($items, 0, 12) as $item) {
        $label = trim((string) ($item['label'] ?? 'Sin especificar'));
        $summary[] = sprintf('%s: %s', $label, ixtla_insights_report_value($item['value'] ?? 0));
    }
    $dimension = ixtla_insights_report_dimension_label((string) ($reportPlan['dimension'] ?? 'estatus'));
    $heading = match ($intent) {
        'comparison' => sprintf('Comparación de %s por %s', $metric, $dimension),
        'ranking' => sprintf('Ranking de %s por %s', $metric, $dimension),
        'trend' => sprintf('Tendencia de %s', $metric),
        default => sprintf('Desglose de %s por %s', $metric, $dimension),
    };
    if (empty($reportPlan['include_summary'])) {
        return sprintf('%s%s en la %s. Consulta el desglose para ver los resultados.', $heading, $period, $scope);
    }
    $answer = sprintf('%s%s en la %s: %s.', $heading, $period, $scope, implode('; ', $summary));
    if ($intent === 'comparison' || $intent === 'ranking') {
        $leader = $items[0] ?? [];
        $answer .= sprintf(' El valor más alto es %s (%s).', trim((string) ($leader['label'] ?? 'Sin especificar')), ixtla_insights_report_value($leader['value'] ?? 0));
    }
    return $answer;
}

function ixtla_insights_report_period_label(string $period): string
{
    return match ($period) {
        'last_7' => ' durante los últimos 7 días',
        'last_30' => ' durante los últimos 30 días',
        'this_month' => ' este mes',
        default => '',
    };
}

function ixtla_insights_report_dimension_label(string $dimension): string
{
    return match ($dimension) {
        'departamento' => 'departamento',
        'tramite' => 'trámite',
        'fecha' => 'fecha',
        default => 'estatus',
    };
}

function ixtla_insights_report_value(mixed $value): string
{
    $number = (float) $value;
    if (floor($number) === $number) {
        return number_format((int) $number, 0, '.', ',');
    }
    return number_format($number, 1, '.', ',');
}

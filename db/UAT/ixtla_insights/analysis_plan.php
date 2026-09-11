<?php
declare(strict_types=1);

/** Herramientas de datos que pueden formar parte de un plan analítico genérico. */
function ixtla_insights_analysis_plan_tools(): array
{
    return [
        'get_requirements_overview',
        'search_requirements',
        'get_priority_requirements',
        'aggregate_requirements',
        'compare_requirement_sets',
        'aggregate_requirement_dimensions',
        'get_feedback_overview',
        'aggregate_feedback',
        'search_feedback',
        'analyze_feedback_comments',
    ];
}

/**
 * Ejecuta varios pasos independientes usando los contratos vigentes. El plan
 * no recibe SQL, nombres de columnas ni permisos; cada paso vuelve a pasar por
 * ixtla_insights_execute_tool(), que valida argumentos y aplica RBAC.
 */
function ixtla_insights_execute_analysis_plan(array $arguments): array
{
    $steps = is_array($arguments['steps'] ?? null) ? $arguments['steps'] : [];
    if (count($steps) < 2 || count($steps) > 8) {
        throw new InvalidArgumentException('El plan debe contener entre dos y ocho pasos.');
    }

    $allowed = ixtla_insights_analysis_plan_tools();
    $sections = [];
    $stateUpdates = [];
    $seenIds = [];
    $lastQuery = null;
    $successes = 0;

    foreach ($steps as $index => $step) {
        if (!is_array($step)) {
            throw new InvalidArgumentException('Cada paso del plan debe ser un objeto.');
        }
        $stepId = trim((string) ($step['id'] ?? ''));
        $tool = trim((string) ($step['tool'] ?? ''));
        $toolArguments = is_array($step['arguments'] ?? null) ? $step['arguments'] : [];
        if ($stepId === '' || mb_strlen($stepId) > 50 || isset($seenIds[$stepId])) {
            throw new InvalidArgumentException('Cada paso debe tener un identificador único y breve.');
        }
        if (!in_array($tool, $allowed, true)) {
            throw new InvalidArgumentException('El plan contiene una operación no permitida.');
        }
        $seenIds[$stepId] = true;

        try {
            $data = ixtla_insights_execute_tool($tool, $toolArguments);
            $outcome = 'success';
            if ((array_key_exists('total_matching', $data) && (int) $data['total_matching'] === 0)
                || (array_key_exists('requirement', $data) && $data['requirement'] === null)) {
                $outcome = 'no_matches';
            } elseif (($data['has_more'] ?? false) === true) {
                $outcome = 'partial';
            }
            $sections[] = [
                'id' => $stepId,
                'tool' => $tool,
                'outcome' => $outcome,
                'data' => $data,
            ];
            $stateUpdates[] = ['tool' => $tool, 'arguments' => $toolArguments, 'result' => $data];
            $successes++;
            if (isset($data['query_id'])) {
                $lastQuery = [
                    'query_id' => (string) $data['query_id'],
                    'total_matching' => (int) ($data['total_matching'] ?? 0),
                    'returned' => (int) ($data['returned'] ?? 0),
                    'has_more' => (bool) ($data['has_more'] ?? false),
                    'query_expires_at_unix' => (int) ($data['query_expires_at_unix'] ?? 0),
                    'filters' => is_array($data['filters'] ?? null) ? $data['filters'] : [],
                ];
            }
        } catch (Throwable $error) {
            ixtla_insights_log_error('analysis_plan_step', $error, ['step' => $stepId, 'tool' => $tool]);
            $sections[] = [
                'id' => $stepId,
                'tool' => $tool,
                'outcome' => 'query_failed',
                'error' => 'Esta parte de la consulta no pudo completarse.',
            ];
        }
    }

    $failures = count($sections) - $successes;
    $result = [
        'outcome' => $successes === 0 ? 'query_failed' : ($failures > 0 ? 'partial' : 'success'),
        'complete' => $failures === 0,
        'steps_requested' => count($steps),
        'steps_completed' => $successes,
        'sections' => $sections,
        '_state_updates' => $stateUpdates,
    ];
    if (is_array($lastQuery)) {
        $result += $lastQuery;
    }
    return $result;
}

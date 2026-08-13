<?php
declare(strict_types=1);

/**
 * Decide si una pregunta depende de los datos internos de Ixtla.
 * Las palabras interrogativas no son senales de datos por si mismas.
 */
function ixtla_insights_question_intent(string $question, bool $hasDatasetContext = false): string
{
    $normalized = ixtla_insights_normalize_match_text($question);
    $hasRequirementReference = preg_match(
        '/\b(requerimiento|requerimientos|folio|folios|tramite|tramites|departamento|departamentos|solicitante|solicitantes|responsable|responsables|asignado|asignados|asignada|asignadas)\b/',
        $normalized
    ) === 1;
    $hasExplicitFolio = preg_match('/\breq[-\s]?\d+\b/i', $question) === 1;
    $hasConceptualPhrase = preg_match(
        '/\b(que es|que significa|que quiere decir|cual es la diferencia|diferencia entre|como funciona|como se interpreta|para que sirve)\b/',
        $normalized
    ) === 1;
    $hasDomainConcept = preg_match(
        '/\b(requerimiento|requerimientos|tramite|tramites|proceso|procesos|tarea|tareas|comentario|comentarios|estatus|canal|solicitud|revision|asignacion|pausado|pausados|cancelado|cancelados|finalizado|finalizados)\b/',
        $normalized
    ) === 1;
    $hasUnusedDeadlineReference = preg_match(
        '/\b(fecha limite|fechas limite|vencido|vencidos|vencida|vencidas|vencimiento|vencimientos|por vencer)\b/',
        $normalized
    ) === 1;
    $hasOperationalPhrase = preg_match(
        '/\b(estatus|rezago|vencimiento|vencimientos|carga de trabajo|tiempo de cierre|tiempo de resolucion)\b/',
        $normalized
    ) === 1;
    $hasReportRequest = preg_match(
        '/\b(reporte|informe|resumen|diagnostico|analisis|analiza|reporta)\b/',
        $normalized
    ) === 1;
    $isDatasetFollowUp = $hasDatasetContext && preg_match(
        '/\b(hazlo|lo mismo|pendiente|pendientes|vencido|vencidos|vencida|vencidas|finalizado|finalizados|riesgo|activos|activas|comentario|comentarios|proceso|procesos|tarea|tareas)\b/',
        $normalized
    ) === 1;

    if (!$hasExplicitFolio && $hasUnusedDeadlineReference) {
        return 'conceptual';
    }
    if (!$hasExplicitFolio && $hasConceptualPhrase && $hasDomainConcept) {
        return 'conceptual';
    }

    return ($hasRequirementReference
        || $hasExplicitFolio
        || $hasOperationalPhrase
        || $isDatasetFollowUp
        || ($hasReportRequest && (ixtla_insights_question_has_explicit_period($question) || $hasDatasetContext)))
        ? 'dataset'
        : 'direct';
}

function ixtla_insights_probe_requires_data(string $question, bool $hasDatasetContext = false): bool
{
    return ixtla_insights_question_intent($question, $hasDatasetContext) === 'dataset';
}

/** Detecta si el usuario limitó explícitamente la consulta a un periodo. */
function ixtla_insights_question_has_explicit_period(string $question): bool
{
    $normalized = ixtla_insights_normalize_match_text($question);
    return preg_match(
        '/\b(hoy|ayer|esta semana|semana actual|ultima semana|ultimas? \d+ semanas|ultimos? \d+ dias|este mes|ultimo mes|mes pasado|mes actual|mes en curso|ultimos? \d+ meses|este ano|ano pasado|ano actual|todo el historial|toda la historia|desde|hasta|entre|durante|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|20\d{2})\b/',
        $normalized
    ) === 1;
}

/** Traduce expresiones temporales soportadas al periodo cerrado del dataset. */
function ixtla_insights_question_requested_period(string $question): ?string
{
    $normalized = ixtla_insights_normalize_match_text($question);
    if (preg_match('/\b(todo el historial|toda la historia)\b/', $normalized) === 1) return 'all';
    if (preg_match('/\b(esta semana|semana actual)\b/', $normalized) === 1) return 'this_week';
    if (preg_match('/\b(ultimos? 7 dias|ultima semana)\b/', $normalized) === 1) return 'last_7';
    if (preg_match('/\b(ultimos? 30 dias|ultimo mes|mes pasado)\b/', $normalized) === 1) return 'last_30';
    if (preg_match('/\b(este mes|mes actual|mes en curso)\b/', $normalized) === 1) return 'this_month';
    return null;
}

/** Resuelve un mes mencionado a un rango ISO; sin año usa su ocurrencia más reciente. */
function ixtla_insights_question_requested_date_range(string $question): ?array
{
    $normalized = ixtla_insights_normalize_match_text($question);
    $months = [
        'enero' => 1, 'febrero' => 2, 'marzo' => 3, 'abril' => 4,
        'mayo' => 5, 'junio' => 6, 'julio' => 7, 'agosto' => 8,
        'septiembre' => 9, 'octubre' => 10, 'noviembre' => 11, 'diciembre' => 12,
    ];
    if (preg_match('/\b(' . implode('|', array_keys($months)) . ')(?:\s+de)?(?:\s+(20\d{2}))?\b/', $normalized, $matches) !== 1) {
        return null;
    }
    $month = $months[$matches[1]];
    $currentYear = (int) date('Y');
    $year = isset($matches[2]) && $matches[2] !== '' ? (int) $matches[2] : $currentYear;
    if ((!isset($matches[2]) || $matches[2] === '') && $month > (int) date('n')) $year--;
    $from = sprintf('%04d-%02d-01', $year, $month);
    $to = date('Y-m-t', strtotime($from));
    $dateField = preg_match('/\b(cerrado|cerrados|cerrada|cerradas|cerraron|cierre|finalizados durante|finalizadas durante)\b/', $normalized) === 1
        ? 'closed_at'
        : 'created_at';
    return ['date_field' => $dateField, 'date_from' => $from, 'date_to' => $to];
}

/**
 * Finalizado es un estado de negocio, no la mera presencia de una fecha de
 * cierre. Devuelve el filtro obligatorio cuando la pregunta pide casos
 * cerrados/finalizados de forma afirmativa.
 */
function ixtla_insights_question_requires_finalized_status(string $question): bool
{
    $normalized = ixtla_insights_normalize_match_text($question);
    $mentionsFinalized = preg_match(
        '/\b(finalizado|finalizados|finalizada|finalizadas|cerrado|cerrados|cerrada|cerradas|cerraron|cierre|cierres)\b/',
        $normalized
    ) === 1;
    $negatesFinalized = preg_match(
        '/\b(no (?:esta|estan|fue|fueron|se encuentra|se encuentran)?\s*(?:finalizado|finalizados|finalizada|finalizadas|cerrado|cerrados|cerrada|cerradas)|sin finalizar|no finalizados|excepto finalizados)\b/',
        $normalized
    ) === 1;
    return $mentionsFinalized && !$negatesFinalized;
}

/**
 * Impone el periodo general para consultas sin referencia temporal. La regla
 * vive en servidor para no depender de que el modelo elija correctamente all.
 */
function ixtla_insights_apply_default_period(string $toolName, array $arguments, string $question): array
{
    if (in_array($toolName, ['get_requirements_overview', 'search_requirements', 'aggregate_requirements'], true)) {
        $arguments['date_field'] = in_array((string) ($arguments['date_field'] ?? ''), ['created_at', 'closed_at'], true)
            ? (string) $arguments['date_field']
            : 'created_at';
        $arguments['date_from'] = isset($arguments['date_from']) && is_string($arguments['date_from']) ? $arguments['date_from'] : null;
        $arguments['date_to'] = isset($arguments['date_to']) && is_string($arguments['date_to']) ? $arguments['date_to'] : null;
        if (in_array($toolName, ['search_requirements', 'aggregate_requirements'], true)) {
            foreach (['department_ids', 'department_names', 'assignee_ids', 'tramite_ids', 'status_ids'] as $listKey) {
                $arguments[$listKey] = is_array($arguments[$listKey] ?? null) ? $arguments[$listKey] : [];
            }
            $arguments['department_id'] = max(0, (int) ($arguments['department_id'] ?? 0));
            $arguments['assignee_id'] = max(0, (int) ($arguments['assignee_id'] ?? 0));
        }
        if ($toolName === 'search_requirements') {
            $arguments['cursor'] = isset($arguments['cursor']) && is_string($arguments['cursor']) ? $arguments['cursor'] : null;
        }
        $requestedRange = ixtla_insights_question_requested_date_range($question);
        if ($requestedRange !== null) {
            $arguments = array_replace($arguments, $requestedRange);
            $arguments['period'] = 'all';
            return $arguments;
        }
        $requestedPeriod = ixtla_insights_question_requested_period($question);
        if ($requestedPeriod !== null) {
            $arguments['period'] = $requestedPeriod;
        } elseif (!ixtla_insights_question_has_explicit_period($question)) {
            $arguments['period'] = 'all';
        }
    }
    return $arguments;
}

/** Detecta seguimientos que hacen referencia al resultado o alcance anterior. */
function ixtla_insights_question_reuses_previous_result(string $question): bool
{
    $normalized = ixtla_insights_normalize_match_text($question);
    return preg_match(
        '/\b(esos|esas|estos|estas|los anteriores|las anteriores|los mismos|las mismas|ese resultado|esa consulta|de que fecha|que fecha|cuales son|muestramelos|muestramelas|detallalos|detallalas|hazlo|lo mismo|ahora)\b/',
        $normalized
    ) === 1;
}

/** Un seguimiento de este tipo necesita filas, no solamente otro agregado. */
function ixtla_insights_question_requires_row_details(string $question): bool
{
    if (!ixtla_insights_question_reuses_previous_result($question)) {
        return false;
    }
    $normalized = ixtla_insights_normalize_match_text($question);
    return preg_match(
        '/\b(fecha|fechas|folio|folios|cuales son|muestramelos|muestramelas|detalle|detalles|detallalos|detallalas)\b/',
        $normalized
    ) === 1;
}

/**
 * Completa una llamada de herramienta con el alcance analitico previo.
 * Los valores explicitos de la pregunta actual siempre tienen precedencia.
 */
function ixtla_insights_prepare_tool_arguments(
    string $toolName,
    array $arguments,
    string $question,
    array $analyticsContext = []
): array {
    $reusesPrevious = ixtla_insights_question_reuses_previous_result($question);
    $previousFilters = is_array($analyticsContext['last_filters'] ?? null)
        ? $analyticsContext['last_filters']
        : [];

    if ($reusesPrevious && in_array($toolName, ['get_requirements_overview', 'search_requirements', 'aggregate_requirements'], true)) {
        $listKeys = ['department_ids', 'department_names', 'assignee_ids', 'tramite_ids', 'status_ids'];
        foreach ($listKeys as $key) {
            $current = is_array($arguments[$key] ?? null) ? $arguments[$key] : [];
            $previous = is_array($previousFilters[$key] ?? null) ? $previousFilters[$key] : [];
            if ($current === [] && $previous !== []) {
                $arguments[$key] = $previous;
            }
        }

        foreach (['department_id', 'assignee_id'] as $key) {
            if ((int) ($arguments[$key] ?? 0) <= 0 && (int) ($previousFilters[$key] ?? 0) > 0) {
                $arguments[$key] = (int) $previousFilters[$key];
            }
        }

        if (($arguments['assignee_state'] ?? 'any') === 'any'
            && isset($previousFilters['assignee_state'])
            && $previousFilters['assignee_state'] !== 'any') {
            $arguments['assignee_state'] = $previousFilters['assignee_state'];
        }

        if (!ixtla_insights_question_has_explicit_period($question)) {
            $previousPeriod = (string) ($previousFilters['period'] ?? $analyticsContext['period'] ?? '');
            if (in_array($previousPeriod, ['all', 'this_week', 'last_7', 'last_30', 'this_month'], true)) {
                $arguments['period'] = $previousPeriod;
            }
            foreach (['date_field', 'date_from', 'date_to'] as $key) {
                if (array_key_exists($key, $previousFilters)) {
                    $arguments[$key] = $previousFilters[$key];
                }
            }
        }
    }

    if (in_array($toolName, ['search_requirements', 'aggregate_requirements'], true)
        && ixtla_insights_question_requires_finalized_status($question)) {
        // La regla de negocio prevalece incluso si el modelo envio otros
        // estatus junto con una fecha de cierre.
        $arguments['status_ids'] = [6];
    }

    $arguments = ixtla_insights_apply_default_period($toolName, $arguments, $question);

    // apply_default_period usa todo el historial para preguntas independientes;
    // en un seguimiento debe conservarse el periodo heredado.
    if ($reusesPrevious && !ixtla_insights_question_has_explicit_period($question)) {
        $previousPeriod = (string) ($previousFilters['period'] ?? $analyticsContext['period'] ?? '');
        if (in_array($previousPeriod, ['all', 'this_week', 'last_7', 'last_30', 'this_month'], true)) {
            $arguments['period'] = $previousPeriod;
        }
    }

    return $arguments;
}

/** Las consultas del dominio deben ejecutar al menos una herramienta autorizada. */
function ixtla_insights_question_tool_choice(string $question, bool $hasDatasetContext = false): string
{
    return ixtla_insights_probe_requires_data($question, $hasDatasetContext) ? 'required' : 'none';
}

/** @param list<array{role?: string, content?: string}> $history */
function ixtla_insights_history_has_dataset_context(array $history): bool
{
    foreach ($history as $message) {
        if (($message['role'] ?? '') === 'user'
            && ixtla_insights_question_intent((string) ($message['content'] ?? '')) === 'dataset') {
            return true;
        }
    }
    return false;
}

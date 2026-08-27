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
        '/\b(requerimiento|requerimientos|retroalimentacion|retroalimentaciones|retro|retros|encuesta|encuestas|calificacion|calificaciones|satisfaccion|favorable|favorables|desfavorable|desfavorables|contestado|contestadas|folio|folios|tramite|tramites|departamento|departamentos|solicitante|solicitantes|ciudadano|ciudadana|ciudadanos|ciudadanas|contacto|contactos|responsable|responsables|asignado|asignados|asignada|asignadas)\b/',
        $normalized
    ) === 1;
    $hasExplicitFolio = preg_match('/\breq[-\s]?\d+\b/i', $question) === 1;
    $hasConceptualPhrase = preg_match(
        '/\b(que es|que significa|que quiere decir|cual es la diferencia|diferencia entre|como funciona|como se interpreta|para que sirve)\b/',
        $normalized
    ) === 1;
    $hasDomainConcept = preg_match(
        '/\b(requerimiento|requerimientos|retroalimentacion|retroalimentaciones|retro|retros|encuesta|encuestas|calificacion|calificaciones|satisfaccion|favorable|favorables|desfavorable|desfavorables|contestado|contestadas|tramite|tramites|proceso|procesos|tarea|tareas|comentario|comentarios|estatus|canal|solicitud|revision|asignacion|pausado|pausados|cancelado|cancelados|finalizado|finalizados)\b/',
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
    $isDatasetFollowUp = $hasDatasetContext && (preg_match(
        '/\b(hazlo|lo mismo|hay mas|siguientes|siguiente pagina|continua|continuar|fuera de|antes de|otras semanas|semanas anteriores|todo el historial|pendiente|pendientes|vencido|vencidos|vencida|vencidas|finalizado|finalizados|riesgo|activos|activas|comentario|comentarios|proceso|procesos|tarea|tareas|ciudadano|ciudadana|empleado|empleados|portal|canal|otro canal|canal contrario|dieron de alta|dados de alta|capturados|registrados|sin asignar|sin responsable|con responsable|contacto|telefono|correo|email|domicilio|direccion|colonia|codigo postal)\b/',
        $normalized
    ) === 1 || ixtla_insights_question_is_temporal_followup($question));

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
    return ixtla_insights_question_requested_period($question) !== null
        || ixtla_insights_question_requested_date_range($question) !== null;
}

/** Traduce expresiones temporales soportadas al periodo cerrado del dataset. */
function ixtla_insights_question_requested_period(string $question): ?string
{
    $normalized = ixtla_insights_normalize_match_text($question);
    if (preg_match('/\b(todo el historial|toda la historia|todas las semanas|incluyendo otras semanas)\b/', $normalized) === 1) return 'all';
    if (preg_match('/\b(esta semana|semana actual)\b/', $normalized) === 1) return 'this_week';
    if (preg_match('/\b(ultimos? 7 dias|ultima semana)\b/', $normalized) === 1) return 'last_7';
    if (preg_match('/\b(ultimos? 30 dias|ultimo mes)\b/', $normalized) === 1) return 'last_30';
    if (preg_match('/\b(este mes|mes actual|mes en curso)\b/', $normalized) === 1) return 'this_month';
    return null;
}

/** Resuelve un mes mencionado a un rango ISO; sin año usa su ocurrencia más reciente. */
function ixtla_insights_temporal_date_field(string $normalized): string
{
    if (preg_match('/\b(creado|creados|creada|creadas|registrado|registrados|registrada|registradas|ingresado|ingresados)\b/', $normalized) === 1) {
        return 'created_at';
    }
    return preg_match('/\b(cerrado|cerrados|cerrada|cerradas|cerraron|cierre|cierres|finalizado|finalizados|finalizada|finalizadas)\b/', $normalized) === 1
        ? 'closed_at'
        : 'created_at';
}

function ixtla_insights_temporal_quantity(string $value): int
{
    if (ctype_digit($value)) return (int) $value;
    return [
        'un' => 1, 'uno' => 1, 'una' => 1, 'dos' => 2, 'tres' => 3, 'cuatro' => 4,
        'cinco' => 5, 'seis' => 6, 'siete' => 7, 'ocho' => 8, 'nueve' => 9,
        'diez' => 10, 'once' => 11, 'doce' => 12,
    ][$value] ?? 1;
}

function ixtla_insights_temporal_iso_date(string $value, DateTimeZone $timezone): ?DateTimeImmutable
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, $timezone);
    $errors = DateTimeImmutable::getLastErrors();
    if (!$date instanceof DateTimeImmutable
        || (is_array($errors) && ((int) $errors['warning_count'] > 0 || (int) $errors['error_count'] > 0))
        || $date->format('Y-m-d') !== $value) {
        return null;
    }
    return $date;
}

/** Devuelve un mensaje explicito cuando una fecha no debe autocorregirse. */
function ixtla_insights_question_temporal_validation_error(string $question): ?string
{
    $normalized = ixtla_insights_normalize_match_text($question);
    $dateText = mb_strtolower(trim($question), 'UTF-8');
    if (preg_match_all('/\b20\d{2}-\d{2}-\d{2}\b/', $dateText, $matches) > 0) {
        $timezone = new DateTimeZone(date_default_timezone_get());
        foreach ($matches[0] as $date) {
            if (ixtla_insights_temporal_iso_date($date, $timezone) === null) {
                return 'La fecha ' . $date . ' no existe. Indica una fecha valida en formato AAAA-MM-DD.';
            }
        }
        if (count($matches[0]) >= 2 && $matches[0][0] > $matches[0][1]) {
            return 'El inicio del rango no puede ser posterior a la fecha final.';
        }
    }

    $quantity = '(\d+|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)';
    if (preg_match('/\b(?:hace|ultimos?|ultimas?)\s+' . $quantity . '\s+(dias?|semanas?|meses?|anos?)\b/', $normalized, $match) === 1) {
        $amount = ixtla_insights_temporal_quantity($match[1]);
        if ($amount < 1) return 'El periodo debe ser mayor que cero.';
        $maximum = str_starts_with($match[2], 'dia') ? 3660
            : (str_starts_with($match[2], 'semana') ? 520
            : (str_starts_with($match[2], 'mes') ? 120 : 10));
        if ($amount > $maximum) {
            return 'El periodo solicitado es demasiado amplio. Usa un rango de fechas explicito.';
        }
    }
    return null;
}

/** Resuelve expresiones temporales a limites ISO inclusivos. */
function ixtla_insights_question_requested_date_range(string $question, ?DateTimeImmutable $now = null): ?array
{
    $normalized = ixtla_insights_normalize_match_text($question);
    $dateText = mb_strtolower(trim($question), 'UTF-8');
    $today = ($now ?? new DateTimeImmutable('now'))->setTime(0, 0);
    $field = ixtla_insights_temporal_date_field($normalized);
    $makeRange = static fn (?DateTimeImmutable $from, ?DateTimeImmutable $to): array => [
        'date_field' => $field,
        'date_from' => $from?->format('Y-m-d'),
        'date_to' => $to?->format('Y-m-d'),
    ];

    if (preg_match('/\b(20\d{2}-\d{2}-\d{2})\s+(?:a|al|hasta|y)\s+(20\d{2}-\d{2}-\d{2})\b/', $dateText, $matches) === 1) {
        $from = ixtla_insights_temporal_iso_date($matches[1], $today->getTimezone());
        $to = ixtla_insights_temporal_iso_date($matches[2], $today->getTimezone());
        if ($from instanceof DateTimeImmutable && $to instanceof DateTimeImmutable && $from <= $to) {
            return $makeRange($from, $to);
        }
    }
    if (preg_match('/\bdesde\s+(20\d{2}-\d{2}-\d{2})\b/', $dateText, $matches) === 1) {
        $from = ixtla_insights_temporal_iso_date($matches[1], $today->getTimezone());
        if ($from instanceof DateTimeImmutable) {
            return $makeRange($from, $today);
        }
        return null;
    }
    if (preg_match('/\bhasta\s+(20\d{2}-\d{2}-\d{2})\b/', $dateText, $matches) === 1) {
        $to = ixtla_insights_temporal_iso_date($matches[1], $today->getTimezone());
        if ($to instanceof DateTimeImmutable) {
            return $makeRange(null, $to);
        }
        return null;
    }

    if (preg_match('/\b(fuera de esta semana|antes de esta semana|semanas anteriores|semanas previas)\b/', $normalized) === 1) {
        return $makeRange(null, $today->modify('monday this week')->modify('-1 day'));
    }
    if (preg_match('/\bhoy\b/', $normalized) === 1) return $makeRange($today, $today);
    if (preg_match('/\bayer\b/', $normalized) === 1) {
        $yesterday = $today->modify('-1 day');
        return $makeRange($yesterday, $yesterday);
    }
    if (preg_match('/\b(semana pasada|semana anterior)\b/', $normalized) === 1) {
        $from = $today->modify('monday this week')->modify('-1 week');
        return $makeRange($from, $from->modify('+6 days'));
    }

    $quantity = '(\d+|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)';
    if (preg_match('/\bhace\s+' . $quantity . '\s+dias?\b/', $normalized, $matches) === 1) {
        $day = $today->modify('-' . ixtla_insights_temporal_quantity($matches[1]) . ' days');
        return $makeRange($day, $day);
    }
    if (preg_match('/\bultimos?\s+' . $quantity . '\s+dias?\b/', $normalized, $matches) === 1) {
        $days = ixtla_insights_temporal_quantity($matches[1]);
        return $makeRange($today->modify('-' . ($days - 1) . ' days'), $today);
    }
    if (preg_match('/\bhace\s+' . $quantity . '\s+semanas?\b/', $normalized, $matches) === 1) {
        $weeks = ixtla_insights_temporal_quantity($matches[1]);
        $from = $today->modify('monday this week')->modify('-' . $weeks . ' weeks');
        return $makeRange($from, $from->modify('+6 days'));
    }
    if (preg_match('/\bultimas?\s+' . $quantity . '\s+semanas?\b/', $normalized, $matches) === 1) {
        $days = ixtla_insights_temporal_quantity($matches[1]) * 7;
        return $makeRange($today->modify('-' . ($days - 1) . ' days'), $today);
    }

    $months = [
        'enero' => 1, 'febrero' => 2, 'marzo' => 3, 'abril' => 4,
        'mayo' => 5, 'junio' => 6, 'julio' => 7, 'agosto' => 8,
        'septiembre' => 9, 'octubre' => 10, 'noviembre' => 11, 'diciembre' => 12,
    ];
    $hasCompoundMonthExpression = preg_match('/\b(quincena|de\s+(?:' . implode('|', array_keys($months)) . ')\s+a\s+(?:' . implode('|', array_keys($months)) . '))\b/', $normalized) === 1;
    if (!$hasCompoundMonthExpression && preg_match('/\b(' . implode('|', array_keys($months)) . ')(?:\s+de)?(?:\s+(20\d{2}))?\b/', $normalized, $matches) === 1) {
        $month = $months[$matches[1]];
        $year = isset($matches[2]) && $matches[2] !== '' ? (int) $matches[2] : (int) $today->format('Y');
        if ((!isset($matches[2]) || $matches[2] === '') && $month > (int) $today->format('n')) $year--;
        $from = new DateTimeImmutable(sprintf('%04d-%02d-01', $year, $month), $today->getTimezone());
        return $makeRange($from, $from->modify('last day of this month'));
    }
    if (preg_match('/\b(mes pasado|mes anterior|ultimo mes calendario)\b/', $normalized) === 1) {
        $from = $today->modify('first day of this month')->modify('-1 month');
        return $makeRange($from, $from->modify('last day of this month'));
    }
    if (preg_match('/\bhace\s+' . $quantity . '\s+meses?\b/', $normalized, $matches) === 1) {
        $monthsAgo = ixtla_insights_temporal_quantity($matches[1]);
        $from = $today->modify('first day of this month')->modify('-' . $monthsAgo . ' months');
        return $makeRange($from, $from->modify('last day of this month'));
    }
    if (preg_match('/\bultimos?\s+' . $quantity . '\s+meses?\b/', $normalized, $matches) === 1) {
        return $makeRange($today->modify('-' . ixtla_insights_temporal_quantity($matches[1]) . ' months'), $today);
    }

    if (preg_match('/\b(primer|primera|segundo|segunda)\s+quincena(?:\s+de\s+(' . implode('|', array_keys($months)) . ')(?:\s+de\s+(20\d{2}))?)?\b/', $normalized, $matches) === 1) {
        $month = isset($matches[2]) && $matches[2] !== '' ? $months[$matches[2]] : (int) $today->format('n');
        $year = isset($matches[3]) && $matches[3] !== '' ? (int) $matches[3] : (int) $today->format('Y');
        $from = new DateTimeImmutable(sprintf('%04d-%02d-%02d', $year, $month, str_starts_with($matches[1], 'primer') ? 1 : 16), $today->getTimezone());
        $to = str_starts_with($matches[1], 'primer') ? $from->setDate($year, $month, 15) : $from->modify('last day of this month');
        return $makeRange($from, $to);
    }
    if (preg_match('/\b(primer|primero|segundo|tercer|tercero|cuarto)\s+trimestre(?:\s+de\s+(20\d{2}))?\b/', $normalized, $matches) === 1) {
        $quarter = ['primer' => 1, 'primero' => 1, 'segundo' => 2, 'tercer' => 3, 'tercero' => 3, 'cuarto' => 4][$matches[1]];
        $year = isset($matches[2]) && $matches[2] !== '' ? (int) $matches[2] : (int) $today->format('Y');
        $from = $today->setDate($year, (($quarter - 1) * 3) + 1, 1);
        return $makeRange($from, $from->modify('+3 months')->modify('-1 day'));
    }
    if (preg_match('/\b(primer|primero|segundo)\s+semestre(?:\s+de\s+(20\d{2}))?\b/', $normalized, $matches) === 1) {
        $first = $matches[1] !== 'segundo';
        $year = isset($matches[2]) && $matches[2] !== '' ? (int) $matches[2] : (int) $today->format('Y');
        $from = $today->setDate($year, $first ? 1 : 7, 1);
        return $makeRange($from, $from->modify('+6 months')->modify('-1 day'));
    }
    if (preg_match('/\bde\s+(' . implode('|', array_keys($months)) . ')\s+a\s+(' . implode('|', array_keys($months)) . ')(?:\s+de\s+(20\d{2}))?\b/', $normalized, $matches) === 1) {
        $year = isset($matches[3]) && $matches[3] !== '' ? (int) $matches[3] : (int) $today->format('Y');
        $fromMonth = $months[$matches[1]];
        $toMonth = $months[$matches[2]];
        if ($fromMonth <= $toMonth) {
            $from = $today->setDate($year, $fromMonth, 1);
            $to = $today->setDate($year, $toMonth, 1)->modify('last day of this month');
            return $makeRange($from, $to);
        }
    }

    if (preg_match('/\b(20\d{2})\b/', $normalized, $matches) === 1) {
        $year = (int) $matches[1];
        return $makeRange($today->setDate($year, 1, 1), $today->setDate($year, 12, 31));
    }
    if (preg_match('/\b(este ano|ano actual|todo el ano)\b/', $normalized) === 1) {
        return $makeRange($today->setDate((int) $today->format('Y'), 1, 1), $today);
    }
    if (preg_match('/\b(ano pasado|ano anterior)\b/', $normalized) === 1) {
        $year = (int) $today->format('Y') - 1;
        return $makeRange($today->setDate($year, 1, 1), $today->setDate($year, 12, 31));
    }
    if (preg_match('/\bhace\s+' . $quantity . '\s+anos?\b/', $normalized, $matches) === 1) {
        $year = (int) $today->format('Y') - ixtla_insights_temporal_quantity($matches[1]);
        return $makeRange($today->setDate($year, 1, 1), $today->setDate($year, 12, 31));
    }
    if (preg_match('/\bultimos?\s+' . $quantity . '\s+anos?\b/', $normalized, $matches) === 1) {
        return $makeRange($today->modify('-' . ixtla_insights_temporal_quantity($matches[1]) . ' years'), $today);
    }
    return null;
}

/** Una frase temporal breve al inicio normalmente modifica la consulta previa. */
function ixtla_insights_question_is_temporal_followup(string $question): bool
{
    if (!ixtla_insights_question_has_explicit_period($question)) return false;
    $normalized = ixtla_insights_normalize_match_text($question);
    return preg_match('/^(?:y\s+|ahora\s+|tambien\s+)?(?:de|del|en|para|durante|desde|fuera|antes|hace|ultim|este|esta|el|todo|toda|semana|mes|ano|20\d{2})\b/', $normalized) === 1;
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
    if (in_array($toolName, ['get_feedback_overview', 'aggregate_feedback', 'search_feedback', 'analyze_feedback_comments'], true)) {
        foreach (['status_ids', 'rating_ids', 'department_ids', 'tramite_ids', 'requirement_status_ids', 'channel_ids', 'assignee_ids'] as $listKey) {
            $arguments[$listKey] = is_array($arguments[$listKey] ?? null) ? $arguments[$listKey] : [];
        }
        $arguments['assignee_state'] = in_array((string) ($arguments['assignee_state'] ?? ''), ['any', 'assigned', 'unassigned'], true)
            ? (string) $arguments['assignee_state'] : 'any';
        $arguments['date_from'] = isset($arguments['date_from']) && is_string($arguments['date_from']) ? $arguments['date_from'] : null;
        $arguments['date_to'] = isset($arguments['date_to']) && is_string($arguments['date_to']) ? $arguments['date_to'] : null;
        $requestedRange = ixtla_insights_question_requested_date_range($question);
        if ($requestedRange !== null) {
            $arguments['date_from'] = $requestedRange['date_from'];
            $arguments['date_to'] = $requestedRange['date_to'];
            $arguments['period'] = 'all';
            return $arguments;
        }
        $arguments['period'] = ixtla_insights_question_requested_period($question)
            ?? (in_array((string) ($arguments['period'] ?? ''), ['all', 'this_week', 'last_7', 'last_30', 'this_month'], true) ? (string) $arguments['period'] : 'all');
    }
    if (in_array($toolName, ['get_requirements_overview', 'search_requirements', 'aggregate_requirements'], true)) {
        $arguments['date_field'] = in_array((string) ($arguments['date_field'] ?? ''), ['created_at', 'closed_at'], true)
            ? (string) $arguments['date_field']
            : 'created_at';
        $arguments['date_from'] = isset($arguments['date_from']) && is_string($arguments['date_from']) ? $arguments['date_from'] : null;
        $arguments['date_to'] = isset($arguments['date_to']) && is_string($arguments['date_to']) ? $arguments['date_to'] : null;
        if (in_array($toolName, ['search_requirements', 'aggregate_requirements'], true)) {
            foreach (['department_ids', 'department_names', 'assignee_ids', 'tramite_ids', 'status_ids', 'channel_ids'] as $listKey) {
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
    return ixtla_insights_question_is_temporal_followup($question)
        || preg_match('/^(y|ahora|tambien|en cambio|por el contrario|por otro lado)\b/', $normalized) === 1
        || preg_match(
        '/\b(esos|esas|estos|estas|ese departamento|esa area|del mismo departamento|los anteriores|las anteriores|los mismos|las mismas|ese resultado|esa consulta|hay mas|siguientes|siguiente pagina|continua|continuar|fuera de esta semana|antes de esta semana|semanas anteriores|de que fecha|que fecha|cuales son|muestramelos|muestramelas|detallalos|detallalas|hazlo|lo mismo|ahora)\b/',
        $normalized
    ) === 1;
}

/** Detecta un canal expresado de forma directa, coloquial o relativa. */
function ixtla_insights_question_requested_channels(string $question, array $previousFilters = []): ?array
{
    $normalized = ixtla_insights_normalize_match_text($question);
    if (preg_match('/\b(todos los canales|ambos canales|cualquier canal|sin filtrar canal)\b/', $normalized) === 1) {
        return [];
    }

    $channels = [];
    $citizen = preg_match('/\b(canal\s*1|portal(?:\s+del)?\s+ciudadan[oa]|canal(?:\s+del)?\s+ciudadan[oa]|solicitudes? ciudadanas?)\b/', $normalized) === 1
        || preg_match('/\b(?:alta|registrad[oa]s?|capturad[oa]s?)\b.{0,35}\b(?:ciudadan[oa]s?)\b/', $normalized) === 1;
    $employee = preg_match('/\b(canal\s*2|portal(?:\s+de\s+los)?\s+empleados?|canal(?:\s+de\s+los)?\s+empleados?)\b/', $normalized) === 1
        || preg_match('/\b(?:alta|registrad[oa]s?|capturad[oa]s?)\b.{0,35}\b(?:por\s+)?empleados?\b/', $normalized) === 1
        || preg_match('/\bempleados?\b.{0,35}\b(?:dieron|dadas?|dados?|registraron|capturaron)\b.{0,18}\balta\b/', $normalized) === 1;
    if (is_array($previousFilters['channel_ids'] ?? null)) {
        $citizen = $citizen || preg_match('/^(?:y\s+|ahora\s+|tambien\s+)?(?:cuantos?\s+|cuantas?\s+|los\s+|las\s+)?ciudadan[oa]s?\??$/', $normalized) === 1;
        $employee = $employee || preg_match('/^(?:y\s+|ahora\s+|tambien\s+)?(?:cuantos?\s+|cuantas?\s+|los\s+|las\s+)?empleados?\??$/', $normalized) === 1;
    }
    if ($citizen) $channels[] = 1;
    if ($employee) $channels[] = 2;
    if ($channels !== []) return array_values(array_unique($channels));

    if (preg_match('/\b(otro canal|canal contrario|canal opuesto|los otros)\b/', $normalized) === 1) {
        $previous = array_values(array_unique(array_map('intval', is_array($previousFilters['channel_ids'] ?? null) ? $previousFilters['channel_ids'] : [])));
        if ($previous === [1]) return [2];
        if ($previous === [2]) return [1];
    }
    return null;
}

/** Traduce menciones inequívocas del estado actual a sus identificadores. */
function ixtla_insights_question_requested_statuses(string $question): ?array
{
    $normalized = ixtla_insights_normalize_match_text($question);
    if (preg_match('/\b(todos los estatus|cualquier estatus|sin filtrar estatus)\b/', $normalized) === 1) return [];
    $excluded = [];
    foreach ([4 => 'pausad[oa]s?', 5 => 'cancelad[oa]s?', 6 => '(?:finalizad[oa]s?|cerrad[oa]s?)'] as $id => $term) {
        if (preg_match('/\b(?:no|excepto|sin)\s+(?:los\s+|las\s+)?' . $term . '\b/', $normalized) === 1) $excluded[] = $id;
    }
    if ($excluded !== []) return array_values(array_diff(range(0, 6), $excluded));
    $patterns = [
        0 => '/\b(estatus solicitud|en solicitud|ingreso inicial|recien ingresad[oa]s?)\b/',
        1 => '/\b(revision|en revision)\b/',
        2 => '/\b(asignacion|en asignacion)\b/',
        3 => '/\b(en proceso|procesandose|atencion activa)\b/',
        4 => '/\b(pausad[oa]s?)\b/',
        5 => '/\b(cancelad[oa]s?)\b/',
        6 => '/\b(finalizad[oa]s?|cerrad[oa]s?)\b/',
    ];
    $statuses = [];
    foreach ($patterns as $id => $pattern) {
        if (preg_match($pattern, $normalized) === 1) $statuses[] = $id;
    }
    return $statuses === [] ? null : $statuses;
}

/** Resuelve preguntas sobre presencia o ausencia de responsable. */
function ixtla_insights_question_requested_assignee_state(string $question): ?string
{
    $normalized = ixtla_insights_normalize_match_text($question);
    if (preg_match('/\b(sin asignar|no asignad[oa]s?|sin responsable|sin empleado asignado|no (?:tiene|tienen|cuenta|cuentan) con responsable)\b/', $normalized) === 1) return 'unassigned';
    if (preg_match('/\b(con responsable|con empleado asignado|ya asignad[oa]s?)\b/', $normalized) === 1) return 'assigned';
    if (preg_match('/\b(todos los responsables|cualquier responsable|sin filtrar responsable)\b/', $normalized) === 1) return 'any';
    return null;
}

/** Un seguimiento de este tipo necesita filas, no solamente otro agregado. */
function ixtla_insights_question_requires_row_details(string $question): bool
{
    if (!ixtla_insights_question_reuses_previous_result($question)) {
        return false;
    }
    $normalized = ixtla_insights_normalize_match_text($question);
    return preg_match(
        '/\b(fecha|fechas|folio|folios|hay mas|fuera de esta semana|antes de esta semana|semanas anteriores|cuales son|muestramelos|muestramelas|detalle|detalles|detallalos|detallalas)\b/',
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
    $normalizedQuestion = ixtla_insights_normalize_match_text($question);
    $previousFilters = is_array($analyticsContext['last_filters'] ?? null)
        ? $analyticsContext['last_filters']
        : [];

    if ($toolName === 'search_requirements'
        && preg_match('/\b(siguientes|siguiente pagina|continua|continuar)\b/', $normalizedQuestion) === 1) {
        $nextCursor = trim((string) ($analyticsContext['last_query']['next_cursor'] ?? ''));
        if ($nextCursor !== '') $arguments['cursor'] = $nextCursor;
    }

    if ($toolName === 'search_feedback'
        && preg_match('/\b(siguientes|siguiente pagina|continua|continuar)\b/', $normalizedQuestion) === 1) {
        $arguments['page'] = max(1, (int) ($previousFilters['page'] ?? 1) + 1);
    }

    if ($reusesPrevious && in_array($toolName, ['get_feedback_overview', 'aggregate_feedback', 'search_feedback', 'analyze_feedback_comments'], true)) {
        foreach (['status_ids', 'rating_ids', 'department_ids', 'tramite_ids', 'requirement_status_ids', 'channel_ids', 'assignee_ids'] as $key) {
            if ((is_array($arguments[$key] ?? null) ? $arguments[$key] : []) === [] && is_array($previousFilters[$key] ?? null)) {
                $arguments[$key] = $previousFilters[$key];
            }
        }
        if (($arguments['assignee_state'] ?? 'any') === 'any' && isset($previousFilters['assignee_state'])) {
            $arguments['assignee_state'] = $previousFilters['assignee_state'];
        }
        if (!ixtla_insights_question_has_explicit_period($question)) {
            foreach (['period', 'date_from', 'date_to'] as $key) {
                if (array_key_exists($key, $previousFilters)) $arguments[$key] = $previousFilters[$key];
            }
        }
    }

    if ($reusesPrevious && in_array($toolName, ['get_requirements_overview', 'search_requirements', 'aggregate_requirements'], true)) {
        $listKeys = ['department_ids', 'department_names', 'assignee_ids', 'tramite_ids', 'status_ids', 'channel_ids'];
        foreach ($listKeys as $key) {
            $resetsDimension = match ($key) {
                'department_ids', 'department_names' => preg_match('/\b(todos los departamentos|todas las areas|sin filtrar departamento)\b/', $normalizedQuestion) === 1,
                'status_ids' => preg_match('/\b(todos los estatus|cualquier estatus|sin filtrar estatus)\b/', $normalizedQuestion) === 1,
                'channel_ids' => preg_match('/\b(todos los canales|cualquier canal|sin filtrar canal)\b/', $normalizedQuestion) === 1,
                'assignee_ids' => preg_match('/\b(todos los responsables|cualquier responsable|sin filtrar responsable)\b/', $normalizedQuestion) === 1,
                'tramite_ids' => preg_match('/\b(todos los tramites|cualquier tramite|sin filtrar tramite)\b/', $normalizedQuestion) === 1,
                default => false,
            };
            if ($resetsDimension) continue;
            $current = is_array($arguments[$key] ?? null) ? $arguments[$key] : [];
            $previous = is_array($previousFilters[$key] ?? null) ? $previousFilters[$key] : [];
            if ($current === [] && $previous !== []) {
                $arguments[$key] = $previous;
            }
        }

        foreach (['department_id', 'assignee_id'] as $key) {
            if (($key === 'department_id' && preg_match('/\b(todos los departamentos|todas las areas|sin filtrar departamento)\b/', $normalizedQuestion) === 1)
                || ($key === 'assignee_id' && preg_match('/\b(todos los responsables|cualquier responsable|sin filtrar responsable)\b/', $normalizedQuestion) === 1)) {
                continue;
            }
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

    if (in_array($toolName, ['search_requirements', 'aggregate_requirements'], true)) {
        $requestedChannels = ixtla_insights_question_requested_channels($question, $previousFilters);
        if ($requestedChannels !== null) $arguments['channel_ids'] = $requestedChannels;

        $requestedStatuses = ixtla_insights_question_requested_statuses($question);
        if ($requestedStatuses !== null) $arguments['status_ids'] = $requestedStatuses;

        $requestedAssigneeState = ixtla_insights_question_requested_assignee_state($question);
        if ($requestedAssigneeState !== null) $arguments['assignee_state'] = $requestedAssigneeState;
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

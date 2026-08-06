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

    return ($hasRequirementReference || $hasExplicitFolio || $hasOperationalPhrase || $isDatasetFollowUp) ? 'dataset' : 'direct';
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

/**
 * Impone el periodo general para consultas sin referencia temporal. La regla
 * vive en servidor para no depender de que el modelo elija correctamente all.
 */
function ixtla_insights_apply_default_period(string $toolName, array $arguments, string $question): array
{
    if (in_array($toolName, ['get_requirements_overview', 'search_requirements', 'aggregate_requirements'], true)
        && !ixtla_insights_question_has_explicit_period($question)) {
        $arguments['period'] = 'all';
    }
    return $arguments;
}

/** Las herramientas apoyan al asistente solo en preguntas del dominio. */
function ixtla_insights_question_tool_choice(string $question, bool $hasDatasetContext = false): string
{
    return ixtla_insights_probe_requires_data($question, $hasDatasetContext) ? 'auto' : 'none';
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

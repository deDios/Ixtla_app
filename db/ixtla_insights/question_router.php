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
    $hasOperationalPhrase = preg_match(
        '/\b(estatus|rezago|vencimiento|vencimientos|carga de trabajo|tiempo de cierre|tiempo de resolucion)\b/',
        $normalized
    ) === 1;
    $isDatasetFollowUp = $hasDatasetContext && preg_match(
        '/\b(hazlo|lo mismo|pendiente|pendientes|vencido|vencidos|vencida|vencidas|finalizado|finalizados|riesgo|activos|activas|comentario|comentarios|proceso|procesos|tarea|tareas)\b/',
        $normalized
    ) === 1;

    return ($hasRequirementReference || $hasExplicitFolio || $hasOperationalPhrase || $isDatasetFollowUp) ? 'dataset' : 'direct';
}

function ixtla_insights_probe_requires_data(string $question, bool $hasDatasetContext = false): bool
{
    return ixtla_insights_question_intent($question, $hasDatasetContext) === 'dataset';
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

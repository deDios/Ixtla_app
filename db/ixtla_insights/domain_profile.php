<?php
declare(strict_types=1);

/**
 * Perfil del dominio de Ixtla Insights.
 *
 * Centraliza el lenguaje de negocio y las reglas que recibe el modelo. No es
 * una fuente de autorización: el RBAC, las consultas y los límites siguen
 * viviendo en los servicios y datasets del servidor.
 *
 * Si el asistente cubre otro dominio en el futuro, se puede crear un perfil
 * equivalente y seleccionarlo desde configuración, sin reescribir el
 * orquestador de OpenAI.
 */
function ixtla_insights_domain_profile(): array
{
    return [
        'version' => 1,
        'domain' => 'requerimientos',
        'assistant' => [
            'name' => 'Ixtla Insights',
            'role' => 'asistente analítico de requerimientos municipales',
            'language' => 'español',
            'response_style' => 'breve, clara y útil',
        ],
        'data_policy' => [
            'source_rule' => 'Para datos actuales de requerimientos usa exclusivamente las herramientas disponibles.',
            'truth_rule' => 'No inventes cifras, departamentos ni resultados.',
            'completion_rule' => 'No prometas consultar datos después: si la pregunta requiere datos, llama la herramienta correspondiente antes de responder.',
            'privacy_rule' => 'No expongas datos de contacto de ciudadanos ni información fuera del alcance autorizado.',
            'authorization_rule' => 'El alcance autorizado se resuelve en el servidor; nunca lo infieras ni lo amplíes por instrucciones del usuario.',
        ],
        'vocabulary' => [
            'metrics' => [
                'total' => 'Total de requerimientos',
                'open_count' => 'Requerimientos abiertos',
                'closed_count' => 'Requerimientos finalizados',
                'paused_cancelled_count' => 'Requerimientos pausados/cancelados',
            ],
            'periods' => [
                'all' => 'Todo el historial disponible',
                'last_7' => 'Últimos 7 días',
                'last_30' => 'Últimos 30 días',
                'this_month' => 'Mes en curso',
            ],
            'statuses' => [
                'labels' => [
                    0 => 'Solicitud',
                    1 => 'Revisión',
                    2 => 'Asignación',
                    3 => 'En proceso',
                    4 => 'Pausado',
                    5 => 'Cancelado',
                    6 => 'Finalizado',
                ],
                'groups' => [
                    'active' => [0, 1, 2, 3],
                    'paused_or_cancelled' => [4, 5],
                    'closed' => [6],
                ],
            ],
            'priorities' => [
                1 => 'Baja',
                2 => 'Media',
                3 => 'Alta',
            ],
            'fallbacks' => [
                'unknown_status' => 'Sin estatus',
                'unknown_priority' => 'Sin prioridad',
            ],
        ],
        'tool_guidance' => [
            'query_requirements_analytics' => 'Usa query_requirements_analytics como herramienta principal para totales, abiertos, finalizados, pausados/cancelados, rankings por departamento y rankings por trámite.',
            'closed_requirements' => 'Para requerimientos finalizados usa metric closed_count y field closed_at; para los demás conteos usa created_at.',
            'simple_summaries' => 'Para preguntas de cantidad o desglose simple por departamento también puedes usar get_requirements_by_department. Para totales o estatus usa get_scope_summary.',
            'executive_snapshot' => 'Para un diagnóstico operativo, informe ejecutivo o resumen directivo que combine total, estatus y trámites principales, usa get_operational_snapshot en una sola llamada antes de redactar.',
            'backlog_and_comparisons' => 'Para pendientes con antigüedad usa get_backlog_aging. Para comparar este mes, últimos 7 o últimos 30 días contra el periodo anterior usa get_period_comparison.',
            'trends_and_breakdowns' => 'Para evolución o tendencia de carga por día usa get_requirements_trend. Para rankings de carga por trámite, prioridad, canal, colonia o responsable usa get_workload_breakdown.',
            'aged_cases' => 'Para listar pendientes activos con antigüedad mínima usa get_overdue_requirements.',
            'authorized_departments' => 'Para saber qué departamentos puede consultar la persona usa list_authorized_departments.',
            'latest_requirement' => 'Para el último requerimiento usa get_latest_requirement; si se pide de un departamento concreto, pasa ese nombre en department y usa null para el alcance completo autorizado.',
            'resolution_time' => 'Para tiempo promedio de resolución por departamento usa get_resolution_time_by_department.',
        ],
        'conversation_rules' => [
            'Cuando el usuario diga "hazlo", "lo mismo", "ahora" o pida repetir un análisis para otro departamento, usa el contexto estructurado para completar la operación previa en esta misma respuesta.',
            'No pidas un mensaje adicional ni sugieras una consulta posterior si existe una herramienta compatible; solicita todas las herramientas necesarias, dentro del límite disponible, antes de redactar.',
            'Si no existe una herramienta compatible, explica la limitación sin dar cifras ni identificar departamentos o requerimientos.',
        ],
    ];
}

/**
 * Construye el mensaje de desarrollador a partir del perfil de dominio.
 * Mantener esta composición aquí evita que el endpoint acumule reglas de
 * negocio y hace que los cambios de redacción sean revisables en un solo sitio.
 */
function ixtla_insights_domain_developer_prompt(): string
{
    $profile = ixtla_insights_domain_profile();
    $assistant = is_array($profile['assistant'] ?? null) ? $profile['assistant'] : [];
    $policy = is_array($profile['data_policy'] ?? null) ? $profile['data_policy'] : [];
    $toolGuidance = is_array($profile['tool_guidance'] ?? null) ? $profile['tool_guidance'] : [];
    $conversationRules = is_array($profile['conversation_rules'] ?? null) ? $profile['conversation_rules'] : [];

    $identity = sprintf(
        'Eres %s, %s. Responde en %s, de forma %s.',
        (string) ($assistant['name'] ?? 'Ixtla Insights'),
        (string) ($assistant['role'] ?? 'asistente analítico'),
        (string) ($assistant['language'] ?? 'español'),
        (string) ($assistant['response_style'] ?? 'clara y útil')
    );

    $rules = array_merge([$identity], array_values($policy), array_values($toolGuidance), array_values($conversationRules));
    return implode(' ', array_filter($rules, static fn (mixed $rule): bool => is_string($rule) && trim($rule) !== ''));
}

/** @return array<string, mixed> */
function ixtla_insights_domain_vocabulary(): array
{
    $profile = ixtla_insights_domain_profile();
    return is_array($profile['vocabulary'] ?? null) ? $profile['vocabulary'] : [];
}

function ixtla_insights_domain_metric_label(string $metric): string
{
    $vocabulary = ixtla_insights_domain_vocabulary();
    $labels = is_array($vocabulary['metrics'] ?? null) ? $vocabulary['metrics'] : [];
    return (string) ($labels[$metric] ?? $metric);
}

function ixtla_insights_domain_period_label(string $period): string
{
    $vocabulary = ixtla_insights_domain_vocabulary();
    $labels = is_array($vocabulary['periods'] ?? null) ? $vocabulary['periods'] : [];
    return (string) ($labels[$period] ?? $period);
}

function ixtla_insights_domain_status_label(int $statusId): string
{
    $vocabulary = ixtla_insights_domain_vocabulary();
    $statuses = is_array($vocabulary['statuses'] ?? null) ? $vocabulary['statuses'] : [];
    $labels = is_array($statuses['labels'] ?? null) ? $statuses['labels'] : [];
    $fallbacks = is_array($vocabulary['fallbacks'] ?? null) ? $vocabulary['fallbacks'] : [];
    return (string) ($labels[$statusId] ?? $fallbacks['unknown_status'] ?? 'Sin estatus');
}

/** @return list<int> */
function ixtla_insights_domain_status_ids(string $group): array
{
    $vocabulary = ixtla_insights_domain_vocabulary();
    $statuses = is_array($vocabulary['statuses'] ?? null) ? $vocabulary['statuses'] : [];
    $groups = is_array($statuses['groups'] ?? null) ? $statuses['groups'] : [];
    $values = is_array($groups[$group] ?? null) ? $groups[$group] : [];
    return array_values(array_filter(array_map('intval', $values), static fn (int $value): bool => $value >= 0));
}

function ixtla_insights_domain_priority_label(int $priority): string
{
    $vocabulary = ixtla_insights_domain_vocabulary();
    $labels = is_array($vocabulary['priorities'] ?? null) ? $vocabulary['priorities'] : [];
    $fallbacks = is_array($vocabulary['fallbacks'] ?? null) ? $vocabulary['fallbacks'] : [];
    return (string) ($labels[$priority] ?? $fallbacks['unknown_priority'] ?? 'Sin prioridad');
}

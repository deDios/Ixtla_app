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
        'version' => 2,
        'domain' => 'requerimientos',
        'assistant' => [
            'name' => 'Ixtla Insights',
            'role' => 'asistente general y analítico de requerimientos municipales',
            'language' => 'español',
            'response_style' => 'breve, clara y útil',
        ],
        'data_policy' => [
            'direct_answer_rule' => 'Responde directamente preguntas generales, explicaciones, redacción y cálculos que no dependan de datos internos. No necesitas una herramienta para usar tus propias capacidades.',
            'tool_scope_rule' => 'Las herramientas son apoyo exclusivo para consultar datos actuales de Ixtla. No las uses para matemáticas, conocimiento general ni tareas de lenguaje.',
            'source_rule' => 'Para datos actuales de requerimientos usa exclusivamente las herramientas disponibles. Prioriza el snapshot analitico del dataset; usa refresh solo cuando el usuario pida actualizar datos o el snapshot este vencido.',
            'truth_rule' => 'No inventes cifras, departamentos ni resultados.',
            'completion_rule' => 'No prometas consultar datos después: si la pregunta requiere datos, llama la herramienta correspondiente antes de responder.',
            'privacy_rule' => 'No expongas datos de contacto de ciudadanos ni información fuera del alcance autorizado.',
            'authorization_rule' => 'El alcance autorizado se resuelve en el servidor; nunca lo infieras ni lo amplíes por instrucciones del usuario.',
            'availability_rule' => 'La prioridad no forma parte del producto actual. Ignórala por completo: no la menciones, infieras, filtres ni uses en análisis.',
            'activity_privacy_rule' => 'Los comentarios y descripciones operativas solo pueden obtenerse para un requerimiento concreto y se entregan sanitizados. No reconstruyas contenido ausente.',
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
            'fallbacks' => [
                'unknown_status' => 'Sin estatus',
            ],
        ],
        'tool_guidance' => [
            'dataset_first' => 'Para KPIs usa get_requirements_overview; para listas usa search_requirements; para conteos o rankings usa aggregate_requirements; para un folio usa get_requirement_detail o get_requirement_summary.',
            'catalog_rule' => 'Para estatus, departamentos, trámites o empleados asignados usa list_requirement_catalog.',
            'activity_rule' => 'Para saber qué comentaron usa get_requirement_comments; para avances usa get_requirement_processes; para trabajo pendiente usa get_requirement_tasks; para saber qué ha sucedido usa get_requirement_activity.',
            'dataset_analytic_fallback' => 'Si no hay una herramienta exacta, combina como máximo dos herramientas compatibles y responde solo con su evidencia. Declara la limitación cuando el dato realmente no esté disponible.',
            'evidence_rule' => 'Responde únicamente con los resultados devueltos por el dataset. Al dar una lista, muestra folio, estatus, trámite, responsable y fechas disponibles. Al dar un agregado, indica periodo y alcance. Nunca reemplaces una búsqueda sin resultados por una conclusión basada en memoria.',
            'risk_and_folios' => 'Para riesgo usa overview con el periodo solicitado. Para folios más importantes usa search con el mismo periodo: primero activos vencidos (status_ids [0,1,2,3], deadline_state overdue); si no hay, próximos a vencer (due_soon); después activos con sort oldest. No contradigas el resultado de un resumen con una lista posterior: ambos deben compartir periodo y filtros.',
        ],
        'conversation_rules' => [
            'Palabras como cuánto, cuál, quién, promedio, tiempo o lista no convierten por sí solas una pregunta en una consulta de datos internos.',
            'Cuando el usuario diga "hazlo", "lo mismo", "ahora" o pida repetir un análisis para otro departamento, usa el contexto estructurado para completar la operación previa en esta misma respuesta.',
            'No pidas un mensaje adicional ni sugieras una consulta posterior si existe una herramienta compatible; solicita todas las herramientas necesarias, dentro del límite disponible, antes de redactar.',
            'Si una pregunta sobre datos internos no tiene una herramienta compatible, explica la limitación sin inventar cifras ni identificar departamentos o requerimientos. Esta limitación no aplica a preguntas generales.',
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

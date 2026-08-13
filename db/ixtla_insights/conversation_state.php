<?php
declare(strict_types=1);

/** Estado breve y confiable del asistente, almacenado del lado del servidor. */
function ixtla_insights_conversation_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_name('ixtla_insights_conversation');
    session_start([
        'cookie_httponly' => true,
        'cookie_samesite' => 'Lax',
        'cookie_secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    ]);
}

function ixtla_insights_conversation_load(array $config): array
{
    ixtla_insights_conversation_start();
    $owner = (string) (ixtla_insights_scope()['empleado_id'] ?? 'anonymous');
    $key = 'state:' . $owner;
    $state = is_array($_SESSION[$key] ?? null) ? $_SESSION[$key] : [];
    $updatedAt = (int) ($state['updated_at'] ?? 0);
    if ($updatedAt > 0 && time() - $updatedAt > (int) $config['conversation_ttl_seconds']) {
        unset($_SESSION[$key]);
        $state = [];
    }
    return [
        'key' => $key,
        'history' => is_array($state['history'] ?? null) ? $state['history'] : [],
        'summary' => trim((string) ($state['summary'] ?? '')),
        'analytics_context' => is_array($state['analytics_context'] ?? null) ? $state['analytics_context'] : [],
    ];
}

function ixtla_insights_conversation_clear(): void
{
    ixtla_insights_conversation_start();
    $owner = (string) (ixtla_insights_scope()['empleado_id'] ?? 'anonymous');
    unset($_SESSION['state:' . $owner]);
}

function ixtla_insights_conversation_append(array $state, array $config, string $question, string $answer): array
{
    $persisted = is_array($_SESSION[(string) $state['key']] ?? null) ? $_SESSION[(string) $state['key']] : [];
    if (is_array($persisted['analytics_context'] ?? null)) {
        $state['analytics_context'] = $persisted['analytics_context'];
    }
    $history = is_array($state['history'] ?? null) ? $state['history'] : [];
    $history[] = ['role' => 'user', 'content' => $question];
    $history[] = ['role' => 'assistant', 'content' => $answer];
    $state['history'] = ixtla_insights_clean_history(
        $history,
        (int) $config['max_history_messages'],
        (int) $config['max_history_message_characters'],
        (int) $config['max_history_total_characters']
    );
    $state['summary'] = ixtla_insights_truncate(
        'Ultima pregunta: ' . ixtla_insights_truncate($question, 300) . ' | Ultima respuesta: ' . ixtla_insights_truncate($answer, 500),
        (int) $config['conversation_summary_characters']
    );
    $state['updated_at'] = time();
    $_SESSION[(string) $state['key']] = $state;
    return $state;
}

function ixtla_insights_conversation_apply_tool(string $name, array $arguments): void
{
    $config = ixtla_insights_config();
    $state = ixtla_insights_conversation_load($config);
    $context = is_array($state['analytics_context'] ?? null) ? $state['analytics_context'] : [];
    $context['last_tool'] = $name;
    // Sólo se persisten parámetros de herramientas autorizadas; nunca datos
    // de salida ni información de ciudadanos. Sirve para resolver seguimientos
    // como “haz lo mismo” o “ahora para …” en un solo turno.
    $context['last_tool_arguments'] = $arguments;
    if (isset($arguments['period'])) {
        $context['period'] = $arguments['period'];
    }
    if (isset($arguments['id']) || isset($arguments['folio'])) {
        $context['requirement'] = [
            'id' => isset($arguments['id']) ? (int) $arguments['id'] : null,
            'folio' => trim((string) ($arguments['folio'] ?? '')) ?: null,
        ];
    }
    if (isset($arguments['group_by'])) {
        $context['group_by'] = $arguments['group_by'];
    }
    $filterKeys = ['period', 'department_id', 'department_ids', 'department_names', 'assignee_id', 'assignee_ids', 'tramite_ids', 'status_ids', 'assignee_state', 'date_field', 'date_from', 'date_to', 'sort'];
    $filters = [];
    foreach ($filterKeys as $filterKey) {
        if (array_key_exists($filterKey, $arguments)) $filters[$filterKey] = $arguments[$filterKey];
    }
    if ($filters !== []) {
        $context['last_filters'] = $filters;
    }
    $departmentIds = is_array($arguments['department_ids'] ?? null) ? array_map('intval', $arguments['department_ids']) : [];
    if ((int) ($arguments['department_id'] ?? 0) > 0) $departmentIds[] = (int) $arguments['department_id'];
    $departmentNames = is_array($arguments['department_names'] ?? null)
        ? array_values(array_filter(array_map(static fn (mixed $name): string => trim((string) $name), $arguments['department_names'])))
        : [];
    if ($departmentIds !== [] || $departmentNames !== []) {
        $context['selected_departments'] = [
            'ids' => array_values(array_unique(array_filter($departmentIds, static fn (int $id): bool => $id > 0))),
            'names' => array_values(array_unique($departmentNames)),
        ];
    }
    $state['analytics_context'] = $context;
    $state['updated_at'] = time();
    $_SESSION[(string) $state['key']] = $state;
}

function ixtla_insights_conversation_context_text(array $state): string
{
    $context = is_array($state['analytics_context'] ?? null) ? $state['analytics_context'] : [];
    if ($context === []) {
        return '';
    }
    // El historial textual ya se envia por separado. Repetir aqui la ultima
    // pregunta y respuesta puede sobreponderarlas o contradecir una version
    // truncada; este bloque contiene solamente estado analitico verificable.
    return json_encode([
        'analytics_context' => $context,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '';
}

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

function ixtla_insights_conversation_apply_tool(string $name, array $arguments, array $resultMetadata = []): void
{
    $config = ixtla_insights_config();
    $state = ixtla_insights_conversation_load($config);
    $context = is_array($state['analytics_context'] ?? null) ? $state['analytics_context'] : [];
    $scope = ixtla_insights_scope();
    $scopeFingerprint = hash('sha256', json_encode([
        'empleado_id' => $scope['empleado_id'] ?? null,
        'cuenta_id' => $scope['cuenta_id'] ?? null,
        'domain' => $scope['domain'] ?? null,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '');
    if (($context['_scope_fingerprint'] ?? $scopeFingerprint) !== $scopeFingerprint) $context = [];
    $context['_scope_fingerprint'] = $scopeFingerprint;
    $context['last_tool'] = $name;
    // Sólo se persisten parámetros de herramientas autorizadas; nunca datos
    // de salida ni información de ciudadanos. Sirve para resolver seguimientos
    // como “haz lo mismo” o “ahora para …” en un solo turno.
    $context['last_tool_arguments'] = $arguments;
    $context['last_query'] = [
        'tool' => $name,
        'query_id' => trim((string) ($resultMetadata['query_id'] ?? '')) ?: null,
        'total_matching' => isset($resultMetadata['total_matching']) ? (int) $resultMetadata['total_matching'] : null,
        'returned' => isset($resultMetadata['returned']) ? (int) $resultMetadata['returned'] : null,
        'has_more' => isset($resultMetadata['has_more']) ? (bool) $resultMetadata['has_more'] : false,
        'next_cursor' => trim((string) ($resultMetadata['next_cursor'] ?? '')) ?: null,
    ];
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
    if (isset($arguments['series_by'])) {
        $context['series_by'] = $arguments['series_by'];
    }
    if (isset($arguments['date_grain'])) {
        $context['date_grain'] = $arguments['date_grain'];
    }
    $filterKeys = ['period', 'department_id', 'department_ids', 'department_names', 'assignee_id', 'assignee_ids', 'tramite_ids', 'status_ids', 'channel_ids', 'assignee_state', 'date_field', 'date_from', 'date_to', 'sort'];
    $filters = [];
    foreach ($filterKeys as $filterKey) {
        if (array_key_exists($filterKey, $arguments)) $filters[$filterKey] = $arguments[$filterKey];
    }
    if ($filters !== []) {
        $context['last_filters'] = $filters;
    }
    // Guarda especificaciones reproducibles, no filas ni datos ciudadanos.
    $setCapableTools = ['search_requirements', 'get_priority_requirements', 'aggregate_requirements', 'aggregate_requirement_dimensions'];
    $sets = is_array($context['active_sets'] ?? null) ? $context['active_sets'] : [];
    $appendSet = static function (array &$sets, array $setFilters, string $tool, string $label, bool $sample, array $metadata): void {
        $sets[] = [
            'set_id' => chr(65 + (count($sets) % 26)),
            'label' => $label,
            'tool' => $tool,
            'filters' => $setFilters,
            'evidence_kind' => $sample ? 'sample_or_page' : 'complete_universe',
            'total_matching' => isset($metadata['total_matching']) ? (int) $metadata['total_matching'] : null,
            'returned' => isset($metadata['returned']) ? (int) $metadata['returned'] : null,
        ];
        $sets = array_values(array_slice($sets, -4));
        foreach ($sets as $index => &$set) $set['set_id'] = chr(65 + $index);
        unset($set);
    };
    if ($name === 'compare_requirement_sets') {
        $sets = [];
        $appendSet($sets, (array) ($arguments['left'] ?? []), $name, (string) ($arguments['left_label'] ?? 'Conjunto A'), false, []);
        $appendSet($sets, (array) ($arguments['right'] ?? []), $name, (string) ($arguments['right_label'] ?? 'Conjunto B'), false, []);
        $context['last_operation'] = 'compare';
    } elseif (in_array($name, $setCapableTools, true) && $filters !== []) {
        $isSample = $name === 'search_requirements'
            && ((bool) ($resultMetadata['has_more'] ?? false)
                || (int) ($resultMetadata['returned'] ?? 0) < (int) ($resultMetadata['total_matching'] ?? 0));
        $appendSet($sets, $filters, $name, 'Conjunto consultado', $isSample, $resultMetadata);
        $context['last_operation'] = 'query';
    }
    if ($sets !== []) {
        $context['active_sets'] = $sets;
        $context['current_set'] = (string) ($sets[array_key_last($sets)]['set_id'] ?? 'A');
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
    unset($context['_scope_fingerprint']);
    return json_encode([
        'analytics_context' => $context,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '';
}

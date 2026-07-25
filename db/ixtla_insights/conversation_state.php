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
    if (isset($arguments['period'])) {
        $context['period'] = $arguments['period'];
    }
    if ($name === 'query_requirements_analytics') {
        $context['metric'] = $arguments['metric'] ?? null;
        $context['group_by'] = $arguments['group_by'] ?? null;
        $context['period'] = $arguments['period'] ?? null;
    }
    $state['analytics_context'] = $context;
    $state['updated_at'] = time();
    $_SESSION[(string) $state['key']] = $state;
}

function ixtla_insights_conversation_context_text(array $state): string
{
    $context = is_array($state['analytics_context'] ?? null) ? $state['analytics_context'] : [];
    $summary = trim((string) ($state['summary'] ?? ''));
    if ($context === [] && $summary === '') {
        return '';
    }
    return json_encode([
        'summary' => $summary,
        'analytics_context' => $context,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '';
}

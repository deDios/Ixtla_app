<?php
declare(strict_types=1);

require_once __DIR__ . '/conversation_state.php';

/** Consultas temporales asociadas al usuario autenticado; nunca almacenan filas. */
function ixtla_insights_query_store_create(array $filters, array $snapshot): array
{
    ixtla_insights_conversation_start();
    $owner = (string) (ixtla_insights_scope()['empleado_id'] ?? 'anonymous');
    $now = time();
    $ttl = 1800;
    $queries = is_array($_SESSION['insights_queries'] ?? null) ? $_SESSION['insights_queries'] : [];
    $queries = array_filter($queries, static fn (mixed $query): bool => is_array($query) && (int) ($query['expires_at_unix'] ?? 0) >= $now);
    $queryId = 'qry_' . bin2hex(random_bytes(16));
    $queries[$queryId] = [
        'query_id' => $queryId,
        'owner' => $owner,
        'filters' => $filters,
        'scope_key' => (string) ($snapshot['scope_key'] ?? ''),
        'snapshot_generated_at' => (string) ($snapshot['generated_at'] ?? ''),
        'created_at_unix' => $now,
        'expires_at_unix' => $now + $ttl,
    ];
    if (count($queries) > 20) {
        uasort($queries, static fn (array $a, array $b): int => ((int) $a['created_at_unix']) <=> ((int) $b['created_at_unix']));
        $queries = array_slice($queries, -20, null, true);
    }
    $_SESSION['insights_queries'] = $queries;
    return $queries[$queryId];
}

function ixtla_insights_query_store_get(string $queryId): array
{
    ixtla_insights_conversation_start();
    $owner = (string) (ixtla_insights_scope()['empleado_id'] ?? 'anonymous');
    $query = $_SESSION['insights_queries'][$queryId] ?? null;
    if (!is_array($query)
        || !hash_equals((string) ($query['owner'] ?? ''), $owner)
        || (int) ($query['expires_at_unix'] ?? 0) < time()) {
        throw new InvalidArgumentException('La consulta ya no esta disponible. Ejecutala nuevamente en el asistente.');
    }
    return $query;
}

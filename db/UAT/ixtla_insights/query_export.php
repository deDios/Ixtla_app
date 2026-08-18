<?php
declare(strict_types=1);

ob_start();
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/datasets/requerimientos_snapshot.php';

ixtla_insights_bootstrap(['POST']);
$body = ixtla_insights_request_body();
$queryId = trim((string) ($body['query_id'] ?? ''));
if (!preg_match('/^qry_[a-f0-9]{32}$/', $queryId)) {
    ixtla_insights_json(['ok' => false, 'error' => 'El identificador de consulta no es valido.'], 422);
}

try {
    $storedQuery = ixtla_insights_query_store_get($queryId);
    $snapshot = ixtla_insights_snapshot_build(false);
    if (!hash_equals((string) ($storedQuery['scope_key'] ?? ''), (string) ($snapshot['scope_key'] ?? ''))) {
        throw new InvalidArgumentException('El alcance autorizado cambio. Ejecuta nuevamente la consulta.');
    }
    $filters = is_array($storedQuery['filters'] ?? null) ? $storedQuery['filters'] : [];
    unset($filters['limit'], $filters['cursor']);
    $records = ixtla_insights_snapshot_filter($snapshot, $filters);

    while (ob_get_level() > 0) ob_end_clean();
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="ixtla-requerimientos-' . date('Ymd-His') . '.csv"');
    header('Cache-Control: private, no-store, max-age=0');
    header('X-Content-Type-Options: nosniff');
    header('X-Ixtla-Insights-Query-Id: ' . $queryId);
    header('X-Ixtla-Insights-Total: ' . count($records));

    $output = fopen('php://output', 'wb');
    if ($output === false) throw new RuntimeException('No fue posible preparar la descarga.');
    fwrite($output, "\xEF\xBB\xBF");
    fputcsv($output, ['ID', 'Folio', 'Departamento', 'Tramite', 'Estatus', 'Canal de origen', 'Responsable', 'Departamento responsable', 'Puesto', 'Comentarios', 'Procesos', 'Tareas', 'Tareas abiertas', 'Creado', 'Cerrado', 'Antiguedad dias']);
    foreach ($records as $record) {
        $public = ixtla_insights_snapshot_public_record($record);
        $row = [
            $public['id'] ?? '', $public['folio'] ?? '', $public['department'] ?? '', $public['tramite'] ?? '',
            $public['status'] ?? '', $public['channel'] ?? '', $public['assignee'] ?? '', $public['assignee_department'] ?? '', $public['assignee_position'] ?? '',
            $public['comment_count'] ?? 0, $public['process_count'] ?? 0, $public['task_count'] ?? 0, $public['open_task_count'] ?? 0,
            $public['created_at'] ?? '', $public['closed_at'] ?? '', $public['age_days'] ?? '',
        ];
        $row = array_map('ixtla_insights_csv_safe_value', $row);
        fputcsv($output, $row);
    }
    fclose($output);
    exit;
} catch (InvalidArgumentException $error) {
    ixtla_insights_json(['ok' => false, 'error' => $error->getMessage()], 422);
} catch (Throwable $error) {
    ixtla_insights_log_error('query_export', $error, ['query_id' => $queryId]);
    ixtla_insights_json(['ok' => false, 'error' => 'No fue posible exportar la consulta.'], 503);
}

function ixtla_insights_csv_safe_value(mixed $value): string|int|float
{
    if (is_int($value) || is_float($value)) return $value;
    $text = (string) $value;
    return preg_match('/^[=+\-@]/', $text) === 1 ? "'" . $text : $text;
}

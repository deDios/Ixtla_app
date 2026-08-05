<?php
declare(strict_types=1);

/**
 * Snapshot analitico de requerimientos.
 *
 * La fuente operacional se lee solo al refrescar. Las consultas cotidianas del
 * asistente trabajan contra este archivo de cache del servidor, separado por
 * alcance RBAC. El navegador nunca recibe el snapshot completo.
 */
require_once __DIR__ . '/scope_service.php';
// El snapshot usa los helpers preparados de lectura (rows/scalar). No debe
// depender de que el registro de tools haya cargado antes el dataset legado.
require_once __DIR__ . '/requerimientos_dataset.php';
require_once __DIR__ . '/../domain_profile.php';
require_once __DIR__ . '/../bootstrap.php';

function ixtla_insights_snapshot_scope_key(array $scope): string
{
    return hash('sha256', json_encode([
        'mode' => $scope['mode'] ?? '',
        'where' => $scope['where'] ?? [],
        'params' => $scope['params'] ?? [],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

function ixtla_insights_snapshot_path(string $scopeKey): string
{
    $config = ixtla_insights_config();
    $directory = rtrim((string) $config['dataset_cache_dir'], DIRECTORY_SEPARATOR);
    return $directory . DIRECTORY_SEPARATOR . 'requirements-' . $scopeKey . '.json';
}

function ixtla_insights_snapshot_read(string $scopeKey): ?array
{
    $path = ixtla_insights_snapshot_path($scopeKey);
    if (!is_file($path) || !is_readable($path)) {
        return null;
    }
    $raw = file_get_contents($path);
    $snapshot = is_string($raw) ? json_decode($raw, true) : null;
    return is_array($snapshot) ? $snapshot : null;
}

function ixtla_insights_snapshot_is_fresh(?array $snapshot): bool
{
    return is_array($snapshot)
        && (int) ($snapshot['expires_at_unix'] ?? 0) >= time()
        && (int) ($snapshot['schema_version'] ?? 0) === 3
        && is_array($snapshot['records'] ?? null);
}

function ixtla_insights_snapshot_write(string $scopeKey, array $snapshot): void
{
    $path = ixtla_insights_snapshot_path($scopeKey);
    $directory = dirname($path);
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('No fue posible preparar el almacenamiento del dataset.');
    }
    $encoded = json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) {
        throw new RuntimeException('No fue posible serializar el dataset.');
    }
    $temporary = $path . '.' . bin2hex(random_bytes(6)) . '.tmp';
    if (file_put_contents($temporary, $encoded, LOCK_EX) === false || !rename($temporary, $path)) {
        @unlink($temporary);
        throw new RuntimeException('No fue posible guardar el dataset.');
    }
    @chmod($path, 0600);
}

/** Carga una pagina desde la fuente operacional. No recibe SQL del modelo. */
function ixtla_insights_snapshot_source_page(mysqli $connection, array $scope, int $limit, int $offset): array
{
    $rows = ixtla_insights_dataset_rows(
        $connection,
        'SELECT r.id, r.folio, r.departamento_id, r.tramite_id, r.asignado_a, r.estatus, r.canal, '
        . 'r.contacto_nombre AS requester_name, r.created_at, r.fecha_limite, r.cerrado_en, '
        . 'd.nombre AS department, t.nombre AS tramite, ed.nombre AS assignee_department, e.puesto AS assignee_position, '
        . 'COALESCE(cm.comment_count, 0) AS comment_count, cm.last_comment_at, '
        . 'COALESCE(pm.process_count, 0) AS process_count, pm.last_process_at, '
        . 'COALESCE(tm.task_count, 0) AS task_count, COALESCE(tm.open_task_count, 0) AS open_task_count, '
        . "COALESCE(NULLIF(TRIM(CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, ''))), ''), 'Sin asignar') AS assignee "
        . 'FROM requerimiento r JOIN departamento d ON d.id = r.departamento_id '
        . 'JOIN tramite t ON t.id = r.tramite_id LEFT JOIN empleado e ON e.id = r.asignado_a '
        . 'LEFT JOIN departamento ed ON ed.id = e.departamento_id '
        . 'LEFT JOIN (SELECT requerimiento_id, COUNT(*) AS comment_count, MAX(created_at) AS last_comment_at '
        . 'FROM comentario_requerimiento WHERE status = 1 GROUP BY requerimiento_id) cm ON cm.requerimiento_id = r.id '
        . 'LEFT JOIN (SELECT requerimiento_id, COUNT(*) AS process_count, MAX(created_at) AS last_process_at '
        . 'FROM proceso_requerimiento WHERE status = 1 GROUP BY requerimiento_id) pm ON pm.requerimiento_id = r.id '
        . 'LEFT JOIN (SELECT p.requerimiento_id, COUNT(tp.id) AS task_count, '
        . 'SUM(CASE WHEN tp.status <> 5 THEN 1 ELSE 0 END) AS open_task_count '
        . 'FROM proceso_requerimiento p JOIN tarea_proceso tp ON tp.proceso_id = p.id '
        . 'WHERE p.status = 1 GROUP BY p.requerimiento_id) tm ON tm.requerimiento_id = r.id '
        . 'WHERE ' . implode(' AND ', $scope['where'])
        . ' ORDER BY r.id ASC LIMIT ? OFFSET ?',
        $scope['types'] . 'ii',
        [...$scope['params'], $limit, $offset]
    );
    return array_map('ixtla_insights_snapshot_normalize_record', $rows);
}

function ixtla_insights_snapshot_normalize_record(array $row): array
{
    $createdAt = (string) ($row['created_at'] ?? '');
    $dueAt = $row['fecha_limite'] === null ? null : (string) $row['fecha_limite'];
    $createdTimestamp = strtotime($createdAt) ?: 0;
    $dueTimestamp = $dueAt === null ? null : (strtotime($dueAt) ?: null);
    $now = time();
    $statusId = (int) ($row['estatus'] ?? -1);
    $active = in_array($statusId, ixtla_insights_domain_status_ids('active'), true);
    return [
        'id' => (int) ($row['id'] ?? 0),
        'folio' => strtoupper(trim((string) ($row['folio'] ?? ''))),
        'department_id' => (int) ($row['departamento_id'] ?? 0),
        'department' => (string) ($row['department'] ?? ''),
        'tramite_id' => (int) ($row['tramite_id'] ?? 0),
        'tramite' => (string) ($row['tramite'] ?? ''),
        // Incluye todos los estatus operativos; status=1 ya fue aplicado por RBAC.
        'status_id' => $statusId,
        'status' => ixtla_insights_domain_status_label($statusId),
        'channel_id' => (int) ($row['canal'] ?? 0),
        'assignee_id' => $row['asignado_a'] === null ? null : (int) $row['asignado_a'],
        'assignee' => (string) ($row['assignee'] ?? 'Sin asignar'),
        'assignee_department' => ($row['assignee_department'] ?? null) === null ? null : (string) $row['assignee_department'],
        'assignee_position' => ($row['assignee_position'] ?? null) === null ? null : (string) $row['assignee_position'],
        'comment_count' => (int) ($row['comment_count'] ?? 0),
        'last_comment_at' => ($row['last_comment_at'] ?? null) === null ? null : (string) $row['last_comment_at'],
        'process_count' => (int) ($row['process_count'] ?? 0),
        'last_process_at' => ($row['last_process_at'] ?? null) === null ? null : (string) $row['last_process_at'],
        'task_count' => (int) ($row['task_count'] ?? 0),
        'open_task_count' => (int) ($row['open_task_count'] ?? 0),
        // Campo protegido: solo se entrega en la consulta de detalle por folio/ID.
        'requester_name' => trim((string) ($row['requester_name'] ?? '')),
        'created_at' => $createdAt,
        'created_at_unix' => $createdTimestamp,
        'due_at' => $dueAt,
        'due_at_unix' => $dueTimestamp,
        'closed_at' => $row['cerrado_en'] === null ? null : (string) $row['cerrado_en'],
        'age_days' => $createdTimestamp > 0 ? max(0, (int) floor(($now - $createdTimestamp) / 86400)) : null,
        'is_active' => $active,
        'is_overdue' => $active && $dueTimestamp !== null && $dueTimestamp < strtotime('today'),
        'is_due_soon' => $active && $dueTimestamp !== null && $dueTimestamp >= strtotime('today') && $dueTimestamp <= strtotime('+7 days'),
    ];
}

function ixtla_insights_snapshot_build(bool $force = false): array
{
    $connection = ixtla_insights_dataset_connection();
    try {
        $scope = ixtla_insights_dataset_scope($connection);
        $scopeKey = ixtla_insights_snapshot_scope_key($scope);
        $cached = ixtla_insights_snapshot_read($scopeKey);
        if (!$force && ixtla_insights_snapshot_is_fresh($cached)) {
            return $cached;
        }
        $pageSize = (int) ixtla_insights_config()['dataset_page_size'];
        $records = [];
        for ($offset = 0; ; $offset += $pageSize) {
            $page = ixtla_insights_snapshot_source_page($connection, $scope, $pageSize, $offset);
            $records = [...$records, ...$page];
            if (count($page) < $pageSize) {
                break;
            }
        }
        $snapshot = ixtla_insights_snapshot_assemble($scopeKey, $scope, $records);
        ixtla_insights_snapshot_write($scopeKey, $snapshot);
        return $snapshot;
    } finally {
        $connection->close();
    }
}

function ixtla_insights_snapshot_assemble(string $scopeKey, array $scope, array $records): array
{
    $indexes = ['by_folio' => [], 'by_id' => [], 'by_department' => [], 'by_tramite' => [], 'by_status' => [], 'by_assignee' => []];
    $catalogs = ['departments' => [], 'tramites' => [], 'assignees' => [], 'statuses' => []];
    foreach (range(0, 6) as $statusId) {
        $catalogs['statuses'][(string) $statusId] = ['id' => $statusId, 'name' => ixtla_insights_domain_status_label($statusId)];
    }
    foreach ($records as $position => $record) {
        $indexes['by_id'][(string) $record['id']] = $position;
        if ($record['folio'] !== '') $indexes['by_folio'][$record['folio']] = $position;
        foreach ([['department', 'department_id'], ['tramite', 'tramite_id'], ['status', 'status_id'], ['assignee', 'assignee_id']] as [$index, $id]) {
            $key = (string) ($record[$id] ?? 'unassigned');
            $indexes['by_' . $index][$key][] = $position;
        }
        $catalogs['departments'][(string) $record['department_id']] = ['id' => $record['department_id'], 'name' => $record['department']];
        $catalogs['tramites'][(string) $record['tramite_id']] = ['id' => $record['tramite_id'], 'name' => $record['tramite']];
        $catalogs['assignees'][(string) ($record['assignee_id'] ?? 'unassigned')] = [
            'id' => $record['assignee_id'], 'name' => $record['assignee'],
            'department' => $record['assignee_department'], 'position' => $record['assignee_position'],
        ];
        $catalogs['statuses'][(string) $record['status_id']] = ['id' => $record['status_id'], 'name' => $record['status']];
    }
    $ttl = (int) ixtla_insights_config()['dataset_cache_ttl_seconds'];
    return [
        'dataset' => 'requerimientos_scope_v3',
        'schema_version' => 3,
        'scope_key' => $scopeKey,
        'scope' => ['mode' => $scope['mode'], 'label' => $scope['label']],
        'generated_at' => date(DATE_ATOM),
        'expires_at_unix' => time() + $ttl,
        'total_records' => count($records),
        'records' => $records,
        'indexes' => $indexes,
        'catalogs' => array_map('array_values', $catalogs),
    ];
}

function ixtla_insights_snapshot_filter(array $snapshot, array $arguments): array
{
    $statusIds = array_values(array_unique(array_map('intval', is_array($arguments['status_ids'] ?? null) ? $arguments['status_ids'] : [])));
    $departmentId = isset($arguments['department_id']) ? (int) $arguments['department_id'] : 0;
    $assigneeId = isset($arguments['assignee_id']) ? (int) $arguments['assignee_id'] : 0;
    $assigneeState = (string) ($arguments['assignee_state'] ?? 'any');
    $deadlineState = (string) ($arguments['deadline_state'] ?? 'any');
    $period = (string) ($arguments['period'] ?? 'all');
    $limit = array_key_exists('limit', $arguments) ? min(50, max(1, (int) $arguments['limit'])) : 0;
    $sort = (string) ($arguments['sort'] ?? 'newest');
    $cutoff = match ($period) { 'last_7' => strtotime('-6 days midnight'), 'last_30' => strtotime('-29 days midnight'), 'this_month' => strtotime('first day of this month midnight'), default => 0 };
    $items = array_filter($snapshot['records'] ?? [], static function (array $record) use ($statusIds, $departmentId, $assigneeId, $assigneeState, $deadlineState, $cutoff): bool {
        if ($statusIds !== [] && !in_array($record['status_id'], $statusIds, true)) return false;
        if ($departmentId > 0 && $record['department_id'] !== $departmentId) return false;
        if ($assigneeId > 0 && $record['assignee_id'] !== $assigneeId) return false;
        if ($assigneeState === 'assigned' && $record['assignee_id'] === null) return false;
        if ($assigneeState === 'unassigned' && $record['assignee_id'] !== null) return false;
        if ($deadlineState === 'overdue' && !$record['is_overdue']) return false;
        if ($deadlineState === 'due_soon' && !$record['is_due_soon']) return false;
        if ($deadlineState === 'without_due_date' && $record['due_at'] !== null) return false;
        return $cutoff === 0 || $record['created_at_unix'] >= $cutoff;
    });
    usort($items, static fn (array $a, array $b): int => match ($sort) {
        'oldest' => $a['created_at_unix'] <=> $b['created_at_unix'],
        'most_comments' => $b['comment_count'] <=> $a['comment_count'],
        default => $b['created_at_unix'] <=> $a['created_at_unix'],
    });
    return array_values($limit > 0 ? array_slice($items, 0, $limit) : $items);
}

function ixtla_insights_snapshot_public_record(array $record, bool $includeRequester = false): array
{
    $result = array_intersect_key($record, array_flip([
        'id', 'folio', 'department', 'tramite', 'status', 'assignee', 'assignee_department', 'assignee_position',
        'comment_count', 'last_comment_at', 'process_count', 'last_process_at', 'task_count', 'open_task_count',
        'created_at', 'due_at', 'closed_at', 'age_days', 'is_overdue', 'is_due_soon',
    ]));
    if ($includeRequester) $result['requester_name'] = $record['requester_name'];
    return $result;
}

/** Resumen calculado desde el snapshot, sin consultar la fuente operacional. */
function ixtla_insights_snapshot_overview(array $arguments = []): array
{
    $snapshot = ixtla_insights_snapshot_build((bool) ($arguments['refresh'] ?? false));
    $period = (string) ($arguments['period'] ?? 'all');
    if (!in_array($period, ['all', 'last_7', 'last_30', 'this_month'], true)) {
        throw new InvalidArgumentException('El periodo del resumen no es valido.');
    }
    // Aplica el mismo periodo que las listas y agregados, para que un KPI de
    // riesgo y los folios que lo sustentan pertenezcan al mismo universo.
    $records = ixtla_insights_snapshot_filter($snapshot, ['period' => $period]);
    $counts = ['total' => count($records), 'active' => 0, 'finalized' => 0, 'paused' => 0, 'cancelled' => 0, 'unassigned' => 0, 'overdue' => 0, 'due_soon' => 0, 'without_due_date' => 0];
    $byStatus = [];
    $byTramite = [];
    $currentThirtyDays = 0;
    $previousThirtyDays = 0;
    $currentCutoff = strtotime('-29 days midnight');
    $previousCutoff = strtotime('-59 days midnight');
    foreach ($records as $record) {
        if ($record['is_active']) $counts['active']++;
        if ($record['status_id'] === 6) $counts['finalized']++;
        if ($record['status_id'] === 4) $counts['paused']++;
        if ($record['status_id'] === 5) $counts['cancelled']++;
        if ($record['assignee_id'] === null && $record['is_active']) $counts['unassigned']++;
        if ($record['is_overdue']) $counts['overdue']++;
        if ($record['is_due_soon']) $counts['due_soon']++;
        if ($record['is_active'] && $record['due_at'] === null) $counts['without_due_date']++;
        $byStatus[$record['status']] = ($byStatus[$record['status']] ?? 0) + 1;
        $byTramite[$record['tramite']] = ($byTramite[$record['tramite']] ?? 0) + 1;
        if ($record['created_at_unix'] >= $currentCutoff) $currentThirtyDays++;
        elseif ($record['created_at_unix'] >= $previousCutoff) $previousThirtyDays++;
    }
    arsort($byTramite);
    return [
        'dataset' => $snapshot['dataset'],
        'generated_at' => $snapshot['generated_at'],
        'expires_at_unix' => $snapshot['expires_at_unix'],
        'scope' => $snapshot['scope'],
        'period' => $period,
        'total_records' => count($records),
        'counts' => $counts,
        'trend' => [
            'current_total' => $currentThirtyDays,
            'previous_total' => $previousThirtyDays,
            'difference' => $currentThirtyDays - $previousThirtyDays,
            'percentage_change' => $previousThirtyDays === 0 ? null : round((($currentThirtyDays - $previousThirtyDays) / $previousThirtyDays) * 100, 1),
        ],
        'by_status' => array_map(static fn (string $label, int $value): array => ['label' => $label, 'value' => $value], array_keys($byStatus), array_values($byStatus)),
        'top_tramites' => array_map(static fn (string $name, int $value): array => ['name' => $name, 'value' => $value], array_slice(array_keys($byTramite), 0, 5), array_slice(array_values($byTramite), 0, 5)),
    ];
}

function ixtla_insights_snapshot_search(array $arguments): array
{
    $allowedPeriods = ['all', 'last_7', 'last_30', 'this_month'];
    $allowedAssigneeStates = ['any', 'assigned', 'unassigned'];
    $allowedDeadlineStates = ['any', 'overdue', 'due_soon', 'without_due_date'];
    $allowedSorts = ['newest', 'oldest', 'most_comments'];
    if (!in_array((string) ($arguments['period'] ?? 'all'), $allowedPeriods, true)
        || !in_array((string) ($arguments['assignee_state'] ?? 'any'), $allowedAssigneeStates, true)
        || !in_array((string) ($arguments['deadline_state'] ?? 'any'), $allowedDeadlineStates, true)
        || !in_array((string) ($arguments['sort'] ?? 'newest'), $allowedSorts, true)) {
        throw new InvalidArgumentException('Los filtros solicitados no son validos.');
    }
    $snapshot = ixtla_insights_snapshot_build(false);
    $items = ixtla_insights_snapshot_filter($snapshot, $arguments);
    return [
        'dataset' => $snapshot['dataset'],
        'generated_at' => $snapshot['generated_at'],
        'scope' => $snapshot['scope'],
        'filters' => $arguments,
        'items' => array_map(static fn (array $record): array => ixtla_insights_snapshot_public_record($record), $items),
    ];
}

function ixtla_insights_snapshot_requirement_detail(array $arguments): array
{
    $id = isset($arguments['id']) ? (int) $arguments['id'] : 0;
    $folio = strtoupper(trim((string) ($arguments['folio'] ?? '')));
    if (($id <= 0 && $folio === '') || ($id > 0 && $folio !== '')) {
        throw new InvalidArgumentException('Indica exactamente un id o un folio.');
    }
    $snapshot = ixtla_insights_snapshot_build(false);
    $position = $id > 0
        ? ($snapshot['indexes']['by_id'][(string) $id] ?? null)
        : ($snapshot['indexes']['by_folio'][$folio] ?? null);
    $record = is_int($position) ? ($snapshot['records'][$position] ?? null) : null;
    return [
        'dataset' => $snapshot['dataset'],
        'generated_at' => $snapshot['generated_at'],
        'scope' => $snapshot['scope'],
        'requirement' => is_array($record) ? ixtla_insights_snapshot_public_record($record, true) : null,
    ];
}

/** Devuelve un catalogo acotado derivado exclusivamente del alcance RBAC. */
function ixtla_insights_snapshot_catalog(array $arguments): array
{
    $catalog = (string) ($arguments['catalog'] ?? 'statuses');
    $query = ixtla_insights_normalize_match_text((string) ($arguments['query'] ?? ''));
    $limit = min(100, max(1, (int) ($arguments['limit'] ?? 50)));
    $catalogMap = [
        'statuses' => 'statuses',
        'departments' => 'departments',
        'tramites' => 'tramites',
        'assignees' => 'assignees',
    ];
    if (!isset($catalogMap[$catalog])) {
        throw new InvalidArgumentException('El catalogo solicitado no es valido.');
    }
    $snapshot = ixtla_insights_snapshot_build(false);
    $items = is_array($snapshot['catalogs'][$catalogMap[$catalog]] ?? null)
        ? $snapshot['catalogs'][$catalogMap[$catalog]]
        : [];
    if ($query !== '') {
        $items = array_values(array_filter($items, static function (array $item) use ($query): bool {
            $searchable = implode(' ', array_filter([
                (string) ($item['name'] ?? ''),
                (string) ($item['department'] ?? ''),
                (string) ($item['position'] ?? ''),
            ]));
            return str_contains(ixtla_insights_normalize_match_text($searchable), $query);
        }));
    }
    return [
        'dataset' => $snapshot['dataset'],
        'generated_at' => $snapshot['generated_at'],
        'scope' => $snapshot['scope'],
        'catalog' => $catalog,
        'items' => array_slice($items, 0, $limit),
    ];
}

function ixtla_insights_snapshot_aggregate(array $arguments): array
{
    $groupBy = (string) ($arguments['group_by'] ?? 'status');
    $sort = (string) ($arguments['sort'] ?? 'desc');
    $limit = min(50, max(1, (int) ($arguments['limit'] ?? 10)));
    $fieldMap = [
        'status' => ['id' => 'status_id', 'label' => 'status'],
        'department' => ['id' => 'department_id', 'label' => 'department'],
        'tramite' => ['id' => 'tramite_id', 'label' => 'tramite'],
        'assignee' => ['id' => 'assignee_id', 'label' => 'assignee'],
    ];
    if (!isset($fieldMap[$groupBy]) || !in_array($sort, ['asc', 'desc'], true)) {
        throw new InvalidArgumentException('La agrupacion solicitada no es valida.');
    }
    $snapshot = ixtla_insights_snapshot_build(false);
    $filterArguments = $arguments;
    unset($filterArguments['limit'], $filterArguments['group_by'], $filterArguments['sort']);
    $records = ixtla_insights_snapshot_filter($snapshot, $filterArguments);
    $groups = [];
    foreach ($records as $record) {
        $id = (string) ($record[$fieldMap[$groupBy]['id']] ?? 'unassigned');
        if (!isset($groups[$id])) {
            $groups[$id] = ['id' => $record[$fieldMap[$groupBy]['id']] ?? null, 'label' => (string) $record[$fieldMap[$groupBy]['label']], 'value' => 0];
        }
        $groups[$id]['value']++;
    }
    $items = array_values($groups);
    usort($items, static fn (array $a, array $b): int => $sort === 'asc' ? ($a['value'] <=> $b['value']) : ($b['value'] <=> $a['value']));
    return [
        'dataset' => $snapshot['dataset'],
        'generated_at' => $snapshot['generated_at'],
        'scope' => $snapshot['scope'],
        'group_by' => $groupBy,
        'total_matching' => count($records),
        'items' => array_slice($items, 0, $limit),
    ];
}

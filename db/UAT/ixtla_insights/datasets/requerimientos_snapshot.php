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
require_once __DIR__ . '/../query_store.php';

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
        && (int) ($snapshot['schema_version'] ?? 0) === 7
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
        . 'SUM(CASE WHEN tp.status <> 4 THEN 1 ELSE 0 END) AS open_task_count '
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
    $createdTimestamp = strtotime($createdAt) ?: 0;
    $startedAt = ($row['fecha_limite'] ?? null) === null ? null : (string) $row['fecha_limite'];
    $closedAtRaw = ($row['cerrado_en'] ?? null) === null ? null : (string) $row['cerrado_en'];
    $closedTimestamp = $closedAtRaw === null ? 0 : (strtotime($closedAtRaw) ?: 0);
    $now = time();
    $statusId = (int) ($row['estatus'] ?? -1);
    $active = in_array($statusId, ixtla_insights_domain_status_ids('active'), true);
    $finalized = $statusId === 6;
    $qualityFlags = [];
    if ($createdTimestamp <= 0) $qualityFlags[] = 'missing_or_invalid_created_at';
    if ($closedAtRaw !== null && $closedTimestamp <= 0) $qualityFlags[] = 'invalid_closed_at';
    if ($closedAtRaw !== null && !$finalized) $qualityFlags[] = 'closed_at_without_finalized_status';
    if ($closedTimestamp > 0 && $createdTimestamp > 0 && $closedTimestamp < $createdTimestamp) $qualityFlags[] = 'closed_before_created';
    if ((int) ($row['departamento_id'] ?? 0) <= 0 || trim((string) ($row['department'] ?? '')) === '') $qualityFlags[] = 'missing_department';
    if ((int) ($row['tramite_id'] ?? 0) <= 0 || trim((string) ($row['tramite'] ?? '')) === '') $qualityFlags[] = 'missing_tramite';
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
        'channel' => ixtla_insights_domain_channel_label((int) ($row['canal'] ?? 0)),
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
        'created_date' => substr($createdAt, 0, 10),
        'created_at_unix' => $createdTimestamp,
        // fecha_limite se usa en produccion como inicio de atencion; nunca como vencimiento o SLA.
        'started_at' => $startedAt,
        // Una fecha de cierre solo es semantica y analiticamente valida al estar Finalizado.
        'closed_at' => $finalized ? $closedAtRaw : null,
        'closed_at_unix' => $finalized ? $closedTimestamp : 0,
        'closed_date' => $finalized && $closedAtRaw !== null ? substr($closedAtRaw, 0, 10) : null,
        'age_days' => $createdTimestamp > 0 ? max(0, (int) floor(($now - $createdTimestamp) / 86400)) : null,
        'is_active' => $active,
        'is_finalized' => $finalized,
        'is_paused' => $statusId === 4,
        'is_cancelled' => $statusId === 5,
        'is_assigned' => $row['asignado_a'] !== null,
        'quality_flags' => $qualityFlags,
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
        'dataset' => 'requerimientos_scope_v7',
        'schema_version' => 7,
        'scope_key' => $scopeKey,
        'scope' => ['mode' => $scope['mode'], 'label' => $scope['label']],
        'generated_at' => date(DATE_ATOM),
        'expires_at_unix' => time() + $ttl,
        'total_records' => count($records),
        'records' => $records,
        'indexes' => $indexes,
        'catalogs' => array_map('array_values', $catalogs),
        'semantics' => ixtla_insights_snapshot_semantics(),
        'data_quality' => ixtla_insights_snapshot_data_quality($records),
    ];
}

/** Definiciones que comparten reportes, previews y futuras visualizaciones. */
function ixtla_insights_snapshot_semantics(): array
{
    return [
        'record_inclusion' => 'Solo registros operativos activos en el sistema.',
        'created_at' => 'Fecha de registro del requerimiento; se usa para carga y entradas.',
        'started_at' => 'Fecha de inicio de atencion cuando existe; no representa vencimiento ni SLA.',
        'closed_at' => 'Fecha de cierre valida unicamente para requerimientos en estatus Finalizado.',
        'priority' => 'Campo legado no analitico; no participa en filtros, KPIs ni visualizaciones.',
        'status_groups' => ['active' => [0, 1, 2, 3], 'paused' => [4], 'cancelled' => [5], 'finalized' => [6]],
    ];
}

/** @return array{total_records:int, records_with_issues:int, issues:array<string,int>, active_unassigned:int} */
function ixtla_insights_snapshot_data_quality(array $records): array
{
    $issues = [];
    $activeUnassigned = 0;
    $recordsWithIssues = 0;
    foreach ($records as $record) {
        if (($record['is_active'] ?? false) && !($record['is_assigned'] ?? false)) $activeUnassigned++;
        $flags = is_array($record['quality_flags'] ?? null) ? $record['quality_flags'] : [];
        if ($flags !== []) $recordsWithIssues++;
        foreach ($flags as $flag) {
            $issues[$flag] = ($issues[$flag] ?? 0) + 1;
        }
    }
    ksort($issues);
    return [
        'total_records' => count($records),
        'records_with_issues' => $recordsWithIssues,
        'issues' => $issues,
        'active_unassigned' => $activeUnassigned,
    ];
}

function ixtla_insights_snapshot_filter(array $snapshot, array $arguments): array
{
    $statusIds = array_values(array_unique(array_map('intval', is_array($arguments['status_ids'] ?? null) ? $arguments['status_ids'] : [])));
    $channelIds = array_values(array_unique(array_filter(
        array_map('intval', is_array($arguments['channel_ids'] ?? null) ? $arguments['channel_ids'] : []),
        static fn (int $id): bool => in_array($id, [1, 2], true)
    )));
    $departmentId = isset($arguments['department_id']) ? (int) $arguments['department_id'] : 0;
    $departmentIds = array_values(array_unique(array_filter(array_map('intval', is_array($arguments['department_ids'] ?? null) ? $arguments['department_ids'] : []), static fn (int $id): bool => $id > 0)));
    if ($departmentId > 0) $departmentIds[] = $departmentId;
    $departmentIds = array_values(array_unique($departmentIds));
    $assigneeId = isset($arguments['assignee_id']) ? (int) $arguments['assignee_id'] : 0;
    $assigneeIds = array_values(array_unique(array_filter(array_map('intval', is_array($arguments['assignee_ids'] ?? null) ? $arguments['assignee_ids'] : []), static fn (int $id): bool => $id > 0)));
    if ($assigneeId > 0) $assigneeIds[] = $assigneeId;
    $assigneeIds = array_values(array_unique($assigneeIds));
    $tramiteIds = array_values(array_unique(array_filter(array_map('intval', is_array($arguments['tramite_ids'] ?? null) ? $arguments['tramite_ids'] : []), static fn (int $id): bool => $id > 0)));
    $assigneeState = (string) ($arguments['assignee_state'] ?? 'any');
    $period = (string) ($arguments['period'] ?? 'all');
    $dateField = (string) ($arguments['date_field'] ?? 'created_at');
    $dateFrom = trim((string) ($arguments['date_from'] ?? ''));
    $dateTo = trim((string) ($arguments['date_to'] ?? ''));
    if (!in_array($dateField, ['created_at', 'closed_at'], true)
        || ($dateFrom !== '' && !ixtla_insights_snapshot_valid_date($dateFrom))
        || ($dateTo !== '' && !ixtla_insights_snapshot_valid_date($dateTo))
        || ($dateFrom !== '' && $dateTo !== '' && $dateFrom > $dateTo)) {
        throw new InvalidArgumentException('El rango personalizado de fechas no es valido.');
    }
    $limit = array_key_exists('limit', $arguments) ? min(50, max(1, (int) $arguments['limit'])) : 0;
    $sort = (string) ($arguments['sort'] ?? 'newest');
    $hasCustomRange = $dateFrom !== '' || $dateTo !== '';
    $cutoff = $hasCustomRange ? 0 : match ($period) { 'this_week' => strtotime('monday this week midnight'), 'last_7' => strtotime('-6 days midnight'), 'last_30' => strtotime('-29 days midnight'), 'this_month' => strtotime('first day of this month midnight'), default => 0 };
    $fromTimestamp = $dateFrom === '' ? null : strtotime($dateFrom . ' 00:00:00');
    $toTimestamp = $dateTo === '' ? null : strtotime($dateTo . ' 23:59:59');
    $items = array_filter($snapshot['records'] ?? [], static function (array $record) use ($statusIds, $channelIds, $departmentIds, $assigneeIds, $tramiteIds, $assigneeState, $cutoff, $hasCustomRange, $dateField, $fromTimestamp, $toTimestamp): bool {
        if ($statusIds !== [] && !in_array($record['status_id'], $statusIds, true)) return false;
        if ($channelIds !== [] && !in_array($record['channel_id'], $channelIds, true)) return false;
        if ($departmentIds !== [] && !in_array($record['department_id'], $departmentIds, true)) return false;
        if ($assigneeIds !== [] && !in_array($record['assignee_id'], $assigneeIds, true)) return false;
        if ($tramiteIds !== [] && !in_array($record['tramite_id'], $tramiteIds, true)) return false;
        if ($assigneeState === 'assigned' && $record['assignee_id'] === null) return false;
        if ($assigneeState === 'unassigned' && $record['assignee_id'] !== null) return false;
        if ($dateField === 'closed_at' && (int) ($record['closed_at_unix'] ?? 0) <= 0) return false;
        if ($hasCustomRange) {
            $recordTimestamp = $dateField === 'closed_at'
                ? ((int) ($record['closed_at_unix'] ?? 0) ?: null)
                : (int) ($record['created_at_unix'] ?? 0);
            if ($recordTimestamp === null || $recordTimestamp <= 0) return false;
            if ($fromTimestamp !== null && $recordTimestamp < $fromTimestamp) return false;
            if ($toTimestamp !== null && $recordTimestamp > $toTimestamp) return false;
        }
        $periodTimestamp = $dateField === 'closed_at'
            ? (int) ($record['closed_at_unix'] ?? 0)
            : (int) ($record['created_at_unix'] ?? 0);
        return $cutoff === 0 || $periodTimestamp >= $cutoff;
    });
    usort($items, static fn (array $a, array $b): int => match ($sort) {
        'oldest' => $a['created_at_unix'] <=> $b['created_at_unix'],
        'most_comments' => $b['comment_count'] <=> $a['comment_count'],
        default => $b['created_at_unix'] <=> $a['created_at_unix'],
    });
    return array_values($limit > 0 ? array_slice($items, 0, $limit) : $items);
}

/** Resuelve nombres exactos y normalizados solamente contra el catalogo visible. */
function ixtla_insights_snapshot_resolve_department_names(array $snapshot, array $arguments): array
{
    $names = is_array($arguments['department_names'] ?? null) ? $arguments['department_names'] : [];
    if ($names === []) return $arguments;
    $visible = [];
    foreach ($snapshot['catalogs']['departments'] ?? [] as $department) {
        $visible[ixtla_insights_normalize_match_text((string) ($department['name'] ?? ''))][] = $department;
    }
    $resolved = [];
    foreach ($names as $name) {
        $normalized = ixtla_insights_normalize_match_text((string) $name);
        $matches = $visible[$normalized] ?? [];
        if (count($matches) !== 1) {
            throw new InvalidArgumentException('No fue posible resolver de forma unica el departamento: ' . trim((string) $name));
        }
        $resolved[] = (int) $matches[0]['id'];
    }
    $existing = is_array($arguments['department_ids'] ?? null) ? array_map('intval', $arguments['department_ids']) : [];
    $arguments['department_ids'] = array_values(array_unique([...$existing, ...$resolved]));
    return $arguments;
}

function ixtla_insights_snapshot_cursor_encode(int $offset): string
{
    return rtrim(strtr(base64_encode(json_encode(['offset' => $offset], JSON_UNESCAPED_SLASHES)), '+/', '-_'), '=');
}

function ixtla_insights_snapshot_cursor_offset(mixed $cursor): int
{
    if ($cursor === null || trim((string) $cursor) === '') return 0;
    $value = strtr(trim((string) $cursor), '-_', '+/');
    $value .= str_repeat('=', (4 - strlen($value) % 4) % 4);
    $decoded = base64_decode($value, true);
    $payload = is_string($decoded) ? json_decode($decoded, true) : null;
    $offset = is_array($payload) ? (int) ($payload['offset'] ?? -1) : -1;
    if ($offset < 0) throw new InvalidArgumentException('El cursor de paginacion no es valido.');
    return $offset;
}

function ixtla_insights_snapshot_valid_date(string $value): bool
{
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $matches) !== 1) return false;
    return checkdate((int) $matches[2], (int) $matches[3], (int) $matches[1]);
}

function ixtla_insights_snapshot_public_record(array $record, bool $includeRequester = false): array
{
    $result = array_intersect_key($record, array_flip([
        'id', 'folio', 'department', 'tramite', 'status', 'channel', 'assignee', 'assignee_department', 'assignee_position',
        'comment_count', 'last_comment_at', 'process_count', 'last_process_at', 'task_count', 'open_task_count',
        'created_at', 'started_at', 'closed_at', 'age_days',
    ]));
    // La fecha puede conservarse internamente para auditoria o filtros, pero
    // no representa un cierre mientras el estado actual no sea Finalizado.
    // Se elimina en la frontera publica para que ni el modelo ni las
    // exportaciones puedan presentarla como una fecha valida de cierre.
    if ((int) ($record['status_id'] ?? -1) !== 6) {
        unset($result['closed_at']);
    }
    if ($includeRequester) $result['requester_name'] = $record['requester_name'];
    return $result;
}

/**
 * Calcula atencion operativa con evidencia disponible en el snapshot.
 * No usa prioridad ni fecha_limite: ambos campos carecen de semantica vigente.
 *
 * @return array{score:int,reasons:array<int,string>,last_activity_at:?string,inactive_days:int}
 */
function ixtla_insights_snapshot_operational_attention(array $record, ?int $now = null): array
{
    $now ??= time();
    $score = 0;
    $reasons = [];
    $ageDays = max(0, (int) ($record['age_days'] ?? 0));
    $agePoints = min(40, (int) floor($ageDays / 3));
    if ($agePoints > 0) {
        $score += $agePoints;
        $reasons[] = 'Antiguedad de ' . $ageDays . ' dias';
    }
    if (($record['assignee_id'] ?? null) === null) {
        $score += 25;
        $reasons[] = 'Sin responsable asignado';
    }
    $statusPoints = [0 => 15, 1 => 12, 2 => 10, 3 => 5][(int) ($record['status_id'] ?? -1)] ?? 0;
    if ($statusPoints > 0) {
        $score += $statusPoints;
        $reasons[] = 'Estatus ' . (string) ($record['status'] ?? 'activo');
    }
    $activityCandidates = array_filter([
        (string) ($record['created_at'] ?? ''),
        (string) ($record['last_comment_at'] ?? ''),
        (string) ($record['last_process_at'] ?? ''),
    ], static fn (string $value): bool => $value !== '' && (strtotime($value) ?: 0) > 0);
    $lastActivityTimestamp = $activityCandidates === []
        ? 0
        : max(array_map(static fn (string $value): int => strtotime($value) ?: 0, $activityCandidates));
    $inactiveDays = $lastActivityTimestamp > 0 ? max(0, (int) floor(($now - $lastActivityTimestamp) / 86400)) : $ageDays;
    $inactivityPoints = $inactiveDays >= 30 ? 15 : ($inactiveDays >= 14 ? 10 : ($inactiveDays >= 7 ? 5 : 0));
    if ($inactivityPoints > 0) {
        $score += $inactivityPoints;
        $reasons[] = 'Sin actividad reciente (' . $inactiveDays . ' dias)';
    }
    $openTasks = max(0, (int) ($record['open_task_count'] ?? 0));
    if ($openTasks > 0) {
        $score += min(5, $openTasks);
        $reasons[] = $openTasks . ($openTasks === 1 ? ' tarea abierta' : ' tareas abiertas');
    }
    return [
        'score' => min(100, $score),
        'reasons' => $reasons,
        'last_activity_at' => $lastActivityTimestamp > 0 ? date('Y-m-d H:i:s', $lastActivityTimestamp) : null,
        'inactive_days' => $inactiveDays,
    ];
}

/** Lista explicable de casos activos que requieren mayor atencion operativa. */
function ixtla_insights_snapshot_priority_requirements(array $arguments): array
{
    $explicitStatuses = array_values(array_unique(array_map(
        'intval',
        is_array($arguments['status_ids'] ?? null) ? $arguments['status_ids'] : []
    )));
    $requestedStatuses = array_values(array_intersect(
        $explicitStatuses,
        ixtla_insights_domain_status_ids('active')
    ));
    $requestedLimit = min(30, max(1, (int) ($arguments['limit'] ?? 10)));
    if ($explicitStatuses !== [] && $requestedStatuses === []) {
        return [
            'ranking_mode' => 'operational_attention',
            'definition' => 'Antiguedad, ausencia de responsable, estatus activo, falta de actividad reciente y tareas abiertas.',
            'period' => (string) ($arguments['period'] ?? 'all'),
            'total_candidates' => 0,
            'returned' => 0,
            'items' => [],
        ];
    }
    $snapshot = ixtla_insights_snapshot_build(false);
    $arguments['status_ids'] = $requestedStatuses !== [] ? $requestedStatuses : ixtla_insights_domain_status_ids('active');
    $arguments['sort'] = 'oldest';
    $arguments['limit'] = 0;
    $records = ixtla_insights_snapshot_filter($snapshot, $arguments);
    $ranked = array_map(static function (array $record): array {
        return [...ixtla_insights_snapshot_public_record($record), ...ixtla_insights_snapshot_operational_attention($record)];
    }, $records);
    usort($ranked, static fn (array $a, array $b): int =>
        ($b['score'] <=> $a['score'])
        ?: ($b['inactive_days'] <=> $a['inactive_days'])
        ?: strcmp((string) ($a['created_at'] ?? ''), (string) ($b['created_at'] ?? ''))
        ?: ((int) ($a['id'] ?? 0) <=> (int) ($b['id'] ?? 0))
    );
    return [
        'ranking_mode' => 'operational_attention',
        'definition' => 'Antiguedad, ausencia de responsable, estatus activo, falta de actividad reciente y tareas abiertas.',
        'period' => (string) ($arguments['period'] ?? 'all'),
        'total_candidates' => count($ranked),
        'returned' => min($requestedLimit, count($ranked)),
        'items' => array_slice($ranked, 0, $requestedLimit),
    ];
}

/** Resumen compacto calculado sobre todas las coincidencias, no solo la pagina. */
function ixtla_insights_snapshot_result_summary(array $records): array
{
    $dimensions = ['by_status' => [], 'by_department' => [], 'by_tramite' => [], 'by_assignee' => [], 'by_channel' => []];
    $unassigned = 0;
    foreach ($records as $record) {
        if (($record['assignee_id'] ?? null) === null) $unassigned++;
        foreach ([
            'by_status' => ['status_id', 'status'],
            'by_department' => ['department_id', 'department'],
            'by_tramite' => ['tramite_id', 'tramite'],
            'by_assignee' => ['assignee_id', 'assignee'],
            'by_channel' => ['channel_id', 'channel'],
        ] as $dimension => [$idField, $labelField]) {
            $key = (string) ($record[$idField] ?? 'unassigned');
            if (!isset($dimensions[$dimension][$key])) {
                $dimensions[$dimension][$key] = ['id' => $record[$idField] ?? null, 'label' => (string) ($record[$labelField] ?? ''), 'value' => 0];
            }
            $dimensions[$dimension][$key]['value']++;
        }
    }
    foreach ($dimensions as $dimension => $groups) {
        $items = array_values($groups);
        usort($items, static fn (array $a, array $b): int => $b['value'] <=> $a['value']);
        $dimensions[$dimension] = array_slice($items, 0, 20);
    }
    return ['unassigned' => $unassigned, ...$dimensions];
}

/** Resumen calculado desde el snapshot, sin consultar la fuente operacional. */
function ixtla_insights_snapshot_overview(array $arguments = []): array
{
    $snapshot = ixtla_insights_snapshot_build((bool) ($arguments['refresh'] ?? false));
    $period = (string) ($arguments['period'] ?? 'all');
    if (!in_array($period, ['all', 'this_week', 'last_7', 'last_30', 'this_month'], true)) {
        throw new InvalidArgumentException('El periodo del resumen no es valido.');
    }
    // Aplica el mismo periodo que las listas y agregados, para que un KPI de
    // carga y los folios que la sustentan pertenezcan al mismo universo.
    $records = ixtla_insights_snapshot_filter($snapshot, [
        'period' => $period,
        'date_field' => $arguments['date_field'] ?? 'created_at',
        'date_from' => $arguments['date_from'] ?? null,
        'date_to' => $arguments['date_to'] ?? null,
    ]);
    $counts = ['total' => count($records), 'active' => 0, 'finalized' => 0, 'paused' => 0, 'cancelled' => 0, 'unassigned' => 0];
    $byStatus = [];
    $byTramite = [];
    $allRecords = is_array($snapshot['records'] ?? null) ? $snapshot['records'] : [];
    $currentThirtyDays = 0;
    $previousThirtyDays = 0;
    $dailyCurrentThirtyDays = [];
    $currentCutoff = strtotime('-29 days midnight');
    $previousCutoff = strtotime('-59 days midnight');
    foreach ($records as $record) {
        if ($record['is_active']) $counts['active']++;
        if ($record['status_id'] === 6) $counts['finalized']++;
        if ($record['status_id'] === 4) $counts['paused']++;
        if ($record['status_id'] === 5) $counts['cancelled']++;
        if ($record['assignee_id'] === null && $record['is_active']) $counts['unassigned']++;
        $byStatus[$record['status']] = ($byStatus[$record['status']] ?? 0) + 1;
        $tramiteKey = (string) $record['tramite_id'];
        if (!isset($byTramite[$tramiteKey])) {
            $byTramite[$tramiteKey] = ['name' => (string) $record['tramite'], 'value' => 0];
        }
        $byTramite[$tramiteKey]['value']++;
    }
    foreach ($allRecords as $record) {
        $createdAtUnix = (int) ($record['created_at_unix'] ?? 0);
        if ($createdAtUnix >= $currentCutoff) {
            $currentThirtyDays++;
            $createdDate = (string) ($record['created_date'] ?? '');
            if ($createdDate !== '') $dailyCurrentThirtyDays[$createdDate] = ($dailyCurrentThirtyDays[$createdDate] ?? 0) + 1;
        } elseif ($createdAtUnix >= $previousCutoff && $createdAtUnix < $currentCutoff) {
            $previousThirtyDays++;
        }
    }
    uasort($byTramite, static fn (array $a, array $b): int => $b['value'] <=> $a['value']);
    ksort($dailyCurrentThirtyDays);
    $peakValue = $dailyCurrentThirtyDays === [] ? 0 : max($dailyCurrentThirtyDays);
    $peakDays = [];
    foreach ($dailyCurrentThirtyDays as $date => $value) {
        if ($value === $peakValue) $peakDays[] = ['date' => $date, 'value' => $value];
    }
    return [
        'dataset' => $snapshot['dataset'],
        'generated_at' => $snapshot['generated_at'],
        'expires_at_unix' => $snapshot['expires_at_unix'],
        'scope' => $snapshot['scope'],
        'period' => $period,
        'total_records' => count($records),
        'semantics' => $snapshot['semantics'] ?? [],
        'data_quality' => $snapshot['data_quality'] ?? [],
        'counts' => $counts,
        'trend' => [
            'current_period' => 'last_30',
            'comparison_period' => 'previous_30',
            'current_total' => $currentThirtyDays,
            'previous_total' => $previousThirtyDays,
            'difference' => $currentThirtyDays - $previousThirtyDays,
            'percentage_change' => $previousThirtyDays === 0 ? null : round((($currentThirtyDays - $previousThirtyDays) / $previousThirtyDays) * 100, 1),
            'daily_current' => array_map(static fn (string $date, int $value): array => ['date' => $date, 'value' => $value], array_keys($dailyCurrentThirtyDays), array_values($dailyCurrentThirtyDays)),
            'peak_days' => $peakDays,
        ],
        'by_status' => array_map(static fn (string $label, int $value): array => ['label' => $label, 'value' => $value], array_keys($byStatus), array_values($byStatus)),
        'top_tramites' => array_values(array_slice($byTramite, 0, 5)),
    ];
}

function ixtla_insights_snapshot_search(array $arguments): array
{
    $allowedPeriods = ['all', 'this_week', 'last_7', 'last_30', 'this_month'];
    $allowedAssigneeStates = ['any', 'assigned', 'unassigned'];
    $allowedSorts = ['newest', 'oldest', 'most_comments'];
    if (!in_array((string) ($arguments['period'] ?? 'all'), $allowedPeriods, true)
        || !in_array((string) ($arguments['assignee_state'] ?? 'any'), $allowedAssigneeStates, true)
        || !in_array((string) ($arguments['sort'] ?? 'newest'), $allowedSorts, true)) {
        throw new InvalidArgumentException('Los filtros solicitados no son validos.');
    }
    $snapshot = ixtla_insights_snapshot_build(false);
    $arguments = ixtla_insights_snapshot_resolve_department_names($snapshot, $arguments);
    $limit = min(50, max(1, (int) ($arguments['limit'] ?? 50)));
    $offset = ixtla_insights_snapshot_cursor_offset($arguments['cursor'] ?? null);
    $filterArguments = $arguments;
    unset($filterArguments['limit'], $filterArguments['cursor']);
    $matching = ixtla_insights_snapshot_filter($snapshot, $filterArguments);
    $storedQuery = ixtla_insights_query_store_create($filterArguments, $snapshot);
    $total = count($matching);
    $items = array_slice($matching, $offset, $limit);
    $nextOffset = $offset + count($items);
    $hasMore = $nextOffset < $total;
    return [
        'dataset' => $snapshot['dataset'],
        'schema_version' => $snapshot['schema_version'],
        'generated_at' => $snapshot['generated_at'],
        'scope' => $snapshot['scope'],
        'semantics' => $snapshot['semantics'] ?? [],
        'data_quality' => $snapshot['data_quality'] ?? [],
        'filters' => $arguments,
        'query_id' => $storedQuery['query_id'],
        'query_expires_at_unix' => $storedQuery['expires_at_unix'],
        'total_matching' => $total,
        'returned' => count($items),
        'has_more' => $hasMore,
        'next_cursor' => $hasMore ? ixtla_insights_snapshot_cursor_encode($nextOffset) : null,
        'summary' => ixtla_insights_snapshot_result_summary($matching),
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
        'schema_version' => $snapshot['schema_version'],
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
        'channel' => ['id' => 'channel_id', 'label' => 'channel'],
        'date' => ['id' => 'created_date', 'label' => 'created_date'],
    ];
    if (!isset($fieldMap[$groupBy]) || !in_array($sort, ['asc', 'desc'], true)) {
        throw new InvalidArgumentException('La agrupacion solicitada no es valida.');
    }
    $snapshot = ixtla_insights_snapshot_build(false);
    $arguments = ixtla_insights_snapshot_resolve_department_names($snapshot, $arguments);
    $filterArguments = $arguments;
    unset($filterArguments['limit'], $filterArguments['group_by'], $filterArguments['sort']);
    $records = ixtla_insights_snapshot_filter($snapshot, $filterArguments);
    if ($groupBy === 'date' && (string) ($filterArguments['date_field'] ?? 'created_at') === 'closed_at') {
        $fieldMap['date'] = ['id' => 'closed_date', 'label' => 'closed_date'];
    }
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
        'schema_version' => $snapshot['schema_version'],
        'generated_at' => $snapshot['generated_at'],
        'scope' => $snapshot['scope'],
        'semantics' => $snapshot['semantics'] ?? [],
        'data_quality' => $snapshot['data_quality'] ?? [],
        'group_by' => $groupBy,
        'total_matching' => count($records),
        'items' => array_slice($items, 0, $limit),
    ];
}

/** Compara dos universos completos del mismo snapshot autorizado por RBAC. */
function ixtla_insights_snapshot_compare_sets(array $arguments): array
{
    $snapshot = ixtla_insights_snapshot_build(false);
    $leftFilters = ixtla_insights_snapshot_resolve_department_names($snapshot, (array) ($arguments['left'] ?? []));
    $rightFilters = ixtla_insights_snapshot_resolve_department_names($snapshot, (array) ($arguments['right'] ?? []));
    $leftRecords = ixtla_insights_snapshot_filter($snapshot, $leftFilters);
    $rightRecords = ixtla_insights_snapshot_filter($snapshot, $rightFilters);
    $groupBy = (string) ($arguments['group_by'] ?? 'status');
    $dateGrain = (string) ($arguments['date_grain'] ?? 'month');
    if (!in_array($groupBy, ['status', 'department', 'tramite', 'assignee', 'channel', 'date'], true)
        || !in_array($dateGrain, ['day', 'week', 'month'], true)) {
        throw new InvalidArgumentException('La dimension de comparacion no es valida.');
    }
    $group = static function (array $records, array $filters) use ($groupBy, $dateGrain): array {
        $items = [];
        foreach ($records as $record) {
            if ($groupBy === 'assignee') {
                $dimension = [
                    'id' => $record['assignee_id'] ?? null,
                    'label' => (string) ($record['assignee'] ?? 'Sin asignar'),
                ];
            } else {
                $dimension = ixtla_insights_snapshot_dimension_value(
                    $record,
                    $groupBy,
                    $dateGrain,
                    (string) ($filters['date_field'] ?? 'created_at')
                );
            }
            $key = $dimension['id'] === null ? 'null:' . $dimension['label'] : 'id:' . (string) $dimension['id'];
            if (!isset($items[$key])) {
                $items[$key] = ['id' => $dimension['id'], 'label' => $dimension['label'], 'value' => 0];
            }
            $items[$key]['value']++;
        }
        return $items;
    };
    $leftGroups = $group($leftRecords, $leftFilters);
    $rightGroups = $group($rightRecords, $rightFilters);
    $keys = array_values(array_unique([...array_keys($leftGroups), ...array_keys($rightGroups)]));
    $items = array_map(static function (string $key) use ($leftGroups, $rightGroups): array {
        $base = $leftGroups[$key] ?? $rightGroups[$key];
        $left = (int) ($leftGroups[$key]['value'] ?? 0);
        $right = (int) ($rightGroups[$key]['value'] ?? 0);
        return [
            'id' => $base['id'], 'label' => $base['label'],
            'left_value' => $left, 'right_value' => $right,
            'absolute_change' => $right - $left,
            'percent_change' => $left === 0 ? null : round((($right - $left) / $left) * 100, 1),
        ];
    }, $keys);
    usort($items, static fn (array $a, array $b): int =>
        abs($b['absolute_change']) <=> abs($a['absolute_change']) ?: strcmp((string) $a['label'], (string) $b['label'])
    );
    $leftTotal = count($leftRecords);
    $rightTotal = count($rightRecords);
    return [
        'dataset' => $snapshot['dataset'],
        'scope' => $snapshot['scope'],
        'comparison_basis' => 'Universos completos filtrados sobre el mismo snapshot autorizado; no muestras.',
        'group_by' => $groupBy,
        'left' => ['label' => (string) ($arguments['left_label'] ?? 'Conjunto A'), 'filters' => $leftFilters, 'total' => $leftTotal],
        'right' => ['label' => (string) ($arguments['right_label'] ?? 'Conjunto B'), 'filters' => $rightFilters, 'total' => $rightTotal],
        'absolute_change' => $rightTotal - $leftTotal,
        'percent_change' => $leftTotal === 0 ? null : round((($rightTotal - $leftTotal) / $leftTotal) * 100, 1),
        'items' => array_slice($items, 0, min(50, max(1, (int) ($arguments['limit'] ?? 20)))),
    ];
}

/** Devuelve id, etiqueta y llave ordenable para una dimensión autorizada. */
function ixtla_insights_snapshot_dimension_value(array $record, string $dimension, string $dateGrain, string $dateField): array
{
    if ($dimension === 'date') {
        $date = (string) ($record[$dateField === 'closed_at' ? 'closed_date' : 'created_date'] ?? '');
        if ($date === '') return ['id' => null, 'label' => 'Sin fecha', 'sort' => '9999-99-99'];
        if ($dateGrain === 'month') {
            $key = substr($date, 0, 7);
            return ['id' => $key, 'label' => $key, 'sort' => $key];
        }
        if ($dateGrain === 'week') {
            $value = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
            if (!$value) return ['id' => $date, 'label' => $date, 'sort' => $date];
            $monday = $value->modify('monday this week')->format('Y-m-d');
            return ['id' => $monday, 'label' => 'Semana del ' . $monday, 'sort' => $monday];
        }
        return ['id' => $date, 'label' => $date, 'sort' => $date];
    }
    $map = [
        'status' => ['status_id', 'status'],
        'department' => ['department_id', 'department'],
        'tramite' => ['tramite_id', 'tramite'],
        'channel' => ['channel_id', 'channel'],
    ];
    [$idField, $labelField] = $map[$dimension];
    $id = $record[$idField] ?? null;
    $label = trim((string) ($record[$labelField] ?? '')) ?: 'Sin especificar';
    return ['id' => $id, 'label' => $label, 'sort' => $label];
}

/**
 * Agregado bidimensional para visualizaciones multiserie y matrices.
 * Trabaja sobre el snapshot ya limitado por RBAC; nunca recibe columnas SQL.
 */
function ixtla_insights_snapshot_aggregate_dimensions(array $arguments): array
{
    $groupBy = (string) ($arguments['group_by'] ?? 'date');
    $seriesBy = (string) ($arguments['series_by'] ?? 'status');
    $dateGrain = (string) ($arguments['date_grain'] ?? 'day');
    $categoryLimit = min(50, max(1, (int) ($arguments['category_limit'] ?? 20)));
    $seriesLimit = min(7, max(1, (int) ($arguments['series_limit'] ?? 5)));
    $includeOther = (bool) ($arguments['include_other'] ?? true);
    $dimensions = ['status', 'department', 'tramite', 'channel', 'date'];
    $seriesDimensions = ['status', 'department', 'tramite', 'channel'];
    if (!in_array($groupBy, $dimensions, true)
        || !in_array($seriesBy, $seriesDimensions, true)
        || !in_array($dateGrain, ['day', 'week', 'month'], true)
        || $groupBy === $seriesBy) {
        throw new InvalidArgumentException('Las dimensiones solicitadas para la visualizacion no son compatibles.');
    }

    $snapshot = ixtla_insights_snapshot_build(false);
    $arguments = ixtla_insights_snapshot_resolve_department_names($snapshot, $arguments);
    $filterArguments = $arguments;
    foreach (['group_by', 'series_by', 'date_grain', 'category_limit', 'series_limit', 'include_other'] as $key) unset($filterArguments[$key]);
    $records = ixtla_insights_snapshot_filter($snapshot, $filterArguments);
    $dateField = (string) ($filterArguments['date_field'] ?? 'created_at');
    $categories = [];
    $series = [];
    $cells = [];
    foreach ($records as $record) {
        $category = ixtla_insights_snapshot_dimension_value($record, $groupBy, $dateGrain, $dateField);
        $serie = ixtla_insights_snapshot_dimension_value($record, $seriesBy, $dateGrain, $dateField);
        $categoryKey = (string) ($category['id'] ?? 'unassigned');
        $seriesKey = (string) ($serie['id'] ?? 'unassigned');
        if (!isset($categories[$categoryKey])) $categories[$categoryKey] = [...$category, 'value' => 0];
        if (!isset($series[$seriesKey])) $series[$seriesKey] = [...$serie, 'value' => 0];
        $categories[$categoryKey]['value']++;
        $series[$seriesKey]['value']++;
        $cells[$categoryKey][$seriesKey] = (int) ($cells[$categoryKey][$seriesKey] ?? 0) + 1;
    }
    $categoryItems = array_values($categories);
    usort($categoryItems, static fn (array $a, array $b): int => $groupBy === 'date'
        ? strcmp((string) $a['sort'], (string) $b['sort'])
        : (((int) $b['value'] <=> (int) $a['value']) ?: strcmp((string) $a['label'], (string) $b['label'])));
    $categoryItems = $groupBy === 'date'
        ? array_slice($categoryItems, -$categoryLimit)
        : array_slice($categoryItems, 0, $categoryLimit);
    $seriesItems = array_values($series);
    usort($seriesItems, static fn (array $a, array $b): int => ((int) $b['value'] <=> (int) $a['value']) ?: strcmp((string) $a['label'], (string) $b['label']));
    $groupRemaining = $includeOther && $seriesLimit > 1 && count($seriesItems) > $seriesLimit;
    $selectedCount = $groupRemaining ? $seriesLimit - 1 : $seriesLimit;
    $selectedSeries = array_slice($seriesItems, 0, $selectedCount);
    $remainingSeries = array_slice($seriesItems, $selectedCount);
    if ($groupRemaining && $remainingSeries !== []) {
        $selectedSeries[] = ['id' => '__other__', 'label' => 'Otros', 'sort' => 'Otros', 'value' => array_sum(array_column($remainingSeries, 'value'))];
    }
    $remainingKeys = array_map(static fn (array $item): string => (string) ($item['id'] ?? 'unassigned'), $remainingSeries);
    $categoryKeys = array_map(static fn (array $item): string => (string) ($item['id'] ?? 'unassigned'), $categoryItems);
    $seriesOutput = array_map(static function (array $serie) use ($cells, $categoryKeys, $remainingKeys): array {
        $key = (string) ($serie['id'] ?? 'unassigned');
        $values = array_map(static function (string $categoryKey) use ($cells, $key, $remainingKeys): int {
            if ($key === '__other__') {
                $value = 0;
                foreach ($remainingKeys as $remainingKey) $value += (int) ($cells[$categoryKey][$remainingKey] ?? 0);
                return $value;
            }
            return (int) ($cells[$categoryKey][$key] ?? 0);
        }, $categoryKeys);
        return ['id' => $serie['id'], 'label' => (string) $serie['label'], 'total' => array_sum($values), 'values' => $values];
    }, $selectedSeries);

    return [
        'dataset' => $snapshot['dataset'],
        'schema_version' => $snapshot['schema_version'],
        'generated_at' => $snapshot['generated_at'],
        'scope' => $snapshot['scope'],
        'semantics' => $snapshot['semantics'] ?? [],
        'data_quality' => $snapshot['data_quality'] ?? [],
        'group_by' => $groupBy,
        'series_by' => $seriesBy,
        'date_grain' => $dateGrain,
        'total_matching' => count($records),
        'categories' => array_map(static fn (array $item): array => ['id' => $item['id'], 'label' => (string) $item['label'], 'total' => (int) $item['value']], $categoryItems),
        'series' => $seriesOutput,
    ];
}

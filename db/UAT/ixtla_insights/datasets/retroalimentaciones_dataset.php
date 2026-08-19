<?php
declare(strict_types=1);

require_once __DIR__ . '/requerimientos_dataset.php';

function ixtla_insights_retro_status_label(int $status): string
{
    return [0 => 'Caducada', 1 => 'No contestada', 2 => 'Contestada', 3 => 'Inhabilitada'][$status]
        ?? 'Sin estado';
}

function ixtla_insights_retro_rating_label(?int $rating): string
{
    return [1 => 'Malo', 2 => 'Regular', 3 => 'Bueno', 4 => 'Excelente'][$rating]
        ?? 'Sin calificacion';
}

/** @return array{where:list<string>,types:string,params:list<mixed>,scope:array} */
function ixtla_insights_retro_query(array $arguments, mysqli $connection): array
{
    $scope = ixtla_insights_dataset_scope($connection);
    $where = $scope['where'];
    $types = $scope['types'];
    $params = $scope['params'];

    foreach ([['status_ids', 'rc.status'], ['rating_ids', 'rc.calificacion'], ['department_ids', 'r.departamento_id'], ['tramite_ids', 'r.tramite_id'], ['requirement_status_ids', 'r.estatus'], ['channel_ids', 'r.canal'], ['assignee_ids', 'r.asignado_a']] as [$key, $column]) {
        $values = array_values(array_unique(array_filter(array_map('intval', is_array($arguments[$key] ?? null) ? $arguments[$key] : []), static fn (int $value): bool => $value >= 0)));
        if ($values === []) continue;
        $where[] = $column . ' IN (' . implode(',', array_fill(0, count($values), '?')) . ')';
        $types .= str_repeat('i', count($values));
        array_push($params, ...$values);
    }

    $assigneeState = (string) ($arguments['assignee_state'] ?? 'any');
    if ($assigneeState === 'assigned') $where[] = 'r.asignado_a IS NOT NULL';
    if ($assigneeState === 'unassigned') $where[] = 'r.asignado_a IS NULL';

    $period = (string) ($arguments['period'] ?? 'all');
    match ($period) {
        'this_week' => $where[] = 'rc.created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)',
        'last_7' => $where[] = 'rc.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)',
        'last_30' => $where[] = 'rc.created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)',
        'this_month' => $where[] = "rc.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')",
        'all' => null,
        default => throw new InvalidArgumentException('El periodo de retroalimentaciones no es valido.'),
    };
    $dateFrom = trim((string) ($arguments['date_from'] ?? ''));
    $dateTo = trim((string) ($arguments['date_to'] ?? ''));
    if ($dateFrom !== '') { $where[] = 'rc.created_at >= ?'; $types .= 's'; $params[] = $dateFrom . ' 00:00:00'; }
    if ($dateTo !== '') { $where[] = 'rc.created_at < DATE_ADD(?, INTERVAL 1 DAY)'; $types .= 's'; $params[] = $dateTo; }

    return ['where' => $where, 'types' => $types, 'params' => $params, 'scope' => $scope];
}

function ixtla_insights_retro_overview(array $arguments): array
{
    $connection = ixtla_insights_dataset_connection();
    try {
        $query = ixtla_insights_retro_query($arguments, $connection);
        $from = ' FROM retro_ciudadana rc JOIN requerimiento r ON r.id = rc.requerimiento_id';
        $where = ' WHERE ' . implode(' AND ', $query['where']);
        $rows = ixtla_insights_dataset_rows($connection,
            'SELECT COUNT(*) total, '
            . 'SUM(rc.status = 0) expired, SUM(rc.status = 1) pending, SUM(rc.status = 2) answered, SUM(rc.status = 3) disabled, '
            . 'COUNT(DISTINCT r.id) unique_requirements, '
            . 'SUM(rc.status IN (1, 2)) eligible_invitations, '
            . 'SUM(rc.status = 2 AND rc.calificacion BETWEEN 1 AND 4) rated, '
            . 'SUM(rc.status = 2 AND rc.calificacion IN (1, 2)) unfavorable, '
            . 'SUM(rc.status = 2 AND rc.calificacion IN (3, 4)) favorable, '
            . 'ROUND(AVG(CASE WHEN rc.status = 2 AND rc.calificacion BETWEEN 1 AND 4 THEN rc.calificacion END), 2) average_rating'
            . $from . $where,
            $query['types'], $query['params']);
        $row = $rows[0] ?? [];
        $answered = (int) ($row['answered'] ?? 0);
        $total = (int) ($row['total'] ?? 0);
        $eligible = (int) ($row['eligible_invitations'] ?? 0);
        $rated = (int) ($row['rated'] ?? 0);
        return [
            'scope' => (string) $query['scope']['label'],
            'period' => (string) ($arguments['period'] ?? 'all'),
            'date_basis' => 'Fecha de creacion de la retroalimentacion',
            'total' => $total,
            'unique_requirements' => (int) ($row['unique_requirements'] ?? 0),
            'status_counts' => [
                'expired' => (int) ($row['expired'] ?? 0),
                'pending' => (int) ($row['pending'] ?? 0),
                'answered' => $answered,
                'disabled' => (int) ($row['disabled'] ?? 0),
            ],
            'response_rate_percent' => $total > 0 ? round(($answered / $total) * 100, 2) : 0.0,
            'eligible_response_rate_percent' => $eligible > 0 ? round(($answered / $eligible) * 100, 2) : 0.0,
            'eligible_invitations' => $eligible,
            'rated_responses' => $rated,
            'average_rating' => $row['average_rating'] === null ? null : (float) $row['average_rating'],
            'favorable_ratings' => (int) ($row['favorable'] ?? 0),
            'unfavorable_ratings' => (int) ($row['unfavorable'] ?? 0),
            'favorable_rating_percent' => $rated > 0 ? round(((int) ($row['favorable'] ?? 0) / $rated) * 100, 2) : 0.0,
            'business_note' => 'La tasa general usa contestadas entre todas las retros filtradas. La tasa elegible usa contestadas entre No contestadas y Contestadas. Favorable agrupa Bueno y Excelente; desfavorable agrupa Malo y Regular.',
        ];
    } finally {
        $connection->close();
    }
}

function ixtla_insights_retro_aggregate(array $arguments): array
{
    $groupBy = (string) ($arguments['group_by'] ?? 'status');
    $groups = [
        'status' => ['expr' => 'rc.status', 'label' => 'rc.status'],
        'rating' => ['expr' => 'rc.calificacion', 'label' => 'rc.calificacion'],
        'department' => ['expr' => 'r.departamento_id', 'label' => 'd.nombre'],
        'tramite' => ['expr' => 'r.tramite_id', 'label' => 't.nombre'],
        'assignee' => ['expr' => 'r.asignado_a', 'label' => "COALESCE(NULLIF(TRIM(CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, ''))), ''), 'Sin responsable')"],
        'channel' => ['expr' => 'r.canal', 'label' => 'r.canal'],
        'requirement_status' => ['expr' => 'r.estatus', 'label' => 'r.estatus'],
        'date' => ['expr' => 'DATE(rc.created_at)', 'label' => 'DATE(rc.created_at)'],
    ];
    if (!isset($groups[$groupBy])) throw new InvalidArgumentException('La agrupacion de retroalimentaciones no es valida.');
    $limit = min(50, max(1, (int) ($arguments['limit'] ?? 20)));
    $connection = ixtla_insights_dataset_connection();
    try {
        $query = ixtla_insights_retro_query($arguments, $connection);
        $group = $groups[$groupBy];
        $sql = 'SELECT ' . $group['expr'] . ' group_id, ' . $group['label'] . ' group_label, COUNT(*) value '
            . 'FROM retro_ciudadana rc JOIN requerimiento r ON r.id = rc.requerimiento_id '
            . 'JOIN departamento d ON d.id = r.departamento_id JOIN tramite t ON t.id = r.tramite_id LEFT JOIN empleado e ON e.id = r.asignado_a '
            . 'WHERE ' . implode(' AND ', $query['where']) . ' GROUP BY ' . $group['expr'] . ', ' . $group['label']
            . ' ORDER BY value DESC, group_label ASC LIMIT ?';
        $types = $query['types'] . 'i';
        $params = [...$query['params'], $limit];
        $rows = ixtla_insights_dataset_rows($connection, $sql, $types, $params);
        return [
            'scope' => (string) $query['scope']['label'],
            'group_by' => $groupBy,
            'date_basis' => 'Fecha de creacion de la retroalimentacion',
            'items' => array_map(static function (array $row) use ($groupBy): array {
                $id = $row['group_id'] === null ? null : ($groupBy === 'date' ? (string) $row['group_id'] : (int) $row['group_id']);
                $label = match ($groupBy) {
                    'status' => ixtla_insights_retro_status_label((int) $id),
                    'rating' => ixtla_insights_retro_rating_label($id),
                    'channel' => ixtla_insights_domain_channel_label((int) $id),
                    'requirement_status' => ixtla_insights_domain_status_label((int) $id),
                    default => trim((string) $row['group_label']) ?: 'Sin especificar',
                };
                return ['id' => $id, 'label' => $label, 'value' => (int) $row['value']];
            }, $rows),
        ];
    } finally {
        $connection->close();
    }
}

function ixtla_insights_retro_search(array $arguments): array
{
    $limit = min(50, max(1, (int) ($arguments['limit'] ?? 20)));
    $page = max(1, (int) ($arguments['page'] ?? 1));
    $offset = ($page - 1) * $limit;
    $connection = ixtla_insights_dataset_connection();
    try {
        $query = ixtla_insights_retro_query($arguments, $connection);
        $total = ixtla_insights_dataset_scalar($connection,
            'SELECT COUNT(*) FROM retro_ciudadana rc JOIN requerimiento r ON r.id = rc.requerimiento_id WHERE ' . implode(' AND ', $query['where']),
            $query['types'], $query['params']);
        $sql = 'SELECT rc.id, r.id requerimiento_id, r.folio, rc.status, rc.calificacion, r.estatus requirement_status, r.canal channel_id, '
            . 'd.nombre department, t.nombre tramite, '
            . "COALESCE(NULLIF(TRIM(CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, ''))), ''), 'Sin responsable') assignee "
            . 'FROM retro_ciudadana rc JOIN requerimiento r ON r.id = rc.requerimiento_id '
            . 'JOIN departamento d ON d.id = r.departamento_id JOIN tramite t ON t.id = r.tramite_id LEFT JOIN empleado e ON e.id = r.asignado_a '
            . 'WHERE ' . implode(' AND ', $query['where']) . ' ORDER BY rc.id DESC LIMIT ? OFFSET ?';
        $rows = ixtla_insights_dataset_rows($connection, $sql, $query['types'] . 'ii', [...$query['params'], $limit, $offset]);
        return [
            'scope' => (string) $query['scope']['label'],
            'date_basis' => 'Fecha de creacion de la retroalimentacion',
            'returned' => count($rows),
            'total_matching' => $total,
            'page' => $page,
            'has_more' => $offset + count($rows) < $total,
            'items' => array_map(static fn (array $row): array => [
                'retro_id' => (int) $row['id'],
                'requirement_id' => (int) $row['requerimiento_id'],
                'folio' => (string) $row['folio'],
                'status' => ixtla_insights_retro_status_label((int) $row['status']),
                'rating' => $row['calificacion'] === null ? null : (int) $row['calificacion'],
                'rating_label' => ixtla_insights_retro_rating_label($row['calificacion'] === null ? null : (int) $row['calificacion']),
                'department' => (string) $row['department'],
                'tramite' => (string) $row['tramite'],
                'requirement_status' => ixtla_insights_domain_status_label((int) $row['requirement_status']),
                'channel' => ixtla_insights_domain_channel_label((int) $row['channel_id']),
                'assignee' => (string) $row['assignee'],
            ], $rows),
            'privacy' => 'La lista no incluye telefono, nombre ciudadano, enlace ni comentario libre.',
        ];
    } finally {
        $connection->close();
    }
}

/**
 * Entrega una muestra acotada de comentarios para análisis cualitativo.
 * El RBAC se aplica antes de leer el texto y nunca se incluyen contactos.
 */
function ixtla_insights_retro_comment_sample(array $arguments): array
{
    $limit = min(30, max(1, (int) ($arguments['limit'] ?? 15)));
    $connection = ixtla_insights_dataset_connection();
    try {
        $query = ixtla_insights_retro_query($arguments, $connection);
        $query['where'][] = "rc.status = 2 AND NULLIF(TRIM(rc.comentario), '') IS NOT NULL";
        $where = ' WHERE ' . implode(' AND ', $query['where']);
        $total = ixtla_insights_dataset_scalar(
            $connection,
            'SELECT COUNT(*) FROM retro_ciudadana rc JOIN requerimiento r ON r.id = rc.requerimiento_id' . $where,
            $query['types'],
            $query['params']
        );
        $rows = ixtla_insights_dataset_rows(
            $connection,
            'SELECT rc.id, r.id requirement_id, r.folio, rc.calificacion, rc.comentario, rc.created_at, '
            . 'd.nombre department, t.nombre tramite '
            . 'FROM retro_ciudadana rc JOIN requerimiento r ON r.id = rc.requerimiento_id '
            . 'JOIN departamento d ON d.id = r.departamento_id JOIN tramite t ON t.id = r.tramite_id'
            . $where . ' ORDER BY rc.created_at DESC, rc.id DESC LIMIT ?',
            $query['types'] . 'i',
            [...$query['params'], $limit]
        );
        return [
            'scope' => (string) $query['scope']['label'],
            'period' => (string) ($arguments['period'] ?? 'all'),
            'date_basis' => 'Fecha de creacion de la retroalimentacion',
            'total_comments_matching' => $total,
            'sample_size' => count($rows),
            'is_sample' => count($rows) < $total,
            'comments' => array_map(static fn (array $row): array => [
                'retro_id' => (int) $row['id'],
                'requirement_id' => (int) $row['requirement_id'],
                'folio' => (string) $row['folio'],
                'rating' => (int) $row['calificacion'],
                'rating_label' => ixtla_insights_retro_rating_label((int) $row['calificacion']),
                'comment' => ixtla_insights_activity_safe_text((string) $row['comentario'], 1000),
                'created_at' => (string) $row['created_at'],
                'department' => (string) $row['department'],
                'tramite' => (string) $row['tramite'],
            ], $rows),
            'privacy' => 'Los comentarios estan sanitizados y no incluyen nombre, contacto ni enlace ciudadano.',
        ];
    } finally {
        $connection->close();
    }
}

function ixtla_insights_retro_detail(array $arguments): array
{
    $retroId = (int) ($arguments['retro_id'] ?? 0);
    $requirementId = (int) ($arguments['requirement_id'] ?? 0);
    $folio = strtoupper(trim((string) ($arguments['folio'] ?? '')));
    if (($retroId > 0 ? 1 : 0) + ($requirementId > 0 ? 1 : 0) + ($folio !== '' ? 1 : 0) !== 1) {
        throw new InvalidArgumentException('Indica exactamente un id de retro, id de requerimiento o folio.');
    }
    $connection = ixtla_insights_dataset_connection();
    try {
        $query = ixtla_insights_retro_query(['period' => 'all'], $connection);
        if ($retroId > 0) { $query['where'][] = 'rc.id = ?'; $query['types'] .= 'i'; $query['params'][] = $retroId; }
        if ($requirementId > 0) { $query['where'][] = 'r.id = ?'; $query['types'] .= 'i'; $query['params'][] = $requirementId; }
        if ($folio !== '') { $query['where'][] = 'r.folio = ?'; $query['types'] .= 's'; $query['params'][] = $folio; }
        $rows = ixtla_insights_dataset_rows($connection,
            'SELECT rc.id, r.id requirement_id, r.folio, rc.status, rc.calificacion, rc.comentario, rc.created_at, rc.updated_at, '
            . 'r.estatus requirement_status, r.canal channel_id, '
            . 'r.contacto_nombre, r.contacto_telefono, r.contacto_email, r.contacto_calle, r.contacto_cp, r.contacto_colonia, '
            . 'd.nombre department, t.nombre tramite, '
            . "COALESCE(NULLIF(TRIM(CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, ''))), ''), 'Sin responsable') assignee "
            . 'FROM retro_ciudadana rc JOIN requerimiento r ON r.id = rc.requerimiento_id '
            . 'JOIN departamento d ON d.id = r.departamento_id JOIN tramite t ON t.id = r.tramite_id LEFT JOIN empleado e ON e.id = r.asignado_a '
            . 'WHERE ' . implode(' AND ', $query['where']) . ' ORDER BY rc.id DESC LIMIT 1',
            $query['types'], $query['params']);
        if ($rows === []) throw new RuntimeException('La retroalimentacion no existe o esta fuera del alcance autorizado.');
        $row = $rows[0];
        $nullable = static function (mixed $value): ?string {
            $value = trim((string) $value);
            return $value === '' ? null : $value;
        };
        return ['scope' => (string) $query['scope']['label'], 'feedback' => [
            'retro_id' => (int) $row['id'], 'requirement_id' => (int) $row['requirement_id'], 'folio' => (string) $row['folio'],
            'status' => ixtla_insights_retro_status_label((int) $row['status']),
            'rating' => $row['calificacion'] === null ? null : (int) $row['calificacion'],
            'rating_label' => ixtla_insights_retro_rating_label($row['calificacion'] === null ? null : (int) $row['calificacion']),
            'comment' => ixtla_insights_activity_safe_text((string) ($row['comentario'] ?? ''), 1000),
            'created_at' => (string) $row['created_at'],
            'updated_at' => (string) $row['updated_at'],
            'requirement_status' => ixtla_insights_domain_status_label((int) $row['requirement_status']),
            'channel' => ixtla_insights_domain_channel_label((int) $row['channel_id']),
            'department' => (string) $row['department'], 'tramite' => (string) $row['tramite'], 'assignee' => (string) $row['assignee'],
            'citizen' => [
                'name' => $nullable($row['contacto_nombre'] ?? null),
                'phone' => $nullable($row['contacto_telefono'] ?? null),
                'email' => $nullable($row['contacto_email'] ?? null),
                'street' => $nullable($row['contacto_calle'] ?? null),
                'postal_code' => $nullable($row['contacto_cp'] ?? null),
                'neighborhood' => $nullable($row['contacto_colonia'] ?? null),
            ],
        ], 'privacy' => 'El comentario se sanitiza y el contacto se entrega solo para esta retroalimentacion autorizada; no se incluye el enlace ciudadano.'];
    } finally {
        $connection->close();
    }
}

<?php
declare(strict_types=1);

require_once __DIR__ . '/scope_service.php';

function ixtla_insights_dataset_scope_summary(array $arguments): array
{
    $period = ixtla_insights_dataset_period($arguments['period'] ?? 'all');
    $connection = ixtla_insights_dataset_connection();
    try {
        $scope = ixtla_insights_dataset_scope($connection);
        $where = $scope['where'];
        ixtla_insights_dataset_period_clause($period, $where);
        $whereSql = $where ? ' WHERE ' . implode(' AND ', $where) : '';
        $from = ' FROM requerimiento r';

        $total = ixtla_insights_dataset_scalar($connection, 'SELECT COUNT(*)' . $from . $whereSql, $scope['types'], $scope['params']);
        $sql = "SELECT r.estatus AS status_id, COUNT(*) AS value" . $from . $whereSql
            . ' GROUP BY r.estatus ORDER BY r.estatus ASC';
        $rows = ixtla_insights_dataset_rows($connection, $sql, $scope['types'], $scope['params']);
        $statusLabels = [0 => 'Solicitud', 1 => 'Revisión', 2 => 'Asignación', 3 => 'En proceso', 4 => 'Pausado', 5 => 'Cancelado', 6 => 'Finalizado'];
        $byStatus = [];
        foreach ($rows as $row) {
            $statusId = (int) ($row['status_id'] ?? -1);
            $byStatus[] = [
                'status' => $statusLabels[$statusId] ?? 'Sin estatus',
                'value' => (int) ($row['value'] ?? 0),
            ];
        }

        return [
            'dataset' => 'scope_summary',
            'scope' => ['mode' => $scope['mode'], 'label' => $scope['label']],
            'period' => $period,
            'total' => $total,
            'by_status' => $byStatus,
        ];
    } finally {
        $connection->close();
    }
}

function ixtla_insights_dataset_authorized_departments(): array
{
    $connection = ixtla_insights_dataset_connection();
    try {
        $scope = ixtla_insights_dataset_scope($connection);
        if ($scope['mode'] === 'global') {
            $result = $connection->query('SELECT d.id, d.nombre FROM departamento d WHERE d.status = 1 ORDER BY d.nombre ASC');
            $rows = [];
            while ($row = $result?->fetch_assoc()) {
                $rows[] = ['id' => (int) $row['id'], 'nombre' => (string) $row['nombre']];
            }
        } else {
            $sql = 'SELECT DISTINCT d.id, d.nombre FROM requerimiento r JOIN departamento d ON d.id = r.departamento_id '
                . 'WHERE d.status = 1 AND ' . implode(' AND ', $scope['where']) . ' ORDER BY d.nombre ASC';
            $rows = ixtla_insights_dataset_rows($connection, $sql, $scope['types'], $scope['params']);
            $rows = array_map(static fn (array $row): array => ['id' => (int) $row['id'], 'nombre' => (string) $row['nombre']], $rows);
        }
        return [
            'dataset' => 'authorized_departments',
            'scope' => ['mode' => $scope['mode'], 'label' => $scope['label']],
            'departments' => $rows,
        ];
    } finally {
        $connection->close();
    }
}

function ixtla_insights_dataset_requirements_by_department(array $arguments): array
{
    $period = ixtla_insights_dataset_period($arguments['period'] ?? 'all');
    $connection = ixtla_insights_dataset_connection();
    try {
        $scope = ixtla_insights_dataset_scope($connection);
        $where = $scope['where'];
        $where[] = 'd.status = 1';
        ixtla_insights_dataset_period_clause($period, $where);
        $sql = 'SELECT d.id, d.nombre, COUNT(*) AS value FROM requerimiento r '
            . 'JOIN departamento d ON d.id = r.departamento_id '
            . 'WHERE ' . implode(' AND ', $where)
            . ' GROUP BY d.id, d.nombre ORDER BY value DESC, d.nombre ASC LIMIT 50';
        $rows = ixtla_insights_dataset_rows($connection, $sql, $scope['types'], $scope['params']);
        $departments = array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'nombre' => (string) $row['nombre'],
            'value' => (int) $row['value'],
        ], $rows);
        return [
            'dataset' => 'requirements_by_department',
            'scope' => ['mode' => $scope['mode'], 'label' => $scope['label']],
            'period' => $period,
            'total' => array_sum(array_column($departments, 'value')),
            'departments' => $departments,
        ];
    } finally {
        $connection->close();
    }
}

/**
 * Ejecuta el contrato analítico v1. Todos sus valores se validan antes de
 * llegar a SQL; esta función nunca acepta nombres de columna del modelo.
 */
function ixtla_insights_dataset_analytics_query(array $arguments): array
{
    $spec = ixtla_insights_dataset_analytics_spec($arguments);
    $connection = ixtla_insights_dataset_connection();
    try {
        $scope = ixtla_insights_dataset_scope($connection);
        $where = $scope['where'];
        $metric = $spec['metric'];
        $metricWhere = match ($metric) {
            'open_count' => 'r.estatus NOT IN (5, 6)',
            'closed_count' => 'r.estatus = 6',
            'paused_cancelled_count' => 'r.estatus IN (4, 5)',
            default => null,
        };
        if ($metricWhere !== null) {
            $where[] = $metricWhere;
        }
        ixtla_insights_dataset_period_clause_for_field($spec['period']['preset'], $spec['period']['field'], $where);
        $whereSql = $where ? ' WHERE ' . implode(' AND ', $where) : '';
        $from = ' FROM requerimiento r JOIN departamento d ON d.id = r.departamento_id JOIN tramite t ON t.id = r.tramite_id';
        $total = ixtla_insights_dataset_scalar($connection, 'SELECT COUNT(*)' . $from . $whereSql, $scope['types'], $scope['params']);

        $group = $spec['group_by'];
        if ($group === 'none') {
            $items = [[
                'label' => ixtla_insights_dataset_metric_label($metric),
                'value' => $total,
            ]];
        } else {
            $dimension = match ($group) {
                'department' => ['label' => 'd.nombre', 'group' => 'd.id, d.nombre'],
                'tramite' => ['label' => 't.nombre', 'group' => 't.id, t.nombre'],
            };
            $sql = 'SELECT ' . $dimension['label'] . ' AS label, COUNT(*) AS value' . $from . $whereSql
                . ' GROUP BY ' . $dimension['group']
                . ' ORDER BY value ' . $spec['ranking']['sort'] . ', label ASC LIMIT ?';
            $params = $scope['params'];
            $params[] = $spec['ranking']['limit'];
            $items = ixtla_insights_dataset_rows($connection, $sql, $scope['types'] . 'i', $params);
            $items = array_map(static fn (array $row): array => [
                'label' => (string) $row['label'],
                'value' => (int) $row['value'],
            ], $items);
        }

        return [
            'dataset' => 'requirements_analytics_v1',
            'metric' => $metric,
            'metric_label' => ixtla_insights_dataset_metric_label($metric),
            'group_by' => $group,
            'period' => $spec['period'],
            'ranking' => $spec['ranking'],
            'scope' => ['mode' => $scope['mode'], 'label' => $scope['label']],
            'total' => $total,
            'items' => $items,
        ];
    } finally {
        $connection->close();
    }
}

function ixtla_insights_dataset_analytics_spec(array $arguments): array
{
    $metric = strtolower(trim((string) ($arguments['metric'] ?? '')));
    $groupBy = strtolower(trim((string) ($arguments['group_by'] ?? '')));
    $period = is_array($arguments['period'] ?? null) ? $arguments['period'] : [];
    $ranking = is_array($arguments['ranking'] ?? null) ? $arguments['ranking'] : [];
    if (!in_array($metric, ['total', 'open_count', 'closed_count', 'paused_cancelled_count'], true)) {
        throw new InvalidArgumentException('La métrica solicitada no está disponible.');
    }
    if (!in_array($groupBy, ['none', 'department', 'tramite'], true)) {
        throw new InvalidArgumentException('El desglose solicitado no está disponible.');
    }
    $field = strtolower(trim((string) ($period['field'] ?? '')));
    $preset = strtolower(trim((string) ($period['preset'] ?? '')));
    if (!in_array($field, ['created_at', 'closed_at'], true)
        || !in_array($preset, ['all', 'last_7', 'last_30', 'this_month'], true)) {
        throw new InvalidArgumentException('El periodo solicitado no es válido.');
    }
    $sort = strtolower(trim((string) ($ranking['sort'] ?? 'desc')));
    $limit = (int) ($ranking['limit'] ?? 10);
    if (!in_array($sort, ['asc', 'desc'], true)) {
        throw new InvalidArgumentException('El orden solicitado no es válido.');
    }
    return [
        'metric' => $metric,
        'group_by' => $groupBy,
        'period' => ['field' => $field, 'preset' => $preset],
        'ranking' => ['sort' => $sort, 'limit' => min(25, max(1, $limit))],
    ];
}

function ixtla_insights_dataset_period_clause_for_field(string $preset, string $field, array &$where): void
{
    $column = $field === 'closed_at' ? 'r.cerrado_en' : 'r.created_at';
    match ($preset) {
        'last_7' => $where[] = $column . ' >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)',
        'last_30' => $where[] = $column . ' >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)',
        'this_month' => $where[] = $column . " >= DATE_FORMAT(CURDATE(), '%Y-%m-01')",
        default => null,
    };
}

function ixtla_insights_dataset_metric_label(string $metric): string
{
    return match ($metric) {
        'open_count' => 'Requerimientos abiertos',
        'closed_count' => 'Requerimientos finalizados',
        'paused_cancelled_count' => 'Requerimientos pausados/cancelados',
        default => 'Total de requerimientos',
    };
}

function ixtla_insights_dataset_period(mixed $period): string
{
    $value = strtolower(trim((string) $period));
    return in_array($value, ['all', 'last_7', 'last_30', 'this_month'], true) ? $value : 'all';
}

function ixtla_insights_dataset_scalar(mysqli $connection, string $sql, string $types, array $params): int
{
    $statement = $connection->prepare($sql);
    if (!$statement) {
        throw new RuntimeException('No fue posible preparar la consulta de resumen.');
    }
    ixtla_insights_dataset_bind($statement, $types, $params);
    $statement->execute();
    $row = $statement->get_result()?->fetch_row();
    $statement->close();
    return (int) ($row[0] ?? 0);
}

function ixtla_insights_dataset_rows(mysqli $connection, string $sql, string $types, array $params): array
{
    $statement = $connection->prepare($sql);
    if (!$statement) {
        throw new RuntimeException('No fue posible preparar la consulta de Insights.');
    }
    ixtla_insights_dataset_bind($statement, $types, $params);
    $statement->execute();
    $result = $statement->get_result();
    $rows = [];
    while ($row = $result?->fetch_assoc()) {
        $rows[] = $row;
    }
    $statement->close();
    return $rows;
}

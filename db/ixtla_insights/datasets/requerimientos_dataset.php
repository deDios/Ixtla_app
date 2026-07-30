<?php
declare(strict_types=1);

require_once __DIR__ . '/scope_service.php';
require_once __DIR__ . '/../domain_profile.php';

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
        $byStatus = [];
        foreach ($rows as $row) {
            $statusId = (int) ($row['status_id'] ?? -1);
            $byStatus[] = [
                'status' => ixtla_insights_domain_status_label($statusId),
                'value' => (int) ($row['value'] ?? 0),
            ];
        }

        return [
            'dataset' => 'scope_summary',
            'scope' => ['mode' => $scope['mode'], 'label' => $scope['label']],
            'period' => $period,
            'period_label' => ixtla_insights_domain_period_label($period),
            'total' => $total,
            'by_status' => $byStatus,
        ];
    } finally {
        $connection->close();
    }
}

/**
 * Paquete ejecutivo para un director. Reúne en una sola llamada los datos que
 * normalmente requerirían varias herramientas, siempre sobre el scope RBAC.
 */
function ixtla_insights_dataset_operational_snapshot(array $arguments): array
{
    $period = ixtla_insights_dataset_period($arguments['period'] ?? 'all');
    $topLimit = min(10, max(1, (int) ($arguments['top_tramites_limit'] ?? 5)));
    $connection = ixtla_insights_dataset_connection();
    try {
        $scope = ixtla_insights_dataset_scope($connection);
        $where = $scope['where'];
        ixtla_insights_dataset_period_clause($period, $where);
        $whereSql = $where ? ' WHERE ' . implode(' AND ', $where) : '';
        $total = ixtla_insights_dataset_scalar(
            $connection,
            'SELECT COUNT(*) FROM requerimiento r' . $whereSql,
            $scope['types'],
            $scope['params']
        );
        $statusRows = ixtla_insights_dataset_rows(
            $connection,
            'SELECT r.estatus AS status_id, COUNT(*) AS value FROM requerimiento r' . $whereSql . ' GROUP BY r.estatus ORDER BY r.estatus ASC',
            $scope['types'],
            $scope['params']
        );
        $byStatus = array_map(static fn (array $row): array => [
            'status' => ixtla_insights_domain_status_label((int) ($row['status_id'] ?? -1)),
            'value' => (int) ($row['value'] ?? 0),
        ], $statusRows);

        $topRows = ixtla_insights_dataset_rows(
            $connection,
            'SELECT t.nombre AS name, COUNT(*) AS value FROM requerimiento r '
            . 'JOIN tramite t ON t.id = r.tramite_id'
            . $whereSql
            . ' GROUP BY t.id, t.nombre ORDER BY value DESC, name ASC LIMIT ?',
            $scope['types'] . 'i',
            [...$scope['params'], $topLimit]
        );
        $topTramites = array_map(static fn (array $row): array => [
            'name' => (string) $row['name'],
            'value' => (int) $row['value'],
        ], $topRows);

        return [
            'dataset' => 'operational_snapshot',
            'scope' => ['mode' => $scope['mode'], 'label' => $scope['label']],
            'period' => ['field' => 'created_at', 'preset' => $period],
            'period_label' => ixtla_insights_domain_period_label($period),
            'total' => $total,
            'by_status' => $byStatus,
            'top_tramites' => $topTramites,
        ];
    } finally {
        $connection->close();
    }
}

/**
 * Compound diagnosis for operational decisions. Deadline metrics include only
 * active requirements with a registered due date. Scope and soft-delete rules
 * are inherited from ixtla_insights_dataset_scope().
 */
function ixtla_insights_dataset_operational_risk_snapshot(array $arguments): array
{
    $period = ixtla_insights_dataset_risk_period($arguments['period'] ?? 'this_month');
    $topLimit = min(10, max(1, (int) ($arguments['top_tramites_limit'] ?? 5)));
    $dueWindowDays = min(30, max(1, (int) ($arguments['due_window_days'] ?? 7)));
    $connection = ixtla_insights_dataset_connection();
    try {
        $scope = ixtla_insights_dataset_scope($connection);
        $where = $scope['where'];
        ixtla_insights_dataset_period_clause($period, $where);
        $whereSql = ' WHERE ' . implode(' AND ', $where);
        $activeCondition = ixtla_insights_dataset_active_status_condition();
        $summary = ixtla_insights_dataset_rows(
            $connection,
            'SELECT COUNT(*) AS total, '
            . 'SUM(CASE WHEN ' . $activeCondition . ' THEN 1 ELSE 0 END) AS active, '
            . 'SUM(CASE WHEN r.estatus = 4 THEN 1 ELSE 0 END) AS paused, '
            . 'SUM(CASE WHEN r.estatus = 5 THEN 1 ELSE 0 END) AS cancelled, '
            . 'SUM(CASE WHEN r.estatus = 6 THEN 1 ELSE 0 END) AS finalized, '
            . 'SUM(CASE WHEN ' . $activeCondition . ' AND r.asignado_a IS NULL THEN 1 ELSE 0 END) AS unassigned, '
            . 'SUM(CASE WHEN ' . $activeCondition . ' AND r.fecha_limite IS NOT NULL AND DATE(r.fecha_limite) < CURDATE() THEN 1 ELSE 0 END) AS overdue, '
            . 'SUM(CASE WHEN ' . $activeCondition . ' AND r.fecha_limite IS NOT NULL AND DATE(r.fecha_limite) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY) THEN 1 ELSE 0 END) AS due_soon, '
            . 'SUM(CASE WHEN ' . $activeCondition . ' AND r.fecha_limite IS NULL THEN 1 ELSE 0 END) AS without_due_date '
            . 'FROM requerimiento r' . $whereSql,
            'i' . $scope['types'],
            [$dueWindowDays, ...$scope['params']]
        )[0] ?? [];

        return [
            'dataset' => 'operational_risk_snapshot',
            'scope' => ['mode' => $scope['mode'], 'label' => $scope['label']],
            'period' => ['field' => 'created_at', 'preset' => $period],
            'period_label' => ixtla_insights_domain_period_label($period),
            'counts' => ixtla_insights_dataset_counts($summary, ['total', 'active', 'paused', 'cancelled', 'finalized', 'unassigned']),
            'deadline_risk' => [
                'overdue' => (int) ($summary['overdue'] ?? 0),
                'due_within_days' => $dueWindowDays,
                'due_soon' => (int) ($summary['due_soon'] ?? 0),
                'without_due_date' => (int) ($summary['without_due_date'] ?? 0),
                'definition' => 'Only active requirements with a registered due date are included.',
            ],
            'top_tramites' => ixtla_insights_dataset_top_tramites($connection, $scope, $where, $topLimit),
        ];
    } finally {
        $connection->close();
    }
}

/** Compound workload analysis for comparisons, peak days and contributors. */
function ixtla_insights_dataset_workload_trend_snapshot(array $arguments): array
{
    $period = ixtla_insights_dataset_risk_period($arguments['period'] ?? 'last_30');
    $topLimit = min(10, max(1, (int) ($arguments['top_tramites_limit'] ?? 5)));
    $connection = ixtla_insights_dataset_connection();
    try {
        $scope = ixtla_insights_dataset_scope($connection);
        $currentWhere = $scope['where'];
        $previousWhere = $scope['where'];
        ixtla_insights_dataset_period_clause_for_field($period, 'created_at', $currentWhere);
        ixtla_insights_dataset_previous_period_clause($period, 'r.created_at', $previousWhere);
        $current = ixtla_insights_dataset_scalar($connection, 'SELECT COUNT(*) FROM requerimiento r WHERE ' . implode(' AND ', $currentWhere), $scope['types'], $scope['params']);
        $previous = ixtla_insights_dataset_scalar($connection, 'SELECT COUNT(*) FROM requerimiento r WHERE ' . implode(' AND ', $previousWhere), $scope['types'], $scope['params']);
        $dailyRows = ixtla_insights_dataset_rows(
            $connection,
            'SELECT DATE(r.created_at) AS date, COUNT(*) AS value FROM requerimiento r WHERE ' . implode(' AND ', $currentWhere)
            . ' GROUP BY DATE(r.created_at) ORDER BY value DESC, date ASC LIMIT 5',
            $scope['types'],
            $scope['params']
        );

        return [
            'dataset' => 'workload_trend_snapshot',
            'scope' => ['mode' => $scope['mode'], 'label' => $scope['label']],
            'period' => ['field' => 'created_at', 'preset' => $period],
            'period_label' => ixtla_insights_domain_period_label($period),
            'comparison' => [
                'current_total' => $current,
                'previous_total' => $previous,
                'difference' => $current - $previous,
                'percentage_change' => $previous === 0 ? null : round((($current - $previous) / $previous) * 100, 1),
            ],
            'peak_days' => array_map(static fn (array $row): array => ['date' => (string) $row['date'], 'value' => (int) $row['value']], $dailyRows),
            'top_tramites' => ixtla_insights_dataset_top_tramites($connection, $scope, $currentWhere, $topLimit),
        ];
    } finally {
        $connection->close();
    }
}

/** Compound backlog analysis for active-work concentration and aging. */
function ixtla_insights_dataset_backlog_risk_snapshot(array $arguments): array
{
    $topLimit = min(10, max(1, (int) ($arguments['top_limit'] ?? 5)));
    $connection = ixtla_insights_dataset_connection();
    try {
        $scope = ixtla_insights_dataset_scope($connection);
        $where = $scope['where'];
        $where[] = ixtla_insights_dataset_active_status_condition();
        $whereSql = ' WHERE ' . implode(' AND ', $where);
        $summary = ixtla_insights_dataset_rows(
            $connection,
            'SELECT COUNT(*) AS active, SUM(CASE WHEN r.asignado_a IS NULL THEN 1 ELSE 0 END) AS unassigned, '
            . 'SUM(CASE WHEN TIMESTAMPDIFF(DAY, r.created_at, NOW()) <= 7 THEN 1 ELSE 0 END) AS age_0_7, '
            . 'SUM(CASE WHEN TIMESTAMPDIFF(DAY, r.created_at, NOW()) BETWEEN 8 AND 15 THEN 1 ELSE 0 END) AS age_8_15, '
            . 'SUM(CASE WHEN TIMESTAMPDIFF(DAY, r.created_at, NOW()) BETWEEN 16 AND 30 THEN 1 ELSE 0 END) AS age_16_30, '
            . 'SUM(CASE WHEN TIMESTAMPDIFF(DAY, r.created_at, NOW()) > 30 THEN 1 ELSE 0 END) AS age_31_plus '
            . 'FROM requerimiento r' . $whereSql,
            $scope['types'],
            $scope['params']
        )[0] ?? [];
        $priorityRows = ixtla_insights_dataset_rows(
            $connection,
            'SELECT r.prioridad AS priority_id, COUNT(*) AS value FROM requerimiento r' . $whereSql
            . ' GROUP BY r.prioridad ORDER BY r.prioridad DESC',
            $scope['types'],
            $scope['params']
        );
        $assigneeRows = ixtla_insights_dataset_rows(
            $connection,
            "SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, ''))), ''), 'Sin asignar') AS name, COUNT(*) AS value "
            . 'FROM requerimiento r LEFT JOIN empleado e ON e.id = r.asignado_a' . $whereSql
            . ' GROUP BY name ORDER BY value DESC, name ASC LIMIT ?',
            $scope['types'] . 'i',
            [...$scope['params'], $topLimit]
        );

        return [
            'dataset' => 'backlog_risk_snapshot',
            'scope' => ['mode' => $scope['mode'], 'label' => $scope['label']],
            'as_of' => date('Y-m-d'),
            'counts' => ixtla_insights_dataset_counts($summary, ['active', 'unassigned']),
            'aging' => [
                ['label' => '0 a 7 dias', 'value' => (int) ($summary['age_0_7'] ?? 0)],
                ['label' => '8 a 15 dias', 'value' => (int) ($summary['age_8_15'] ?? 0)],
                ['label' => '16 a 30 dias', 'value' => (int) ($summary['age_16_30'] ?? 0)],
                ['label' => 'Mas de 30 dias', 'value' => (int) ($summary['age_31_plus'] ?? 0)],
            ],
            'by_priority' => array_map(static fn (array $row): array => [
                'priority' => ixtla_insights_domain_priority_label((int) $row['priority_id']),
                'value' => (int) $row['value'],
            ], $priorityRows),
            'top_assignees' => array_map(static fn (array $row): array => ['name' => (string) $row['name'], 'value' => (int) $row['value']], $assigneeRows),
            'top_tramites' => ixtla_insights_dataset_top_tramites($connection, $scope, $where, $topLimit),
        ];
    } finally {
        $connection->close();
    }
}

/** Distribución de pendientes activos por antigüedad, dentro del scope RBAC. */
function ixtla_insights_dataset_backlog_aging(): array
{
    $connection = ixtla_insights_dataset_connection();
    try {
        $scope = ixtla_insights_dataset_scope($connection);
        $where = $scope['where'];
        $where[] = ixtla_insights_dataset_active_status_condition();
        $whereSql = ' WHERE ' . implode(' AND ', $where);
        $rows = ixtla_insights_dataset_rows(
            $connection,
            'SELECT CASE '
            . 'WHEN TIMESTAMPDIFF(DAY, r.created_at, NOW()) <= 7 THEN "0_7" '
            . 'WHEN TIMESTAMPDIFF(DAY, r.created_at, NOW()) <= 15 THEN "8_15" '
            . 'WHEN TIMESTAMPDIFF(DAY, r.created_at, NOW()) <= 30 THEN "16_30" '
            . 'ELSE "31_plus" END AS bucket, COUNT(*) AS value '
            . 'FROM requerimiento r' . $whereSql . ' GROUP BY bucket',
            $scope['types'],
            $scope['params']
        );
        $values = ['0_7' => 0, '8_15' => 0, '16_30' => 0, '31_plus' => 0];
        foreach ($rows as $row) {
            $bucket = (string) ($row['bucket'] ?? '');
            if (array_key_exists($bucket, $values)) {
                $values[$bucket] = (int) ($row['value'] ?? 0);
            }
        }
        return [
            'dataset' => 'backlog_aging',
            'scope' => ['mode' => $scope['mode'], 'label' => $scope['label']],
            'as_of' => date('Y-m-d'),
            'open_statuses' => array_map(
                static fn (int $statusId): string => ixtla_insights_domain_status_label($statusId),
                ixtla_insights_domain_status_ids('active')
            ),
            'buckets' => [
                ['label' => '0 a 7 días', 'value' => $values['0_7']],
                ['label' => '8 a 15 días', 'value' => $values['8_15']],
                ['label' => '16 a 30 días', 'value' => $values['16_30']],
                ['label' => 'Más de 30 días', 'value' => $values['31_plus']],
            ],
        ];
    } finally {
        $connection->close();
    }
}

/** Compara una métrica del periodo actual contra su periodo inmediato previo. */
function ixtla_insights_dataset_period_comparison(array $arguments): array
{
    $metric = strtolower(trim((string) ($arguments['metric'] ?? '')));
    $period = strtolower(trim((string) ($arguments['period'] ?? '')));
    if (!in_array($metric, ['total', 'open_count', 'closed_count'], true)) {
        throw new InvalidArgumentException('La métrica de comparación no está disponible.');
    }
    if (!in_array($period, ['last_7', 'last_30', 'this_month'], true)) {
        throw new InvalidArgumentException('El periodo de comparación no está disponible.');
    }
    $connection = ixtla_insights_dataset_connection();
    try {
        $scope = ixtla_insights_dataset_scope($connection);
        $currentWhere = $scope['where'];
        $previousWhere = $scope['where'];
        $field = $metric === 'closed_count' ? 'r.cerrado_en' : 'r.created_at';
        if ($metric === 'open_count') {
            $currentWhere[] = 'r.estatus NOT IN (5, 6)';
            $previousWhere[] = 'r.estatus NOT IN (5, 6)';
        } elseif ($metric === 'closed_count') {
            $currentWhere[] = 'r.estatus = 6';
            $previousWhere[] = 'r.estatus = 6';
        }
        ixtla_insights_dataset_period_clause_for_field($period, $metric === 'closed_count' ? 'closed_at' : 'created_at', $currentWhere);
        ixtla_insights_dataset_previous_period_clause($period, $field, $previousWhere);
        $current = ixtla_insights_dataset_scalar($connection, 'SELECT COUNT(*) FROM requerimiento r WHERE ' . implode(' AND ', $currentWhere), $scope['types'], $scope['params']);
        $previous = ixtla_insights_dataset_scalar($connection, 'SELECT COUNT(*) FROM requerimiento r WHERE ' . implode(' AND ', $previousWhere), $scope['types'], $scope['params']);
        $difference = $current - $previous;
        return [
            'dataset' => 'period_comparison',
            'scope' => ['mode' => $scope['mode'], 'label' => $scope['label']],
            'metric' => $metric,
            'metric_label' => ixtla_insights_domain_metric_label($metric),
            'period' => $period,
            'period_label' => ixtla_insights_domain_period_label($period),
            'current_value' => $current,
            'previous_value' => $previous,
            'difference' => $difference,
            'percentage_change' => $previous === 0 ? null : round(($difference / $previous) * 100, 1),
        ];
    } finally {
        $connection->close();
    }
}

/** Serie diaria de requerimientos creados para identificar tendencia de carga. */
function ixtla_insights_dataset_requirements_trend(array $arguments): array
{
    $period = strtolower(trim((string) ($arguments['period'] ?? '')));
    if (!in_array($period, ['last_7', 'last_30', 'this_month'], true)) {
        throw new InvalidArgumentException('El periodo de tendencia no está disponible.');
    }
    $connection = ixtla_insights_dataset_connection();
    try {
        $scope = ixtla_insights_dataset_scope($connection);
        $where = $scope['where'];
        ixtla_insights_dataset_period_clause_for_field($period, 'created_at', $where);
        $rows = ixtla_insights_dataset_rows(
            $connection,
            'SELECT DATE(r.created_at) AS date, COUNT(*) AS value FROM requerimiento r WHERE '
            . implode(' AND ', $where)
            . ' GROUP BY DATE(r.created_at) ORDER BY date ASC',
            $scope['types'],
            $scope['params']
        );
        return [
            'dataset' => 'requirements_trend',
            'scope' => ['mode' => $scope['mode'], 'label' => $scope['label']],
            'period' => ['field' => 'created_at', 'preset' => $period],
            'period_label' => ixtla_insights_domain_period_label($period),
            'granularity' => 'day',
            'items' => array_map(static fn (array $row): array => [
                'date' => (string) $row['date'],
                'value' => (int) $row['value'],
            ], $rows),
        ];
    } finally {
        $connection->close();
    }
}

/** Ranking seguro por una dimensión operativa aprobada. */
function ixtla_insights_dataset_workload_breakdown(array $arguments): array
{
    $dimension = strtolower(trim((string) ($arguments['dimension'] ?? '')));
    $period = ixtla_insights_dataset_period($arguments['period'] ?? 'all');
    $limit = min(20, max(1, (int) ($arguments['limit'] ?? 10)));
    $dimensions = [
        'tramite' => [
            'label' => 't.nombre',
            'from' => ' JOIN tramite t ON t.id = r.tramite_id',
            'group' => 't.id, t.nombre',
        ],
        'priority' => [
            'label' => 'r.prioridad',
            'from' => '',
            'group' => 'r.prioridad',
        ],
        'channel' => [
            'label' => "CASE WHEN r.canal IS NULL THEN 'Sin canal' ELSE CONCAT('Canal ', r.canal) END",
            'from' => '',
            'group' => 'r.canal',
        ],
        'colonia' => [
            'label' => "COALESCE(NULLIF(TRIM(r.contacto_colonia), ''), 'Sin colonia')",
            'from' => '',
            'group' => "COALESCE(NULLIF(TRIM(r.contacto_colonia), ''), 'Sin colonia')",
        ],
        'assignee' => [
            'label' => "COALESCE(NULLIF(TRIM(CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, ''))), ''), 'Sin asignar')",
            'from' => ' LEFT JOIN empleado e ON e.id = r.asignado_a',
            'group' => "COALESCE(NULLIF(TRIM(CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, ''))), ''), 'Sin asignar')",
        ],
    ];
    if (!isset($dimensions[$dimension])) {
        throw new InvalidArgumentException('La dimensión solicitada no está disponible.');
    }
    $spec = $dimensions[$dimension];
    $connection = ixtla_insights_dataset_connection();
    try {
        $scope = ixtla_insights_dataset_scope($connection);
        $where = $scope['where'];
        ixtla_insights_dataset_period_clause($period, $where);
        $rows = ixtla_insights_dataset_rows(
            $connection,
            'SELECT ' . $spec['label'] . ' AS label, COUNT(*) AS value FROM requerimiento r'
            . $spec['from']
            . ' WHERE ' . implode(' AND ', $where)
            . ' GROUP BY ' . $spec['group']
            . ' ORDER BY value DESC, label ASC LIMIT ?',
            $scope['types'] . 'i',
            [...$scope['params'], $limit]
        );
        return [
            'dataset' => 'workload_breakdown',
            'scope' => ['mode' => $scope['mode'], 'label' => $scope['label']],
            'dimension' => $dimension,
            'period' => ['field' => 'created_at', 'preset' => $period],
            'period_label' => ixtla_insights_domain_period_label($period),
            'items' => array_map(static fn (array $row) => [
                'label' => $dimension === 'priority'
                    ? ixtla_insights_domain_priority_label((int) $row['label'])
                    : (string) $row['label'],
                'value' => (int) $row['value'],
            ], $rows),
        ];
    } finally {
        $connection->close();
    }
}

/** Lista operativa acotada de pendientes activos con antigüedad mínima. */
function ixtla_insights_dataset_overdue_requirements(array $arguments): array
{
    $minimumDays = min(365, max(1, (int) ($arguments['minimum_days'] ?? 15)));
    $limit = min(20, max(1, (int) ($arguments['limit'] ?? 10)));
    $connection = ixtla_insights_dataset_connection();
    try {
        $scope = ixtla_insights_dataset_scope($connection);
        $where = $scope['where'];
        $where[] = ixtla_insights_dataset_active_status_condition();
        $where[] = 'TIMESTAMPDIFF(DAY, r.created_at, NOW()) >= ?';
        $params = [...$scope['params'], $minimumDays, $limit];
        $types = $scope['types'] . 'ii';
        $rows = ixtla_insights_dataset_rows(
            $connection,
            'SELECT r.id, r.created_at, TIMESTAMPDIFF(DAY, r.created_at, NOW()) AS age_days, '
            . 'r.prioridad AS priority_id, '
            . 't.nombre AS tramite, '
            . "COALESCE(NULLIF(TRIM(CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, ''))), ''), 'Sin asignar') AS assignee "
            . 'FROM requerimiento r JOIN tramite t ON t.id = r.tramite_id '
            . 'LEFT JOIN empleado e ON e.id = r.asignado_a '
            . 'WHERE ' . implode(' AND ', $where)
            . ' ORDER BY age_days DESC, r.id ASC LIMIT ?',
            $types,
            $params
        );
        return [
            'dataset' => 'overdue_requirements',
            'scope' => ['mode' => $scope['mode'], 'label' => $scope['label']],
            'minimum_days' => $minimumDays,
            'items' => array_map(static fn (array $row): array => [
                'id' => (int) $row['id'],
                'created_at' => (string) $row['created_at'],
                'age_days' => (int) $row['age_days'],
                'priority' => ixtla_insights_domain_priority_label((int) $row['priority_id']),
                'tramite' => (string) $row['tramite'],
                'assignee' => (string) $row['assignee'],
            ], $rows),
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
            'period_label' => ixtla_insights_domain_period_label($period),
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
            'period_label' => ixtla_insights_domain_period_label($spec['period']['preset']),
            'ranking' => $spec['ranking'],
            'scope' => ['mode' => $scope['mode'], 'label' => $scope['label']],
            'total' => $total,
            'items' => $items,
        ];
    } finally {
        $connection->close();
    }
}

function ixtla_insights_dataset_latest_requirement(array $arguments = []): array
{
    $department = ixtla_insights_dataset_department_name($arguments['department'] ?? null);
    $connection = ixtla_insights_dataset_connection();
    try {
        $scope = ixtla_insights_dataset_scope($connection);
        $where = $scope['where'];
        $types = $scope['types'];
        $params = $scope['params'];
        if ($department !== null) {
            // El valor se enlaza y siempre se combina con el alcance RBAC.
            $where[] = 'd.nombre = ?';
            $types .= 's';
            $params[] = $department;
        }
        $sql = 'SELECT r.id, r.created_at, d.nombre AS department, t.nombre AS tramite '
            . 'FROM requerimiento r JOIN departamento d ON d.id = r.departamento_id '
            . 'JOIN tramite t ON t.id = r.tramite_id '
            . ($where ? 'WHERE ' . implode(' AND ', $where) . ' ' : '')
            . 'ORDER BY r.created_at DESC, r.id DESC LIMIT 1';
        $rows = ixtla_insights_dataset_rows($connection, $sql, $types, $params);
        $row = $rows[0] ?? null;
        return [
            'dataset' => 'latest_requirement',
            'scope' => ['mode' => $scope['mode'], 'label' => $scope['label']],
            'department_filter' => $department,
            'requirement' => $row === null ? null : [
                'id' => (int) $row['id'],
                'department' => (string) $row['department'],
                'tramite' => (string) $row['tramite'],
                'created_at' => (string) $row['created_at'],
            ],
        ];
    } finally {
        $connection->close();
    }
}

function ixtla_insights_dataset_department_name(mixed $value): ?string
{
    if ($value === null) {
        return null;
    }

    $department = trim((string) $value);
    if ($department === '' || mb_strlen($department) > 160) {
        throw new InvalidArgumentException('El filtro de departamento no es válido.');
    }

    return $department;
}

function ixtla_insights_dataset_resolution_time_by_department(array $arguments): array
{
    $period = ixtla_insights_dataset_period($arguments['period'] ?? 'all');
    $connection = ixtla_insights_dataset_connection();
    try {
        $scope = ixtla_insights_dataset_scope($connection);
        $where = $scope['where'];
        $where[] = 'r.estatus = 6';
        $where[] = 'r.cerrado_en IS NOT NULL';
        $where[] = 'r.cerrado_en >= r.created_at';
        ixtla_insights_dataset_period_clause_for_field($period, 'closed_at', $where);
        $sql = 'SELECT d.id, d.nombre, AVG(TIMESTAMPDIFF(HOUR, r.created_at, r.cerrado_en) / 24) AS value '
            . 'FROM requerimiento r JOIN departamento d ON d.id = r.departamento_id '
            . 'WHERE ' . implode(' AND ', $where)
            . ' GROUP BY d.id, d.nombre ORDER BY value ASC, d.nombre ASC LIMIT 50';
        $rows = ixtla_insights_dataset_rows($connection, $sql, $scope['types'], $scope['params']);
        $departments = array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'nombre' => (string) $row['nombre'],
            'average_days' => round((float) $row['value'], 1),
        ], $rows);
        return [
            'dataset' => 'resolution_time_by_department',
            'scope' => ['mode' => $scope['mode'], 'label' => $scope['label']],
            'period' => ['field' => 'closed_at', 'preset' => $period],
            'period_label' => ixtla_insights_domain_period_label($period),
            'departments' => $departments,
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

function ixtla_insights_dataset_previous_period_clause(string $period, string $field, array &$where): void
{
    match ($period) {
        'last_7' => $where[] = $field . ' >= DATE_SUB(CURDATE(), INTERVAL 13 DAY) AND ' . $field . ' < DATE_SUB(CURDATE(), INTERVAL 6 DAY)',
        'last_30' => $where[] = $field . ' >= DATE_SUB(CURDATE(), INTERVAL 59 DAY) AND ' . $field . ' < DATE_SUB(CURDATE(), INTERVAL 29 DAY)',
        'this_month' => $where[] = $field . " >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01') AND " . $field . " < DATE_FORMAT(CURDATE(), '%Y-%m-01')",
        default => throw new InvalidArgumentException('El periodo previo no es válido.'),
    };
}

function ixtla_insights_dataset_metric_label(string $metric): string
{
    return ixtla_insights_domain_metric_label($metric);
}

/**
 * Construye una condición SQL únicamente desde el grupo estático del perfil.
 * Los IDs se validan como enteros antes de interpolarlos; el modelo nunca
 * participa en esta construcción.
 */
function ixtla_insights_dataset_active_status_condition(): string
{
    $statusIds = ixtla_insights_domain_status_ids('active');
    if ($statusIds === []) {
        throw new LogicException('El perfil de dominio no define estados activos.');
    }
    return 'r.estatus IN (' . implode(', ', $statusIds) . ')';
}

/** @return array<string, int> */
function ixtla_insights_dataset_counts(array $source, array $keys): array
{
    $counts = [];
    foreach ($keys as $key) {
        $counts[(string) $key] = (int) ($source[$key] ?? 0);
    }
    return $counts;
}

/**
 * Returns the highest-volume procedures for a prevalidated where clause.
 * The caller supplies a scope obtained on the same connection, preserving RBAC.
 */
function ixtla_insights_dataset_top_tramites(mysqli $connection, array $scope, array $where, int $limit): array
{
    $rows = ixtla_insights_dataset_rows(
        $connection,
        'SELECT t.nombre AS name, COUNT(*) AS value FROM requerimiento r '
        . 'JOIN tramite t ON t.id = r.tramite_id WHERE ' . implode(' AND ', $where)
        . ' GROUP BY t.id, t.nombre ORDER BY value DESC, name ASC LIMIT ?',
        (string) $scope['types'] . 'i',
        [...$scope['params'], $limit]
    );
    return array_map(static fn (array $row): array => [
        'name' => (string) $row['name'],
        'value' => (int) $row['value'],
    ], $rows);
}

/** Limits compound snapshots to periods that have an unambiguous comparison. */
function ixtla_insights_dataset_risk_period(mixed $period): string
{
    $value = strtolower(trim((string) $period));
    if (!in_array($value, ['last_7', 'last_30', 'this_month'], true)) {
        throw new InvalidArgumentException('El periodo del diagnóstico no está disponible.');
    }
    return $value;
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

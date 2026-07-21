<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../conn/conn_db.php';
require_once __DIR__ . '/../WEB/tools_105277.php';

$config = ixtla_insights_bootstrap(['POST']);
if (($config['allow_database_queries'] ?? false) !== true) {
    ixtla_insights_json(['ok' => false, 'error' => 'Las agregaciones de Insights están deshabilitadas.'], 503);
}

$body = ixtla_insights_request_body();
$plan = is_array($body['plan'] ?? null) ? $body['plan'] : [];
$con = conectar();
if (!$con instanceof mysqli) {
    ixtla_insights_json(['ok' => false, 'error' => 'No fue posible conectar con la fuente analítica.'], 503);
}
$con->set_charset('utf8mb4');
$con->query("SET time_zone='-06:00'");

try {
    $response = ixtla_insights_aggregate_requerimientos($con, $plan);
    $con->close();
    ixtla_insights_json(['ok' => true] + $response);
} catch (InvalidArgumentException $error) {
    $con->close();
    ixtla_insights_json(['ok' => false, 'error' => $error->getMessage()], 422);
} catch (Throwable $error) {
    error_log('[IxtlaInsights analytics] ' . $error->getMessage());
    $con->close();
    ixtla_insights_json(['ok' => false, 'error' => 'No fue posible calcular la visualización solicitada.'], 500);
}

function ixtla_insights_aggregate_requerimientos(mysqli $con, array $rawPlan): array
{
    $plan = ixtla_insights_normalize_plan($rawPlan);
    $session = $GLOBALS['ix_session'] ?? [];
    $empleadoId = (int) ($session['empleado_id'] ?? $session['id_empleado'] ?? 0);
    if ($empleadoId <= 0) {
        throw new InvalidArgumentException('No fue posible identificar al usuario de Insights.');
    }

    $rbac = rbac_compute_by_empleado_id($con, $empleadoId, ['presidencia_dept_ids' => [6]]);
    if (!is_array($rbac)) {
        throw new InvalidArgumentException('No fue posible resolver el alcance autorizado.');
    }

    $where = [];
    $params = [];
    $types = '';
    $scope = ixtla_insights_apply_scope($con, $rbac, $where, $params, $types);
    ixtla_insights_apply_visibility($rbac, $where);
    ixtla_insights_apply_metric($plan['metric'], $where);
    ixtla_insights_apply_filters($plan['filters'], $where, $params, $types);
    ixtla_insights_apply_period($plan['period'], $where);

    $joins = ' FROM requerimiento r JOIN departamento d ON d.id = r.departamento_id JOIN tramite t ON t.id = r.tramite_id';
    $whereSql = $where ? ' WHERE ' . implode(' AND ', $where) : '';
    $total = ixtla_insights_scalar($con, 'SELECT COUNT(*) AS total' . $joins . $whereSql, $types, $params);

    if ($plan['kind'] === 'kpi') {
        $value = ixtla_insights_kpi_value($con, $plan['metric'], $joins, $whereSql, $types, $params, $total);
        return [
            'plan' => $plan,
            'scope' => $scope,
            'total' => $value,
            'items' => [['label' => ixtla_insights_metric_label($plan['metric']), 'value' => $value]],
            'aggregated_at' => gmdate('c'),
        ];
    }

    $dimension = ixtla_insights_dimension_sql($plan['dimension']);
    $limit = $plan['limit'];
    $sql = 'SELECT ' . $dimension['label'] . ' AS label, COUNT(*) AS value' . $joins . $whereSql
        . ' GROUP BY ' . $dimension['group']
        . ' ORDER BY ' . ixtla_insights_sort_sql($plan['sort'], $dimension['date'])
        . ' LIMIT ?';
    $queryParams = $params;
    $queryParams[] = $limit;
    $queryTypes = $types . 'i';
    $items = ixtla_insights_rows($con, $sql, $queryTypes, $queryParams);

    return [
        'plan' => $plan,
        'scope' => $scope,
        'total' => $total,
        'items' => $items,
        'aggregated_at' => gmdate('c'),
    ];
}

function ixtla_insights_normalize_plan(array $raw): array
{
    $kind = strtolower(trim((string) ($raw['kind'] ?? $raw['chart'] ?? 'bar')));
    $metric = strtolower(trim((string) ($raw['metric'] ?? 'total')));
    $dimension = strtolower(trim((string) ($raw['dimension'] ?? 'estatus')));
    $period = strtolower(trim((string) ($raw['period'] ?? 'all')));
    $sort = strtolower(trim((string) ($raw['sort'] ?? 'desc')));
    $limit = (int) ($raw['limit'] ?? 10);

    if (!in_array($kind, ['kpi', 'bar', 'donut', 'line', 'area', 'table', 'funnel'], true)) {
        throw new InvalidArgumentException('El tipo de visualización no está permitido.');
    }
    if (!in_array($metric, ['total', 'abiertos', 'finalizados', 'pausados_cancelados', 'pausados', 'cancelados', 'cerrados', 'promedio_semanal', 'tiempo_resolucion'], true)) {
        throw new InvalidArgumentException('La métrica solicitada no está permitida.');
    }
    if ($kind !== 'kpi' && in_array($metric, ['promedio_semanal', 'tiempo_resolucion'], true)) {
        throw new InvalidArgumentException('La métrica solicitada solo está disponible como indicador.');
    }
    if (!in_array($dimension, ['estatus', 'tramite', 'departamento', 'fecha'], true)) {
        throw new InvalidArgumentException('La dimensión solicitada no está permitida.');
    }
    if ($kind !== 'kpi' && $dimension === 'estatus' && in_array($metric, ['finalizados', 'pausados', 'cancelados', 'pausados_cancelados'], true)) {
        throw new InvalidArgumentException('El estatus ya esta definido por la metrica solicitada.');
    }
    if (!in_array($period, ['all', 'last_7', 'last_30', 'this_month'], true)) {
        $period = 'all';
    }
    if (!in_array($sort, ['desc', 'asc', 'chronological'], true)) {
        $sort = 'desc';
    }

    $filters = [];
    foreach (is_array($raw['filters'] ?? null) ? $raw['filters'] : [] as $filter) {
        if (!is_array($filter)) {
            continue;
        }
        $field = strtolower(trim((string) ($filter['field'] ?? '')));
        $value = trim((string) ($filter['value'] ?? ''));
        if ($value === '' || !in_array($field, ['departamento', 'tramite', 'estatus'], true)) {
            continue;
        }
        $filters[] = ['field' => $field, 'value' => ixtla_insights_truncate($value, 120)];
    }

    return [
        'kind' => $kind,
        'metric' => $metric,
        'dimension' => $dimension,
        'period' => $period,
        'filters' => array_slice($filters, 0, 50),
        'sort' => $dimension === 'fecha' ? 'chronological' : $sort,
        'limit' => $kind === 'kpi' ? 1 : min(50, max(1, $limit)),
    ];
}

function ixtla_insights_apply_scope(mysqli $con, array $rbac, array &$where, array &$params, string &$types): array
{
    $scope = $rbac['scope'] ?? [];
    $empleado = $rbac['empleado'] ?? [];
    $empleadoId = (int) ($empleado['id'] ?? 0);
    if (!empty($scope['global'])) {
        return ['mode' => 'global', 'label' => 'Vista global autorizada'];
    }
    if (!empty($scope['department'])) {
        $departamentoId = (int) ($empleado['departamento_id'] ?? 0);
        if ($departamentoId <= 0) {
            throw new InvalidArgumentException('El usuario no tiene un departamento asignado.');
        }
        $where[] = 'r.departamento_id = ?';
        $params[] = $departamentoId;
        $types .= 'i';
        return ['mode' => 'departamento', 'label' => 'Departamento autorizado'];
    }
    if (!empty($scope['team'])) {
        $flags = $rbac['flags'] ?? [];
        if (!empty($flags['is_jefe'])) {
            $ids = ixtla_insights_team_ids($con, $empleadoId, false);
            if (!$ids) {
                $ids = [$empleadoId];
            }
            $where[] = 'r.asignado_a IN (' . implode(',', array_fill(0, count($ids), '?')) . ')';
            foreach ($ids as $id) {
                $params[] = $id;
                $types .= 'i';
            }
            return ['mode' => 'equipo', 'label' => 'Usuario y reportes directos autorizados'];
        }
    }
    $where[] = 'r.asignado_a = ?';
    $params[] = $empleadoId;
    $types .= 'i';
    return ['mode' => 'propio', 'label' => 'Requerimientos asignados al usuario'];
}

function ixtla_insights_team_ids(mysqli $con, int $empleadoId, bool $recursive = false): array
{
    $result = $con->query('SELECT e.id, c.reporta_a FROM empleado e LEFT JOIN empleado_cuenta c ON c.empleado_id = e.id WHERE e.status = 1');
    if (!$result) {
        return [$empleadoId];
    }
    $children = [];
    while ($row = $result->fetch_assoc()) {
        $manager = (int) ($row['reporta_a'] ?? 0);
        if ($manager > 0) {
            $children[$manager][] = (int) $row['id'];
        }
    }
    if (!$recursive) {
        return array_values(array_unique(array_merge([$empleadoId], $children[$empleadoId] ?? [])));
    }
    $ids = [];
    $pending = [$empleadoId];
    while ($pending) {
        $id = array_shift($pending);
        if ($id <= 0 || in_array($id, $ids, true)) {
            continue;
        }
        $ids[] = $id;
        foreach ($children[$id] ?? [] as $child) {
            $pending[] = $child;
        }
    }
    return $ids;
}

function ixtla_insights_apply_visibility(array $rbac, array &$where): void
{
    $flags = $rbac['flags'] ?? [];
    if (!empty($flags['is_director']) || !empty($flags['is_primera_linea']) || !empty($flags['is_jefe']) || !empty($flags['is_analista'])) {
        $where[] = 'r.estatus NOT IN (0, 1)';
    }
}

function ixtla_insights_apply_metric(string $metric, array &$where): void
{
    if ($metric === 'finalizados') {
        $where[] = 'r.estatus = 6';
    } elseif ($metric === 'abiertos') {
        $where[] = 'r.estatus NOT IN (5, 6)';
    } elseif ($metric === 'pausados') {
        $where[] = 'r.estatus = 4';
    } elseif ($metric === 'cancelados') {
        $where[] = 'r.estatus = 5';
    } elseif ($metric === 'pausados_cancelados') {
        $where[] = 'r.estatus IN (4, 5)';
    } elseif ($metric === 'cerrados') {
        $where[] = 'r.estatus IN (5, 6)';
    } elseif ($metric === 'tiempo_resolucion') {
        $where[] = 'r.estatus = 6';
        $where[] = 'r.cerrado_en IS NOT NULL';
    }
}

function ixtla_insights_apply_period(string $period, array &$where): void
{
    if ($period === 'last_7') {
        $where[] = 'r.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)';
    } elseif ($period === 'last_30') {
        $where[] = 'r.created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)';
    } elseif ($period === 'this_month') {
        $where[] = "r.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')";
    }
}

function ixtla_insights_kpi_value(mysqli $con, string $metric, string $joins, string $whereSql, string $types, array $params, int $total): float|int
{
    if ($metric === 'promedio_semanal') {
        $sql = 'SELECT AVG(weekly_total) AS value FROM (SELECT COUNT(*) AS weekly_total' . $joins . $whereSql
            . ' GROUP BY YEARWEEK(r.created_at, 1)) AS weekly_values';
        return round(ixtla_insights_float_scalar($con, $sql, $types, $params), 1);
    }
    if ($metric === 'tiempo_resolucion') {
        $sql = 'SELECT AVG(TIMESTAMPDIFF(HOUR, r.created_at, r.cerrado_en) / 24) AS value' . $joins . $whereSql;
        return round(ixtla_insights_float_scalar($con, $sql, $types, $params), 1);
    }
    return $total;
}

function ixtla_insights_metric_label(string $metric): string
{
    return match ($metric) {
        'abiertos' => 'Requerimientos abiertos',
        'finalizados' => 'Requerimientos finalizados',
        'pausados_cancelados' => 'Requerimientos pausados/cancelados',
        'pausados' => 'Requerimientos pausados',
        'cancelados' => 'Requerimientos cancelados',
        'cerrados' => 'Requerimientos cerrados',
        'promedio_semanal' => 'Promedio semanal',
        'tiempo_resolucion' => 'Tiempo promedio de resolución (días)',
        default => 'Total de requerimientos',
    };
}

function ixtla_insights_apply_filters(array $filters, array &$where, array &$params, string &$types): void
{
    $statusMap = [
        'solicitud' => 0,
        'revision' => 1,
        'revisión' => 1,
        'asignacion' => 2,
        'asignación' => 2,
        'proceso' => 3,
        'en proceso' => 3,
        'pausado' => 4,
        'cancelado' => 5,
        'finalizado' => 6,
    ];
    $departments = [];
    foreach ($filters as $filter) {
        if ($filter['field'] === 'departamento') {
            $departments[] = $filter['value'];
        } elseif ($filter['field'] === 'tramite') {
            $where[] = 't.nombre LIKE CONCAT(\'%\', ?, \'%\')';
            $params[] = $filter['value'];
            $types .= 's';
        } elseif ($filter['field'] === 'estatus') {
            $key = mb_strtolower($filter['value']);
            if (!array_key_exists($key, $statusMap)) {
                throw new InvalidArgumentException('El estatus indicado no está disponible.');
            }
            $where[] = 'r.estatus = ?';
            $params[] = $statusMap[$key];
            $types .= 'i';
        }
    }

    $departments = array_values(array_unique($departments));
    if ($departments) {
        $where[] = 'd.nombre IN (' . implode(',', array_fill(0, count($departments), '?')) . ')';
        foreach ($departments as $department) {
            $params[] = $department;
            $types .= 's';
        }
    }
}

function ixtla_insights_dimension_sql(string $dimension): array
{
    return match ($dimension) {
        'tramite' => ['label' => 't.nombre', 'group' => 't.id, t.nombre', 'date' => false],
        'departamento' => ['label' => 'd.nombre', 'group' => 'd.id, d.nombre', 'date' => false],
        'fecha' => ['label' => 'DATE(r.created_at)', 'group' => 'DATE(r.created_at)', 'date' => true],
        default => [
            'label' => "CASE r.estatus WHEN 0 THEN 'Solicitud' WHEN 1 THEN 'Revisión' WHEN 2 THEN 'Asignación' WHEN 3 THEN 'En proceso' WHEN 4 THEN 'Pausado' WHEN 5 THEN 'Cancelado' WHEN 6 THEN 'Finalizado' ELSE 'Sin estatus' END",
            'group' => 'r.estatus',
            'date' => false,
        ],
    };
}

function ixtla_insights_sort_sql(string $sort, bool $isDate): string
{
    if ($isDate || $sort === 'chronological') {
        return 'label ASC';
    }
    return $sort === 'asc' ? 'value ASC, label ASC' : 'value DESC, label ASC';
}

function ixtla_insights_scalar(mysqli $con, string $sql, string $types, array $params): int
{
    $rows = ixtla_insights_rows($con, $sql, $types, $params);
    return (int) ($rows[0]['total'] ?? 0);
}

function ixtla_insights_float_scalar(mysqli $con, string $sql, string $types, array $params): float
{
    $rows = ixtla_insights_rows($con, $sql, $types, $params);
    return (float) ($rows[0]['value'] ?? 0);
}

function ixtla_insights_rows(mysqli $con, string $sql, string $types, array $params): array
{
    $statement = $con->prepare($sql);
    if (!$statement) {
        throw new RuntimeException('No fue posible preparar la consulta analítica.');
    }
    if ($types !== '') {
        $references = [$types];
        foreach ($params as $index => $value) {
            $references[] = &$params[$index];
        }
        call_user_func_array([$statement, 'bind_param'], $references);
    }
    if (!$statement->execute()) {
        $statement->close();
        throw new RuntimeException('No fue posible ejecutar la consulta analítica.');
    }
    $result = $statement->get_result();
    $rows = [];
    while ($row = $result->fetch_assoc()) {
        if (array_key_exists('value', $row)) {
            $rows[] = ['label' => (string) $row['label'], 'value' => (int) $row['value']];
        } else {
            $rows[] = $row;
        }
    }
    $statement->close();
    return $rows;
}

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

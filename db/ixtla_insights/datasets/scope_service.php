<?php
declare(strict_types=1);

require_once __DIR__ . '/../../conn/conn_db.php';
require_once __DIR__ . '/../../WEB/tools_105277.php';

/**
 * Resuelve el alcance de datos una vez por petición. Ningún dataset recibe un
 * empleado, departamento o condición SQL desde el modelo.
 */
function ixtla_insights_dataset_connection(): mysqli
{
    $connection = conectar();
    if (!$connection instanceof mysqli) {
        throw new RuntimeException('No fue posible conectar con la fuente de datos.');
    }
    $connection->set_charset('utf8mb4');
    $connection->query("SET time_zone='-06:00'");
    return $connection;
}

function ixtla_insights_dataset_scope(mysqli $connection): array
{
    $session = $GLOBALS['ix_session'] ?? [];
    $employeeId = (int) ($session['empleado_id'] ?? $session['id_empleado'] ?? 0);
    if ($employeeId <= 0) {
        throw new InvalidArgumentException('No fue posible identificar al usuario de Insights.');
    }

    $rbac = rbac_compute_by_empleado_id($connection, $employeeId, ['presidencia_dept_ids' => [6]]);
    if (!is_array($rbac)) {
        throw new InvalidArgumentException('No fue posible resolver el alcance autorizado.');
    }

    $scope = is_array($rbac['scope'] ?? null) ? $rbac['scope'] : [];
    $employee = is_array($rbac['empleado'] ?? null) ? $rbac['empleado'] : [];
    if (!empty($scope['global'])) {
        return ['where' => [], 'types' => '', 'params' => [], 'mode' => 'global', 'label' => 'Vista global autorizada'];
    }

    $departmentId = (int) ($employee['departamento_id'] ?? 0);
    if (!empty($scope['department'])) {
        if ($departmentId <= 0) {
            throw new InvalidArgumentException('El usuario no tiene un departamento asignado.');
        }
        return [
            'where' => ['r.departamento_id = ?'],
            'types' => 'i',
            'params' => [$departmentId],
            'mode' => 'department',
            'label' => 'Departamento autorizado',
        ];
    }

    if (!empty($scope['team'])) {
        $employeeIds = ixtla_insights_dataset_team_ids($connection, $employeeId);
        return [
            'where' => ['r.asignado_a IN (' . implode(',', array_fill(0, count($employeeIds), '?')) . ')'],
            'types' => str_repeat('i', count($employeeIds)),
            'params' => $employeeIds,
            'mode' => 'team',
            'label' => 'Usuario y equipo autorizado',
        ];
    }

    return [
        'where' => ['r.asignado_a = ?'],
        'types' => 'i',
        'params' => [$employeeId],
        'mode' => 'self',
        'label' => 'Requerimientos asignados al usuario',
    ];
}

function ixtla_insights_dataset_team_ids(mysqli $connection, int $managerId): array
{
    $statement = $connection->prepare(
        'SELECT e.id FROM empleado e LEFT JOIN empleado_cuenta c ON c.empleado_id = e.id '
        . 'WHERE e.status = 1 AND (e.id = ? OR c.reporta_a = ?)'
    );
    if (!$statement) {
        return [$managerId];
    }
    $statement->bind_param('ii', $managerId, $managerId);
    $statement->execute();
    $result = $statement->get_result();
    $ids = [$managerId];
    while ($row = $result?->fetch_assoc()) {
        $id = (int) ($row['id'] ?? 0);
        if ($id > 0) {
            $ids[] = $id;
        }
    }
    $statement->close();
    return array_values(array_unique($ids));
}

function ixtla_insights_dataset_period_clause(string $period, array &$where): void
{
    match ($period) {
        'last_7' => $where[] = 'r.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)',
        'last_30' => $where[] = 'r.created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)',
        'this_month' => $where[] = "r.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')",
        default => null,
    };
}

function ixtla_insights_dataset_bind(mysqli_stmt $statement, string $types, array $params): void
{
    if ($types === '' || $params === []) {
        return;
    }
    $values = [$types];
    foreach ($params as $index => $value) {
        $params[$index] = $value;
        $values[] = &$params[$index];
    }
    $statement->bind_param(...$values);
}

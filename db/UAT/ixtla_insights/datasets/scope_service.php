<?php
declare(strict_types=1);

require_once __DIR__ . '/../../../conn/conn_db.php';
require_once __DIR__ . '/../../../WEB/tools_105277.php';

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

    $access = ixtla_insights_access_scope_from_rbac($rbac);
    if ($access['mode'] === 'team') {
        $access = ixtla_insights_access_scope_from_rbac(
            $rbac,
            ixtla_insights_dataset_team_ids($connection, $employeeId)
        );
    }

    return ixtla_insights_dataset_scope_query($access);
}

/**
 * Contrato de autorizacion de Insights. Esta funcion no recibe datos del
 * navegador ni del modelo; transforma exclusivamente el resultado del RBAC
 * central en un alcance que las herramientas pueden aplicar.
 */
function ixtla_insights_access_scope_from_rbac(array $rbac, array $teamEmployeeIds = []): array
{
    $employee = is_array($rbac['empleado'] ?? null) ? $rbac['empleado'] : [];
    $scope = is_array($rbac['scope'] ?? null) ? $rbac['scope'] : [];
    $employeeId = (int) ($employee['id'] ?? 0);
    if ($employeeId <= 0) {
        throw new InvalidArgumentException('El alcance RBAC no contiene un empleado valido.');
    }

    $base = [
        'employee_id' => $employeeId,
        'department_id' => null,
        'team_employee_ids' => [],
        // null significa que el alcance no esta limitado por departamento.
        'allowed_department_ids' => null,
    ];
    if (!empty($scope['global'])) {
        return array_replace($base, ['mode' => 'global', 'label' => 'Vista global autorizada']);
    }

    $departmentId = (int) ($employee['departamento_id'] ?? 0);
    if (!empty($scope['department'])) {
        if ($departmentId <= 0) {
            throw new InvalidArgumentException('El usuario no tiene un departamento asignado.');
        }
        return array_replace($base, [
            'mode' => 'department',
            'label' => 'Departamento autorizado',
            'department_id' => $departmentId,
            'allowed_department_ids' => [$departmentId],
        ]);
    }

    if (!empty($scope['team'])) {
        $ids = array_map('intval', $teamEmployeeIds);
        $ids[] = $employeeId;
        $ids = array_values(array_unique(array_filter($ids, static fn (int $id): bool => $id > 0)));
        sort($ids, SORT_NUMERIC);
        return array_replace($base, [
            'mode' => 'team',
            'label' => 'Usuario y equipo autorizado',
            'team_employee_ids' => $ids,
        ]);
    }

    return array_replace($base, ['mode' => 'self', 'label' => 'Requerimientos asignados al usuario']);
}

/**
 * Condición base de visibilidad para requerimientos.
 *
 * El endpoint operativo canónico sólo expone registros con status=1. Esta
 * regla no forma parte del RBAC: evita incluir bajas lógicas en cualquier
 * consulta analítica, sin importar el alcance autorizado del usuario.
 *
 * @return list<string>
 */
function ixtla_insights_dataset_requirement_visibility_where(): array
{
    return ['r.status = 1'];
}

/** Convierte el contrato de acceso en condiciones SQL preparadas. */
function ixtla_insights_dataset_scope_query(array $access): array
{
    $mode = (string) ($access['mode'] ?? '');
    $visibilityWhere = ixtla_insights_dataset_requirement_visibility_where();
    return match ($mode) {
        'global' => ['where' => $visibilityWhere, 'types' => '', 'params' => [], 'mode' => $mode, 'label' => (string) $access['label'], 'access' => $access],
        'department' => [
            'where' => [...$visibilityWhere, 'r.departamento_id = ?'],
            'types' => 'i',
            'params' => [(int) $access['department_id']],
            'mode' => $mode,
            'label' => (string) $access['label'],
            'access' => $access,
        ],
        'team' => [
            'where' => [...$visibilityWhere, 'r.asignado_a IN (' . implode(',', array_fill(0, count($access['team_employee_ids']), '?')) . ')'],
            'types' => str_repeat('i', count($access['team_employee_ids'])),
            'params' => $access['team_employee_ids'],
            'mode' => $mode,
            'label' => (string) $access['label'],
            'access' => $access,
        ],
        'self' => [
            'where' => [...$visibilityWhere, 'r.asignado_a = ?'],
            'types' => 'i',
            'params' => [(int) $access['employee_id']],
            'mode' => $mode,
            'label' => (string) $access['label'],
            'access' => $access,
        ],
        default => throw new InvalidArgumentException('El alcance de Insights no es valido.'),
    };
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

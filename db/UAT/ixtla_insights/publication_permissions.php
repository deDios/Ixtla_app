<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/datasets/scope_service.php';

ixtla_insights_bootstrap(['GET']);

try {
    $connection = ixtla_insights_dataset_connection();
    $session = $GLOBALS['ix_session'] ?? [];
    $employeeId = (int) ($session['empleado_id'] ?? $session['id_empleado'] ?? 0);
    $rbac = rbac_compute_by_empleado_id($connection, $employeeId, ['presidencia_dept_ids' => [6]]);
    if (!is_array($rbac)) {
        throw new RuntimeException('No fue posible resolver los permisos de publicación.');
    }

    $flags = is_array($rbac['flags'] ?? null) ? $rbac['flags'] : [];
    $employee = is_array($rbac['empleado'] ?? null) ? $rbac['empleado'] : [];
    $department = is_array($rbac['departamento'] ?? null) ? $rbac['departamento'] : [];
    $isOrganizationPublisher = !empty($flags['is_admin']) || !empty($flags['is_presidencia']);
    $isDepartmentPublisher = !empty($flags['is_director']) || !empty($flags['is_primera_linea']);
    $isTeamPublisher = !empty($flags['is_jefe']);

    $allowedScopes = ['private'];
    if ($isTeamPublisher) $allowedScopes[] = 'team';
    if ($isDepartmentPublisher || $isOrganizationPublisher) $allowedScopes[] = 'department';
    if ($isOrganizationPublisher) {
        $allowedScopes[] = 'departments';
        $allowedScopes[] = 'organization';
    }

    $departments = [];
    if ($isOrganizationPublisher) {
        $result = $connection->query("SELECT id, nombre FROM departamento WHERE status = 1 AND nombre IS NOT NULL AND TRIM(nombre) <> '' ORDER BY nombre ASC");
        while ($row = $result?->fetch_assoc()) {
            $departments[] = ['id' => (int) $row['id'], 'nombre' => trim((string) $row['nombre'])];
        }
    } elseif (($isDepartmentPublisher || $isTeamPublisher) && (int) ($department['id'] ?? 0) > 0) {
        $departments[] = ['id' => (int) $department['id'], 'nombre' => trim((string) ($department['nombre'] ?? ''))];
    }

    $profile = $isOrganizationPublisher ? 'Presidencia o administración'
        : ($isDepartmentPublisher ? 'Dirección o primera línea'
            : ($isTeamPublisher ? 'Jefatura' : 'Analista o usuario'));

    ixtla_insights_json([
        'ok' => true,
        'permissions' => [
            'profile' => $profile,
            'position' => trim((string) ($employee['puesto'] ?? '')),
            'allowed_scopes' => $allowedScopes,
            'allowed_department_ids' => array_values(array_map(static fn (array $item): int => $item['id'], $departments)),
            'can_feature' => $isTeamPublisher || $isDepartmentPublisher || $isOrganizationPublisher,
            'can_make_mandatory' => $isOrganizationPublisher,
            'departments' => $departments,
        ],
    ]);
} catch (Throwable $error) {
    ixtla_insights_log_error('publication_permissions', $error);
    ixtla_insights_json(['ok' => false, 'error' => 'No fue posible consultar los permisos de publicación.'], 503);
} finally {
    if (isset($connection) && $connection instanceof mysqli) $connection->close();
}

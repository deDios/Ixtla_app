<?php
declare(strict_types=1);
/** Legacy analytical entry points were removed after the UAT consumer audit. Shared SQL and period helpers remain below for compatibility tests and the snapshot source. */

require_once __DIR__ . '/scope_service.php';
require_once __DIR__ . '/../domain_profile.php';

// Contiene las consultas y cálculos sobre los requerimientos.


/**
 * Paquete ejecutivo para un director. Reúne en una sola llamada los datos que
 * normalmente requerirían varias herramientas, siempre sobre el scope RBAC.
 */

/**
 * Compound diagnosis for operational decisions without deadline assumptions.
 * Scope and soft-delete rules are inherited from the shared dataset scope.
 */

/** Compound workload analysis for comparisons, peak days and contributors. */

/** Compound backlog analysis for active-work concentration and aging. */

/** Distribución de pendientes activos por antigüedad */

/** Compara una métrica del periodo actual contra su periodo inmediato previo. */

/** Serie diaria de requerimientos creados para identificar tendencia de carga. */

/** Ranking seguro por una dimensión operativa aprobada. */

/** Lista operativa acotada de pendientes activos con antigüedad mínima. */

/**
 * Dataset de respaldo para preguntas operativas que no encajan en un reporte
 * agregado solo puede combinar filtros enumerados y obtener una lista pequeña de fichas.
 */

/** @return array<string, mixed> */



/**
 * Ejecuta el contrato analítico v1. Todos sus valores se validan antes de
 * llegar a SQL; esta función nunca acepta nombres de columna del modelo.
 */


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



function ixtla_insights_dataset_period_clause_for_field(string $preset, string $field, array &$where): void
{
    $column = $field === 'closed_at' ? 'r.cerrado_en' : 'r.created_at';
    match ($preset) {
        'this_week' => $where[] = $column . ' >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)',
        'last_7' => $where[] = $column . ' >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)',
        'last_30' => $where[] = $column . ' >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)',
        'this_month' => $where[] = $column . " >= DATE_FORMAT(CURDATE(), '%Y-%m-01')",
        default => null,
    };
}

function ixtla_insights_dataset_previous_period_clause(string $period, string $field, array &$where): void
{
    match ($period) {
        'this_week' => $where[] = $field . ' >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY) AND ' . $field . ' < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)',
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

/** 
 * Validates and returns the risk period for diagnostic queries.
 */
function ixtla_insights_dataset_risk_period(mixed $period): string
{
    $value = strtolower(trim((string) $period));
    if (!in_array($value, ['this_week', 'last_7', 'last_30', 'this_month'], true)) {
        throw new InvalidArgumentException('El periodo del diagnóstico no está disponible.');
    }
    return $value;
}

function ixtla_insights_dataset_period(mixed $period): string
{
    $value = strtolower(trim((string) $period));
    return in_array($value, ['all', 'this_week', 'last_7', 'last_30', 'this_month'], true) ? $value : 'all';
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

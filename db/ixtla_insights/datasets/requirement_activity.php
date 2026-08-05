<?php
declare(strict_types=1);

require_once __DIR__ . '/requerimientos_dataset.php';
require_once __DIR__ . '/requerimientos_snapshot.php';

/** Resuelve un requerimiento sin permitir que la herramienta amplie el RBAC. */
function ixtla_insights_activity_requirement(mysqli $connection, array $arguments): array
{
    $id = isset($arguments['id']) ? (int) $arguments['id'] : 0;
    $folio = strtoupper(trim((string) ($arguments['folio'] ?? '')));
    if (($id <= 0 && $folio === '') || ($id > 0 && $folio !== '')) {
        throw new InvalidArgumentException('Indica exactamente un id o un folio.');
    }
    $scope = ixtla_insights_dataset_scope($connection);
    $where = $scope['where'];
    $types = $scope['types'];
    $params = $scope['params'];
    if ($id > 0) {
        $where[] = 'r.id = ?';
        $types .= 'i';
        $params[] = $id;
    } else {
        $where[] = 'r.folio = ?';
        $types .= 's';
        $params[] = $folio;
    }
    $rows = ixtla_insights_dataset_rows(
        $connection,
        'SELECT r.id, r.folio FROM requerimiento r WHERE ' . implode(' AND ', $where) . ' LIMIT 1',
        $types,
        $params
    );
    if ($rows === []) {
        throw new RuntimeException('El requerimiento no existe o no pertenece al alcance autorizado.');
    }
    return ['id' => (int) $rows[0]['id'], 'folio' => (string) $rows[0]['folio']];
}

/** Reduce datos personales accidentales antes de enviar texto operacional al modelo. */
function ixtla_insights_activity_safe_text(?string $text, int $maximum = 500): string
{
    $value = trim((string) $text);
    $value = preg_replace('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/iu', '[correo oculto]', $value) ?? $value;
    $value = preg_replace('/(?<!\d)(?:\+?52[\s.\-]?)?(?:\d[\s.\-]?){10}(?!\d)/', '[telefono oculto]', $value) ?? $value;
    return ixtla_insights_truncate($value, $maximum);
}

function ixtla_insights_task_status_label(int $status): string
{
    return [1 => 'Por hacer', 2 => 'En proceso', 3 => 'En revision', 4 => 'Bloqueada', 5 => 'Terminada'][$status]
        ?? 'Sin estado';
}

function ixtla_insights_requirement_comments(array $arguments): array
{
    $limit = min(30, max(1, (int) ($arguments['limit'] ?? 10)));
    $connection = ixtla_insights_dataset_connection();
    try {
        $requirement = ixtla_insights_activity_requirement($connection, $arguments);
        $rows = ixtla_insights_dataset_rows(
            $connection,
            "SELECT c.id, c.comentario, c.created_at, c.empleado_id, "
            . "COALESCE(NULLIF(TRIM(CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, ''))), ''), 'Autor no identificado') AS author "
            . 'FROM comentario_requerimiento c LEFT JOIN empleado e ON e.id = c.empleado_id '
            . 'WHERE c.requerimiento_id = ? AND c.status = 1 ORDER BY c.created_at DESC, c.id DESC LIMIT ?',
            'ii',
            [$requirement['id'], $limit]
        );
        return [
            'requirement' => $requirement,
            'items' => array_map(static fn (array $row): array => [
                'id' => (int) $row['id'],
                'author_id' => $row['empleado_id'] === null ? null : (int) $row['empleado_id'],
                'author' => (string) $row['author'],
                'created_at' => (string) $row['created_at'],
                'comment' => ixtla_insights_activity_safe_text((string) $row['comentario']),
            ], $rows),
            'privacy' => 'Correos y telefonos detectables se ocultan antes de entregar el texto.',
        ];
    } finally {
        $connection->close();
    }
}

function ixtla_insights_requirement_tasks(array $arguments): array
{
    $limit = min(50, max(1, (int) ($arguments['limit'] ?? 20)));
    $state = (string) ($arguments['state'] ?? 'any');
    if (!in_array($state, ['any', 'open', 'completed'], true)) {
        throw new InvalidArgumentException('El filtro de tareas no es valido.');
    }
    $connection = ixtla_insights_dataset_connection();
    try {
        $requirement = ixtla_insights_activity_requirement($connection, $arguments);
        $where = ['p.requerimiento_id = ?', 'p.status = 1'];
        if ($state === 'open') $where[] = 't.status <> 5';
        if ($state === 'completed') $where[] = 't.status = 5';
        $rows = ixtla_insights_dataset_rows(
            $connection,
            "SELECT t.id, t.titulo, t.descripcion, t.status, t.fecha_inicio, t.fecha_fin, t.created_at, t.asignado_a, "
            . "COALESCE(NULLIF(TRIM(CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, ''))), ''), 'Sin asignar') AS assignee "
            . 'FROM tarea_proceso t JOIN proceso_requerimiento p ON p.id = t.proceso_id '
            . 'LEFT JOIN empleado e ON e.id = t.asignado_a WHERE ' . implode(' AND ', $where)
            . ' ORDER BY COALESCE(t.fecha_inicio, t.created_at) DESC, t.id DESC LIMIT ?',
            'ii',
            [$requirement['id'], $limit]
        );
        return [
            'requirement' => $requirement,
            'state' => $state,
            'items' => array_map(static fn (array $row): array => [
                'id' => (int) $row['id'],
                'title' => ixtla_insights_activity_safe_text((string) $row['titulo'], 200),
                'description' => ixtla_insights_activity_safe_text((string) $row['descripcion']),
                'status_id' => (int) $row['status'],
                'status' => ixtla_insights_task_status_label((int) $row['status']),
                'assignee_id' => $row['asignado_a'] === null ? null : (int) $row['asignado_a'],
                'assignee' => (string) $row['assignee'],
                'start_at' => $row['fecha_inicio'] === null ? null : (string) $row['fecha_inicio'],
                'due_at' => $row['fecha_fin'] === null ? null : (string) $row['fecha_fin'],
                'created_at' => (string) $row['created_at'],
            ], $rows),
        ];
    } finally {
        $connection->close();
    }
}

function ixtla_insights_requirement_processes(array $arguments): array
{
    $limit = min(30, max(1, (int) ($arguments['limit'] ?? 10)));
    $connection = ixtla_insights_dataset_connection();
    try {
        $requirement = ixtla_insights_activity_requirement($connection, $arguments);
        $rows = ixtla_insights_dataset_rows(
            $connection,
            "SELECT p.id, p.descripcion, p.created_at, p.empleado_id, "
            . "COALESCE(NULLIF(TRIM(CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, ''))), ''), 'Autor no identificado') AS author "
            . 'FROM proceso_requerimiento p LEFT JOIN empleado e ON e.id = p.empleado_id '
            . 'WHERE p.requerimiento_id = ? AND p.status = 1 ORDER BY p.created_at DESC, p.id DESC LIMIT ?',
            'ii',
            [$requirement['id'], $limit]
        );
        return [
            'requirement' => $requirement,
            'items' => array_map(static fn (array $row): array => [
                'id' => (int) $row['id'],
                'author_id' => $row['empleado_id'] === null ? null : (int) $row['empleado_id'],
                'author' => (string) $row['author'],
                'created_at' => (string) $row['created_at'],
                'description' => ixtla_insights_activity_safe_text((string) $row['descripcion']),
            ], $rows),
        ];
    } finally {
        $connection->close();
    }
}

function ixtla_insights_requirement_activity(array $arguments): array
{
    $limit = min(50, max(1, (int) ($arguments['limit'] ?? 20)));
    $comments = ixtla_insights_requirement_comments(array_replace($arguments, ['limit' => $limit]));
    $tasks = ixtla_insights_requirement_tasks(array_replace($arguments, ['state' => 'any', 'limit' => $limit]));
    $processes = ixtla_insights_requirement_processes(array_replace($arguments, ['limit' => $limit]));
    $events = [];
    foreach ($comments['items'] as $comment) {
        $events[] = ['type' => 'comment', 'date' => $comment['created_at'], 'actor' => $comment['author'], 'text' => $comment['comment']];
    }
    foreach ($tasks['items'] as $task) {
        $events[] = ['type' => 'task', 'date' => $task['created_at'], 'actor' => $task['assignee'], 'title' => $task['title'], 'status' => $task['status']];
    }
    foreach ($processes['items'] as $process) {
        $events[] = ['type' => 'process', 'date' => $process['created_at'], 'actor' => $process['author'], 'text' => $process['description']];
    }
    usort($events, static fn (array $a, array $b): int => strcmp((string) $b['date'], (string) $a['date']));
    return [
        'requirement' => $comments['requirement'],
        'items' => array_slice($events, 0, $limit),
        'privacy' => $comments['privacy'],
    ];
}

function ixtla_insights_requirement_summary(array $arguments): array
{
    $detail = ixtla_insights_snapshot_requirement_detail($arguments);
    if (($detail['requirement'] ?? null) === null) return $detail;
    $detail['recent_activity'] = ixtla_insights_requirement_activity(array_replace($arguments, ['limit' => 10]))['items'];
    return $detail;
}

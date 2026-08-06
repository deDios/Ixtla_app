<?php
declare(strict_types=1);

/** Informe inicial del chat, construido exclusivamente con datasets autorizados. */
ob_start();
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/datasets/requerimientos_snapshot.php';

ixtla_insights_bootstrap(['POST']);

try {
    $session = is_array($GLOBALS['ix_session'] ?? null) ? $GLOBALS['ix_session'] : [];
    $fullName = trim(implode(' ', array_filter([
        trim((string) ($session['nombre'] ?? '')),
        trim((string) ($session['apellidos'] ?? '')),
    ])));
    if ($fullName === '') {
        $fullName = trim((string) ($session['username'] ?? 'Usuario actual'));
    }
    $roleLabels = [
        'ADMIN' => 'Administrador',
        'ADMIN_GLOBAL' => 'Administrador',
        'DIRECTOR' => 'Director',
        'ANALISTA' => 'Analista',
        'JEFE' => 'Jefe',
        'EMPLEADO' => 'Empleado',
    ];
    $sessionRoles = is_array($session['roles'] ?? null) ? $session['roles'] : [];
    $roles = [];
    foreach ($sessionRoles as $role) {
        $code = strtoupper(trim((string) (is_array($role) ? ($role['codigo'] ?? $role['nombre'] ?? '') : $role)));
        if ($code !== '') {
            $roles[] = $roleLabels[$code] ?? mb_convert_case(str_replace('_', ' ', $code), MB_CASE_TITLE, 'UTF-8');
        }
    }
    $roleLabel = implode(', ', array_values(array_unique($roles))) ?: 'Empleado';

    // Consulta el snapshot cacheado. Solo se construye desde la fuente cuando
    // falta o expira, nunca por cada pregunta del chat.
    $snapshot = ixtla_insights_snapshot_overview(['refresh' => false, 'period' => 'all']);
    $currentThirtyDayTotal = (int) ($snapshot['trend']['current_total'] ?? 0);

    ixtla_insights_json([
        'ok' => true,
        'report' => [
            'title' => 'Dataset de: ' . $fullName,
            'user_name' => $fullName,
            'role_label' => $roleLabel,
            'scope' => $snapshot['scope'] ?? [],
            'period_label' => 'Toda la muestra autorizada',
            'counts' => $snapshot['counts'] ?? [],
            'top_tramites' => $snapshot['top_tramites'] ?? [],
            'trend' => $snapshot['trend'] ?? [],
            'average_weekly' => round($currentThirtyDayTotal / (30 / 7), 1),
            'generated_at' => date(DATE_ATOM),
        ],
    ]);
} catch (Throwable $error) {
    ixtla_insights_log_error('welcome_report', $error);
    ixtla_insights_json(['ok' => false, 'error' => 'No fue posible generar el informe inicial.'], 503);
}

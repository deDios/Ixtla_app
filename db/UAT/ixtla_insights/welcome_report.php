<?php
declare(strict_types=1);

/** Informe inicial del chat, construido exclusivamente con datasets autorizados. */
ob_start();
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/datasets/requerimientos_snapshot.php';

ixtla_insights_bootstrap(['POST']);

try {
    $contract = ixtla_insights_data_contract();
    $welcomeContract = $contract['welcome'];
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
    $summaryPeriod = (string) $welcomeContract['summary_period'];
    $trendPeriod = (string) $welcomeContract['trend_period'];
    $snapshot = ixtla_insights_snapshot_overview(['refresh' => false, 'period' => $summaryPeriod]);
    $currentThirtyDayTotal = (int) ($snapshot['trend']['current_total'] ?? 0);

    ixtla_insights_json([
        'ok' => true,
        'report' => [
            'contract_version' => $contract['version'],
            'schema_version' => $contract['snapshot']['schema_version'],
            'title' => 'Dataset de: ' . $fullName,
            'user_name' => $fullName,
            'role_label' => $roleLabel,
            'scope' => $snapshot['scope'] ?? [],
            'period' => $summaryPeriod,
            'period_label' => ixtla_insights_domain_period_label($summaryPeriod),
            'counts' => $snapshot['counts'] ?? [],
            'top_tramites' => $snapshot['top_tramites'] ?? [],
            'trend' => $snapshot['trend'] ?? [],
            'trend_period' => $trendPeriod,
            'trend_period_label' => ixtla_insights_domain_period_label($trendPeriod),
            'average_weekly' => round($currentThirtyDayTotal / (30 / 7), 1),
            'average_weekly_period' => $trendPeriod,
            'average_weekly_period_label' => ixtla_insights_domain_period_label($trendPeriod),
            'generated_at' => date(DATE_ATOM),
        ],
    ]);
} catch (Throwable $error) {
    ixtla_insights_log_error('welcome_report', $error);
    ixtla_insights_json(['ok' => false, 'error' => 'No fue posible generar el informe inicial.'], 503);
}

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

    // Consulta el snapshot cacheado. Solo se construye desde la fuente cuando
    // falta o expira, nunca por cada pregunta del chat.
    $snapshot = ixtla_insights_snapshot_overview(['refresh' => false]);
    $currentThirtyDayTotal = (int) ($snapshot['trend']['current_total'] ?? 0);

    ixtla_insights_json([
        'ok' => true,
        'report' => [
            'title' => 'Dataset de: ' . $fullName,
            'user_name' => $fullName,
            'scope' => $snapshot['scope'] ?? [],
            'period_label' => 'Mes en curso',
            'counts' => $snapshot['counts'] ?? [],
            'deadline_risk' => [
                'overdue' => $snapshot['counts']['overdue'] ?? 0,
                'due_within_days' => 7,
                'due_soon' => $snapshot['counts']['due_soon'] ?? 0,
                'without_due_date' => $snapshot['counts']['without_due_date'] ?? 0,
            ],
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

<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/contracts.php';

function expect(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$catalog = ixtla_insights_catalog();
expect($catalog['version'] === 1, 'El contrato debe tener versión explícita.');
expect(ixtla_insights_catalog_contains('widget_kinds', 'bar'), 'bar debe ser un widget permitido.');
expect(!ixtla_insights_catalog_contains('metrics', 'sql_libre'), 'El contrato no debe aceptar métricas libres.');
expect(ixtla_insights_is_kpi_only_metric('tiempo_resolucion'), 'tiempo_resolucion debe ser KPI.');
expect(ixtla_insights_is_fixed_status_metric('pausados_cancelados'), 'pausados_cancelados debe fijar el estatus.');

echo "OK contracts\n";

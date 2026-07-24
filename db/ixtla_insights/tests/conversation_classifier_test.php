<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/conversation_service.php';

function expect_plan(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$byDepartment = ixtla_insights_operational_question_plan('¿Cuántos requerimientos tiene cada departamento?');
expect_plan(($byDepartment['metric'] ?? null) === 'total', 'La consulta por departamento debe usar la métrica total.');
expect_plan(($byDepartment['dimension'] ?? null) === 'departamento', 'La consulta por departamento debe agrupar por departamento.');

$byStatus = ixtla_insights_operational_question_plan('Cuántos requerimientos hay por estatus');
expect_plan(($byStatus['dimension'] ?? null) === 'estatus', 'La consulta por estatus debe agrupar por estatus.');

expect_plan(ixtla_insights_operational_question_plan('¿Qué información tienes?') === null, 'Una duda general debe quedar para el asistente de IA.');

echo "OK conversation classifier\n";

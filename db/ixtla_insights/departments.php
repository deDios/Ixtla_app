<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../conn/conn_db.php';
define('IXTLA_INSIGHTS_ANALYTICS_LIBRARY', true);
require_once __DIR__ . '/analytics.php';

$config = ixtla_insights_bootstrap(['GET']);
if (($config['enabled'] ?? false) !== true) {
    ixtla_insights_json(['ok' => false, 'error' => 'Ixtla Insights está deshabilitado en este entorno.'], 503);
}

$con = conectar();
if (!$con instanceof mysqli) {
    ixtla_insights_json(['ok' => false, 'error' => 'No fue posible consultar los departamentos.'], 503);
}
$con->set_charset('utf8mb4');

try {
    $departments = ixtla_insights_authorized_department_catalog($con);
    $con->close();
    ixtla_insights_json(['ok' => true, 'departments' => $departments]);
} catch (Throwable $error) {
    ixtla_insights_log_error('departments', $error);
    $con->close();
    ixtla_insights_json(['ok' => false, 'error' => 'No fue posible consultar los departamentos.'], 503);
}

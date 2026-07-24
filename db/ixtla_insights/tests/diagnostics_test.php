<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

function expect_diagnostic(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$requestId = ixtla_insights_request_id();
expect_diagnostic((bool) preg_match('/^ix-[a-f0-9]{24}$/', $requestId), 'El request id generado debe tener un formato seguro y correlacionable.');
expect_diagnostic(ixtla_insights_request_id() === $requestId, 'El request id debe ser estable durante la solicitud.');
expect_diagnostic(ixtla_insights_default_error_code(502) === 'provider_unavailable', '502 debe clasificarse como error de proveedor.');
expect_diagnostic(ixtla_insights_default_error_code(503) === 'service_unavailable', '503 debe clasificarse como servicio no disponible.');
expect_diagnostic(ixtla_insights_default_error_code(422) === 'validation_failed', '422 debe clasificarse como validación.');

echo "OK diagnostics\n";

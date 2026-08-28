<?php
// JS/auth/ix_guard.php

declare(strict_types=1);

function ix_require_session(array $options = []): void
{
    $loginUrl   = $options['login_url']   ?? '/VIEWS/Login.php';
    $cookieName = $options['cookie_name'] ?? 'ix_emp';
    $responseMode = ($options['response_mode'] ?? 'redirect') === 'json' ? 'json' : 'redirect';
    $requestId = trim((string) ($options['request_id'] ?? ''));

    // No hacemos nada en CLI
    if (PHP_SAPI === 'cli') {
        return;
    }

    // IMPORTANTÍSIMO: este guard debe incluirse ANTES de cualquier salida HTML
    // para poder mandar headers de redirección.
    if (headers_sent()) {
        ix_guard_reject($cookieName, $loginUrl, $responseMode, $requestId);
    }

    // 1) Leer cookie
    $rawCookie = $_COOKIE[$cookieName] ?? '';

    if ($rawCookie === '' || $rawCookie === null) {
        ix_guard_reject($cookieName, $loginUrl, $responseMode, $requestId);
    }

    // 2) Decodificar (mirror de JS: base64 de JSON)
    $payload = null;
    $b64     = $rawCookie; // PHP ya hace urldecode de las cookies

    $jsonStr = base64_decode($b64, true);
    if ($jsonStr === false || $jsonStr === '') {
        ix_guard_reject($cookieName, $loginUrl, $responseMode, $requestId);
    }

    $payload = json_decode($jsonStr, true);
    if (!is_array($payload)) {
        ix_guard_reject($cookieName, $loginUrl, $responseMode, $requestId);
    }

    // Validar expiración (exp en milisegundos, como en Session.js) :contentReference[oaicite:1]{index=1}
    if (isset($payload['exp']) && is_numeric($payload['exp'])) {
        $nowMs = (int) round(microtime(true) * 1000);
        if ($nowMs > (int) $payload['exp']) {
            ix_guard_reject($cookieName, $loginUrl, $responseMode, $requestId);
        }
    }

    // Validar que al menos haya algún id (empleado o cuenta)
    $empleadoId = $payload['empleado_id'] ?? $payload['id_empleado'] ?? null;
    $cuentaId   = $payload['cuenta_id']   ?? $payload['id_cuenta']   ?? $payload['id_usuario'] ?? null;

    if (empty($empleadoId) && empty($cuentaId)) {
        ix_guard_reject($cookieName, $loginUrl, $responseMode, $requestId);
    }

    // Exponer sesión para PHP por si la necesitas en la vista
    $GLOBALS['ix_session'] = $payload;
}

function ix_guard_clear_cookie(string $cookieName): void
{
    $params = session_get_cookie_params();
    setcookie(
        $cookieName,
        '',
        time() - 3600,
        $params['path']   ?? '/',
        $params['domain'] ?? '',
        isset($_SERVER['HTTPS']),
        true
    );
}

function ix_guard_reject(string $cookieName, string $loginUrl, string $responseMode, string $requestId = ''): never
{
    ix_guard_clear_cookie($cookieName);
    if ($responseMode === 'json') {
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
        }
        http_response_code(401);
        $payload = [
            'ok' => false,
            'error' => 'Tu sesion termino. Recarga la pagina para continuar.',
            'error_code' => 'session_required',
        ];
        if ($requestId !== '') $payload['request_id'] = $requestId;
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
    if (!headers_sent()) {
        header('Location: ' . $loginUrl, true, 302);
    } else {
        echo '<script>window.location.href = ' . json_encode($loginUrl) . ';</script>';
    }
    exit;
}

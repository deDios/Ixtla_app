<?php
// /db/WEB/ix_guard.php
// Guard sencillo basado en la cookie "ix_emp" que genera Session.js

declare(strict_types=1);

function ix_require_session(array $options = []): void
{
    // Ruta al login (ajústala si tu login está en otro lugar)
    $loginUrl   = $options['login_url']   ?? '/VIEWS/Login.php';
    $cookieName = $options['cookie_name'] ?? 'ix_emp';

    // No hacemos nada en CLI
    if (PHP_SAPI === 'cli') {
        return;
    }

    // IMPORTANTÍSIMO: este guard debe incluirse ANTES de cualquier salida HTML
    // para poder mandar headers de redirección.
    if (headers_sent()) {
        // Fallback por si alguien lo incluyó tarde
        echo '<script>window.location.href = ' . json_encode($loginUrl) . ';</script>';
        exit;
    }

    // 1) Leer cookie
    $rawCookie = $_COOKIE[$cookieName] ?? '';

    if ($rawCookie === '' || $rawCookie === null) {
        // Sin cookie → redirigir directo
        ix_guard_clear_cookie($cookieName);
        header('Location: ' . $loginUrl, true, 302);
        exit;
    }

    // 2) Decodificar (mirror de JS: base64 de JSON)
    $payload = null;
    $b64     = $rawCookie; // PHP ya hace urldecode de las cookies

    $jsonStr = base64_decode($b64, true);
    if ($jsonStr === false || $jsonStr === '') {
        ix_guard_clear_cookie($cookieName);
        header('Location: ' . $loginUrl, true, 302);
        exit;
    }

    $payload = json_decode($jsonStr, true);
    if (!is_array($payload)) {
        ix_guard_clear_cookie($cookieName);
        header('Location: ' . $loginUrl, true, 302);
        exit;
    }

    // 3) Validar expiración (exp en milisegundos, como en Session.js) :contentReference[oaicite:1]{index=1}
    if (isset($payload['exp']) && is_numeric($payload['exp'])) {
        $nowMs = (int) round(microtime(true) * 1000);
        if ($nowMs > (int) $payload['exp']) {
            // Expirada
            ix_guard_clear_cookie($cookieName);
            header('Location: ' . $loginUrl, true, 302);
            exit;
        }
    }

    // 4) Validar que al menos haya algún id (empleado o cuenta)
    $empleadoId = $payload['empleado_id'] ?? $payload['id_empleado'] ?? null;
    $cuentaId   = $payload['cuenta_id']   ?? $payload['id_cuenta']   ?? $payload['id_usuario'] ?? null;

    if (empty($empleadoId) && empty($cuentaId)) {
        ix_guard_clear_cookie($cookieName);
        header('Location: ' . $loginUrl, true, 302);
        exit;
    }

    // 5) Exponer sesión para PHP por si la necesitas en la vista
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
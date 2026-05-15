<?php
// /PRI/JS/auth/ix_guard.php

declare(strict_types=1);

function ix_require_session(array $options = []): void
{
    $loginUrl   = $options['login_url']   ?? '/PRI/Views/login.php';
    $cookieName = $options['cookie_name'] ?? 'red_user';

    if (PHP_SAPI === 'cli') {
        return;
    }

    $rawCookie = $_COOKIE[$cookieName] ?? '';

    if ($rawCookie === '' || $rawCookie === null) {
        ix_guard_redirect($cookieName, $loginUrl);
    }

    $jsonStr = base64_decode($rawCookie, true);

    if ($jsonStr === false || $jsonStr === '') {
        ix_guard_redirect($cookieName, $loginUrl);
    }

    $payload = json_decode($jsonStr, true);

    if (!is_array($payload)) {
        ix_guard_redirect($cookieName, $loginUrl);
    }

    if (isset($payload['exp']) && is_numeric($payload['exp'])) {
        $nowMs = (int) round(microtime(true) * 1000);

        if ($nowMs > (int) $payload['exp']) {
            ix_guard_redirect($cookieName, $loginUrl);
        }
    }

    $usuarioId = $payload['usuario_id'] ?? null;

    if (empty($usuarioId)) {
        ix_guard_redirect($cookieName, $loginUrl);
    }

    $GLOBALS['red_session'] = $payload;
}

function ix_guard_redirect(string $cookieName, string $loginUrl): void
{
    ix_guard_clear_cookie($cookieName);

    if (headers_sent()) {
        echo '<script>window.location.href = ' . json_encode($loginUrl) . ';</script>';
        exit;
    }

    header('Location: ' . $loginUrl, true, 302);
    exit;
}

function ix_guard_clear_cookie(string $cookieName): void
{
    setcookie(
        $cookieName,
        '',
        [
            'expires' => time() - 3600,
            'path' => '/',
            'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
            'httponly' => false,
            'samesite' => 'Lax',
        ]
    );
}
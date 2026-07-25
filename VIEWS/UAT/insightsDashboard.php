<?php
declare(strict_types=1);

require_once __DIR__ . '/../../JS/UAT/auth/ix_guard.php';
ix_require_session(['login_url' => '/VIEWS/UAT/login.php']);
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ixtla Insights</title>
  <link rel="stylesheet" href="/CSS/UAT/ixtla-insights-dashboard.css">
</head>
<body class="ixtla-dashboard-page">
  <main class="ixtla-dashboard-empty">
    <p class="ixtla-dashboard-kicker">Ixtla Insights</p>
    <h1>Dashboard en reconstrucción</h1>
    <p>El dashboard anterior fue archivado para reconstruir Insights desde el chat mínimo validado.</p>
    <a class="ixtla-dashboard-button" href="/VIEWS/UAT/home.php">Abrir asistente</a>
  </main>
</body>
</html>

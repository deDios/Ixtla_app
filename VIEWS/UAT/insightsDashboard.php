<?php
require_once __DIR__ . '/../../JS/UAT/auth/ix_guard.php';
ix_require_session(['login_url' => '/VIEWS/UAT/login.php']);
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ixtla Insights — Dashboard temporal</title>
  <link rel="stylesheet" href="/CSS/UAT/ixtla-insights-dashboard.css">
</head>
<body class="ixtla-dashboard-page">
  <header class="ixtla-dashboard-top">
    <div><p class="ixtla-dashboard-kicker">Ixtla Insights</p><h1>Dashboard personalizado</h1><p id="ixtla-dashboard-question">Cargando consulta…</p><p id="ixtla-dashboard-scope"></p></div>
    <div class="ixtla-dashboard-actions"><a class="ixtla-dashboard-button ixtla-dashboard-button--ghost" href="/VIEWS/UAT/home.php">Volver a Home</a><button class="ixtla-dashboard-button" id="ixtla-dashboard-clear" type="button">Cerrar dashboard</button></div>
  </header>
  <main id="ixtla-dashboard-grid" class="ixtla-dashboard-grid"></main>
  <section id="ixtla-dashboard-empty" class="ixtla-dashboard-empty" hidden><h2>No hay un dashboard temporal</h2><p>Genera una gráfica desde el chat de Home para abrir una vista personalizada.</p><a class="ixtla-dashboard-button" href="/VIEWS/UAT/home.php">Ir a Home</a></section>
  <script type="module" src="/JS/UAT/insights/dashboard.js"></script>
</body>
</html>

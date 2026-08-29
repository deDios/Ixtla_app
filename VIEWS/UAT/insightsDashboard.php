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
  <title>Mi dashboard — Ixtla Insights</title>
  <link rel="icon" href="/favicon.ico">
  <link rel="stylesheet" href="/CSS/UAT/ixtla-insights-dashboard.css?v=tooltips-2">
</head>
<body class="ixtla-dashboard-page">
  <header class="ixtla-dashboard-appbar">
    <a class="ixtla-dashboard-brand" href="/VIEWS/UAT/home.php" aria-label="Volver a Ixtla Insights">
      <span class="ixtla-dashboard-brand__mark" aria-hidden="true">✦</span>
      <span><strong>Ixtla Insights</strong><small>Asistente de requerimientos</small></span>
    </a>
    <a class="ixtla-dashboard-appbar__back" href="/VIEWS/UAT/home.php">← Volver al asistente</a>
  </header>

  <main class="ixtla-dashboard-shell">
    <section class="ixtla-dashboard-top" aria-labelledby="dashboard-title">
      <div>
        <p class="ixtla-dashboard-kicker">Espacio de trabajo</p>
        <h1 id="dashboard-title">Mi dashboard</h1>
        <p>Consulta y organiza las visualizaciones que preparaste con el asistente.</p>
        <span class="ixtla-dashboard-scope">Privado · Sesión actual</span>
      </div>
      <div class="ixtla-dashboard-actions" aria-label="Acciones del dashboard">
        <button class="ixtla-dashboard-button ixtla-dashboard-button--ghost" id="dashboard-refresh" type="button">Actualizar</button>
        <button class="ixtla-dashboard-button ixtla-dashboard-button--danger" id="dashboard-clear" type="button">Limpiar dashboard</button>
        <a class="ixtla-dashboard-button" href="/VIEWS/UAT/home.php">＋ Crear con el asistente</a>
      </div>
    </section>

    <section class="ixtla-dashboard-summary" aria-live="polite">
      <div><strong id="dashboard-widget-count">0</strong><span>visualizaciones</span></div>
      <p id="dashboard-status">Las gráficas se conservan durante esta sesión del navegador.</p>
      <span class="ixtla-dashboard-summary__badge">Datos según tu alcance autorizado</span>
    </section>

    <section id="dashboard-grid" class="ixtla-dashboard-grid" aria-label="Visualizaciones del dashboard"></section>

    <section id="dashboard-empty" class="ixtla-dashboard-empty" hidden>
      <span class="ixtla-dashboard-empty__mark" aria-hidden="true">✦</span>
      <h2>Tu dashboard está listo para comenzar</h2>
      <p>Pídele una gráfica al asistente, revisa su preview y selecciona “Agregar al dashboard”.</p>
      <a class="ixtla-dashboard-button" href="/VIEWS/UAT/home.php">Crear mi primera gráfica</a>
    </section>

    <p class="ixtla-dashboard-footnote">Esta primera versión utiliza almacenamiento temporal de sesión. La publicación privada, departamental y organizacional se habilitará con la persistencia autorizada del servidor.</p>
  </main>

  <dialog class="ixtla-dashboard-confirm" id="dashboard-confirm">
    <form method="dialog">
      <span class="ixtla-dashboard-confirm__icon" aria-hidden="true">!</span>
      <h2>¿Limpiar el dashboard?</h2>
      <p>Se quitarán todas las visualizaciones preparadas durante esta sesión.</p>
      <div>
        <button class="ixtla-dashboard-button ixtla-dashboard-button--ghost" value="cancel">Cancelar</button>
        <button class="ixtla-dashboard-button ixtla-dashboard-button--danger" value="confirm">Sí, limpiar</button>
      </div>
    </form>
  </dialog>

  <script type="module" src="/JS/UAT/insights/dashboard.js?v=tooltips-2"></script>
</body>
</html>

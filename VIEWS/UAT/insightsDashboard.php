<?php
require_once __DIR__ . '/../../JS/UAT/auth/ix_guard.php';
ix_require_session(['login_url' => '/VIEWS/UAT/login.php']);
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ixtla Insights - Dashboard temporal</title>
  <link rel="stylesheet" href="/CSS/UAT/ixtla-insights-dashboard.css">
  <link rel="stylesheet" href="/CSS/UAT/ixtla-insights-chat.css">
</head>
<body class="ixtla-dashboard-page">
  <header class="ixtla-dashboard-top">
    <div class="ixtla-dashboard-brand">
      <p class="ixtla-dashboard-kicker">Ixtla Insights</p>
      <h1>Dashboard personalizado</h1>
      <p id="ixtla-dashboard-question">Cargando consulta...</p>
      <p id="ixtla-dashboard-scope" class="ixtla-dashboard-scope"></p>
    </div>
    <div class="ixtla-dashboard-actions">
      <button class="ixtla-dashboard-button ixtla-dashboard-button--ghost" id="ixtla-dashboard-add" type="button">+ Agregar widget</button>
      <a class="ixtla-dashboard-button ixtla-dashboard-button--ghost" href="/VIEWS/UAT/home.php">Abrir Home</a>
      <button class="ixtla-dashboard-button" id="ixtla-dashboard-clear" type="button">Limpiar dashboard</button>
    </div>
  </header>

  <main id="ixtla-dashboard-grid" class="ixtla-dashboard-grid" aria-live="polite"></main>

  <section id="ixtla-dashboard-empty" class="ixtla-dashboard-empty" hidden>
    <h2>No hay un dashboard temporal</h2>
    <p>Genera una grafica desde el chat de Home para abrir y poblar esta vista.</p>
    <a class="ixtla-dashboard-button" href="/VIEWS/UAT/home.php">Ir a Home</a>
  </section>

  <div class="ixtla-dashboard-modal" id="ixtla-dashboard-modal" hidden>
    <div class="ixtla-dashboard-modal__backdrop" data-ixtla-close-modal></div>
    <section class="ixtla-dashboard-modal__content" role="dialog" aria-modal="true" aria-labelledby="ixtla-dashboard-modal-title">
      <header><div><p class="ixtla-dashboard-kicker">Catalogo seguro</p><h2 id="ixtla-dashboard-modal-title">Agregar visualizacion</h2></div><button class="ixtla-dashboard-icon-button" data-ixtla-close-modal type="button" aria-label="Cerrar">&times;</button></header>
      <p>Los widgets usan exclusivamente los requerimientos visibles y autorizados en la consulta que abrio este dashboard.</p>
      <div id="ixtla-dashboard-catalog" class="ixtla-dashboard-catalog"></div>
    </section>
  </div>
  <script type="module" src="/JS/UAT/insights/dashboard.js"></script>
  <script type="module">
    import { mountIxtlaInsights } from "/JS/UAT/insights/chat.js";

    function mountDashboardAssistant() {
      const dashboard = window.IxtlaInsightsDashboard;
      if (!dashboard) return;
      mountIxtlaInsights({
        subtitle: "Asistente del dashboard",
        context: dashboard.getContext(),
        visualizationHandler: ({ question, context, spec }) => dashboard.addVisualization({ question, context, spec }),
      });
    }

    if (window.IxtlaInsightsDashboard) mountDashboardAssistant();
    else document.addEventListener("ixtla-insights:dashboard-ready", mountDashboardAssistant, { once: true });
  </script>
</body>
</html>

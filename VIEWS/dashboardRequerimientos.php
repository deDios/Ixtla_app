<?php
require_once __DIR__ . '/../JS/auth/ix_guard.php';
ix_require_session();
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Ixtla App — Dashboard Profesional</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="/favicon.ico">

  <link rel="stylesheet" href="/CSS/plantilla.css">
  <link rel="stylesheet" href="/CSS/components.css">
  <link rel="stylesheet" href="/CSS/dashboard.css">

  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
</head>
<body class="ix-app-container">

  <aside class="ix-sidebar">
    <div class="ix-sidebar-logo">
      <img src="/ASSETS/logo_ixtla_mini.png" alt="Logo">
    </div>
    <nav class="ix-sidebar-nav">
      <div class="nav-item active"><span class="icon">🏠</span></div>
      <div class="nav-item"><span class="icon">📁</span></div>
      <div class="nav-item"><span class="icon">📊</span></div>
    </nav>
    <div class="ix-sidebar-bottom">
      <div class="nav-item"><span class="icon">⚙️</span></div>
    </div>
  </aside>

  <div class="ix-main-content">
    
    <header class="ix-header-top">
      <div class="ix-header-titles">
        <h1>Dashboard de Requerimientos</h1>
        <p>Dashboard de requerimientos operativos</p>
      </div>
      <div class="ix-header-actions">
        <label class="ix-filter-month">
          <span>Mes:</span>
          <select id="filtro-mes">
            <option value="">Junio 2024</option>
            <option value="2024-05">Mayo 2024</option>
          </select>
        </label>
        <div class="ix-user-badge">
          <img src="/ASSETS/user/img_user1.png" alt="User">
        </div>
      </div>
    </header>

    <section class="ix-dept-grid" id="chips-departamentos"></section>

    <section class="ix-kpi-row">
      <div class="ix-kpi-card">
        <div class="kpi-info">
          <span class="kpi-label">PROMEDIO SEMANAL (Req)</span>
          <h2 id="kpi-val-semana">14.2</h2>
          <span class="kpi-sub">Req/Sem</span>
        </div>
        <div class="kpi-chart-mini"><canvas id="sparkline-1"></canvas></div>
      </div>
      <div class="ix-kpi-card">
        <div class="kpi-info">
          <span class="kpi-label">TIEMPO PROMEDIO RESOLUCIÓN</span>
          <h2 id="kpi-val-tiempo">2.5 Días</h2>
          <span class="kpi-sub">Tiempo x Req.</span>
        </div>
        <div class="kpi-icon-circle">🕒</div>
      </div>
      <div class="ix-kpi-card">
        <div class="kpi-info">
          <span class="kpi-label">CP CON MAYOR NÚMERO DE REQS</span>
          <h2 id="kpi-val-cp">45400</h2>
          <span class="kpi-sub">CP Top Ventas/Req</span>
        </div>
        <div class="kpi-icon-circle">📍</div>
      </div>
    </section>

    <section class="ix-dashboard-main-grid">
      
      <article class="ix-main-card">
        <div class="card-header-counts" id="cards-estatus-header">
          </div>
        <div class="ix-table-wrapper">
          <table class="ix-modern-table">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Abiertos</th>
                <th>Cerrados</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody id="tbl-tramites-body"></tbody>
          </table>
        </div>
      </article>

      <article class="ix-main-card ix-center-content">
        <div class="donut-container">
          <canvas id="donut-open-close-canvas" width="280" height="280"></canvas>
        </div>
        <div id="legend-open-close-labels" class="ix-donut-legend"></div>
      </article>

      <article class="ix-main-card ix-map-card">
        <div id="map-colonias"></div>
      </article>

    </section>
  </div>

  <script type="module" src="/JS/ui/JSDashboard.js"></script>
</body>
</html>
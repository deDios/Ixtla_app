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

  <link rel="stylesheet" href="/CSS/dashboard.css">

  <!-- Leaflet -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>

  <!-- Chart.js -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>

<body class="ix-app-container">

  <div class="ix-main-content">

    <!-- HEADER -->
    <header class="ix-header-top">
      <div>
        <h1>Dashboard de Requerimientos</h1>
        <p class="subtitle">Indicadores operativos</p>
      </div>

      <div class="ix-header-actions">
        <select id="filtro-mes" class="ix-select">
          <option value="ALL">Todos</option>
        </select>
      </div>
    </header>

    <!-- CHIPS -->
    <section class="ix-dept-grid" id="chips-departamentos"></section>

    <!-- KPI -->
    <section class="ix-kpi-row">
      <div class="ix-kpi-card">
        <div>
          <span class="kpi-label">PROMEDIO SEMANAL</span>
          <h2 id="kpi-val-semana">0</h2>
          <span class="kpi-sub">Req/Sem</span>
        </div>
      </div>

      <div class="ix-kpi-card">
        <div>
          <span class="kpi-label">TIEMPO PROMEDIO</span>
          <h2 id="kpi-val-tiempo">0 Días</h2>
          <span class="kpi-sub">Resolución</span>
        </div>
      </div>

      <div class="ix-kpi-card">
        <div>
          <span class="kpi-label">CP TOP</span>
          <h2 id="kpi-val-cp">—</h2>
          <span class="kpi-sub">Mayor incidencia</span>
        </div>
      </div>
    </section>

    <!-- GRID PRINCIPAL -->
    <section class="ix-dashboard-main-grid">

      <!-- TABLA -->
      <article class="ix-main-card">
        <div class="card-header-counts" id="cards-estatus-header"></div>

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
      </article>

      <!-- DONUT -->
      <article class="ix-main-card ix-center-content">
        <canvas id="donutChart"></canvas>
        <div id="legend-open-close-labels" class="ix-donut-legend"></div>
      </article>

      <!-- MAPA -->
      <article class="ix-main-card ix-map-card">
        <div id="map-colonias"></div>
      </article>

    </section>

  </div>

  <script type="module" src="/JS/ui/JSDashboard.js"></script>
</body>
</html>
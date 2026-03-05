<?php
require_once __DIR__ . '/../JS/auth/ix_guard.php';
ix_require_session();
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Ixtla App — Dashboard de Requerimientos Rediseñado</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="/favicon.ico">

  <link rel="stylesheet" href="/CSS/plantilla.css">
  <link rel="stylesheet" href="/CSS/components.css">
  <link rel="stylesheet" href="/CSS/dashboard.css">

  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
    crossorigin=""
  />
  <script
    src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
    crossorigin=""
    defer
  ></script>
</head>
<body>
  <header id="header" data-link-home="/index.php"></header>

  <main class="ix-dashboard">
    <header class="ix-dash-head">
      <div>
        <h1 class="ix-title">Dashboard de Requerimientos</h1>
        <p class="ix-subtitle">Resumen operativo por trámite, estatus y estado (abierto/cerrado)</p>
      </div>
      <div class="ix-filtros">
        <label class="ix-filter">
          <span>Mes:</span>
          <input type="month" id="filtro-mes">
        </label>
      </div>
    </header>

    <section class="ix-dept-chips" aria-label="Filtrar por departamento">
      <div class="ix-chips-scroll" id="chips-departamentos" role="tablist" aria-label="Departamentos"></div>
    </section>

    <section class="ix-kpi-totalizers">
      <div class="ix-card ix-kpi-card" id="kpi-req-semana">
        <div class="ix-kpi-label">Promedio Requerimientos / Semana</div>
        <div class="ix-kpi-value" id="kpi-val-semana">0</div>
        <div class="ix-kpi-formula">Cálculo pendiente...</div>
      </div>
      <div class="ix-card ix-kpi-card" id="kpi-tiempo-req">
        <div class="ix-kpi-label">Tiempo Promedio / Requerimiento</div>
        <div class="ix-kpi-value" id="kpi-val-tiempo">0</div>
        <div class="ix-kpi-formula">Cálculo pendiente...</div>
      </div>
      <div class="ix-card ix-kpi-card" id="kpi-cp-top">
        <div class="ix-kpi-label">CP con Mayor No. Requerimientos</div>
        <div class="ix-kpi-value" id="kpi-val-cp">0</div>
        <div class="ix-kpi-formula">Cálculo pendiente...</div>
      </div>
    </section>

    <section class="ix-dash-grid">
      <article class="ix-card ix-card--equal">
        <div class="ix-fill-scroll">
          <div class="ix-table" id="tbl-tramites">
            <div class="ix-thead ix-thead--4cols">
              <div>Trámite</div>
              <div class="ta-right">Abiertos</div>
              <div class="ta-right">Cerrados</div>
              <div class="ta-right">Total</div>
            </div>
            <div class="ix-tbody" id="tbl-tramites-body"></div>
          </div>
        </div>
      </article>

      <article class="ix-card ix-card--equal">
        <div id="cards-estatus" class="ix-cards"></div>
        <div class="ix-donut ix-donut--fullcenter ix-donut--under-status">
          <canvas id="donut-open-close-2" width="320" height="320" aria-label="Distribución Abiertos vs Cerrados (con etiquetas)" role="img"></canvas>
          <div class="ix-donut-legend" id="legend-open-close-2"></div>
        </div>
      </article>

      <article class="ix-card ix-card--equal ix-card--map">
        <div class="ix-fill-scroll">
          <div id="map-colonias" aria-label="Mapa de calor geográfico"></div>
          <div id="map-legend" class="map-legend" aria-hidden="true"></div>
        </div>
      </article>
    </section>
  </main>

  <script type="module" src="/JS/ui/JSDashboard.js"></script>

</body>
</html>
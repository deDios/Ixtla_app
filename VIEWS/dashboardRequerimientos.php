<?php
require_once __DIR__ . '/../JS/auth/ix_guard.php';
ix_require_session();
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Ixtla App — Dashboard de Requerimientos</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="/favicon.ico">

  <!-- Estilos base -->
  <link rel="stylesheet" href="/CSS/plantilla.css">
  <link rel="stylesheet" href="/CSS/components.css">
  <!-- Estilos del dashboard -->
  <link rel="stylesheet" href="/CSS/dashboard.css">

  <!-- Leaflet (mapa) -->
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

    <!-- Filtros por Departamento -->
    <section class="ix-dept-chips" aria-label="Filtrar por departamento">
      <div class="ix-chips-scroll" id="chips-departamentos" role="tablist" aria-label="Departamentos"></div>
    </section>

    <!-- Grid principal -->
    <section class="ix-dash-grid">
      <!-- (1) Tabla por trámite (con scroll interno) -->
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

      <!-- (2) Estatus + Donut replicado con data labels -->
      <article class="ix-card ix-card--equal">
        <div id="cards-estatus" class="ix-cards"></div>

        <div class="ix-donut ix-donut--fullcenter ix-donut--under-status">
          <canvas id="donut-open-close-2" width="320" height="320"
                  aria-label="Distribución Abiertos vs Cerrados (con etiquetas)" role="img"></canvas>
          <div class="ix-donut-legend" id="legend-open-close-2"></div>
        </div>
      </article>

      <!-- (3) MAPA por colonias (con scroll interno si hace falta) -->
      <article class="ix-card ix-card--equal">
        <div class="ix-fill-scroll">
          <div id="map-colonias" aria-label="Mapa por colonias"></div>
          <div id="map-legend" class="map-legend" aria-hidden="true"></div>
        </div>
      </article>
    </section>
  </main>

  <script src="/JS/JSglobal.js"></script>
  <script type="module" src="/JS/auth/session.js"></script>
  <script type="module" src="/JS/ui/dashboardRequerimientos.js"></script>
  <!-- JS nuevo SOLO para el mapa -->
  <script type="module" src="/JS/ui/mapRequerimientos.js"></script>
  <script type="module" src="/JS/ui/mapRequerimientos_points.js"></script>

</body>
</html>

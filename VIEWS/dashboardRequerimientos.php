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
      <!-- (1) Tabla por trámite -->
      <article class="ix-card">
        <div class="ix-table" id="tbl-tramites">
          <div class="ix-thead ix-thead--4cols">
            <div>Trámite</div>
            <div class="ta-right">Abiertos</div>
            <div class="ta-right">Cerrados</div>
            <div class="ta-right">Total</div>
          </div>
          <div class="ix-tbody" id="tbl-tramites-body"></div>
        </div>
      </article>

      <!-- (2) Estatus + (2b) Donut replicado con data labels -->
      <article class="ix-card">
        <div id="cards-estatus" class="ix-cards"></div>

        <!-- Donut replicado debajo del estatus con data labels -->
        <div class="ix-donut ix-donut--fullcenter ix-donut--under-status">
          <canvas id="donut-open-close-2" width="320" height="320"
                  aria-label="Distribución Abiertos vs Cerrados (con etiquetas)" role="img"></canvas>
          <div class="ix-donut-legend" id="legend-open-close-2"></div>
        </div>
      </article>

      <!-- (3) Donut original (sin data labels) -->
      <article class="ix-card ix-card--donut">
        <div class="ix-donut ix-donut--fullcenter">
          <canvas id="donut-open-close" width="340" height="340"
                  aria-label="Distribución Abiertos vs Cerrados" role="img"></canvas>
          <div class="ix-donut-legend" id="legend-open-close"></div>
        </div>
      </article>
    </section>
  </main>

  <script src="/JS/JSglobal.js"></script>
  <script type="module" src="/JS/auth/session.js"></script>
  <script type="module" src="/JS/ui/dashboardRequerimientos.js"></script>
</body>
</html>

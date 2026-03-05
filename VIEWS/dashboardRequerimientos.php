<?php
require_once __DIR__ . '/../JS/auth/ix_guard.php';
ix_require_session();
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Ixtla App — Dashboard de Gestión</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="/favicon.ico">

  <link rel="stylesheet" href="/CSS/plantilla.css">
  <link rel="stylesheet" href="/CSS/components.css">
  <link rel="stylesheet" href="/CSS/dashboard.css">

  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
</head>
<body>
  <div class="ix-main-header">
     <h1>Plataforma de Gestión Ixtlahuacán</h1>
  </div>

  <header id="header" data-link-home="/index.php"></header>

  <main class="ix-dashboard">
    <header class="ix-dash-head">
      <div class="ix-filtros">
        <label class="ix-filter">
          <span>Periodo:</span>
          <select id="filtro-mes">
            <option value="">Todos los meses</option>
            <?php
              // Generación dinámica de los últimos 12 meses
              for ($i = 0; $i < 12; $i++) {
                $date = date('Y-m', strtotime("-$i months"));
                $label = date('F Y', strtotime($date));
                echo "<option value='$date'>$label</option>";
              }
            ?>
          </select>
        </label>
      </div>
    </header>

    <section class="ix-dept-chips">
      <div class="ix-chips-scroll" id="chips-departamentos" role="tablist"></div>
    </section>

    <section class="ix-kpi-totalizers">
      <div class="ix-card ix-kpi-card" id="kpi-req-semana">
        <div class="ix-kpi-label">Requerimientos / Semana</div>
        <div class="ix-kpi-value" id="kpi-val-semana">0</div>
      </div>
      <div class="ix-card ix-kpi-card" id="kpi-tiempo-req">
        <div class="ix-kpi-label">Tiempo Promedio Resolución</div>
        <div class="ix-kpi-value" id="kpi-val-tiempo">0</div>
      </div>
      <div class="ix-card ix-kpi-card" id="kpi-cp-top">
        <div class="ix-kpi-label">CP Mayor Incidencia</div>
        <div class="ix-kpi-value" id="kpi-val-cp">0</div>
      </div>
    </section>

    <section class="ix-dash-grid">
      <article class="ix-card ix-card--equal">
        <div class="ix-fill-scroll">
          <div class="ix-table">
            <div class="ix-thead">
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
        <div class="ix-donut">
          <canvas id="donut-open-close-2" width="280" height="280"></canvas>
          <div class="ix-donut-legend" id="legend-open-close-2"></div>
        </div>
      </article>

      <article class="ix-card ix-card--equal ix-card--map">
        <div id="map-colonias"></div>
        <div id="map-legend" class="map-legend"></div>
      </article>
    </section>
  </main>

  <script type="module" src="/JS/ui/JSDashboard.js"></script>
</body>
</html>
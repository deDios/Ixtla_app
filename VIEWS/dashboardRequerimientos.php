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
</head>
<body class="ix-dashboard-body">

  <header id="header" data-link-home="/index.php"></header>

  <div class="ix-main-container">
    <header class="ix-header-top">
      <div class="ix-header-titles">
        <h1 class="ix-header-title">Dashboard de Requerimientos</h1>
        <p class="ix-header-subtitle">Resumen operativo por trámite, estatus y estado</p>
      </div>
      <div class="ix-header-actions">
        
        <label class="ix-demo-toggle" for="demo-mode-checkbox">
          <input type="checkbox" id="demo-mode-checkbox">
          <span>DEMO</span>
        </label>

        <div class="ix-period-select">
          <label for="filtro-mes">Mes:</label>
          <select id="filtro-mes">
            <option value="">Todos los meses</option>
            <?php
              $meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
              for ($i = 0; $i < 12; $i++) {
                $date = date('Y-m', strtotime("-$i months"));
                $m = (int)date('m', strtotime($date));
                $y = date('Y', strtotime($date));
                echo "<option value='$date'>{$meses[$m-1]} $y</option>";
              }
            ?>
          </select>
        </div>
        <div class="ix-user-badge">
          <img src="/ASSETS/user/img_user1.png" alt="User" id="hs-avatar">
        </div>
      </div>
    </header>

    <section class="ix-dept-scroller">
      <div id="chips-departamentos" class="ix-dept-grid"></div>
    </section>

    <section class="ix-kpi-row">
      <div class="ix-card ix-kpi-card">
        <div class="kpi-info">
          <span class="kpi-label">PROMEDIO SEMANAL (REQ)</span>
          <h2 id="kpi-val-semana">--</h2>
          <span class="kpi-sub">Req/Sem</span>
        </div>
      </div>
      <div class="ix-card ix-kpi-card">
        <div class="kpi-info">
          <span class="kpi-label">TIEMPO PROMEDIO RESOLUCIÓN</span>
          <h2 id="kpi-val-tiempo">--</h2>
          <span class="kpi-sub">Tiempo x Req.</span>
        </div>
        <div class="kpi-icon-circle">
          <img src="/ASSETS/icons/clock.svg" alt="Reloj" width="20" style="opacity: 0.6;" onerror="this.style.display='none'">
        </div>
      </div>
      <div class="ix-card ix-kpi-card">
        <div class="kpi-info">
          <span class="kpi-label">MAYOR INCIDENCIA</span>
          <h2 id="kpi-val-incidencias">--</h2>
          <span class="kpi-sub" id="kpi-sub-cp">Calculando...</span>
        </div>
        <div class="kpi-icon-circle">
          <img src="/ASSETS/icons/pin.svg" alt="Pin" width="20" style="opacity: 0.6;" onerror="this.style.display='none'">
        </div>
      </div>
    </section>

    <section class="ix-dashboard-main-grid">
      <article class="ix-card ix-main-card ix-card-table">
        <div class="card-header-counts" id="status-summary-header"></div>
        <div class="ix-table-wrapper">
          <table class="ix-modern-table">
            <thead>
              <tr>
                <th class="col-main">Categoría</th>
                <th class="ta-right">Abiertos</th>
                <th class="ta-right">Cerrados</th>
                <th class="ta-right">Total</th>
              </tr>
            </thead>
            <tbody id="tbl-tramites-body"></tbody>
          </table>
        </div>
      </article>

      <article class="ix-card ix-main-card ix-center-content">
        <div class="donut-container">
          <canvas id="donut-canvas" width="220" height="220"></canvas>
        </div>
        <div id="donut-legend" class="ix-donut-html-legend"></div>
      </article>

      <article class="ix-card ix-main-card ix-map-card">
        <div id="map-colonias"></div>
      </article>
    </section>
  </div>

  <script type="module" src="/JS/ui/JSDashboard.js"></script>
</body>
</html>
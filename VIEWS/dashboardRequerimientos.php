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
<body class="ix-app-layout">

  <aside class="ix-sidebar">
    <div class="ix-sidebar-brand">
      <img src="/ASSETS/logo_mini.png" alt="Ixtla" class="ix-logo-side">
    </div>
    <nav class="ix-sidebar-nav">
      <div class="ix-nav-item active"><span class="icon">🏠</span></div>
      <div class="ix-nav-item"><span class="icon">📋</span></div>
      <div class="ix-nav-item"><span class="icon">📊</span></div>
    </nav>
    <div class="ix-sidebar-footer">
      <div class="ix-nav-item"><span class="icon">🚪</span></div>
    </div>
  </aside>

  <div class="ix-main-wrapper">
    <header class="ix-top-header">
      <div class="ix-header-info">
        <h1 class="ix-header-title">Dashboard de Requerimientos</h1>
        <p class="ix-header-subtitle">Dashboard de requerimientos operativos</p>
      </div>
      <div class="ix-header-tools">
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
        <div class="ix-user-profile">
          <img src="/ASSETS/user/img_user1.png" alt="Perfil" id="hs-avatar">
        </div>
      </div>
    </header>

    <main class="ix-content">
      <section class="ix-dept-scroller">
        <div id="chips-departamentos" class="ix-dept-grid"></div>
      </section>

      <section class="ix-kpi-grid">
        <div class="ix-card kpi-card">
          <div class="kpi-content">
            <span class="kpi-label">PROMEDIO SEMANAL (Req)</span>
            <div class="kpi-value">14.2</div>
            <span class="kpi-meta">Req/Sem</span>
          </div>
          <div class="kpi-visual">
            <canvas id="sparkline-1" width="100" height="40"></canvas>
          </div>
        </div>
        <div class="ix-card kpi-card">
          <div class="kpi-content">
            <span class="kpi-label">TIEMPO PROMEDIO RESOLUCIÓN</span>
            <div class="kpi-value">2.5 Días</div>
            <span class="kpi-meta">Tiempo x Req.</span>
          </div>
          <div class="kpi-visual-icon">🕒</div>
        </div>
        <div class="ix-card kpi-card">
          <div class="kpi-content">
            <span class="kpi-label">CP CON MAYOR NÚMERO DE REQS</span>
            <div class="kpi-value">45400</div>
            <span class="kpi-meta">CP Top Ventas/Req</span>
          </div>
          <div class="kpi-visual-icon">📍</div>
        </div>
      </section>

      <section class="ix-main-grid">
        <article class="ix-card ix-table-card">
          <header class="ix-table-stats" id="status-summary-header"></header>
          <div class="ix-table-scroll">
            <table class="ix-modern-table">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Abiertos</th>
                  <th>Cerrados</th>
                  <th class="ta-right">Total</th>
                </tr>
              </thead>
              <tbody id="tbl-tramites-body"></tbody>
            </table>
          </div>
        </article>

        <article class="ix-card ix-donut-card">
          <div class="ix-donut-container">
            <canvas id="donut-canvas" width="300" height="300"></canvas>
          </div>
          <div id="donut-legend" class="ix-donut-legend"></div>
        </article>

        <article class="ix-card ix-map-card">
          <div id="map-colonias"></div>
        </article>
      </section>
    </main>
  </div>

  <script type="module" src="/JS/ui/JSDashboard.js"></script>
</body>
</html>
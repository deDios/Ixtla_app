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

  <!-- Estilos base que ya usas -->
  <link rel="stylesheet" href="/CSS/plantilla.css">
  <link rel="stylesheet" href="/CSS/components.css">
  <!-- Estilos propios del dashboard -->
  <link rel="stylesheet" href="/CSS/dashboard.css">
</head>
<body>
  <!-- Header existente si lo tienes como include -->
  <header id="header" data-link-home="/index.php"></header>

  <main class="ix-dashboard">
    <header class="ix-dash-head">
      <div>
        <h1 class="ix-title">Dashboard de Requerimientos</h1>
        <p class="ix-subtitle">Resumen operativo por trámite, estatus y estado (abierto/cerrado)</p>
      </div>
      <div class="ix-filtros">
        <!-- Mes (YYYY-MM) -->
        <label class="ix-filter">
          <span>Mes:</span>
          <input type="month" id="filtro-mes">
        </label>
      </div>
    </header>

    <!-- Filtros por Departamento (chips) -->
    <section class="ix-dept-chips" aria-label="Filtrar por departamento">
      <div class="ix-chips-scroll" id="chips-departamentos" role="tablist" aria-label="Departamentos">
        <!-- Se inyectan chips por JS. Incluye “Todos” como chip 0 -->
      </div>
    </section>

    <!-- Grid principal -->
    <section class="ix-dash-grid">
      <!-- Tabla izquierda -->
      <article class="ix-card">
        <div class="ix-card-head">
          <h3>Requerimientos por trámite</h3>
          <small id="meta-tramites" class="ix-meta"></small>
        </div>

        <div class="ix-table" id="tbl-tramites">
          <div class="ix-thead">
            <div>Trámite</div>
            <div class="ta-right">#</div>
          </div>
          <div class="ix-tbody" id="tbl-tramites-body">
            <!-- rows por JS -->
          </div>
        </div>
      </article>

      <!-- Tarjetas por estatus -->
      <article class="ix-card">
        <div class="ix-card-head">
          <h3>Estatus</h3>
          <small id="meta-estatus" class="ix-meta"></small>
        </div>
        <div id="cards-estatus" class="ix-cards">
          <!-- 7 tarjetas fijas por JS -->
        </div>
      </article>

      <!-- Abiertos vs Cerrados -->
      <article class="ix-card">
        <div class="ix-card-head">
          <h3>Abiertos vs Cerrados</h3>
          <small id="meta-openclose" class="ix-meta"></small>
        </div>

        <div class="ix-donut">
          <canvas id="donut-open-close" width="320" height="320"
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

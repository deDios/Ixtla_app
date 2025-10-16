<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Ixtla App</title>

  <!-- Estilos del sitio -->
  <link rel="stylesheet" href="/CSS/plantilla.css">
  <link rel="stylesheet" href="/CSS/home.css">
  <link rel="stylesheet" href="/CSS/components.css">
  <link rel="icon" href="/favicon.ico">
</head>

<body>
  <!-- Header -->
  <header id="header" data-link-home="/index.php">
    <div class="social-bar-mobile">
      <div class="social-icons">
        <div class="icon-mobile"><img src="/ASSETS/social_icons/Facebook_logo.png" alt="Facebook"/></div>
        <div class="icon-mobile"><img src="/ASSETS/social_icons/Instagram_logo.png" alt="Instagram"/></div>
        <div class="icon-mobile"><img src="/ASSETS/social_icons/Youtube_logo.png" alt="YouTube"/></div>
        <div class="icon-mobile"><img src="/ASSETS/social_icons/X_logo.png" alt="X"/></div>
        <!-- El JSglobal reemplaza este avatar cuando hay sesión -->
        <div class="user-icon-mobile" onclick="window.location.href='/VIEWS/login.php'">
          <img src="/ASSETS/user/userImgs/default.png" alt="Usuario"/>
        </div>
      </div>
    </div>

    <!-- Top bar -->
    <div class="top-bar" id="top-bar">
      <div id="logo-btn" class="logo" title="Ir al inicio" aria-label="Ir al inicio">
        <img class="logo-marca" src="/ASSETS/main_logo.png" alt="Ixtlahuacán de los Membrillos - Ayuntamiento"/>
      </div>

      <div class="actions">
        <button href="/VIEWS/contacto.php" class="btn btn-contacto" type="button"
                onclick="window.location.href=this.getAttribute('href')">
          Contacto
        </button>
        <button class="hamburger" aria-controls="mobile-menu" aria-expanded="false" aria-label="Abrir menú" onclick="toggleMenu()">
          <span></span><span></span><span></span>
        </button>
        <!-- El JSglobal inyecta aquí el avatar desktop si hay sesión -->
      </div>
    </div>

    <!-- Subnav -->
    <nav id="mobile-menu" class="subnav" aria-label="Navegación secundaria">
      <div class="nav-left">
        <a href="/index.php">Inicio</a>
        <a href="/VIEWS/tramiteDepartamento.php">Trámites y Seguimiento</a>
      </div>
      <div class="social-icons">
        <div class="circle-icon"><img src="/ASSETS/social_icons/Facebook_logo.png" alt="Facebook"/></div>
        <div class="circle-icon"><img src="/ASSETS/social_icons/Instagram_logo.png" alt="Instagram"/></div>
        <div class="circle-icon"><img src="/ASSETS/social_icons/Youtube_logo.png" alt="YouTube"/></div>
        <div class="circle-icon"><img src="/ASSETS/social_icons/X_logo.png" alt="X"/></div>
      </div>
    </nav>
  </header>

  <!-- MAIN -->
  <main class="home-samapa">
    <div class="hs-wrap">
      <!-- === SIDEBAR ======================================================= -->
      <aside class="hs-sidebar">
        <!-- Perfil -->
        <section class="hs-profile" aria-label="Perfil">
          <img id="hs-avatar" class="avatar" src="/ASSETS/user/userImgs/default.png" alt="Avatar"/>
          <h3 id="hs-profile-name" class="name">—</h3>
          <span id="hs-profile-badge" class="badge">—</span>
          <button class="btn" id="btn-edit-profile" type="button" aria-haspopup="dialog" aria-controls="profile-modal">
            Editar perfil
          </button>
        </section>

        <!-- Estados (filtros) -->
        <nav id="hs-states" class="hs-states" aria-label="Estados">
          <button class="item is-active" data-status="todos" role="radio" aria-checked="true">
            <span class="label">Todos</span><span class="count" id="cnt-todos">(0)</span>
          </button>
          <button class="item" data-status="solicitud" role="radio" aria-checked="false">
            <span class="label">Solicitud</span><span class="count" id="cnt-solicitud">(0)</span>
          </button>
          <button class="item" data-status="revision" role="radio" aria-checked="false">
            <span class="label">Revisión</span><span class="count" id="cnt-revision">(0)</span>
          </button>
          <button class="item" data-status="asignacion" role="radio" aria-checked="false">
            <span class="label">Asignación</span><span class="count" id="cnt-asignacion">(0)</span>
          </button>
          <button class="item" data-status="enProceso" role="radio" aria-checked="false">
            <span class="label">En proceso</span><span class="count" id="cnt-enProceso">(0)</span>
          </button>
          <button class="item" data-status="pausado" role="radio" aria-checked="false">
            <span class="label">Pausado</span><span class="count" id="cnt-pausado">(0)</span>
          </button>
          <button class="item" data-status="cancelado" role="radio" aria-checked="false">
            <span class="label">Cancelado</span><span class="count" id="cnt-cancelado">(0)</span>
          </button>
          <button class="item" data-status="finalizado" role="radio" aria-checked="false">
            <span class="label">Finalizado</span><span class="count" id="cnt-finalizado">(0)</span>
          </button>
        </nav>
      </aside>

      <!-- === MAIN ========================================================== -->
      <section class="hs-main">
        <!-- CHARTS -->
        <div class="hs-charts" id="hs-charts">
          <!-- Línea: este año (sin título visible) -->
          <section class="hs-card" aria-labelledby="y-title">
            <h3 id="y-title" class="sr-only">Gráfico de este Año</h3>
            <div class="hs-chart-wrap" style="position:relative;">
              <canvas id="chart-year" width="600" height="240" aria-describedby="y-desc"></canvas>
              <!-- tooltip -->
              <div class="chart-tip" style="position:absolute;pointer-events:none;padding:.35rem .5rem;border-radius:.5rem;background:#1f2937;color:#fff;font:12px/1.2 system-ui;opacity:0;transform:translate(-50%,-120%);transition:opacity .12s;"></div>
            </div>
            <p id="y-desc" class="sr-only">Serie mensual (Ene–Dic) de requerimientos creados durante el año actual.</p>
          </section>

          <!-- Donut: GLOBAL por tipo de trámite (sin título visible) -->
          <section class="hs-card" aria-labelledby="m-title">
            <h3 id="m-title" class="sr-only">Gráfico de distribución por tipo</h3>
            <div class="hs-chart-wrap" style="position:relative;">
              <canvas id="chart-month" width="380" height="240" aria-describedby="m-desc"></canvas>
              <!-- tooltip -->
              <div class="chart-tip" style="position:absolute;pointer-events:none;padding:.35rem .5rem;border-radius:.5rem;background:#1f2937;color:#fff;font:12px/1.2 system-ui;opacity:0;transform:translate(-50%,-120%);transition:opacity .12s;"></div>
            </div>
            <!-- La leyenda la renderiza el JS -->
            <ul id="donut-legend" class="hs-legend" aria-hidden="true"></ul>
            <p id="m-desc" class="sr-only">Distribución total de requerimientos por tipo de trámite (acumulado).</p>
          </section>
        </div>

        <!-- TABLA -->
        <section class="hs-table">
          <div class="hs-head">
            <h3 style="margin:0;">Trámites</h3>
            <div class="hs-tools">
              <div class="search" role="search">
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M10 4a6 6 0 0 1 4.472 9.931l4.298 4.297l-1.414 1.415l-4.297-4.298A6 6 0 1 1 10 4m0 2a4 4 0 1 0 0 8a4 4 0 0 0 0-8"/>
                </svg>
                <input id="hs-search" type="search" placeholder="Buscar por folio (REQ-...), ID o status…" aria-label="Buscar"/>
              </div>
              <div class="legend">
                <span>Requerimientos: <strong id="hs-legend-total">0</strong></span>
                <span style="margin:0 .4rem;">·</span>
                <span>Filtro: <strong id="hs-legend-status">Todos</strong></span>
              </div>
            </div>
          </div>

          <div id="hs-table-wrap" class="table-wrap">
            <table class="gc" aria-describedby="hs-search">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Tipo de trámite</th>
                  <th>Asignado</th>
                  <th>Teléfono</th>
                  <th>Estatus</th>
                </tr>
              </thead>
              <tbody id="hs-table-body"></tbody>
            </table>
          </div>

          <!-- Paginación (se inyecta con el JS, usa tus estilos .btn) -->
          <nav id="hs-pager" class="hs-pager" aria-label="Paginación"></nav>
        </section>
      </section>
    </div>
  </main>

  <!-- Footer -->
  <footer id="site-footer">
    <div class="limite">
      <div class="footer-brand">
        <img class="brand-lockup" src="/ASSETS/main_logo_al_frente.png" alt="Ixtlahuacán de los Membrillos - Ayuntamiento">
      </div>
      <div class="footer-cols">
        <div class="col left">
          <div class="left-inner">
            <img class="footer-crest" src="/ASSETS/main_logo_shield.png" alt="Escudo municipal">
            <p class="copyright">
              © Presidente José Heriberto García Murillo Gobierno de Ixtlahuacán de los Membrillos 2021 |
              Todos los derechos reservados.
            </p>
          </div>
        </div>
        <div class="col right">
          <p class="location">
            Ubicación: Jardín, Ixtlahuacán de Los Membrillos Centro, 2 Jardín,
            45850 Ixtlahuacán de los Membrillos, Jal.
          </p>
        </div>
      </div>
    </div>
  </footer>

  <!-- ====================== MODAL: Editar Perfil ======================= -->
  <div id="profile-modal" class="modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title" hidden>
    <div class="modal-backdrop" data-close></div>
    <div class="modal-card" role="document" style="max-width:520px;">
      <header class="modal-header">
        <h4 id="profile-modal-title">Editar perfil</h4>
        <button class="btn" type="button" data-close aria-label="Cerrar">✕</button>
      </header>
      <div class="modal-body">
        <form id="profile-form">
          <div class="field">
            <label for="pf-nombre">Nombre</label>
            <input id="pf-nombre" name="nombre" type="text" class="ixd-input"/>
          </div>
          <div class="field">
            <label for="pf-apellidos">Apellidos</label>
            <input id="pf-apellidos" name="apellidos" type="text" class="ixd-input"/>
          </div>
          <div class="field">
            <label for="pf-avatar">Avatar (imagen)</label>
            <input id="pf-avatar" name="avatar" type="file" accept="image/*"/>
          </div>
        </form>
      </div>
      <footer class="modal-footer">
        <button class="btn" data-close type="button">Cancelar</button>
        <button class="btn primary" id="pf-save" type="button">Guardar</button>
      </footer>
    </div>
  </div>

  <!-- Guard -->
  <script type="module">
    import { guardPage } from "/JS/auth/guard.js";
    guardPage({ stealth:false, redirectTo: "/VIEWS/login.php" });
  </script>

  <!-- Pagina -->

  <script type="module" src="/JS/auth/session.js"></script>
  <script type="module" src="/JS/home.js"></script>
  <script src="/JS/JSglobal.js"></script>

  <!-- pequeño script para el modal 
  <script>
    (function(){
      const modal = document.getElementById('profile-modal');
      const openBtn = document.getElementById('btn-edit-profile');
      const closeEls = modal ? modal.querySelectorAll('[data-close], .modal-backdrop') : [];
      if (openBtn && modal) {
        openBtn.addEventListener('click', () => { modal.hidden = false; });
      }
      closeEls.forEach(el => el.addEventListener('click', () => { modal.hidden = true; }));
      // Escape
      document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape' && !modal.hidden) modal.hidden = true; });
    })();
  </script>
    -->

</body>
</html>

<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ixtla App</title>
    <link rel="stylesheet" href="/CSS/plantilla.css">
    <link rel="stylesheet" href="/CSS/home.css">
    <link rel="stylesheet" href="/CSS/components.css">
    <link rel="icon" href="/favicon.ico">
</head>

<body>

    <!-- Tope de pagina -->
    <header id="header" data-link-home="/index.php">
        <div class="social-bar-mobile">
            <div class="social-icons">
                <div class="icon-mobile"><img src="/ASSETS/social_icons/Facebook_logo.png" alt="Facebook" /></div>
                <div class="icon-mobile"><img src="/ASSETS/social_icons/Instagram_logo.png" alt="Instagram" /></div>
                <div class="icon-mobile"><img src="/ASSETS/social_icons/Youtube_logo.png" alt="YouTube" /></div>
                <div class="icon-mobile"><img src="/ASSETS/social_icons/X_logo.png" alt="X" /></div>
                <div class="user-icon-mobile" onclick="window.location.href='/VIEWS/login.php'">
                    <img src="/ASSETS/user/img_user1.png" alt="Usuario" />
                </div>
            </div>
        </div>

        <div class="top-bar" id="top-bar">
            <div id="logo-btn" class="logo" title="Ir al inicio" aria-label="Ir al inicio">
                <img class="logo-marca" src="/ASSETS/main_logo.png"
                    alt="Ixtlahuacán de los Membrillos - Ayuntamiento" />
            </div>
            <div class="actions">
                <button href="/VIEWS/contacto.php" class="btn btn-contacto" type="button"
                    onclick="window.location.href=this.getAttribute('href')">Contacto</button>
                <button class="hamburger" aria-controls="mobile-menu" aria-expanded="false" aria-label="Abrir menú"
                    onclick="toggleMenu()">
                    <span></span><span></span><span></span>
                </button>
            </div>
        </div>

        <nav id="mobile-menu" class="subnav" aria-label="Navegación secundaria">
            <div class="nav-left">
                <a href="/index.php">Inicio</a>
                <a href="/VIEWS/tramiteDepartamento.php">Trámites y Seguimiento</a>
            </div>
            <div class="social-icons">
                <div class="circle-icon"><img src="/ASSETS/social_icons/Facebook_logo.png" alt="Facebook" /></div>
                <div class="circle-icon"><img src="/ASSETS/social_icons/Instagram_logo.png" alt="Instagram" /></div>
                <div class="circle-icon"><img src="/ASSETS/social_icons/Youtube_logo.png" alt="YouTube" /></div>
                <div class="circle-icon"><img src="/ASSETS/social_icons/X_logo.png" alt="X" /></div>
            </div>
        </nav>
    </header>

    <main class="home-samapa">
        <div class="hs-wrap">

            <!-- SIDEBAR -->
            <aside class="hs-sidebar">
                <section class="hs-profile" aria-label="Perfil">
                    <img id="hs-avatar" class="avatar" src="/ASSETS/user/img_user1.png" alt="Avatar">
                    <h3 id="hs-profile-name" class="name">—</h3>
                    <!-- boton de modal -->
                    <button type="button" class="gc-btn gc-btn-ghost edit-profile" data-open="#modal-perfil"
                        aria-haspopup="dialog" aria-controls="modal-perfil">
                        Administrar perfil ›
                    </button>
                    <span id="hs-profile-badge" class="badge">—</span>
                </section>
                <!-- se actulizaron los filtros ahora deberian coincidir con los esperados -->
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
                    <button class="item" data-status="proceso" role="radio" aria-checked="false">
                        <span class="label">En proceso</span><span class="count" id="cnt-proceso">(0)</span>
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

            <!-- MAIN -->
            <section class="hs-main">

                <!-- CHARTS -->
                <div class="hs-charts" id="hs-charts">

                    <!-- Línea (año actual, sin título) -->
                    <section class="hs-card" aria-labelledby="y-desc">
                        <div class="hs-chart-wrap" style="position:relative;">
                            <canvas id="chart-year" width="600" height="240" aria-describedby="y-desc"></canvas>
                            <!-- Tooltip (lo usa LineChart) -->
                            <div class="chart-tip"
                                style="position:absolute;pointer-events:none;padding:.35rem .5rem;border-radius:.5rem;background:#1f2937;color:#fff;font:12px/1.2 system-ui;opacity:0;transform:translate(-50%,-120%);transition:opacity .12s;">
                            </div>
                        </div>
                        <p id="y-desc" class="sr-only">Serie mensual de requerimientos creados durante el año actual.
                        </p>
                    </section>

                    <!-- Donut -->
                    <section class="hs-card" aria-labelledby="m-desc">
                        <div class="hs-donut">
                            <!-- Columna: gráfico -->
                            <div class="hs-chart-wrap" style="position:relative;">
                                <canvas id="chart-month" width="380" height="240" aria-describedby="m-desc"></canvas>
                                <!-- Tooltip (lo usa DonutChart) -->
                                <div class="chart-tip"
                                    style="position:absolute;pointer-events:none;padding:.35rem .5rem;border-radius:.5rem;background:#1f2937;color:#fff;font:12px/1.2 system-ui;opacity:0;transform:translate(-50%,-120%);transition:opacity .12s;">
                                </div>
                            </div>

                            <!-- Columna: leyenda (scrollable) -->
                            <aside class="hs-donut-legend" aria-label="Tipos de requerimiento">
                                <div id="donut-legend" class="legend" aria-live="polite"></div>
                            </aside>
                        </div>

                        <p id="m-desc" class="sr-only">
                            Requerimientos.
                        </p>
                    </section>


                </div>

                <!-- TABLA -->
                <section class="hs-table">
                    <div class="hs-head">
                        <h3 style="margin:0;">Trámites</h3>
                        <div class="hs-tools">
                            <div class="search" role="search">
                                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                                    <path fill="currentColor"
                                        d="M10 4a6 6 0 0 1 4.472 9.931l4.298 4.297l-1.414 1.415l-4.297-4.298A6 6 0 1 1 10 4m0 2a4 4 0 1 0 0 8a4 4 0 0 0 0-8" />
                                </svg>
                                <input id="hs-search" type="search" placeholder="Buscar por folio, ID (#123) o status…"
                                    aria-label="Buscar">
                            </div>
                            <div class="legend">
                                <span>Requerimientos: <strong id="hs-legend-total">0</strong></span>
                                <span style="margin:0 .4rem;">·</span>
                                <span>Status: <strong id="hs-legend-status">Todos los status</strong></span>
                            </div>
                        </div>
                    </div>

                    <div id="hs-table-wrap" class="table-wrap">
                        <table class="gc" aria-describedby="hs-search">
                            <thead>
                                <tr>
                                    <th>REQID</th>
                                    <th>Tipo de trámite</th>
                                    <th>Asignado</th>
                                    <th>Teléfono de contacto</th>
                                    <th>Estatus</th>
                                </tr>
                            </thead>
                            <tbody id="hs-table-body"></tbody>
                        </table>
                    </div>

                    <!-- Paginación -->
                    <nav id="hs-pager" class="hs-pager" aria-label="Paginación"></nav>
                </section>

            </section>
        </div>
    </main>


    <!-- Pie de pagina -->
    <footer id="site-footer">
        <div class="limite">
            <div class="footer-brand">
                <img class="brand-lockup" src="/ASSETS/main_logo_al_frente.png"
                    alt="Ixtlahuacán de los Membrillos - Ayuntamiento">
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

    <!-- MODALES -->
    <!-- Modal: Administrar perfil -->
<div id="modal-perfil" class="modal-overlay" aria-hidden="true">
  <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="perfil-title">
    <button class="modal-close" type="button" aria-label="Cerrar">×</button>
    <h2 id="perfil-title">Administrar perfil</h2>

    <form id="form-perfil" novalidate>
      <div class="form-row">
        <label for="perfil-nombre">Nombre completo</label>
        <input type="text" id="perfil-nombre" name="nombre" autocomplete="name">
      </div>

      <div class="form-row">
        <label for="perfil-email">Correo electrónico</label>
        <input type="email" id="perfil-email" name="correo" autocomplete="email">
      </div>

      <div class="form-row split">
        <div>
          <label for="perfil-password">
            Contraseña
            <span class="tooltip">ⓘ
              <span class="tooltiptext">Deja vacío si no deseas cambiarla.</span>
            </span>
          </label>
          <input type="password" id="perfil-password" name="password" autocomplete="new-password">
        </div>
        <div>
          <label for="perfil-password2">Confirmar contraseña</label>
          <input type="password" id="perfil-password2" name="password2" autocomplete="new-password">
        </div>
      </div>

      <div class="form-row split">
        <div>
          <label for="perfil-telefono">Teléfono</label>
          <input type="tel" id="perfil-telefono" name="telefono" autocomplete="tel">
        </div>
        <div>
          <label for="perfil-reporta">Reporta a</label>
          <input type="text" id="perfil-reporta" name="reporta_a_nombre" readonly aria-readonly="true" class="is-readonly">
        </div>
      </div>

      <button type="submit" class="btn-submit">Guardar cambios</button>
    </form>

    <p class="modal-note">
      Tus datos están seguros con nosotros. Al guardar aceptas nuestras políticas de privacidad y condiciones de uso.
    </p>
    <p class="modal-copy">© 2025 GodCode. Todos los derechos reservados.</p>
  </div>
</div>



    <!-- Guard para la página de home

    -->
    <script type="module">
    import {
        guardPage
    } from "/JS/auth/guard.js";
    guardPage({
        stealth: false,
        redirectTo: "/VIEWS/login.php"
    });
    </script>

    <script type="module" src="/JS/home.js"></script>
    <script src="/JS/JSglobal.js"></script>
</body>

</html>
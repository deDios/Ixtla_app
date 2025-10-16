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
                    <span id="hs-profile-badge" class="badge">—</span>
                </section>

                <nav id="hs-states" class="hs-states" aria-label="Estados">
                    <button class="item is-active" data-status="todos" role="radio" aria-checked="true">
                        <span class="label">Todos</span><span class="count" id="cnt-todos">(0)</span>
                    </button>
                    <button class="item" data-status="pendientes" role="radio" aria-checked="false">
                        <span class="label">Pendientes</span><span class="count" id="cnt-pendientes">(0)</span>
                    </button>
                    <button class="item" data-status="en_proceso" role="radio" aria-checked="false">
                        <span class="label">En proceso</span><span class="count" id="cnt-en_proceso">(0)</span>
                    </button>
                    <button class="item" data-status="terminados" role="radio" aria-checked="false">
                        <span class="label">Terminados</span><span class="count" id="cnt-terminados">(0)</span>
                    </button>
                    <button class="item" data-status="cancelados" role="radio" aria-checked="false">
                        <span class="label">Cancelados</span><span class="count" id="cnt-cancelados">(0)</span>
                    </button>
                    <button class="item" data-status="pausados" role="radio" aria-checked="false">
                        <span class="label">Pausados</span><span class="count" id="cnt-pausados">(0)</span>
                    </button>
                </nav>
            </aside>

            <!-- MAIN -->
            <section class="hs-main">

                <!-- CHARTS -->
                <div class="hs-charts" id="hs-charts">

                    <!-- Línea: este año -->
                    <section class="hs-card" aria-labelledby="y-title">
                        <h3 id="y-title" class="hs-card-title">Gráfico de este Año</h3>

                        <div class="hs-chart-wrap">
  <canvas id="chart-year"></canvas>
  <div class="chart-tip"></div> 
</div>

                        <p id="y-desc" class="sr-only">
                            Serie mensual de requerimientos creados durante el año actual.
                        </p>
                    </section>

                    <!-- Donut: este mes -->
                    <section class="hs-card" aria-labelledby="m-title">
                        <h3 id="m-title" class="hs-card-title">Gráfico de este mes</h3>

                        
<div class="hs-chart-wrap">
  <canvas id="chart-month"></canvas>
  <div class="chart-tip"></div> <!-- opcional -->
  <div id="donut-legend"></div>  <!-- opcional -->
</div>

                        <!-- Sin leyenda estática: la genera el JS del donut -->
                        <p id="m-desc" class="sr-only">
                            Distribución porcentual de requerimientos por tipo en el mes actual.
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

                    <!-- Paginación: el JS dibuja los botones clásicos y el “Ir a:” -->
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
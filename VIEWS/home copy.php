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
                <!-- El JSglobal reemplaza este avatar cuando hay sesión -->
                <div class="user-icon-mobile" onclick="window.location.href='/VIEWS/login.php'">
                    <img src="/ASSETS/user/img_user1.png" alt="Usuario" />
                </div>
            </div>
        </div>


        <!-- Top bar: logo a la izquierda, acciones (Hamburguesa) a la derecha -->
        <div class="top-bar" id="top-bar">
            <div id="logo-btn" class="logo" title="Ir al inicio" aria-label="Ir al inicio">
                <!-- logo del header -->
                <img class="logo-marca" src="/ASSETS/main_logo.png"
                    alt="Ixtlahuacán de los Membrillos - Ayuntamiento" />
            </div>


            <div class="actions">
                <button href="/VIEWS/contacto.php" class="btn btn-contacto" type="button"
                    onclick="window.location.href=this.getAttribute('href')">
                    Contacto
                </button>
                <button class="hamburger" aria-controls="mobile-menu" aria-expanded="false" aria-label="Abrir menú"
                    onclick="toggleMenu()">
                    <span></span><span></span><span></span>
                </button>
                <!-- El JSglobal inyecta aquí el avatar desktop si hay sesión -->
            </div>
        </div>


        <!-- Subnav -- links a la izquierda, redes + avatar a la derecha -->
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
                <!-- Perfil -->
                <section class="hs-profile" aria-label="Perfil">
                    <img id="hs-avatar" class="avatar" src="/ASSETS/user/img_user1.png" alt="Avatar">
                    <h3 id="hs-profile-name" class="name">—</h3>
                    <span id="hs-profile-badge" class="badge">—</span>
                </section>

                <!-- Estados -->
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
                <!-- === CHARTS: Año (linea) + Mes (donut) =============================== -->
                <div class="hs-charts" id="hs-charts">
                    <!-- Línea: este año -->
                    <section class="hs-card" aria-labelledby="y-title">
                        <h3 id="y-title" class="hs-card-title">Gráfico de este Año</h3>

                        <div class="hs-chart-wrap" style="position:relative;">
                            <canvas id="chart-year" width="600" height="240"
                                data-series-year='[3,8,14,20,17,24,22,27,29,30,31,35]'
                                data-labels-year='["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]'
                                aria-describedby="y-desc">
                            </canvas>

                            <!-- Skeleton (se oculta al renderizar el chart) -->
                            <div class="hs-chart-skeleton" aria-hidden="true"></div>

                            <!-- Tooltip para hover -->
                            <div class="chart-tip"
                                style="position:absolute;pointer-events:none;padding:.35rem .5rem;border-radius:.5rem;background:#1f2937;color:#fff;font:12px/1.2 system-ui;opacity:0;transform:translate(-50%,-120%);transition:opacity .12s;">
                            </div>
                        </div>


                        <p id="y-desc" class="sr-only">
                            Serie mensual de requerimientos creados durante el año actual.
                        </p>

                    </section>

                    <!-- Donut: este mes -->
                    <section class="hs-card" aria-labelledby="m-title">
                        <h3 id="m-title" class="hs-card-title">Gráfico de este mes</h3>

                        <div class="hs-chart-wrap">
                            <canvas id="chart-month" width="380" height="240" data-donut='[
                                 {"label":"Fuga de agua","value":50},
                                 {"label":"Fuga de drenaje","value":5},
                                 {"label":"Baja presión de agua","value":10},
                                 {"label":"No disponemos de agua","value":15},
                                 {"label":"Otros","value":20}
                                  ]' aria-describedby="m-desc">
                            </canvas>

                            <!-- Skeleton (el JS lo ocultará/retirará cuando pinte el chart) -->
                            <div class="hs-chart-skeleton" aria-hidden="true"></div>
                        </div>

                        <!-- datos estaticos -->
                        <ul id="donut-legend">
                            <li data-label="Fuga de agua"><span class="bullet"></span> <span class="t">Fuga de
                                    agua</span> <span class="pct"></span></li>
                            <li data-label="Fuga de drenaje"><span class="bullet"></span> <span class="t">Fuga de
                                    drenaje</span> <span class="pct"></span></li>
                            <li data-label="Baja presión de agua"><span class="bullet"></span> <span class="t">Baja
                                    presión de agua</span> <span class="pct"></span></li>
                            <li data-label="No disponemos de agua"><span class="bullet"></span> <span class="t">No
                                    disponemos de agua</span> <span class="pct"></span></li>
                            <li data-label="Otros"><span class="bullet"></span> <span class="t">Otros</span> <span
                                    class="pct"></span></li>
                        </ul>


                        <p id="m-desc" class="sr-only">
                            Distribución porcentual de requerimientos por tipo en el mes actual.
                        </p>
                    </section>
                </div>
                <!-- ===================================================================== -->


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
                                <input id="hs-search" type="search" placeholder="Buscar por nombre o status…"
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
                                    <th>Trámites</th>
                                    <th>Asignado</th>
                                    <th>Fecha de solicitado</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody id="hs-table-body"></tbody>
                        </table>
                    </div>

                    <!-- Contenedor de paginación 
                     
                    <nav id="hs-pager" class="hs-pager" aria-label="Paginación"><button class="btn "
                            data-p="1">«</button> <button class="btn " data-p="2" disabled="">›</button><button
                            class="btn " data-p="0" disabled="">‹</button> <button class="btn primary"
                            data-p="1">1</button> <button class="btn " data-p="1">»</button> <span class="muted"
                            style="margin-left:.75rem;">Ir a:</span>
                        <input type="number" min="1" max="1" value="1" data-goto="" style="width:4rem;margin:0 .25rem;">
                        <button class="btn" data-go="">Ir</button>
                    </nav>

                    -->
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












    <!-- ESPACIO PARA MODALES -->


    <!--
    <script type="module">
    import {
        guardPage
    } from "/JS/auth/guard.js?v=2";
    guardPage({
        stealth: false,
        redirectTo: "/VIEWS/Login.php"
    });
    </script>

    <script src="/JS/components.js"></script>

    -->

    <!-- guard para la pagina de home -->
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
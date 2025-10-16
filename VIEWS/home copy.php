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

    <main class="home-view">
        <!-- Layout principal -->
        <div class="home-layout">
            <!-- ================= Sidebar ================= -->
            <aside class="home-sidebar">
                <!-- Perfil -->
                <section class="section">
                    <div class="section-head">
                        <h2>Mi perfil</h2>
                    </div>
                    <div class="profile">
                        <img id="hs-avatar" alt="Avatar" class="avatar" width="72" height="72" />
                        <div class="info">
                            <div id="hs-profile-name" class="name">—</div>
                            <div id="hs-profile-badge" class="badge">—</div>
                        </div>
                    </div>
                </section>

                <!-- Estados / Filtro -->
                <section class="section">
                    <div class="section-head">
                        <h2>Estados</h2>
                    </div>
                    <nav id="hs-states" class="states" aria-label="Filtros por estado">
                        <!-- usa data-status con claves: todos | pendientes | en_proceso | terminados | cancelados | pausados -->
                        <button class="item is-active" data-status="todos">Todos <span id="cnt-todos" class="muted">(0)</span></button>
                        <button class="item" data-status="pendientes">Pendientes <span id="cnt-pendientes" class="muted">(0)</span></button>
                        <button class="item" data-status="en_proceso">En proceso <span id="cnt-en_proceso" class="muted">(0)</span></button>
                        <button class="item" data-status="terminados">Terminados <span id="cnt-terminados" class="muted">(0)</span></button>
                        <button class="item" data-status="cancelados">Cancelados <span id="cnt-cancelados" class="muted">(0)</span></button>
                        <button class="item" data-status="pausados">Pausados <span id="cnt-pausados" class="muted">(0)</span></button>
                    </nav>
                </section>
            </aside>

            <!-- ================= Contenido ================= -->
            <section class="home-content">
                <!-- Buscador + leyendas -->
                <section class="section">
                    <div class="section-head">
                        <h2>Trámites</h2>
                        <input id="hs-search" type="search" placeholder="Buscar por asunto, asignado, estatus, folio o ID…" aria-label="Buscar" />
                    </div>
                    <div class="legend">
                        <span>Total: <strong id="hs-legend-total">0</strong></span>
                        <span class="muted">•</span>
                        <span>Estatus: <strong id="hs-legend-status">Todos</strong></span>
                    </div>
                </section>

                <!-- Gráficas -->
                <section class="section">
                    <div class="cards">
                        <!-- Línea (por meses) -->
                        <article class="card">
                            <div class="body" style="width:100%">
                                <div class="chart-wrap" style="position:relative; width:100%; height:220px;">
                                    <canvas id="chart-year"></canvas>
                                    <!-- el JS crea .chart-tip si no existe -->
                                </div>
                            </div>
                        </article>

                        <!-- Donut (distribución global por estatus) -->
                        <article class="card">
                            <div class="body" style="width:100%">
                                <div class="chart-wrap" style="position:relative; width:100%; height:220px;">
                                    <canvas id="chart-month"></canvas>
                                    <!-- leyenda del donut -->
                                    <div id="donut-legend" class="legend-list" aria-live="polite"></div>
                                </div>
                            </div>
                        </article>
                    </div>
                </section>

                <!-- Tabla -->
                <section class="section">
                    <div class="table-wrap" id="hs-table-wrap">
                        <table class="table" aria-label="Listado de requerimientos">
                            <thead>
                                <tr>
                                    <th>REQID</th>
                                    <th>Tipo de trámite</th>
                                    <th>Asignado</th>
                                    <th>Teléfono de contacto</th>
                                    <th>Estatus</th>
                                </tr>
                            </thead>
                            <tbody id="hs-table-body">
                                <!-- filas renderizadas por JS -->
                            </tbody>
                        </table>
                    </div>
                    <div id="hs-pager" class="pager" aria-label="Paginación">
                        <!-- el JS pinta el pager clásico aquí -->
                    </div>
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
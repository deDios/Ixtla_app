<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ixtla App</title>
    <link rel="stylesheet" href="/CSS/plantilla.css">
    <link rel="stylesheet" href="/CSS/home.css">
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
                <div class="user-icon-mobile" onclick="window.location.href='VIEW/Login.php'">
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





    <main id="home" class="ix-home" aria-labelledby="home-title">
        <div class="ix-wrap">
            <h1 id="home-title" class="visually-hidden">Panel principal</h1>

            <div class="home-grid">
                <!-- Sidebar -->
                <aside class="home-sidebar" aria-label="Perfil y filtros">
                    <div class="profile-card">
                        <div class="avatar" aria-hidden="true"></div>
                        <div class="profile-body">
                            <a id="h-admin-perfil" href="#" class="profile-link">Administrar perfil ›</a>
                            <h2 id="h-user-nombre" class="profile-name">—</h2>
                            <span id="h-user-dep" class="profile-dep badge">—</span>
                        </div>
                    </div>

                    <nav class="status-nav" aria-label="Filtros por estado">
                        <button class="status-item active" data-status="todos">Todos <span id="cnt-todos" class="count">(0)</span></button>
<button class="status-item" data-status="solicitud">Solicitud <span id="cnt-solicitud" class="count">(0)</span></button>
<button class="status-item" data-status="revicion">Revición <span id="cnt-revicion" class="count">(0)</span></button>
<button class="status-item" data-status="asignacion">Asignación <span id="cnt-asignacion" class="count">(0)</span></button>
<button class="status-item" data-status="enProceso">En proceso <span id="cnt-enProceso" class="count">(0)</span></button>
<button class="status-item" data-status="pausado">Pausado <span id="cnt-pausado" class="count">(0)</span></button>
<button class="status-item" data-status="cancelado">Cancelado <span id="cnt-cancelado" class="count">(0)</span></button>
<button class="status-item" data-status="finalizado">Finalizado <span id="cnt-finalizado" class="count">(0)</span></button>

                    </nav>
                </aside>

                <!-- Panel principal -->
                <section class="home-main" aria-label="Contenido principal">
                    <!-- graficos -->
                    <div class="charts-row">
                        <section class="chart-card" aria-labelledby="chart-year-title">
                            <h3 id="chart-year-title">Gráfico de este Año</h3>
                            <div class="chart-wrap">
                                <canvas id="chart-year" width="600" height="260"></canvas>
                                <div class="chart-skeleton" aria-hidden="true"></div>
                            </div>
                        </section>

                        <section class="chart-card" aria-labelledby="chart-month-title">
                            <h3 id="chart-month-title">Gráfico de este mes</h3>
                            <div class="chart-wrap">
                                <canvas id="chart-month" width="420" height="260"></canvas>
                                <div class="chart-skeleton" aria-hidden="true"></div>
                            </div>
                        </section>
                    </div>

                    <!-- Tabla de trámites -->
                    <section class="table-card" aria-labelledby="tbl-title">
                        <div class="table-head">
                            <h3 id="tbl-title">Trámites</h3>
                            <div class="table-tools">
                                <div class="input-search">
                                    <input id="tbl-search" type="search" placeholder="Buscar por nombre o status…" />
                                </div>
                                <div class="legend">
                                    <span>Requerimientos: <strong id="tbl-total">0</strong></span>
                                    <span>·</span>
                                    <span>Status: <strong id="tbl-status-label">Todos los status</strong></span>
                                </div>
                            </div>
                        </div>

                        <div id="tbl-skeleton" class="skeleton-list" aria-hidden="true"></div>

                        <div class="table-wrap" id="tbl-wrap" hidden>
                            <table class="gc-table" aria-describedby="tbl-title">
                                <thead>
                                    <tr>
                                        <th>Trámites</th>
                                        <th>Asignado</th>
                                        <th>Fecha de solicitado</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody id="tbl-body"></tbody>
                            </table>
                            <div class="pagination" id="tbl-pag"></div>
                        </div>

                        <p id="tbl-empty" class="muted" hidden>No hay elementos para mostrar.</p>
                    </section>
                </section>
            </div>
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




    <script src="/JS/JSglobal.js"></script>
    <script src="/JS/home.js"></script>

</body>

</html>
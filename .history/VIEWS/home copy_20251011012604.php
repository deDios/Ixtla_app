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
                    <img class="avatar" src="/ASSETS/user/img_user1.png" alt="Avatar">
                    <!-- <a class="link" href="#perfil" aria-label="Administrar perfil">Administrar perfil ›</a> -->
                    <h3 class="name">Juan Pablo Garcia Casillas</h3>
                    <span class="badge">SAMAPA</span>
                </section>

                <!-- Estados -->
                <nav class="hs-states" aria-label="Estados">
                    <button class="item is-active">
                        <span class="label">Todos</span><span class="count">(50)</span>
                    </button>
                    <button class="item">
                        <span class="label">Pendientes</span><span class="count">(10)</span>
                    </button>
                    <button class="item">
                        <span class="label">En proceso</span><span class="count">(10)</span>
                    </button>
                    <button class="item">
                        <span class="label">Terminados</span><span class="count">(20)</span>
                    </button>
                    <button class="item">
                        <span class="label">Cancelados</span><span class="count">(5)</span>
                    </button>
                    <button class="item">
                        <span class="label">Pausados</span><span class="count">(5)</span>
                    </button>
                </nav>
            </aside>

            <!-- MAIN -->
            <section class="hs-main">
                <!-- FILA DE GRÁFICOS -->
                <div class="hs-charts">
                    <section class="hs-card" aria-labelledby="y-title">
                        <div class="hs-chart-wrap">
                            <canvas id="chart-year" width="600" height="240" aria-hidden="true"></canvas>
                            <div class="hs-chart-skeleton" aria-hidden="true"></div>
                        </div>
                    </section>

                    <section class="hs-card" aria-labelledby="m-title">
                        <div class="hs-chart-wrap">
                            <canvas id="chart-month" width="380" height="240" aria-hidden="true"></canvas>
                            <div class="hs-chart-skeleton" aria-hidden="true"></div>
                        </div>
                    </section>
                </div>

                <!-- TABLA -->
                <section class="hs-table">
                    <div class="hs-head">
                        <h3 style="margin:0;">Trámites</h3>
                        <div class="hs-tools">
                            <div class="search" role="search">
                                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                                    <path fill="currentColor" d="M10 4a6 6 0 0 1 4.472 9.931l4.298 4.297l-1.414 1.415l-4.297-4.298A6 6 0 1 1 10 4m0 2a4 4 0 1 0 0 8a4 4 0 0 0 0-8" />
                                </svg>
                                <input id="hs-search" type="search" placeholder="Buscar por nombre o status…" aria-label="Buscar">
                            </div>
                            <div class="legend">
                                <span>Requerimientos: <strong>50</strong></span>
                                <span style="margin:0 .4rem;">·</span>
                                <span>Status: <strong>Todos los status</strong></span>
                            </div>
                        </div>
                    </div>

                    <div class="table-wrap">
                        <table class="gc" aria-describedby="hs-search">
                            <thead>
                                <tr>
                                    <th>Trámites</th>
                                    <th>Asignado</th>
                                    <th>Fecha de solicitado</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                <!-- Filas de ejemplo (placeholder) -->
                                <tr>
                                    <td>Fuga de agua</td>
                                    <td>Juan Pablo Casillas</td>
                                    <td>02/09/2025</td>
                                    <td><span class="hs-status" data-k="en-proceso">Solicitud</span></td>
                                </tr>
                                <tr>
                                    <td>Fuga de agua</td>
                                    <td>Juan Pablo Casillas</td>
                                    <td>02/09/2025</td>
                                    <td><span class="hs-status" data-k="en-proceso">En proceso</span></td>
                                </tr>
                                <tr>
                                    <td>Fuga de agua</td>
                                    <td>Juan Pablo Casillas</td>
                                    <td>02/09/2025</td>
                                    <td><span class="hs-status" data-k="en-proceso">En pausa</span></td>
                                </tr>
                                <tr>
                                    <td>Fuga de drenaje</td>
                                    <td>Juan Pablo Casillas</td>
                                    <td>02/09/2025</td>
                                    <td><span class="hs-status" data-k="pendiente">Pendiente</span></td>
                                </tr>
                                <tr>
                                    <td>No disponemos de agua</td>
                                    <td>Juan Pablo Casillas</td>
                                    <td>02/09/2025</td>
                                    <td><span class="hs-status" data-k="pausado">Pausado</span></td>
                                </tr>
                                <tr>
                                    <td>Baja presión de agua</td>
                                    <td>Juan Pablo Casillas</td>
                                    <td>02/09/2025</td>
                                    <td><span class="hs-status" data-k="terminado">Terminado</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <nav class="hs-pager" aria-label="Paginación (demo – 12 páginas)">
                        <span class="pg-info">151–175 de 300</span>

                        <div class="pg-group">
                            <button class="pg-btn" aria-label="Primera página">«</button>
                            <button class="pg-btn" aria-label="Página anterior">‹</button>
                        </div>

                        <div class="pg-group">
                            <button class="pg-num" aria-label="Página 1">1</button>
                            <span class="pg-dots" aria-hidden="true">…</span>
                            <button class="pg-num" aria-label="Página 5">5</button>
                            <button class="pg-num" aria-label="Página 6">6</button>
                            <button class="pg-num" aria-label="Página 7" aria-current="page">7</button>
                            <button class="pg-num" aria-label="Página 8">8</button>
                            <button class="pg-num" aria-label="Página 9">9</button>
                            <span class="pg-dots" aria-hidden="true">…</span>
                            <button class="pg-num" aria-label="Página 12">12</button>
                        </div>

                        <div class="pg-group">
                            <button class="pg-btn" aria-label="Página siguiente">›</button>
                            <button class="pg-btn" aria-label="Última página">»</button>
                        </div>

                        <div class="pg-jump">
                            <span>Ir a:</span>
                            <input type="number" value="7" min="1" max="12">
                            <button class="pg-btn">Ir</button>
                        </div>
                    </nav>
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
    <script type="module" src="/JS/auth/session.js"></script>
    <script type="module" src="/JS/home.js"></script>
    <script src="/JS/JSglobal.js"></script>

</body>

</html>
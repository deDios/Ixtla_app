<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ixtla App</title>
    <link rel="stylesheet" href="/CSS/plantilla.css">
    <link rel="stylesheet" href="/CSS/home.css">
    <link rel="stylesheet" href="/CSS/components.css">
    <link rel="stylesheet" href="/CSS/tareas.css">
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
                    <div class="avatar-shell">
                        <div class="avatar-circle">
                            <img id="hs-avatar" class="avatar" src="/ASSETS/user/img_user1.png" alt="Avatar">
                        </div>

                        <!-- Botón editar avatar (igual que en GodCode) -->
                        <button type="button" class="icon-btn avatar-edit" aria-label="Cambiar foto"
                            title="Cambiar foto">
                            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                <path
                                    d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83z"
                                    fill="currentColor"></path>
                            </svg>
                        </button>
                    </div>

                    <h3 id="hs-profile-name" class="name">—</h3>

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

                <!-- KANBAN -->
                <div class="kb-wrap">
                    <div class="kb-board" id="kb-board">

                        <!-- Por Hacer = estatus 0 -->
                        <section class="kb-col" data-status="0" aria-labelledby="kb-h-0">
                            <header class="kb-header" id="kb-h-0">
                                <h3>Por Hacer</h3><span class="kb-count" id="kb-cnt-0">(0)</span>
                            </header>
                            <div class="kb-list" id="kb-col-0" aria-describedby="kb-h-0"></div>
                        </section>

                        <!-- En proceso = estatus 3 -->
                        <section class="kb-col" data-status="3" aria-labelledby="kb-h-3">
                            <header class="kb-header" id="kb-h-3">
                                <h3>En proceso</h3><span class="kb-count" id="kb-cnt-3">(0)</span>
                            </header>
                            <div class="kb-list" id="kb-col-3" aria-describedby="kb-h-3"></div>
                        </section>

                        <!-- Por revisar = estatus 1 -->
                        <section class="kb-col" data-status="1" aria-labelledby="kb-h-1">
                            <header class="kb-header" id="kb-h-1">
                                <h3>Por revisar</h3><span class="kb-count" id="kb-cnt-1">(0)</span>
                            </header>
                            <div class="kb-list" id="kb-col-1" aria-describedby="kb-h-1"></div>
                        </section>

                        <!-- Hecho = estatus 6 -->
                        <section class="kb-col" data-status="6" aria-labelledby="kb-h-6">
                            <header class="kb-header" id="kb-h-6">
                                <h3>Hecho</h3><span class="kb-count" id="kb-cnt-6">(0)</span>
                            </header>
                            <div class="kb-list" id="kb-col-6" aria-describedby="kb-h-6"></div>
                        </section>

                        <!-- Panel de detalles -->
                        <aside class="kb-details" id="kb-details">
                            <div class="kb-d-empty">Selecciona una tarjeta para ver sus detalles</div>

                            <div class="kb-d-body" hidden>
                                <h3>Detalles de la asignación</h3>

                                <p class="kb-d-field"><strong>Reporte:</strong><br><span id="kb-d-title">—</span></p>

                                <p class="kb-d-field"><strong>Descripción:</strong><br><span id="kb-d-desc">—</span></p>

                                <p class="kb-d-field"><strong>Asignado a:</strong><br><span id="kb-d-asignado">—</span>
                                </p>

                                <p class="kb-d-field"><strong>Reportado por:</strong><br><span
                                        id="kb-d-contacto">—</span></p>

                                <p class="kb-d-field"><strong>Fecha de solicitado:</strong><br><span
                                        id="kb-d-creado">—</span></p>

                                <p class="kb-d-field"><strong>Dirección:</strong><br><span id="kb-d-direccion">—</span>
                                </p>

                                <p class="kb-d-field"><strong>Teléfono del contacto:</strong><br><span
                                        id="kb-d-tel">—</span></p>

                                <div class="kb-d-field">
                                    <strong>Evidencias:</strong>
                                    <div id="kb-d-evidencias" class="kb-evid-grid"></div>
                                </div>
                            </div>
                        </aside>


                    </div>
                </div>




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





    <!-- Guard para la página de home
<script type="module">
    import {
        guardPage
    } from "/JS/auth/guard.js";
    guardPage({
        stealth: false,
        redirectTo: "/VIEWS/login.php"
    });
    </script>
    -->

    <script src="/JS/JSglobal.js"></script>
    <script type="module" src="/JS/ui/avatar-edit.js"></script>

    <!-- SortableJS -->
    <script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js" defer></script>
    <script type="module" src="/JS/tareas.js"></script>


    <!-- bundle para que cargue bien el sidebar -->
    <script type="module" src="/JS/auth/session.js"></script>
    <script type="module" src="/JS/ui/sidebar.js"></script>
    <script type="module" src="/JS/ui/avatar-edit.js"></script>

</body>

</html>
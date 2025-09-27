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
                        <button class="status-item active" data-status="todos">Todos <span id="cnt-todos"
                                class="count">(0)</span></button>

                        <button class="status-item" data-status="solicitud">Solicitud <span id="cnt-solicitud"
                                class="count">(0)</span></button>

                        <button class="status-item" data-status="revicion">Revición <span id="cnt-revicion"
                                class="count">(0)</span></button>

                        <button class="status-item" data-status="asignacion">Asignación <span id="cnt-asignacion"
                                class="count">(0)</span></button>

                        <button class="status-item" data-status="enProceso">En proceso <span id="cnt-enProceso"
                                class="count">(0)</span></button>

                        <button class="status-item" data-status="pausado">Pausado <span id="cnt-pausado"
                                class="count">(0)</span></button>

                        <button class="status-item" data-status="cancelado">Cancelado <span id="cnt-cancelado"
                                class="count">(0)</span></button>

                        <button class="status-item" data-status="finalizado">Finalizado <span id="cnt-finalizado"
                                class="count">(0)</span></button>

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
                                        <th>Requerimiento</th>
                                        <th>Contacto</th>
                                        <th>Teléfono</th>
                                        <th>Departamento</th>
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



    <!-- Drawer de requerimientos -->
    <div class="ix-drawer-overlay" data-drawer="overlay" hidden></div>

    <!-- Panel -->
    <!-- Overlay (opcional, puro estilo) -->
    <div class="ix-drawer-overlay" id="drawer-overlay" hidden></div>

    <!-- Drawer -->
    <aside id="drawer-req" class="ix-drawer" aria-hidden="true" role="dialog" aria-labelledby="d-title" hidden>
        <header class="ix-drawer__header">
            <div class="left">
                <h3 id="d-title">
                    <span id="d-folio">—</span>
                    <span class="badge-status" id="d-badge">—</span>
                </h3>
                <div class="mini-meta">
                    <div><strong>Depto:</strong> <span id="d-dep">—</span></div>
                    <div><strong>Contacto:</strong> <span id="d-contacto">—</span></div>
                    <div><strong>Teléfono:</strong> <span id="d-telefono">—</span></div>
                </div>
            </div>
            <div class="right">
                <label class="status-select">
                    <span>Estatus:</span>
                    <select id="d-status" aria-label="Cambiar estatus"></select>
                </label>
                <button type="button" class="ix-drawer__close" id="d-close" aria-label="Cerrar">✕</button>
            </div>
        </header>

        <div class="ix-drawer__content">
            <section class="drw-pane is-active" data-pane="detalle">
                <div class="field"><label>Asunto</label>
                    <p id="d-asunto">—</p>
                </div>
                <div class="field"><label>Descripción</label>
                    <p id="d-descripcion">—</p>
                </div>
            </section>

            <section class="drw-pane" data-pane="imagenes">
                <div class="img-tools">
                    <label>Ver evidencia de:
                        <select id="d-img-status-view"></select>
                    </label>
                    <div class="spacer"></div>
                    <label>Subir a:
                        <select id="d-img-status-up"></select>
                    </label>
                    <input type="file" id="d-img-files" multiple accept="image/*" />
                    <button type="button" class="btn" id="d-img-upload">Subir</button>
                </div>

                <div id="d-gallery" class="img-grid">
                    <!-- thumbs -->
                </div>
            </section>
        </div>

        <footer class="ix-drawer__footer">
            <div class="left"></div>
            <div class="right">
                <!-- Si luego agregas edición/guardar: botones aquí -->
            </div>
        </footer>
    </aside>






    <!-- Modal confirm delete -->
    <div class="ix-modal" data-modal="delete" hidden aria-modal="true" role="dialog" aria-labelledby="del-title">
        <div class="ix-modal__card">
            <h4 id="del-title">¿Eliminar (soft delete)?</h4>
            <p>Esto marcará el requerimiento como <strong>Cancelado (5)</strong>. Podrás revertirlo luego cambiando el
                estatus.</p>
            <div class="actions">
                <button class="btn" data-del="cancel">Cancelar</button>
                <button class="btn danger" data-del="confirm">Confirmar</button>
            </div>
        </div>
    </div>









    <script src="/JS/JSglobal.js"></script>
    <script src="/JS/components.js"></script>
    <script src="/JS/ui/table.js" type="module"></script>
    <script src="/JS/ui/drawer.js" type="module"></script>
    <script src="/JS/home.js" type="module"></script>

</body>

</html>
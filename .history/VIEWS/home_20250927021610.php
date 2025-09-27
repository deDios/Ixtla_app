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
    <aside class="ix-drawer" role="dialog" aria-modal="true" aria-labelledby="ix-drw-title" data-drawer="panel" hidden>
        <header class="ix-drawer__header">
            <div class="left">
                <h3 id="ix-drw-title">
                    <span class="ix-drw-folio">—</span>
                    <span class="badge-status" data-k="">—</span>
                </h3>
                <div class="mini-meta">
                    <div><strong>Trámite:</strong> <span data-field="tramite_nombre">—</span></div>
                    <div><strong>Depto:</strong> <span data-field="departamento_nombre">—</span></div>
                    <div><strong>Asignado a:</strong> <span data-field="asignado_nombre_completo">—</span></div>
                    <div><strong>Creado:</strong> <span data-field="created_at">—</span></div>
                </div>
            </div>
            <div class="right">
                <label class="status-select">
                    <span>Estatus:</span>
                    <select data-drawer="statusSelect" aria-label="Cambiar estatus"></select>
                </label>
                <button class="ix-drawer__close" data-drawer="close" aria-label="Cerrar">✕</button>
            </div>
        </header>

        <nav class="ix-drawer__tabs" aria-label="Secciones">
            <button class="tab is-active" data-tab="detalle">Detalle</button>
            <button class="tab" data-tab="editar">Editar</button>
            <button class="tab" data-tab="imagenes">Imágenes</button>
        </nav>

        <div class="ix-drawer__content">
            <!-- Pane: Detalle -->
            <section class="drw-pane is-active" data-pane="detalle">
                <div class="field"><label>Asunto</label>
                    <p data-field="asunto">—</p>
                </div>
                <div class="field"><label>Descripción</label>
                    <p data-field="descripcion">—</p>
                </div>

                <div class="grid-2">
                    <div class="field"><label>Prioridad</label>
                        <p data-field="prioridad">—</p>
                    </div>
                    <div class="field"><label>Canal</label>
                        <p data-field="canal">—</p>
                    </div>
                </div>

                <h4>Contacto</h4>
                <div class="grid-2">
                    <div class="field"><label>Nombre</label>
                        <p data-field="contacto_nombre">—</p>
                    </div>
                    <div class="field"><label>Teléfono</label>
                        <p data-field="contacto_telefono">—</p>
                    </div>
                </div>
                <div class="grid-2">
                    <div class="field"><label>Email</label>
                        <p data-field="contacto_email">—</p>
                    </div>
                    <div class="field"><label>Código Postal</label>
                        <p data-field="contacto_cp">—</p>
                    </div>
                </div>
                <div class="field"><label>Calle</label>
                    <p data-field="contacto_calle">—</p>
                </div>
                <div class="field"><label>Colonia</label>
                    <p data-field="contacto_colonia">—</p>
                </div>
            </section>

            <!-- Pane: Editar -->
            <section class="drw-pane" data-pane="editar">
                <form class="ix-drawer__form" novalidate>
                    <div class="field">
                        <label for="f-asunto">Asunto</label>
                        <input id="f-asunto" name="asunto" type="text" />
                    </div>
                    <div class="field">
                        <label for="f-descripcion">Descripción</label>
                        <textarea id="f-descripcion" name="descripcion" rows="4"></textarea>
                    </div>

                    <div class="grid-3">
                        <div class="field">
                            <label for="f-prioridad">Prioridad</label>
                            <select id="f-prioridad" name="prioridad">
                                <option value="1">Baja</option>
                                <option value="2">Media</option>
                                <option value="3">Alta</option>
                            </select>
                        </div>
                        <div class="field">
                            <label for="f-estatus">Estatus</label>
                            <select id="f-estatus" name="estatus"></select>
                        </div>
                        <div class="field">
                            <label for="f-asignado">Asignado a (ID)</label>
                            <input id="f-asignado" name="asignado_a" type="number" placeholder="ID empleado" />
                        </div>
                    </div>

                    <fieldset class="fieldset">
                        <legend>Contacto</legend>
                        <div class="grid-2">
                            <div class="field"><label for="f-contacto_nombre">Nombre</label><input
                                    id="f-contacto_nombre" name="contacto_nombre" type="text" /></div>
                            <div class="field"><label for="f-contacto_telefono">Teléfono</label><input
                                    id="f-contacto_telefono" name="contacto_telefono" type="tel" /></div>
                        </div>
                        <div class="grid-2">
                            <div class="field"><label for="f-contacto_email">Email</label><input id="f-contacto_email"
                                    name="contacto_email" type="email" /></div>
                            <div class="field"><label for="f-contacto_cp">CP</label><input id="f-contacto_cp"
                                    name="contacto_cp" type="text" /></div>
                        </div>
                        <div class="field"><label for="f-contacto_calle">Calle</label><input id="f-contacto_calle"
                                name="contacto_calle" type="text" /></div>
                        <div class="field"><label for="f-contacto_colonia">Colonia</label><input id="f-contacto_colonia"
                                name="contacto_colonia" type="text" /></div>
                    </fieldset>

                    <input type="hidden" name="id" />
                    <input type="hidden" name="updated_by" />
                </form>
            </section>

            <!-- Pane: Imágenes -->
            <section class="drw-pane" data-pane="imagenes">
                <div class="img-tools">
                    <label>Ver evidencia de:
                        <select data-img="viewStatus"></select>
                    </label>
                    <div class="spacer"></div>
                    <div class="uploader">
                        <label>Estado destino:
                            <select data-img="uploadStatus"></select>
                        </label>
                        <input type="file" data-img="files" multiple accept="image/*" />
                        <button class="btn" data-img="uploadBtn" type="button">Subir</button>
                    </div>
                </div>

                <div class="img-grid" data-img="grid">
                    <!-- Thumbs aquí -->
                </div>

                <p class="muted" data-img="empty" hidden>No hay evidencia en este estatus.</p>
            </section>
        </div>

        <footer class="ix-drawer__footer">
            <div class="left"></div>
            <div class="right">
                <button class="btn" data-action="editar" type="button">Editar</button>
                <button class="btn primary" data-action="guardar" type="button" disabled>Guardar</button>
                <button class="btn danger" data-action="eliminar" type="button">Eliminar</button>
            </div>
        </footer>
    </aside>

    <!-- Modal confirm delete (2 pasos) -->
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
    <script type="module" src="/JS/home.js"></script>

</body>

</html>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ixtla App</title>
    <link rel="stylesheet" href="/CSS/plantilla.css">
    <link rel="stylesheet" href="/CSS/home.css">
    <link rel="stylesheet" href="/CSS/stepper.css">
    <link rel="stylesheet" href="/CSS/requerimiento.css">
    <link rel="stylesheet" href="/CSS/components.css">
    <link rel="stylesheet" href="/CSS/requerimientoCoemntariosSection.css">
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
                <!-- El JSglobal reemplaza este avatar cuando hay sesion -->
                <div class="user-icon-mobile" onclick="window.location.href='/VIEWS/login.php'">
                    <img src="/ASSETS/user/img_user1.png" alt="Usuario" />
                </div>
            </div>
        </div>

        <!-- Top bar: logo a la izquierda, acciones (Hamburguesa) a la derecha -->
        <div class="top-bar" id="top-bar">
            <div id="logo-btn" class="logo" title="Ir al inicio" aria-label="Ir al inicio">
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
                <!-- El JSglobal inyecta aquí el avatar desktop si hay sesion -->
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
                <section class="hs-profile" aria-label="Perfil">
                    <div class="avatar-shell">
                        <div class="avatar-circle">
                            <img id="hs-avatar" class="avatar" src="/ASSETS/user/img_user1.png" alt="Avatar">
                        </div>

                        <!-- Botón editar avatar -->
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

                <section class="demo-comments">
                    <div class="demo-card">
                        <div class="head">
                            <h4>Comentarios</h4>
                        </div>

                        <div class="composer" aria-label="Escribir comentario">
                            <div class="composer-wrap">
                                <textarea placeholder="Escribe un comentario…"></textarea>
                                <button class="send-fab" type="button" aria-label="Enviar comentario">
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                    </svg>
                                </button>
                            </div>
                            <div class="hint">Presiona <strong> Enter </strong> para enviar <br> o <br> da clic en el
                                botón</div>
                        </div>

                        <div class="c-feed" aria-live="polite">
                            <article class="msg">
                                <img class="avatar" src="/ASSETS/user/img_user1.png" alt="">
                                <div>
                                    <div class="who"><span class="name">Juan Pablo</span> <span class="time">hace 2
                                            min</span></div>
                                    <div class="text">¿Pueden validar si la cuadrilla ya salió a la zona?</div>
                                </div>
                            </article>
                            <article class="msg">
                                <img class="avatar" src="/ASSETS/user/img_user1.png" alt="">
                                <div>
                                    <div class="who"><span class="name">María López</span> <span class="time">hace 1
                                            min</span></div>
                                    <div class="text">Confirmado. Llegan en 10 minutos. Dejo fotos cuando estén en
                                        sitio.</div>
                                </div>
                            </article>
                            <article class="msg">
                                <img class="avatar" src="/ASSETS/user/img_user1.png" alt="">
                                <div>
                                    <div class="who"><span class="name">Sergio</span> <span class="time">ahora</span>
                                    </div>
                                    <div class="text">Recibido ✅</div>
                                </div>
                            </article>

                            <!-- mensajes de ejemplo repetidos -->
                            <article class="msg">
                                <img class="avatar" src="/ASSETS/user/img_user1.png" alt="">
                                <div>
                                    <div class="who"><span class="name">Juan Pablo</span> <span class="time">hace 2
                                            min</span></div>
                                    <div class="text">¿Pueden validar si la cuadrilla ya salió a la zona?</div>
                                </div>
                            </article>
                            <article class="msg">
                                <img class="avatar" src="/ASSETS/user/img_user1.png" alt="">
                                <div>
                                    <div class="who"><span class="name">María López</span> <span class="time">hace 1
                                            min</span></div>
                                    <div class="text">Confirmado. Llegan en 10 minutos. Dejo fotos cuando estén en
                                        sitio.</div>
                                </div>
                            </article>
                            <article class="msg">
                                <img class="avatar" src="/ASSETS/user/img_user1.png" alt="">
                                <div>
                                    <div class="who"><span class="name">Sergio</span> <span class="time">ahora</span>
                                    </div>
                                    <div class="text">Recibido ✅</div>
                                </div>
                            </article>
                            <!-- /mensajes de ejemplo -->
                        </div>
                    </div>
                </section>
            </aside>

            <!-- MAIN -->
            <section class="hs-main exp-view">
                <!-- Encabezado -->
                <header class="exp-head">

                    <div class="exp-title">
                        <h1>Fuga de agua</h1>
                        <div id="req-actions" class="exp-actions"></div>
                    </div>

                    <dl class="exp-meta">
                        <div>
                            <dt>Contacto</dt>
                            <dd>Luis Enrique Mendez</dd>
                        </div>
                        <div>
                            <dt>Encargado</dt>
                            <dd>Juan Pablo</dd>
                        </div>
                        <div>
                            <dt>Fecha de solicitado</dt>
                            <dd>04/06/2025 12:30pm</dd>
                        </div>
                    </dl>
                </header>

                <!-- Stepper -->
                <div class="container">
                    <ul class="step-menu">
                        <li role="button" class="complete" data-status="0">Solicitud</li>
                        <li role="button" class="complete" data-status="1">Revisión</li>
                        <li role="button" class="complete" data-status="2">Asignación</li>
                        <li role="button" class="current" data-status="3">Proceso</li>
                        <li role="button" data-status="4">Pausado</li>
                        <li role="button" data-status="5">Cancelado</li>
                        <li role="button" data-status="6">Finalizado</li>
                    </ul>
                </div>

                <!-- Tabs -->
                <nav class="exp-tabs" role="tablist" aria-label="Secciones">
                    <button class="exp-tab is-active" role="tab" aria-selected="true">Contacto</button>
                    <button class="exp-tab" role="tab" aria-selected="false">Detalles</button>
                    <button class="exp-tab" role="tab" aria-selected="false">Planeación</button>
                </nav>

                <!-- WRAPPER: evita salto entre tabs -->
                <div class="exp-panes">
                    <!-- Panel: Contacto -->
                    <section class="exp-pane is-active" role="tabpanel" data-tab="Contacto">
                        <div class="exp-grid">
                            <div class="exp-field"><label>Nombre:</label>
                                <div class="exp-val">Luis Enrique Mendez</div>
                            </div>
                            <div class="exp-field"><label>Teléfono:</label>
                                <div class="exp-val">33 3333 3333</div>
                            </div>
                            <div class="exp-field"><label>Dirección del reporte:</label>
                                <div class="exp-val">Vicente Guerrero #13, Centro</div>
                            </div>
                            <div class="exp-field"><label>Correo:</label>
                                <div class="exp-val"><a href="mailto:correo@ejemplo.com">correo@ejemplo.com</a></div>
                            </div>
                            <div class="exp-field"><label>C.P:</label>
                                <div class="exp-val">45850</div>
                            </div>
                        </div>
                    </section>

                    <!-- Panel: Detalles -->
                    <section class="exp-pane" role="tabpanel" data-tab="detalles">
                        <div class="exp-grid">
                            <div class="exp-field"><label>Nombre del Requerimiento:</label>
                                <div class="exp-val">Fuga de agua</div>
                            </div>
                            <div class="exp-field"><label>Líder del Departamento:</label>
                                <div class="exp-val"><a>Juan Pablo</a></div>
                            </div>
                            <div class="exp-field"><label>Asignado:</label>
                                <div class="exp-val"><a>Luis Enrique Mendez</a></div>
                            </div>

                            <div class="exp-field">
                                <label>Estatus:</label>
                                <div class="exp-val" id="req-status">
                                    <!-- Badge que actualizamos por JS -->
                                    <span data-role="status-badge" class="exp-badge is-info">—</span>

                                    <!-- boton + combo para cambiar el status, de momento no actualiza realmente-->
                                    <div class="status-tools"
                                        style="display:inline-flex; gap:8px; align-items:center; margin-left:8px;">
                                        <button type="button" class="btn-xs" data-role="status-btn">Cambiar</button>
                                        <select class="status-select" data-role="status-select" hidden>
                                            <option value="0">Solicitud</option>
                                            <option value="1">Revisión</option>
                                            <option value="2">Asignación</option>
                                            <option value="3">Proceso</option>
                                            <option value="4">Pausado</option>
                                            <option value="5">Cancelado</option>
                                            <option value="6">Finalizado</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div class="exp-field exp-field--full">
                                <label>Descripción:</label>
                                <div class="exp-val exp-preline">
                                    Vimos una fuga de agua en una casa amarilla de dos pisos, lleva más de 3 horas
                                    tirando
                                    agua y no parece que se encuentren los propietarios. Nos preocupa porque es agua
                                    limpia.
                                </div>
                            </div>
                            <div class="exp-field"><label>Fecha de inicio:</label>
                                <div class="exp-val">02/09/2025</div>
                            </div>
                            <div class="exp-field"><label>Fecha de terminado:</label>
                                <div class="exp-val">—</div>
                            </div>
                        </div>
                    </section>

                    <!-- Panel: Planeacion -->
                    <section class="exp-pane" role="tabpanel" data-tab="planeacion">

                        <!-- ===== HEADER TOOLBAR ===== -->
                        <div class="planeacion-toolbar">
                            <h3 class="planeacion-title">Planeación</h3>
                            <button id="btn-add-proceso" class="fase-add" type="button">Nuevo proceso +</button>
                            <button id="btn-add-tarea" class="fase-add" type="button">Nueva tarea +</button>
                        </div>

                        <!-- ===== CONTENEDOR DE PROCESOS ===== -->
                        <div id="planeacion-list">
                            <!-- Acordeón de proceso -->
                            <section class="exp-accordion exp-accordion--fase" data-proceso-id="p1">
                                <!-- HEADER del acordeón -->
                                <button class="exp-acc-head" type="button" aria-expanded="true">
                                    <div class="fase-left">
                                        <div class="fase-head">
                                            <span class="fase-title">Proceso</span>
                                            <small class="fase-meta">10 actividades</small>
                                        </div>
                                    </div>

                                    <div class="fase-right">
                                        <span class="fase-label">Estatus</span>
                                        <span class="exp-progress" aria-label="70%">
                                            <span class="bar" style="width:70%"></span>
                                            <span class="pct">70%</span>
                                        </span>
                                        <span class="fase-label">Fecha de inicio</span>
                                        <span class="fase-date">02/06/2025</span>
                                        <span class="chev" aria-hidden="true"></span>
                                    </div>
                                </button>

                                <!-- CUERPO del acordeón -->
                                <div class="exp-acc-body">
                                    <div class="exp-table exp-table--planeacion is-card">
                                        <div class="exp-thead">
                                            <div>Actividad</div>
                                            <div>Responsable</div>
                                            <div>Estatus</div>
                                            <div>Porcentaje</div>
                                            <div>Fecha de inicio</div>
                                        </div>

                                        <div class="exp-row">
                                            <div class="actividad">Reparación de Llave</div>
                                            <div class="responsable">Juan Pablo</div>
                                            <div class="estatus"><span class="exp-badge is-info">Activo</span></div>
                                            <div class="porcentaje"><span class="exp-progress xs"><span class="bar"
                                                        style="width:70%"></span></span></div>
                                            <div class="fecha">02/06/2025</div>
                                        </div>

                                        <div class="exp-row">
                                            <div class="actividad">Revisión de toma</div>
                                            <div class="responsable">Juan Pablo</div>
                                            <div class="estatus"><span class="exp-badge is-success">Finalizado</span>
                                            </div>
                                            <div class="porcentaje"><span class="exp-progress xs"><span class="bar"
                                                        style="width:100%"></span></span></div>
                                            <div class="fecha">10/06/2025</div>
                                        </div>

                                        <div class="exp-row">
                                            <div class="actividad">Cierre de Toma</div>
                                            <div class="responsable">Juan Pablo</div>
                                            <div class="estatus"><span class="exp-badge is-success">Finalizado</span>
                                            </div>
                                            <div class="porcentaje"><span class="exp-progress xs"><span class="bar"
                                                        style="width:100%"></span></span></div>
                                            <div class="fecha">10/05/2025</div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>

                    </section>
                </div>
                <!-- /exp-panes -->

                <!-- Toolbar arriba -->
                <div class="planeacion-toolbar evid-toolbar">
                    <h3 class="planeacion-title">Evidencias</h3>
                    <button id="btn-open-evid-modal" class="fase-add" type="button">Subir imágenes +</button>
                </div>

                <!-- Evidencias -->
                <section class="exp-accordion exp-accordion--evidencias" data-acc="evidencias">
                    <button class="exp-acc-head" type="button" aria-expanded="true">
                        <span>Evidencias</span>
                        <span class="chev" aria-hidden="true"></span>
                    </button>

                    <div class="exp-acc-body">
                        <div class="exp-table">
                            <div class="exp-thead">
                                <div>Nombre <span class="sort"></span></div>
                                <div>Quien lo cargo</div>
                                <div>Última modificación <span class="sort"></span></div>
                            </div>
                            <!-- filas -->
                        </div>
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

    <!-- ESPACIO PARA MODALES -->
    <div id="modal-perfil" class="modal-overlay" aria-hidden="true">
        <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="perfil-title">
            <button class="modal-close" type="button" aria-label="Cerrar">×</button>
            <h2 id="perfil-title">Administrar perfil</h2>

            <form id="form-perfil" novalidate>
                <div class="form-row split">
                    <div>
                        <label for="perfil-nombre">Nombre</label>
                        <input type="text" id="perfil-nombre" name="nombre" autocomplete="given-name">
                    </div>
                    <div>
                        <label for="perfil-apellidos">Apellidos</label>
                        <input type="text" id="perfil-apellidos" name="apellidos" autocomplete="family-name">
                    </div>
                </div>

                <div class="form-row split">
                    <div>
                        <label for="perfil-email">Correo electrónico</label>
                        <input type="email" id="perfil-email" name="correo" autocomplete="email">
                    </div>
                    <div>
                        <label for="perfil-telefono">Teléfono</label>
                        <input type="tel" id="perfil-telefono" name="telefono" autocomplete="tel">
                    </div>
                </div>

                <div class="form-row split">
                    <div>
                        <label for="perfil-password">
                            Contraseña
                            <span class="tooltip">ⓘ
                                <span class="tooltiptext">Deja vacío si no deseas cambiarla.</span>
                            </span>
                        </label>
                        <input type="password" id="perfil-password" name="password" autocomplete="new-password"
                            placeholder="Opcional">
                    </div>
                    <div>
                        <label for="perfil-password2">Confirmar contraseña</label>
                        <input type="password" id="perfil-password2" name="password2" autocomplete="new-password"
                            placeholder="Opcional">
                    </div>
                </div>

                <h3 class="form-section-title">INFORMACIÓN DEL EMPLEADO</h3>

                <div class="form-row split">
                    <div>
                        <label for="perfil-departamento">Departamento</label>
                        <input type="text" id="perfil-departamento" name="departamento" class="is-readonly" readonly
                            aria-readonly="true">
                    </div>
                    <div>
                        <label for="perfil-reporta">Reporta a</label>
                        <input type="text" id="perfil-reporta" name="reporta_a_nombre" class="is-readonly" readonly
                            aria-readonly="true">
                    </div>
                </div>

                <div class="form-row">
                    <label for="perfil-status">Status</label>
                    <input type="text" id="perfil-status" name="status" class="is-readonly" readonly
                        aria-readonly="true">
                </div>

                <button type="submit" class="btn-submit">Guardar cambios</button>
            </form>

            <p class="modal-note">
                Tus datos están seguros con nosotros. Al guardar aceptas nuestras políticas de privacidad y condiciones
                de uso.
            </p>
            <p class="modal-copy">© 2025 GodCode. Todos los derechos reservados.</p>
        </div>
    </div>

    <!-- Modal editor de Avatar -->
    <div class="eda-overlay" id="eda-overlay" aria-hidden="true">
        <div class="eda-modal" role="dialog" aria-modal="true" aria-labelledby="eda-title">
            <div class="eda-header">
                <div class="eda-title" id="eda-title">Editar avatar</div>
                <div class="eda-actions">
                    <button class="btn" id="eda-close" type="button">Cerrar</button>
                </div>
            </div>

            <div class="eda-body">
                <div class="eda-left">
                    <div class="eda-drop" id="eda-drop" aria-label="Zona para arrastrar y soltar imágenes">
                        <div class="eda-drop-cta">
                            <strong>Arrastra una imagen</strong> o
                            <button class="btn btn-outline" id="eda-choose" type="button">Elegir archivo</button>
                            <div class="eda-hint">También puedes pegar con <kbd>Ctrl</kbd>+<kbd>V</kbd></div>
                        </div>
                    </div>

                    <div class="eda-preview">
                        <div class="eda-preview-wrap">
                            <img id="eda-preview-img" alt="Vista previa" />
                            <div class="eda-mask" aria-hidden="true"></div>
                        </div>
                    </div>
                </div>

                <div class="eda-right">
                    <div class="eda-recents">
                        <div class="eda-recents-title">Recientes</div>
                        <div class="eda-recents-grid" id="eda-recents-grid">
                            <div class="eda-empty">Sin recientes</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="eda-footer">
                <div class="eda-hint">JPG, PNG, WebP, HEIC/HEIF · Máx 1MB</div>
                <div class="eda-actions">
                    <button class="btn" id="eda-cancel" type="button">Cancelar</button>
                    <button class="btn blue" id="eda-save" type="button" disabled>Guardar</button>
                </div>
            </div>

            <input type="file" id="eda-file" accept="image/png, image/jpeg, image/webp, image/heic, image/heif"
                hidden />
        </div>
    </div>

    <!-- Modal generico para Pausar / Cancelar -->
    <div id="modal-estado" class="modal-overlay" aria-hidden="true">
        <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="estado-title">
            <button class="modal-close" type="button" aria-label="Cerrar">×</button>
            <h2 id="estado-title">Motivo</h2>
            <form id="form-estado">
                <div class="form-row">
                    <label for="estado-motivo">Describe el motivo</label>
                    <textarea id="estado-motivo" name="motivo" rows="5" required
                        placeholder="Escribe brevemente el motivo…"></textarea>
                </div>
                <div class="form-row">
                    <button type="submit" class="btn-submit">Confirmar</button>
                </div>
            </form>
            <p class="modal-note">Este cambio afectará el estado del requerimiento.</p>
        </div>
    </div>

    <!-- Modal: Nueva tarea -->
    <div id="modal-tarea" class="modal-overlay" aria-hidden="true">
        <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="tarea-title">
            <button class="modal-close" type="button" aria-label="Cerrar">×</button>
            <h2 id="tarea-title">Nueva tarea</h2>

            <form id="form-tarea" novalidate>
                <div class="form-row">
                    <label for="tarea-proceso">Proceso</label>
                    <!-- Se llena por JS con los procesos detectados; value = data-proceso-id -->
                    <select id="tarea-proceso" name="proceso" required>
                        <option value="" disabled selected>Selecciona un proceso…</option>
                    </select>
                </div>

                <div class="form-row">
                    <label for="tarea-titulo">Título</label>
                    <input type="text" id="tarea-titulo" name="titulo" maxlength="150" required
                        placeholder="Ej. Reparar válvula principal">
                </div>

                <div class="form-row">
                    <div>
                        <label for="tarea-asignado">Responsable</label>
                        <select id="tarea-asignado" name="tarea-asignado" required>
                            <option value="" disabled selected>Selecciona responsable…</option>
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <label for="tarea-asignado">Asignado a (opcional)</label>
                    <input type="text" id="tarea-asignado" name="asignado_nombre" placeholder="Nombre responsable">
                </div>

                <div class="form-row">
                    <label for="tarea-desc">Descripción (opcional)</label>
                    <textarea id="tarea-desc" name="descripcion" rows="4"
                        placeholder="Detalles de la tarea…"></textarea>
                </div>

                <div class="form-row">
                    <button type="submit" class="btn-submit">Crear tarea</button>
                </div>
            </form>

            <p class="modal-note">La tarea se agregará al proceso seleccionado.</p>
        </div>
    </div>



    <!-- Modal: Visor de Evidencias -->
    <div id="modal-media" class="modal-overlay" aria-hidden="true">
        <div class="modal-content">
            <button class="modal-close" aria-label="Cerrar">&times;</button>
            <div class="media-head" style="margin-bottom:10px;">
                <h3 id="media-title" style="margin:0; font-size:1.05rem; font-weight:700;"></h3>
                <div id="media-meta" style="color:#6b7280; font-size:.85rem; margin-top:4px;"></div>
            </div>
            <div class="media-body">
                <img id="media-img" alt=""
                    style="max-width:100%; height:auto; display:block; margin:0 auto; border-radius:8px;">
            </div>
        </div>
    </div>

    <!-- Modal: Nuevo proceso -->
    <div id="modal-proceso" class="modal-overlay" aria-hidden="true">
        <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="proceso-title">
            <button class="modal-close" type="button" aria-label="Cerrar">×</button>
            <h2 id="proceso-title">Nuevo proceso</h2>

            <form id="form-proceso" novalidate>
                <div class="form-row">
                    <label for="proceso-titulo">Título / Descripción</label>
                    <input type="text" id="proceso-titulo" name="titulo" maxlength="150" required
                        placeholder="Ej. Se asignó a Jurídico">
                </div>

                <div class="form-row">
                    <label for="proceso-inicio">Fecha de inicio</label>
                    <input type="date" id="proceso-inicio" name="fecha_inicio">
                </div>

                <div class="form-row">
                    <button type="submit" class="btn-submit">Crear proceso</button>
                </div>
            </form>

            <p class="modal-note">recuerda que todavia no se hacen los cambios con los endpoints.</p>
        </div>
    </div>


    <!-- Modal: Subir evidencias -->
    <div id="ix-evid-modal" class="modal-overlay" aria-hidden="true">
        <div class="modal-content ix-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="ix-evid-title">
            <button class="modal-close" type="button" aria-label="Cerrar">×</button>
            <div class="ix-modal__header">
                <h2 id="ix-evid-title">Subir evidencias</h2>
            </div>

            <div class="ix-modal__body">
                <form id="ix-evid-form" class="ix-form" novalidate>
                    <div class="ix-form__row">
                        <div class="ix-field ix-field--full">
                            <label class="ix-field__label" for="ix-evidencia">Evidencia</label>

                            <div class="ix-upload" id="ix-upload-zone" data-js="upload">
                                <button type="button" id="ix-evidencia-cta" class="ix-upload-btn" title="Subir imágenes"
                                    aria-label="Subir imágenes">
                                    Subir imágenes
                                </button>

                                <input id="ix-evidencia" type="file"
                                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
                                    multiple hidden>

                                <div class="ix-upload__hint">
                                    Arrastra imágenes o haz click para seleccionar (JPG/PNG/WebP/HEIC · máx 1 MB c/u ·
                                    hasta 3)
                                </div>

                                <div class="ix-gallery" id="ix-evidencia-previews" aria-live="polite"></div>
                            </div>

                            <small class="ix-help" id="ix-err-evidencia" hidden></small>
                        </div>
                    </div>
                </form>
            </div>

            <div class="ix-modal__footer">
                <button type="button" class="btn" id="ix-evid-cancel">Cancelar</button>
                <button type="button" class="btn blue" id="ix-evid-save" disabled>Subir</button>
            </div>
        </div>
    </div>




    <script src="/JS/JSglobal.js"></script>
    <script src="/JS/components.js"></script>
    <script src="/JS/requerimientoView.js"></script>
    <script src="/JS/ui/requerimientoPlaneacion.js"></script>

    <script type="module" src="/JS/api/media.js"></script>
    <script type="module" src="/JS/api/mediaRequerimientos.js"></script>


    <!-- bundle para que cargue bien el sidebar -->
    <script type="module" src="/JS/auth/session.js"></script>
    <script type="module" src="/JS/ui/sidebar.js"></script>
    <script type="module" src="/JS/ui/avatar-edit.js"></script>

    <!-- Animaciones y utilidades de esta vista -->
    <script type="module" src="/JS/ui/animacionesDeViewDetalle.js"></script>


</body>

</html>
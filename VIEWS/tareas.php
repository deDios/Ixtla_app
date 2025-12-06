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
    <link rel="stylesheet" href="/CSS/requerimiento.css">
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

                <!-- Filtros en sidebar (Departamentos / Empleados) -->
                <section id="kb-sidebar-filters" class="kb-sidebar-filters" aria-label="Filtros de tablero">
                    <div class="kb-filters-head">
                        <h4>Filtros</h4>
                        <button type="button" class="kb-filter-clear" id="kb-sidebar-clear">
                            Limpiar filtros
                        </button>
                    </div>

                    <!-- Filtro múltiple: Departamentos -->
                    <div class="kb-filter-field kb-filter-field--multi" id="kb-filter-departamentos"
                        data-filter="departamentos">
                        <span class="kb-filter-label">Departamentos</span>

                        <!-- Trigger del combo múltiple -->
                        <button type="button" class="kb-multi-trigger" aria-haspopup="listbox" aria-expanded="false">
                            <span class="kb-multi-placeholder">Seleccionar departamentos…</span>
                            <span class="kb-multi-summary" hidden>—</span>
                            <span class="kb-multi-caret">▾</span>
                        </button>

                        <!-- Menú desplegable -->
                        <div class="kb-multi-menu">
                            <div class="kb-multi-search">
                                <input type="text" class="kb-multi-search-input" placeholder="Buscar departamento…">
                            </div>
                            <ul class="kb-multi-options" role="listbox">
                                <!-- Opciones se llenan desde JS -->
                                <li>
                                    <span class="muted" style="font-size: 0.8rem; color:#9aa7a5;">
                                        — Sin datos: se llenará desde JS —
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <!-- Filtro múltiple: Empleados -->
                    <div class="kb-filter-field kb-filter-field--multi" id="kb-filter-empleados"
                        data-filter="empleados">
                        <span class="kb-filter-label">Empleados</span>

                        <!-- Trigger del combo múltiple -->
                        <button type="button" class="kb-multi-trigger" aria-haspopup="listbox" aria-expanded="false">
                            <span class="kb-multi-placeholder">Seleccionar empleados…</span>
                            <span class="kb-multi-summary" hidden>—</span>
                            <span class="kb-multi-caret">▾</span>
                        </button>

                        <!-- Menú desplegable -->
                        <div class="kb-multi-menu">
                            <div class="kb-multi-search">
                                <input type="text" class="kb-multi-search-input" placeholder="Buscar empleado…">
                            </div>
                            <ul class="kb-multi-options" role="listbox">
                                <!-- Opciones se llenan desde JS -->
                                <li>
                                    <span class="muted" style="font-size: 0.8rem; color:#9aa7a5;">
                                        — Sin datos: se llenará desde JS —
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>
            </aside>

            <!-- MAIN -->
            <section class="hs-main">

                <!-- Header de filtros rápidos -->
                <section class="kb-toolbar" aria-label="Filtros de tareas">
                    <div class="kb-toolbar-main">
                        <div class="kb-toolbar-title">
                            <h2>Tareas</h2>
                            <span class="kb-toolbar-sub">Filtros rápidos</span>
                        </div>

                        <div class="kb-toolbar-chips">
                            <button type="button" class="kb-chip is-active" data-filter="mine">
                                Solo mis tareas
                            </button>
                            <button type="button" class="kb-chip" data-filter="recent">
                                Recientes
                            </button>
                        </div>
                    </div>

                    <div class="kb-toolbar-filters">
                        <div class="kb-filter-field">
                            <label for="kb-filter-search">Buscar</label>
                            <input type="search" id="kb-filter-search" class="kb-filter-input" placeholder="Folio"
                                autocomplete="off" />
                        </div>

                        <div class="kb-filter-field">
                            <label for="kb-filter-proceso">Proceso</label>
                            <select id="kb-filter-proceso" class="kb-filter-input">
                                <!-- luego estos vendrán del backend -->
                            </select>
                        </div>

                        <div class="kb-filter-field">
                            <label for="kb-filter-tramite">Trámite</label>
                            <select id="kb-filter-tramite" class="kb-filter-input">
                                <!-- luego estos vendrán del backend -->
                            </select>
                        </div>

                        <button type="button" class="kb-filter-clear" id="kb-filter-clear">
                            Limpiar filtros
                        </button>
                    </div>
                </section>

                <!-- Tablero Kanban -->
                <div class="kb-board" id="kb-board">

                    <!-- Por Hacer = status 1 -->
                    <section class="kb-col" data-status="1" aria-labelledby="kb-h-1">
                        <header class="kb-header" id="kb-h-1">
                            <h3>Por hacer</h3>
                            <span class="kb-count" id="kb-cnt-1">(0)</span>
                        </header>
                        <div class="kb-list" id="kb-col-1" aria-describedby="kb-h-1"></div>
                    </section>

                    <!-- En proceso = status 2 -->
                    <section class="kb-col" data-status="2" aria-labelledby="kb-h-2">
                        <header class="kb-header" id="kb-h-2">
                            <h3>En proceso</h3>
                            <span class="kb-count" id="kb-cnt-2">(0)</span>
                        </header>
                        <div class="kb-list" id="kb-col-2" aria-describedby="kb-h-2"></div>
                    </section>

                    <!-- Por revisar = status 3 -->
                    <section class="kb-col" data-status="3" aria-labelledby="kb-h-3">
                        <header class="kb-header" id="kb-h-3">
                            <h3>Por revisar</h3>
                            <span class="kb-count" id="kb-cnt-3">(0)</span>
                        </header>
                        <div class="kb-list" id="kb-col-3" aria-describedby="kb-h-3"></div>
                    </section>

                    <!-- Hecho = status 4 -->
                    <section class="kb-col" data-status="4" aria-labelledby="kb-h-4">
                        <header class="kb-header" id="kb-h-4">
                            <h3>Hecho</h3>
                            <span class="kb-count" id="kb-cnt-4">(0)</span>
                        </header>
                        <div class="kb-list" id="kb-col-4" aria-describedby="kb-h-4"></div>
                    </section>

                    <!-- En pausa = status 5 -->
                    <section class="kb-col" data-status="5" aria-labelledby="kb-h-5">
                        <header class="kb-header" id="kb-h-5">
                            <h3>Bloqueado</h3>
                            <span class="kb-count" id="kb-cnt-5">(0)</span>
                        </header>
                        <div class="kb-list" id="kb-col-5" aria-describedby="kb-h-5"></div>
                    </section>

                </div><!-- /.kb-board -->

                <!-- Overlay para el drawer de detalles -->
                <div id="kb-d-overlay" class="kb-d-overlay" hidden></div>

                <!-- Overlay para el drawer de detalles -->
                <div id="kb-d-overlay" class="kb-d-overlay" hidden></div>





                <!-- Drawer de detalles -->
                <aside class="kb-details" id="kb-details" aria-label="Detalle de la asignación" aria-hidden="true">

                    <header class="kb-d-head">
                        <h3 class="kb-d-heading">Detalle de la tarea</h3>
                        <button type="button" id="kb-d-close" class="kb-d-close" aria-label="Cerrar detalle">✕</button>
                    </header>

                    <!-- Estado vacío por defecto -->
                    <p class="kb-d-empty" id="kb-d-empty">
                        Selecciona una tarjeta para ver el detalle de la tarea.
                    </p>

                    <!-- Cuerpo del detalle (se muestra cuando hay tarea seleccionada) -->
                    <div class="kb-d-body" id="kb-d-body" hidden>

                        <!-- ================== DATOS PRINCIPALES ================== -->
                        <div class="kb-d-section">

                            <!-- Folio -->
                            <div class="kb-d-field">
                                <strong>Folio:</strong>
                                <span id="kb-d-folio">—</span>
                            </div>

                            <!-- Proceso -->
                            <div class="kb-d-field">
                                <strong>Proceso:</strong>
                                <span id="kb-d-proceso">—</span>
                            </div>

                            <!-- Tarea (título de la tarea) -->
                            <div class="kb-d-field">
                                <strong>Tarea:</strong>
                                <span id="kb-d-tarea">—</span>
                            </div>

                            <!-- Asignado a -->
                            <div class="kb-d-field">
                                <strong>Asignado a:</strong>
                                <span id="kb-d-asignado">—</span>
                            </div>

                            <!-- Esfuerzo -->
                            <div class="kb-d-field">
                                <strong>Esfuerzo (hrs):</strong>
                                <span id="kb-d-esfuerzo">—</span>
                            </div>

                            <!-- Descripción -->
                            <div class="kb-d-field">
                                <strong>Descripción:</strong>
                                <p class="kb-d-desc" id="kb-d-desc">—</p>
                            </div>

                            <!-- Creado por -->
                            <div class="kb-d-field">
                                <strong>Creado por:</strong>
                                <span id="kb-d-creado-por">—</span>
                            </div>

                            <!-- Quien autoriza -->
                            <div class="kb-d-field">
                                <strong>Quien autoriza:</strong>
                                <span id="kb-d-autoriza">—</span>
                            </div>
                        </div>

                        <hr class="kb-d-section-sep" />

                        <!-- ================== EVIDENCIAS ================== -->
                        <section class="kb-d-section kb-d-section--media">

                            <div class="kb-d-media-head">
                                <h4 class="kb-d-media-title">Evidencias</h4>
                                <span class="kb-d-media-hint">
                                    Puedes adjuntar imágenes, videos o PDFs (p.ej. fotos del reporte).
                                </span>
                            </div>

                            <!-- Grid de thumbnails (se llena desde JS) -->
                            <div class="kb-evid-grid kb-d-media-grid" id="kb-d-evidencias">
                                <div class="kb-evid-placeholder"></div>
                                <div class="kb-evid-placeholder"></div>
                                <div class="kb-evid-placeholder"></div>
                            </div>

                            <!-- Acciones de evidencias -->
                            <div class="kb-evid-actions kb-d-media-actions">
                                <!-- input oculto para elegir archivos -->
                                <input type="file" id="kb-evid-input" accept="image/*,video/*,application/pdf" multiple
                                    hidden>

                                <!-- Botón tipo tile, usa el CSS .kb-media-upload -->
                                <button type="button" id="kb-evid-upload" class="kb-evid-upload-btn kb-media-upload">
                                    <span>Subir archivo…</span>
                                </button>
                            </div>

                        </section>

                        <hr class="kb-d-section-sep" />

                        <!-- ================== COMENTARIOS TAREA ================== -->
                        <section class="kb-d-section">
                            <div class="kb-d-field">
                                <strong>Comentarios:</strong>

                                <section class="demo-comments">
                                    <div class="demo-card">

                                        <!-- Header del widget -->
                                        <div class="head">
                                            <h4>Comentarios de la tarea</h4>
                                            <span class="pill" id="kb-comments-count">0 comentarios</span>
                                        </div>

                                        <!-- Composer -->
                                        <div class="composer">
                                            <div class="composer-wrap">
                                                <textarea id="kb-comment-text" rows="2"
                                                    placeholder="Escribe un comentario sobre esta tarea…"></textarea>

                                                <!-- Botón flotante con SVG (enviar) -->
                                                <button type="button" class="send-fab" id="kb-comment-send"
                                                    title="Enviar comentario">
                                                    <svg viewBox="0 0 20 20" aria-hidden="true">
                                                        <path d="M2.3 17.7l15.4-7.7L2.3 2.3 2 8.5l8 1.5-8 1.5z"
                                                            fill="currentColor" />
                                                    </svg>
                                                </button>
                                            </div>

                                            <div class="actions">
                                                <button type="button" class="btn primary" id="kb-comment-btn">
                                                    Comentar
                                                </button>
                                                <span class="hint">Pulsa Ctrl + Enter para enviar.</span>
                                            </div>
                                        </div>

                                        <!-- Feed de comentarios -->
                                        <div class="c-feed" id="kb-comments-feed">
                                            <p class="empty">Aún no hay comentarios para esta tarea.</p>

                                            <article class="msg">
                                                <div class="avatar">
                                                    <img src="/ASSETS/user/img_user1.png" alt="Juan Pablo García">
                                                </div>
                                                <div class="body">
                                                    <div class="who">
                                                        <span class="name">Juan Pablo García</span>
                                                        <span class="time">Hace 2 h</span>
                                                    </div>
                                                    <div class="text">
                                                        <span class="task-tag">Tarea-15142</span>
                                                        <p class="comment-body">
                                                            Texto del comentario relacionado a esta tarea…
                                                        </p>
                                                    </div>
                                                </div>
                                            </article>
                                        </div>

                                    </div>
                                </section>
                            </div>
                        </section>

                    </div><!-- /.kb-d-body -->
                </aside>



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
                <!-- Nombre / Apellidos -->
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

                <!-- Correo / Teléfono -->
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

                <!-- Contraseña / Confirmar -->
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

                <!-- Sección informativa -->
                <h3 class="form-section-title">INFORMACIÓN DEL EMPLEADO</h3>

                <!-- Departamento / Reporta a (solo lectura) -->
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

                <!-- Status (solo lectura) -->
                <div class="form-row">
                    <label for="perfil-status">Status</label>
                    <input type="text" id="perfil-status" name="status" class="is-readonly" readonly
                        aria-readonly="true">
                </div>

                <!-- Submit -->
                <button type="submit" class="btn-submit">Guardar cambios</button>
            </form>

            <p class="modal-note">
                Tus datos están seguros con nosotros. Al guardar aceptas nuestras políticas de privacidad y condiciones
                de uso.
            </p>
            <p class="modal-copy">© 2025 GodCode. Todos los derechos reservados.</p>
        </div>
    </div>

    <!-- Modal editor de Avatar  -->
    <div class="eda-overlay" id="eda-overlay" aria-hidden="true">
        <div class="eda-modal" role="dialog" aria-modal="true" aria-labelledby="eda-title">
            <div class="eda-header">
                <div class="eda-title" id="eda-title">Editar avatar</div>
                <div class="eda-actions">
                    <button class="btn" id="eda-close" type="button">Cerrar</button>
                </div>
            </div>

            <div class="eda-body">
                <!-- Lado izquierdo: Dropzone + Vista previa -->
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

                <!-- Lado derecho: Recientes (mini-historial local) -->
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

            <!-- Input real (oculto). El JS se encarga de activarlo. -->
            <input type="file" id="eda-file" accept="image/png, image/jpeg, image/webp, image/heic, image/heif"
                hidden />
        </div>
    </div>

    <!-- Modal: Subir evidencias V2 -->
    <div id="ix-evid-modal" class="modal-overlay" aria-hidden="true">
        <div class="modal-content ix-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="ix-evid-title">
            <button class="modal-close" type="button" aria-label="Cerrar">×</button>

            <div class="ix-modal__header">
                <h2 id="ix-evid-title">Subir evidencias</h2>

                <!-- NUEVO: tabs para elegir Imágenes / Enlaces -->
                <div class="ix-modal__tabs">
                    <button type="button" class="ix-tab is-active" id="ix-tab-file" data-mode="file">
                        Imágenes
                    </button>
                    <button type="button" class="ix-tab" id="ix-tab-link" data-mode="link">
                        Enlace
                    </button>
                </div>
            </div>

            <div class="ix-modal__body">
                <form id="ix-evid-form" class="ix-form" novalidate="">
                    <!-- MODO IMÁGENES -->
                    <div class="ix-form__row" id="ix-file-group">
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

                    <!-- NUEVO: MODO ENLACES (Drive, Mega, etc.) -->
                    <div class="ix-form__row" id="ix-url-group" hidden>
                        <div class="ix-field ix-field--full">
                            <label class="ix-field__label" for="ix-url-input">Enlace (Drive, Mega, etc.)</label>
                            <input id="ix-url-input" type="url" class="ix-input"
                                placeholder="https://drive.google.com/..." autocomplete="off">
                            <small class="ix-help" id="ix-err-url" hidden></small>
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
    <script src="/JS/components.js"></script>
    <script type="module" src="/JS/ui/avatar-edit.js"></script>

    <!-- SortableJS -->
    <script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js" defer></script>

    <script type="module" src="/JS/tareas.js"></script>

    <!-- media -->
    <script type="module" src="/JS/api/media.js"></script>
    <script type="module" src="/JS/api/mediaRequerimientos.js"></script>

    <!-- bundle para que cargue bien el sidebar -->
    <script type="module" src="/JS/auth/session.js"></script>
    <script type="module" src="/JS/ui/sidebar.js"></script>
    <script type="module" src="/JS/ui/avatar-edit.js"></script>

</body>

</html>
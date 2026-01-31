<?php
require_once __DIR__ . '/../../JS/auth/ix_guard.php';
ix_require_session();
?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ixtla App</title>
    <link rel="stylesheet" href="/CSS/plantilla.css">
    <link rel="stylesheet" href="/CSS/home.css">
    <link rel="stylesheet" href="/CSS/stepper.css">
    <link rel="stylesheet" href="/CSS/requerimiento copy.css">
    <link rel="stylesheet" href="/CSS/components.css">
    <link rel="stylesheet" href="/CSS/requerimientoCoemntariosSection copy.css">
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

                <!-- =========================================
                     COMENTARIOS (solo contenedor, sin dummies)
                     ========================================= -->
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

                        <!-- JS llenará aquí los comentarios -->
                        <div class="c-feed" aria-live="polite"></div>
                    </div>
                </section>
            </aside>

            <!-- MAIN -->
            <section class="hs-main exp-view">
                <!-- Encabezado -->
                <header class="exp-head">

                    <!-- Fila 1: título + meta -->
                    <div class="exp-head-main">
                        <div class="exp-title">
                            <h1>Reporte Otros</h1>
                        </div>

                        <dl class="exp-meta">
                            <div>
                                <dt>Folio</dt>
                                <dd id="req-folio">—</dd>
                            </div>
                            <div>
                                <dt>Departamento</dt>
                                <dd id="req-departamento">—</dd>
                            </div>
                            <div>
                                <dt>Fecha de solicitud</dt>
                                <dd id="req-fecha-solicitud">—</dd>
                            </div>
                        </dl>
                    </div>

                    <!-- Fila 2: botones, renglón propio -->
                    <div class="exp-head-actions">
                        <div id="req-actions" class="exp-actions">
                            <!-- los botones se rellenan por JS, deja este contenedor -->
                        </div>
                    </div>
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

                <!-- Tabs + botón Generar expediente -->
                <div class="exp-tabs-bar">
                    <nav class="exp-tabs" role="tablist" aria-label="Secciones">
                        <button class="exp-tab is-active" role="tab" aria-selected="true">Contacto</button>
                        <button class="exp-tab" role="tab" aria-selected="false">Detalles</button>
                        <button class="exp-tab" role="tab" aria-selected="false">Planeación</button>
                    </nav>

                    <button type="button" class="exp-expediente-btn" id="btn-expediente">
                        <svg class="exp-expediente-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="none"
                                stroke="currentColor" stroke-width="1.5" />
                            <path d="M14 3v5h5" fill="none" stroke="currentColor" stroke-width="1.5" />
                            <path d="M8 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                            <path d="M8 15h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                            <path d="M9 18h6a.6.6 0 0 0 .6-.6v-1.8A.6.6 0 0 0 15 15h-6v3z" fill="currentColor"
                                opacity=".12" />
                        </svg>
                        <span>Generar expediente</span>
                    </button>
                </div>

                <!-- WRAPPER: evita salto entre tabs -->
                <div class="exp-panes">

                    <!-- Panel: Contacto -->
                    <section class="exp-pane is-active" role="tabpanel" data-tab="Contacto">
                        <div class="exp-grid">
                            <!-- Nombre -->
                            <div class="exp-field">
                                <label>Nombre de contacto:</label>
                                <div class="exp-val" data-role="contacto-nombre-val">
                                    <span data-contact-text="contacto_nombre">Requerimiento prueba</span>
                                    <button type="button" class="icon-btn" data-contact-basic-edit="1"
                                        data-contact-key="contacto_nombre" title="Editar nombre de contacto"
                                        aria-label="Editar nombre de contacto">
                                        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                            <path fill="currentColor"
                                                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83z">
                                            </path>
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <!-- Teléfono -->
                            <div class="exp-field">
                                <label>Teléfono:</label>
                                <div class="exp-val" data-role="contacto-telefono-val">
                                    <span data-contact-text="contacto_telefono">3322578320</span>
                                    <button type="button" class="icon-btn" data-contact-basic-edit="1"
                                        data-contact-key="contacto_telefono" title="Editar teléfono"
                                        aria-label="Editar teléfono">
                                        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                            <path fill="currentColor"
                                                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83z">
                                            </path>
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <!-- Correo -->
                            <div class="exp-field">
                                <label>Correo electrónico:</label>
                                <div class="exp-val" data-role="contacto-email-val">
                                    <a href="mailto:jackstriker26@gmail.com" data-contact-text="contacto_email">
                                        jackstriker26@gmail.com
                                    </a>
                                    <button type="button" class="icon-btn" data-contact-basic-edit="1"
                                        data-contact-key="contacto_email" title="Editar correo electrónico"
                                        aria-label="Editar correo electrónico">
                                        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                            <path fill="currentColor"
                                                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83z">
                                            </path>
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <!-- Domicilio -->
                            <div class="exp-field">
                                <label>Domicilio:</label>
                                <div class="exp-val" data-role="contacto-calle-val">
                                    <span data-contact-text="contacto_calle">San Antonio Tlayacapan</span>
                                    <button type="button" class="icon-btn" data-contact-basic-edit="1"
                                        data-contact-key="contacto_calle" title="Editar domicilio"
                                        aria-label="Editar domicilio">
                                        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                            <path fill="currentColor"
                                                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83z">
                                            </path>
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <!-- C.P. -->
                            <div class="exp-field exp-field--editable" data-contact-field="cp">
                                <label for="contact-cp">C.P.:</label>

                                <!-- lectura -->
                                <div class="exp-val contact-read">
                                    <span data-contact-text="contacto_cp">45877</span>
                                    <button type="button" class="icon-btn" data-contact-edit="cp"
                                        title="Editar C.P. y colonia" aria-label="Editar C.P. y colonia">
                                        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                            <path fill="currentColor"
                                                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83z">
                                            </path>
                                        </svg>
                                    </button>
                                </div>

                                <!-- edición CP -->
                                <div class="contact-edit contact-edit--cp" data-contact-edit-wrapper="cp" hidden>
                                    <div class="contact-edit-row">
                                        <select id="contact-cp" name="contacto_cp" class="ix-select ix-select--quiet"
                                            data-role="cp-select">
                                            <option value="">Selecciona C.P.</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <!-- Colonia -->
                            <div class="exp-field exp-field--editable" data-contact-field="colonia">
                                <label for="contact-colonia">Colonia:</label>

                                <!-- lectura -->
                                <div class="exp-val contact-read">
                                    <span data-contact-text="contacto_colonia">Valle de los Olivos</span>
                                </div>

                                <!-- edición -->
                                <div class="contact-edit contact-edit--colonia" data-contact-edit-wrapper="colonia"
                                    hidden>
                                    <div class="contact-edit-row">
                                        <select id="contact-colonia" name="contacto_colonia"
                                            class="ix-select ix-select--quiet" data-role="colonia-select">
                                            <option value="">Selecciona colonia</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- Panel: Detalles -->
                    <section class="exp-pane" role="tabpanel" data-tab="detalles">
                        <div class="exp-grid">

                            <!-- Campo Trámite -->
                            <div class="exp-field">
                                <label>Trámite:</label>
                                <div class="exp-val">
                                    <span data-detalle-text="tramite">Reporte Fuga de agua</span>

                                    <!-- Botón de editar -->
                                    <button type="button" class="icon-btn" data-detalle-edit="tramite"
                                        title="Editar trámite" aria-label="Editar trámite">
                                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                                            <path fill="currentColor"
                                                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83z">
                                            </path>
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div class="exp-field"><label>Director:</label>
                                <div class="exp-val"><a>Juan Pablo</a></div>
                            </div>

                            <div class="exp-field">
                                <label>Asignado:</label>
                                <div class="exp-val">
                                    <span data-detalle-text="asignado">Analista SAMAPA</span>

                                    <button type="button" class="icon-btn" title="Asignar requerimiento"
                                        aria-label="Asignar requerimiento" data-act="assign-req">
                                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                                            <path fill="currentColor"
                                                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div class="exp-field">
                                <label>Estatus:</label>
                                <div class="exp-val" id="req-status"
                                    style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">

                                    <!-- Bloque de estatus -->
                                    <div class="status-main" style="display:inline-flex; align-items:center; gap:8px;">
                                        <span data-role="status-badge" class="exp-badge is-info">—</span>
                                        <!-- botón + combo para cambiar el status -->
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
                            </div>

                            <div class="exp-field" id="req-motivo-field">
                                <label>Motivo de Pausa/Cancelación:</label>
                                <div class="exp-val" id="req-motivo-wrap">—</div>
                            </div>

                            <!-- Campo Descripción -->
                            <div class="exp-field">
                                <label>Descripción:</label>
                                <div class="exp-val">
                                    <span data-detalle-text="descripcion">
                                        Texto de descripción del requerimiento…
                                    </span>

                                    <!-- Botón de editar -->
                                    <button type="button" class="icon-btn" data-detalle-edit="descripcion"
                                        title="Editar descripción" aria-label="Editar descripción">
                                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                                            <path fill="currentColor"
                                                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83z">
                                            </path>
                                        </svg>
                                    </button>
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

                            <!-- JS renderiza aqui los procesos/tareas -->

                        </div>

                    </section>
                </div>
                <!-- /exp-panes -->

                <!-- Toolbar arriba -->
                <div class="planeacion-toolbar evid-toolbar">
                    <h3 class="planeacion-title">Evidencias</h3>
                    <button id="btn-open-evid-modal" class="fase-add" type="button">Subir evidencias +</button>
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

    <!-- Modal: Confirmar eliminación de tarea -->
    <div id="modal-del-tarea" class="modal-overlay" aria-hidden="true">
        <div class="modal-content ix-del-modal" role="dialog" aria-modal="true" aria-labelledby="del-tarea-title">
            <button class="modal-close" type="button" aria-label="Cerrar">×</button>

            <h2 id="del-tarea-title" class="ix-del-title">Eliminar tarea</h2>

            <p class="ix-del-text">
                ¿Seguro que quieres eliminar esta tarea?
            </p>

            <!-- Slot opcional para pintar info (título / id) desde JS -->
            <p class="ix-del-meta" id="del-tarea-meta" hidden></p>

            <!-- aquí el JS puede guardar el id -->
            <input type="hidden" id="del-tarea-id" value="">

            <div class="ix-del-actions">
                <button type="button" class="btn ix-del-cancel" id="btn-del-tarea-cancel">
                    Cancelar
                </button>
                <button type="button" class="btn ix-del-confirm" id="btn-del-tarea-confirm">
                    Confirmar
                </button>
            </div>

            <p class="modal-note ix-del-note">
                Esta acción no se puede deshacer.
            </p>
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

                <div class="form-row split">
                    <div>
                        <label for="tarea-esfuerzo">Esfuerzo (horas)</label>
                        <input type="number" id="tarea-esfuerzo" name="esfuerzo" min="1" step="1" required
                            placeholder="1">
                    </div>
                </div>

                <div class="form-row">
                    <label for="tarea-asignado">Responsable</label>
                    <select id="tarea-asignado" name="tarea-asignado" required>
                        <option value="" disabled selected>Selecciona responsable…</option>
                    </select>
                </div>

                <div class="form-row">
                    <label for="tarea-desc">Descripción</label>
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
                    <button type="submit" class="btn-submit">Crear proceso</button>
                </div>
            </form>

            <p class="modal-note">recuerda que todavia no se hacen los cambios con los endpoints.</p>
        </div>
    </div>

    <!-- Modal: Subir evidencias V2 -->
    <div id="ix-evid-modal" class="modal-overlay" aria-hidden="true">
        <div class="modal-content ix-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="ix-evid-title">
            <button class="modal-close" type="button" aria-label="Cerrar">×</button>

            <div class="ix-modal__header">
                <h2 id="ix-evid-title">Subir evidencias</h2>

                <!-- tabs para elegir Imágenes / Enlaces -->
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

    <script src="/JS/JSglobal.js"></script>
    <script src="/JS/components.js"></script>

    <script type="module" src="/JS/auth/session.js"></script>
    <script type="module" src="/JS/auth/requerimientoGuard.js"></script>

    <script src="/JS/UAT/requerimientoView.js"></script>
    <script src="/JS/UAT/ui/requerimientoDetalle.js"></script>
    <script src="/JS/UAT/ui/requerimientoPlaneacion.js"></script>
    <script src="/JS/UAT/ui/requerimientoExpediente.js"></script>

    <script type="module" src="/JS/api/media.js"></script>
    <script type="module" src="/JS/api/mediaRequerimientos.js"></script>

    <!-- bundle para que cargue bien el sidebar -->
    <script type="module" src="/JS/ui/sidebar.js"></script>
    <script type="module" src="/JS/ui/avatar-edit.js"></script>

    <!-- Animaciones y utilidades de esta vista -->
    <script type="module" src="/JS/ui/animacionesDeViewDetalle.js"></script>


</body>

</html>
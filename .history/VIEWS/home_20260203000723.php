<?php
    require_once __DIR__ . '/../JS/auth/ix_guard.php';
    ix_require_session();
?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ixtla App</title>
    <link rel="stylesheet" href="/CSS/plantilla.css">
    <link rel="stylesheet" href="/CSS/home copy.css">
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
                <section id="hs-filterbox" class="hs-filterbox" aria-label="Filtros">
                    <button type="button" id="hs-filter-toggle" class="hs-filter-toggle" aria-expanded="false"
                        aria-controls="hs-states">
                        <span class="hs-filter-title">Filtros</span>
                        <span id="hs-filter-active" class="hs-filter-active">Todos (0)</span>
                        <span class="hs-filter-chevron" aria-hidden="true">▾</span>
                    </button>

                    <nav id="hs-states" class="hs-states" aria-label="Estados">
                        <button class="item is-active" data-status="todos" role="radio" aria-checked="true">
                            <span class="label">Todos</span><span class="count" id="cnt-todos">(0)</span>
                        </button>
                        <button type="button" class="item" data-status="activo" role="radio" aria-checked="false">
                            <span class="label">Activo</span>
                            <span class="count" id="cnt-activo">(0)</span>
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
                </section>

            </aside>

            <!-- MAIN -->
            <section class="hs-main">

                <!-- CHARTS -->
                <div class="hs-charts" id="hs-charts">

                    <!-- Línea (año actual, sin título) -->
                    <section class="hs-card" aria-labelledby="y-desc">
                        <div class="hs-chart-wrap" style="position:relative;">
                            <canvas id="chart-year" width="600" height="240" aria-describedby="y-desc"></canvas>
                            <!-- Tooltip (lo usa LineChart) -->
                            <div class="chart-tip"
                                style="position:absolute;pointer-events:none;padding:.35rem .5rem;border-radius:.5rem;background:#1f2937;color:#fff;font:12px/1.2 system-ui;opacity:0;transform:translate(-50%,-120%);transition:opacity .12s;">
                            </div>
                        </div>
                        <p id="y-desc" class="sr-only">Serie mensual de requerimientos creados durante el año actual.
                        </p>
                    </section>

                    <!-- Donut -->
                    <section class="hs-card" aria-labelledby="m-desc">
                        <div class="hs-donut">
                            <!-- Columna: gráfico -->
                            <div class="hs-chart-wrap" style="position:relative;">
                                <canvas id="chart-month" width="380" height="240" aria-describedby="m-desc"></canvas>
                                <!-- Tooltip (lo usa DonutChart) -->
                                <div class="chart-tip"
                                    style="position:absolute;pointer-events:none;padding:.35rem .5rem;border-radius:.5rem;background:#1f2937;color:#fff;font:12px/1.2 system-ui;opacity:0;transform:translate(-50%,-120%);transition:opacity .12s;">
                                </div>
                            </div>

                            <!-- Columna: leyenda (scrollable) -->
                            <aside class="hs-donut-legend" aria-label="Tipos de requerimiento">
                                <div id="donut-legend" class="legend" aria-live="polite"></div>
                            </aside>
                        </div>

                        <p id="m-desc" class="sr-only">
                            Requerimientos.
                        </p>
                    </section>


                </div>

                <!-- TABLA -->
                <section class="hs-table">
                    <div class="hs-head">
                        <h3 style="margin:0;">Trámites</h3>

                        <div class="hs-tools">

                            <!-- esta es la barra de busqueda de requerimientos de home -->
                            <div class="search" role="search">
                                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                                    <path fill="currentColor"
                                        d="M10 4a6 6 0 0 1 4.472 9.931l4.298 4.297l-1.414 1.415l-4.297-4.298A6 6 0 1 1 10 4m0 2a4 4 0 1 0 0 8a4 4 0 0 0 0-8" />
                                </svg>
                                <input id="hs-search" type="search" placeholder="Buscar por folio, ID (#123) o status…"
                                    aria-label="Buscar">
                            </div>

                            <div class="legend">

                                <!-- boton para exportar un excel de los requerimientos -->
                                <button type="button" id="hs-btn-export-req" class="hs-btn-new-req hs-btn-export-req"
                                    title="Exportar requerimientos">
                                    <svg class="hs-btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                                        <!-- ícono  -->
                                        <path fill="currentColor"
                                            d="M12 3a1 1 0 0 1 1 1v9.59l2.3-2.3 1.4 1.42L12 17.41 7.3 12.7l1.4-1.42 2.3 2.3V4a1 1 0 0 1 1-1z" />
                                        <path fill="currentColor"
                                            d="M5 19a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1z" />
                                    </svg>
                                    <span>Exportar requerimientos</span>
                                </button>



                                <!-- boton para disparar el modal de la creacion de requerimientos -->
                                <button type="button" id="hs-btn-new-req" class="hs-btn-new-req">
                                    <svg class="hs-btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                                        <!-- ícono archivo con signo + -->
                                        <path fill="currentColor"
                                            d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm6 1.5V8h4.5L12 3.5zM11 11h2v3h3v2h-3v3h-2v-3H8v-2h3v-3z" />
                                    </svg>
                                    <span>Nuevo requerimiento</span>
                                </button>

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
                                    <th>Folio</th>
                                    <th>Departamento</th>
                                    <th>Tipo de trámite</th>
                                    <th>Asignado</th>
                                    <th>Teléfono</th>
                                    <th>Solicitado</th>
                                    <th>Estatus</th>
                                </tr>
                            </thead>
                            <tbody id="hs-table-body"></tbody>
                        </table>
                    </div>

                    <!-- Paginación -->
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


















    <!-- MODALES -->
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




    <!-- Modal para levantamiento de requerimientos de parte del canal 2 -->
    <div id="ix-report-modal" class="ix-modal" hidden aria-hidden="true">
        <div class="ix-modal__overlay" data-ix-close></div>

        <div class="ix-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="ix-report-title"
            aria-describedby="ix-report-desc">

            <header class="ix-modal__header">
                <div class="ix-modal__brand">
                    <img src="/ASSETS/main_logo.png" alt="Ixtlahuacán de los Membrillos - Ayuntamiento"
                        onerror="this.style.display='none'">
                </div>

                <div class="ix-modal__headings">
                    <h2 id="ix-report-title" class="ix-modal__title">Nuevo Requerimiento</h2>
                    <p id="ix-report-subtitle" class="ix-modal__subtitle">Selecciona el tipo de trámite</p>
                    <p id="ix-report-desc" class="sr-only">
                        Completa los campos para levantar un requerimiento.
                    </p>
                </div>

                <button type="button" class="ix-modal__close" aria-label="Cerrar" data-ix-close>×</button>
            </header>

            <div class="ix-modal__body">
                <form id="ix-report-form" class="ix-form" novalidate>

                    <!-- Hidden -->
                    <input type="hidden" id="ix-departamento-id" name="departamento_id" value="">
                    <input type="hidden" name="req_title" id="ix-report-req" value="">
                    <input type="hidden" name="tramite_id" id="ix-tramite-id" value="">

                    <!-- ======================= SELECTORES ======================= -->
                    <div class="ix-form__row">
                        <div class="ix-field">
                            <label for="ix-departamento-select" class="ix-field__label">Departamento</label>

                            <div class="ix-field__control">

                                <select id="ix-departamento-select" class="ix-select ix-select--quiet"
                                    aria-describedby="ix-depto-help">
                                    <option value="" disabled selected>Selecciona un departamento</option>
                                </select>
                            </div>

                            <small class="ix-help" id="ix-err-depto" hidden></small>
                        </div>

                        <div class="ix-field">
                            <label for="ix-tramite-select" class="ix-field__label">Tipo de trámite</label>

                            <div class="ix-field__control">
                                <select id="ix-tramite-select" class="ix-select ix-select--quiet"
                                    aria-describedby="ix-tramite-help" required>
                                    <option value="" disabled selected>Selecciona un trámite</option>
                                </select>
                            </div>

                            <small class="ix-help" id="ix-err-tramite" hidden></small>
                        </div>
                    </div>

                    <!-- =======================  FORM  ======================= -->
                    <div class="ix-form__row">
                        <div class="ix-field">
                            <label for="ix-nombre" class="ix-field__label">Nombre completo</label>
                            <div class="ix-field__control">
                                <input id="ix-nombre" name="nombre" type="text" placeholder="Juan Pablo García Casillas"
                                    required>
                            </div>
                            <small class="ix-help" id="ix-err-nombre" hidden></small>
                        </div>

                        <div class="ix-field ix-field--compact">
                            <label for="ix-fecha" class="ix-field__label">Fecha</label>
                            <div class="ix-field__control">
                                <input id="ix-fecha" name="fecha" type="text" readonly aria-readonly="true"
                                    aria-describedby="ix-fecha-help" placeholder="--/--/---- · --:--">
                            </div>
                        </div>
                    </div>

                    <div class="ix-form__row">
                        <div class="ix-field">
                            <label for="ix-domicilio" class="ix-field__label">Domicilio</label>
                            <div class="ix-field__control">
                                <input id="ix-domicilio" name="contacto_calle" type="text"
                                    placeholder="Francisco I. Madero #2" required>
                            </div>
                            <small class="ix-help" id="ix-err-domicilio" hidden></small>
                        </div>

                        <div class="ix-field ix-field--sm">
                            <label for="ix-cp" class="ix-field__label">C.P.</label>
                            <div class="ix-field__control">
                                <select id="ix-cp" name="contacto_cp" class="ix-select ix-select--quiet" required>
                                    <option value="" disabled selected>Selecciona C.P.</option>
                                </select>
                            </div>
                            <small class="ix-help" id="ix-err-cp" hidden></small>
                        </div>
                    </div>

                    <div class="ix-form__row">
                        <div class="ix-field">
                            <label for="ix-colonia" class="ix-field__label">Colonia</label>
                            <div class="ix-field__control">
                                <select id="ix-colonia" name="contacto_colonia" class="ix-select ix-select--quiet"
                                    required disabled>
                                    <option value="" disabled selected>Selecciona colonia</option>
                                </select>
                            </div>
                            <small class="ix-help" id="ix-err-colonia" hidden></small>
                        </div>

                        <div class="ix-field">
                            <label for="ix-telefono" class="ix-field__label">Teléfono</label>
                            <div class="ix-field__control">
                                <input id="ix-telefono" name="contacto_telefono" type="tel" inputmode="numeric"
                                    maxlength="10" placeholder="3312345678" required>
                            </div>
                            <small class="ix-help" id="ix-err-telefono" hidden></small>
                        </div>
                    </div>

                    <div class="ix-form__row">
                        <div class="ix-field">
                            <label for="ix-correo" class="ix-field__label">Correo electrónico (opcional)</label>
                            <div class="ix-field__control">
                                <input id="ix-correo" name="contacto_email" type="email"
                                    placeholder="tucorreo@dominio.com">
                            </div>
                            <small class="ix-help" id="ix-err-correo" hidden></small>
                        </div>
                    </div>

                    <!-- (Se conserva: asunto condicional si aplica) -->
                    <div class="ix-form__row" id="ix-asunto-group" hidden>
                        <div class="ix-field ix-field--full">
                            <label for="ix-asunto" class="ix-field__label">Clasificación (Título)</label>
                            <div class="ix-field__control">
                                <input id="ix-asunto" name="asunto" type="text"
                                    placeholder="Ej. Quedó la llave abierta de una casa">
                            </div>
                            <small class="ix-help" id="ix-err-asunto" hidden></small>
                        </div>
                    </div>

                    <div class="ix-form__row">
                        <div class="ix-field ix-field--full">
                            <label for="ix-descripcion" class="ix-field__label">Descripción</label>
                            <div class="ix-field__control">
                                <textarea id="ix-descripcion" name="descripcion" rows="4" maxlength="700"
                                    placeholder="Describa lo mejor posible el motivo de su reporte" required></textarea>
                                <div class="ix-counter" aria-live="polite">
                                    <span id="ix-desc-count">0</span>
                                </div>
                            </div>
                            <small class="ix-help" id="ix-err-descripcion" hidden></small>
                        </div>
                    </div>

                    <div class="ix-form__row">
                        <div class="ix-field ix-field--full">
                            <label class="ix-field__label" for="ix-evidencia">Evidencia</label>
                            <div class="ix-upload" id="ix-upload-zone" data-js="upload">
                                <button type="button" id="ix-evidencia-cta" class="ix-upload-btn">Subir
                                    imágenes</button>
                                <input id="ix-evidencia" type="file" accept="image/png,image/jpeg" multiple hidden>
                                <div class="ix-upload__hint">
                                    Arrastra imágenes o haz click para seleccionar (JPG/PNG · máx 1 MB c/u · hasta 3)
                                </div>
                                <div class="ix-gallery" id="ix-evidencia-previews" aria-live="polite"></div>
                            </div>
                            <small class="ix-help" id="ix-err-evidencia" hidden></small>
                        </div>
                    </div>

                    <div class="ix-form__row ix-form__row--consent">
                        <label class="ix-checkbox">
                            <input type="checkbox" id="ix-consent" name="consent" required>
                            <span>
                                Acepto el aviso de privacidad y el uso de mis datos para gestionar este reporte.
                            </span>
                        </label>
                    </div>

                    <div class="ix-form__feedback" id="ix-report-feedback" role="status" aria-live="polite" hidden>
                    </div>

                    <div class="ix-form__footer">
                        <button type="button" class="ix-btn ix-btn--ghost" data-ix-close>Cancelar</button>
                        <button type="submit" class="ix-btn ix-btn--primary" id="ix-submit">Mandar reporte</button>
                    </div>

                </form>
            </div>
        </div>
    </div>









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

    <!-- componente de sheetjs -->
    <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>

    <script src="/JS/JSglobal.js"></script>
    <script type="module" src="/JS/home.js"></script>
    <script type="module" src="/JS/ui/avatar-edit.js"></script>
    <script type="module" src="/JS/ui/requerimientosCanal2.js"></script>


</body>

</html>
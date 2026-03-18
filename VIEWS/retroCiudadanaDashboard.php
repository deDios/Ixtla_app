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
    <link rel="stylesheet" href="/CSS/components.css">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <link rel="stylesheet" href="/CSS/retroCiudadanaDashboard.css">
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
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




















    <main class="home-samapa retro-dashboard">
        <div class="hs-wrap">

            <!-- SIDEBAR -->
            <aside class="hs-sidebar">
                <section class="hs-profile" aria-label="Perfil">
                    <div class="avatar-shell">
                        <div class="avatar-circle">
                            <img id="hs-avatar" class="avatar" src="/ASSETS/user/img_user1.png" alt="Avatar">
                        </div>

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

                <!-- FILTROS: conservar IDs base de HOME -->
                <section id="hs-filterbox" class="hs-filterbox" aria-label="Filtros">
                    <button type="button" id="hs-filter-toggle" class="hs-filter-toggle" aria-expanded="false"
                        aria-controls="hs-states">
                        <span class="hs-filter-title">Filtros</span>
                        <span id="hs-filter-active" class="hs-filter-active">Todos (0)</span>
                        <span class="hs-filter-chevron" aria-hidden="true">▾</span>
                    </button>

                    <nav id="hs-states" class="hs-states retro-states" aria-label="Status de retroalimentación"
                        role="radiogroup">
                        <button type="button" class="item is-active" data-status="todos" role="radio"
                            aria-checked="true">
                            <span class="label">Todos</span>
                            <span class="count" id="cnt-retro-todos">(0)</span>
                        </button>

                        <button type="button" class="item" data-status="1" role="radio" aria-checked="false">
                            <span class="label">No contestada</span>
                            <span class="count" id="cnt-retro-no-contestado">(0)</span>
                        </button>

                        <button type="button" class="item" data-status="2" role="radio" aria-checked="false">
                            <span class="label">Contestada</span>
                            <span class="count" id="cnt-retro-contestado">(0)</span>
                        </button>

                        <button type="button" class="item" data-status="3" role="radio" aria-checked="false">
                            <span class="label">Inhabilitada</span>
                            <span class="count" id="cnt-retro-inhabilitado">(0)</span>
                        </button>

                        <button type="button" class="item" data-status="0" role="radio" aria-checked="false">
                            <span class="label">Caducada</span>
                            <span class="count" id="cnt-retro-caducado">(0)</span>
                        </button>
                    </nav>
                </section>
            </aside>

            <!-- MAIN -->
            <section class="hs-main">

                <!-- OVERVIEW SUPERIOR -->
                <div class="hs-charts retro-overview" id="hs-charts">

                    <section class="hs-card retro-map-card" aria-labelledby="retro-map-title">

                        <div class="retro-map-shell">
                            <div id="retro-map" class="retro-map-canvas" role="img"
                                aria-label="Mapa de retroalimentación por colonia"></div>
                        </div>
                    </section>

                    <section class="hs-card retro-donut-card" aria-labelledby="retro-donut-title">
                        <!--
                        <div class="retro-card__head">
                            <h3 id="retro-donut-title">Gráfico de retros</h3>
                        </div>
                        -->

                        <div class="hs-donut">
                            <div class="hs-chart-wrap retro-donut__chart" style="position:relative;">
                                <canvas id="chart-month" width="380" height="240"
                                    aria-describedby="retro-donut-desc"></canvas>
                                <div class="chart-tip"
                                    style="position:absolute;pointer-events:none;padding:.35rem .5rem;border-radius:.5rem;background:#1f2937;color:#fff;font:12px/1.2 system-ui;opacity:0;transform:translate(-50%,-120%);transition:opacity .12s;">
                                </div>
                            </div>

                            <aside class="hs-donut-legend retro-donut__legend"
                                aria-label="Leyenda de retroalimentación">
                                <div id="donut-legend" class="legend" aria-live="polite"></div>
                            </aside>
                        </div>

                        <p id="retro-donut-desc" class="sr-only">
                            Distribución de retroalimentación ciudadana por status.
                        </p>
                    </section>
                </div>

                <!-- TABLA -->
                <section class="hs-table retro-table-section">
                    <div class="hs-head">
                        <h3 class="retro-table-title">Retro ciudadana</h3>

                        <div class="hs-tools retro-tools">
                            <div class="search" role="search">
                                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                                    <path fill="currentColor"
                                        d="M10 4a6 6 0 0 1 4.472 9.931l4.298 4.297l-1.414 1.415l-4.297-4.298A6 6 0 1 1 10 4m0 2a4 4 0 1 0 0 8a4 4 0 0 0 0-8" />
                                </svg>
                                <input id="hs-search" type="search"
                                    placeholder="Buscar por folio, departamento, trámite o retroalimentación…"
                                    aria-label="Buscar registros de retroalimentación">
                            </div>

                            <div class="legend retro-legend">
                                <span>Registros: <strong id="hs-legend-total">0</strong></span>
                                <span style="margin:0 .4rem;">·</span>
                                <span>Filtro: <strong id="hs-legend-status">Todos los status</strong></span>
                            </div>
                        </div>
                    </div>

                    <div id="hs-table-wrap" class="table-wrap">
                        <table class="gc retro-table" aria-describedby="hs-search">
                            <thead>
                                <tr>
                                    <th data-sort="folio">Folio</th>
                                    <th data-sort="departamento">Departamento</th>
                                    <th data-sort="tramite">Tipo de trámite</th>
                                    <th data-sort="asignado">Asignado</th>
                                    <th data-sort="telefono">Teléfono</th>
                                    <th data-sort="status">Status</th>
                                </tr>
                            </thead>
                            <tbody id="hs-table-body"></tbody>
                        </table>
                    </div>

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

    <!-- =========================
     DONE MODAL — CONFIRMACIÓN DE REQUERIMIENTO
     ========================= -->
    <div id="ix-done-modal" class="ix-modal ix-modal--done" hidden aria-hidden="true">

        <!-- Overlay -->
        <div class="ix-modal__overlay" data-ix-close=""></div>

        <!-- Dialog -->
        <div class="ix-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="ix-done-title">

            <!-- Header -->
            <header class="ix-modal__header">
                <div class="ix-modal__brand">
                    <img src="/ASSETS/main_logo.png" alt="Ixtlahuacán de los Membrillos - Ayuntamiento"
                        onerror="this.style.display='none'">
                </div>

                <div class="ix-modal__headings">
                    <h2 id="ix-done-title" class="ix-modal__title">
                        Nuevo Reporte
                    </h2>
                    <p class="ix-modal__subtitle">
                        <span id="ix-done-subtitle">—</span>
                    </p>
                </div>

                <button type="button" class="ix-modal__close" aria-label="Cerrar" data-ix-close="">
                    ×
                </button>
            </header>

            <!-- Body -->
            <div class="ix-modal__body">
                <div class="ix-done-copy">
                    <p>
                        Gracias por contribuir a mejorar la zona.
                        Pronto se dará seguimiento.
                    </p>

                    <p class="ix-done-mid">
                        Lo atenderemos lo más rápido posible.<br>
                        El N° de tu reporte es:
                        <strong id="ix-done-folio">REQ-—</strong>.<br>
                        Recuerda guardar este número para darle seguimiento.
                    </p>

                    <p>
                        Para cualquier otra duda comunícate al
                        <a href="tel:3312977799">33 1297 7799</a>
                        o envía un correo a
                        <a href="mailto:aciudadana98@gmail.com">
                            aciudadana98@gmail.com
                        </a>.
                    </p>
                </div>
            </div>

            <!-- Footer -->
            <footer class="ix-modal__footer">
                <button type="button" class="ix-btn ix-btn--primary" id="ix-done-ok" data-ix-close="">
                    Finalizar
                </button>
            </footer>

        </div>
    </div>



    <!-- =========================
 RETRO MODAL — SOLO LECTURA
 Basado 1:1 en retroCiudadana.php
 ========================= -->
    <div id="retro-modal" class="ix-modal ix-modal--lock" hidden aria-hidden="true">
        <div class="ix-modal__overlay" id="retro-view-overlay"></div>

        <div class="ix-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="retro-title">
            <header class="ix-modal__header retro-view-head">
                <h2 id="retro-title" class="ix-modal__title">Retroalimentación</h2>
                <button type="button" class="retro-view-x" id="retro-view-close" aria-label="Cerrar">×</button>
            </header>

            <div class="ix-modal__body">
                <div id="retro-folio" class="retro-folio">
                    Folio: REQ-000000000
                </div>

                <label class="retro-label" for="retro-tramite">Tipo de trámite</label>
                <input id="retro-tramite" class="retro-input" type="text" readonly>

                <label class="retro-label" for="retro-descripcion">Descripción del requerimiento</label>
                <textarea id="retro-descripcion" class="retro-input retro-textarea" rows="4" readonly></textarea>

                <label class="retro-label" for="retro-ciudadano">Ciudadano</label>
                <input id="retro-ciudadano" class="retro-input" type="text" readonly>

                <div class="retro-grid-2">
                    <div>
                        <label class="retro-label" for="retro-depto">Departamento</label>
                        <input id="retro-depto" class="retro-input" type="text" readonly>
                    </div>

                    <div>
                        <label class="retro-label" for="retro-asignado">Asignado</label>
                        <input id="retro-asignado" class="retro-input" type="text" readonly>
                    </div>
                </div>

                <div class="retro-grid-2">
                    <div>
                        <label class="retro-label" for="retro-telefono">Teléfono</label>
                        <input id="retro-telefono" class="retro-input" type="text" readonly>
                    </div>

                    <div>
                        <label class="retro-label" for="retro-status">Status</label>
                        <input id="retro-status" class="retro-input" type="text" readonly>
                    </div>
                </div>

                <p class="retro-q">¿Cómo valoras el servicio recibido?</p>

                <div class="retro-rate retro-rate--svg retro-rate--readonly" aria-label="Valoración del servicio">

                    <label class="rate-item" data-rate="1">
                        <input type="radio" name="rate_view" value="1" disabled />
                        <span class="rate-icon" aria-hidden="true">
                            <svg viewBox="0 0 48 48" class="rate-svg">
                                <circle class="s" cx="24" cy="24" r="14"></circle>
                                <circle class="f" cx="19" cy="22" r="1.6"></circle>
                                <circle class="f" cx="29" cy="22" r="1.6"></circle>
                                <path class="s" d="M18 32c2.2-2.4 9.8-2.4 12 0"></path>
                            </svg>
                        </span>
                        <span class="rate-label">Malo</span>
                    </label>

                    <label class="rate-item" data-rate="2">
                        <input type="radio" name="rate_view" value="2" disabled />
                        <span class="rate-icon" aria-hidden="true">
                            <svg viewBox="0 0 48 48" class="rate-svg">
                                <circle class="s" cx="24" cy="24" r="14"></circle>
                                <circle class="f" cx="19" cy="22" r="1.6"></circle>
                                <circle class="f" cx="29" cy="22" r="1.6"></circle>
                                <path class="s" d="M18 31h12"></path>
                            </svg>
                        </span>
                        <span class="rate-label">Regular</span>
                    </label>

                    <label class="rate-item" data-rate="3">
                        <input type="radio" name="rate_view" value="3" disabled />
                        <span class="rate-icon" aria-hidden="true">
                            <svg viewBox="0 0 48 48" class="rate-svg">
                                <circle class="s" cx="24" cy="24" r="14"></circle>
                                <circle class="f" cx="19" cy="22" r="1.6"></circle>
                                <circle class="f" cx="29" cy="22" r="1.6"></circle>
                                <path class="s" d="M18 29c2.2 2.6 9.8 2.6 12 0"></path>
                            </svg>
                        </span>
                        <span class="rate-label">Bueno</span>
                    </label>

                    <label class="rate-item" data-rate="4">
                        <input type="radio" name="rate_view" value="4" disabled />
                        <span class="rate-icon" aria-hidden="true">
                            <svg viewBox="0 0 48 48" class="rate-svg">
                                <circle class="s" cx="24" cy="24" r="14"></circle>
                                <circle class="f" cx="19" cy="22" r="1.6"></circle>
                                <circle class="f" cx="29" cy="22" r="1.6"></circle>
                                <path class="f" d="M18 29.2 H30 Q30 32.6 24 32.6 Q18 32.6 18 29.2 Z"></path>
                            </svg>
                        </span>
                        <span class="rate-label">Excelente</span>
                    </label>

                </div>

                <label class="retro-label" for="retro-comentario">Comentario sobre el requerimiento</label>
                <textarea id="retro-comentario" class="retro-input retro-textarea" rows="4" readonly></textarea>

                <div class="retro-actions">
                    <button id="retro-close-footer" class="retro-btn retro-btn--ghost" type="button">Cerrar</button>
                    <button id="retro-go" class="retro-btn" type="button">Ir al requerimiento</button>
                </div>
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

    <script src="/JS/components.js"></script>
    <script src="/JS/JSglobal.js"></script>

    <script type="module" src="/JS/retroCiudadanaDashboard.js"></script>

    <script type="module" src="/JS/ui/sidebar.js"></script>
    <script type="module" src="/JS/ui/avatar-edit.js"></script>


</body>

</html>
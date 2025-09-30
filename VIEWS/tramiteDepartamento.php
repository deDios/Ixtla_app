<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ixtla App</title>
    <link rel="stylesheet" href="/CSS/components.css">
    <link rel="stylesheet" href="/CSS/plantilla.css">
    <link rel="stylesheet" href="/CSS/tramiteDepartamento.css">
    <link rel="icon" href="/favicon.ico">

    <!-- 🔐 reCAPTCHA Enterprise (usa tu SITE KEY) -->
    <script src="https://www.google.com/recaptcha/enterprise.js?render=TU_SITE_KEY"></script>
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
                <a href="/VIEWS/tramiteDepartamento.php" class="active">Trámites y Seguimiento</a>
            </div>


            <div class="social-icons">
                <div class="circle-icon"><img src="/ASSETS/social_icons/Facebook_logo.png" alt="Facebook" /></div>
                <div class="circle-icon"><img src="/ASSETS/social_icons/Instagram_logo.png" alt="Instagram" /></div>
                <div class="circle-icon"><img src="/ASSETS/social_icons/Youtube_logo.png" alt="YouTube" /></div>
                <div class="circle-icon"><img src="/ASSETS/social_icons/X_logo.png" alt="X" /></div>
            </div>
        </nav>
    </header>

    <main>



        <!-------------------------- Seccion 1  --------------------------->
        <section id="tramites-busqueda" class="ix-section ix-tramites" aria-labelledby="tramites-busqueda-title">
            <div class="ix-wrap">
                <h2 id="tramites-busqueda-title" class="ix-title">N° del trámite</h2>

                <!-- Formulario -->
                <form id="form-tramite" class="ix-form" autocomplete="off" novalidate>
                    <div class="ix-input-row">
                        <div class="ix-input-underline">
                            <input id="folio" name="folio" type="text" placeholder="REQ-0000000000"
                                aria-describedby="folioHelp" maxlength="20" required />
                            <div class="ix-underline"></div>
                        </div>
                        <button class="ix-btn" id="btn-buscar" type="submit" aria-live="polite">Buscar</button>
                    </div>
                    <small id="folioHelp" class="ix-help sr-only">
                        Ingresa el ID del trámite (ej. REQ-0000000005).
                    </small>
                </form>

                <!-- Contenedor (reusa tu .ix-result) -->
                <div class="ix-result" role="region" aria-live="polite" aria-label="Seguimiento del trámite">

                    <!-- EMPTY -->
                    <div id="ix-track-empty" class="ix-state is-visible" role="status">
                        <p>Una vez ingresado el ID del trámite, el estado del reporte se mostrará en esta sección, de
                            acuerdo con la etapa del proceso en la que se encuentre.</p>
                        <p>Si no recuerdas tu ID comunícate al <a href="tel:33 1297 7799">33 1297 7799</a>
                            o escribe a <a href="mailto:aciudadana98@gmail.com">aciudadana98@gmail.com</a>.</p>
                    </div>

                    <!-- LOADING -->
                    <div id="ix-track-loading" class="ix-state" role="status" aria-busy="true">
                        <div class="ix-loading">
                            <span class="ix-spinner" aria-hidden="true"></span>
                            <span>Buscando información del trámite…</span>
                        </div>
                    </div>

                    <!-- ERROR -->
                    <div id="ix-track-error" class="ix-state" role="alert">
                        <p><strong>No se encontró el trámite.</strong></p>
                        <p>Verifica el número e inténtalo nuevamente.</p>
                        <button class="ix-btn ghost" type="button" id="ix-reintentar">Reintentar</button>
                    </div>

                    <!-- RESULT -->
                    <article id="ix-track-result" class="ix-state" hidden data-folio="" data-updated-at="">
                        <!-- Encabezado -->
                        <div class="ix-ticket-head">
                            <div class="ix-ticket-left">
                                <p><strong>ID:</strong> <span id="ix-meta-folio" class="mono">REQ-0000000005</span></p>
                                <p><strong>Requerimiento:</strong> <span id="ix-meta-req">—</span></p>
                                <p><strong>Dirección:</strong> <span id="ix-meta-dir">—</span></p>
                                <p><strong>Solicitante:</strong> <span id="ix-meta-sol">—</span></p>
                                <p><strong>Descripción:</strong> <span id="ix-meta-desc">—</span></p>
                            </div>
                            <div class="ix-ticket-right">
                                <p><strong>Fecha de solicitado:</strong></p>
                                <p><span id="ix-meta-date">—</span><br><span id="ix-meta-time" class="mono">—</span></p>
                            </div>
                        </div>

                        <div class="ix-stepper" aria-label="Etapas del trámite">
                            <ul class="ix-steps" role="list">
                                <!-- 1: Solicitud -->
                                <li class="ix-step pending" role="listitem" data-step="1">
                                    <button class="ix-stepbtn" type="button" aria-expanded="false"
                                        aria-controls="ix-pop-1">
                                        <span class="ix-step-dot" aria-hidden="true"></span>
                                        <span class="ix-step-label">Solicitud</span>
                                    </button>
                                    <div id="ix-pop-1" class="ix-pop" role="tooltip" hidden>
                                        Tu trámite fue enviado y está registrado en el sistema.
                                        <button class="ix-pop-close" type="button" aria-label="Cerrar">×</button>
                                    </div>
                                </li>

                                <!-- 2: Revision -->
                                <li class="ix-step pending" role="listitem" data-step="2">
                                    <button class="ix-stepbtn" type="button" aria-expanded="false"
                                        aria-controls="ix-pop-2">
                                        <span class="ix-step-dot" aria-hidden="true"></span>
                                        <span class="ix-step-label">Revisión</span>
                                    </button>
                                    <div id="ix-pop-2" class="ix-pop" role="tooltip" hidden>
                                        Se revisa la información y evidencias proporcionadas.
                                        <button class="ix-pop-close" type="button" aria-label="Cerrar">×</button>
                                    </div>
                                </li>

                                <!-- 3: Asignacion -->
                                <li class="ix-step pending" role="listitem" data-step="3">
                                    <button class="ix-stepbtn" type="button" aria-expanded="false"
                                        aria-controls="ix-pop-3">
                                        <span class="ix-step-dot" aria-hidden="true"></span>
                                        <span class="ix-step-label">Asignación</span>
                                    </button>
                                    <div id="ix-pop-3" class="ix-pop" role="tooltip" hidden>
                                        Se asigna el caso al área o personal responsable.
                                        <button class="ix-pop-close" type="button" aria-label="Cerrar">×</button>
                                    </div>
                                </li>

                                <!-- 4: En proceso -->
                                <li class="ix-step pending" role="listitem" data-step="4">
                                    <button class="ix-stepbtn" type="button" aria-expanded="false"
                                        aria-controls="ix-pop-4">
                                        <span class="ix-step-dot" aria-hidden="true"></span>
                                        <span class="ix-step-label">
                                            En proceso
                                        </span>
                                    </button>
                                    <div id="ix-pop-4" class="ix-pop" role="tooltip" hidden>
                                        El equipo trabaja en la atención del requerimiento.
                                        <button class="ix-pop-close" type="button" aria-label="Cerrar">×</button>
                                    </div>
                                </li>

                                <!-- 5: Finalizado -->
                                <li class="ix-step pending" role="listitem" data-step="5">
                                    <button class="ix-stepbtn" type="button" aria-expanded="false"
                                        aria-controls="ix-pop-5">
                                        <span class="ix-step-dot" aria-hidden="true"></span>
                                        <span class="ix-step-label">Finalizado</span>
                                    </button>
                                    <div id="ix-pop-5" class="ix-pop" role="tooltip" hidden>
                                        El requerimiento fue resuelto y el trámite ha concluido.
                                        <button class="ix-pop-close" type="button" aria-label="Cerrar">×</button>
                                    </div>
                                </li>
                            </ul>
                        </div>

                        <div id="ix-step-desc" class="ix-stepdesc" aria-live="polite">
                            <p class="ix-stepdesc-text">—</p>
                        </div>
                    </article>
                </div>
            </div>
        </section>









        <!-- seccion 2 -->
        <section id="tramites" class="ix-section ix-deps" aria-labelledby="deps-title">
            <div class="ix-wrap">
                <h2 id="deps-title">Selecciona un Departamento</h2>

                <div class="ix-grid">
                    <!-- 1
                    <a class="ix-tile" href="/VIEWS/tramiteDepartamento.php?dep=samapa"
                        aria-label="SAMAPA - Solicitud de atención a fugas y servicio de agua">
                        <div class="ix-logo"><img src="/ASSETS/departamentos/samapa_icon.png" alt="SAMAPA"></div>
                        <h3>Solicitud de atención a fugas y servicio de agua</h3>
                        <p>Formulario para reportar fugas, baja presión o problemas de suministro, con folio de
                            seguimiento.</p>
                    </a>

                     2
                    <a class="ix-tile" href="/VIEWS/tramiteDepartamento.php?dep=limpieza"
                        aria-label="Servicios de recolección y limpieza">
                        <div class="ix-logo"><img src="/ASSETS/departamentos/aseoPublico_icon.png"
                                alt="Ayuntamiento Ixtlahuacán"></div>
                        <h3>Servicios de recolección y limpieza</h3>
                        <p>Reportes de residuos, limpieza de espacios públicos y mantenimiento general para un entorno
                            ordenado.</p>
                    </a>

                     3
                    <a class="ix-tile" href="/VIEWS/tramiteDepartamento.php?dep=obras"
                        aria-label="Dirección de obras y servicios públicos">
                        <div class="ix-logo"><img src="/ASSETS/departamentos/obrasPublicas_icon.png"
                                alt="Infraestructura y Obra Pública"></div>
                        <h3>Dirección de obras y servicios públicos</h3>
                        <p>Planeación y mantenimiento de la infraestructura urbana y coordinación de servicios públicos.
                        </p>
                    </a>

                     4
                    <a class="ix-tile" href="/VIEWS/tramiteDepartamento.php?dep=alumbrado"
                        aria-label="Gestión de alumbrado y energía urbana">
                        <div class="ix-logo"><img src="/ASSETS/departamentos/alumbrado_icon.png" alt="CFE"></div>
                        <h3>Gestión de alumbrado y energía urbana</h3>
                        <p>Revisión de luminarias y administración de energía en espacios urbanos para mayor seguridad.
                        </p>
                    </a>


                    <a class="ix-tile" href="/VIEWS/tramiteDepartamento.php?dep=ambiental"
                        aria-label="Gestión ambiental y ecología urbana">
                        <div class="ix-logo"><img src="/ASSETS/departamentos/ecologia_icon.png"
                                alt="Gestión Ambiental">
                        </div>
                        <h3>Gestión ambiental y ecología urbana</h3>
                        <p>Conservación del medio ambiente, áreas verdes y reducción de la contaminación.</p>
                    </a>
                     5 -->

                </div>

                <p class="ix-note">
                    La información es de carácter informativo. Los tiempos y requisitos pueden variar según el trámite o
                    departamento. Para mayor certeza, comunícate con el área indicada o consulta los medios oficiales.
                </p>
            </div>
        </section>

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
                    <h2 id="ix-report-title" class="ix-modal__title">Nuevo Reporte</h2>
                    <p id="ix-report-subtitle" class="ix-modal__subtitle">Fuga de agua</p>
                    <p id="ix-report-desc" class="sr-only">
                        Completa los campos para levantar un reporte.
                    </p>
                </div>

                <button type="button" class="ix-modal__close" aria-label="Cerrar" data-ix-close>×</button>
            </header>

            <div class="ix-modal__body">
                <form id="ix-report-form" class="ix-form" novalidate>
                    <input type="hidden" id="ix-departamento-id" name="departamento_id" value="1">
                    <input type="hidden" name="req_title" id="ix-report-req" value="Fuga de agua">
                    <input type="hidden" name="tramite_id" id="ix-tramite-id" value="">

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
                                    <span id="ix-desc-count">0</span>/700
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

                    <!-- consentimiento -->
                    <div class="ix-form__row ix-form__row--consent">
                        <label class="ix-checkbox">
                            <input type="checkbox" id="ix-consent" name="consent" required>
                            <span>
                                Acepto el aviso de privacidad y el uso de mis datos para gestionar este reporte.
                            </span>
                        </label>
                    </div>

                    <!-- feedback -->
                    <div class="ix-form__feedback" id="ix-report-feedback" role="status" aria-live="polite" hidden>
                    </div>

                    <!-- footer -->
                    <div class="ix-form__footer">
                        <button type="button" class="ix-btn ix-btn--ghost" data-ix-close>Cancelar</button>
                        <button type="submit" class="ix-btn ix-btn--primary" id="ix-submit">Mandar reporte</button>
                    </div>
                </form>
            </div>
        </div>
    </div>



    <!-- modal informativo del requerimiento -->
    <div id="ix-done-modal" class="ix-modal ix-modal--done" hidden aria-hidden="true">
        <div class="ix-modal__overlay" data-close></div>

        <div class="ix-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="ix-done-title">
            <header class="ix-modal__header">
                <div class="ix-modal__brand">
                    <img src="/ASSETS/main_logo.png" alt="Ixtlahuacán de los Membrillos - Ayuntamiento"
                        onerror="this.style.display='none'">
                </div>

                <div class="ix-modal__headings">
                    <h2 id="ix-done-title" class="ix-modal__title">Nuevo Reporte</h2>
                    <p class="ix-modal__subtitle"><span id="ix-done-subtitle">—</span></p>
                </div>

                <button type="button" class="ix-modal__close" aria-label="Cerrar" data-close>×</button>
            </header>

            <div class="ix-modal__body">
                <div class="ix-done-copy">
                    <p>Gracias por contribuir a mejorar la zona. Pronto se dará seguimiento.</p>

                    <p class="ix-done-mid">
                        Lo atenderemos lo más rápido posible.<br>
                        El N° de tu reporte es: <strong id="ix-done-folio">—</strong>.<br>
                        Recuerda guardar este número para darle seguimiento.
                    </p>

                    <p>Para cualquier otra duda comunícate al <a href="tel:33 1297 7799">33 1297 7799</a>
                        o envía un correo a <a href="mailto:aciudadana98@gmail.com">aciudadana98@gmail.com</a>.
                    </p>
                </div>
            </div>

            <footer class="ix-modal__footer">
                <button type="button" class="ix-btn ix-btn--primary" id="ix-done-ok" data-close>Finalizar</button>
            </footer>
        </div>
    </div>





    <script src="/JS/serviceSeguimientoTramites.js"></script>
    <script src="/JS/components.js"></script>
    <script src="/JS/tramiteDepartamentos.js"></script>
    <script src="/JS/JSglobal.js"></script>

</body>

</html>
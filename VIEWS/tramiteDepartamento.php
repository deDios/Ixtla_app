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
                <button class="btn btn-contacto" type="button">Contacto</button>
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
                <h2 id="tramites-busqueda-title" class="sr-only">Búsqueda de trámite</h2>

                <form id="form-tramite" class="ix-form" autocomplete="off" novalidate>
                    <label for="folio" class="ix-label">N° del trámite</label>

                    <div class="ix-input-row">
                        <div class="ix-input-underline">
                            <input id="folio" name="folio" type="text" placeholder="ID00001"
                                aria-describedby="folioHelp" maxlength="20" required />
                        </div>

                        <button class="ix-btn" type="submit">Buscar</button>
                    </div>

                    <small id="folioHelp" class="ix-help sr-only">Formato sugerido: ID seguido de dígitos, ej.
                        ID00001.</small>
                </form>

                <!-- Panel de texto/instrucciones -->
                <div class="ix-result" role="status" aria-live="polite">
                    <p>Una vez cargado el ID del trámite se verá reflejado en esta parte de la siguiente forma
                        dependiendo del paso en el que se encuentre el reporte.</p>
                    <p>Si no recuerdas tu ID comunícate al: <a href="tel:3333333333">33 3333 3333</a> o al correo:
                        <a href="mailto:recuperarId@gmail.com">recuperarId@gmail.com</a>
                    </p>
                </div>
            </div>
        </section>


        <!-- seccion 2 -->
        <section id="tramites" class="ix-section ix-deps" aria-labelledby="deps-title">
            <div class="ix-wrap">
                <h2 id="deps-title">Selecciona un Departamento</h2>

                <div class="ix-grid">
                    <!-- 1 -->
                    <a class="ix-tile" href="/VIEWS/tramiteDepartamento.php?dep=samapa"
                        aria-label="SAMAPA - Solicitud de atención a fugas y servicio de agua">
                        <div class="ix-logo"><img src="/ASSETS/departamentos/samapa_icon.png" alt="SAMAPA"></div>
                        <h3>Solicitud de atención a fugas y servicio de agua</h3>
                        <p>Formulario para reportar fugas, baja presión o problemas de suministro, con folio de
                            seguimiento.</p>
                    </a>

                    <!-- 2 -->
                    <a class="ix-tile" href="/VIEWS/tramiteDepartamento.php?dep=limpieza"
                        aria-label="Servicios de recolección y limpieza">
                        <div class="ix-logo"><img src="/ASSETS/departamentos/recoleccionLimpieza_icon.png"
                                alt="Ayuntamiento Ixtlahuacán"></div>
                        <h3>Servicios de recolección y limpieza</h3>
                        <p>Reportes de residuos, limpieza de espacios públicos y mantenimiento general para un entorno
                            ordenado.</p>
                    </a>

                    <!-- 3 -->
                    <a class="ix-tile" href="/VIEWS/tramiteDepartamento.php?dep=obras"
                        aria-label="Dirección de obras y servicios públicos">
                        <div class="ix-logo"><img src="/ASSETS/departamentos/obraPublica_icon.png"
                                alt="Infraestructura y Obra Pública"></div>
                        <h3>Dirección de obras y servicios públicos</h3>
                        <p>Planeación y mantenimiento de la infraestructura urbana y coordinación de servicios públicos.
                        </p>
                    </a>

                    <!-- 4 -->
                    <a class="ix-tile" href="/VIEWS/tramiteDepartamento.php?dep=alumbrado"
                        aria-label="Gestión de alumbrado y energía urbana">
                        <div class="ix-logo"><img src="/ASSETS/departamentos/cfe_icon.png" alt="CFE"></div>
                        <h3>Gestión de alumbrado y energía urbana</h3>
                        <p>Revisión de luminarias y administración de energía en espacios urbanos para mayor seguridad.
                        </p>
                    </a>

                    <!-- 5 -->
                    <a class="ix-tile" href="/VIEWS/tramiteDepartamento.php?dep=ambiental"
                        aria-label="Gestión ambiental y ecología urbana">
                        <div class="ix-logo"><img src="/ASSETS/departamentos/gestionAmbiental_icon.png"
                                alt="Gestión Ambiental">
                        </div>
                        <h3>Gestión ambiental y ecología urbana</h3>
                        <p>Conservación del medio ambiente, áreas verdes y reducción de la contaminación.</p>
                    </a>
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

    <script src="/JS/components.js"></script>
    <script src="/JS/tramiteDepartamentos.js"></script>
    <script src="/JS/JSglobal.js"></script>


    <!-- ESPACIO PARA MODALES -->
    <div id="ix-report-modal" class="ix-modal" hidden aria-hidden="true">
        <div class="ix-modal__overlay" data-ix-close></div>

        <div class="ix-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="ix-report-title"
            aria-describedby="ix-report-desc">

            <!-- header -->
            <header class="ix-modal__header">
                <div class="ix-modal__brand">
                    <img src="/ASSETS/main_logo.png" alt="Ixtlahuacán de los Membrillos - Ayuntamiento"
                        onerror="this.style.display='none'">
                </div>

                <div class="ix-modal__headings">
                    <h2 id="ix-report-title" class="ix-modal__title">Nuevo Reporte</h2>
                    <p id="ix-report-subtitle" class="ix-modal__subtitle">Fuga de agua</p>
                    <p id="ix-report-desc" class="sr-only">Completa los campos para levantar un reporte a SAMAPA.</p>
                </div>

                <div class="ix-modal__meta">
                    <strong class="ix-meta__label">Fecha</strong>
                    <time id="ix-report-date" class="ix-meta__value" datetime="">
                        02 de septiembre 2025<br><span class="mono">12:34 am</span>
                    </time>
                </div>

                <button type="button" class="ix-modal__close" aria-label="Cerrar" data-ix-close>×</button>
            </header>

            <!-- body / form -->
            <div class="ix-modal__body">
                <form id="ix-report-form" class="ix-form" novalidate>
                    <!-- contexto -->
                    <input type="hidden" name="departamento_id" value="1">
                    <input type="hidden" name="req_title" id="ix-report-req" value="Fuga de agua">

                    <!-- nombre / fecha -->
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
                                    value="02 de septiembre 2025 · 12:34 am">
                            </div>
                        </div>
                    </div>

                    <!-- domicilio / CP -->
                    <div class="ix-form__row">
                        <div class="ix-field">
                            <label for="ix-domicilio" class="ix-field__label">Domicilio</label>
                            <div class="ix-field__control">
                                <input id="ix-domicilio" name="domicilio" type="text"
                                    placeholder="Francisco I. Madero #2" required>
                            </div>
                            <small class="ix-help" id="ix-err-domicilio" hidden></small>
                        </div>

                        <div class="ix-field ix-field--sm">
                            <label for="ix-cp" class="ix-field__label">C.P.</label>
                            <div class="ix-field__control">
                                <input id="ix-cp" name="cp" type="text" inputmode="numeric" pattern="\d{5}"
                                    maxlength="5" placeholder="45850" required>
                            </div>
                            <small class="ix-help" id="ix-err-cp" hidden></small>
                        </div>
                    </div>

                    <!-- colonia / telefono -->
                    <div class="ix-form__row">
                        <div class="ix-field">
                            <label for="ix-colonia" class="ix-field__label">Colonia</label>
                            <div class="ix-field__control">
                                <input id="ix-colonia" name="colonia" type="text" placeholder="Centro" required>
                            </div>
                            <small class="ix-help" id="ix-err-colonia" hidden></small>
                        </div>

                        <div class="ix-field">
                            <label for="ix-telefono" class="ix-field__label">Teléfono</label>
                            <div class="ix-field__control">
                                <input id="ix-telefono" name="telefono" type="tel" inputmode="numeric" pattern="\d{10}"
                                    maxlength="10" placeholder="33 3333 3333" required>
                            </div>
                            <small class="ix-help" id="ix-err-telefono" hidden></small>
                        </div>
                    </div>

                    <!-- correo -->
                    <div class="ix-form__row">
                        <div class="ix-field">
                            <label for="ix-correo" class="ix-field__label">Correo electrónico</label>
                            <div class="ix-field__control">
                                <input id="ix-correo" name="correo" type="email" placeholder="correo@ejemplo.com">
                            </div>
                            <small class="ix-help" id="ix-err-correo" hidden></small>
                        </div>
                    </div>

                    <!-- descripcion -->
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

                    <!-- evidencia -->
                    <div class="ix-form__row">
                        <div class="ix-field ix-field--full">
                            <label class="ix-field__label" for="ix-evidencia">Evidencia</label>
                            <div class="ix-upload" data-js="upload">
                                <input id="ix-evidencia" class="ix-upload__input" name="evidencia[]" type="file"
                                    accept="image/jpeg,image/png" multiple>
                                <div class="ix-upload__hint">Arrastra imágenes o haz click para seleccionar (JPG/PNG ·
                                    máx 5 MB c/u · hasta 3)</div>
                                <div class="ix-gallery" id="ix-evidencia-previews" aria-live="polite"></div>
                            </div>
                            <small class="ix-help" id="ix-err-evidencia" hidden></small>
                        </div>
                    </div>

                    <div class="ix-form__row ix-form__row--consent">
                        <label class="ix-checkbox">
                            <input type="checkbox" id="ix-consent" name="consent" required>
                            <span>Acepto el aviso de privacidad y el uso de mis datos para gestionar este
                                reporte.</span>
                        </label>
                    </div>

                    <div class="ix-form__feedback" id="ix-report-feedback" role="status" aria-live="polite" hidden>
                    </div>

                    <div class="ix-form__footer">
                        <button type="button" class="ix-btn ix-btn--ghost" data-ix-close>Cancelar</button>
                        <button type="submit" class="ix-btn ix-btn--primary" id="ix-submit" disabled>Mandar
                            reporte</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

</body>

</html>
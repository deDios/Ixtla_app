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
                <div class="icon-mobile"><img src="/ASSETS/social_icons/Facebook_logo.png" alt="Facebook" /></div>
                <div class="icon-mobile"><img src="/ASSETS/social_icons/Instagram_logo.png" alt="Instagram" /></div>
                <div class="icon-mobile"><img src="/ASSETS/social_icons/Youtube_logo.png" alt="YouTube" /></div>
                <div class="icon-mobile"><img src="/ASSETS/social_icons/X_logo.png" alt="X" /></div>
                <!-- El JSglobal reemplaza este avatar cuando hay sesión -->
                <div class="user-icon-mobile"><img src="ASSETS/usuario/usuarioImg/img_user1.png" alt="Usuario" /></div>
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
</body>

</html>
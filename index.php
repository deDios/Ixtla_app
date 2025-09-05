<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ixtla App</title>
    <link rel="stylesheet" href="/CSS/components.css">
    <link rel="stylesheet" href="CSS/index.css">
    <link rel="stylesheet" href="/CSS/plantilla.css">
    <link rel="icon" href="/favicon.ico">
</head>

<body>
    <!-- Tope de pagina -->
    <header id="header" data-link-home="/index.php">
        <!-- Barra social móvil (solo visible en pantallas pequeñas) -->
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


        <!-- Top bar: logo a la izquierda, acciones (Contacto + Hamburguesa) a la derecha -->
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
                <a href="index.php" class="active">Inicio</a>
                <a href="index.php">Trámites y Seguimiento</a>
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
        <!-- carrusel -->
        <div class="ix-carousel" aria-label="Avisos del Ayuntamiento" data-loop="true" data-autoplay="0">
            <div class="ix-viewport">
                <div class="ix-track">
                    <!-- Slide 1 -->
                    <article class="ix-slide" aria-roledescription="slide">
                        <div class="ix-card">
                            <figure class="ix-media">
                                <img src="/ASSETS/index/carrusel_index_img1.png" alt="Equipo junto al Pozo 3 La Mora">
                            </figure>
                            <div class="ix-content">
                                <p>
                                    <strong>¡Buenas noticias!</strong><br>
                                    para Capilla del Refugio y Residencial La Capilla.<br><br>
                                    Entregamos un nuevo pozo de agua que beneficiará a más de 6,000 habitantes,
                                    abatiendo el rezago en el suministro del vital líquido.<br><br>
                                    Seguimos trabajando con compromiso para llevar bienestar y
                                    servicios dignos a todas las comunidades de Ixtlahuacán de los Membrillos.
                                </p>
                            </div>
                        </div>
                    </article>

                    <!-- Slide 2 -->
                    <article class="ix-slide" aria-roledescription="slide">
                        <div class="ix-card">
                            <figure class="ix-media">
                                <img src="/ASSETS/index/carrusel_index_img2.png" alt="Equipo junto al Pozo 3 La Mora">
                            </figure>
                            <div class="ix-content">
                                <p>
                                    <strong>Seguimos trabajando por tu seguridad</strong><br><br>
                                    Estamos rehabilitando con asfalto las principales vialidades en la zona de la
                                    carretera estatal a La Capilla del Refugio, así como en las colonias Valle de los
                                    Olivos, Sabinos y Girasoles.
                                </p>
                            </div>
                        </div>
                    </article>
                </div>
            </div>

            <!-- controles -->
            <div class="ix-controls">
                <button class="ix-nav ix-prev" type="button" aria-label="Anterior">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M14.5 4.5L7.5 12l7 7.5" fill="none" stroke="currentColor" stroke-width="2"
                            stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </button>

                <div class="ix-indicator" aria-live="polite" aria-atomic="true">
                    <span class="ix-current">1</span>
                    <span class="ix-sep">/</span>
                    <span class="ix-total">2</span>
                </div>

                <button class="ix-nav ix-next" type="button" aria-label="Siguiente">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9.5 4.5L16.5 12l-7 7.5" fill="none" stroke="currentColor" stroke-width="2"
                            stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </button>
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

    <script src="/JS/components.js"></script>
    <script src="JS/JSglobal.js"></script>
</body>

</html>
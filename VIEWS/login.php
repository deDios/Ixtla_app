<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ixtla App</title>
    <link rel="stylesheet" href="/CSS/plantilla.css">
    <link rel="stylesheet" href="/CSS/login.css">
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

    <main>
        <!-------------------------- Seccion 1, login  --------------------------->
        <section id="auth-login" aria-labelledby="auth-title">
            <div class="auth-wrap">
                <div class="auth-grid">

                    <!-- imagen -->
                    <div class="auth-photos">
                        <img src="/ASSETS/portadaLogin.png" alt="Ixtlahuacán de los Membrillos">
                    </div>

                    <!-- formulario -->
                    <div class="auth-panel">
                        <h2 id="auth-title">
                            <span>Atención ciudadana</span><br>
                            <strong>Ixtlahuacan de los membrillos</strong>
                        </h2>

                        <form class="auth-form" action="#" method="post" novalidate>
                            <label class="field">
                                <input type="text" name="usuario" autocomplete="username"
                                    placeholder="Teléfono o correo electrónico">
                            </label>

                            <label class="field">
                                <input type="password" name="password" autocomplete="current-password"
                                    placeholder="Contraseña">
                            </label>

                            <button type="submit" class="btn-login">Iniciar sesión</button>

                            <div class="auth-divider" role="separator" aria-label="o">
                                <span class="line"></span><span class="dot"></span><span class="line"></span>
                            </div>
                            <!-- <a href="/VIEWS/recover.php" class="forgot-link">¿Olvidaste tu contraseña?</a>  -->
                        </form>
                    </div>
                </div>

                <nav class="auth-mini-nav" aria-label="Enlaces informativos">
                    <a href="https://maps.app.goo.gl/LZD6t8JeazxKa5wn9">Ubicación</a>
                    <a href="https://www.instagram.com/imembrillosgob/">Galería</a>
                    <!-- <a href="#">Información</a> -->
                </nav>
                <p class="auth-copy">©2025 Municipio Ixtlahuacan de los membrillos</p>
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




    <script src="/JS/JSglobal.js"></script>
    <script type="module" src="/JS/auth/session.js"></script>
    <script type="module" src="/JS/login.js"></script>

</body>

</html>
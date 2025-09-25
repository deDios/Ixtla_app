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
                <button href="/VIEWS/contacto.php" class="btn btn-contacto" type="button">Contacto</button>
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
        <!-------------------------- Seccion 1, login  --------------------------->
        <section id="login" aria-labelledby="login-title">
            <div class="login-wrap">
                <div class="login-card" role="region" aria-label="Formulario de contacto y acceso">

                    <!-- Columna izquierda: Formulario -->
                    <div class="login-form">
                        <h1 id="login-title" class="visually-hidden">Acceso y contacto</h1>

                        <form class="form" action="#" method="post" novalidate>
                            <div class="grid-2">
                                <label class="field">
                                    <span>Nombre</span>
                                    <input type="text" name="nombre" placeholder="Juan Pablo" autocomplete="given-name">
                                </label>

                                <label class="field">
                                    <span>Apellidos</span>
                                    <input type="text" name="apellidos" placeholder="Garcia Casillas"
                                        autocomplete="family-name">
                                </label>
                            </div>

                            <div class="grid-2">
                                <label class="field">
                                    <span>Email</span>
                                    <input type="email" name="email" placeholder="Mani06@gmail.com" inputmode="email"
                                        autocomplete="email">
                                </label>

                                <label class="field">
                                    <span>Número telefónico</span>
                                    <input type="tel" name="telefono" placeholder="+52 33 1381 2235" inputmode="tel"
                                        autocomplete="tel">
                                </label>
                            </div>

                            <label class="field">
                                <span>¿Cómo podemos ayudarte?</span>
                                <textarea name="mensaje" rows="4" placeholder="Hola, me gustaría saber...."></textarea>
                            </label>

                            <button type="submit" class="btn-enviar">Enviar</button>
                        </form>
                    </div>

                    <!-- Columna derecha: Panel de contacto -->
                    <aside class="contact-panel" aria-label="Contacta con nosotros">
                        <div class="contact-inner">
                            <h2>Contacta con nosotros</h2>
                            <ul class="contact-list">
                                <li>
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <path
                                            d="M20 4H4a2 2 0 0 0-2 2v.4l10 6 10-6V6a2 2 0 0 0-2-2Zm0 4.3-8.6 5.2a1 1 0 0 1-1 0L2 8.3V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8.3Z" />
                                    </svg>
                                    <a href="mailto:atencionciudadana@gmail.gob.mx">atencionciudadana@gmail.gob.mx</a>
                                </li>
                                <li>
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <path
                                            d="M6.6 10.2a15.5 15.5 0 0 0 7.2 7.2l2.4-2.4a1 1 0 0 1 1-.25 11.7 11.7 0 0 0 3.7.6 1 1 0 0 1 1 1V20a2 2 0 0 1-2 2A18 18 0 0 1 2 6a2 2 0 0 1 2-2h3.6a1 1 0 0 1 1 1 11.7 11.7 0 0 0 .6 3.7 1 1 0 0 1-.25 1Z" />
                                    </svg>
                                    7676-2001
                                </li>
                                <li>
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <path
                                            d="M16.5 3h-9A4.5 4.5 0 0 0 3 7.5v9A4.5 4.5 0 0 0 7.5 21h9a4.5 4.5 0 0 0 4.5-4.5v-9A4.5 4.5 0 0 0 16.5 3ZM12 17.3a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-4.8h-2a1 1 0 0 1-1-1V7.5a1 1 0 1 1 2 0v3h1a1 1 0 1 1 0 2Z" />
                                    </svg>
                                    +52 33 3333 3333
                                </li>
                                <li class="address">
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <path
                                            d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
                                    </svg>
                                    Jardín, Ixtlahuacán de Los Membrillos Centro, 2 Jardín, 45850 Ixtlahuacán de los
                                    Membrillos, Jal.
                                </li>
                            </ul>
                        </div>
                        <div class="panel-accent" aria-hidden="true"></div>
                    </aside>

                </div>

                <!-- Nota inferior -->
                <p class="login-note">
                    Estamos para servirte Para cualquier duda, reporte o trámite, comunícate con nosotros a través de
                    los medios oficiales.
                    Tu participación es importante para mejorar nuestra comunidad.
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




    <script src="/JS/JSglobal.js"></script>

</body>

</html>
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

                    <!-- Columna izquierda: formulario simple para login -->
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

                    <!-- Columna derecha: el recuadro verde -->
                    <aside class="contact-panel" aria-label="Contacta con nosotros">
                        <div class="contact-inner">
                            <h2>Contacta con nosotros</h2>
                            <ul class="contact-list">
                                 <!-- icono de correo -->
                                <li>
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <rect x="3" y="4.5" width="18" height="15" rx="2.5" class="fill-white" />
                                        <path d="M4 7l8 5 8-5" class="fill-none" />
                                    </svg>
                                    <a href="mailto:atencionciudadana@gmail.gob.mx">atencionciudadana@gmail.gob.mx</a>
                                </li>
                                 <!-- icono de telefono fijo -->
                                <li>
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <path class="fill-none"
                                            d="M6.6 10.2a15.5 15.5 0 0 0 7.2 7.2l2.4-2.4a1.4 1.4 0 0 1 1.4-.35c1.3.4 2.6.6 4 .6a1.4 1.4 0 0 1 1.4 1.4V20a2.5 2.5 0 0 1-2.5 2.5A18.5 18.5 0 0 1 1.5 7.5 2.5 2.5 0 0 1 4 5h3.4a1.4 1.4 0 0 1 1.4 1.1c.2 1.4.5 2.7.9 4a1.4 1.4 0 0 1-.35 1.4L6.6 10.2Z" />
                                    </svg>
                                    7676-2001
                                </li>
                                 <!-- icono de whatsapp -->
                                <li>
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <path class="fill-white"
                                            d="M12 3.5a8.5 8.5 0 0 0-7.5 12.4L3 21l5.3-1.4A8.5 8.5 0 1 0 12 3.5Z" />
                                        <path class="fill-none"
                                            d="M9.2 8.8c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .5.3.2.6.7 1.5 1.1 1.8.2.2.2.4 0 .6-.1.2-.3.5-.4.6s-.2.4 0 .6c.5.6 1.2 1.1 2 1.4.2.1.4 0 .6-.2l.5-.6c.2-.2.4-.2.6 0 .4.1.9.3 1.2.4.4.2.4.9.3 1.3-.1.4-.9.9-1.4 1-1 .1-2.9-.2-4.6-1.7-1.6-1.4-2.3-3-2.6-4-.1-.6.2-1.2 .4-1.6Z" />
                                    </svg>
                                    +52 33 3333 3333
                                </li>
                                <!-- icono de ubicacion -->
                                <li class="address">
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <path class="fill-none"
                                            d="M12 2.8a6.2 6.2 0 0 0-6.2 6.2c0 4.7 6.2 11.7 6.2 11.7s6.2-7 6.2-11.7A6.2 6.2 0 0 0 12 2.8Z" />
                                        <circle cx="12" cy="9" r="2.6" class="fill-white" />
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
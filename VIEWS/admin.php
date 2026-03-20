<?php

/* require_once __DIR__ . '/../JS/auth/ix_guard.php';
ix_require_session(); */

?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ixtla App</title>
    <link rel="stylesheet" href="/CSS/plantilla.css">
    <link rel="stylesheet" href="/CSS/components.css">
    <link rel="stylesheet" href="/CSS/admin.css">
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



    <main class="home-samapa admin-dashboard">
        <div class="hs-wrap">

            <!-- SIDEBAR -->
            <aside class="hs-sidebar admin-sidebar">
                <section class="admin-panel" aria-label="Panel de Administrador">
                    <div class="admin-panel__head">Panel de Administrador</div>

                    <nav class="admin-panel__menu" aria-label="Menú de administración">
                        <a href="#" class="admin-panel__item is-active" data-admin-view="carrusel">
                            <span class="admin-panel__icon">🖼️</span>
                            <span class="admin-panel__text">Carrusel</span>
                        </a>

                        <a href="#" class="admin-panel__item" data-admin-view="departamentos">
                            <span class="admin-panel__icon">🏢</span>
                            <span class="admin-panel__text">Departamentos</span>
                        </a>

                        <a href="#" class="admin-panel__item" data-admin-view="tramites">
                            <span class="admin-panel__icon">🧾</span>
                            <span class="admin-panel__text">Tipo de trámite</span>
                        </a>
                    </nav>
                </section>
            </aside>

            <!-- MAIN -->
            <section class="hs-main">
                <div id="admin-view-root"></div>
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

    <!-- MODALES/drawers -->


    <script src="/JS/components.js"></script>
    <script src="/JS/JSglobal.js"></script>

    <script src="/JS/ui/adminCarrusel.js"></script>
    <script src="/JS/ui/adminDepartamentos.js"></script>
    <script src="/JS/ui/adminTramites.js"></script>
    <script src="/JS/ui/adminRouter.js"></script>
    <script src="/JS/admin.js"></script>
</body>

</html>
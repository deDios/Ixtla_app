<?php
require_once __DIR__ . '/../JS/auth/ix_guard.php';

ix_require_session([
    'login_url' => '/PRI/Views/login.php'
]);
?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PRI</title>
    <link rel="stylesheet" href="/PRI/CSS/plantilla.css">
    <link rel="stylesheet" href="/PRI/CSS/home.css">
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

    <main class="red-home">
        <section class="red-dashboard" aria-labelledby="red-title">

            <header class="red-panel-head">
                <div class="red-panel-logo">
                    <img src="/PRI/ASSETS/pri.png" alt="PRI">
                </div>

                <div class="red-panel-titlebox">
                    <p class="red-panel-kicker">Panel principal RED</p>

                    <h1 id="red-title" class="red-title">
                        <span id="red-user-name">Coordinador General 01</span>
                    </h1>
                </div>
            </header>

            <section class="red-metrics" aria-label="Resumen de registros">
                <article class="red-metric-card">
                    <span>Afiliados</span>
                    <strong id="metric-afiliados">0</strong>
                </article>

                <article class="red-metric-card">
                    <span>Simpatizantes</span>
                    <strong id="metric-simpatizantes">0</strong>
                </article>

                <article class="red-metric-card">
                    <span>Promotores</span>
                    <strong id="metric-promotores">0</strong>
                </article>
            </section>

            <section class="red-toolbar" aria-label="Herramientas de búsqueda y acciones">
                <div class="red-search" role="search">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="currentColor"
                            d="M10 4a6 6 0 0 1 4.47 9.93l4.3 4.3l-1.42 1.41l-4.29-4.29A6 6 0 1 1 10 4m0 2a4 4 0 1 0 0 8a4 4 0 0 0 0-8" />
                    </svg>

                    <input
                        id="red-search"
                        type="search"
                        placeholder="Buscar"
                        autocomplete="off"
                        aria-label="Buscar registros RED">
                </div>

                <div class="red-actions">
                    <button type="button" id="red-btn-export" class="red-btn red-btn-export">
                        Exportar
                    </button>

                    <button type="button" id="red-btn-add" class="red-btn-add" aria-label="Agregar registro">
                        +
                    </button>
                </div>
            </section>

            <section class="red-table-card" aria-label="Listado RED">
                <div class="red-table-wrap">
                    <table class="red-table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Domicilio</th>
                                <th>Sección</th>
                                <th>Teléfono</th>
                                <th>Validez</th>
                                <th>Inter</th>
                            </tr>
                        </thead>

                        <tbody id="red-table-body"></tbody>
                    </table>
                </div>

                <div id="red-mobile-list" class="red-mobile-list" aria-label="Listado móvil"></div>

                <nav id="red-pager" class="red-pager" aria-label="Paginación"></nav>
            </section>

        </section>
    </main>

    <!-- Espacio para modales -->

    <section id="ine-capture-modal" class="ine-capture-modal" hidden aria-hidden="true">
        <div class="ine-capture-overlay" data-ine-capture-close></div>

        <article class="ine-capture-dialog" role="dialog" aria-modal="true" aria-labelledby="ine-capture-title">
            <header class="ine-capture-header ine-capture-header--minimal">
                <button type="button" class="ine-capture-close" data-ine-capture-close aria-label="Cerrar modal">
                    ×
                </button>
            </header>

            <div class="ine-capture-body">

                <!-- Pantalla cámara -->
                <section class="ine-capture-screen is-active" data-ine-screen="camera">
                    <div class="ine-camera-stage" data-step="front" data-state="idle">
                        <video id="ine-camera-video" class="ine-camera-video" autoplay playsinline muted></video>
                        <canvas id="ine-camera-canvas" class="ine-camera-canvas" hidden></canvas>

                        <div class="ine-camera-overlay" aria-hidden="true"></div>

                        <div class="ine-camera-copy">
                            <h3 id="ine-camera-step-title">Coloca el frente de la INE dentro del recuadro</h3>
                            <p>Acomoda la credencial y presiona <strong>Capturar</strong></p>
                        </div>

                        <div class="ine-camera-guide" aria-hidden="true">
                            <div class="ine-camera-guide-box"></div>
                        </div>

                        <div class="ine-camera-feedback" aria-hidden="true">
                            <div class="ine-camera-feedback-icon ine-camera-feedback-icon--ok">✓</div>
                            <div class="ine-camera-feedback-icon ine-camera-feedback-icon--error">×</div>
                        </div>

                        <div class="ine-camera-bottom">
                            <p id="ine-camera-status" class="ine-camera-status">
                                Cuando la INE esté bien alineada, presiona Capturar
                            </p>

                            <div class="ine-camera-actions">
                                <button type="button" id="ine-btn-capture" class="ine-capture-btn ine-capture-btn--primary">
                                    Capturar
                                </button>

                                <button type="button" id="ine-btn-retry" class="ine-capture-btn ine-capture-btn--danger" hidden>
                                    Reintentar
                                </button>

                                <button type="button" id="ine-btn-next" class="ine-capture-btn ine-capture-btn--success" hidden>
                                    Continuar
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Pantalla resumen -->
                <section class="ine-capture-screen" data-ine-screen="summary">
                    <div class="ine-summary-card">
                        <h3>Capturas listas</h3>
                        <p>Revisa que el frente y reverso de la INE se vean correctamente antes de leer los datos.</p>

                        <div class="ine-summary-grid">
                            <figure>
                                <img id="ine-preview-front" src="" alt="Vista previa del frente de la INE">
                                <figcaption>Frente</figcaption>
                            </figure>

                            <figure>
                                <img id="ine-preview-back" src="" alt="Vista previa del reverso de la INE">
                                <figcaption>Reverso</figcaption>
                            </figure>
                        </div>

                        <div class="ine-summary-actions">
                            <button type="button" id="ine-btn-summary-retry" class="ine-capture-btn ine-capture-btn--ghost">
                                Repetir captura
                            </button>

                            <button type="button" id="ine-btn-read-data" class="ine-capture-btn ine-capture-btn--primary">
                                Leer datos
                            </button>
                        </div>
                    </div>
                </section>

                <!-- Pantalla cargando -->
                <section class="ine-capture-screen" data-ine-screen="loading">
                    <div class="ine-loading-card">
                        <div class="ine-loading-icon" aria-hidden="true">
                            <span></span>
                        </div>

                        <h3>Leyendo datos de la INE</h3>
                        <p>Estamos procesando las imágenes. Esto puede tardar unos segundos.</p>
                    </div>
                </section>

            </div>
        </article>
    </section>

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

    <script src="/PRI/JS/JSglobal.js"></script>
    <script type="module" src="/PRI/JS/auth/session.js"></script>
    <script type="module" src="/PRI/JS/home.js"></script>
    <script type="module" src="/PRI/JS/home.modals.js"></script>

</body>

</html>
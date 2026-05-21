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
    <title>Captura INE | PRI</title>

    <link rel="stylesheet" href="/PRI/CSS/plantilla.css">
    <link rel="stylesheet" href="/PRI/CSS/captura.css">
    <link rel="icon" href="/favicon.ico">
</head>

<body>
    <header id="header" data-link-home="/index.php">
        <div class="social-bar-mobile">
            <div class="social-icons">
                <div class="icon-mobile"><img src="/ASSETS/social_icons/Facebook_logo.png" alt="Facebook" /></div>
                <div class="icon-mobile"><img src="/ASSETS/social_icons/Instagram_logo.png" alt="Instagram" /></div>
                <div class="icon-mobile"><img src="/ASSETS/social_icons/Youtube_logo.png" alt="YouTube" /></div>
                <div class="icon-mobile"><img src="/ASSETS/social_icons/X_logo.png" alt="X" /></div>

                <div class="user-icon-mobile" onclick="window.location.href='/PRI/Views/login.php'">
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
                <button class="hamburger" aria-controls="mobile-menu" aria-expanded="false" aria-label="Abrir menú"
                    onclick="toggleMenu()">
                    <span></span><span></span><span></span>
                </button>
            </div>
        </div>

        <nav id="mobile-menu" class="subnav" aria-label="Navegación secundaria">
            <div class="nav-left">
                <a href="/PRI/Views/home.php">Home</a>
            </div>

            <div class="social-icons">
                <div class="circle-icon"><img src="/ASSETS/social_icons/Facebook_logo.png" alt="Facebook" /></div>
                <div class="circle-icon"><img src="/ASSETS/social_icons/Instagram_logo.png" alt="Instagram" /></div>
                <div class="circle-icon"><img src="/ASSETS/social_icons/Youtube_logo.png" alt="YouTube" /></div>
                <div class="circle-icon"><img src="/ASSETS/social_icons/X_logo.png" alt="X" /></div>
            </div>
        </nav>
    </header>

    <main id="captura-ine" class="captura-ine">
        <section class="scanner-shell" aria-labelledby="scanner-title">

            <header class="scanner-header">
                <div>
                    <p class="scanner-kicker">Captura con escáner</p>
                    <h1 id="scanner-title">Validación de INE</h1>
                </div>

                <button type="button" id="scanner-close" class="scanner-close" aria-label="Cerrar captura">
                    ×
                </button>
            </header>

            <section class="scanner-stage" data-step="front" data-state="idle">

                <video id="scanner-video" class="scanner-video" autoplay playsinline muted></video>

                <canvas id="scanner-canvas" class="scanner-canvas" hidden></canvas>

                <div class="scanner-overlay" aria-hidden="true"></div>

                <div id="scanner-guide" class="scanner-guide" aria-hidden="true">
                    <div class="scanner-guide-box"></div>
                </div>

                <div id="scanner-feedback" class="scanner-feedback" aria-hidden="true">
                    <div class="scanner-feedback-icon scanner-feedback-icon--ok">✓</div>
                    <div class="scanner-feedback-icon scanner-feedback-icon--error">×</div>
                </div>

                <div class="scanner-copy">
                    <h2 id="scanner-step-title">
                        Escanea la parte de enfrente de la INE
                    </h2>

                    <p id="scanner-step-help">
                        Hasta que el recuadro esté en <strong>verde</strong>
                    </p>
                </div>

                <div class="scanner-bottom">
                    <div class="scanner-progress" aria-label="Progreso de validación">
                        <div id="scanner-progress-bar" class="scanner-progress-bar"></div>
                    </div>

                    <p id="scanner-status-text" class="scanner-status-text">
                        Coloca la INE dentro del recuadro
                    </p>

                    <div class="scanner-actions">
                        <button type="button" id="scanner-btn-retry" class="scanner-btn scanner-btn-retry" hidden>
                            Reintentar
                        </button>

                        <button type="button" id="scanner-btn-continue" class="scanner-btn scanner-btn-continue" hidden>
                            Continuar
                        </button>

                        <!-- ocultar cuando salga a prod esto es para debug -->
                        <button type="button" id="scanner-btn-debug-file" class="scanner-btn scanner-btn-debug-file">
                            Debug imagen PC
                        </button>

                        <input type="file" id="scanner-debug-file-input" accept="image/*" hidden>
                    </div>
                </div>

            </section>

            <section class="scanner-summary" aria-label="Resumen de captura" hidden>
                <article class="scanner-summary-card">
                    <h2>Capturas listas</h2>
                    <p>La parte frontal y posterior fueron capturadas correctamente.</p>

                    <div class="scanner-preview-grid">
                        <figure>
                            <img id="preview-front" src="" alt="Vista previa frontal de INE">
                            <figcaption>Frente</figcaption>
                        </figure>

                        <figure>
                            <img id="preview-back" src="" alt="Vista previa posterior de INE">
                            <figcaption>Reverso</figcaption>
                        </figure>
                    </div>

                    <div class="scanner-extract-actions">
                        <button type="button" id="scanner-btn-process-watsonx" class="scanner-btn scanner-btn-process">
                            Extraer con Watsonx
                        </button>

                        <button type="button" id="scanner-btn-process-openai"
                            class="scanner-btn scanner-btn-process scanner-btn-process--openai">
                            Extraer con OpenAI
                        </button>
                    </div>
                </article>
            </section>

        </section>










        <!-- espacio para modales -->
        <!-- espacio para modales -->
        <section id="ine-data-modal" class="ine-data-modal" hidden aria-hidden="true">
            <div class="ine-data-backdrop" data-ine-modal-close></div>

            <article class="ine-data-card" role="dialog" aria-modal="true" aria-labelledby="ine-data-title">
                <header class="ine-data-head">
                    <div class="ine-data-brand">
                        <img src="/ASSETS/main_logo.png" alt="Ixtlahuacán de los Membrillos">
                    </div>

                    <div class="ine-data-titlebox">
                        <p class="ine-data-kicker">Datos extraídos</p>
                        <h2 id="ine-data-title">Validación de INE</h2>
                    </div>

                    <button type="button" class="ine-data-close" data-ine-modal-close aria-label="Cerrar">
                        ×
                    </button>
                </header>

                <div class="ine-data-body">
                    <section class="ine-data-section">
                        <div class="ine-data-meta">
                            <div>
                                <span>Fecha</span>
                                <strong id="ine-modal-fecha">--</strong>
                            </div>

                            <div>
                                <span>Proveedor</span>
                                <strong id="ine-modal-registrado">--------</strong>
                            </div>
                        </div>
                    </section>

                    <section class="ine-data-section">
                        <h3>Información principal</h3>

                        <div class="ine-data-grid">
                            <label class="ine-data-field">
                                <span>Nombre completo</span>
                                <output id="ine-modal-nombre">--------</output>
                            </label>

                            <label class="ine-data-field">
                                <span>Teléfono</span>
                                <output id="ine-modal-telefono">--------</output>
                            </label>

                            <label class="ine-data-field ine-data-field--full">
                                <span>Domicilio</span>
                                <output id="ine-modal-domicilio">--------</output>
                            </label>

                            <label class="ine-data-field">
                                <span>Sección</span>
                                <output id="ine-modal-seccion">--------</output>
                            </label>

                            <label class="ine-data-field">
                                <span>Vigencia</span>
                                <output id="ine-modal-vigencia">--------</output>
                            </label>

                            <label class="ine-data-field">
                                <span>Clave de elector</span>
                                <output id="ine-modal-clave">--------</output>
                            </label>

                            <label class="ine-data-field">
                                <span>CURP</span>
                                <output id="ine-modal-curp">--------</output>
                            </label>

                            <label class="ine-data-field">
                                <span>Editado por</span>
                                <output id="ine-modal-editado">--------</output>
                            </label>
                        </div>
                    </section>

                    <section class="ine-data-section">
                        <h3>Capturas INE</h3>

                        <div class="ine-preview-row">
                            <figure>
                                <img id="ine-modal-front" src="" alt="Frente INE">
                                <figcaption>Frente</figcaption>
                            </figure>

                            <figure>
                                <img id="ine-modal-back" src="" alt="Reverso INE">
                                <figcaption>Reverso</figcaption>
                            </figure>
                        </div>
                    </section>

                    <details class="ine-json-debug">
                        <summary>Ver JSON debug</summary>
                        <pre id="ine-modal-json">{}</pre>
                    </details>
                </div>

                <footer class="ine-data-footer">
                    <button type="button" class="ine-data-secondary" data-ine-modal-close>
                        Cancelar
                    </button>

                    <button type="button" id="ine-modal-affiliate" class="ine-affiliate-btn">
                        Afiliar simpatizante
                    </button>
                </footer>
            </article>
        </section>
    </main>

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

    <script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
    <script src="/PRI/JS/JSglobal.js"></script>
    <script src="/PRI/JS/components.js"></script>
    <script src="/PRI/JS/media.js"></script>
    <script type="module" src="/PRI/JS/auth/session.js"></script>
    <script type="module" src="/PRI/JS/captura.js"></script>
</body>

</html>
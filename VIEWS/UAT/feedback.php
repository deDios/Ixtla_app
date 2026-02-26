<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ixtla App</title>
    <link rel="stylesheet" href="/CSS/plantilla.css">
    <link rel="stylesheet" href="/CSS/feedback.css">
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
        <section id="retro-page">
            <div class="retro-wrap">

                <!-- CARD estilo modal (siempre visible en esta página) -->
                <article class="retro-dialog" role="dialog" aria-modal="false" aria-labelledby="retro-title">

                    <div id="retro-modal" class="ix-modal ix-modal--lock" aria-hidden="false">
                        <div class="ix-modal__overlay"></div>

                        <div class="ix-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="retro-title">
                            <header class="ix-modal__header">
                                <h2 id="retro-title" class="ix-modal__title">Retroalimentación</h2>

                                <!-- NOTA: sin botón cerrar -->
                                <!-- <button class="ix-modal__close" type="button" aria-label="Cerrar">×</button> -->
                            </header>

                            <div class="ix-modal__body">
                                <p class="retro-q">¿Cómo valoras el servicio recibido?</p>

                                <div class="retro-rate retro-rate--svg" role="radiogroup"
                                    aria-label="Valoración del servicio">

                                    <label class="rate-item">
                                        <input type="radio" name="rate" value="1" />
                                        <span class="rate-icon" aria-hidden="true">
                                            <!-- MALO -->
                                            <svg viewBox="0 0 48 48" class="rate-svg">
                                                <circle class="s" cx="24" cy="24" r="14"></circle>
                                                <circle class="f" cx="19" cy="22" r="1.6"></circle>
                                                <circle class="f" cx="29" cy="22" r="1.6"></circle>
                                                <!-- boca triste -->
                                                <path class="s" d="M18 32c2.2-2.4 9.8-2.4 12 0"></path>
                                            </svg>
                                        </span>
                                        <span class="rate-label">Malo</span>
                                    </label>

                                    <label class="rate-item">
                                        <input type="radio" name="rate" value="2" />
                                        <span class="rate-icon" aria-hidden="true">
                                            <!-- REGULAR -->
                                            <svg viewBox="0 0 48 48" class="rate-svg">
                                                <circle class="s" cx="24" cy="24" r="14"></circle>
                                                <circle class="f" cx="19" cy="22" r="1.6"></circle>
                                                <circle class="f" cx="29" cy="22" r="1.6"></circle>
                                                <!-- boca neutral -->
                                                <path class="s" d="M18 31h12"></path>
                                            </svg>
                                        </span>
                                        <span class="rate-label">Regular</span>
                                    </label>

                                    <label class="rate-item">
                                        <input type="radio" name="rate" value="3" />
                                        <span class="rate-icon" aria-hidden="true">
                                            <!-- BUENO -->
                                            <svg viewBox="0 0 48 48" class="rate-svg">
                                                <circle class="s" cx="24" cy="24" r="14"></circle>
                                                <circle class="f" cx="19" cy="22" r="1.6"></circle>
                                                <circle class="f" cx="29" cy="22" r="1.6"></circle>
                                                <!-- sonrisa -->
                                                <path class="s" d="M18 29c2.2 2.6 9.8 2.6 12 0"></path>
                                            </svg>
                                        </span>
                                        <span class="rate-label">Bueno</span>
                                    </label>

                                    <label class="rate-item">
                                        <input type="radio" name="rate" value="4" />
                                        <span class="rate-icon" aria-hidden="true">
                                            <svg viewBox="0 0 48 48" class="rate-svg">
                                                <circle class="s" cx="24" cy="24" r="14"></circle>
                                                <circle class="f" cx="19" cy="22" r="1.6"></circle>
                                                <circle class="f" cx="29" cy="22" r="1.6"></circle>

                                                <!-- boca tipo D real (arriba plano, abajo redondo) -->
                                                <path class="f" d="M18 29.2 H30 Q30 32.6 24 32.6 Q18 32.6 18 29.2 Z"></path>
                                            </svg>
                                        </span>
                                        <span class="rate-label">Excelente</span>
                                    </label>

                                </div>

                                <label class="retro-label" for="retro-comentario">Comentario sobre el
                                    requerimiento</label>
                                <textarea id="retro-comentario" class="retro-input retro-textarea" rows="4"></textarea>

                                <label class="retro-label" for="retro-depto">Departamento</label>
                                <input id="retro-depto" class="retro-input" type="text" value="SAMAPA" readonly />

                                <button id="retro-send" class="retro-btn" type="button" disabled>Enviar</button>
                            </div>
                        </div>
                    </div>
                </article>

                <!-- MINI MODAL: Gracias / Ya respondido -->
                <div id="retro-overlay" class="retro-overlay" hidden></div>
                <div id="retro-mini" class="retro-mini" role="dialog" aria-modal="true"
                    aria-labelledby="retro-mini-title" hidden>
                    <h3 id="retro-mini-title">Muchas gracias</h3>
                    <p id="retro-mini-msg">Tu retroalimentación fue registrada correctamente.</p>
                    <button id="retro-finish" class="retro-btn" type="button">Finalizar</button>
                </div>

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
    <script src="/JS/components.js"></script>
    <script src="/JS/feedback.js"></script>

</body>

</html>
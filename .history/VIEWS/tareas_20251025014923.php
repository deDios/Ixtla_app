<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ixtla App</title>
    <link rel="stylesheet" href="/CSS/plantilla.css">
    <link rel="stylesheet" href="/CSS/home.css">
    <link rel="stylesheet" href="/CSS/components.css">
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

    <main class="home-samapa">
        <div class="hs-wrap">

            <!-- SIDEBAR -->
            <aside class="hs-sidebar">
                <section class="hs-profile" aria-label="Perfil">
                    <div class="avatar-shell">
                        <div class="avatar-circle">
                            <img id="hs-avatar" class="avatar" src="/ASSETS/user/img_user1.png" alt="Avatar">
                        </div>

                        <!-- Botón editar avatar (igual que en GodCode) -->
                        <button type="button" class="icon-btn avatar-edit" aria-label="Cambiar foto"
                            title="Cambiar foto">
                            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                <path
                                    d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83z"
                                    fill="currentColor"></path>
                            </svg>
                        </button>
                    </div>

                    <h3 id="hs-profile-name" class="name">—</h3>

                    <button type="button" class="gc-btn gc-btn-ghost edit-profile" data-open="#modal-perfil"
                        aria-haspopup="dialog" aria-controls="modal-perfil">
                        Administrar perfil ›
                    </button>

                    <span id="hs-profile-badge" class="badge">—</span>
                </section>

                <!-- se actulizaron los filtros ahora deberian coincidir con los esperados -->
                <nav id="hs-states" class="hs-states" aria-label="Estados">
                    <button class="item is-active" data-status="todos" role="radio" aria-checked="true">
                        <span class="label">Todos</span><span class="count" id="cnt-todos">(0)</span>
                    </button>
                    <button class="item" data-status="solicitud" role="radio" aria-checked="false">
                        <span class="label">Solicitud</span><span class="count" id="cnt-solicitud">(0)</span>
                    </button>
                    <button class="item" data-status="revision" role="radio" aria-checked="false">
                        <span class="label">Revisión</span><span class="count" id="cnt-revision">(0)</span>
                    </button>
                    <button class="item" data-status="asignacion" role="radio" aria-checked="false">
                        <span class="label">Asignación</span><span class="count" id="cnt-asignacion">(0)</span>
                    </button>
                    <button class="item" data-status="proceso" role="radio" aria-checked="false">
                        <span class="label">En proceso</span><span class="count" id="cnt-proceso">(0)</span>
                    </button>
                    <button class="item" data-status="pausado" role="radio" aria-checked="false">
                        <span class="label">Pausado</span><span class="count" id="cnt-pausado">(0)</span>
                    </button>
                    <button class="item" data-status="cancelado" role="radio" aria-checked="false">
                        <span class="label">Cancelado</span><span class="count" id="cnt-cancelado">(0)</span>
                    </button>
                    <button class="item" data-status="finalizado" role="radio" aria-checked="false">
                        <span class="label">Finalizado</span><span class="count" id="cnt-finalizado">(0)</span>
                    </button>
                </nav>

            </aside>

            <!-- MAIN -->
            <section class="hs-main">

                

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

    <!-- MODALES -->
    <div id="modal-perfil" class="modal-overlay" aria-hidden="true">
        <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="perfil-title">
            <button class="modal-close" type="button" aria-label="Cerrar">×</button>
            <h2 id="perfil-title">Administrar perfil</h2>

            <form id="form-perfil" novalidate>
                <!-- Nombre / Apellidos -->
                <div class="form-row split">
                    <div>
                        <label for="perfil-nombre">Nombre</label>
                        <input type="text" id="perfil-nombre" name="nombre" autocomplete="given-name">
                    </div>
                    <div>
                        <label for="perfil-apellidos">Apellidos</label>
                        <input type="text" id="perfil-apellidos" name="apellidos" autocomplete="family-name">
                    </div>
                </div>

                <!-- Correo / Teléfono -->
                <div class="form-row split">
                    <div>
                        <label for="perfil-email">Correo electrónico</label>
                        <input type="email" id="perfil-email" name="correo" autocomplete="email">
                    </div>
                    <div>
                        <label for="perfil-telefono">Teléfono</label>
                        <input type="tel" id="perfil-telefono" name="telefono" autocomplete="tel">
                    </div>
                </div>

                <!-- Contraseña / Confirmar -->
                <div class="form-row split">
                    <div>
                        <label for="perfil-password">
                            Contraseña
                            <span class="tooltip">ⓘ
                                <span class="tooltiptext">Deja vacío si no deseas cambiarla.</span>
                            </span>
                        </label>
                        <input type="password" id="perfil-password" name="password" autocomplete="new-password"
                            placeholder="Opcional">
                    </div>
                    <div>
                        <label for="perfil-password2">Confirmar contraseña</label>
                        <input type="password" id="perfil-password2" name="password2" autocomplete="new-password"
                            placeholder="Opcional">
                    </div>
                </div>

                <!-- Sección informativa -->
                <h3 class="form-section-title">INFORMACIÓN DEL EMPLEADO</h3>

                <!-- Departamento / Reporta a (solo lectura) -->
                <div class="form-row split">
                    <div>
                        <label for="perfil-departamento">Departamento</label>
                        <input type="text" id="perfil-departamento" name="departamento" class="is-readonly" readonly
                            aria-readonly="true">
                    </div>
                    <div>
                        <label for="perfil-reporta">Reporta a</label>
                        <input type="text" id="perfil-reporta" name="reporta_a_nombre" class="is-readonly" readonly
                            aria-readonly="true">
                    </div>
                </div>

                <!-- Status (solo lectura) -->
                <div class="form-row">
                    <label for="perfil-status">Status</label>
                    <input type="text" id="perfil-status" name="status" class="is-readonly" readonly
                        aria-readonly="true">
                </div>

                <!-- Submit -->
                <button type="submit" class="btn-submit">Guardar cambios</button>
            </form>



            <p class="modal-note">
                Tus datos están seguros con nosotros. Al guardar aceptas nuestras políticas de privacidad y condiciones
                de uso.
            </p>
            <p class="modal-copy">© 2025 GodCode. Todos los derechos reservados.</p>
        </div>
    </div>




    <!-- Modal editor de Avatar  -->
    <div class="eda-overlay" id="eda-overlay" aria-hidden="true">
        <div class="eda-modal" role="dialog" aria-modal="true" aria-labelledby="eda-title">
            <div class="eda-header">
                <div class="eda-title" id="eda-title">Editar avatar</div>
                <div class="eda-actions">
                    <button class="btn" id="eda-close" type="button">Cerrar</button>
                </div>
            </div>

            <div class="eda-body">
                <!-- Lado izquierdo: Dropzone + Vista previa -->
                <div class="eda-left">
                    <div class="eda-drop" id="eda-drop" aria-label="Zona para arrastrar y soltar imágenes">
                        <div class="eda-drop-cta">
                            <strong>Arrastra una imagen</strong> o
                            <button class="btn btn-outline" id="eda-choose" type="button">Elegir archivo</button>
                            <div class="eda-hint">También puedes pegar con <kbd>Ctrl</kbd>+<kbd>V</kbd></div>
                        </div>
                    </div>

                    <div class="eda-preview">
                        <div class="eda-preview-wrap">
                            <img id="eda-preview-img" alt="Vista previa" />
                            <div class="eda-mask" aria-hidden="true"></div>
                        </div>
                    </div>
                </div>

                <!-- Lado derecho: Recientes (mini-historial local) -->
                <div class="eda-right">
                    <div class="eda-recents">
                        <div class="eda-recents-title">Recientes</div>
                        <div class="eda-recents-grid" id="eda-recents-grid">
                            <div class="eda-empty">Sin recientes</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="eda-footer">
                <div class="eda-hint">JPG, PNG, WebP, HEIC/HEIF · Máx 1MB</div>
                <div class="eda-actions">
                    <button class="btn" id="eda-cancel" type="button">Cancelar</button>
                    <button class="btn blue" id="eda-save" type="button" disabled>Guardar</button>
                </div>
            </div>

            <!-- Input real (oculto). El JS se encarga de activarlo. -->
            <input type="file" id="eda-file" accept="image/png, image/jpeg, image/webp, image/heic, image/heif"
                hidden />
        </div>
    </div>




    <!-- Guard para la página de home
<script type="module">
    import {
        guardPage
    } from "/JS/auth/guard.js";
    guardPage({
        stealth: false,
        redirectTo: "/VIEWS/login.php"
    });
    </script>
    -->
    

    <script src="/JS/JSglobal.js"></script>
    <script type="module" src="/JS/ui/avatar-edit.js"></script>


</body>

</html>
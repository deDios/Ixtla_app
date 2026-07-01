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
    <!-- Tope de página -->
    <header id="header" data-link-home="/index.php">
        <div class="social-bar-mobile">
            <div class="social-icons">
                <div class="icon-mobile"><img src="/ASSETS/social_icons/Facebook_logo.png" alt="Facebook" /></div>
                <div class="icon-mobile"><img src="/ASSETS/social_icons/Instagram_logo.png" alt="Instagram" /></div>
                <div class="icon-mobile"><img src="/ASSETS/social_icons/Youtube_logo.png" alt="YouTube" /></div>
                <div class="icon-mobile"><img src="/ASSETS/social_icons/X_logo.png" alt="X" /></div>
                <!-- El JS global reemplaza este avatar cuando hay sesión -->
                <div class="user-icon-mobile" onclick="window.location.href='VIEW/Login.php'">
                    <img src="/ASSETS/user/img_user1.png" alt="Usuario" />
                </div>
            </div>
        </div>


        <!-- Top bar: logo a la izquierda, acciones (Hamburguesa) a la derecha -->
        <div class="top-bar" id="top-bar">
            <div id="logo-btn" class="logo" title="Ir al inicio" aria-label="Ir al inicio">
                <!-- logo del header -->
                <img class="logo-marca" src="/PRI/Assets/Logo_PRI%20(2).png"
                    alt="Ixtlahuacán de los Membrillos - Ayuntamiento" />
            </div>


            <div class="actions">
                <button class="hamburger" aria-controls="mobile-menu" aria-expanded="false" aria-label="Abrir menu"
                    onclick="toggleMenu()">
                    <span></span><span></span><span></span>
                </button>
                <!-- El JS global inyecta aquí el avatar desktop si hay sesión -->
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

                    <input id="red-search" type="search" placeholder="Buscar" autocomplete="off"
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
                    &times;
                </button>
            </header>

            <div class="ine-capture-body">

                <!-- Pantalla método -->
                <section class="ine-capture-screen is-active" data-ine-screen="method">
                    <div class="ine-method-card">
                        <p class="ine-method-kicker">Captura INE</p>
                        <h3>Selecciona cómo cargar la identificación</h3>
                        <p>
                            Puedes usar la cámara del dispositivo o subir imágenes ya tomadas del frente y reverso.
                        </p>

                        <div class="ine-method-actions">
                            <button type="button" id="ine-btn-use-camera"
                                class="ine-capture-btn ine-capture-btn--primary">
                                Usar cámara
                            </button>

                            <button type="button" id="ine-btn-use-upload"
                                class="ine-capture-btn ine-capture-btn--ghost">
                                Subir imágenes
                            </button>
                        </div>
                    </div>
                </section>

                <!-- Pantalla cámara -->
                <section class="ine-capture-screen" data-ine-screen="camera">
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
                            <div class="ine-camera-feedback-icon ine-camera-feedback-icon--ok">&#10003;</div>
                            <div class="ine-camera-feedback-icon ine-camera-feedback-icon--error">&times;</div>
                        </div>

                        <div class="ine-camera-bottom">
                            <p id="ine-camera-status" class="ine-camera-status">
                                Cuando la INE esté bien alineada, presiona Capturar
                            </p>

                            <div class="ine-camera-actions">
                                <button type="button" id="ine-btn-capture"
                                    class="ine-capture-btn ine-capture-btn--primary">
                                    Capturar
                                </button>

                                <button type="button" id="ine-btn-retry"
                                    class="ine-capture-btn ine-capture-btn--danger" hidden>
                                    Reintentar
                                </button>

                                <button type="button" id="ine-btn-next" class="ine-capture-btn ine-capture-btn--success"
                                    hidden>
                                    Continuar
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Pantalla subir imágenes -->
                <section class="ine-capture-screen" data-ine-screen="upload">
                    <div class="ine-upload-card">
                        <p class="ine-method-kicker">Carga manual</p>
                        <h3>Sube las imágenes de la INE</h3>
                        <p>
                            Selecciona una imagen del frente y una del reverso.
                            Formatos permitidos: JPG, PNG o WEBP.
                        </p>

                        <div class="ine-upload-grid">
                            <label class="ine-upload-box" for="ine-upload-front">
                                <span>Frente de la INE</span>
                                <input type="file" id="ine-upload-front" accept="image/jpeg,image/png,image/webp">
                                <img id="ine-upload-preview-front" alt="Vista previa frente" hidden>
                                <small>Seleccionar frente</small>
                            </label>

                            <label class="ine-upload-box" for="ine-upload-back">
                                <span>Reverso de la INE</span>
                                <input type="file" id="ine-upload-back" accept="image/jpeg,image/png,image/webp">
                                <img id="ine-upload-preview-back" alt="Vista previa reverso" hidden>
                                <small>Seleccionar reverso</small>
                            </label>
                        </div>

                        <div class="ine-summary-actions">
                            <button type="button" id="ine-btn-upload-back"
                                class="ine-capture-btn ine-capture-btn--ghost">
                                Volver
                            </button>

                            <button type="button" id="ine-btn-upload-continue"
                                class="ine-capture-btn ine-capture-btn--primary" disabled>
                                Ver capturas
                            </button>
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
                            <button type="button" id="ine-btn-summary-retry"
                                class="ine-capture-btn ine-capture-btn--ghost">
                                Repetir captura
                            </button>

                            <button type="button" id="ine-btn-read-data"
                                class="ine-capture-btn ine-capture-btn--primary">
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



    <!---------------------- Modal media afiliado ------------------------------->

    <section id="affiliate-media-modal" class="ine-capture-modal" hidden aria-hidden="true">
        <div class="ine-capture-overlay" data-affiliate-media-close></div>

        <article class="ine-capture-dialog" role="dialog" aria-modal="true" aria-labelledby="affiliate-media-title">
            <header class="ine-capture-header ine-capture-header--minimal">
                <button type="button" class="ine-capture-close" data-affiliate-media-close aria-label="Cerrar modal">
                    &times;
                </button>
            </header>

            <div class="ine-capture-body">
                <section class="ine-capture-screen is-active" data-affiliate-screen="method">
                    <div class="ine-method-card">
                        <p class="ine-method-kicker">Afiliado</p>
                        <h3 id="affiliate-media-title">Captura evidencia de afiliación</h3>
                        <p>Puedes usar la cámara del dispositivo o subir dos imágenes: el documento de afiliación y una
                            foto del afiliado con fondo blanco.</p>

                        <div class="ine-method-actions">
                            <button type="button" id="affiliate-btn-use-camera"
                                class="ine-capture-btn ine-capture-btn--primary">
                                Usar cámara
                            </button>

                            <button type="button" id="affiliate-btn-use-upload"
                                class="ine-capture-btn ine-capture-btn--ghost">
                                Subir imágenes
                            </button>
                        </div>
                    </div>
                </section>

                <section class="ine-capture-screen" data-affiliate-screen="camera">
                    <div class="ine-camera-stage" data-affiliate-step="front" data-affiliate-state="idle">
                        <video id="affiliate-camera-video" class="ine-camera-video" autoplay playsinline muted></video>

                        <div class="ine-camera-overlay" aria-hidden="true"></div>

                        <div class="ine-camera-copy">
                            <h3 id="affiliate-camera-step-title">Captura el documento de afiliación</h3>
                            <p id="affiliate-camera-helper">Centra el documento y presiona <strong>Capturar</strong></p>
                        </div>

                        <div class="ine-camera-guide" aria-hidden="true">
                            <div class="ine-camera-guide-box" id="affiliate-camera-guide-box"></div>
                        </div>

                        <div class="ine-camera-bottom">
                            <p id="affiliate-camera-status" class="ine-camera-status">
                                Cuando la imagen esté bien alineada, presiona Capturar
                            </p>

                            <div class="ine-camera-actions">
                                <button type="button" id="affiliate-btn-capture"
                                    class="ine-capture-btn ine-capture-btn--primary">
                                    Capturar
                                </button>

                                <button type="button" id="affiliate-btn-retry"
                                    class="ine-capture-btn ine-capture-btn--danger" hidden>
                                    Reintentar
                                </button>

                                <button type="button" id="affiliate-btn-next"
                                    class="ine-capture-btn ine-capture-btn--success" hidden>
                                    Continuar
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="ine-capture-screen" data-affiliate-screen="upload">
                    <div class="ine-upload-card">
                        <p class="ine-method-kicker">Carga manual</p>
                        <h3>Sube la evidencia del afiliado</h3>
                        <p>
                            Selecciona primero el documento de afiliación y después una foto del afiliado con fondo
                            blanco.
                            Formatos permitidos: JPG, PNG o WEBP.
                        </p>

                        <div class="ine-upload-grid">
                            <label class="ine-upload-box" for="affiliate-upload-front">
                                <span>Documento de afiliación</span>
                                <input type="file" id="affiliate-upload-front" accept="image/jpeg,image/png,image/webp">
                                <img id="affiliate-upload-preview-front" alt="Vista previa del documento de afiliación"
                                    hidden>
                                <small>Seleccionar documento</small>
                            </label>

                            <label class="ine-upload-box" for="affiliate-upload-back">
                                <span>Foto del afiliado con fondo blanco</span>
                                <input type="file" id="affiliate-upload-back" accept="image/jpeg,image/png,image/webp">
                                <img id="affiliate-upload-preview-back" alt="Vista previa de la foto del afiliado"
                                    hidden>
                                <small>Seleccionar foto</small>
                            </label>
                        </div>

                        <div class="ine-summary-actions">
                            <button type="button" id="affiliate-btn-upload-back"
                                class="ine-capture-btn ine-capture-btn--ghost">
                                Volver
                            </button>

                            <button type="button" id="affiliate-btn-upload-continue"
                                class="ine-capture-btn ine-capture-btn--primary" disabled>
                                Ver capturas
                            </button>
                        </div>
                    </div>
                </section>

                <section class="ine-capture-screen" data-affiliate-screen="summary">
                    <div class="ine-summary-card">
                        <h3>Capturas listas</h3>
                        <p>Revisa que ambas imágenes se vean correctamente antes de continuar.</p>

                        <div class="ine-summary-grid">
                            <figure>
                                <img id="affiliate-preview-front" src="" alt="Vista previa del documento de afiliación">
                                <figcaption>Documento de afiliación</figcaption>
                            </figure>

                            <figure>
                                <img id="affiliate-preview-back" src="" alt="Vista previa de la foto del afiliado">
                                <figcaption>Foto del afiliado con fondo blanco</figcaption>
                            </figure>
                        </div>

                        <div class="ine-summary-actions">
                            <button type="button" id="affiliate-btn-summary-retry"
                                class="ine-capture-btn ine-capture-btn--ghost">
                                Repetir captura
                            </button>

                            <button type="button" id="affiliate-btn-complete"
                                class="ine-capture-btn ine-capture-btn--primary">
                                Confirmar afiliación
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </article>
    </section>

    <section id="affiliate-replace-modal" class="red-affiliate-replace-modal" hidden aria-hidden="true">
        <div class="red-affiliate-replace-overlay" data-affiliate-replace-close></div>

        <article class="red-affiliate-replace-dialog" role="dialog" aria-modal="true"
            aria-labelledby="affiliate-replace-title">
            <header class="red-affiliate-replace-header">
                <button type="button" class="red-affiliate-replace-close" data-affiliate-replace-close
                    aria-label="Cerrar modal">
                    &times;
                </button>
            </header>

            <div class="red-affiliate-replace-body">
                <p class="red-affiliate-replace-kicker">Carga manual</p>
                <h3 id="affiliate-replace-title">Reemplazar imagen</h3>
                <p id="affiliate-replace-copy" class="red-affiliate-replace-copy">
                    Selecciona una imagen JPG, PNG o WEBP.
                </p>

                <label class="red-affiliate-replace-picker" for="affiliate-replace-input">
                    <span id="affiliate-replace-label">Seleccionar imagen</span>
                    <input type="file" id="affiliate-replace-input" accept="image/jpeg,image/png,image/webp" hidden>
                </label>

                <p id="affiliate-replace-file" class="red-affiliate-replace-file">
                    Ningún archivo seleccionado
                </p>

                <div class="red-affiliate-replace-actions">
                    <button type="button" id="affiliate-replace-cancel"
                        class="red-affiliate-replace-btn red-affiliate-replace-btn--ghost">
                        Cancelar
                    </button>

                    <button type="button" id="affiliate-replace-save"
                        class="red-affiliate-replace-btn red-affiliate-replace-btn--primary" disabled>
                        Guardar imagen
                    </button>
                </div>
            </div>
        </article>
    </section>

    <!---------------------- Modal revision / alta de persona desde INE -------------------------->


    <section id="ine-review-modal" class="ine-review-modal" hidden aria-hidden="true">
        <div class="ine-review-overlay" data-ine-review-close></div>

        <article class="ine-review-dialog" role="dialog" aria-modal="true" aria-labelledby="ine-review-title">
            <header class="ine-review-header">
                <div class="ine-review-titlebox">
                    <p class="ine-review-kicker">Datos extraídos</p>
                    <h2 id="ine-review-title">Revisión de información INE</h2>
                </div>

                <button type="button" class="ine-review-close" data-ine-review-close aria-label="Cerrar">
                    &times;
                </button>
            </header>

            <form id="ine-review-form" class="ine-review-form" autocomplete="off">
                <div class="ine-review-body">

                    <!-- Resumen -->
                    <section class="ine-review-section ine-review-section--summary">

                        <div class="ine-review-adminbar" id="ine-review-adminbar" hidden>
                            <label class="ine-review-field ine-review-status-field">
                                <span>Estatus</span>

                                <select id="ine-review-estatus" name="estatus_id" class="ine-review-status-select">
                                    <option value="">Selecciona un estatus</option>
                                </select>
                            </label>

                            <label class="ine-review-affiliate-toggle" for="ine-review-es-afiliado">
                                <span class="ine-review-affiliate-text">Afiliado</span>

                                <span class="ine-review-toggle-wrap">
                                    <input type="checkbox" id="ine-review-es-afiliado" name="es_afiliado" value="1">

                                    <span class="ine-review-switch" aria-hidden="true">
                                        <span class="ine-review-switch-dot"></span>
                                    </span>
                                </span>
                            </label>
                        </div>

                        <div class="ine-review-meta">
                            <label class="ine-review-field">
                                <span>Fecha de extracción</span>
                                <input type="text" id="ine-review-fecha-extraccion" name="fecha_extraccion"
                                    placeholder="Fecha de extracción" readonly>
                            </label>

                            <label class="ine-review-field">
                                <span>Capturado por</span>
                                <input type="text" id="ine-review-capturado-por" name="capturado_por_label"
                                    placeholder="Capturado por" readonly>
                            </label>

                            <label class="ine-review-field">
                                <span>Última edición por</span>
                                <input type="text" id="ine-review-updated-by" name="updated_by_label"
                                    placeholder="Última edición por" readonly>
                            </label>
                        </div>

                        <div class="ine-review-warning" role="alert">
                            <strong>Importante: La información fue extraída automáticamente.</strong>
                            Valide esta información comparando contra el documento INE,
                            realice los ajustes que sean necesarios y guarde el registro.
                        </div>
                    </section>

                    <!-- Identidad -->
                    <section class="ine-review-section">
                        <h3>Identidad</h3>

                        <div class="ine-review-grid">
                            <label class="ine-review-field">
                                <span>Nombre(s) *</span>
                                <input type="text" id="ine-review-nombres" name="nombres" placeholder="Nombre(s)"
                                    required>
                            </label>

                            <label class="ine-review-field">
                                <span>Apellido paterno</span>
                                <input type="text" id="ine-review-apellido-paterno" name="apellido_paterno"
                                    placeholder="Apellido paterno">
                            </label>

                            <label class="ine-review-field">
                                <span>Apellido materno</span>
                                <input type="text" id="ine-review-apellido-materno" name="apellido_materno"
                                    placeholder="Apellido materno">
                            </label>

                            <label class="ine-review-field">
                                <span>Fecha de nacimiento</span>
                                <input type="date" id="ine-review-fecha-nacimiento" name="fecha_nacimiento">
                            </label>

                            <label class="ine-review-field">
                                <span>Sexo</span>
                                <select id="ine-review-sexo" name="sexo">
                                    <option value="">Selecciona</option>
                                    <option value="H">Hombre</option>
                                    <option value="M">Mujer</option>
                                    <option value="X">Otro / No especificado</option>
                                </select>
                            </label>
                        </div>
                    </section>

                    <!-- Datos de credencial -->
                    <section class="ine-review-section">
                        <h3>Datos de credencial</h3>

                        <div class="ine-review-grid">
                            <label class="ine-review-field">
                                <span>CURP</span>
                                <input type="text" id="ine-review-curp" name="curp" maxlength="18" placeholder="CURP"
                                    readonly>
                            </label>

                            <label class="ine-review-field">
                                <span>Clave de elector</span>
                                <input type="text" id="ine-review-clave-elector" name="clave_elector" readonly
                                    placeholder="Clave de elector">
                            </label>

                            <label class="ine-review-field ine-review-field--combo">
                                <span>Sección</span>

                                <input type="hidden" id="ine-review-seccion" name="seccion_id">

                                <button type="button" id="ine-review-seccion-toggle" class="red-residence-combo-toggle"
                                    aria-haspopup="listbox" aria-expanded="false">
                                    <span id="ine-review-seccion-text">Selecciona una sección</span>
                                    <span class="red-residence-combo-chevron" aria-hidden="true"></span>
                                </button>

                                <div id="ine-review-seccion-list" class="red-residence-combo-list" role="listbox"
                                    hidden>
                                </div>
                            </label>

                            <label class="ine-review-field">
                                <span>Año de registro</span>
                                <input type="number" id="ine-review-anio-registro" name="anio_registro" min="1900"
                                    max="2100" placeholder="Año">
                            </label>

                            <label class="ine-review-field">
                                <span>Emisión</span>
                                <input type="text" id="ine-review-emision" name="emision" inputmode="numeric"
                                    maxlength="2" pattern="[0-9]{1,2}" placeholder="00">
                            </label>

                            <label class="ine-review-field">
                                <span>Vigencia inicio</span>
                                <input type="number" id="ine-review-vigencia-inicio" name="vigencia_inicio" min="1900"
                                    max="2100" placeholder="Año">
                            </label>

                            <label class="ine-review-field">
                                <span>Vigencia fin</span>
                                <input type="number" id="ine-review-vigencia-fin" name="vigencia_fin" min="1900"
                                    max="2100" placeholder="Año">
                            </label>

                            <label class="ine-review-field">
                                <span>IDMEX</span>
                                <input type="text" id="ine-review-idmex" name="idmex" placeholder="IDMEX" readonly>
                            </label>
                        </div>
                    </section>

                    <!-- Domicilio -->
                    <section class="ine-review-section">
                        <h3>Domicilio</h3>

                        <div class="ine-review-grid">
                            <label class="ine-review-field ine-review-field--full">
                                <span>Domicilio</span>
                                <textarea id="ine-review-domicilio" name="domicilio_texto" rows="3"
                                    placeholder="Domicilio extraído de la INE"></textarea>
                            </label>
                        </div>
                    </section>

                    <!-- Contacto -->
                    <section class="ine-review-section">
                        <h3>Contacto</h3>

                        <div class="ine-review-grid">
                            <label class="ine-review-field">
                                <span>Teléfono</span>
                                <input type="tel" id="ine-review-telefono" name="telefono" inputmode="tel"
                                    minlength="10" maxlength="12" pattern="[0-9]{10,12}" placeholder="Teléfono"
                                    title="Captura entre 10 y 12 números">
                            </label>

                            <label class="ine-review-field">
                                <span>WhatsApp</span>
                                <input type="tel" id="ine-review-whatsapp" name="whatsapp" inputmode="tel"
                                    placeholder="WhatsApp">
                            </label>

                            <label class="ine-review-field ine-review-field--full">
                                <span>Email</span>
                                <input type="email" id="ine-review-email" name="email" placeholder="correo@ejemplo.com">
                            </label>
                        </div>
                    </section>

                    <!-- Consentimiento -->
                    <section class="ine-review-section">
                        <h3>Consentimiento</h3>

                        <div class="ine-review-consent-card">
                            <label class="ine-review-check">
                                <input type="checkbox" id="ine-review-acepta-tratamiento"
                                    name="acepta_tratamiento_datos" value="1">

                                <span>
                                    Acepto el tratamiento de mis datos personales conforme al aviso de privacidad
                                    y autorizo el uso de la información capturada para el registro correspondiente.
                                </span>
                            </label>

                            <label class="ine-review-check">
                                <input type="checkbox" id="ine-review-acepta-whatsapp" name="acepta_contacto_whatsapp"
                                    value="1">

                                <span>
                                    Acepto recibir seguimiento o contacto por WhatsApp.
                                </span>
                            </label>
                        </div>
                    </section>

                    <!-- Observaciones -->
                    <section class="ine-review-section">
                        <h3>Observaciones</h3>

                        <div class="ine-review-grid">
                            <label class="ine-review-field ine-review-field--full">
                                <span>Notas adicionales</span>
                                <textarea id="ine-review-observaciones" name="observaciones" rows="3"
                                    placeholder="Observaciones internas o aclaraciones del registro"></textarea>
                            </label>
                        </div>
                    </section>

                    <!-- Capturas INE -->
                    <section class="ine-review-section ine-review-section--captures">

                        <div class="ine-review-captures-grid">
                            <figure class="ine-review-capture-card">
                                <img id="ine-review-front" src="" alt="Captura del frente de la INE">
                                <figcaption>Frente</figcaption>
                            </figure>

                            <figure class="ine-review-capture-card">
                                <img id="ine-review-back" src="" alt="Captura del reverso de la INE">
                                <figcaption>Reverso</figcaption>
                            </figure>
                        </div>
                    </section>

                    <!-- Capturas afiliado -->
                    <section id="ine-review-affiliate-captures-section"
                        class="ine-review-section ine-review-section--captures" hidden>
                        <h3>Evidencia de afiliación</h3>

                        <div class="ine-review-captures-grid">
                            <figure class="ine-review-capture-card">
                                <img id="ine-review-affiliate-front" src="" alt="Documento de afiliación">
                                <figcaption>Documento de afiliación</figcaption>
                                <div class="ine-review-capture-actions" data-readonly-image-actions hidden>
                                    <button type="button" class="ine-review-btn ine-review-btn--ghost" data-readonly-image-pick="affiliate_front" style="border-color:#bfd8c6;background:#f3fbf6;color:#1f6b48;font-weight:700;">
                                        Reemplazar
                                    </button>
                                    <input type="file" accept="image/jpeg,image/png,image/webp" data-readonly-image-input="affiliate_front" hidden>
                                </div>
                            </figure>

                            <figure class="ine-review-capture-card">
                                <img id="ine-review-affiliate-back" src="" alt="Foto del afiliado con fondo blanco">
                                <figcaption>Foto del afiliado con fondo blanco</figcaption>
                                <div class="ine-review-capture-actions" data-readonly-image-actions hidden>
                                    <button type="button" class="ine-review-btn ine-review-btn--ghost" data-readonly-image-pick="affiliate_back" style="border-color:#bfd8c6;background:#f3fbf6;color:#1f6b48;font-weight:700;">
                                        Reemplazar
                                    </button>
                                    <input type="file" accept="image/jpeg,image/png,image/webp" data-readonly-image-input="affiliate_back" hidden>
                                </div>
                            </figure>
                        </div>
                    </section>

                </div>

                <footer class="ine-review-footer">
                    <button type="submit" id="ine-modal-affiliate" class="ine-review-btn ine-review-btn--primary">
                        Guardar persona
                    </button>

                    <button type="button" id="ine-review-edit" class="ine-review-btn ine-review-btn--ghost" hidden>
                        Editar
                    </button>

                    <button type="button" id="ine-review-save-person" class="ine-review-btn ine-review-btn--primary"
                        hidden>
                        Guardar cambios
                    </button>

                    <button type="button" id="ine-review-cancel-edit" class="ine-review-btn ine-review-btn--ghost"
                        hidden>
                        Cancelar edición
                    </button>

                    <button type="button" id="ine-review-save-status"
                        class="ine-review-btn ine-review-btn--primary ine-review-status-save" disabled hidden>
                        Guardar
                    </button>

                    <button type="button" class="ine-review-btn ine-review-btn--ghost" data-ine-review-close>
                        Cancelar
                    </button>

                    <button type="button" id="ine-btn-reprocess" class="ine-review-btn ine-review-btn--muted">
                        Reprocesar
                    </button>
                </footer>
            </form>
        </article>
    </section>


    <!-- Modal aviso: sección fuera de RED / residencia actual -->

    <section id="red-residence-modal" class="red-residence-modal" hidden aria-hidden="true">
        <div class="red-residence-overlay" data-red-residence-close></div>

        <article class="red-residence-dialog" role="dialog" aria-modal="true" aria-labelledby="red-residence-title">
            <header class="red-residence-header">
                <button type="button" class="red-residence-close" data-red-residence-close aria-label="Cerrar">
                    &times;
                </button>
            </header>

            <div class="red-residence-body">
                <div class="red-residence-icon" aria-hidden="true">!</div>

                <p class="red-residence-kicker">Aviso</p>

                <h2 id="red-residence-title">
                    Detectamos que la "Sección" es de otra RED.
                </h2>

                <p id="red-residence-question" class="red-residence-question">
                    ¿Este residente vive en <strong>Ixtlahuacán de los Membrillos</strong>?
                </p>

                <div id="red-residence-choice" class="red-residence-choice">
                    <button type="button" id="red-residence-yes" class="red-residence-btn red-residence-btn--yes">
                        Si
                    </button>

                    <button type="button" id="red-residence-no" class="red-residence-btn red-residence-btn--no">
                        No
                    </button>
                </div>

                <form id="red-residence-form" class="red-residence-form" autocomplete="off">
                    <label class="red-residence-field red-residence-field--combo">
                        <span>Sección</span>

                        <input type="hidden" id="red-residence-seccion" name="seccion_id">

                        <button type="button" id="red-residence-seccion-toggle" class="red-residence-combo-toggle"
                            disabled aria-haspopup="listbox" aria-expanded="false">
                            <span id="red-residence-seccion-text">Selecciona una sección</span>
                            <span class="red-residence-combo-chevron" aria-hidden="true"></span>
                        </button>

                        <div id="red-residence-seccion-list" class="red-residence-combo-list" role="listbox" hidden>
                        </div>
                    </label>

                    <label class="red-residence-field">
                        <span>Calle actual de residencia</span>
                        <input type="text" id="red-residence-domicilio" name="domicilio_texto"
                            placeholder="Ej. Francisco I. Madero #2, Centro CP.45850" disabled>
                    </label>

                    <label class="red-residence-field">
                        <span>Método de contacto</span>
                        <input type="tel" id="red-residence-telefono" name="telefono" inputmode="tel" minlength="10"
                            maxlength="12" pattern="[0-9]{10,12}" placeholder="Ej. 3333333333"
                            title="Captura entre 10 y 12 números" disabled>
                    </label>

                    <footer class="red-residence-footer">
                        <button type="submit" id="red-residence-submit" class="red-residence-submit" disabled>
                            Enviar
                        </button>
                    </footer>
                </form>
            </div>
        </article>
    </section>

    <!-- Modal aviso: persona duplicada por CURP / clave de elector -->

    <section id="red-duplicate-modal" class="red-duplicate-modal" hidden aria-hidden="true">
        <div class="red-duplicate-overlay" data-red-duplicate-close></div>

        <article class="red-duplicate-dialog" role="dialog" aria-modal="true" aria-labelledby="red-duplicate-title">
            <header class="red-duplicate-header">
                <button type="button" class="red-duplicate-close" data-red-duplicate-close aria-label="Cerrar">
                    &times;
                </button>
            </header>

            <div class="red-duplicate-body">
                <div class="red-duplicate-icon" aria-hidden="true">
                    <span>&#128101;</span>
                </div>

                <p class="red-duplicate-kicker">Aviso</p>

                <h2 id="red-duplicate-title">
                    Persona ya registrada
                </h2>

                <p id="red-duplicate-message" class="red-duplicate-message">
                    Este simpatizante ya ha sido registrado.
                </p>

                <p id="red-duplicate-person" class="red-duplicate-person" hidden></p>

                <p id="red-duplicate-owner" class="red-duplicate-owner"></p>

                <div class="red-duplicate-actions">
                    <button type="button" id="red-duplicate-update" class="red-duplicate-btn red-duplicate-btn--update">
                        Actualizar datos
                    </button>

                    <button type="button" class="red-duplicate-btn red-duplicate-btn--close" data-red-duplicate-close>
                        &larr; Cerrar
                    </button>
                </div>
            </div>
        </article>
    </section>

    <!-- Modal aviso: validación de CURP / clave de elector -->

    <section id="red-validation-modal" class="red-validation-modal" hidden aria-hidden="true">
        <div class="red-validation-overlay" data-red-validation-close></div>

        <article class="red-validation-dialog" role="dialog" aria-modal="true" aria-labelledby="red-validation-title">
            <header class="red-validation-header">
                <button type="button" class="red-validation-close" data-red-validation-close aria-label="Cerrar">
                    &times;
                </button>
            </header>

            <div class="red-validation-body">
                <div class="red-validation-icon" aria-hidden="true">!</div>

                <p class="red-validation-kicker">Validación</p>

                <h2 id="red-validation-title">
                    Documento no válido.
                </h2>

                <p id="red-validation-message" class="red-validation-message">
                    El documento capturado no cumple con la validación esperada.
                </p>

                <div class="red-validation-actions">
                    <button type="button" id="red-validation-recapture"
                        class="red-validation-btn red-validation-btn--primary">
                        Volver a capturar
                    </button>

                    <button type="button" class="red-validation-btn red-validation-btn--close"
                        data-red-validation-close>
                        Cerrar
                    </button>
                </div>
            </div>
        </article>
    </section>

    <section id="red-revoke-affiliate-modal" class="red-revoke-affiliate-modal" hidden aria-hidden="true">
        <div class="red-revoke-affiliate-overlay" data-red-revoke-affiliate-close></div>

        <article class="red-revoke-affiliate-dialog" role="dialog" aria-modal="true"
            aria-labelledby="red-revoke-affiliate-title">
            <header class="red-revoke-affiliate-header">
                <button type="button" class="red-revoke-affiliate-close" data-red-revoke-affiliate-close
                    aria-label="Cerrar">
                    &times;
                </button>
            </header>

            <div class="red-revoke-affiliate-body">
                <div class="red-revoke-affiliate-icon" aria-hidden="true">
                    <span>&times;</span>
                </div>

                <p class="red-revoke-affiliate-kicker">Confirmación</p>

                <h2 id="red-revoke-affiliate-title">
                    ¿Quieres revocar la afiliación?
                </h2>

                <p id="red-revoke-affiliate-message" class="red-revoke-affiliate-message">
                    La persona dejará de estar marcada como afiliada y volverá al estado de simpatizante.
                </p>

                <p id="red-revoke-affiliate-person" class="red-revoke-affiliate-person" hidden></p>

                <div class="red-revoke-affiliate-actions">
                    <button type="button" id="red-revoke-affiliate-confirm"
                        class="red-revoke-affiliate-btn red-revoke-affiliate-btn--danger">
                        Sí, revocar afiliación
                    </button>

                    <button type="button" class="red-revoke-affiliate-btn red-revoke-affiliate-btn--cancel"
                        data-red-revoke-affiliate-close>
                        Cancelar
                    </button>
                </div>
            </div>
        </article>
    </section>
    <footer id="site-footer">
        <div class="limite">

            <div class="footer-cols">
                <div class="col left">
                    <div class="left-inner">
                        <p class="copyright">
                            RED PRI Ixtlahuacán de los Membrillos | Organización, seguimiento y vinculación territorial
                            del partido.
                        </p>
                    </div>
                </div>
                <div class="col right">
                    <p class="location">
                        (c) Copyright 2026, Todos los derechos reservados | GodCode Software | Francisco, C. Madero 1C,
                        Ixtlahuacán de Los Membrillos Centro, La Arena, 45850 Ixtlahuacán de los Membrillos, Jal.
                    </p>
                </div>
            </div>
        </div>
    </footer>

    <!-- componente de sheetjs -->
    <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>

    <script src="/PRI/JS/media.js"></script>
    <script src="/PRI/JS/jsGlobal.js"></script>
    <script src="/PRI/JS/components.js"></script>
    <script type="module" src="/PRI/JS/auth/session.js"></script>
    <script type="module" src="/PRI/JS/home.js"></script>
    <script type="module" src="/PRI/JS/home.modals.js"></script>

</body>

</html>

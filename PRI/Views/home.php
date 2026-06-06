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
                    ×
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
                            <div class="ine-camera-feedback-icon ine-camera-feedback-icon--ok">✓</div>
                            <div class="ine-camera-feedback-icon ine-camera-feedback-icon--error">×</div>
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

                                <button type="button" id="ine-btn-retry" class="ine-capture-btn ine-capture-btn--danger"
                                    hidden>
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






    <!---------------------- Modal revisión / alta de persona desde INE -------------------------->


    <section id="ine-review-modal" class="ine-review-modal" hidden aria-hidden="true">
        <div class="ine-review-overlay" data-ine-review-close></div>

        <article class="ine-review-dialog" role="dialog" aria-modal="true" aria-labelledby="ine-review-title">
            <header class="ine-review-header">
                <div class="ine-review-titlebox">
                    <p class="ine-review-kicker">Datos extraídos</p>
                    <h2 id="ine-review-title">Revisión de información INE</h2>
                </div>

                <button type="button" class="ine-review-close" data-ine-review-close aria-label="Cerrar">
                    ×
                </button>
            </header>

            <form id="ine-review-form" class="ine-review-form" autocomplete="off">
                <div class="ine-review-body">

                    <!-- Resumen -->
                    <section class="ine-review-section ine-review-section--summary">
                        <div class="ine-review-meta">
                            <label class="ine-review-field">
                                <span>Fecha de extracción</span>
                                <input type="text" id="ine-review-fecha-extraccion" name="fecha_extraccion"
                                    placeholder="Fecha de extracción" readonly>
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
                                <input type="text" id="ine-review-curp" name="curp" maxlength="18" placeholder="CURP">
                            </label>

                            <label class="ine-review-field">
                                <span>Clave de elector</span>
                                <input type="text" id="ine-review-clave-elector" name="clave_elector"
                                    placeholder="Clave de elector">
                            </label>

                            <label class="ine-review-field">
                                <span>Sección</span>
                                <input type="text" id="ine-review-seccion" name="seccion_id" inputmode="numeric"
                                    placeholder="Sección">
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
                                <input type="text" id="ine-review-idmex" name="idmex" placeholder="IDMEX">
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
                                    placeholder="Teléfono">
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
                        <h3>Capturas INE</h3>

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

                </div>

                <footer class="ine-review-footer">
                    <button type="submit" id="ine-modal-affiliate" class="ine-review-btn ine-review-btn--primary">
                        Guardar persona
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
                    ×
                </button>
            </header>

            <div class="red-residence-body">
                <div class="red-residence-icon" aria-hidden="true">!</div>

                <p class="red-residence-kicker">Aviso</p>

                <h2 id="red-residence-title">
                    Detectamos que la “Sección” es de otra RED.
                </h2>

                <p class="red-residence-question">
                    ¿Este residente vive en <strong>Ixtlahuacán de los Membrillos</strong>?
                </p>

                <div class="red-residence-choice">
                    <button type="button" id="red-residence-yes" class="red-residence-btn red-residence-btn--yes">
                        Sí
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
                            <span class="red-residence-combo-chevron" aria-hidden="true">⌄</span>
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
                        <input type="text" id="red-residence-telefono" name="telefono" placeholder="Ej. 3333333333"
                            disabled>
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
                    ×
                </button>
            </header>

            <div class="red-duplicate-body">
                <div class="red-duplicate-icon" aria-hidden="true">
                    <span>👥</span>
                </div>

                <p class="red-duplicate-kicker">Aviso</p>

                <h2 id="red-duplicate-title">
                    Persona ya registrada
                </h2>

                <p id="red-duplicate-message" class="red-duplicate-message">
                    Este simpatizante ya ha sido registrado.
                </p>

                <p id="red-duplicate-person" class="red-duplicate-person"></p>

                <p id="red-duplicate-owner" class="red-duplicate-owner"></p>

                <div class="red-duplicate-actions">
                    <button type="button" id="red-duplicate-update" class="red-duplicate-btn red-duplicate-btn--update">
                        Actualizar datos
                    </button>

                    <button type="button" class="red-duplicate-btn red-duplicate-btn--close" data-red-duplicate-close>
                        ← Cerrar
                    </button>
                </div>
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

    <script src="/PRI/JS/media.js"></script>
    <script src="/PRI/JS/JSglobal.js"></script>
    <script src="/PRI/JS/components.js"></script>
    <script type="module" src="/PRI/JS/auth/session.js"></script>
    <script type="module" src="/PRI/JS/home.js"></script>
    <script type="module" src="/PRI/JS/home.modals.js"></script>

</body>

</html>
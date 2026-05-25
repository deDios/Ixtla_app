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
                <div class="icon-mobile">
                    <img src="/ASSETS/social_icons/Facebook_logo.png" alt="Facebook" />
                </div>

                <div class="icon-mobile">
                    <img src="/ASSETS/social_icons/Instagram_logo.png" alt="Instagram" />
                </div>

                <div class="icon-mobile">
                    <img src="/ASSETS/social_icons/Youtube_logo.png" alt="YouTube" />
                </div>

                <div class="icon-mobile">
                    <img src="/ASSETS/social_icons/X_logo.png" alt="X" />
                </div>

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
                <button type="button" class="hamburger" aria-controls="mobile-menu" aria-expanded="false"
                    aria-label="Abrir menú" onclick="toggleMenu()">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
            </div>
        </div>

        <nav id="mobile-menu" class="subnav" aria-label="Navegación secundaria">
            <div class="nav-left">
                <a href="/PRI/Views/home.php">Home</a>
            </div>

            <div class="social-icons">
                <div class="circle-icon">
                    <img src="/ASSETS/social_icons/Facebook_logo.png" alt="Facebook" />
                </div>

                <div class="circle-icon">
                    <img src="/ASSETS/social_icons/Instagram_logo.png" alt="Instagram" />
                </div>

                <div class="circle-icon">
                    <img src="/ASSETS/social_icons/Youtube_logo.png" alt="YouTube" />
                </div>

                <div class="circle-icon">
                    <img src="/ASSETS/social_icons/X_logo.png" alt="X" />
                </div>
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
                        Coloca el frente de la INE dentro del recuadro
                    </h2>

                    <p id="scanner-step-help">
                        Acomoda la credencial y presiona <strong>Capturar</strong>
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
                        <button type="button" id="scanner-btn-capture" class="scanner-btn scanner-btn-capture">
                            Capturar
                        </button>

                        <button type="button" id="scanner-btn-retry" class="scanner-btn scanner-btn-retry" hidden>
                            Reintentar
                        </button>

                        <button type="button" id="scanner-btn-continue" class="scanner-btn scanner-btn-continue" hidden>
                            Continuar
                        </button>

                        <!-- Ocultar cuando salga a producción. Esto es solo para debug. -->
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

        <!-- Modal de revisión / captura de persona -->
        <section id="ine-data-modal" class="ine-data-modal" hidden aria-hidden="true">
            <div class="ine-data-backdrop" data-ine-modal-close></div>

            <article class="ine-data-card" role="dialog" aria-modal="true" aria-labelledby="ine-data-title">
                <header class="ine-data-head ine-data-head--simple">
                    <div class="ine-data-titlebox">
                        <p class="ine-data-kicker">Datos extraídos</p>
                        <h2 id="ine-data-title">Revisión de información INE</h2>
                    </div>

                    <button type="button" class="ine-data-close" data-ine-modal-close aria-label="Cerrar">
                        ×
                    </button>
                </header>

                <form id="ine-persona-form" class="ine-persona-form" autocomplete="off">
                    <div class="ine-data-body">

                        <!-- Resumen de extracción -->
                        <section class="ine-data-section ine-data-section--summary">
                            <div class="ine-data-meta">
                                <div>
                                    <span>Fecha de extracción</span>
                                    <strong id="ine-modal-fecha">--</strong>
                                </div>

                                <div>
                                    <span>Proveedor</span>
                                    <strong id="ine-modal-registrado">--------</strong>
                                </div>
                            </div>

                            <p class="ine-data-help">
                                Revisa los datos antes de guardar. Algunos campos pueden variar según la generación de
                                la INE.
                            </p>
                        </section>

                        <!-- Identidad -->
                        <section class="ine-data-section">
                            <h3>Identidad</h3>

                            <div class="ine-data-grid">
                                <label class="ine-data-field">
                                    <span>Nombre(s) *</span>
                                    <input type="text" id="ine-modal-nombres" name="nombres" placeholder="Nombre(s)"
                                        required>
                                </label>

                                <label class="ine-data-field">
                                    <span>Apellido paterno</span>
                                    <input type="text" id="ine-modal-apellido-paterno" name="apellido_paterno"
                                        placeholder="Apellido paterno">
                                </label>

                                <label class="ine-data-field">
                                    <span>Apellido materno</span>
                                    <input type="text" id="ine-modal-apellido-materno" name="apellido_materno"
                                        placeholder="Apellido materno">
                                </label>

                                <label class="ine-data-field">
                                    <span>Fecha de nacimiento</span>
                                    <input type="date" id="ine-modal-fecha-nacimiento" name="fecha_nacimiento">
                                </label>

                                <label class="ine-data-field">
                                    <span>Sexo</span>
                                    <select id="ine-modal-sexo" name="sexo">
                                        <option value="">Selecciona</option>
                                        <option value="H">H</option>
                                        <option value="M">M</option>
                                        <option value="X">X</option>
                                    </select>
                                </label>

                                <!-- Campo legacy para compatibilidad temporal con JS actual -->
                                <input type="hidden" id="ine-modal-nombre" name="nombre_completo">
                            </div>
                        </section>

                        <!-- Datos INE principales -->
                        <section class="ine-data-section">
                            <h3>Datos de credencial</h3>

                            <div class="ine-data-grid">
                                <label class="ine-data-field">
                                    <span>CURP *</span>
                                    <input type="text" id="ine-modal-curp" name="curp" maxlength="18"
                                        placeholder="CURP">
                                </label>

                                <label class="ine-data-field">
                                    <span>Clave de elector *</span>
                                    <input type="text" id="ine-modal-clave" name="clave_elector"
                                        placeholder="Clave de elector">
                                </label>

                                <label class="ine-data-field">
                                    <span>Sección *</span>
                                    <input type="text" id="ine-modal-seccion" name="seccion" placeholder="Sección">
                                </label>

                                <label class="ine-data-field">
                                    <span>Año de registro</span>
                                    <input type="number" id="ine-modal-anio-registro" name="anio_registro" min="1900"
                                        max="2100" placeholder="Año">
                                </label>

                                <label class="ine-data-field">
                                    <span>Emisión</span>
                                    <input type="number" id="ine-modal-emision" name="emision" min="1900" max="2100"
                                        placeholder="Año">
                                </label>

                                <label class="ine-data-field">
                                    <span>Vigencia inicio</span>
                                    <input type="number" id="ine-modal-vigencia-inicio" name="vigencia_inicio"
                                        min="1900" max="2100" placeholder="Año">
                                </label>

                                <label class="ine-data-field">
                                    <span>Vigencia fin</span>
                                    <input type="number" id="ine-modal-vigencia-fin" name="vigencia_fin" min="1900"
                                        max="2100" placeholder="Año">
                                </label>

                                <!-- Campo legacy para compatibilidad temporal con JS actual -->
                                <input type="hidden" id="ine-modal-vigencia" name="vigencia_texto">
                            </div>
                        </section>

                        <!-- Domicilio -->
                        <section class="ine-data-section">
                            <h3>Domicilio</h3>

                            <div class="ine-data-grid">
                                <label class="ine-data-field ine-data-field--full">
                                    <span>Domicilio completo</span>
                                    <textarea id="ine-modal-domicilio" name="domicilio_texto" rows="3"
                                        placeholder="Domicilio completo extraído de la INE"></textarea>
                                </label>

                                <label class="ine-data-field">
                                    <span>Calle</span>
                                    <input type="text" id="ine-modal-calle" name="calle" placeholder="Calle">
                                </label>

                                <label class="ine-data-field">
                                    <span>Número exterior</span>
                                    <input type="text" id="ine-modal-numero-exterior" name="numero_exterior"
                                        placeholder="Número exterior">
                                </label>

                                <label class="ine-data-field">
                                    <span>Número interior</span>
                                    <input type="text" id="ine-modal-numero-interior" name="numero_interior"
                                        placeholder="Número interior">
                                </label>

                                <label class="ine-data-field">
                                    <span>Colonia</span>
                                    <input type="text" id="ine-modal-colonia" name="colonia" placeholder="Colonia">
                                </label>

                                <label class="ine-data-field">
                                    <span>Localidad</span>
                                    <input type="text" id="ine-modal-localidad" name="localidad"
                                        placeholder="Localidad">
                                </label>

                                <label class="ine-data-field">
                                    <span>Municipio</span>
                                    <input type="text" id="ine-modal-municipio" name="municipio"
                                        placeholder="Municipio">
                                </label>

                                <label class="ine-data-field">
                                    <span>Estado</span>
                                    <input type="text" id="ine-modal-estado" name="estado" placeholder="Estado">
                                </label>

                                <label class="ine-data-field">
                                    <span>Código postal</span>
                                    <input type="text" id="ine-modal-codigo-postal" name="codigo_postal" maxlength="10"
                                        placeholder="Código postal">
                                </label>
                            </div>
                        </section>

                        <!-- Contacto -->
                        <section class="ine-data-section">
                            <h3>Contacto</h3>

                            <div class="ine-data-grid">
                                <label class="ine-data-field">
                                    <span>Teléfono</span>
                                    <input type="tel" id="ine-modal-telefono" name="telefono" placeholder="Teléfono">
                                </label>

                                <label class="ine-data-field">
                                    <span>WhatsApp</span>
                                    <input type="tel" id="ine-modal-whatsapp" name="whatsapp" placeholder="WhatsApp">
                                </label>

                                <label class="ine-data-field">
                                    <span>Email</span>
                                    <input type="email" id="ine-modal-email" name="email"
                                        placeholder="correo@ejemplo.com">
                                </label>
                            </div>
                        </section>

                        <!-- Consentimiento -->
                        <section class="ine-data-section">
                            <h3>Consentimiento</h3>

                            <div class="ine-consent-list">
                                <label class="ine-consent-item">
                                    <input type="checkbox" id="ine-modal-acepta-tratamiento"
                                        name="acepta_tratamiento_datos" value="1">
                                    <span>Acepta tratamiento de datos personales *</span>
                                </label>

                                <label class="ine-consent-item">
                                    <input type="checkbox" id="ine-modal-acepta-sensibles" name="acepta_datos_sensibles"
                                        value="1">
                                    <span>Acepta tratamiento de datos sensibles *</span>
                                </label>

                                <label class="ine-consent-item">
                                    <input type="checkbox" id="ine-modal-acepta-whatsapp"
                                        name="acepta_contacto_whatsapp" value="1">
                                    <span>Acepta contacto por WhatsApp</span>
                                </label>
                            </div>

                            <input type="hidden" id="ine-modal-aviso-version" name="aviso_privacidad_version"
                                value="v1">
                        </section>

                        <!-- Datos opcionales por generación de INE -->
                        <details class="ine-data-details">
                            <summary>Datos opcionales de generación INE</summary>

                            <section class="ine-data-section ine-data-section--inside">
                                <div class="ine-data-grid">
                                    <label class="ine-data-field">
                                        <span>Estado número</span>
                                        <input type="text" id="ine-modal-estado-num" name="estado_num"
                                            placeholder="Ej. 14">
                                    </label>

                                    <label class="ine-data-field">
                                        <span>Municipio número</span>
                                        <input type="text" id="ine-modal-municipio-num" name="municipio_num"
                                            placeholder="Ej. 031">
                                    </label>

                                    <label class="ine-data-field">
                                        <span>Localidad número</span>
                                        <input type="text" id="ine-modal-localidad-num" name="localidad_num"
                                            placeholder="Ej. 0011">
                                    </label>
                                </div>
                            </section>
                        </details>

                        <!-- Datos técnicos del reverso -->
                        <details class="ine-data-details">
                            <summary>Datos técnicos del reverso</summary>

                            <section class="ine-data-section ine-data-section--inside">
                                <div class="ine-data-grid">
                                    <label class="ine-data-field">
                                        <span>OCR</span>
                                        <input type="text" id="ine-modal-ocr" name="ocr" placeholder="OCR">
                                    </label>

                                    <label class="ine-data-field">
                                        <span>CIC</span>
                                        <input type="text" id="ine-modal-cic" name="cic" placeholder="CIC">
                                    </label>

                                    <label class="ine-data-field">
                                        <span>IDMEX</span>
                                        <input type="text" id="ine-modal-idmex" name="idmex" placeholder="IDMEX">
                                    </label>
                                </div>
                            </section>
                        </details>

                        <!-- Observaciones -->
                        <section class="ine-data-section">
                            <h3>Observaciones</h3>

                            <div class="ine-data-grid">
                                <label class="ine-data-field ine-data-field--full">
                                    <span>Observaciones del capturista</span>
                                    <textarea id="ine-modal-observaciones" name="observaciones" rows="3"
                                        placeholder="Notas internas, correcciones manuales o dudas de captura"></textarea>
                                </label>
                            </div>
                        </section>

                        <!-- Capturas -->
                        <details class="ine-data-details">
                            <summary>Capturas INE</summary>

                            <div class="ine-preview-row">
                                <figure>
                                    <img id="ine-modal-front" src="" alt="Captura frontal de INE">
                                    <figcaption>Frente</figcaption>
                                </figure>

                                <figure>
                                    <img id="ine-modal-back" src="" alt="Captura posterior de INE">
                                    <figcaption>Reverso</figcaption>
                                </figure>
                            </div>
                        </details>

                        <!-- JSON debug -->
                        <details class="ine-json-debug">
                            <summary>Ver JSON de extracción</summary>
                            <pre id="ine-modal-json">{}</pre>
                        </details>

                        <!-- Campo legacy para compatibilidad temporal con JS actual -->
                        <input type="hidden" id="ine-modal-editado" name="editado_por">
                    </div>

                    <footer class="ine-data-footer">
                        <button type="button" class="ine-data-secondary" data-ine-modal-close>
                            Cancelar
                        </button>

                        <button type="button" id="ine-modal-reprocess" class="ine-data-secondary">
                            Reprocesar
                        </button>

                        <button type="submit" id="ine-modal-affiliate" class="ine-affiliate-btn">
                            Guardar persona
                        </button>
                    </footer>
                </form>
            </article>
        </section>

        <section class="ine-data-section">
            <h3>Contacto</h3>

            <div class="ine-data-grid">
                <label class="ine-data-field">
                    <span>Teléfono</span>
                    <input type="tel" id="ine-modal-telefono" name="telefono" placeholder="Teléfono">
                </label>

                <label class="ine-data-field">
                    <span>WhatsApp</span>
                    <input type="tel" id="ine-modal-whatsapp" name="whatsapp" placeholder="WhatsApp">
                </label>

                <label class="ine-data-field">
                    <span>Email</span>
                    <input type="email" id="ine-modal-email" name="email" placeholder="correo@ejemplo.com">
                </label>
            </div>
        </section>

        <section class="ine-data-section">
            <h3>Consentimiento</h3>

            <div class="ine-consent-list">
                <label class="ine-consent-item">
                    <input type="checkbox" id="ine-modal-acepta-tratamiento" name="acepta_tratamiento_datos" value="1">
                    <span>Acepta tratamiento de datos personales</span>
                </label>

                <label class="ine-consent-item">
                    <input type="checkbox" id="ine-modal-acepta-sensibles" name="acepta_datos_sensibles" value="1">
                    <span>Acepta tratamiento de datos sensibles</span>
                </label>

                <label class="ine-consent-item">
                    <input type="checkbox" id="ine-modal-acepta-whatsapp" name="acepta_contacto_whatsapp" value="1">
                    <span>Acepta contacto por WhatsApp</span>
                </label>
            </div>

            <input type="hidden" id="ine-modal-aviso-version" name="aviso_privacidad_version" value="v1">
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

        <section class="ine-data-section">
            <h3>Observaciones</h3>

            <label class="ine-data-field ine-data-field--full">
                <span>Notas adicionales</span>
                <textarea id="ine-modal-observaciones" name="observaciones" rows="3"
                    placeholder="Observaciones opcionales"></textarea>
            </label>
        </section>

        <details class="ine-json-debug">
            <summary>Ver JSON debug</summary>
            <pre id="ine-modal-json">{}</pre>
        </details>

        <!-- Campo legacy para compatibilidad temporal con JS actual -->
        <input type="hidden" id="ine-modal-editado" name="editado_por">
        </div>

        <footer class="ine-data-footer">
            <button type="button" class="ine-data-secondary" data-ine-modal-close>
                Cancelar
            </button>

            <button type="button" id="ine-modal-reprocess" class="ine-data-secondary">
                Reprocesar
            </button>

            <button type="submit" id="ine-modal-affiliate" class="ine-affiliate-btn">
                Guardar persona
            </button>
        </footer>
        </form>
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
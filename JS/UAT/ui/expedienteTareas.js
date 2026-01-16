// /JS/expedienteTareas.js
// Generador de expediente PDF/impresión para tareas del kanban
"use strict";

(function () {
  const TAG = "[KB Expediente]";
  const log = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);
  const err = (...a) => console.error(TAG, ...a);
  const toast = (m, t = "info") =>
    window.gcToast ? gcToast(m, t) : log("[toast]", t, m);

  log("Archivo cargado (hook de expediente listo).");

  /**
   * Helper seguro para leer texto de un elemento.
   */
  function getText(selector) {
    const el = document.querySelector(selector);
    if (!el) return "—";
    return (el.textContent || "").trim() || "—";
  }

  /**
   * Construye el HTML del expediente.
   * IMPORTANTE: aquí solo usamos los DATOS PRINCIPALES del drawer.
   * NO incluimos evidencias ni comentarios.
   */
  function buildExpedienteHtml(data) {
    const {
      folio,
      proceso,
      tarea,
      asignado,
      esfuerzo,
      descripcion,
      creadoPor,
      autoriza,
    } = data;

    const now = new Date();
    const fechaStr = now.toLocaleString("es-MX", {
      dateStyle: "full",
      timeStyle: "short",
    });

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Expediente de tarea ${folio || ""}</title>
  <style>
    :root {
      --c-bg: #f3f4f6;
      --c-card: #ffffff;
      --c-line: #d1d5db;
      --c-text: #111827;
      --c-sub: #6b7280;
      --c-brand: #859F8E;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
        sans-serif;
      background: var(--c-bg);
      color: var(--c-text);
    }

    body {
      padding: 24px;
    }

    .exp-wrap {
      max-width: 900px;
      margin: 0 auto;
      background: var(--c-card);
      border-radius: 16px;
      border: 1px solid var(--c-line);
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
      padding: 24px 28px 28px;
    }

    .exp-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 18px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 14px;
    }

    .exp-header-main h1 {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 700;
      color: #111827;
    }

    .exp-header-main .exp-subtitle {
      margin-top: 4px;
      font-size: 0.85rem;
      color: var(--c-sub);
    }

    .exp-header-meta {
      text-align: right;
      font-size: 0.78rem;
      color: #6b7280;
    }

    .exp-header-meta span {
      display: block;
    }

    .exp-tag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 0.75rem;
      background: #e5f3ec;
      color: #14532d;
      border: 1px solid #bae6c9;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-top: 4px;
    }

    .exp-section {
      margin-top: 18px;
    }

    .exp-section-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: #374151;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }

    .exp-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
      gap: 10px 24px;
      font-size: 0.9rem;
    }

    .exp-field {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .exp-label {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #6b7280;
    }

    .exp-value {
      font-size: 0.95rem;
      color: #111827;
      word-wrap: break-word;
    }

    .exp-desc {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px dashed #e5e7eb;
    }

    .exp-desc .exp-value {
      white-space: pre-wrap;
      line-height: 1.4;
    }

    .exp-footer {
      margin-top: 22px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      font-size: 0.78rem;
      color: #6b7280;
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }

    .exp-footer small {
      display: block;
    }

    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .exp-wrap {
        box-shadow: none;
        border-radius: 0;
        border: none;
        max-width: 100%;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <main class="exp-wrap">
    <header class="exp-header">
      <div class="exp-header-main">
        <h1>Expediente de tarea</h1>
        <p class="exp-subtitle">
          Documento generado desde el módulo de tareas (Ixtla App).
        </p>
        ${
          folio && folio !== "—"
            ? `<span class="exp-tag">Folio ${folio}</span>`
            : ""
        }
      </div>
      <div class="exp-header-meta">
        ${
          tarea && tarea !== "—"
            ? `<span><strong>Tarea:</strong> ${tarea}</span>`
            : ""
        }
        <span>Emitido el: ${fechaStr}</span>
      </div>
    </header>

    <section class="exp-section">
      <h2 class="exp-section-title">Datos principales</h2>
      <div class="exp-grid">
        <div class="exp-field">
          <span class="exp-label">Folio</span>
          <span class="exp-value">${folio}</span>
        </div>

        <div class="exp-field">
          <span class="exp-label">Proceso</span>
          <span class="exp-value">${proceso}</span>
        </div>

        <div class="exp-field">
          <span class="exp-label">Tarea</span>
          <span class="exp-value">${tarea}</span>
        </div>

        <div class="exp-field">
          <span class="exp-label">Asignado a</span>
          <span class="exp-value">${asignado}</span>
        </div>

        <div class="exp-field">
          <span class="exp-label">Esfuerzo (horas)</span>
          <span class="exp-value">${esfuerzo}</span>
        </div>

        <div class="exp-field">
          <span class="exp-label">Creado por</span>
          <span class="exp-value">${creadoPor}</span>
        </div>

        <div class="exp-field">
          <span class="exp-label">Quien autoriza</span>
          <span class="exp-value">${autoriza}</span>
        </div>
      </div>

      <div class="exp-desc">
        <div class="exp-field">
          <span class="exp-label">Descripción</span>
          <span class="exp-value">${descripcion}</span>
        </div>
      </div>
    </section>

    <footer class="exp-footer">
      <div>
        <small>Generado automáticamente desde Ixtla App.</small>
        <small>Este documento es un apoyo operativo y no sustituye el expediente oficial del requerimiento.</small>
      </div>
      <div>
        <small>Folio interno: ${
          folio && folio !== "—" ? folio : "N/D"
        }</small>
        <small>ID de impresión: ${Date.now()}</small>
      </div>
    </footer>
  </main>
</body>
</html>`;
  }

  /**
   * Verifica que haya tarea seleccionada en el drawer.
   */
  function isDrawerReady() {
    const body = document.getElementById("kb-d-body");
    const folio = getText("#kb-d-folio");
    const hidden = !body || body.hasAttribute("hidden");

    if (hidden) {
      return false;
    }
    if (!folio || folio === "—") {
      return false;
    }
    return true;
  }

  /**
   * Handler del botón "Generar expediente".
   */
  function onClickExpediente() {
    log("Click en 'Generar expediente'");

    if (!isDrawerReady()) {
      toast("Primero selecciona una tarea del tablero.", "warning");
      return;
    }

    const data = {
      folio: getText("#kb-d-folio"),
      proceso: getText("#kb-d-proceso"),
      tarea: getText("#kb-d-tarea"),
      asignado: getText("#kb-d-asignado"),
      esfuerzo: getText("#kb-d-esfuerzo"),
      descripcion: getText("#kb-d-desc"),
      creadoPor: getText("#kb-d-creado-por"),
      autoriza: getText("#kb-d-autoriza"),
    };

    log("Datos para expediente:", data);

    const html = buildExpedienteHtml(data);

    let win = null;
    try {
      win = window.open("", "_blank");
    } catch (e) {
      err("Error al abrir la ventana del expediente:", e);
    }

    if (!win) {
      toast(
        "No se pudo abrir la vista de impresión (revisa el bloqueador de ventanas emergentes).",
        "error"
      );
      return;
    }

    win.document.open();
    win.document.write(html);
    win.document.close();

    // Opcional: intentamos lanzar el diálogo de impresión
    try {
      win.focus();
      win.print();
    } catch (e) {
      // Si el navegador bloquea print(), no pasa nada.
      log("No se pudo lanzar print() automáticamente:", e);
    }
  }

  /**
   * Inicializa el hook del botón.
   * Como el script está al final del body, podemos ejecutar init() directo.
   */
  function init() {
    const btn = document.getElementById("kb-btn-expediente");
    if (!btn) {
      warn("Botón #kb-btn-expediente no encontrado en el DOM.");
      return;
    }

    btn.addEventListener("click", onClickExpediente);
    log("Listener de 'Generar expediente' conectado.");
  }

  // Ejecutamos inmediatamente (el HTML ya está cargado)
  init();
})();
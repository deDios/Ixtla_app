// /JS/ui/requerimientoExpediente.js
(function () {
  "use strict";

  const TAG = "[ReqExpediente]";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const log = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);
  const err = (...a) => console.error(TAG, ...a);
  const toast = (m, t = "info") =>
    window.gcToast ? gcToast(m, t) : log("[toast]", t, m);

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* =========================
   *  Extractores de datos DOM
   * ========================= */

  function getReqFromGlobal() {
    // Lo llena requerimientoView.js → loadReqUI()
    return window.__REQ__ || null;
  }

  function getHeaderInfo() {
    const titleEl = $(".exp-view .exp-title h1");
    const metaRoot = $(".exp-view .exp-meta");

    const title = titleEl ? titleEl.textContent.trim() : "";
    const meta = [];

    if (metaRoot) {
      metaRoot.querySelectorAll("div").forEach((div) => {
        const dt = div.querySelector("dt");
        const dd = div.querySelector("dd");
        const label = dt ? dt.textContent.trim() : "";
        const value = dd ? dd.textContent.trim() : "";
        if (label || value) {
          meta.push({ label, value });
        }
      });
    }

    const req = getReqFromGlobal();
    const folio =
      (req && (req.folio || req.folio_req || "")) ||
      (title && title.match(/REQ-\d+/)?.[0]) ||
      "";

    // Si el folio no viene en el meta, lo agregamos
    const hasFolio = meta.some((m) => m.label.toLowerCase().includes("folio"));

    if (folio && !hasFolio) {
      meta.unshift({
        label: "Folio",
        value: folio,
      });
    }

    return { title, folio, meta };
  }

  function collectGridRowsByTab(tabName) {
    const pane = `.exp-pane[role="tabpanel"][data-tab="${tabName}"]`;
    const root = $(pane);
    if (!root) return [];

    const rows = [];
    root.querySelectorAll(".exp-grid .exp-field").forEach((field) => {
      const labelEl = field.querySelector("label");
      const valEl = field.querySelector(".exp-val");
      const label = labelEl ? labelEl.textContent.trim() : "";

      let value = "";
      if (valEl) {
        // Caso especial: campo Estatus (req-status)
        if (valEl.id === "req-status") {
          const badge = valEl.querySelector("[data-role='status-badge']");
          value = badge ? badge.textContent.trim() : valEl.textContent.trim();
        } else {
          value = valEl.textContent.trim();
        }
      }

      if (label || value) {
        rows.push({ label, value });
      }
    });
    return rows;
  }

  function collectPlaneacion() {
    const list = $("#planeacion-list");
    if (!list) return [];

    const fases = [];
    list.querySelectorAll(".exp-accordion--fase").forEach((faseEl, idx) => {
      const titleEl = faseEl.querySelector(".fase-title");
      const metaEl = faseEl.querySelector(".fase-meta");

      const title =
        (titleEl && titleEl.textContent.trim()) || `Fase ${idx + 1}`;
      const meta = metaEl ? metaEl.textContent.trim() : "";

      const tareas = [];
      const table = faseEl.querySelector(".exp-table.exp-table--planeacion");
      if (table) {
        table.querySelectorAll(".exp-row").forEach((row) => {
          const cells = Array.from(row.children).map((c) =>
            c.textContent.trim()
          );
          if (cells.some((c) => c.length)) {
            // La tabla en la vista tiene 5 columnas: Actividad, Responsable, Estatus, %, Fecha
            const [actividad, responsable, estatus, porcentaje, fecha] = cells;
            tareas.push({
              actividad,
              responsable,
              estatus,
              porcentaje,
              fecha,
            });
          }
        });
      }

      fases.push({ title, meta, tareas });
    });

    return fases;
  }

  // Nota: dejamos de usar evidencias en el expediente (solo datos principales)
  // por lo que no necesitamos collectEvidencias() aquí.

  /* =========================
   *  Render HTML para imprimir
   * ========================= */

  function renderMetaTable(meta) {
    if (!meta || !meta.length) return "";
    const rows = meta
      .map(
        (m) => `<tr>
            <th>${escapeHtml(m.label || "")}</th>
            <td>${escapeHtml(m.value || "")}</td>
          </tr>`
      )
      .join("");
    return `
      <table class="meta-table">
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  function renderSimpleTableSection(title, rows) {
    if (!rows || !rows.length) return "";
    const body = rows
      .map(
        (r) => `<tr>
            <th>${escapeHtml(r.label || "")}</th>
            <td>${escapeHtml(r.value || "")}</td>
          </tr>`
      )
      .join("");

    return `
      <section class="section">
        <h2 class="section-title">${escapeHtml(title)}</h2>
        <table>
          <tbody>
            ${body}
          </tbody>
        </table>
      </section>
    `;
  }

  function renderPlaneacionSection(fases) {
    if (!fases || !fases.length) return "";
    const bloques = fases
      .map((fase, idx) => {
        const tareasRows =
          (fase.tareas || [])
            .map(
              (t) =>
                `<tr>
                  <td>${escapeHtml(t.actividad || "")}</td>
                  <td>${escapeHtml(t.responsable || "")}</td>
                  <td>${escapeHtml(t.estatus || "")}</td>
                  <td>${escapeHtml(t.fecha || "")}</td>
                </tr>`
            )
            .join("") ||
          `<tr><td colspan="4">Sin tareas registradas.</td></tr>`;

        return `
          <div class="fase-block">
            <div class="fase-headline">
              <span class="fase-title">${escapeHtml(
                fase.title || `Fase ${idx + 1}`
              )}</span>
              ${
                fase.meta
                  ? `<span class="fase-meta">${escapeHtml(fase.meta)}</span>`
                  : ""
              }
            </div>
            <table class="fase-table">
              <thead>
                <tr>
                  <th>Actividad</th>
                  <th>Responsable</th>
                  <th>Estatus</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                ${tareasRows}
              </tbody>
            </table>
          </div>
        `;
      })
      .join("");

    return `
      <section class="section">
        <h2 class="section-title">Planeación</h2>
        ${bloques}
      </section>
    `;
  }

  // También eliminamos completamente el render de evidencias del documento.

  function buildDocumentHtml() {
    const header = getHeaderInfo();
    const contacto = collectGridRowsByTab("contacto");
    const detalles = collectGridRowsByTab("detalles");
    const planeacion = collectPlaneacion();

    const now = new Date();
    const fechaGen = now.toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });

    const tituloDoc = header.folio
      ? `Expediente ${header.folio}`
      : "Expediente de requerimiento";

    const contactoSection = renderSimpleTableSection("Contacto", contacto);
    const detallesSection = renderSimpleTableSection(
      "Detalles del requerimiento",
      detalles
    );
    const planeacionSection = renderPlaneacionSection(planeacion);

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(tituloDoc)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 24px;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: #111827;
      font-size: 13px;
    }
    h1, h2, h3 { margin: 0 0 .4rem; }
    .exp-header {
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .exp-header-title {
      font-size: 18px;
      font-weight: 800;
    }
    .exp-header-sub {
      font-size: 13px;
      color: #4b5563;
      margin-top: 2px;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
    }
    .meta-table th,
    .meta-table td {
      border: 1px solid #e5e7eb;
      padding: 4px 6px;
      font-size: 12px;
      vertical-align: top;
    }
    .meta-table th {
      width: 30%;
      background: #f3f4f6;
      text-align: left;
      font-weight: 600;
      color: #374151;
    }
    .section {
      margin-top: 16px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 4px;
      color: #111827;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #e5e7eb;
      padding: 4px 6px;
      vertical-align: top;
    }
    th {
      background: #f3f4f6;
      text-align: left;
      font-weight: 600;
      color: #374151;
    }
    .fase-block {
      margin-top: 8px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      padding: 8px 10px;
    }
    .fase-headline {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 4px;
    }
    .fase-title {
      font-weight: 700;
      color: #111827;
      font-size: 13px;
    }
    .fase-meta {
      font-size: 11px;
      color: #6b7280;
    }
    .fase-table {
      margin-top: 4px;
      font-size: 11px;
    }
    .small {
      font-size: 11px;
      color: #6b7280;
    }
    .footer-note {
      margin-top: 18px;
      padding-top: 8px;
      border-top: 1px dashed #e5e7eb;
      font-size: 11px;
      color: #6b7280;
    }
    @page { margin: 20mm; }
  </style>
</head>
<body>
  <header class="exp-header">
    <div class="exp-header-title">${escapeHtml(
      header.title || "Expediente de requerimiento"
    )}</div>
    ${
      header.folio
        ? `<div class="exp-header-sub">Folio: ${escapeHtml(header.folio)}</div>`
        : ""
    }
    <div class="exp-header-sub">Generado el ${escapeHtml(fechaGen)}</div>
    ${renderMetaTable(header.meta)}
  </header>

  ${contactoSection}
  ${detallesSection}
  ${planeacionSection}

  <div class="footer-note">
    Expediente generado automáticamente desde Ixtla App.
    Puede contener información sujeta a cambios posteriores en el sistema.
  </div>
</body>
</html>
    `.trim();
  }

  /* =========================
   *  Impresión
   * ========================= */

  function openPrintWindow(html) {
    const safeHtml = String(html || "");
    log("[ReqExpediente] Longitud HTML:", safeHtml.length);

    // 1) Intento normal: nueva pestaña
    const win = window.open("", "_blank");

    if (!win) {
      // 2) Fallback: misma pestaña si se bloquean popups
      warn("[ReqExpediente] Popup bloqueado; usando fallback same-tab");

      toast(
        "Tu navegador bloqueó la ventana nueva. Abriré el expediente en esta pestaña.",
        "warning"
      );

      try {
        const blob = new Blob([safeHtml], {
          type: "text/html;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        window.location.href = url; // reemplaza la vista actual
      } catch (e) {
        err("[ReqExpediente] Error en fallback same-tab:", e);
        toast("No se pudo mostrar el expediente.", "error");
      }

      return;
    }

    // Si sí nos dejó abrir la nueva pestaña:
    try {
      win.document.open();
      win.document.write(safeHtml);
      win.document.close();
    } catch (e) {
      err("Error usando document.write en ventana de impresión:", e);
      try {
        win.document.body.innerHTML =
          "<pre style='font-family:monospace; white-space:pre-wrap;'>" +
          safeHtml.replace(
            /[&<>]/g,
            (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])
          ) +
          "</pre>";
      } catch (e2) {
        err("Error también al usar innerHTML:", e2);
        win.document.body.innerHTML =
          "<p>Ocurrió un error al generar el expediente.</p>";
      }
    }

    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch (e) {
        err("Error al enviar a impresión:", e);
      }
    }, 400);
  }

  function onGenerateExpedienteClick() {
    const req = getReqFromGlobal();
    if (!req) {
      warn(
        "No hay __REQ__ global; se generará sólo con lo visible en pantalla."
      );
    }

    try {
      const html = buildDocumentHtml();
      log("buildDocumentHtml() OK, longitud:", html ? html.length : 0);
      openPrintWindow(html);
    } catch (e) {
      err("Error generando expediente:", e);
      toast("Ocurrió un error al generar el expediente.", "error");
    }
  }

  function boot() {
    const btn = $("#btn-expediente");
    if (!btn) {
      log("No se encontró #btn-expediente; módulo inactivo.");
      return;
    }

    btn.addEventListener("click", onGenerateExpedienteClick);
    log("Módulo de expediente listo.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

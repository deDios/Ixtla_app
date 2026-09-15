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

  function normTab(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();
  }

  function findPaneByTab(tabName) {
    const wanted = normTab(tabName);
    // Match exact (fast path)
    let root = $(`.exp-pane[role="tabpanel"][data-tab="${tabName}"]`);
    if (root) return root;

    // Common variants (Contacto/Detalles casing)
    root =
      $(
        `.exp-pane[role="tabpanel"][data-tab="${String(
          tabName || ""
        ).toLowerCase()}"]`
      ) ||
      $(
        `.exp-pane[role="tabpanel"][data-tab="${String(
          tabName || ""
        ).toUpperCase()}"]`
      );
    if (root) return root;

    // Robust path: scan all panes and compare normalized data-tab
    const panes = $$(".exp-pane[role='tabpanel'][data-tab]");
    return panes.find((p) => normTab(p.dataset.tab) === wanted) || null;
  }

  function collectGridRowsByTab(tabName) {
    const root = findPaneByTab(tabName);
    if (!root) return [];

    const rows = [];
    root.querySelectorAll(".exp-grid .exp-field").forEach((field) => {
      const labelEl = field.querySelector("label");
      const valEl = field.querySelector(".exp-val");
      const label = labelEl ? labelEl.textContent.trim() : "";

      let value = "";
      if (valEl) {
        // 🔧 Caso especial: Estatus → solo el badge actual
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

  function collectEvidencias() {
    // (Se deja por compatibilidad, pero ya no se usará en el PDF)
    const accordions = $$(".exp-view .exp-accordion");
    let evidAccordion = null;

    for (const acc of accordions) {
      const head = acc.querySelector(".exp-acc-head");
      if (!head) continue;
      const txt = head.textContent.toLowerCase();
      if (txt.includes("evidencia")) {
        evidAccordion = acc;
        break;
      }
    }

    if (!evidAccordion) return [];

    const table = evidAccordion.querySelector(".exp-table");
    if (!table) return [];

    const rows = [];
    table.querySelectorAll(".exp-row").forEach((row) => {
      const cells = Array.from(row.children).map((c) => c.textContent.trim());
      if (cells.some((c) => c.length)) {
        rows.push(cells);
      }
    });

    return rows;
  }

  /* =========================
   *  Render HTML para imprimir
   * ========================= */

  function renderMetaTable(meta) {
    if (!meta || !meta.length) return "";
    const rows = meta
      .map(
        (m) =>
          `<tr>
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
        (r) =>
          `<tr>
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

  function renderEvidenciasSection(rows) {
    // Ya no se usa, pero se deja por si luego quieres reactivarlo.
    if (!rows || !rows.length) return "";
    const body = rows
      .map(
        (cells) =>
          `<tr>${cells
            .map((c) => `<td>${escapeHtml(c || "")}</td>`)
            .join("")}</tr>`
      )
      .join("");

    return `
      <section class="section">
        <h2 class="section-title">Evidencias</h2>
        <p class="small">
          Nota: este listado resume los archivos/enlaces asociados al requerimiento
          al momento de generación del expediente.
        </p>
        <table>
          <tbody>
            ${body}
          </tbody>
        </table>
      </section>
    `;
  }

  function printableMapTiles(lat, lng) {
    const zoom = 15;
    const width = 560;
    const height = 280;
    const tilesPerAxis = 2 ** zoom;
    const worldPixels = tilesPerAxis * 256;
    const latitudeRadians = (lat * Math.PI) / 180;
    const sine = Math.max(-0.9999, Math.min(0.9999, Math.sin(latitudeRadians)));
    const centerX = ((lng + 180) / 360) * worldPixels;
    const centerY = (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * worldPixels;
    const left = centerX - width / 2;
    const top = centerY - height / 2;
    const images = [];

    for (let tileY = Math.floor(top / 256); tileY <= Math.floor((top + height - 1) / 256); tileY++) {
      if (tileY < 0 || tileY >= tilesPerAxis) continue;
      for (let tileX = Math.floor(left / 256); tileX <= Math.floor((left + width - 1) / 256); tileX++) {
        const wrappedX = ((tileX % tilesPerAxis) + tilesPerAxis) % tilesPerAxis;
        images.push(`<img class="geo-map-tile" src="https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png" alt="" style="left:${Math.round(tileX * 256 - left)}px;top:${Math.round(tileY * 256 - top)}px">`);
      }
    }
    return images.join("");
  }

  function renderGeolocationSection(record, queryFailed = false) {
    if (queryFailed) {
      return '<section class="section"><h2 class="section-title">Geolocalización</h2><p>No se pudo verificar la geolocalización registrada al generar este expediente.</p></section>';
    }
    if (!record || record.latitud == null || record.longitud == null) return "";
    const lat = Number(record.latitud);
    const lng = Number(record.longitud);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return "";

    const latitude = lat.toFixed(6);
    const longitude = lng.toFixed(6);
    const precision = Number(record.precision_metros ?? record.presicion_metros);
    const capturedAt = record.captured_at || record.created_at;
    const capturedDate = capturedAt && !Number.isNaN(Date.parse(capturedAt))
      ? new Date(capturedAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })
      : "No disponible";
    const status = Number(record.validada) === 1 || record.validada === true
      ? "Validada"
      : "Pendiente de validación";
    const mapUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
    const rows = [
      { label: "Estado", value: status },
      { label: "Coordenadas", value: `${latitude}, ${longitude}` },
      { label: "Dirección aproximada", value: record.direccion || "No disponible" },
      { label: "Precisión registrada", value: Number.isFinite(precision) && precision > 0 ? `${Math.round(precision)} m` : "No disponible" },
      { label: "Capturada el", value: capturedDate },
    ];

    return `
      <section class="section geo-section">
        <h2 class="section-title">Geolocalización</h2>
        <table><tbody>${rows.map((row) => `<tr><th>${escapeHtml(row.label)}</th><td>${escapeHtml(row.value)}</td></tr>`).join("")}</tbody></table>
        <div class="geo-map" role="img" aria-label="Mapa de la ubicación registrada">
          <span class="geo-map-fallback">Mapa de la ubicación registrada</span>
          ${printableMapTiles(lat, lng)}
          <span class="geo-map-pin" aria-hidden="true"></span>
          <span class="geo-map-attribution">© OpenStreetMap contributors · openstreetmap.org/copyright</span>
        </div>
        <p class="small">Ubicación registrada: <a href="${escapeHtml(mapUrl)}">${escapeHtml(mapUrl)}</a></p>
      </section>
    `;
  }

  function buildDocumentHtml(geolocation = null, geoQueryFailed = false) {
    const header = getHeaderInfo();
    const contacto = collectGridRowsByTab("contacto");
    const detalles = collectGridRowsByTab("detalles");
    const planeacion = collectPlaneacion();
    // 🔧 evidencias ya no se usan en el PDF:
    // const evidencias = collectEvidencias();

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
    const geolocationSection = renderGeolocationSection(geolocation, geoQueryFailed);
    // const evidenciasSection = renderEvidenciasSection(evidencias);

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(tituloDoc)}</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      margin: 24px;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: #111827;
      font-size: 13px;
    }
    h1, h2, h3 {
      margin: 0 0 .4rem;
    }
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
    .geo-map {
      position: relative;
      width: 560px;
      max-width: 100%;
      height: 280px;
      overflow: hidden;
      margin: 8px 0 4px;
      border: 1px solid #d1d5db;
      background: #edf2f3;
    }
    .geo-map-tile {
      position: absolute;
      width: 256px;
      height: 256px;
      max-width: none;
    }
    .geo-map-fallback {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: #52616b;
      font-size: 12px;
    }
    .geo-map-pin {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 18px;
      height: 18px;
      transform: translate(-50%, -50%);
      border: 3px solid #fff;
      border-radius: 50%;
      background: #cf3947;
      box-shadow: 0 1px 5px #374151;
    }
    .geo-map-attribution {
      position: absolute;
      right: 2px;
      bottom: 2px;
      padding: 2px 4px;
      background: rgba(255, 255, 255, .9);
      font-size: 9px;
      color: #111827;
    }
    .geo-section a { overflow-wrap: anywhere; }

    @page {
      margin: 20mm;
    }
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
  ${geolocationSection}
  <!-- Evidencias removidas del expediente -->

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

  function openPrintWindow(html, win) {
    const safeHtml = String(html || "");
    log("[ReqExpediente] Longitud HTML:", safeHtml.length);

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

    const images = Array.from(win.document.querySelectorAll(".geo-map-tile"));
    const imageSettled = Promise.all(images.map((image) => new Promise((resolve) => {
      if (image.complete) { resolve(); return; }
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    })));
    // La impresión no debe quedar bloqueada si el servidor de teselas tarda.
    Promise.race([imageSettled, new Promise((resolve) => setTimeout(resolve, 6000))])
      .then(() => {
        setTimeout(() => {
          try {
            if (win.closed) return;
            win.focus();
            win.print();
          } catch (e) {
            err("Error al enviar a impresión:", e);
          }
        }, 300);
      });
  }

  async function onGenerateExpedienteClick() {
    const req = getReqFromGlobal();
    if (!req) {
      warn(
        "No hay __REQ__ global; se generará sólo con lo visible en pantalla."
      );
    }

    // Abrir durante el click evita que el navegador bloquee la ventana después
    // de esperar la consulta de geolocalización.
    const win = window.open("", "_blank");
    if (!win) {
      warn("Popup bloqueado; expediente no se pudo abrir en nueva pestaña.");
      toast("Tu navegador bloqueó la ventana del expediente. Por favor permite ventanas emergentes para Ixtla App.", "warning");
      return;
    }
    win.document.body.textContent = "Preparando expediente…";

    try {
      let geolocation = null;
      let geoQueryFailed = false;
      if (Number.isInteger(Number(req?.id)) && Number(req.id) > 0 && window.IxtlaRequirementGeolocation?.getPersistedRecord) {
        try {
          geolocation = await window.IxtlaRequirementGeolocation.getPersistedRecord(req);
        } catch (error) {
          warn("No se pudo verificar la geolocalización para el expediente:", error);
          geoQueryFailed = true;
        }
      }
      if (win.closed) return;
      const html = buildDocumentHtml(geolocation, geoQueryFailed);
      log("buildDocumentHtml() OK, longitud:", html ? html.length : 0);
      openPrintWindow(html, win);
    } catch (e) {
      err("Error generando expediente:", e);
      toast("Ocurrió un error al generar el expediente.", "error");
      if (!win.closed) win.document.body.textContent = "Ocurrió un error al generar el expediente.";
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

"use strict";

import { Session } from "/PRI/JS/auth/session.js";

const CONFIG = {
  DEBUG_LOGS: true,
  PAGE_SIZE: 10,
  ENDPOINT_PERSONAS: "/PRI/db/WEB/ixtla_c_persona.php",
  ENDPOINT_ESTATUS: "/PRI/db/WEB/ixtla_c_cat_estatus.php",
  ENDPOINT_ARCHIVOS: "/PRI/db/WEB/ixtla_c_archivo.php",
};

const TAG = "[RED Home]";
const log = (...args) => CONFIG.DEBUG_LOGS && console.log(TAG, ...args);
const warn = (...args) => CONFIG.DEBUG_LOGS && console.warn(TAG, ...args);
const error = (...args) => CONFIG.DEBUG_LOGS && console.error(TAG, ...args);

const $ = (sel, root = document) => root.querySelector(sel);

const State = {
  session: null,
  sessionData: null,
  usuario: null,
  rol: null,
  token: "",
  estatusCatalog: [],
  universe: [],
  rows: [],
  search: "",
  page: 1,
  pageSize: CONFIG.PAGE_SIZE,
  loading: false,
  counts: {
    afiliados: 0,
    simpatizantes: 0,
    promotores: 0,
  },
};

const SEL = {
  userName: "#red-user-name",
  search: "#red-search",
  tableBody: "#red-table-body",
  mobileList: "#red-mobile-list",
  pager: "#red-pager",
  metricAfiliados: "#metric-afiliados",
  metricSimpatizantes: "#metric-simpatizantes",
  metricPromotores: "#metric-promotores",
  btnExport: "#red-btn-export",

  ineReviewModal: "#ine-review-modal",
  ineReviewForm: "#ine-review-form",
  ineReviewTitle: "#ine-review-title",
  ineReviewKicker: ".ine-review-kicker",
  ineReviewWarning: ".ine-review-warning",
  ineReviewSave: "#ine-modal-affiliate",
  ineReviewReprocess: "#ine-btn-reprocess",
  ineReviewFront: "#ine-review-front",
  ineReviewBack: "#ine-review-back",
};

const ESTATUS_VALIDOS = new Set(["VALIDADO", "ACTIVO"]);

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                     */
/* -------------------------------------------------------------------------- */

function toast(msg, tipo = "exito", duration = 4500) {
  if (typeof window.gcToast === "function") {
    window.gcToast(msg, tipo, duration);
    return;
  }

  console[tipo === "error" ? "error" : "log"]("[toast]", tipo, msg);
}

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setFieldValue(selector, value, fallback = "") {
  const el = $(selector);
  if (!el) return;

  const clean = String(value ?? fallback ?? "").trim();

  if (el.type === "checkbox") {
    el.checked = clean === "1" || clean === "true";
    return;
  }

  if ("value" in el) {
    el.value = clean;
    return;
  }

  el.textContent = clean;
}

function clearImage(selector) {
  const img = $(selector);
  if (!img) return;

  img.removeAttribute("src");
  img.alt = "";
}

/* -------------------------------------------------------------------------- */
/* SESIÓN                                                                      */
/* -------------------------------------------------------------------------- */

function readCookiePayload() {
  try {
    const name = "ix_emp=";
    const pair = document.cookie.split("; ").find((c) => c.startsWith(name));
    if (!pair) return null;

    const raw = decodeURIComponent(pair.slice(name.length));
    return JSON.parse(decodeURIComponent(escape(atob(raw))));
  } catch {
    return null;
  }
}

function normalizeSession(rawSession) {
  const raw = rawSession || {};
  const data = raw.data && typeof raw.data === "object" ? raw.data : raw;

  return {
    raw,
    data,
    token: data.token || raw.token || "",
    usuario: data.usuario || raw.usuario || {},
    rol: data.rol || raw.rol || {},
    persona: data.persona || raw.persona || {},
    territorios: Array.isArray(data.territorios) ? data.territorios : [],
  };
}

function readSession() {
  let session = null;

  try {
    session = Session?.get?.() || null;
  } catch (err) {
    warn("No se pudo leer Session.get()", err);
  }

  if (!session) session = readCookiePayload();

  const normalized = normalizeSession(session);

  State.session = session || null;
  State.sessionData = normalized.data;
  State.usuario = normalized.usuario;
  State.rol = normalized.rol;
  State.token = normalized.token;

  log("Sesión detectada:", State.session);
  log("Sesión normalizada:", normalized);

  return normalized;
}

function getUsuarioId() {
  return Number(State.usuario?.usuario_id || State.sessionData?.usuario_id || 0);
}

function getAuthHeaders() {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };

  if (State.token) {
    headers.Authorization = `Bearer ${State.token}`;
  }

  return headers;
}

async function postJSON(url, body = {}) {
  const resp = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const status = resp.status;
  const out = await resp.json().catch(() => null);

  log("POST:", url, "status:", status, "body:", body, "response:", out);

  if (!resp.ok || !out?.ok) {
    const msg = out?.error || `Error HTTP ${status}`;
    throw new Error(msg);
  }

  return out;
}

function hydrateUser() {
  const usuario = State.usuario || {};
  const rol = State.rol || {};

  const fullName =
    [usuario.nombre, usuario.apellido_paterno, usuario.apellido_materno]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    usuario.username ||
    "Usuario RED";

  const roleName = rol.nombre ? ` · ${rol.nombre}` : "";

  const userNameEl = $(SEL.userName);
  if (userNameEl) userNameEl.textContent = `${fullName}${roleName}`;
}

/* -------------------------------------------------------------------------- */
/* CARGA DE DATOS                                                              */
/* -------------------------------------------------------------------------- */

async function loadEstatusCatalog() {
  try {
    const out = await postJSON(CONFIG.ENDPOINT_ESTATUS, {
      activo: 1,
      page: 1,
      page_size: 100,
    });

    State.estatusCatalog = Array.isArray(out.data) ? out.data : [];
    log("Catálogo de estatus cargado:", State.estatusCatalog);
  } catch (err) {
    warn("No se pudo cargar catálogo de estatus. Se usará estatus de persona.", err);
    State.estatusCatalog = [];
  }
}

async function loadPersonas() {
  const usuarioId = getUsuarioId();

  if (!usuarioId) {
    warn("No hay usuario_id en sesión. No se puede consultar personas capturadas.");

    State.universe = [];
    State.rows = [];
    updateCounts();
    render();

    toast("No se encontró usuario en sesión.", "error");
    return;
  }

  State.loading = true;
  renderLoading();

  try {
    const out = await postJSON(CONFIG.ENDPOINT_PERSONAS, {
      page: 1,
      page_size: 500,
      capturado_por: usuarioId,
      scope: "mine",
    });

    const personas = Array.isArray(out.data) ? out.data : [];

    State.universe = personas
      .filter((persona) => Number(persona.capturado_por) === Number(usuarioId))
      .map(mapPersonaToRedRow);

    State.page = 1;

    updateCounts();
    applyFilters();

    log("Personas reales cargadas:", State.universe);
  } catch (err) {
    error("No se pudieron cargar personas reales:", err);

    State.universe = [];
    State.rows = [];
    updateCounts();
    render();

    toast("No se pudieron cargar las personas.", "error");
  } finally {
    State.loading = false;
  }
}

function mapPersonaToRedRow(persona = {}) {
  const estatusCodigo = String(persona.estatus?.codigo || "").toUpperCase();
  const estatusNombre =
    persona.estatus?.nombre ||
    getEstatusNombreByCodigo(estatusCodigo) ||
    "Sin estatus";

  const nombre =
    persona.nombre_completo ||
    [persona.nombres, persona.apellido_paterno, persona.apellido_materno]
      .filter(Boolean)
      .join(" ")
      .trim();

  const seccion =
    persona.territorio?.seccion?.codigo ||
    persona.territorio?.seccion?.nombre ||
    persona.seccion_id ||
    "—";

  const zona =
    persona.territorio?.zona?.codigo ||
    persona.territorio?.zona?.nombre ||
    "—";

  return {
    id: persona.persona_id,
    nombre: nombre || "Persona sin nombre",
    domicilio: persona.domicilio_texto || "—",
    seccion,
    zona,
    telefono: persona.telefono || persona.whatsapp || "—",
    validez: isEstatusValido(estatusCodigo),
    estatus_codigo: estatusCodigo,
    estatus_nombre: estatusNombre,
    tipo: getTipoPersona(persona),
    raw: persona,
  };
}

function getTipoPersona(persona = {}) {
  const rawTipo =
    persona.tipo ||
    persona.tipo_persona ||
    persona.categoria ||
    persona.rol_persona ||
    "";

  const tipo = normalizeText(rawTipo);

  if (tipo === "afiliado") return "afiliado";
  if (tipo === "promotor") return "promotor";

  return "simpatizante";
}

function getEstatusNombreByCodigo(codigo) {
  const target = String(codigo || "").toUpperCase();

  const found = State.estatusCatalog.find(
    (item) => String(item.codigo || "").toUpperCase() === target
  );

  return found?.nombre || "";
}

function isEstatusValido(codigo) {
  return ESTATUS_VALIDOS.has(String(codigo || "").toUpperCase());
}

/* -------------------------------------------------------------------------- */
/* FILTROS / MÉTRICAS                                                          */
/* -------------------------------------------------------------------------- */

function updateCounts() {
  const counts = {
    afiliados: 0,
    simpatizantes: 0,
    promotores: 0,
  };

  State.universe.forEach((item) => {
    const tipo = normalizeText(item.tipo);

    if (tipo === "afiliado") counts.afiliados += 1;
    if (tipo === "simpatizante") counts.simpatizantes += 1;
    if (tipo === "promotor") counts.promotores += 1;
  });

  State.counts = counts;

  const afiliadosEl = $(SEL.metricAfiliados);
  const simpatizantesEl = $(SEL.metricSimpatizantes);
  const promotoresEl = $(SEL.metricPromotores);

  if (afiliadosEl) afiliadosEl.textContent = counts.afiliados.toLocaleString("es-MX");
  if (simpatizantesEl) simpatizantesEl.textContent = counts.simpatizantes.toLocaleString("es-MX");
  if (promotoresEl) promotoresEl.textContent = counts.promotores.toLocaleString("es-MX");
}

function applyFilters() {
  const q = normalizeText(State.search);

  State.rows = State.universe.filter((item) => {
    if (!q) return true;

    const haystack = normalizeText([
      item.nombre,
      item.domicilio,
      item.seccion,
      item.zona,
      item.telefono,
      item.tipo,
      item.estatus_codigo,
      item.estatus_nombre,
      item.validez
        ? "valido validado activo"
        : "pendiente inactivo rechazado baja duplicado capturado",
    ].join(" "));

    return haystack.includes(q);
  });

  const maxPage = getMaxPage();
  if (State.page > maxPage) State.page = maxPage || 1;

  render();
}

function getMaxPage() {
  return Math.max(1, Math.ceil(State.rows.length / State.pageSize));
}

function getPageRows() {
  const start = (State.page - 1) * State.pageSize;
  return State.rows.slice(start, start + State.pageSize);
}

/* -------------------------------------------------------------------------- */
/* RENDER                                                                      */
/* -------------------------------------------------------------------------- */

function renderLoading() {
  const tbody = $(SEL.tableBody);
  const mobile = $(SEL.mobileList);
  const pager = $(SEL.pager);

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="red-empty">Cargando personas...</div>
        </td>
      </tr>
    `;
  }

  if (mobile) {
    mobile.innerHTML = `<div class="red-empty">Cargando personas...</div>`;
  }

  if (pager) pager.innerHTML = "";
}

function render() {
  renderTable();
  renderMobileCards();
  renderPager();
}

function renderStatusIcon(item) {
  const validClass = item.validez ? "red-valid" : "red-valid is-missing";
  const validText = item.validez ? "✓" : "—";
  const title = item.estatus_nombre
    ? `Estatus: ${item.estatus_nombre}`
    : "Estatus: Sin estatus";

  return `
    <span class="${validClass}" title="${escapeHTML(title)}" aria-label="${escapeHTML(title)}">
      ${validText}
    </span>
  `;
}

function renderTable() {
  const tbody = $(SEL.tableBody);
  if (!tbody) return;

  const rows = getPageRows();

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="red-empty">No se encontraron registros.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((item) => `
    <tr data-id="${escapeHTML(item.id)}">
      <td class="td-name">${escapeHTML(safeText(item.nombre))}</td>
      <td>${escapeHTML(safeText(item.domicilio))}</td>
      <td>${escapeHTML(safeText(item.seccion))}</td>
      <td>${escapeHTML(safeText(item.telefono))}</td>
      <td>${renderStatusIcon(item)}</td>
      <td>
        <button type="button" class="red-open" data-action="open" data-id="${escapeHTML(item.id)}">
          Abrir
        </button>
      </td>
    </tr>
  `).join("");
}

function renderMobileCards() {
  const host = $(SEL.mobileList);
  if (!host) return;

  const rows = getPageRows();

  if (!rows.length) {
    host.innerHTML = `<div class="red-empty">No se encontraron registros.</div>`;
    return;
  }

  host.innerHTML = rows.map((item) => `
    <article class="red-person-card" data-id="${escapeHTML(item.id)}">
      <h3>${escapeHTML(safeText(item.nombre))}</h3>

      <div class="red-person-meta">
        <span><strong>Domicilio:</strong> ${escapeHTML(safeText(item.domicilio))}</span>
        <span><strong>Sección:</strong> ${escapeHTML(safeText(item.seccion))}</span>
        <span><strong>Teléfono:</strong> ${escapeHTML(safeText(item.telefono))}</span>
        <span><strong>Estatus:</strong> ${escapeHTML(safeText(item.estatus_nombre))}</span>
      </div>

      <footer>
        ${renderStatusIcon(item)}

        <button type="button" class="red-open" data-action="open" data-id="${escapeHTML(item.id)}">
          Abrir
        </button>
      </footer>
    </article>
  `).join("");
}

function renderPager() {
  const pager = $(SEL.pager);
  if (!pager) return;

  const total = State.rows.length;
  const maxPage = getMaxPage();

  if (!total) {
    pager.innerHTML = "";
    return;
  }

  const pages = buildPageList(State.page, maxPage);

  pager.innerHTML = `
    <button type="button" data-page="${State.page - 1}" ${State.page <= 1 ? "disabled" : ""}>‹</button>

    ${pages.map((page) => `
      <button
        type="button"
        class="page-number ${page === State.page ? "is-active" : ""}"
        data-page="${page}">
        ${page}
      </button>
    `).join("")}

    <button type="button" data-page="${State.page + 1}" ${State.page >= maxPage ? "disabled" : ""}>›</button>

    <span>Pág. ${State.page} de ${maxPage}</span>

    <input id="red-page-jump" type="number" min="1" max="${maxPage}" aria-label="Ir a página">
    <button type="button" data-action="jump">Ir</button>
  `;
}

function buildPageList(current, max) {
  const set = new Set([1, current - 1, current, current + 1, max]);

  return Array.from(set)
    .filter((page) => page >= 1 && page <= max)
    .sort((a, b) => a - b);
}

function goToPage(page) {
  const maxPage = getMaxPage();
  const next = Math.min(Math.max(Number(page) || 1, 1), maxPage);

  if (next === State.page) return;

  State.page = next;
  render();
}

/* -------------------------------------------------------------------------- */
/* MODAL EXISTENTE DE REVISIÓN EN MODO SOLO LECTURA                            */
/* -------------------------------------------------------------------------- */

async function openRecord(id) {
  const local = State.universe.find((row) => Number(row.id) === Number(id));

  if (!id) {
    warn("openRecord sin id");
    return;
  }

  openPersonaReadonlyModal({
    loading: true,
    persona: local?.raw || null,
    fallbackRow: local || null,
    archivos: [],
  });

  try {
    const personaOut = await postJSON(CONFIG.ENDPOINT_PERSONAS, {
      persona_id: Number(id),
      capturado_por: getUsuarioId(),
    });

    const persona = personaOut.data || null;

    if (!persona) {
      throw new Error("No se encontró información de la persona.");
    }

    let archivos = [];
    let archivoError = "";

    try {
      const archivosOut = await postJSON(CONFIG.ENDPOINT_ARCHIVOS, {
        entidad_tipo: "PERSONA",
        entidad_id: Number(persona.persona_id || id),
        es_actual: 1,
        page: 1,
        page_size: 20,
      });

      archivos = Array.isArray(archivosOut.data) ? archivosOut.data : [];
    } catch (err) {
      archivoError = err.message || "No se pudieron cargar los archivos de la persona.";
      warn("No se pudieron cargar archivos de persona:", err);
    }

    openPersonaReadonlyModal({
      loading: false,
      persona,
      fallbackRow: local || null,
      archivos,
      errorMessage: archivoError,
    });
  } catch (err) {
    error("No se pudo abrir detalle de persona:", err);

    openPersonaReadonlyModal({
      loading: false,
      errorMessage: err.message || "No se pudo cargar el detalle.",
      persona: local?.raw || null,
      fallbackRow: local || null,
      archivos: [],
    });

    toast("No se pudo cargar el detalle de la persona.", "error");
  }
}

function setReviewModalOpen(isOpen) {
  const modal = $(SEL.ineReviewModal);
  if (!modal) return;

  modal.hidden = !isOpen;
  modal.setAttribute("aria-hidden", isOpen ? "false" : "true");

  document.body.classList.toggle("ine-modal-open", Boolean(isOpen));
}

function setReviewModalReadonlyMode(isReadonly) {
  const modal = $(SEL.ineReviewModal);
  const form = $(SEL.ineReviewForm);

  if (!modal || !form) return;

  modal.dataset.mode = isReadonly ? "readonly" : "capture";
  form.classList.toggle("is-readonly", Boolean(isReadonly));

  form.querySelectorAll("input, textarea").forEach((field) => {
    field.readOnly = Boolean(isReadonly);
  });

  form.querySelectorAll("select").forEach((field) => {
    field.disabled = Boolean(isReadonly);
  });

  const saveBtn = $(SEL.ineReviewSave);
  const reprocessBtn = $(SEL.ineReviewReprocess);
  const cancelBtn = form.querySelector("[data-ine-review-close]");

  if (saveBtn) saveBtn.hidden = Boolean(isReadonly);
  if (reprocessBtn) reprocessBtn.hidden = Boolean(isReadonly);
  if (cancelBtn) cancelBtn.textContent = isReadonly ? "Cerrar" : "Cancelar";
}

function resetReviewModalToCaptureMode() {
  const title = $(SEL.ineReviewTitle);
  const kicker = $(SEL.ineReviewKicker);
  const warning = $(SEL.ineReviewWarning);

  setReviewModalReadonlyMode(false);

  if (kicker) kicker.textContent = "Datos extraídos";
  if (title) title.textContent = "Revisión de información INE";

  if (warning) {
    warning.innerHTML = `
      <strong>Importante: La información fue extraída automáticamente.</strong>
      Valide esta información comparando contra el documento INE,
      realice los ajustes que sean necesarios y guarde el registro.
    `;
  }
}

function openPersonaReadonlyModal({
  loading = false,
  errorMessage = "",
  persona = null,
  fallbackRow = null,
  archivos = [],
} = {}) {
  const modal = $(SEL.ineReviewModal);

  if (!modal) {
    warn("No existe #ine-review-modal para mostrar el detalle.");
    return;
  }

  setReviewModalReadonlyMode(true);
  setReviewModalOpen(true);

  const title = $(SEL.ineReviewTitle);
  const kicker = $(SEL.ineReviewKicker);
  const warning = $(SEL.ineReviewWarning);

  if (kicker) kicker.textContent = "Consulta de registro";

  if (loading) {
    clearImage(SEL.ineReviewFront);
    clearImage(SEL.ineReviewBack);

    if (title) title.textContent = "Cargando detalle de persona...";
    if (warning) {
      warning.innerHTML = `
      <strong>Consultando información.</strong>
      Espera un momento mientras se carga el registro.
    `;
    }
    return;
  }

  if (errorMessage && !persona && !fallbackRow) {
    if (title) title.textContent = "No se pudo cargar el detalle";
    if (warning) {
      warning.innerHTML = `
        <strong>Error.</strong>
        ${escapeHTML(errorMessage)}
      `;
    }
    return;
  }

  paintPersonaReadonlyData(persona || {}, fallbackRow || {});
  paintPersonaReadonlyImages(archivos);

  if (errorMessage && warning) {
    warning.innerHTML = `
      <strong>Detalle parcial.</strong>
      ${escapeHTML(errorMessage)}
    `;
  }
}

function paintPersonaReadonlyData(persona = {}, fallbackRow = {}) {
  const p = persona || {};
  const row = fallbackRow || {};

  const title = $(SEL.ineReviewTitle);
  const kicker = $(SEL.ineReviewKicker);
  const warning = $(SEL.ineReviewWarning);

  if (kicker) kicker.textContent = "Consulta de registro";
  if (title) title.textContent = p.nombre_completo || row.nombre || "Detalle de persona";

  if (warning) {
    warning.innerHTML = `
      <strong>Consulta en solo lectura.</strong>
      Este registro se muestra para revisión. No se realizarán cambios desde esta vista.
    `;
  }

  setFieldValue("#ine-review-fecha-extraccion", p.fecha_captura || "");
  setFieldValue("#ine-review-nombres", p.nombres || "");
  setFieldValue("#ine-review-apellido-paterno", p.apellido_paterno || "");
  setFieldValue("#ine-review-apellido-materno", p.apellido_materno || "");
  setFieldValue("#ine-review-fecha-nacimiento", p.fecha_nacimiento || "");
  setFieldValue("#ine-review-sexo", p.sexo || "");

  setFieldValue("#ine-review-curp", p.curp || "");
  setFieldValue("#ine-review-clave-elector", p.clave_elector || "");
  setFieldValue("#ine-review-idmex", p.idmex || shortHash(p.idmex_hash));

  setFieldValue("#ine-review-seccion", formatSeccionPersona(p, row));
  setFieldValue("#ine-review-anio-registro", p.anio_registro || "");
  setFieldValue("#ine-review-emision", p.emision || "");
  setFieldValue("#ine-review-vigencia-inicio", p.vigencia_inicio || "");
  setFieldValue("#ine-review-vigencia-fin", p.vigencia_fin || "");

  setFieldValue("#ine-review-domicilio", p.domicilio_texto || "");
  setFieldValue("#ine-review-telefono", p.telefono || "");
  setFieldValue("#ine-review-whatsapp", p.whatsapp || "");
  setFieldValue("#ine-review-email", p.email || "");

  setFieldValue("#ine-review-acepta-tratamiento", p.acepta_tratamiento_datos ?? "");
  setFieldValue("#ine-review-acepta-whatsapp", p.acepta_contacto_whatsapp ?? "");

  setFieldValue("#ine-review-observaciones", p.observaciones || "");

  clearImage(SEL.ineReviewFront);
  clearImage(SEL.ineReviewBack);
}

function findArchivoByUso(archivos = [], usoArchivo = "") {
  const target = String(usoArchivo || "").toUpperCase();

  return archivos.find((archivo) => {
    return String(archivo?.uso_archivo || "").toUpperCase() === target;
  }) || null;
}

function setReadonlyImage(selector, src, altText) {
  const img = $(selector);
  if (!img) return;

  const cleanSrc = String(src || "").trim();

  if (!cleanSrc) {
    img.removeAttribute("src");
    img.alt = "Imagen no disponible";
    return;
  }

  img.src = cleanSrc;
  img.alt = altText || "Imagen INE";
}

function paintPersonaReadonlyImages(archivos = []) {
  const frente = findArchivoByUso(archivos, "INE_FRENTE");
  const reverso = findArchivoByUso(archivos, "INE_REVERSO");

  setReadonlyImage(
    SEL.ineReviewFront,
    frente?.url_archivo || "",
    "Frente de la INE"
  );

  setReadonlyImage(
    SEL.ineReviewBack,
    reverso?.url_archivo || "",
    "Reverso de la INE"
  );

  log("Archivos pintados en modal readonly:", {
    total: archivos.length,
    frente: frente?.archivo_id || null,
    reverso: reverso?.archivo_id || null,
  });
}

function shortHash(value) {
  const hash = String(value || "").trim();

  if (!hash) return "";

  if (hash.length <= 18) return hash;

  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function formatSeccionPersona(persona = {}, fallbackRow = {}) {
  const territorio = persona.territorio?.seccion || null;

  if (territorio?.codigo && territorio?.nombre) {
    return `${territorio.codigo} · ${territorio.nombre}`;
  }

  if (territorio?.codigo) {
    return territorio.codigo;
  }

  if (territorio?.nombre) {
    return territorio.nombre;
  }

  return persona.seccion_id || fallbackRow.seccion || "";
}

/* -------------------------------------------------------------------------- */
/* EXPORTACIÓN                                                                 */
/* -------------------------------------------------------------------------- */

function exportCSV() {
  const rows = State.rows;

  const headers = [
    "ID",
    "Nombre",
    "Domicilio",
    "Seccion",
    "Zona",
    "Telefono",
    "Tipo",
    "Estatus",
    "Validez",
  ];

  const body = rows.map((item) => [
    item.id,
    item.nombre,
    item.domicilio,
    item.seccion,
    item.zona,
    item.telefono,
    item.tipo,
    item.estatus_nombre,
    item.validez ? "Valido" : "Pendiente",
  ]);

  const csv = [headers, ...body]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `red_export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

/* --------------------------------------------------------------------------- */
/* EVENTOS                                                                     */
/* --------------------------------------------------------------------------- */

function bindEvents() {
  const search = $(SEL.search);

  search?.addEventListener("input", () => {
    State.search = search.value;
    State.page = 1;
    applyFilters();
  });

  document.addEventListener("click", (event) => {
    const openBtn = event.target.closest("[data-action='open']");
    if (openBtn) {
      openRecord(openBtn.dataset.id);
      return;
    }

    const pagerBtn = event.target.closest("#red-pager button");
    if (pagerBtn) {
      const action = pagerBtn.dataset.action;

      if (action === "jump") {
        const input = $("#red-page-jump");
        goToPage(input?.value);
        return;
      }

      if (pagerBtn.dataset.page) {
        goToPage(pagerBtn.dataset.page);
      }
    }
  });

  $(SEL.btnExport)?.addEventListener("click", exportCSV);
}

/* -------------------------------------------------------------------------- */
/* INIT                                                                        */
/* -------------------------------------------------------------------------- */

async function init() {
  readSession();
  hydrateUser();
  bindEvents();

  await loadEstatusCatalog();
  await loadPersonas();

  log("Home RED inicializado");
}

document.addEventListener("DOMContentLoaded", init);
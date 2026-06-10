"use strict";

import { Session } from "/PRI/JS/auth/session.js";

const CONFIG = {
  DEBUG_LOGS: true,
  PAGE_SIZE: 10,
  ENDPOINT_RED_HOME: "/PRI/db/WEB/ixtla_c_red_home.php",
  ENDPOINT_PERSONAS: "/PRI/db/WEB/ixtla_c_persona.php",
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

  rows: [],
  search: "",
  page: 1,
  pageSize: CONFIG.PAGE_SIZE,
  total: 0,
  totalPages: 1,
  loading: false,
  scope: null,

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
/* HELPERS                                                                    */
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

function debounce(fn, delay = 350) {
  let timer = null;

  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
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
/* SESIÓN                                                                     */
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

function getRolCodigo() {
  return String(
    State.rol?.codigo ||
    State.sessionData?.rol_codigo ||
    State.sessionData?.rol?.codigo ||
    ""
  ).toUpperCase();
}

function getRolId() {
  return Number(
    State.rol?.rol_id ||
    State.sessionData?.rol_id ||
    State.sessionData?.rol?.rol_id ||
    0
  );
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
  const raw = await resp.text();

  let out = null;

  try {
    out = raw ? JSON.parse(raw) : null;
  } catch {
    console.error(TAG, "Respuesta no JSON:", raw);
    throw new Error("El endpoint respondió algo que no es JSON.");
  }

  log("POST:", url, "status:", status, "body:", body, "response:", out);

  if (!resp.ok || !out?.ok) {
    const msg = out?.error || out?.message || `Error HTTP ${status}`;
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
/* CARGA DASHBOARD SERVER-SIDE                                                */
/* -------------------------------------------------------------------------- */

function buildDashboardPayload(overrides = {}) {
  return {
    usuario_id: getUsuarioId(),
    rol_codigo: getRolCodigo(),
    rol_id: getRolId(),
    page: State.page,
    page_size: State.pageSize,
    search: State.search,
    ...overrides,
  };
}

async function loadDashboard({ keepPage = true } = {}) {
  const usuarioId = getUsuarioId();

  if (!usuarioId && getRolCodigo() !== "ADMIN" && getRolCodigo() !== "COORD_GENERAL") {
    warn("No hay usuario_id en sesión. No se puede consultar dashboard RED.");

    State.rows = [];
    State.total = 0;
    State.totalPages = 1;
    setCounts({ afiliados: 0, simpatizantes: 0, promotores: 0 });
    render();

    toast("No se encontró usuario en sesión.", "error");
    return;
  }

  if (!keepPage) State.page = 1;

  State.loading = true;
  renderLoading();

  try {
    const out = await postJSON(CONFIG.ENDPOINT_RED_HOME, buildDashboardPayload());

    State.rows = Array.isArray(out.data) ? out.data.map(mapRedHomeToRow) : [];
    State.scope = out.scope || null;
    State.page = Number(out.meta?.page || State.page || 1);
    State.pageSize = Number(out.meta?.page_size || State.pageSize || CONFIG.PAGE_SIZE);
    State.total = Number(out.meta?.total || 0);
    State.totalPages = Math.max(1, Number(out.meta?.total_pages || 1));

    setCounts(out.metrics || {});

    log("Dashboard RED cargado:", {
      page: State.page,
      total: State.total,
      totalPages: State.totalPages,
      scope: State.scope,
      rows: State.rows,
      metrics: State.counts,
    });

    render();
  } catch (err) {
    error("No se pudo cargar dashboard RED:", err);

    State.rows = [];
    State.total = 0;
    State.totalPages = 1;
    setCounts({ afiliados: 0, simpatizantes: 0, promotores: 0 });
    render();

    toast("No se pudieron cargar los registros RED.", "error");
  } finally {
    State.loading = false;
  }
}

function mapRedHomeToRow(persona = {}) {
  const participacion = persona.participacion || {};
  const estatus = participacion.estatus || {};

  const estatusCodigo = String(
    estatus.codigo ||
    persona.estatus_codigo ||
    persona.participacion_estatus_codigo ||
    ""
  ).toUpperCase();

  const estatusNombre =
    estatus.nombre ||
    persona.estatus_nombre ||
    persona.participacion_estatus_nombre ||
    "Sin estatus";

  const nombre =
    persona.nombre_completo ||
    [persona.nombres, persona.apellido_paterno, persona.apellido_materno]
      .filter(Boolean)
      .join(" ")
      .trim();

  const seccion =
    persona.territorio?.seccion?.codigo ||
    persona.seccion_codigo ||
    persona.territorio?.seccion?.nombre ||
    persona.seccion_nombre ||
    persona.seccion_id ||
    "—";

  const zona =
    persona.territorio?.zona?.codigo ||
    persona.territorio?.zona?.nombre ||
    "—";

  const tipo = normalizeTipoParticipacion(
    participacion.tipo_actual ||
    participacion.tipo_participacion ||
    persona.tipo_participacion ||
    "SIMPATIZANTE"
  );

  return {
    id: persona.persona_id,
    participacion_id: participacion.participacion_id || persona.participacion_id || null,
    nombre: nombre || "Persona sin nombre",
    domicilio: persona.domicilio_texto || "—",
    seccion,
    zona,
    telefono: persona.telefono || persona.whatsapp || "—",
    validez: isEstatusValido(estatusCodigo),
    estatus_codigo: estatusCodigo,
    estatus_nombre: estatusNombre,
    tipo,
    responsable: persona.responsable || null,
    raw: persona,
  };
}

function normalizeTipoParticipacion(value) {
  const tipo = normalizeText(value).replaceAll(" ", "_").toUpperCase();

  if (tipo === "AFILIADO") return "afiliado";
  if (tipo === "PROMOTOR") return "promotor";

  return "simpatizante";
}

function isEstatusValido(codigo) {
  return ESTATUS_VALIDOS.has(String(codigo || "").toUpperCase());
}

/* -------------------------------------------------------------------------- */
/* MÉTRICAS                                                                   */
/* -------------------------------------------------------------------------- */

function setCounts(metrics = {}) {
  State.counts = {
    afiliados: Number(metrics.afiliados || 0),
    simpatizantes: Number(metrics.simpatizantes || 0),
    promotores: Number(metrics.promotores || metrics.responsables_con_registros || 0),
  };

  const afiliadosEl = $(SEL.metricAfiliados);
  const simpatizantesEl = $(SEL.metricSimpatizantes);
  const promotoresEl = $(SEL.metricPromotores);

  if (afiliadosEl) afiliadosEl.textContent = State.counts.afiliados.toLocaleString("es-MX");
  if (simpatizantesEl) simpatizantesEl.textContent = State.counts.simpatizantes.toLocaleString("es-MX");
  if (promotoresEl) promotoresEl.textContent = State.counts.promotores.toLocaleString("es-MX");
}

function getMaxPage() {
  return Math.max(1, State.totalPages || 1);
}

function getPageRows() {
  return State.rows;
}

/* -------------------------------------------------------------------------- */
/* RENDER                                                                     */
/* -------------------------------------------------------------------------- */

function renderLoading() {
  const tbody = $(SEL.tableBody);
  const mobile = $(SEL.mobileList);
  const pager = $(SEL.pager);

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="red-empty">Cargando registros...</div>
        </td>
      </tr>
    `;
  }

  if (mobile) {
    mobile.innerHTML = `<div class="red-empty">Cargando registros...</div>`;
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
        <span><strong>Tipo:</strong> ${escapeHTML(formatTipo(item.tipo))}</span>
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

function formatTipo(tipo) {
  const clean = normalizeText(tipo);

  if (clean === "afiliado") return "Afiliado";
  if (clean === "promotor") return "Promotor";

  return "Simpatizante";
}

function renderPager() {
  const pager = $(SEL.pager);
  if (!pager) return;

  const total = State.total;
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

    <span>Pág. ${State.page} de ${maxPage} · ${total.toLocaleString("es-MX")} registros</span>

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

async function goToPage(page) {
  const maxPage = getMaxPage();
  const next = Math.min(Math.max(Number(page) || 1, 1), maxPage);

  if (next === State.page) return;

  State.page = next;
  await loadDashboard({ keepPage: true });
}

/* -------------------------------------------------------------------------- */
/* MODAL EXISTENTE DE REVISIÓN EN MODO SOLO LECTURA                           */
/* -------------------------------------------------------------------------- */

async function openRecord(id) {
  const local = State.rows.find((row) => Number(row.id) === Number(id));

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
    const tipo = p.participacion?.tipo_actual || p.participacion?.actual?.tipo_participacion || row.tipo || "";
    const tipoText = tipo ? ` Participación actual: <strong>${escapeHTML(formatTipo(tipo))}</strong>.` : "";

    warning.innerHTML = `
      <strong>Consulta en solo lectura.</strong>
      Este registro se muestra para revisión. No se realizarán cambios desde esta vista.${tipoText}
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

  setFieldValue("#ine-review-observaciones", p.observaciones || p.persona_observaciones || "");

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

  if (territorio?.codigo) return territorio.codigo;
  if (territorio?.nombre) return territorio.nombre;

  return persona.seccion_id || fallbackRow.seccion || "";
}

/* -------------------------------------------------------------------------- */
/* EXPORTACIÓN                                                                */
/* -------------------------------------------------------------------------- */

function exportCSV() {
  const rows = State.rows;

  if (!rows.length) {
    toast("No hay registros para exportar en esta página.", "advertencia");
    return;
  }

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
    formatTipo(item.tipo),
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
  a.download = `red_export_pagina_${State.page}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);

  if (State.total > rows.length) {
    toast("Se exportó solo la página actual.", "advertencia", 5000);
  }
}

/* -------------------------------------------------------------------------- */
/* EVENTOS                                                                    */
/* -------------------------------------------------------------------------- */

function bindEvents() {
  const search = $(SEL.search);
  const handleSearch = debounce(async () => {
    State.search = search?.value || "";
    await loadDashboard({ keepPage: false });
  }, 350);

  search?.addEventListener("input", handleSearch);

  document.addEventListener("click", async (event) => {
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
        await goToPage(input?.value);
        return;
      }

      if (pagerBtn.dataset.page) {
        await goToPage(pagerBtn.dataset.page);
      }
    }
  });

  $(SEL.btnExport)?.addEventListener("click", exportCSV);

  document.addEventListener("red:persona-saved", async () => {
    await loadDashboard({ keepPage: false });
  });
}

/* -------------------------------------------------------------------------- */
/* INIT                                                                       */
/* -------------------------------------------------------------------------- */

async function init() {
  readSession();
  hydrateUser();
  bindEvents();

  await loadDashboard({ keepPage: true });

  log("Home RED inicializado con endpoint server-side");
}

document.addEventListener("DOMContentLoaded", init);

// Permite que otros módulos restauren el modal de revisión si lo necesitan.
window.redResetReviewModalToCaptureMode = resetReviewModalToCaptureMode;
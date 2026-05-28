"use strict";

import { Session } from "/PRI/JS/auth/session.js";

const CONFIG = {
  DEBUG_LOGS: true,
  PAGE_SIZE: 10,
  ENDPOINT_PERSONAS: "/PRI/db/WEB/ixtla_c_persona.php",
  ENDPOINT_ESTATUS: "/PRI/db/WEB/ixtla_c_cat_estatus.php",
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
  btnAdd: "#red-btn-add",
};

const ESTATUS_VALIDOS = new Set(["VALIDADO", "ACTIVO"]);

function toast(msg, tipo = "exito") {
  if (typeof window.gcToast === "function") {
    window.gcToast(msg, tipo);
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

      // Regla acordada:
      // personas asociadas al usuario que las capturó.
      capturado_por: usuarioId,

      // Si el backend lo implementa, debe resolver este scope desde el token.
      scope: "mine",
    });

    const personas = Array.isArray(out.data) ? out.data : [];
    /*
    State.universe = personas
      .filter((persona) => {
        // Filtro defensivo.
        // Lo correcto es que el backend ya filtre por capturado_por/token.
        if (persona.capturado_por == null) return true;
        return Number(persona.capturado_por) === Number(usuarioId);
      })
      .map(mapPersonaToRedRow);
    */
    State.universe = personas
      .filter((persona) => {
        return Number(persona.capturado_por) === Number(usuarioId);
      })
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
    tipo: "simpatizante",
    raw: persona,
  };
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
      item.validez ? "valido validado activo" : "pendiente inactivo rechazado baja duplicado capturado",
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

async function openRecord(id) {
  const local = State.universe.find((row) => Number(row.id) === Number(id));

  if (!id) {
    warn("openRecord sin id");
    return;
  }

  openRevisionModal({
    loading: true,
    persona: local?.raw || null,
    fallbackRow: local || null,
  });

  try {
    const out = await postJSON(CONFIG.ENDPOINT_PERSONAS, {
      persona_id: Number(id),
    });

    const persona = out.data || null;

    if (!persona) {
      throw new Error("No se encontró información de la persona.");
    }

    openRevisionModal({
      loading: false,
      persona,
      fallbackRow: local || null,
    });
  } catch (err) {
    error("No se pudo abrir detalle de persona:", err);

    openRevisionModal({
      loading: false,
      errorMessage: err.message || "No se pudo cargar el detalle.",
      persona: local?.raw || null,
      fallbackRow: local || null,
    });

    toast("No se pudo cargar el detalle de la persona.", "error");
  }
}

function ensureRevisionModal() {
  let modal = $("#red-revision-modal");

  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "red-revision-modal";
  modal.className = "red-revision-modal";
  modal.hidden = true;

  modal.innerHTML = `
    <div class="red-revision-backdrop" data-action="close-revision"></div>

    <section class="red-revision-dialog" role="dialog" aria-modal="true" aria-labelledby="red-revision-title">
      <header class="red-revision-header">
        <div>
          <p class="red-revision-kicker">Revisión</p>
          <h2 id="red-revision-title">Detalle de persona</h2>
        </div>

        <button type="button" class="red-revision-close" data-action="close-revision" aria-label="Cerrar">
          ×
        </button>
      </header>

      <div class="red-revision-body" id="red-revision-body"></div>

      <footer class="red-revision-footer">
        <button type="button" class="red-open" data-action="close-revision">
          Cerrar
        </button>
      </footer>
    </section>
  `;

  document.body.appendChild(modal);

  return modal;
}

function openRevisionModal({ loading = false, errorMessage = "", persona = null, fallbackRow = null } = {}) {
  const modal = ensureRevisionModal();
  const body = $("#red-revision-body", modal);

  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add("is-open"));

  if (!body) return;

  if (loading) {
    body.innerHTML = `<div class="red-empty">Cargando información de la persona...</div>`;
    return;
  }

  if (errorMessage && !persona && !fallbackRow) {
    body.innerHTML = `<div class="red-empty">${escapeHTML(errorMessage)}</div>`;
    return;
  }

  body.innerHTML = renderRevisionContent(persona, fallbackRow, errorMessage);
}

function closeRevisionModal() {
  const modal = $("#red-revision-modal");
  if (!modal) return;

  modal.classList.remove("is-open");

  setTimeout(() => {
    modal.hidden = true;
  }, 180);
}

function renderRevisionContent(persona = {}, fallbackRow = {}, errorMessage = "") {
  const p = persona || {};
  const row = fallbackRow || {};

  const nombre =
    p.nombre_completo ||
    [p.nombres, p.apellido_paterno, p.apellido_materno]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    row.nombre ||
    "Persona sin nombre";

  const estatusNombre = p.estatus?.nombre || row.estatus_nombre || "Sin estatus";
  const estatusCodigo = p.estatus?.codigo || row.estatus_codigo || "";

  const seccion =
    p.territorio?.seccion?.codigo ||
    p.territorio?.seccion?.nombre ||
    p.seccion_id ||
    row.seccion ||
    "—";

  const zona =
    p.territorio?.zona?.codigo ||
    p.territorio?.zona?.nombre ||
    row.zona ||
    "—";

  return `
    ${errorMessage ? `
      <div class="red-revision-alert">
        ${escapeHTML(errorMessage)}
      </div>
    ` : ""}

    <section class="red-revision-summary">
      <div>
        <span class="red-revision-label">Nombre</span>
        <strong>${escapeHTML(nombre)}</strong>
      </div>

      <div>
        <span class="red-revision-label">Estatus</span>
        <strong title="${escapeHTML(`Estatus: ${estatusNombre}`)}">
          ${escapeHTML(estatusNombre)}
          ${estatusCodigo ? `<small>(${escapeHTML(estatusCodigo)})</small>` : ""}
        </strong>
      </div>
    </section>

    <section class="red-revision-grid">
      ${infoItem("ID persona", p.persona_id || row.id)}
      ${infoItem("Fecha de nacimiento", p.fecha_nacimiento)}
      ${infoItem("Sexo", p.sexo)}
      ${infoItem("Sección", seccion)}
      ${infoItem("Zona", zona)}
      ${infoItem("Domicilio", p.domicilio_texto || row.domicilio, true)}
      ${infoItem("Teléfono", p.telefono || row.telefono)}
      ${infoItem("WhatsApp", p.whatsapp)}
      ${infoItem("Email", p.email)}
      ${infoItem("Fecha de captura", p.fecha_captura)}
      ${infoItem("Capturado por", p.capturado_por)}
      ${infoItem("Observaciones", p.observaciones, true)}
    </section>

    <section class="red-revision-checks">
      <h3>Indicadores de captura</h3>

      <div class="red-revision-check-list">
        ${checkItem("CURP capturada", Boolean(p.curp_hash))}
        ${checkItem("Clave elector capturada", Boolean(p.clave_elector_hash))}
        ${checkItem("OCR capturado", Boolean(p.ocr_hash))}
        ${checkItem("CIC capturado", Boolean(p.cic_hash))}
        ${checkItem("IDMEX capturado", Boolean(p.idmex_hash))}
      </div>
    </section>

    <section class="red-revision-checks">
      <h3>Consentimientos</h3>

      <div class="red-revision-check-list">
        ${checkItem("Tratamiento de datos", Number(p.acepta_tratamiento_datos) === 1)}
        ${checkItem("Datos sensibles", Number(p.acepta_datos_sensibles) === 1)}
        ${checkItem("Contacto por WhatsApp", Number(p.acepta_contacto_whatsapp) === 1)}
      </div>

      <div class="red-revision-grid is-compact">
        ${infoItem("Aviso privacidad", p.aviso_privacidad_version)}
        ${infoItem("Fecha consentimiento", p.fecha_consentimiento)}
      </div>
    </section>
  `;
}

function infoItem(label, value, wide = false) {
  return `
    <div class="red-revision-item ${wide ? "is-wide" : ""}">
      <span>${escapeHTML(label)}</span>
      <strong>${escapeHTML(safeText(value))}</strong>
    </div>
  `;
}

function checkItem(label, ok) {
  return `
    <div class="red-revision-check ${ok ? "is-ok" : "is-missing"}">
      <span>${ok ? "✓" : "—"}</span>
      <strong>${escapeHTML(label)}</strong>
    </div>
  `;
}

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

function bindEvents() {
  const search = $(SEL.search);

  search?.addEventListener("input", () => {
    State.search = search.value;
    State.page = 1;
    applyFilters();
  });

  document.addEventListener("click", (event) => {
    const closeRevisionBtn = event.target.closest("[data-action='close-revision']");
    if (closeRevisionBtn) {
      closeRevisionModal();
      return;
    }

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

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeRevisionModal();
  });

  $(SEL.btnExport)?.addEventListener("click", exportCSV);

  /* ya no se va a usar el boton para redirigir a la view captura.
  $(SEL.btnAdd)?.addEventListener("click", () => {
    log("Ir a captura INE");
    window.location.href = "/PRI/Views/captura.php";
  });
  */
}

async function init() {
  readSession();
  hydrateUser();
  bindEvents();

  await loadEstatusCatalog();
  await loadPersonas();

  log("Home RED inicializado");
}

document.addEventListener("DOMContentLoaded", init);
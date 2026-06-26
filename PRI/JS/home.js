"use strict";

import { Session } from "/PRI/JS/auth/session.js";
import { initExportXLSXHome } from "/PRI/JS/ui/exportXLSXHome.js";

const CONFIG = {
  DEBUG_LOGS: true,
  PAGE_SIZE: 10,
  ENDPOINT_RED_HOME: "/PRI/db/WEB/ixtla_c_red_home.php",
  ENDPOINT_PERSONAS: "/PRI/db/WEB/ixtla_c_persona.php",
  ENDPOINT_ARCHIVOS: "/PRI/db/WEB/ixtla_c_archivo.php",
  ENDPOINT_INSERT_ARCHIVO: "/PRI/db/WEB/ixtla_i_archivo.php",
  ENDPOINT_USUARIOS: "/PRI/db/WEB/ixtla_c_usuario.php",
  ENDPOINT_UPDATE_PERSONA: "/PRI/db/WEB/ixtla_u_persona.php",
};

const TAG = "[RED Home]";
const log = (...args) => CONFIG.DEBUG_LOGS && console.log(TAG, ...args);
const warn = (...args) => CONFIG.DEBUG_LOGS && console.warn(TAG, ...args);
const error = (...args) => CONFIG.DEBUG_LOGS && console.error(TAG, ...args);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

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

  sort: {
    key: "nombre",
    dir: "asc",
  },

  counts: {
    afiliados: 0,
    simpatizantes: 0,
    promotores: 0,
  },

  estatus: [],
  usuariosById: new Map(),

  readonlyRecord: null,
  readonlyOriginalStatusId: null,
  readonlySavingStatus: false,
  readonlyChangingAffiliate: false,
  readonlyRevokeAffiliatePending: false,
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
  ineReviewAffiliateSection: "#ine-review-affiliate-captures-section",
  ineReviewAffiliateFront: "#ine-review-affiliate-front",
  ineReviewAffiliateBack: "#ine-review-affiliate-back",

  ineReviewEstatus: "#ine-review-estatus",
  ineReviewAfiliado: "#ine-review-es-afiliado",
  ineReviewSaveStatus: "#ine-review-save-status",
  ineReviewAdminbar: "#ine-review-adminbar",

  revokeAffiliateModal: "#red-revoke-affiliate-modal",
  revokeAffiliateClose: "[data-red-revoke-affiliate-close]",
  revokeAffiliateMessage: "#red-revoke-affiliate-message",
  revokeAffiliatePerson: "#red-revoke-affiliate-person",
  revokeAffiliateConfirm: "#red-revoke-affiliate-confirm",
};

const ESTATUS_VALIDOS = new Set(["VALIDADO", "ACTIVO"]);
const PERSON_STATUS_OPTIONS = Object.freeze([
  { estatus_id: 1, codigo: "CAPTURADO", nombre: "Capturado" },
  { estatus_id: 2, codigo: "PENDIENTE_VALIDACION", nombre: "Pendiente de validación" },
  { estatus_id: 4, codigo: "ACTIVO", nombre: "Activo" },
  { estatus_id: 5, codigo: "INACTIVO", nombre: "Inactivo" },
  { estatus_id: 8, codigo: "DUPLICADO", nombre: "Duplicado" },
]);

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

async function loadCatEstatus() {
  if (Array.isArray(State.estatus) && State.estatus.length) {
    return State.estatus;
  }

  State.estatus = PERSON_STATUS_OPTIONS.map((item) => ({ ...item }));

  return State.estatus;
}

function getCurrentParticipación(persona = {}, fallbackRow = {}) {
  return (
    persona?.participacion?.actual ||
    persona?.participacion ||
    fallbackRow?.raw?.participacion ||
    {}
  );
}

function getCurrentStatusId(persona = {}, fallbackRow = {}) {
  const participacion = getCurrentParticipación(persona, fallbackRow);

  return Number(
    participacion?.estatus_id ||
    persona?.estatus_id ||
    fallbackRow?.raw?.estatus_id ||
    fallbackRow?.raw?.participacion?.estatus_id ||
    0
  );
}

function isPersonaAfiliada(persona = {}, fallbackRow = {}) {
  const participacion = getCurrentParticipación(persona, fallbackRow);

  const tipo = String(
    persona?.participacion?.tipo_actual ||
    participacion?.tipo_actual ||
    participacion?.tipo_participacion ||
    fallbackRow?.tipo ||
    ""
  ).toUpperCase();

  return tipo === "AFILIADO";
}

function toast(msg, tipo = "exito", duration = 4500) {
  if (typeof window.gcToast === "function") {
    window.gcToast(msg, tipo, duration);
    return;
  }

  console[tipo === "error" ? "error" : "log"]("[toast]", tipo, msg);
}

function paintReadonlyStatusOptions(persona = {}, fallbackRow = {}) {
  const select = $(SEL.ineReviewEstatus);
  if (!select) return;

  const currentStatusId = getCurrentStatusId(persona, fallbackRow);

  select.innerHTML = `<option value="">Selecciona un estado</option>`;

  State.estatus.forEach((item) => {
    const option = document.createElement("option");
    option.value = String(item.estatus_id);
    option.textContent = item.nombre || item.codigo || `Estatus ${item.estatus_id}`;
    option.dataset.codigo = item.codigo || "";
    option.selected = Number(item.estatus_id) === currentStatusId;

    select.appendChild(option);
  });

  State.readonlyOriginalStatusId = currentStatusId || null;
  syncReadonlyStatusSaveButton();
}

function paintReadonlyAffiliateToggle(persona = {}, fallbackRow = {}) {
  const input = $(SEL.ineReviewAfiliado);
  if (!input) return;

  input.checked = isPersonaAfiliada(persona, fallbackRow);
}

function getReadonlySelectedStatusId() {
  const select = $(SEL.ineReviewEstatus);
  return Number(select?.value || 0);
}

function syncReadonlyStatusSaveButton() {
  const btn = $(SEL.ineReviewSaveStatus);
  if (!btn) return;

  const selectedStatusId = getReadonlySelectedStatusId();
  const originalStatusId = Number(State.readonlyOriginalStatusId || 0);

  const changed =
    selectedStatusId > 0 &&
    originalStatusId > 0 &&
    selectedStatusId !== originalStatusId;

  btn.disabled = !changed || State.readonlySavingStatus;
}

async function updateReadonlyAffiliate(isAfiliado, { silent = false } = {}) {
  const record = State.readonlyRecord || {};
  const persona = record.persona || {};
  const fallbackRow = record.fallbackRow || {};

  const personaId = Number(persona.persona_id || fallbackRow.id || 0);

  if (!personaId) {
    toast("No se encontró la persona para actualizar afiliación.", "error");
    return false;
  }

  const input = $(SEL.ineReviewAfiliado);
  const previousValue = !isAfiliado;

  if (State.readonlyChangingAffiliate) return false;

  State.readonlyChangingAffiliate = true;

  if (input) input.disabled = true;

  try {
    const tipoParticipación = isAfiliado ? "AFILIADO" : "SIMPATIZANTE";
    const originalStatusId = Number(State.readonlyOriginalStatusId || 0);

    const payload = {
      persona_id: personaId,
      tipo_participacion: tipoParticipación,
      updated_by: getUsuarioId() || null,
      usuario_responsable_id: getUsuarioId() || null,
      fuente_captura: "PORTAL",
    };

    if (originalStatusId > 0) {
      payload.participacion_estatus_id = originalStatusId;
    }

    const out = await postJSON(CONFIG.ENDPOINT_UPDATE_PERSONA, payload);

    const updatedPersona = out.data || null;

    if (updatedPersona) {
      State.readonlyRecord.persona = updatedPersona;
      paintPersonaReadonlyData(updatedPersona, fallbackRow);
      paintReadonlyStatusOptions(updatedPersona, fallbackRow);
      paintReadonlyAffiliateToggle(updatedPersona, fallbackRow);
    }

    if (!isAfiliado) {
      paintPersonaReadonlyAffiliateImages([]);
    }

    if (!silent) {
      toast(
        isAfiliado
          ? "La persona ahora está marcada como afiliada."
          : "Se quitó la afiliación. La persona queda como simpatizante.",
        "exito"
      );
    }

    await loadDashboard({ keepPage: true });
    return true;
  } catch (err) {
    error("No se pudo actualizar afiliación:", err);

    if (input) input.checked = previousValue;

    toast(err?.message || "No se pudo actualizar la afiliación.", "error");
    return false;
  } finally {
    State.readonlyChangingAffiliate = false;

    if (input) input.disabled = false;
  }
}

function normalizeReadonlyCapture(capture) {
  if (!capture) return null;

  if (typeof capture === "string") {
    return {
      dataUrl: capture,
      mime: capture.match(/^data:([^;]+);base64,/)?.[1] || "image/jpeg",
      extension: capture.match(/^data:image\/([^;]+);base64,/)?.[1] || "jpg",
      sizeBytes: Math.round((capture.length * 3) / 4),
    };
  }

  const dataUrl = capture.dataUrl || capture.url || "";
  return {
    ...capture,
    dataUrl,
    mime: capture.mime || dataUrl.match(/^data:([^;]+);base64,/)?.[1] || "image/jpeg",
    extension: capture.extension || dataUrl.match(/^data:image\/([^;]+);base64,/)?.[1] || "jpg",
    sizeBytes: capture.sizeBytes || Math.round((String(dataUrl).length * 3) / 4),
  };
}

function buildReadonlyAffiliateArchivoPayload({ personaId, side, capture }) {
    const normalized = normalizeReadonlyCapture(capture);
    const fileBase = side === "front" ? "foto_persona" : "documento_afiliacion";
    const extension = normalized?.extension || "jpg";
  const timestamp = Date.now();

  return {
    entidad_tipo: "PERSONA",
    entidad_id: Number(personaId),
    uso_archivo: side === "front" ? "FOTO_PERSONA" : "DOCUMENTO_AFILIACION",
    nombre_original: `${fileBase}.${extension}`,
    nombre_storage: `persona_${personaId}_${fileBase}_${timestamp}.${extension}`,
    url_archivo: normalized?.dataUrl || "",
    mime_type: normalized?.mime || "image/jpeg",
    extension,
    tamano_bytes: normalized?.sizeBytes || null,
    version_no: 1,
    es_actual: 1,
    privado: 1,
    uploaded_by: getUsuarioId() || null,
    updated_by: getUsuarioId() || null,
  };
}

async function saveReadonlyAffiliateFiles({ personaId, captures }) {
  const normalizedCaptures = {
    front: normalizeReadonlyCapture(captures?.front),
    back: normalizeReadonlyCapture(captures?.back),
  };

  if (!normalizedCaptures.front?.dataUrl || !normalizedCaptures.back?.dataUrl) {
    return [];
  }

  const payloads = [
    buildReadonlyAffiliateArchivoPayload({
      personaId,
      side: "front",
      capture: normalizedCaptures.front,
    }),
    buildReadonlyAffiliateArchivoPayload({
      personaId,
      side: "back",
      capture: normalizedCaptures.back,
    }),
  ];

  const saved = [];

  for (const payload of payloads) {
    const out = await postJSON(CONFIG.ENDPOINT_INSERT_ARCHIVO, payload);
    if (out?.data) saved.push(out.data);
  }

  return saved;
}

async function saveReadonlyStatus() {
  const record = State.readonlyRecord || {};
  const persona = record.persona || {};
  const fallbackRow = record.fallbackRow || {};

  const personaId = Number(persona.persona_id || fallbackRow.id || 0);
  const estatusId = getReadonlySelectedStatusId();

  if (!personaId) {
    toast("No se encontró la persona para actualizar estatus.", "error");
    return;
  }

  if (!estatusId) {
    toast("Selecciona un estatus válido.", "warning");
    return;
  }

  const btn = $(SEL.ineReviewSaveStatus);
  const afiliadoInput = $(SEL.ineReviewAfiliado);
  const isAfiliado = Boolean(afiliadoInput?.checked);

  State.readonlySavingStatus = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Guardando...";
  }

  try {
    const out = await postJSON(CONFIG.ENDPOINT_UPDATE_PERSONA, {
      persona_id: personaId,
      estatus_id: estatusId,
      tipo_participacion: isAfiliado ? "AFILIADO" : "SIMPATIZANTE",
      participacion_estatus_id: estatusId,
      updated_by: getUsuarioId() || null,
      usuario_responsable_id: getUsuarioId() || null,
      fuente_captura: "PORTAL",
    });

    const updatedPersona = out.data || null;

    if (updatedPersona) {
      State.readonlyRecord.persona = updatedPersona;
      paintPersonaReadonlyData(updatedPersona, fallbackRow);
      paintReadonlyStatusOptions(updatedPersona, fallbackRow);
      paintReadonlyAffiliateToggle(updatedPersona, fallbackRow);
    } else {
      State.readonlyOriginalStatusId = estatusId;
      syncReadonlyStatusSaveButton();
    }

    toast("Estatus actualizado correctamente.", "exito");

    await loadDashboard({ keepPage: true });
  } catch (err) {
    error("No se pudo actualizar estatus:", err);
    toast(err?.message || "No se pudo actualizar el estatus.", "error");
  } finally {
    State.readonlySavingStatus = false;

    if (btn) {
      btn.textContent = "Guardar";
    }

    syncReadonlyStatusSaveButton();
  }
}

function safeText(value, fallback = "-") {
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
    const name = encodeURIComponent("red_user") + "=";
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

function isPromotorRole() {
  const rolCodigo = getRolCodigo();
  const rolId = getRolId();

  return rolCodigo === "PROMOTOR" || rolId === 5;
}

function canEditReadonlyAdminbar() {
  return !isPromotorRole();
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
    sort_key: State.sort.key,
    sort_dir: State.sort.dir,
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

async function fetchRowsForExport() {
  const usuarioId = getUsuarioId();
  const rolCodigo = getRolCodigo();

  if (!usuarioId && rolCodigo !== "ADMIN" && rolCodigo !== "COORD_GENERAL") {
    throw new Error("No se encontró usuario en sesión para exportar.");
  }

  const pageSize = 200;
  const firstOut = await postJSON(
    CONFIG.ENDPOINT_RED_HOME,
    buildDashboardPayload({
      page: 1,
      page_size: pageSize,
    }),
  );

  const totalPages = Math.max(1, Number(firstOut.meta?.total_pages || 1));
  const rows = Array.isArray(firstOut.data)
    ? firstOut.data.map(mapRedHomeToRow)
    : [];

  for (let page = 2; page <= totalPages; page += 1) {
    const out = await postJSON(
      CONFIG.ENDPOINT_RED_HOME,
      buildDashboardPayload({
        page,
        page_size: pageSize,
      }),
    );

    if (Array.isArray(out.data) && out.data.length) {
      rows.push(...out.data.map(mapRedHomeToRow));
    }
  }

  return rows;
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

  const sección =
    persona.territorio?.sección?.codigo ||
    persona.sección_codigo ||
    persona.territorio?.sección?.nombre ||
    persona.sección_nombre ||
    persona.sección_id ||
    "-";

  const zona =
    persona.territorio?.zona?.codigo ||
    persona.territorio?.zona?.nombre ||
    "-";

  const tipo = normalizeTipoParticipación(
    participacion.tipo_actual ||
    participacion.tipo_participacion ||
    persona.tipo_participacion ||
    "SIMPATIZANTE"
  );

  return {
    id: persona.persona_id,
    participacion_id: participacion.participacion_id || persona.participacion_id || null,
    nombre: nombre || "Persona sin nombre",
    domicilio: persona.domicilio_texto || "-",
    sección,
    zona,
    telefono: persona.telefono || persona.whatsapp || "-",
    validez: isEstatusValido(estatusCodigo),
    estatus_codigo: estatusCodigo,
    estatus_nombre: estatusNombre,
    tipo,
    responsable: persona.responsable || null,
    raw: persona,
  };
}

function normalizeTipoParticipación(value) {
  const tipo = normalizeText(value).replaceAll(" ", "_").toUpperCase();

  if (tipo === "AFILIADO") return "afiliado";
  if (tipo === "PROMOTOR") return "promotor";

  return "simpatizante";
}

function isEstatusValido(codigo) {
  return ESTATUS_VALIDOS.has(String(codigo || "").toUpperCase());
}

/* -------------------------------------------------------------------------- */
/* METRICAS                                                                   */
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
  paintSortHeaders();
}

function renderStatusIcon(item) {
  const validClass = item.validez ? "red-valid" : "red-valid is-missing";
  const validText = item.validez ? "✓" : "-";
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
  <tr
    class="red-row"
    data-id="${escapeHTML(item.id)}"
    data-action="open"
    tabindex="0"
    role="button"
    aria-label="Abrir registro de ${escapeHTML(safeText(item.nombre))}">
    <td class="td-name">${escapeHTML(safeText(item.nombre))}</td>
    <td>${escapeHTML(safeText(item.domicilio))}</td>
    <td>${escapeHTML(safeText(item.sección))}</td>
    <td class="td-phone">${escapeHTML(safeText(item.telefono))}</td>
    <td class="td-valid">
      ${renderStatusIcon(item)}
      <span class="red-status-mobile-text">
        ${escapeHTML(safeText(item.estatus_nombre))}
      </span>
    </td>
    <td class="td-actions">
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
        <span><strong>Sección:</strong> ${escapeHTML(safeText(item.sección))}</span>
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
    <button type="button" data-page="${State.page - 1}" ${State.page <= 1 ? "disabled" : ""}><</button>

    ${pages.map((page) => `
      <button
        type="button"
        class="page-number ${page === State.page ? "is-active" : ""}"
        data-page="${page}">
        ${page}
      </button>
    `).join("")}

    <button type="button" data-page="${State.page + 1}" ${State.page >= maxPage ? "disabled" : ""}>></button>

    <span>Pag. ${State.page} de ${maxPage} · ${total.toLocaleString("es-MX")} registros</span>

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
/* SORT TABLA                                                                  */
/* -------------------------------------------------------------------------- */

const TABLE_SORT_HEADERS = [
  { index: 0, key: "nombre" },
  { index: 1, key: "domicilio" },
  { index: 2, key: "sección" },
  { index: 3, key: "telefono" },
  { index: 4, key: "estatus" },
];

function ensureSortHeaders() {
  const headers = Array.from(document.querySelectorAll(".red-table thead th"));

  TABLE_SORT_HEADERS.forEach(({ index, key }) => {
    const th = headers[index];

    if (!th) return;

    th.dataset.sortKey = key;
    th.setAttribute("tabindex", "0");

    if (!th.hasAttribute("aria-sort")) {
      th.setAttribute("aria-sort", "none");
    }
  });
}

function paintSortHeaders() {
  const headers = document.querySelectorAll(".red-table thead th[data-sort-key]");

  headers.forEach((th) => {
    const key = th.dataset.sortKey || "";
    const isActive = key === State.sort.key;

    th.dataset.sortDir = isActive ? State.sort.dir : "";

    th.setAttribute(
      "aria-sort",
      isActive
        ? State.sort.dir === "asc"
          ? "ascending"
          : "descending"
        : "none"
    );

    th.title = isActive
      ? `Ordenado ${State.sort.dir === "asc" ? "ascendente" : "descendente"}`
      : "Click para ordenar";
  });
}

async function updateSortByHeader(th) {
  const key = th?.dataset?.sortKey || "";

  if (!key) return;

  if (State.sort.key === key) {
    State.sort.dir = State.sort.dir === "asc" ? "desc" : "asc";
  } else {
    State.sort.key = key;
    State.sort.dir = "asc";
  }

  State.page = 1;

  paintSortHeaders();

  await loadDashboard({ keepPage: true });
}

function bindSortHeaders() {
  ensureSortHeaders();

  const headers = document.querySelectorAll(".red-table thead th[data-sort-key]");

  headers.forEach((th) => {
    if (th.dataset.sortBound === "1") return;

    th.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      await updateSortByHeader(th);
    });

    th.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;

      event.preventDefault();
      event.stopPropagation();

      await updateSortByHeader(th);
    });

    th.dataset.sortBound = "1";
  });

  paintSortHeaders();
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

  await openPersonaReadonlyModal({
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

    await openPersonaReadonlyModal({
      loading: false,
      persona,
      fallbackRow: local || null,
      archivos,
      errorMessage: archivoError,
    });
  } catch (err) {
    error("No se pudo abrir detalle de persona:", err);

    await openPersonaReadonlyModal({
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

  const editableReadonlyIds = new Set([
    "ine-review-estatus",
    "ine-review-es-afiliado",
    "ine-review-save-status",
  ]);

  modal.dataset.mode = isReadonly ? "readonly" : "capture";
  form.classList.toggle("is-readonly", Boolean(isReadonly));

  form.querySelectorAll("input, textarea").forEach((field) => {
    if (isReadonly && editableReadonlyIds.has(field.id)) {
      field.disabled = false;
      field.readOnly = false;
      return;
    }

    if (field.type === "checkbox" || field.type === "radio") {
      field.disabled = Boolean(isReadonly);
      return;
    }

    field.readOnly = Boolean(isReadonly);
  });

  form.querySelectorAll("select, button").forEach((field) => {
    if (field.matches("[data-ine-review-close]")) {
      field.disabled = false;
      return;
    }

    if (isReadonly && editableReadonlyIds.has(field.id)) {
      field.disabled = false;
      return;
    }

    if (field.id === "ine-review-save-status") {
      field.disabled = true;
      return;
    }

    field.disabled = Boolean(isReadonly);
  });

  const saveBtn = $(SEL.ineReviewSave);
  const statusSaveBtn = $(SEL.ineReviewSaveStatus);
  const reprocessBtn = $(SEL.ineReviewReprocess);
  const cancelBtn = form.querySelector("[data-ine-review-close]");
  const adminbar = $(SEL.ineReviewAdminbar);
  const statusField = form.querySelector(".ine-review-status-field");
  const affiliateToggle = form.querySelector(".ine-review-affiliate-toggle");

  const showReadonlyAdminbar = Boolean(isReadonly) && canEditReadonlyAdminbar();

  if (saveBtn) saveBtn.hidden = Boolean(isReadonly);
  if (statusSaveBtn) statusSaveBtn.hidden = !showReadonlyAdminbar;
  if (reprocessBtn) reprocessBtn.hidden = Boolean(isReadonly);
  if (cancelBtn) cancelBtn.textContent = isReadonly ? "Cerrar" : "Cancelar";
  if (adminbar) adminbar.hidden = !showReadonlyAdminbar;

  if (statusField) { statusField.hidden = !showReadonlyAdminbar; }
  if (affiliateToggle) { affiliateToggle.hidden = !showReadonlyAdminbar; }

  if (!showReadonlyAdminbar) {
    const estatusSelect = $(SEL.ineReviewEstatus);
    const afiliadoInput = $(SEL.ineReviewAfiliado);

    if (estatusSelect) estatusSelect.disabled = true;
    if (afiliadoInput) afiliadoInput.disabled = true;
  }

  syncReadonlyStatusSaveButton();
}

function syncReadonlyModalBodyState() {
  const reviewModal = $(SEL.ineReviewModal);
  const revokeModal = $(SEL.revokeAffiliateModal);
  const reviewOpen = Boolean(reviewModal && !reviewModal.hidden);
  const revokeOpen = Boolean(revokeModal && !revokeModal.hidden);

  document.body.classList.toggle("ine-modal-open", reviewOpen || revokeOpen);
}

function setReviewModalOpen(isOpen) {
  const modal = $(SEL.ineReviewModal);
  if (!modal) return;

  modal.hidden = !isOpen;
  modal.setAttribute("aria-hidden", isOpen ? "false" : "true");

  syncReadonlyModalBodyState();
}

function setRevokeAffiliateModalOpen(isOpen) {
  const modal = $(SEL.revokeAffiliateModal);
  if (!modal) return;

  modal.hidden = !isOpen;
  modal.setAttribute("aria-hidden", isOpen ? "false" : "true");

  syncReadonlyModalBodyState();
}

function openRevokeAffiliateModal() {
  const modal = $(SEL.revokeAffiliateModal);
  const personText = $(SEL.revokeAffiliatePerson);
  const message = $(SEL.revokeAffiliateMessage);
  const record = State.readonlyRecord || {};
  const persona = record.persona || {};
  const fallbackRow = record.fallbackRow || {};
  const personName = String(persona.nombre_completo || fallbackRow.nombre || "").trim();

  if (!modal) {
    updateReadonlyAffiliate(false);
    return;
  }

  State.readonlyRevokeAffiliatePending = true;

  if (message) {
    message.textContent = "La persona dejara de estar marcada como afiliada y volvera al estado de simpatizante.";
  }

  if (personText) {
    personText.textContent = personName || "";
  }

  setRevokeAffiliateModalOpen(true);
}

function closeRevokeAffiliateModal({ restoreToggle = true } = {}) {
  const input = $(SEL.ineReviewAfiliado);

  setRevokeAffiliateModalOpen(false);
  State.readonlyRevokeAffiliatePending = false;

  if (restoreToggle && input) {
    input.checked = true;
  }
}

async function confirmRevokeAffiliate() {
  const confirmBtn = $(SEL.revokeAffiliateConfirm);
  const originalText = confirmBtn?.textContent || "Si, revocar afiliacion";

  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Revocando...";
  }

  closeRevokeAffiliateModal({ restoreToggle: false });

  try {
    await updateReadonlyAffiliate(false);
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = originalText;
    }
  }
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

async function openPersonaReadonlyModal({
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

  State.readonlyRevokeAffiliatePending = false;
  setRevokeAffiliateModalOpen(false);
  setReviewModalReadonlyMode(true);
  setReviewModalOpen(true);

  if (canEditReadonlyAdminbar()) {
    await loadCatEstatus();
  }

  const title = $(SEL.ineReviewTitle);
  const kicker = $(SEL.ineReviewKicker);
  const warning = $(SEL.ineReviewWarning);

  if (kicker) kicker.textContent = "Consulta de registro";

  if (loading) {
    clearImage(SEL.ineReviewFront);
    clearImage(SEL.ineReviewBack);
    paintPersonaReadonlyAffiliateImages([]);

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

  State.readonlyRecord = {
    persona: persona || {},
    fallbackRow: fallbackRow || {},
  };

  paintPersonaReadonlyData(persona || {}, fallbackRow || {});
  paintPersonaReadonlyImages(archivos);

  paintReadonlyStatusOptions(persona || {}, fallbackRow || {});
  paintReadonlyAffiliateToggle(persona || {}, fallbackRow || {});

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

    /*
    warning.innerHTML = `
      <strong>Consulta en solo lectura.</strong>
      Este registro se muestra para revisión. No se realizarán cambios desde esta vista.${tipoText}
    `;
    */

    warning.innerHTML = `
      <strong>Consulta en solo lectura.</strong>
    `;
  }

  setFieldValue("#ine-review-fecha-extraccion", p.fecha_captura || "");
  setFieldValue(
    "#ine-review-capturado-por",
    formatReadonlyAuditUser(
      p.capturado_por || p.created_by,
      "Sin capturador registrado"
    )
  );
  setFieldValue(
    "#ine-review-updated-by",
    formatReadonlyAuditUser(
      p.updated_by,
      "Este registro aún no ha sido editado"
    )
  );
  setFieldValue("#ine-review-nombres", p.nombres || "");
  setFieldValue("#ine-review-apellido-paterno", p.apellido_paterno || "");
  setFieldValue("#ine-review-apellido-materno", p.apellido_materno || "");
  setFieldValue("#ine-review-fecha-nacimiento", p.fecha_nacimiento || "");
  setFieldValue("#ine-review-sexo", p.sexo || "");

  setFieldValue("#ine-review-curp", p.curp || "");
  setFieldValue("#ine-review-clave-elector", p.clave_elector || "");
  setFieldValue("#ine-review-idmex", p.idmex || shortHash(p.idmex_hash));

  paintReadonlySeccionField(p, row);
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

  refreshReadonlyAuditUsers(p);
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

  paintPersonaReadonlyAffiliateImages(archivos);

  log("Archivos pintados en modal readonly:", {
    total: archivos.length,
    frente: frente?.archivo_id || null,
    reverso: reverso?.archivo_id || null,
  });
}

function isCurrentReadonlyRecordAfiliado() {
  const record = State.readonlyRecord || {};
  return isPersonaAfiliada(record.persona || {}, record.fallbackRow || {});
}

function paintPersonaReadonlyAffiliateImages(archivos = [], { forceShow = false } = {}) {
  const section = $(SEL.ineReviewAffiliateSection);
  const canShowAffiliateImages = forceShow || isCurrentReadonlyRecordAfiliado();
  const fotoPersona = findArchivoByUso(archivos, "FOTO_PERSONA");
  const documentoAfiliacion = findArchivoByUso(archivos, "DOCUMENTO_AFILIACION");
  const hasBoth = Boolean(
    canShowAffiliateImages &&
    fotoPersona?.url_archivo &&
    documentoAfiliacion?.url_archivo
  );

  setReadonlyImage(
    SEL.ineReviewAffiliateFront,
    hasBoth ? fotoPersona?.url_archivo || "" : "",
    "Foto de la persona"
  );

  setReadonlyImage(
    SEL.ineReviewAffiliateBack,
    hasBoth ? documentoAfiliacion?.url_archivo || "" : "",
    "Documento de afiliación"
  );

  if (section) section.hidden = !hasBoth;
}

function shortHash(value) {
  const hash = String(value || "").trim();

  if (!hash) return "";
  if (hash.length <= 18) return hash;

  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function paintReadonlySeccionField(persona = {}, fallbackRow = {}) {
  const input = $("#ine-review-sección");
  const text = $("#ine-review-sección-text");

  const secciónId = String(persona?.sección_id || "").trim();
  const secciónCodigo = String(
    persona?.territorio?.sección?.nombre ||
    // persona?.territorio?.sección?.codigo || // para mostrar el codigo en vez del nombre
    fallbackRow?.sección ||
    persona?.sección_id ||
    ""
  ).trim();

  if (input) input.value = secciónId;
  if (text) text.textContent = secciónCodigo || "Sin sección";
}

function formatReadonlyAuditUser(value, fallback = "Sin dato") {
  const userId = Number(value || 0);

  if (userId > 0) return `Usuario ID ${userId}`;

  return fallback;
}

async function loadUsuarioById(usuarioId) {
  const id = Number(usuarioId || 0);
  if (id <= 0) return null;

  if (State.usuariosById.has(id)) {
    return State.usuariosById.get(id);
  }

  const pending = postJSON(CONFIG.ENDPOINT_USUARIOS, { usuario_id: id })
    .then((out) => out?.data || null)
    .catch((err) => {
      State.usuariosById.delete(id);
      throw err;
    });

  State.usuariosById.set(id, pending);

  const usuario = await pending;
  State.usuariosById.set(id, usuario);

  return usuario;
}

async function refreshReadonlyAuditUsers(persona = {}) {
  const captureField = $("#ine-review-capturado-por");
  const updatedField = $("#ine-review-updated-by");

  const capturadoPorId = Number(persona?.capturado_por || persona?.created_by || 0);
  const updatedById = Number(persona?.updated_by || 0);

  try {
    if (capturadoPorId > 0 && captureField) {
      const usuario = await loadUsuarioById(capturadoPorId);
      const nombreCompleto = String(usuario?.nombre_completo || "").trim();

      if (nombreCompleto) {
        setFieldValue("#ine-review-capturado-por", nombreCompleto);
      }
    }
  } catch (err) {
    warn("No se pudo resolver capturado_por:", err);
  }

  try {
    if (!updatedField) return;

    if (updatedById <= 0) {
      setFieldValue("#ine-review-updated-by", "Este registro aún no ha sido editado");
      return;
    }

    const usuario = await loadUsuarioById(updatedById);
    const nombreCompleto = String(usuario?.nombre_completo || "").trim();

    if (nombreCompleto) {
      setFieldValue("#ine-review-updated-by", nombreCompleto);
    }
  } catch (err) {
    warn("No se pudo resolver updated_by:", err);
  }
}

function formatSeccionPersonaLegacy(persona = {}, fallbackRow = {}) {
  const territorio = persona.territorio?.sección || null;

  if (territorio?.codigo && territorio?.nombre) {
    return `${territorio.codigo} · ${territorio.nombre}`;
  }

  if (territorio?.codigo) return territorio.codigo;
  if (territorio?.nombre) return territorio.nombre;

  return persona.sección_id || fallbackRow.sección || "";
}

function formatSeccionPersona(persona = {}, fallbackRow = {}) {
  const territorio = persona.territorio?.sección || null;

  if (territorio?.codigo) return territorio.codigo;

  return persona.sección_id || fallbackRow.sección || "";
}

/* -------------------------------------------------------------------------- */
/* EVENTOS                                                                    */
/* -------------------------------------------------------------------------- */

function bindEvents() {
  bindSortHeaders();
  const search = $(SEL.search);
  const handleSearch = debounce(async () => {
    State.search = search?.value || "";
    await loadDashboard({ keepPage: false });
  }, 350);

  search?.addEventListener("input", handleSearch);

  document.addEventListener("click", async (event) => {
    const openTarget = event.target.closest("[data-action='open']");
    if (openTarget) {
      const row = openTarget.closest("[data-id]");
      const id = openTarget.dataset.id || row?.dataset.id;

      if (id) {
        openRecord(id);
      }

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

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    const row = event.target.closest?.(".red-row[data-action='open']");
    if (!row) return;

    event.preventDefault();
    openRecord(row.dataset.id);
  });

  $(SEL.ineReviewEstatus)?.addEventListener("change", () => {
    syncReadonlyStatusSaveButton();
  });

  $(SEL.ineReviewSaveStatus)?.addEventListener("click", async () => {
    await saveReadonlyStatus();
  });

  $(SEL.ineReviewAfiliado)?.addEventListener("change", async (event) => {
    const modal = $(SEL.ineReviewModal);
    const mode = modal?.dataset?.mode || "capture";

    /*
      para que no este saliendo el toast de "No se puede actualizar estatus" cuando se cambia el checkbox de afiliado
      en el modo de captura, solo se permite actualizar el estatus cuando se esta en modo readonly.
    */
    if (mode !== "readonly") {
      return;
    }

    if (event.target.checked && typeof window.redOpenAffiliateMedia === "function") {
      await window.redOpenAffiliateMedia({
        input: event.target,
        mode: "readonly",
      });
      return;
    }

    if (!event.target.checked) {
      openRevokeAffiliateModal();
      return;
    }

    await updateReadonlyAffiliate(Boolean(event.target.checked));
  });

  $$(SEL.revokeAffiliateClose).forEach((btn) => {
    btn.addEventListener("click", () => {
      closeRevokeAffiliateModal({ restoreToggle: true });
    });
  });

  $(SEL.revokeAffiliateConfirm)?.addEventListener("click", async () => {
    await confirmRevokeAffiliate();
  });
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
  initExportXLSXHome({
    buttonId: "red-btn-export",
    fetchRows: fetchRowsForExport,
    toast,
  });

  await loadDashboard({ keepPage: true });

  log("Home RED inicializado con endpoint server-side");
}

window.redConfirmReadonlyAffiliate = async function redConfirmReadonlyAffiliate({ captures = null } = {}) {
  const record = State.readonlyRecord || {};
  const persona = record.persona || {};
  const fallbackRow = record.fallbackRow || {};
  const personaId = Number(persona.persona_id || fallbackRow.id || 0);
  const input = $(SEL.ineReviewAfiliado);

  if (!personaId || !captures?.front || !captures?.back) {
    if (input) input.checked = false;
    throw new Error("No se pudo identificar la persona o faltan fotos de afiliación.");
  }

  const archivos = await saveReadonlyAffiliateFiles({ personaId, captures });

  if (archivos.length !== 2) {
    if (input) input.checked = false;
    throw new Error("No se pudieron guardar ambas fotos de afiliación.");
  }

  const updated = await updateReadonlyAffiliate(true, { silent: true });
  if (!updated) {
    if (input) input.checked = false;
    throw new Error("Las fotos se guardaron, pero no se pudo actualizar la afiliación.");
  }

  paintPersonaReadonlyAffiliateImages(archivos, { forceShow: true });
  toast("Afiliación y fotos guardadas correctamente.", "exito");
  return true;
};
document.addEventListener("DOMContentLoaded", init);

// Permite que otros módulos restauren el modal de revisión si lo necesitan.
window.redResetReviewModalToCaptureMode = resetReviewModalToCaptureMode;

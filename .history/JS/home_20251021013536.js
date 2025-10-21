// /JS/home.js
"use strict";

/* ============================================================================
   CONFIGURACIÓN
   ========================================================================== */
const CONFIG = {
  DEBUG_LOGS: true,
  PAGE_SIZE: 10,
  DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",
  ADMIN_ROLES: ["ADMIN"],
  PRESIDENCIA_DEPT_IDS: [6], // ids que ven TODO
  DEPT_FALLBACK_NAMES: { 6: "Presidencia" },

  // Paleta de badges (clases CSS ya existen)
  STATUS_KEY_BY_CODE: {
    0: "solicitud",
    1: "revision",
    2: "asignacion",
    3: "enProceso",
    4: "pausado",
    5: "cancelado",
    6: "finalizado",
  },
};

const TAG = "[Home]";
const log  = (...a) => { if (CONFIG.DEBUG_LOGS) console.log(TAG, ...a); };
const warn = (...a) => { if (CONFIG.DEBUG_LOGS) console.warn(TAG, ...a); };
const err  = (...a) => console.error(TAG, ...a);

/* ============================================================================
   IMPORTS
   ========================================================================== */
import { Session } from "/JS/auth/session.js";
import {
  planScope,
  loadEmpleados,
  listByAsignado,
  parseReq,
} from "/JS/api/requerimientos.js";
import { createTable } from "/JS/ui/table.js";
import { LineChart } from "/JS/charts/line-chart.js";
import { DonutChart } from "/JS/charts/donut-chart.js";

/* === NUEVO: API de usuarios (empleados) === */
import { getEmpleadoById, updateEmpleado } from "/JS/api/usuarios.js";

/* ============================================================================
   SELECTORES
   ========================================================================== */
const SEL = {
  avatar: "#hs-avatar",
  profileName: "#hs-profile-name",
  profileBadge: "#hs-profile-badge",
  profileSection: ".hs-profile",

  statusGroup: "#hs-states",
  statusItems: "#hs-states .item",

  searchInput: "#hs-search",

  legendTotal: "#hs-legend-total",
  legendStatus: "#hs-legend-status",

  tableWrap: "#hs-table-wrap",
  tableBody: "#hs-table-body",
  pager: "#hs-pager",

  chartYear: "#chart-year",
  chartMonth: "#chart-month",
  donutLegend: "#donut-legend",
};

const SIDEBAR_KEYS = [
  "todos",
  "solicitud",
  "revision",
  "asignacion",
  "proceso",
  "pausado",
  "cancelado",
  "finalizado",
];

/* ============================================================================
   HELPERS
   ========================================================================== */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };

function formatFolio(folio, id) {
  if (folio && /^REQ-\d+$/i.test(String(folio).trim()))
    return String(folio).trim();
  const digits = String(folio ?? "").match(/\d+/)?.[0];
  if (digits) return "REQ-" + digits.padStart(11, "0");
  if (id != null) return "REQ-" + String(id).padStart(11, "0");
  return "—";
}

function formatDateMX(v) {
  if (!v) return "—";
  const d = new Date(String(v).replace(" ", "T"));
  if (isNaN(d)) return v;
  return d.toLocaleDateString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit" });
}

/* ============================================================================
   PERFIL + botón "Administrar perfil" + Modal
   ========================================================================== */

/** Inserta el botón si no existe */
function ensureEditProfileButton() {
  const section = $(SEL.profileSection);
  if (!section) return;
  if (section.querySelector(".edit-profile")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "gc-btn gc-btn-ghost edit-profile";
  btn.setAttribute("data-open", "#modal-perfil");
  btn.setAttribute("aria-haspopup", "dialog");
  btn.setAttribute("aria-controls", "modal-perfil");
  btn.textContent = "Administrar perfil ›";

  const badgeEl = $(SEL.profileBadge, section);
  section.insertBefore(btn, badgeEl || null);
}

/** Partir un "Nombre completo" en { nombre, apellidos } de forma robusta */
function splitNombreCompleto(full) {
  const s = (full || "").trim().replace(/\s+/g, " ");
  if (!s) return { nombre: "", apellidos: "" };
  const parts = s.split(" ");
  if (parts.length === 1) return { nombre: parts[0], apellidos: "" };
  // Heurística: último token como último apellido, resto como nombre+apellidos
  const apellidos = parts.slice(-1).join(" ");
  const nombre = parts.slice(0, -1).join(" ");
  return { nombre, apellidos };
}

/** Devuelve input de "Reporta a" (acepta fallback si aún no cambiaste el HTML) */
function pickReportaField(modalRoot) {
  let inp = modalRoot.querySelector("#perfil-reporta");
  if (inp) return { el: inp, usedFallback: false };

  // Fallback: reutilizar el antiguo campo de nacimiento
  inp = modalRoot.querySelector("#perfil-nacimiento");
  if (inp) {
    try {
      // cambiar label visualmente
      const label = modalRoot.querySelector('label[for="perfil-nacimiento"]');
      if (label) label.childNodes[0].nodeValue = "Reporta a";
      // volverlo texto readonly
      inp.setAttribute("type", "text");
      inp.setAttribute("readonly", "true");
      inp.setAttribute("aria-readonly", "true");
      inp.classList.add("is-readonly");
    } catch {}
    return { el: inp, usedFallback: true };
  }
  return { el: null, usedFallback: false };
}

/** Inicializa el modal y lo conecta a la API de usuarios */
function initProfileModal() {
  const MODAL_ID = "modal-perfil";
  const modal = document.getElementById(MODAL_ID);
  if (!modal) { log("[Modal] #modal-perfil no encontrado (se activará cuando exista)."); return; }

  const openers = document.querySelectorAll('.edit-profile,[data-open="#modal-perfil"]');
  const closeBtn = modal.querySelector(".modal-close");
  const content  = modal.querySelector(".modal-content");
  const form     = modal.querySelector("#form-perfil");

  // Inputs base
  const inpNombre   = modal.querySelector("#perfil-nombre");
  const inpEmail    = modal.querySelector("#perfil-email");
  const inpTel      = modal.querySelector("#perfil-telefono");
  const inpPass     = modal.querySelector("#perfil-password");
  const inpPass2    = modal.querySelector("#perfil-password2");

  // Campo Reporta a (solo lectura) + fallback
  const { el: inpReporta, usedFallback } = pickReportaField(modal);
  if (!inpReporta) warn("[Perfil] Campo 'Reporta a' no está en el DOM (ni fallback).");

  // Estado para el empleado actual
  let empleadoActual = null;

  const focusFirst = () => {
    const first = modal.querySelector("input,button,select,textarea,[tabindex]:not([tabindex='-1'])");
    first?.focus();
  };

  const open = async () => {
    log("[Modal] abrir perfil (prefill)...");
    modal.classList.add("active");
    document.body.classList.add("modal-open");

    try {
      const empId = State.session.empleado_id;
      if (!empId) { warn("[Perfil] Sin empleado_id en sesión"); return; }

      // 1) Traer empleado actual
      empleadoActual = await getEmpleadoById(empId);
      log("[Perfil] empleado actual:", empleadoActual);

      // 2) Prefill simples
      const nombreCompleto = [empleadoActual?.nombre, empleadoActual?.apellidos].filter(Boolean).join(" ");
      if (inpNombre) inpNombre.value = nombreCompleto || "";
      if (inpEmail)  inpEmail.value  = (empleadoActual?.email || "").toLowerCase();
      if (inpTel)    inpTel.value    = empleadoActual?.telefono || "";
      if (inpPass)   inpPass.value   = "";
      if (inpPass2)  inpPass2.value  = "";

      // 3) Reporta a (solo lectura)
      let jefeTxt = "—";
      const reportaId = empleadoActual?.cuenta?.reporta_a ?? null;
      log("[Perfil] reporta_a id:", reportaId);
      if (reportaId) {
        try {
          const jefe = await getEmpleadoById(reportaId);
          jefeTxt = [jefe?.nombre, jefe?.apellidos].filter(Boolean).join(" ") || `Empleado #${reportaId}`;
        } catch (e) {
          warn("[Perfil] No se pudo consultar el 'reporta_a':", e);
          jefeTxt = `Empleado #${reportaId}`;
        }
      }
      if (inpReporta) {
        inpReporta.value = jefeTxt;
        inpReporta.readOnly = true;
        inpReporta.setAttribute("aria-readonly", "true");
        if (usedFallback) inpReporta.classList.add("is-readonly");
      }

      // listo
      focusFirst();
      log("[Modal] prefill OK");
    } catch (e) {
      err("[Modal] error prefill:", e);
    }
  };

  const close = () => {
    modal.classList.remove("active");
    document.body.classList.remove("modal-open");
  };

  // Abrir/cerrar
  openers.forEach(el => el.addEventListener("click", (e) => { e.preventDefault(); open(); }));
  closeBtn?.addEventListener("click", (e) => { e.preventDefault(); close(); });
  modal.addEventListener("mousedown", (e) => { if (e.target === modal && !content.contains(e.target)) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("active")) close(); });

  // Submit
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!empleadoActual) return;

    // Validar passwords (opcionales)
    if (inpPass && inpPass2 && inpPass.value !== inpPass2.value) {
      alert("Las contraseñas no coinciden.");
      return;
    }

    // Parse nombre completo → nombre + apellidos
    const { nombre, apellidos } = splitNombreCompleto(inpNombre?.value || "");

    // Construir payload de actualización
    const payload = {
      id: empleadoActual.id,
      nombre: (nombre || "").trim(),
      apellidos: (apellidos || "").trim(),
      email: (inpEmail?.value || "").trim().toLowerCase(),
      telefono: (inpTel?.value || "").trim(),
      // Omitimos: reporta_a, roles, username, depto, etc.
      ...(inpPass?.value ? { password: inpPass.value } : {}),
      updated_by: State.session?.empleado_id || null,
    };

    log("[Perfil] updateEmpleado payload:", payload);

    try {
      const result = await updateEmpleado(payload);
      log("[Perfil] actualizado OK:", result);

      // Refrescar encabezado de perfil
      const nuevoNombre = [payload.nombre, payload.apellidos].filter(Boolean).join(" ") || "—";
      setText(SEL.profileName, nuevoNombre);

      // (El badge de depto no cambia aquí)

      close();
    } catch (e2) {
      err("[Perfil] error al actualizar:", e2);
      alert("Error al actualizar perfil. Intenta de nuevo.");
    }
  });
}

/* ============================================================================
   ESTADO
   ========================================================================== */
const State = {
  session: { empleado_id: null, dept_id: null, roles: [], id_usuario: null },
  scopePlan: null,
  universe: [],
  rows: [], // parseados para UI
  filterKey: "todos",
  search: "",
  counts: {
    todos: 0,
    pendientes: 0,
    en_proceso: 0,
    terminados: 0,
    cancelados: 0,
    pausados: 0,
  },
  table: null,
  __page: 1,
};

let Charts = { line: null, donut: null };

/* ============================================================================
   COOKIE FALLBACK
   ========================================================================== */
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

/* ============================================================================
   RESOLVER NOMBRE DE DEPTO
   ========================================================================== */
async function resolveDeptName(deptId) {
  if (!deptId) return "—";
  if (CONFIG.DEPT_FALLBACK_NAMES[deptId])
    return CONFIG.DEPT_FALLBACK_NAMES[deptId];
  try {
    const url =
      "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ page: 1, page_size: 200, status: 1 }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    const arr = json?.data || [];
    const found = arr.find((d) => Number(d.id) === Number(deptId));
    return found?.nombre || `Depto ${deptId}`;
  } catch {
    return `Depto ${deptId}`;
  }
}

async function isPrimeraLinea(viewerId, deptId) {
  try {
    const url =
      "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    const arr = json?.data || [];
    const dep = arr.find((d) => Number(d.id) === Number(deptId));
    return !!(dep && Number(dep.primera_linea) === Number(viewerId));
  } catch {
    return false;
  }
}

/* ============================================================================
   SESIÓN
   ========================================================================== */
function readSession() {
  let s = null;
  try { s = Session?.get?.() || null; } catch {}
  if (!s) s = readCookiePayload();

  if (!s) {
    warn("Sin sesión.");
    State.session = { empleado_id: null, dept_id: null, roles: [], id_usuario: null };
    return State.session;
  }
  const empleado_id = s?.empleado_id ?? s?.id_empleado ?? null;
  const dept_id     = s?.departamento_id ?? null;
  const roles       = Array.isArray(s?.roles) ? s.roles.map((r) => String(r).toUpperCase()) : [];
  const id_usuario  = s?.id_usuario ?? s?.cuenta_id ?? null;

  log("sesión detectada", { empleado_id, dept_id, roles });
  State.session = { empleado_id, dept_id, roles, id_usuario };
  return State.session;
}

/* ============================================================================
   PERFIL UI
   ========================================================================== */
async function hydrateProfileFromSession() {
  const s = Session?.get?.() || readCookiePayload() || {};
  const nombre = [s?.nombre, s?.apellidos].filter(Boolean).join(" ") || "—";
  setText(SEL.profileName, nombre);

  const badge = $(SEL.profileBadge);
  if (badge) {
    const deptName = await resolveDeptName(State.session.dept_id);
    badge.textContent = deptName || "—";
  }

  const img = $(SEL.avatar);
  if (img) {
    const idu = State.session.id_usuario;
    const candidates = idu
      ? [
          `/ASSETS/usuario/usuarioImg/user_${idu}.png`,
          `/ASSETS/usuario/usuarioImg/user_${idu}.jpg`,
          `/ASSETS/usuario/usuarioImg/img_user${idu}.png`,
          `/ASSETS/usuario/usuarioImg/img_user${idu}.jpg`,
        ]
      : [];
    let i = 0;
    const tryNext = () => {
      if (i >= candidates.length) { img.src = CONFIG.DEFAULT_AVATAR; return; }
      img.onerror = () => { i++; tryNext(); };
      img.src = `${candidates[i]}?v=${Date.now()}`;
    };
    tryNext();
  }
}

/* ============================================================================
   SIDEBAR
   ========================================================================== */
function initSidebar(onChange) {
  const group = $(SEL.statusGroup);
  if (!group) return;

  group.setAttribute("role", "radiogroup");
  const items = $$(SEL.statusItems);
  items.forEach((btn, i) => {
    btn.setAttribute("role", "radio");
    btn.setAttribute("tabindex", i === 0 ? "0" : "-1");
    btn.setAttribute("aria-checked", btn.classList.contains("is-active") ? "true" : "false");
    const key = btn.dataset.status;
    if (!SIDEBAR_KEYS.includes(key)) warn("status no válido:", key);

    btn.addEventListener("click", () => {
      items.forEach((b) => {
        b.classList.remove("is-active");
        b.setAttribute("aria-checked", "false");
        b.tabIndex = -1;
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-checked", "true");
      btn.tabIndex = 0;
      State.filterKey = key || "todos";
      State.__page = 1;
      updateLegendStatus();
      onChange?.();
      $(SEL.searchInput)?.focus();
    });
  });

  group.addEventListener("keydown", (e) => {
    const cur = document.activeElement.closest(".item");
    const idx = Math.max(0, items.indexOf(cur));
    let next = idx;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (idx + 1) % items.length;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (idx - 1 + items.length) % items.length;
    if (next !== idx) { items[next].focus(); e.preventDefault(); }
    if (e.key === " " || e.key === "Enter") { items[next].click(); e.preventDefault(); }
  });
}

/* ============================================================================
   SEARCH
   ========================================================================== */
function initSearch(onChange) {
  const input = $(SEL.searchInput);
  if (!input) return;
  let t;
  input.addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      State.search = (e.target.value || "").trim().toLowerCase();
      State.__page = 1;
      onChange?.();
    }, 250);
  });
}

/* ============================================================================
   TABLA (REQID, Tipo de trámite, Asignado, Teléfono, Estatus)
   ========================================================================== */
function buildTable() {
  State.table = createTable({
    bodySel: SEL.tableBody,
    wrapSel: SEL.tableWrap,
    pagSel: null,
    pageSize: CONFIG.PAGE_SIZE,
    columns: [
      {
        key: "folio",
        title: "Folio",
        sortable: true,
        accessor: (r) => {
          const m = String(r.folio ?? "").match(/\d+/);
          return m ? Number(m[0]) : Number(r.id || 0);
        },
        render: (v, r) => {
          const fol = (r.folio ?? "").toString().trim();
          if (/^REQ-\d+$/i.test(fol)) return fol;
          const digits = (fol.match(/\d+/) || [String(r.id ?? "")])[0];
          return digits ? "REQ-" + digits.padStart(11, "0") : "—";
        },
      },
      {
        key: "tramite",
        title: "Tipo de trámite",
        sortable: true,
        accessor: (r) => r.tramite || r.asunto || "—",
      },
      {
        key: "asignado",
        title: "Asignado",
        sortable: true,
        accessor: (r) => r.asignado || "Sin asignar",
      },
      {
        key: "tel",
        title: "Teléfono de contacto",
        sortable: true,
        accessor: (r) => r.tel || "—",
        render: (v) => (v && v !== "—" ? v : "—"),
      },
      {
        key: "status",
        title: "Estatus",
        sortable: true,
        accessor: (r) => r.estatus?.label || "—",
        render: (v, r) => {
          const k = (r.estatus?.key || "revision").toLowerCase();
          return `<span class="badge-status" data-k="${k}">${r.estatus?.label || "—"}</span>`;
        },
      },
    ],
  });
  State.table.setPageSize?.(CONFIG.PAGE_SIZE);
  State.table.setSort?.("folio", -1);
}

/* ============================================================================
   LEYENDAS / CONTEOS
   ========================================================================== */
function updateLegendTotals(n) {
  setText(SEL.legendTotal, String(n ?? 0));
}
function updateLegendStatus() {
  const map = {
    todos: "Todos los status",
    solicitud: "Solicitud",
    revision: "Revisión",
    asignacion: "Asignación",
    proceso: "En proceso",
    pausado: "Pausado",
    cancelado: "Cancelado",
    finalizado: "Finalizado",
  };
  setText(SEL.legendStatus, map[State.filterKey] || "Todos los status");
}

function computeCounts(rows) {
  const c = {
    todos: 0,
    solicitud: 0,
    revision: 0,
    asignacion: 0,
    proceso: 0,
    pausado: 0,
    cancelado: 0,
    finalizado: 0,
  };
  rows.forEach((r) => {
    c.todos++;
    const k = (r.estatus?.key || "").toLowerCase();
    if (k in c) c[k]++;
  });
  State.counts = c;
  setText("#cnt-todos", `(${c.todos})`);
  setText("#cnt-solicitud", `(${c.solicitud})`);
  setText("#cnt-revision", `(${c.revision})`);
  setText("#cnt-asignacion", `(${c.asignacion})`);
  setText("#cnt-proceso", `(${c.proceso})`);
  setText("#cnt-pausado", `(${c.pausado})`);
  setText("#cnt-cancelado", `(${c.cancelado})`);
  setText("#cnt-finalizado", `(${c.finalizado})`);
}

/* ============================================================================
   PAGINACIÓN CLÁSICA
   ========================================================================== */
function renderPagerClassic(total) {
  const cont = $(SEL.pager);
  if (!cont) return;

  const pages = Math.max(1, Math.ceil(total / CONFIG.PAGE_SIZE));
  const cur = Math.min(Math.max(1, State.__page || 1), pages);

  const btn = (label, p, extra = "") =>
    `<button class="btn ${extra}" data-p="${p}" ${p === "disabled" ? "disabled" : ""}>${label}</button>`;

  let nums = "";
  for (let i = 1; i <= pages; i++) nums += btn(String(i), i, i === cur ? "primary" : "");

  cont.innerHTML = [
    btn("«", cur <= 1 ? "disabled" : 1),
    btn("‹", cur <= 1 ? "disabled" : cur - 1),
    nums,
    btn("›", cur >= pages ? "disabled" : cur + 1),
    btn("»", cur >= pages ? "disabled" : pages),
    `<span class="muted" style="margin-left:.75rem;">Ir a:</span>`,
    `<input type="number" min="1" max="${pages}" value="${cur}" data-goto style="width:4rem;margin:0 .25rem;">`,
    `<button class="btn" data-go>Ir</button>`,
  ].join(" ");

  cont.querySelectorAll("[data-p]").forEach((b) => {
    b.addEventListener("click", () => {
      const v = b.getAttribute("data-p");
      if (v === "disabled") return;
      const p = parseInt(v, 10);
      if (!Number.isFinite(p)) return;
      State.__page = p;
      State.table?.setPage(p);
      refreshCurrentPageDecorations();
      renderPagerClassic(total);
    });
  });

  cont.querySelector("[data-go]")?.addEventListener("click", () => {
    const n = parseInt(cont.querySelector("[data-goto]")?.value || "1", 10);
    const p = Math.min(Math.max(1, n), pages);
    State.__page = p;
    State.table?.setPage(p);
    refreshCurrentPageDecorations();
    renderPagerClassic(total);
  });
}

/* ============================================================================
   GAPS + BIND ROW CLICK
   ========================================================================== */
function refreshCurrentPageDecorations() {
  const tbody = $(SEL.tableBody);
  if (!tbody) return;

  // limpiar gaps previos
  tbody.querySelectorAll("tr.hs-gap").forEach((tr) => tr.remove());

  // filas reales actuales
  const pageRows = State.table?.getRawRows?.() || [];
  const realCount = pageRows.length;
  const gaps = Math.max(0, CONFIG.PAGE_SIZE - realCount);

  // limpiar interacción previa y re-asignar
  Array.from(tbody.querySelectorAll("tr")).forEach((tr) => {
    tr.classList.remove("is-clickable");
    tr.onclick = null;
  });
  for (let i = 0; i < realCount; i++) {
    const tr = tbody.querySelectorAll("tr")[i];
    const raw = pageRows[i];
    if (!tr || !raw) continue;
    tr.classList.add("is-clickable");
    tr.addEventListener("click", () => {
      const id = raw?.id || raw?.__raw?.id;
      if (id) window.location.href = `/VIEWS/requerimiento.php?id=${id}`;
    });
  }

  if (gaps > 0) {
    let html = "";
    for (let i = 0; i < gaps; i++) {
      html += `<tr class="hs-gap" aria-hidden="true"><td colspan="5">&nbsp;</td></tr>`;
    }
    tbody.insertAdjacentHTML("beforeend", html);
  }
  log("gaps añadidos:", gaps, "reales en página:", realCount);
}

/* ============================================================================
   PIPELINE + RENDER
   ========================================================================== */
function applyPipelineAndRender() {
  const all = State.rows || [];
  let filtered = all;

  if (State.filterKey !== "todos") {
    filtered = filtered.filter(
      (r) => (r.estatus?.key || "").toLowerCase() === State.filterKey
    );
  }
  if (State.search) {
    const q = State.search;
    filtered = filtered.filter((r) => {
      const asunto = (r.asunto || "").toLowerCase();
      const asign = (r.asignado || "").toLowerCase();
      const est = (r.estatus?.label || "").toLowerCase();
      const folio = (r.folio || "").toLowerCase();
      const idTxt = String(r.id || "");
      return (
        asunto.includes(q) ||
        asign.includes(q) ||
        est.includes(q) ||
        folio.includes(q) ||
        idTxt.includes(q)
      );
    });
  }

  computeCounts(all);
  updateLegendTotals(filtered.length);

  const rows = filtered.map((r) => ({
    __raw: r,
    id: r.id,
    tramite: r.tramite,
    asunto: r.asunto,
    asignado: r.asignado,
    tel: r.tel,
    estatus: r.estatus,
  }));

  State.table?.setData(rows);
  State.__page = 1;

  refreshCurrentPageDecorations();
  renderPagerClassic(filtered.length);

  log("pipeline", {
    filtroStatus: State.filterKey,
    search: State.search,
    totalUniverso: all.length,
    totalFiltrado: filtered.length,
    page: State.__page,
  });

  // Charts sensibles al filtro
  drawChartsFromRows(filtered);
}

/* ============================================================================
   CHARTS — helpers + render
   ========================================================================== */
function computeYearSeries(rows) {
  const now = new Date();
  const y = now.getFullYear();
  const series = Array(12).fill(0);
  for (const r of rows) {
    const iso = String(r.creado || r.raw?.created_at || "").replace(" ", "T");
    const d = new Date(iso);
    if (!isNaN(d) && d.getFullYear() === y) series[d.getMonth()]++;
  }
  return series;
}
function computeMonthDistribution(rows) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const by = new Map();
  for (const r of rows) {
    const iso = String(r.creado || r.raw?.created_at || "").replace(" ", "T");
    const d = new Date(iso);
    if (!isNaN(d) && d.getFullYear() === y && d.getMonth() === m) {
      const key = r.tramite || r.asunto || "Otros";
      by.set(key, (by.get(key) || 0) + 1);
    }
  }
  const items = Array.from(by.entries()).map(([label, value]) => ({ label, value }));
  items.sort((a, b) => b.value - a.value);
  const total = items.reduce((a, b) => a + b.value, 0);
  return { items, total };
}
function drawChartsFromRows(rows) {
  const labels = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const yearSeries = computeYearSeries(rows);
  const monthAgg   = computeMonthDistribution(rows);

  const $line  = $(SEL.chartYear);
  const $donut = $(SEL.chartMonth);

  log("CHARTS — input (rows length):", rows.length);
  log("CHARTS — year series:", { labels, series: yearSeries });
  log("CHARTS — month distribution:", monthAgg);

  if ($line) {
    Charts.line = new LineChart($line, { labels, series: yearSeries, showGrid: true, headroom: 0.2, yTicks: 6 });
    log("CHARTS — LineChart render ok");
  }
  if ($donut) {
    Charts.donut = new DonutChart($donut, { data: monthAgg.items, total: monthAgg.total, legendEl: $(SEL.donutLegend) || null, showPercLabels: true });
    log("CHARTS — DonutChart render ok", { total: monthAgg.total });
  }

  document.querySelectorAll(".hs-chart-skeleton")?.forEach((el) => el.remove());
}

/* ============================================================================
   RBAC – fetch según rol
   ========================================================================== */
async function fetchAllRequerimientos(perPage = 200, maxPages = 50) {
  const url =
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_requerimiento.php";
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ page, per_page: perPage }),
    });
    if (!res.ok) break;
    const json = await res.json();
    const arr = json?.data || [];
    all.push(...arr);
    if (arr.length < perPage) break;
  }
  return all;
}

async function fetchMineAndTeam(plan) {
  const ids = [plan.mineId, ...(plan.teamIds || [])].filter(Boolean);
  const results = await Promise.allSettled(ids.map((id) => listByAsignado(id, {})));
  const lists = results.filter((r) => r.status === "fulfilled").map((r) => r.value || []);
  const map = new Map();
  lists.flat().forEach((r) => { if (r?.id != null) map.set(r.id, r); });
  return Array.from(map.values()).sort(
    (a, b) =>
      String(b.created_at || "").localeCompare(String(a.created_at || "")) ||
      (b.id || 0) - (a.id || 0)
  );
}

async function fetchDeptAsignacion(deptId) {
  const url =
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_requerimiento.php";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ departamento_id: deptId, estatus: 2, per_page: 200 }),
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json?.data || [];
}

/* ============================================================================
   CARGA PRINCIPAL
   ========================================================================== */
async function loadScopeData() {
  const { empleado_id: viewerId, dept_id, roles } = State.session;
  if (!viewerId) {
    warn("viewerId ausente.");
    State.universe = [];
    State.rows = [];
    computeCounts([]);
    updateLegendTotals(0);
    updateLegendStatus();
    applyPipelineAndRender();
    drawChartsFromRows([]);
    return;
  }

  const plan = await planScope({ viewerId, viewerDeptId: dept_id });
  State.scopePlan = plan;

  const isAdmin = (roles || []).some((r) => CONFIG.ADMIN_ROLES.includes(r));
  const isPres  = CONFIG.PRESIDENCIA_DEPT_IDS.includes(Number(dept_id));
  const isDir   = (roles || []).includes("DIRECTOR");
  const soyPrimeraLinea = await isPrimeraLinea(viewerId, dept_id);

  log("RBAC flags:", { isAdmin, isPres, isDirector: isDir, soyPrimeraLinea });

  let items = [];
  if (isAdmin || isPres) {
    log("modo ADMIN/PRESIDENCIA → fetch global");
    items = await fetchAllRequerimientos();
  } else if (isDir || soyPrimeraLinea) {
    log("modo DIRECTOR/PRIMERA LÍNEA → asignación del depto + asignados (yo/team)");
    const [deptAsign, mineTeam] = await Promise.all([ fetchDeptAsignacion(dept_id), fetchMineAndTeam(plan) ]);
    const dedup = new Map();
    [...deptAsign, ...mineTeam].forEach((r) => { if (r?.id != null) dedup.set(r.id, r); });
    items = Array.from(dedup.values()).sort(
      (a, b) =>
        String(b.created_at || "").localeCompare(String(a.created_at || "")) ||
        (b.id || 0) - (a.id || 0)
    );
  } else {
    log("modo JEFE/ANALISTA/resto → yo + team asignados");
    items = await fetchMineAndTeam(plan);
  }

  State.universe = items.slice();
  State.rows = State.universe.map(parseReq);

  log("items UI-mapped (preview):",
    State.rows.slice(0, 5).map((r) => ({
      id: r.id,
      tramite: r.tramite,
      asignado: r.asignado,
      tel: r.tel,
      estatus: r.estatus?.label,
    }))
  );

  computeCounts(State.rows);
  updateLegendTotals(State.rows.length);
  updateLegendStatus();
  applyPipelineAndRender();

  drawChartsFromRows(State.rows);
  log("Home listo");
}

/* ============================================================================
   INIT
   ========================================================================== */
window.addEventListener("DOMContentLoaded", async () => {
  try {
    readSession();
    await hydrateProfileFromSession();
    ensureEditProfileButton();    // <- inserta botón si no estaba
    initProfileModal();           // <- conecta modal + API usuarios
    initSidebar(() => applyPipelineAndRender());
    initSearch(() => applyPipelineAndRender());
    buildTable();
    updateLegendStatus();

    await loadScopeData();
  } catch (e) {
    err("init error:", e);
  }
});

// /JS/home.js
"use strict";

/* ============================================================================
   Imports
   ========================================================================== */
import { Session } from "/JS/auth/session.js";
import {
  planScope,
  fetchScope,
  parseReq,
  ESTATUS,
  loadEmpleados,          
} from "/JS/api/requerimientos.js";
import { createTable } from "/JS/ui/table.js";

/* ============================================================================
   Debug flag
   ========================================================================== */
const DEBUG_LOGS = true;              
const TAG = "[Home]";
const log  = (...a) => { if (DEBUG_LOGS) console.log(TAG, ...a); };
const warn = (...a) => { if (DEBUG_LOGS) console.warn(TAG, ...a); };
const err  = (...a) => console.error(TAG, ...a);
window.__HOME_DEBUG = DEBUG_LOGS;

/* ============================================================================
   Selectores
   ========================================================================== */
const SEL = {
  // Perfil
  avatar:       "#hs-avatar",
  profileName:  "#hs-profile-name",
  profileBadge: "#hs-profile-badge",

  // Sidebar estados
  statusGroup:  "#hs-states",
  statusItems:  "#hs-states .item",

  // Búsqueda
  searchInput:  "#hs-search",

  // Leyendas
  legendTotal:  "#hs-legend-total",
  legendStatus: "#hs-legend-status",

  // Tabla
  tableWrap:    "#hs-table-wrap",
  tableBody:    "#hs-table-body",
  pager:        "#hs-pager",

  // Charts (hooks)
  chartYear:    "#chart-year",
  chartMonth:   "#chart-month",
};
const SIDEBAR_KEYS = ["todos", "pendientes", "en_proceso", "terminados", "cancelados", "pausados"];

/* ============================================================================
   Helpers DOM
   ========================================================================== */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };

function formatDateMX(isoOrSql) {
  if (!isoOrSql) return "—";
  const s = String(isoOrSql).replace(" ", "T");
  const d = new Date(s);
  if (isNaN(d)) return isoOrSql;
  return d.toLocaleDateString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit" });
}

/* ============================================================================
   Estado
   ========================================================================== */
const State = {
  session: { empleado_id: null, dept_id: null, roles: [], id_usuario: null },
  scopePlan: null,
  universe: [],
  rows: [],
  filterKey: "todos",
  search: "",
  counts: { todos: 0, pendientes: 0, en_proceso: 0, terminados: 0, cancelados: 0, pausados: 0 },
  table: null
};

/* ============================================================================
   Fallback cookie ix_emp (base64 JSON) si Session.get() no devuelve nada
   ========================================================================== */
function readCookiePayload() {
  try {
    const name = "ix_emp=";
    const pair = document.cookie.split("; ").find(c => c.startsWith(name));
    if (!pair) return null;
    const raw = decodeURIComponent(pair.slice(name.length));
    return JSON.parse(decodeURIComponent(escape(atob(raw)))) || null;
  } catch (e) {
    warn("No se pudo decodificar cookie ix_emp:", e);
    return null;
  }
}

/* ============================================================================
   Lectura de sesión
   ========================================================================== */
function readSession() {
  let s = null;
  try { s = Session?.get?.() || null; } catch { s = null; }

  if (!s) {
    s = readCookiePayload();
    log("cookie ix_emp (fallback):", s || null);
  } else {
    log("cookie ix_emp (via Session):", s || null);
  }

  if (!s) {
    warn("No hay sesión (Session.get y cookie fallback nulos).");
    State.session = { empleado_id: null, dept_id: null, roles: [], id_usuario: null };
    return State.session;
  }

  const empleado_id = s?.empleado_id ?? s?.id_empleado ?? null;
  const dept_id     = s?.departamento_id ?? null;
  const roles       = Array.isArray(s?.roles) ? s.roles.map(r => String(r).toUpperCase()) : [];
  const id_usuario  = s?.id_usuario ?? s?.cuenta_id ?? null;

  if (!empleado_id) {
    warn("No hay sesión válida (empleado_id).");
  } else {
    log("sesión detectada", { idEmpleado: empleado_id, depId: dept_id, roles });
  }

  State.session = { empleado_id, dept_id, roles, id_usuario };
  return State.session;
}

/* ============================================================================
   UI: perfil
   ========================================================================== */
function hydrateProfileFromSession() {
  const s = Session?.get?.() || readCookiePayload() || {};
  const nombre = [s?.nombre, s?.apellidos].filter(Boolean).join(" ") || "—";
  setText(SEL.profileName, nombre);

  const depBadgeEl = $(SEL.profileBadge);
  if (depBadgeEl) {
    const text = depBadgeEl.textContent?.trim();
    if (!text || text === "—") {
      depBadgeEl.textContent = State.session.dept_id != null ? String(State.session.dept_id) : "—";
    }
  }

  // Avatar con fallback silencioso
  const avatarEl = $(SEL.avatar);
  if (avatarEl && State.session.id_usuario != null) {
    const idu = State.session.id_usuario;
    const candidates = [
      `/ASSETS/usuario/usuarioImg/user_${idu}.png`,
      `/ASSETS/usuario/usuarioImg/user_${idu}.jpg`,
      `/ASSETS/usuario/usuarioImg/img_user${idu}.png`,
      `/ASSETS/usuario/usuarioImg/img_user${idu}.jpg`,
    ];
    let idx = 0;
    const tryNext = () => {
      if (idx >= candidates.length) return;
      avatarEl.onerror = () => { idx++; tryNext(); };
      avatarEl.src = `${candidates[idx]}?v=${Date.now()}`;
    };
    tryNext();
  }
}

/* ============================================================================
   Sidebar: eventos + ARIA
   ========================================================================== */
function initStatesSidebar() {
  const group = $(SEL.statusGroup);
  if (!group) { warn("No se encontró el contenedor de estados", SEL.statusGroup); return; }
  group.setAttribute("role", "radiogroup");

  const items = $$(SEL.statusItems);
  if (!items.length) warn("No se encontraron status items a tiempo. Revisa el HTML o los selectores.");

  items.forEach((btn, i) => {
    btn.setAttribute("role", "radio");
    btn.setAttribute("tabindex", i === 0 ? "0" : "-1");
    btn.setAttribute("aria-checked", btn.classList.contains("is-active") ? "true" : "false");

    if (!SIDEBAR_KEYS.includes(btn.dataset.status)) warn("Botón de estado sin data-status válido:", btn);

    btn.addEventListener("click", () => {
      items.forEach(b => { b.classList.remove("is-active"); b.setAttribute("aria-checked", "false"); b.tabIndex = -1; });
      btn.classList.add("is-active"); btn.setAttribute("aria-checked", "true"); btn.tabIndex = 0;
      State.filterKey = btn.dataset.status || "todos";
      updateLegendStatus();
      applyPipelineAndRender();
      $(SEL.searchInput)?.focus();
    });
  });

  group.addEventListener("keydown", (e) => {
    const items = $$(SEL.statusItems);
    if (!items.length) return;
    const cur = document.activeElement.closest(".item");
    const idx = Math.max(0, items.indexOf(cur));
    let nextIdx = idx;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") nextIdx = (idx + 1) % items.length;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") nextIdx = (idx - 1 + items.length) % items.length;
    if (nextIdx !== idx) { items[nextIdx].focus(); e.preventDefault(); }
    if (e.key === " " || e.key === "Enter") { items[nextIdx].click(); e.preventDefault(); }
  });

  log("sidebar events listos");
}

/* ============================================================================
   Búsqueda
   ========================================================================== */
function initSearch() {
  const input = $(SEL.searchInput);
  if (!input) return;
  let t;
  input.addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      State.search = (e.target.value || "").trim().toLowerCase();
      applyPipelineAndRender();
    }, 250);
  });
}

/* ============================================================================
   Tabla
   ========================================================================== */
function buildTable() {
  State.table = createTable({
    bodySel:  SEL.tableBody,
    wrapSel:  SEL.tableWrap,
    pagSel:   SEL.pager,
    pageSize: 25,
    columns: [
      {
        key: "tramite",
        title: "Trámites",
        sortable: true,
        accessor: r => r.asunto || r.tramite || "—"
      },
      {
        key: "asignado",
        title: "Asignado",
        sortable: true,
        accessor: r => r.asignado || "—"
      },
      {
        key: "fecha",
        title: "Fecha de solicitado",
        sortable: true,
        accessor: r => r.creado ? new Date(String(r.creado).replace(" ", "T")).getTime() : 0,
        render: (v, r) => formatDateMX(r.creado)
      },
      {
        key: "status",
        title: "Status",
        sortable: true,
        accessor: r => r.estatus?.label || "—",
        render: (v, r) => {
          const cat = catKeyFromCode(r.estatus?.code);
          return `<span class="hs-status" data-k="${cat}">${r.estatus?.label || "—"}</span>`;
        }
      }
    ]
  });
  // Orden inicial: más recientes primero
  State.table.setSort?.("fecha", -1);
}

/* ============================================================================
   Leyenda
   ========================================================================== */
function updateLegendTotals(n) { setText(SEL.legendTotal, String(n ?? 0)); }
function updateLegendStatus() {
  const map = {
    todos: "Todos los status",
    pendientes: "Pendientes",
    en_proceso: "En proceso",
    terminados: "Terminados",
    cancelados: "Cancelados",
    pausados: "Pausados",
  };
  setText(SEL.legendStatus, map[State.filterKey] || "Todos los status");
}

/* ============================================================================
   Conteos
   ========================================================================== */
function catKeyFromCode(code) {
  if (code === 3) return "en_proceso";
  if (code === 4) return "pausados";
  if (code === 5) return "cancelados";
  if (code === 6) return "terminados";
  return "pendientes"; // 0,1,2
}
function computeCounts(rows) {
  const c = { todos: 0, pendientes: 0, en_proceso: 0, terminados: 0, cancelados: 0, pausados: 0 };
  rows.forEach(r => { c.todos++; const k = catKeyFromCode(r.estatus?.code); if (k in c) c[k]++; });
  State.counts = c;
  log("conteos", c);

  setText("#cnt-todos",       `(${c.todos})`);
  setText("#cnt-pendientes",  `(${c.pendientes})`);
  setText("#cnt-en_proceso",  `(${c.en_proceso})`);
  setText("#cnt-terminados",  `(${c.terminados})`);
  setText("#cnt-cancelados",  `(${c.cancelados})`);
  setText("#cnt-pausados",    `(${c.pausados})`);
}

/* ============================================================================
   Pipeline + render tabla
   ========================================================================== */
function applyPipelineAndRender() {
  const all = State.rows || [];
  let filtered = all;

  if (State.filterKey !== "todos") {
    filtered = filtered.filter(r => catKeyFromCode(r.estatus?.code) === State.filterKey);
  }
  if (State.search) {
    const q = State.search;
    filtered = filtered.filter(r => {
      const asunto = (r.asunto || "").toLowerCase();
      const asign  = (r.asignado || "").toLowerCase();
      const est    = (r.estatus?.label || "").toLowerCase();
      const folio  = (r.folio || "").toLowerCase(); // <-- incluir folio
      return asunto.includes(q) || asign.includes(q) || est.includes(q) || folio.includes(q);
    });
  }

  computeCounts(all);
  updateLegendTotals(filtered.length);

  const tableRows = filtered.map(r => ({
    __raw: r,
    asunto:   r.asunto,
    tramite:  r.tramite,
    asignado: r.asignado,
    creado:   r.creado,
    estatus:  r.estatus
  }));

  State.table?.setData(tableRows);

  if (State.table) {
    const s = State.table.getSort?.() || {};
    log("table render", s);
  }
  log("pipeline", {
    filtroStatus: State.filterKey,
    search: State.search,
    totalUniverso: all.length,
    totalFiltrado: tableRows.length,
    counts: State.counts
  });
}

/* ============================================================================
   Util: log de jerarquía (usuario principal + subordinados con nombres)
   ========================================================================== */
async function logHierarchy(plan) {
  try {
    if (!plan) return;
    const empleados = await loadEmpleados({ status_empleado: 1 });
    const byId = new Map(empleados.map(e => [e.id, e]));
    const principal = byId.get(plan.viewerId);
    const fullName = (e) => e ? [e.nombre, e.apellidos].filter(Boolean).join(" ") : "—";

    const subsAll = (plan.teamIds || []).map(id => {
      const emp = byId.get(id);
      return { id, nombre: fullName(emp), depto: emp?.departamento_id ?? null, username: emp?.cuenta?.username || null };
    });

    log("USUARIO PRINCIPAL:", {
      id: plan.viewerId,
      nombre: fullName(principal),
      depto: principal?.departamento_id ?? null,
      role: plan.role,
      isAdmin: !!plan.isAdmin
    });
    log("SUBORDINADOS (deep):", { total: subsAll.length, items: subsAll });
  } catch (e) {
    warn("No se pudo loggear jerarquía:", e);
  }
}

/* ============================================================================
   Carga de datos (scope por subordinados)
   ========================================================================== */
async function loadScopeData() {
  const viewerId = State.session.empleado_id;
  const viewerDeptId = State.session.dept_id;

  if (!viewerId) {
    warn("viewerId ausente. Se omite carga de scope.");
    State.universe = [];
    State.rows = [];
    computeCounts(State.rows);
    updateLegendTotals(0);
    updateLegendStatus();
    applyPipelineAndRender();
    return;
  }

  log("construyendo planScope", { viewerId, viewerDeptId });
  const plan = await planScope({ viewerId, viewerDeptId });
  State.scopePlan = plan;
  log("planScope listo", plan);

  // LOG: jerarquía con nombres
  logHierarchy(plan);

  log("ejecutando fetchScope…");
  const { items, counts, filtros } = await fetchScope({ plan, filtros: {} });
  log("fetchScope OK", { total: items.length, counts, filtros });

  State.universe = items.slice();
  State.rows = State.universe.map(parseReq);

  computeCounts(State.rows);
  updateLegendTotals(State.rows.length);
  updateLegendStatus();
  applyPipelineAndRender();

  log("datos listos", {
    total: State.rows.length,
    primeros3: State.rows.slice(0, 3).map(r => ({ id: r.id, folio: r.folio, estatus: r.estatus?.code }))
  });
}

/* ============================================================================
   Init
   ========================================================================== */
window.addEventListener("DOMContentLoaded", async () => {
  try {
    // 1) Sesión
    readSession();
    hydrateProfileFromSession();

    // 2) UI base
    initStatesSidebar();
    initSearch();
    buildTable();
    updateLegendStatus(); // etiqueta inicial

    // 3) Datos
    await loadScopeData();

    log("init — Home listo");
  } catch (e) {
    err("init error:", e);
  }
});

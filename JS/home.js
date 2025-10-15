// /JS/home.js
"use strict";

/* ============================================================================
   CONFIG
   ========================================================================== */
const CONFIG = {
  DEBUG_LOGS: true,
  PAGE_SIZE: 10, // <- solicitado
  DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",
  PRESI_DEPTS: [/* agrega aquí los IDs de Presidencia, ej. 99 */],
};

const TAG = "[Home]";
const log  = (...a) => { if (CONFIG.DEBUG_LOGS) console.log(TAG, ...a); };
const warn = (...a) => { if (CONFIG.DEBUG_LOGS) console.warn(TAG, ...a); };
const err  = (...a) => console.error(TAG, ...a);
window.__HOME_DEBUG = CONFIG.DEBUG_LOGS;

/* ============================================================================
   Imports
   ========================================================================== */
import { Session } from "/JS/auth/session.js";
import {
  planScope,
  fetchScope,         // <- para ADMIN/Presidencia (todo)
  parseReq,
  loadEmpleados,
  listByAsignado,
} from "/JS/api/requerimientos.js";
import { createTable } from "/JS/ui/table.js";

/* ============================================================================
   Selectores
   ========================================================================== */
const SEL = {
  avatar:       "#hs-avatar",
  profileName:  "#hs-profile-name",
  profileBadge: "#hs-profile-badge",

  statusGroup:  "#hs-states",
  statusItems:  "#hs-states .item",

  searchInput:  "#hs-search",

  legendTotal:  "#hs-legend-total",
  legendStatus: "#hs-legend-status",

  tableWrap:    "#hs-table-wrap",
  tableBody:    "#hs-table-body",
  pager:        "#hs-pager",

  chartYear:    "#chart-year",
  chartMonth:   "#chart-month",
};

const SIDEBAR_KEYS = ["todos","pendientes","en_proceso","terminados","cancelados","pausados"];

/* ============================================================================
   Helpers DOM
   ========================================================================== */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };

function formatDateMX(isoOrSql) {
  if (!isoOrSql) return "—";
  const s = String(isoOrSql).replace(" ", "T");
  const d = new Date(s);
  if (isNaN(d)) return isoOrSql;
  return d.toLocaleDateString("es-MX", { year:"numeric", month:"2-digit", day:"2-digit" });
}

/* ============================================================================
   Estado
   ========================================================================== */
const State = {
  session: { empleado_id:null, dept_id:null, roles:[], id_usuario:null },
  scopePlan: null,
  universe: [],
  rows: [],
  filterKey: "todos",
  search: "",
  counts: { todos:0, pendientes:0, en_proceso:0, terminados:0, cancelados:0, pausados:0 },
  table: null
};

/* ============================================================================
   Cookie ix_emp (fallback)
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
   Sesión
   ========================================================================== */
function readSession() {
  let s = null;
  try { s = Session?.get?.() || null; } catch { s = null; }

  if (!s) { s = readCookiePayload(); log("cookie ix_emp (fallback):", s || null); }
  else {    log("cookie ix_emp (via Session):", s || null); }

  if (!s) {
    warn("No hay sesión.");
    State.session = { empleado_id:null, dept_id:null, roles:[], id_usuario:null };
    return State.session;
  }

  const empleado_id = s?.empleado_id ?? s?.id_empleado ?? null;
  const dept_id     = s?.departamento_id ?? null;
  const roles       = Array.isArray(s?.roles) ? s.roles.map(r => String(r).toUpperCase()) : [];
  const id_usuario  = s?.id_usuario ?? s?.cuenta_id ?? null;

  if (!empleado_id) warn("No hay sesión válida (empleado_id).");
  else log("sesión detectada", { idEmpleado: empleado_id, depId: dept_id, roles });

  State.session = { empleado_id, dept_id, roles, id_usuario };
  return State.session;
}

/* ============================================================================
   UI: Perfil
   ========================================================================== */
function hydrateProfileFromSession() {
  const s = Session?.get?.() || readCookiePayload() || {};
  const nombre = [s?.nombre, s?.apellidos].filter(Boolean).join(" ") || "—";
  setText(SEL.profileName, nombre);

  // Forzar ID del departamento en el badge
  const depBadgeEl = $(SEL.profileBadge);
  if (depBadgeEl) depBadgeEl.textContent = State.session.dept_id != null ? String(State.session.dept_id) : "—";

  // Avatar: intenta varios; si no, DEFAULT_AVATAR
  const avatarEl = $(SEL.avatar);
  if (avatarEl) {
    const idu = State.session.id_usuario;
    const candidates = idu ? [
      `/ASSETS/usuario/usuarioImg/user_${idu}.png`,
      `/ASSETS/usuario/usuarioImg/user_${idu}.jpg`,
      `/ASSETS/usuario/usuarioImg/img_user${idu}.png`,
      `/ASSETS/usuario/usuarioImg/img_user${idu}.jpg`,
      CONFIG.DEFAULT_AVATAR
    ] : [CONFIG.DEFAULT_AVATAR];

    let idx = 0;
    const tryNext = () => {
      avatarEl.onerror = null;
      if (idx >= candidates.length) { avatarEl.src = CONFIG.DEFAULT_AVATAR; return; }
      const src = `${candidates[idx]}${candidates[idx] === CONFIG.DEFAULT_AVATAR ? "" : `?v=${Date.now()}`}`;
      avatarEl.onerror = () => { idx++; tryNext(); };
      avatarEl.src = src;
    };
    tryNext();
  }
}

/* ============================================================================
   Sidebar (estados)
   ========================================================================== */
function updateLegendStatus() {
  const map = {
    todos:"Todos los status", pendientes:"Pendientes", en_proceso:"En proceso",
    terminados:"Terminados", cancelados:"Cancelados", pausados:"Pausados",
  };
  setText(SEL.legendStatus, map[State.filterKey] || "Todos los status");
}

function initSidebar() {
  const group = $(SEL.statusGroup);
  if (!group) { warn("No se encontró contenedor de estados", SEL.statusGroup); return; }
  group.setAttribute("role","radiogroup");

  const items = $$(SEL.statusItems);
  items.forEach((btn,i) => {
    btn.setAttribute("role","radio");
    btn.setAttribute("tabindex", i===0 ? "0":"-1");
    btn.setAttribute("aria-checked", btn.classList.contains("is-active") ? "true" : "false");

    if (!SIDEBAR_KEYS.includes(btn.dataset.status)) warn("status sin data-status válido:", btn);

    btn.addEventListener("click", () => {
      items.forEach(b => { b.classList.remove("is-active"); b.setAttribute("aria-checked","false"); b.tabIndex = -1; });
      btn.classList.add("is-active"); btn.setAttribute("aria-checked","true"); btn.tabIndex = 0;

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
    if (e.key === "ArrowDown" || e.key === "ArrowRight") nextIdx = (idx+1) % items.length;
    if (e.key === "ArrowUp"   || e.key === "ArrowLeft")  nextIdx = (idx-1+items.length) % items.length;
    if (nextIdx !== idx) { items[nextIdx].focus(); e.preventDefault(); }
    if (e.key === " " || e.key === "Enter") { items[nextIdx].click(); e.preventDefault(); }
  });

  log("sidebar listo");
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
let _tbodyEl = null;

function buildTable() {
  State.table = createTable({
    bodySel:  SEL.tableBody,
    wrapSel:  SEL.tableWrap,
    pagSel:   SEL.pager,
    pageSize: CONFIG.PAGE_SIZE,
    columns: [
      { key:"tramite",  title:"Trámites",            sortable:true, accessor:r => r.asunto || r.tramite || "—" },
      { key:"asignado", title:"Asignado",            sortable:true, accessor:r => r.asignado || "—" },
      { key:"fecha",    title:"Fecha de solicitado", sortable:true,
        accessor: r => r.creado ? new Date(String(r.creado).replace(" ","T")).getTime() : 0,
        render:   (v,r) => formatDateMX(r.creado)
      },
      { key:"status",   title:"Status",              sortable:true,
        accessor: r => r.estatus?.label || "—",
        render:   (v,r) => {
          const k = catKeyFromCode(r.estatus?.code);
          return `<span class="hs-status" data-k="${k}">${r.estatus?.label || "—"}</span>`;
        }
      }
    ]
  });
  State.table.setPageSize?.(CONFIG.PAGE_SIZE);
  State.table.setSort?.("fecha", -1);

  _tbodyEl = $(SEL.tableBody);

  // Delegación: click fila -> navegar
  if (_tbodyEl) {
    _tbodyEl.addEventListener("click", (e) => {
      const tr = e.target.closest("tr");
      if (!tr || tr.classList.contains("gc-row--spacer") || tr.classList.contains("gc-empty-row")) return;
      const idx = Number(tr.getAttribute("data-row-idx"));
      const pageRaw = State.table?.getRawRows?.() || [];
      const raw = pageRaw[idx];
      const id = raw?.id ?? raw?.__raw?.id;
      if (id) window.location.href = `/VIEWS/requerimiento.php?id=${id}`;
    });
  }

  // Cada click en paginador -> repintar fillers en el siguiente frame
  const pager = $(SEL.pager);
  if (pager) {
    pager.addEventListener("click", () => setTimeout(paintFillers, 0));
  }
}

/* --- filas vacías / fillers contadas desde el DOM --- */
function paintFillers() {
  if (!_tbodyEl) return;

  // 1) limpiar fillers previos
  const prev = Array.from(_tbodyEl.querySelectorAll("tr.gc-row--spacer, tr.gc-empty-row"));
  prev.forEach(tr => tr.remove());

  // 2) contar filas reales ya pintadas por table.js
  const realRows = Array.from(_tbodyEl.querySelectorAll("tr"))
    .filter(tr => !tr.classList.contains("gc-row--spacer") && !tr.classList.contains("gc-empty-row"));
  const realCount = realRows.length;

  // 3) si no hay filas reales -> mensaje dentro de la tabla
  if (realCount === 0) {
    _tbodyEl.innerHTML = `<tr class="gc-empty-row"><td colspan="4">
      <div class="tbl-empty">
        <div>
          <strong>No hay requerimientos asignados de momento</strong>
          <div>Cuando te asignen un requerimiento a ti o a tu equipo, aparecerá aquí.</div>
        </div>
      </div>
    </td></tr>`;
    log("paintFillers() -> tabla vacía (0 fillers)");
    return;
  }

  // 4) calcular fillers hasta PAGE_SIZE
  const toAdd = Math.max(0, CONFIG.PAGE_SIZE - realCount);
  for (let i = 0; i < toAdd; i++) {
    const tr = document.createElement("tr");
    tr.className = "gc-row--spacer";
    tr.innerHTML = `<td>&nbsp;</td><td></td><td></td><td></td>`;
    _tbodyEl.appendChild(tr);
  }
  log("paintFillers()", { realCount, pageSize: CONFIG.PAGE_SIZE, added: toAdd });
}

/* ============================================================================
   Conteos & filtros
   ========================================================================== */
function catKeyFromCode(code) {
  if (code === 3) return "en_proceso";
  if (code === 4) return "pausados";
  if (code === 5) return "cancelados";
  if (code === 6) return "terminados";
  return "pendientes"; // 0,1,2
}
function computeCounts(rows) {
  const c = { todos:0, pendientes:0, en_proceso:0, terminados:0, cancelados:0, pausados:0 };
  rows.forEach(r => { c.todos++; const k = catKeyFromCode(r.estatus?.code); if (k in c) c[k]++; });
  State.counts = c;
  setText("#cnt-todos",       `(${c.todos})`);
  setText("#cnt-pendientes",  `(${c.pendientes})`);
  setText("#cnt-en_proceso",  `(${c.en_proceso})`);
  setText("#cnt-terminados",  `(${c.terminados})`);
  setText("#cnt-cancelados",  `(${c.cancelados})`);
  setText("#cnt-pausados",    `(${c.pausados})`);
  log("conteos", c);
}

/* ============================================================================
   Pipeline + render
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
      const folio  = (r.folio || "").toLowerCase();
      return asunto.includes(q) || asign.includes(q) || est.includes(q) || folio.includes(q);
    });
  }

  computeCounts(all);
  setText(SEL.legendTotal, String(filtered.length));
  updateLegendStatus();

  const tableRows = filtered.map(r => ({
    __raw: r,
    asunto:   r.asunto,
    tramite:  r.tramite,
    asignado: r.asignado,
    creado:   r.creado,
    estatus:  r.estatus
  }));

  State.table?.setData(tableRows);

  // tras render del table -> pintar fillers
  setTimeout(paintFillers, 0);

  log("pipeline", {
    filtroStatus: State.filterKey,
    search: State.search,
    totalUniverso: all.length,
    totalFiltrado: tableRows.length,
    counts: State.counts
  });
}

/* ============================================================================
   Jerarquía (logs útiles)
   ========================================================================== */
async function logHierarchy(plan) {
  try {
    if (!plan) return;
    const empleados = await loadEmpleados({ status_empleado: 1 });
    const byId = new Map(empleados.map(e => [e.id, e]));
    const full = e => e ? [e.nombre, e.apellidos].filter(Boolean).join(" ") : "—";

    const principal = byId.get(plan.viewerId);
    const subs = (plan.teamIds || []).map(id => {
      const emp = byId.get(id);
      return { id, nombre: full(emp), depto: emp?.departamento_id ?? null, username: emp?.cuenta?.username || null };
    });

    log("USUARIO PRINCIPAL:", {
      id: plan.viewerId, nombre: full(principal),
      depto: principal?.departamento_id ?? null,
      role: plan.role, isAdmin: !!plan.isAdmin
    });
    log("SUBORDINADOS (deep):", { total: subs.length, items: subs });
  } catch (e) { warn("No se pudo loggear jerarquía:", e); }
}

/* ============================================================================
   Carga de datos (ADMIN/Presidencia = todo; otros = yo + sub)
   ========================================================================== */
async function fetchMineAndTeam(plan, filtros = {}) {
  const ids = [plan.mineId, ...(plan.teamIds || [])].filter(Boolean);
  const promises = ids.map(id => listByAsignado(id, filtros));
  const results = await Promise.allSettled(promises);
  const lists = results.filter(r => r.status === "fulfilled").map(r => r.value || []);
  // dedup + order
  const map = new Map();
  lists.flat().forEach(r => { if (r?.id != null) map.set(r.id, r); });
  return Array.from(map.values()).sort((a,b) =>
    String(b.created_at||"").localeCompare(String(a.created_at||"")) || ((b.id||0)-(a.id||0))
  );
}

async function loadScopeData() {
  const viewerId = State.session.empleado_id;
  const viewerDeptId = State.session.dept_id;

  if (!viewerId) {
    warn("viewerId ausente. Se omite carga.");
    State.universe = [];
    State.rows = [];
    computeCounts(State.rows);
    setText(SEL.legendTotal, "0");
    updateLegendStatus();
    applyPipelineAndRender();
    return;
  }

  log("construyendo planScope", { viewerId, viewerDeptId });
  // fuerza ADMIN/Presidencia
  const forceAdmin = State.session.roles.includes("ADMIN") ||
                     CONFIG.PRESI_DEPTS.includes(Number(viewerDeptId));
  const plan = await planScope({ viewerId, viewerDeptId });
  if (forceAdmin) { plan.isAdmin = true; plan.role = "ADMIN"; }
  State.scopePlan = plan;
  log("planScope listo", plan);

  // logs de jerarquía
  logHierarchy(plan);

  let items = [];
  if (plan.isAdmin) {
    log("fetchScope [ADMIN/Presidencia] — trayendo todos…");
    const out = await fetchScope({ plan, filtros: {} });
    items = out.items || [];
  } else {
    log("fetching only mine + team…");
    items = await fetchMineAndTeam(plan, {});
  }

  // Mapear a UI
  State.universe = items.slice();
  State.rows = State.universe.map(parseReq);

  // Log de la lista final mapeada
  log("FINAL items (UI):",
    State.rows.map(r => ({ id:r.id, folio:r.folio, asignado:r.asignado, estatus:r.estatus?.label, creado:r.creado }))
  );

  computeCounts(State.rows);
  setText(SEL.legendTotal, String(State.rows.length));
  updateLegendStatus();
  applyPipelineAndRender();

  log("datos listos", {
    total: State.rows.length,
    primeros3: State.rows.slice(0,3).map(r => ({ id:r.id, folio:r.folio, estatus:r.estatus?.code }))
  });
}

/* ============================================================================
   Init
   ========================================================================== */
window.addEventListener("DOMContentLoaded", async () => {
  try {
    readSession();
    hydrateProfileFromSession();

    initSidebar();
    initSearch();
    buildTable();
    updateLegendStatus();

    await loadScopeData();

    log("init — Home listo");
  } catch (e) {
    err("init error:", e);
  }
});

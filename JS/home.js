// /JS/home.js
"use strict";

/* ============================================================================
   CONFIG (edítame)
   ========================================================================== */
const CONFIG = {
  DEBUG_LOGS: true,
  PAGE_SIZE: 7,

  // Avatar por defecto (editable)
  DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",

  // Ruta a la vista de detalle
  ROUTES: {
    viewReq: (id) => `/VIEWS/requerimiento.php?id=${encodeURIComponent(id)}`
  },

  // Selectores del DOM
  SEL: {
    // Perfil
    avatar:       "#hs-avatar",
    profileName:  "#hs-profile-name",
    profileBadge: "#hs-profile-badge",

    // Sidebar de estados
    statusGroup:  "#hs-states",
    statusItems:  "#hs-states .item",

    // Búsqueda
    searchInput:  "#hs-search",

    // Leyendas
    legendTotal:  "#hs-legend-total",
    legendStatus: "#hs-legend-status",

    // Tabla
    tableBody:    "#hs-table-body",

    // Paginación (usa los controles ya existentes en tu HTML)
    pagerWrap:    "#hs-pager",
    pagerFirst:   '#hs-pager [data-pg="first"]',
    pagerPrev:    '#hs-pager [data-pg="prev"]',
    pagerNext:    '#hs-pager [data-pg="next"]',
    pagerLast:    '#hs-pager [data-pg="last"]',
    pagerNums:    '#hs-pager [data-pg="num"]',      // botones numéricos (si los tienes)
    pagerInput:   '#hs-pager [data-pg="input"]',    // <input> Ir a:
    pagerGo:      '#hs-pager [data-pg="go"]',       // botón "Ir"
  }
};

/* ============================================================================
   Imports
   ========================================================================== */
import { Session } from "/JS/auth/session.js";
import {
  planScope,
  parseReq,
  loadEmpleados,
  listByAsignado,
} from "/JS/api/requerimientos.js";
import { createTable } from "/JS/ui/table.js";

/* ============================================================================
   Logging helpers
   ========================================================================== */
const TAG = "[Home]";
const LOG_ON = CONFIG.DEBUG_LOGS;
const log  = (...a) => { if (LOG_ON) console.log(TAG, ...a); };
const warn = (...a) => { if (LOG_ON) console.warn(TAG, ...a); };
const err  = (...a) => console.error(TAG, ...a);

/* ============================================================================
   Utils DOM
   ========================================================================== */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };

function formatDateMX(isoOrSql) {
  if (!isoOrSql) return "—";
  const d = new Date(String(isoOrSql).replace(" ", "T"));
  return isNaN(d) ? String(isoOrSql) : d.toLocaleDateString("es-MX", {year:"numeric",month:"2-digit",day:"2-digit"});
}

/* ============================================================================
   Estado
   ========================================================================== */
const State = {
  session: { empleado_id: null, dept_id: null, roles: [], id_usuario: null },
  scopePlan: null,

  universe: [],
  rows: [],               // mapeados con parseReq()

  filterKey: "todos",
  search: "",
  counts: { todos: 0, pendientes: 0, en_proceso: 0, terminados: 0, cancelados: 0, pausados: 0 },

  table: null,
  curPage: 1,            // página externa (own pager)
  totalPages: 1,

  // cache de catálogos
  depsById: null,
  depsCacheAt: 0,
};

/* ============================================================================
   Cookie fallback ix_emp (base64 JSON)
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
  else { log("cookie ix_emp (via Session):", s || null); }

  if (!s) {
    warn("Sin sesión.");
    State.session = { empleado_id: null, dept_id: null, roles: [], id_usuario: null };
    return State.session;
  }

  const empleado_id = s?.empleado_id ?? s?.id_empleado ?? null;
  const dept_id     = s?.departamento_id ?? null;
  const roles       = Array.isArray(s?.roles) ? s.roles.map(r => String(r).toUpperCase()) : [];
  const id_usuario  = s?.id_usuario ?? s?.cuenta_id ?? null;

  if (!empleado_id) warn("No hay empleado_id en sesión.");
  else log("sesión detectada", { idEmpleado: empleado_id, depId: dept_id, roles });

  State.session = { empleado_id, dept_id, roles, id_usuario };
  return State.session;
}

/* ============================================================================
   Catálogos
   ========================================================================== */
async function loadDepartamentosOnce() {
  // TTL 60s
  if (State.depsById && (Date.now() - State.depsCacheAt) < 60_000) return State.depsById;
  try {
    // reutilizamos loadEmpleados? no; usamos el endpoint del módulo de requerimientos.js no expuesto.
    // Como no tenemos helper aquí, llamamos al endpoint directo.
    const API_BASE = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/";
    const url = API_BASE + "ixtla01_c_departamento.php?status=1";
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const json = await res.json().catch(()=>null);
    const arr = json?.data || json?.rows || [];
    const map = new Map(arr.map(d => [Number(d.id), String(d.nombre || `Departamento ${d.id}`)]));
    State.depsById = map;
    State.depsCacheAt = Date.now();
    log("Departamentos cargados:", { total: map.size });
    return map;
  } catch (e) {
    warn("No se pudo cargar catálogo de departamentos:", e);
    State.depsById = new Map();
    return State.depsById;
  }
}

/* ============================================================================
   UI Perfil
   ========================================================================== */
async function hydrateProfileFromSession() {
  const s = Session?.get?.() || readCookiePayload() || {};
  const nombre = [s?.nombre, s?.apellidos].filter(Boolean).join(" ") || "—";
  setText(CONFIG.SEL.profileName, nombre);

  // Badge: nombre del departamento, no el id
  const depId = State.session.dept_id != null ? Number(State.session.dept_id) : null;
  const badge = $(CONFIG.SEL.profileBadge);
  if (badge) {
    let label = "—";
    if (depId != null) {
      const deps = await loadDepartamentosOnce();
      label = deps.get(depId) || `Departamento ${depId}`;
      badge.dataset.depId = String(depId);
    }
    badge.textContent = label;
    log("dep badge ->", { id: depId, nombre: label });
  }

  // Avatar con fallback
  const avatarEl = $(CONFIG.SEL.avatar);
  if (avatarEl) {
    const idu = State.session.id_usuario;
    const candidates = (idu != null) ? [
      `/ASSETS/usuario/usuarioImg/user_${idu}.png`,
      `/ASSETS/usuario/usuarioImg/user_${idu}.jpg`,
      `/ASSETS/usuario/usuarioImg/img_user${idu}.png`,
      `/ASSETS/usuario/usuarioImg/img_user${idu}.jpg`,
    ] : [];
    let triedFallback = false, idx = 0;
    const tryNext = () => {
      if (idx < candidates.length) {
        avatarEl.onerror = () => { idx++; tryNext(); };
        avatarEl.src = `${candidates[idx]}?v=${Date.now()}`;
      } else if (!triedFallback) {
        triedFallback = true;
        avatarEl.onerror = null;
        avatarEl.src = CONFIG.DEFAULT_AVATAR;
      }
    };
    if (candidates.length) tryNext();
    else avatarEl.src = CONFIG.DEFAULT_AVATAR;
  }
}

/* ============================================================================
   Sidebar estados (ARIA + eventos)
   ========================================================================== */
const SIDEBAR_KEYS = ["todos","pendientes","en_proceso","terminados","cancelados","pausados"];

function initSidebar(onChange) {
  const group = $(CONFIG.SEL.statusGroup);
  if (!group) { warn("No se encontró el contenedor de estados", CONFIG.SEL.statusGroup); return; }
  group.setAttribute("role","radiogroup");

  const items = $$(CONFIG.SEL.statusItems);
  items.forEach((btn,i) => {
    btn.setAttribute("role","radio");
    btn.setAttribute("tabindex", i===0 ? "0" : "-1");
    btn.setAttribute("aria-checked", btn.classList.contains("is-active") ? "true":"false");

    if (!SIDEBAR_KEYS.includes(btn.dataset.status)) warn("Botón estado sin data-status válido:", btn);

    btn.addEventListener("click", () => {
      items.forEach(b => { b.classList.remove("is-active"); b.setAttribute("aria-checked","false"); b.tabIndex = -1; });
      btn.classList.add("is-active"); btn.setAttribute("aria-checked","true"); btn.tabIndex = 0;
      State.filterKey = btn.dataset.status || "todos";
      onChange?.();
      $(CONFIG.SEL.searchInput)?.focus();
    });
  });

  group.addEventListener("keydown", (e) => {
    const items = $$(CONFIG.SEL.statusItems);
    const cur = document.activeElement.closest(".item");
    const idx = Math.max(0, items.indexOf(cur));
    let nextIdx = idx;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") nextIdx = (idx+1)%items.length;
    if (e.key === "ArrowUp"   || e.key === "ArrowLeft")  nextIdx = (idx-1+items.length)%items.length;
    if (nextIdx !== idx) { items[nextIdx].focus(); e.preventDefault(); }
    if (e.key === " " || e.key === "Enter") { items[nextIdx].click(); e.preventDefault(); }
  });

  log("sidebar listo");
}

/* ============================================================================
   Búsqueda
   ========================================================================== */
function initSearch(onChange) {
  const input = $(CONFIG.SEL.searchInput);
  if (!input) return;
  let t;
  input.addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      State.search = (e.target.value || "").trim().toLowerCase();
      onChange?.();
    }, 250);
  });
}

/* ============================================================================
   Tabla
   ========================================================================== */
let _tbodyEl = null;

function buildTable() {
  _tbodyEl = $(CONFIG.SEL.tableBody);

  State.table = createTable({
    bodySel:  CONFIG.SEL.tableBody,
    wrapSel:  null,          // no ocultar/mostrar desde table.js
    emptySel: null,          // sin placeholder externo
    pagSel:   null,          // sin paginación interna
    pageSize: CONFIG.PAGE_SIZE,
    columns: [
      { key: "tramite",  title: "Trámites",            sortable: true, accessor: r => r.asunto || r.tramite || "—" },
      { key: "asignado", title: "Asignado",            sortable: true, accessor: r => r.asignado || "—",
        render: (v, r) => `${r.asignado || "—"}${r.cargo ? ` <div class="sub">${r.cargo}</div>` : ""}` },
      { key: "fecha",    title: "Fecha de solicitado", sortable: true,
        accessor: r => r.creado ? new Date(String(r.creado).replace(" ","T")).getTime() : 0,
        render: (_v, r) => formatDateMX(r.creado) },
      { key: "status",   title: "Status",              sortable: true,
        accessor: r => r.estatus?.label || "—",
        render: (_v, r) => {
          const cat = catKeyFromCode(r.estatus?.code);
          return `<span class="hs-status" data-k="${cat}">${r.estatus?.label || "—"}</span>`;
        } }
    ]
  });

  // Click fila → detalle (sólo filas reales)
  if (_tbodyEl) {
    _tbodyEl.addEventListener("click", (e) => {
      const tr = e.target.closest("tr");
      if (!tr || !_tbodyEl.contains(tr)) return;
      if (tr.classList.contains("gc-row--spacer") || tr.classList.contains("gc-empty-row")) return;
      const idx = Number(tr.dataset.rowIdx);
      const pageRaw = State.table.getRawRows?.() || [];
      const raw = pageRaw[idx];
      if (raw && raw.id != null) {
        location.href = CONFIG.ROUTES.viewReq(raw.id);
      }
    });
  }
}

/* ============================================================================
   Leyendas
   ========================================================================== */
function updateLegendTotals(n) { setText(CONFIG.SEL.legendTotal, String(n ?? 0)); }
function updateLegendStatus() {
  const map = {
    todos: "Todos los status",
    pendientes: "Pendientes",
    en_proceso: "En proceso",
    terminados: "Terminados",
    cancelados: "Cancelados",
    pausados: "Pausados",
  };
  setText(CONFIG.SEL.legendStatus, map[State.filterKey] || "Todos los status");
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
   Paginación externa (usa tus controles del HTML)
   ========================================================================== */
function wirePagerControls() {
  const wrap = $(CONFIG.SEL.pagerWrap);
  if (!wrap) { warn("No se encontró #hs-pager; se omite wiring de paginación externa."); return; }

  const btnFirst = $(CONFIG.SEL.pagerFirst);
  const btnPrev  = $(CONFIG.SEL.pagerPrev);
  const btnNext  = $(CONFIG.SEL.pagerNext);
  const btnLast  = $(CONFIG.SEL.pagerLast);
  const btnNums  = $$(CONFIG.SEL.pagerNums);
  const input    = $(CONFIG.SEL.pagerInput);
  const btnGo    = $(CONFIG.SEL.pagerGo);

  btnFirst?.addEventListener("click", () => setPageExternal(1));
  btnPrev?.addEventListener("click",  () => setPageExternal(Math.max(1, State.curPage - 1)));
  btnNext?.addEventListener("click",  () => setPageExternal(Math.min(State.totalPages, State.curPage + 1)));
  btnLast?.addEventListener("click",  () => setPageExternal(State.totalPages));
  btnNums?.forEach(b => b.addEventListener("click", () => {
    const p = parseInt(b.textContent.trim(), 10);
    if (!isNaN(p)) setPageExternal(p);
  }));
  if (btnGo && input) {
    btnGo.addEventListener("click", () => {
      const p = parseInt(input.value, 10);
      if (isNaN(p)) return;
      setPageExternal(Math.min(Math.max(1, p), State.totalPages));
    });
  }
  log("pager externo listo");
}

function setPageExternal(p) {
  State.curPage = Math.min(Math.max(1, p|0), State.totalPages || 1);
  State.table?.setPage(State.curPage);
  paintPagerState();
  paintFillers(); // re-pinta fillers de la página actual
  log("pager ->", { page: State.curPage, totalPages: State.totalPages });
}

function paintPagerState() {
  const wrap = $(CONFIG.SEL.pagerWrap);
  if (!wrap) return;

  // Actualiza aria-current en botones numéricos si existen
  $$(CONFIG.SEL.pagerNums).forEach(b => {
    const n = parseInt(b.textContent.trim(), 10);
    b.toggleAttribute("aria-current", n === State.curPage);
  });

  // Deshabilita prev/first y next/last según corresponda
  const atFirst = State.curPage <= 1;
  const atLast  = State.curPage >= (State.totalPages || 1);
  $(CONFIG.SEL.pagerFirst)?.toggleAttribute("disabled", atFirst);
  $(CONFIG.SEL.pagerPrev )?.toggleAttribute("disabled", atFirst);
  $(CONFIG.SEL.pagerNext )?.toggleAttribute("disabled", atLast);
  $(CONFIG.SEL.pagerLast )?.toggleAttribute("disabled", atLast);

  // Actualiza input "Ir a:"
  const input = $(CONFIG.SEL.pagerInput);
  if (input) input.value = String(State.curPage);
}

/* ============================================================================
   Pipeline + render tabla (con fillers y empty-row)
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
  updateLegendTotals(filtered.length);
  updateLegendStatus();

  // Datos para la tabla (la tabla pagina internamente).
  const tableRows = filtered.map(r => ({
    __raw: r,
    id:       r.id,
    asunto:   r.asunto,
    tramite:  r.tramite,
    asignado: r.asignado,
    cargo:    r.cargo || "",     // opcional
    creado:   r.creado,
    estatus:  r.estatus
  }));

  // calcular páginas para el pager externo
  State.totalPages = Math.max(1, Math.ceil(tableRows.length / CONFIG.PAGE_SIZE));
  if (State.curPage > State.totalPages) State.curPage = State.totalPages;

  State.table?.setPageSize(CONFIG.PAGE_SIZE);
  State.table?.setData(tableRows);
  State.table?.setPage(State.curPage);

  paintPagerState();
  paintFillers();

  const s = State.table?.getSort?.() || {};
  log("pipeline", {
    filtroStatus: State.filterKey,
    search: State.search,
    totalUniverso: all.length,
    totalFiltrado: tableRows.length,
    page: State.curPage,
    totalPages: State.totalPages,
    counts: State.counts,
    sort: s
  });
}

// Inserta fillers y fila vacía si aplica
function paintFillers() {
  if (!_tbodyEl) return;

  // Si no hay filas reales en la página actual → mostrar una fila vacía descriptiva
  const pageRows = State.table.getRawRows?.() || [];
  if (!pageRows.length) {
    _tbodyEl.innerHTML = `<tr class="gc-empty-row"><td colspan="4">
      <div class="tbl-empty">
        <span class="ico" aria-hidden="true">🗂️</span>
        <div>
          <strong>No hay requerimientos asignados de momento</strong>
          <div>Cuando te asignen un requerimiento a ti o a tu equipo, aparecerá aquí.</div>
        </div>
      </div>
    </td></tr>`;
    log("filler rows insertados: 0 (tabla vacía con mensaje)");
    return;
  }

  // Hay filas: agregamos fillers hasta PAGE_SIZE
  // (mantenemos las filas reales que ya pintó table.js)
  const currentTrs = Array.from(_tbodyEl.querySelectorAll("tr"));
  const realCount  = pageRows.length;
  // limpia fillers anteriores
  currentTrs.filter(tr => tr.classList.contains("gc-row--spacer") || tr.classList.contains("gc-empty-row"))
            .forEach(tr => tr.remove());

  const toAdd = Math.max(0, CONFIG.PAGE_SIZE - realCount);
  for (let i = 0; i < toAdd; i++) {
    const tr = document.createElement("tr");
    tr.className = "gc-row--spacer";
    tr.innerHTML = `<td>&nbsp;</td><td></td><td></td><td></td>`;
    _tbodyEl.appendChild(tr);
  }
  log("filler rows insertados:", toAdd);
}

/* ============================================================================
   Jerarquía (logs)
   ========================================================================== */
async function logHierarchy(plan) {
  try {
    if (!plan) return;
    const empleados = await loadEmpleados({ status_empleado: 1 });
    const byId = new Map(empleados.map(e => [e.id, e]));
    const fullName = (e) => e ? [e.nombre, e.apellidos].filter(Boolean).join(" ") : "—";

    const principal = byId.get(plan.viewerId);
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
   Fetch: sólo yo + subordinados
   ========================================================================== */
async function fetchMineAndTeam(plan, filtros = {}) {
  const ids = [plan.mineId, ...(plan.teamIds || [])].filter(Boolean);
  const results = await Promise.allSettled(ids.map(id => listByAsignado(id, filtros)));
  const lists = results.filter(r => r.status === "fulfilled").map(r => r.value || []);

  // Dedup por id y orden por created_at DESC
  const map = new Map();
  lists.flat().forEach(r => { if (r?.id != null) map.set(r.id, r); });
  const items = Array.from(map.values())
    .sort((a, b) =>
      String(b.created_at || "").localeCompare(String(a.created_at || "")) ||
      ((b.id || 0) - (a.id || 0))
    );

  log("FINAL mine+team items (raw):",
    items.map(r => ({ id: r.id, folio: r.folio, asignado_a: r.asignado_a, estatus: r.estatus }))
  );

  return items;
}

/* ============================================================================
   Carga de datos
   ========================================================================== */
async function loadScopeData() {
  const viewerId = State.session.empleado_id;
  const viewerDeptId = State.session.dept_id;

  if (!viewerId) {
    warn("viewerId ausente. Se omite carga.");
    State.universe = [];
    State.rows = [];
    updateLegendTotals(0);
    updateLegendStatus();
    applyPipelineAndRender();
    return;
  }

  log("construyendo planScope", { viewerId, viewerDeptId });
  const plan = await planScope({ viewerId, viewerDeptId });
  State.scopePlan = plan;
  log("planScope listo", plan);

  logHierarchy(plan);

  // Sólo yo + subordinados
  const items = await fetchMineAndTeam(plan, {});
  State.universe = items.slice();
  State.rows = State.universe.map(parseReq);

  log("FINAL mine+team items (UI):",
    State.rows.map(r => ({ id: r.id, folio: r.folio, asignado: r.asignado, estatus: r.estatus?.label, creado: r.creado }))
  );

  State.curPage = 1;
  applyPipelineAndRender();
}

/* ============================================================================
   Init
   ========================================================================== */
window.addEventListener("DOMContentLoaded", async () => {
  try {
    readSession();
    await hydrateProfileFromSession();

    initSidebar(() => { State.curPage = 1; applyPipelineAndRender(); });
    initSearch(() => { State.curPage = 1; applyPipelineAndRender(); });
    buildTable();
    wirePagerControls();
    updateLegendStatus();

    await loadScopeData();

    log("init — Home listo");
  } catch (e) {
    err("init error:", e);
  }
});

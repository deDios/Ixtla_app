// /JS/home.js
"use strict";

/* =============================================================================
   CONFIG 
   ========================================================================== */
const CONFIG = {
  ENABLE_LOGS: true,
  PAGE_SIZE: 7, 
  DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",
};

const TAG = "[Home]";
const log  = (...a) => { if (CONFIG.ENABLE_LOGS) console.log(TAG, ...a); };
const warn = (...a) => { if (CONFIG.ENABLE_LOGS) console.warn(TAG, ...a); };
const err  = (...a) => console.error(TAG, ...a);

/* =============================================================================
   Imports
   ========================================================================== */
import { Session } from "/JS/auth/session.js";
import {
  planScope,
  parseReq,
  loadEmpleados,
  listByAsignado,
} from "/JS/api/requerimientos.js";
import { createTable }   from "/JS/ui/table.js";
import { createSidebar } from "/JS/ui/sidebar.js";

/* =============================================================================
   Selectores
   ========================================================================== */
const SEL = {
  // Perfil
  avatar:       "#hs-avatar",
  profileName:  "#hs-profile-name",
  profileBadge: "#hs-profile-badge",

  // Sidebar
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
};

const SIDEBAR_KEYS = ["todos","pendientes","en_proceso","terminados","cancelados","pausados"];

/* =============================================================================
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

/* =============================================================================
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
  table: null,
  sidebar: null,
};

/* =============================================================================
   Fallback cookie ix_emp (base64 JSON)
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

/* =============================================================================
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

  if (!empleado_id) warn("No hay sesión válida (empleado_id).");
  else log("sesión detectada", { idEmpleado: empleado_id, depId: dept_id, roles });

  State.session = { empleado_id, dept_id, roles, id_usuario };
  return State.session;
}

/* =============================================================================
   UI: perfil (nombre, badge, avatar con fallback)
   ========================================================================== */
function hydrateProfileFromSession() {
  const s = Session?.get?.() || readCookiePayload() || {};
  const nombre = [s?.nombre, s?.apellidos].filter(Boolean).join(" ") || "—";
  setText(SEL.profileName, nombre);

  // badge: si el HTML ya trae el nombre del depto, lo dejamos; si no, ponemos el id
  const depBadgeEl = $(SEL.profileBadge);
  if (depBadgeEl) {
    const text = depBadgeEl.textContent?.trim();
    if (!text || text === "—") {
      depBadgeEl.textContent = State.session.dept_id != null ? String(State.session.dept_id) : "—";
    }
  }

  // Avatar con fallback
  const avatarEl = $(SEL.avatar);
  if (avatarEl) {
    const idu = State.session.id_usuario;
    const candidates = idu ? [
      `/ASSETS/usuario/usuarioImg/user_${idu}.png`,
      `/ASSETS/usuario/usuarioImg/user_${idu}.jpg`,
      `/ASSETS/usuario/usuarioImg/img_user${idu}.png`,
      `/ASSETS/usuario/usuarioImg/img_user${idu}.jpg`,
    ] : [];
    let idx = 0;
    const tryNext = () => {
      if (idx >= candidates.length) {
        avatarEl.onerror = null;
        avatarEl.src = CONFIG.DEFAULT_AVATAR;
        return;
      }
      avatarEl.onerror = () => { idx++; tryNext(); };
      avatarEl.src = `${candidates[idx]}?v=${Date.now()}`;
    };
    if (candidates.length) tryNext();
    else avatarEl.src = CONFIG.DEFAULT_AVATAR;
  }
}

/* =============================================================================
   Sidebar (componente)
   ========================================================================== */
function initSidebar() {
  State.sidebar = createSidebar({
    groupSel: SEL.statusGroup,
    itemSel:  SEL.statusItems,
    initial:  "todos",
    onChange: (key) => {
      State.filterKey = key;
      updateLegendStatus();
      applyPipelineAndRender();
      $(SEL.searchInput)?.focus();
    }
  });
}

/* =============================================================================
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

/* =============================================================================
   Tabla
   ========================================================================== */
function buildTable() {
  State.table = createTable({
    bodySel:  SEL.tableBody,
    wrapSel:  SEL.tableWrap,
    pagSel:   SEL.pager,
    pageSize: CONFIG.PAGE_SIZE,
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

  // Navegar al requerimiento al hacer click en fila (ignora vacías y mensaje)
  const tbody = $(SEL.tableBody);
  if (tbody) {
    tbody.addEventListener("click", (e) => {
      const tr = e.target.closest("tr");
      if (!tr || tr.dataset.blank === "1" || tr.dataset.empty === "1") return;
      const idx = Number(tr.dataset.rowIdx);
      const pageRows = State.table.getRawRows?.() || [];
      const uiRow = pageRows[idx];
      const req = uiRow?.__raw || uiRow; // nuestro setData mete __raw
      const id = req?.id;
      if (id != null) {
        location.href = `/VIEWS/requerimiento.php?id=${id}`;
      }
    });
  }
}

/* =============================================================================
   Leyendas
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

/* =============================================================================
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
  State.sidebar?.setCounts(c);
  log("conteos", c);
}

/* =============================================================================
   Relleno de tabla: mensaje vacío y filas en blanco
   ========================================================================== */
function padTableRowsAfterRender(visibleCount, totalFiltered) {
  const tbody = $(SEL.tableBody);
  if (!tbody) return;

  // Si no hay datos: 1 fila de mensaje + blanks hasta PAGE_SIZE
  if (totalFiltered === 0) {
    const msg = document.createElement("tr");
    msg.dataset.empty = "1";
    msg.innerHTML = `<td colspan="4" class="gc-empty-cell">No hay requerimientos asignados de momento</td>`;
    tbody.appendChild(msg);

    const blanks = Math.max(0, CONFIG.PAGE_SIZE - 1);
    for (let i = 0; i < blanks; i++) {
      const tr = document.createElement("tr");
      tr.dataset.blank = "1";
      tr.className = "gc-blank-row";
      tr.innerHTML = `<td>&nbsp;</td><td></td><td></td><td></td>`;
      tbody.appendChild(tr);
    }
    log("tabla: filas vacías agregadas (estado vacío)", { blanks });
    return;
  }

  // Si hay menos filas que PAGE_SIZE: agregar blanks
  const need = Math.max(0, CONFIG.PAGE_SIZE - visibleCount);
  for (let i = 0; i < need; i++) {
    const tr = document.createElement("tr");
    tr.dataset.blank = "1";
    tr.className = "gc-blank-row";
    tr.innerHTML = `<td>&nbsp;</td><td></td><td></td><td></td>`;
    tbody.appendChild(tr);
  }
  if (need > 0) log("tabla: filas vacías agregadas (padding)", { blanks: need });
}

/* =============================================================================
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
  updateLegendTotals(filtered.length);

  const tableRows = filtered.map(r => ({
    __raw: r,
    asunto:   r.asunto,
    tramite:  r.tramite,
    asignado: r.asignado,
    creado:   r.creado,
    estatus:  r.estatus
  }));

  // Pintar tabla
  State.table?.setData(tableRows);

  // Padding/placeholder dentro del tbody
  const tbody = $(SEL.tableBody);
  if (tbody) {
    // `createTable` ya pintó pageItems; contamos cuántos
    const painted = tbody.querySelectorAll("tr").length;
    // Limpia y vuelve a calcular según los datos de la página actual
    tbody.querySelectorAll('tr[data-blank="1"], tr[data-empty="1"]').forEach(el => el.remove());
    const currentRows = State.table.getRawRows?.() || [];
    const visibleCount = currentRows.length;
    padTableRowsAfterRender(visibleCount, tableRows.length);
  }

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

/* =============================================================================
   Log de jerarquía (principal + subordinados)
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

/* =============================================================================
   Traer solo “yo + subordinados” (sin depto)
   ========================================================================== */
async function fetchMineAndTeam(plan, filtros = {}) {
  const ids = [plan.mineId, ...(plan.teamIds || [])].filter(Boolean);
  const promises = ids.map(id => listByAsignado(id, filtros));
  const results = await Promise.allSettled(promises);
  const lists = results
    .filter(r => r.status === "fulfilled")
    .map(r => r.value || []);

  // Dedup por id y orden por created_at DESC
  const map = new Map();
  lists.flat().forEach(r => { if (r?.id != null) map.set(r.id, r); });
  const items = Array.from(map.values())
    .sort((a, b) =>
      String(b.created_at || "").localeCompare(String(a.created_at || "")) ||
      ((b.id || 0) - (a.id || 0))
    );

  log("FINAL mine+team items (raw):",
    items.map(r => ({
      id: r.id, folio: r.folio,
      asignado_a: r.asignado_a,
      asignado_nombre: r.asignado_nombre_completo,
      estatus: r.estatus
    }))
  );

  return items;
}

/* =============================================================================
   Carga de datos
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

  await logHierarchy(plan);

  // Solo yo + subordinados
  log("fetching only mine + team…");
  const items = await fetchMineAndTeam(plan, {});

  // Mapear a UI
  State.universe = items.slice();
  State.rows = State.universe.map(parseReq);

  // Log de lo que pintamos
  log("FINAL mine+team items (UI-mapped):",
    State.rows.map(r => ({
      id: r.id, folio: r.folio, asignado: r.asignado,
      estatus: r.estatus?.label, creado: r.creado
    }))
  );

  computeCounts(State.rows);
  updateLegendTotals(State.rows.length);
  updateLegendStatus();
  applyPipelineAndRender();

  log("datos listos", {
    total: State.rows.length,
    primeros3: State.rows.slice(0, 3).map(r => ({ id: r.id, folio: r.folio, estatus: r.estatus?.code }))
  });
}

/* =============================================================================
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

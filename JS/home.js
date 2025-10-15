// /JS/home.js
"use strict";

/* ============================================================================
   CONFIG
   ========================================================================== */
const CONFIG = {
  DEBUG_LOGS: true,                            // ← apágalo en prod si quieres
  PAGE_SIZE: 7,                                // ← 7 filas por página (fijas)
  DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",
  REQ_VIEW_URL: "/VIEWS/requerimiento.php",    // ← destino al hacer click en fila
  // Si tienes window.API.departamentos, se usa para resolver el nombre
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
import { createSidebar } from "/JS/ui/sidebar.js";

/* ============================================================================
   Logs
   ========================================================================== */
const TAG = "[Home]";
const log  = (...a) => { if (CONFIG.DEBUG_LOGS) console.log(TAG, ...a); };
const warn = (...a) => { if (CONFIG.DEBUG_LOGS) console.warn(TAG, ...a); };
const err  = (...a) => console.error(TAG, ...a);
window.__HOME_DEBUG = CONFIG.DEBUG_LOGS;

/* ============================================================================
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

  // Panel vacío (dentro de tabla lo mostraremos como fila)
  emptyPanel:   "#hs-empty",
};

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
  table: null,
};

/* ============================================================================
   Cookie fallback (ix_emp base64 JSON)
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

/* ============================================================================
   Departamento: resolver nombre (si hay API.departamentos)
   ========================================================================== */
async function resolveDeptName(depId) {
  if (!depId) return null;
  try {
    const url = window.API?.departamentos;
    if (!url) return null;
    const body = { status: 1, page: 1, page_size: 200 };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    const list = json?.data || json?.rows || [];
    const found = list.find(d => Number(d.id) === Number(depId));
    return found?.nombre || null;
  } catch {
    return null;
  }
}

/* ============================================================================
   UI: perfil
   ========================================================================== */
async function hydrateProfileFromSession() {
  const s = Session?.get?.() || readCookiePayload() || {};
  const nombre = [s?.nombre, s?.apellidos].filter(Boolean).join(" ") || "—";
  setText(SEL.profileName, nombre);

  // Departamento → nombre si disponible, si no el id
  const badgeEl = $(SEL.profileBadge);
  if (badgeEl) {
    const current = badgeEl.textContent?.trim();
    if (!current || current === "—") {
      const depId = State.session.dept_id;
      const depName = await resolveDeptName(depId);
      badgeEl.textContent = depName || (depId != null ? String(depId) : "—");
    }
  }

  // Avatar con fallback
  const avatarEl = $(SEL.avatar);
  if (avatarEl) {
    const idu = State.session.id_usuario;
    const candidates = idu
      ? [
          `/ASSETS/usuario/usuarioImg/user_${idu}.png`,
          `/ASSETS/usuario/usuarioImg/user_${idu}.jpg`,
          `/ASSETS/usuario/usuarioImg/img_user${idu}.png`,
          `/ASSETS/usuario/usuarioImg/img_user${idu}.jpg`,
        ]
      : [];
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
    // Si no hay id de usuario, poner default directo
    if (!idu) {
      avatarEl.src = CONFIG.DEFAULT_AVATAR;
    } else {
      tryNext();
    }
  }
}

/* ============================================================================
   Sidebar (usa /JS/ui/sidebar.js)
   ========================================================================== */
function initSidebar() {
  const el = $(SEL.statusGroup);
  if (!el) {
    warn("No se encontró el contenedor de estados", SEL.statusGroup);
    return;
  }

  createSidebar({
    root: el,
    activeKey: "todos",
    onChange: (key) => {
      State.filterKey = key || "todos";
      updateLegendStatus();
      applyPipelineAndRender();   // <- aquí ya existe la tabla (se construye antes)
      $(SEL.searchInput)?.focus();
    },
    debug: CONFIG.DEBUG_LOGS,
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

  // Click fila -> navegar al detalle
  const tbody = $(SEL.tableBody);
  if (tbody) {
    tbody.addEventListener("click", (e) => {
      const tr = e.target.closest("tr");
      if (!tr) return;
      const idx = Number(tr.dataset.rowIdx);
      const raw = State.table?.getRawRows?.()?.[idx];
      const id = raw?.id || raw?.__raw?.id;
      if (!id) return;
      location.href = `${CONFIG.REQ_VIEW_URL}?id=${encodeURIComponent(id)}`;
    });
  }
}

/* ============================================================================
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
   Padding / placeholder dentro de la tabla
   ========================================================================== */
function padTableRowsAfterRender(visibleCount, filteredCount) {
  const tbody = $(SEL.tableBody);
  if (!tbody) return;

  // Limpia placeholders previos
  tbody.querySelectorAll('tr[data-blank="1"], tr[data-empty="1"]').forEach(el => el.remove());

  // Caso: no hay elementos -> una fila que ocupa todas las columnas
  if (filteredCount === 0) {
    const tr = document.createElement("tr");
    tr.setAttribute("data-empty", "1");
    tr.className = "is-empty";
    tr.innerHTML = `
      <td colspan="4">
        <div class="hs-empty-inline">
          <div class="hs-empty-icon" aria-hidden="true">🗂️</div>
          <div>
            <div class="hs-empty-title">No hay requerimientos asignados de momento</div>
            <div class="hs-empty-desc">Cuando te asignen un requerimiento a ti o a tu equipo, aparecerá aquí.</div>
          </div>
        </div>
      </td>`;
    tbody.appendChild(tr);
    log("padding: tabla vacía → se colocó 1 fila placeholder (data-empty=1)");
    return;
  }

  // Caso: hay menos filas que PAGE_SIZE -> rellenar con blanks no interactivos
  const blanks = Math.max(0, CONFIG.PAGE_SIZE - visibleCount);
  for (let i = 0; i < blanks; i++) {
    const tr = document.createElement("tr");
    tr.setAttribute("data-blank", "1");
    tr.className = "is-blank";
    tr.innerHTML = `<td>&nbsp;</td><td></td><td></td><td></td>`;
    tbody.appendChild(tr);
  }
  if (blanks > 0) log(`padding: se agregaron ${blanks} filas en blanco para completar ${CONFIG.PAGE_SIZE}`);
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
  updateLegendTotals(filtered.length);

  const tableRows = filtered.map(r => ({
    __raw: r,
    asunto:   r.asunto,
    tramite:  r.tramite,
    asignado: r.asignado,
    creado:   r.creado,
    estatus:  r.estatus,
    id:       r.id,
  }));

  // ⛑️ Guardia si la tabla aún no existe (no intentes pintar ni paddear)
  if (!State.table) {
    log("applyPipelineAndRender() — tabla aún no inicializada; diferido.", {
      totalUniverso: all.length, totalFiltrado: tableRows.length
    });
    return;
  }

  State.table.setData(tableRows);

  // Padding / placeholder
  const pageRaw = State.table.getRawRows?.() || [];
  padTableRowsAfterRender(pageRaw.length, tableRows.length);

  const s = State.table.getSort?.() || {};
  log("table render", s);
  log("pipeline", {
    filtroStatus: State.filterKey,
    search: State.search,
    totalUniverso: all.length,
    totalFiltrado: tableRows.length,
    counts: State.counts
  });
}

/* ============================================================================
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

/* ============================================================================
   Sólo “yo + subordinados” (sin depto)
   ========================================================================== */
async function fetchMineAndTeam(plan, filtros = {}) {
  const ids = [plan.mineId, ...(plan.teamIds || [])].filter(Boolean);
  const results = await Promise.allSettled(ids.map(id => listByAsignado(id, filtros)));
  const lists = results.filter(r => r.status === "fulfilled").map(r => r.value || []);

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

/* ============================================================================
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

  // Jerarquía con nombres
  logHierarchy(plan);

  // Sólo yo + team
  log("fetching only mine + team…");
  const items = await fetchMineAndTeam(plan, {});

  State.universe = items.slice();
  State.rows = State.universe.map(parseReq);

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

/* ============================================================================
   Init
   ========================================================================== */
window.addEventListener("DOMContentLoaded", async () => {
  try {
    // 1) Sesión + Perfil
    readSession();
    await hydrateProfileFromSession();

    // 2) Construye TABLA primero (evita getRawRows null)
    buildTable();

    // 3) Sidebar + search
    initSidebar();
    initSearch();
    updateLegendStatus();

    // 4) Datos
    await loadScopeData();

    log("init — Home listo");
  } catch (e) {
    err("init error:", e);
  }
});

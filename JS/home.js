// /JS/home.js
"use strict";

/* ============================================================================
   CONFIG
   ========================================================================== */
const CONFIG = {
  DEBUG_LOGS: true,                    // ← apaga/enciende logs del Home
  PAGE_SIZE: 7,                        // ← tamaño de página en la tabla
  DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",
  DEPT_API_URL: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/ixtla01_c_departamento.php",
  // Navegación al hacer click en una fila
  REQ_VIEW_URL: "/VIEWS/requerimiento.php", // se le añade ?id=123
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
   Logs helpers
   ========================================================================== */
const TAG  = "[Home]";
const LOG  = (...a) => { if (CONFIG.DEBUG_LOGS) console.log(TAG, ...a); };
const WARN = (...a) => { if (CONFIG.DEBUG_LOGS) console.warn(TAG, ...a); };
const ERR  = (...a) => console.error(TAG, ...a);
window.__HOME_DEBUG = CONFIG.DEBUG_LOGS;

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
   Fallback cookie ix_emp (base64 JSON)
   ========================================================================== */
function readCookiePayload() {
  try {
    const name = "ix_emp=";
    const pair = document.cookie.split("; ").find(c => c.startsWith(name));
    if (!pair) return null;
    const raw = decodeURIComponent(pair.slice(name.length));
    // decode base64 json
    const json = JSON.parse(decodeURIComponent(escape(atob(raw))));
    return json || null;
  } catch (e) {
    WARN("No se pudo decodificar cookie ix_emp:", e);
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
    LOG("cookie ix_emp (fallback):", s || null);
  } else {
    LOG("cookie ix_emp (via Session):", s || null);
  }

  if (!s) {
    WARN("No hay sesión (Session.get y cookie fallback nulos).");
    State.session = { empleado_id: null, dept_id: null, roles: [], id_usuario: null };
    return State.session;
  }

  const empleado_id = s?.empleado_id ?? s?.id_empleado ?? null;
  const dept_id     = s?.departamento_id ?? null;
  const roles       = Array.isArray(s?.roles) ? s.roles.map(r => String(r).toUpperCase()) : [];
  const id_usuario  = s?.id_usuario ?? s?.cuenta_id ?? null;

  if (!empleado_id) WARN("No hay sesión válida (empleado_id).");
  else LOG("sesión detectada", { idEmpleado: empleado_id, depId: dept_id, roles });

  State.session = { empleado_id, dept_id, roles, id_usuario };
  return State.session;
}

/* ============================================================================
   Resolver nombre de departamento por id (caché)
   ========================================================================== */
const _deptCache = new Map();
async function resolveDeptName(depId) {
  if (!depId) return "Sin dependencia";
  if (_deptCache.has(depId)) return _deptCache.get(depId);

  try {
    // Intento 1: consulta por id (si el endpoint lo soporta)
    const res1 = await fetch(CONFIG.DEPT_API_URL, {
      method: "POST",
      headers: { "Content-Type":"application/json", "Accept":"application/json" },
      body: JSON.stringify({ id: Number(depId) })
    });
    if (res1.ok) {
      const j1 = await res1.json().catch(() => null);
      const name = j1?.data?.nombre || j1?.data?.Nombre || j1?.data?.nombre_departamento;
      if (name) { _deptCache.set(depId, name); return name; }
    }

    // Intento 2: listado completo y buscar localmente
    const res2 = await fetch(CONFIG.DEPT_API_URL, {
      method: "POST",
      headers: { "Content-Type":"application/json", "Accept":"application/json" },
      body: JSON.stringify({ page: 1, page_size: 500, status: 1 })
    });
    if (res2.ok) {
      const j2 = await res2.json().catch(() => null);
      const list = j2?.data || j2?.rows || [];
      const hit = list.find(d => Number(d.id) === Number(depId));
      const name = hit?.nombre || hit?.Nombre || hit?.nombre_departamento;
      if (name) { _deptCache.set(depId, name); return name; }
    }
  } catch (e) {
    if (CONFIG.DEBUG_LOGS) console.warn("[Home] resolveDeptName error:", e);
  }
  const fallback = `Departamento ${depId}`;
  _deptCache.set(depId, fallback);
  return fallback;
}

/* ============================================================================
   UI: perfil
   ========================================================================== */
async function hydrateProfileFromSession() {
  const s = Session?.get?.() || readCookiePayload() || {};
  const nombre = [s?.nombre, s?.apellidos].filter(Boolean).join(" ") || "—";
  setText(SEL.profileName, nombre);

  // Departamento → nombre
  const depBadgeEl = $(SEL.profileBadge);
  if (depBadgeEl) {
    const depId = State.session.dept_id;
    if (depId != null) {
      depBadgeEl.textContent = "Cargando…";
      const depName = await resolveDeptName(depId);
      depBadgeEl.textContent = depName || String(depId);
    } else {
      depBadgeEl.textContent = "Sin dependencia";
    }
  }

  // Avatar con fallback configurable
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
      if (idx >= candidates.length) {
        avatarEl.onerror = null;
        avatarEl.src = CONFIG.DEFAULT_AVATAR;
        return;
      }
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
  if (!group) { WARN("No se encontró el contenedor de estados", SEL.statusGroup); return; }
  group.setAttribute("role", "radiogroup");

  const items = $$(SEL.statusItems);
  if (!items.length) WARN("No se encontraron status items a tiempo. Revisa el HTML o los selectores.");

  items.forEach((btn, i) => {
    btn.setAttribute("role", "radio");
    btn.setAttribute("tabindex", i === 0 ? "0" : "-1");
    btn.setAttribute("aria-checked", btn.classList.contains("is-active") ? "true" : "false");

    if (!SIDEBAR_KEYS.includes(btn.dataset.status)) WARN("Botón de estado sin data-status válido:", btn);

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

  LOG("sidebar events listos");
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

  // Orden por fecha desc por defecto
  State.table.setSort?.("fecha", -1);

  // Navegación al hacer click (ignora filas de relleno o fila vacía)
  const tbody = $(SEL.tableBody);
  if (tbody) {
    tbody.addEventListener("click", (ev) => {
      const tr = ev.target.closest("tr");
      if (!tr || tr.classList.contains("gc-blank") || tr.classList.contains("gc-empty-row")) return;

      const idx = parseInt(tr.getAttribute("data-row-idx") || "-1", 10);
      if (isNaN(idx) || idx < 0) return;

      const rawRowsThisPage = State.table.getPageRawRows?.() || [];
      const raw = rawRowsThisPage[idx];
      const reqId = raw?.id ?? raw?.__raw?.id;
      if (!reqId) return;

      // Redirige a la vista del requerimiento
      const url = `${CONFIG.REQ_VIEW_URL}?id=${encodeURIComponent(reqId)}`;
      window.location.href = url;
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
  LOG("conteos", c);

  // Solo se actualizan si existen en tu HTML
  setText("#cnt-todos",       `(${c.todos})`);
  setText("#cnt-pendientes",  `(${c.pendientes})`);
  setText("#cnt-en_proceso",  `(${c.en_proceso})`);
  setText("#cnt-terminados",  `(${c.terminados})`);
  setText("#cnt-cancelados",  `(${c.cancelados})`);
  setText("#cnt-pausados",    `(${c.pausados})`);
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
    estatus:  r.estatus
  }));

  State.table?.setData(tableRows);

  if (State.table) {
    const s = State.table.getSort?.() || {};
    LOG("table render", s);
  }
  LOG("pipeline", {
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
    const fullName = (e) => e ? [e.nombre, e.apellidos].filter(Boolean).join(" ") : "—";

    const principal = byId.get(plan.viewerId);
    const subsAll = (plan.teamIds || []).map(id => {
      const emp = byId.get(id);
      return { id, nombre: fullName(emp), depto: emp?.departamento_id ?? null, username: emp?.cuenta?.username || null };
    });

    LOG("USUARIO PRINCIPAL:", {
      id: plan.viewerId,
      nombre: fullName(principal),
      depto: principal?.departamento_id ?? null,
      role: plan.role,
      isAdmin: !!plan.isAdmin
    });
    LOG("SUBORDINADOS (deep):", { total: subsAll.length, items: subsAll });
  } catch (e) {
    WARN("No se pudo loggear jerarquía:", e);
  }
}

/* ============================================================================
   Solo “yo + subordinados” (sin depto)
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

  // Log visible de la lista final (crudos)
  LOG("FINAL mine+team items (raw):",
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
    WARN("viewerId ausente. Se omite carga de scope.");
    State.universe = [];
    State.rows = [];
    computeCounts(State.rows);
    updateLegendTotals(0);
    updateLegendStatus();
    applyPipelineAndRender();
    return;
  }

  LOG("construyendo planScope", { viewerId, viewerDeptId });
  const plan = await planScope({ viewerId, viewerDeptId });
  State.scopePlan = plan;
  LOG("planScope listo", plan);

  // Logs de jerarquía
  logHierarchy(plan);

  // Solo yo + subordinados
  LOG("fetching only mine + team…");
  const items = await fetchMineAndTeam(plan, {});

  // Pintado
  State.universe = items.slice();
  State.rows = State.universe.map(parseReq);

  // Log visible (ya mapeado a UI)
  LOG("FINAL mine+team items (UI-mapped):",
    State.rows.map(r => ({
      id: r.id, folio: r.folio, asignado: r.asignado,
      estatus: r.estatus?.label, creado: r.creado
    }))
  );

  computeCounts(State.rows);
  updateLegendTotals(State.rows.length);
  updateLegendStatus();
  applyPipelineAndRender();

  LOG("datos listos", {
    total: State.rows.length,
    primeros3: State.rows.slice(0, 3).map(r => ({ id: r.id, folio: r.folio, estatus: r.estatus?.code }))
  });
}

/* ============================================================================
   Init
   ========================================================================== */
window.addEventListener("DOMContentLoaded", async () => {
  try {
    readSession();                  // llena State.session y loguea
    await hydrateProfileFromSession(); // pinta nombre/depto/avatar

    initStatesSidebar();
    initSearch();
    buildTable();
    updateLegendStatus();

    await loadScopeData();

    LOG("init — Home listo");
  } catch (e) {
    ERR("init error:", e);
  }
});


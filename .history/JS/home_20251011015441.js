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
  ESTATUS
} from "/JS/api/requerimientos.js";
import { createTable } from "/JS/ui/table.js";

/* ============================================================================
   Constantes / Selectores
   ========================================================================== */
const TAG = "[Home]";

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

  // Charts (opcional)
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
   Fallback: leer cookie ix_emp (base64 json) si Session.get() no devuelve nada
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
    console.warn(TAG, "No se pudo decodificar cookie ix_emp:", e);
    return null;
  }
}

/* ============================================================================
   Lectura de sesión
   ========================================================================== */
function readSession() {
  // 1) Intentar por módulo
  let s = null;
  try { s = Session?.get?.() || null; } catch { s = null; }

  // 2) Fallback: cookie base64
  if (!s) {
    s = readCookiePayload();
    console.log(TAG, "cookie ix_emp (fallback):", s || null);
  } else {
    console.log(TAG, "cookie ix_emp (via Session):", s || null);
  }

  if (!s) {
    console.warn(TAG, "No hay sesión (Session.get y cookie fallback nulos).");
    State.session = { empleado_id: null, dept_id: null, roles: [], id_usuario: null };
    return State.session;
  }

  const empleado_id = s?.empleado_id ?? s?.id_empleado ?? null;
  const dept_id     = s?.departamento_id ?? null;
  const roles       = Array.isArray(s?.roles) ? s.roles.map(r => String(r).toUpperCase()) : [];
  const id_usuario  = s?.id_usuario ?? s?.cuenta_id ?? null;

  if (!empleado_id) {
    console.warn(TAG, "No hay sesión válida (empleado_id).");
  } else {
    console.log(TAG, "sesión detectada", { idEmpleado: empleado_id, depId: dept_id, roles });
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

  // Si no hay nombre de dependencia ya puesto en el HTML, mostramos el id
  const depBadgeEl = $(SEL.profileBadge);
  if (depBadgeEl) {
    const text = depBadgeEl.textContent?.trim();
    if (!text || text === "—") {
      depBadgeEl.textContent = State.session.dept_id != null ? String(State.session.dept_id) : "—";
    }
  }

  // Avatar (best-effort)
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
  if (!group) {
    console.warn(TAG, "No se encontró el contenedor de estados", SEL.statusGroup);
    return;
  }
  group.setAttribute("role", "radiogroup");

  const items = $$(SEL.statusItems);
  if (!items.length) {
    console.warn(TAG, "No se encontraron status items a tiempo. Revisa el HTML o los selectores.");
  }

  items.forEach((btn, i) => {
    btn.setAttribute("role", "radio");
    btn.setAttribute("tabindex", i === 0 ? "0" : "-1");
    btn.setAttribute("aria-checked", btn.classList.contains("is-active") ? "true" : "false");

    if (!SIDEBAR_KEYS.includes(btn.dataset.status)) {
      console.warn(TAG, "Botón de estado sin data-status válido:", btn);
    }

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

  console.log(TAG, "sidebar events listos");
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
  rows.forEach(r => {
    c.todos++;
    const k = catKeyFromCode(r.estatus?.code);
    if (k in c) c[k]++;
  });
  State.counts = c;
  console.log(TAG, "conteos", c);

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
      return asunto.includes(q) || asign.includes(q) || est.includes(q);
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
    console.log(TAG, "table render", s);
  }
  console.log(TAG, "pipeline", {
    filtroStatus: State.filterKey,
    search: State.search,
    totalUniverso: all.length,
    totalFiltrado: tableRows.length,
    counts: State.counts
  });
}

/* ============================================================================
   Carga de datos (scope por subordinados)
   ========================================================================== */
async function loadScopeData() {
  const viewerId = State.session.empleado_id;
  const viewerDeptId = State.session.dept_id;

  if (!viewerId) {
    console.warn(TAG, "viewerId ausente. Se omite carga de scope.");
    // deja UI vacía pero consistente
    State.universe = [];
    State.rows = [];
    computeCounts(State.rows);
    updateLegendTotals(0);
    updateLegendStatus();
    applyPipelineAndRender();
    return;
  }

  console.log(TAG, "construyendo planScope", { viewerId, viewerDeptId });

  const plan = await planScope({ viewerId, viewerDeptId });
  State.scopePlan = plan;
  console.log(TAG, "planScope listo", plan);

  console.log(TAG, "ejecutando fetchScope…");
  const { items, counts, filtros } = await fetchScope({ plan, filtros: {} });
  console.log(TAG, "fetchScope OK", { total: items.length, counts, filtros });

  State.universe = items.slice();
  State.rows = State.universe.map(parseReq);

  computeCounts(State.rows);
  updateLegendTotals(State.rows.length);
  updateLegendStatus();
  applyPipelineAndRender();

  console.log(TAG, "datos listos", {
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
    readSession();                  // llena State.session y loguea
    hydrateProfileFromSession();    // pinta nombre/depto/avatar

    // 2) UI base
    initStatesSidebar();
    initSearch();
    buildTable();

    // 3) Datos (scope por subordinados) – no truena si no hay sesión
    await loadScopeData();

    console.log(TAG, "init — Home listo");
  } catch (err) {
    console.error(TAG, "init error:", err);
  }
});

// /JS/home.js
// Modo módulo
"use strict";

/* ============================================================================
   Selectores/Constantes
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

  // Charts (placeholder, opcional)
  chartYear:    "#chart-year",
  chartMonth:   "#chart-month",
};

// Mapa de categorías para el sidebar
// - "pendientes" = 0,1,2
// - "en_proceso" = 3
// - "pausados"   = 4
// - "cancelados" = 5
// - "terminados" = 6
const SIDEBAR_KEYS = ["todos", "pendientes", "en_proceso", "terminados", "cancelados", "pausados"];

/* ============================================================================
   Helpers DOM mínimos
   ========================================================================== */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };
const toggle  = (el, show) => { if (!el) return; el.hidden = !show; };

function formatDateMX(isoOrSql) {
  if (!isoOrSql) return "—";
  // Soporta "YYYY-MM-DD hh:mm:ss"
  const s = String(isoOrSql).replace(" ", "T");
  const d = new Date(s);
  if (isNaN(d)) return isoOrSql;
  return d.toLocaleDateString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit" });
}

/* ============================================================================
   Import API requerimientos (asume rutas ya en tu proyecto)
   ========================================================================== */
import {
  planScope,
  fetchScope,
  parseReq,
  ESTATUS
} from "/JS/api/requerimientos.js";

import { createTable } from "/JS/ui/table.js";

/* ============================================================================
   Estado local
   ========================================================================== */
const State = {
  session: { empleado_id: null, dept_id: null, roles: [] },
  scopePlan: null,
  universe: [],         // registros crudos (items del scope)
  rows: [],             // registros parseados para UI
  filterKey: "todos",   // uno de SIDEBAR_KEYS
  search: "",
  counts: {             // conteos por categoría
    todos: 0, pendientes: 0, en_proceso: 0, terminados: 0, cancelados: 0, pausados: 0
  },
  table: null
};

/* ============================================================================
   Lectura de sesión
   ========================================================================== */
function readSession() {
  const s = window.Session?.get?.();
  console.log(TAG, "cookie ix_emp:", s || null);

  const empleado_id = s?.empleado_id ?? s?.id_empleado ?? null;
  const dept_id     = s?.departamento_id ?? null;
  const roles       = Array.isArray(s?.roles) ? s.roles.map(r => String(r).toUpperCase()) : [];

  if (!empleado_id) {
    console.warn(TAG, "No hay sesión válida (empleado_id).");
  } else {
    console.log(TAG, "sesión detectada", { idEmpleado: empleado_id, depId: dept_id, roles });
  }

  State.session = { empleado_id, dept_id, roles };
  return State.session;
}

/* ============================================================================
   UI: perfil (nombre / depto / avatar)
   ========================================================================== */
function hydrateProfileFromSession() {
  const s = window.Session?.get?.() || {};
  const nombre    = [s?.nombre, s?.apellidos].filter(Boolean).join(" ") || "—";
  const depBadge  = $(SEL.profileBadge)?.textContent?.trim();

  console.log(TAG, "perfil", { nombre, depId: State.session.dept_id });

  // Nombre
  setText(SEL.profileName, nombre);

  // Badge (si ya hay texto, lo respetamos; si no, mostramos ID de depto como fallback)
  if ($(SEL.profileBadge) && (!depBadge || depBadge === "—")) {
    setText(SEL.profileBadge, State.session.dept_id != null ? String(State.session.dept_id) : "—");
  }

  // Avatar: si falla, dejamos el que está
  const avatarEl = $(SEL.avatar);
  if (avatarEl && s?.id_usuario != null) {
    const idu = s.id_usuario;
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
   Sidebar: wiring y ARIA
   ========================================================================== */
function initStatesSidebar() {
  const group = $(SEL.statusGroup);
  if (!group) {
    console.warn(TAG, "No se encontró el contenedor de estados", SEL.statusGroup);
    return;
  }
  group.setAttribute("role", "radiogroup");

  const items = $$(SEL.statusItems);
  items.forEach((btn, i) => {
    btn.setAttribute("role", "radio");
    btn.setAttribute("tabindex", i === 0 ? "0" : "-1");
    btn.setAttribute("aria-checked", btn.classList.contains("is-active") ? "true" : "false");

    // Asegura data-status
    const k = btn.dataset.status;
    if (!k || !SIDEBAR_KEYS.includes(k)) {
      console.warn(TAG, "Botón de estado sin data-status válido:", btn);
    }

    btn.addEventListener("click", () => {
      items.forEach(b => { b.classList.remove("is-active"); b.setAttribute("aria-checked", "false"); b.tabIndex = -1; });
      btn.classList.add("is-active"); btn.setAttribute("aria-checked", "true"); btn.tabIndex = 0;
      State.filterKey = (btn.dataset.status || "todos");
      updateLegendStatus();
      applyPipelineAndRender();
      $(SEL.searchInput)?.focus();
    });
  });

  // Navegación con flechas + activar con Enter/Espacio
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
   Controles de leyenda
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
   Categorización y conteos
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

  // Pintar en sidebar
  setText("#cnt-todos",       `(${c.todos})`);
  setText("#cnt-pendientes",  `(${c.pendientes})`);
  setText("#cnt-en_proceso",  `(${c.en_proceso})`);
  setText("#cnt-terminados",  `(${c.terminados})`);
  setText("#cnt-cancelados",  `(${c.cancelados})`);
  setText("#cnt-pausados",    `(${c.pausados})`);
}

/* ============================================================================
   Pipeline (filtros + búsqueda) y render de tabla
   ========================================================================== */
function applyPipelineAndRender() {
  const all = State.rows || [];
  let filtered = all;

  // Filtro por categoría de status
  if (State.filterKey !== "todos") {
    filtered = filtered.filter(r => catKeyFromCode(r.estatus?.code) === State.filterKey);
  }

  // Búsqueda
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

  // Mapea filas a formato tabla (con __raw para getRawRows)
  const tableRows = filtered.map(r => ({
    __raw: r,
    asunto:   r.asunto,
    tramite:  r.tramite,
    asignado: r.asignado,
    creado:   r.creado,
    estatus:  r.estatus
  }));

  State.table?.setData(tableRows);
  // Log útil de la tabla
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
   Bootstrap de datos (scope por subordinados)
   ========================================================================== */
async function loadScopeData() {
  const viewerId = State.session.empleado_id;
  const viewerDeptId = State.session.dept_id;

  if (!viewerId) {
    throw new Error("viewerId ausente. Revisa sesión.");
  }

  console.log(TAG, "construyendo planScope", { viewerId, viewerDeptId });

  // 1) Plan
  const plan = await planScope({ viewerId, viewerDeptId });
  State.scopePlan = plan;
  console.log(TAG, "planScope listo", plan);

  // 2) Fetch scope
  console.log(TAG, "ejecutando fetchScope…");
  const { items, counts, filtros } = await fetchScope({ plan, filtros: {} });
  console.log(TAG, "fetchScope OK", { total: items.length, counts, filtros });

  State.universe = items.slice();

  // 3) Parseo a modelo UI
  State.rows = State.universe.map(parseReq);

  // Conteos iniciales y render
  computeCounts(State.rows);
  updateLegendTotals(State.rows.length);
  updateLegendStatus();
  applyPipelineAndRender();

  // Charts (opcional; placeholder)
  try {
    // aquí conectarías tu LineChart / DonutChart si lo deseas.
    // console.log(TAG, "chart-year & chart-month listos");
  } catch (e) {
    console.warn(TAG, "charts skip/placeholder", e);
  }

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
    readSession();
    hydrateProfileFromSession();

    // 2) Sidebar + búsqueda + tabla
    initStatesSidebar();
    initSearch();
    buildTable();

    // 3) Datos (scope por subordinados)
    await loadScopeData();

    console.log(TAG, "init — cargado Home con scope por subordinados");
  } catch (err) {
    console.error(TAG, "init error:", err);

  }
});

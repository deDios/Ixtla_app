// /JS/views/home.js

import { $, mountSkeletonList, toggle, escapeHtml } from "/JS/core/dom.js";
import { createStore } from "/JS/core/store.js";
import { LineChart } from "/JS/charts/line-chart.js";
import { DonutChart } from "/JS/charts/donut-chart.js";
import { fetchRequerimientos } from "/JS/api/requerimientos.js";
import { createTable } from "/JS/ui/table.js";
import { Drawer } from "/JS/ui/drawer.js";

const TAG = "[Home]";

// CON
const CFG = {
  ENDPOINTS: {
    empleadoDetalle: "/DB/WEB/ixtla01_c_empleado.php",
    departamentos: [
      "/db/WEB/ixtla01_c_departamento.php",
      "/db/WEB/c_departamento.php",
    ],
  },
  SELECTORS: {
    profileName: "#h-user-nombre",
    profileBadge: ".profile-dep.badge",
    profileLink: ".profile-link",
    avatar: ".profile-card .avatar",
    statusGroup: ".status-block",
    statusItems: ".status-nav .status-item",
    statusNav: ".status-nav",
    searchInput: "#tbl-search",
    tableSkeleton: "#tbl-skeleton",
    tableWrap: "#tbl-wrap",
    tableEmpty: "#tbl-empty",
    tableBody: "#tbl-body",
    tableTotal: "#tbl-total",
    tableStatusLabel: "#tbl-status-label",
    chartYear: "#chart-year",
    chartMonth: "#chart-month",
  },
  TABLE: {
    pageSize: 7,
    reqFetchPerPage: 200,
  },
  FEATURES: {
    deptChipToggleEnabled: true, 
    preHydrateSidebar: true,     
  },
};

// STATUS 
const ESTATUS = {
  0: { clave: "solicitud",  nombre: "Solicitud"   },
  1: { clave: "revision",   nombre: "Revisión"    },
  2: { clave: "asignacion", nombre: "Asignación"  },
  3: { clave: "enProceso",  nombre: "En proceso"  },
  4: { clave: "pausado",    nombre: "Pausado"     },
  5: { clave: "cancelado",  nombre: "Cancelado"   },
  6: { clave: "finalizado", nombre: "Finalizado"  },
};
const STATUS_COLORS = {
  solicitud:  "#a5b4fc",
  revision:   "#93c5fd",
  asignacion: "#6ee7b7",
  enProceso:  "#60a5fa",
  pausado:    "#fbbf24",
  cancelado:  "#f87171",
  finalizado: "#34d399",
};
function ESTATUS_BY_CLAVE(clave) {
  const id = Object.keys(ESTATUS).find(k => ESTATUS[k].clave === clave);
  return id ? ESTATUS[id] : null;
}
function humanStatusLabel(key) {
  return ESTATUS_BY_CLAVE(key)?.nombre ?? (key === "todos" ? "Todos los status" : key);
}

// ============================================================================
// Session (cookie) utils – prefer global from guard; else Session.get()
// ============================================================================
const __sess = (window.__ixSession) || (window.Session?.get?.() ?? null);
function getUserFromSession(sess) {
  if (!sess) return {
    idUsuario: null,
    nombre: "",
    apellidos: "",
    departamento_id: 1,
    roles: [],
    departamento_nombre: null,
  };
  const roles = Array.isArray(sess.roles)
    ? sess.roles.map(r => (typeof r === "string" ? r : (r?.codigo ?? r?.name ?? ""))).filter(Boolean)
    : [];
  return {
    idUsuario: sess.id_usuario ?? sess.id ?? null,
    nombre: sess.nombre ?? "",
    apellidos: sess.apellidos ?? "",
    departamento_id: Number(sess.departamento_id ?? 1),
    roles,
    departamento_nombre: sess.departamento_nombre ?? sess.dependencia ?? null,
  };
}
const UserFromSess = getUserFromSession(__sess);

// ============================================================================
// DOM helpers
// ============================================================================
const $one = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const bindOnce = (el, ev, fn) => { if (!el || el.dataset.binded === "1") return; el.addEventListener(ev, fn); el.dataset.binded = "1"; };
function debounce(fn, ms = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function setTextSafe(sel, txt) { const el = document.querySelector(sel); if (el) el.textContent = txt; }
function normalizeLabelToKey(label){
  if (!label) return null;
  const s = String(label)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,'');
  if (s === 'todos') return 'todos';
  if (s === 'solicitud') return 'solicitud';
  if (s === 'revision') return 'revision';
  if (s === 'asignacion') return 'asignacion';
  if (s === 'enproceso') return 'enProceso';
  if (s === 'pausado') return 'pausado';
  if (s === 'cancelado') return 'cancelado';
  if (s === 'finalizado') return 'finalizado';
  return null;
}
function setCount(key, val) {
  const byId = document.querySelector(`#cnt-${key}`);
  if (byId) { byId.textContent = `(${val})`; return; }
  const byDs = document.querySelector(`.status-nav [data-status="${key}"] .count`);
  if (byDs) byDs.textContent = `(${val})`;
}

// ============================================================================
// Department name resolver (with cache)
// ============================================================================
const deptCache = new Map();
async function resolveDepartamentoNombre(depId) {
  if (!depId) return "Sin dependencia";
  if (deptCache.has(depId)) return deptCache.get(depId);

  if (UserFromSess.departamento_nombre) {
    deptCache.set(depId, UserFromSess.departamento_nombre);
    return UserFromSess.departamento_nombre;
  }
  for (const url of CFG.ENDPOINTS.departamentos) {
    try {
      const u = new URL(url, location.origin);
      u.searchParams.set("status", 1);
      const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
      const json = await res.json().catch(() => null);
      const arr = json?.data ?? json?.rows ?? [];
      const found = arr.find(d => Number(d.id) === Number(depId));
      if (found?.nombre) { deptCache.set(depId, found.nombre); return found.nombre; }
    } catch (_) {}
  }
  const fallback = `Departamento ${depId}`;
  deptCache.set(depId, fallback);
  return fallback;
}

// ============================================================================
// Employee endpoint
// ============================================================================
async function fetchEmpleadoDetalleById(idEmpleado) {
  if (!idEmpleado) return null;
  try {
    const res = await fetch(CFG.ENDPOINTS.empleadoDetalle, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ id: Number(idEmpleado) })
    });
    const json = await res.json().catch(() => null);
    return (json && json.ok) ? (json.data || null) : null;
  } catch { return null; }
}

// ============================================================================
// Store (single source of truth)
// ============================================================================
const S = createStore({
  user: {
    id: UserFromSess.idUsuario,
    nombre: (UserFromSess.nombre || "") + (UserFromSess.apellidos ? " " + UserFromSess.apellidos : ""),
    dep: UserFromSess.departamento_id,
    roles: UserFromSess.roles,
  },
  filtros: {
    status: "todos",  // 'todos' | 'solicitud' | 'revision' | 'asignacion' | 'enProceso' | 'pausado' | 'cancelado' | 'finalizado'
    search: "",
    depto: null,       // null => ALL departments; number => filter by that dept id
  },
  requerimientos: [],
  counts: {
    todos: 0,
    solicitud: 0,
    revision: 0,
    asignacion: 0,
    enProceso: 0,
    pausado: 0,
    cancelado: 0,
    finalizado: 0,
  },
  pageSize: CFG.TABLE.pageSize,
});

// ============================================================================
// Pre-hydrate Sidebar (avoid FOUC)
// ============================================================================
(function preHydrateSidebar() {
  if (!CFG.FEATURES.preHydrateSidebar) return;
  const fullName = S.get().user.nombre || "—";

  // Name under profile link
  if (!$one(CFG.SELECTORS.profileName)){
    const link = $one(CFG.SELECTORS.profileLink);
    const dash = $one(".profile-dash");
    const h = document.createElement("h3");
    h.id = CFG.SELECTORS.profileName.replace('#','');
    h.className = "profile-name";
    h.textContent = fullName;
    if (link && dash) link.insertAdjacentElement("afterend", h);
    else $one(".profile-card")?.appendChild(h);
  } else {
    setTextSafe(CFG.SELECTORS.profileName, fullName);
  }

  // Avatar alt + fallback
  const avatarEl = $one(CFG.SELECTORS.avatar);
  if (avatarEl) {
    const fallback = "/ASSETS/user/img_user1.png";
    const candidate = S.get().user.id ? `/ASSETS/user/img_user${S.get().user.id}.png` : fallback;
    avatarEl.alt = fullName || "Avatar";
    avatarEl.src = candidate;
    avatarEl.onerror = () => (avatarEl.src = fallback);
  }

  // Profile link href (if missing)
  const linkPerfil = $one(CFG.SELECTORS.profileLink);
  if (linkPerfil && !linkPerfil.getAttribute("href")) {
    linkPerfil.setAttribute("href", "/VIEWS/perfil.php");
  }
})();

// ============================================================================
// Init
// ============================================================================
window.addEventListener("DOMContentLoaded", () => {
  Drawer.init(".ix-drawer");
  init();
});

async function init() {
  console.log(`${TAG} init (dep: ${S.get().user.dep}, roles: ${S.get().user.roles?.join(",") || "-"})`);

  // Badge (department name) and chip behavior (optional filter for everyone)
  const depEl = $one(CFG.SELECTORS.profileBadge);
  if (depEl) {
    const depName = await resolveDepartamentoNombre(S.get().user.dep);
    depEl.textContent = depName || "Sin dependencia";

    // Chip as optional toggle (default: ALL departments)
    if (CFG.FEATURES.deptChipToggleEnabled) {
      depEl.setAttribute("role", "button");
      depEl.setAttribute("aria-pressed", "false");
      depEl.classList.remove("active");
      depEl.dataset.departamento = String(S.get().user.dep);

      bindOnce(depEl, "click", () => {
        const active = S.get().filtros.depto != null;
        const next = active ? null : S.get().user.dep;
        S.set({ filtros: { ...S.get().filtros, depto: next } });
        depEl.classList.toggle("active", !!next);
        depEl.setAttribute("aria-pressed", String(!!next));
        applyPipelineAndRender();
      });
    }
  }

  // Skeleton
  mountSkeletonList($(CFG.SELECTORS.tableSkeleton), 7);

  // Charts
  const lc = LineChart($(CFG.SELECTORS.chartYear));   lc.mount({ data: [] });
  const dc = DonutChart($(CFG.SELECTORS.chartMonth)); dc.mount({ data: [] });
  window.__ixCharts = { lc, dc };

  // Table
  const table = createTable({
    pageSize: S.get().pageSize,
    columns: [
      { key: "folio",        title: "Requerimiento", sortable: true, accessor: r => r.folio || "—" },
      { key: "contacto",     title: "Contacto",      sortable: true, accessor: r => r.contacto || "—" },
      { key: "telefono",     title: "Teléfono",      sortable: true, accessor: r => r.telefono  || "—" },
      { key: "departamento", title: "Departamento",  sortable: true, accessor: r => r.departamento || "—" },
      {
        key: "status", title: "Status", sortable: true, accessor: r => r.statusKey || "",
        render: (val, row) => {
          const name = row.status || val || "—";
          const k = row.statusKey || "";
          return `<span class="badge-status" data-k="${k}">${escapeHtml(name)}</span>`;
        }
      }
    ]
  });
  window.__tableInstance = table;

  // Load data
  await loadRequerimientos();

  // Sidebar data-status + ARIA radiogroup
  initStatusDom();
  makeStatusRadiogroup();

  // First render
  applyPipelineAndRender(table);

  // Hide skeletons
  document.documentElement.classList.add("is-loaded");

  // Wire events
  wireSidebarEvents(table);
  wireSearch();
  wireRowClick(table);

  // Mark "todos" active
  const allBtn = document.querySelector(`${CFG.SELECTORS.statusItems}[data-status="todos"]`);
  if (allBtn) {
    $$(CFG.SELECTORS.statusItems).forEach(b => b.classList.remove("active"));
    allBtn.classList.add("active");
    allBtn.setAttribute("aria-checked", "true");
  }

  // Try to refresh the full name from employee endpoint (best-effort)
  try {
    const emp = await fetchEmpleadoDetalleById(S.get().user.id);
    if (emp?.nombre) {
      const full = `${emp.nombre ?? ""}${emp.apellidos ? " " + emp.apellidos : ""}`.trim() || "—";
      S.set({ user: { ...S.get().user, nombre: full }});
      setTextSafe(CFG.SELECTORS.profileName, full);
    }
  } catch {}
}

// ============================================================================
// Data load
// ============================================================================
async function loadRequerimientos() {
  toggle($(CFG.SELECTORS.tableWrap), false);
  toggle($(CFG.SELECTORS.tableSkeleton), true);
  toggle($(CFG.SELECTORS.tableEmpty), false);

  try {
    const { ok, rows, data, count } = await fetchRequerimientos({
      page: 1,
      per_page: CFG.TABLE.reqFetchPerPage,
    });

    if (!ok) throw new Error("Respuesta no OK");
    const list = Array.isArray(rows) ? rows : (Array.isArray(data) ? data : []);
    S.set({ requerimientos: list });

    // Charts (from full universe)
    window.__ixCharts?.lc?.update({ data: computeSeriesAnual(list) });
    window.__ixCharts?.dc?.update({ data: computeDonutMes(list) });

    // Legend total (updated again after pipeline)
    setTextSafe(CFG.SELECTORS.tableTotal, String(count ?? list.length));
    setTextSafe(CFG.SELECTORS.tableStatusLabel, "Todos los status");

  } catch (err) {
    console.error(TAG, "loadRequerimientos()", err);
    if (typeof gcToast === "function") gcToast("Hubo un error, inténtalo más tarde.", "warning");
    S.set({
      requerimientos: [],
      counts: { todos: 0, solicitud: 0, revision: 0, asignacion: 0, enProceso: 0, pausado: 0, cancelado: 0, finalizado: 0 }
    });
  } finally {
    toggle($(CFG.SELECTORS.tableSkeleton), false);
    toggle($(CFG.SELECTORS.tableWrap), true);
  }
}

// ============================================================================
// Sidebar helpers (status DOM + ARIA)
// ============================================================================
function initStatusDom(){
  $$(CFG.SELECTORS.statusItems).forEach(btn => {
    if (!btn.dataset.status){
      const label = btn.querySelector('.label')?.textContent?.trim();
      const key = normalizeLabelToKey(label);
      if (key) btn.dataset.status = key;
    }
  });
}
function makeStatusRadiogroup() {
  const nav = $one(CFG.SELECTORS.statusGroup);
  if (nav) nav.setAttribute("role", "radiogroup");
  $$(CFG.SELECTORS.statusItems).forEach((btn, idx) => {
    btn.setAttribute("role", "radio");
    btn.setAttribute("tabindex", idx === 0 ? "0" : "-1");
    btn.setAttribute("aria-checked", btn.classList.contains("active") ? "true" : "false");
  });
  bindOnce($one(CFG.SELECTORS.statusNav), "keydown", (e) => {
    const items = $$(CFG.SELECTORS.statusItems);
    if (!items.length) return;
    const current = document.activeElement.closest(".status-item");
    const idx = Math.max(0, items.indexOf(current));
    let nextIdx = idx;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") nextIdx = (idx + 1) % items.length;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") nextIdx = (idx - 1 + items.length) % items.length;
    if (nextIdx !== idx) { items[nextIdx].focus(); e.preventDefault(); }
    if (e.key === " " || e.key === "Enter") { items[nextIdx].click(); e.preventDefault(); }
  });
}

// ============================================================================
// Wiring (sidebar clicks, search, row click)
// ============================================================================
function wireSidebarEvents(table) {
  $$(CFG.SELECTORS.statusItems).forEach(btn => {
    bindOnce(btn, "click", () => {
      $$(CFG.SELECTORS.statusItems).forEach(b => { b.classList.remove("active"); b.setAttribute("aria-checked", "false"); });
      btn.classList.add("active");
      btn.setAttribute("aria-checked", "true");

      const statusKey = btn.dataset.status || normalizeLabelToKey(btn.querySelector(".label")?.textContent) || "todos";
      S.set({ filtros: { ...S.get().filtros, status: statusKey } });

      setTextSafe(CFG.SELECTORS.tableStatusLabel, humanStatusLabel(statusKey));
      applyPipelineAndRender(table);
      $(CFG.SELECTORS.searchInput)?.focus();
    });
  });
}
function wireSearch() {
  $(CFG.SELECTORS.searchInput)?.addEventListener("input", debounce((e) => {
    const q = (e.target.value || "").trim().toLowerCase();
    S.set({ filtros: { ...S.get().filtros, search: q } });
    applyPipelineAndRender();
  }, 250));
}
function wireRowClick(table) {
  const tbody = document.querySelector(CFG.SELECTORS.tableBody);
  if (!tbody) return;
  bindOnce(tbody, "click", (e) => {
    const tr = e.target.closest("tr");
    if (!tr || !tbody.contains(tr)) return;
    const idx = Number(tr.dataset.rowIdx);
    const raw = table.getRawRows?.()?.[idx];
    if (!raw) return;

    Drawer.open(raw, {
      getSessionUserId: () => (window.__ixSession?.id_usuario ?? 1),
      onUpdated: (updated) => {
        try {
          const arr = S.get().requerimientos.slice();
          const i = arr.findIndex(r => r.id === updated.id);
          if (i >= 0) arr[i] = updated;
          S.set({ requerimientos: arr });
          applyPipelineAndRender(table);
          if (typeof gcToast === "function") gcToast("Requerimiento actualizado.", "exito");
        } catch (err) { console.error("[Home] onUpdated error:", err); }
      },
      onError: (err) => {
        console.error("[Drawer] error:", err);
        if (typeof gcToast === "function") gcToast("Ocurrió un error. Inténtalo más tarde.", "warning");
      }
    });
  });
}

// ============================================================================
// Pipeline: depto + search -> counts -> status -> table
// ============================================================================
function applyPipelineAndRender(tableInstance) {
  const t = tableInstance || window.__tableInstance;
  const { status, search, depto } = S.get().filtros;
  const base = S.get().requerimientos || [];

  // (1) Department filter (optional). Default: null => ALL departments
  const deptFilterId = depto; // *** IMPORTANT: default ALL ***
  let filtered = base;
  if (deptFilterId != null) {
    filtered = filtered.filter(r => Number(r.departamento_id ?? r.departamento) === Number(deptFilterId));
  }

  // (2) Search filter
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(r => {
      const estNom = (ESTATUS[Number(r.estatus)]?.nombre || "").toLowerCase();
      const folio = (r.folio || "").toLowerCase();
      const nom   = (r.contacto_nombre || "").toLowerCase();
      const tel   = (r.contacto_telefono || "").toLowerCase();
      const dep   = (r.departamento_nombre || "").toLowerCase();
      return estNom.includes(q) || folio.includes(q) || nom.includes(q) || tel.includes(q) || dep.includes(q);
    });
  }

  // (3) Counts on pre-status universe
  computeCounts(filtered);
  renderCounts();

  // (4) Status filter for the table
  let forTable = filtered;
  if (status !== "todos") {
    forTable = filtered.filter(r => ESTATUS[Number(r.estatus)]?.clave === status);
  }

  // (5) Map to table rows
  const rows = forTable.map(r => {
    const est = ESTATUS[Number(r.estatus)];
    return {
      __raw: r,
      folio:        r.folio || "—",
      contacto:     r.contacto_nombre || "—",
      telefono:     r.contacto_telefono || "—",
      departamento: r.departamento_nombre || "—",
      status:       est?.nombre || String(r.estatus ?? "—"),
      statusKey:    est?.clave  || "",
    };
  });

  // (6) Render table
  const table = t || createTable({ pageSize: S.get().pageSize, columns: [] });
  window.__tableInstance = table;

  if (!rows.length) {
    table.setData([]);
    toggle($(CFG.SELECTORS.tableEmpty), true);
    setTextSafe(CFG.SELECTORS.tableTotal, "0");
  } else {
    table.setData(rows);
    toggle($(CFG.SELECTORS.tableEmpty), false);
    setTextSafe(CFG.SELECTORS.tableTotal, String(rows.length));
  }

  // (7) Human status label
  setTextSafe(CFG.SELECTORS.tableStatusLabel, humanStatusLabel(status));
}

// ============================================================================
// Counts
// ============================================================================
function computeCounts(rows = []) {
  const counts = {
    todos: rows.length,
    solicitud: 0,
    revision: 0,
    asignacion: 0,
    enProceso: 0,
    pausado: 0,
    cancelado: 0,
    finalizado: 0,
  };
  rows.forEach(r => {
    const k = ESTATUS[Number(r.estatus)]?.clave;
    if (k && Object.prototype.hasOwnProperty.call(counts, k)) counts[k]++;
  });
  S.set({ counts });
}
function renderCounts() {
  const c = S.get().counts;
  setCount("todos",      c.todos);
  setCount("solicitud",  c.solicitud);
  setCount("revision",   c.revision);
  setCount("asignacion", c.asignacion);
  setCount("enProceso",  c.enProceso);
  setCount("pausado",    c.pausado);
  setCount("cancelado",  c.cancelado);
  setCount("finalizado", c.finalizado);
}

// ============================================================================
// Charts helpers
// ============================================================================
function computeSeriesAnual(rows = []) {
  const now = new Date();
  const year = now.getFullYear();
  const counts = new Array(12).fill(0);
  rows.forEach(r => {
    const d = new Date(String(r.created_at).replace(" ", "T"));
    if (!isNaN(d) && d.getFullYear() === year) counts[d.getMonth()] += 1;
  });
  return counts;
}
function computeDonutMes(rows = []) {
  const now = new Date();
  const y = now.getFullYear(), m0 = now.getMonth();
  const acc = {};
  rows.forEach(r => {
    const d = new Date(String(r.created_at).replace(" ", "T"));
    if (isNaN(d)) return;
    if (d.getFullYear() !== y || d.getMonth() !== m0) return;
    const clave = ESTATUS[Number(r.estatus)]?.clave;
    if (!clave) return;
    acc[clave] = (acc[clave] || 0) + 1;
  });
  const out = [];
  for (const k of Object.keys(acc)) {
    out.push({ label: ESTATUS_BY_CLAVE(k)?.nombre || k, value: acc[k], color: STATUS_COLORS[k] || "#4f6b95" });
  }
  out.sort((a, b) => b.value - a.value);
  return out;
}

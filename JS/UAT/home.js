// /JS/UAT/home.js  
window.__IX_DEBUG_HOME = true;

import { $, mountSkeletonList, toggle, escapeHtml } from "/JS/UAT/core/dom.js";
import { createStore } from "/JS/UAT/core/store.js";
import { LineChart } from "/JS/UAT/charts/line-chart.js";
import { DonutChart } from "/JS/UAT/charts/donut-chart.js";
import { fetchRequerimientos } from "/JS/UAT/api/requerimientos.js";
import { createTable } from "/JS/UAT/ui/table.js";
import { Drawer } from "/JS/UAT/ui/drawer.js";

const TAG = "[Home]";
const DEBUG = Boolean(window.__IX_DEBUG_HOME);

const dbg = {
  log:  (...a) => DEBUG && console.log(TAG, ...a),
  info: (...a) => DEBUG && console.info(TAG, ...a),
  warn: (...a) => DEBUG && console.warn(TAG, ...a),
  error:(...a) => DEBUG && console.error(TAG, ...a),
  group:(label) => DEBUG && console.group(`${TAG} ${label}`),
  groupEnd:() => DEBUG && console.groupEnd()
};

// CON
const CFG = {
  ENDPOINTS: {
    empleado: "/DB/WEB/ixtla01_c_empleado.php",
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
  TABLE: { pageSize: 7, reqFetchPerPage: 200 },
  FEATURES: {
    preHydrateFromCookie: true,
    deptChipToggleEnabled: true,
  },
};

// Estatus y colores
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

// Session
function readIxSession() {
  if (window.__ixSession && typeof window.__ixSession === "object") {
    dbg.log("readIxSession(): usando window.__ixSession", window.__ixSession);
    return window.__ixSession;
  }
  if (window.Session?.get) {
    try {
      const s = window.Session.get();
      if (s) {
        dbg.log("readIxSession(): usando window.Session.get()", s);
        return s;
      }
    } catch (e) {
      dbg.warn("readIxSession(): error en Session.get()", e);
    }
  }

  try {
    dbg.group("readIxSession(): cookie ix_emp");
    dbg.log("document.cookie =", document.cookie);

    const pair = document.cookie.split("; ").find(c => c.startsWith("ix_emp="));
    if (!pair) {
      dbg.warn("No se encontró cookie ix_emp");
      dbg.groupEnd();
      return null;
    }

    const rawEnc = pair.split("=")[1] || "";
    const rawDecUri = decodeURIComponent(rawEnc);
    dbg.log("rawEnc (encoded) =", rawEnc);
    dbg.log("rawDecUri (decodedURIComponent) =", rawDecUri);

    // Base64 → binario → texto (más robusto que escape/unescape)
    let jsonObj = null;
    try {
      const bin = atob(rawDecUri);
      const bytes = new Uint8Array([...bin].map(c => c.charCodeAt(0)));
      const text = new TextDecoder("utf-8").decode(bytes);
      dbg.log("cookie base64 → texto =", text);
      jsonObj = JSON.parse(text);
      dbg.log("cookie JSON parse =", jsonObj);
      dbg.groupEnd();
      return jsonObj;
    } catch (e2) {
      dbg.warn("Fallo TextDecoder/atob JSON. Intentando fallback escape/unescape", e2);
      try {
        const legacy = JSON.parse(decodeURIComponent(escape(atob(rawDecUri))));
        dbg.log("cookie JSON (fallback legacy) =", legacy);
        dbg.groupEnd();
        return legacy;
      } catch (e3) {
        dbg.error("readIxSession(): no se pudo decodificar la cookie ix_emp", e3);
        dbg.groupEnd();
        return null;
      }
    }
  } catch (err) {
    dbg.error("readIxSession(): error inesperado", err);
    return null;
  }
}

const __sess = readIxSession();
const SessIDs = {
  idUsuario: __sess?.id_usuario ?? __sess?.id ?? null,
  username: __sess?.username ?? null,
  depId: Number(__sess?.departamento_id ?? 1),
  nombre: __sess?.nombre ?? "",
  apellidos: __sess?.apellidos ?? "",
  roles: Array.isArray(__sess?.roles)
    ? __sess.roles.map(r => (typeof r === "string" ? r : r?.codigo)).filter(Boolean)
    : [],
};
dbg.group("SessIDs derivados de cookie");
dbg.log(SessIDs);
dbg.groupEnd();

// ------------------------------------------------------------
// DOM helpers
// ------------------------------------------------------------
const $one = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const bindOnce = (el, ev, fn, key = "") => {
  if (!el) return;
  const flag = `binded_${ev}${key ? `_${key}` : ""}`;
  if (el.dataset[flag] === "1") return;
  el.addEventListener(ev, fn);
  el.dataset[flag] = "1";
};

function debounce(fn, ms = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function setTextSafe(sel, txt) { const el = document.querySelector(sel); if (el) el.textContent = txt; }
function normalizeLabelToKey(label){
  if (!label) return null;
  const s = String(label).toLowerCase()
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

// ------------------------------------------------------------
// Resolver nombre de departamento
// ------------------------------------------------------------
const deptCache = new Map();
async function resolveDepartamentoNombre(depId) {
  if (!depId) return "Sin dependencia";
  if (deptCache.has(depId)) return deptCache.get(depId);
  for (const url of CFG.ENDPOINTS.departamentos) {
    try {
      const u = new URL(url, location.origin);
      u.searchParams.set("status", 1);
      dbg.log("resolveDepartamentoNombre(): fetch", u.toString());
      const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
      const json = await res.json().catch(() => null);
      const arr = json?.data ?? json?.rows ?? [];
      const found = arr.find(d => Number(d.id) === Number(depId));
      if (found?.nombre) { deptCache.set(depId, found.nombre); dbg.log("depId", depId, "→", found.nombre); return found.nombre; }
    } catch (e) { dbg.warn("resolveDepartamentoNombre error", e); }
  }
  const fallback = `Departamento ${depId}`;
  deptCache.set(depId, fallback);
  dbg.warn("resolveDepartamentoNombre(): fallback", fallback);
  return fallback;
}

// ------------------------------------------------------------
// API Empleado (con logs)
// ------------------------------------------------------------
async function empleadoById(idEmpleado) {
  if (!idEmpleado) return null;
  try {
    dbg.log("empleadoById(): POST", CFG.ENDPOINTS.empleado, { id: Number(idEmpleado) });
    const res = await fetch(CFG.ENDPOINTS.empleado, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ id: Number(idEmpleado) })
    });
    const json = await res.json().catch(() => null);
    dbg.log("empleadoById(): respuesta", json);
    return (json && json.ok) ? (json.data || null) : null;
  } catch (e) { dbg.warn("empleadoById error", e); return null; }
}
async function empleadoByUsername(username) {
  if (!username) return null;
  try {
    dbg.log("empleadoByUsername(): POST", CFG.ENDPOINTS.empleado, { q: String(username) });
    const res = await fetch(CFG.ENDPOINTS.empleado, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ q: String(username), page: 1, page_size: 5 })
    });
    const json = await res.json().catch(() => null);
    dbg.log("empleadoByUsername(): respuesta", json);
    if (!(json && json.ok)) return null;
    const arr = json.data || [];
    if (!Array.isArray(arr) || !arr.length) return null;
    return arr.find(e => (e.cuenta?.username||"") === username) || arr[0] || null;
  } catch (e) { dbg.warn("empleadoByUsername error", e); return null; }
}

// ------------------------------------------------------------
// Store
// ------------------------------------------------------------
const S = createStore({
  user: {
    idEmpleado: null,
    idCuenta: SessIDs.idUsuario ?? null,
    username: SessIDs.username ?? "",
    nombre: `${SessIDs.nombre ?? ""}${SessIDs.apellidos ? " " + SessIDs.apellidos : ""}`.trim(),
    dep: SessIDs.depId,
    roles: SessIDs.roles,
  },
  filtros: {
    status: "todos",
    search: "",
    depto: null,
  },
  requerimientos: [],
  counts: { todos: 0, solicitud: 0, revision: 0, asignacion: 0, enProceso: 0, pausado: 0, cancelado: 0, finalizado: 0 },
  pageSize: CFG.TABLE.pageSize,
});
DEBUG && (window.__dbgStore = S);

// ------------------------------------------------------------
// Pre-hydrate
// ------------------------------------------------------------
(function preHydrateSidebar() {
  if (!CFG.FEATURES.preHydrateFromCookie) return;
  const fullName = S.get().user.nombre || "";
  dbg.log("preHydrateSidebar(): nombre desde cookie =", fullName);
  if (fullName) setTextSafe(CFG.SELECTORS.profileName, fullName);

  const avatarEl = $one(CFG.SELECTORS.avatar);
  if (avatarEl) {
    const idForAvatar = S.get().user.idEmpleado || S.get().user.idCuenta;
    const fallback = "/ASSETS/user/img_user1.png";
    const candidate = idForAvatar ? `/ASSETS/user/img_user${idForAvatar}.png` : fallback;
    dbg.log("preHydrateSidebar(): avatar candidato =", candidate, "fallback =", fallback);
    avatarEl.alt = fullName || "Avatar";
    avatarEl.src = candidate;
    avatarEl.onerror = () => (avatarEl.src = fallback);
  }
  const linkPerfil = $one(CFG.SELECTORS.profileLink);
  if (linkPerfil && !linkPerfil.getAttribute("href")) {
    linkPerfil.setAttribute("href", "/VIEWS/perfil.php");
    dbg.log("preHydrateSidebar(): set profile link → /VIEWS/perfil.php");
  }
})();

// ------------------------------------------------------------
// Bootstrap empleado (API-first)
// ------------------------------------------------------------
async function bootstrapEmployee() {
  dbg.group("bootstrapEmployee()");
  let emp = null;

  if (SessIDs.idUsuario) {
    dbg.log("Intento 1: por idUsuario =", SessIDs.idUsuario);
    emp = await empleadoById(SessIDs.idUsuario);
  }

  if (!emp && SessIDs.username) {
    dbg.log("Intento 2: por username =", SessIDs.username);
    emp = await empleadoByUsername(SessIDs.username);
  }

  if (!emp && S.get().user.nombre) {
    dbg.log("Intento 3: por nombre completo =", S.get().user.nombre);
    emp = await empleadoByUsername(S.get().user.nombre);
  }

  if (!emp) {
    dbg.warn("bootstrapEmployee(): no se encontró empleado");
    dbg.groupEnd();
    return null;
  }

  const full = `${emp.nombre ?? ""}${emp.apellidos ? " " + emp.apellidos : ""}`.trim() || "—";
  const roles = Array.isArray(emp.cuenta?.roles) ? emp.cuenta.roles.map(r => r.codigo).filter(Boolean) : [];
  dbg.log("Empleado resuelto =", { id: emp.id, username: emp.cuenta?.username, dep: emp.departamento_id, roles });

  S.set({
    user: {
      ...S.get().user,
      idEmpleado: emp.id,
      idCuenta: emp.cuenta?.id ?? S.get().user.idCuenta ?? null,
      username: emp.cuenta?.username || S.get().user.username,
      nombre: full,
      dep: Number(emp.departamento_id ?? S.get().user.dep),
      roles,
    }
  });

  setTextSafe(CFG.SELECTORS.profileName, full);

  const depEl = $one(CFG.SELECTORS.profileBadge);
  if (depEl) {
    const depName = await resolveDepartamentoNombre(S.get().user.dep);
    depEl.textContent = depName || "Sin dependencia";
    dbg.log("Badge dep =", depName);
  }

  window.__ixEmployee = emp;
  dbg.groupEnd();
  return emp;
}

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  DEBUG && console.time(`${TAG} init`);
  Drawer.init(".ix-drawer");
  init().finally(() => { DEBUG && console.timeEnd(`${TAG} init`); });
});

async function init() {
  dbg.info("init(): empleado desde API…");
  await bootstrapEmployee();

  // Chip depto
  const depEl = $one(CFG.SELECTORS.profileBadge);
  if (depEl && CFG.FEATURES.deptChipToggleEnabled) {
    depEl.setAttribute("role", "button");
    depEl.setAttribute("aria-pressed", "false");
    depEl.classList.remove("active");
    depEl.dataset.departamento = String(S.get().user.dep);
    bindOnce(depEl, "click", () => {
      const active = S.get().filtros.depto != null;
      const next = active ? null : S.get().user.dep;
      dbg.log("Dept chip click: active?", active, "→ next depto =", next);
      S.set({ filtros: { ...S.get().filtros, depto: next } });
      depEl.classList.toggle("active", !!next);
      depEl.setAttribute("aria-pressed", String(!!next));
      applyPipelineAndRender();
    });
  }

  // Skeleton
  mountSkeletonList($(CFG.SELECTORS.tableSkeleton), 7);

  // Charts
  const lc = LineChart($(CFG.SELECTORS.chartYear));   lc.mount({ data: [] });
  const dc = DonutChart($(CFG.SELECTORS.chartMonth)); dc.mount({ data: [] });
  window.__ixCharts = { lc, dc };
  dbg.log("Charts montados:", window.__ixCharts);

  // Tabla
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
  dbg.log("Tabla creada:", table);

  await loadRequerimientos();

  initStatusDom();
  makeStatusRadiogroup();

  applyPipelineAndRender(table);

  document.documentElement.classList.add("is-loaded");

  wireSidebarEvents(table);
  wireSearch();
  wireRowClick(table);

  const allBtn = document.querySelector(`${CFG.SELECTORS.statusItems}[data-status="todos"]`);
  if (allBtn) {
    $$(CFG.SELECTORS.statusItems).forEach(b => b.classList.remove("active"));
    allBtn.classList.add("active");
    allBtn.setAttribute("aria-checked", "true");
    dbg.log("Marcado inicial: TODOS");
  }
}

// ------------------------------------------------------------
// Data load (requerimientos)
// ------------------------------------------------------------
async function loadRequerimientos() {
  toggle($(CFG.SELECTORS.tableWrap), false);
  toggle($(CFG.SELECTORS.tableSkeleton), true);
  toggle($(CFG.SELECTORS.tableEmpty), false);

  try {
    dbg.group("fetchRequerimientos");
    const { ok, rows, data, count } = await fetchRequerimientos({ page: 1, per_page: CFG.TABLE.reqFetchPerPage });
    dbg.log("Respuesta:", { ok, count, rowsLen: rows?.length, dataLen: data?.length });
    if (!ok) throw new Error("Respuesta no OK");

    const list = Array.isArray(rows) ? rows : (Array.isArray(data) ? data : []);
    S.set({ requerimientos: list });
    dbg.log("Total requerimientos en store:", list.length);

    window.__ixCharts?.lc?.update({ data: computeSeriesAnual(list) });
    window.__ixCharts?.dc?.update({ data: computeDonutMes(list) });

    setTextSafe(CFG.SELECTORS.tableTotal, String(count ?? list.length));
    setTextSafe(CFG.SELECTORS.tableStatusLabel, "Todos los status");
    dbg.groupEnd();
  } catch (err) {
    dbg.error("loadRequerimientos() error:", err);
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

// ------------------------------------------------------------
// Sidebar (status DOM + ARIA)
// ------------------------------------------------------------
function initStatusDom(){
  $$(CFG.SELECTORS.statusItems).forEach(btn => {
    if (!btn.dataset.status){
      const label = btn.querySelector('.label')?.textContent?.trim();
      const key = normalizeLabelToKey(label);
      if (key) btn.dataset.status = key;
      dbg.log("initStatusDom(): mapeado", label, "→", key);
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

// ------------------------------------------------------------
// Wiring (sidebar clicks, búsqueda, click fila)
// ------------------------------------------------------------
function wireSidebarEvents(table) {
  $$(CFG.SELECTORS.statusItems).forEach(btn => {
    bindOnce(btn, "click", () => {
      $$(CFG.SELECTORS.statusItems).forEach(b => { b.classList.remove("active"); b.setAttribute("aria-checked", "false"); });
      btn.classList.add("active");
      btn.setAttribute("aria-checked", "true");

      const statusKey = btn.dataset.status || normalizeLabelToKey(btn.querySelector(".label")?.textContent) || "todos";
      dbg.log("Filtro status →", statusKey);
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
    dbg.log("Búsqueda =", q);
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
    dbg.log("Row click idx =", idx, "raw =", raw);
    if (!raw) return;

    Drawer.open(raw, {
      getSessionUserId: () => (window.__ixSession?.id_usuario ?? SessIDs.idUsuario ?? 1),
      onUpdated: (updated) => {
        try {
          const arr = S.get().requerimientos.slice();
          const i = arr.findIndex(r => r.id === updated.id);
          if (i >= 0) arr[i] = updated;
          S.set({ requerimientos: arr });
          dbg.log("Drawer onUpdated(): updated id =", updated?.id);
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

// ------------------------------------------------------------
// Pipeline: depto + búsqueda -> conteos -> estatus -> tabla
// ------------------------------------------------------------
function applyPipelineAndRender(tableInstance) {
  const t = tableInstance || window.__tableInstance;
  const { status, search, depto } = S.get().filtros;
  const base = S.get().requerimientos || [];

  const deptFilterId = depto;
  let filtered = base;
  if (deptFilterId != null) {
    filtered = filtered.filter(r => Number(r.departamento_id ?? r.departamento) === Number(deptFilterId));
  }

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

  computeCounts(filtered);
  renderCounts();

  let forTable = filtered;
  if (status !== "todos") {
    forTable = filtered.filter(r => ESTATUS[Number(r.estatus)]?.clave === status);
  }

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

  setTextSafe(CFG.SELECTORS.tableStatusLabel, humanStatusLabel(status));

  dbg.log("Pipeline:", {
    filtros: { status, search, depto },
    baseLen: base.length,
    filteredLen: filtered.length,
    tableRows: rows.length
  });
}

// ------------------------------------------------------------
// Conteos
// ------------------------------------------------------------
function computeCounts(rows = []) {
  const counts = { todos: rows.length, solicitud: 0, revision: 0, asignacion: 0, enProceso: 0, pausado: 0, cancelado: 0, finalizado: 0 };
  rows.forEach(r => { const k = ESTATUS[Number(r.estatus)]?.clave; if (k && Object.prototype.hasOwnProperty.call(counts, k)) counts[k]++; });
  S.set({ counts });
  dbg.log("Counts:", counts);
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

// ------------------------------------------------------------
// Charts helpers
// ------------------------------------------------------------
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

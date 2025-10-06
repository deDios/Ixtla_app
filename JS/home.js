// /JS/views/home.js

import { $, mountSkeletonList, toggle, escapeHtml } from "/JS/core/dom.js";
import { createStore } from "/JS/core/store.js";
import { LineChart } from "/JS/charts/line-chart.js";
import { DonutChart } from "/JS/charts/donut-chart.js";
import { fetchRequerimientos } from "/JS/api/requerimientos.js";
import { createTable } from "/JS/ui/table.js";
import { Drawer } from "/JS/ui/drawer.js";

const TAG = "[Home]";

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

// rescatar la cookie
const __sess = (window.__ixSession) || (window.Session?.get?.() ?? null);

// Derivar IDs y roles
function getUserFromSession(sess) {
  if (!sess) return {
    idUsuario: null,
    nombre: "",
    apellidos: "",
    departamento_id: 1,
    roles: [],
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
    // por si luego se usa (NO ESTA EN LA COOKIE LUEGO AGREGARLOS)
    departamento_nombre: sess.departamento_nombre ?? sess.dependencia ?? sess.departamento_nombre ?? null,
  };
}
const UserFromSess = getUserFromSession(__sess);
const isAdmin = UserFromSess.roles.includes("ADMIN");

// Helpers DOM
const $one = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const bindOnce = (el, ev, fn) => {
  if (!el || el.dataset.binded === "1") return;
  el.addEventListener(ev, fn);
  el.dataset.binded = "1";
};
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
function humanStatusLabel(key) { return ESTATUS_BY_CLAVE(key)?.nombre ?? (key === "todos" ? "Todos los status" : key); }

function setCount(key, val) {
  const byId = document.querySelector(`#cnt-${key}`);
  if (byId) { byId.textContent = `(${val})`; return; }
  const byDs = document.querySelector(`.status-nav [data-status="${key}"] .count`);
  if (byDs) byDs.textContent = `(${val})`;
}

/* nombre de departamento */
const deptCache = new Map();
async function resolveDepartamentoNombre(depId) {
  if (!depId) return "Sin dependencia";
  if (deptCache.has(depId)) return deptCache.get(depId);

  if (UserFromSess.departamento_nombre) {
    deptCache.set(depId, UserFromSess.departamento_nombre);
    return UserFromSess.departamento_nombre;
  }

  const endpoints = [
    "/db/WEB/ixtla01_c_departamento.php",
    "/db/WEB/c_departamento.php",
  ];

  for (const url of endpoints) {
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

/* Store */
const S = createStore({
  user: {
    id: UserFromSess.idUsuario,
    nombre: (UserFromSess.nombre || "") + (UserFromSess.apellidos ? " " + UserFromSess.apellidos : ""),
    dep: UserFromSess.departamento_id,
    roles: UserFromSess.roles,
  },
  filtros: {
    status: "todos",   // 'todos' | claves de ESTATUS
    search: "",
    depto: null,       // id de departamento si chip activo (admin) o forzado (no admin)
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
  pageSize: 7,
});

/* Sidebar */
(function preHydrateSidebar() {
  const fullName = S.get().user.nombre || "—";
  if (!$one("#h-user-nombre")){
    const link = $one(".profile-link");
    const dash = $one(".profile-dash");
    const h = document.createElement("h3");
    h.id = "h-user-nombre";
    h.className = "profile-name";
    h.textContent = fullName;
    if (link && dash) link.insertAdjacentElement("afterend", h);
    else $one(".profile-card")?.appendChild(h);
  } else {
    setTextSafe("#h-user-nombre", fullName);
  }

  // Avatar alt + fallback
  const avatarEl = $one(".profile-card .avatar");
  if (avatarEl) {
    const fallback = "/ASSETS/user/img_user1.png";
    const candidate = S.get().user.id ? `/ASSETS/user/img_user${S.get().user.id}.png` : fallback;
    avatarEl.alt = fullName || "Avatar";
    avatarEl.src = candidate;
    avatarEl.onerror = () => (avatarEl.src = fallback);
  }

  // Link perfil (si falta href)
  const linkPerfil = $one(".profile-link");
  if (linkPerfil && !linkPerfil.getAttribute("href")) {
    linkPerfil.setAttribute("href", "/VIEWS/perfil.php");
  }
})();

/* ============================================================
 *  Inicialización
 * ========================================================== */
window.addEventListener("DOMContentLoaded", () => {
  Drawer.init(".ix-drawer");
  init();
});

async function init() {
  console.log(`${TAG} init (dep: ${S.get().user.dep}, roles: ${S.get().user.roles?.join(",") || "-"})`);

  // --- Badge de departamento (nombre real)
  const depEl = $one(".profile-dep.badge");
  if (depEl) {
    const depName = await resolveDepartamentoNombre(S.get().user.dep);
    depEl.textContent = depName || "Sin dependencia";
    // Chip: admin => toggle; no-admin => fijo
    if (isAdmin) {
      depEl.setAttribute("role", "button");
      depEl.setAttribute("aria-pressed", "false");
      depEl.dataset.departamento = String(S.get().user.dep);
      bindOnce(depEl, "click", () => {
        const active = S.get().filtros.depto != null;
        const next = active ? null : S.get().user.dep;
        S.set({ filtros: { ...S.get().filtros, depto: next } });
        depEl.classList.toggle("active", !!next);
        depEl.setAttribute("aria-pressed", String(!!next));
        applyPipelineAndRender(); // actualiza conteos + tabla
      });
    } else {
      // No admin: forzado al depto del usuario
      S.set({ filtros: { ...S.get().filtros, depto: S.get().user.dep } });
      depEl.setAttribute("aria-pressed", "true");
      depEl.classList.add("active");
    }
  }

  // Skeleton tabla
  mountSkeletonList($("#tbl-skeleton"), 7);

  // Charts
  const lc = LineChart($("#chart-year"));   lc.mount({ data: [] });
  const dc = DonutChart($("#chart-month")); dc.mount({ data: [] });
  window.__ixCharts = { lc, dc };

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

  // Cargar datos
  await loadRequerimientos();

  // Sidebar: preparar data-status si faltan, y ARIA del radiogroup
  initStatusDom();
  makeStatusRadiogroup();

  // Pintar UI
  applyPipelineAndRender(table);

  // Ocultar skeletons
  document.documentElement.classList.add("is-loaded");

  // Eventos
  wireSidebarEvents(table);
  wireSearch();
  wireRowClick(table);

  // Marcar "todos" activo
  const allBtn = document.querySelector(`.status-item[data-status="todos"]`);
  if (allBtn) {
    $$(".status-item").forEach(b => b.classList.remove("active"));
    allBtn.classList.add("active");
    allBtn.setAttribute("aria-checked", "true");
  }
}

/* ============================================================
 *  Data load
 * ========================================================== */
async function loadRequerimientos() {
  toggle($("#tbl-wrap"), false);
  toggle($("#tbl-skeleton"), true);
  toggle($("#tbl-empty"), false);

  try {
    const { ok, rows, data, count } = await fetchRequerimientos({
      page: 1,
      per_page: 200, // margen para cliente
    });

    if (!ok) throw new Error("Respuesta no OK");
    const list = Array.isArray(rows) ? rows : (Array.isArray(data) ? data : []);
    S.set({ requerimientos: list });

    // Charts con el universo completo
    window.__ixCharts?.lc?.update({ data: computeSeriesAnual(list) });
    window.__ixCharts?.dc?.update({ data: computeDonutMes(list) });

    // Leyenda total inicial (se actualizará tras pipeline)
    setTextSafe("#tbl-total", String(count ?? list.length));
    setTextSafe("#tbl-status-label", "Todos los status");

  } catch (err) {
    console.error(TAG, "loadRequerimientos()", err);
    if (typeof gcToast === "function") gcToast("Hubo un error, inténtalo más tarde.", "warning");
    S.set({
      requerimientos: [],
      counts: { todos: 0, solicitud: 0, revision: 0, asignacion: 0, enProceso: 0, pausado: 0, cancelado: 0, finalizado: 0 }
    });
  } finally {
    toggle($("#tbl-skeleton"), false);
    toggle($("#tbl-wrap"), true);
  }
}

/* ============================================================
 *  Sidebar helpers (estatus)
 * ========================================================== */
function initStatusDom(){
  // Asignar data-status a partir del texto visible si aún no existe
  $$(".status-nav .status-item").forEach(btn => {
    if (!btn.dataset.status){
      const label = btn.querySelector('.label')?.textContent?.trim();
      const key = normalizeLabelToKey(label);
      if (key) btn.dataset.status = key;
    }
  });
}
function makeStatusRadiogroup() {
  const nav = $one(".status-block");
  if (nav) nav.setAttribute("role", "radiogroup");
  $$(".status-nav .status-item").forEach((btn, idx) => {
    btn.setAttribute("role", "radio");
    btn.setAttribute("tabindex", idx === 0 ? "0" : "-1");
    btn.setAttribute("aria-checked", btn.classList.contains("active") ? "true" : "false");
  });

  // Navegación por teclado
  bindOnce($one(".status-nav"), "keydown", (e) => {
    const items = $$(".status-nav .status-item");
    if (!items.length) return;
    const current = document.activeElement.closest(".status-item");
    const idx = Math.max(0, items.indexOf(current));
    let nextIdx = idx;

    if (e.key === "ArrowDown" || e.key === "ArrowRight") nextIdx = (idx + 1) % items.length;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") nextIdx = (idx - 1 + items.length) % items.length;

    if (nextIdx !== idx) {
      items[nextIdx].focus();
      e.preventDefault();
    }
    if (e.key === " " || e.key === "Enter") {
      items[nextIdx].click();
      e.preventDefault();
    }
  });
}

/* ============================================================
 *  Eventos (sidebar, búsqueda, filas)
 * ========================================================== */
function wireSidebarEvents(table) {
  // Click en chips de estatus
  $$(".status-item").forEach(btn => {
    bindOnce(btn, "click", () => {
      $$(".status-item").forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-checked", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-checked", "true");

      const statusKey = btn.dataset.status || normalizeLabelToKey(btn.querySelector(".label")?.textContent) || "todos";
      S.set({ filtros: { ...S.get().filtros, status: statusKey } });

      setTextSafe("#tbl-status-label", humanStatusLabel(statusKey));
      applyPipelineAndRender(table);
      $("#tbl-search")?.focus();
    });
  });
}

function wireSearch() {
  $("#tbl-search")?.addEventListener("input", debounce((e) => {
    const q = (e.target.value || "").trim().toLowerCase();
    S.set({ filtros: { ...S.get().filtros, search: q } });
    applyPipelineAndRender();
  }, 250));
}

function wireRowClick(table) {
  const tbody = document.querySelector("#tbl-body");
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
        } catch (err) {
          console.error("[Home] onUpdated error:", err);
        }
      },
      onError: (err) => {
        console.error("[Drawer] error:", err);
        if (typeof gcToast === "function") gcToast("Ocurrió un error. Inténtalo más tarde.", "warning");
      }
    });
  });
}

/* ============================================================
 *  Pipeline: depto + búsqueda -> conteos -> status -> tabla
 * ========================================================== */
function applyPipelineAndRender(tableInstance) {
  const t = tableInstance || window.__tableInstance;
  const { status, search, depto } = S.get().filtros;
  const base = S.get().requerimientos || [];

  // 1) Filtro por departamento (no admin = forzado)
  const deptFilterId = (!isAdmin ? S.get().user.dep : depto);
  let filtered = base;
  if (deptFilterId != null) {
    filtered = filtered.filter(r => Number(r.departamento_id ?? r.departamento) === Number(deptFilterId));
  }

  // 2) Búsqueda
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

  // 3) Conteos sobre el universo filtrado (pre-estatus)
  computeCounts(filtered);
  renderCounts();

  // 4) Filtrar por estatus seleccionado
  let forTable = filtered;
  if (status !== "todos") {
    forTable = filtered.filter(r => ESTATUS[Number(r.estatus)]?.clave === status);
  }

  // 5) Mapear filas a la tabla
  const rows = forTable.map(r => {
    const est = ESTATUS[Number(r.estatus)];
    return {
      __raw: r,
      folio:        r.folio || "—",
      contacto:     r.contacto_nombre || "—",
      telefono:     r.contacto_telefono || "—",
      departamento: r.departamento_nombre || "—",
      status:       est?.nombre || String(r.estatus ?? "—"),
      statusKey:    est?.clave  || ""
    };
  });

  // 6) Render tabla
  const table = t || createTable({ pageSize: S.get().pageSize, columns: [] });
  window.__tableInstance = table;

  if (!rows.length) {
    table.setData([]);
    toggle($("#tbl-empty"), true);
    setTextSafe("#tbl-total", "0");
  } else {
    table.setData(rows);
    toggle($("#tbl-empty"), false);
    setTextSafe("#tbl-total", String(rows.length));
  }

  // 7) Leyenda status legible
  setTextSafe("#tbl-status-label", humanStatusLabel(status));
}

/* ============================================================
 *  Conteos
 * ========================================================== */
function computeCounts(rows = []) {
  const counts = {
    todos: rows.length,
    solicitud: 0,
    revision: 0,
    asignacion: 0,
    enProceso: 0,
    pausado: 0,
    cancelado: 0,
    finalizado: 0
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

/* ============================================================
 *  Charts helpers
 * ========================================================== */
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

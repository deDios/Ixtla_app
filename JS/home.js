// /JS/views/home.js — Ixtla Home (sidebar + table)

import { $, mountSkeletonList, toggle, escapeHtml } from "/JS/core/dom.js";
import { createStore } from "/JS/core/store.js";
import { LineChart } from "/JS/charts/line-chart.js";
import { DonutChart } from "/JS/charts/donut-chart.js";
import { fetchRequerimientos } from "/JS/api/requerimientos.js";
import { createTable } from "/JS/ui/table.js";
import { Drawer } from "/JS/ui/drawer.js";

const TAG = "[Home]";

/**  Estatus (num -> clave/nombre)  */
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

/**  Sesion / Departamento activo  */
const sess  = window.__ixSession || null;
const userId = sess?.id_usuario ?? sess?.id ?? null;
const departamentoActivo = Number(sess?.departamento_id ?? 1);

/**  Store  */
const S = createStore({
  user: {
    nombre: (sess?.nombre || "") + (sess?.apellidos ? " " + sess.apellidos : ""),
    dep: departamentoActivo,
  },
  filtros: { status: "todos", search: "" },
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

/**  Utils  */
const $one = (sel, root=document) => root.querySelector(sel);
function debounce(fn, ms = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function setTextSafe(sel, txt) { const el = document.querySelector(sel); if (el) el.textContent = txt; }
function setCount(key, val) {
  // 1) ids tipo #cnt-<key>
  const byId = document.querySelector(`#cnt-${key}`);
  if (byId) { byId.textContent = `(${val})`; return; }
  // 2) fallback: por data-status dentro del sidebar
  const byDs = document.querySelector(`.status-nav [data-status="${key}"] .count`);
  if (byDs) byDs.textContent = `(${val})`;
}
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
function initStatusDom(){
  document.querySelectorAll('.status-nav .status-item').forEach(btn => {
    if (!btn.dataset.status){
      const label = btn.querySelector('.label')?.textContent?.trim();
      const key = normalizeLabelToKey(label);
      if (key) btn.dataset.status = key;
    }
  });
}

/**  Dependencias (resolver nombre por id)  */
const deptCache = new Map();
async function resolveDepartamentoNombre(depId) {
  if (!depId) return "Sin dependencia";
  if (deptCache.has(depId)) return deptCache.get(depId);

  // Si la sesión ya trae el nombre, úsalo
  const direct = sess?.dependencia || sess?.departamento_nombre;
  if (direct) { deptCache.set(depId, direct); return direct; }

  // Fallback: intentar endpoints conocidos (con la convención de tu backend)
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
      const arr = json?.data || json?.rows || [];
      const found = arr.find(d => Number(d.id) === Number(depId));
      if (found?.nombre) { deptCache.set(depId, found.nombre); return found.nombre; }
    } catch (_) {}
  }
  const fallback = `Departamento ${depId}`;
  deptCache.set(depId, fallback);
  return fallback;
}

/**  Init  */
window.addEventListener("DOMContentLoaded", () => {
  Drawer.init(".ix-drawer");
  init();
});

async function init() {
  console.log(`${TAG} init (dep: ${S.get().user.dep})`);

  // --- Sidebar: avatar / nombre / departamento ---
  // Nombre (inserta el nodo si no existe en tu HTML)
  if (!$one("#h-user-nombre")){
    const link = $one(".profile-link");
    const dash = $one(".profile-dash");
    const h = document.createElement("h3");
    h.id = "h-user-nombre";
    h.className = "profile-name";
    h.textContent = S.get().user.nombre || "—";
    if (link && dash) link.insertAdjacentElement("afterend", h);
    else $one(".profile-card")?.appendChild(h);
  } else {
    setTextSafe("#h-user-nombre", S.get().user.nombre || "—");
  }

  // Avatar
  const avatarEl = $one(".profile-card .avatar");
  if (avatarEl) {
    const fallback = "/ASSETS/user/img_user1.png";
    const candidate = userId ? `/ASSETS/user/img_user${userId}.png` : fallback;
    avatarEl.alt = S.get().user.nombre || "Avatar";
    avatarEl.src = candidate;
    avatarEl.onerror = () => (avatarEl.src = fallback);
  }

  // Link perfil
  const linkPerfil = $one(".profile-link");
  if (linkPerfil && !linkPerfil.getAttribute("href")) {
    linkPerfil.setAttribute("href", "/VIEWS/perfil.php");
  }

  // Dependencia (chip)
  const depEl = $one("#h-user-dep") || $one(".profile-dep.badge");
  if (depEl) {
    try {
      const depName = await resolveDepartamentoNombre(S.get().user.dep);
      depEl.textContent = depName || "Sin dependencia";
    } catch {
      depEl.textContent = String(S.get().user.dep);
    }
  }

  // Skeleton tabla
  mountSkeletonList($("#tbl-skeleton"), 7);

  // Charts
  const lc = LineChart($("#chart-year"));  lc.mount({ data: [] });
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

  // Pintar UI
  renderCounts();
  applyAndRenderTable(table);

  // Oculta skeletons una vez que ya pintamos
  document.documentElement.classList.add("is-loaded");

  // Inicializa data-status en DOM según etiquetas (porque tu HTML aún no las trae)
  initStatusDom();

  /** Filtros sidebar (clic en chips) */
  document.querySelectorAll(".status-item").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".status-item").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const statusKey = btn.dataset.status || normalizeLabelToKey(btn.querySelector(".label")?.textContent) || "todos";
      S.set({ filtros: { ...S.get().filtros, status: statusKey } });
      setTextSafe("#tbl-status-label", statusKey === "todos" ? "Todos los status" : statusKey);
      applyAndRenderTable(table);
    });
  });

  /** Búsqueda (cliente) */
  $("#tbl-search")?.addEventListener("input", debounce((e) => {
    const q = (e.target.value || "").trim().toLowerCase();
    S.set({ filtros: { ...S.get().filtros, search: q } });
    applyAndRenderTable(table);
  }, 250));

  /** Click en filas → abrir drawer */
  const tbody = document.querySelector("#tbl-body");
  if (tbody) {
    tbody.addEventListener("click", (e) => {
      const tr = e.target.closest("tr");
      if (!tr || !tbody.contains(tr)) return;
      const idx = Number(tr.dataset.rowIdx);
      const raw = table.getRawRows?.()?.[idx];   // devuelve los __raw de la página actual
      if (!raw) return;

      Drawer.open(raw, {
        getSessionUserId: () => (window.__ixSession?.id_usuario ?? 1),
        onUpdated: (updated) => {
          try {
            const arr = S.get().requerimientos.slice();
            const i = arr.findIndex(r => r.id === updated.id);
            if (i >= 0) arr[i] = updated;
            S.set({ requerimientos: arr });
            applyAndRenderTable(table);
            renderCounts();
            if (typeof gcToast === "function") gcToast("Requerimiento actualizado.", "exito");
          } catch (e) {
            console.error("[Home] onUpdated error:", e);
          }
        },
        onError: (err) => {
          console.error("[Drawer] error:", err);
          if (typeof gcToast === "function") gcToast("Ocurrió un error. Inténtalo más tarde.", "warning");
        }
      });
    });
  }

  // Marcar activo inicial ("todos")
  const activeBtn = document.querySelector(`.status-item[data-status="todos"]`);
  if (activeBtn) {
    document.querySelectorAll(".status-item").forEach(b => b.classList.remove("active"));
    activeBtn.classList.add("active");
  }
}

/** = Data load = */
async function loadRequerimientos() {
  toggle($("#tbl-wrap"), false);
  toggle($("#tbl-skeleton"), true);
  toggle($("#tbl-empty"), false);

  try {
    const { ok, rows, data, count } = await fetchRequerimientos({
      //departamento_id: S.get().user.dep,
      page: 1,
      per_page: 50
    });

    if (!ok) throw new Error("Respuesta no OK");
    const list = Array.isArray(rows) ? rows : (Array.isArray(data) ? data : []);
    S.set({ requerimientos: list });

    // Totales por estatus
    computeCounts(list);

    // Leyenda
    setTextSafe("#tbl-total", String(count ?? list.length));
    setTextSafe("#tbl-status-label", "Todos los status");

    // Charts
    const seriesAnual = computeSeriesAnual(list);
    window.__ixCharts?.lc?.update({ data: seriesAnual });

    const donutMes = computeDonutMes(list);
    window.__ixCharts?.dc?.update({ data: donutMes });

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

/** = Conteos = */
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

/** = Tabla: filtros + render = */
function applyAndRenderTable(table) {
  const { status, search } = S.get().filtros;
  const base = S.get().requerimientos;

  let filtered = base;

  if (status !== "todos") {
    filtered = filtered.filter(r => ESTATUS[Number(r.estatus)]?.clave === status);
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

  const rows = filtered.map(r => {
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

  if (!rows.length) {
    table.setData([]);
    toggle($("#tbl-empty"), true);
    setTextSafe("#tbl-total", "0");
  } else {
    table.setData(rows);
    toggle($("#tbl-empty"), false);
    setTextSafe("#tbl-total", String(rows.length));
  }

  renderCounts();
}

/** = Charts helpers = */
function computeSeriesAnual(rows = []) {
  const now = new Date();
  const year = now.getFullYear();
  const counts = new Array(12).fill(0);
  rows.forEach(r => {
    const d = new Date(String(r.created_at).replace(" ", "T"));
    if (!isNaN(d) && d.getFullYear() === year) counts[d.getMonth()] += 1; // 0..11
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
function ESTATUS_BY_CLAVE(clave) {
  const id = Object.keys(ESTATUS).find(k => ESTATUS[k].clave === clave);
  return id ? ESTATUS[id] : null;
}

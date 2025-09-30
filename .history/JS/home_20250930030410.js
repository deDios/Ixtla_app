// /JS/views/home.js
import { $, mountSkeletonList, toggle, escapeHtml } from "/JS/core/dom.js";
import { createStore } from "/JS/core/store.js";
import { LineChart } from "/JS/charts/line-chart.js";
import { DonutChart } from "/JS/charts/donut-chart.js";
import { fetchRequerimientos } from "/JS/api/requerimientos.js";
import { createTable } from "/JS/ui/table.js";
import { Drawer } from "/JS/ui/drawer.js";

const TAG = "[Home]";

/** ===== Estatus (num -> clave/nombre) ===== */
const ESTATUS = {
  0: { clave: "solicitud", nombre: "Solicitud" },
  1: { clave: "revision", nombre: "Revisión" },
  2: { clave: "asignacion", nombre: "Asignación" },
  3: { clave: "enProceso", nombre: "En proceso" },
  4: { clave: "pausado", nombre: "Pausado" },
  5: { clave: "cancelado", nombre: "Cancelado" },
  6: { clave: "finalizado", nombre: "Finalizado" }
};

const STATUS_COLORS = {
  solicitud: "#a5b4fc",
  revision: "#93c5fd",
  asignacion: "#6ee7b7",
  enProceso: "#60a5fa",
  pausado: "#fbbf24",
  cancelado: "#f87171",
  finalizado: "#34d399"
};

/** ===== Sesión / Departamento activo ===== */
const sess = window.__ixSession || null;
const departamentoActivo = Number(sess?.departamento_id ?? 1);

/** ===== Store ===== */
const S = createStore({
  user: {
    nombre: (sess?.nombre || "") + (sess?.apellidos ? " " + sess.apellidos : ""),
    dep: departamentoActivo
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
    finalizado: 0
  },
  pageSize: 7
});

/** ===== Utils ===== */
function debounce(fn, ms = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function setTextSafe(sel, txt) { const el = document.querySelector(sel); if (el) el.textContent = txt; }

/** ===== Init ===== */
window.addEventListener("DOMContentLoaded", () => {
  Drawer.init(".ix-drawer");
  init();
});

async function init() {
  console.log(`${TAG} init (dep: ${S.get().user.dep})`);

  // Perfil lateral (seguros)
  setTextSafe("#h-user-nombre", S.get().user.nombre || "—");
  setTextSafe("#h-user-dep", String(S.get().user.dep));

  // Skeleton tabla
  mountSkeletonList($("#tbl-skeleton"), 7);

  // Charts
  const lc = LineChart($("#chart-year")); lc.mount({ data: [] });
  const dc = DonutChart($("#chart-month")); dc.mount({ data: [] });
  window.__ixCharts = { lc, dc };

  // Tabla
  const table = createTable({
    pageSize: S.get().pageSize,
    columns: [
      { key: "folio", title: "Requerimiento", sortable: true, accessor: r => r.folio || "—" },
      { key: "contacto", title: "Contacto", sortable: true, accessor: r => r.contacto || "—" },
      { key: "telefono", title: "Teléfono", sortable: true, accessor: r => r.telefono || "—" },
      { key: "departamento", title: "Departamento", sortable: true, accessor: r => r.departamento || "—" },
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

  // Importante: oculta skeletons una vez que ya pintamos
  document.documentElement.classList.add("is-loaded");

  /** Filtros sidebar (clic en chips) */
  document.querySelectorAll(".status-item").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".status-item").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const statusKey = btn.dataset.status || "todos";
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
  // Sustituye todo tu bloque de "Delegación: abrir drawer al hacer click en una fila" por este:
const tbody = document.querySelector("#tbl-body");
if (tbody) {
  tbody.addEventListener("click", (e) => {
    const tr = e.target.closest("tr");
    if (!tr) return;

    // lee índice absoluto si viene en data-row-idx; si no, lo calculamos
    const idxAttr = tr.dataset.rowIdx;
    let idx = Number.isFinite(+idxAttr) ? +idxAttr : Array.from(tr.parentNode.children).indexOf(tr);

    // toma el arreglo RAW desde table.js (ver paso 2)
    const rawRows = typeof table.getRawRows === "function" ? table.getRawRows() : null;
    const raw = rawRows && rawRows[idx] ? rawRows[idx] : tr.__raw || tr._rowData || null;

    if (!raw) {
      console.warn("[Home] No se encontró el objeto de la fila para idx:", idx);
      return;
    }

    if (typeof Drawer?.open !== "function") {
      console.error("[Home] Drawer.open no está disponible");
      return;
    }

    Drawer.open(raw, {
      getSessionUserId: () => (window.__ixSession?.id_usuario ?? 1),
      onUpdated: (updated) => {
        const arr = S.get().requerimientos.slice();
        const i = arr.findIndex(r => r.id === updated.id);
        if (i >= 0) {
          arr[i] = updated;
          S.set({ requerimientos: arr });
          applyAndRenderTable(table);
          renderCounts();
        }
      }
    });
  });
}

}

/** ====== Data load ====== */
async function loadRequerimientos() {
  toggle($("#tbl-wrap"), false);
  toggle($("#tbl-skeleton"), true);
  toggle($("#tbl-empty"), false);

  try {
    const { ok, rows, count } = await fetchRequerimientos({
      departamento_id: S.get().user.dep,
      page: 1,
      per_page: 50
    });

    if (!ok) throw new Error("Respuesta no OK");
    S.set({ requerimientos: rows });

    // Totales por estatus
    computeCounts(rows);

    // Leyenda
    setTextSafe("#tbl-total", String(count ?? rows.length));
    setTextSafe("#tbl-status-label", "Todos los status");

    // Charts
    const seriesAnual = computeSeriesAnual(rows);
    window.__ixCharts?.lc?.update({ data: seriesAnual });

    const donutMes = computeDonutMes(rows);
    window.__ixCharts?.dc?.update({ data: donutMes });

  } catch (err) {
    console.error(TAG, "loadRequerimientos()", err);
    // aviso visual
    if (typeof gcToast === "function") gcToast("Hubo un error, inténtalo más tarde.", "warning");
    // estado vacío coherente
    S.set({
      requerimientos: [],
      counts: { todos: 0, solicitud: 0, revision: 0, asignacion: 0, enProceso: 0, pausado: 0, cancelado: 0, finalizado: 0 }
    });
  } finally {
    toggle($("#tbl-skeleton"), false);
    toggle($("#tbl-wrap"), true);
  }
}

/** ====== Conteos ====== */
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
  setTextSafe("#cnt-todos", `(${c.todos})`);
  setTextSafe("#cnt-solicitud", `(${c.solicitud})`);
  setTextSafe("#cnt-revision", `(${c.revision})`);
  setTextSafe("#cnt-asignacion", `(${c.asignacion})`);
  setTextSafe("#cnt-enProceso", `(${c.enProceso})`);
  setTextSafe("#cnt-pausado", `(${c.pausado})`);
  setTextSafe("#cnt-cancelado", `(${c.cancelado})`);
  setTextSafe("#cnt-finalizado", `(${c.finalizado})`);
}

/** ====== Tabla: filtros + render ====== */
function applyAndRenderTable(table) {
  const { status, search } = S.get().filtros;
  const base = S.get().requerimientos;

  let filtered = base;

  // Filtro por estatus 
  if (status !== "todos") {
    filtered = filtered.filter(r => ESTATUS[Number(r.estatus)]?.clave === status);
  }

  // Búsqueda (folio, contacto, teléfono, departamento, nombre de estatus)
  if (search) {
    filtered = filtered.filter(r => {
      const estNom = (ESTATUS[Number(r.estatus)]?.nombre || "").toLowerCase();
      const folio = (r.folio || "").toLowerCase();
      const nom = (r.contacto_nombre || "").toLowerCase();
      const tel = (r.contacto_telefono || "").toLowerCase();
      const dep = (r.departamento_nombre || "").toLowerCase();
      return (
        estNom.includes(search) ||
        folio.includes(search) ||
        nom.includes(search) ||
        tel.includes(search) ||
        dep.includes(search)
      );
    });
  }

  // Mapeo a filas
  const rows = filtered.map(r => {
    const est = ESTATUS[Number(r.estatus)];
    return {
      __raw: r, // conserva el objeto original
      folio: r.folio || "—",
      contacto: r.contacto_nombre || "—",
      telefono: r.contacto_telefono || "—",
      departamento: r.departamento_nombre || "—",
      status: est?.nombre || String(r.estatus ?? "—"),
      statusKey: est?.clave || ""
    };
  });

  if (!rows.length) {
    table.setData([]);
    toggle($("#tbl-empty"), true);
    setTextSafe("#tbl-total", "0");
  } else {
    table.setData(rows);
    toggle($("#tbl-empty"), false);
    setTextSafe("#tbl-total", String(rows.length)); // total filtrado
  }

  renderCounts(); // mantiene sidebar al día
}

/** ====== Charts helpers ====== */
function computeSeriesAnual(rows = []) {
  const now = new Date();
  const year = now.getFullYear();
  const counts = new Array(12).fill(0);
  rows.forEach(r => {
    const d = new Date(String(r.created_at).replace(" ", "T"));
    if (!isNaN(d) && d.getFullYear() === year) {
      counts[d.getMonth()] += 1; // 0..11
    }
  });
  return counts;
}

function computeDonutMes(rows = []) {
  const now = new Date();
  const y = now.getFullYear(), m0 = now.getMonth();
  const acc = {}; // clave -> count
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
    out.push({
      label: ESTATUS_BY_CLAVE(k)?.nombre || k,
      value: acc[k],
      color: STATUS_COLORS[k] || "#4f6b95"
    });
  }
  out.sort((a, b) => b.value - a.value);
  return out;
}

function ESTATUS_BY_CLAVE(clave) {
  const id = Object.keys(ESTATUS).find(k => ESTATUS[k].clave === clave);
  return id ? ESTATUS[id] : null;
}

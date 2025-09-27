// /JS/views/home.js
import { $, mountSkeletonList, toggle, fmtDateISOtoMX } from "../core/dom.js";
import { createStore } from "../core/store.js";
import { LineChart } from "../charts/line-chart.js";
import { DonutChart } from "../charts/donut-chart.js";
import { fetchRequerimientos } from "../api/requerimientos.js";
import { createTable } from "../ui/table.js";

const TAG = "[Home]";

// ===== Estatus (num -> clave/nombre) =====
const ESTATUS = {
  0: { clave: "solicitud", nombre: "Solicitud" },
  1: { clave: "revicion", nombre: "Revición" },
  2: { clave: "asignacion", nombre: "Asignación" },
  3: { clave: "enProceso", nombre: "En proceso" },
  4: { clave: "pausado", nombre: "Pausado" },
  5: { clave: "cancelado", nombre: "Cancelado" },
  6: { clave: "finalizado", nombre: "Finalizado" }
};

const sess = window.__ixSession || null;
const departamentoActivo = Number(sess?.departamento_id ?? 1);

// ===== Store =====
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
    revicion: 0,
    asignacion: 0,
    enProceso: 0,
    pausado: 0,
    cancelado: 0,
    finalizado: 0
  },
  pageSize: 7
});

// ===== Utils =====
function debounce(fn, ms = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

window.addEventListener("DOMContentLoaded", init);

const STATUS_COLORS = {
  solicitud:  "#a5b4fc",
  revicion:   "#93c5fd",
  asignacion: "#6ee7b7",
  enProceso:  "#60a5fa",
  pausado:    "#fbbf24",
  cancelado:  "#f87171",
  finalizado: "#34d399"
};

async function init() {
  console.log(`${TAG} init (dep: ${S.get().user.dep})`);

  // Perfil lateral
  $("#h-user-nombre").textContent = S.get().user.nombre || "—";
  $("#h-user-dep").textContent = String(S.get().user.dep);

  // Skeleton tabla
  mountSkeletonList($("#tbl-skeleton"), 7);

  const lc = LineChart($("#chart-year"));  lc.mount({ data: [] });
const dc = DonutChart($("#chart-month")); dc.mount({ data: [] });
// Guardarlos en cierre para updates:
window.__ixCharts = { lc, dc };

  // Tabla
  const table = createTable({
    pageSize: S.get().pageSize,
    columns: [
      { key: "tramite", title: "Trámites", sortable: true, accessor: r => (r.tramite || "").toLowerCase() },
      { key: "asignado", title: "Asignado", sortable: true, accessor: r => (r.asignado || "").toLowerCase() },
      { key: "fecha", title: "Fecha de solicitado", sortable: true },
      { key: "status", title: "Status", sortable: true, accessor: r => (r.status || "").toLowerCase() }
    ]
  });

  // Cargar datos
  await loadRequerimientos();

  // Pintar UI
  renderCounts();
  applyAndRenderTable(table);

  // Filtros sidebar
  document.querySelectorAll(".status-item").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".status-item").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const statusKey = btn.dataset.status || "todos";
      S.set({ filtros: { ...S.get().filtros, status: statusKey } });
      $("#tbl-status-label").textContent = statusKey === "todos" ? "Todos los status" : statusKey;
      applyAndRenderTable(table);
    });
  });

  // Busqueda (cliente)
  $("#tbl-search")?.addEventListener("input", debounce((e) => {
    const q = (e.target.value || "").trim().toLowerCase();
    S.set({ filtros: { ...S.get().filtros, search: q } });
    applyAndRenderTable(table);
  }, 250));
}

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
    $("#tbl-total").textContent = String(count ?? rows.length);
    $("#tbl-status-label").textContent = "Todos los status";

  } catch (err) {
    console.error(TAG, "loadRequerimientos()", err);
    gcToast("Hubo un error, inténtalo más tarde.", "warning");
    S.set({
      requerimientos: [],
      counts: { todos: 0, solicitud: 0, revicion: 0, asignacion: 0, enProceso: 0, pausado: 0, cancelado: 0, finalizado: 0 }
    });
  } finally {
    toggle($("#tbl-skeleton"), false);
    toggle($("#tbl-wrap"), true);
  }
}

function computeCounts(rows = []) {
  const counts = {
    todos: rows.length,
    solicitud: 0,
    revicion: 0,
    asignacion: 0,
    enProceso: 0,
    pausado: 0,
    cancelado: 0,
    finalizado: 0
  };
  rows.forEach(r => {
    const k = ESTATUS[Number(r.estatus)]?.clave;
    if (k && counts.hasOwnProperty(k)) counts[k]++;
  });
  S.set({ counts });
}

function renderCounts() {
  const c = S.get().counts;
  $("#cnt-todos").textContent = `(${c.todos})`;
  $("#cnt-solicitud").textContent = `(${c.solicitud})`;
  $("#cnt-revicion").textContent = `(${c.revicion})`;
  $("#cnt-asignacion").textContent = `(${c.asignacion})`;
  $("#cnt-enProceso").textContent = `(${c.enProceso})`;
  $("#cnt-pausado").textContent = `(${c.pausado})`;
  $("#cnt-cancelado").textContent = `(${c.cancelado})`;
  $("#cnt-finalizado").textContent = `(${c.finalizado})`;
}

function applyAndRenderTable(table) {
  const { status, search } = S.get().filtros;
  const base = S.get().requerimientos;

  let filtered = base;

  // Filtro por estatus 
  if (status !== "todos") {
    filtered = filtered.filter(r => ESTATUS[Number(r.estatus)]?.clave === status);
  }

  // Busqueda (tramite_nombre/asunto + nombre de estatus)
  if (search) {
    filtered = filtered.filter(r => {
      const tramite = (r.tramite_nombre || r.asunto || "").toLowerCase();
      const estNom = (ESTATUS[Number(r.estatus)]?.nombre || "").toLowerCase();
      return tramite.includes(search) || estNom.includes(search);
    });
  }

  const rows = filtered.map(r => ({
    tramite: r.tramite_nombre || r.asunto || "—",
    asignado: r.asignado_nombre_completo || "—",
    fecha: fmtDateISOtoMX(r.created_at),
    status: ESTATUS[Number(r.estatus)]?.nombre || String(r.estatus ?? "—")
  }));

  if (!rows.length) {
    table.setData([]);
    toggle($("#tbl-empty"), true);
    $("#tbl-total").textContent = "0";
  } else {
    table.setData(rows);
    toggle($("#tbl-empty"), false);
    $("#tbl-total").textContent = String(rows.length); // total del conjunto filtrado
  }

  renderCounts(); // mantiene sidebar al día
}

// Si luego filtras en servidor:
function mapStatusFilter(key) {
  if (!key || key === "todos") return null;
  const reverse = {
    solicitud: 0, revicion: 1, asignacion: 2,
    enProceso: 3, pausado: 4, cancelado: 5, finalizado: 6
  };
  return reverse[key] ?? null;
}

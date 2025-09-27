// /JS/views/home.js
import { $, mountSkeletonList, toggle, fmtDateISOtoMX } from "/JS/core/dom.js";
import { createStore } from "/JS/core/store.js";
import { LineChart } from "/JS/charts/line-chart.js";
import { DonutChart } from "/JS/charts/donut-chart.js";
import { fetchRequerimientos } from "/JS/api/requerimientos.js";
import { createTable } from "/JS/ui/table.js";

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
  solicitud: "#a5b4fc",
  revicion: "#93c5fd",
  asignacion: "#6ee7b7",
  enProceso: "#60a5fa",
  pausado: "#fbbf24",
  cancelado: "#f87171",
  finalizado: "#34d399"
};

async function init() {
  console.log(`${TAG} init (dep: ${S.get().user.dep})`);

  // Perfil lateral
  $("#h-user-nombre").textContent = S.get().user.nombre || "—";
  $("#h-user-dep").textContent = String(S.get().user.dep);

  // Skeleton tabla
  mountSkeletonList($("#tbl-skeleton"), 7);

  const lc = LineChart($("#chart-year")); lc.mount({ data: [] });
  const dc = DonutChart($("#chart-month")); dc.mount({ data: [] });
  // Guardarlos en cierre para updates:
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
          // badge simple; usa el nombre visible
          const name = row.status || val || "—";
          return `<span class="badge badge-status">${escapeHtml(name)}</span>`;
        }
      }
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

    // ===== Charts =====
    const seriesAnual = computeSeriesAnual(rows);      // [12]
    window.__ixCharts?.lc?.update({ data: seriesAnual });

    const donutMes = computeDonutMes(rows);            // [{label,value,color}]
    window.__ixCharts?.dc?.update({ data: donutMes });

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

  const rows = filtered.map(r => {
  const est = ESTATUS[Number(r.estatus)];
  return {
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
    $("#tbl-total").textContent = "0";
  } else {
    table.setData(rows);
    toggle($("#tbl-empty"), false);
    $("#tbl-total").textContent = String(rows.length); // total del conjunto filtrado
  }

  renderCounts(); // mantiene sidebar al día
}

function computeSeriesAnual(rows = []) {
  // Cuenta por mes del año actual (1..12)
  const now = new Date();
  const year = now.getFullYear();
  const counts = new Array(12).fill(0);
  rows.forEach(r => {
    const d = new Date(String(r.created_at).replace(" ", "T"));
    if (!isNaN(d) && d.getFullYear() === year) {
      const m = d.getMonth(); // 0..11
      counts[m] += 1;
    }
  });
  return counts;
}

function computeDonutMes(rows = []) {
  // Distribución por estatus en el MES actual
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

  // construir arreglo para el donut
  const out = [];
  for (const k of Object.keys(acc)) {
    out.push({
      label: ESTATUS_BY_CLAVE(k)?.nombre || k,
      value: acc[k],
      color: STATUS_COLORS[k] || "#4f6b95"
    });
  }
  // ordenar por valor desc (opcional)
  out.sort((a, b) => b.value - a.value);
  return out;
}

function ESTATUS_BY_CLAVE(clave) {
  const id = Object.keys(ESTATUS).find(k => ESTATUS[k].clave === clave);
  return id ? ESTATUS[id] : null;
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

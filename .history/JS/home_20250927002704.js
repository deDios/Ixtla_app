// /JS/views/home.js
import { $, mountSkeletonList, toggle, escapeHtml, fmtDateISOtoMX } from "../core/dom.js";
import { createStore } from "../core/store.js";
import { LineChart } from "../charts/line-chart.js";
import { DonutChart } from "../charts/donut-chart.js";
import { fetchRequerimientos } from "../api/requerimientos.js";
import { createTable } from "../ui/table.js";

const TAG = "[Home]";

// Mapa de estatus numérico -> nombre/clave para UI
const ESTATUS = {
  0: { clave: "pendiente",  nombre: "Pendiente"  },
  1: { clave: "proceso",    nombre: "En proceso" },
  2: { clave: "terminado",  nombre: "Terminado"  },
  3: { clave: "cancelado",  nombre: "Cancelado"  },
  4: { clave: "pausado",    nombre: "Pausado"    }
};

const sess = window.__ixSession || null;
const departamentoActivo = Number(sess?.departamento_id ?? 1);

const S = createStore({
  user: {
    nombre: (sess?.nombre || "") + (sess?.apellidos ? " " + sess.apellidos : ""),
    dep: departamentoActivo
  },
  filtros: {
    status: "todos",   // "todos" | "pendiente" | "proceso" | "terminado" | "cancelado" | "pausado"
    search: ""
  },
  // Datos crudos traídos del endpoint (una página "grande" para paginar en cliente)
  requerimientos: [],
  // Derivados para UI
  counts: { todos: 0, pendiente: 0, proceso: 0, terminado: 0, cancelado: 0, pausado: 0 },
  pageSize: 7
});

// Debounce helper
function debounce(fn, ms=300){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args),ms); }; }

window.addEventListener("DOMContentLoaded", init);

async function init() {
  console.log(`${TAG} init (dep: ${S.get().user.dep})`);

  // Header lateral
  $("#h-user-nombre").textContent = S.get().user.nombre || "—";
  $("#h-user-dep").textContent = String(S.get().user.dep);

  // Skeletons
  mountSkeletonList($("#tbl-skeleton"), 7);

  // Charts (stubs por ahora)
  const lc = LineChart($("#chart-year"));  lc.mount({ data: [] });
  const dc = DonutChart($("#chart-month")); dc.mount({ data: [] });

  // Tabla
  const table = createTable({ pageSize: S.get().pageSize });

  // Cargar datos iniciales
  await loadRequerimientos();

  // Rellenar UI inicial
  renderCounts();
  applyAndRenderTable(table);

  // Filtros por estatus
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

  // Búsqueda con debounce (servidor opcional en Fase futura; por ahora filtramos en cliente)
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
      per_page: 50,                  // de momento traemos "todo" para paginar en cliente
      // Podemos enviar estatus/search al servidor si prefieres server-side:
      // estatus: mapStatusFilter(S.get().filtros.status),
      // search: S.get().filtros.search,
    });

    if (!ok) throw new Error("Respuesta no OK");
    S.set({ requerimientos: rows });

    // Actualizamos conteos
    computeCounts(rows);

    // Leyenda superior
    $("#tbl-total").textContent = String(count ?? rows.length);
    $("#tbl-status-label").textContent = "Todos los status";

  } catch (err) {
    console.error(TAG, "loadRequerimientos()", err);
    gcToast("Hubo un error, inténtalo más tarde.", "warning");
    S.set({ requerimientos: [], counts: { todos: 0, pendiente: 0, proceso: 0, terminado: 0, cancelado: 0, pausado: 0 } });
  } finally {
    toggle($("#tbl-skeleton"), false);
    toggle($("#tbl-wrap"), true);
  }
}

function computeCounts(rows = []) {
  const counts = { todos: rows.length, pendiente: 0, proceso: 0, terminado: 0, cancelado: 0, pausado: 0 };
  rows.forEach(r => {
    const e = Number(r.estatus);
    const clave = ESTATUS[e]?.clave;
    if (clave && counts.hasOwnProperty(clave)) counts[clave]++;
  });
  S.set({ counts });
}

function renderCounts() {
  const c = S.get().counts;
  $("#cnt-todos").textContent = `(${c.todos})`;
  $("#cnt-pend").textContent = `(${c.pendiente})`;
  $("#cnt-proc").textContent = `(${c.proceso})`;
  $("#cnt-term").textContent = `(${c.terminado})`;
  $("#cnt-canc").textContent = `(${c.cancelado})`;
  $("#cnt-paus").textContent = `(${c.pausado})`;
}

// Aplica filtro + búsqueda en cliente y llena la tabla (con paginación cliente del módulo)
function applyAndRenderTable(table) {
  const { status, search } = S.get().filtros;
  const base = S.get().requerimientos;

  let filtered = base;

  // Filtro por estatus
  if (status !== "todos") {
    filtered = filtered.filter(r => ESTATUS[Number(r.estatus)]?.clave === status);
  }

  // Filtro por búsqueda (tramite_nombre, asunto, estatus nombre)
  if (search) {
    filtered = filtered.filter(r => {
      const tramite = (r.tramite_nombre || r.asunto || "").toLowerCase();
      const estNom = (ESTATUS[Number(r.estatus)]?.nombre || "").toLowerCase();
      return tramite.includes(search) || estNom.includes(search);
    });
  }

  // Mapeo de filas para la tabla
  const rows = filtered.map(r => ({
    tramite: r.tramite_nombre || r.asunto || "—",
    asignado: r.asignado_nombre_completo || "—",
    fecha: fmtDateISOtoMX(r.created_at),
    status: ESTATUS[Number(r.estatus)]?.nombre || String(r.estatus ?? "—")
  }));

  // Pintar
  if (!rows.length) {
    table.setData([]); // limpia
    toggle($("#tbl-empty"), true);
    $("#tbl-total").textContent = "0";
  } else {
    table.setData(rows);
    toggle($("#tbl-empty"), false);
    // Mostramos el total del conjunto filtrado en la leyenda
    $("#tbl-total").textContent = String(rows.length);
  }

  // Actualiza conteos del sidebar (si cambió el set base, ya se llamó computeCounts)
  renderCounts();
}

// (Para server-side filtering, si decides hacerlo luego)
function mapStatusFilter(key) {
  if (!key || key === "todos") return null;
  // clave -> id (ajusta si tu backend usa otros IDs)
  const reverse = {
    pendiente: 0, proceso: 1, terminado: 2, cancelado: 3, pausado: 4
  };
  return reverse[key] ?? null;
}

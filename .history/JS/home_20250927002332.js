// /JS/views/home.js
import { $, mountSkeletonList, toggle, fmtDateISOtoMX } from "../core/dom.js";
import { createStore } from "../core/store.js";
import { LineChart } from "../charts/line-chart.js";
import { DonutChart } from "../charts/donut-chart.js";
import { createTable } from "../ui/table.js";

const TAG = "[Home]";

// Estado base (puede venir de cookie de sesión)
const sess = window.__ixSession || null;
const S = createStore({
  user: sess ? {
    nombre: (sess.nombre || "") + (sess.apellidos ? " " + sess.apellidos : ""),
    dep: sess.departamento_id || 1
  } : { nombre: "—", dep: 1 },

  filtros: { status: "todos" },
  reportes: [],          // data original
  reportesFiltrados: [], // resultado de filtros/busqueda
  pageSize: 7
});

window.addEventListener("DOMContentLoaded", () => {
  console.log(`${TAG} init`);

  // ----- Sidebar: usuario/departamento -----
  $("#h-user-nombre").textContent = S.get().user.nombre || "—";
  $("#h-user-dep").textContent = String(S.get().user.dep);

  // ----- Skeleton tabla -----
  mountSkeletonList($("#tbl-skeleton"), 7);

  // ----- Charts (stubs) -----
  const lc = LineChart($("#chart-year"));
  lc.mount({ data: [] });
  const dc = DonutChart($("#chart-month"));
  dc.mount({ data: [] });

  // ----- Tabla -----
  const table = createTable({ pageSize: S.get().pageSize });

  const mock = [
    { tramite: "Fuga de agua", asignado: "Juan Pérez", fecha: "02/09/2025", status: "En proceso" },
    { tramite: "Fuga de drenaje", asignado: "María López", fecha: "02/09/2025", status: "Pendiente" },
    { tramite: "No disponemos de agua", asignado: "Carlos Ruiz", fecha: "02/09/2025", status: "Pausado" },
    { tramite: "Baja presión de agua", asignado: "Ana Gómez", fecha: "02/09/2025", status: "Terminado" },
    { tramite: "Basura tirada", asignado: "Luis Méndez", fecha: "02/09/2025", status: "En proceso" },
    { tramite: "Solicitar topé", asignado: "Karla Díaz", fecha: "02/09/2025", status: "Cancelado" },
    { tramite: "Otros", asignado: "Pablo García", fecha: "02/09/2025", status: "Terminado" }
  ];

  table.setData(mock);
  toggle($("#tbl-skeleton"), false);
  toggle($("#tbl-wrap"), true);
  $("#tbl-total").textContent = String(mock.length);
  $("#tbl-status-label").textContent = "Todos los status";

  // ----- Sidebar filtros (solo UI por ahora) -----
  document.querySelectorAll(".status-item").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".status-item").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const statusKey = btn.dataset.status || "todos";
      S.set({ filtros: { ...S.get().filtros, status: statusKey } });
      $("#tbl-status-label").textContent = statusKey === "todos" ? "Todos los status" : statusKey;
      gcToast?.(`Filtro aplicado: ${statusKey}`, "warning");
      // Fase 2: aplicaremos filtro real & recarga/paginación
    });
  });

  // ----- Buscador (de momento sin funcion) -----
  $("#tbl-search")?.addEventListener("input", (e) => {
    const q = (e.target.value || "").toLowerCase();
    // Fase 2: filtrar datos reales
    if (!q) {
      table.setData(mock);
      $("#tbl-total").textContent = String(mock.length);
      return;
    }
    const filtered = mock.filter(r => {
      const a = (r.tramite || "").toLowerCase();
      const s = (r.status || "").toLowerCase();
      return a.includes(q) || s.includes(q);
    });
    table.setData(filtered);
    $("#tbl-total").textContent = String(filtered.length);
  });
});

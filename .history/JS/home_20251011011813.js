// /JS/home.js
import { $, toggle, escapeHtml } from "/JS/core/dom.js";
import { createTable } from "/JS/ui/table.js";
import { planScope, fetchScope, parseReq, ESTATUS } from "/JS/api/requerimientos.js";

const TAG = "[Home]";

/* ============================== Selectors ============================== */
const SEL = {
  profileName: "#h-user-nombre",
  profileBadge: ".profile-dep.badge",

  // Sidebar
  statusGroup: ".status-block",
  statusItems: ".status-nav .status-item",

  // Buscador
  searchInput: "#tbl-search",

  // Tabla
  tableSkeleton: "#tbl-skeleton",
  tableWrap: "#tbl-wrap",
  tableEmpty: "#tbl-empty",
  tableBody: "#tbl-body",
  tablePag: "#tbl-pag",
  tableTotal: "#tbl-total",
  tableStatusLabel: "#tbl-status-label",

  // Charts (si quieres activarlos luego)
  chartYear: "#chart-year",
  chartMonth: "#chart-month",
};

/* ============================== Helpers ================================ */
function debounce(fn, ms = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function waitFor(testFn, timeoutMs = 3000, stepMs = 50) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now?.() ?? Date.now();
    const it = setInterval(() => {
      try {
        if (testFn()) { clearInterval(it); return resolve(true); }
        const dt = (performance.now?.() ?? Date.now()) - t0;
        if (dt >= timeoutMs) { clearInterval(it); return reject(new Error("waitFor timeout")); }
      } catch (e) { clearInterval(it); reject(e); }
    }, stepMs);
  });
}
function readSession() {
  try {
    const s = window.Session?.get?.() || null;
    if (!s) return null;
    return {
      idEmpleado: s.empleado_id ?? s.id_empleado ?? null,
      depId: s.departamento_id ?? null,
      roles: Array.isArray(s.roles) ? s.roles : [],
      nombre: [s.nombre, s.apellidos].filter(Boolean).join(" "),
    };
  } catch { return null; }
}
function formatDateISOtoDMY(iso) {
  if (!iso) return "—";
  const d = new Date(String(iso).replace(" ", "T"));
  if (isNaN(d)) return "—";
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yy = String(d.getFullYear());
  return `${dd}/${mm}/${yy}`;
}
function estatusNombre(code) {
  const e = ESTATUS[Number(code)];
  return e?.label || "—";
}

/* ============================== Estado ================================ */
// Grupos de estado para el sidebar
const STATUS_GROUPS = {
  pendientes: [0, 1, 2],   // Solicitud, Revisión, Asignación
  en_proceso: [3],         // En proceso
  terminados: [6],         // Finalizado
  cancelados: [5],         // Cancelado
  pausados:   [4],         // Pausado
};
function statusToGroup(code) {
  const c = Number(code);
  if (STATUS_GROUPS.pendientes.includes(c)) return "pendientes";
  if (STATUS_GROUPS.en_proceso.includes(c)) return "en_proceso";
  if (STATUS_GROUPS.terminados.includes(c)) return "terminados";
  if (STATUS_GROUPS.cancelados.includes(c)) return "cancelados";
  if (STATUS_GROUPS.pausados.includes(c))   return "pausados";
  return null;
}
function groupHumanLabel(key) {
  if (key === "todos") return "Todos los status";
  const map = {
    pendientes: "Pendientes",
    en_proceso: "En proceso",
    terminados: "Terminados",
    cancelados: "Cancelados",
    pausados:   "Pausados",
  };
  return map[key] || key;
}

const S = {
  viewer: { id: null, depId: null, name: "" },
  filtros: { status: "todos", search: "" },
  items: [],        // filas presentables
  itemsRaw: [],     // crudos (opcional)
  counts: { todos:0, pendientes:0, en_proceso:0, terminados:0, cancelados:0, pausados:0 },
  pageSize: 25,
};
function setCounts(rows) {
  const m = { todos: rows.length, pendientes:0, en_proceso:0, terminados:0, cancelados:0, pausados:0 };
  rows.forEach(r => {
    const code = r?.estatus?.code ?? r?.raw?.estatus;
    const g = statusToGroup(code);
    if (g && m[g] != null) m[g] += 1;
  });
  S.counts = m;
  console.log(TAG, "conteos", m);

  // pintar sidebar si hay spans .count
  setCountSidebar("todos",       m.todos);
  setCountSidebar("pendientes",  m.pendientes);
  setCountSidebar("en_proceso",  m.en_proceso);
  setCountSidebar("terminados",  m.terminados);
  setCountSidebar("cancelados",  m.cancelados);
  setCountSidebar("pausados",    m.pausados);
}
function setCountSidebar(groupKey, val) {
  const el = document.querySelector(`.status-nav .status-item[data-status="${groupKey}"] .count`);
  if (el) el.textContent = `(${val})`;
}

/* ============================== Tabla ================================ */
let table = null;
function buildTable() {
  table = createTable({
    bodySel: SEL.tableBody,
    wrapSel: SEL.tableWrap,
    emptySel: SEL.tableEmpty,
    pagSel: SEL.tablePag,
    pageSize: S.pageSize,
    pagerFancy: true,
    tag: "[Table@Home]",
    columns: [
      { key: "asunto", title: "Trámites", sortable: true, accessor: r => r.asunto || "—",
        render: (val, row) => `
          <div>${escapeHtml(val || "—")}</div>
          <div class="muted mono">${escapeHtml(row.folio || "")}</div>
        `
      },
      { key: "asignado", title: "Asignado", sortable: true, accessor: r => r.asignado || "Sin asignar" },
      { key: "fecha", title: "Fecha de solicitado", sortable: true, accessor: r => r.fecha || "—" },
      { key: "estatus", title: "Status", sortable: true, accessor: r => r.estatus?.code ?? "",
        render: (val) => {
  const key = (val === 3) ? "en_proceso" : (ESTATUS[val]?.key || "");
  return `<span class="badge-status" data-k="${escapeHtml(key)}">${escapeHtml(estatusNombre(val))}</span>`;
},
    ],
    onRender: ({ page, pages, total }) => console.log(TAG, "table render", { page, pages, total }),
  });
}

/* ============================== Sidebar ============================== */
function initStatusDom() {
  const mapByText = {
    "todos": "todos",
    "pendientes": "pendientes",
    "en proceso": "en_proceso",
    "terminados": "terminados",
    "cancelados": "cancelados",
    "pausados": "pausados",
  };
  const items = Array.from(document.querySelectorAll(SEL.statusItems));
  items.forEach(btn => {
    if (!btn.dataset.status) {
      const label = (btn.querySelector(".label")?.textContent || btn.textContent || "")
        .trim().toLowerCase();
      const key = mapByText[label];
      if (key) btn.dataset.status = key;
    }
  });
  console.log(TAG, "status DOM inicializado", items.map(b => b.dataset.status));
}
function makeStatusRadiogroup() {
  const nav = document.querySelector(SEL.statusGroup);
  if (nav) nav.setAttribute("role", "radiogroup");
  const items = Array.from(document.querySelectorAll(SEL.statusItems));
  items.forEach((btn, idx) => {
    btn.setAttribute("role", "radio");
    btn.setAttribute("tabindex", idx === 0 ? "0" : "-1");
    btn.setAttribute("aria-checked", btn.classList.contains("active") ? "true" : "false");
  });
  const container = document.querySelector(".status-nav");
  if (!container) return;
  container.addEventListener("keydown", (e) => {
    const items = Array.from(document.querySelectorAll(SEL.statusItems));
    if (!items.length) return;
    const current = document.activeElement.closest(".status-item");
    const idx = Math.max(0, items.indexOf(current));
    let nextIdx = idx;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") nextIdx = (idx + 1) % items.length;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") nextIdx = (idx - 1 + items.length) % items.length;
    if (nextIdx !== idx) { items[nextIdx].focus(); e.preventDefault(); }
    if (e.key === " " || e.key === "Enter") { items[nextIdx].click(); e.preventDefault(); }
  });
  console.log(TAG, "radiogroup ARIA listo");
}
function wireSidebarEvents() {
  const items = Array.from(document.querySelectorAll(SEL.statusItems));
  items.forEach(btn => {
    btn.addEventListener("click", () => {
      items.forEach(b => { b.classList.remove("active"); b.setAttribute("aria-checked", "false"); });
      btn.classList.add("active");
      btn.setAttribute("aria-checked", "true");
      S.filtros.status = btn.dataset.status || "todos";
      document.querySelector(SEL.tableStatusLabel).textContent = groupHumanLabel(S.filtros.status);
      runPipeline();
      $(SEL.searchInput)?.focus();
    });
  });
  console.log(TAG, "sidebar events listos");
}

/* ============================== Búsqueda ============================== */
function wireSearch() {
  $(SEL.searchInput)?.addEventListener("input", debounce((e) => {
    const q = (e.target.value || "").trim().toLowerCase();
    S.filtros.search = q;
    runPipeline();
  }, 250));
}

/* ============================== Pipeline ============================== */
function runPipeline() {
  const base = S.items; // ya presentables
  const { status, search } = S.filtros;

  // búsqueda
  let filtered = base;
  if (search) {
    const q = search;
    filtered = base.filter(r => {
      const st = estatusNombre(r?.estatus?.code).toLowerCase();
      return (r.asunto||"").toLowerCase().includes(q)
          || (r.asignado||"").toLowerCase().includes(q)
          || (r.folio||"").toLowerCase().includes(q)
          || st.includes(q);
    });
  }

  // conteos con el listado tras búsqueda (para que coincida UI)
  setCounts(filtered);

  // filtro por grupo
  let forTable = filtered;
  if (status !== "todos") {
    const allowed = new Set(STATUS_GROUPS[status] || []);
    forTable = filtered.filter(r => allowed.has(Number(r.estatus?.code)));
  }

  // pintar totales y tabla
  const total = forTable.length;
  $(SEL.tableTotal).textContent = String(total);
  if (table) table.setData(forTable);

  console.log(TAG, "pipeline", {
    filtroStatus: status,
    search,
    totalBase: base.length,
    totalFiltrado: total,
    counts: S.counts
  });
}

/* ============================== Carga de datos ============================== */
async function loadScopeData() {
  toggle($(SEL.tableSkeleton), true);
  toggle($(SEL.tableWrap), false);
  toggle($(SEL.tableEmpty), false);

  // plan
  console.log(TAG, "construyendo planScope", { viewerId: S.viewer.id, viewerDeptId: S.viewer.depId });
  const plan = await planScope({ viewerId: S.viewer.id, viewerDeptId: S.viewer.depId });
  console.log(TAG, "planScope listo", plan);

  // fetch
  console.log(TAG, "ejecutando fetchScope…");
  const { items, counts, filtros } = await fetchScope({ plan, filtros: {} });
  console.log(TAG, "fetchScope OK", { total: items.length, counts, filtros });

  // parse → presentables
  const presentables = items.map(parseReq).map(x => ({
    ...x,
    fecha: formatDateISOtoDMY(x.creado || x.raw?.created_at),
  }));

  S.itemsRaw = items;
  S.items = presentables;

  // conteos iniciales y render
  setCounts(presentables);
  runPipeline();

  toggle($(SEL.tableSkeleton), false);
  toggle($(SEL.tableWrap), true);

  // info de debug
  console.log(TAG, "datos listos", {
    total: presentables.length,
    primeros3: presentables.slice(0,3).map(r => ({ id:r.id, folio:r.folio, estatus:r.estatus.code }))
  });
}

/* ============================== Bootstrap ============================== */
async function init() {
  // Sesión
  const sess = readSession();
  if (!sess?.idEmpleado) {
    console.error(TAG, "No hay sesión válida (empleado_id).");
    return;
  }
  S.viewer = { id: Number(sess.idEmpleado), depId: Number(sess.depId), name: sess.nombre || "" };
  console.log(TAG, "sesión detectada", { idEmpleado: S.viewer.id, depId: S.viewer.depId, roles: sess.roles });

  // Perfil en UI
  if (S.viewer.name) $(SEL.profileName).textContent = S.viewer.name;
  if (S.viewer.depId != null) $(SEL.profileBadge).textContent = $(SEL.profileBadge).textContent || "—";
  console.log(TAG, "perfil", { nombre: S.viewer.name, depId: S.viewer.depId });

  // Tabla
  buildTable();

  // Espera a que el sidebar exista
  try {
    await waitFor(() => document.querySelectorAll(SEL.statusItems).length > 0, 2500);
    console.log(TAG, "status items encontrados:", document.querySelectorAll(SEL.statusItems).length);
  } catch {
    console.warn(TAG, "No se encontraron status items a tiempo. Revisa el HTML o los selectores.");
  }

  // Sidebar + eventos + búsqueda
  initStatusDom();
  makeStatusRadiogroup();
  wireSidebarEvents();
  wireSearch();

  // Datos
  await loadScopeData();

  // Marcar “Todos” como activo al inicio si existe
  const allBtn = document.querySelector(`${SEL.statusItems}[data-status="todos"]`);
  if (allBtn) {
    Array.from(document.querySelectorAll(SEL.statusItems)).forEach(b => { b.classList.remove("active"); b.setAttribute("aria-checked", "false"); });
    allBtn.classList.add("active");
    allBtn.setAttribute("aria-checked", "true");
  }

  console.log(TAG, "init — cargado Home con scope por subordinados");
}

window.addEventListener("DOMContentLoaded", init);

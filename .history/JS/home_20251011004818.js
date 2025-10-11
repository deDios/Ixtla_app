// /JS/home.js
// Home Ixtla — Tabla + Filtros + Charts con alcance por subordinados (y ADMIN global)
// Dependencias: /JS/core/dom.js, /JS/core/store.js, /JS/charts/line-chart.js, /JS/charts/donut-chart.js,
//               /JS/ui/table.js, /JS/api/requerimientos.js

import { $, mountSkeletonList, toggle, escapeHtml } from "/JS/core/dom.js";
import { createStore } from "/JS/core/store.js";
import { LineChart } from "/JS/charts/line-chart.js";
import { DonutChart } from "/JS/charts/donut-chart.js";
import { createTable } from "/JS/ui/table.js";

import {
  planScope,
  fetchScope,
  parseReq,
} from "/JS/api/requerimientos.js";

const TAG = "[Home]";

/* ===================== Selectores (alineados a tu HTML) ===================== */
const SEL = {
  profileName: "#h-user-nombre",
  profileBadge: ".profile-dep.badge", // (no la usamos aún como filtro, pero se conserva)
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
};

/* ===================== Estatus (texto para UI) ===================== */
const ESTATUS = {
  0: { clave: "solicitud",  nombre: "Solicitud"   },
  1: { clave: "revision",   nombre: "Revisión"    },
  2: { clave: "asignacion", nombre: "Asignación"  },
  3: { clave: "enProceso",  nombre: "En proceso"  },
  4: { clave: "pausado",    nombre: "Pausado"     },
  5: { clave: "cancelado",  nombre: "Cancelado"   },
  6: { clave: "finalizado", nombre: "Finalizado"  },
};
function estatusNombre(code){ return ESTATUS[Number(code)]?.nombre ?? "—"; }
function humanStatusLabel(key) {
  if (key === "todos") return "Todos los status";
  const id = Number(key);
  if (!Number.isNaN(id)) return estatusNombre(id);
  const found = Object.values(ESTATUS).find(v => v.clave === key);
  return found?.nombre ?? key;
}

/* ===================== Helpers DOM ===================== */
const $one = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
function debounce(fn, ms = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function setTextSafe(sel, txt) { const el = document.querySelector(sel); if (el) el.textContent = txt; }

/* ===================== Sesión (con fallback a cookie) ===================== */
// Lee Session.get(); si no está, lee cookie ix_emp (base64 JSON) y valida exp
function readIxSession() {
  // 1) API oficial si existe
  try {
    if (window.Session?.get) {
      const s = window.Session.get();
      if (s) return s;
    }
  } catch (e) {
    console.warn(`${TAG} Session.get() lanzó`, e);
  }

  // 2) Fallback: cookie ix_emp
  try {
    const pair = document.cookie.split("; ")
      .find(c => c.startsWith(encodeURIComponent("ix_emp") + "="));
    if (!pair) return null;

    const raw = decodeURIComponent(pair.split("=")[1] || "");
    const json = JSON.parse(decodeURIComponent(escape(atob(raw))));

    if (json && typeof json === "object") {
      if (typeof json.exp === "number" && Date.now() > json.exp) {
        // expirada → borrar
        document.cookie = [
          encodeURIComponent("ix_emp") + "=;",
          "expires=Thu, 01 Jan 1970 00:00:00 GMT",
          "Max-Age=0",
          "path=/",
          "SameSite=Lax",
          location.protocol === "https:" ? "Secure" : ""
        ].filter(Boolean).join("; ");
        console.warn(`${TAG} cookie ix_emp expirada; borrada`);
        return null;
      }
      return json;
    }
  } catch (e) {
    console.warn(`${TAG} error leyendo cookie ix_emp`, e);
  }

  return null;
}

const __sess = readIxSession();
const SessIDs = {
  idEmpleado: __sess?.empleado_id ?? __sess?.id_empleado ?? null,
  depId: Number(__sess?.departamento_id ?? 1),
  nombre: (__sess?.nombre || "").trim(),
  apellidos: (__sess?.apellidos || "").trim(),
  roles: Array.isArray(__sess?.roles) ? __sess.roles.map(String) : [],
};

// log de sesión
console.log(`${TAG} sesión detectada`, {
  idEmpleado: SessIDs.idEmpleado,
  depId: SessIDs.depId,
  roles: SessIDs.roles
});

/* ===================== Store ===================== */
const S = createStore({
  viewerId: SessIDs.idEmpleado || null,

  // Datos crudos y presentables
  itemsRaw: [],
  items: [],

  // Filtros UI
  filtros: {
    status: "todos", // "todos" | "0".."6"
    search: "",
  },

  // Conteos por estatus
  counts: { todos: 0, "0":0,"1":0,"2":0,"3":0,"4":0,"5":0,"6":0 },

  // Tabla
  pageSize: 20,
});

/* ===================== Charts ===================== */
const CH = {
  lc: null, // línea anual
  dc: null, // dona mensual
};

/* ===================== Init ===================== */
window.addEventListener("DOMContentLoaded", init);

async function init() {
  console.log(`${TAG} init — cargando Home con scope por subordinados`);

  // Perfil (nombre + avatar)
  hydrateProfile();

  // Skeleton tabla
  mountSkeletonList($(SEL.tableSkeleton), 7);

  // Charts
  CH.lc = LineChart($(SEL.chartYear));   CH.lc.mount({ data: [] });
  CH.dc = DonutChart($(SEL.chartMonth)); CH.dc.mount({ data: [] });

  // Tabla
  const table = createTable({
    pageSize: S.get().pageSize,
    columns: [
      { key: "folio", title: "Requerimiento", sortable: true, accessor: r => r.folio || "—",
        render: (val, row) => `
          <div class="mono">${escapeHtml(val || "—")}</div>
          <div class="muted">${escapeHtml(row.asunto || "")}</div>
        `
      },
      { key: "contacto",     title: "Contacto",      sortable: true, accessor: r => r.contacto || "—" },
      { key: "tel",          title: "Teléfono",      sortable: true, accessor: r => r.tel  || "—" },
      { key: "departamento", title: "Departamento",  sortable: true, accessor: r => r.departamento || "—" },
      { key: "prioridad",    title: "Prioridad",     sortable: true, accessor: r => r.prioridad || "—" },
      { key: "canal",        title: "Canal",         sortable: true, accessor: r => r.canal || "—" },
      {
        key: "estatus", title: "Status", sortable: true, accessor: r => r.estatus?.code ?? "",
        render: (val) => `<span class="badge-status" data-k="${escapeHtml(ESTATUS[val]?.clave || "")}">${escapeHtml(estatusNombre(val))}</span>`
      }
    ],
    targetBody: SEL.tableBody,
    targetWrap: SEL.tableWrap,
    targetEmpty: SEL.tableEmpty,
    targetSkeleton: SEL.tableSkeleton,
  });
  window.__tableInstance = table;

  // Status sidebar + ARIA
  initStatusDom();
  makeStatusRadiogroup();
  wireSidebarEvents(table);
  wireSearch();

  // Carga de datos por scope
  await loadScopeData();

  // Primer render
  pipelineAndRender({ table });

  // Ocultar skeletons
  document.documentElement.classList.add("is-loaded");
}

/* ===================== Perfil ===================== */
function hydrateProfile() {
  const fullName = `${SessIDs.nombre}${SessIDs.apellidos ? " " + SessIDs.apellidos : ""}`.trim() || "—";
  setTextSafe(SEL.profileName, fullName);

  const avatarEl = $one(SEL.avatar);
  if (avatarEl) {
    const fallback = "/ASSETS/user/img_user1.png";
    const candidate = __sess?.avatar_url
      ? __sess.avatar_url
      : (SessIDs.idEmpleado ? `/ASSETS/user/img_user${SessIDs.idEmpleado}.png` : fallback);
    avatarEl.alt = fullName || "Avatar";
    avatarEl.src = candidate;
    avatarEl.onerror = () => (avatarEl.src = fallback);
  }

  console.log(`${TAG} perfil`, { nombre: fullName, depId: SessIDs.depId });
}

/* ===================== Data por Scope ===================== */
async function loadScopeData() {
  toggle($(SEL.tableWrap), false);
  toggle($(SEL.tableSkeleton), true);
  toggle($(SEL.tableEmpty), false);

  try {
    const viewerId = S.get().viewerId;
    if (!viewerId) throw new Error("viewerId ausente. Revisa sesión.");

    console.log(`${TAG} construyendo planScope`, { viewerId, viewerDeptId: SessIDs.depId });
    const plan = await planScope({
      viewerId,
      viewerDeptId: SessIDs.depId || null
    });
    console.log(`${TAG} planScope listo`, plan);

    console.log(`${TAG} ejecutando fetchScope…`);
    const { items, counts, filtros } = await fetchScope({ plan, filtros: {} });
    console.log(`${TAG} fetchScope OK`, { total: items.length, counts, filtros });

    // Parse para UI
    const presentables = items.map(parseReq);
    S.set({ itemsRaw: items, items: presentables });

    // Charts
    CH.lc?.update({ data: computeSeriesAnual(items) });
    CH.dc?.update({ data: computeDonutMes(items) });

    // Totales y etiqueta
    setTextSafe(SEL.tableTotal, String(items.length));
    setTextSafe(SEL.tableStatusLabel, "Todos los status");

    console.log(`${TAG} datos listos`, {
      total: items.length,
      primeros3: items.slice(0, 3).map(r => ({ id: r.id, folio: r.folio, estatus: r.estatus }))
    });
  } catch (err) {
    console.error(`${TAG} loadScopeData() Error:`, err);
    S.set({ itemsRaw: [], items: [] });
    if (typeof gcToast === "function") gcToast("Hubo un error al cargar datos.", "warning");
  } finally {
    toggle($(SEL.tableSkeleton), false);
    toggle($(SEL.tableWrap), true);
  }
}

/* ===================== Sidebar (status DOM + ARIA) ===================== */
function initStatusDom(){
  // Indexado: 0=Todos, luego 0..6
  $$(SEL.statusItems).forEach((btn, i) => {
    if (!btn.dataset.status) {
      const key = (i === 0) ? "todos" : String(i - 1);
      btn.dataset.status = key;
    }
  });
  console.log(`${TAG} status DOM inicializado`, $$(SEL.statusItems).map(b => b.dataset.status));
}
function makeStatusRadiogroup() {
  const nav = $one(SEL.statusGroup);
  if (nav) nav.setAttribute("role", "radiogroup");
  $$(SEL.statusItems).forEach((btn, idx) => {
    btn.setAttribute("role", "radio");
    btn.setAttribute("tabindex", idx === 0 ? "0" : "-1");
    btn.setAttribute("aria-checked", btn.classList.contains("active") ? "true" : "false");
  });
  $one(SEL.statusNav)?.addEventListener("keydown", (e) => {
    const items = $$(SEL.statusItems);
    if (!items.length) return;
    const current = document.activeElement.closest(".status-item");
    const idx = Math.max(0, items.indexOf(current));
    let nextIdx = idx;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") nextIdx = (idx + 1) % items.length;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") nextIdx = (idx - 1 + items.length) % items.length;
    if (nextIdx !== idx) { items[nextIdx].focus(); e.preventDefault(); }
    if (e.key === " " || e.key === "Enter") { items[nextIdx].click(); e.preventDefault(); }
  }, { passive:false });

  console.log(`${TAG} radiogroup ARIA listo`);
}

/* ===================== Wiring: sidebar y búsqueda ===================== */
function wireSidebarEvents(table) {
  $$(SEL.statusItems).forEach(btn => {
    btn.addEventListener("click", () => {
      $$(SEL.statusItems).forEach(b => { b.classList.remove("active"); b.setAttribute("aria-checked", "false"); });
      btn.classList.add("active");
      btn.setAttribute("aria-checked", "true");

      const statusKey = btn.dataset.status ?? "todos"; // "todos" o "0".."6"
      S.set({ filtros: { ...S.get().filtros, status: statusKey } });
      setTextSafe(SEL.tableStatusLabel, humanStatusLabel(statusKey));
      pipelineAndRender({ table });
      $(SEL.searchInput)?.focus();

      console.log(`${TAG} filtro de status aplicado`, { statusKey });
    });
  });
  console.log(`${TAG} sidebar events listos`);
}
function wireSearch() {
  $(SEL.searchInput)?.addEventListener("input", debounce((e) => {
    const q = (e.target.value || "").trim().toLowerCase();
    S.set({ filtros: { ...S.get().filtros, search: q } });
    pipelineAndRender({});
    console.log(`${TAG} búsqueda`, { q });
  }, 250));
}

/* ===================== Pipeline: búsqueda → conteos → status → tabla ===================== */
function pipelineAndRender({ table = window.__tableInstance } = {}) {
  const base = S.get().items; // ya vienen parseados
  const { status, search } = S.get().filtros;

  // (1) Búsqueda en cliente
  let filtered = base;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(r => {
      const estNom = String(estatusNombre(r.estatus?.code)).toLowerCase();
      const folio  = String(r.folio || "").toLowerCase();
      const nom    = String(r.contacto || "").toLowerCase();
      const tel    = String(r.tel || "").toLowerCase();
      const dep    = String(r.departamento || "").toLowerCase();
      const asunto = String(r.asunto || "").toLowerCase();
      const prio   = String(r.prioridad || "").toLowerCase();
      const canal  = String(r.canal || "").toLowerCase();
      return estNom.includes(q) || folio.includes(q) || nom.includes(q) || tel.includes(q) ||
             dep.includes(q) || asunto.includes(q) || prio.includes(q) || canal.includes(q);
    });
  }

  // (2) Conteos previos al filtro de status
  computeCounts(filtered);

  // (3) Filtro por status
  let forTable = filtered;
  if (status !== "todos") {
    const code = Number(status);
    if (!Number.isNaN(code)) {
      forTable = filtered.filter(r => (r.estatus?.code === code));
    }
  }

  // (4) Render tabla
  if (!forTable.length) {
    table.setData([]);
    toggle($(SEL.tableEmpty), true);
    setTextSafe(SEL.tableTotal, "0");
  } else {
    table.setData(forTable);
    toggle($(SEL.tableEmpty), false);
    setTextSafe(SEL.tableTotal, String(forTable.length));
  }

  console.log(`${TAG} pipeline`, {
    filtroStatus: status,
    search,
    totalBase: base.length,
    totalFiltrado: forTable.length,
    counts: S.get().counts
  });
}

/* ===================== Conteos ===================== */
function computeCounts(rows = []) {
  const m = { todos: rows.length, "0":0,"1":0,"2":0,"3":0,"4":0,"5":0,"6":0 };
  rows.forEach(r => {
    const code = r.estatus?.code;
    if (m[code] != null) m[code] += 1;
  });
  S.set({ counts: m });
  // log de conteos
  console.log(`${TAG} conteos`, m);
}

/* ===================== Charts helpers ===================== */
function computeSeriesAnual(rows = []) {
  const now = new Date(); const y = now.getFullYear();
  const counts = new Array(12).fill(0);
  rows.forEach(r => {
    const d = new Date(String(r.created_at || r.raw?.created_at).replace(" ", "T"));
    if (!isNaN(d) && d.getFullYear() === y) counts[d.getMonth()] += 1;
  });
  return counts;
}
function computeDonutMes(rows = []) {
  const now = new Date(); const y = now.getFullYear(); const m0 = now.getMonth();
  const acc = {};
  rows.forEach(r => {
    const d = new Date(String(r.created_at || r.raw?.created_at).replace(" ", "T"));
    if (isNaN(d) || d.getFullYear() !== y || d.getMonth() !== m0) return;
    const code = Number(r.estatus ?? r.raw?.estatus);
    const clave = ESTATUS[code]?.clave;
    if (!clave) return;
    acc[clave] = (acc[clave] || 0) + 1;
  });
  const donut = Object.entries(acc)
    .map(([clave, value]) => ({ label: humanStatusLabel(clave), value }))
    .sort((a,b) => b.value - a.value);

  console.log(`${TAG} donutMes`, donut);
  return donut;
}

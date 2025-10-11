// /JS/home.js.

import { $, mountSkeletonList, toggle, escapeHtml } from "/JS/core/dom.js";
import { createStore } from "/JS/core/store.js";
import { LineChart } from "/JS/charts/line-chart.js";
import { DonutChart } from "/JS/charts/donut-chart.js";
import { createTable } from "/JS/ui/table.js";

import {
  planScope,
  fetchScope,
  parseReq,
  ESTATUS as ESTATUS_API
} from "/JS/api/requerimientos.js";

const TAG = "[Home]";

/* ============ Selectores dom ============ */
const SEL = {
  profileName: "#h-user-nombre",
  profileBadge: ".profile-dep.badge",
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

/* ============ Estatus (usando etiquetas del backend) ============ */
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
function estatusClave(code){ return ESTATUS[Number(code)]?.clave ?? ""; }
function humanStatusLabel(key) {
  if (key === "todos") return "Todos los status";
  const id = Number(key);
  if (!Number.isNaN(id)) return estatusNombre(id);
  // fallback por clave por si acaso
  const found = Object.values(ESTATUS).find(v => v.clave === key);
  return found?.nombre ?? key;
}

/* ============ Helpers DOM/UX ============ */
const $one = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
function debounce(fn, ms = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function setTextSafe(sel, txt) { const el = document.querySelector(sel); if (el) el.textContent = txt; }

/* ============ Sesion, la cookie del usuario ============ */
function readIxSession() {
  if (window.__ixSession && typeof window.__ixSession === "object") return window.__ixSession;
  if (window.Session?.get) { try { const s = window.Session.get(); if (s) return s; } catch {} }
  try {
    const pair = document.cookie.split("; ").find(c => c.startsWith("ix_emp="));
    if (pair) {
      const raw = decodeURIComponent(pair.split("=")[1] || "");
      return JSON.parse(decodeURIComponent(escape(atob(raw))));
    }
  } catch {}
  return null;
}
const __sess = readIxSession();
const SessIDs = {
  idEmpleado: window.GC_USER?.id || window.GC_USER?.empleado_id || __sess?.id_usuario || __sess?.id || null,
  depId: Number(window.GC_USER?.departamento_id ?? __sess?.departamento_id ?? 1),
  nombre: (window.GC_USER?.nombre || __sess?.nombre || "").trim(),
  apellidos: (window.GC_USER?.apellidos || __sess?.apellidos || "").trim(),
};

const S = createStore({
  viewerId: SessIDs.idEmpleado || null,

  // Datos crudos
  itemsRaw: [],        
  items: [],        

  // Filtros de UI
  filtros: {
    status: "todos",   // "todos" | "0".."6"
    search: "",        // texto libre
  },

  // Conteos por estatus
  counts: { todos: 0, "0":0,"1":0,"2":0,"3":0,"4":0,"5":0,"6":0 },

  // Tabla
  pageSize: 7,
});

/* ============ Charts instancia ============ */
const CH = {
  lc: null, // LineChart (año)
  dc: null, // DonutChart (mes)
};

/* ============ Init ============ */
window.addEventListener("DOMContentLoaded", init);

async function init() {
  console.log(TAG, "init — cargando Home con scope por subordinados"); // LOG (Home)

  // Perfil 
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
      { key: "folio",        title: "Requerimiento", sortable: true, accessor: r => r.folio || "—",
        render: (val, row) => `
          <div class="mono">${escapeHtml(val || "—")}</div>
          <div class="muted">${escapeHtml(row.asunto || "")}</div>
        `
      },
      { key: "contacto",     title: "Contacto",      sortable: true, accessor: r => r.contacto || "—" },
      { key: "tel",          title: "Teléfono",      sortable: true, accessor: r => r.tel  || "—" },
      { key: "departamento", title: "Departamento",  sortable: true, accessor: r => r.departamento || "—" },
      {
        key: "estatus", title: "Status", sortable: true, accessor: r => r.estatus?.code ?? "",
        render: (val, row) => `<span class="badge-status" data-k="${escapeHtml(row.estatus?.key || "")}">${escapeHtml(estatusNombre(val))}</span>`
      }
    ],
    targetBody: SEL.tableBody,
    targetWrap: SEL.tableWrap,
    targetEmpty: SEL.tableEmpty,
    targetSkeleton: SEL.tableSkeleton,
  });
  window.__tableInstance = table;

  // Status sidebar: set dataset-status si falta
  initStatusDom();
  makeStatusRadiogroup();
  wireSidebarEvents(table);
  wireSearch();

  // Cargar datos por scope de subordinados
  await loadScopeData();

  // Primer render
  pipelineAndRender({ table });

  // listo
  document.documentElement.classList.add("is-loaded");
}

/* ============ Perfil (avatar/nombre/depto) ============ */
function hydrateProfile() {
  const fullName = `${SessIDs.nombre}${SessIDs.apellidos ? " " + SessIDs.apellidos : ""}`.trim() || "—";
  setTextSafe(SEL.profileName, fullName);

  const avatarEl = $one(SEL.avatar);
  if (avatarEl) {
    const idForAvatar = SessIDs.idEmpleado || 0;
    const fallback = "/ASSETS/user/img_user1.png";
    const candidate = idForAvatar ? `/ASSETS/user/img_user${idForAvatar}.png` : fallback;
    avatarEl.alt = fullName || "Avatar";
    avatarEl.src = candidate;
    avatarEl.onerror = () => (avatarEl.src = fallback);
  }
}

/* ============ Carga de datos por Scope (subordinados) ============ */
async function loadScopeData() {
  toggle($(SEL.tableWrap), false);
  toggle($(SEL.tableSkeleton), true);
  toggle($(SEL.tableEmpty), false);

  try {
    if (!S.get().viewerId) throw new Error("viewerId ausente. Revisa sesión.");

    const plan = await planScope({ viewerId: S.get().viewerId });
    console.log(TAG, "planScope listo", plan); // LOG (Home)

    // filtros globales (q/estatus/rango) aun no estan en uso
    const { items } = await fetchScope({ plan, filtros: {} });

    // datos crudos
    const presentables = items.map(parseReq);
    S.set({ itemsRaw: items, items: presentables });

    // Charts
    CH.lc?.update({ data: computeSeriesAnual(items) });
    CH.dc?.update({ data: computeDonutMes(items) });

    // Totales
    setTextSafe(SEL.tableTotal, String(items.length));
    setTextSafe(SEL.tableStatusLabel, "Todos los status");
  } catch (err) {
    console.error(TAG, "loadScopeData()", err);
    S.set({ itemsRaw: [], items: [] });
    if (typeof gcToast === "function") gcToast("Hubo un error al cargar datos.", "warning");
  } finally {
    toggle($(SEL.tableSkeleton), false);
    toggle($(SEL.tableWrap), true);
  }
}

/* ============ Sidebar (status DOM + ARIA) ============ */
function initStatusDom(){
  $$(SEL.statusItems).forEach((btn, i) => {
    if (!btn.dataset.status) {
      const label = btn.querySelector('.label')?.textContent?.trim();
      const map = ["todos","Solicitud","Revisión","Asignación","En proceso","Pausado","Cancelado","Finalizado"];
      const key = (i===0) ? "todos"
        : String(i-1); // 1->0,2->1,...,7->6
      btn.dataset.status = key;
    }
  });
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
}

/* ============ Wiring: sidebar y búsqueda ============ */
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
    });
  });
}
function wireSearch() {
  $(SEL.searchInput)?.addEventListener("input", debounce((e) => {
    const q = (e.target.value || "").trim().toLowerCase();
    S.set({ filtros: { ...S.get().filtros, search: q } });
    pipelineAndRender({});
  }, 250));
}

/* ============ Pipeline: filtros -> conteos -> tabla ============ */
function pipelineAndRender({ table = window.__tableInstance } = {}) {
  const base = S.get().items; // ya son parseados
  const { status, search } = S.get().filtros;

  // (1) Búsqueda (cliente)
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
      return estNom.includes(q) || folio.includes(q) || nom.includes(q) || tel.includes(q) || dep.includes(q) || asunto.includes(q);
    });
  }

  // (2) Conteos previos a status
  computeCounts(filtered);
  renderCounts();

  // (3) Filtro por estatus
  let forTable = filtered;
  if (status !== "todos") {
    const code = Number(status);
    if (!Number.isNaN(code)) {
      forTable = filtered.filter(r => (r.estatus?.code === code));
    }
  }

  // (4) Mapa a filas de tabla (ya están en formato presentable)
  const rows = forTable.map(r => ({
    ...r,
    statusKey: ESTATUS[r.estatus?.code]?.clave || "",
  }));

  // (5) Render tabla
  if (!rows.length) {
    table.setData([]);
    toggle($(SEL.tableEmpty), true);
    setTextSafe(SEL.tableTotal, "0");
  } else {
    table.setData(rows);
    toggle($(SEL.tableEmpty), false);
    setTextSafe(SEL.tableTotal, String(rows.length));
  }
}

/* ============ Conteos ============ */
function computeCounts(rows = []) {
  const m = { todos: rows.length, "0":0,"1":0,"2":0,"3":0,"4":0,"5":0,"6":0 };
  rows.forEach(r => {
    const code = r.estatus?.code;
    if (m[code] != null) m[code] += 1;
  });
  S.set({ counts: m });
}
function renderCounts() {
  const m = S.get().counts;
  const order = ["todos","0","1","2","3","4","5","6"];
  const buttons = $$(SEL.statusItems);
  buttons.forEach((btn, idx) => {
    const key = order[idx] ?? "todos";
    const cntEl = btn.querySelector(".count");
    if (cntEl) cntEl.textContent = `(${m[key] ?? 0})`;
  });
}

/* ============ Charts helpers (año y mes actuales) ============ */
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
    const clave = estatusClave(code);
    if (!clave) return;
    acc[clave] = (acc[clave] || 0) + 1;
  });
  const out = Object.entries(acc)
    .map(([clave, value]) => ({ label: humanStatusLabel(clave), value }))
    .sort((a,b) => b.value - a.value);
  return out;
}

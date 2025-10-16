// /JS/home.js
import { planScope, fetchScope, parseReq, loadEmpleados } from "/JS/api/requerimientos.js";
import { LineChart } from "/JS/charts/line-chart.js";
import { DonutChart } from "/JS/charts/donut-chart.js";

const TAG = "[Home]";

// ========================= Helpers de sesión/DOM =========================
function getSession() {
  try { return window.Session?.get?.() || null; } catch { return null; }
}

function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

function log(...a){ console.log(TAG, ...a); }
function warn(...a){ console.warn(TAG, ...a); }

// Carga avatar: muestra default y prueba variantes en silencio (sin 404 visibles)
function setProfileImage(imgEl, userId) {
  const base = "/ASSETS/user/userImgs/";
  imgEl.src = base + "default.png";
  if (!userId) return;
  const candidates = [
    `img_${userId}.webp`,`img_${userId}.jpg`,`img_${userId}.png`,
    `user_${userId}.webp`,`user_${userId}.jpg`,`user_${userId}.png`,
    `img${userId}.webp`,`img${userId}.jpg`,`img${userId}.png`,`img${userId}.jpeg`
  ];
  (async () => {
    for (const name of candidates) {
      const ok = await tryImg(base + name);
      if (ok) { imgEl.src = base + name; break; }
    }
  })();
  function tryImg(url){ return new Promise(res => { const t = new Image(); t.onload=()=>res(true); t.onerror=()=>res(false); t.src=url; }); }
}

// ========================= Estado de UI =========================
const STATUS_MAP = {
  todos: null,
  solicitud: 0,
  revision: 1,
  asignacion: 2,
  en_proceso: 3,
  pausado: 4,
  cancelado: 5,
  finalizado: 6,
};

const MONTHS3 = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const State = {
  plan: null,
  items: [],
  charts: { year:null, donut:null },
  ui: {
    filterKey: "todos",   // sin filtro por defecto
    search: "",
  },
};

// ========================= Selectores de la vista =========================
const SEL = {
  avatar:   "#hs-avatar",
  name:     "#hs-profile-name",
  editBtn:  "#hs-edit-profile",

  states:   "#hs-states",     // contenedor del sidebar
  stateItem: "#hs-states .item",

  search:   "#hs-search",

  chartYear:  "#chart-year",
  chartDonut: "#chart-month",       // conservamos id aunque ahora sea “Total”

  tableBody: "#hs-table-body",
  tableWrap: "#hs-table-wrap",

  legendTotal: "#hs-legend-total",
  legendStatus:"#hs-legend-status",
};

// ========================= Boot =========================
document.addEventListener("DOMContentLoaded", init);

async function init(){
  const session = getSession();
  const userName = session?.user?.nombre_completo || session?.user?.name || "—";
  const empleadoId = session?.empleado_id ?? session?.user?.empleado_id ?? session?.user?.id ?? null;
  const deptId = session?.departamento_id ?? session?.user?.departamento_id ?? null;

  // Perfil
  const $avatar = $(SEL.avatar);
  const $name = $(SEL.name);
  if ($name) $name.textContent = userName;
  if ($avatar) setProfileImage($avatar, empleadoId);

  // Sidebar: wiring
  wireSidebar();

  // Buscador
  const $search = $(SEL.search);
  if ($search){
    $search.addEventListener("input", () => {
      State.ui.search = $search.value.trim();
      render(); // filtra tabla + charts
    });
  }

  // Charts: instanciar uno de cada
  const $cy = $(SEL.chartYear);
  const $cd = $(SEL.chartDonut);
  if ($cy) {
    State.charts.year = new LineChart($cy, {
      labels: MONTHS3,
      series: new Array(12).fill(0),
      showGrid: true,
      headroom: 0.2,
      yTicks: 5,
    });
  }
  if ($cd) {
    // paleta azulada al crear; si luego no pasamos colors en update, conserva esta
    State.charts.donut = new DonutChart($cd, {
      data: [],
      total: 0,
      colors: [
        "#1d4ed8","#2563eb","#3b82f6","#60a5fa","#93c5fd",
        "#38bdf8","#0ea5e9","#0284c7","#0369a1","#7dd3fc"
      ],
      showPercLabels: true
    });
  }

  // Plan de alcance (usa empleado_id como viewerId)
  const empleados = await loadEmpleados().catch(()=>[]);
  State.plan = await planScope({
    viewerId: empleadoId,
    viewerDeptId: deptId,
    empleadosAll: empleados
  });

  await loadDataAndRender();
}

// ========================= Sidebar (filtros) =========================
function wireSidebar(){
  const $items = $all(SEL.stateItem);
  $items.forEach(btn => {
    btn.addEventListener("click", () => {
      const k = btn.dataset.k || btn.dataset.status || btn.getAttribute("data-status") || "todos";
      setActiveState(k);
      loadDataAndRender();
    });
  });
  // Estado inicial
  setActiveState("todos");
}

function setActiveState(key){
  State.ui.filterKey = (key in STATUS_MAP) ? key : "todos";
  $all(SEL.stateItem).forEach(b => b.classList.toggle("is-active", (b.dataset.k||b.dataset.status) === State.ui.filterKey));
  const $legendStatus = $(SEL.legendStatus);
  if ($legendStatus) $legendStatus.textContent = key === "todos" ? "Todos los status" : key.replace("_"," ");
}

// ========================= Datos + Render =========================
async function loadDataAndRender(){
  const filtros = buildAPIFiltrosFromUI();
  const { items } = await fetchScope({ plan: State.plan, filtros }).catch(()=>({items:[]}));
  State.items = items;
  render();
}

function buildAPIFiltrosFromUI(){
  const f = {};
  const k = State.ui.filterKey || "todos";
  const code = STATUS_MAP[k];
  if (code != null) f.estatus = code;           // solo si no es “todos”
  return f;
}

function render(){
  const filtered = applyClientFilters(State.items, State.ui.search);
  renderCountsSidebar(State.items);            // numeritos (totales sin search)
  renderTable(filtered);
  renderCharts(filtered);
  const $total = $(SEL.legendTotal);
  if ($total) $total.textContent = String(filtered.length);
}

function applyClientFilters(items, q){
  if (!q) return items.slice();
  const s = q.toLowerCase();
  // búsqueda simple: folio (REQ-...), id numérico o estatus textual
  return items.filter(r => {
    const p = parseReq(r);
    const byFolio = String(p.folio||"").toLowerCase().includes(s);
    const byId = /^\d+$/.test(s) ? String(p.id||"") === s : false;
    const byStatus = (p.estatus?.label || "").toLowerCase().includes(s);
    const byTipo = (p.tramite || "").toLowerCase().includes(s);
    return byFolio || byId || byStatus || byTipo;
  });
}

function renderCountsSidebar(items){
  // recalcular contadores de cada estado usando STATUS_MAP
  const counts = { todos: items.length };
  Object.entries(STATUS_MAP).forEach(([k,code])=>{
    if (k==="todos") return;
    counts[k] = items.reduce((a,r)=> a + ((r?.estatus===code)?1:0), 0);
  });
  // buscar spans contadores al lado de cada item (si existen)
  $all(SEL.stateItem).forEach(btn => {
    const k = btn.dataset.k || btn.dataset.status || "todos";
    const cnt = counts[k] ?? 0;
    const spot = btn.querySelector(".count");
    if (spot) spot.textContent = `(${cnt})`;
  });
}

// ========================= Tabla =========================
function renderTable(items){
  const $tbody = $(SEL.tableBody);
  if (!$tbody) return;

  if (!items.length) {
    $tbody.innerHTML = `
      <tr><td colspan="5" style="padding:16px 20px;color:#6b7280;">
        No hay requerimientos asignados de momento
      </td></tr>`;
    return;
  }

  const rows = items.map(raw => {
    const p = parseReq(raw);
    const folio = p.folio || (p.id ? `REQ-${String(p.id).padStart(11,"0")}` : "—");
    const asignado = (p.asignado||"").toString().replace(/\s+(DIRECTOR|ANALISTA|JEFE)$/i,"").trim() || "Sin asignar";
    const tel = p.tel || "—";
    const tipo = p.tramite || "—";
    const k = mapStatusKeyFromCode(p.estatus?.code);
    const label = p.estatus?.label || "—";

    return `
      <tr class="is-clickable" data-id="${p.id}">
        <td>${folio}</td>
        <td>${escapeHTML(tipo)}</td>
        <td>${escapeHTML(asignado)}</td>
        <td>${escapeHTML(tel)}</td>
        <td style="text-align:center">
          <span class="badge-status" data-k="${k}">${escapeHTML(label)}</span>
        </td>
      </tr>`;
  }).join("");

  $tbody.innerHTML = rows;

  // click → detalle
  const base = $(SEL.tableWrap)?.dataset?.detailBase || "/VIEWS/requerimiento.php?id=";
  $all("tr.is-clickable", $tbody).forEach(tr => {
    tr.addEventListener("click", () => {
      const id = tr.getAttribute("data-id");
      if (id) location.href = `${base}${id}`;
    });
  });
}

function mapStatusKeyFromCode(c){
  switch (c) {
    case 0: return "solicitud";
    case 1: return "revision";
    case 2: return "asignacion";
    case 3: return "enProceso";
    case 4: return "pausado";
    case 5: return "cancelado";
    case 6: return "finalizado";
    default: return "solicitud";
  }
}

function escapeHTML(s){ return String(s||"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }

// ========================= Gráficas =========================
function renderCharts(items){
  // Línea (año) con meses abreviados
  if (State.charts.year) {
    const series = new Array(12).fill(0);
    for (const r of items) {
      const d = new Date(r.created_at || r.creado);
      if (!isNaN(d)) series[d.getMonth()]++;
    }
    State.charts.year.update({
      labels: MONTHS3,
      series,
      showGrid: true,
      headroom: 0.2,
      yTicks: 5
    });
    log("CHARTS — year series:", { labels: MONTHS3, series });
  }

  // Donut = TODO lo registrado (agrupado por tipo de trámite)
  if (State.charts.donut) {
    const agg = aggregateDonut(items);
    State.charts.donut.update({
      data: agg.items,
      total: agg.total,
      // paleta azul ya se setea al construir; puedes pasar otra aquí si quieres
    });
    log("CHARTS — donut distribution:", agg);
  }
}

function aggregateDonut(all){
  const map = new Map();
  for (const r of all) {
    const k = r?.tramite_nombre || r?.tramite || "Otros";
    map.set(k, (map.get(k)||0) + 1);
  }
  const items = [...map.entries()]
    .sort((a,b)=> b[1]-a[1])          // opcional: más grandes primero
    .map(([label, value]) => ({ label, value }));
  const total = items.reduce((a,b)=>a+b.value,0);
  return { items, total };
}

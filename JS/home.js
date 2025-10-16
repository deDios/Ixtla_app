// /JS/home.js
import { planScope, fetchScope, parseReq } from "/JS/api/requerimientos.js";
import { LineChart } from "/JS/charts/line-chart.js";
import { DonutChart } from "/JS/charts/donut-chart.js";

// === Cookie de sesión (única fuente) ===
function getSessionSafe() {
  try { return window.Session?.get?.() || null; } catch { return null; }
}

const TAG = "[Home]";
const MONTHS3 = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

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

const State = {
  plan: null,
  items: [],
  charts: { year:null, donut:null },
  ui: {
    filterKey: "todos",
    search: "",
    pager: { page: 1, size: 10, total: 0, pages: 1 },
  },
};

const SEL = {
  // Perfil
  avatar:   "#hs-avatar",
  name:     "#hs-profile-name",
  editBtn:  "#hs-edit-profile",

  // Sidebar
  states:   "#hs-states",
  stateItem:"#hs-states .item",

  // Buscador
  search:   "#hs-search",

  // Charts
  chartYear:  "#chart-year",
  chartDonut: "#chart-month",

  // Tabla
  tableBody: "#hs-table-body",
  tableWrap: "#hs-table-wrap",

  // Leyenda / contador
  legendTotal:  "#hs-legend-total",
  legendStatus: "#hs-legend-status",

  // Paginador
  pager: "#hs-pager",
};

// ------------- utils -------------
function $(s, r=document){ return r.querySelector(s); }
function $all(s, r=document){ return Array.from(r.querySelectorAll(s)); }
function log(...a){ console.log(TAG, ...a); }
function warn(...a){ console.warn(TAG, ...a); }
function escapeHTML(s){ return String(s||"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }

// Avatar: default + intenta img{id}.{png,jpg,webp,jpeg} sin flood
function setProfileImage(imgEl, empleadoId) {
  if (!imgEl) return;
  const base = "/ASSETS/user/userImgs/";
  imgEl.src = base + "default.png";
  if (!empleadoId) return;
  const cand = [`img${empleadoId}.png`,`img${empleadoId}.jpg`,`img${empleadoId}.jpeg`,`img${empleadoId}.webp`];
  (async () => {
    for (const name of cand) {
      const ok = await tryImg(base + name);
      if (ok) { imgEl.src = base + name; break; }
    }
  })();
  function tryImg(url){ return new Promise(res=>{ const t=new Image(); t.onload=()=>res(true); t.onerror=()=>res(false); t.src=url; }); }
}

// ------------- init -------------
document.addEventListener("DOMContentLoaded", init);

async function init(){
  const session = getSessionSafe();
  log("Cookie ix_emp (Session.get()):", session);

  const empleadoId = session?.empleado_id ?? session?.id_empleado ?? null;
  const deptId     = session?.departamento_id ?? null;

  const displayName = (session?.nombre || "") && (session?.apellidos || "")
    ? `${session.nombre} ${session.apellidos}`
    : (session?.nombre || session?.username || "—");
  const $name = $(SEL.name);
  if ($name) $name.textContent = displayName;
  setProfileImage($(SEL.avatar), empleadoId);

  wireSidebar();
  wireSearch();
  initCharts();

  if (!empleadoId) {
    warn("empleado_id ausente; no se llama a planScope()");
    State.items = [];
    render(); // limpia UI con 0s
    return;
  }

  State.plan = await planScope({ viewerId: empleadoId, viewerDeptId: deptId });
  await loadDataAndRender();
}

// ------------- sidebar -------------
function wireSidebar(){
  $all(SEL.stateItem).forEach(btn => {
    btn.addEventListener("click", () => {
      const k = btn.dataset.k || btn.dataset.status || "todos";
      setActiveState(k);
      State.ui.pager.page = 1;
      loadDataAndRender();
    });
  });
  setActiveState("todos");
}
function setActiveState(key){
  State.ui.filterKey = (key in STATUS_MAP) ? key : "todos";
  $all(SEL.stateItem).forEach(b => b.classList.toggle("is-active", (b.dataset.k||b.dataset.status) === State.ui.filterKey));
  const $legendStatus = $(SEL.legendStatus);
  if ($legendStatus) $legendStatus.textContent = key === "todos" ? "Todos los status" : key.replace("_"," ");
}

// ------------- search -------------
function wireSearch(){
  const $search = $(SEL.search);
  if (!$search) return;
  $search.addEventListener("input", () => {
    State.ui.search = $search.value.trim();
    State.ui.pager.page = 1;
    render();
  });
}

// ------------- charts -------------
function initCharts(){
  const $cy = $(SEL.chartYear);
  const $cd = $(SEL.chartDonut);

  if ($cy) {
    State.charts.year = new LineChart($cy, {
      labels: MONTHS3,
      series: new Array(12).fill(0),
      showGrid: true, headroom: 0.2, yTicks: 5
    });
  }

  if ($cd) {
    State.charts.donut = new DonutChart($cd, {
      data: [],
      total: 0,
      colors: ["#1d4ed8","#2563eb","#3b82f6","#60a5fa","#93c5fd","#38bdf8","#0ea5e9","#0284c7","#0369a1","#7dd3fc"],
      showPercLabels: true
    });
  }
}

// ------------- datos + render -------------
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
  if (code != null) f.estatus = code;
  return f;
}
function render(){
  // filtros cliente + conteos + paginado + tabla + charts
  const filtered = applyClientFilters(State.items, State.ui.search);
  renderCountsSidebar(State.items);
  buildPager(filtered.length);
  const pageRows = slicePage(filtered);
  renderTable(pageRows);
  renderCharts(filtered);

  const $total = $(SEL.legendTotal);
  if ($total) $total.textContent = String(filtered.length);
}

// ------------- filtros cliente -------------
function applyClientFilters(items, q){
  if (!q) return items.slice();
  const s = q.toLowerCase();
  return items.filter(r => {
    const p = parseReq(r);
    const byFolio = String(p.folio||"").toLowerCase().includes(s);
    const byId = /^\d+$/.test(s) ? String(p.id||"") === s : false;
    const byStatus = (p.estatus?.label || "").toLowerCase().includes(s);
    const byTipo = (p.tramite || "").toLowerCase().includes(s);
    return byFolio || byId || byStatus || byTipo;
  });
}

// ------------- sidebar counts -------------
function renderCountsSidebar(items){
  const counts = { todos: items.length };
  Object.entries(STATUS_MAP).forEach(([k,code])=>{
    if (k==="todos") return;
    counts[k] = items.reduce((a,r)=> a + ((r?.estatus===code)?1:0), 0);
  });
  $all(SEL.stateItem).forEach(btn => {
    const k = btn.dataset.k || btn.dataset.status || "todos";
    const cnt = counts[k] ?? 0;
    const spot = btn.querySelector(".count");
    if (spot) spot.textContent = `(${cnt})`;
  });
}

// ------------- paginador -------------
function buildPager(total){
  const size = State.ui.pager.size;
  const pages = Math.max(1, Math.ceil(total / size));
  State.ui.pager.total = total;
  State.ui.pager.pages = pages;
  if (State.ui.pager.page > pages) State.ui.pager.page = pages;

  const $p = $(SEL.pager);
  if (!$p) return;

  const cur = State.ui.pager.page;
  const mkBtn = (label, disabled, goTo) =>
    `<button class="pg-btn" ${disabled?"disabled":""} data-go="${goTo??""}">${label}</button>`;
  const mkNum = (n) =>
    `<button class="pg-num" data-go="${n}" ${n===cur?'aria-current="page"':''}>${n}</button>`;

  let nums = "";
  const windowSize = 5;
  const start = Math.max(1, cur - Math.floor(windowSize/2));
  const end = Math.min(pages, start + windowSize - 1);
  for (let i=start;i<=end;i++) nums += mkNum(i);

  $p.innerHTML =
    `<div class="pg-group">
       ${mkBtn("«", cur===1, 1)}
       ${mkBtn("‹", cur===1, cur-1)}
     </div>
     <div class="pg-group">${nums}</div>
     <div class="pg-group">
       ${mkBtn("›", cur===pages, cur+1)}
       ${mkBtn("»", cur===pages, pages)}
     </div>
     <div class="pg-jump">
       <span class="pg-info">Pág. ${cur} de ${pages}</span>
       <span>Ir a:</span>
       <input type="number" min="1" max="${pages}" value="${cur}" data-goto />
       <button class="pg-btn" data-go="__input">Ir</button>
     </div>`;

  $all(".pg-btn,[data-go]", $p).forEach(b=>{
    b.addEventListener("click", (ev)=>{
      const go = b.getAttribute("data-go");
      if (!go || b.disabled) return;
      let target = cur;
      if (go === "__input") {
        const n = Number($('[data-goto]',$p)?.value || cur);
        target = clamp(n, 1, pages);
      } else {
        target = clamp(Number(go), 1, pages);
      }
      if (target !== cur) {
        State.ui.pager.page = target;
        render();
      }
    });
  });
}
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
function slicePage(list){
  const { page, size } = State.ui.pager;
  const start = (page-1)*size;
  return list.slice(start, start + size);
}

// ------------- tabla -------------
function renderTable(items){
  const $tbody = $(SEL.tableBody);
  if (!$tbody) return;
  if (!items.length) {
    $tbody.innerHTML = `<tr><td colspan="5" style="padding:16px 20px;color:#6b7280;">No hay requerimientos asignados de momento</td></tr>`;
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
        <td style="text-align:center"><span class="badge-status" data-k="${k}">${escapeHTML(label)}</span></td>
      </tr>`;
  }).join("");
  $tbody.innerHTML = rows;

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

// ------------- charts (filtrados) -------------
function renderCharts(items){
  if (State.charts.year) {
    const series = new Array(12).fill(0);
    for (const r of items) {
      const d = new Date(r.created_at || r.creado);
      if (!isNaN(d)) series[d.getMonth()]++;
    }
    State.charts.year.update({ labels: MONTHS3, series, showGrid:true, headroom:0.2, yTicks:5 });
  }
  if (State.charts.donut) {
    const agg = aggregateDonut(items); // por tipo de trámite, sobre el set filtrado
    State.charts.donut.update({ data: agg.items, total: agg.total });
  }
}
function aggregateDonut(all){
  const map = new Map();
  for (const r of all) {
    const k = r?.tramite_nombre || r?.tramite || "Otros";
    map.set(k, (map.get(k)||0) + 1);
  }
  const items = [...map.entries()].sort((a,b)=> b[1]-a[1]).map(([label,value])=>({ label, value }));
  const total = items.reduce((a,b)=>a+b.value,0);
  return { items, total };
}

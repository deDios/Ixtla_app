// /JS/home.js
"use strict";

/* ============================================================================
   CONFIG
   ========================================================================== */
const CONFIG = {
  DEBUG_LOGS: true,
  PAGE_SIZE: 10,
  DEFAULT_AVATAR: "/ASSETS/user/userImgs/default.png",
  ADMIN_ROLES: ["ADMIN"],
  PRESIDENCIA_DEPT_IDS: [6],              // si 6 == Presidencia
  DONUT_PALETTE: [                        // “más azules” para el donut global
    "#1d4ed8","#2563eb","#3b82f6","#60a5fa","#93c5fd",
    "#0ea5e9","#06b6d4","#22d3ee","#67e8f9","#38bdf8"
  ]
};

const TAG = "[Home]";
const log  = (...a)=>{ if (CONFIG.DEBUG_LOGS) console.log(TAG, ...a); };
const warn = (...a)=>{ if (CONFIG.DEBUG_LOGS) console.warn(TAG, ...a); };
const err  = (...a)=>console.error(TAG, ...a);

/* ============================================================================
   Imports
   ========================================================================== */
import { Session } from "/JS/auth/session.js";
import {
  planScope,
  fetchScope,
  parseReq,
  loadEmpleados
} from "/JS/api/requerimientos.js";
import { createTable } from "/JS/ui/table.js";
import { LineChart } from "/JS/charts/line-chart.js";
import { DonutChart } from "/JS/charts/donut-chart.js";

/* ============================================================================
   Selectores
   ========================================================================== */
const SEL = {
  avatar:       "#hs-avatar",
  profileName:  "#hs-profile-name",
  profileBadge: "#hs-profile-badge",

  statusGroup:  "#hs-states",
  statusItems:  "#hs-states .item",

  searchInput:  "#hs-search",

  legendTotal:  "#hs-legend-total",
  legendStatus: "#hs-legend-status",

  tableWrap:    "#hs-table-wrap",
  tableBody:    "#hs-table-body",
  pager:        "#hs-pager",

  chartsWrap:   "#hs-charts",
  chartYear:    "#chart-year",
  chartDonut:   "#chart-month",
  donutLegend:  "#donut-legend"
};

// Sidebar keys (homologados con la app)
const SIDEBAR_KEYS = [
  "todos","solicitud","revision","asignacion","enProceso",
  "pausado","cancelado","finalizado"
];

/* ============================================================================
   Helpers
   ========================================================================== */
const $  = (sel, root=document)=>root.querySelector(sel);
const $$ = (sel, root=document)=>Array.from(root.querySelectorAll(sel));
const setText = (sel, txt)=>{ const el=$(sel); if (el) el.textContent = txt; };

function safeDate(v){ return v ? new Date(String(v).replace(" ","T")) : null; }

/** Mapea códigos 0..6 a las claves de CSS que acordamos */
function cssKeyFromCode(code){
  switch(Number(code)){
    case 0: return "solicitud";
    case 1: return "revision";
    case 2: return "asignacion";
    case 3: return "enProceso";
    case 4: return "pausado";
    case 5: return "cancelado";
    case 6: return "finalizado";
    default: return "revision";
  }
}

/** Restringe visibilidad según RBAC duro (solicitud/revisión ocultos al personal) */
function isVisibleForRole(raw, rbac){
  // ADMIN / Presidencia: ven todo
  if (rbac.isAdmin || rbac.isPresidencia) return true;

  const code = Number(raw?.estatus);
  const asignadoA = Number(raw?.asignado_a);
  const isMine = asignadoA === rbac.viewerId;
  const isTeam = rbac.teamIds?.includes(asignadoA);

  // DIRECTOR / PRIMERA LÍNEA: ven asignación (2) de su depto + asignados (mine/team)
  if (rbac.isDirector || rbac.isPrimeraLinea){
    if (code === 2) return true;          // todo en estado “asignación”
    return isMine || isTeam;
  }

  // JEFE / ANALISTA (resto): solo sus asignados (yo + team)
  return isMine || isTeam;
}

/** Limpia nombre asignado para tabla (solo nombre) */
function onlyName(s){
  if (!s) return "—";
  // Si viene con rol al final, recórtalo (p.ej. “Juan Pérez ANALISTA”)
  return String(s).replace(/\s+(ANALISTA|JEFE|DIRECTOR)\s*$/i,"").trim();
}

/* ============================================================================
   Estado
   ========================================================================== */
const State = {
  session: { empleado_id:null, dept_id:null, roles:[], id_usuario:null },
  rbac: { isAdmin:false, isPresidencia:false, isDirector:false, isPrimeraLinea:false, viewerId:null, teamIds:[] },
  scope: { items:[], counts:{} },

  rows: [],                 // parseados y filtrados por visibilidad RBAC
  filterKey: "todos",       // sidebar
  search: "",

  counts: { todos:0, solicitud:0, revision:0, asignacion:0, enProceso:0, pausado:0, cancelado:0, finalizado:0 },

  table: null,
  __page: 1,

  charts: { line:null, donut:null }
};

const MONTH_LABELS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

/* ============================================================================
   Leer cookie de usuario (para avatar y nombre)
   ========================================================================== */
function readCookiePayload(){
  try{
    const name = "ix_emp=";
    const pair = document.cookie.split("; ").find(c=>c.startsWith(name));
    if (!pair) return null;
    const raw = decodeURIComponent(pair.slice(name.length));
    return JSON.parse(decodeURIComponent(escape(atob(raw))));
  } catch { return null; }
}

/* ============================================================================
   Sesión + Perfil
   ========================================================================== */
function readSession(){
  let s=null;
  try{ s = Session?.get?.() || null; } catch {}
  if (!s) s = readCookiePayload();

  const empleado_id = s?.empleado_id ?? s?.id_empleado ?? null;
  const dept_id     = s?.departamento_id ?? null;
  const roles       = Array.isArray(s?.roles) ? s.roles.map(r=>String(r).toUpperCase()) : [];
  const id_usuario  = s?.id_usuario ?? s?.cuenta_id ?? null;

  State.session = { empleado_id, dept_id, roles, id_usuario };
  return State.session;
}

async function hydrateProfile(){
  const s = Session?.get?.() || readCookiePayload() || {};
  const nombre = [s?.nombre, s?.apellidos].filter(Boolean).join(" ") || "—";
  setText(SEL.profileName, nombre);
  setText(SEL.profileBadge, s?.departamento_nombre || "—");

  const img = $(SEL.avatar);
  if (img){
    const idu = State.session.id_usuario;
    const candidates = idu ? [
      `/ASSETS/user/userImgs/img${idu}.png`,
      `/ASSETS/user/userImgs/img${idu}.jpg`,
      `/ASSETS/user/userImgs/img${idu}.jpeg`,
      `/ASSETS/user/userImgs/img${idu}.webp`,
    ] : [];
    let i=0;
    const tryNext = ()=>{
      if (i>=candidates.length){ img.src = CONFIG.DEFAULT_AVATAR; return; }
      img.onerror = ()=>{ i++; tryNext(); };
      img.src = `${candidates[i]}?v=${Date.now()}`;
    };
    tryNext();
  }
}

/* ============================================================================
   RBAC flags
   ========================================================================== */
function resolveRBACFlags(plan){
  const roles = (State.session.roles||[]);
  const isAdmin = roles.some(r=>CONFIG.ADMIN_ROLES.includes(r));
  const isPres  = CONFIG.PRESIDENCIA_DEPT_IDS.includes(Number(State.session.dept_id));

  // Heurística simple para PRIMERA LÍNEA: si la cuenta tiene rol “ANALISTA” pero además
  // tiene subordinados directos, lo tratamos como “primera línea” (ajústalo si tienes campo explícito)
  const isDirector = plan?.role === "DIRECTOR";
  const isPrimeraLinea = plan?.role === "JEFE" || (plan?.role === "ANALISTA" && (plan?.teamIds?.length||0)>0);

  State.rbac = {
    isAdmin, isPresidencia:isPres, isDirector, isPrimeraLinea,
    viewerId: plan?.viewerId ?? State.session.empleado_id,
    teamIds: plan?.teamIds || []
  };
  log("RBAC flags:", State.rbac);
}

/* ============================================================================
   Sidebar
   ========================================================================== */
function initSidebar(onChange){
  const group = $(SEL.statusGroup);
  if (!group) return;

  group.setAttribute("role","radiogroup");
  const items = $$(SEL.statusItems);
  items.forEach((btn,i)=>{
    btn.setAttribute("role","radio");
    btn.setAttribute("tabindex", i===0 ? "0" : "-1");
    btn.setAttribute("aria-checked", btn.classList.contains("is-active") ? "true" : "false");
    const key = btn.dataset.status;
    if (!SIDEBAR_KEYS.includes(key)) warn("status no válido:", key);

    btn.addEventListener("click", ()=>{
      items.forEach(b=>{ b.classList.remove("is-active"); b.setAttribute("aria-checked","false"); b.tabIndex=-1; });
      btn.classList.add("is-active"); btn.setAttribute("aria-checked","true"); btn.tabIndex=0;
      State.filterKey = key || "todos";
      State.__page = 1;
      updateLegendStatus();
      onChange?.();
      $(SEL.searchInput)?.focus();
    });
  });
}

/* ============================================================================
   Search (folIo, id, status, tramite, asignado)
   ========================================================================== */
function initSearch(onChange){
  const input = $(SEL.searchInput);
  if (!input) return;
  let t;
  input.addEventListener("input",(e)=>{
    clearTimeout(t);
    t = setTimeout(()=>{
      State.search = (e.target.value||"").trim().toLowerCase();
      State.__page = 1;
      onChange?.();
    },200);
  });
}

/* ============================================================================
   Tabla
   ========================================================================== */
function buildTable(){
  State.table = createTable({
    bodySel: SEL.tableBody,
    wrapSel: SEL.tableWrap,
    pagSel:  null,
    pageSize: CONFIG.PAGE_SIZE,
    columns: [
      // (REQID) Folio
      { key:"folio", title:"Folio", sortable:true, accessor:r=>r.folio || "", render:(v)=> v || "—" },
      // Tipo de trámite
      { key:"tramite", title:"Tipo de trámite", sortable:true, accessor:r=>r.tramite||"—" },
      // Asignado (solo nombre)
      { key:"asignado", title:"Asignado", sortable:true, accessor:r=>onlyName(r.asignado) },
      // Teléfono
      { key:"tel", title:"Teléfono", sortable:true, accessor:r=>r.tel||"—" },
      // Estatus (badge con tu paleta)
      { key:"status", title:"Estatus", sortable:true,
        accessor:r=> r.estatus?.label || "—",
        render:(v,r)=>{
          const k = cssKeyFromCode(r.estatus?.code);
          return `<span class="badge-status" data-k="${k}">${r.estatus?.label||"—"}</span>`;
        }
      }
    ]
  });
  State.table.setPageSize?.(CONFIG.PAGE_SIZE);
  // default: orden por folio desc si lo deseas, o por creado
}

/* ============================================================================
   Leyendas / conteos
   ========================================================================== */
function updateLegendTotals(n){ setText(SEL.legendTotal, String(n??0)); }
function updateLegendStatus(){
  const map = {
    todos:"Todos",
    solicitud:"Solicitud", revision:"Revisión", asignacion:"Asignación",
    enProceso:"En proceso", pausado:"Pausado", cancelado:"Cancelado", finalizado:"Finalizado"
  };
  setText(SEL.legendStatus, map[State.filterKey] || "Todos");
}

function computeCounts(rows){
  const c = { todos:0, solicitud:0, revision:0, asignacion:0, enProceso:0, pausado:0, cancelado:0, finalizado:0 };
  rows.forEach(r=>{
    c.todos++;
    const k = cssKeyFromCode(r.estatus?.code);
    if (k in c) c[k]++;
  });
  State.counts = c;
  setText("#cnt-todos",      `(${c.todos})`);
  setText("#cnt-solicitud",  `(${c.solicitud})`);
  setText("#cnt-revision",   `(${c.revision})`);
  setText("#cnt-asignacion", `(${c.asignacion})`);
  setText("#cnt-enProceso",  `(${c.enProceso})`);
  setText("#cnt-pausado",    `(${c.pausado})`);
  setText("#cnt-cancelado",  `(${c.cancelado})`);
  setText("#cnt-finalizado", `(${c.finalizado})`);
}

/* ============================================================================
   Paginación básica
   ========================================================================== */
function renderPagerClassic(total){
  const cont = $(SEL.pager);
  if (!cont) return;

  const pages = Math.max(1, Math.ceil(total / CONFIG.PAGE_SIZE));
  const cur   = Math.min(Math.max(1, State.__page || 1), pages);

  const btn = (label, p, extra="") =>
    `<button class="btn ${extra}" data-p="${p}" ${p==="disabled"?"disabled":""}>${label}</button>`;

  let nums="";
  for (let i=1;i<=pages;i++){
    nums += btn(String(i), i, i===cur ? "primary" : "");
  }

  cont.innerHTML = [
    btn("«", cur<=1 ? "disabled" : 1),
    btn("‹", cur<=1 ? "disabled" : (cur-1)),
    nums,
    btn("›", cur>=pages ? "disabled" : (cur+1)),
    btn("»", cur>=pages ? "disabled" : pages),
    `<span class="muted" style="margin-left:.75rem;">Ir a:</span>`,
    `<input type="number" min="1" max="${pages}" value="${cur}" data-goto style="width:4rem;margin:0 .25rem;">`,
    `<button class="btn" data-go>Ir</button>`
  ].join(" ");

  cont.querySelectorAll("[data-p]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const v = b.getAttribute("data-p");
      if (v==="disabled") return;
      const p = parseInt(v,10);
      if (!Number.isFinite(p)) return;
      State.__page = p;
      State.table?.setPage(p);
      refreshCurrentPageDecorations();
      renderPagerClassic(total);
    });
  });
  cont.querySelector("[data-go]")?.addEventListener("click", ()=>{
    const n = parseInt(cont.querySelector("[data-goto]")?.value || "1", 10);
    const p = Math.min(Math.max(1, n), pages);
    State.__page = p;
    State.table?.setPage(p);
    refreshCurrentPageDecorations();
    renderPagerClassic(total);
  });
}

/* ============================================================================
   Decoraciones de la página actual
   ========================================================================== */
function refreshCurrentPageDecorations(){
  const tbody = $(SEL.tableBody);
  if (!tbody) return;

  // quitar gaps previos
  tbody.querySelectorAll("tr.hs-gap").forEach(tr => tr.remove());

  // bind click a filas reales
  const pageRows = State.table?.getRawRows?.() || [];
  Array.from(tbody.querySelectorAll("tr")).forEach((tr, i)=>{
    tr.classList.remove("is-clickable");
    tr.onclick = null;
    const raw = pageRows[i];
    if (!raw) return;
    tr.classList.add("is-clickable");
    tr.addEventListener("click", ()=>{
      const id = raw?.__raw?.id || raw?.id;
      if (id) window.location.href = `/VIEWS/requerimiento.php?id=${id}`;
    });
  });

  // gaps para completar PAGE_SIZE
  const realCount = pageRows.length;
  const gaps = Math.max(0, CONFIG.PAGE_SIZE - realCount);
  if (gaps>0){
    let html="";
    for (let i=0;i<gaps;i++){
      html += `<tr class="hs-gap" aria-hidden="true"><td colspan="5">&nbsp;</td></tr>`;
    }
    tbody.insertAdjacentHTML("beforeend", html);
  }
}

/* ============================================================================
   Pipeline + render (tabla + charts)
   ========================================================================== */
function applyPipelineAndRender(){
  // 1) Filtrado por visibilidad + sidebar + búsqueda
  const visible = State.rows.slice(); // rows ya respeta RBAC visibilidad

  let filtered = visible;
  if (State.filterKey !== "todos"){
    filtered = filtered.filter(r => cssKeyFromCode(r.estatus?.code) === State.filterKey);
  }

  if (State.search){
    const q = State.search;
    filtered = filtered.filter(r=>{
      const folio = (r.folio||"").toLowerCase();
      const id    = String(r.id||"").toLowerCase();
      const est   = (r.estatus?.label||"").toLowerCase();
      const tram  = (r.tramite||"").toLowerCase();
      const asig  = onlyName(r.asignado||"").toLowerCase();
      return folio.includes(q) || id.includes(q) || est.includes(q) || tram.includes(q) || asig.includes(q);
    });
  }

  // 2) Conteos
  computeCounts(visible);
  updateLegendTotals(filtered.length);
  updateLegendStatus();

  // 3) Tabla
  const rows = filtered.map(r=>({
    __raw:r,
    id:r.id, folio:r.folio, tramite:r.tramite,
    asignado:r.asignado, tel:r.tel, estatus:r.estatus
  }));
  State.table?.setData(rows);
  State.__page = 1;
  refreshCurrentPageDecorations();
  renderPagerClassic(filtered.length);

  log("pipeline", {
    filtro: State.filterKey, search: State.search,
    totalVisible: visible.length, totalFiltrado: filtered.length
  });

  // 4) Charts: ambos reaccionan al filtro activo
  renderCharts(filtered);
}

/* ============================================================================
   Charts (reactivos al filtro)
   ========================================================================== */
function buildYearSeries(rows){
  const now = new Date();
  const y = now.getFullYear();
  const counts = Array(12).fill(0);
  rows.forEach(r=>{
    const d = safeDate(r.creado);
    if (!d) return;
    if (d.getFullYear() !== y) return;
    counts[d.getMonth()] += 1;
  });
  return { labels: MONTH_LABELS.slice(), series: counts };
}

function buildDonutByTramite(rows){
  const map = new Map();
  rows.forEach(r=>{
    const key = r.tramite || "Otros";
    map.set(key, (map.get(key)||0)+1);
  });
  const items = Array.from(map.entries()).map(([label,value])=>({ label, value }));
  const total = items.reduce((a,b)=>a+b.value,0);
  // ordenar desc por valor
  items.sort((a,b)=>b.value - a.value);
  return { items, total };
}

function renderCharts(rowsFiltered){
  // Línea (año) — meses Ene..Dic
  const $line = $(SEL.chartYear);
  if ($line){
    const yr = buildYearSeries(rowsFiltered);
    if (!State.charts.line){
      State.charts.line = new LineChart($line, {
        labels: yr.labels,
        series: yr.series,
        showGrid: true,
        showDots: true,
        headroom: 0.12,      // un poco de aire arriba
        yTicks: 5
      });
    } else {
      State.charts.line.update({ labels: yr.labels, series: yr.series, headroom: 0.12, yTicks: 5 });
    }
    log("CHARTS — year series:", yr);
  }

  // Donut (GLOBAL por tipo de trámite) usando paleta azul
  const $donut = $(SEL.chartDonut);
  if ($donut){
    const agg = buildDonutByTramite(rowsFiltered);
    if (!State.charts.donut){
      State.charts.donut = new DonutChart($donut, {
        data: agg.items,
        total: agg.total,
        legendEl: $(SEL.donutLegend) || null,
        showPercLabels: true,
        colors: CONFIG.DONUT_PALETTE
      });
    } else {
      // DonutChart no expone update en tu versión; recreamos instancia ligera
      $donut.getContext("2d").clearRect(0,0,$donut.width,$donut.height);
      State.charts.donut = new DonutChart($donut, {
        data: agg.items,
        total: agg.total,
        legendEl: $(SEL.donutLegend) || null,
        showPercLabels: true,
        colors: CONFIG.DONUT_PALETTE
      });
    }
    log("CHARTS — donut distribution:", agg);
  }
}

/* ============================================================================
   Carga principal 
   ========================================================================== */
async function loadScopeAndData(){
  const { empleado_id:viewerId, dept_id } = State.session;
  if (!viewerId){
    warn("Sin sesión/empleado_id.");
    State.rows = [];
    computeCounts(State.rows);
    updateLegendTotals(0); updateLegendStatus();
    applyPipelineAndRender();
    return;
  }

  // Construir plan y traer items
  const empleados = await loadEmpleados({ status_empleado:1 });
  const plan = await planScope({ viewerId, viewerDeptId: dept_id, empleadosAll: empleados });
  resolveRBACFlags(plan);

  const { items } = await fetchScope({ plan });
  State.scope = { items, counts:{}, filtros:{} };

  // 1) Visibilidad por RBAC
  const visibleRaw = items.filter(raw => isVisibleForRole(raw, State.rbac));

  // 2) Parse para UI
  State.rows = visibleRaw.map(parseReq);

  log("items UI-mapped (preview):", State.rows.slice(0,5).map(r=>({
    id:r.id, folio:r.folio, tramite:r.tramite, asignado:r.asignado, estatus:r.estatus?.label
  })));

  computeCounts(State.rows);
  updateLegendTotals(State.rows.length);
  updateLegendStatus();

  // Render general
  applyPipelineAndRender();
}

/* ============================================================================
   Init
   ========================================================================== */
window.addEventListener("DOMContentLoaded", async ()=>{
  try{
    readSession();
    await hydrateProfile();

    initSidebar(()=>applyPipelineAndRender());
    initSearch(()=>applyPipelineAndRender());
    buildTable();
    updateLegendStatus();

    await loadScopeAndData();

    log("Home listo");
  } catch(e){
    err("init error:", e);
  }
});

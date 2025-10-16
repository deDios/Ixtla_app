// /JS/home.js
"use strict";

/* ============================================================================
   CONFIG
   ========================================================================== */
const CONFIG = {
  DEBUG_LOGS: true,
  PAGE_SIZE: 10,
  DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",
  ADMIN_ROLES: ["ADMIN"],
  PRESIDENCIA_DEPT_IDS: [6],                 // ids que ven TODO
  DEPT_FALLBACK_NAMES: { 6: "Presidencia" }, // fallback nombre depto
};

const TAG = "[Home]";
const log  = (...a) => { if (CONFIG.DEBUG_LOGS) console.log(TAG, ...a); };
const warn = (...a) => { if (CONFIG.DEBUG_LOGS) console.warn(TAG, ...a); };
const err  = (...a) => console.error(TAG, ...a);

/* ============================================================================
   Imports
   ========================================================================== */
import { Session } from "/JS/auth/session.js";
import {
  planScope,
  loadEmpleados,
  listByAsignado,
  listByDepto,
  parseReq,
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

  chartYear:    "#chart-year",
  chartMonth:   "#chart-month",
  donutLegend:  "#donut-legend",
};

/* ============================================================================
   Helpers
   ========================================================================== */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };

function formatDateMX(v){
  if (!v) return "—";
  const d = new Date(String(v).replace(" ", "T"));
  if (isNaN(d)) return v;
  return d.toLocaleDateString("es-MX",{year:"numeric",month:"2-digit",day:"2-digit"});
}

function readCookiePayload() {
  try {
    const name="ix_emp=";
    const pair = document.cookie.split("; ").find(c=>c.startsWith(name));
    if (!pair) return null;
    const raw = decodeURIComponent(pair.slice(name.length));
    return JSON.parse(decodeURIComponent(escape(atob(raw))));
  } catch { return null; }
}

/* ============================================================================
   Estado
   ========================================================================== */
const State = {
  session: { empleado_id:null, dept_id:null, roles:[], id_usuario:null },
  scopePlan: null,
  departamentos: [],   // cache de departamentos (para nombre y primera_linea)
  rows: [],
  filterKey: "todos",
  search: "",
  counts: { todos:0, pendientes:0, en_proceso:0, terminados:0, cancelados:0, pausados:0 },
  table: null,
  __page: 1
};

/* ============================================================================
   Departamentos
   ========================================================================== */
async function fetchDepartamentos() {
  try {
    const url = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ all: true })
    });
    if (!res.ok) throw new Error("HTTP "+res.status);
    const json = await res.json();
    const arr = json?.data || [];
    State.departamentos = arr;
    log("Departamentos cargados:", { total: arr.length });
    return arr;
  } catch (e) {
    warn("No se pudieron cargar departamentos:", e);
    State.departamentos = [];
    return [];
  }
}

function getDeptById(id){
  return State.departamentos.find(d => Number(d.id) === Number(id)) || null;
}
async function resolveDeptName(deptId){
  const d = getDeptById(deptId);
  if (d) return d.nombre || CONFIG.DEPT_FALLBACK_NAMES[deptId] || `Depto ${deptId}`;
  // fallback (si no cargó todavía)
  return CONFIG.DEPT_FALLBACK_NAMES[deptId] || `Depto ${deptId}`;
}

/* ============================================================================
   Sesión y Perfil
   ========================================================================== */
function readSession(){
  let s=null;
  try { s = Session?.get?.() || null; } catch {}
  if (!s) s = readCookiePayload();

  if (!s) {
    warn("Sin sesión.");
    State.session = { empleado_id:null, dept_id:null, roles:[], id_usuario:null };
    return State.session;
  }
  const empleado_id = s?.empleado_id ?? s?.id_empleado ?? null;
  const dept_id     = s?.departamento_id ?? null;
  const roles       = Array.isArray(s?.roles) ? s.roles.map(r=>String(r).toUpperCase()) : [];
  const id_usuario  = s?.id_usuario ?? s?.cuenta_id ?? null;

  log("sesión detectada", { empleado_id, dept_id, roles });
  State.session = { empleado_id, dept_id, roles, id_usuario };
  return State.session;
}

async function hydrateProfileFromSession(){
  const s = Session?.get?.() || readCookiePayload() || {};
  const nombre = [s?.nombre, s?.apellidos].filter(Boolean).join(" ") || "—";
  setText(SEL.profileName, nombre);

  const badge = $(SEL.profileBadge);
  if (badge){
    const deptName = await resolveDeptName(State.session.dept_id);
    badge.textContent = deptName || "—";
  }

  const img = $(SEL.avatar);
  if (img){
    const idu = State.session.id_usuario;
    const candidates = idu ? [
      `/ASSETS/usuario/usuarioImg/user_${idu}.png`,
      `/ASSETS/usuario/usuarioImg/user_${idu}.jpg`,
      `/ASSETS/usuario/usuarioImg/img_user${idu}.png`,
      `/ASSETS/usuario/usuarioImg/img_user${idu}.jpg`,
    ] : [];
    let i=0;
    const tryNext = () => {
      if (i >= candidates.length) { img.src = CONFIG.DEFAULT_AVATAR; return; }
      img.onerror = () => { i++; tryNext(); };
      img.src = `${candidates[i]}?v=${Date.now()}`;
    };
    tryNext();
  }
}

/* ============================================================================
   Sidebar + Search
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
    },250);
  });
}

/* ============================================================================
   Tabla (REQID, Tipo de trámite, Asignado, Teléfono, Estatus)
   ========================================================================== */
function statusKeyFromCode(code){
  // Paleta fija provista
  if (code === 0) return "solicitud";
  if (code === 1) return "revision";
  if (code === 2) return "asignacion";
  if (code === 3) return "enProceso";
  if (code === 4) return "pausado";
  if (code === 5) return "cancelado";
  if (code === 6) return "finalizado";
  return "revision"; // default suave
}

function buildTable(){
  State.table = createTable({
    bodySel: SEL.tableBody,
    wrapSel: SEL.tableWrap,
    pagSel:  null, // paginador propio (clásico) abajo
    pageSize: CONFIG.PAGE_SIZE,
    columns: [
      { key:"reqid",    title:"REQID", sortable:true, accessor:r=>r.id ?? r.__raw?.id ?? "—",
        render:(v)=> v!=null ? String(v) : "—" },
      { key:"tramite",  title:"Tipo de trámite", sortable:true, accessor:r=>r.tramite || r.asunto || "—" },
      { key:"asignado", title:"Asignado", sortable:true, accessor:r=>r.asignado ? String(r.asignado).split(" / ")[0] : "Sin asignar" },
      { key:"tel",      title:"Teléfono de contacto", sortable:true, accessor:r=>r.tel || "—" },
      { key:"status",   title:"Estatus", sortable:true,
        accessor:r=>r.estatus?.label || "—",
        render:(v, r)=>{
          const k = statusKeyFromCode(r.estatus?.code);
          return `<span class="badge-status" data-k="${k}">${r.estatus?.label || "—"}</span>`;
        }
      }
    ]
  });
  State.table.setPageSize?.(CONFIG.PAGE_SIZE);
  // Ordenar por ID desc por defecto (suelen ser recientes)
  State.table.setSort?.("reqid",-1);
}

/* ============================================================================
   Leyendas / Conteos (para el sidebar)
   ========================================================================== */
function updateLegendTotals(n){ setText(SEL.legendTotal, String(n??0)); }
function updateLegendStatus(){
  const map = { todos:"Todos los status", pendientes:"Pendientes", en_proceso:"En proceso",
                terminados:"Terminados", cancelados:"Cancelados", pausados:"Pausados" };
  setText(SEL.legendStatus, map[State.filterKey] || "Todos los status");
}
function catKeyForSidebar(code){
  if (code===3) return "en_proceso";
  if (code===4) return "pausados";
  if (code===5) return "cancelados";
  if (code===6) return "terminados";
  return "pendientes"; // 0,1,2
}
function computeCounts(rows){
  const c={ todos:0, pendientes:0, en_proceso:0, terminados:0, cancelados:0, pausados:0 };
  rows.forEach(r=>{ c.todos++; const k=catKeyForSidebar(r.estatus?.code); if(k in c) c[k]++; });
  State.counts=c;
  setText("#cnt-todos",      `(${c.todos})`);
  setText("#cnt-pendientes", `(${c.pendientes})`);
  setText("#cnt-en_proceso", `(${c.en_proceso})`);
  setText("#cnt-terminados", `(${c.terminados})`);
  setText("#cnt-cancelados", `(${c.cancelados})`);
  setText("#cnt-pausados",   `(${c.pausados})`);
}

/* ============================================================================
   Paginación clásica (tu HTML / estilos)
   ========================================================================== */
function renderPagerClassic(total){
  const cont = $(SEL.pager);
  if (!cont) return;

  const pages = Math.max(1, Math.ceil(total / CONFIG.PAGE_SIZE));
  const cur   = Math.min(Math.max(1, State.__page || 1), pages);

  const btn = (label, p, extra="") =>
    `<button class="btn ${extra}" data-p="${p}" ${p==="disabled"?"disabled":""}>${label}</button>`;

  let nums = "";
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
   Decoraciones de la página actual (click + gaps)
   ========================================================================== */
function refreshCurrentPageDecorations(){
  const tbody = $(SEL.tableBody);
  if (!tbody) return;

  // limpiar gaps previos
  tbody.querySelectorAll("tr.hs-gap").forEach(tr => tr.remove());

  const pageRows = State.table?.getRawRows?.() || [];
  const realCount = pageRows.length;
  const gaps = Math.max(0, CONFIG.PAGE_SIZE - realCount);

  // limpiar y bindear click en filas reales
  Array.from(tbody.querySelectorAll("tr")).forEach(tr=>{
    tr.classList.remove("is-clickable");
    tr.onclick = null;
  });
  for (let i=0;i<realCount;i++){
    const tr = tbody.querySelectorAll("tr")[i];
    const raw = pageRows[i];
    if (!tr || !raw) continue;
    tr.classList.add("is-clickable");
    tr.addEventListener("click", ()=>{
      const id = raw?.id || raw?.__raw?.id;
      if (id) window.location.href = `/VIEWS/requerimiento.php?id=${id}`;
    });
  }

  // gaps
  if (gaps>0){
    let html="";
    for (let i=0;i<gaps;i++){
      html += `<tr class="hs-gap" aria-hidden="true"><td colspan="5">&nbsp;</td></tr>`;
    }
    tbody.insertAdjacentHTML("beforeend", html);
  }
  log("gaps añadidos:", gaps, "reales en página:", realCount);
}

/* ============================================================================
   Pipeline (filtros + búsqueda + render)
   ========================================================================== */
function applyPipelineAndRender(){
  const all = State.rows || [];
  let filtered = all;

  // filtro por status (sidebar)
  if (State.filterKey !== "todos") {
    filtered = filtered.filter(r => {
      const k = catKeyForSidebar(r.estatus?.code);
      return k === State.filterKey;
    });
  }

  // búsqueda por texto + id/folio
  if (State.search) {
    const q = State.search;
    const isNum = /^\d+$/.test(q);
    filtered = filtered.filter(r=>{
      if (isNum) {
        const idStr = String(r.id||"");
        const folio = String(r.folio||"").toLowerCase();
        return idStr === q || folio.includes(q);
      }
      const texto = [
        r.tramite||"", r.asunto||"", r.asignado||"", r.tel||"",
        r.estatus?.label||"", r.folio||"", String(r.id||"")
      ].join(" ").toLowerCase();
      return texto.includes(q);
    });
  }

  computeCounts(all);
  updateLegendTotals(filtered.length);

  const tableRows = filtered.map(r => ({
    __raw: r,
    id: r.id,
    tramite: r.tramite || r.asunto,
    asignado: r.asignado,
    tel: r.tel,
    estatus: r.estatus
  }));

  State.table?.setData(tableRows);
  State.__page = 1;
  refreshCurrentPageDecorations();
  renderPagerClassic(filtered.length);

  log("pipeline", {
    filtroStatus: State.filterKey,
    search: State.search,
    totalUniverso: all.length,
    totalFiltrado: filtered.length,
    page: State.__page,
  });

  // ==== CHARTS: datos que realmente ve el usuario ====
  try {
    const yearData = buildYearSeries(filtered);
    const monthData = buildMonthDonut(filtered);
    log("CHARTS — input (rows length):", filtered.length);
    log("CHARTS — year series:", yearData);
    log("CHARTS — month distribution:", monthData);

    // LINE
    const cLine = $(SEL.chartYear);
    if (cLine) {
      LineChart.render(cLine, yearData.labels, yearData.series);
      // tooltip container en el wrap
      const wrap = cLine.closest(".hs-chart-wrap");
      wrap?.querySelector(".hs-chart-skeleton")?.remove();
      log("CHARTS — LineChart render ok");
    }
    // DONUT
    const cDonut = $(SEL.chartMonth);
    if (cDonut) {
      const legend = $(SEL.donutLegend) || null;
      DonutChart.render(cDonut, { items: monthData.items, total: monthData.total, legendContainer: legend });
      cDonut.closest(".hs-chart-wrap")?.querySelector(".hs-chart-skeleton")?.remove();
      log("CHARTS — DonutChart render ok", { total: monthData.total });
    }
  } catch(e){
    warn("CHARTS render error:", e);
  }
}

/* === Helpers para charts === */
function monthIndexFromDateStr(s){
  if (!s) return null;
  const d = new Date(String(s).replace(" ","T"));
  if (isNaN(d)) return null;
  return d.getMonth(); // 0..11
}
function buildYearSeries(rows){
  const labels = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const series = new Array(12).fill(0);
  rows.forEach(r=>{
    const m = monthIndexFromDateStr(r.creado);
    if (m!=null) series[m] += 1;
  });
  return { labels, series };
}
function buildMonthDonut(rows){
  const now = new Date();
  const mNow = now.getMonth();
  const yearNow = now.getFullYear();
  const itemsMap = new Map();
  let total = 0;

  rows.forEach(r=>{
    const d = new Date(String(r.creado).replace(" ","T"));
    if (isNaN(d)) return;
    if (d.getMonth() !== mNow || d.getFullYear() !== yearNow) return;
    const label = r.tramite || "Otros";
    itemsMap.set(label, (itemsMap.get(label)||0) + 1);
    total++;
  });

  const items = Array.from(itemsMap.entries())
    .map(([label, value])=>({ label, value }))
    .sort((a,b)=>b.value - a.value);
  return { items, total };
}

/* ============================================================================
   Visibilidad por rol (reglas)
   ========================================================================== */
function hasAdminRole() {
  const rs = State.session.roles || [];
  return rs.some(r => CONFIG.ADMIN_ROLES.includes(r));
}
function hasRole(code){ // "DIRECTOR", "JEFE", "ANALISTA"
  return (State.session.roles||[]).includes(code);
}
function isPresidencia(){
  return CONFIG.PRESIDENCIA_DEPT_IDS.includes(Number(State.session.dept_id));
}
function isPrimeraLinea(viewerId, deptId){
  const d = getDeptById(deptId);
  // campo según el endpoint: "primera_linea"
  const pl = d?.primera_linea ?? null;
  return Number(pl) === Number(viewerId);
}

/* ============================================================================
   Fetch de datos según reglas
   ========================================================================== */
async function listAllRequerimientos({ perPage=200, maxPages=50 } = {}) {
  const url = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_requerimiento.php";
  const all=[];
  for (let page=1; page<=maxPages; page++){
    const res = await fetch(url, {
      method:"POST",
      headers:{ "Content-Type":"application/json", "Accept":"application/json" },
      body: JSON.stringify({ page, per_page: perPage })
    });
    if (!res.ok) break;
    const json = await res.json();
    const arr = json?.data || [];
    all.push(...arr);
    if (arr.length < perPage) break;
  }
  return all;
}

async function fetchForDirectorOrPrimeraLinea(viewerId, deptId){
  // asignados (yo + subordinados)
  const empleados = await loadEmpleados({ status_empleado:1 });
  const plan = await planScope({ viewerId, viewerDeptId: deptId, empleadosAll: empleados });

  const ids = [plan.mineId, ...(plan.teamIds||[])].filter(Boolean);
  const assignedLists = await Promise.allSettled(ids.map(id => listByAsignado(id, {})));
  const assigned = assignedLists.filter(r=>r.status==="fulfilled").flatMap(r=>r.value||[]);

  // del departamento solo estatus = 2 (asignación)
  const deptAsignList = await listByDepto(deptId, { estatus: 2 });
  // union + dedupe
  const map = new Map();
  assigned.forEach(r => { if (r?.id!=null) map.set(r.id, r); });
  (deptAsignList||[]).forEach(r => { if (r?.id!=null) map.set(r.id, r); });

  return Array.from(map.values())
    .sort((a,b)=> String(b.created_at||"").localeCompare(String(a.created_at||"")) || ((b.id||0)-(a.id||0)));
}

async function fetchForJefeAnalista(viewerId, deptId){
  // Yo + equipo (asignados)
  const empleados = await loadEmpleados({ status_empleado:1 });
  const plan = await planScope({ viewerId, viewerDeptId: deptId, empleadosAll: empleados });
  const ids = [plan.mineId, ...(plan.teamIds||[])].filter(Boolean);
  const assignedLists = await Promise.allSettled(ids.map(id => listByAsignado(id, {})));
  return assignedLists
    .filter(r=>r.status==="fulfilled")
    .flatMap(r=>r.value||[])
    .sort((a,b)=> String(b.created_at||"").localeCompare(String(a.created_at||"")) || ((b.id||0)-(a.id||0)));
}

/* ============================================================================
   Carga principal
   ========================================================================== */
async function loadScopeData(){
  const { empleado_id:viewerId, dept_id } = State.session;
  if (!viewerId){
    warn("viewerId ausente.");
    State.rows=[]; updateLegendTotals(0); updateLegendStatus(); applyPipelineAndRender();
    return;
  }

  // asegurar deps cargados (para nombre y primera_linea)
  if (!State.departamentos.length) await fetchDepartamentos();

  let items = [];
  if (hasAdminRole() || isPresidencia()) {
    log("modo ADMIN/PRESIDENCIA: todo el universo");
    items = await listAllRequerimientos();
  } else if (hasRole("DIRECTOR") || isPrimeraLinea(viewerId, dept_id)) {
    log("modo DIRECTOR / PRIMERA LÍNEA");
    items = await fetchForDirectorOrPrimeraLinea(viewerId, dept_id);
    // OJO: no mostrar 0/1 a personal; la mezcla ya limita depto a estatus=2 y asignados (cualquiera)
  } else { // JEFE / ANALISTA / resto
    log("modo JEFE/ANALISTA (yo + equipo asignados)");
    items = await fetchForJefeAnalista(viewerId, dept_id);
  }

  // Adaptar a UI
  State.rows = items.map(parseReq);

  // No mostrar Solicitud/Revisión a personal no admin/presidencia (si llegaran por asignados)
  if (!(hasAdminRole() || isPresidencia())) {
    State.rows = State.rows.filter(r => r.estatus?.code !== 0 && r.estatus?.code !== 1);
  }

  // Logs preview
  log("items UI-mapped (preview):", State.rows.slice(0,5).map(r=>({id:r.id, tramite:r.tramite, asignado:r.asignado, tel:r.tel, estatus:r.estatus?.label})));

  // Render
  updateLegendTotals(State.rows.length);
  updateLegendStatus();
  computeCounts(State.rows);
  applyPipelineAndRender();
}

/* ============================================================================
   Init
   ========================================================================== */
window.addEventListener("DOMContentLoaded", async ()=>{
  try{
    readSession();
    await fetchDepartamentos();       // para badge y reglas primera_linea
    await hydrateProfileFromSession();

    initSidebar(()=>applyPipelineAndRender());
    initSearch(()=>applyPipelineAndRender());
    buildTable();
    updateLegendStatus();

    await loadScopeData();
    log("Home listo");
  } catch(e){
    err("init error:", e);
  }
});

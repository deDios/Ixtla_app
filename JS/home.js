// /JS/home.js
"use strict";

/* ============================================================================
   CONFIG (ajusta aquí lo que necesites)
   ========================================================================== */
const CONFIG = {
  DEBUG_LOGS: true,
  PAGE_SIZE: 10,
  DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",
  ADMIN_ROLES: ["ADMIN"],
  PRESIDENCIA_DEPT_IDS: [6],
  DEPT_FALLBACK_NAMES: { 6: "Presidencia" },

  // Endpoints “crudos” cuando necesitamos resolver nombres/visiones globales
  API_BASE: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/",
};

const TAG  = "[Home]";
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
  parseReq,
} from "/JS/api/requerimientos.js";

import { createTable } from "/JS/ui/table.js";

// Charts (línea + donut)
import { LineChart } from "/JS/charts/line-chart.js";
import { DonutChart } from "/JS/charts/donut-chart.js";

/* ============================================================================
   Selectores
   ========================================================================== */
const SEL = {
  // Perfil
  avatar:       "#hs-avatar",
  profileName:  "#hs-profile-name",
  profileBadge: "#hs-profile-badge",

  // Sidebar
  statusGroup:  "#hs-states",
  statusItems:  "#hs-states .item",

  // Búsqueda
  searchInput:  "#hs-search",

  // Leyendas
  legendTotal:  "#hs-legend-total",
  legendStatus: "#hs-legend-status",

  // Tabla
  tableWrap:    "#hs-table-wrap",
  tableBody:    "#hs-table-body",
  pager:        "#hs-pager",

  // Charts
  chartYear:    "#chart-year",
  chartMonth:   "#chart-month",
};

const SIDEBAR_KEYS = [
  "todos","pendientes","en_proceso","terminados","cancelados","pausados"
];

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

/* ============================================================================
   Estado
   ========================================================================== */
const State = {
  session: { empleado_id:null, dept_id:null, roles:[], id_usuario:null },
  scopePlan: null,

  universe: [], // crudos originales
  rows: [],     // mapeados a la UI

  filterKey: "todos",
  search: "",

  counts: { todos:0, pendientes:0, en_proceso:0, terminados:0, cancelados:0, pausados:0 },

  table: null,
  __page: 1,
};

/* ============================================================================
   Cookie fallback (por si Session.get falla)
   ========================================================================== */
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
   Resolver nombre de departamento
   ========================================================================== */
async function resolveDeptName(deptId){
  if (CONFIG.DEPT_FALLBACK_NAMES[deptId]) return CONFIG.DEPT_FALLBACK_NAMES[deptId];
  try {
    const url = CONFIG.API_BASE + "ixtla01_c_departamento.php";
    const res = await fetch(url, {
      method:"POST",
      headers:{ "Content-Type":"application/json","Accept":"application/json" },
      body: JSON.stringify({ page:1, page_size:200, status:1 })
    });
    if (!res.ok) throw new Error("HTTP "+res.status);
    const json = await res.json();
    const arr = json?.data || [];
    const found = arr.find(d => Number(d.id) === Number(deptId));
    return found?.nombre || CONFIG.DEPT_FALLBACK_NAMES[deptId] || `Depto ${deptId}`;
  } catch {
    return CONFIG.DEPT_FALLBACK_NAMES[deptId] || `Depto ${deptId}`;
  }
}

/* ============================================================================
   Sesión
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

/* ============================================================================
   Perfil UI
   ========================================================================== */
async function hydrateProfileFromSession(){
  const s = Session?.get?.() || readCookiePayload() || {};
  const nombre = [s?.nombre, s?.apellidos].filter(Boolean).join(" ") || "—";
  setText(SEL.profileName, nombre);

  const badge = $(SEL.profileBadge);
  if (badge){
    const deptName = await resolveDeptName(State.session.dept_id);
    badge.textContent = deptName || "—";
  }

  // Avatar
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

  group.addEventListener("keydown",(e)=>{
    const cur = document.activeElement.closest(".item");
    const idx = Math.max(0, items.indexOf(cur));
    let next = idx;
    if (e.key==="ArrowDown"||e.key==="ArrowRight") next=(idx+1)%items.length;
    if (e.key==="ArrowUp"  ||e.key==="ArrowLeft")  next=(idx-1+items.length)%items.length;
    if (next!==idx){ items[next].focus(); e.preventDefault(); }
    if (e.key===" "||e.key==="Enter"){ items[next].click(); e.preventDefault(); }
  });
}

/* ============================================================================
   Search
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
    },250);
  });
}

/* ============================================================================
   Tabla
   ========================================================================== */
function buildTable(){
  State.table = createTable({
    bodySel: SEL.tableBody,
    wrapSel: SEL.tableWrap,
    pagSel:  null, // usamos nuestro paginador clásico externo
    pageSize: CONFIG.PAGE_SIZE,
    columns: [
      { key:"tramite",  title:"Trámites", sortable:true, accessor:r=>r.asunto||r.tramite||"—" },
      { key:"asignado", title:"Asignado", sortable:true, accessor:r=>r.asignado||"—" },
      { key:"fecha",    title:"Fecha de solicitado", sortable:true,
        accessor:r=> r.creado ? new Date(String(r.creado).replace(" ","T")).getTime() : 0,
        render:(v,r)=> formatDateMX(r.creado)
      },
      { key:"status",   title:"Status", sortable:true,
        accessor:r=> r.estatus?.label || "—",
        render:(v,r)=>{
          const k = catKeyFromCode(r.estatus?.code);
          return `<span class="hs-status" data-k="${k}">${r.estatus?.label||"—"}</span>`;
        }
      }
    ]
  });
  State.table.setPageSize?.(CONFIG.PAGE_SIZE);
  State.table.setSort?.("fecha",-1);
}

/* ============================================================================
   Leyendas / conteos
   ========================================================================== */
function updateLegendTotals(n){ setText(SEL.legendTotal, String(n??0)); }
function updateLegendStatus(){
  const map = { todos:"Todos los status", pendientes:"Pendientes", en_proceso:"En proceso",
                terminados:"Terminados", cancelados:"Cancelados", pausados:"Pausados" };
  setText(SEL.legendStatus, map[State.filterKey] || "Todos los status");
}
function catKeyFromCode(code){
  if (code===3) return "en_proceso";
  if (code===4) return "pausados";
  if (code===5) return "cancelados";
  if (code===6) return "terminados";
  return "pendientes";
}
function computeCounts(rows){
  const c={ todos:0, pendientes:0, en_proceso:0, terminados:0, cancelados:0, pausados:0 };
  rows.forEach(r=>{ c.todos++; const k=catKeyFromCode(r.estatus?.code); if(k in c) c[k]++; });
  State.counts=c;
  setText("#cnt-todos",      `(${c.todos})`);
  setText("#cnt-pendientes", `(${c.pendientes})`);
  setText("#cnt-en_proceso", `(${c.en_proceso})`);
  setText("#cnt-terminados", `(${c.terminados})`);
  setText("#cnt-cancelados", `(${c.cancelados})`);
  setText("#cnt-pausados",   `(${c.pausados})`);
}

/* ============================================================================
   Paginación — usa el estilo/markup clásico de tu HTML (.btn, "Ir a:")
   ========================================================================== */
function renderPagerClassic(total){
  const cont = $(SEL.pager);
  if (!cont) return;

  const pages = Math.max(1, Math.ceil(total / CONFIG.PAGE_SIZE));
  const cur   = Math.min(Math.max(1, State.__page || 1), pages);

  const btn = (label, p, extra="") =>
    `<button class="btn ${extra}" data-p="${p}" ${p==="disabled"?"disabled":""}>${label}</button>`;

  // números 1..pages
  let nums = "";
  for (let i=1; i<=pages; i++){
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

  // wire (sin rehacer filtros)
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
   Gaps + binds (para la página actual)
   ========================================================================== */
function refreshCurrentPageDecorations(){
  const tbody = $(SEL.tableBody);
  if (!tbody) return;

  // Limpia gaps previos
  tbody.querySelectorAll("tr.hs-gap").forEach(tr => tr.remove());

  const pageRows = State.table?.getRawRows?.() || [];
  const realCount = pageRows.length;
  const gaps = Math.max(0, CONFIG.PAGE_SIZE - realCount);

  // Re-bind filas reales
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

  // Inserta gaps visuales
  if (gaps>0){
    let html="";
    for (let i=0;i<gaps;i++){
      html += `<tr class="hs-gap" aria-hidden="true"><td colspan="4">&nbsp;</td></tr>`;
    }
    tbody.insertAdjacentHTML("beforeend", html);
  }

  log("gaps añadidos:", gaps, "reales en página:", realCount);
}

/* ============================================================================
   Pipeline + render
   ========================================================================== */
function applyPipelineAndRender(){
  const all = State.rows || [];
  let filtered = all;

  if (State.filterKey !== "todos") {
    filtered = filtered.filter(r => catKeyFromCode(r.estatus?.code) === State.filterKey);
  }
  if (State.search) {
    const q = State.search;
    filtered = filtered.filter(r=>{
      const asunto=(r.asunto||"").toLowerCase();
      const asign =(r.asignado||"").toLowerCase();
      const est   =(r.estatus?.label||"").toLowerCase();
      const folio =(r.folio||"").toLowerCase();
      return asunto.includes(q)||asign.includes(q)||est.includes(q)||folio.includes(q);
    });
  }

  computeCounts(all);
  updateLegendTotals(filtered.length);

  const rows = filtered.map(r=>({
    __raw:r, asunto:r.asunto, tramite:r.tramite, asignado:r.asignado, creado:r.creado, estatus:r.estatus
  }));

  State.table?.setData(rows);
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
}

/* ============================================================================
   Jerarquía — logs bonitos
   ========================================================================== */
async function logHierarchy(plan){
  try{
    if (!plan) return;
    const empleados = await loadEmpleados({ status_empleado:1 });
    const byId = new Map(empleados.map(e=>[e.id,e]));
    const full = e => e ? [e.nombre, e.apellidos].filter(Boolean).join(" ") : "—";

    const principal = byId.get(plan.viewerId);
    const subs = (plan.teamIds||[]).map(id=>{
      const emp = byId.get(id);
      return { id, nombre: full(emp), depto: emp?.departamento_id ?? null, username: emp?.cuenta?.username || null };
    });

    log("USUARIO PRINCIPAL:", { id:plan.viewerId, nombre:full(principal), depto:principal?.departamento_id ?? null, role:plan.role, isAdmin:!!plan.isAdmin });
    log("SUBORDINADOS (deep):", { total:subs.length, items:subs });
  } catch(e){ warn("No se pudo loggear jerarquía:", e); }
}

/* ============================================================================
   Visiones de datos
   - ADMIN / Presidencia: “todos”
   - Primera línea: “todos del departamento”
   - Resto: yo + subordinados
   ========================================================================== */
async function fetchAllRequerimientos(perPage=200, maxPages=50){
  const url = CONFIG.API_BASE + "ixtla01_c_requerimiento.php";
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

async function fetchMineAndTeam(plan){
  const ids = [plan.mineId, ...(plan.teamIds||[])].filter(Boolean);
  const results = await Promise.allSettled(ids.map(id => listByAsignado(id, {})));
  const lists = results.filter(r=>r.status==="fulfilled").map(r=>r.value||[]);
  const map = new Map();
  lists.flat().forEach(r=>{ if (r?.id!=null) map.set(r.id, r); });
  return Array.from(map.values()).sort((a,b)=>
    String(b.created_at||"").localeCompare(String(a.created_at||"")) || ((b.id||0)-(a.id||0))
  );
}

async function isPrimeraLinea(empleadoId, deptId){
  try{
    const url = CONFIG.API_BASE + "ixtla01_c_departamento.php";
    const res = await fetch(url, {
      method:"POST",
      headers:{ "Content-Type":"application/json","Accept":"application/json" },
      body: JSON.stringify({ page:1, page_size:200, all:true })
    });
    if (!res.ok) return false;
    const json = await res.json();
    const d = (json?.data||[]).find(x => Number(x.id)===Number(deptId));
    return Number(d?.primera_linea) === Number(empleadoId);
  } catch { return false; }
}

/* ============================================================================
   Carga principal
   ========================================================================== */
async function loadScopeData(){
  const { empleado_id:viewerId, dept_id } = State.session;
  if (!viewerId){
    warn("viewerId ausente.");
    State.universe=[]; State.rows=[];
    computeCounts([]); updateLegendTotals(0); updateLegendStatus(); applyPipelineAndRender();
    return;
  }

  const plan = await planScope({ viewerId, viewerDeptId: dept_id });
  State.scopePlan = plan;

  const isAdmin = (State.session.roles||[]).some(r=>CONFIG.ADMIN_ROLES.includes(r));
  const isPres  = CONFIG.PRESIDENCIA_DEPT_IDS.includes(Number(dept_id));
  const isLinea = await isPrimeraLinea(viewerId, dept_id);

  await logHierarchy(plan);

  let items=[];
  if (isAdmin || isPres){
    log("modo ADMIN/PRESIDENCIA: fetch global…");
    items = await fetchAllRequerimientos();
  } else if (isLinea){
    log("modo PRIMERA LÍNEA (depto): fetch global y filtro por departamento…");
    const all = await fetchAllRequerimientos();
    items = all.filter(r => Number(r.departamento_id) === Number(dept_id));
  } else {
    log("modo subordinados: yo + team…");
    items = await fetchMineAndTeam(plan);
  }

  State.universe = items.slice();
  State.rows = State.universe.map(parseReq);

  log("items UI-mapped (preview):",
    State.rows.slice(0,5).map(r=>({id:r.id, folio:r.folio, asignado:r.asignado, estatus:r.estatus?.label}))
  );

  computeCounts(State.rows);
  updateLegendTotals(State.rows.length);
  updateLegendStatus();
  applyPipelineAndRender();

  // Charts una vez que hay datos (quita skeletons si existen)
  initCharts();
}

/* ============================================================================
   Charts
   ========================================================================== */
function hideSiblingSkeleton(canvas){
  const wrap = canvas?.parentElement;
  const sk = wrap?.querySelector?.(".hs-chart-skeleton");
  if (sk) sk.remove();
}

function initCharts(){
  // Línea (año)
  const cYear = $(SEL.chartYear);
  if (cYear){
    const series = JSON.parse(cYear.getAttribute("data-series-year") || "[]");
    const labels = JSON.parse(cYear.getAttribute("data-labels-year") || "[]");
    new LineChart(cYear, { labels, series, color: "#4f6b95" });
    hideSiblingSkeleton(cYear);
  }

  // Donut (mes) — pasamos deptId para que pueda auto-ajustar claves si lo necesita
  const cMonth = $(SEL.chartMonth);
  if (cMonth){
    const raw = JSON.parse(cMonth.getAttribute("data-donut") || "[]");
    new DonutChart(cMonth, {
      data: raw,
      legendSelector: "#donut-legend",
      centerText: true,
      deptId: State.session.dept_id
    });
    hideSiblingSkeleton(cMonth);
  }
}

/* ============================================================================
   Init
   ========================================================================== */
window.addEventListener("DOMContentLoaded", async ()=>{
  try{
    readSession();
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

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
  PRESIDENCIA_DEPT_IDS: [6],
  DEPT_FALLBACK_NAMES: { 6: "Presidencia" },

  API_BASE: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/",

  CHARTS: {
    enable: true,
    // línea (año)
    linePadding: 24,        // px (aprox del chart interno)
    lineCanvas:   "#chart-year",
    lineTip:      ".chart-tip",
    lineSkeleton: "#chart-year ~ .hs-chart-skeleton",
    // donut (mes)
    donutCanvas:   "#chart-month",
    donutLegend:   "#chart-month-legend", // opcional; si no existe, DonutSmart genera la suya
    donutSkeleton: "#chart-month ~ .hs-chart-skeleton",
  }
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
import { DonutSmart } from "/JS/charts/donut-chart.js"; // ← moderno

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
};

const SIDEBAR_KEYS = ["todos","pendientes","en_proceso","terminados","cancelados","pausados"];

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
  universe: [],
  rows: [],
  filterKey: "todos",
  search: "",
  counts: { todos:0, pendientes:0, en_proceso:0, terminados:0, cancelados:0, pausados:0 },
  table: null,
  __page: 1,
};

/* ============================================================================
   Depto name
   ========================================================================== */
async function resolveDeptName(deptId){
  if (CONFIG.DEPT_FALLBACK_NAMES[deptId]) return CONFIG.DEPT_FALLBACK_NAMES[deptId];
  try {
    const url = CONFIG.API_BASE + "ixtla01_c_departamento.php";
    const res = await fetch(url, {
      method:"POST",
      headers:{ "Content-Type":"application/json","Accept":"application/json" },
      body: JSON.stringify({ all:true, page:1, page_size:200 })
    });
    if (!res.ok) throw new Error("HTTP "+res.status);
    const json = await res.json();
    const arr  = json?.data || [];
    const f    = arr.find(d => Number(d.id) === Number(deptId));
    return f?.nombre || `Depto ${deptId}`;
  } catch {
    return `Depto ${deptId}`;
  }
}

/* ============================================================================
   Sesión + Perfil
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
   Tabla + paginación
   ========================================================================== */
function buildTable(){
  State.table = createTable({
    bodySel: SEL.tableBody,
    wrapSel: SEL.tableWrap,
    pagSel:  null,
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

function renderPagerClassic(total){
  const cont = $(SEL.pager);
  if (!cont) return;

  const pages = Math.max(1, Math.ceil(total / CONFIG.PAGE_SIZE));
  const cur   = Math.min(Math.max(1, State.__page || 1), pages);

  const btn = (label, p, extra="") =>
    `<button class="btn ${extra}" data-p="${p}" ${p==="disabled"?"disabled":""}>${label}</button>`;

  // números continuos (si prefieres ventana, limita aquí)
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

function refreshCurrentPageDecorations(){
  const tbody = $(SEL.tableBody);
  if (!tbody) return;

  // quitar gaps previos
  tbody.querySelectorAll("tr.hs-gap").forEach(tr => tr.remove());

  const pageRows = State.table?.getRawRows?.() || [];
  const realCount = pageRows.length;
  const gaps = Math.max(0, CONFIG.PAGE_SIZE - realCount);

  // des-bind de filas previas y bind nuevas (solo reales)
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

  // mapeo
  const rows = filtered.map(r=>({
    __raw:r, asunto:r.asunto, tramite:r.tramite, asignado:r.asignado, creado:r.creado, estatus:r.estatus
  }));

  // setData y reset page
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

  // charts (si quieres que sigan al filtrado, usa `filtered` en vez de `State.rows`)
  if (CONFIG.CHARTS.enable) {
    updateCharts(State.rows);
  }
}

/* ============================================================================
   Charts
   ========================================================================== */
function hideSkeleton(selectorOrEl){
  const el = typeof selectorOrEl === "string" ? $(selectorOrEl) : selectorOrEl;
  if (el) el.style.display = "none";
}

// Serie anual (counts por mes del año actual)
function computeYearSeries(rawItems){
  const now = new Date(); const y = now.getFullYear();
  const counts = new Array(12).fill(0);
  rawItems.forEach(r=>{
    const d = new Date(String(r.created_at || r.creado).replace(" ", "T"));
    if (!isNaN(d) && d.getFullYear() === y) counts[d.getMonth()] += 1;
  });
  const labels = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return { labels, counts };
}

// Hover simple para el line chart (independiente del módulo)
function attachLineHover(canvas, tipEl, labels, counts){
  if (!canvas || !tipEl) return;
  const pad = CONFIG.CHARTS.linePadding;
  const N = labels.length;
  const rectCache = () => canvas.getBoundingClientRect();

  function showTip(e){
    const rect = rectCache();
    const x = e.clientX - rect.left;
    const innerW = Math.max(1, canvas.width - pad*2);
    const ratio = (x - pad) / innerW;
    const idx = Math.min(N-1, Math.max(0, Math.round(ratio * (N-1))));
    const val = counts[idx] ?? 0;

    tipEl.style.opacity = "1";
    tipEl.textContent = `${labels[idx]}: ${val}`;
    tipEl.style.left = `${e.clientX - rect.left}px`;
    tipEl.style.top  = `${e.clientY - rect.top}px`;
  }
  function hideTip(){ tipEl.style.opacity = "0"; }

  canvas.addEventListener("mousemove", showTip);
  canvas.addEventListener("mouseleave", hideTip);
}

async function updateCharts(rawItems){
  // Línea (año)
  try {
    const canvas = $(CONFIG.CHARTS.lineCanvas);
    if (canvas){
      const { labels, counts } = computeYearSeries(rawItems);

      // Si tu line-chart.js expone una API update({labels, data}) úsala aquí.
      // Como es externo, solo seteamos data-attributes (back-compat)…
      canvas.dataset.labelsYear = JSON.stringify(labels);
      canvas.dataset.seriesYear = JSON.stringify(counts);

      // Quitamos skeleton visualmente
      const sk = $(CONFIG.CHARTS.lineSkeleton);
      hideSkeleton(sk);

      // Hover tip
      const tip = canvas.parentElement?.querySelector(CONFIG.CHARTS.lineTip) || null;
      attachLineHover(canvas, tip, labels, counts);
    }
  } catch(e){ warn("line chart update:", e); }

  // Donut (mes actual, por trámite)
  try {
    const donut = new DonutSmart({
      canvas:   CONFIG.CHARTS.donutCanvas,
      legend:   CONFIG.CHARTS.donutLegend,    // opcional
      skeleton: CONFIG.CHARTS.donutSkeleton,
      scopeType: (State.session.roles||[]).some(r=>CONFIG.ADMIN_ROLES.includes(r)) ||
                 CONFIG.PRESIDENCIA_DEPT_IDS.includes(Number(State.session.dept_id))
                 ? "global" : "dept",
      deptId: State.session.dept_id
    });
    await donut.update(rawItems); // le pasamos los crudos/universe
  } catch(e){ warn("donut chart update:", e); }
}

/* ============================================================================
   Jerarquía logs
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
   Fetch scope
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

  await logHierarchy(plan);

  let items=[];
  if (isAdmin || isPres){
    log("modo ADMIN/PRESIDENCIA: fetch global…");
    items = await fetchAllRequerimientos();
  } else {
    log("modo subordinados: yo + team…");
    items = await fetchMineAndTeam(plan);
  }

  State.universe = items.slice();
  State.rows = State.universe.map(parseReq);

  log("items UI-mapped (preview):", State.rows.slice(0,5).map(r=>({id:r.id, folio:r.folio, asignado:r.asignado, estatus:r.estatus?.label})));

  computeCounts(State.rows);
  updateLegendTotals(State.rows.length);
  updateLegendStatus();
  applyPipelineAndRender();
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

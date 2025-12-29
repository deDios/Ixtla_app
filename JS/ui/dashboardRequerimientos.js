// /JS/ui/dashboardRequerimientos.js
const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

/* ===== Endpoints =====
   Ajusta si ya tienes nombres específicos.
   - c_departamento.php debe devolver una lista: [{id:1,nombre:"SAMAPA"}, ...]
   - El resto como se describió antes.
*/
const API = {
  departamentos: "/db/web/c_departamento.php",
  byTramite:    "/db/web/req_stats_by_tramite.php",
  byStatus:     "/db/web/req_stats_by_status.php",
  openClosed:   "/db/web/req_stats_open_closed.php",
  // Si prefieres un solo overview, podrías agregar:
  // overview: "/db/web/req_stats_overview.php"
};

/* ===== Estatus fijos 0..6 ===== */
const STATUS = [
  { id:0, label:"Solicitud"   },
  { id:1, label:"Revisión"    },
  { id:2, label:"Asignación"  },
  { id:3, label:"En proceso"  },
  { id:4, label:"Pausado"     },
  { id:5, label:"Cancelado"   },
  { id:6, label:"Finalizado"  }
];

/* ===== Estado de filtros ===== */
let state = {
  departamento_id: "",         // vacío = Todos
  month: ""                    // YYYY-MM
};

/* ===== Helpers ===== */
function qs(paramsObj){
  const p = new URLSearchParams();
  if (paramsObj.departamento_id) p.set("departamento_id", paramsObj.departamento_id);
  if (paramsObj.month)           p.set("month", paramsObj.month);
  const q = p.toString();
  return q ? `?${q}` : "";
}
async function fetchJSON(url){
  const r = await fetch(url, { credentials:"include" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/* ===== Chips de Departamentos ===== */
function buildDeptChips(items){
  const wrap = $("#chips-departamentos");
  wrap.innerHTML = "";

  // Chip "Todos"
  const all = document.createElement("button");
  all.type = "button";
  all.role = "tab";
  all.className = "ix-chip";
  all.dataset.deptId = "";
  all.setAttribute("aria-selected", state.departamento_id === "" ? "true" : "false");
  all.innerHTML = `Todos`;
  wrap.appendChild(all);

  items.forEach(it=>{
    const b = document.createElement("button");
    b.type = "button";
    b.role = "tab";
    b.className = "ix-chip";
    b.dataset.deptId = String(it.id);
    b.setAttribute("aria-selected", state.departamento_id === String(it.id) ? "true" : "false");
    b.innerHTML = `<span class="ix-name">${it.nombre ?? "Depto"}</span>`;
    wrap.appendChild(b);
  });

  wrap.addEventListener("click", ev=>{
    const btn = ev.target.closest(".ix-chip");
    if (!btn) return;
    const id = btn.dataset.deptId ?? "";
    if (id === state.departamento_id) return;

    state.departamento_id = id;
    // actualizar aria-selected
    $$(".ix-chip", wrap).forEach(c=>c.setAttribute("aria-selected", c===btn ? "true":"false"));
    loadAll().catch(console.error);
  });

  // navegación por teclado (izq/der)
  wrap.addEventListener("keydown", ev=>{
    if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
    const chips = $$(".ix-chip", wrap);
    const i = chips.findIndex(c=>c.getAttribute("aria-selected")==="true");
    let j = i >= 0 ? i : 0;
    j = ev.key === "ArrowRight" ? Math.min(j+1, chips.length-1) : Math.max(j-1, 0);
    chips[j].focus();
    chips[j].click();
    ev.preventDefault();
  });
}

/* ===== Tabla por trámite ===== */
function paintTableByTramite(rows){
  const body = $("#tbl-tramites-body");
  body.innerHTML = "";
  if (!rows?.length){
    const empty = document.createElement("div");
    empty.className = "ix-row";
    empty.innerHTML = `<div>Sin datos</div><div class="ta-right">0</div>`;
    body.appendChild(empty);
    $("#meta-tramites").textContent = "";
    return;
  }
  const total = rows.reduce((a,r)=>a + Number(r.total||0), 0);
  $("#meta-tramites").textContent = `Total: ${total}`;

  const frag = document.createDocumentFragment();
  rows.forEach(r=>{
    const row = document.createElement("div");
    row.className = "ix-row";
    row.innerHTML = `<div>${r.tramite ?? "—"}</div><div class="ta-right">${Number(r.total||0)}</div>`;
    frag.appendChild(row);
  });
  body.appendChild(frag);
}

/* ===== Tarjetas por estatus ===== */
function paintCardsByStatus(map){
  const wrap = $("#cards-estatus");
  wrap.innerHTML = "";
  const total = STATUS.reduce((a,s)=>a + Number(map?.[s.id] ?? 0), 0);
  $("#meta-estatus").textContent = `Total: ${total}`;

  const frag = document.createDocumentFragment();
  STATUS.forEach(s=>{
    const n = Number(map?.[s.id] ?? 0);
    const card = document.createElement("div");
    card.className = "ix-badge";
    card.innerHTML = `<span>${s.label}</span><span class="n">${n}</span>`;
    frag.appendChild(card);
  });
  wrap.appendChild(frag);
}

/* ===== Donut Abiertos/Cerrados ===== */
function paintDonutOpenClosed(data){
  const abiertos = Number(data?.abiertos ?? 0);
  const cerrados = Number(data?.cerrados ?? 0);
  const total = Math.max(1, abiertos + cerrados);

  $("#meta-openclose").textContent = `Total: ${abiertos+cerrados}`;

  const canvas = $("#donut-open-close");
  const ctx = canvas.getContext("2d");
  const cx = canvas.width/2, cy = canvas.height/2, r = Math.min(cx,cy)-8;
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const drawSlice = (start, frac) => {
    const end = start + frac * Math.PI*2;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,end); ctx.closePath(); ctx.fill();
    return end;
  };

  // Abiertos
  ctx.fillStyle = "#22c55e";
  let ang = drawSlice(-Math.PI/2, abiertos/total);
  // Cerrados
  ctx.fillStyle = "#475569";
  drawSlice(ang, cerrados/total);

  // agujero
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath(); ctx.arc(cx,cy, r*0.55, 0, Math.PI*2); ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // leyenda
  const legend = $("#legend-open-close");
  legend.innerHTML = `
    <div><span class="ix-dot open"></span><strong>Abiertos:</strong> ${abiertos}</div>
    <div><span class="ix-dot closed"></span><strong>Cerrados:</strong> ${cerrados}</div>
  `;
}

/* ===== Carga de datos ===== */
async function loadAll(){
  const q = qs(state);

  // Opción con 3 endpoints
  const [byTramite, byStatus, openClosed] = await Promise.all([
    fetchJSON(`${API.byTramite}${q}`),
    fetchJSON(`${API.byStatus}${q}`),
    fetchJSON(`${API.openClosed}${q}`)
  ]);

  paintTableByTramite(byTramite?.data || byTramite || []);
  paintCardsByStatus(byStatus?.data || byStatus || {});
  paintDonutOpenClosed(openClosed?.data || openClosed || {});
}

/* ===== Inicializar filtros ===== */
function initFilters(){
  // Mes
  const mes = $("#filtro-mes");
  mes.addEventListener("change", ()=>{
    state.month = mes.value || "";
    loadAll().catch(console.error);
  });
}

/* ===== Cargar departamentos y armar chips ===== */
async function initDepartments(){
  try{
    const data = await fetchJSON(API.departamentos);
    // Normaliza posibles formatos: {data:[...]} o [...]
    const list = Array.isArray(data) ? data : (data?.data || []);
    // Espera objetos {id, nombre}
    buildDeptChips(list);
  }catch(e){
    console.error("[dashboard] departamentos:", e);
    // Si falla, al menos pinta el chip "Todos"
    buildDeptChips([]);
  }
}

/* ===== Boot ===== */
document.addEventListener("DOMContentLoaded", async ()=>{
  initFilters();
  await initDepartments();
  await loadAll().catch(console.error);
});

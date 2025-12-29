/* Dashboard de Requerimientos (v3) */
(function () {
  const API = {
    departamentos: "/db/web/ixtla01_c_departamentos.php",   // POST JSON (no se toca)
    byTramite:     "/db/web/req_stats_by_tramite.php",       // POST JSON -> tramite, abiertos, cerrados, total
    byStatus:      "/db/web/req_stats_by_status.php",        // GET
    openClosed:    "/db/web/req_stats_open_closed.php",      // GET
  };

  const $chipsWrap   = document.querySelector("#chips-departamentos");
  const $monthInput  = document.querySelector("#filtro-mes");

  // Tabla
  const $tblBody     = document.querySelector("#tbl-tramites-body");

  // Estatus
  const $cardsEstatus = document.querySelector("#cards-estatus");
  const STATUS_LABELS = [
    "Solicitud","Revisión","Asignación","En proceso","Pausado","Cancelado","Finalizado"
  ];

  // Donut
  const $donutCanvas = document.querySelector("#donut-open-close");
  const $legendOC    = document.querySelector("#legend-open-close");

  let currentDept  = null; // null = Todos
  let currentMonth = null; // "YYYY-MM" o null
  let donutCache   = { abiertos:0, cerrados:0 };

  async function fetchJSON(url, opts = undefined) {
    const method  = (opts && opts.method) || "GET";
    const hasBody = opts && "body" in opts;
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...(opts && opts.headers) },
      body: hasBody ? JSON.stringify(opts.body) : undefined,
      credentials: "include",
    });
    if (!r.ok) { throw new Error(`HTTP ${r.status} ${url}`); }
    return r.json();
  }
  const escapeHTML = s => (s==null?"":String(s)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;"));

  const qs = o => {
    const sp = new URLSearchParams();
    Object.entries(o).forEach(([k,v]) => { if (v!==null && v!==undefined && v!=="") sp.append(k,String(v)); });
    return sp.toString();
  };

  // Chips
  function buildDeptChips(list) {
    $chipsWrap.innerHTML = "";
    const make = (id,label,selected) => {
      const b = document.createElement("button");
      b.type="button"; b.className="ix-chip"; b.setAttribute("role","tab");
      b.setAttribute("aria-selected", selected?"true":"false");
      b.dataset.dept = id==null ? "" : String(id);
      b.textContent = label;
      b.addEventListener("click", () => {
        $chipsWrap.querySelectorAll(".ix-chip").forEach(x=>x.setAttribute("aria-selected","false"));
        b.setAttribute("aria-selected","true");
        currentDept = (id==null?null:String(id));
        reloadAll();
      });
      return b;
    };
    $chipsWrap.appendChild(make(null,"Todos",true));
    (list||[]).forEach(d => $chipsWrap.appendChild(make(d.id, d.nombre, false)));
  }
  async function initDepartments() {
    try {
      const resp = await fetchJSON(API.departamentos,{ method:"POST", body:{ all:true, status:1, per_page:500 }});
      const list = Array.isArray(resp?.data) ? resp.data.map(d=>({id:d.id, nombre:d.nombre})) : [];
      buildDeptChips(list);
    } catch { buildDeptChips([]); }
  }

  // Tabla
  function renderTable(rows) {
    $tblBody.innerHTML = "";
    if (!Array.isArray(rows) || !rows.length) return;
    const frag = document.createDocumentFragment();
    rows.forEach(r => {
      const row = document.createElement("div");
      row.className = "ix-row ix-row--4cols";
      row.innerHTML = `
        <div>${escapeHTML(r.tramite)}</div>
        <div class="ta-right">${Number(r.abiertos||0)}</div>
        <div class="ta-right">${Number(r.cerrados||0)}</div>
        <div class="ta-right">${Number(r.total||0)}</div>
      `;
      frag.appendChild(row);
    });
    $tblBody.appendChild(frag);
  }
  async function loadByTramite() {
    const resp = await fetchJSON(API.byTramite, {
      method:"POST",
      body:{ departamento_id: currentDept?Number(currentDept):null, month: currentMonth||null }
    });
    renderTable(Array.isArray(resp?.data)?resp.data:[]);
  }

  // Estatus
  function ensureStatusCards() {
    if ($cardsEstatus.dataset.built==="1") return;
    $cardsEstatus.innerHTML="";
    const frag=document.createDocumentFragment();
    for (let i=0;i<=6;i++){
      const card=document.createElement("div");
      card.className="ix-badge";
      card.innerHTML=`<div>${STATUS_LABELS[i]}</div><div class="n" id="stat_${i}">0</div>`;
      frag.appendChild(card);
    }
    $cardsEstatus.appendChild(frag);
    $cardsEstatus.dataset.built="1";
  }
  function renderStatus(map){
    ensureStatusCards();
    for (let i=0;i<=6;i++){
      const el=document.querySelector(`#stat_${i}`);
      if (el) el.textContent = String(Number(map?.[i]||0));
    }
  }
  async function loadByStatus(){
    const url = `${API.byStatus}?${qs({departamento_id: currentDept?Number(currentDept):null, month: currentMonth||""})}`;
    const resp = await fetchJSON(url);
    const map = Array.isArray(resp)?resp.reduce((a,v,i)=>(a[i]=v,a),{}):resp;
    renderStatus(map||{});
  }

  // Donut
  function drawDonut(a,c){
    if (!$donutCanvas) return;
    const ctx=$donutCanvas.getContext("2d");
    const w=$donutCanvas.width,h=$donutCanvas.height,cx=w/2,cy=h/2,r=Math.min(w,h)/2-8,inner=r*.6;
    ctx.clearRect(0,0,w,h);
    const total=Math.max(0,(a||0)+(c||0)); const af=total?(a/total):0; const cf=total?(c/total):0;
    const arc=(start,frac,color)=>{const end=start+frac*Math.PI*2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,start,end);ctx.closePath();ctx.fillStyle=color;ctx.fill();return end;};
    let ang=-Math.PI/2; ang=arc(ang,af,"#22c55e"); arc(ang,cf,"#475569");
    ctx.globalCompositeOperation="destination-out"; ctx.beginPath(); ctx.arc(cx,cy,inner,0,Math.PI*2); ctx.fill(); ctx.globalCompositeOperation="source-over";
    ctx.fillStyle="#0f172a"; ctx.font="700 22px system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,Helvetica,Arial"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(String(total),cx,cy);
    if ($legendOC){ $legendOC.innerHTML = `
      <div><span class="ix-dot open"></span>Abiertos: <strong>${a||0}</strong></div>
      <div><span class="ix-dot closed"></span>Cerrados: <strong>${c||0}</strong></div>`; }
  }
  function renderOpenClosed(p){ const abiertos=Number(p?.abiertos||0), cerrados=Number(p?.cerrados||0); donutCache={abiertos,cerrados}; drawDonut(abiertos,cerrados); }
  async function loadOpenClosed(){
    const url = `${API.openClosed}?${qs({departamento_id: currentDept?Number(currentDept):null, month: currentMonth||""})}`;
    const resp = await fetchJSON(url); renderOpenClosed(resp||{});
  }

  async function reloadAll(){ await Promise.all([loadByTramite(), loadByStatus(), loadOpenClosed()]); }

  document.addEventListener("DOMContentLoaded", async ()=>{
    if ($monthInput){ $monthInput.addEventListener("change", ()=>{ currentMonth=($monthInput.value||"").trim()||null; reloadAll(); }); }
    await initDepartments(); await reloadAll();
    window.addEventListener("resize", ()=> drawDonut(donutCache.abiertos, donutCache.cerrados));
  });
})();

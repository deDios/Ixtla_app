/* Dashboard de Requerimientos (v5 con filtro por trámite) */
(function () {
  const API = {
    departamentos: "/db/web/ixtla01_c_departamentos.php",   // POST JSON
    byTramite:     "/db/web/req_stats_by_tramite.php",       // POST JSON
    byStatus:      "/db/web/req_stats_by_status.php",        // GET
    openClosed:    "/db/web/req_stats_open_closed.php",      // GET
  };

  // Estado global de filtros (compartido con el mapa)
  if (!window.ixFilters) window.ixFilters = { tramite: null };

  const $chipsWrap   = document.querySelector("#chips-departamentos");
  const $monthInput  = document.querySelector("#filtro-mes");

  // Tabla
  const $tblBody     = document.querySelector("#tbl-tramites-body");

  // Estatus
  const $cardsEstatus = document.querySelector("#cards-estatus");
  const STATUS_LABELS = [
    "Solicitud","Revisión","Asignación","En proceso","Pausado","Cancelado","Finalizado"
  ];

  // Donuts
  const $donut1 = document.querySelector("#donut-open-close");      // si existe
  const $legend1= document.querySelector("#legend-open-close");
  const $donut2 = document.querySelector("#donut-open-close-2");     // replicado (bajo estatus)
  const $legend2= document.querySelector("#legend-open-close-2");

  let currentDept  = null;   // number | null
  let currentMonth = null;   // "YYYY-MM" | null
  let donutCache   = { abiertos:0, cerrados:0 };

  // —— Utilidades
  async function fetchJSON(url, opts = undefined) {
    const method  = (opts && opts.method) || "GET";
    const hasBody = opts && "body" in opts;
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...(opts && opts.headers) },
      body: hasBody ? JSON.stringify(opts.body) : undefined,
      credentials: "include",
    });
    if (!r.ok) { const t = await r.text().catch(()=> ""); throw new Error(`HTTP ${r.status} ${url} :: ${t}`); }
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

  // —— Publicar evento de cambio de filtros
  function publishFiltersChanged(source){
    window.dispatchEvent(new CustomEvent('ix:filters-changed', {
      detail: { source, tramite: window.ixFilters.tramite, dept: currentDept, month: currentMonth }
    }));
  }

  // —— Chips (Departamentos)
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
        currentDept = (id==null?null:Number(id));
        // Si cambian dept/mes, mantenemos el tramite seleccionado (si aplica)
        reloadAll();
        publishFiltersChanged('dept-chip');
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

  // —— Tabla de trámites (clicable)
  function renderTable(rows) {
    $tblBody.innerHTML = "";
    if (!Array.isArray(rows) || !rows.length) return;

    const selected = window.ixFilters.tramite || null;

    const frag = document.createDocumentFragment();
    rows.forEach(r => {
      const row = document.createElement("div");
      row.className = "ix-row ix-row--4cols";
      if (selected && String(r.tramite).trim() === String(selected).trim()) {
        row.classList.add('ix-row--selected');
      }
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

  function hookTableSelection(){
    if (!$tblBody) return;
    // Delegación de eventos
    $tblBody.addEventListener('click', (ev) => {
      const row = ev.target.closest('.ix-row');
      if (!row) return;

      const titleCell = row.querySelector(':scope > div:first-child');
      const clickedTramite = (titleCell?.textContent || '').trim() || null;

      // Toggle selección
      const wasSelected = row.classList.contains('ix-row--selected');
      $tblBody.querySelectorAll('.ix-row.ix-row--selected').forEach(x=>x.classList.remove('ix-row--selected'));
      if (!wasSelected && clickedTramite) {
        row.classList.add('ix-row--selected');
        window.ixFilters.tramite = clickedTramite;
      } else {
        window.ixFilters.tramite = null;
      }
      // Notificar a mapa y donuts
      publishFiltersChanged('tramites-table');
      // Donuts se recargan aquí; la tabla no necesita recargar
      loadByStatus().catch(console.error);
      loadOpenClosed().catch(console.error);
    });
  }

  async function loadByTramite() {
    const resp = await fetchJSON(API.byTramite, {
      method:"POST",
      body:{
        departamento_id: currentDept ?? null,
        month: currentMonth || null
      }
    });
    renderTable(Array.isArray(resp?.data)?resp.data:[]);
  }

  // —— Estatus
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
    const url = `${API.byStatus}?${qs({
      departamento_id: currentDept ?? null,
      month: currentMonth || "",
      tramite: window.ixFilters.tramite || ""
    })}`;
    const resp = await fetchJSON(url);
    const map = Array.isArray(resp)?resp.reduce((a,v,i)=>(a[i]=v,a),{}):resp;
    renderStatus(map||{});
  }

  // —— Donut base (sin etiquetas)
  function drawDonut(canvas, legend, a, c){
    if (!canvas) return;
    const ctx=canvas.getContext("2d");
    const w=canvas.width,h=canvas.height,cx=w/2,cy=h/2,r=Math.min(w,h)/2-8,inner=r*.6;
    ctx.clearRect(0,0,w,h);
    const total=Math.max(0,(a||0)+(c||0)); const af=total?(a/total):0; const cf=total?(c/total):0;
    const arc=(start,frac,color)=>{const end=start+frac*Math.PI*2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,start,end);ctx.closePath();ctx.fillStyle=color;ctx.fill();return end;};
    let ang=-Math.PI/2; ang=arc(ang,af,"#22c55e"); arc(ang,cf,"#475569");
    ctx.globalCompositeOperation="destination-out"; ctx.beginPath(); ctx.arc(cx,cy,inner,0,Math.PI*2); ctx.fill(); ctx.globalCompositeOperation="source-over";
    ctx.fillStyle="#0f172a"; ctx.font="700 22px system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,Helvetica,Arial"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(String(total),cx,cy);
    if (legend){ legend.innerHTML = `
      <div><span class="ix-dot open"></span>Abiertos: <strong>${a||0}</strong></div>
      <div><span class="ix-dot closed"></span>Cerrados: <strong>${c||0}</strong></div>`; }
  }

  // —— Donut con etiquetas (cantidad y %)
  function drawDonutWithLabels(canvas, legend, a, c){
    if (!canvas) return;
    drawDonut(canvas, legend, a, c); // base

    const ctx=canvas.getContext("2d");
    const w=canvas.width,h=canvas.height,cx=w/2,cy=h/2,r=Math.min(w,h)/2-8;
    const total=Math.max(0,(a||0)+(c||0));
    if (!total) return;

    const segs = [
      { value:a||0, color:"#22c55e", label:"Abiertos" },
      { value:c||0, color:"#475569", label:"Cerrados" }
    ];

    let start = -Math.PI/2;
    ctx.font = "600 12px system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,Helvetica,Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(15,23,42,.25)";
    ctx.lineWidth = 1;

    segs.forEach(seg=>{
      const frac = seg.value/total;
      if (frac <= 0) return;
      const mid = start + frac*Math.PI;   // ángulo medio
      start += frac*2*Math.PI;

      const rOut = r * 0.88;
      const x0 = cx + Math.cos(mid) * rOut;
      const y0 = cy + Math.sin(mid) * rOut;

      const labelRadius = r + 20;
      const x1 = cx + Math.cos(mid) * labelRadius;
      const y1 = cy + Math.sin(mid) * labelRadius;

      ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();

      const pct = Math.round(frac*100);
      const text = `${seg.label}: ${seg.value} (${pct}%)`;

      const onRight = Math.cos(mid) >= 0;
      ctx.textAlign = onRight ? "left" : "right";
      const tx = onRight ? x1 + 6 : x1 - 6;

      ctx.fillStyle = seg.color;
      ctx.beginPath(); ctx.arc(tx, y1, 4, 0, Math.PI*2); ctx.fill();

      ctx.fillStyle = "#0f172a";
      const textX = onRight ? tx + 10 : tx - 10;
      ctx.fillText(text, textX, y1);
    });
  }

  function renderOpenClosed(payload){
    const a = Number(payload?.abiertos || 0);
    const c = Number(payload?.cerrados || 0);
    donutCache = { abiertos:a, cerrados:c };

    drawDonut($donut1, $legend1, a, c);                 // Donut original (si existe)
    drawDonutWithLabels($donut2, $legend2, a, c);       // Donut bajo estatus
  }

  async function loadOpenClosed(){
    const url = `${API.openClosed}?${qs({
      departamento_id: currentDept ?? null,
      month: currentMonth || "",
      tramite: window.ixFilters.tramite || ""
    })}`;
    const resp = await fetchJSON(url);
    renderOpenClosed(resp || {});
  }

  // —— Recarga completa (tabla + estatus + donut)
  async function reloadAll(){
    await Promise.all([loadByTramite(), loadByStatus(), loadOpenClosed()]);
  }

  // —— Init
  document.addEventListener("DOMContentLoaded", async ()=>{
    if ($monthInput){
      $monthInput.addEventListener("change", ()=>{
        currentMonth = ($monthInput.value||"").trim() || null;
        reloadAll().catch(console.error);
        publishFiltersChanged('month');
      });
    }

    await initDepartments();
    hookTableSelection();
    await reloadAll();

    // Redibujar donuts en resize
    window.addEventListener("resize", ()=>{
      drawDonut($donut1, $legend1, donutCache.abiertos, donutCache.cerrados);
      drawDonutWithLabels($donut2, $legend2, donutCache.abiertos, donutCache.cerrados);
    });
  });

  // — Si otro módulo cambia filtros (por ejemplo, limpiar trámite)
  window.addEventListener('ix:filters-changed', (e) => {
    // Si cambió trámite desde fuera, solo re-render de estatus & donut;
    // la tabla conserva selección salvo que se resetee a null.
    loadByStatus().catch(console.error);
    loadOpenClosed().catch(console.error);

    // Si el tramite se vació, limpia selección visual en la tabla.
    if (!window.ixFilters.tramite && $tblBody) {
      $tblBody.querySelectorAll('.ix-row.ix-row--selected').forEach(x=>x.classList.remove('ix-row--selected'));
    }
  });
})();

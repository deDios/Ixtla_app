(() => {
  //  Config 
  const ENDPOINT = "http://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/ixtla01_c_requerimiento.php";
  const FETCH_TIMEOUT = 12000;
  const IX_DEBUG_TRACK = true;          // recordar colocar false aqui cuando la pagina este liberada
  const CACHE_TTL_MS = 1 * 60 * 1000;   // 1 min

  function getDepIdFromURL() {
    try {
      const sp = new URLSearchParams(location.search);
      const raw = sp.get("depId");
      const n = Number(raw);
      return Number.isInteger(n) && n > 0 ? n : null;
    } catch { return null; }
  }
  const DEPARTAMENTO_ID = getDepIdFromURL(); 
  const CACHE_KEY = `ix_req_cache_dept_${DEPARTAMENTO_ID ?? "all"}`;

  //  Estado / textos 
  const NUM_STATUS_MAP = { 0:"solicitud",1:"revision",2:"asignacion",3:"proceso",4:"pausado",5:"cancelado",6:"finalizado" };
  const STEP_BY_KEY    = { solicitud:1, revision:2, asignacion:3, proceso:4, pausado:4, cancelado:4, finalizado:5 };
  const SUBSTATUS_LABELS = { pausado:"Pausado", cancelado:"Cancelado" };
  const MESSAGES = {
    solicitud:"Tu trámite fue enviado y está registrado en el sistema.",
    revision:"Se revisa la información y evidencias proporcionadas.",
    asignacion:"Se asigna el caso al área o personal responsable.",
    proceso:"El equipo trabaja en la atención del requerimiento.",
    pausado:"El trámite se encuentra temporalmente pausado.",
    cancelado:"El trámite fue cancelado por el área responsable.",
    finalizado:"El requerimiento fue resuelto y el trámite ha concluido."
  };

  //  Utils 
  const $ = (r,s) => (r?.querySelector?.(s) ?? null);
  const $$ = (r,s) => Array.from(r?.querySelectorAll?.(s) ?? []);
  const log = (...a)=>{ if(IX_DEBUG_TRACK) console.log("[IX][track]",...a); };
  const warn= (...a)=>{ if(IX_DEBUG_TRACK) console.warn("[IX][track]",...a); };
  const err = (...a)=>{ if(IX_DEBUG_TRACK) console.error("[IX][track]",...a); };

  function withTimeout(promiseFactory, ms = FETCH_TIMEOUT) {
    const ctrl = new AbortController(), t0 = performance.now();
    const to = setTimeout(()=>ctrl.abort(), ms);
    return promiseFactory(ctrl.signal)
      .then(r => { clearTimeout(to); r.__ms=Math.round(performance.now()-t0); return r; })
      .catch(e => { clearTimeout(to); e.__ms=Math.round(performance.now()-t0); throw e; });
  }

  function normalizeFolio(input){
    const raw = String(input||"").toUpperCase().replace(/\s+/g,"");
    const m = raw.match(/([A-Z]+)?-?(\d{1,})/);
    if(!m) return "";
    const digits = m[2].replace(/\D/g,"").slice(0,10).padStart(10,"0");
    return `REQ-${digits}`;
  }

  function formatDateTime(sqlOrIso){
    if(!sqlOrIso) return {date:"—",time:"—"};
    const iso = sqlOrIso.includes("T") ? sqlOrIso : sqlOrIso.replace(" ","T");
    const d = new Date(iso);
    if(isNaN(d)) return {date:"—",time:"—"};
    const meses=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    const dd=String(d.getDate()).padStart(2,"0");
    const date=`${dd} de ${meses[d.getMonth()]} ${d.getFullYear()}`;
    let h=d.getHours(), m=String(d.getMinutes()).padStart(2,"0");
    const ampm=h>=12?"pm":"am"; h=((h+11)%12)+1;
    return {date,time:`${h}:${m} ${ampm}`};
  }

  function setText(el, val){ if(el) el.textContent = (val ?? "—"); }

  function getCache(key){ try{const r=sessionStorage.getItem(key); if(!r) return null; const o=JSON.parse(r); if(!o||Date.now()-o.t>(o.ttl??0))return null; return o.v;}catch{return null;} }
  function setCache(key,v,ttl=CACHE_TTL_MS){ try{sessionStorage.setItem(key,JSON.stringify({v,t:Date.now(),ttl}))}catch{} }

  //  DOM Refs 
  const root = document.getElementById("tramites-busqueda"); if(!root) return;
  const form = $("#tramites-busqueda","#form-tramite") || root.querySelector("#form-tramite");
  const inpFolio = root.querySelector("#folio");
  const btnBuscar= root.querySelector("#btn-buscar");

  const pEmpty = root.querySelector("#ix-track-empty");
  const pLoad  = root.querySelector("#ix-track-loading");
  const pError = root.querySelector("#ix-track-error");
  const pResult= root.querySelector("#ix-track-result");

  const elFolio= root.querySelector("#ix-meta-folio");
  const elReq  = root.querySelector("#ix-meta-req");
  const elDir  = root.querySelector("#ix-meta-dir");
  const elSol  = root.querySelector("#ix-meta-sol");
  const elDesc = root.querySelector("#ix-meta-desc");
  const elDate = root.querySelector("#ix-meta-date");
  const elTime = root.querySelector("#ix-meta-time");

  const steps   = root.querySelectorAll(".ix-stepper .ix-step");
  const popBtns = root.querySelectorAll(".ix-stepper .ix-stepbtn");
  const popovers= root.querySelectorAll(".ix-stepper .ix-pop");
  const subBadge= root.querySelector("#ix-substatus");
  const stepDescText = root.querySelector(".ix-stepdesc-text");

  //  UI State 
  function showPanel(which){
    [pEmpty,pLoad,pError,pResult].forEach(p=>p?.classList.remove("is-visible"));
    if(which){ which.hidden=false; which.classList.add("is-visible"); }
  }
  function setLoading(on){
    root.classList.toggle("is-loading",!!on);
    if(btnBuscar) btnBuscar.disabled=!!on;
    if(inpFolio)  inpFolio.disabled =!!on;
  }

  function keyByStep(step, subKey){
    if(subKey && (subKey==="pausado"||subKey==="cancelado")) return subKey;
    return ({1:"solicitud",2:"revision",3:"asignacion",4:"proceso",5:"finalizado"})[step]||"proceso";
  }
  function setStepsActive(stepIndex, subKey=null){
    steps.forEach(li=>{
      const n=Number(li.getAttribute("data-step")||"0");
      li.classList.remove("done","current","pending");
      li.removeAttribute("aria-current");
      if(n<stepIndex) li.classList.add("done");
      else if(n===stepIndex){ li.classList.add("current"); li.setAttribute("aria-current","step"); }
      else li.classList.add("pending");
    });
    if(subBadge){
      if(subKey && SUBSTATUS_LABELS[subKey]){ subBadge.textContent=SUBSTATUS_LABELS[subKey]; subBadge.hidden=false; }
      else subBadge.hidden=true;
    }
    const key = keyByStep(stepIndex, subKey);
    if(stepDescText) stepDescText.textContent = MESSAGES[key] || "—";
  }

  function closeAllPopovers(exceptId=null){
    popBtns.forEach(b=>b.setAttribute("aria-expanded","false"));
    popovers.forEach(p=>{ if(exceptId && p.id===exceptId) return; p.hidden=true; });
  }
  function handleStepBtnClick(e){
    const btn=e.currentTarget, id=btn.getAttribute("aria-controls");
    const pop=root.querySelector(`#${id}`); if(!pop) return;
    const willOpen=pop.hidden;
    closeAllPopovers(willOpen? id : null);
    btn.setAttribute("aria-expanded",String(willOpen));
    pop.hidden=!willOpen;
  }
  function handleDocClick(e){
    if(!root.contains(e.target)) return closeAllPopovers();
    const isBtn=e.target.closest?.(".ix-stepbtn");
    const isPop=e.target.closest?.(".ix-pop");
    if(!isBtn && !isPop) closeAllPopovers();
  }
  function handleEsc(e){ if(e.key==="Escape") closeAllPopovers(); }

  //  Data logic 
  function statusKeyFromRow(row){
    if(row?.cerrado_en) return "finalizado";
    const raw=row?.estatus;
    if(raw===null||raw===undefined) return "proceso";
    if(typeof raw==="number"){ return NUM_STATUS_MAP[raw] || "proceso"; }
    if(typeof raw==="string"){
      const k=raw.trim().toLowerCase();
      if(k in STEP_BY_KEY) return k;
      if(k.includes("paus")) return "pausado";
      if(k.includes("cancel")) return "cancelado";
      if(k.includes("final")) return "finalizado";
      if(k.includes("rev")) return "revision";
      if(k.includes("asign")) return "asignacion";
      if(k.includes("sol")) return "solicitud";
      if(k.includes("proc")) return "proceso";
      return "proceso";
    }
    return "proceso";
  }
  const stepFromKey = key => STEP_BY_KEY[key] || 4;
  const subStatusFromKey = key => (key==="pausado"||key==="cancelado") ? key : null;

  function renderResult(row){
    setText(elFolio, row.folio || "—");
    setText(elReq, row.tramite_nombre || row.asunto || "—");
    const dir=[row.contacto_calle,row.contacto_colonia,row.contacto_cp].filter(Boolean).join(", ");
    setText(elDir, dir || "—");
    setText(elSol, row.contacto_nombre || "—");
    setText(elDesc, row.descripcion || "—");
    const {date,time}=formatDateTime(row.created_at);
    setText(elDate, date); setText(elTime, time);

    const key=statusKeyFromRow(row);
    const step=stepFromKey(key);
    const subK=subStatusFromKey(key);
    setStepsActive(step, subK);

    showPanel(pResult);
  }
  function renderNotFound(){ showPanel(pError); }

  //  Fetch 
  async function fetchJSON(body, signal){
    const res=await fetch(ENDPOINT,{
      method:"POST",
      headers:{ "Content-Type":"application/json","Accept":"application/json" },
      body:JSON.stringify(body), signal
    });
    const http=res.status; if(!res.ok) throw new Error(`HTTP ${http}`);
    const json=await res.json(); return { http, json };
  }
  const queryByFolio = (folio)=> withTimeout(sig=>fetchJSON({ folio }, sig));
  const queryList    = (depId, opts={})=>{
    // si depId es null/invalid, omitimos filtro para buscar en todos
    const payload = {};
    if(Number.isInteger(depId)) payload.departamento_id = depId;
    if(opts.all === true){ payload.all = true; }
    else { payload.page = opts.page || 1; payload.per_page = opts.per_page || 50; }
    return withTimeout(sig=>fetchJSON(payload, sig));
  };

  //  Submit flow 
  async function handleSubmit(e){
    e?.preventDefault?.();
    closeAllPopovers();

    const folioNorm = normalizeFolio(inpFolio?.value || "");
    if(!folioNorm){ renderNotFound(); return; }

    setLoading(true); showPanel(pLoad);
    log("Buscar folio:", folioNorm, "depId:", DEPARTAMENTO_ID ?? "(todos)");

    // 1) Intento puntual por folio
    try{
      const r1=await queryByFolio(folioNorm);
      log("Resp folio:", r1.http, r1.json?.ok ? "ok" : r1.json?.error, r1?.__ms ?? "?ms");
      if(r1.json?.ok && r1.json?.data){ renderResult(r1.json.data); setLoading(false); return; }
    }catch(ex){ warn("Fallo puntual por folio, voy a listado:", ex?.message || ex); }

    // 2) Fallback listado (cache por dep)
    try{
      let list = getCache(CACHE_KEY);
      if(!Array.isArray(list)){
        const r2=await queryList(DEPARTAMENTO_ID, { all:true });
        log("Resp listado:", r2.http, r2.json?.ok ? "ok" : r2.json?.error, r2?.__ms ?? "?ms");
        if(!r2.json?.ok || !Array.isArray(r2.json?.data)) throw new Error("Respuesta de listado inválida");
        list = r2.json.data; setCache(CACHE_KEY, list);
      } else {
        log("Usando cache listado:", list.length, "items");
      }

      const target = list.find(row => String(row?.folio||"").toUpperCase() === folioNorm.toUpperCase());
      if(target){
        if(Number.isInteger(DEPARTAMENTO_ID) && Number(target.departamento_id)!==Number(DEPARTAMENTO_ID)){
          warn(`Folio está en otro departamento (${target.departamento_id}) diferente a depId=${DEPARTAMENTO_ID}`);
        }
        renderResult(target);
      } else {
        renderNotFound();
      }
    }catch(ex){
      err("Error en listado:", ex?.message || ex);
      renderNotFound();
    }finally{
      setLoading(false);
    }
  }

  //  Events ==
  form?.addEventListener("submit", handleSubmit);
  popBtns.forEach(btn=>btn.addEventListener("click", handleStepBtnClick));
  $$(root,".ix-pop-close").forEach(b=>b.addEventListener("click",()=>closeAllPopovers()));
  document.addEventListener("click", handleDocClick);
  document.addEventListener("keydown", handleEsc);

  // Soporta ?folio=... en la URL (y ya tomamos depId automáticamente)
  try{
    const sp=new URLSearchParams(location.search);
    const qf=sp.get("folio");
    if(qf){ inpFolio.value=qf; handleSubmit(); }
  }catch{}

})();

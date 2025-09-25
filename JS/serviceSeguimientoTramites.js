(()=>{"use strict";
/* ============= Config ============= */
const ENDPOINT="https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/ixtla01_c_requerimiento.php";
const FETCH_TIMEOUT=12000, IX_DEBUG_TRACK=true; // colocar false antes del sabado

/* ============= Helpers ============= */
function getDepIdFromURL(){try{const p=new URLSearchParams(location.search),n=Number(p.get("depId"));return Number.isInteger(n)&&n>0?n:null}catch{return null}}
const DEPARTAMENTO_ID=getDepIdFromURL();

const NUM_STATUS_MAP={0:"solicitud",1:"revision",2:"asignacion",3:"proceso",4:"pausado",5:"cancelado",6:"finalizado"};

const STEP_BY_KEY={solicitud:1,revision:2,asignacion:3,proceso:4,pausado:4,cancelado:4,finalizado:5};
const MESSAGES={
  solicitud:"Tu trámite fue enviado y está registrado en el sistema.",
  revision:"Se revisa la información y evidencias proporcionadas.",
  asignacion:"Se asigna el caso al área o personal responsable.",
  proceso:"El equipo trabaja en la atención del requerimiento.",
  pausado:"Tu requerimiento está Pausado.",
  cancelado:"Tu requerimiento está Cancelado.",
  finalizado:"El requerimiento fue resuelto y el trámite ha concluido."
};

const $=(r,s)=>r?.querySelector?.(s)||null, $$=(r,s)=>Array.from(r?.querySelectorAll?.(s)||[]);
const log=(...a)=>{if(IX_DEBUG_TRACK)console.log("[IX][track]",...a)}, warn=(...a)=>{if(IX_DEBUG_TRACK)console.warn("[IX][track]",...a)}, err=(...a)=>{if(IX_DEBUG_TRACK)console.error("[IX][track]",...a)};
function withTimeout(factory,ms=FETCH_TIMEOUT){const c=new AbortController(),t0=performance.now(),to=setTimeout(()=>c.abort(),ms);return factory(c.signal).then(r=>{clearTimeout(to);r.__ms=Math.round(performance.now()-t0);return r}).catch(e=>{clearTimeout(to);e.__ms=Math.round(performance.now()-t0);throw e})}
function normalizeFolio(input){const raw=String(input||"").toUpperCase().replace(/\s+/g,""),m=raw.match(/([A-Z]+)?-?(\d{1,})/);if(!m)return"";const digits=m[2].replace(/\D/g,"").slice(0,10).padStart(10,"0");return`REQ-${digits}`}
function formatDateTime(s){if(!s)return{date:"—",time:"—"};const iso=s.includes("T")?s:s.replace(" ","T"),d=new Date(iso);if(isNaN(d))return{date:"—",time:"—"};const meses=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"],dd=String(d.getDate()).padStart(2,"0");let h=d.getHours(),m=String(d.getMinutes()).padStart(2,"0");const ampm=h>=12?"pm":"am";h=((h+11)%12)+1;return{date:`${dd} de ${meses[d.getMonth()]} ${d.getFullYear()}`,time:`${h}:${m} ${ampm}`}}
function setText(el,val){if(el)el.textContent=val??"—"}

/* ============= DOM ============= */
const root=document.getElementById("tramites-busqueda"); if(!root) return;
const form=$("#tramites-busqueda","#form-tramite")||root.querySelector("#form-tramite");
const inpFolio=root.querySelector("#folio"), btnBuscar=root.querySelector("#btn-buscar");
const pEmpty=root.querySelector("#ix-track-empty"), pLoad=root.querySelector("#ix-track-loading"), pError=root.querySelector("#ix-track-error"), pResult=root.querySelector("#ix-track-result");
const elFolio=root.querySelector("#ix-meta-folio"), elReq=root.querySelector("#ix-meta-req"), elDir=root.querySelector("#ix-meta-dir"), elSol=root.querySelector("#ix-meta-sol"), elDesc=root.querySelector("#ix-meta-desc"), elDate=root.querySelector("#ix-meta-date"), elTime=root.querySelector("#ix-meta-time");
const steps=$$(root,".ix-stepper .ix-step"), popBtns=$$(root,".ix-stepper .ix-stepbtn"), popovers=$$(root,".ix-stepper .ix-pop"), stepDescText=root.querySelector(".ix-stepdesc-text");

/* ============= UI ============= */
function showPanel(which){[pEmpty,pLoad,pError,pResult].forEach(p=>p?.classList.remove("is-visible"));if(which){which.hidden=false;which.classList.add("is-visible")}}
function setLoading(on){root.classList.toggle("is-loading",!!on); if(btnBuscar)btnBuscar.disabled=!!on; if(inpFolio)inpFolio.disabled=!!on}
function keyByStep(step){return({1:"solicitud",2:"revision",3:"asignacion",4:"proceso",5:"finalizado"})[step]||"proceso"}

function resetStepDescClasses(){
  if(!stepDescText) return;
  stepDescText.classList.remove("ix-stepdesc--warning","ix-stepdesc--danger");
}

// pintar stepper (1..5)
function setStepsActive(stepIndex){
  steps.forEach(li=>{
    const n=Number(li.getAttribute("data-step")||"0");
    li.classList.remove("done","current","pending");
    li.removeAttribute("aria-current");
    if(n<stepIndex) li.classList.add("done");
    else if(n===stepIndex){ li.classList.add("current"); li.setAttribute("aria-current","step"); }
    else li.classList.add("pending");
  });
  const k=keyByStep(stepIndex);
  resetStepDescClasses();
  if(stepDescText) stepDescText.textContent = MESSAGES[k] || "—";
}

// subestados (los comentarios que estan abajo)
const isSubStatus = (k)=> k==="pausado" || k==="cancelado";
function setSubStatusOnly(subKey){
  steps.forEach(li=>{
    li.classList.remove("done","current","pending");
    li.removeAttribute("aria-current");
    li.classList.add("pending");
  });
  if(stepDescText){
    stepDescText.textContent = MESSAGES[subKey] || "—";
    resetStepDescClasses();
    if(subKey==="pausado")   stepDescText.classList.add("ix-stepdesc--warning");
    if(subKey==="cancelado") stepDescText.classList.add("ix-stepdesc--danger");
  }
}

// popovers
function closeAllPopovers(exceptId=null){popBtns.forEach(b=>b.setAttribute("aria-expanded","false"));popovers.forEach(p=>{if(exceptId&&p.id===exceptId)return;p.hidden=true})}
function handleStepBtnClick(e){const btn=e.currentTarget,id=btn.getAttribute("aria-controls"),pop=root.querySelector(`#${id}`);if(!pop)return;const willOpen=pop.hidden;closeAllPopovers(willOpen?id:null);btn.setAttribute("aria-expanded",String(willOpen));pop.hidden=!willOpen}
function handleDocClick(e){if(!root.contains(e.target))return closeAllPopovers();const isBtn=e.target.closest?.(".ix-stepbtn"),isPop=e.target.closest?.(".ix-pop");if(!isBtn&&!isPop)closeAllPopovers()}
function handleEsc(e){if(e.key==="Escape")closeAllPopovers()}

/* ============= Data logic ============= */
function statusKeyFromRow(row) {
  switch (Number(row?.estatus)) {
    case 0: return "solicitud";
    case 1: return "revision";
    case 2: return "asignacion";
    case 3: return "proceso";
    case 4: return "pausado";    // no tiene status visible solo el mensaje abajo
    case 5: return "cancelado";  // lo mismo tambien
    case 6: return "finalizado";
    default: return "proceso";
  }
}
const stepFromKey = k => STEP_BY_KEY[k] || 4;

/* ============= Render ============= */
function renderResult(row){
  setText(elFolio,row.folio||"—");
  setText(elReq,row.tramite_nombre||row.asunto||"—");
  const dir=[row.contacto_calle,row.contacto_colonia,row.contacto_cp].filter(Boolean).join(", ");
  setText(elDir,dir||"—");
  setText(elSol,row.contacto_nombre||"—");
  setText(elDesc,row.descripcion||"—");
  const {date,time}=formatDateTime(row.created_at); setText(elDate,date); setText(elTime,time);

  const key = statusKeyFromRow(row);
  if (isSubStatus(key)) {
    setSubStatusOnly(key);
  } else {
    const step = stepFromKey(key);
    setStepsActive(step);
  }

  showPanel(pResult);
}
function renderNotFound(){showPanel(pError)}

/* ============= fetch ============= */
async function fetchJSON(body,signal){
  const res=await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(body),signal});
  const http=res.status; if(!res.ok) throw new Error(`HTTP ${http}`);
  const json=await res.json(); return {http,json};
}
const queryByFolio=folio=>withTimeout(sig=>fetchJSON({folio},sig));
const queryList=(depId,opts={})=>{
  const payload={};
  if(Number.isInteger(depId)) payload.departamento_id=depId;
  if(opts.all===true) payload.all=true; else { payload.page=opts.page||1; payload.per_page=opts.per_page||50; }
  return withTimeout(sig=>fetchJSON(payload,sig));
};

/* ============= Submit flow ============= */
async function handleSubmit(e){
  e?.preventDefault?.(); closeAllPopovers();
  const folioNorm=normalizeFolio(inpFolio?.value||"");
  if(!folioNorm){ renderNotFound(); return; }
  setLoading(true); showPanel(pLoad);
  log("Buscar folio:",folioNorm,"depId:",DEPARTAMENTO_ID??"(todos)");

  // puntual por folio
  try{
    const r1=await queryByFolio(folioNorm);
    log("Resp folio:",r1.http,r1.json?.ok?"ok":r1.json?.error,r1?.__ms??"?ms");
    if(r1.json?.ok && r1.json?.data){ renderResult(r1.json.data); setLoading(false); return; }
  }catch(ex){ warn("Fallo puntual por folio, voy a listado:",ex?.message||ex); }

  // fallback listado
  try{
    const r2=await queryList(DEPARTAMENTO_ID,{all:true});
    log("Resp listado:",r2.http,r2.json?.ok?"ok":r2.json?.error,r2?.__ms??"?ms");
    if(!r2.json?.ok || !Array.isArray(r2.json?.data)) throw new Error("Respuesta de listado inválida");
    const target=r2.json.data.find(row=>String(row?.folio||"").toUpperCase()===folioNorm.toUpperCase());
    target ? renderResult(target) : renderNotFound();
  }catch(ex){ err("Error en listado:",ex?.message||ex); renderNotFound(); }
  finally{ setLoading(false); }
}

/* ============= Events ============= */
form?.addEventListener("submit",handleSubmit);
popBtns.forEach(b=>b.addEventListener("click",handleStepBtnClick));
$$(root,".ix-pop-close").forEach(b=>b.addEventListener("click",()=>closeAllPopovers()));
document.addEventListener("click",handleDocClick);
document.addEventListener("keydown",handleEsc);

try{ const sp=new URLSearchParams(location.search), qf=sp.get("folio"); if(qf){ inpFolio.value=qf; handleSubmit(); } }catch{}
})();

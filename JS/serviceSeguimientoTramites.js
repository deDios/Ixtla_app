(()=>{/* Config */
const ENDPOINT="https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/ixtla01_c_requerimiento.php",FETCH_TIMEOUT=12000,IX_DEBUG_TRACK=!0,CACHE_TTL_MS=60*1000;
function getDepIdFromURL(){try{const s=new URLSearchParams(location.search),n=Number(s.get("depId"));return Number.isInteger(n)&&n>0?n:null}catch{return null}}
const DEPARTAMENTO_ID=getDepIdFromURL(),CACHE_KEY=`ix_req_cache_dept_${DEPARTAMENTO_ID??"all"}`;
/* Estado / textos (sin badges/subestatus) */
const NUM_STATUS_MAP={0:"solicitud",1:"revision",2:"asignacion",3:"proceso",4:"proceso",5:"proceso",6:"finalizado"},
      STEP_BY_KEY={solicitud:1,revision:2,asignacion:3,proceso:4,finalizado:5},
      MESSAGES={solicitud:"Tu trámite fue enviado y está registrado en el sistema.",revision:"Se revisa la información y evidencias proporcionadas.",asignacion:"Se asigna el caso al área o personal responsable.",proceso:"El equipo trabaja en la atención del requerimiento.",finalizado:"El requerimiento fue resuelto y el trámite ha concluido."};
/* Utils */
const $=(r,s)=>r?.querySelector?.(s)??null,$$=(r,s)=>Array.from(r?.querySelectorAll?.(s)??[]),
log=(...a)=>{IX_DEBUG_TRACK&&console.log("[IX][track]",...a)},
warn=(...a)=>{IX_DEBUG_TRACK&&console.warn("[IX][track]",...a)},
err=(...a)=>{IX_DEBUG_TRACK&&console.error("[IX][track]",...a)};
function withTimeout(promiseFactory,ms=FETCH_TIMEOUT){const ctrl=new AbortController(),t0=performance.now(),to=setTimeout(()=>ctrl.abort(),ms);return promiseFactory(ctrl.signal).then(r=>{clearTimeout(to);r.__ms=Math.round(performance.now()-t0);return r}).catch(e=>{clearTimeout(to);e.__ms=Math.round(performance.now()-t0);throw e})}
function normalizeFolio(input){const raw=String(input||"").toUpperCase().replace(/\s+/g,""),m=raw.match(/([A-Z]+)?-?(\d{1,})/);if(!m)return"";const digits=m[2].replace(/\D/g,"").slice(0,10).padStart(10,"0");return`REQ-${digits}`}
function formatDateTime(sqlOrIso){if(!sqlOrIso)return{date:"—",time:"—"};const iso=sqlOrIso.includes("T")?sqlOrIso:sqlOrIso.replace(" ","T"),d=new Date(iso);if(isNaN(d))return{date:"—",time:"—"};const meses=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"],dd=String(d.getDate()).padStart(2,"0"),date=`${dd} de ${meses[d.getMonth()]} ${d.getFullYear()}`;let h=d.getHours(),m=String(d.getMinutes()).padStart(2,"0");const ampm=h>=12?"pm":"am";h=((h+11)%12)+1;return{date,time:`${h}:${m} ${ampm}`}}
function setText(el,val){if(el)el.textContent=val??"—"}
function getCache(key){try{const r=sessionStorage.getItem(key);if(!r)return null;const o=JSON.parse(r);if(!o||Date.now()-o.t>(o.ttl??0))return null;return o.v}catch{return null}}
function setCache(key,v,ttl=CACHE_TTL_MS){try{sessionStorage.setItem(key,JSON.stringify({v,t:Date.now(),ttl}))}catch{}}
/* DOM Refs */
const root=document.getElementById("tramites-busqueda");if(!root)return;
const form=$("#tramites-busqueda","#form-tramite")||root.querySelector("#form-tramite"),
      inpFolio=root.querySelector("#folio"),
      btnBuscar=root.querySelector("#btn-buscar"),
      pEmpty=root.querySelector("#ix-track-empty"),
      pLoad=root.querySelector("#ix-track-loading"),
      pError=root.querySelector("#ix-track-error"),
      pResult=root.querySelector("#ix-track-result"),
      elFolio=root.querySelector("#ix-meta-folio"),
      elReq=root.querySelector("#ix-meta-req"),
      elDir=root.querySelector("#ix-meta-dir"),
      elSol=root.querySelector("#ix-meta-sol"),
      elDesc=root.querySelector("#ix-meta-desc"),
      elDate=root.querySelector("#ix-meta-date"),
      elTime=root.querySelector("#ix-meta-time"),
      steps=root.querySelectorAll(".ix-stepper .ix-step"),
      popBtns=root.querySelectorAll(".ix-stepper .ix-stepbtn"),
      popovers=root.querySelectorAll(".ix-stepper .ix-pop"),
      stepDescText=root.querySelector(".ix-stepdesc-text");
/* UI State */
function showPanel(which){[pEmpty,pLoad,pError,pResult].forEach(p=>p?.classList.remove("is-visible"));if(which){which.hidden=!1;which.classList.add("is-visible")}}
function setLoading(on){root.classList.toggle("is-loading",!!on);btnBuscar&&(btnBuscar.disabled=!!on);inpFolio&&(inpFolio.disabled=!!on)}
function keyByStep(step){return({1:"solicitud",2:"revision",3:"asignacion",4:"proceso",5:"finalizado"})[step]||"proceso"}
function setStepsActive(stepIndex){steps.forEach(li=>{const n=Number(li.getAttribute("data-step")||"0");li.classList.remove("done","current","pending");li.removeAttribute("aria-current");n<stepIndex?li.classList.add("done"):n===stepIndex?(li.classList.add("current"),li.setAttribute("aria-current","step")):li.classList.add("pending")});const key=keyByStep(stepIndex);stepDescText&&(stepDescText.textContent=MESSAGES[key]||"—")}
function closeAllPopovers(exceptId=null){popBtns.forEach(b=>b.setAttribute("aria-expanded","false"));popovers.forEach(p=>{if(exceptId&&p.id===exceptId)return;p.hidden=!0})}
function handleStepBtnClick(e){const btn=e.currentTarget,id=btn.getAttribute("aria-controls"),pop=root.querySelector(`#${id}`);if(!pop)return;const willOpen=pop.hidden;closeAllPopovers(willOpen?id:null);btn.setAttribute("aria-expanded",String(willOpen));pop.hidden=!willOpen}
function handleDocClick(e){if(!root.contains(e.target))return closeAllPopovers();const isBtn=e.target.closest?.(".ix-stepbtn"),isPop=e.target.closest?.(".ix-pop");!isBtn&&!isPop&&closeAllPopovers()}
function handleEsc(e){"Escape"===e.key&&closeAllPopovers()}
/* Data logic (sin subestatus) */
function statusKeyFromRow(row){if(row?.cerrado_en)return"finalizado";const raw=row?.estatus;if(raw===null||raw===undefined)return"proceso";if(typeof raw==="number")return NUM_STATUS_MAP[raw]||"proceso";if(typeof raw==="string"){const k=raw.trim().toLowerCase();if(k in STEP_BY_KEY)return k;if(k.includes("final"))return"finalizado";if(k.includes("rev"))return"revision";if(k.includes("asign"))return"asignacion";if(k.includes("sol"))return"solicitud";if(k.includes("proc"))return"proceso";return"proceso"}return"proceso"}
const stepFromKey=k=>STEP_BY_KEY[k]||4;
/* Render */
function renderResult(row){setText(elFolio,row.folio||"—");setText(elReq,row.tramite_nombre||row.asunto||"—");const dir=[row.contacto_calle,row.contacto_colonia,row.contacto_cp].filter(Boolean).join(", ");setText(elDir,dir||"—");setText(elSol,row.contacto_nombre||"—");setText(elDesc,row.descripcion||"—");const{date,time}=formatDateTime(row.created_at);setText(elDate,date);setText(elTime,time);const key=statusKeyFromRow(row),step=stepFromKey(key);setStepsActive(step);showPanel(pResult)}
function renderNotFound(){showPanel(pError)}
/* Fetch */
async function fetchJSON(body,signal){const res=await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(body),signal});const http=res.status;if(!res.ok)throw new Error(`HTTP ${http}`);const json=await res.json();return{http,json}}
const queryByFolio=folio=>withTimeout(sig=>fetchJSON({folio},sig)),
      queryList=(depId,opts={})=>{const payload={};Number.isInteger(depId)&&(payload.departamento_id=depId);opts.all===!0?payload.all=!0:(payload.page=opts.page||1,payload.per_page=opts.per_page||50);return withTimeout(sig=>fetchJSON(payload,sig))};
/* Submit flow */
async function handleSubmit(e){e?.preventDefault?.();closeAllPopovers();const folioNorm=normalizeFolio(inpFolio?.value||"");if(!folioNorm){renderNotFound();return}setLoading(!0);showPanel(pLoad);log("Buscar folio:",folioNorm,"depId:",DEPARTAMENTO_ID??"(todos)");try{const r1=await queryByFolio(folioNorm);log("Resp folio:",r1.http,r1.json?.ok?"ok":r1.json?.error,r1?.__ms??"?ms");if(r1.json?.ok&&r1.json?.data){renderResult(r1.json.data);setLoading(!1);return}}catch(ex){warn("Fallo puntual por folio, voy a listado:",ex?.message||ex)}try{let list=getCache(CACHE_KEY);if(!Array.isArray(list)){const r2=await queryList(DEPARTAMENTO_ID,{all:!0});log("Resp listado:",r2.http,r2.json?.ok?"ok":r2.json?.error,r2?.__ms??"?ms");if(!r2.json?.ok||!Array.isArray(r2.json?.data))throw new Error("Respuesta de listado inválida");list=r2.json.data;setCache(CACHE_KEY,list)}else{log("Usando cache listado:",list.length,"items")}const target=list.find(row=>String(row?.folio||"").toUpperCase()===folioNorm.toUpperCase());target?renderResult(target):renderNotFound()}catch(ex){err("Error en listado:",ex?.message||ex);renderNotFound()}finally{setLoading(!1)}}
/* Events */
form?.addEventListener("submit",handleSubmit);
popBtns.forEach(btn=>btn.addEventListener("click",handleStepBtnClick));
$$(root,".ix-pop-close").forEach(b=>b.addEventListener("click",()=>closeAllPopovers()));
document.addEventListener("click",handleDocClick);
document.addEventListener("keydown",handleEsc);
/* ?folio= autoload */
try{const sp=new URLSearchParams(location.search),qf=sp.get("folio");if(qf){inpFolio.value=qf;handleSubmit()}}catch{}
})();

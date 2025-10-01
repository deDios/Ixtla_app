//----------------------------------------- RENDERS DE CARDS Y ITEMS DE DEPARTAMENTOPS
(function (w) {
  w.IX_CFG_DEPS = {
    DEBUG: Boolean(w.IX_DEBUG),

    VIEW_KEY: "ix_deps_view",
    DEFAULT_VIEW: "list",
    SKELETON_COUNT: 4,

    TIMEOUT_MS: 12000,
    CACHE_TTL: 10 * 60 * 1000, // 10 min

    ENDPOINTS: {
      deps:   "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php",
      tramite:"https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_tramite.php",
    },

    ASSETS: {
      BASE: "/ASSETS/departamentos/modulosAssets",
      ICON_PLACEHOLDER: "/ASSETS/departamentos/placeholder_icon.png",
      CARD_PLACEHOLDER: "/ASSETS/departamentos/placeholder_card.png",
      iconSrcs(depId, reqId){
        return [
          `${this.BASE}/dep-${depId}/req_icon${reqId}.png`,
          `${this.BASE}/dep-${depId}/req_icon${reqId}.jpg`,
          this.ICON_PLACEHOLDER,
        ];
      },
      cardSrcs(depId, reqId){
        return [
          `${this.BASE}/dep-${depId}/req_card${reqId}.png`,
          `${this.BASE}/dep-${depId}/req_card${reqId}.jpg`,
          this.CARD_PLACEHOLDER,
        ];
      },
    },

    ALIAS: { samapa:1, limpieza:2, obras:3, alumbrado:4, ambiental:5 },

    DEFAULT_SLA: "24h",
  };
})(window);


//------------------------------------- LEVANTAMIENTO DE REQUERIMIENTOS
(function (w) {
  w.IX_CFG_REQ = {
    // Validaciones
    NAME_MIN_CHARS: 5,
    DESC_MIN_CHARS: 10,
    PHONE_DIGITS: 10,

    // Subida de imágenes
    MAX_FILES: 3,
    MIN_FILES: 0,
    MAX_MB: 1, 
    ACCEPT_MIME: ["image/jpeg","image/png","image/webp","image/heic","image/heif"],
    ACCEPT_EXT:  [".jpg",".jpeg",".png",".webp",".heic",".heif"],

    ENDPOINTS: {
      cpcolonia:  "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_cpcolonia.php",
      insertReq:  "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_i_requerimiento.php",
      fsBootstrap:"https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_u_requerimiento_folders.php",
      uploadImg:  "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_i_requerimiento_img.php",
    },

    FETCH_TIMEOUT: 12000,
    DEBUG: true,
  };

  w.IX_CFG_REQ_ACCEPT = [...w.IX_CFG_REQ.ACCEPT_MIME, ...w.IX_CFG_REQ.ACCEPT_EXT].join(",");

  w.ixToast = w.ixToast || {
    ok  (m,ms=3200){ return w.gcToast ? gcToast(m,"exito",ms)  : alert(m); },
    info(m,ms=2200){ return w.gcToast ? gcToast(m,"info",ms)   : alert(m); },
    warn(m,ms=4200){ return w.gcToast ? gcToast(m,"alerta",ms) : alert(m); },
    err (m,ms=4200){ return w.gcToast ? gcToast(m,"error",ms)  : alert(m); },
  };
})(window);



/* ==================== modulo departamentos ==================== */
document.addEventListener("DOMContentLoaded", () => {
  const CFG  = window.IX_CFG_DEPS || {};
  const wrap = document.querySelector("#tramites .ix-wrap");
  if (!wrap) return;

  const log = (...a) => { if (CFG.DEBUG) try { console.log("[DEPS]", ...a); } catch {} };

  // helpers de abort+timeout
  const anySignal = (signals=[]) => {
    const c = new AbortController();
    const onAbort = () => c.abort();
    signals.filter(Boolean).forEach(s => s.addEventListener("abort", onAbort, { once:true }));
    return c.signal;
  };
  const withTimeout = (factory, ms=CFG.TIMEOUT_MS, extSignal) => {
    const tCtrl = new AbortController();
    const timer = setTimeout(() => tCtrl.abort(), ms);
    const signal = extSignal ? anySignal([tCtrl.signal, extSignal]) : tCtrl.signal;
    return Promise.resolve().then(() => factory(signal)).finally(() => clearTimeout(timer));
  };

  // refs base
  const grid = wrap.querySelector(".ix-grid");
  const note = wrap.querySelector(".ix-note");
  const h2   = wrap.querySelector("#deps-title");

  // cache & view
  const getView = () => sessionStorage.getItem(CFG.VIEW_KEY) || CFG.DEFAULT_VIEW;
  const setView = (v) => sessionStorage.setItem(CFG.VIEW_KEY, v);
  const cacheGet = (k) => {
    try{
      const raw = sessionStorage.getItem(k);
      if(!raw) return null;
      const obj = JSON.parse(raw);
      if(!obj || Date.now()-obj.t>(obj.ttl ?? CFG.CACHE_TTL)){ sessionStorage.removeItem(k); return null; }
      return obj.v;
    }catch{return null;}
  };
  const cacheSet = (k,v,ttl=CFG.CACHE_TTL)=>{ try{ sessionStorage.setItem(k, JSON.stringify({t:Date.now(), ttl, v})); }catch{} };

  // utils
  const norm = (s)=> (s??"").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  const isOtro = (title)=> norm(title)==="otro";
  const parseDepParam = (raw)=>{
    if(!raw) return null;
    const s=String(raw).toLowerCase();
    if(CFG.ALIAS[s]) return CFG.ALIAS[s];
    const n=parseInt(s,10);
    return Number.isFinite(n)?n:null;
  };
  const el=(html)=>{ const t=document.createElement("template"); t.innerHTML=html.trim(); return t.content.firstChild; };
  const plusSvg=`
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M12 7v10M7 12h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`.trim();
  function attachImgFallback(img, srcs, markEl){
    let i=0; const set=()=>img.src=srcs[i];
    img.addEventListener("error",()=>{ if(i<srcs.length-1){ i++; set(); } else { markEl?.classList.add("asset-missing"); markEl&&(markEl.dataset.missingAsset="true"); } },{passive:true});
    set();
  }

  // panel
  let panel = wrap.querySelector(".ix-dep-panel");
  if(!panel){
    panel = document.createElement("div");
    panel.className = "ix-dep-panel view-"+getView();
    panel.hidden = true;
    panel.innerHTML = `
      <div class="ix-dep-toolbar">
        <h2 class="ix-dep-heading">Trámites disponibles</h2>
        <div class="ix-dep-actions">
          <button type="button" class="ix-action ix-action--list" aria-label="Vista de lista" aria-pressed="true">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <polyline points="4,6.5 6,8.5 9.5,4.5" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="12" y1="6.5" x2="20" y2="6.5" stroke-linecap="round"/>
              <polyline points="4,12 6,14 9.5,10" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="12" y1="12" x2="20" y2="12" stroke-linecap="round"/>
              <polyline points="4,17.5 6,19.5 9.5,15.5" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="12" y1="17.5" x2="20" y2="17.5" stroke-linecap="round"/>
            </svg>
          </button>
          <button type="button" class="ix-action ix-action--grid" aria-label="Vista de tarjetas" aria-pressed="false">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5"  y="5"  width="6" height="6" rx="1.2"/>
              <rect x="13" y="5"  width="6" height="6" rx="1.2"/>
              <rect x="5"  y="13" width="6" height="6" rx="1.2"/>
              <rect x="13" y="13" width="6" height="6" rx="1.2"/>
            </svg>
          </button>
        </div>
      </div>
      <ul class="ix-dep-list" id="ix-dep-list" aria-live="polite"></ul>
      <a class="ix-dep-back" href="/VIEWS/tramiteDepartamento.php">← Ver todos los departamentos</a>
    `;
    wrap.appendChild(panel);
  }
  const listEl = panel.querySelector("#ix-dep-list");
  const btnList = panel.querySelector(".ix-action--list");
  const btnGrid = panel.querySelector(".ix-action--grid");

  const setLoadingUI = (on)=>{ panel.setAttribute("aria-busy", String(on)); btnList.disabled=on; btnGrid.disabled=on; };
  const renderSkeleton=(n=CFG.SKELETON_COUNT)=>{ listEl.innerHTML=""; for(let i=0;i<n;i++){ listEl.appendChild(el(`
    <li class="ix-dep-item ix-skel">
      <div class="ix-dep-media"><span class="sk sk-ico"></span></div>
      <div class="ix-dep-content"><h3><span class="sk sk-title"></span></h3><p><span class="sk sk-text"></span></p></div>
      <div class="sk sk-btn" aria-hidden="true"></div>
    </li>`)); } };
  const renderError=(msg,onRetry)=>{ listEl.innerHTML=""; const li=el(`
    <li class="ix-dep-empty">
      <p><strong>Error:</strong> ${msg||"No se pudieron cargar los trámites."}</p>
      <p><button type="button" class="ix-btn ix-btn--retry">Reintentar</button></p>
    </li>`); li.querySelector(".ix-btn--retry").addEventListener("click", onRetry); listEl.appendChild(li); };
  const renderEmpty=()=>{ listEl.innerHTML = `<li class="ix-dep-empty"><p>No hay trámites disponibles para este departamento.</p></li>`; };

  // fetchers
  async function fetchDeps(){
    const CK="ix_dep_meta"; const hit=cacheGet(CK); if(hit) return hit;
    const json = await withTimeout((signal)=>
      fetch(CFG.ENDPOINTS.deps,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({status:1}),signal})
      .then(r=>{ if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    );
    const data = Array.isArray(json?.data)?json.data:[];
    const meta={}; for(const row of data){ const id=Number(row?.id); if(!id) continue; meta[id]={ id, nombre:String(row?.nombre||`Departamento #${id}`), status:Number(row?.status ?? 1) }; }
    cacheSet(CK, meta); log("dep meta:", meta); return meta;
  }
  async function fetchTramitesByDep(depId, extSignal){
    const json = await withTimeout((signal)=>
      fetch(CFG.ENDPOINTS.tramite,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({departamento_id:Number(depId), all:true}),signal})
      .then(r=>{ if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    , CFG.TIMEOUT_MS, extSignal);
    const raw = Array.isArray(json?.data)?json.data:(Array.isArray(json)?json:[]);
    const rows = raw.filter(r => Number(r?.departamento_id)===Number(depId) && (r?.estatus===undefined || Number(r?.estatus)===1));
    return rows.map(r=>({ id:String(Number(r.id)), depId:String(Number(depId)), title:String(r?.nombre||"Trámite").trim(), desc:String(r?.descripcion||"").trim(), sla:null }))
               .sort((a,b)=>Number(a.id)-Number(b.id));
  }

  // renderers
  function renderListItem(it){
    const li=el(`<li class="ix-dep-item">
      <div class="ix-dep-media"></div>
      <div class="ix-dep-content"><h3></h3><p></p></div>
      <button type="button" class="ix-dep-add" aria-label=""></button>
    </li>`);
    const img=document.createElement("img"); img.alt=it.title; img.loading="lazy"; img.decoding="async"; img.width=40; img.height=40;
    attachImgFallback(img, CFG.ASSETS.iconSrcs(it.depId,it.id), li);
    li.querySelector(".ix-dep-media").appendChild(img);
    li.querySelector("h3").textContent = it.title;
    li.querySelector("p").textContent = it.desc || "Consulta detalles y levanta tu reporte.";
    const btn=li.querySelector(".ix-dep-add");
    btn.innerHTML=plusSvg; btn.dataset.dep=it.depId; btn.dataset.id=it.id; btn.dataset.title=it.title;
    btn.setAttribute("aria-label",`Iniciar ${it.title}`); if(isOtro(it.title)) btn.dataset.mode="otros";
    return li;
  }
  function renderCardItem(it){
    const li=el(`<li class="ix-dep-item ix-card">
      <div class="ix-card-img"></div>
      <div class="ix-card-body">
        <h3 class="ix-card-title"></h3>
        <p class="ix-card-desc"></p>
        <div class="ix-card-meta">
          <small>Tiempo aproximado: <span class="ix-sla"></span></small>
          <button type="button" class="ix-dep-add ix-card-btn">Crear</button>
        </div>
      </div>
    </li>`);
    const img=document.createElement("img"); img.alt=it.title; img.loading="lazy"; img.decoding="async";
    attachImgFallback(img, CFG.ASSETS.cardSrcs(it.depId,it.id), li);
    li.querySelector(".ix-card-img").appendChild(img);
    li.querySelector(".ix-card-title").textContent = it.title;
    li.querySelector(".ix-card-desc").textContent  = it.desc || "Consulta detalles y levanta tu reporte.";
    li.querySelector(".ix-sla").textContent        = it.sla || CFG.DEFAULT_SLA;
    const btn=li.querySelector(".ix-dep-add");
    btn.dataset.dep=it.depId; btn.dataset.id=it.id; btn.dataset.title=it.title;
    btn.setAttribute("aria-label",`Iniciar ${it.title}`); if(isOtro(it.title)) btn.dataset.mode="otros";
    return li;
  }
  function reRender(items){
    listEl.innerHTML = "";
    if(!Array.isArray(items)||!items.length) return renderEmpty();
    const v = getView();
    panel.classList.toggle("view-list",  v==="list");
    panel.classList.toggle("view-cards", v==="cards");
    btnList.setAttribute("aria-pressed", String(v==="list"));
    btnGrid.setAttribute("aria-pressed", String(v==="cards"));
    const renderer = v==="cards"?renderCardItem:renderListItem;
    items.forEach(it => listEl.appendChild(renderer(it)));
  }

  // estado de página
  function showDefault(){
    panel.hidden=true; listEl.innerHTML="";
    note.hidden=false; grid.style.display="";
    h2.textContent="Selecciona un Departamento";
    document.title="Trámites / Departamentos";
  }

  let depReqToken=0; let depAbortController=null;
  async function showDep(rawParam){
    const depId = parseDepParam(rawParam);
    if(!depId) return showDefault();

    // abort previo
    if(depAbortController){ try{ depAbortController.abort(); }catch{} }
    depAbortController = new AbortController();

    // UI
    grid.style.display="none"; note.hidden=true; panel.hidden=false;
    panel.dataset.dep=String(depId); setLoadingUI(true);
    listEl.setAttribute("aria-busy","true"); renderSkeleton(CFG.SKELETON_COUNT);

    const token=++depReqToken;

    // título
    let depMeta={}; try{ depMeta=await fetchDeps(); }catch(e){ log("deps meta error:",e); }
    const nombreDep = depMeta[depId]?.nombre || `Departamento #${depId}`;
    h2.textContent = `${nombreDep}`;
    panel.querySelector(".ix-dep-heading").textContent = "Trámites disponibles";
    document.title = `Trámites – ${nombreDep}`;

    try{
      const items = await fetchTramitesByDep(depId, depAbortController.signal);
      if(token!==depReqToken) return;
      reRender(items);

      // deep link ?req=
      const req = new URLSearchParams(location.search).get("req");
      if(req && window.ixReportModal?.open){
        const it = items.find(x => String(x.id)===String(req));
        if(it){
          const mode = isOtro(it.title) ? "otros" : "normal";
          ixReportModal.open({ title:it.title, depKey:String(depId), itemId:it.id, sla:it.sla||"-", mode });
        }
      }
    }catch(err){
      if(token!==depReqToken) return;
      renderError("No se pudo cargar el catálogo.", () => showDep(depId));
    }finally{
      if(token===depReqToken){ setLoadingUI(false); listEl.removeAttribute("aria-busy"); }
    }
  }

  // toggles list/cards
  btnList.addEventListener("click", ()=>{
    if(getView()==="list") return;
    setView("list");
    const depId = parseDepParam(panel.dataset.dep); if(!depId) return;
    const items = [...listEl.querySelectorAll(".ix-dep-add")].map(btn=>({
      id:btn.dataset.id, depId:String(depId), title:btn.dataset.title,
      desc: btn.closest(".ix-dep-item")?.querySelector(".ix-card-desc, .ix-dep-content p")?.textContent || "",
      sla:  btn.closest(".ix-dep-item")?.querySelector(".ix-sla")?.textContent || "24h",
    }));
    reRender(items);
  });
  btnGrid.addEventListener("click", ()=>{
    if(getView()==="cards") return;
    setView("cards");
    const depId = parseDepParam(panel.dataset.dep); if(!depId) return;
    const items = [...listEl.querySelectorAll(".ix-dep-add")].map(btn=>({
      id:btn.dataset.id, depId:String(depId), title:btn.dataset.title,
      desc: btn.closest(".ix-dep-item")?.querySelector(".ix-dep-content p, .ix-card-desc")?.textContent || "",
      sla:  btn.closest(".ix-dep-item")?.querySelector(".ix-sla")?.textContent || "24h",
    }));
    reRender(items);
  });

  // abrir modal del formulario
  panel.addEventListener("click", (e)=>{
    const btn = e.target.closest(".ix-dep-add"); if(!btn) return;
    const depKey = panel.dataset.dep;
    const title  = btn.dataset.title || "Trámite";
    const itemId = btn.dataset.id;
    const sla    = btn.closest(".ix-dep-item")?.querySelector(".ix-sla")?.textContent || "24h";
    const mode   = btn.dataset.mode || (isOtro(title) ? "otros" : "normal");
    if(window.ixReportModal?.open){
      ixReportModal.open({ title, depKey, itemId, sla, mode }, btn);
    }else{
      window.ixToast?.info(`Abrir formulario: ${title}`, 2200);
    }
  });

  // estado inicial
  const params = new URLSearchParams(window.location.search);
  const depParam = params.get("depId") || params.get("dep");
  depParam ? showDep(depParam) : showDefault();

  window.addEventListener("popstate", ()=>{
    const p=new URLSearchParams(window.location.search);
    const q=p.get("depId")||p.get("dep");
    q ? showDep(q) : showDefault();
  });

  const v = getView();
  btnList.setAttribute("aria-pressed", String(v==="list"));
  btnGrid.setAttribute("aria-pressed", String(v==="cards"));
  panel.classList.toggle("view-list",  v==="list");
  panel.classList.toggle("view-cards", v==="cards");
});





























/* ==================== Modulo Levantamiento de Requerimientos ==================== */
(() => {
  /* ---------- Config ---------- */
  const CFG = Object.assign({
    NAME_MIN_CHARS: 5,
    DESC_MIN_CHARS: 30,
    PHONE_DIGITS: 10,
    MAX_FILES: 3,
    MIN_FILES: 0,
    MAX_MB: 20,
    ACCEPT_MIME: ["image/jpeg","image/png","image/webp","image/heic","image/heif"],
    ACCEPT_EXT: [".jpg",".jpeg",".png",".webp",".heic",".heif"],
    ENDPOINTS: {
      cpcolonia:  "/db/WEB/ixtla01_c_cpcolonia.php",
      insertReq:  "/db/WEB/ixtla01_i_requerimiento.php",
      fsBootstrap:"/db/WEB/ixtla01_u_requerimiento_folders.php",
      uploadImg:  "/db/WEB/ixtla01_i_requerimiento_img.php",
    },
    FETCH_TIMEOUT: 12000,
    DEBUG: false
  }, window.IX_CFG_REQ || {});
  const ACCEPT_ALL = window.IX_CFG_REQ_ACCEPT || [...CFG.ACCEPT_MIME, ...CFG.ACCEPT_EXT].join(",");

  const log = (...a) => { if (CFG.DEBUG) try { console.log("[REQ]", ...a); } catch {} };

  /* ---------- Helpers de control de tiempo / abort ---------- */
  function anySignal(signals = []) {
    const c = new AbortController();
    const onAbort = () => c.abort();
    signals.filter(Boolean).forEach(s => s.addEventListener("abort", onAbort, { once: true }));
    return c.signal;
  }
  function withTimeout(factory, ms = CFG.FETCH_TIMEOUT, extSignal) {
    const tCtrl = new AbortController();
    const timer = setTimeout(() => tCtrl.abort(), ms);
    const signal = extSignal ? anySignal([tCtrl.signal, extSignal]) : tCtrl.signal;
    return Promise.resolve().then(() => factory(signal)).finally(() => clearTimeout(timer));
  }

  /* ---------- Estado ---------- */
  let files = [];
  let isSubmitting = false;
  let hasAttemptedSubmit = false;

  let currentDepId = "1";
  let currentItemId = "";
  let currentTitle = "Reporte";

  /* ---------- DOM ---------- */
  const modal = document.getElementById("ix-report-modal");
  if (!modal) { console.warn("[REQ] No existe #ix-report-modal"); return; }

  const overlay  = modal.querySelector(".ix-modal__overlay");
  const dialog   = modal.querySelector(".ix-modal__dialog");
  const form     = modal.querySelector("#ix-report-form");
  const feedback = modal.querySelector("#ix-report-feedback");

  const subTitle = modal.querySelector("#ix-report-subtitle");
  const inpReq   = modal.querySelector("#ix-report-req");
  const inpDepId = modal.querySelector("input[name='departamento_id']");
  const inpTram  = modal.querySelector("input[name='tramite_id']");
  const btnClose = modal.querySelectorAll("[data-ix-close]");

  // campos
  const inpNombre = modal.querySelector("#ix-nombre");
  const inpDom    = modal.querySelector("#ix-domicilio");
  let   inpCP     = modal.querySelector("#ix-cp");
  let   inpCol    = modal.querySelector("#ix-colonia");
  const inpTel    = modal.querySelector("#ix-telefono");
  const inpCorreo = modal.querySelector("#ix-correo");
  const inpDesc   = modal.querySelector("#ix-descripcion");
  const cntDesc   = modal.querySelector("#ix-desc-count");
  const chkCons   = modal.querySelector("#ix-consent");
  const btnSend   = modal.querySelector("#ix-submit");

  const asuntoGroup = modal.querySelector("#ix-asunto-group");
  const inpAsunto   = modal.querySelector("#ix-asunto");

  // uploader
  const upWrap   = modal.querySelector(".ix-upload");
  const upInput  = modal.querySelector("#ix-evidencia");
  const upCTA    = modal.querySelector("#ix-evidencia-cta");
  const previews = modal.querySelector("#ix-evidencia-previews");

  // fecha visible
  const inpFecha = modal.querySelector("#ix-fecha");
  const timeMeta = modal.querySelector("#ix-report-date");

  /* ---------- Utils ---------- */
  const digits = (s) => (s || "").replace(/\D+/g, "");
  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
  const extOf = (name="") => { const n=String(name).toLowerCase(); const i=n.lastIndexOf("."); return i>=0?n.slice(i):""; };
  const hasAllowedExt  = (f) => (CFG.ACCEPT_EXT || []).includes(extOf(f?.name));
  const hasAllowedMime = (f) => (CFG.ACCEPT_MIME|| []).includes(f?.type);
  const norm   = (s) => (s ?? "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  const isOtros = (title) => norm(title) === "otro";

  function clearFeedback(){ if (feedback) { feedback.hidden = true; feedback.textContent=""; } }
  function showFeedback(msg){ if (feedback) { feedback.hidden = false; feedback.textContent=msg; } }

  function setToday() {
    if (!inpFecha) return;
    const now = new Date();
    const visible = now.toLocaleString("es-MX",{dateStyle:"short", timeStyle:"short"}).replace(",", " ·");
    inpFecha.value = visible;
    if (timeMeta) { timeMeta.dateTime = now.toISOString(); timeMeta.textContent=""; }
  }

  // Modal "done"
  (function () {
    const root = document.getElementById("ix-done-modal");
    if (!root) return;
    const overlay = root.querySelector("[data-close]");
    theCloses  = root.querySelectorAll("[data-close]");
    const subEl   = root.querySelector("#ix-done-subtitle");
    const folioEl = root.querySelector("#ix-done-folio");
    function open({ folio = "—", title = "—" } = {}) {
      if (subEl)   subEl.textContent   = title || "—";
      if (folioEl) folioEl.textContent = folio || "—";
      root.hidden = false;
      root.setAttribute("aria-hidden","false");
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", onKey);
    }
    function close() {
      root.hidden = true;
      root.setAttribute("aria-hidden","true");
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e){ if (e.key === "Escape") close(); }
    overlay?.addEventListener("click", close);
    theCloses.forEach(b=> b.addEventListener("click", close));
    window.ixDoneModal = { open, close };
  })();

  function setFieldError(inputEl, msg = "") {
    if (inputEl === chkCons) {
      const row = chkCons.closest(".ix-form__row--consent");
      row?.classList.toggle("ix-field--error", !!msg);
      return;
    }
    const field = inputEl?.closest?.(".ix-field");
    const help  = field?.querySelector?.(".ix-help");
    if (!field) return;
    field.classList.toggle("ix-field--error", !!msg);
    if (msg) inputEl?.setAttribute?.("aria-invalid","true"); else inputEl?.removeAttribute?.("aria-invalid");
    if (help) { help.hidden = !msg; help.textContent = msg || ""; }
  }
  function updateDescCount(){ if (cntDesc && inpDesc) cntDesc.textContent = `${(inpDesc.value || "").length}`; }

  /* ---------- CP/Colonia ---------- */
  const makeOpt = (v, label, o={}) => { const el=document.createElement("option"); el.value=v; el.textContent=label; if(o.disabled)el.disabled=true; if(o.selected)el.selected=true; return el; };
  const ensureSelect = (el, { nameFallback, idFallback } = {}) => { if(el && el.tagName==="SELECT") return el; const sel=document.createElement("select"); sel.id=el?.id||idFallback||""; sel.name=el?.name||nameFallback||""; sel.className=el?.className||"ix-select ix-select--quiet"; sel.required=true; if(el) el.replaceWith(sel); return sel; };
  const ensureCpSelect  = () => (inpCP  = ensureSelect(inpCP,  { idFallback:"ix-cp",      nameFallback:"contacto_cp" }));
  const ensureColSelect = () => (inpCol = ensureSelect(inpCol, { idFallback:"ix-colonia", nameFallback:"contacto_colonia" }));

  const CP_CACHE_KEY = "ix_cpcolonia_cache_v1";
  let CP_MAP = {}; let CP_LIST = [];
  const getCpCache = () => { try { return JSON.parse(sessionStorage.getItem(CP_CACHE_KEY) || "null"); } catch { return null; } };
  const setCpCache = (data) => { try { sessionStorage.setItem(CP_CACHE_KEY, JSON.stringify(data)); } catch {} };
  const knownCP = (cp) => Object.prototype.hasOwnProperty.call(CP_MAP, String(cp || ""));

  function extractCpColoniaArray(json) {
    const arr = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    const out = [];
    for (const item of arr) {
      const cp = String(item.cp ?? item.CP ?? item.codigo_postal ?? item.codigoPostal ?? "").trim();
      const col= String(item.colonia ?? item.Colonia ?? item.asentamiento ?? item.neighborhood ?? "").trim();
      if (cp && col) out.push({ cp, colonia: col });
    }
    return out;
  }
  async function fetchCpColonia() {
    const hit = getCpCache();
    if (hit?.map && hit?.list) { CP_MAP = hit.map; CP_LIST = hit.list; return; }
    const json = await withTimeout((signal) =>
      fetch(CFG.ENDPOINTS.cpcolonia, {
        method: "POST",
        headers: { "Content-Type":"application/json", "Accept":"application/json" },
        body: JSON.stringify({ all: true }),
        signal,
      }).then(r => { if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    );
    const rows = extractCpColoniaArray(json);
    const tmp = {};
    for (const r of rows) {
      const cp = String(r.cp).trim(), col = String(r.colonia).trim();
      if (!tmp[cp]) tmp[cp] = new Set();
      tmp[cp].add(col);
    }
    CP_MAP = Object.fromEntries(Object.entries(tmp).map(([k,v]) => [k, [...v].sort((a,b)=>a.localeCompare(b,"es"))]));
    CP_LIST = Object.keys(CP_MAP).sort();
    setCpCache({ map: CP_MAP, list: CP_LIST });
  }
  function populateCpOptions() {
    ensureCpSelect();
    inpCP.innerHTML = "";
    inpCP.appendChild(makeOpt("", "Selecciona C.P.", { disabled:true, selected:true }));
    CP_LIST.forEach((cp) => inpCP.appendChild(makeOpt(cp, cp)));
  }
  function resetColonia(msg="Selecciona C.P. primero") {
    ensureColSelect();
    inpCol.innerHTML = "";
    inpCol.appendChild(makeOpt("", msg, { disabled:true, selected:true }));
    inpCol.disabled = true;
  }
  function populateColoniasForCP(cp) {
    ensureColSelect();
    const prev = inpCol.value || "";
    const list = CP_MAP[cp] || [];
    inpCol.innerHTML = "";
    const ph = makeOpt("", "Selecciona colonia", { disabled:true });
    inpCol.appendChild(ph);
    list.forEach(col => inpCol.appendChild(makeOpt(col, col)));
    inpCol.disabled = false;
    if (prev && list.includes(prev)) inpCol.value = prev; else ph.selected = true;
  }

  /* ---------- Uploader ---------- */
  function toggleUploadCTA() {
    if (!upCTA) return;
    const atLimit = files.length >= CFG.MAX_FILES;
    upCTA.disabled = atLimit;
    const tip = atLimit
      ? `Límite alcanzado (${files.length}/${CFG.MAX_FILES}).`
      : `Subir imágenes (${files.length}/${CFG.MAX_FILES}).`;
    upCTA.title = tip;
    upCTA.setAttribute("aria-label", tip);
  }
  function refreshPreviews() {
    if (!previews) return;
    previews.innerHTML = "";
    files.forEach((file, idx) => {
      const fig = document.createElement("figure");
      const img = document.createElement("img");
      const btn = document.createElement("button");
      const canPreview = /^(image\/jpeg|image\/png|image\/webp)$/i.test(file.type);
      const url = canPreview ? URL.createObjectURL(file) : "/ASSETS/departamentos/placeholder_card.png";
      file._url = url;
      img.src = url; img.alt = canPreview ? file.name : "Vista previa no disponible";
      img.loading = "lazy"; img.decoding = "async";
      img.onload = () => { try { URL.revokeObjectURL(url); } catch {} };
      btn.type = "button"; btn.textContent = "×"; btn.setAttribute("aria-label", "Eliminar imagen");
      btn.addEventListener("click", () => {
        const f = files.splice(idx, 1)[0];
        if (f?._url) { try { URL.revokeObjectURL(f._url); } catch {} }
        refreshPreviews(); toggleUploadCTA();
        if (hasAttemptedSubmit) validateForm(true);
      });
      fig.appendChild(img); fig.appendChild(btn); previews.appendChild(fig);
    });
    toggleUploadCTA();
  }
  function handleFiles(list) {
    const inc = Array.from(list || []);
    for (const f of inc) {
      const okMime = hasAllowedMime(f);
      const okExt  = hasAllowedExt(f);
      if (!okMime && !okExt) { window.ixToast?.warn("Solo JPG/PNG/WebP/HEIC/HEIF."); continue; }
      if (f.size > CFG.MAX_MB * 1024 * 1024) { window.ixToast?.warn(`Cada archivo ≤ ${CFG.MAX_MB} MB.`); continue; }
      if (files.length >= CFG.MAX_FILES) { window.ixToast?.warn(`Máximo ${CFG.MAX_FILES} imágenes.`); break; }
      files.push(f);
    }
    refreshPreviews();
  }
  function ensureUploadButton() {
    if (upInput) upInput.setAttribute("accept", ACCEPT_ALL);
    upCTA?.addEventListener("click", () => upInput?.click());
    upInput?.addEventListener("change", (e) => handleFiles(e.target.files));
    if (upWrap) {
      ["dragenter","dragover"].forEach(ev => upWrap.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); upWrap.classList.add("is-drag"); }));
      ["dragleave","drop"].forEach(ev => upWrap.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); upWrap.classList.remove("is-drag"); }));
      upWrap.addEventListener("drop", (e) => handleFiles(e.dataTransfer?.files || []));
    }
    toggleUploadCTA();
  }

  /* ---------- Validación ---------- */
  function setFieldOK(el){ setFieldError(el, ""); }
  function validateField(key, showErrors) {
    let ok = true, msg = "";
    switch (key) {
      case "nombre": {
        const v = (inpNombre?.value || "").trim();
        ok = v.length >= CFG.NAME_MIN_CHARS || v.split(/\s+/).length >= 2;
        msg = ok ? "" : "Ingresa tu nombre completo.";
        setFieldError(inpNombre, showErrors ? msg : ""); break;
      }
      case "dom": {
        ok = !!(inpDom?.value || "").trim();
        msg = ok ? "" : "El domicilio es obligatorio.";
        setFieldError(inpDom, showErrors ? msg : ""); break;
      }
      case "cp": {
        const cp = inpCP?.value || "";
        ok = !!cp && knownCP(cp);
        msg = ok ? "" : "Selecciona un C.P. válido.";
        setFieldError(inpCP, showErrors ? msg : "");
        if (ok) populateColoniasForCP(cp);
        break;
      }
      case "col": {
        const cp  = inpCP?.value || "";
        const col = inpCol?.value || "";
        const list = CP_MAP[cp] || [];
        ok = !!col && list.includes(col);
        msg = ok ? "" : "Selecciona una colonia válida.";
        setFieldError(inpCol, showErrors ? msg : ""); break;
      }
      case "tel": {
        if (inpTel) inpTel.value = digits(inpTel.value).slice(0, CFG.PHONE_DIGITS);
        const tel = digits(inpTel?.value || "");
        ok = tel.length === CFG.PHONE_DIGITS;
        msg = ok ? "" : `Teléfono a ${CFG.PHONE_DIGITS} dígitos.`;
        setFieldError(inpTel, showErrors ? msg : ""); break;
      }
      case "correo": {
        const mail = (inpCorreo?.value || "").trim();
        ok = !mail || isEmail(mail);
        msg = ok ? "" : "Correo no válido.";
        setFieldError(inpCorreo, showErrors ? msg : ""); break;
      }
      case "desc": {
        const d = (inpDesc?.value || "").trim();
        ok = d.length >= CFG.DESC_MIN_CHARS;
        msg = ok ? "" : `Describe con al menos ${CFG.DESC_MIN_CHARS} caracteres.`;
        setFieldError(inpDesc, showErrors ? msg : ""); break;
      }
      case "consent": {
        ok = !!chkCons?.checked;
        msg = ok ? "" : "Debes aceptar el consentimiento.";
        setFieldError(chkCons, showErrors ? msg : ""); break;
      }
      case "asunto": {
        if (!asuntoGroup || asuntoGroup.hidden) { ok = true; break; }
        const v = (inpAsunto?.value || "").trim();
        ok = !!v;
        msg = ok ? "" : "Indica una clasificación.";
        setFieldError(inpAsunto, showErrors ? msg : ""); break;
      }
    }
    return ok;
  }
  function validateForm(showErrors) {
    const keys = ["nombre","dom","cp","col","tel","correo","desc","consent","asunto"];
    let firstBad = null; let allOk = true;
    for (const k of keys) {
      const ok = validateField(k, showErrors);
      if (!ok) { allOk = false; if (!firstBad) firstBad = k; }
    }
    if (files.length > CFG.MAX_FILES) { allOk = false; showFeedback(`Máximo ${CFG.MAX_FILES} imágenes.`); }
    if (files.length < (CFG.MIN_FILES || 0)) {
      allOk = false; showFeedback(`Adjunta al menos ${CFG.MIN_FILES} imagen${CFG.MIN_FILES>1?"es":""}.`);
      upWrap?.classList.add("ix-upload--error");
    } else { upWrap?.classList.remove("ix-upload--error"); }
    return { ok: allOk, firstBad };
  }

  /* ---------- Apertura / cierre del modal de formulario ---------- */
  function trap(e) {
    if (e.key !== "Tab") return;
    const focusables = Array.from(dialog.querySelectorAll(
      'a[href],button:not([disabled]),textarea,input:not([disabled]),select,[tabindex]:not([tabindex="-1"])'
    )).filter(el => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function toggleAsuntoForOtros(visible) {
    if (!asuntoGroup) return;
    asuntoGroup.hidden = !visible;
    asuntoGroup.style.display = visible ? "" : "none";
    if (!visible && inpAsunto) { inpAsunto.value = ""; setFieldError(inpAsunto, ""); }
  }
  function openModal({ title="Reporte", depKey="1", itemId="", sla="", mode="normal" } = {}, opener=null) {
    currentDepId  = String(depKey || "1");
    currentItemId = String(itemId || "");
    currentTitle  = String(title || "Reporte");
    modal.dataset.mode = mode;
    subTitle && (subTitle.textContent = currentTitle);
    inpReq   && (inpReq.value   = currentTitle);
    inpDepId && (inpDepId.value = currentDepId);
    inpTram  && (inpTram.value  = currentItemId);
    clearFeedback(); hasAttemptedSubmit = false; isSubmitting = false;
    form?.reset(); files = []; refreshPreviews(); updateDescCount(); setToday();
    btnSend && (btnSend.disabled = false);
    toggleAsuntoForOtros(mode === "otros");
    ensureCpSelect(); ensureColSelect(); resetColonia();
    fetchCpColonia().then(() => populateCpOptions()).catch(()=>{});
    modal.hidden = false; modal.setAttribute("aria-hidden","false");
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") closeModal(); else trap(e); };
    document.addEventListener("keydown", onKey, { passive: false });
    overlay?.addEventListener("click", closeModal, { once: true });
    btnClose.forEach(b => b.addEventListener("click", closeModal, { once: true }));
    setTimeout(() => inpNombre?.focus(), 0);
    modal._onKey = onKey;
  }
  function closeModal() {
    document.removeEventListener("keydown", modal._onKey || (()=>{}));
    modal.hidden = true; modal.setAttribute("aria-hidden","true");
    document.body.style.overflow = "";
  }
  window.ixReportModal = {
    open: (opts={}, opener) => openModal({ ...opts, mode: opts.mode || (isOtros(opts.title) ? "otros" : "normal") }, opener),
    close: () => closeModal(),
  };

  /* ---------- Listeners ---------- */
  inpDesc?.addEventListener("input", () => { updateDescCount(); if (hasAttemptedSubmit) validateField("desc", true); });
  [
    ["nombre", inpNombre], ["dom", inpDom], ["tel", inpTel],
    ["correo", inpCorreo], ["consent", chkCons], ["asunto", inpAsunto],
  ].forEach(([k, el]) => el?.addEventListener("input", () => { if (hasAttemptedSubmit) validateField(k, true); }));

  modal.addEventListener("change", (e) => {
    const t = e.target;
    if (t?.id === "ix-cp") {
      const cp = t.value || "";
      if (knownCP(cp)) { setFieldError(inpCP, ""); populateColoniasForCP(cp); }
      else { setFieldError(inpCP, "Selecciona un C.P. válido."); resetColonia(); }
    }
    if (t?.id === "ix-colonia") {
      const val = t.value || "";
      inpCol.value = val;
      const ok = !!val && (CP_MAP[inpCP?.value] || []).includes(val);
      setFieldError(inpCol, ok ? "" : "Selecciona una colonia válida.");
    }
  });

  ensureUploadButton();

  form?.addEventListener("input", () => {
    const { ok } = validateForm(false);
    btnSend.disabled = !ok;
  });

  /* ---------- Submit ---------- */
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    clearFeedback();
    hasAttemptedSubmit = true;

    const res = validateForm(true);
    if (!res.ok) {
      const sel = {
        nombre:"#ix-nombre", dom:"#ix-domicilio", cp:"#ix-cp", col:"#ix-colonia",
        tel:"#ix-telefono", correo:"#ix-correo", desc:"#ix-descripcion",
        consent:"#ix-consent", asunto:"#ix-asunto",
      }[res.firstBad];
      modal.querySelector(sel || "")?.focus?.();
      return;
    }

    // build payload (SIN captcha)
    const depId  = Number(currentDepId  || inpDepId?.value || 1);
    const tramId = Number(currentItemId || inpTram?.value  || 0);
    const modoOtros = modal.dataset.mode === "otros";

    const body = {
      departamento_id: depId,
      tramite_id: tramId || null,
      asunto: (modoOtros && inpAsunto?.value.trim()) ? inpAsunto.value.trim() : `Reporte ${currentTitle}`,
      descripcion: (inpDesc?.value || "").trim(),
      contacto_nombre: (inpNombre?.value || "").trim(),
      contacto_email: (inpCorreo?.value || "").trim() || null,
      contacto_telefono: digits(inpTel?.value || ""),
      contacto_calle: (inpDom?.value || "").trim(),
      contacto_colonia: (inpCol?.value || "").trim(),
      contacto_cp: (inpCP?.value || "").trim()
    };

    // UI
    isSubmitting = true;
    form.setAttribute("aria-busy","true");
    const oldTxt = btnSend.textContent;
    btnSend.disabled = true;
    btnSend.textContent = "Enviando…";

    // Idempotencia
    const idempKey = (crypto?.randomUUID && crypto.randomUUID())
                  || (`idemp-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    try {
      // 1) crear requerimiento
      const json = await withTimeout((signal) =>
        fetch(CFG.ENDPOINTS.insertReq, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "Idempotency-Key": idempKey,
            //"X-Trace-Label": "r8K2z-F3qG-9vP6wH"
          },
          body: JSON.stringify(body),
          signal,
        }).then(r => { if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      );

      if (!json?.ok || !json?.data) throw new Error("Respuesta inesperada del servidor.");
      const folio = json.data.folio || `REQ-${String(Date.now() % 1e10).padStart(10,"0")}`;

      // 2) preparar folders (best-effort)
      try {
        await withTimeout((signal) =>
          fetch(CFG.ENDPOINTS.fsBootstrap, {
            method: "POST",
            headers: { "Content-Type":"application/json", "Accept":"application/json" },
            body: JSON.stringify({ folio }),
            signal,
          }).then(r=>r.json())
        );
      } catch {}

      // 3) subir evidencias (si hay)
      if (files.length) {
        const fd = new FormData();
        fd.append("folio", folio);
        fd.append("status", "0");
        files.forEach(f => fd.append("files[]", f, f.name));
        try {
          await withTimeout((signal) =>
            fetch(CFG.ENDPOINTS.uploadImg, { method:"POST", body: fd, signal })
              .then(r => r.json())
          );
        } catch {
          window.ixToast?.warn("El reporte se creó, pero algunas imágenes no se subieron.");
        }
      }

      window.ixToast?.ok(`Reporte creado: ${folio}`, 3200);
      Array.from(form.elements).forEach(el => (el.disabled = false));
      btnSend.textContent = oldTxt;
      form.reset();
      files.forEach(f => { if (f?._url) { try { URL.revokeObjectURL(f._url); } catch {} } });
      files = []; refreshPreviews(); updateDescCount();
      window.ixDoneModal?.open({ folio, title: currentTitle });
      (window.ixReportModal?.close || (()=>{}))();

    } catch (err) {
      window.ixToast?.err("No se pudo enviar el reporte.");
      showFeedback(`No se pudo enviar el reporte. ${err?.message || err}`);
    } finally {
      isSubmitting = false;
      form.removeAttribute("aria-busy");
      btnSend.textContent = oldTxt;
      btnSend.disabled = false;
    }
  });
})();


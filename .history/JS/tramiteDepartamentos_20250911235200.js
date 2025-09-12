//----------------------------- módulo de departamentos 
document.addEventListener("DOMContentLoaded", () => {
  const wrap = document.querySelector("#tramites .ix-wrap");
  if (!wrap) return;

  // --- mini debug
  if (typeof window.IX_DEBUG === "undefined") window.IX_DEBUG = true;
  const ixLog = (...a) => { if (window.IX_DEBUG) try { console.log("[IX]", ...a); } catch { } };

  // refs base de la vista
  const grid = wrap.querySelector(".ix-grid");
  const note = wrap.querySelector(".ix-note");
  const h2 = wrap.querySelector("#deps-title");

  // ========= Preferencia de vista (list/cards) =========
  const VIEW_KEY = "ix_deps_view";
  const getView = () => sessionStorage.getItem(VIEW_KEY) || "list";
  const setView = (v) => sessionStorage.setItem(VIEW_KEY, v);

  // ========= Panel del módulo  =========
  let panel = wrap.querySelector(".ix-dep-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.className = "ix-dep-panel view-" + getView();
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

  // ========= Endpoints (HTTPS sí o sí para evitar mixed content) =========
  const ENDPOINTS = {
    deps: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/ixtla01_c_departamento.php",
    tramite: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/ixtla01_c_tramite.php",
  };

  // ========= Cache básico (sessionStorage con TTL) =========
  const CACHE_TTL = 10 * 60 * 1000; // 10 min
  const cacheGet = (k) => {
    try {
      const raw = sessionStorage.getItem(k);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || (Date.now() - obj.t) > (obj.ttl ?? CACHE_TTL)) { sessionStorage.removeItem(k); return null; }
      return obj.v;
    } catch { return null; }
  };
  const cacheSet = (k, v, ttl = CACHE_TTL) => {
    try { sessionStorage.setItem(k, JSON.stringify({ t: Date.now(), ttl, v })); } catch { }
  };

  // ========= Config de assets (cero slugs, todo por ID) =========
  // placeholders globales que TÚ colocarás en /ASSETS/departamentos/
  const ICON_PLACEHOLDER = "/ASSETS/departamentos/placeholder_icon.png";
  const CARD_PLACEHOLDER = "/ASSETS/departamentos/placeholder_card.png";
  // assets por depId, p.ej.: /ASSETS/departamentos/modulosAssets/dep-1/req_icon4.png
  const ASSETS_BASE = "/ASSETS/departamentos/modulosAssets";
  const iconSrcs = (depId, reqId) => ([
    `${ASSETS_BASE}/dep-${depId}/req_icon${reqId}.png`,
    `${ASSETS_BASE}/dep-${depId}/req_icon${reqId}.jpg`,
    ICON_PLACEHOLDER,
  ]);
  const cardSrcs = (depId, reqId) => ([
    `${ASSETS_BASE}/dep-${depId}/req_card${reqId}.png`,
    `${ASSETS_BASE}/dep-${depId}/req_card${reqId}.jpg`,
    CARD_PLACEHOLDER,
  ]);

  // fallback de imagen: intenta srcs en orden y al final marca asset-missing
  function attachImgFallback(img, srcList, liForFlag) {
    let i = 0;
    const set = () => { img.src = srcList[i]; };
    img.addEventListener("error", () => {
      if (i < srcList.length - 1) { i++; set(); }
      else {
        if (liForFlag) { liForFlag.classList.add("asset-missing"); liForFlag.dataset.missingAsset = "true"; }
      }
    }, { passive: true });
    set();
  }

  // ========= Fetchers (con timeout) =========
  const TIMEOUT_MS = 12000;
  const withTimeout = async (promise, ms = TIMEOUT_MS) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await promise(ctrl.signal);
      clearTimeout(t);
      return res;
    } catch (e) { clearTimeout(t); throw e; }
  };

  async function fetchDeps() {
    // cache first
    const CK = "ix_dep_meta";
    const hit = cacheGet(CK);
    if (hit) return hit;

    // pido activos (status:1). Si mañana quieres todos, quitamos el filtro y listo.
    const json = await withTimeout((signal) =>
      fetch(ENDPOINTS.deps, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ status: 1 }),
        signal
      }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    );

    // normalizo a map por id: { [id]: { id, nombre, status } }
    const data = Array.isArray(json?.data) ? json.data : [];
    const meta = {};
    for (const row of data) {
      const id = Number(row?.id);
      if (!id) continue;
      meta[id] = {
        id,
        nombre: String(row?.nombre || `Departamento #${id}`),
        status: Number(row?.status ?? 1)
      };
    }
    cacheSet(CK, meta);
    ixLog("dep meta desde API:", meta);
    return meta;
  }

  async function fetchTramitesByDep(depId) {
    // pido TODO (all:true), pero yo filtro duro en cliente por si el back se pone punk
    const json = await withTimeout((signal) =>
      fetch(ENDPOINTS.tramite, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ departamento_id: Number(depId), all: true }),
        signal
      }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    );

    // agarro arreglo tolerante
    const raw = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    // FILTRO DURO: solo trámites del dep y activos (si hay estatus)
    const rows = raw.filter(r =>
      Number(r?.departamento_id) === Number(depId) &&
      (r?.estatus === undefined || Number(r?.estatus) === 1)
    );

    // adapto a mis items: id, title, desc, sla (si un día llega del back, lo mapeamos)
    const items = rows.map(r => ({
      id: String(Number(r.id)),                // id en string (para datasets)
      depId: String(Number(depId)),           // dep actual
      title: String(r?.nombre || "Trámite").trim(),
      desc: String(r?.descripcion || "").trim(),
      sla: null,                               // por ahora n/a
    }))
      // orden por id asc numérico (simple y estable)
      .sort((a, b) => Number(a.id) - Number(b.id));

    return items;
  }

  // ========= Render (lista/cards) =========
  const plusSvg = `
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M12 7v10M7 12h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`.trim();

  const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; };

  function renderSkeleton(n = 4) {
    listEl.innerHTML = "";
    for (let i = 0; i < n; i++) {
      listEl.appendChild(el(`
        <li class="ix-dep-item ix-skel">
          <div class="ix-dep-media"><span class="sk sk-ico"></span></div>
          <div class="ix-dep-content">
            <h3><span class="sk sk-title"></span></h3>
            <p><span class="sk sk-text"></span></p>
          </div>
          <div class="sk sk-btn" aria-hidden="true"></div>
        </li>
      `));
    }
  }

  function renderError(msg, onRetry) {
    listEl.innerHTML = "";
    const li = el(`
      <li class="ix-dep-empty">
        <p><strong>Error:</strong> ${msg || "No se pudieron cargar los trámites."}</p>
        <p><button type="button" class="ix-btn ix-btn--retry">Reintentar</button></p>
      </li>
    `);
    li.querySelector(".ix-btn--retry").addEventListener("click", onRetry);
    listEl.appendChild(li);
  }

  function renderEmpty() {
    listEl.innerHTML = `
      <li class="ix-dep-empty">
        <p>No hay trámites disponibles para este departamento.</p>
      </li>
    `;
  }

  function renderListItem(it) {
    const li = el(`
      <li class="ix-dep-item">
        <div class="ix-dep-media"></div>
        <div class="ix-dep-content">
          <h3></h3>
          <p></p>
        </div>
        <button type="button" class="ix-dep-add" aria-label=""></button>
      </li>
    `);

    // icono (png → jpg → placeholder)
    const img = document.createElement("img");
    img.alt = it.title;
    attachImgFallback(img, iconSrcs(it.depId, it.id), li);
    li.querySelector(".ix-dep-media").appendChild(img);

    // copy
    li.querySelector("h3").textContent = it.title;
    li.querySelector("p").textContent = it.desc || "Consulta detalles y levanta tu reporte.";

    // botón
    const btn = li.querySelector(".ix-dep-add");
    btn.innerHTML = plusSvg;
    btn.dataset.dep = it.depId;
    btn.dataset.id = it.id;
    btn.dataset.title = it.title;
    btn.setAttribute("aria-label", `Iniciar ${it.title}`);

    return li;
  }

  function renderCardItem(it) {
    const li = el(`
      <li class="ix-dep-item ix-card">
        <div class="ix-card-img"></div>
        <div class="ix-card-body">
          <h3 class="ix-card-title"></h3>
          <p class="ix-card-desc"></p>
          <div class="ix-card-meta">
            <small>Tiempo aproximado: <span class="ix-sla"></span></small>
            <button type="button" class="ix-dep-add ix-card-btn">Crear</button>
          </div>
        </div>
      </li>
    `);

    // imagen de card (png → jpg → placeholder)
    const img = document.createElement("img");
    img.alt = it.title;
    img.loading = "lazy";
    attachImgFallback(img, cardSrcs(it.depId, it.id), li);
    li.querySelector(".ix-card-img").appendChild(img);

    // textos
    li.querySelector(".ix-card-title").textContent = it.title;
    li.querySelector(".ix-card-desc").textContent = it.desc || "Consulta detalles y levanta tu reporte.";
    li.querySelector(".ix-sla").textContent = it.sla || "-";

    // botón
    const btn = li.querySelector(".ix-dep-add");
    btn.dataset.dep = it.depId;
    btn.dataset.id = it.id;
    btn.dataset.title = it.title;
    btn.setAttribute("aria-label", `Iniciar ${it.title}`);

    return li;
  }

  function reRender(items) {
    listEl.innerHTML = "";
    if (!Array.isArray(items) || !items.length) return renderEmpty();

    const v = getView();
    panel.classList.toggle("view-list", v === "list");
    panel.classList.toggle("view-cards", v === "cards");
    btnList.setAttribute("aria-pressed", String(v === "list"));
    btnGrid.setAttribute("aria-pressed", String(v === "cards"));

    const renderer = v === "cards" ? renderCardItem : renderListItem;
    items.forEach(it => listEl.appendChild(renderer(it)));
  }

  // ========= Estado de página =========
  function showDefault() {
    panel.hidden = true; listEl.innerHTML = "";
    note.hidden = false; grid.style.display = "";
    h2.textContent = "Selecciona un Departamento";
    document.title = "Trámites / Departamentos";
  }

  // parsea depId desde query (acepto alias de cortesía, pero la neta usamos números)
  const ALIAS = { samapa: 1, simapa: 1, limpieza: 2, obras: 3, alumbrado: 4, ambiental: 5 };
  const parseDepParam = (raw) => {
    if (!raw) return null;
    const s = String(raw).toLowerCase();
    if (ALIAS[s]) return ALIAS[s];
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  };

  // ========= Carga del módulo =========
  async function showDep(rawParam) {
    const depId = parseDepParam(rawParam);
    if (!depId) return showDefault();

    // UI: mostrar panel, ocultar grid
    grid.style.display = "none";
    note.hidden = true;
    panel.hidden = false;
    panel.dataset.dep = String(depId);

    // cargo meta de departamentos (para título bonito si existe)
    let depMeta = {};
    try { depMeta = await fetchDeps(); } catch (e) { ixLog("dep meta falló:", e?.message || e); }

    const nombreDep = depMeta[depId]?.nombre || `Departamento #${depId}`;
    h2.textContent = `${nombreDep}`;
    panel.querySelector(".ix-dep-heading").textContent = "Trámites disponibles";
    document.title = `Trámites – ${nombreDep}`;

    // muestro skeleton mientras jalo la lista
    renderSkeleton(4);

    try {
      const items = await fetchTramitesByDep(depId);
      reRender(items);

      // deep-link: si viene ?req=<id>, abro el modal directo
      const req = new URLSearchParams(location.search).get("req");
      if (req && window.ixReportModal?.open) {
        const it = items.find(x => String(x.id) === String(req));
        if (it) ixReportModal.open({ title: it.title, depKey: String(depId), itemId: it.id, sla: it.sla || "-" });
      }
    } catch (err) {
      ixLog("catalogo dep falló:", err?.message || err);
      renderError("No se pudo cargar el catálogo.", () => showDep(depId)); // reintento simple
    }
  }

  // ========= Toolbar: cambiar list/cards =========
  btnList.addEventListener("click", () => {
    if (getView() === "list") return;
    setView("list");
    // re-render con lo que haya en DOM (agarro items de botones… meh, más fácil volver a pintar leyendo datasets)
    const depId = parseDepParam(panel.dataset.dep);
    if (!depId) return;
    // truco rápido: re-levanto modelos desde DOM (suficiente para conmutar vista sin refetch)
    const items = [...listEl.querySelectorAll(".ix-dep-add")].map(btn => ({
      id: btn.dataset.id, depId: String(depId), title: btn.dataset.title, desc: btn.closest(".ix-dep-item")?.querySelector(".ix-card-desc, .ix-dep-content p")?.textContent || "", sla: btn.closest(".ix-dep-item")?.querySelector(".ix-sla")?.textContent || "-"
    }));
    reRender(items);
  });
  btnGrid.addEventListener("click", () => {
    if (getView() === "cards") return;
    setView("cards");
    const depId = parseDepParam(panel.dataset.dep);
    if (!depId) return;
    const items = [...listEl.querySelectorAll(".ix-dep-add")].map(btn => ({
      id: btn.dataset.id, depId: String(depId), title: btn.dataset.title, desc: btn.closest(".ix-dep-item")?.querySelector(".ix-dep-content p, .ix-card-desc")?.textContent || "", sla: btn.closest(".ix-dep-item")?.querySelector(".ix-sla")?.textContent || "-"
    }));
    reRender(items);
  });

  // ========= Click en “Crear/+” → abre modal =========
  panel.addEventListener("click", (e) => {
    const btn = e.target.closest(".ix-dep-add");
    if (!btn) return;

    const depKey = panel.dataset.dep;
    const title = btn.dataset.title || "Trámite";
    const itemId = btn.dataset.id;
    const sla = btn.closest(".ix-dep-item")?.querySelector(".ix-sla")?.textContent || "-";

    if (window.ixReportModal?.open) {
      ixReportModal.open({ title, depKey, itemId, sla }, btn);
    } else {
      window.gcToast ? gcToast(`Abrir formulario: ${title}`, "info", 2200) : alert(`Abrir formulario: ${title}`);
    }
  });

  // ========= Estado inicial por URL  =========
  const params = new URLSearchParams(window.location.search);
  const depParam = params.get("depId") || params.get("dep");
  depParam ? showDep(depParam) : showDefault();

  // back/forward
  window.addEventListener("popstate", () => {
    const p = new URLSearchParams(window.location.search);
    const q = p.get("depId") || p.get("dep");
    q ? showDep(q) : showDefault();
  });

  // estado visual inicial de los toggles
  const v = getView();
  btnList.setAttribute("aria-pressed", String(v === "list"));
  btnGrid.setAttribute("aria-pressed", String(v === "cards"));
  panel.classList.toggle("view-list", v === "list");
  panel.classList.toggle("view-cards", v === "cards");
});












//--------------------------------------------------- modal para SAMAPA 
(() => {
  const modal = document.getElementById("ix-report-modal");
  if (!modal) {
    console.warn("[IX] No existe #ix-report-modal, me salgo.");
    return;
  }

  // ---------- refs base
  const overlay   = modal.querySelector(".ix-modal__overlay");
  const dialog    = modal.querySelector(".ix-modal__dialog");
  const btnCloses = modal.querySelectorAll("[data-ix-close]");
  const form      = modal.querySelector("#ix-report-form");
  const feedback  = modal.querySelector("#ix-report-feedback");

  const inpReq    = modal.querySelector("#ix-report-req");
  const subTitle  = modal.querySelector("#ix-report-subtitle");

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

  const upWrap    = modal.querySelector(".ix-upload");
  const upInput   = modal.querySelector("#ix-evidencia");
  const previews  = modal.querySelector("#ix-evidencia-previews");

  // ---------- preferimos manejar la validación nosotros 
  form?.setAttribute('novalidate','novalidate');
  feedback?.setAttribute('role','alert');

  // ---------- limitew de imagenes, por si acaso queremos mas imagenes 
  const MAX_IMAGES = Number(window.IX_MAX_IMAGES ?? 3);

  // ---------- config uploader
  const CFG = { 
    MAX_FILES: MAX_IMAGES, 
    MAX_MB: 5, 
    TYPES: ["image/jpeg", "image/png"] 
  };

  // habilita accept/multiple por si no viene en el HTML
  if (upInput) {
    upInput.setAttribute('accept', CFG.TYPES.join(','));
    upInput.multiple = true;
  }

  // ---------- estado interno
  let files = [];          
  let previewURLs = [];    
  let openerBtn = null;    
  let trapHandler = null;  
  let hasAttemptedSubmit = false; 
  let lastInvalids = [];   

  //   API de CP/Colonia  
  const CP_API     = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_cpcolonia.php";
  const CP_BODY    = { all: true }; // si backend soporta estatus:1, se podría añadir
  const CP_TIMEOUT = 10000;

  // fallback por si truena el API (así la UI no se queda muerta)
  const CP_CATALOG_FALLBACK = {
    "00000": ["Fallback"],
  };

  // catálogo efectivo en memoria (inicia con fallback; si API trae datos, lo sobrescribimos)
  let CP_CATALOG = { ...CP_CATALOG_FALLBACK };
  let CP_LOADED  = false; // carga perezosa

  const getCpList = () => Object.keys(CP_CATALOG).sort();
  const knownCP   = (cp) => Object.prototype.hasOwnProperty.call(CP_CATALOG, cp);

  async function fetchWithTimeout(url, opts = {}, timeout = 10000) {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(to);
      return res;
    } catch (e) {
      clearTimeout(to);
      throw e;
    }
  }

  async function loadCpCatalog() {
    if (CP_LOADED) return true; // cache (si quieres TTL, acá lo puedes manejar)
    try {
      const res = await fetchWithTimeout(
        CP_API,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(CP_BODY) },
        CP_TIMEOUT
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json?.ok || !Array.isArray(json?.data)) throw new Error("Formato inesperado");

      const map = {};
      for (const row of json.data) {
        const cp  = String(row?.cp || "").trim();
        const col = String(row?.colonia || "").trim();
        const active = row?.estatus == null || row?.estatus === 1 || row?.estatus === "1" || row?.estatus === true;
        if (!cp || !col || !active) continue;
        if (!map[cp]) map[cp] = [];
        if (!map[cp].includes(col)) map[cp].push(col);
      }
      Object.keys(map).forEach(cp => map[cp].sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"})));

      if (Object.keys(map).length) CP_CATALOG = map; // usa API si trajo algo
      CP_LOADED = true;
      return true;
    } catch (err) {
      console.warn("[IX] CP API falló, usando fallback:", err);
      CP_LOADED = true; // evitamos reintentos en bucle
      return false;
    }
  }

  // ===========================================================
  //   Utils de UI / accesibilidad / selects / uploader
  // ===========================================================
  const digits  = (s) => (s || "").replace(/\D+/g, "");
  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

  const clearFeedback = () => { feedback.hidden = true; feedback.textContent = ""; };
  const showFeedback  = (msgHtml) => { feedback.hidden = false; feedback.innerHTML = msgHtml; };

  const labelFor = (el) =>
    el?.closest('.ix-field')?.querySelector('label')?.textContent?.trim() ||
    el?.getAttribute?.('aria-label') ||
    el?.name || el?.id || 'Campo';

  const setFieldError = (inputEl, msg = "") => {
    const field = inputEl?.closest?.(".ix-field");
    const help  = field?.querySelector(".ix-help");
    if (!field) return;

    // aria para lectores de pantalla
    if (inputEl && 'setAttribute' in inputEl) {
      inputEl.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }

    if (msg) {
      field.classList.add("ix-field--error");
      if (help) { help.hidden = false; help.textContent = msg; }
    } else {
      field.classList.remove("ix-field--error");
      if (help) { help.hidden = true; help.textContent = ""; }
    }
  };

  const clearAllFieldErrors = () => {
    modal.querySelectorAll('.ix-field').forEach(f => {
      f.classList.remove('ix-field--error');
      const help = f.querySelector('.ix-help');
      if (help) { help.hidden = true; help.textContent = ""; }
    });
    modal.querySelectorAll('input,select,textarea').forEach(el=>{
      el.setAttribute('aria-invalid','false');
    });
  };

  const updateDescCount = () => {
    const len = (inpDesc.value || "").length;
    cntDesc.textContent = String(len);
  };

  // --- helpers de select
  const makeOpt = (val, label, { disabled = false, selected = false } = {}) => {
    const o = document.createElement("option");
    o.value = val; o.textContent = label;
    if (disabled) o.disabled = true;
    if (selected) o.selected = true;
    return o;
  };

  const ensureSelect = (el, { nameFallback, idFallback } = {}) => {
    if (el && el.tagName === "SELECT") return el;
    const sel = document.createElement("select");
    sel.id   = el?.id   || idFallback   || "";
    sel.name = el?.name || nameFallback || "";
    sel.className = el?.className || "";
    sel.required = true;
    el?.replaceWith?.(sel);
    return sel;
  };

  const ensureCpSelect  = () => (inpCP  = ensureSelect(inpCP,  { nameFallback: "cp",      idFallback: "ix-cp" }));
  const ensureColSelect = () => (inpCol = ensureSelect(inpCol, { nameFallback: "colonia", idFallback: "ix-colonia" }));

  function setCpLoading(loading) {
    ensureCpSelect(); ensureColSelect();
    inpCP.disabled  = loading;
    inpCol.disabled = loading;
    if (loading) {
      inpCP.innerHTML  = ""; inpCP.appendChild(makeOpt("", "Cargando C.P.…", { disabled:true, selected:true }));
      inpCol.innerHTML = ""; inpCol.appendChild(makeOpt("", "Cargando…",      { disabled:true, selected:true }));
    }
  }

  function populateCpOptions() {
    ensureCpSelect();
    const list = getCpList();
    inpCP.innerHTML = "";
    if (!list.length) {
      inpCP.appendChild(makeOpt("", "Sin C.P. disponibles", { disabled:true, selected:true }));
      inpCP.disabled = true;
      return;
    }
    inpCP.appendChild(makeOpt("", "Selecciona C.P.", { disabled:true, selected:true }));
    list.forEach(cp => inpCP.appendChild(makeOpt(cp, cp)));
    inpCP.disabled = false;
  }

  function resetColonia(msg = "Selecciona C.P. primero") {
    ensureColSelect();
    inpCol.innerHTML = "";
    inpCol.appendChild(makeOpt("", msg, { disabled:true, selected:true }));
    inpCol.disabled = true;
  }

  function populateColoniasForCP(cp) {
    ensureColSelect();
    const cols = CP_CATALOG[cp] || [];
    inpCol.innerHTML = "";
    if (!cols.length) {
      inpCol.appendChild(makeOpt("", "Sin colonias para ese C.P.", { disabled:true, selected:true }));
      inpCol.disabled = true;
      return;
    }
    inpCol.appendChild(makeOpt("", "Selecciona colonia", { disabled:true, selected:true }));
    cols.forEach(col => inpCol.appendChild(makeOpt(col, col)));
    inpCol.disabled = false;
  }

  // --- Uploader (agregamos botón “Subir imágenes” para que sea obvio dónde dar click)
  const ensureUploadButton = () => {
    if (!upWrap) return;
    let btn = upWrap.querySelector("#ix-evidencia-cta");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.id = "ix-evidencia-cta";
      btn.className = "ix-upload-btn";
      btn.textContent = "Subir imágenes";
      upWrap.prepend(btn);
    }
    btn.addEventListener("click", () => upInput?.click());
  };

  function refreshPreviews() {
    // libera URLs previas para no fugar memoria
    previewURLs.forEach(url => URL.revokeObjectURL(url));
    previewURLs = [];

    previews.innerHTML = "";
    files.forEach((file, idx) => {
      const fig = document.createElement("figure");
      const img = document.createElement("img");
      const btn = document.createElement("button");

      const url = URL.createObjectURL(file);
      previewURLs.push(url);

      img.src = url;
      img.alt = file.name;

      btn.type = "button";
      btn.textContent = "×";
      btn.setAttribute("aria-label", "Eliminar imagen");
      btn.addEventListener("click", () => {
        files.splice(idx, 1);
        refreshPreviews();
        if (hasAttemptedSubmit) validateForm(true);
      });

      fig.appendChild(img);
      fig.appendChild(btn);
      previews.appendChild(fig);
    });
  }

  function handleFiles(list) {
    const incoming = Array.from(list || []);
    for (const f of incoming) {
      if (!CFG.TYPES.includes(f.type)) { showFeedback("Solo se permiten imágenes JPG o PNG."); continue; }
      if (f.size > CFG.MAX_MB * 1024 * 1024) { showFeedback(`Cada archivo debe pesar ≤ ${CFG.MAX_MB} MB.`); continue; }
      if (files.length >= CFG.MAX_FILES) { showFeedback(`Máximo ${CFG.MAX_FILES} imágenes.`); break; }
      files.push(f);
    }
    refreshPreviews();
  }

  // click área y drag&drop
  upWrap?.addEventListener("click", (e) => {
    if (e.target instanceof HTMLElement && e.target.tagName === "BUTTON") return; // evita tapar el botón de eliminar
    upInput?.click();
  });
  upInput?.addEventListener("change", (e) => handleFiles(e.target.files));
  ["dragenter", "dragover"].forEach((ev) =>
    upWrap?.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); upWrap.classList.add("is-drag"); })
  );
  ["dragleave", "drop"].forEach((ev) =>
    upWrap?.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); upWrap.classList.remove("is-drag"); })
  );
  upWrap?.addEventListener("drop", (e) => handleFiles(e.dataTransfer?.files || []));

  // ===========================================================
  //   Focus trap + abrir/cerrar
  // ===========================================================
  const getFocusable = () =>
    Array.from(dialog.querySelectorAll(
      'a[href],button:not([disabled]),textarea,input:not([disabled]),select,[tabindex]:not([tabindex="-1"])'
    )).filter((el) => el.offsetParent !== null);

  function trap(e) {
    if (e.key !== "Tab") return;
    const list = getFocusable(); if (!list.length) return;
    const first = list[0], last = list[list.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function openModal(
    { title = "Reporte", depKey = "samapa", itemId = "", sla = "" } = {},
    opener = null
  ) {
    openerBtn = opener || document.activeElement;

    // título + req
    subTitle.textContent = title;
    inpReq.value = title;

    // reseteo general
    clearFeedback();
    hasAttemptedSubmit = false;
    form.reset();
    clearAllFieldErrors();
    files = [];
    refreshPreviews();
    updateDescCount();

    // guarda depKey/itemId en dataset para el payload del submit
    form.dataset.depKey = depKey || "";
    form.dataset.itemId = itemId || "";

    // CP/Colonia: deja “cargando…”, trae catálogo y puebla
    setCpLoading(true);
    loadCpCatalog().then(() => {
      populateCpOptions();
      resetColonia(); // colonia bloqueada hasta elegir CP
      inpCP.value = ""; // placeholder visible siempre
    });

    // muestra modal
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    // trap + esc + overlay
    trapHandler = (e) => { if (e.key === "Escape") closeModal(); else trap(e); };
    document.addEventListener("keydown", trapHandler);
    overlay?.addEventListener("click", closeModal, { once: true });
    btnCloses.forEach((b) => b.addEventListener("click", closeModal, { once: true }));

    // foco inicial
    setTimeout(() => { inpNombre?.focus(); }, 0);

    // evento público
    try { document.dispatchEvent(new CustomEvent("ix:report:open", { detail: { depKey, itemId, title, sla } })); } catch { }
  }

  function closeModal() {
    document.removeEventListener("keydown", trapHandler || (() => {}));
    trapHandler = null;

    // limpia previews + revoke URLs
    previewURLs.forEach(url => URL.revokeObjectURL(url));
    previewURLs = [];
    previews.innerHTML = "";

    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";

    if (openerBtn && typeof openerBtn.focus === "function") openerBtn.focus();
    openerBtn = null;

    try { document.dispatchEvent(new CustomEvent("ix:report:close")); } catch { }
  }

  // ===========================================================
  //   Validaciones (solo muestran después del 1er submit)
  // ===========================================================
  function validateForm(showErrors = true) {
    let ok = true;
    lastInvalids = [];

    // nombre
    const nombre = (inpNombre.value || "").trim();
    if (!(nombre.length >= 5 || nombre.split(/\s+/).length >= 2)) {
      ok = false; if (showErrors) setFieldError(inpNombre, "Ingresa tu nombre completo.");
      lastInvalids.push({ el: inpNombre, msg: "Ingresa tu nombre completo.", label: labelFor(inpNombre) });
    } else setFieldError(inpNombre);

    // domicilio
    if (!(inpDom.value || "").trim()) {
      ok = false; if (showErrors) setFieldError(inpDom, "El domicilio es obligatorio.");
      lastInvalids.push({ el: inpDom, msg: "El domicilio es obligatorio.", label: labelFor(inpDom) });
    } else setFieldError(inpDom);

    // C.P.
    const cpVal    = inpCP?.value || "";
    const cpDigits = digits(cpVal);
    const cpBad    = !cpVal || cpDigits.length !== 5 || !knownCP(cpVal);
    if (cpBad) {
      ok = false; if (showErrors) setFieldError(inpCP, "Selecciona un C.P. válido.");
      lastInvalids.push({ el: inpCP, msg: "Selecciona un C.P. válido.", label: labelFor(inpCP) });
    } else setFieldError(inpCP);

    // Colonia
    const colVal   = inpCol?.value || "";
    const validCols= CP_CATALOG[cpVal] || [];
    const colBad   = !colVal || !validCols.includes(colVal);
    if (colBad) {
      ok = false; if (showErrors) setFieldError(inpCol, "Selecciona una colonia válida.");
      lastInvalids.push({ el: inpCol, msg: "Selecciona una colonia válida.", label: labelFor(inpCol) });
    } else setFieldError(inpCol);

    // Teléfono
    const tel = digits(inpTel.value);
    if (tel.length !== 10) {
      ok = false; if (showErrors) setFieldError(inpTel, "Teléfono a 10 dígitos.");
      lastInvalids.push({ el: inpTel, msg: "Teléfono a 10 dígitos.", label: labelFor(inpTel) });
    } else setFieldError(inpTel);

    // Correo (opcional)
    const mail = (inpCorreo.value || "").trim();
    if (mail && !isEmail(mail)) {
      ok = false; if (showErrors) setFieldError(inpCorreo, "Correo no válido.");
      lastInvalids.push({ el: inpCorreo, msg: "Correo no válido.", label: labelFor(inpCorreo) });
    } else setFieldError(inpCorreo);

    // Descripción
    const desc = (inpDesc.value || "").trim();
    if (desc.length < 30) {
      ok = false; if (showErrors) setFieldError(inpDesc, "Describe con al menos 30 caracteres.");
      lastInvalids.push({ el: inpDesc, msg: "Describe con al menos 30 caracteres.", label: labelFor(inpDesc) });
    } else setFieldError(inpDesc);

    // Consentimiento
    if (!chkCons.checked) {
      ok = false; if (showErrors) setFieldError(chkCons, "Debes aceptar el consentimiento.");
      lastInvalids.push({ el: chkCons, msg: "Debes aceptar el consentimiento.", label: labelFor(chkCons) });
    } else setFieldError(chkCons);

    // Límite de archivos (duro)
    if (files.length > CFG.MAX_FILES) {
      ok = false;
      showFeedback?.(`Máximo ${CFG.MAX_FILES} imágenes.`);
    }

    return ok;
  }

  // inputs: después del 1er submit, si el user corrige, refrescamos errores
  [inpNombre, inpDom, inpTel, inpCorreo, inpDesc, chkCons].forEach((el) => {
    el?.addEventListener("input", () => {
      if (!hasAttemptedSubmit) return;
      if (el === inpTel)  el.value = digits(el.value).slice(0, 10);
      if (el === inpDesc) updateDescCount();
      validateForm(true);
    });
  });

  // selects: CP/Colonia
  modal.addEventListener("change", (e) => {
    const t = e.target;

    if (t && t.id === "ix-cp") {
      const v = t.value || "";
      if (!v || !knownCP(v)) {
        resetColonia();             // deja colonia bloqueada
      } else {
        populateColoniasForCP(v);   // llena y habilita colonia
      }
      if (hasAttemptedSubmit) validateForm(true);
    }

    if (t && t.id === "ix-colonia") {
      if (hasAttemptedSubmit) validateForm(true);
    }
  });

  // ===========================================================
  //   Submit (no bloquea; lista errores; éxito simulado)
  // ===========================================================
  form.addEventListener("submit", (e) => {
    e.preventDefault(); // nos quedamos en la página siempre
    clearFeedback();
    hasAttemptedSubmit = true;

    const ok = validateForm(true);
    if (!ok) {
      // arma lista de errores (amigable)
      const items = lastInvalids.map(x => `<li><strong>${x.label}:</strong> ${x.msg}</li>`).join("");
      showFeedback(`<strong>Faltan datos:</strong><ul>${items}</ul>`);

      // enfoca y hace scroll al primero
      const bad = lastInvalids[0]?.el;
      if (bad) {
        bad.focus({ preventScroll: true });
        bad.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return; // ojo: no deshabilitamos el botón; el user puede corregir y volver a enviar
    }

    // --- flujo de éxito (simulado). Aquí sí bloqueamos para evitar doble envío
    btnSend.disabled = true;
    btnSend.textContent = "Enviando…";
    Array.from(form.elements).forEach((el) => (el.disabled = el === btnSend ? false : true));

    setTimeout(() => {
      const stamp = Date.now() % 1000000;
      const folio = "ID" + String(stamp).padStart(5, "0");
      try { sessionStorage.setItem("ix_last_folio", folio); } catch {}

      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      payload.telefono = digits(payload.telefono || "");
      payload.cp       = inpCP?.value || "";
      payload.colonia  = inpCol?.value || "";
      payload.folio    = folio;
      payload._filesCount = files.length;
      payload.depKey   = form.dataset.depKey || "";
      payload.itemId   = form.dataset.itemId || "";

      try { document.dispatchEvent(new CustomEvent("ix:report:submit",  { detail: payload })); } catch {}
      try { document.dispatchEvent(new CustomEvent("ix:report:success", { detail: { folio } })); } catch {}

      if (window.gcToast) gcToast(`Reporte creado: ${folio}`, "exito", 3000);
      else alert(`Reporte creado: ${folio}`);

      // reset UI
      Array.from(form.elements).forEach((el) => (el.disabled = false));
      btnSend.textContent = "Mandar reporte";
      form.reset();
      clearAllFieldErrors();
      feedback.hidden = true; feedback.textContent = "";
      files = [];
      refreshPreviews();
      updateDescCount();
      closeModal();
    }, 800);
  });

  // ===========================================================
  //   API pública + setup
  // ===========================================================
  window.ixReportModal = {
    open:  (opts = {}, opener) => openModal(opts, opener),
    close: () => closeModal(),
  };

  ensureUploadButton();
})();
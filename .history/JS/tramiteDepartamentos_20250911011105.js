//----------------------------- módulo de departamentos 
document.addEventListener("DOMContentLoaded", () => {
  const wrap = document.querySelector("#tramites .ix-wrap");
  if (!wrap) return;

  // --- mini debug
  if (typeof window.IX_DEBUG === "undefined") window.IX_DEBUG = true;
  const ixLog = (...a) => { if (window.IX_DEBUG) try { console.log("[IX]", ...a); } catch {} };

  // refs base de la vista
  const grid = wrap.querySelector(".ix-grid");
  const note = wrap.querySelector(".ix-note");
  const h2   = wrap.querySelector("#deps-title");

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

  const listEl  = panel.querySelector("#ix-dep-list");
  const btnList = panel.querySelector(".ix-action--list");
  const btnGrid = panel.querySelector(".ix-action--grid");

  // ========= Endpoints (HTTPS sí o sí para evitar mixed content) =========
  const ENDPOINTS = {
    deps:    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/ixtla01_c_departamento.php",
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
    try { sessionStorage.setItem(k, JSON.stringify({ t: Date.now(), ttl, v })); } catch {}
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

  const el = (html) => { const t=document.createElement("template"); t.innerHTML=html.trim(); return t.content.firstChild; };

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
    panel.classList.toggle("view-list",  v === "list");
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
    const title  = btn.dataset.title || "Trámite";
    const itemId = btn.dataset.id;
    const sla    = btn.closest(".ix-dep-item")?.querySelector(".ix-sla")?.textContent || "-";

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
  panel.classList.toggle("view-list",  v === "list");
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
  const timeMeta  = modal.querySelector("#ix-report-date");  // (por si lo usas)
  const inpFecha  = modal.querySelector("#ix-fecha");        // (por si lo usas)

  const inpNombre = modal.querySelector("#ix-nombre");
  const inpDom    = modal.querySelector("#ix-domicilio");
  let   inpCP     = modal.querySelector("#ix-cp");       // <- puede venir como input o select, ahorita lo normalizo
  let   inpCol    = modal.querySelector("#ix-colonia");  // <- puede mutar entre input/select

  const inpTel    = modal.querySelector("#ix-telefono");
  const inpCorreo = modal.querySelector("#ix-correo");
  const inpDesc   = modal.querySelector("#ix-descripcion");
  const cntDesc   = modal.querySelector("#ix-desc-count");
  const chkCons   = modal.querySelector("#ix-consent");
  const btnSend   = modal.querySelector("#ix-submit");

  const upWrap    = modal.querySelector(".ix-upload");
  const upInput   = modal.querySelector("#ix-evidencia");
  const previews  = modal.querySelector("#ix-evidencia-previews");

  // ---------- config uploader
  const CFG = {
    MAX_FILES: 3,
    MAX_MB: 5,
    TYPES: ["image/jpeg", "image/png"],
  };

  // ---------- estado interno
  let files = [];         // File[]
  let openerBtn = null;   // para devolver foco
  let trapHandler = null; // focus trap
  let hasAttemptedSubmit = false; // <<-- clave: no mostramos errores hasta submit

  // ---------- catálogo de CP -> colonias (pon los reales aquí)
  // Puedes meter 1 o N colonias por C.P. Si pones 1, dejo #ix-colonia como input readonly; si hay varias, lo convierto a select.
  const CP_CATALOG = {
    "45670": ["Centro", "La Loma", "San Miguel"],
    "45671": ["San Isidro"],
    "45672": ["Barrancas", "El Mirador"],
    // "00000": ["Única colonia"], ...
  };

  // ---------- utils
  const digits  = (s) => (s || "").replace(/\D+/g, "");
  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

  // feedback global
  const clearFeedback = () => { feedback.hidden = true; feedback.textContent = ""; };
  const showFeedback  = (msg) => { feedback.hidden = false; feedback.textContent = msg; };

  // marca/unmarca error visual por campo
  const setFieldError = (inputEl, msg = "") => {
    const field = inputEl?.closest?.(".ix-field");
    const help  = field?.querySelector(".ix-help");
    if (!field) return;
    if (msg) {
      field.classList.add("ix-field--error");
      if (help) { help.hidden = false; help.textContent = msg; }
    } else {
      field.classList.remove("ix-field--error");
      if (help) { help.hidden = true; help.textContent = ""; }
    }
  };

  // contador de descripción
  const updateDescCount = () => { const len = (inpDesc.value || "").length; cntDesc.textContent = String(len); };

  // =========================
  // Normalizo #ix-cp a SELECT (si viniera como input lo reemplazo sin romper name/id)
  // =========================
  const ensureCpSelect = () => {
    if (!inpCP) return null;
    if (inpCP.tagName === "SELECT") return inpCP;

    const sel = document.createElement("select");
    sel.id   = inpCP.id || "ix-cp";
    sel.name = inpCP.name || "cp";
    sel.className = inpCP.className || "";
    sel.required = true;

    // inserto select en lugar del input
    inpCP.replaceWith(sel);
    inpCP = sel;
    return sel;
  };

  // helper para crear opción
  const makeOpt = (val, label, {disabled=false, selected=false}={}) => {
    const o = document.createElement("option");
    o.value = val; o.textContent = label;
    if (disabled) o.disabled = true;
    if (selected) o.selected = true;
    return o;
  };

  // puebla el select de CP
  const populateCpOptions = () => {
    const sel = ensureCpSelect();
    if (!sel) return;

    // limpio y meto placeholder
    sel.innerHTML = "";
    sel.appendChild(makeOpt("", "Selecciona C.P.", {disabled:true, selected:true}));

    const cps = Object.keys(CP_CATALOG).sort();
    cps.forEach(cp => sel.appendChild(makeOpt(cp, cp)));
  };

  // =========================
  // Colonia: auto según C.P.
  //  - si hay 1 colonia → input (readonly, valor fijo)
  //  - si hay N>1 colonias → select con opciones
  //  - si 0 o cp vacío → input editable vacío
  // =========================
  const toColoniaInput = (value = "", {readonly=false}={}) => {
    // si ya es input solo ajusto
    if (inpCol && inpCol.tagName === "INPUT") {
      inpCol.value = value;
      inpCol.readOnly = !!readonly;
      return inpCol;
    }
    // si es select, lo reemplazo
    const input = document.createElement("input");
    input.type = "text";
    input.id = inpCol?.id || "ix-colonia";
    input.name = inpCol?.name || "colonia";
    input.className = inpCol?.className || "";
    input.placeholder = "Colonia";
    input.value = value;
    input.readOnly = !!readonly;

    inpCol.replaceWith(input);
    inpCol = input;
    return input;
  };

  const toColoniaSelect = (colonias = []) => {
    // si ya es select, repoblo
    if (inpCol && inpCol.tagName === "SELECT") {
      inpCol.innerHTML = "";
      inpCol.appendChild(makeOpt("", "Selecciona colonia", {disabled:true, selected:true}));
      colonias.forEach(c => inpCol.appendChild(makeOpt(c, c)));
      return inpCol;
    }
    // si es input, lo reemplazo por select
    const sel = document.createElement("select");
    sel.id = inpCol?.id || "ix-colonia";
    sel.name = inpCol?.name || "colonia";
    sel.className = inpCol?.className || "";

    sel.appendChild(makeOpt("", "Selecciona colonia", {disabled:true, selected:true}));
    colonias.forEach(c => sel.appendChild(makeOpt(c, c)));

    inpCol.replaceWith(sel);
    inpCol = sel;
    return sel;
  };

  const applyColoniaForCP = (cpVal) => {
    const list = CP_CATALOG[cpVal] || [];
    if (!cpVal) {
      // sin cp: input vacío editable
      toColoniaInput("", {readonly:false});
      return;
    }
    if (list.length === 0) {
      // cp sin catálogo: input editable vacío (por si el usuario la escribe)
      toColoniaInput("", {readonly:false});
      return;
    }
    if (list.length === 1) {
      // única colonia → lo fijo en input readonly
      toColoniaInput(list[0], {readonly:true});
      return;
    }
    // varias colonias → select
    toColoniaSelect(list);
  };

  // =========================
  // Uploader (agrego botón "Subir imágenes")
  // =========================
  const ensureUploadButton = () => {
    if (!upWrap) return;
    let btn = upWrap.querySelector("#ix-evidencia-cta");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.id = "ix-evidencia-cta";
      btn.className = "ix-upload-btn";
      btn.textContent = "Subir imágenes";
      // lo pongo arriba del drop-zone
      upWrap.prepend(btn);
    }
    btn.addEventListener("click", () => upInput?.click());
  };

  function refreshPreviews() {
    previews.innerHTML = "";
    files.forEach((file, idx) => {
      const fig = document.createElement("figure");
      const img = document.createElement("img");
      const btn = document.createElement("button");
      img.src = URL.createObjectURL(file);
      img.alt = file.name;
      btn.type = "button";
      btn.textContent = "×";
      btn.setAttribute("aria-label", "Eliminar imagen");
      btn.addEventListener("click", () => {
        files.splice(idx, 1);
        refreshPreviews();
        if (hasAttemptedSubmit) validateForm(true); // si ya intentó enviar, revalido/limpio
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

  // click área y drag&drop (se mantienen)
  upWrap?.addEventListener("click", (e) => {
    if (e.target instanceof HTMLElement && e.target.tagName === "BUTTON") return;
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

  // =========================
  // Focus trap + open/close
  // =========================
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

    // título y req
    subTitle.textContent = title;
    inpReq.value = title;

    // estado inicial: sin feedback ni errores visibles
    clearFeedback();
    hasAttemptedSubmit = false;

    // reseteo form y previews
    form.reset();
    files = [];
    refreshPreviews();
    updateDescCount();

    // aseguro CP select y lo lleno
    populateCpOptions();
    applyColoniaForCP(""); // colonia limpia por default

    // activo modal
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    // focus trap + esc + overlay
    trapHandler = (e) => { if (e.key === "Escape") closeModal(); else trap(e); };
    document.addEventListener("keydown", trapHandler);
    overlay?.addEventListener("click", closeModal, { once: true });
    btnCloses.forEach((b) => b.addEventListener("click", closeModal, { once: true }));

    // enfoque al primer campo
    setTimeout(() => { inpNombre.focus(); }, 0);

    // evento público
    try { document.dispatchEvent(new CustomEvent("ix:report:open", { detail: { depKey, itemId, title, sla } })); } catch {}
  }

  function closeModal() {
    document.removeEventListener("keydown", trapHandler || (() => {}));
    trapHandler = null;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (openerBtn && typeof openerBtn.focus === "function") openerBtn.focus();
    openerBtn = null;
    try { document.dispatchEvent(new CustomEvent("ix:report:close")); } catch {}
  }

  // =========================
  // Validaciones (solo muestran errores tras primer submit)
  // =========================
  function validateForm(showErrors = true) {
    let ok = true;

    // nombre
    const nombre = (inpNombre.value || "").trim();
    if (!(nombre.length >= 5 || nombre.split(/\s+/).length >= 2)) {
      ok = false; if (showErrors) setFieldError(inpNombre, "Ingresa tu nombre completo."); 
    } else setFieldError(inpNombre);

    // domicilio
    if (!(inpDom.value || "").trim()) {
      ok = false; if (showErrors) setFieldError(inpDom, "El domicilio es obligatorio.");
    } else setFieldError(inpDom);

    // CP (select o input tolerante)
    const isCpSelect = inpCP && inpCP.tagName === "SELECT";
    const cpVal = isCpSelect ? (inpCP.value || "") : digits(inpCP.value || "");
    const cpBad = !cpVal || cpVal.length !== 5;
    if (cpBad) { ok = false; if (showErrors) setFieldError(inpCP, "Selecciona un C.P. válido."); }
    else setFieldError(inpCP);

    // colonia (si es select debe tener valor; si es input, al menos 3 chars cuando no readonly)
    if (inpCol.tagName === "SELECT") {
      const v = inpCol.value || "";
      if (!v) { ok = false; if (showErrors) setFieldError(inpCol, "Selecciona una colonia."); }
      else setFieldError(inpCol);
    } else {
      const v = (inpCol.value || "").trim();
      const need = !inpCol.readOnly; // si es readonly y viene fijo, no exijo nada
      if (need && v.length < 3) { ok = false; if (showErrors) setFieldError(inpCol, "Escribe la colonia."); }
      else setFieldError(inpCol);
    }

    // teléfono (10 dígitos)
    const tel = digits(inpTel.value);
    if (tel.length !== 10) { ok = false; if (showErrors) setFieldError(inpTel, "Teléfono a 10 dígitos."); }
    else setFieldError(inpTel);

    // correo (opcional, pero válido si viene)
    const mail = (inpCorreo.value || "").trim();
    if (mail && !isEmail(mail)) { ok = false; if (showErrors) setFieldError(inpCorreo, "Correo no válido."); }
    else setFieldError(inpCorreo);

    // descripción (30+)
    const desc = (inpDesc.value || "").trim();
    if (desc.length < 30) { ok = false; if (showErrors) setFieldError(inpDesc, "Describe con al menos 30 caracteres."); }
    else setFieldError(inpDesc);

    // consentimiento
    if (!chkCons.checked) { ok = false; if (showErrors) setFieldError(chkCons, "Debes aceptar el consentimiento."); }
    else setFieldError(chkCons);

    // archivos (límite suave)
    if (files.length > CFG.MAX_FILES) ok = false;

    return ok;
  }

  // inputs: SOLO limpian errores en vivo **después** del 1er intento de submit
  [
    inpNombre, inpDom, inpTel, inpCorreo, inpDesc, chkCons
  ].forEach((el) => {
    el?.addEventListener("input", () => {
      if (el === inpDesc) updateDescCount();
      if (!hasAttemptedSubmit) return;
      // normalizaciones suaves SIN mostrar errores si no se intentó enviar
      if (el === inpTel) el.value = digits(el.value).slice(0, 10);
      // revalido para ir limpiando mensajes
      validateForm(true);
    });
  });

  // cp/colonia listeners
  inpCP?.addEventListener("change", () => {
    applyColoniaForCP(inpCP.value || "");
    if (!hasAttemptedSubmit) return;
    validateForm(true);
  });
  // cuando la colonia sea select
  modal.addEventListener("change", (e) => {
    const t = e.target;
    if (t && t.id === "ix-colonia" && t.tagName === "SELECT" && hasAttemptedSubmit) {
      validateForm(true);
    }
  });

  // =========================
  // Submit (simulado)
  // =========================
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearFeedback();
    hasAttemptedSubmit = true; // desde aquí ya mostramos errores

    if (!validateForm(true)) {
      showFeedback("Revisa los campos marcados y vuelve a intentar.");
      // foco al primero con error
      const bad = modal.querySelector(".ix-field.ix-field--error input, .ix-field.ix-field--error select, .ix-field.ix-field--error textarea, .ix-field.ix-field--error [type='checkbox']");
      bad?.focus();
      return;
    }

    // estado enviando
    btnSend.disabled = true;
    btnSend.textContent = "Enviando…";
    Array.from(form.elements).forEach((el) => (el.disabled = el === btnSend ? false : true));

    // simulamos latencia
    setTimeout(() => {
      const stamp = Date.now() % 1000000;
      const folio = "ID" + String(stamp).padStart(5, "0");

      try { sessionStorage.setItem("ix_last_folio", folio); } catch {}

      // payload final (normalizo tel/cp)
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.telefono = digits(payload.telefono || "");
      // si el cp es select ya está limpio; si viniera como input, lo normalizo
      const isCpSelect = inpCP && inpCP.tagName === "SELECT";
      payload.cp = isCpSelect ? (inpCP.value || "") : digits(payload.cp || "");
      payload.folio = folio;
      payload._filesCount = files.length;

      try { document.dispatchEvent(new CustomEvent("ix:report:submit", { detail: payload })); } catch {}
      try { document.dispatchEvent(new CustomEvent("ix:report:success", { detail: { folio } })); } catch {}

      if (window.gcToast) gcToast(`Reporte creado: ${folio}`, "exito", 3000);
      else alert(`Reporte creado: ${folio}`);

      Array.from(form.elements).forEach((el) => (el.disabled = false));
      btnSend.textContent = "Mandar reporte";
      form.reset();
      files = [];
      refreshPreviews();
      updateDescCount();
      closeModal();
    }, 800);
  });

  // =========================
  // API pública + setup de UI extra (botón subir)
  // =========================
  window.ixReportModal = {
    open: (opts = {}, opener) => openModal(opts, opener),
    close: () => closeModal(),
  };

  // preparo botón de subir y el select de CP (por si el modal ya está en DOM desde antes)
  ensureUploadButton();
  // ojo: el populateCpOptions se hace en openModal para resetear siempre el estado
})();

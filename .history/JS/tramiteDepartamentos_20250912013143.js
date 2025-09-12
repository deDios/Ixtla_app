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

  // ========= helpers para detectar "Otros" =========
  // normalizo: sin acentos, lowercase, trim — para que “OTROS”, “Otro”, etc. hagan match igual
  const norm = (s) => (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const isOtros = (title) => {
    const n = norm(title);
    return n === "otros" || n === "otro";
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
  const ICON_PLACEHOLDER = "/ASSETS/departamentos/placeholder_icon.png";
  const CARD_PLACEHOLDER = "/ASSETS/departamentos/placeholder_card.png";
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

  // fallback de imagen
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
    const CK = "ix_dep_meta";
    const hit = cacheGet(CK);
    if (hit) return hit;

    const json = await withTimeout((signal) =>
      fetch(ENDPOINTS.deps, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ status: 1 }),
        signal
      }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    );

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
    const json = await withTimeout((signal) =>
      fetch(ENDPOINTS.tramite, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ departamento_id: Number(depId), all: true }),
        signal
      }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    );

    const raw = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    const rows = raw.filter(r =>
      Number(r?.departamento_id) === Number(depId) &&
      (r?.estatus === undefined || Number(r?.estatus) === 1)
    );

    const items = rows.map(r => ({
      id: String(Number(r.id)),
      depId: String(Number(depId)),
      title: String(r?.nombre || "Trámite").trim(),
      desc: String(r?.descripcion || "").trim(),
      sla: null,
    }))
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

    // botón (+) con datasets
    const btn = li.querySelector(".ix-dep-add");
    btn.innerHTML = plusSvg;
    btn.dataset.dep = it.depId;
    btn.dataset.id = it.id;
    btn.dataset.title = it.title;
    btn.setAttribute("aria-label", `Iniciar ${it.title}`);

    // 👉 si es “Otros”, lo marco aquí para que el modal no adivine
    if (isOtros(it.title)) btn.dataset.mode = "otros";

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

    // 👉 idem: marquito “Otros” para el modal
    if (isOtros(it.title)) btn.dataset.mode = "otros";

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

    let depMeta = {};
    try { depMeta = await fetchDeps(); } catch (e) { ixLog("dep meta falló:", e?.message || e); }

    const nombreDep = depMeta[depId]?.nombre || `Departamento #${depId}`;
    h2.textContent = `${nombreDep}`;
    panel.querySelector(".ix-dep-heading").textContent = "Trámites disponibles";
    document.title = `Trámites – ${nombreDep}`;

    renderSkeleton(4);

    try {
      const items = await fetchTramitesByDep(depId);
      reRender(items);

      // deep-link: si viene ?req=<id>, abro el modal directo
      const req = new URLSearchParams(location.search).get("req");
      if (req && window.ixReportModal?.open) {
        const it = items.find(x => String(x.id) === String(req));
        if (it) {
          // 👉 paso mode “otros” si aplica; así el modal cae en la variante correcta
          const mode = isOtros(it.title) ? "otros" : "normal";
          ixReportModal.open({
            title: it.title,
            depKey: String(depId),
            itemId: it.id,
            sla: it.sla || "-",
            mode
          });
        }
      }
    } catch (err) {
      ixLog("catalogo dep falló:", err?.message || err);
      renderError("No se pudo cargar el catálogo.", () => showDep(depId));
    }
  }

  // ========= Toolbar: cambiar list/cards =========
  btnList.addEventListener("click", () => {
    if (getView() === "list") return;
    setView("list");
    const depId = parseDepParam(panel.dataset.dep);
    if (!depId) return;
    const items = [...listEl.querySelectorAll(".ix-dep-add")].map(btn => ({
      id: btn.dataset.id,
      depId: String(depId),
      title: btn.dataset.title,
      desc: btn.closest(".ix-dep-item")?.querySelector(".ix-card-desc, .ix-dep-content p")?.textContent || "",
      sla: btn.closest(".ix-dep-item")?.querySelector(".ix-sla")?.textContent || "-"
    }));
    reRender(items);
  });
  btnGrid.addEventListener("click", () => {
    if (getView() === "cards") return;
    setView("cards");
    const depId = parseDepParam(panel.dataset.dep);
    if (!depId) return;
    const items = [...listEl.querySelectorAll(".ix-dep-add")].map(btn => ({
      id: btn.dataset.id,
      depId: String(depId),
      title: btn.dataset.title,
      desc: btn.closest(".ix-dep-item")?.querySelector(".ix-dep-content p, .ix-card-desc")?.textContent || "",
      sla: btn.closest(".ix-dep-item")?.querySelector(".ix-sla")?.textContent || "-"
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

    // 👉 si ya venía marcado data-mode lo usamos; si no, inferimos por título
    const mode = btn.dataset.mode || (isOtros(title) ? "otros" : "normal");

    if (window.ixReportModal?.open) {
      ixReportModal.open(
        { title, depKey, itemId, sla, mode }, // le pasamos todo, incluyendo “mode”
        btn
      );
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












//--------------------------------------------------- modal de reporte (SAMAPA y demás)
(() => {
  const modal = document.getElementById("ix-report-modal");
  if (!modal) { console.warn("[IX] No existe #ix-report-modal, me salgo."); return; }

  // ---------- refs base (todo null-safe)
  const overlay   = modal.querySelector(".ix-modal__overlay");
  const dialog    = modal.querySelector(".ix-modal__dialog");
  const btnCloses = modal.querySelectorAll("[data-ix-close]");
  const form      = modal.querySelector("#ix-report-form");
  const feedback  = modal.querySelector("#ix-report-feedback");

  const subTitle  = modal.querySelector("#ix-report-subtitle");
  const inpReq    = modal.querySelector("#ix-report-req");

  const inpNombre = modal.querySelector("#ix-nombre");
  const inpDom    = modal.querySelector("#ix-domicilio");
  let   inpCP     = modal.querySelector("#ix-cp");      // puede ser <input> → lo haremos <select>
  let   inpCol    = modal.querySelector("#ix-colonia"); // idem

  const inpTel    = modal.querySelector("#ix-telefono");
  const inpCorreo = modal.querySelector("#ix-correo");
  const inpDesc   = modal.querySelector("#ix-descripcion");
  const cntDesc   = modal.querySelector("#ix-desc-count");
  const chkCons   = modal.querySelector("#ix-consent");
  const btnSend   = modal.querySelector("#ix-submit");

  const upWrap    = modal.querySelector(".ix-upload");
  const upInput   = modal.querySelector("#ix-evidencia");
  const previews  = modal.querySelector("#ix-evidencia-previews");

  // Campos opcionales (solo si existen en tu HTML nuevo)
  const asuntoGroup  = modal.querySelector("#ix-asunto-group");
  const inpAsunto    = modal.querySelector("#ix-asunto");
  const inpTramiteId = modal.querySelector("#ix-tramite-id");

  // ---------- config general
  const ENDPOINTS = {
    insertReq: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_i_requerimiento.php",
    cpcolonia: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_cpcolonia.php",
  };

  // uploader / validación
  const CFG = {
    MAX_FILES: 3,                 // 👈 límite de imágenes
    MAX_MB: 5,                    // por archivo
    TYPES: ["image/jpeg", "image/png"],
    ASSIGN_TO: 1,                 // asignado_a (por ahora fijo)
    PRIORIDAD: 2,
    ESTATUS: 0,                   // abierto
    CANAL: 1,                     // web
    CREATED_BY: 1,
    TIMEOUT_MS: 15000
  };

  // ---------- estado interno
  let files = [];
  let openerBtn = null;
  let trapHandler = null;
  let hasAttemptedSubmit = false;
  let currentDepId = null;   // llega desde ixReportModal.open
  let currentItemId = null;  // tramite_id

  // ---------- utils rápidas
  const digits  = (s) => (s || "").replace(/\D+/g, "");
  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  const el = (html) => { const t=document.createElement("template"); t.innerHTML=html.trim(); return t.content.firstChild; };

  const clearFeedback = () => { if (!feedback) return; feedback.hidden = true; feedback.textContent = ""; };
  const showFeedback  = (msg="Ocurrió un problema.") => { if (!feedback) return; feedback.hidden = false; feedback.textContent = msg; };

  const setFieldError = (inputEl, msg = "") => {
    const field = inputEl?.closest?.(".ix-field");
    const help = field?.querySelector(".ix-help");
    if (!field) return;
    if (msg) {
      field.classList.add("ix-field--error");
      if (help) { help.hidden = false; help.textContent = msg; }
    } else {
      field.classList.remove("ix-field--error");
      if (help) { help.hidden = true; help.textContent = ""; }
    }
  };

  const updateDescCount = () => { if (cntDesc && inpDesc) cntDesc.textContent = String((inpDesc.value || "").length); };

  // ---------- convierte input→select si hace falta (para CP/Colonia)
  const makeOpt = (val, label, { disabled=false, selected=false } = {}) => {
    const o = document.createElement("option");
    o.value = val; o.textContent = label;
    if (disabled) o.disabled = true;
    if (selected) o.selected = true;
    return o;
  };

  const ensureSelect = (el, { nameFallback, idFallback } = {}) => {
    if (el && el.tagName === "SELECT") return el;
    const sel = document.createElement("select");
    sel.id = el?.id || idFallback || "";
    sel.name = el?.name || nameFallback || "";
    sel.className = el?.className || "ix-input";
    sel.required = true;
    if (el) el.replaceWith(sel);
    return sel;
  };

  const ensureCpSelect  = () => (inpCP  = ensureSelect(inpCP,  { nameFallback:"cp",      idFallback:"ix-cp" }));
  const ensureColSelect = () => (inpCol = ensureSelect(inpCol, { nameFallback:"colonia", idFallback:"ix-colonia" }));

  // ---------- CP/Colonia por API (cache en memoria)
  let CP_TABLE = null; // [{cp, colonia}]
  let CP_MAP   = null; // { "44580": ["Centro", ...] }

  async function fetchCpColonia() {
    if (CP_TABLE && CP_MAP) return { CP_TABLE, CP_MAP };
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), CFG.TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINTS.cpcolonia, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ all: true }),
        signal: ctrl.signal
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const rows = Array.isArray(json?.data) ? json.data : [];
      CP_TABLE = rows.map(r => ({ cp: String(r?.cp||"").trim(), colonia: String(r?.colonia||"").trim() }))
                     .filter(r => r.cp && r.colonia);
      // armo mapa cp -> colonias
      const map = {};
      for (const r of CP_TABLE) {
        if (!map[r.cp]) map[r.cp] = [];
        if (!map[r.cp].includes(r.colonia)) map[r.cp].push(r.colonia);
      }
      // ordeno
      Object.keys(map).forEach(cp => map[cp].sort((a,b)=>a.localeCompare(b,'es')));
      CP_MAP = map;
      return { CP_TABLE, CP_MAP };
    } catch (e) {
      clearTimeout(t);
      console.warn("[IX] cp/colonia falló:", e?.message || e);
      throw e;
    }
  }

  function populateCpOptions() {
    ensureCpSelect();
    inpCP.innerHTML = "";
    inpCP.appendChild(makeOpt("", "Selecciona C.P.", { disabled:true, selected:true }));
    const cps = Object.keys(CP_MAP || {}).sort();
    cps.forEach(cp => inpCP.appendChild(makeOpt(cp, cp)));
  }

  function resetColonia(msg="Selecciona C.P. primero") {
    ensureColSelect();
    inpCol.innerHTML = "";
    inpCol.appendChild(makeOpt("", msg, { disabled:true, selected:true }));
    inpCol.disabled = true;
  }

  function populateColoniasForCP(cp) {
    ensureColSelect();
    const list = CP_MAP?.[cp] || [];
    inpCol.innerHTML = "";
    inpCol.appendChild(makeOpt("", "Selecciona colonia", { disabled:true, selected:true }));
    list.forEach(c => inpCol.appendChild(makeOpt(c, c)));
    inpCol.disabled = list.length === 0;
  }

  // ---------- uploader: previews + CTA “Subir imágenes”
  // deja un botón visible para que el usuario sepa dónde picar
  const ensureUploadCTA = () => {
    if (!upWrap) return;
    let cta = upWrap.querySelector("#ix-evidencia-cta");
    if (!cta) {
      cta = document.createElement("button");
      cta.type = "button";
      cta.id = "ix-evidencia-cta";
      cta.className = "ix-upload-btn";
      cta.textContent = "Subir imágenes";
      upWrap.prepend(cta);
    }
    cta.addEventListener("click", () => upInput?.click());
  };

  function refreshPreviews() {
    if (!previews) return;
    previews.innerHTML = "";
    files.forEach((file, idx) => {
      const fig = el(`<figure><img alt=""><button type="button" aria-label="Eliminar imagen">×</button></figure>`);
      const img = fig.querySelector("img");
      img.src = URL.createObjectURL(file);
      img.alt = file.name;
      fig.querySelector("button").addEventListener("click", () => {
        files.splice(idx, 1);
        refreshPreviews();
        if (hasAttemptedSubmit) validateForm(true);
      });
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

  upWrap?.addEventListener("click", (e) => {
    if (e.target instanceof HTMLElement && e.target.tagName === "BUTTON") return; // no dupliques cta
    upInput?.click();
  });
  upInput?.addEventListener("change", (e) => handleFiles(e.target.files));
  ["dragenter", "dragover"].forEach(ev => upWrap?.addEventListener(ev, (e)=>{e.preventDefault(); e.stopPropagation(); upWrap.classList.add("is-drag");}));
  ["dragleave", "drop"].forEach(ev => upWrap?.addEventListener(ev, (e)=>{e.preventDefault(); e.stopPropagation(); upWrap.classList.remove("is-drag");}));
  upWrap?.addEventListener("drop", (e)=> handleFiles(e.dataTransfer?.files || []));

  // ---------- focus trap + open/close del modal
  const getFocusable = () =>
    Array.from(dialog.querySelectorAll(
      'a[href],button:not([disabled]),textarea,input:not([disabled]),select,[tabindex]:not([tabindex="-1"])'
    )).filter(el => el.offsetParent !== null);

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
    { title = "Reporte", depKey = "1", itemId = "", sla = "" } = {},
    opener = null
  ) {
    openerBtn = opener || document.activeElement;
    currentDepId  = String(depKey || "1");
    currentItemId = String(itemId || "");

    // set textos base
    if (subTitle) subTitle.textContent = title;
    if (inpReq)   inpReq.value = title;
    if (inpTramiteId) inpTramiteId.value = currentItemId;

    // “Clasificación (Título)” solo si es Otros (si existe el grupo en HTML)
    const isOtros = (title || "").toLowerCase().includes("otro");
    if (asuntoGroup) {
      asuntoGroup.hidden = !isOtros;
      if (!isOtros && inpAsunto) inpAsunto.value = "";
    }

    // reset de UI
    clearFeedback();
    hasAttemptedSubmit = false;
    form?.reset();
    files = [];
    refreshPreviews();
    updateDescCount();

    // CP/Colonia: cargo catálogo y pinto selects
    // (si no hay API o falla, simplemente verás los selects vacíos con placeholder)
    ensureCpSelect(); ensureColSelect(); resetColonia();
    fetchCpColonia().then(() => {
      populateCpOptions();
      resetColonia();
    }).catch(()=>{/*nop*/});

    // abrir modal
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    // trap + esc + overlay
    trapHandler = (e) => { if (e.key === "Escape") closeModal(); else trap(e); };
    document.addEventListener("keydown", trapHandler);
    overlay?.addEventListener("click", closeModal, { once:true });
    btnCloses.forEach(b => b.addEventListener("click", closeModal, { once:true }));

    // foco
    setTimeout(()=>{ inpNombre?.focus(); }, 0);

    // evento público (por si escuchas fuera)
    try { document.dispatchEvent(new CustomEvent("ix:report:open", { detail: { depKey: currentDepId, itemId: currentItemId, title, sla } })); } catch {}
  }

  function closeModal() {
    document.removeEventListener("keydown", trapHandler || (()=>{}));
    trapHandler = null;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (openerBtn && typeof openerBtn.focus === "function") openerBtn.focus();
    openerBtn = null;
    try { document.dispatchEvent(new CustomEvent("ix:report:close")); } catch {}
  }

  // ---------- validación (solo muestra errores al dar submit)
  function validateForm(showErrors = true) {
    let ok = true;

    // nombre
    const nombre = (inpNombre?.value || "").trim();
    if (!(nombre.length >= 5 || nombre.split(/\s+/).length >= 2)) {
      ok = false; if (showErrors) setFieldError(inpNombre, "Ingresa tu nombre completo.");
    } else setFieldError(inpNombre);

    // domicilio
    if (!((inpDom?.value || "").trim())) {
      ok = false; if (showErrors) setFieldError(inpDom, "El domicilio es obligatorio.");
    } else setFieldError(inpDom);

    // CP
    const cpVal = inpCP?.value || "";
    const cpBad = !cpVal || !CP_MAP || !CP_MAP[cpVal];
    if (cpBad) { ok = false; if (showErrors) setFieldError(inpCP, "Selecciona un C.P. válido."); }
    else setFieldError(inpCP);

    // colonia (debe pertenecer al CP)
    const colVal = inpCol?.value || "";
    const colBad = !colVal || !(CP_MAP?.[cpVal] || []).includes(colVal);
    if (colBad) { ok = false; if (showErrors) setFieldError(inpCol, "Selecciona una colonia válida."); }
    else setFieldError(inpCol);

    // teléfono
    const tel = digits(inpTel?.value);
    if (tel.length !== 10) { ok = false; if (showErrors) setFieldError(inpTel, "Teléfono a 10 dígitos."); }
    else setFieldError(inpTel);

    // correo (opcional)
    const mail = (inpCorreo?.value || "").trim();
    if (mail && !isEmail(mail)) { ok = false; if (showErrors) setFieldError(inpCorreo, "Correo no válido."); }
    else setFieldError(inpCorreo);

    // descripción
    const desc = (inpDesc?.value || "").trim();
    if (desc.length < 30) { ok = false; if (showErrors) setFieldError(inpDesc, "Describe con al menos 30 caracteres."); }
    else setFieldError(inpDesc);

    // consentimiento
    if (!chkCons?.checked) { ok = false; if (showErrors) setFieldError(chkCons, "Debes aceptar el consentimiento."); }
    else setFieldError(chkCons);

    // imágenes
    if (files.length > CFG.MAX_FILES) ok = false;

    return ok;
  }

  // inputs: solo limpian error si ya intentaste enviar
  [inpNombre, inpDom, inpTel, inpCorreo, inpDesc, chkCons].forEach((el) => {
    el?.addEventListener("input", () => {
      if (!hasAttemptedSubmit) return;
      if (el === inpTel) el.value = digits(el.value).slice(0, 10);
      if (el === inpDesc) updateDescCount();
      validateForm(true);
    });
  });

  // change CP/colonia
  modal.addEventListener("change", (e) => {
    const t = e.target;
    if (t && t.id === "ix-cp") {
      const v = t.value || "";
      if (!CP_MAP || !CP_MAP[v]) resetColonia();
      else populateColoniasForCP(v);
      if (hasAttemptedSubmit) validateForm(true);
    }
    if (t && t.id === "ix-colonia") {
      if (hasAttemptedSubmit) validateForm(true);
    }
  });

  // ---------- submit (POST real al endpoint)
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFeedback();
    hasAttemptedSubmit = true;

    // muestra errores si hay, y no manda nada
    if (!validateForm(true)) {
      showFeedback("Revisa los campos marcados y vuelve a intentar.");
      const bad = modal.querySelector(
        ".ix-field.ix-field--error select, .ix-field.ix-field--error input, .ix-field.ix-field--error textarea, .ix-field.ix-field--error [type='checkbox']"
      );
      bad?.focus();
      return;
    }

    // armo payload para el insert
    const depId = Number(currentDepId || form?.elements?.departamento_id?.value || 0) || 0;
    const tramiteId = Number(currentItemId || inpTramiteId?.value || 0) || 0;

    // Asunto: si es “Otros” y existe el input, úsalo; si no, usa el título del trámite
    const isOtros = (subTitle?.textContent || inpReq?.value || "").toLowerCase().includes("otro");
    const asunto =
      (isOtros && inpAsunto && inpAsunto.value.trim()) ?
         inpAsunto.value.trim() :
         (inpReq?.value || subTitle?.textContent || "Reporte");

    const payload = {
      departamento_id : depId,
      tramite_id      : tramiteId,
      asignado_a      : CFG.ASSIGN_TO,
      asunto          : asunto,
      descripcion     : (inpDesc?.value || "").trim(),
      prioridad       : CFG.PRIORIDAD,
      estatus         : CFG.ESTATUS,
      canal           : CFG.CANAL,
      contacto_nombre : (inpNombre?.value || "").trim(),
      contacto_email  : (inpCorreo?.value || "").trim(),
      contacto_telefono: digits(inpTel?.value),
      contacto_calle  : (inpDom?.value || "").trim(),
      contacto_colonia: (inpCol?.value || "").trim(),
      contacto_cp     : (inpCP?.value || "").trim(),
      // fecha_limite :  "",   // si después quieres calcularla, la pones aquí
      status          : 1,
      created_by      : CFG.CREATED_BY
    };

    // bloqueo botón SOLO mientras envío
    const prevText = btnSend?.textContent;
    btnSend && (btnSend.disabled = true, btnSend.textContent = "Enviando…");
    Array.from(form.elements).forEach(el => { if (el !== btnSend) el.disabled = true; });

    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), CFG.TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINTS.insertReq, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (!json?.ok || !json?.data) {
        throw new Error(json?.error || "No se pudo registrar el requerimiento.");
      }

      const folio = json.data.folio || ("ID" + String(Date.now()%100000).padStart(5,"0"));
      try { sessionStorage.setItem("ix_last_folio", folio); } catch {}

      // evento público + toast
      try { document.dispatchEvent(new CustomEvent("ix:report:success", { detail: { folio, data: json.data } })); } catch {}
      if (window.gcToast) gcToast(`Reporte creado: ${folio}`, "exito", 3200); else alert(`Reporte creado: ${folio}`);

      // reset y cerrar
      Array.from(form.elements).forEach(el => (el.disabled = false));
      if (btnSend) { btnSend.disabled = false; btnSend.textContent = prevText || "Mandar reporte"; }
      form.reset();
      files = []; refreshPreviews(); updateDescCount();
      closeModal();

    } catch (err) {
      clearTimeout(t);
      console.warn("[IX] insert falló:", err?.message || err);
      showFeedback("No se pudo enviar el reporte. Intenta de nuevo en unos minutos.");
      Array.from(form.elements).forEach(el => (el.disabled = false));
      if (btnSend) { btnSend.disabled = false; btnSend.textContent = prevText || "Mandar reporte"; }
    }
  });

  // ---------- API pública + setup
  window.ixReportModal = {
    open : (opts = {}, opener) => openModal(opts, opener),
    close: () => closeModal(),
  };

  // deja listo el CTA de subir imágenes
  ensureUploadCTA();

})();

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












//--------------------------------------------------- modal de reporte 
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

  const subTitle  = modal.querySelector("#ix-report-subtitle");
  const inpReq    = modal.querySelector("#ix-report-req");        
  const inpFecha  = modal.querySelector("#ix-fecha");             
  const timeMeta  = modal.querySelector("#ix-report-date");       

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

  // bloque solo para “Otros”
  const asuntoGroup = modal.querySelector("#ix-asunto-group");
  const inpAsunto   = modal.querySelector("#ix-asunto");

  // uploader
  const upWrap   = modal.querySelector(".ix-upload");
  const upInput  = modal.querySelector("#ix-evidencia");
  const previews = modal.querySelector("#ix-evidencia-previews");

  // hidden opcionales (si los agregaste)
  const inpDepId     = modal.querySelector("input[name='departamento_id']");
  const inpTramiteId = modal.querySelector("input[name='tramite_id']");

  // ---------- endpoints
  const ENDPOINTS = {
    cpcolonia: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_cpcolonia.php",
    insertReq: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_i_requerimiento.php",
  };

  // ---------- config general
  const CFG = {
    MAX_FILES: 3,                           // máximo de imágenes permitidas
    MAX_MB: 5,                              // por archivo
    TYPES: ["image/jpeg", "image/png"],     // tipos permitidos
    FETCH_TIMEOUT: 12000,
  };

  // ---------- estado interno
  let files = [];
  let openerBtn = null;
  let trapHandler = null;
  let hasAttemptedSubmit = false;

  // contexto que llega desde el módulo de trámites al abrir el modal
  let currentDepId  = "1";   // string numérica
  let currentItemId = "";    // id del trámite
  let currentTitle  = "Reporte"; // titulo visible del trámite

  // ---------- utilidades
  const digits  = (s) => (s || "").replace(/\D+/g, "");
  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());

  const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const pad2 = (n) => String(n).padStart(2, "0");
  const fmtAMPM = (d) => {
    const h = d.getHours(), m = d.getMinutes();
    const ampm = h >= 12 ? "pm" : "am";
    const hh = ((h + 11) % 12) + 1;
    return `${hh}:${pad2(m)} ${ampm}`;
  };
  function setToday() {
    const d = new Date();
    const text = `${pad2(d.getDate())} de ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()} · ${fmtAMPM(d)}`;
    if (inpFecha)  inpFecha.value = text;
    if (timeMeta) { timeMeta.dateTime = d.toISOString(); timeMeta.textContent = text; }
  }

  const clearFeedback = () => { if (!feedback) return; feedback.hidden = true; feedback.textContent = ""; };
  const showFeedback  = (msg) => { if (!feedback) return; feedback.hidden = false; feedback.textContent = msg; };

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

  const updateDescCount = () => {
    if (!cntDesc || !inpDesc) return;
    const len = (inpDesc.value || "").length;
    cntDesc.textContent = String(len);
  };

  // ---------- CP/Colonia: cache + fetch
  function withTimeout(promiseFactory, ms = CFG.FETCH_TIMEOUT) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), ms);
    return promiseFactory(ctrl.signal)
      .then((r) => { clearTimeout(to); return r; })
      .catch((e) => { clearTimeout(to); throw e; });
  }

  const CP_CACHE_KEY = "ix_cpcolonia_cache_v1";
  function getCpCache() {
    try {
      const raw = sessionStorage.getItem(CP_CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }
  function setCpCache(data) {
    try { sessionStorage.setItem(CP_CACHE_KEY, JSON.stringify(data)); } catch {}
  }

  let CP_MAP = {};  // { "44580": ["Centro",...], ... }
  let CP_LIST = []; // ["44580", ...]
  const knownCP = (cp) => Object.prototype.hasOwnProperty.call(CP_MAP, cp);

  async function fetchCpColonia() {
    const hit = getCpCache();
    if (hit && hit.map && hit.list) {
      CP_MAP = hit.map;
      CP_LIST = hit.list;
      return;
    }
    const json = await withTimeout((signal) =>
      fetch(ENDPOINTS.cpcolonia, {
        method: "POST",
        headers: { "Content-Type":"application/json", "Accept":"application/json" },
        body: JSON.stringify({ all: true }),
        signal
      }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    );

    const rows = Array.isArray(json?.data) ? json.data : [];
    const map = {};
    for (const r of rows) {
      const cp  = String(r?.cp || "").trim();
      const col = String(r?.colonia || "").trim();
      if (!cp || !col) continue;
      if (!map[cp]) map[cp] = [];
      if (!map[cp].includes(col)) map[cp].push(col);
    }
    Object.keys(map).forEach(cp => map[cp].sort((a,b)=>a.localeCompare(b,"es")));
    const list = Object.keys(map).sort();

    CP_MAP  = map;
    CP_LIST = list;
    setCpCache({ map, list });
  }

  // ---------- helpers de SELECT
  const makeOpt = (val, label, { disabled = false, selected = false } = {}) => {
    const o = document.createElement("option");
    o.value = val; o.textContent = label;
    if (disabled) o.disabled = true;
    if (selected) o.selected = true;
    return o;
  };

  const ensureSelect = (el, { nameFallback, idFallback } = {}) => {
    if (el && el.tagName === "SELECT") return el;
    let sel = document.createElement("select");
    sel.id = el?.id || idFallback || "";
    sel.name = el?.name || nameFallback || "";
    sel.className = el?.className || "";
    sel.required = true;
    if (el) el.replaceWith(sel);
    return sel;
  };

  const ensureCpSelect  = () => (inpCP  = ensureSelect(inpCP,  { nameFallback:"cp",      idFallback:"ix-cp" }));
  const ensureColSelect = () => (inpCol = ensureSelect(inpCol, { nameFallback:"colonia", idFallback:"ix-colonia" }));

  const populateCpOptions = () => {
    ensureCpSelect();
    inpCP.innerHTML = "";
    inpCP.appendChild(makeOpt("", "Selecciona C.P.", { disabled:true, selected:true }));
    CP_LIST.forEach(cp => inpCP.appendChild(makeOpt(cp, cp)));
  };

  const resetColonia = (msg = "Selecciona C.P. primero") => {
    ensureColSelect();
    inpCol.innerHTML = "";
    inpCol.appendChild(makeOpt("", msg, { disabled:true, selected:true }));
    inpCol.disabled = true;
  };

  const populateColoniasForCP = (cp) => {
    ensureColSelect();
    inpCol.innerHTML = "";
    inpCol.appendChild(makeOpt("", "Selecciona colonia", { disabled:true, selected:true }));
    (CP_MAP[cp] || []).forEach(col => inpCol.appendChild(makeOpt(col, col)));
    inpCol.disabled = false;
  };

  // ---------- uploader (con botón “Subir imágenes”)
  function ensureUploadButton() {
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
  }

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
      if (!CFG.TYPES.includes(f.type)) { showFeedback("Solo JPG o PNG."); continue; }
      if (f.size > CFG.MAX_MB * 1024 * 1024) { showFeedback(`Cada archivo ≤ ${CFG.MAX_MB} MB.`); continue; }
      if (files.length >= CFG.MAX_FILES) { showFeedback(`Máximo ${CFG.MAX_FILES} imágenes.`); break; }
      files.push(f);
    }
    refreshPreviews();
  }

  // click/drag
  upWrap?.addEventListener("click", (e) => {
    if (e.target instanceof HTMLElement && e.target.tagName === "BUTTON") return;
    upInput?.click();
  });
  upInput?.addEventListener("change", (e) => handleFiles(e.target.files));
  ["dragenter", "dragover"].forEach(ev =>
    upWrap?.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); upWrap.classList.add("is-drag"); })
  );
  ["dragleave", "drop"].forEach(ev =>
    upWrap?.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); upWrap.classList.remove("is-drag"); })
  );
  upWrap?.addEventListener("drop", (e) => handleFiles(e.dataTransfer?.files || []));

  // ---------- focus trap + open/close
  const getFocusable = () =>
    Array.from(dialog.querySelectorAll(
      'a[href],button:not([disabled]),textarea,input:not([disabled]),select,[tabindex]:not([tabindex="-1"])'
    )).filter(el => el.offsetParent !== null);

  function trap(e) {
    if (e.key !== "Tab") return;
    const list = getFocusable(); if (!list.length) return;
    const first = list[0], last = list[list.length - 1];
    if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
    else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
  }

  function openModal(
    { title = "Reporte", depKey = "1", itemId = "", sla = "" } = {},
    opener = null
  ) {
    openerBtn = opener || document.activeElement;
    currentDepId  = String(depKey || "1");
    currentItemId = String(itemId || "");
    currentTitle  = String(title || "Reporte");

    // Título/contexto
    if (subTitle) subTitle.textContent = currentTitle;
    if (inpReq)   inpReq.value = currentTitle;
    if (inpTramiteId) inpTramiteId.value = currentItemId;
    if (inpDepId)     inpDepId.value = currentDepId;

    // Solo “Otros” muestra el campo de “Clasificación (Título)”
    const isOtros = /\botr(os|o)\b/i.test(currentTitle);
    if (asuntoGroup) {
      asuntoGroup.hidden = !isOtros;
      if (!isOtros && inpAsunto) { inpAsunto.value = ""; setFieldError(inpAsunto, ""); }
    }

    // Fecha actual
    setToday();

    // Reset UI (y aseguro que el botón NO quede deshabilitado)
    clearFeedback();
    hasAttemptedSubmit = false;
    form?.reset();
    files = [];
    refreshPreviews();
    updateDescCount();
    if (btnSend) btnSend.disabled = false;

    // CP/Colonia
    ensureCpSelect(); ensureColSelect(); resetColonia();
    fetchCpColonia().then(() => { populateCpOptions(); resetColonia(); }).catch(()=>{});

    // Mostrar modal
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    // trap + esc + overlay
    trapHandler = (e) => { if (e.key === "Escape") closeModal(); else trap(e); };
    document.addEventListener("keydown", trapHandler);
    overlay?.addEventListener("click", closeModal, { once:true });
    btnCloses.forEach(b => b.addEventListener("click", closeModal, { once:true }));

    // foco
    setTimeout(() => { inpNombre?.focus(); }, 0);

    // evento público
    try {
      document.dispatchEvent(new CustomEvent("ix:report:open", {
        detail: { depKey: currentDepId, itemId: currentItemId, title: currentTitle, sla }
      }));
    } catch {}
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

  // ---------- validaciones (se muestran tras el primer submit)
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

    // cp
    const cpVal = inpCP?.value || "";
    const cpBad = !cpVal || !knownCP(cpVal);
    if (cpBad) { ok = false; if (showErrors) setFieldError(inpCP, "Selecciona un C.P. válido."); }
    else setFieldError(inpCP);

    // colonia
    const colVal = inpCol?.value || "";
    const validCols = CP_MAP[cpVal] || [];
    const colBad = !colVal || !validCols.includes(colVal);
    if (colBad) { ok = false; if (showErrors) setFieldError(inpCol, "Selecciona una colonia válida."); }
    else setFieldError(inpCol);

    // teléfono
    const tel = digits(inpTel?.value || "");
    if (tel.length !== 10) { ok = false; if (showErrors) setFieldError(inpTel, "Teléfono a 10 dígitos."); }
    else setFieldError(inpTel);

    // correo (OPCIONAL, pero si viene, validar formato)
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

    // imágenes (límite duro)
    if (files.length > CFG.MAX_FILES) ok = false;

    return ok;
  }

  // tras primer submit, limpiar errores en tiempo real
  [inpNombre, inpDom, inpTel, inpCorreo, inpDesc, chkCons].forEach((el) => {
    el?.addEventListener("input", () => {
      if (!hasAttemptedSubmit) return;
      if (el === inpTel) el.value = digits(el.value).slice(0, 10);
      if (el === inpDesc) updateDescCount();
      if (el === inpCorreo) {
        // valida correo mientras escribe, pero solo muestra si ya hubo intento de submit
        if (el.value && !isEmail(el.value)) setFieldError(inpCorreo, "Correo no válido.");
        else setFieldError(inpCorreo, "");
      }
      validateForm(true);
    });
  });

  // cambios CP/Colonia
  modal.addEventListener("change", (e) => {
    const t = e.target;
    if (t && t.id === "ix-cp") {
      const v = t.value || "";
      if (!v || !knownCP(v)) resetColonia();
      else populateColoniasForCP(v);
      if (hasAttemptedSubmit) validateForm(true);
    }
    if (t && t.id === "ix-colonia") {
      if (hasAttemptedSubmit) validateForm(true);
    }
  });

  // ---------- submit → inserción
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFeedback();
    hasAttemptedSubmit = true;

    if (!validateForm(true)) {
      showFeedback("Revisa los campos marcados y vuelve a intentar.");
      const bad = modal.querySelector(
        ".ix-field.ix-field--error select, .ix-field.ix-field--error input, .ix-field.ix-field--error textarea, .ix-field.ix-field--error [type='checkbox']"
      );
      bad?.focus();
      return; // no mandamos al backend si está inválido
    }

    // armo payload para el endpoint
    const depId   = Number(currentDepId || inpDepId?.value || 1);
    const tramId  = Number(currentItemId || inpTramiteId?.value || 0);
    const isOtros = /\botr(os|o)\b/i.test(currentTitle);

    const nombre = (inpNombre?.value || "").trim();
    const calle  = (inpDom?.value    || "").trim();
    const cp     = (inpCP?.value     || "").trim();
    const col    = (inpCol?.value    || "").trim();
    const tel    = digits(inpTel?.value || "");
    const correo = (inpCorreo?.value || "").trim();
    const desc   = (inpDesc?.value   || "").trim();

    // asunto: si es “Otros”, usar inpAsunto; si no, “Reporte {currentTitle}”
    let asunto = `Reporte ${currentTitle}`;
    if (isOtros && inpAsunto && inpAsunto.value.trim()) {
      asunto = inpAsunto.value.trim();
    }

    const body = {
      departamento_id: depId,
      tramite_id: tramId || null,      // si “Otros” no tiene id en back, puedes omitirlo
      asignado_a: 1,                    // ajusta si aplica
      asunto,
      descripcion: desc,
      prioridad: 2,
      estatus: 0,
      canal: 1,
      contacto_nombre: nombre,
      contacto_email: correo || null,
      contacto_telefono: tel,
      contacto_calle: calle,
      contacto_colonia: col,
      contacto_cp: cp,
      fecha_limite: null,               // si no manejas fecha límite todavía
      status: 1,
      created_by: 1
    };

    // estado enviando
    btnSend.disabled = true;
    const oldTxt = btnSend.textContent;
    btnSend.textContent = "Enviando…";
    Array.from(form.elements).forEach((el) => (el.disabled = el === btnSend ? false : true));

    try {
      const json = await withTimeout((signal) =>
        fetch(ENDPOINTS.insertReq, {
          method: "POST",
          headers: { "Content-Type":"application/json", "Accept":"application/json" },
          body: JSON.stringify(body),
          signal
        }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      );

      if (!json?.ok || !json?.data) throw new Error("Respuesta inesperada del servidor.");

      const folio = json.data.folio || `ID${String(Date.now()%1000000).padStart(5,"0")}`;
      try { sessionStorage.setItem("ix_last_folio", folio); } catch {}

      try { document.dispatchEvent(new CustomEvent("ix:report:submit",  { detail: { ...body, folio } })); } catch {}
      try { document.dispatchEvent(new CustomEvent("ix:report:success", { detail: { folio } })); } catch {}

      if (window.gcToast) gcToast(`Reporte creado: ${folio}`, "exito", 3200);
      else alert(`Reporte creado: ${folio}`);

      // reset
      Array.from(form.elements).forEach((el) => (el.disabled = false));
      btnSend.textContent = oldTxt;
      form.reset();
      files = [];
      refreshPreviews();
      updateDescCount();
      closeModal();
    } catch (err) {
      showFeedback(`No se pudo enviar el reporte. ${err?.message || err}`);
      if (window.gcToast) gcToast("No se pudo enviar el reporte.", "error", 3200);
      // re-habilitar
      Array.from(form.elements).forEach((el) => (el.disabled = false));
      btnSend.textContent = oldTxt;
      btnSend.disabled = false;
    }
  });

  // ---------- API pública + setup
  window.ixReportModal = {
    open: (opts = {}, opener) => openModal(opts, opener),
    close: () => closeModal(),
  };

  ensureUploadButton();
})();

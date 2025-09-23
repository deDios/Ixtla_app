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












//------------------------------- modal de reporte 
(() => {
  const modal = document.getElementById("ix-report-modal");
  if (!modal) { console.warn("[IX] No existe #ix-report-modal."); return; }

  const overlay = modal.querySelector(".ix-modal__overlay");
  const dialog = modal.querySelector(".ix-modal__dialog");
  const btnCloses = modal.querySelectorAll("[data-ix-close]");
  const form = modal.querySelector("#ix-report-form");
  const feedback = modal.querySelector("#ix-report-feedback");

  const subTitle = modal.querySelector("#ix-report-subtitle");
  const inpReq = modal.querySelector("#ix-report-req");
  const inpFecha = modal.querySelector("#ix-fecha");
  const timeMeta = modal.querySelector("#ix-report-date");

  // campos
  const inpNombre = modal.querySelector("#ix-nombre");
  const inpDom = modal.querySelector("#ix-domicilio");
  let inpCP = modal.querySelector("#ix-cp");
  let inpCol = modal.querySelector("#ix-colonia");
  const inpTel = modal.querySelector("#ix-telefono");
  const inpCorreo = modal.querySelector("#ix-correo");
  const inpDesc = modal.querySelector("#ix-descripcion");
  const cntDesc = modal.querySelector("#ix-desc-count");
  const chkCons = modal.querySelector("#ix-consent");
  const btnSend = modal.querySelector("#ix-submit");

  // bloque solo para Otros
  const asuntoGroup = modal.querySelector("#ix-asunto-group");
  const inpAsunto = modal.querySelector("#ix-asunto");

  // uploader
  const upWrap = modal.querySelector(".ix-upload");
  const upInput = modal.querySelector("#ix-evidencia");
  const previews = modal.querySelector("#ix-evidencia-previews");

  // hidden opcionales
  const inpDepId = modal.querySelector("input[name='departamento_id']");
  const inpTramiteId = modal.querySelector("input[name='tramite_id']");

  // ---------- endpoints
  const ENDPOINTS = {
    cpcolonia: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_cpcolonia.php",
    insertReq: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_i_requerimiento.php",
    fsBootstrap: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_u_requerimiento_fs_bootstrap.php",
    uploadImg: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_i_requerimiento_img.php",
  };

  // ---------- config
  const CFG = {
    MAX_FILES: 3,
    MIN_FILES: 0, // mínimo requerido
    MAX_MB: 30,
    TYPES: ["image/jpeg", "image/png"],
    FETCH_TIMEOUT: 12000,
    DEBUG: false,  // dejar en true para ver los console logs
  };

  // ---------- estado
  let files = [];
  let openerBtn = null;
  let trapHandler = null;
  let hasAttemptedSubmit = false;

  let currentDepId = "1";
  let currentItemId = "";
  let currentTitle = "Reporte";

  // ---------- utils
  const digits = (s) => (s || "").replace(/\D+/g, "");
  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());

  const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
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
    if (inpFecha) inpFecha.value = text;     // set DESPUÉS de form.reset()
    if (timeMeta) { timeMeta.dateTime = d.toISOString(); timeMeta.textContent = text; }
  }

  const clearFeedback = () => { if (!feedback) return; feedback.hidden = true; feedback.textContent = ""; };
  const showFeedback = (msg) => { if (!feedback) return; feedback.hidden = false; feedback.textContent = msg; };

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

  const updateDescCount = () => {
    if (!cntDesc || !inpDesc) return;
    cntDesc.textContent = String((inpDesc.value || "").length);
  };

  // ---------- CP/Colonia fetch
  function withTimeout(promiseFactory, ms = CFG.FETCH_TIMEOUT) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), ms);
    return promiseFactory(ctrl.signal)
      .then((r) => { clearTimeout(to); return r; })
      .catch((e) => { clearTimeout(to); throw e; });
  }

  const CP_CACHE_KEY = "ix_cpcolonia_cache_v1";
  const LAST_CP_KEY = "ix_last_cp";
  function getCpCache() { try { return JSON.parse(sessionStorage.getItem(CP_CACHE_KEY) || "null"); } catch { return null; } }
  function setCpCache(data) { try { sessionStorage.setItem(CP_CACHE_KEY, JSON.stringify(data)); } catch { } }
  function getLastCP() { try { return sessionStorage.getItem(LAST_CP_KEY) || ""; } catch { return ""; } }
  function setLastCP(cp) { try { sessionStorage.setItem(LAST_CP_KEY, String(cp || "")); } catch { } }

  let CP_MAP = {};
  let CP_LIST = [];
  const knownCP = (cp) => Object.prototype.hasOwnProperty.call(CP_MAP, String(cp || ""));

  function extractCpColoniaArray(json) {
    if (CFG.DEBUG) console.log("[IX] cpcolonia raw:", json);
    const arr = Array.isArray(json?.data) ? json.data
      : Array.isArray(json) ? json
        : [];
    if (!arr.length) {
      console.warn("[IX] cpcolonia: respuesta sin arreglo de datos.");
      return [];
    }
    const out = [];
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const cp = String(item.cp ?? item.CP ?? item.codigo_postal ?? item.codigoPostal ?? item.postal_code ?? item.postalCode ?? "").trim();
      const col = String(item.colonia ?? item.Colonia ?? item.asentamiento ?? item.barrio ?? item.neighborhood ?? "").trim();
      if (!cp || !col) continue;
      out.push({ cp, colonia: col });
    }
    if (CFG.DEBUG) console.log("[IX] cpcolonia normalizado (primeros 5):", out.slice(0, 5));
    return out;
  }

  async function fetchCpColonia() {
    const hit = getCpCache();
    if (hit?.map && hit?.list) { CP_MAP = hit.map; CP_LIST = hit.list; return; }

    const json = await withTimeout((signal) =>
      fetch(ENDPOINTS.cpcolonia, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ all: true }),
        signal
      }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    );

    const rows = extractCpColoniaArray(json);

    const map = {};
    for (const r of rows) {
      const cp = String(r.cp || "").trim();
      const col = String(r.colonia || "").trim();
      if (!cp || !col) continue;

      if (!map[cp]) map[cp] = { order: [], seen: new Set() };
      const key = col.toLocaleLowerCase("es");
      if (!map[cp].seen.has(key)) {
        map[cp].seen.add(key);
        map[cp].order.push(col);
      }
    }

    const finalMap = {};
    Object.keys(map).forEach(cp => {
      const sorted = map[cp].order.sort((a, b) => a.localeCompare(b, "es"));
      finalMap[cp] = sorted;
    });

    const list = Object.keys(finalMap).sort();
    CP_MAP = finalMap;
    CP_LIST = list;
    setCpCache({ map: finalMap, list });

    if (CFG.DEBUG) console.log("[IX] cpcolonia resumen:", { cps: CP_LIST.length, ejemploCP: CP_LIST[0], coloniasEjemplo: CP_MAP[CP_LIST[0]]?.slice(0, 5) });
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
    const sel = document.createElement("select");
    sel.id = el?.id || idFallback || "";
    sel.name = el?.name || nameFallback || "";
    sel.className = el?.className || "";
    sel.required = true;
    if (el) el.replaceWith(sel);
    return sel;
  };

  const ensureCpSelect = () => (inpCP = ensureSelect(inpCP, { nameFallback: "cp", idFallback: "ix-cp" }));
  const ensureColSelect = () => (inpCol = ensureSelect(inpCol, { nameFallback: "colonia", idFallback: "ix-colonia" }));

  const populateCpOptions = () => {
    ensureCpSelect();
    inpCP.innerHTML = "";
    inpCP.appendChild(makeOpt("", "Selecciona C.P.", { disabled: true, selected: true }));
    CP_LIST.forEach(cp => inpCP.appendChild(makeOpt(cp, cp)));
  };

  const resetColonia = (msg = "Selecciona C.P. primero") => {
    ensureColSelect();
    inpCol.innerHTML = "";
    inpCol.appendChild(makeOpt("", msg, { disabled: true, selected: true }));
    inpCol.disabled = true;
  };

  const populateColoniasForCP = (cp) => {
    ensureColSelect();
    inpCol.innerHTML = "";
    inpCol.appendChild(makeOpt("", "Selecciona colonia", { disabled: true, selected: true }));
    (CP_MAP[cp] || []).forEach(col => inpCol.appendChild(makeOpt(col, col)));
    inpCol.disabled = false;
  };

  // ---------- uploader
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
    // marca error visual si ya intentó enviar y no cumple mínimo
    if (hasAttemptedSubmit) {
      if (files.length < (CFG.MIN_FILES || 0)) {
        upWrap?.classList.add("ix-upload--error");
      } else {
        upWrap?.classList.remove("ix-upload--error");
      }
    }
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

  function toggleAsuntoForOtros(isOtros) {
    if (!asuntoGroup) return;
    asuntoGroup.hidden = !isOtros;
    asuntoGroup.style.display = isOtros ? "" : "none";  // blindaje ante CSS externos
    if (!isOtros && inpAsunto) { inpAsunto.value = ""; setFieldError(inpAsunto, ""); }
  }

  function openModal(
    { title = "Reporte", depKey = "1", itemId = "", sla = "" } = {},
    opener = null
  ) {
    openerBtn = opener || document.activeElement;
    currentDepId = String(depKey || "1");
    currentItemId = String(itemId || "");
    currentTitle = String(title || "Reporte");

    // Título / contexto
    if (subTitle) subTitle.textContent = currentTitle;
    if (inpReq) inpReq.value = currentTitle;
    if (inpTramiteId) inpTramiteId.value = currentItemId;
    if (inpDepId) inpDepId.value = currentDepId;

    // Reset UI
    clearFeedback();
    hasAttemptedSubmit = false;
    form?.reset();
    files = [];
    refreshPreviews();
    updateDescCount();                  // contador arranca en 0
    if (btnSend) btnSend.disabled = false;

    // Fecha actual (IMPORTANTE: después de reset)
    setToday();

    // Campo “Clasificación (Título)” SOLO para “Otros”
    const isOtros = /\botr(os|o)\b/i.test(currentTitle);
    toggleAsuntoForOtros(isOtros);

    // CP/Colonia
    ensureCpSelect(); ensureColSelect(); resetColonia();
    fetchCpColonia()
      .then(() => {
        populateCpOptions();
        const last = getLastCP();
        if (last && knownCP(last)) {
          inpCP.value = last;
          populateColoniasForCP(last);
        } else {
          resetColonia();
        }
      })
      .catch((err) => { console.warn("[IX] cpcolonia error:", err); });

    // Mostrar modal
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    trapHandler = (e) => { if (e.key === "Escape") closeModal(); else trap(e); };
    document.addEventListener("keydown", trapHandler);
    overlay?.addEventListener("click", closeModal, { once: true });
    btnCloses.forEach(b => b.addEventListener("click", closeModal, { once: true }));

    // foco inicial
    setTimeout(() => { inpNombre?.focus(); }, 0);

    try {
      document.dispatchEvent(new CustomEvent("ix:report:open", {
        detail: { depKey: currentDepId, itemId: currentItemId, title: currentTitle, sla }
      }));
    } catch { }
  }

  function closeModal() {
    document.removeEventListener("keydown", trapHandler || (() => { }));
    trapHandler = null;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (openerBtn && typeof openerBtn.focus === "function") openerBtn.focus();
    openerBtn = null;
    try { document.dispatchEvent(new CustomEvent("ix:report:close")); } catch { }
  }

  // ---------- validaciones
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

    // correo (opcional; si viene, validar)
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

    // imágenes (mínimo y máximo)
    if (files.length > CFG.MAX_FILES) {
      ok = false;
      if (showErrors) showFeedback(`Máximo ${CFG.MAX_FILES} imágenes.`);
    }
    if (files.length < (CFG.MIN_FILES || 0)) {
      ok = false;
      if (showErrors) {
        showFeedback(`Adjunta al menos ${CFG.MIN_FILES} imagen${CFG.MIN_FILES > 1 ? "es" : ""} (JPG o PNG).`);
        upWrap?.classList.add("ix-upload--error");
      }
    } else {
      upWrap?.classList.remove("ix-upload--error");
    }

    return ok;
  }

  // SIEMPRE actualiza contador; validadores solo tras submit
  inpDesc?.addEventListener("input", () => {
    updateDescCount();
    if (hasAttemptedSubmit) validateForm(true);
  });

  [inpNombre, inpDom, inpTel, inpCorreo, chkCons, inpAsunto].forEach((el) => {
    el?.addEventListener("input", () => {
      if (!hasAttemptedSubmit) return;
      if (el === inpTel) el.value = digits(el.value).slice(0, 10);
      if (el === inpCorreo) {
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
      if (!v || !knownCP(v)) {
        resetColonia();
      } else {
        populateColoniasForCP(v);
        setLastCP(v);
      }
      if (hasAttemptedSubmit) validateForm(true);
    }
    if (t && t.id === "ix-colonia") {
      if (hasAttemptedSubmit) validateForm(true);
    }
  });

  // ---------- helpers: FS bootstrap + upload images
  async function bootstrapFS(folio) {
    try {
      const json = await withTimeout((signal) =>
        fetch(ENDPOINTS.fsBootstrap, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ folio }),
          signal
        }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      );
      if (CFG.DEBUG) console.log("[IX] fsBootstrap:", json);
      if (!json?.ok) throw new Error(json?.error || "fsBootstrap no OK");
      return json;
    } catch (e) {
      console.warn("[IX] fsBootstrap fallo:", e?.message || e);
      return null; // no bloquea el flujo
    }
  }

  async function uploadEvidence(folio, status, fileList) {
    if (!fileList?.length) return { ok: true, saved: [], failed: [] };
    const fd = new FormData();
    fd.append("folio", folio);
    fd.append("status", String(status));

    // <-- AQUI el cambio importante: usar "files[]"
    fileList.forEach(f => fd.append("files[]", f, f.name));

    if (CFG.DEBUG) {
      console.log("[IX] preparando upload:", { count: fileList.length, names: fileList.map(f => f.name) });
    }

    try {
      const json = await withTimeout((signal) =>
        fetch(ENDPOINTS.uploadImg, { method: "POST", body: fd, signal })
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      );
      if (CFG.DEBUG) console.log("[IX] uploadImg:", json);
      return json;
    } catch (e) {
      console.error("[IX] uploadImg fallo:", e?.message || e);
      return { ok: false, saved: [], failed: [{ error: e?.message || String(e) }] };
    }
  }

  // ---------- submit → inserción
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFeedback();
    hasAttemptedSubmit = true;

    if (!validateForm(true)) {
      const bad = modal.querySelector(
        ".ix-field.ix-field--error select, .ix-field.ix-field--error input, .ix-field.ix-field--error textarea, .ix-upload--error"
      );
      bad?.focus?.();
      return;
    }

    // seguridad extra
    if (files.length < (CFG.MIN_FILES || 0)) {
      showFeedback(`Adjunta al menos ${CFG.MIN_FILES} imagen${CFG.MIN_FILES > 1 ? "es" : ""}.`);
      upWrap?.classList.add("ix-upload--error");
      return;
    }

    // payload
    const depId = Number(currentDepId || inpDepId?.value || 1);
    const tramId = Number(currentItemId || inpTramiteId?.value || 0);
    const isOtros = /\botr(os|o)\b/i.test(currentTitle);

    const nombre = (inpNombre?.value || "").trim();
    const calle = (inpDom?.value || "").trim();
    const cp = (inpCP?.value || "").trim();
    const col = (inpCol?.value || "").trim();
    const tel = digits(inpTel?.value || "");
    const correo = (inpCorreo?.value || "").trim();
    const desc = (inpDesc?.value || "").trim();

    let asunto = `Reporte ${currentTitle}`;
    if (isOtros && inpAsunto && inpAsunto.value.trim()) {
      asunto = inpAsunto.value.trim();
    }

    // estatus inicial → 0 (solicitud)
    const initialStatus = 0;

    const body = {
      departamento_id: depId,
      tramite_id: tramId || null,
      asignado_a: 1,
      asunto,
      descripcion: desc,
      prioridad: 2,
      estatus: initialStatus,
      canal: 1,
      contacto_nombre: nombre,
      contacto_email: correo || null,
      contacto_telefono: tel,
      contacto_calle: calle,
      contacto_colonia: col,
      contacto_cp: cp,
      fecha_limite: null,
      status: 1,
      created_by: 1
    };

    // enviando
    btnSend.disabled = true;
    const oldTxt = btnSend.textContent;
    btnSend.textContent = "Enviando…";
    Array.from(form.elements).forEach((el) => (el.disabled = el === btnSend ? false : true));

    try {
      // 1) Insertar requerimiento
      const json = await withTimeout((signal) =>
        fetch(ENDPOINTS.insertReq, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(body),
          signal
        }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      );

      if (!json?.ok || !json?.data) throw new Error("Respuesta inesperada del servidor.");
      const folio = json.data.folio || `REQ-${String(Date.now() % 1e10).padStart(10, "0")}`;
      try { sessionStorage.setItem("ix_last_folio", folio); } catch { }

      if (CFG.DEBUG) console.log("[IX] insertReq OK, folio:", folio);

      // 2) Bootstrap FS (no bloqueante si falla)
      await bootstrapFS(folio);

      // 3) Subir imágenes (mínimo 1 ya garantizado)
      const upRes = await uploadEvidence(folio, initialStatus, files);
      if (!upRes?.ok) {
        const failedCnt = Array.isArray(upRes?.failed) ? upRes.failed.length : 0;
        showFeedback(`Reporte creado (${folio}), pero algunas imágenes no se subieron (${failedCnt}).`);
        if (window.gcToast) gcToast("Algunas imágenes fallaron al subir.", "alerta", 4200);
      } else if (CFG.DEBUG) {
        console.log("[IX] Evidencias subidas:", upRes.saved?.length || 0);
      }

      try { document.dispatchEvent(new CustomEvent("ix:report:submit", { detail: { ...body, folio } })); } catch { }
      try { document.dispatchEvent(new CustomEvent("ix:report:success", { detail: { folio } })); } catch { }

      if (window.gcToast) gcToast(`Reporte creado: ${folio}`, "exito", 3200);
      else alert(`Reporte creado: ${folio}`);

      // Reset UI
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
      Array.from(form.elements).forEach((el) => (el.disabled = false));
      btnSend.textContent = oldTxt;
      btnSend.disabled = false;
    }
  });

  window.ixReportModal = {
    open: (opts = {}, opener) => openModal(opts, opener),
    close: () => closeModal(),
  };

  ensureUploadButton();
})();

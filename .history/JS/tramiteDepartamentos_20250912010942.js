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












//--------------------------------------------------- Modal 
(() => {
  const modal = document.getElementById("ix-report-modal");
  if (!modal) { console.warn("[IX] No existe #ix-report-modal, me salgo."); return; }

  // ===== refs base del DOM
  const overlay   = modal.querySelector(".ix-modal__overlay");
  const dialog    = modal.querySelector(".ix-modal__dialog");
  const btnCloses = modal.querySelectorAll("[data-ix-close]");
  const form      = modal.querySelector("#ix-report-form");
  const feedback  = modal.querySelector("#ix-report-feedback");

  const inpReq    = modal.querySelector("#ix-report-req");
  const subTitle  = modal.querySelector("#ix-report-subtitle");

  const inpDepId  = modal.querySelector("#ix-departamento-id");
  const inpTraId  = modal.querySelector("#ix-tramite-id");

  const inpNombre = modal.querySelector("#ix-nombre");
  const inpDom    = modal.querySelector("#ix-domicilio");
  const selCP     = modal.querySelector("#ix-cp");
  const selCol    = modal.querySelector("#ix-colonia");
  const inpTel    = modal.querySelector("#ix-telefono");
  const inpCorreo = modal.querySelector("#ix-correo");
  const inpDesc   = modal.querySelector("#ix-descripcion");
  const cntDesc   = modal.querySelector("#ix-desc-count");
  const otrosBox  = modal.querySelector("#ix-otros-block");
  const inpOtros  = modal.querySelector("#ix-otros-detalle");
  const chkCons   = modal.querySelector("#ix-consent");
  const btnSend   = modal.querySelector("#ix-submit");

  const upWrap    = modal.querySelector("#ix-upload-zone");
  const upBtn     = modal.querySelector("#ix-evidencia-cta");
  const upInput   = modal.querySelector("#ix-evidencia");
  const previews  = modal.querySelector("#ix-evidencia-previews");

  // ===== Configs (ajústale a gusto)
  const CFG = {
    // máximo de imágenes permitidas (lo pediste configurable)
    MAX_FILES: 3,
    MAX_MB: 5, // por archivo
    TYPES: ["image/jpeg", "image/png"],

    // endpoints (todo HTTPS para evitar mixed content)
    ENDPOINTS: {
      CP_COLONIA: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_cpcolonia.php",
      INSERT:     "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_i_requerimiento.php",
    },

    // payload base para el insert (puedes cambiar asignado_a/created_by si lo necesitas)
    DEFAULTS: {
      asignado_a: 1,
      prioridad:  2,
      estatus:    0,
      canal:      1,
      status:     1,
      created_by: 1,
    },

    TIMEOUT_MS: 15000
  };

  // ===== estado interno simple
  let files = [];                 // File[] para previews (ojo: no se están subiendo aún)
  let openerBtn = null;           // para devolver el foco al cerrar
  let trapHandler = null;         // keydown handler focus-trap
  let hasAttemptedSubmit = false; // para mostrar validaciones solo tras 1er submit

  // ===== mini helpers
  const digits  = (s) => (s || "").replace(/\D+/g, "");
  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

  const clearFeedback = () => { feedback.hidden = true; feedback.textContent = ""; };
  const showFeedback  = (msg) => { feedback.hidden = false; feedback.textContent = msg; };

  const setFieldError = (inputEl, msg = "") => {
    const field = inputEl?.closest?.(".ix-field") || inputEl?.closest?.(".ix-consent");
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

  const updateDescCount = () => { const len = (inpDesc.value || "").length; cntDesc.textContent = String(len); };

  // ===== Focus trap del modal (pa’ que no se escape el tab)
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

  // ====== Cache CP/Colonia (client) para no pegarle cada vez
  let CP_CACHE = null; // { [cp]: Set(colonias) }
  async function fetchCpColonia() {
    if (CP_CACHE) return CP_CACHE;

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), CFG.TIMEOUT_MS);

    let json;
    try {
      const res = await fetch(CFG.ENDPOINTS.CP_COLONIA, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ all: true }),
        signal: ctrl.signal
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      json = await res.json();
    } catch (err) {
      clearTimeout(t);
      console.warn("[IX] Falló CP/Colonia:", err?.message || err);
      showFeedback("No se pudo cargar el catálogo de C.P. y colonias.");
      CP_CACHE = {}; // vacío para no volver a pegarle en esta sesión del modal
      return CP_CACHE;
    }

    const arr = Array.isArray(json?.data) ? json.data : [];
    const map = {};
    for (const row of arr) {
      const cp = String(row?.cp || "").trim();
      const col = String(row?.colonia || "").trim();
      if (!cp || !col) continue;
      if (!map[cp]) map[cp] = new Set();
      map[cp].add(col);
    }
    CP_CACHE = map;
    return CP_CACHE;
  }

  // ====== UI: llenar selects CP/Colonia
  function resetColonia(msg = "Selecciona C.P. primero") {
    selCol.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = ""; opt.textContent = msg; opt.disabled = true; opt.selected = true;
    selCol.appendChild(opt);
    selCol.disabled = true;
  }

  function populateCpOptions(map) {
    selCP.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = ""; opt.textContent = "Selecciona C.P."; opt.disabled = true; opt.selected = true;
    selCP.appendChild(opt);
    Object.keys(map).sort().forEach(cp => {
      const o = document.createElement("option");
      o.value = cp; o.textContent = cp;
      selCP.appendChild(o);
    });
  }

  function populateColoniasForCP(map, cp) {
    const set = map[cp] || new Set();
    const list = Array.from(set).sort();
    selCol.innerHTML = "";
    const base = document.createElement("option");
    base.value = ""; base.textContent = "Selecciona colonia"; base.disabled = true; base.selected = true;
    selCol.appendChild(base);
    list.forEach(c => {
      const o = document.createElement("option");
      o.value = c; o.textContent = c;
      selCol.appendChild(o);
    });
    selCol.disabled = false;
  }

  // ====== Uploader (solo previews, límite de archivos; NO se suben al endpoint aún)
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
      if (!CFG.TYPES.includes(f.type)) {
        showFeedback("Solo se permiten imágenes JPG o PNG.");
        continue;
      }
      if (f.size > CFG.MAX_MB * 1024 * 1024) {
        showFeedback(`Cada archivo debe pesar ≤ ${CFG.MAX_MB} MB.`);
        continue;
      }
      if (files.length >= CFG.MAX_FILES) {
        showFeedback(`Máximo ${CFG.MAX_FILES} imágenes.`);
        break;
      }
      files.push(f);
    }
    refreshPreviews();
  }

  // eventos del uploader (click + drag & drop)
  upBtn?.addEventListener("click", () => upInput?.click());
  upWrap?.addEventListener("click", (e) => {
    if (e.target === upBtn) return; // ya controlado arriba
    // permitir click en el área para abrir selector (fuera del botón)
    if (!(e.target instanceof HTMLButtonElement)) upInput?.click();
  });
  upInput?.addEventListener("change", (e) => handleFiles(e.target.files));
  ["dragenter", "dragover"].forEach((ev) =>
    upWrap?.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); upWrap.classList.add("is-drag"); })
  );
  ["dragleave", "drop"].forEach((ev) =>
    upWrap?.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); upWrap.classList.remove("is-drag"); })
  );
  upWrap?.addEventListener("drop", (e) => handleFiles(e.dataTransfer?.files || []));

  // ====== Abrir/Cerrar modal
  async function openModal(
    { title = "Reporte", depKey = "1", itemId = "", sla = "", mode } = {},
    opener = null
  ) {
    openerBtn = opener || document.activeElement;

    // set títulos/hidden
    subTitle.textContent = title;
    inpReq.value = title ? `Reporte: ${title}` : "Reporte";
    inpDepId.value = String(parseInt(depKey, 10) || depKey || "");
    inpTraId.value = String(parseInt(itemId, 10) || itemId || "");

    // “Otros”: si no lo pasan, infiero por título
    const isOtros = (typeof mode === "string" && mode.toLowerCase() === "otros")
      || /otro/i.test(title || "");
    otrosBox.hidden = !isOtros;
    if (otrosBox.hidden) { inpOtros.value = ""; }

    // reset de estado
    clearFeedback();
    hasAttemptedSubmit = false;
    form.reset(); // cuidado: resetea selects → los repoblamos abajo
    files = [];
    refreshPreviews();
    updateDescCount();

    // repongo lo que reset borró:
    subTitle.textContent = title;
    inpReq.value = title ? `Reporte: ${title}` : "Reporte";
    inpDepId.value = String(parseInt(depKey, 10) || depKey || "");
    inpTraId.value = String(parseInt(itemId, 10) || itemId || "");
    otrosBox.hidden = !isOtros;

    // carga CP/Colonia y seteo selects
    const map = await fetchCpColonia();
    populateCpOptions(map);
    resetColonia();

    // mostrar modal + trap
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    trapHandler = (e) => { if (e.key === "Escape") closeModal(); else trap(e); };
    document.addEventListener("keydown", trapHandler);
    overlay?.addEventListener("click", closeModal, { once: true });
    btnCloses.forEach((b) => b.addEventListener("click", closeModal, { once: true }));

    // submit visible y habilitado (solo se deshabilita mientras se envía)
    btnSend.disabled = false;
    btnSend.textContent = "Mandar reporte";

    // foco al primer campo
    setTimeout(() => { inpNombre.focus(); }, 0);

    // evento público por si quieres escuchar fuera
    try { document.dispatchEvent(new CustomEvent("ix:report:open", { detail: { depKey, itemId, title, sla, mode: isOtros ? "otros" : "normal" } })); } catch {}
  }

  function closeModal() {
    document.removeEventListener("keydown", trapHandler || (() => {}));
    trapHandler = null;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    // regresar foco
    if (openerBtn && typeof openerBtn.focus === "function") openerBtn.focus();
    openerBtn = null;
    try { document.dispatchEvent(new CustomEvent("ix:report:close")); } catch {}
  }

  // ====== Validación (solo muestra errores tras el 1er submit)
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

    // cp/colonia
    const cpVal = selCP.value || "";
    const colVal = selCol.value || "";
    const cpBad  = !cpVal || !(CP_CACHE && CP_CACHE[cpVal]);
    if (cpBad) { ok = false; if (showErrors) setFieldError(selCP, "Selecciona un C.P. válido."); }
    else setFieldError(selCP);

    const validCols = (CP_CACHE && CP_CACHE[cpVal]) ? Array.from(CP_CACHE[cpVal]) : [];
    const colBad = !colVal || !validCols.includes(colVal);
    if (colBad) { ok = false; if (showErrors) setFieldError(selCol, "Selecciona una colonia válida."); }
    else setFieldError(selCol);

    // teléfono
    const tel = digits(inpTel.value);
    if (tel.length !== 10) { ok = false; if (showErrors) setFieldError(inpTel, "Teléfono a 10 dígitos."); }
    else setFieldError(inpTel);

    // correo (opcional)
    const mail = (inpCorreo.value || "").trim();
    if (mail && !isEmail(mail)) { ok = false; if (showErrors) setFieldError(inpCorreo, "Correo no válido."); }
    else setFieldError(inpCorreo);

    // descripción
    const desc = (inpDesc.value || "").trim();
    if (desc.length < 30) { ok = false; if (showErrors) setFieldError(inpDesc, "Describe con al menos 30 caracteres."); }
    else setFieldError(inpDesc);

    // consentimiento
    if (!chkCons.checked) { ok = false; if (showErrors) setFieldError(chkCons, "Debes aceptar el consentimiento."); }
    else setFieldError(chkCons);

    // archivos (solo límite)
    if (files.length > CFG.MAX_FILES) { ok = false; if (showErrors) showFeedback(`Máximo ${CFG.MAX_FILES} imágenes.`); }

    return ok;
  }

  // inputs cambian: solo limpio errores después del 1er submit
  [inpNombre, inpDom, inpTel, inpCorreo, inpDesc, chkCons].forEach((el) => {
    el?.addEventListener("input", () => {
      if (!hasAttemptedSubmit) return;
      if (el === inpTel)  el.value = digits(el.value).slice(0, 10);
      if (el === inpDesc) updateDescCount();
      validateForm(true);
    });
  });

  // selects: actualizar colonia cuando cambia CP
  modal.addEventListener("change", (e) => {
    const t = e.target;
    if (t === selCP) {
      const cp = selCP.value || "";
      if (!cp || !(CP_CACHE && CP_CACHE[cp])) resetColonia();
      else populateColoniasForCP(CP_CACHE, cp);
      if (hasAttemptedSubmit) validateForm(true);
    }
    if (t === selCol) {
      if (hasAttemptedSubmit) validateForm(true);
    }
  });

  // ====== Submit → POST al endpoint de insertar requerimiento
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFeedback();
    hasAttemptedSubmit = true;

    // validaciones (no deshabilitamos el botón previo; solo mostramos qué falta)
    if (!validateForm(true)) {
      showFeedback("Revisa los campos marcados y vuelve a intentar.");
      const bad = modal.querySelector(
        ".ix-field.ix-field--error select, .ix-field.ix-field--error input, .ix-field.ix-field--error textarea, .ix-consent.ix-field--error [type='checkbox']"
      );
      bad?.focus();
      return; // no enviamos al back si está inválido
    }

    // juntar payload para el back
    const depId = (inpDepId.value || "").trim();
    const traId = (inpTraId.value || "").trim();
    const asuntoText = inpReq.value || subTitle.textContent || "Reporte";
    const nombre   = (inpNombre.value || "").trim();
    const tel      = digits(inpTel.value);
    const correo   = (inpCorreo.value || "").trim();
    const calle    = (inpDom.value || "").trim();
    const cp       = selCP.value || "";
    const colonia  = selCol.value || "";
    const baseDesc = (inpDesc.value || "").trim();

    const isOtrosVisible = !otrosBox.hidden;
    const extraOtros = (inpOtros.value || "").trim();
    const descFinal = isOtrosVisible && extraOtros
      ? `${baseDesc}\n\nOtros: ${extraOtros}`
      : baseDesc;

    // armamos JSON limpio (omito campos vacíos opcionales)
    const payload = {
      departamento_id: Number(depId) || 0,
      tramite_id:      Number(traId) || 0,
      asignado_a:      CFG.DEFAULTS.asignado_a,
      asunto:          asuntoText,
      descripcion:     descFinal,
      prioridad:       CFG.DEFAULTS.prioridad,
      estatus:         CFG.DEFAULTS.estatus,
      canal:           CFG.DEFAULTS.canal,
      contacto_nombre: nombre,
      contacto_telefono: tel,
      contacto_calle:  calle,
      contacto_colonia: colonia,
      contacto_cp:     cp,
      status:          CFG.DEFAULTS.status,
      created_by:      CFG.DEFAULTS.created_by,
    };
    if (correo) payload.contacto_email = correo;

    // estado “enviando”: deshabilito solo mientras vuelo al back (esto sí se vale)
    btnSend.disabled = true;
    const prevTxt = btnSend.textContent;
    btnSend.textContent = "Enviando…";
    Array.from(form.elements).forEach((el) => { if (el !== btnSend) el.disabled = true; });

    // POST con timeout
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), CFG.TIMEOUT_MS);
    let json;
    try {
      const res = await fetch(CFG.ENDPOINTS.INSERT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      json = await res.json();
    } catch (err) {
      clearTimeout(t);
      showFeedback("No se pudo crear el reporte. Intenta de nuevo.");
      console.warn("[IX] Insert falló:", err?.message || err);
      Array.from(form.elements).forEach((el) => (el.disabled = false));
      btnSend.disabled = false;
      btnSend.textContent = prevTxt;
      return;
    }

    // éxito del back
    const folio = json?.data?.folio || "";
    try { sessionStorage.setItem("ix_last_folio", folio || ""); } catch {}
    try { document.dispatchEvent(new CustomEvent("ix:report:success", { detail: { folio, payload } })); } catch {}

    if (window.gcToast) gcToast(folio ? `Reporte creado: ${folio}` : "Reporte creado", "exito", 3200);
    else alert(folio ? `Reporte creado: ${folio}` : "Reporte creado");

    // reset visual y cerrar
    Array.from(form.elements).forEach((el) => (el.disabled = false));
    btnSend.disabled = false;
    btnSend.textContent = "Mandar reporte";
    form.reset();
    files = [];
    refreshPreviews();
    updateDescCount();
    closeModal();
  });

  // ===== API pública del modal (para que lo llame tu listado)
  window.ixReportModal = {
    open: (opts = {}, opener) => openModal(opts, opener),
    close: () => closeModal(),
  };
})();

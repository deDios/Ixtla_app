// /JS/retroCiudadanaDashboard.js
"use strict";

import { DonutChart } from "/JS/charts/donut-chart.js";

/* ============================================================================
   CONFIG
   ========================================================================== */
const CONFIG = {
  DEBUG_LOGS: true,
  PAGE_SIZE: 7,
  DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",

  API_RETRO:
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_retro.php",

  API_REQUERIMIENTO:
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_requerimiento.php",

  DEPT_ENDPOINT:
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php",

  API_RETRO_MAP:
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_cpcolonia_latlon_retro.php",

  RATE_LABELS: {
    1: "Malo",
    2: "Regular",
    3: "Bueno",
    4: "Excelente",
  },

  RETRO_STATUS_LABELS: {
    0: "Caducada",
    1: "No contestada",
    2: "Contestada",
    3: "Inhabilitada",
  },

  RETRO_STATUS_COLORS: {
    0: "#ef4444", // Caducada
    1: "#cbd5e1", // No contestada
    2: "#22c55e", // Contestada
    3: "#64748b", // Inhabilitada
  },

  MAX_FETCH_PAGES: 20,
};

const TAG = "[RetroDashboard]";
const log = (...a) => CONFIG.DEBUG_LOGS && console.log(TAG, ...a);
const warn = (...a) => CONFIG.DEBUG_LOGS && console.warn(TAG, ...a);
const err = (...a) => console.error(TAG, ...a);

const toast = (msg, type = "info") => {
  if (window.gcToast) return window.gcToast(msg, type);
  console.log("[toast]", type, msg);
};

/* ============================================================================
   HELPERS
   ========================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function getSortValue(row, key) {
  switch (key) {
    case "folio": {
      const m = String(row?.folio ?? "").match(/\d+/);
      return m ? Number(m[0]) : Number(row?.id ?? 0);
    }

    case "departamento":
      return normText(row?.departamento_nombre);

    case "tramite":
      return normText(row?.tramite_nombre);

    case "asignado":
      return normText(row?.asignado_nombre_completo);

    case "telefono":
      return Number(onlyDigits(row?.contacto_telefono) || 0);

    case "status":
      return Number(row?.status ?? -1);

    default:
      return "";
  }
}

function compareValues(a, b) {
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return String(a).localeCompare(String(b), "es", {
    numeric: true,
    sensitivity: "base",
  });
}

function sortRows(rows) {
  const key = State.sortKey;
  const dir = State.sortDir === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const av = getSortValue(a, key);
    const bv = getSortValue(b, key);
    return compareValues(av, bv) * dir;
  });
}

function renderSortableTh(label, key) {
  const active = State.sortKey === key;
  const isAsc = active && State.sortDir === "asc";
  const isDesc = active && State.sortDir === "desc";

  const ariaSort = active
    ? (isAsc ? "ascending" : "descending")
    : "none";

  const arrow = active
    ? `<span class="th-sort-arrow" aria-hidden="true">${isAsc ? "▲" : "▼"}</span>`
    : "";

  return `
    <th data-sort="${key}" aria-sort="${ariaSort}">
      <button type="button" class="th-sort-btn" data-sort="${key}" title="${active ? `Ordenado ${isAsc ? "ascendente" : "descendente"}` : "Ordenar"}">
        <span>${label}</span>
        ${arrow}
      </button>
    </th>
  `;
}

function debounce(fn, wait = 220) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function safeTxt(v, fallback = "—") {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}

function normText(v) {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function onlyDigits(v) {
  return String(v ?? "").replace(/\D+/g, "");
}

function escapeHtml(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPhone(v) {
  const d = onlyDigits(v);
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)} ${d.slice(6)}`;
  }
  return safeTxt(v);
}

function formatRate(value) {
  const n = Number(value);
  return CONFIG.RATE_LABELS[n] || "Sin respuesta";
}

function formatRetroStatus(value) {
  const n = Number(value);
  return CONFIG.RETRO_STATUS_LABELS[n] || "—";
}

function retroStatusDataKey(value) {
  const n = Number(value);
  if (n === 2) return "contestado";
  if (n === 1) return "no-contestado";
  if (n === 3) return "inhabilitado";
  if (n === 0) return "caducado";
  return "sin-status";
}

function getRetroStatusPaletteMap() {
  return {
    Contestada: CONFIG.RETRO_STATUS_COLORS[2],
    "No contestada": CONFIG.RETRO_STATUS_COLORS[1],
    Inhabilitada: CONFIG.RETRO_STATUS_COLORS[3],
    Caducada: CONFIG.RETRO_STATUS_COLORS[0],
  };
}

function getStatusCount(status) {
  return State.rows.filter((row) => String(row.status) === String(status))
    .length;
}

function isMobileAccordion() {
  return window.matchMedia("(max-width: 720px)").matches;
}

function getAccordionColspan() {
  return isMobileAccordion() ? 2 : 8;
}

function refreshCurrentPageDecorations() {
  const tbody = $(SEL.tableBody);
  if (!tbody) return;

  const rows = $$(".retro-row", tbody);
  rows.forEach((tr) => {
    tr.classList.add("is-clickable");
    tr.setAttribute("tabindex", "0");
    tr.setAttribute("role", "link");
    tr.setAttribute(
      "aria-label",
      `Abrir requerimiento ${tr.children?.[0]?.textContent?.trim() || ""}`,
    );
  });
}

function syncTableHead() {
  const table = $(SEL.tableBody)?.closest("table");
  const thead = table?.querySelector("thead");
  if (!thead) return;

  if (isMobileAccordion()) {
    thead.innerHTML = `
      <tr>
        ${renderSortableTh("Folio", "folio")}
        <th></th>
        <th></th>
        <th></th>
        <th></th>
        <th></th>
        ${renderSortableTh("Status", "status")}
        <th class="hs-th-expander" aria-label="Detalles"></th>
      </tr>
    `;
  } else {
    thead.innerHTML = `
      <tr>
        ${renderSortableTh("Folio", "folio")}
        ${renderSortableTh("Departamento", "departamento")}
        ${renderSortableTh("Tipo de trámite", "tramite")}
        ${renderSortableTh("Asignado", "asignado")}
        ${renderSortableTh("Teléfono", "telefono")}
        ${renderSortableTh("Status", "status")}
      </tr>
    `;
  }
}

function buildRetroViewModel(retroRow, reqRow) {
  return {
    retro_id: Number(retroRow?.id ?? 0),
    requerimiento_id: Number(reqRow?.id ?? retroRow?.requerimiento_id ?? 0),
    folio: safeTxt(reqRow?.folio || retroRow?.folio),
    tramite: safeTxt(reqRow?.tramite_nombre || retroRow?.tramite_nombre),
    descripcion: safeTxt(reqRow?.descripcion),
    ciudadano: safeTxt(reqRow?.contacto_nombre),
    departamento: safeTxt(
      reqRow?.departamento_nombre || retroRow?.departamento_nombre,
    ),
    asignado: safeTxt(
      reqRow?.asignado_nombre_completo || retroRow?.asignado_nombre_completo,
    ),
    telefono: safeTxt(retroRow?.contacto_telefono || reqRow?.contacto_telefono),
    comentario: safeTxt(retroRow?.comentario, "Sin comentario"),
    calificacion:
      retroRow?.calificacion != null ? Number(retroRow.calificacion) : null,
    status: retroRow?.status != null ? Number(retroRow.status) : null,
  };
}

function findRetroRowByReqId(reqId) {
  const id = Number(reqId || 0);
  if (!id) return null;
  return (
    State.rows.find((row) => Number(row?.requerimiento_id ?? 0) === id) || null
  );
}

function readCookiePayload() {
  try {
    const name = "ix_emp=";
    const pair = document.cookie.split("; ").find((c) => c.startsWith(name));
    if (!pair) return null;
    const raw = decodeURIComponent(pair.slice(name.length));
    return JSON.parse(decodeURIComponent(escape(atob(raw))));
  } catch {
    return null;
  }
}

function cacheBust(url) {
  const base = String(url || "").split("?")[0];
  return `${base}${base.includes("?") ? "&" : "?"}v=${Date.now()}`;
}

function setAvatarSrc(img, idUsuario) {
  if (!img) return;

  const id = Number(idUsuario);
  if (!id) {
    img.src = CONFIG.DEFAULT_AVATAR;
    return;
  }

  const candidates = [
    `/ASSETS/user/userImgs/img_${id}.png`,
    `/ASSETS/user/userImgs/img_${id}.jpg`,
    `/ASSETS/user/userImgs/img_${id}.webp`,
  ];

  let i = 0;
  const tryNext = () => {
    if (i >= candidates.length) {
      img.onerror = null;
      img.src = CONFIG.DEFAULT_AVATAR;
      return;
    }

    img.onerror = () => {
      i += 1;
      tryNext();
    };

    img.src = cacheBust(candidates[i]);
  };

  tryNext();
}

const __DEPT_CACHE = new Map();

async function resolveDeptName(deptId) {
  if (!deptId) return "—";

  const key = Number(deptId);
  if (__DEPT_CACHE.has(key)) return __DEPT_CACHE.get(key);

  try {
    const res = await fetch(CONFIG.DEPT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ page: 1, page_size: 200, status: 1 }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const arr = Array.isArray(json?.data) ? json.data : [];
    const found = arr.find((d) => Number(d.id) === key);
    const name = found?.nombre ? String(found.nombre) : `Depto ${deptId}`;

    __DEPT_CACHE.set(key, name);
    return name;
  } catch (e) {
    warn("resolveDeptName() fallback:", deptId, e);
    return `Depto ${deptId}`;
  }
}

function isElementRenderable(el) {
  if (!el) return false;

  const cs = window.getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden") return false;

  const r = el.getBoundingClientRect();
  if (!Number.isFinite(r.width) || !Number.isFinite(r.height)) return false;
  if (r.width < 20 || r.height < 20) return false;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const max = 8192;
  if (r.width * dpr > max || r.height * dpr > max) return false;

  return true;
}

/* ============================================================================
   STATE
   ========================================================================== */
const State = {
  session: null,
  rows: [],
  filtered: [],
  currentPage: 1,
  pageSize: CONFIG.PAGE_SIZE,
  activeStatus: "todos",
  search: "",
  chartMonth: null,
  retroViewOpen: false,
  retroViewModel: null,
  openRow: null,

  sortKey: "folio",
  sortDir: "desc",

  retroMap: null,
  retroBubbleLayer: null,
  retroMapRows: [],
};

/* ============================================================================
   SELECTORES
   ========================================================================== */
const SEL = {
  avatar: "#hs-avatar",
  profileName: "#hs-profile-name",
  profileBadge: "#hs-profile-badge",

  searchInput: "#hs-search",
  tableBody: "#hs-table-body",
  pager: "#hs-pager",
  legendTotal: "#hs-legend-total",
  legendStatus: "#hs-legend-status",

  rateGroup: "#hs-states",
  rateItems: "#hs-states .item",

  filterBox: "#hs-filterbox",
  filterToggle: "#hs-filter-toggle",
  filterActive: "#hs-filter-active",

  donutCanvas: "#chart-month",
  donutLegend: "#donut-legend",

  //modal readonly
  retroModal: "#retro-modal",
  retroOverlay: "#retro-view-overlay",
  retroClose: "#retro-view-close",
  retroCloseFooter: "#retro-close-footer",
  retroGo: "#retro-go",

  retroFolio: "#retro-folio",
  retroTramite: "#retro-tramite",
  retroDescripcion: "#retro-descripcion",
  retroCiudadano: "#retro-ciudadano",
  retroDepartamento: "#retro-depto",
  retroAsignado: "#retro-asignado",
  retroTelefono: "#retro-telefono",
  retroStatus: "#retro-status",
  retroComentario: "#retro-comentario",
  retroRateItems: "#retro-modal .rate-item",
  retroRateInputs: '#retro-modal input[name="rate_view"]',

  //mapa de retro
  retroMap: "#retro-map",
};

/* ============================================================================
   PERFIL / SIDEBAR
   ========================================================================== */
async function hydrateProfileFromSession() {
  const s = readCookiePayload() || {};
  State.session = s;

  const idUsuario = s?.id_usuario ?? s?.empleado_id ?? null;
  const deptId = s?.dept_id ?? s?.departamento_id ?? null;
  const nombre =
    [s?.nombre, s?.apellidos].filter(Boolean).join(" ").trim() || "—";

  const nameEl = $(SEL.profileName);
  if (nameEl) nameEl.textContent = nombre;

  const avatar = $(SEL.avatar);
  if (avatar) setAvatarSrc(avatar, idUsuario);

  const badge = $(SEL.profileBadge);
  if (badge) badge.textContent = await resolveDeptName(deptId);

  log("hydrateProfileFromSession()", { idUsuario, deptId, nombre });
}

function updateFilterActiveLabel() {
  const slot = $(SEL.filterActive);
  if (!slot) return;

  const all =
    getStatusCount(0) +
    getStatusCount(1) +
    getStatusCount(2) +
    getStatusCount(3);

  if (State.activeStatus === "todos") {
    slot.textContent = `Todos (${all})`;
    return;
  }

  slot.textContent = `${formatRetroStatus(State.activeStatus)} (${applyPipeline().length})`;
}

function initSidebar(onChange) {
  const items = $$(SEL.rateItems);
  if (!items.length) return;

  items.forEach((btn) => {
    btn.addEventListener("click", () => {
      items.forEach((it) => {
        it.classList.remove("is-active");
        it.setAttribute("aria-checked", "false");
      });

      btn.classList.add("is-active");
      btn.setAttribute("aria-checked", "true");

      State.activeStatus = btn.dataset.status || "todos";
      State.currentPage = 1;
      State.openRow = null;

      renderCounts();
      onChange?.();
    });
  });
}

function initMobileFilterCombo() {
  const box = $(SEL.filterBox);
  const toggle = $(SEL.filterToggle);
  const states = $(SEL.rateGroup);
  if (!box || !toggle || !states) return;

  const isMobile = () => window.matchMedia("(max-width: 720px)").matches;

  const close = () => {
    box.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    if (!isMobile()) return;
    box.classList.toggle("is-open");
    toggle.setAttribute(
      "aria-expanded",
      box.classList.contains("is-open") ? "true" : "false",
    );
  });

  states.addEventListener("click", (e) => {
    const item = e.target.closest(".item");
    if (!item) return;

    setTimeout(() => {
      updateFilterActiveLabel();
      if (isMobile()) close();
    }, 0);
  });

  document.addEventListener("click", (e) => {
    if (!isMobile()) return;
    if (!box.classList.contains("is-open")) return;
    if (box.contains(e.target)) return;
    close();
  });

  window.addEventListener("resize", () => {
    updateFilterActiveLabel();
    if (!isMobile()) close();
  });

  updateFilterActiveLabel();
}

/* ============================================================================
   FETCH
   ========================================================================== */
async function fetchRetroPage(page = 1, pageSize = 200) {
  const url = new URL(CONFIG.API_RETRO);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(pageSize));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  if (!json?.ok) throw new Error(json?.error || "Respuesta inválida");

  return json;
}

async function fetchAllRetros() {
  const acc = [];
  let page = 1;
  let total = Infinity;
  const pageSize = 200;

  while (acc.length < total && page <= CONFIG.MAX_FETCH_PAGES) {
    const json = await fetchRetroPage(page, pageSize);
    const rows = Array.isArray(json?.data) ? json.data : [];
    total = Number(json?.meta?.total ?? rows.length);

    acc.push(...rows);

    log("fetchAllRetros page", {
      page,
      pageSize,
      fetched: rows.length,
      total,
      accumulated: acc.length,
    });

    if (!rows.length || rows.length < pageSize) break;
    page += 1;
  }

  return acc.map(normalizeRow);
}

async function fetchRequerimientoById(id) {
  const reqId = Number(id || 0);
  if (!reqId) throw new Error("ID de requerimiento inválido");

  const res = await fetch(CONFIG.API_REQUERIMIENTO, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ id: reqId }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  if (!json?.ok || !json?.data) {
    throw new Error(json?.error || "No se pudo obtener el requerimiento");
  }

  return json.data;
}

function normalizeRow(row) {
  return {
    ...row,
    id: Number(row?.id ?? 0),
    requerimiento_id:
      row?.requerimiento_id != null ? Number(row.requerimiento_id) : null,
    status: row?.status != null ? Number(row.status) : null,
    calificacion: row?.calificacion != null ? Number(row.calificacion) : null,
    folio: safeTxt(row?.folio),
    contacto_telefono: safeTxt(row?.contacto_telefono),
    departamento_nombre: safeTxt(row?.departamento_nombre),
    tramite_nombre: safeTxt(row?.tramite_nombre),
    asignado_nombre_completo: safeTxt(row?.asignado_nombre_completo),
  };
}

/* ============================================================================
   MAPA
   ========================================================================== */
async function fetchRetroMapData() {
  const payload = {};

  if (State.activeStatus !== "todos") {
    payload.retro_status = Number(State.activeStatus);
  }

  const res = await fetch(CONFIG.API_RETRO_MAP, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  if (!json?.ok) throw new Error(json?.error || "No se pudo obtener el mapa");

  return Array.isArray(json?.data) ? json.data : [];
}

function initRetroMap() {
  const el = $(SEL.retroMap);
  if (!el || State.retroMap || typeof L === "undefined") return;

  State.retroMap = L.map("retro-map", { zoomControl: true }).setView(
    [20.55, -103.2],
    12,
  );

  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      maxZoom: 18,
      attribution: "© OpenStreetMap, © CARTO",
    },
  ).addTo(State.retroMap);

  State.retroBubbleLayer = L.layerGroup().addTo(State.retroMap);
}

function getDominantRetroStatus(row) {
  const candidates = [
    Number(row?.dominant_status),
    Number(row?.retro_status),
    Number(row?.status),
  ];

  for (const n of candidates) {
    if ([0, 1, 2, 3].includes(n)) return n;
  }

  return 1;
}

function getRetroStatusColor(status) {
  return CONFIG.RETRO_STATUS_COLORS[Number(status)] || "#94a3b8";
}

function getRetroStatusLabel(status) {
  return CONFIG.RETRO_STATUS_LABELS[Number(status)] || "Sin definir";
}

function processRetroBubbleMap(geoData) {
  initRetroMap();

  if (!State.retroMap || !State.retroBubbleLayer) return;

  setTimeout(() => {
    if (State.retroMap) State.retroMap.invalidateSize();
  }, 300);

  State.retroBubbleLayer.clearLayers();

  if (!Array.isArray(geoData) || !geoData.length) return;

  const bounds = [];

  geoData.forEach((r) => {
    const val = parseFloat(r.total) || 0;
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    const dominantStatus = getDominantRetroStatus(r);

    if (Number.isNaN(lat) || Number.isNaN(lon) || val <= 0) return;

    bounds.push([lat, lon]);

    const radius = Math.min(8 + Math.sqrt(val) * 2.2, 32);
    const color = getRetroStatusColor(dominantStatus);
    const statusLabel = getRetroStatusLabel(dominantStatus);

    L.circleMarker([lat, lon], {
      radius,
      fillColor: color,
      color: "#ffffff",
      weight: 1.5,
      opacity: 1,
      fillOpacity: 0.82,
    })
      .addTo(State.retroBubbleLayer)
      .bindTooltip(
        `
          <strong>${escapeHtml(r.colonia || "Zona")}</strong><br>
          Retros: ${val}<br>
          Status predominante: ${escapeHtml(statusLabel)}
        `,
        { direction: "top" },
      );
  });

  if (bounds.length > 0) {
    State.retroMap.fitBounds(L.latLngBounds(bounds), {
      padding: [30, 30],
      maxZoom: 15,
    });
  }
}

async function refreshRetroMap() {
  try {
    const rows = await fetchRetroMapData();
    State.retroMapRows = rows;
    processRetroBubbleMap(rows);
  } catch (e) {
    warn("refreshRetroMap()", e);
  }
}

/* ============================================================================
   FILTROS / PIPELINE
   ========================================================================== */
function matchesSearch(row) {
  const q = normText(State.search);
  if (!q) return true;

  const haystack = [
    row.folio,
    row.departamento_nombre,
    row.tramite_nombre,
    row.asignado_nombre_completo,
    row.contacto_telefono,
    formatRetroStatus(row.status),
  ]
    .map(normText)
    .join(" ");

  return haystack.includes(q);
}

function applyPipeline() {
  return State.rows.filter((row) => {
    const okStatus =
      State.activeStatus === "todos" ||
      String(row.status) === String(State.activeStatus);

    const okSearch = matchesSearch(row);

    return okStatus && okSearch;
  });
}

/* ============================================================================
   MODAL READONLY
   ========================================================================== */
function closeRetroReadonlyModal() {
  const modal = $(SEL.retroModal);
  if (!modal) return;

  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");

  State.retroViewOpen = false;
  State.retroViewModel = null;
}

function fillRetroReadonlyModal(viewModel) {
  const setField = (sel, value, prefix = "") => {
    const el = $(sel);
    if (!el) return;

    const finalValue = prefix ? `${prefix}${value}` : value;

    if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) {
      el.value = finalValue;
    } else {
      el.textContent = finalValue;
    }
  };

  setField(SEL.retroFolio, safeTxt(viewModel?.folio), "Folio: ");
  setField(SEL.retroTramite, safeTxt(viewModel?.tramite));
  setField(SEL.retroDescripcion, safeTxt(viewModel?.descripcion));
  setField(SEL.retroCiudadano, safeTxt(viewModel?.ciudadano));
  setField(SEL.retroDepartamento, safeTxt(viewModel?.departamento));
  setField(SEL.retroAsignado, safeTxt(viewModel?.asignado));
  setField(SEL.retroTelefono, safeTxt(formatPhone(viewModel?.telefono)));
  setField(SEL.retroStatus, formatRetroStatus(viewModel?.status));
  setField(
    SEL.retroComentario,
    safeTxt(viewModel?.comentario, "Sin comentario"),
  );

  $$(SEL.retroRateItems).forEach((item) => {
    const rate = Number(item.dataset.rate || 0);
    item.classList.toggle(
      "is-active",
      rate === Number(viewModel?.calificacion ?? 0),
    );
  });

  $$(SEL.retroRateInputs).forEach((input) => {
    input.checked =
      Number(input.value) === Number(viewModel?.calificacion ?? 0);
  });

  const goBtn = $(SEL.retroGo);
  if (goBtn) goBtn.dataset.reqId = String(viewModel?.requerimiento_id ?? "");
}

function openRetroReadonlyModal(viewModel) {
  const modal = $(SEL.retroModal);
  if (!modal) {
    warn("Modal readonly no encontrado en DOM");
    return;
  }

  State.retroViewModel = viewModel || null;
  fillRetroReadonlyModal(viewModel);

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  State.retroViewOpen = true;
}

function initRetroReadonlyModal() {
  const modal = $(SEL.retroModal);
  const overlay = $(SEL.retroOverlay);
  const closeBtn = $(SEL.retroClose);
  const closeFooterBtn = $(SEL.retroCloseFooter);
  const goBtn = $(SEL.retroGo);

  overlay?.addEventListener("click", closeRetroReadonlyModal);
  closeBtn?.addEventListener("click", closeRetroReadonlyModal);
  closeFooterBtn?.addEventListener("click", closeRetroReadonlyModal);

  goBtn?.addEventListener("click", () => {
    const reqId = Number(goBtn.dataset.reqId || 0);
    if (!reqId) return;
    window.location.href = `/VIEWS/requerimiento.php?id=${reqId}`;
  });

  document.addEventListener("keydown", (e) => {
    if (!State.retroViewOpen) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeRetroReadonlyModal();
    }
  });

  modal?.addEventListener("click", (e) => {
    const dialog = e.target.closest(".ix-modal__dialog");
    if (dialog) e.stopPropagation();
  });
}

async function handleOpenRetroDetail(reqId) {
  const id = Number(reqId || 0);
  if (!id) return;

  const retroRow = findRetroRowByReqId(id);
  if (!retroRow) {
    toast("No se encontró la retro seleccionada.", "warning");
    return;
  }

  try {
    const reqRow = await fetchRequerimientoById(id);
    const viewModel = buildRetroViewModel(retroRow, reqRow);
    log("retro detail viewModel", viewModel);
    openRetroReadonlyModal(viewModel);
  } catch (e) {
    err("handleOpenRetroDetail()", e);
    toast("No se pudo cargar el detalle del requerimiento.", "error");
  }
}

/* ============================================================================
   CONTADORES / LEYENDAS
   ========================================================================== */
function renderCounts() {
  const all =
    getStatusCount(0) +
    getStatusCount(1) +
    getStatusCount(2) +
    getStatusCount(3);

  const totalEl = $("#cnt-retro-todos");
  const noContestEl = $("#cnt-retro-no-contestado");
  const contestadoEl = $("#cnt-retro-contestado");
  const inhabilitadoEl = $("#cnt-retro-inhabilitado");
  const caducadoEl = $("#cnt-retro-caducado");

  if (totalEl) totalEl.textContent = `(${all})`;
  if (noContestEl) noContestEl.textContent = `(${getStatusCount(1)})`;
  if (contestadoEl) contestadoEl.textContent = `(${getStatusCount(2)})`;
  if (inhabilitadoEl) inhabilitadoEl.textContent = `(${getStatusCount(3)})`;
  if (caducadoEl) caducadoEl.textContent = `(${getStatusCount(0)})`;

  updateFilterActiveLabel();
}

function updateLegendStatus() {
  const el = $(SEL.legendStatus);
  if (!el) return;

  if (State.activeStatus === "todos") {
    el.textContent = "Todos los status";
    return;
  }

  el.textContent = formatRetroStatus(State.activeStatus);
}

/* ============================================================================
   TABLA
   ========================================================================== */
function getPagedRows(rows) {
  const start = (State.currentPage - 1) * State.pageSize;
  return rows.slice(start, start + State.pageSize);
}

function renderTable(rows) {
  const tbody = $(SEL.tableBody);
  if (!tbody) return;

  const paged = getPagedRows(rows);

  if (!paged.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${isMobileAccordion() ? getAccordionColspan() : 6}" class="is-empty-row">
          No se encontraron registros.
        </td>
      </tr>
    `;
    return;
  }

  if (isMobileAccordion()) {
    tbody.innerHTML = paged
      .map(
        (row, idx) => `
          <tr class="retro-row is-clickable ${idx === State.openRow ? "is-open" : ""}" data-row-idx="${idx}" data-req-id="${escapeHtml(row.requerimiento_id ?? "")}">
            <td>${escapeHtml(row.folio)}</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td>
              <span class="badge-status retro-status" data-retro-status="${escapeHtml(retroStatusDataKey(row.status))}">
                ${escapeHtml(formatRetroStatus(row.status))}
              </span>
            </td>
            <td class="hs-cell-expander">
              <button
                type="button"
                class="hs-expander"
                data-expand="${idx}"
                aria-label="Ver más detalles"
                title="Ver más detalles"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"></path>
                </svg>
              </button>
            </td>
          </tr>

          ${
            idx === State.openRow
              ? `
            <tr class="hs-row-expand">
              <td colspan="${getAccordionColspan()}">
                <div class="hs-expand-grid">
                  <div class="hs-kv">
                    <div class="hs-k">Departamento</div>
                    <div class="hs-v">${escapeHtml(row.departamento_nombre)}</div>
                  </div>

                  <div class="hs-kv">
                    <div class="hs-k">Asignado</div>
                    <div class="hs-v">${escapeHtml(row.asignado_nombre_completo)}</div>
                  </div>

                  <div class="hs-kv">
                    <div class="hs-k">Teléfono</div>
                    <div class="hs-v">${escapeHtml(formatPhone(row.contacto_telefono))}</div>
                  </div>
                </div>

                <div class="hs-expand-actions">
                  <button type="button" class="hs-open-btn" data-open-req="${escapeHtml(row.requerimiento_id ?? "")}">
                    Abrir
                  </button>
                </div>
              </td>
            </tr>
          `
              : ""
          }
        `,
      )
      .join("");
  } else {
    tbody.innerHTML = paged
      .map(
        (row) => `
          <tr class="retro-row is-clickable" data-req-id="${escapeHtml(row.requerimiento_id ?? "")}">
            <td>${escapeHtml(row.folio)}</td>
            <td>${escapeHtml(row.departamento_nombre)}</td>
            <td>${escapeHtml(row.tramite_nombre)}</td>
            <td>${escapeHtml(row.asignado_nombre_completo)}</td>
            <td>${escapeHtml(formatPhone(row.contacto_telefono))}</td>
            <td>
              <span class="badge-status retro-status" data-retro-status="${escapeHtml(retroStatusDataKey(row.status))}">
                ${escapeHtml(formatRetroStatus(row.status))}
              </span>
            </td>
          </tr>
        `,
      )
      .join("");
  }

  refreshCurrentPageDecorations();
}

function renderPager(rows) {
  const pager = $(SEL.pager);
  if (!pager) return;

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / State.pageSize));

  if (State.currentPage > pages) State.currentPage = pages;

  if (pages <= 1) {
    pager.innerHTML = "";
    return;
  }

  const makeBtn = ({ label, page, disabled = false, active = false }) => `
    <button
      type="button"
      class="btn ${active ? "primary" : ""}"
      data-p="${disabled ? "disabled" : page}"
      ${disabled ? "disabled" : ""}
    >${label}</button>
  `;

  const parts = [];

  parts.push(
    makeBtn({ label: "«", page: 1, disabled: State.currentPage === 1 }),
  );
  parts.push(
    makeBtn({
      label: "‹",
      page: State.currentPage - 1,
      disabled: State.currentPage === 1,
    }),
  );

  let start = Math.max(1, State.currentPage - 2);
  let end = Math.min(pages, State.currentPage + 2);

  if (State.currentPage <= 3) {
    start = 1;
    end = Math.min(5, pages);
  }

  if (State.currentPage >= pages - 2) {
    start = Math.max(1, pages - 4);
    end = pages;
  }

  if (start > 1) {
    parts.push(
      makeBtn({ label: "1", page: 1, active: State.currentPage === 1 }),
    );
    if (start > 2) parts.push(`<span class="pager-ellipsis">…</span>`);
  }

  for (let p = start; p <= end; p += 1) {
    if (p === 1 && start > 1) continue;
    if (p === pages && end < pages) continue;

    parts.push(
      makeBtn({
        label: String(p),
        page: p,
        active: p === State.currentPage,
      }),
    );
  }

  if (end < pages) {
    if (end < pages - 1) parts.push(`<span class="pager-ellipsis">…</span>`);
    parts.push(
      makeBtn({
        label: String(pages),
        page: pages,
        active: State.currentPage === pages,
      }),
    );
  }

  parts.push(
    makeBtn({
      label: "›",
      page: State.currentPage + 1,
      disabled: State.currentPage === pages,
    }),
  );

  parts.push(
    makeBtn({
      label: "»",
      page: pages,
      disabled: State.currentPage === pages,
    }),
  );

  pager.innerHTML = `
    ${parts.join("")}
    <span class="muted" style="margin-left:.75rem;">Pág. ${State.currentPage} de ${pages}</span>
    <input type="number" min="1" max="${pages}" value="${State.currentPage}" data-goto style="width:4rem;margin-left:.5rem;">
    <button type="button" class="btn" data-go>Ir</button>
  `;

  $$("button[data-p]", pager).forEach((b) => {
    b.addEventListener("click", () => {
      const raw = b.dataset.p;
      if (!raw || raw === "disabled") return;

      const page = Number(raw);
      if (!page || page < 1 || page > pages || page === State.currentPage)
        return;

      State.currentPage = page;
      renderTable(State.filtered);
      renderPager(State.filtered);
    });
  });

  const gotoInput = $("input[data-goto]", pager);
  const gotoBtn = $("button[data-go]", pager);

  const goToPage = () => {
    const page = Number(gotoInput?.value || 1);
    if (!page || page < 1 || page > pages || page === State.currentPage) return;

    State.currentPage = page;
    renderTable(State.filtered);
    renderPager(State.filtered);
  };

  gotoBtn?.addEventListener("click", goToPage);
  gotoInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") goToPage();
  });
}

/* ============================================================================
   CHART
   ========================================================================== */
function buildDonutData(rows) {
  const counts = {
    Contestada: 0,
    "No contestada": 0,
    Inhabilitada: 0,
    Caducada: 0,
  };

  rows.forEach((row) => {
    const st = Number(row.status);

    if (st === 2) counts.Contestada += 1;
    else if (st === 1) counts["No contestada"] += 1;
    else if (st === 3) counts.Inhabilitada += 1;
    else if (st === 0) counts.Caducada += 1;
  });

  return {
    total: rows.length,
    data: [
      { label: "Contestada", value: counts.Contestada },
      { label: "No contestada", value: counts["No contestada"] },
      { label: "Inhabilitada", value: counts.Inhabilitada },
      { label: "Caducada", value: counts.Caducada },
    ],
  };
}

function drawDonutFromRows(rows) {
  const canvas = $(SEL.donutCanvas);
  const legendEl = $(SEL.donutLegend);
  if (!canvas || !legendEl) return;
  if (!isElementRenderable(canvas)) return;

  const donutAgg = buildDonutData(rows);

  try {
    State.chartMonth?.destroy?.();
  } catch (_) {}

  try {
    State.chartMonth = new DonutChart(canvas, {
      data: donutAgg.data,
      total: donutAgg.total,
      legendEl,
      paletteMap: getRetroStatusPaletteMap(),
      showPercLabels: true,
    });

    if (
      State.chartMonth &&
      typeof State.chartMonth._drawCenter === "function"
    ) {
      const originalDrawCenter = State.chartMonth._drawCenter.bind(
        State.chartMonth,
      );
      State.chartMonth._drawCenter = (big) => originalDrawCenter(big, "Retros");
      State.chartMonth.draw(true);
      State.chartMonth.renderLegend();
    }
  } catch (e) {
    err("DonutChart error:", e);
  }
}

/* ============================================================================
   SEARCH
   ========================================================================== */
function initSearch(onChange) {
  const input = $(SEL.searchInput);
  if (!input) return;

  input.addEventListener(
    "input",
    debounce((e) => {
      State.search = String(e.target.value || "").trim();
      State.currentPage = 1;
      State.openRow = null;
      onChange?.();
    }, 180),
  );
}

/* ============================================================================
   INTERACCIÓN TABLA
   ========================================================================== */
function setupRowClickDelegation() {
  const tbody = $(SEL.tableBody);
  if (!tbody) return;

  tbody.addEventListener("click", (e) => {
    const openBtn = e.target.closest("[data-open-req]");
    if (openBtn) {
      e.stopPropagation();
      handleOpenRetroDetail(openBtn.dataset.openReq);
      return;
    }

    const expander = e.target.closest("[data-expand]");
    if (expander) {
      e.stopPropagation();
      const idx = Number(expander.dataset.expand);
      State.openRow = State.openRow === idx ? null : idx;
      renderTable(State.filtered);
      return;
    }

    const tr = e.target.closest("tr[data-req-id]");
    if (!tr) return;

    if (!isMobileAccordion()) {
      handleOpenRetroDetail(tr.dataset.reqId);
    }
  });

  tbody.addEventListener("keydown", (e) => {
    const tr = e.target.closest("tr[data-req-id]");
    if (!tr) return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!isMobileAccordion()) {
        handleOpenRetroDetail(tr.dataset.reqId);
      }
    }
  });
}

function initTableSorting() {
  const table = $(SEL.tableBody)?.closest("table");
  const thead = table?.querySelector("thead");
  if (!thead) return;

  thead.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-sort]");
    if (!btn) return;

    const key = btn.dataset.sort;
    if (!key) return;

    if (State.sortKey === key) {
      State.sortDir = State.sortDir === "asc" ? "desc" : "asc";
    } else {
      State.sortKey = key;
      State.sortDir = key === "folio" ? "desc" : "asc";
    }

    State.currentPage = 1;
    State.openRow = null;
    applyPipelineAndRender();
  });
}

/* ============================================================================
   RENDER GENERAL
   ========================================================================== */
function applyPipelineAndRender() {
  const filtered = sortRows(applyPipeline());
  State.filtered = filtered;

  const legendTotal = $(SEL.legendTotal);
  if (legendTotal) legendTotal.textContent = String(filtered.length);

  updateLegendStatus();
  syncTableHead();
  renderTable(filtered);
  renderPager(filtered);
  drawDonutFromRows(filtered);
  refreshRetroMap();
}

/* ============================================================================
   INIT
   ========================================================================== */
async function init() {
  try {
    await hydrateProfileFromSession();
    initSidebar(() => applyPipelineAndRender());
    initMobileFilterCombo();
    initSearch(() => applyPipelineAndRender());
    initRetroReadonlyModal();
    setupRowClickDelegation();
    initRetroMap();
    initTableSorting();

    window.addEventListener(
      "resize",
      debounce(() => {
        refreshCurrentPageDecorations();
        syncTableHead();
        renderTable(State.filtered);
        drawDonutFromRows(State.filtered);

        if (State.retroMap) {
          State.retroMap.invalidateSize();
        }
      }, 120),
    );

    State.rows = await fetchAllRetros();

    renderCounts();
    applyPipelineAndRender();

    log("init ok", {
      rows: State.rows.length,
      pageSize: State.pageSize,
    });
  } catch (e) {
    err("init error:", e);
    toast("No se pudo cargar el dashboard de retroalimentación.", "error");

    const tbody = $(SEL.tableBody);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="is-empty-row">
            Ocurrió un error al cargar la información.
          </td>
        </tr>
      `;
    }
  }
}

window.addEventListener("DOMContentLoaded", init);

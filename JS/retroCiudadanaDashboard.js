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

  // Ajusta este endpoint si tu ruta final cambia
  API_RETRO:
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_retro.php",

  DEPT_ENDPOINT:
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php",

  RATE_LABELS: {
    1: "Malo",
    2: "Regular",
    3: "Bueno",
    4: "Excelente",
  },

  RATE_COLORS: {
    Malo: "#ef4444",
    Regular: "#f59e0b",
    Bueno: "#3b82f6",
    Excelente: "#22c55e",
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

function rateBadgeClass(value) {
  const n = Number(value);
  if (n === 4) return "is-excelente";
  if (n === 3) return "is-bueno";
  if (n === 2) return "is-regular";
  if (n === 1) return "is-malo";
  return "is-empty";
}

function getRowDate(row) {
  return (
    row?.updated_at ||
    row?.created_at ||
    row?.cerrado_en ||
    row?.fecha ||
    row?.fecha_respuesta ||
    null
  );
}

function parseDateLoose(v) {
  if (!v) return null;
  const d = new Date(String(v).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

function isCurrentMonth(v) {
  const d = parseDateLoose(v);
  if (!d) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
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
  return base + (base.includes("?") ? "&" : "?") + "v=" + Date.now();
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
      i++;
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
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    const arr = json?.data || [];
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
  activeRate: "todos",
  search: "",
  chartMonth: null,
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

  rateGroup: "#retro-states",
  rateItems: "#retro-states .item",

  filterBox: "#retro-filterbox",
  filterToggle: "#retro-filter-toggle",
  filterActive: "#retro-filter-active",

  donutCanvas: "#chart-month",
  donutLegend: "#donut-legend",
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

      State.activeRate = btn.dataset.rate || "todos";
      State.currentPage = 1;
      updateFilterActiveLabel();
      onChange?.();
    });
  });
}

function updateFilterActiveLabel() {
  const active = $(`${SEL.rateGroup} .item.is-active`);
  const slot = $(SEL.filterActive);
  if (!slot) return;

  const label = active?.querySelector(".label")?.textContent?.trim() || "Todos";
  const total = getRateCount(State.activeRate);
  slot.textContent = `${label} (${total})`;
}

function getRateCount(rateKey) {
  if (rateKey === "todos") return State.rows.length;
  return State.rows.filter((r) => String(r.calificacion ?? "") === String(rateKey))
    .length;
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
      box.classList.contains("is-open") ? "true" : "false"
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

function normalizeRow(row) {
  return {
    ...row,
    id: Number(row?.id ?? 0),
    requerimiento_id:
      row?.requerimiento_id != null ? Number(row.requerimiento_id) : null,
    status: row?.status != null ? Number(row.status) : null,
    calificacion:
      row?.calificacion != null ? Number(row.calificacion) : null,
    folio: safeTxt(row?.folio),
    contacto_telefono: safeTxt(row?.contacto_telefono),
    departamento_nombre: safeTxt(row?.departamento_nombre),
    tramite_nombre: safeTxt(row?.tramite_nombre),
    asignado_nombre_completo: safeTxt(row?.asignado_nombre_completo),
  };
}

/* ============================================================================
   FILTROS / PIPELINE
   ========================================================================== */
function matchesRate(row) {
  if (State.activeRate === "todos") return true;
  return String(row.calificacion ?? "") === String(State.activeRate);
}

function matchesSearch(row) {
  const q = normText(State.search);
  if (!q) return true;

  const haystack = [
    row.folio,
    row.departamento_nombre,
    row.tramite_nombre,
    row.asignado_nombre_completo,
    row.contacto_telefono,
    formatRate(row.calificacion),
  ]
    .map(normText)
    .join(" ");

  return haystack.includes(q);
}

function applyPipeline() {
  State.filtered = State.rows.filter(
    (row) => matchesRate(row) && matchesSearch(row)
  );
  return State.filtered;
}

/* ============================================================================
   CONTADORES / LEYENDAS
   ========================================================================== */
function renderCounts() {
  const map = {
    todos: State.rows.length,
    excelente: State.rows.filter((r) => r.calificacion === 4).length,
    bueno: State.rows.filter((r) => r.calificacion === 3).length,
    regular: State.rows.filter((r) => r.calificacion === 2).length,
    malo: State.rows.filter((r) => r.calificacion === 1).length,
  };

  const bind = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `(${value})`;
  };

  bind("cnt-retro-todos", map.todos);
  bind("cnt-retro-excelente", map.excelente);
  bind("cnt-retro-bueno", map.bueno);
  bind("cnt-retro-regular", map.regular);
  bind("cnt-retro-malo", map.malo);

  updateFilterActiveLabel();
}

function updateLegendStatus() {
  const el = $(SEL.legendStatus);
  if (!el) return;

  if (State.activeRate === "todos") {
    el.textContent = "Todas las calificaciones";
    return;
  }

  el.textContent = formatRate(State.activeRate);
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
        <td colspan="6" class="is-empty-row">No se encontraron registros.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = paged
    .map((row) => {
      return `
        <tr class="retro-row" data-req-id="${escapeHtml(row.requerimiento_id ?? "")}">
          <td>${escapeHtml(row.folio)}</td>
          <td>${escapeHtml(row.departamento_nombre)}</td>
          <td>${escapeHtml(row.tramite_nombre)}</td>
          <td>${escapeHtml(row.asignado_nombre_completo)}</td>
          <td>${escapeHtml(formatPhone(row.contacto_telefono))}</td>
          <td>
            <span class="retro-badge ${rateBadgeClass(row.calificacion)}">
              ${escapeHtml(formatRate(row.calificacion))}
            </span>
          </td>
        </tr>
      `;
    })
    .join("");
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

  const btn = (page, label = page, active = false, disabled = false) => `
    <button
      type="button"
      class="hs-page ${active ? "is-active" : ""}"
      data-page="${page}"
      ${disabled ? "disabled" : ""}
    >${label}</button>
  `;

  const parts = [];
  parts.push(btn(State.currentPage - 1, "‹", false, State.currentPage === 1));

  for (let p = 1; p <= pages; p++) {
    parts.push(btn(p, p, p === State.currentPage, false));
  }

  parts.push(
    btn(State.currentPage + 1, "›", false, State.currentPage === pages)
  );

  pager.innerHTML = parts.join("");

  $$("button[data-page]", pager).forEach((b) => {
    b.addEventListener("click", () => {
      const page = Number(b.dataset.page || 1);
      if (!page || page < 1 || page > pages || page === State.currentPage) return;
      State.currentPage = page;
      renderTable(State.filtered);
      renderPager(State.filtered);
    });
  });
}

function setupRowClickDelegation() {
  const tbody = $(SEL.tableBody);
  if (!tbody) return;

  tbody.addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-req-id]");
    if (!tr) return;

    const reqId = Number(tr.dataset.reqId || 0);
    if (!reqId) return;

    // Ajusta la ruta si tu vista final usa otra URL
    window.location.href = `/VIEWS/requerimiento.php?id=${reqId}`;
  });
}

/* ============================================================================
   CHART
   ========================================================================== */
function buildMonthDonutData(rows) {
  const monthRows = rows.filter((r) => isCurrentMonth(getRowDate(r)));

  const counts = {
    Excelente: 0,
    Bueno: 0,
    Regular: 0,
    Malo: 0,
  };

  monthRows.forEach((row) => {
    const label = formatRate(row.calificacion);
    if (counts[label] != null) counts[label] += 1;
  });

  const data = Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .filter((x) => x.value > 0);

  const total = monthRows.length;

  return { total, data };
}

function drawDonutFromRows(rows) {
  const canvas = $(SEL.donutCanvas);
  const legendEl = $(SEL.donutLegend);
  if (!canvas || !legendEl) return;
  if (!isElementRenderable(canvas)) {
    log("Donut skip: canvas oculto o sin tamaño");
    return;
  }

  const donutAgg = buildMonthDonutData(rows);

  try {
    State.chartMonth?.destroy?.();
  } catch (_) {}

  try {
    State.chartMonth = new DonutChart(canvas, {
      data: donutAgg.data,
      total: donutAgg.total,
      legendEl,
      paletteMap: CONFIG.RATE_COLORS,
      showPercLabels: true,
    });

    // Ajuste del texto central
    if (State.chartMonth && typeof State.chartMonth._drawCenter === "function") {
      const originalDrawCenter = State.chartMonth._drawCenter.bind(State.chartMonth);
      State.chartMonth._drawCenter = (big) => originalDrawCenter(big, "Este mes");
      State.chartMonth.draw(true);
      State.chartMonth.renderLegend();
    }

    log("Donut render ok", donutAgg);
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
      onChange?.();
    }, 180)
  );
}

/* ============================================================================
   RENDER GENERAL
   ========================================================================== */
function applyPipelineAndRender() {
  const filtered = applyPipeline();

  const legendTotal = $(SEL.legendTotal);
  if (legendTotal) legendTotal.textContent = String(filtered.length);

  updateLegendStatus();
  renderTable(filtered);
  renderPager(filtered);
  drawDonutFromRows(filtered);
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
    setupRowClickDelegation();

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
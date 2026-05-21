"use strict";

import { Session } from "/PRI/JS/auth/session.js";

const CONFIG = {
  DEBUG_LOGS: true,
  PAGE_SIZE: 10,
};

const TAG = "[RED Home]";
const log = (...args) => CONFIG.DEBUG_LOGS && console.log(TAG, ...args);
const warn = (...args) => CONFIG.DEBUG_LOGS && console.warn(TAG, ...args);

const $ = (sel, root = document) => root.querySelector(sel);

const State = {
  session: null,
  universe: [],
  rows: [],
  search: "",
  page: 1,
  pageSize: CONFIG.PAGE_SIZE,
  counts: {
    afiliados: 0,
    simpatizantes: 0,
    promotores: 0,
  },
};

const SEL = {
  userName: "#red-user-name",
  search: "#red-search",
  tableBody: "#red-table-body",
  mobileList: "#red-mobile-list",
  pager: "#red-pager",
  metricAfiliados: "#metric-afiliados",
  metricSimpatizantes: "#metric-simpatizantes",
  metricPromotores: "#metric-promotores",
  btnExport: "#red-btn-export",
  btnAdd: "#red-btn-add",
};

const DUMMY_RED = [
  {
    id: 1,
    nombre: "Luis Enrique Mendez",
    domicilio: "Vicente Guerrero #4a",
    seccion: "1592",
    telefono: "3333333335",
    validez: true,
    tipo: "afiliado",
  },
  {
    id: 2,
    nombre: "Juan Pablo Garcia",
    domicilio: "La Bandera #16",
    seccion: "1592",
    telefono: "3333333334",
    validez: true,
    tipo: "simpatizante",
  },
  {
    id: 3,
    nombre: "Luis Enrique Mendez",
    domicilio: "Vicente Guerrero #4a",
    seccion: "1592",
    telefono: "3333333333",
    validez: true,
    tipo: "promotor",
  },
  {
    id: 4,
    nombre: "Juan Pablo Garcia",
    domicilio: "La Bandera #16",
    seccion: "1592",
    telefono: "3333333332",
    validez: true,
    tipo: "simpatizante",
  },
  {
    id: 5,
    nombre: "Luis Enrique Mendez",
    domicilio: "Vicente Guerrero #4a",
    seccion: "1592",
    telefono: "3333333331",
    validez: true,
    tipo: "afiliado",
  },
  {
    id: 6,
    nombre: "Juan Pablo Garcia",
    domicilio: "La Bandera #16",
    seccion: "1592",
    telefono: "3333333330",
    validez: true,
    tipo: "promotor",
  },
  {
    id: 7,
    nombre: "Luis Enrique Mendez",
    domicilio: "Vicente Guerrero #4a",
    seccion: "1592",
    telefono: "3333333336",
    validez: true,
    tipo: "afiliado",
  },
  {
    id: 8,
    nombre: "Juan Pablo Garcia",
    domicilio: "La Bandera #16",
    seccion: "1592",
    telefono: "3333333337",
    validez: true,
    tipo: "simpatizante",
  },
  {
    id: 9,
    nombre: "Luis Enrique Mendez",
    domicilio: "Vicente Guerrero #4a",
    seccion: "1592",
    telefono: "3333333338",
    validez: true,
    tipo: "afiliado",
  },
  {
    id: 10,
    nombre: "Juan Pablo Garcia",
    domicilio: "La Bandera #16",
    seccion: "1592",
    telefono: "3333333339",
    validez: true,
    tipo: "simpatizante",
  },
  {
    id: 11,
    nombre: "María Fernanda López",
    domicilio: "Hidalgo #120",
    seccion: "1593",
    telefono: "3333333340",
    validez: false,
    tipo: "promotor",
  },
  {
    id: 12,
    nombre: "Carlos Alberto Hernández",
    domicilio: "Morelos #45",
    seccion: "1594",
    telefono: "3333333341",
    validez: true,
    tipo: "afiliado",
  },
];

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function readSession() {
  let session = null;

  try {
    session = Session?.get?.() || null;
  } catch (error) {
    warn("No se pudo leer Session.get()", error);
  }

  if (!session) session = readCookiePayload();

  State.session = session || null;
  log("Sesión detectada:", State.session);

  return State.session;
}

function hydrateUser() {
  const session = State.session || {};
  const fullName =
    [session.nombre, session.apellidos].filter(Boolean).join(" ") ||
    session.username ||
    session.usuario ||
    "Usuario RED";

  const userNameEl = $(SEL.userName);
  if (userNameEl) userNameEl.textContent = fullName;
}

function loadDummyData() {
  State.universe = DUMMY_RED.map((item) => ({ ...item }));
  State.rows = [...State.universe];

  updateCounts();
  applyFilters();
}

function updateCounts() {
  const counts = {
    afiliados: 0,
    simpatizantes: 0,
    promotores: 0,
  };

  State.universe.forEach((item) => {
    const tipo = normalizeText(item.tipo);

    if (tipo === "afiliado") counts.afiliados += 1;
    if (tipo === "simpatizante") counts.simpatizantes += 1;
    if (tipo === "promotor") counts.promotores += 1;
  });

  State.counts = counts;

  const afiliadosEl = $(SEL.metricAfiliados);
  const simpatizantesEl = $(SEL.metricSimpatizantes);
  const promotoresEl = $(SEL.metricPromotores);

  if (afiliadosEl) afiliadosEl.textContent = counts.afiliados.toLocaleString("es-MX");
  if (simpatizantesEl) simpatizantesEl.textContent = counts.simpatizantes.toLocaleString("es-MX");
  if (promotoresEl) promotoresEl.textContent = counts.promotores.toLocaleString("es-MX");
}

function applyFilters() {
  const q = normalizeText(State.search);

  State.rows = State.universe.filter((item) => {
    if (!q) return true;

    const haystack = normalizeText([
      item.nombre,
      item.domicilio,
      item.seccion,
      item.telefono,
      item.tipo,
      item.validez ? "valido validado verificado" : "pendiente invalido",
    ].join(" "));

    return haystack.includes(q);
  });

  const maxPage = getMaxPage();
  if (State.page > maxPage) State.page = maxPage || 1;

  render();
}

function getMaxPage() {
  return Math.max(1, Math.ceil(State.rows.length / State.pageSize));
}

function getPageRows() {
  const start = (State.page - 1) * State.pageSize;
  return State.rows.slice(start, start + State.pageSize);
}

function render() {
  renderTable();
  renderMobileCards();
  renderPager();
}

function renderTable() {
  const tbody = $(SEL.tableBody);
  if (!tbody) return;

  const rows = getPageRows();

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="red-empty">No se encontraron registros.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((item) => {
    const validClass = item.validez ? "red-valid" : "red-valid is-missing";
    const validText = item.validez ? "✓" : "—";

    return `
      <tr data-id="${escapeHTML(item.id)}">
        <td class="td-name">${escapeHTML(safeText(item.nombre))}</td>
        <td>${escapeHTML(safeText(item.domicilio))}</td>
        <td>${escapeHTML(safeText(item.seccion))}</td>
        <td>${escapeHTML(safeText(item.telefono))}</td>
        <td>
          <span class="${validClass}" title="${item.validez ? "Registro válido" : "Registro pendiente"}">
            ${validText}
          </span>
        </td>
        <td>
          <button type="button" class="red-open" data-action="open" data-id="${escapeHTML(item.id)}">
            Abrir
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderMobileCards() {
  const host = $(SEL.mobileList);
  if (!host) return;

  const rows = getPageRows();

  if (!rows.length) {
    host.innerHTML = `<div class="red-empty">No se encontraron registros.</div>`;
    return;
  }

  host.innerHTML = rows.map((item) => {
    const validClass = item.validez ? "red-valid" : "red-valid is-missing";
    const validText = item.validez ? "✓" : "—";

    return `
      <article class="red-person-card" data-id="${escapeHTML(item.id)}">
        <h3>${escapeHTML(safeText(item.nombre))}</h3>

        <div class="red-person-meta">
          <span><strong>Domicilio:</strong> ${escapeHTML(safeText(item.domicilio))}</span>
          <span><strong>Sección:</strong> ${escapeHTML(safeText(item.seccion))}</span>
          <span><strong>Teléfono:</strong> ${escapeHTML(safeText(item.telefono))}</span>
          <span><strong>Tipo:</strong> ${escapeHTML(safeText(item.tipo))}</span>
        </div>

        <footer>
          <span class="${validClass}" title="${item.validez ? "Registro válido" : "Registro pendiente"}">
            ${validText}
          </span>

          <button type="button" class="red-open" data-action="open" data-id="${escapeHTML(item.id)}">
            Abrir
          </button>
        </footer>
      </article>
    `;
  }).join("");
}

function renderPager() {
  const pager = $(SEL.pager);
  if (!pager) return;

  const total = State.rows.length;
  const maxPage = getMaxPage();

  if (!total) {
    pager.innerHTML = "";
    return;
  }

  const pages = buildPageList(State.page, maxPage);

  pager.innerHTML = `
    <button type="button" data-page="${State.page - 1}" ${State.page <= 1 ? "disabled" : ""}>‹</button>

    ${pages.map((page) => `
      <button
        type="button"
        class="page-number ${page === State.page ? "is-active" : ""}"
        data-page="${page}">
        ${page}
      </button>
    `).join("")}

    <button type="button" data-page="${State.page + 1}" ${State.page >= maxPage ? "disabled" : ""}>›</button>

    <span>Pág. ${State.page} de ${maxPage}</span>

    <input id="red-page-jump" type="number" min="1" max="${maxPage}" aria-label="Ir a página">
    <button type="button" data-action="jump">Ir</button>
  `;
}

function buildPageList(current, max) {
  const set = new Set([1, current - 1, current, current + 1, max]);
  return Array.from(set)
    .filter((page) => page >= 1 && page <= max)
    .sort((a, b) => a - b);
}

function goToPage(page) {
  const maxPage = getMaxPage();
  const next = Math.min(Math.max(Number(page) || 1, 1), maxPage);

  if (next === State.page) return;

  State.page = next;
  render();
}

function openRecord(id) {
  const item = State.universe.find((row) => Number(row.id) === Number(id));

  if (!item) {
    warn("No se encontró registro:", id);
    return;
  }

  log("Abrir registro:", item);

  // Temporal dummy.
  // Después aquí podemos abrir drawer/modal o redirigir:
  // window.location.href = `/PRI/Views/redDetalle.php?id=${encodeURIComponent(id)}`;
  alert(`Abrir registro:\n${item.nombre}`);
}

function exportDummyCSV() {
  const rows = State.rows;

  const headers = ["ID", "Nombre", "Domicilio", "Seccion", "Telefono", "Tipo", "Validez"];

  const body = rows.map((item) => [
    item.id,
    item.nombre,
    item.domicilio,
    item.seccion,
    item.telefono,
    item.tipo,
    item.validez ? "Valido" : "Pendiente",
  ]);

  const csv = [headers, ...body]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `red_export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function bindEvents() {
  const search = $(SEL.search);
  search?.addEventListener("input", () => {
    State.search = search.value;
    State.page = 1;
    applyFilters();
  });

  document.addEventListener("click", (event) => {
    const openBtn = event.target.closest("[data-action='open']");
    if (openBtn) {
      openRecord(openBtn.dataset.id);
      return;
    }

    const pagerBtn = event.target.closest("#red-pager button");
    if (pagerBtn) {
      const action = pagerBtn.dataset.action;

      if (action === "jump") {
        const input = $("#red-page-jump");
        goToPage(input?.value);
        return;
      }

      if (pagerBtn.dataset.page) {
        goToPage(pagerBtn.dataset.page);
      }
    }
  });

  $(SEL.btnExport)?.addEventListener("click", exportDummyCSV);

  $(SEL.btnAdd)?.addEventListener("click", () => {
    log("Nuevo registro");
    alert("Aquí abriremos el modal/drawer para crear un registro.");
  });
}

function init() {
  readSession();
  hydrateUser();
  bindEvents();
  loadDummyData();

  log("Home RED inicializado");
}

document.addEventListener("DOMContentLoaded", init);
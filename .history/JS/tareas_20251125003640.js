// /JS/tareas.js – Tablero de tareas (kanban) con API real
"use strict";

/* ==========================================================================
   Imports (módulos compartidos)
   ========================================================================== */

import { Session } from "./auth/session.js";
import { postJSON } from "./api/http.js";
import { searchEmpleados } from "./api/usuarios.js";

/* ==========================================================================
   Config
   ========================================================================== */

const KB = {
  DEBUG: true,

  CURRENT_USER_ID: null,

  STATUS: {
    TODO: 1,
    PROCESO: 2,
    REVISAR: 3,
    HECHO: 4,
    PAUSA: 5,
  },
};

// Departamentos especiales
const PRES_DEPT_IDS = [6]; // Presidencia (no mostrar en filtro)

/** Info del usuario actual (viewer) */
const Viewer = {
  deptId: null,
  roles: [],
  isAdmin: false,
  isPres: false,
};

// Host base
const API_HOST =
  "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net";

const API_TAREAS = {
  LIST: `${API_HOST}/db/WEB/ixtla01_c_tarea_proceso.php`,
  UPDATE: `${API_HOST}/db/WEB/ixtla01_u_tarea_proceso.php`,
};

const API_DEPTS = {
  LIST: `${API_HOST}/db/WEB/ixtla01_c_departamento.php`,
};

const API_PROCESOS = {
  LIST: `${API_HOST}/db/WEB/ixtla01_c_proceso_requerimiento.php`,
};

const API_TRAMITES = {
  LIST: `${API_HOST}/DB/WEB/ixtla01_c_tramite.php`,
};

const log = (...a) => KB.DEBUG && console.log("[KB]", ...a);
const warn = (...a) => KB.DEBUG && console.warn("[KB]", ...a);

/* ==========================================================================
   Helpers
   ========================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function formatDateMX(str) {
  if (!str) return "—";
  const d = new Date(String(str).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function diffDays(startStr) {
  if (!startStr) return null;
  const start = new Date(String(startStr).replace(" ", "T"));
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  const ms = now.getTime() - start.getTime();
  const days = Math.floor(ms / 86400000);
  return days < 0 ? 0 : days;
}

function parseDateSafe(str) {
  if (!str) return null;
  const d = new Date(String(str).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Devuelve true si la fecha está dentro de la semana actual
 * (lunes 00:00 a lunes siguiente 00:00).
 */
function isInCurrentWeek(dateStr) {
  const d = parseDateSafe(dateStr);
  if (!d) return false;

  const now = new Date();

  // 0=domingo, 1=lunes, ...
  const nowDay = now.getDay();
  const diffToMonday = nowDay === 0 ? -6 : 1 - nowDay;

  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diffToMonday);

  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

  return d >= monday && d < nextMonday;
}

function calcAgeChip(task) {
  const base = task.fecha_inicio || task.created_at;
  const d = diffDays(base);
  if (d == null) return null;

  const realDays = d < 0 ? 0 : d;

  let paletteIndex;
  if (realDays >= 10) paletteIndex = 10;
  else if (realDays === 0) paletteIndex = 1;
  else paletteIndex = realDays;

  let display;
  if (realDays >= 100) display = "99+";
  else display = String(Math.min(realDays, 99));

  return {
    classIndex: paletteIndex,
    display,
    realDays,
  };
}

/* ==========================================================================
   State
   ========================================================================== */

const State = {
  tasks: [],
  selectedId: null,
  filters: {
    mine: true,      // "Solo mis tareas"
    search: "",
    recent: false,   // "Recientes" (semana actual)
    tramiteId: null, // 👈 filtro por trámite
    departamentos: new Set(),
    empleados: new Set(),
  },

  // Índices
  empleadosIndex: new Map(),      // id_empleado → empleado
  departamentosIndex: new Map(),  // id_depto → depto
  procesosIndex: new Map(),       // id_proceso → proceso (para título)
  tramitesIndex: new Map(),       // id_tramite → tramite (para filtro)
};

const COL_IDS = {
  [KB.STATUS.TODO]: "#kb-col-1",
  [KB.STATUS.PROCESO]: "#kb-col-2",
  [KB.STATUS.REVISAR]: "#kb-col-3",
  [KB.STATUS.HECHO]: "#kb-col-4",
  [KB.STATUS.PAUSA]: "#kb-col-5",
};

const CNT_IDS = {
  [KB.STATUS.TODO]: "#kb-cnt-1",
  [KB.STATUS.PROCESO]: "#kb-cnt-2",
  [KB.STATUS.REVISAR]: "#kb-cnt-3",
  [KB.STATUS.HECHO]: "#kb-cnt-4",
  [KB.STATUS.PAUSA]: "#kb-cnt-5",
};

let dragging = false;

const MultiFilters = {
  departamentos: null,
  empleados: null,
};

/* ==========================================================================
   Normalización de datos desde API
   ========================================================================== */

function mapRawTask(raw) {
  const id = Number(raw.id);

  const status =
    raw.status != null
      ? Number(raw.status)
      : raw.estatus != null
      ? Number(raw.estatus)
      : KB.STATUS.TODO;

  const proceso_id =
    raw.proceso_id != null ? Number(raw.proceso_id) : raw.proceso || null;

  // 👇 aquí intento cubrir posibles nombres de campo para trámite
  const tramite_id =
    raw.tramite_id != null
      ? Number(raw.tramite_id)
      : raw.tramite != null
      ? Number(raw.tramite)
      : raw.tramiteId != null
      ? Number(raw.tramiteId)
      : null;

  const asignado_a =
    raw.asignado_a != null
      ? Number(raw.asignado_a)
      : raw.empleado_id != null
      ? Number(raw.empleado_id)
      : null;

  const asignado_nombre = raw.asignado_nombre || raw.empleado_nombre || "";
  const asignado_apellidos =
    raw.asignado_apellidos || raw.empleado_apellidos || "";

  const asignado_display =
    raw.asignado_display ||
    [asignado_nombre, asignado_apellidos].filter(Boolean).join(" ") ||
    "—";

  const folio =
    raw.folio ||
    raw.requerimiento_folio ||
    `REQ-${String(15000 + (id || 0)).padStart(9, "0")}`;

  const proceso_titulo =
    raw.proceso_titulo ||
    raw.proceso_nombre ||
    (proceso_id ? `Proceso ${proceso_id}` : "Proceso");

  const tramite_nombre = raw.tramite_nombre || null;

  return {
    id,
    proceso_id,
    tramite_id,
    tramite_nombre,
    asignado_a,
    asignado_display,
    titulo: raw.titulo || raw.titulo_tarea || "Tarea sin título",
    descripcion: raw.descripcion || raw.detalle || "",
    esfuerzo:
      raw.esfuerzo != null
        ? Number(raw.esfuerzo)
        : raw.horas != null
        ? Number(raw.horas)
        : null,
    fecha_inicio: raw.fecha_inicio || raw.fecha_inicio_tarea || null,
    fecha_fin: raw.fecha_fin || raw.fecha_fin_tarea || null,
    status,
    created_at: raw.created_at || null,
    created_by: raw.created_by != null ? Number(raw.created_by) : null,
    created_by_nombre: raw.created_by_nombre || raw.creado_por_nombre || "—",
    autoriza_nombre: raw.autoriza_nombre || raw.autorizado_por || "—",
    folio,
    proceso_titulo,
  };
}

/* ==========================================================================
   Fetch de datos (TAREAS, EMPLEADOS, DEPARTAMENTOS, PROCESOS, TRÁMITES)
   ========================================================================== */

async function fetchTareasFromApi() {
  const payload = {
    page: 1,
    page_size: 200,
  };

  try {
    log("TAREAS LIST →", API_TAREAS.LIST, payload);
    const json = await postJSON(API_TAREAS.LIST, payload);
    log("TAREAS LIST respuesta cruda:", json);

    if (!json || !Array.isArray(json.data)) {
      warn("Respuesta inesperada de TAREAS LIST", json);
      return [];
    }
    const mapped = json.data.map(mapRawTask);
    log("TAREAS mapeadas", mapped.length, mapped);
    return mapped;
  } catch (e) {
    console.error("[KB] Error al listar tareas:", e);
    return [];
  }
}

async function fetchDepartamentos() {
  try {
    const payload = {
      all: true,
      page: 1,
      page_size: 100,
    };
    log("DEPTS LIST →", API_DEPTS.LIST, payload);
    const json = await postJSON(API_DEPTS.LIST, payload);
    log("DEPTS LIST respuesta cruda:", json);

    if (!json || !Array.isArray(json.data)) {
      warn("Respuesta inesperada DEPTS LIST", json);
      return [];
    }
    const out = json.data.map((d) => ({
      id: Number(d.id),
      nombre: d.nombre || `Depto ${d.id}`,
      status: d.status != null ? Number(d.status) : null,
    }));
    log("Departamentos normalizados:", out.length, out);
    return out;
  } catch (e) {
    console.error("[KB] Error al listar departamentos:", e);
    return [];
  }
}

async function fetchEmpleadosForFilters() {
  try {
    const payload = {
      status_empleado: 1,
      status_cuenta: 1,
      page: 1,
      page_size: 500,
    };
    log("[Empleados] payload búsqueda:", payload);

    const res = await searchEmpleados(payload);
    log("[Empleados] respuesta searchEmpleados:", res);

    const data = Array.isArray(res?.items) ? res.items : [];

    log("Empleados para filtros (sin jerarquía aún):", data.length, data);
    return data;
  } catch (e) {
    console.error("[KB] Error al buscar empleados:", e);
    return [];
  }
}

async function fetchProcesosCatalog() {
  try {
    const payload = {
      status: 1,
      page: 1,
      page_size: 200,
    };
    log("PROCESOS LIST →", API_PROCESOS.LIST, payload);
    const json = await postJSON(API_PROCESOS.LIST, payload);
    log("PROCESOS LIST respuesta cruda:", json);

    if (!json || !Array.isArray(json.data)) {
      warn("Respuesta inesperada PROCESOS LIST", json);
      return [];
    }

    const out = json.data.map((p) => ({
      id: Number(p.id),
      descripcion: p.descripcion || "",
      requerimiento_id:
        p.requerimiento_id != null ? Number(p.requerimiento_id) : null,
      status: p.status != null ? Number(p.status) : null,
    }));

    log("Procesos normalizados:", out.length, out);
    return out;
  } catch (e) {
    console.error("[KB] Error al listar procesos:", e);
    return [];
  }
}

async function fetchTramitesCatalog() {
  try {
    const payload = {
      estatus: 1,
      all: true,
      page: 1,
      page_size: 200,
    };
    log("TRÁMITES LIST →", API_TRAMITES.LIST, payload);
    const json = await postJSON(API_TRAMITES.LIST, payload);
    log("TRÁMITES LIST respuesta cruda:", json);

    if (!json || !Array.isArray(json.data)) {
      warn("Respuesta inesperada TRÁMITES LIST", json);
      return [];
    }

    const out = json.data.map((t) => ({
      id: Number(t.id),
      nombre: t.nombre || `Trámite ${t.id}`,
      departamento_id:
        t.departamento_id != null ? Number(t.departamento_id) : null,
      estatus: t.estatus != null ? Number(t.estatus) : null,
    }));

    log("Trámites normalizados:", out.length, out);
    return out;
  } catch (e) {
    console.error("[KB] Error al listar trámites:", e);
    return [];
  }
}

/* ==========================================================================
   Filtros / combos
   ========================================================================== */

function passesFilters(task) {
  // Solo mis tareas
  if (
    State.filters.mine &&
    KB.CURRENT_USER_ID != null &&
    task.asignado_a !== KB.CURRENT_USER_ID
  ) {
    return false;
  }

  // Buscar por folio, proceso o id
  const q = State.filters.search.trim().toLowerCase();
  if (q) {
    const hay =
      (task.folio || "").toLowerCase().includes(q) ||
      (task.proceso_titulo || "").toLowerCase().includes(q) ||
      String(task.id).includes(q);
    if (!hay) return false;
  }

  // Filtro por trámite (select toolbar)
  if (State.filters.tramiteId != null) {
    if (!task.tramite_id || task.tramite_id !== State.filters.tramiteId) {
      return false;
    }
  }

  // Recientes (semana actual)
  if (State.filters.recent) {
    const baseDate = task.fecha_inicio || task.created_at;
    if (!isInCurrentWeek(baseDate)) {
      return false;
    }
  }

  // Filtro por empleados
  if (State.filters.empleados.size) {
    if (!task.asignado_a || !State.filters.empleados.has(task.asignado_a)) {
      return false;
    }
  }

  // Filtro por departamentos (según departamento del empleado asignado)
  if (State.filters.departamentos.size) {
    const emp = State.empleadosIndex.get(task.asignado_a);
    const deptId = emp?.departamento_id || null;
    if (!deptId || !State.filters.departamentos.has(deptId)) {
      return false;
    }
  }

  return true;
}

/* --------------------------------------------------------------------------
   Multi select (Departamentos / Empleados)
   -------------------------------------------------------------------------- */

function createMultiFilter(fieldEl, key, options) {
  if (!fieldEl) return;

  const trigger = fieldEl.querySelector(".kb-multi-trigger");
  const placeholderEl = fieldEl.querySelector(".kb-multi-placeholder");
  const summaryEl = fieldEl.querySelector(".kb-multi-summary");
  const menu = fieldEl.querySelector(".kb-multi-menu");
  const searchInput = fieldEl.querySelector(".kb-multi-search-input");
  const list = fieldEl.querySelector(".kb-multi-options");

  const stateSet =
    State.filters[key] || (State.filters[key] = new Set());

  function renderOptions() {
    if (!list) return;
    list.innerHTML = "";
    options.forEach((opt) => {
      const li = document.createElement("li");
      li.className = "kb-multi-option";
      li.dataset.value = String(opt.value);
      li.textContent = opt.label;
      if (stateSet.has(opt.value)) {
        li.classList.add("is-selected");
      }
      li.addEventListener("click", () => toggleValue(opt.value));
      list.appendChild(li);
    });
  }

  function updateSummary() {
    const selected = options.filter((opt) => stateSet.has(opt.value));
    if (!selected.length) {
      if (placeholderEl) placeholderEl.hidden = false;
      if (summaryEl) {
        summaryEl.hidden = true;
        summaryEl.textContent = "";
      }
    } else {
      if (placeholderEl) placeholderEl.hidden = true;
      if (summaryEl) {
        summaryEl.hidden = false;
        if (selected.length === 1) {
          summaryEl.textContent = selected[0].label;
        } else {
          summaryEl.textContent = `${selected[0].label} +${
            selected.length - 1
          }`;
        }
      }
    }
  }

  function toggleValue(value) {
    if (stateSet.has(value)) {
      stateSet.delete(value);
    } else {
      stateSet.add(value);
    }

    if (list) {
      const li = list.querySelector(`.kb-multi-option[data-value="${value}"]`);
      if (li) li.classList.toggle("is-selected", stateSet.has(value));
    }

    updateSummary();
    renderBoard();
  }

  function openMenu() {
    if (!menu || !trigger) return;
    trigger.setAttribute("aria-expanded", "true");
    menu.hidden = false;
    fieldEl.classList.add("is-open");
  }

  function closeMenu() {
    if (!menu || !trigger) return;
    trigger.setAttribute("aria-expanded", "false");
    menu.hidden = true;
    fieldEl.classList.remove("is-open");
  }

  function toggleMenu() {
    const expanded = trigger.getAttribute("aria-expanded") === "true";
    if (expanded) {
      closeMenu();
    } else {
      openMenu();
      if (searchInput) searchInput.focus();
    }
  }

  if (trigger) {
    trigger.addEventListener("click", (ev) => {
      ev.stopPropagation();
      toggleMenu();
    });
  }

  if (searchInput && list) {
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.trim().toLowerCase();
      const items = list.querySelectorAll(".kb-multi-option");
      items.forEach((li) => {
        const label = (li.textContent || "").toLowerCase();
        li.hidden = q && !label.includes(q);
      });
    });
  }

  document.addEventListener("click", (ev) => {
    if (!fieldEl.contains(ev.target)) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      closeMenu();
    }
  });

  renderOptions();
  updateSummary();

  MultiFilters[key] = {
    clear() {
      stateSet.clear();
      updateSummary();
      const items = list?.querySelectorAll(".kb-multi-option") || [];
      items.forEach((li) => li.classList.remove("is-selected"));
    },
  };
}

function setupSidebarFilters() {
  const btnClear = $("#kb-sidebar-clear");
  if (btnClear) {
    btnClear.addEventListener("click", () => {
      State.filters.departamentos.clear();
      State.filters.empleados.clear();

      if (MultiFilters.departamentos) MultiFilters.departamentos.clear();
      if (MultiFilters.empleados) MultiFilters.empleados.clear();

      renderBoard();
    });
  }
}

/* ==========================================================================
   Render de cards
   ========================================================================== */

function createCard(task) {
  const age = calcAgeChip(task);

  const art = document.createElement("article");
  art.className = "kb-card";
  art.dataset.id = String(task.id);

  const main = document.createElement("div");
  main.className = "kb-task-main";

  const titleLine = document.createElement("div");
  titleLine.className = "kb-task-title-line";

  const spProceso = document.createElement("span");
  spProceso.className = "kb-task-proceso";
  spProceso.textContent = task.proceso_titulo;

  const spSep = document.createElement("span");
  spSep.className = "kb-task-sep";
  spSep.textContent = "/";

  const spId = document.createElement("span");
  spId.className = "kb-task-id";
  spId.textContent = `T-${task.id}`;

  titleLine.append(spProceso, spSep, spId);

  const lines = document.createElement("div");
  lines.className = "kb-task-lines";

  const lineFolio = document.createElement("div");
  lineFolio.className = "kb-task-line";
  lineFolio.innerHTML = `<span class="kb-task-label">Folio:</span> <span class="kb-task-value kb-task-folio">${task.folio}</span>`;

  const lineAsig = document.createElement("div");
  lineAsig.className = "kb-task-line";
  lineAsig.innerHTML = `<span class="kb-task-label">Asignado a:</span> <span class="kb-task-value kb-task-asignado">${task.asignado_display}</span>`;

  const lineFecha = document.createElement("div");
  lineFecha.className = "kb-task-line";
  lineFecha.innerHTML = `<span class="kb-task-label">Fecha de proceso:</span> <span class="kb-task-value">${formatDateMX(
    task.fecha_inicio || task.created_at
  )}</span>`;

  lines.append(lineFolio, lineAsig, lineFecha);
  main.append(titleLine, lines);
  art.appendChild(main);

  if (task.status !== KB.STATUS.HECHO && age) {
    const chip = document.createElement("div");
    chip.className = `kb-age-chip kb-age-${age.classIndex}`;
    chip.textContent = String(age.display);
    chip.title = `${age.realDays} día${
      age.realDays === 1 ? "" : "s"
    } en proceso`;
    art.appendChild(chip);
  }

  art.addEventListener("click", () => {
    if (dragging) return;
    openDetails(task.id);
  });

  return art;
}

function renderBoard() {
  Object.values(COL_IDS).forEach((sel) => {
    const col = $(sel);
    if (col) col.innerHTML = "";
  });
  Object.entries(CNT_IDS).forEach(([, sel]) => {
    const lbl = $(sel);
    if (lbl) lbl.textContent = "(0)";
  });

  for (const task of State.tasks) {
    if (!passesFilters(task)) continue;
    const colSel = COL_IDS[task.status];
    const col = colSel ? $(colSel) : null;
    if (!col) continue;

    const card = createCard(task);
    col.appendChild(card);

    const cntSel = CNT_IDS[task.status];
    const cntEl = cntSel ? $(cntSel) : null;
    if (cntEl) {
      const current =
        Number((cntEl.textContent || "").replace(/[()]/g, "")) || 0;
      cntEl.textContent = `(${current + 1})`;
    }
  }

  highlightSelected();
}

/* ==========================================================================
   Drawer
   ========================================================================== */

function getTaskById(id) {
  return State.tasks.find((t) => String(t.id) === String(id));
}

function highlightSelected() {
  const cards = $$(".kb-card");
  cards.forEach((c) => c.classList.remove("is-selected"));
  if (!State.selectedId) return;
  const sel = $(`.kb-card[data-id="${State.selectedId}"]`);
  if (sel) sel.classList.add("is-selected");
}

function fillDetails(task) {
  $("#kb-d-folio").textContent = task.folio || "—";
  $("#kb-d-proceso").textContent = task.proceso_titulo || "—";
  $("#kb-d-tarea").textContent = task.titulo || "—";
  $("#kb-d-asignado").textContent = task.asignado_display || "—";
  $("#kb-d-esfuerzo").textContent =
    task.esfuerzo != null ? `${task.esfuerzo} h` : "—";
  $("#kb-d-desc").textContent = task.descripcion || "—";
  $("#kb-d-creado-por").textContent = task.created_by_nombre || "—";
  $("#kb-d-autoriza").textContent = task.autoriza_nombre || "—";

  const evidWrap = $("#kb-d-evidencias");
  if (evidWrap) {
    evidWrap.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const ph = document.createElement("div");
      ph.className = "kb-evid-placeholder";
      evidWrap.appendChild(ph);
    }
  }
}

function openDetails(id) {
  const task = getTaskById(id);
  if (!task) return;
  State.selectedId = task.id;

  fillDetails(task);
  highlightSelected();

  $("#kb-d-empty").hidden = true;
  $("#kb-d-body").hidden = false;

  $("#kb-details").classList.add("is-open");
  $("#kb-details").setAttribute("aria-hidden", "false");
  $("#kb-d-overlay").classList.add("is-open");
  $("#kb-d-overlay").hidden = false;
}

function closeDetails() {
  State.selectedId = null;
  highlightSelected();

  $("#kb-details").classList.remove("is-open");
  $("#kb-details").setAttribute("aria-hidden", "true");
  $("#kb-d-overlay").classList.remove("is-open");
  $("#kb-d-overlay").hidden = true;
}

/* ==========================================================================
   Filtro por Trámite (select en la toolbar)
   ========================================================================== */

function setupTramiteFilter() {
  const sel = $("#kb-filter-proceso"); // mismo select, ahora es Trámite
  if (!sel) {
    log("No encontré #kb-filter-proceso en el DOM");
    return;
  }

  // Dejar sólo la opción "Todos" (value="")
  sel.querySelectorAll("option:not([value=''])").forEach((opt) => opt.remove());

  const options = [];
  State.tramitesIndex.forEach((tram, id) => {
    if (tram.estatus != null && Number(tram.estatus) !== 1) return;
    const label = tram.nombre || `Trámite ${id}`;
    options.push({ id, label });
  });

  options.sort((a, b) =>
    a.label.localeCompare(b.label, "es", { sensitivity: "base" })
  );

  for (const opt of options) {
    const o = document.createElement("option");
    o.value = String(opt.id);
    o.textContent = opt.label;
    sel.appendChild(o);
  }

  log("Filtro Trámite – opciones cargadas:", options);

  sel.addEventListener("change", () => {
    const val = sel.value;
    State.filters.tramiteId = val ? Number(val) : null;
    log("Filtro Trámite →", State.filters.tramiteId);
    renderBoard();
  });
}

/* ==========================================================================
   Toolbar
   ========================================================================== */

function setupToolbar() {
  const chipMine = $('.kb-chip[data-filter="mine"]');
  const chipRecent = $('.kb-chip[data-filter="recent"]');
  const inputSearch = $("#kb-filter-search");
  const btnClear = $("#kb-filter-clear");

  if (chipMine) {
    chipMine.classList.toggle("is-active", State.filters.mine);
    chipMine.addEventListener("click", () => {
      State.filters.mine = !State.filters.mine;
      chipMine.classList.toggle("is-active", State.filters.mine);
      log("Filtro 'Solo mis tareas' →", State.filters.mine);
      renderBoard();
    });
  }

  if (chipRecent) {
    chipRecent.classList.toggle("is-active", State.filters.recent);
    chipRecent.addEventListener("click", () => {
      State.filters.recent = !State.filters.recent;
      chipRecent.classList.toggle("is-active", State.filters.recent);
      log("Filtro 'Recientes (semana actual)' →", State.filters.recent);
      renderBoard();
    });
  }

  if (inputSearch) {
    inputSearch.addEventListener("input", () => {
      State.filters.search = inputSearch.value || "";
      log("Filtro search →", State.filters.search);
      renderBoard();
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", () => {
      State.filters.mine = false;
      State.filters.search = "";
      State.filters.recent = false;
      State.filters.tramiteId = null;

      if (chipMine) chipMine.classList.remove("is-active");
      if (chipRecent) chipRecent.classList.remove("is-active");
      if (inputSearch) inputSearch.value = "";

      const selectTramite = $("#kb-filter-proceso");
      if (selectTramite) selectTramite.value = "";

      log("Filtros rápidos limpiados");
      renderBoard();
    });
  }
}

/* ==========================================================================
   Drag & drop
   ========================================================================== */

async function persistTaskStatus(task, newStatus) {
  const payload = {
    id: task.id,
    status: newStatus,
  };

  try {
    log("TAREA UPDATE status →", API_TAREAS.UPDATE, payload);
    const res = await postJSON(API_TAREAS.UPDATE, payload);
    log("Respuesta UPDATE tarea:", res);
  } catch (e) {
    console.error("[KB] Error al actualizar status de tarea:", e);
  }
}

function setupDragAndDrop() {
  const lists = $$(".kb-list");
  if (!window.Sortable || !lists.length) {
    warn("SortableJS no disponible o sin listas");
    return;
  }

  lists.forEach((list) => {
    new Sortable(list, {
      group: "kb-tasks",
      animation: 150,
      ghostClass: "kb-card-ghost",
      dragClass: "kb-card-drag",
      onStart() {
        dragging = true;
      },
      async onEnd(evt) {
        setTimeout(() => {
          dragging = false;
        }, 0);

        const itemEl = evt.item;
        const id = itemEl.dataset.id;
        const task = getTaskById(id);
        if (!task) return;

        const col = evt.to.closest(".kb-col");
        if (!col) return;
        const newStatus = Number(col.dataset.status);
        if (!newStatus || newStatus === task.status) return;

        const oldStatus = task.status;
        task.status = newStatus;
        log("DragEnd → tarea", task.id, "de", oldStatus, "a", newStatus);

        renderBoard();
        if (State.selectedId === task.id) {
          highlightSelected();
        }

        await persistTaskStatus(task, newStatus);
      },
    });
  });
}

/* ==========================================================================
   Init
   ========================================================================== */

function hydrateViewerFromSession() {
  try {
    const ids = Session?.getIds ? Session.getIds() : null;
    KB.CURRENT_USER_ID = ids?.id_empleado || null;
    log("Session.getIds():", ids, "CURRENT_USER_ID:", KB.CURRENT_USER_ID);
  } catch (e) {
    console.error("[KB] Error leyendo Session.getIds():", e);
  }

  let full = null;
  try {
    full = Session?.get ? Session.get() : null;
  } catch (e) {
    warn("[KB] Session.get() no disponible o falló:", e);
  }
  log("Session.get() completo:", full);

  const deptId =
    full?.empleado?.departamento_id ?? full?.departamento_id ?? null;

  const rolesRaw = full?.roles ?? full?.user?.roles ?? [];
  const roles = Array.isArray(rolesRaw)
    ? rolesRaw
    : String(rolesRaw || "")
        .split(/[,\s]+/)
        .map((r) => r.trim())
        .filter(Boolean);

  Viewer.deptId = deptId != null ? Number(deptId) : null;
  Viewer.roles = roles;
  Viewer.isAdmin = roles.includes("ADMIN");
  Viewer.isPres =
    Viewer.deptId != null && PRES_DEPT_IDS.includes(Viewer.deptId);

  log("Viewer info:", {
    deptId: Viewer.deptId,
    roles: Viewer.roles,
    isAdmin: Viewer.isAdmin,
    isPres: Viewer.isPres,
  });
}

async function init() {
  hydrateViewerFromSession();

  const [empleados, depts, procesos, tramites, tareas] = await Promise.all([
    fetchEmpleadosForFilters(),
    fetchDepartamentos(),
    fetchProcesosCatalog(),
    fetchTramitesCatalog(),
    fetchTareasFromApi(),
  ]);

  // Index empleados
  empleados.forEach((emp) => {
    if (emp?.id != null) {
      State.empleadosIndex.set(emp.id, emp);
    }
  });
  log("Index empleados (global):", State.empleadosIndex);

  // Index departamentos
  depts.forEach((d) => {
    if (d?.id != null) {
      State.departamentosIndex.set(d.id, d);
    }
  });
  log("Index departamentos:", State.departamentosIndex);

  // Index procesos
  procesos.forEach((p) => {
    if (p?.id != null) {
      State.procesosIndex.set(p.id, p);
    }
  });
  log("Index procesos:", State.procesosIndex);

  // Index trámites
  tramites.forEach((t) => {
    if (t?.id != null) {
      State.tramitesIndex.set(t.id, t);
    }
  });
  log("Index trámites:", State.tramitesIndex);

  // Enriquecer tareas con descripción de proceso y nombre de trámite
  const tareasEnriquecidas = tareas.map((t) => {
    let merged = { ...t };

    if (t.proceso_id != null) {
      const proc = State.procesosIndex.get(t.proceso_id);
      if (proc) {
        const tituloProc =
          proc.descripcion && proc.descripcion.trim().length
            ? proc.descripcion.trim()
            : merged.proceso_titulo;
        merged.proceso_titulo = tituloProc;
      }
    }

    if (t.tramite_id != null && !t.tramite_nombre) {
      const tram = State.tramitesIndex.get(t.tramite_id);
      if (tram && tram.nombre) {
        merged.tramite_nombre = tram.nombre;
      }
    }

    log("Tarea enriquecida:", merged);
    return merged;
  });

  State.tasks = tareasEnriquecidas;
  log("TAREAS finales en state:", State.tasks.length, State.tasks);

  // ==========================
  //   JERARQUÍAS / FILTROS
  // ==========================

  // a) Departamentos permitidos para el usuario
  const allowedDeptIds = new Set();

  if (Viewer.isAdmin || Viewer.isPres) {
    depts.forEach((d) => {
      if (d?.id != null) allowedDeptIds.add(d.id);
    });
  } else if (Viewer.deptId != null) {
    allowedDeptIds.add(Viewer.deptId);
  }

  // Quitar Presidencia del combo de departamentos
  PRES_DEPT_IDS.forEach((id) => allowedDeptIds.delete(id));

  log(
    "allowedDeptIds para filtros (sin Presidencia):",
    Array.from(allowedDeptIds)
  );

  // b) Empleados visibles según jerarquía
  let empleadosForFilter = [];

  if (Viewer.isAdmin || Viewer.isPres) {
    empleadosForFilter = empleados;
  } else if (Viewer.deptId != null) {
    empleadosForFilter = empleados.filter(
      (e) => Number(e.departamento_id) === Viewer.deptId
    );
  } else {
    empleadosForFilter = empleados;
  }

  log(
    "Empleados visibles para combo (tras jerarquía):",
    empleadosForFilter.length,
    empleadosForFilter
  );

  // c) Opciones de Departamentos
  const deptOptions = Array.from(allowedDeptIds).map((id) => {
    const dep = State.departamentosIndex.get(id);
    const label = dep ? dep.nombre : `Depto ${id}`;
    return { value: id, label };
  });
  log("Opciones filtro Departamentos:", deptOptions);

  // d) Opciones de Empleados
  const empOptions = empleadosForFilter.map((emp) => {
    const label =
      emp.nombre_completo ||
      [emp.nombre, emp.apellidos].filter(Boolean).join(" ") ||
      `Empleado ${emp.id}`;
    return {
      value: emp.id,
      label,
    };
  });
  log("Opciones filtro Empleados:", empOptions);

  // ==========================
  //   UI
  // ==========================

  setupSidebarFilters();

  const fieldDept = $("#kb-filter-departamentos");
  const fieldEmp = $("#kb-filter-empleados");
  if (fieldDept && deptOptions.length) {
    createMultiFilter(fieldDept, "departamentos", deptOptions);
  }
  if (fieldEmp && empOptions.length) {
    createMultiFilter(fieldEmp, "empleados", empOptions);
  }

  setupTramiteFilter(); // 👈 ahora el select es de Trámite
  setupToolbar();
  renderBoard();
  setupDragAndDrop();

  const btnClose = $("#kb-d-close");
  const overlay = $("#kb-d-overlay");
  if (btnClose) btnClose.addEventListener("click", closeDetails);
  if (overlay) overlay.addEventListener("click", closeDetails);

  log("Tablero de tareas listo", {
    tareas: State.tasks.length,
    empleados: State.empleadosIndex.size,
    departamentos: State.departamentosIndex.size,
    procesos: State.procesosIndex.size,
    tramites: State.tramitesIndex.size,
  });
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((e) => console.error("[KB] init error:", e));
});

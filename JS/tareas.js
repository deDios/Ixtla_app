// /JS/tareas.js – Tablero de tareas (kanban) listo para API real
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

  // Se sobreescribe con el empleado logueado (Session.getIds())
  CURRENT_USER_ID: null,

  STATUS: {
    TODO: 1,
    PROCESO: 2,
    REVISAR: 3,
    HECHO: 4,
    PAUSA: 5,
  },
};

// Fallback de endpoints (mismo host que en Planeación)
const API_FBK = {
  HOST: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net",
};

// Endpoints específicos que nos interesan aquí
const API_TAREAS = {
  LIST: `${API_FBK.HOST}/db/WEB/ixtla01_c_tarea_proceso.php`,
  UPDATE: `${API_FBK.HOST}/db/WEB/ixtla01_u_tarea_proceso.php`,
};

const API_DEPTS = {
  LIST: `${API_FBK.HOST}/db/WEB/ixtla01_c_departamento.php`,
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

/**
 * Calcula el “chip” de edad en días:
 * - realDays: días exactos transcurridos
 * - classIndex: 1–9 = paleta, 10 = rojo (10+ días)
 * - display: "0".."99" o "99+"
 */
function calcAgeChip(task) {
  const base = task.fecha_inicio || task.created_at;
  const d = diffDays(base); // 0,1,2,...
  if (d == null) return null;

  const realDays = d < 0 ? 0 : d;

  let paletteIndex;
  if (realDays >= 10) {
    paletteIndex = 10; // 10+ días → rojo pastel permanente
  } else if (realDays === 0) {
    paletteIndex = 1; // hoy → primer color
  } else {
    paletteIndex = realDays; // 1..9 días
  }

  let display;
  if (realDays >= 100) {
    display = "99+";
  } else {
    display = String(Math.min(realDays, 99));
  }

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
    mine: true, // "Solo mis tareas" por defecto
    search: "",
    departamentos: new Set(), // ids de departamento
    empleados: new Set(), // ids de empleado
  },

  // Para filtros de combos
  empleadosIndex: new Map(), // id_empleado → empleado normalizado
  departamentosIndex: new Map(), // id_depto → { id, nombre }
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

// Referencias a los combos multi (para limpiar UI)
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

  return {
    id,
    proceso_id,
    asignado_a,
    asignado_display,
    titulo: raw.titulo || raw.titulo_tarea || "Tarea sin título",
    descripcion: raw.descripcion || raw.detalle || "",
    esfuerzo:
      raw.esfuerzo != null ? Number(raw.esfuerzo) : raw.horas != null ? Number(raw.horas) : null,
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
   DEMO TASKS (mantenemos mientras probamos UI)
   ========================================================================== */

// NOTA: esta sección es el mismo mock que ya veníamos usando,
// solo para que la vista no se rompa mientras probamos integraciones.

const MOCK_PROCESOS = {
  9: "Proceso: Fuga de agua",
  10: "Proceso: Bacheo",
  11: "Proceso: Poda de árbol",
  12: "Proceso: Manual",
  13: "Proceso: Difusor",
};

const MOCK_TAREAS = [
  {
    id: 4,
    proceso_id: 9,
    asignado_a: 12,
    asignado_nombre: "Juan Pablo",
    asignado_apellidos: "García ANALISTA",
    titulo: "hola soy una tarea insertada desde postman 1",
    descripcion: "tarea test 1",
    esfuerzo: 2,
    fecha_inicio: "2025-10-28 13:00:00",
    fecha_fin: "2025-10-28 15:00:00",
    status: KB.STATUS.TODO,
    created_at: "2025-11-07 18:29:18",
    created_by: 12,
    created_by_nombre: "Juan Pablo García ANALISTA",
    autoriza_nombre: "Pablo Agustín Director",
  },
  {
    id: 5,
    proceso_id: 9,
    asignado_a: 12,
    asignado_nombre: "Juan Pablo",
    asignado_apellidos: "García ANALISTA",
    titulo: "hola soy una tarea insertada desde postman 2",
    descripcion: "tarea test 1",
    esfuerzo: 2,
    fecha_inicio: "2025-10-28 13:00:00",
    fecha_fin: "2025-10-28 15:00:00",
    status: KB.STATUS.REVISAR,
    created_at: "2025-11-07 19:54:57",
    created_by: 12,
    created_by_nombre: "Juan Pablo García ANALISTA",
    autoriza_nombre: "Pablo Agustín Director",
  },
  {
    id: 6,
    proceso_id: 9,
    asignado_a: 12,
    asignado_nombre: "Juan Pablo",
    asignado_apellidos: "García ANALISTA",
    titulo: "hola soy una tarea insertada desde postman 3",
    descripcion: "tarea test 1",
    esfuerzo: 2,
    fecha_inicio: "2025-10-28 13:00:00",
    fecha_fin: "2025-10-28 15:00:00",
    status: KB.STATUS.PROCESO,
    created_at: "2025-11-07 20:01:32",
    created_by: 12,
    created_by_nombre: "Juan Pablo García ANALISTA",
    autoriza_nombre: "Pablo Agustín Director",
  },
  {
    id: 7,
    proceso_id: 10,
    asignado_a: 13,
    asignado_nombre: "Juan Manuel",
    asignado_apellidos: "Perez Rodriguez",
    titulo: "hola soy una tarea 2",
    descripcion: "detalle",
    esfuerzo: 10,
    fecha_inicio: null,
    fecha_fin: null,
    status: KB.STATUS.TODO,
    created_at: "2025-11-12 02:16:05",
    created_by: 15,
    created_by_nombre: "Administrador",
    autoriza_nombre: "Director Obras Públicas",
  },
  {
    id: 8,
    proceso_id: 10,
    asignado_a: 5,
    asignado_nombre: "Juan Pablo",
    asignado_apellidos: "García Casillas",
    titulo: "hola soy una tarea 3",
    descripcion: "detalle 3",
    esfuerzo: 10,
    fecha_inicio: null,
    fecha_fin: null,
    status: KB.STATUS.TODO,
    created_at: "2025-11-12 02:26:48",
    created_by: 15,
    created_by_nombre: "Administrador",
    autoriza_nombre: "Director Obras Públicas",
  },
  {
    id: 9,
    proceso_id: 11,
    asignado_a: 6,
    asignado_nombre: "Luis Enrique",
    asignado_apellidos: "Mendez Fernandez",
    titulo: "Rellenar bache",
    descripcion: "Es necesario rellenar el bache con el material indicado",
    esfuerzo: 4,
    fecha_inicio: null,
    fecha_fin: null,
    status: KB.STATUS.TODO,
    created_at: "2025-11-12 12:06:32",
    created_by: 15,
    created_by_nombre: "Admin SAMAPA",
    autoriza_nombre: "Director SAMAPA",
  },
  {
    id: 10,
    proceso_id: 11,
    asignado_a: 6,
    asignado_nombre: "Luis Enrique",
    asignado_apellidos: "Mendez Fernandez",
    titulo: "Aplanado del bache",
    descripcion: "Es necesario aplanar el bache para poder circular",
    esfuerzo: 2,
    fecha_inicio: null,
    fecha_fin: null,
    status: KB.STATUS.PROCESO,
    created_at: "2025-11-12 12:07:04",
    created_by: 15,
    created_by_nombre: "Admin SAMAPA",
    autoriza_nombre: "Director SAMAPA",
  },
  {
    id: 11,
    proceso_id: 12,
    asignado_a: 2,
    asignado_nombre: "Pablo Agustin",
    asignado_apellidos: "de Dios Garcia",
    titulo: "manual",
    descripcion: "proceso 1",
    esfuerzo: 5,
    fecha_inicio: null,
    fecha_fin: null,
    status: KB.STATUS.TODO,
    created_at: "2025-11-12 16:25:31",
    created_by: 2,
    created_by_nombre: "Pablo Agustín",
    autoriza_nombre: "Presidencia",
  },
  {
    id: 12,
    proceso_id: 13,
    asignado_a: 2,
    asignado_nombre: "Pablo Agustin",
    asignado_apellidos: "de Dios Garcia",
    titulo: "cambio del difusor",
    descripcion:
      "esta es una tarea para cambio de difusor, es necesario subir evidencia",
    esfuerzo: 3,
    fecha_inicio: null,
    fecha_fin: null,
    status: KB.STATUS.REVISAR,
    created_at: "2025-11-17 12:29:34",
    created_by: 2,
    created_by_nombre: "Pablo Agustín",
    autoriza_nombre: "Presidencia",
  },
  {
    id: 13,
    proceso_id: 13,
    asignado_a: 2,
    asignado_nombre: "Pablo Agustin",
    asignado_apellidos: "de Dios Garcia",
    titulo: "cambio de alca....",
    descripcion: "esta descripción",
    esfuerzo: 1,
    fecha_inicio: null,
    fecha_fin: null,
    status: KB.STATUS.PROCESO,
    created_at: "2025-11-17 20:21:03",
    created_by: 2,
    created_by_nombre: "Pablo Agustín",
    autoriza_nombre: "Presidencia",
  },
  {
    id: 14,
    proceso_id: 9,
    asignado_a: 7,
    asignado_nombre: "Juan Pablo",
    asignado_apellidos: "García DIRECTOR",
    titulo: "tarea 20/11",
    descripcion: "detalle",
    esfuerzo: 10,
    fecha_inicio: null,
    fecha_fin: null,
    status: KB.STATUS.PAUSA,
    created_at: "2025-11-20 10:57:33",
    created_by: 15,
    created_by_nombre: "Administrador",
    autoriza_nombre: "Director SAMAPA",
  },
].map((t) => ({
  ...t,
  folio: `REQ-${String(15000 + t.id).padStart(9, "0")}`,
  proceso_titulo: MOCK_PROCESOS[t.proceso_id] || `Proceso ${t.proceso_id}`,
  asignado_display:
    t.asignado_display || `${t.asignado_nombre} ${t.asignado_apellidos}`,
}));

/* ==========================================================================
   Fetch de datos reales (TAREAS, EMPLEADOS, DEPARTAMENTOS)
   ========================================================================== */

async function fetchTareasFromApi() {
  // TODO: activar API real cuando quieras dejar de usar MOCK_TAREAS
  // Ejemplo de payload; puedes ajustar filtros en backend:
  const payload = {
    // status: null,            // opcional: todos los estatus
    // asignado_a: KB.CURRENT_USER_ID, // opcional
    page: 1,
    page_size: 200,
  };

  try {
    log("TAREAS LIST →", API_TAREAS.LIST, payload);
    const json = await postJSON(API_TAREAS.LIST, payload);
    if (!json || !Array.isArray(json.data)) {
      warn("Respuesta inesperada de TAREAS LIST", json);
      return [];
    }
    const mapped = json.data.map(mapRawTask);
    log("TAREAS mapeadas", mapped.length);
    return mapped;
  } catch (e) {
    console.error("[KB] Error al listar tareas:", e);
    return [];
  }
}

async function fetchDepartamentos() {
  try {
    const payload = {
      status: 1,
      page: 1,
      page_size: 100,
    };
    log("DEPTS LIST →", API_DEPTS.LIST, payload);
    const json = await postJSON(API_DEPTS.LIST, payload);
    if (!json || !Array.isArray(json.data)) {
      warn("Respuesta inesperada DEPTS LIST", json);
      return [];
    }
    return json.data.map((d) => ({
      id: Number(d.id),
      nombre: d.nombre || `Depto ${d.id}`,
    }));
  } catch (e) {
    console.error("[KB] Error al listar departamentos:", e);
    return [];
  }
}

async function fetchEmpleadosForFilters() {
  try {
    // Traemos empleados activos con cuenta activa
    const res = await searchEmpleados({
      status_empleado: 1,
      status_cuenta: 1,
      page: 1,
      page_size: 500,
    });
    const data = Array.isArray(res?.data) ? res.data : [];
    log("Empleados para filtros:", data.length);
    return data;
  } catch (e) {
    console.error("[KB] Error al buscar empleados:", e);
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

  // Filtro por empleados
  if (State.filters.empleados.size) {
    if (!task.asignado_a || !State.filters.empleados.has(task.asignado_a)) {
      return false;
    }
  }

  // Filtro por departamentos (desde empleadosIndex)
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
   Multi select (Departamentos / Empleados) tipo Jira
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
    State.filters[key] ||
    (State.filters[key] = new Set());

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
          summaryEl.textContent = `${selected[0].label} +${selected.length - 1}`;
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

    // Actualizar UI de opciones
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

  // Inicializar
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

  // Título: {proceso} / {id}
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

  // Líneas de detalle
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

  // Contador de días (no en HECHO)
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
  // Limpiar columnas y contadores
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
   Drawer de detalle
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

  // Evidencias demo: solo placeholders
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
   Filtros rápidos (toolbar)
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
      renderBoard();
    });
  }

  if (chipRecent) {
    chipRecent.addEventListener("click", () => {
      chipRecent.classList.toggle("is-active");
      // Por ahora recientes no aplica lógica extra
    });
  }

  if (inputSearch) {
    inputSearch.addEventListener("input", () => {
      State.filters.search = inputSearch.value || "";
      renderBoard();
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", () => {
      State.filters.mine = false;
      State.filters.search = "";
      if (chipMine) chipMine.classList.remove("is-active");
      if (chipRecent) chipRecent.classList.remove("is-active");
      if (inputSearch) inputSearch.value = "";
      renderBoard();
    });
  }
}

/* ==========================================================================
   Drag & drop (Sortable)
   ========================================================================== */

async function persistTaskStatus(task, newStatus) {
  // TODO: cuando quieras que persista en backend, activa este bloque
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

        task.status = newStatus;
        renderBoard();
        if (State.selectedId === task.id) {
          highlightSelected();
        }

        // Persistencia (opcional / activable)
        await persistTaskStatus(task, newStatus);
      },
    });
  });
}

/* ==========================================================================
   Init
   ========================================================================== */

async function init() {
  // 1) Session → empleado actual
  try {
    const ids = Session?.getIds ? Session.getIds() : null;
    KB.CURRENT_USER_ID = ids?.id_empleado || null;
    log("Session ids:", ids, "CURRENT_USER_ID:", KB.CURRENT_USER_ID);
  } catch (e) {
    console.error("[KB] Error leyendo Session.getIds():", e);
  }

  // 2) Empleados y departamentos para filtros
  const [empleados, depts] = await Promise.all([
    fetchEmpleadosForFilters(),
    fetchDepartamentos(),
  ]);

  // Index de empleados
  empleados.forEach((emp) => {
    if (emp?.id != null) {
      State.empleadosIndex.set(emp.id, emp);
    }
  });

  // Index de departamentos (si vienen de la API)
  depts.forEach((d) => {
    if (d?.id != null) {
      State.departamentosIndex.set(d.id, d);
    }
  });

  // Construir opciones de filtros solo con lo que aparece en tareas
  // (de momento usamos MOCK_TAREAS; cuando actives API real, se alimentará de ahí)
  // 3) TAREAS
  // === DEMO: usamos MOCK_TAREAS ================================
  State.tasks = MOCK_TAREAS.slice();
  // === REAL: cuando estés listo, cambia la línea anterior por:
  // State.tasks = await fetchTareasFromApi();
  // =============================================================

  // Construir opciones de combos en base a tareas cargadas
  const deptIdsSet = new Set();
  const empIdsSet = new Set();

  for (const t of State.tasks) {
    if (t.asignado_a != null) {
      empIdsSet.add(t.asignado_a);
      const emp = State.empleadosIndex.get(t.asignado_a);
      if (emp?.departamento_id != null) {
        deptIdsSet.add(emp.departamento_id);
      }
    }
  }

  // Opciones de Departamentos
  const deptOptions = Array.from(deptIdsSet).map((id) => {
    const dep = State.departamentosIndex.get(id);
    const label = dep ? dep.nombre : `Depto ${id}`;
    return { value: id, label };
  });

  // Opciones de Empleados
  const empOptions = Array.from(empIdsSet).map((id) => {
    const emp = State.empleadosIndex.get(id);
    const label = emp ? emp.nombre_completo : `Empleado ${id}`;
    return { value: id, label };
  });

  // 4) Instanciar combos multi
  setupSidebarFilters();

  const fieldDept = $("#kb-filter-departamentos");
  const fieldEmp = $("#kb-filter-empleados");
  if (fieldDept && deptOptions.length) {
    createMultiFilter(fieldDept, "departamentos", deptOptions);
  }
  if (fieldEmp && empOptions.length) {
    createMultiFilter(fieldEmp, "empleados", empOptions);
  }

  // 5) Toolbar, board, drag & drop, drawer
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
  });
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((e) => console.error("[KB] init error:", e));
});

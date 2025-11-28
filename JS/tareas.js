// /JS/tareas.js – Tablero de tareas (kanban) con API real + jerarquías
"use strict";

/* ==========================================================================
   Imports (módulos compartidos)
   ========================================================================== */

import { Session } from "./auth/session.js";
import { postJSON, patchJSON } from "./api/http.js";
import { searchEmpleados } from "./api/usuarios.js";
import { createTaskDetailsModule } from "./ui/tareasDetalle.js";
import { createTaskFiltersModule } from "./ui/tareasFiltros.js";

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

// Departamentos especiales
const PRES_DEPT_IDS = [6]; // Presidencia (no mostrar en filtro)

/** Info del usuario actual (viewer) */
const Viewer = {
  deptId: null,
  roles: [],
  isAdmin: false,
  isPres: false,
  isDirector: false,
  isJefe: false,
  isAnalista: false,
};

const API_FBK = {
  HOST: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net",
};

const API_TAREAS = {
  LIST: `${API_FBK.HOST}/db/WEB/ixtla01_c_tarea_proceso.php`,
  UPDATE: `${API_FBK.HOST}/db/WEB/ixtla01_u_tarea_proceso.php`,
};

const API_DEPTS = {
  LIST: `${API_FBK.HOST}/db/WEB/ixtla01_c_departamento.php`,
};

const API_PROCESOS = {
  LIST: `${API_FBK.HOST}/db/WEB/ixtla01_c_proceso_requerimiento.php`,
};

const API_TRAMITES = {
  LIST: `${API_FBK.HOST}/db/WEB/ixtla01_c_tramite.php`,
};

const API_REQ = {
  GET: `${API_FBK.HOST}/db/WEB/ixtla01_c_requerimiento.php`,
};

// ENDPOINTS DE MEDIA DE REQUERIMIENTOS (se usan desde tareas.detalle.js)
const API_MEDIA = {
  // DB\WEB\ixtla01_c_requerimiento_img.php
  LIST: `${API_FBK.HOST}/db/WEB/ixtla01_c_requerimiento_img.php`,
  // DB\WEB\ixtla01_in_requerimiento_img.php
  UPLOAD: `${API_FBK.HOST}/db/WEB/ixtla01_in_requerimiento_img.php`,
};

const log = (...a) => KB.DEBUG && console.log("[KB]", ...a);
const warn = (...a) => KB.DEBUG && console.warn("[KB]", ...a);
const toast = (m, t = "info") =>
  window.gcToast ? gcToast(m, t) : log("[toast]", t, m);

/* ==========================================================================
   Helpers
   ========================================================================== */

/* ==========================================================================
   Reglas de negocio: quién puede mover qué
   ========================================================================== */

/**
 * Determina si el viewer actual es "privilegiado" para esta tarea:
 * - Admin
 * - Presidencia
 * - Director del departamento dueño del requerimiento/tarea
 */
function isPrivilegedForTask(task) {
  if (Viewer.isAdmin || Viewer.isPres) return true;

  // Director del depto (autoriza_id viene del catálogo de departamentos)
  if (
    KB.CURRENT_USER_ID != null &&
    task.autoriza_id != null &&
    Number(task.autoriza_id) === Number(KB.CURRENT_USER_ID)
  ) {
    return true;
  }

  return false;
}

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

/**
 * Formato estándar de folio de requerimiento.
 * - Si ya viene como REQ-########### lo respeta.
 * - Si trae solo dígitos, los rellena a 11.
 * - Si no hay nada, usa el id como respaldo.
 */
function formatFolio(folio, id) {
  if (folio && /^REQ-\d+$/i.test(String(folio).trim()))
    return String(folio).trim();

  const digits = String(folio ?? "").match(/\d+/)?.[0];

  if (digits) return "REQ-" + digits.padStart(11, "0");
  if (id != null) return "REQ-" + String(id).padStart(11, "0");
  return "—";
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

function calcAgeChip(task) {
  // Prioridad: status_since (desde cuándo está en este status)
  const base =
    task.status_since ||
    task.updated_at ||
    task.fecha_inicio ||
    task.created_at;

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
    mine: false,
    recentDays: null,
    search: "",
    departamentos: new Set(), // ids
    empleados: new Set(), // ids
    procesoId: null,
    tramiteId: null,
  },

  empleadosIndex: new Map(), // id_empleado → empleado
  departamentosIndex: new Map(), // id_depto → depto
  procesosIndex: new Map(), // id_proceso → proceso
  tramitesIndex: new Map(), // id_tramite → tramite
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
let FiltersModule = null;

// cache para requerimientos (folio, tramite, etc.)
const ReqCache = new Map(); // reqId → data o null

// Módulo del drawer (se inicializa en init)
let DetailsModule = null;

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

  const requerimiento_id =
    raw.requerimiento_id != null
      ? Number(raw.requerimiento_id)
      : raw.req_id != null
      ? Number(raw.req_id)
      : null;

  const tramite_id = raw.tramite_id != null ? Number(raw.tramite_id) : null;

  const tramite_nombre = raw.tramite_nombre || "";

  const folio = formatFolio(
    raw.folio || raw.requerimiento_folio || null,
    requerimiento_id
  );

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
      raw.esfuerzo != null
        ? Number(raw.esfuerzo)
        : raw.horas != null
        ? Number(raw.horas)
        : null,
    fecha_inicio: raw.fecha_inicio || raw.fecha_inicio_tarea || null,
    fecha_fin: raw.fecha_fin || raw.fecha_fin_tarea || null,
    status,
    created_at: raw.created_at || null,
    updated_at: raw.updated_at || null,
    created_by: raw.created_by != null ? Number(raw.created_by) : null,
    created_by_nombre: raw.created_by_nombre || raw.creado_por_nombre || "—",
    autoriza_nombre: raw.autoriza_nombre || raw.autorizado_por || "—",
    folio,
    proceso_titulo,
    requerimiento_id,
    tramite_id,
    tramite_nombre,

    status_since: raw.status_since || raw.fecha_status || null,
  };
}

/* ==========================================================================
   Fetch de datos (TAREAS, EMPLEADOS, DEPARTAMENTOS, PROCESOS, TRÁMITES, REQS)
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
      all: true, // todos los deptos, incluso status 0 (Presidencia)
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

      director: d.director != null ? Number(d.director) : null,
      director_nombre: d.director_nombre || d.primera_nombre || "",
      director_apellidos: d.director_apellidos || d.primera_apellidos || "",

      primera_nombre: d.primera_nombre || "",
      primera_apellidos: d.primera_apellidos || "",
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

    // IMPORTANTE: searchEmpleados devuelve {items, total, ...}
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
      // por si algún día viene folio directo
      requerimiento_folio: p.requerimiento_folio || null,
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
      descripcion: t.descripcion || "",
      estatus: t.estatus != null ? Number(t.estatus) : null,
    }));

    log("Trámites normalizados:", out.length, out);
    return out;
  } catch (e) {
    console.error("[KB] Error al listar trámites:", e);
    return [];
  }
}

async function fetchRequerimientoById(id) {
  if (!id) return null;
  if (ReqCache.has(id)) return ReqCache.get(id);

  try {
    const payload = { id };
    log("REQ GET →", API_REQ.GET, payload);
    const json = await postJSON(API_REQ.GET, payload);
    const data = json?.data || null;
    ReqCache.set(id, data || null);
    log("REQ GET resp (id=" + id + "):", data);
    return data;
  } catch (e) {
    console.error("[KB] Error al consultar requerimiento:", e);
    ReqCache.set(id, null);
    return null;
  }
}

/**
 * Enriquecer tareas con datos del requerimiento (folio real + tramite)
 * usando requerimiento_id que viene desde el proceso.
 */
async function enrichTasksWithRequerimientos(tasks) {
  const idsToFetch = new Set();

  for (const t of tasks) {
    if (!t.requerimiento_id) continue;

    const hasFolio = t.folio && t.folio !== "—";
    if (!hasFolio && !ReqCache.has(t.requerimiento_id)) {
      idsToFetch.add(t.requerimiento_id);
    }
  }

  if (idsToFetch.size) {
    log("EnrichReq → ids a consultar:", Array.from(idsToFetch));
    await Promise.all(
      Array.from(idsToFetch).map((id) => fetchRequerimientoById(id))
    );
  }

  const enriched = tasks.map((t) => {
    if (!t.requerimiento_id) return t;
    const req = ReqCache.get(t.requerimiento_id);
    if (!req) return t;

    const folioReal = formatFolio(req.folio, req.id);

    return {
      ...t,
      folio: folioReal,
      tramite_id:
        t.tramite_id != null
          ? Number(t.tramite_id)
          : req.tramite_id != null
          ? Number(req.tramite_id)
          : null,
      tramite_nombre:
        t.tramite_nombre || req.tramite_nombre || t.tramite_nombre || "",
    };
  });

  log("TAREAS enriquecidas con requerimientos:", enriched);
  return enriched;
}

/* ==========================================================================
   Filtros / combos (lógica de negocio)
   ========================================================================== */

function passesBaseFilters(task) {
  // Solo mis tareas
  if (
    State.filters.mine &&
    KB.CURRENT_USER_ID != null &&
    task.asignado_a !== KB.CURRENT_USER_ID
  ) {
    return false;
  }

  // Search (folio / proceso / id)
  const q = State.filters.search.trim().toLowerCase();
  if (q) {
    const hay =
      (task.folio || "").toLowerCase().includes(q) ||
      (task.proceso_titulo || "").toLowerCase().includes(q) ||
      String(task.id).includes(q);
    if (!hay) return false;
  }

  return true;
}

function passesFilters(task) {
  // Solo mis tareas
  if (
    State.filters.mine &&
    KB.CURRENT_USER_ID != null &&
    task.asignado_a !== KB.CURRENT_USER_ID
  ) {
    return false;
  }

  // Search (folio, proceso, id)
  const q = State.filters.search.trim().toLowerCase();
  if (q) {
    const hay =
      (task.folio || "").toLowerCase().includes(q) ||
      (task.proceso_titulo || "").toLowerCase().includes(q) ||
      String(task.id).includes(q);
    if (!hay) return false;
  }

  // Filtro "recientes" (últimos N días, por ahora 15)
  const recentDays = State.filters.recentDays;
  if (recentDays != null) {
    const baseDateStr = task.fecha_inicio || task.created_at;
    const d = diffDays(baseDateStr);
    // si no tiene fecha o es más viejo que N días, se excluye
    if (d == null || d > recentDays) {
      return false;
    }
  }

  // Filtro por empleado
  if (State.filters.empleados.size) {
    if (!task.asignado_a || !State.filters.empleados.has(task.asignado_a)) {
      return false;
    }
  }

  // Filtro por departamento (según empleado asignado)
  if (State.filters.departamentos.size) {
    let deptId = task.departamento_id ?? null;

    // Fallback: si por alguna razón la tarea no tiene departamento_id,
    // usamos el departamento del empleado asignado.
    if (deptId == null && task.asignado_a != null) {
      const emp = State.empleadosIndex.get(task.asignado_a);
      deptId = emp?.departamento_id ?? null;
    }

    if (deptId == null || !State.filters.departamentos.has(Number(deptId))) {
      return false;
    }
  }

  // Filtro por proceso
  if (State.filters.procesoId != null) {
    if (!task.proceso_id || task.proceso_id !== State.filters.procesoId) {
      return false;
    }
  }

  // Filtro por trámite (usamos tramite_id que viene del req)
  if (State.filters.tramiteId != null) {
    if (!task.tramite_id || task.tramite_id !== State.filters.tramiteId) {
      return false;
    }
  }

  return true;
}

/* ==========================================================================
   Render de cards
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

// Wrappers para el módulo de detalle
function openDetails(id) {
  if (!DetailsModule) return;
  DetailsModule.openDetails(id);
}

function closeDetails() {
  if (!DetailsModule) return;
  DetailsModule.closeDetails();
}

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
  lineFolio.innerHTML = `<span class="kb-task-label">Folio:</span> <span class="kb-task-value kb-task-folio">${
    task.folio || "—"
  }</span>`;

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

    // Texto del tooltip según el status actual
    let statusLabel = "en proceso";
    switch (task.status) {
      case KB.STATUS.TODO:
        statusLabel = "en por hacer";
        break;
      case KB.STATUS.PROCESO:
        statusLabel = "en proceso";
        break;
      case KB.STATUS.REVISAR:
        statusLabel = "en revisión";
        break;
      case KB.STATUS.PAUSA:
        statusLabel = "en bloqueado";
        break;
      case KB.STATUS.HECHO:
        statusLabel = "en terminado";
        break;
    }

    chip.title = `${age.realDays} día${
      age.realDays === 1 ? "" : "s"
    } ${statusLabel}`;
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

  // 1) Tareas visibles
  const visibleTasks = [];
  for (const task of State.tasks) {
    if (!passesFilters(task)) continue;
    visibleTasks.push(task);

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

  // 2) Actualizar filtros dinámicos según tareas que cumplen mine + búsqueda
  if (FiltersModule && FiltersModule.updateAvailableOptions) {
    // Usamos passesFilters para que Proceso, Trámite, Departamentos y Empleados
    // afecten el universo con el que se recalculan las opciones.
    const universeTasks = State.tasks.filter(passesFilters);
    FiltersModule.updateAvailableOptions(universeTasks);
  }
}

/* ==========================================================================
   Reglas de movimiento (jerarquías)
   ========================================================================== */

// Orden lógico del flujo para saber qué es "adelante" y qué es "atrás"
const STATUS_ORDER = {
  [KB.STATUS.TODO]: 1,
  [KB.STATUS.PROCESO]: 2,
  [KB.STATUS.REVISAR]: 3,
  [KB.STATUS.HECHO]: 4,
};

function isBlockedStatus(status) {
  return status === KB.STATUS.PAUSA;
}

/**
 * Reglas de movimiento entre columnas según rol.
 * - Director/Admin: pueden todo.
 * - Jefes/Analistas:
 *   - No pueden mandar a HECHO.
 *   - Pueden mandar a PAUSA desde cualquier estado.
 *   - No pueden regresar hacia atrás en el flujo (TODO → PROCESO → REVISAR → HECHO).
 *   - Desde PAUSA pueden volver al flujo (salvo HECHO).
 */
function canMoveTask(task, oldStatus, newStatus) {
  if (oldStatus === newStatus) return true;

  const privileged = isPrivilegedForTask(task);
  if (privileged) {
    // Admin / Pres / Director del depto: pueden hacer cualquier movimiento
    return true;
  }

  // ===========================
  //  Usuarios NO privilegiados
  //  (JEFE, ANALISTA, etc.)
  // ===========================

  // Solo pueden mover SUS propias tareas
  const isOwner =
    KB.CURRENT_USER_ID != null &&
    task.asignado_a != null &&
    Number(task.asignado_a) === Number(KB.CURRENT_USER_ID);

  if (!isOwner) {
    return false;
  }

  // Nunca pueden mandar a HECHO
  if (newStatus === KB.STATUS.HECHO) {
    return false;
  }

  const S = KB.STATUS;
  const key = `${oldStatus}->${newStatus}`;

  // Mapa explícito de movimientos permitidos para jefe/analista
  const allowedMoves = new Set([
    // Flujo progresivo principal
    `${S.TODO}->${S.PROCESO}`, // Por hacer → En proceso
    `${S.TODO}->${S.REVISAR}`, // Por hacer → Por revisar
    `${S.PROCESO}->${S.REVISAR}`, // En proceso → Por revisar

    // Hacia bloqueado
    `${S.TODO}->${S.PAUSA}`, // Por hacer → Bloqueado
    `${S.PROCESO}->${S.PAUSA}`, // En proceso → Bloqueado
    `${S.REVISAR}->${S.PAUSA}`, // Por revisar → Bloqueado

    // Desde bloqueado de regreso al flujo
    `${S.PAUSA}->${S.PROCESO}`, // Bloqueado → En proceso
  ]);

  return allowedMoves.has(key);
}

/* ==========================================================================
   Drag & drop
   ========================================================================== */

async function persistTaskStatus(task, newStatus) {
  // Intentamos obtener el id de empleado que está moviendo la tarjeta
  let updatedBy = KB.CURRENT_USER_ID;

  if (!updatedBy) {
    try {
      const ids = Session?.getIds ? Session.getIds() : null;
      updatedBy = ids?.id_empleado ?? null;
    } catch (e) {
      console.warn("[KB] No se pudo leer Session.getIds() para updated_by:", e);
    }
  }

  if (!updatedBy) {
    warn("No se pudo determinar updated_by, se cancela update", {
      taskId: task.id,
      newStatus,
    });
    toast(
      "No se pudo identificar al usuario que actualiza la tarea. Revisa tu sesión.",
      "warning"
    );
    return;
  }

  const payload = {
    id: task.id,
    status: newStatus, // si el backend usa 'estatus', cámbialo aquí
    updated_by: updatedBy, // <--- dato obligatorio
  };

  try {
    log("TAREA UPDATE status →", API_TAREAS.UPDATE, payload);
    const res = await patchJSON(API_TAREAS.UPDATE, payload);
    log("Respuesta UPDATE tarea:", res);

    if (!res || res.ok === false) {
      toast(
        res?.error || "No se pudo actualizar el status de la tarea.",
        "error"
      );
      return;
    }

    task.status = newStatus;
    task.updated_at = new Date().toISOString().slice(0, 19).replace("T", " ");
  } catch (e) {
    console.error("[KB] Error al actualizar status de tarea:", e);
    toast("Error al actualizar el status de la tarea.", "error");
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

        const fromCol = evt.from.closest(".kb-col");
        const toCol = evt.to.closest(".kb-col");
        if (!toCol || !fromCol) return;

        const oldStatus = task.status;
        const newStatus = Number(toCol.dataset.status);

        if (!newStatus || newStatus === oldStatus) {
          return;
        }

        // ================================
        // Validar permisos antes de mover
        // ================================
        if (!canMoveTask(task, oldStatus, newStatus)) {
          // Revertir visualmente la tarjeta a su columna original
          const fromList = evt.from;
          if (fromList && itemEl) {
            // Intentamos regresarla a su índice original
            if (
              typeof evt.oldIndex === "number" &&
              evt.oldIndex >= 0 &&
              evt.oldIndex < fromList.children.length
            ) {
              fromList.insertBefore(itemEl, fromList.children[evt.oldIndex]);
            } else {
              fromList.appendChild(itemEl);
            }
          }

          toast(
            "No tienes permisos para mover esta tarea a ese estado.",
            "warning"
          );
          log("Movimiento NO permitido", {
            taskId: task.id,
            oldStatus,
            newStatus,
            viewer: KB.CURRENT_USER_ID,
          });
          return;
        }

        // ================================
        // Movimiento permitido
        // ================================
        task.status = newStatus;
        log(
          "DragEnd → tarea",
          task.id,
          "de",
          oldStatus,
          "a",
          newStatus,
          "status_since:",
          task.status_since || task.updated_at || task.created_at
        );

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
    console.warn("[KB] Session.get() no disponible o falló:", e);
  }
  log("Session.get() completo:", full);

  const deptId =
    full?.empleado?.departamento_id ?? full?.departamento_id ?? null;

  const rolesRaw = full?.roles ?? full?.user?.roles ?? [];
  const roles = Array.isArray(rolesRaw)
    ? rolesRaw
    : String(rolesRaw || "")
        .split(/[,\s]+/g)
        .map((r) => r.trim())
        .filter(Boolean);

  Viewer.deptId = deptId != null ? Number(deptId) : null;
  Viewer.roles = roles;
  Viewer.isAdmin = roles.includes("ADMIN");
  Viewer.isPres =
    Viewer.deptId != null && PRES_DEPT_IDS.includes(Viewer.deptId);

  const rolesUpper = Viewer.roles.map((r) => String(r).toUpperCase());
  Viewer.isDirector = rolesUpper.some((r) => r.includes("DIRECTOR"));
  Viewer.isJefe = rolesUpper.some((r) => r.includes("JEFE"));
  Viewer.isAnalista = rolesUpper.some((r) => r.includes("ANALISTA"));

  log("Viewer info:", {
    deptId: Viewer.deptId,
    roles: Viewer.roles,
    isAdmin: Viewer.isAdmin,
    isPres: Viewer.isPres,
    isDirector: Viewer.isDirector,
    isJefe: Viewer.isJefe,
    isAnalista: Viewer.isAnalista,
  });
}

async function init() {
  hydrateViewerFromSession();

  const [empleados, depts, procesos, tramites, tareasRaw] = await Promise.all([
    fetchEmpleadosForFilters(),
    fetchDepartamentos(),
    fetchProcesosCatalog(),
    fetchTramitesCatalog(),
    fetchTareasFromApi(),
  ]);

  // Index empleados (para depto de tareas)
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

  // ==========================
  //   Enriquecer tareas
  // ==========================

  const tareasConProceso = tareasRaw.map((t) => {
    if (t.proceso_id == null) return t;
    const proc = State.procesosIndex.get(t.proceso_id);
    if (!proc) return t;

    const tituloProc =
      proc.descripcion && proc.descripcion.trim().length
        ? proc.descripcion.trim()
        : t.proceso_titulo;

    const merged = {
      ...t,
      proceso_titulo: tituloProc,
    };

    if (!merged.requerimiento_id && proc.requerimiento_id) {
      merged.requerimiento_id = proc.requerimiento_id;
    }

    if (!merged.folio && proc.requerimiento_folio) {
      merged.folio = formatFolio(
        proc.requerimiento_folio,
        proc.requerimiento_id
      );
    }

    return merged;
  });

  const tareasFinales = await enrichTasksWithRequerimientos(tareasConProceso);

  // ==========================================================
  //  Enriquecer tareas con:
  //  - creado_por (nombre)
  //  - departamento_id (desde el req)
  //  - quien autoriza (director del depto)
  // ==========================================================
  const tareasConPersonas = tareasFinales.map((t) => {
    // ---------- CREADO POR ----------
    let created_by_nombre = t.created_by_nombre;

    if (
      (!created_by_nombre || created_by_nombre === "—") &&
      t.created_by != null
    ) {
      const emp = State.empleadosIndex.get(t.created_by);
      if (emp) {
        created_by_nombre =
          emp.nombre_completo ||
          [emp.nombre, emp.apellidos].filter(Boolean).join(" ");
      }
    }

    // ---------- DEPARTAMENTO + DIRECTOR (QUIEN AUTORIZA) ----------
    let deptId = t.departamento_id ?? null;

    // si no viene en la tarea, lo sacamos del requerimiento
    if (!deptId && t.requerimiento_id) {
      const req = ReqCache.get(t.requerimiento_id);
      if (req?.departamento_id != null) {
        deptId = Number(req.departamento_id);
      }
    }

    let autoriza_id = t.autoriza_id ?? null;
    let autoriza_nombre = t.autoriza_nombre;

    if (deptId != null) {
      const dep = State.departamentosIndex.get(deptId);
      if (dep) {
        autoriza_id = dep.director ?? autoriza_id;

        const dirNombre = dep.director_nombre || dep.primera_nombre || "";
        const dirApellidos =
          dep.director_apellidos || dep.primera_apellidos || "";

        const fullDirector = [dirNombre, dirApellidos]
          .filter(Boolean)
          .join(" ");

        if (fullDirector) {
          autoriza_nombre = fullDirector;
        }
      }
    }

    return {
      ...t,
      departamento_id: deptId ?? t.departamento_id ?? null,
      created_by_nombre: created_by_nombre || "—",
      autoriza_id: autoriza_id ?? null,
      autoriza_nombre: autoriza_nombre || "—",
    };
  });

  State.tasks = tareasConPersonas;
  log("TAREAS finales en state:", State.tasks.length, State.tasks);

  // ==========================
  //   Módulo de Detalle
  // ==========================

  DetailsModule = createTaskDetailsModule({
    State,
    KB,
    ReqCache,
    fetchRequerimientoById,
    formatFolio,
    log,
    warn,
    toast,
    highlightSelected,
    getTaskById,
    API_MEDIA,
    postJSON,
  });

  // ==========================
  //   JERARQUÍAS / FILTROS
  // ==========================

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

  const deptOptions = Array.from(allowedDeptIds).map((id) => {
    const dep = State.departamentosIndex.get(id);
    const label = dep ? dep.nombre : `Depto ${id}`;
    return { value: id, label };
  });
  log("Opciones filtro Departamentos:", deptOptions);

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

  const procesosOptions = procesos.map((p) => ({
    value: p.id,
    label: p.descripcion?.trim() || `Proceso ${p.id}`,
  }));

  const tramitesOptions = tramites.map((t) => ({
    value: t.id,
    label: t.nombre || `Trámite ${t.id}`,
  }));

  // ==========================
  //   UI – Filtros + tablero
  // ==========================

  FiltersModule = createTaskFiltersModule({
    State,
    KB,
    log,
    renderBoard,
    $,
    $$,
  });

  FiltersModule.init({
    deptOptions,
    empOptions,
    procesosOptions,
    tramitesOptions,
  });

  renderBoard();
  setupDragAndDrop();

  const btnClose = $("#kb-d-close");
  const overlay = $("#kb-d-overlay");
  if (btnClose) btnClose.addEventListener("click", closeDetails);
  if (overlay) overlay.addEventListener("click", closeDetails);

  if (DetailsModule && DetailsModule.setupEvidenciasUpload) {
    DetailsModule.setupEvidenciasUpload();
  }

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

// /JS/tareas.js
"use strict";

/* ==========================================================================
   1) Imports (módulos compartidos)
   ========================================================================== */
import { setupMedia, uploadMedia, uploadMediaLink } from "./api/media.js";
import { Session } from "./auth/session.js";
import { postJSON, patchJSON } from "./api/http.js";
import { searchEmpleados } from "./api/usuarios.js";
import { createTaskDetailsModule } from "./ui/tareasDetalle.js";
import { createTaskFiltersModule } from "./ui/tareasFiltros.js";

/* ==========================================================================
   2) Config + helpers genéricos
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
  isPrimeraLinea: false,
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
  LIST: `${API_FBK.HOST}/db/WEB/ixtla01_c_requerimiento_img.php`,
  UPLOAD: `${API_FBK.HOST}/db/WEB/ixtla01_in_requerimiento_img.php`,
};

const log = (...a) => KB.DEBUG && console.log("[KB]", ...a);
const warn = (...a) => KB.DEBUG && console.warn("[KB]", ...a);
const toast = (m, t = "info") =>
  window.gcToast ? gcToast(m, t) : log("[toast]", t, m);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Fecha corta dd/mm/aaaa para UI */
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

/** Fecha/hora actual en formato SQL: YYYY-MM-DD HH:MM:SS */
function nowAsSqlDateTime() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
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

/** Diferencia en días entre una fecha y ahora */
function diffDays(startStr) {
  if (!startStr) return null;
  const start = new Date(String(startStr).replace(" ", "T"));
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  const ms = now.getTime() - start.getTime();
  const days = Math.floor(ms / 86400000);
  return days < 0 ? 0 : days;
}

/** Cálculo del chip de edad por días en el status */
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
   3) State + normalización
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

// Subordinados detectados para el viewer (empleados que le reportan)
const SubordinateIds = new Set();

/**
 * Calcular subordinados según payload de empleados
 * Usa varios posibles campos: reporta_a / reporta_a_id / jefe_id / jefe_directo_id
 */
function buildSubordinatesIndex(empleados) {
  SubordinateIds.clear();
  const myId = KB.CURRENT_USER_ID != null ? Number(KB.CURRENT_USER_ID) : null;
  if (!myId || !Array.isArray(empleados)) return;

  empleados.forEach((emp) => {
    if (!emp) return;

    const reportsTo =
      emp.reporta_a_id ??
      emp.reporta_a ??
      emp.jefe_id ??
      emp.jefe_directo_id ??
      null;

    const bossId = reportsTo != null ? Number(reportsTo) : null;

    if (bossId === myId && emp.id != null) {
      SubordinateIds.add(Number(emp.id));
    }
  });

  log(
    "Subordinados detectados para viewer (reporta_a):",
    Array.from(SubordinateIds)
  );
}

// Módulo del drawer (se inicializa en init)
let DetailsModule = null;

/** Normalizar tarea cruda desde API */
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
   4) Fetch de datos (TAREAS, EMPLEADOS, DEPARTAMENTOS, PROCESOS, TRÁMITES, REQS)
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

      primera_linea: d.primera_linea != null ? Number(d.primera_linea) : null,
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
   5) Reglas de negocio (jerarquías: ver/mover)
   ========================================================================== */

/**
 * Determina si el viewer actual es "privilegiado" para esta tarea:
 * - Admin
 * - Presidencia
 * - Director del departamento dueño del requerimiento/tarea
 */
function isPrivilegedForTask(task) {
  const roles = Array.isArray(Viewer.roles) ? Viewer.roles : [];

  // Admin o Presidencia → super permisos
  if (
    roles.includes("ADMIN") ||
    roles.includes("PRES") ||
    Viewer.isAdmin ||
    Viewer.isPres
  ) {
    return true;
  }

  // Director / Primera línea del departamento de la tarea → permisos tipo admin pero acotados al depto
  const deptId = task?.departamento_id ?? null;
  if (!deptId) return false;

  const dep = State.departamentosIndex.get(deptId);
  if (!dep) return false;

  const me = KB.CURRENT_USER_ID != null ? Number(KB.CURRENT_USER_ID) : null;
  if (me == null) return false;

  const isDirector = dep.director != null && Number(dep.director) === me;
  const isPrimeraLinea = dep.primera_linea != null && Number(dep.primera_linea) === me;

  return Boolean(isDirector || isPrimeraLinea);
}

// Orden lógico del flujo para saber qué es "adelante" y qué es "atrás"
const STATUS_ORDER = {
  [KB.STATUS.TODO]: 1,
  [KB.STATUS.PROCESO]: 2,
  [KB.STATUS.REVISAR]: 3,
  [KB.STATUS.HECHO]: 4,
};

/** Mensaje de por qué NO se puede mover una tarea */
function getForbiddenMoveMessage(task, oldStatus, newStatus) {
  const S = KB.STATUS;
  const roles = Array.isArray(Viewer.roles)
    ? Viewer.roles.map((r) => String(r).toUpperCase())
    : [];

  const isAnalista = Viewer.isAnalista || roles.includes("ANALISTA");
  const isJefe = Viewer.isJefe || roles.includes("JEFE");

  // Intento de mandar a HECHO
  if (newStatus === S.HECHO) {
    if (isAnalista || isJefe) {
      return 'Solo el director de tu departamento puede colocar la tarea en "hecho".';
    }
    return 'No tienes permisos para colocar esta tarea en "hecho".';
  }

  // Desde bloqueado a otro que no sea PROCESO
  if (oldStatus === S.PAUSA && newStatus !== S.PROCESO) {
    return 'Para salir de "bloqueado" primero coloca la tarea en "en proceso".';
  }

  const oldOrder = STATUS_ORDER[oldStatus] ?? null;
  const newOrder = STATUS_ORDER[newStatus] ?? null;

  // Intento de retroceso en el flujo
  if (oldOrder != null && newOrder != null && newOrder < oldOrder) {
    return "No puedes regresar la tarea a un estado anterior. Pide apoyo a tu director si necesitas hacer un ajuste.";
  }

  // Sin permisos básicos
  if (
    !Viewer.isAdmin &&
    !Viewer.isPres &&
    !Viewer.isDirector &&
    !Viewer.isJefe
  ) {
    return "Solo puedes mover tus propias tareas dentro del flujo permitido.";
  }

  return "No tienes permisos para mover esta tarea a ese estado.";
}

/**
 * Reglas de movimiento entre columnas según rol.
 * - Director/Admin: pueden todo.
 * - Jefes/Analistas:
 *   - No pueden mandar a HECHO.
 *   - Pueden mandar a PAUSA desde cualquier estado.
 *   - No pueden regresar hacia atrás en el flujo (TODO → PROCESO → REVISAR → HECHO).
 *   - Desde PAUSA pueden volver al flujo (salvo HECHO).
 *
 *  Mapa explícito de movimientos permitidos:
 *    1 → 2, 1 → 3, 2 → 3
 *    1/2/3 → 5
 *    5 → 2
 */
function canMoveTask(task, oldStatus, newStatus) {
  if (oldStatus === newStatus) return true;

  const S = KB.STATUS;

  const privileged = isPrivilegedForTask(task);
  if (privileged) {
    // Admin / Pres / Director del depto → pueden hacer cualquier movimiento
    return true;
  }

  // ================================
  //  Usuarios NO privilegiados
  //  (JEFE, ANALISTA, etc.)
  // ================================

  const roles = Array.isArray(Viewer.roles) ? Viewer.roles : [];

  // ¿La tarea es "mía"?
  const isOwner =
    KB.CURRENT_USER_ID != null &&
    task.asignado_a != null &&
    Number(task.asignado_a) === Number(KB.CURRENT_USER_ID);

  // ¿La tarea es de mi departamento?
  const sameDept =
    Viewer.deptId != null &&
    task.departamento_id != null &&
    Number(task.departamento_id) === Number(Viewer.deptId);

  // Regla de quién puede tocar la tarjeta:
  //  - JEFE: puede mover cualquier tarea de su departamento
  //  - Otros (ANALISTA, etc.): solo sus propias tareas
  let canTouch = false;
  if (roles.includes("JEFE")) {
    canTouch = sameDept || isOwner;
  } else {
    canTouch = isOwner;
  }

  if (!canTouch) {
    return false;
  }

  // Nunca pueden mandar a HECHO (4)
  if (newStatus === S.HECHO) {
    return false;
  }

  const key = `${oldStatus}->${newStatus}`;

  // Mapa explícito de movimientos permitidos para JEFE/ANALISTA
  const allowedMoves = new Set([
    // Flujo progresivo principal
    `${S.TODO}->${S.PROCESO}`, // 1 → 2  (Por hacer → En proceso)
    `${S.TODO}->${S.REVISAR}`, // 1 → 3  (Por hacer → Por revisar)
    `${S.PROCESO}->${S.REVISAR}`, // 2 → 3  (En proceso → Por revisar)

    // Hacia bloqueado
    `${S.TODO}->${S.PAUSA}`, // 1 → 5  (Por hacer → Bloqueado)
    `${S.PROCESO}->${S.PAUSA}`, // 2 → 5  (En proceso → Bloqueado)
    `${S.REVISAR}->${S.PAUSA}`, // 3 → 5  (Por revisar → Bloqueado)

    // Desde bloqueado de regreso al flujo
    `${S.PAUSA}->${S.PROCESO}`, // 5 → 2  (Bloqueado → En proceso)
  ]);

  return allowedMoves.has(key);
}

/**
 * Qué tareas puede VER el usuario actual según jerarquías:
 * - Admin / Pres: todas las tareas.
 * - Director / Primera línea: todas las tareas de su departamento.
 * - Jefe: sus tareas + las tareas de sus subordinados.
 * - Analista (u otros): solo sus tareas asignadas.
 */
function canViewTask(task) {
  if (!task) return false;

  const myId = KB.CURRENT_USER_ID != null ? Number(KB.CURRENT_USER_ID) : null;

  // Admin / Pres → todo
  if (Viewer.isAdmin || Viewer.isPres) return true;

  const taskOwnerId = task.asignado_a != null ? Number(task.asignado_a) : null;
  const sameOwner = myId != null && taskOwnerId === myId;

  const deptId =
    task.departamento_id != null ? Number(task.departamento_id) : null;

  // Director / Primera línea → todo su depto
  if ((Viewer.isDirector || Viewer.isPrimeraLinea) && Viewer.deptId != null) {
    if (deptId != null && deptId === Number(Viewer.deptId)) {
      return true;
    }
  }

  // Jefe → sus tareas + subordinados
  if (Viewer.isJefe) {
    if (sameOwner) return true;
    if (taskOwnerId != null && SubordinateIds.has(taskOwnerId)) return true;
    return false;
  }

  // Analista / otros → solo propias
  if (sameOwner) return true;

  return false;
}

/* ==========================================================================
   6) Filtros (lógica de negocio)
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

  // Search (folio, proceso, id)
  const q = State.filters.search.trim().toLowerCase();
  if (q) {
    const hay =
      (task.folio || "").toLowerCase().includes(q) ||
      (task.proceso_titulo || "").toLowerCase().includes(q) ||
      String(task.id).includes(q);
    if (!hay) return false;
  }

  // Filtro "recientes" (últimos N días)
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
   7) UI: cards + board
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

  const task = getTaskById(id);
  if (task && MediaUI && MediaUI.setCurrentTask) {
    MediaUI.setCurrentTask(task);
  }

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
  // Limpiar columnas y contadores
  Object.values(COL_IDS).forEach((sel) => {
    const col = $(sel);
    if (col) col.innerHTML = "";
  });
  Object.entries(CNT_IDS).forEach(([, sel]) => {
    const lbl = $(sel);
    if (lbl) lbl.textContent = "(0)";
  });

  // 1) Tareas visibles según jerarquía + filtros
  const visibleTasks = [];
  for (const task of State.tasks) {
    if (!canViewTask(task)) continue;
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

  // 2) Actualizar filtros dinámicos según tareas que cumplen jerarquía + filtros
  if (FiltersModule && FiltersModule.updateAvailableOptions) {
    const universeTasks = State.tasks.filter(
      (t) => canViewTask(t) && passesFilters(t)
    );
    FiltersModule.updateAvailableOptions(universeTasks);
  }
}

/* ==========================================================================
   8) Drag & drop + persistencia
   ========================================================================== */

/**
 * Persistir el cambio de status en backend.
 * Extra: si entra a EN PROCESO → fecha_inicio = ahora
 *        si entra a HECHO     → fecha_fin    = ahora
 */
async function persistTaskStatus(task, newStatus, oldStatus) {
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
    updated_by: updatedBy,
  };

  // Si entra a EN PROCESO, actualizamos fecha_inicio
  if (oldStatus !== KB.STATUS.PROCESO && newStatus === KB.STATUS.PROCESO) {
    const now = nowAsSqlDateTime();
    payload.fecha_inicio = now;
    task.fecha_inicio = now;
  }

  // Si entra a HECHO, actualizamos fecha_fin
  if (oldStatus !== KB.STATUS.HECHO && newStatus === KB.STATUS.HECHO) {
    const now = nowAsSqlDateTime();
    payload.fecha_fin = now;
    task.fecha_fin = now;
  }

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
    task.updated_at = nowAsSqlDateTime();
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

          const msg = getForbiddenMoveMessage(task, oldStatus, newStatus);
          toast(msg, "warning");
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

        await persistTaskStatus(task, newStatus, oldStatus);
      },
    });
  });
}

// ======================================================================
// MEDIA / EVIDENCIAS – Modal "Subir evidencias" (Imágenes / Enlace)
// ======================================================================
const MediaUI = (() => {
  const TAG = "[Media]";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const log = (...a) => console.log(TAG, ...a);
  const err = (...a) => console.error(TAG, ...a);
  const toast = (m, t = "info") =>
    window.gcToast ? gcToast(m, t) : log("[toast]", t, m);

  // Referencias DOM
  let btnOpenDrawerUpload; // #kb-evid-upload (tile del drawer)
  let modal; // #ix-evid-modal
  let modalCloseBtn; // .modal-close
  let btnCancel; // #ix-evid-cancel
  let btnSave; // #ix-evid-save

  let tabFile; // #ix-tab-file
  let tabLink; // #ix-tab-link
  let fileGroup; // #ix-file-group
  let urlGroup; // #ix-url-group

  let uploadZone; // #ix-upload-zone
  let ctaFileBtn; // #ix-evidencia-cta
  let fileInput; // #ix-evidencia
  let previewsWrap; // #ix-evidencia-previews
  let errFiles; // #ix-err-evidencia

  let urlInput; // #ix-url-input
  let errUrl; // #ix-err-url

  // Estado interno
  let currentTaskId = null;
  let currentFolio = null; // folio REQ-##########
  let currentStatus = 0; // 0..6 (lo derivaremos del status de la tarea)
  let mode = "file"; // "file" | "link"
  let selectedFiles = [];

  const MAX_FILES = 3;
  const MAX_SIZE_MB = 1;

  // Normaliza cualquier folio tipo "REQ-123", "REQ-0000000123" a REQ-0000000123 (10 dígitos)
  function normalizeFolio(anyFolio) {
    const m = String(anyFolio || "").match(/\d+/);
    if (!m) return null;
    const digits = m[0];
    const padded = digits.slice(-10).padStart(10, "0");
    return `REQ-${padded}`;
  }

  // ------------------------------------------------
  // API pública para que tareas.js le diga la tarea
  // ------------------------------------------------
  function setCurrentTask(task) {
    currentTaskId = task && task.id ? task.id : null;

    let fol = null;

    if (task) {
      // 1) Intentar con el folio que ya trae la tarea
      if (task.folio) {
        fol = normalizeFolio(task.folio);
      }

      // 2) Si no, intentamos leerlo desde ReqCache usando requerimiento_id
      if (!fol && task.requerimiento_id && typeof ReqCache !== "undefined") {
        const req = ReqCache.get?.(task.requerimiento_id);
        if (req?.folio) {
          fol = normalizeFolio(req.folio);
        }
      }
    }

    currentFolio = fol;
    currentStatus = task && task.status != null ? Number(task.status) || 0 : 0;

    log("setCurrentTask →", {
      taskId: currentTaskId,
      folio: currentFolio,
      statusFolder: currentStatus,
    });
  }

  // Inicializar listeners (llamar UNA vez en boot)
  function init() {
    btnOpenDrawerUpload = $("#kb-evid-upload");
    if (!btnOpenDrawerUpload) {
      log("No hay #kb-evid-upload en esta vista, MediaUI inactivo");
      return;
    }

    modal = $("#ix-evid-modal");
    if (!modal) {
      log("No hay #ix-evid-modal, MediaUI inactivo");
      return;
    }

    modalCloseBtn = modal.querySelector(".modal-close");
    btnCancel = $("#ix-evid-cancel");
    btnSave = $("#ix-evid-save");

    tabFile = $("#ix-tab-file");
    tabLink = $("#ix-tab-link");
    fileGroup = $("#ix-file-group");
    urlGroup = $("#ix-url-group");

    uploadZone = $("#ix-upload-zone");
    ctaFileBtn = $("#ix-evidencia-cta");
    fileInput = $("#ix-evidencia");
    previewsWrap = $("#ix-evidencia-previews");
    errFiles = $("#ix-err-evidencia");

    urlInput = $("#ix-url-input");
    errUrl = $("#ix-err-url");

    // Abrir modal desde el drawer
    btnOpenDrawerUpload.addEventListener("click", onOpenClick);

    // Tabs (Imágenes / Enlace)
    tabFile?.addEventListener("click", () => switchMode("file"));
    tabLink?.addEventListener("click", () => switchMode("link"));

    // Cerrar modal
    modalCloseBtn?.addEventListener("click", closeModal);
    btnCancel?.addEventListener("click", closeModal);

    // Fondo: cerrar al click fuera
    modal.addEventListener("click", (ev) => {
      if (ev.target === modal) closeModal();
    });

    // Botón de subir (confirmación)
    btnSave?.addEventListener("click", onSave);

    // Selección de archivos
    ctaFileBtn?.addEventListener("click", () => fileInput?.click());
    fileInput?.addEventListener("change", onFilesSelected);

    // Drag & drop
    if (uploadZone) {
      uploadZone.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        uploadZone.classList.add("is-dragover");
      });
      uploadZone.addEventListener("dragleave", () =>
        uploadZone.classList.remove("is-dragover")
      );
      uploadZone.addEventListener("drop", (ev) => {
        ev.preventDefault();
        uploadZone.classList.remove("is-dragover");
        if (ev.dataTransfer?.files?.length) {
          handleFiles(ev.dataTransfer.files);
        }
      });
    }

    // URL (modo enlace)
    urlInput?.addEventListener("input", validateUrl);

    log("MediaUI inicializado");
  }

  // -----------------------
  // Abrir / cerrar modal
  // -----------------------
  function onOpenClick() {
    if (!currentTaskId) {
      toast("Primero selecciona una tarea para subir evidencias.", "warning");
      return;
    }
    if (!currentFolio) {
      toast(
        "No se encontró el folio del requerimiento para esta tarea.",
        "warning"
      );
      return;
    }
    resetState();
    openModal();
  }

  function openModal() {
    if (!modal) return;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("me-modal-open");
  }

  function closeModal() {
    if (!modal) return;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("me-modal-open");
    resetState();
  }

  function resetState() {
    // modo por defecto: archivos
    mode = "file";
    selectedFiles = [];
    if (fileInput) fileInput.value = "";
    if (urlInput) urlInput.value = "";

    if (previewsWrap) previewsWrap.innerHTML = "";
    hideError(errFiles);
    hideError(errUrl);

    // tabs
    tabFile?.classList.add("is-active");
    tabLink?.classList.remove("is-active");
    if (fileGroup) fileGroup.hidden = false;
    if (urlGroup) urlGroup.hidden = true;

    updateSaveEnabled();
  }

  // -----------------------
  // Tabs de modo
  // -----------------------
  function switchMode(next) {
    if (mode === next) return;
    mode = next;

    const isFile = mode === "file";

    tabFile?.classList.toggle("is-active", isFile);
    tabLink?.classList.toggle("is-active", !isFile);

    if (fileGroup) fileGroup.hidden = !isFile;
    if (urlGroup) urlGroup.hidden = isFile;

    updateSaveEnabled();
  }

  // -----------------------
  // Archivos (imágenes)
  // -----------------------
  function onFilesSelected(ev) {
    const files = ev.target.files;
    if (!files) return;
    handleFiles(files);
  }

  function handleFiles(fileList) {
    hideError(errFiles);
    selectedFiles = [];

    const arr = Array.from(fileList || []);
    if (!arr.length) {
      updatePreviews();
      updateSaveEnabled();
      return;
    }

    const problems = [];
    for (const f of arr) {
      if (selectedFiles.length >= MAX_FILES) break;

      const sizeMb = f.size / (1024 * 1024);
      if (sizeMb > MAX_SIZE_MB) {
        problems.push(`"${f.name}" excede ${MAX_SIZE_MB} MB`);
        continue;
      }

      // Validaciones extra si quieres (tipo mime, etc.)
      selectedFiles.push(f);
    }

    if (!selectedFiles.length) {
      showError(
        errFiles,
        problems.length
          ? problems.join(". ")
          : "Los archivos seleccionados no son válidos."
      );
    } else if (problems.length) {
      showError(
        errFiles,
        problems.join(". ") + " Solo se subirán los archivos válidos restantes."
      );
    }

    updatePreviews();
    updateSaveEnabled();
  }

  function updatePreviews() {
    if (!previewsWrap) return;
    previewsWrap.innerHTML = "";

    if (!selectedFiles.length) return;

    selectedFiles.forEach((file) => {
      const item = document.createElement("div");
      item.className = "ix-thumb";

      const img = document.createElement("img");
      img.alt = file.name;
      img.loading = "lazy";

      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);

      const caption = document.createElement("div");
      caption.className = "ix-thumb__name";
      caption.textContent = file.name;

      item.appendChild(img);
      item.appendChild(caption);
      previewsWrap.appendChild(item);
    });
  }

  // -----------------------
  // URL (enlace externo)
  // -----------------------
  function validateUrl() {
    hideError(errUrl);

    const value = (urlInput?.value || "").trim();

    if (!value) {
      updateSaveEnabled();
      return;
    }

    updateSaveEnabled();
  }

  // -----------------------
  // Habilitar / deshabilitar botón "Subir"
  // -----------------------
  function updateSaveEnabled() {
    if (!btnSave) return;

    let enabled = false;

    if (mode === "file") {
      const hasFiles = selectedFiles.length > 0;
      const hasError = errFiles && !errFiles.hidden;
      enabled = hasFiles && !hasError;
    } else {
      const value = (urlInput?.value || "").trim();
      const hasError = errUrl && !errUrl.hidden;
      enabled = !!value && !hasError;
    }

    btnSave.disabled = !enabled;
  }

  // -----------------------
  // Guardar: subir al backend
  // -----------------------
  async function onSave() {
    if (!currentTaskId) {
      toast("No hay tarea seleccionada.", "error");
      return;
    }

    try {
      if (mode === "file") {
        await uploadFiles();
      } else {
        await uploadLink();
      }

      closeModal();

      // IMPORTANTE: refrescar las evidencias del drawer
      if (typeof loadEvidenciasForTask === "function") {
        loadEvidenciasForTask(currentTaskId);
      }
    } catch (e) {
      err("Error al subir evidencias:", e);
      toast("Ocurrió un error al subir las evidencias.", "error");
    }
  }

  async function uploadFiles() {
    if (!selectedFiles.length) return;
    if (!currentFolio) {
      throw new Error("Sin folio del requerimiento para esta tarea.");
    }

    const statusFolder = Number(currentStatus ?? 0) || 0;

    // Asegura carpetas del folio (idempotente)
    try {
      await setupMedia(currentFolio, { create_status_txt: true });
    } catch (e) {
      log("setupMedia falló (no crítico):", e);
    }

    log("Subiendo archivos…", {
      folio: currentFolio,
      status: statusFolder,
      total: selectedFiles.length,
    });

    const out = await uploadMedia({
      folio: currentFolio,
      status: statusFolder,
      files: selectedFiles,
    });

    const saved = out?.saved?.length || 0;
    const failed = out?.failed?.length || 0;
    const skipped = out?.skipped?.length || 0;

    if (saved) toast(`Evidencias subidas: ${saved} archivo(s).`, "success");
    if (failed) toast(`Fallo servidor: ${failed} archivo(s).`, "danger");
    if (skipped) toast(`Descartados localmente: ${skipped}.`, "warn");
  }

  async function uploadLink() {
    const value = (urlInput?.value || "").trim();
    if (!value) return;
    if (!currentFolio) {
      throw new Error("Sin folio del requerimiento para esta tarea.");
    }

    const statusFolder = Number(currentStatus ?? 0) || 0;

    // Igual que en archivos: aseguramos carpetas (por si acaso)
    try {
      await setupMedia(currentFolio, { create_status_txt: true });
    } catch (e) {
      log("setupMedia (link) falló (no crítico):", e);
    }

    const res = await uploadMediaLink({
      folio: currentFolio,
      status: statusFolder,
      url: value,
    });

    const ok = !!res?.ok && Array.isArray(res?.saved) && res.saved.length > 0;
    if (ok) {
      toast("Enlace registrado como evidencia.", "success");
    } else {
      throw new Error(res?.error || "No se pudo registrar el enlace.");
    }
  }

  // -----------------------
  // Helpers de errores
  // -----------------------
  function showError(el, msg) {
    if (!el) return;
    el.textContent = msg || "";
    el.hidden = false;
  }

  function hideError(el) {
    if (!el) return;
    el.textContent = "";
    el.hidden = true;
  }

  // API pública
  return {
    init,
    setCurrentTask,
  };
})();

/* ==========================================================================
   9) Init: sesión, jerarquías, filtros, detalle
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

  log("Viewer info (parcial sesión):", {
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

  // --------------------------------------------------------------------
  // 1) Evitar flicker del sidebar: lo dejamos oculto hasta decidir rol
  // --------------------------------------------------------------------
  const sidebarFiltersEl = $(".kb-sidebar-filters");
  const sidebarDeptFieldEl = $("#kb-filter-departamentos");
  const sidebarEmpFieldEl = $("#kb-filter-empleados");

  if (sidebarFiltersEl) {
    sidebarFiltersEl.classList.add("kb-filters-boot-hidden");
  }

  // --------------------------------------------------------------------
  // 2) Cargar datos base
  // --------------------------------------------------------------------
  const [empleados, depts, procesos, tramites, tareasRaw] = await Promise.all([
    fetchEmpleadosForFilters(),
    fetchDepartamentos(),
    fetchProcesosCatalog(),
    fetchTramitesCatalog(),
    fetchTareasFromApi(),
  ]);

  // --------------------------------------------------------------------
  // 3) Indexes globales
  // --------------------------------------------------------------------
  empleados.forEach((emp) => {
    if (emp?.id != null) {
      State.empleadosIndex.set(emp.id, emp);
    }
  });
  log("Index empleados (global):", State.empleadosIndex);

  // Subordinados de viewer
  buildSubordinatesIndex(empleados);

  depts.forEach((d) => {
    if (d?.id != null) {
      State.departamentosIndex.set(d.id, d);
    }
  });
  log("Index departamentos:", State.departamentosIndex);

  procesos.forEach((p) => {
    if (p?.id != null) {
      State.procesosIndex.set(p.id, p);
    }
  });
  log("Index procesos:", State.procesosIndex);

  tramites.forEach((t) => {
    if (t?.id != null) {
      State.tramitesIndex.set(t.id, t);
    }
  });
  log("Index trámites:", State.tramitesIndex);

  // --------------------------------------------------------------------
  // 4) Enriquecer tareas con info de proceso / requerimiento
  // --------------------------------------------------------------------
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

  // --------------------------------------------------------------------
  // 5) Enriquecer con creado_por, depto, director (autoriza)
  // --------------------------------------------------------------------
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

  // --------------------------------------------------------------------
  // 6) Módulo de detalle
  // --------------------------------------------------------------------
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

  // 6.1) Módulo de evidencias (modal Imágenes/Enlace)
  if (MediaUI && MediaUI.init) {
    MediaUI.init();
  }

  // --------------------------------------------------------------------
  // 7) Jerarquías: normalizar roles + director/primera desde departamentos
  // --------------------------------------------------------------------
  const roles =
    Array.isArray(Viewer.roles) && Viewer.roles.length
      ? Viewer.roles.map((r) => String(r).toUpperCase())
      : [];

  // Normalizar flags a partir de roles
  Viewer.isAdmin = Viewer.isAdmin || roles.includes("ADMIN");
  Viewer.isPres = Viewer.isPres || roles.includes("PRES");
  Viewer.isDirector = Viewer.isDirector || roles.includes("DIRECTOR");
  Viewer.isJefe = Viewer.isJefe || roles.includes("JEFE");
  Viewer.isAnalista = Viewer.isAnalista || roles.includes("ANALISTA");

  // Director / primera línea con catálogo de departamentos
  if (KB.CURRENT_USER_ID != null && depts.length) {
    let isDirectorFromDepts = false;
    let isPrimeraLineaFromDepts = false;

    depts.forEach((d) => {
      if (!d) return;
      const dirId = d.director != null ? Number(d.director) : null;
      const primeraId =
        d.primera_linea != null ? Number(d.primera_linea) : null;

      if (dirId === Number(KB.CURRENT_USER_ID)) {
        isDirectorFromDepts = true;
      }
      if (primeraId === Number(KB.CURRENT_USER_ID)) {
        isPrimeraLineaFromDepts = true;
      }
    });

    Viewer.isDirector = Viewer.isDirector || isDirectorFromDepts;
    Viewer.isPrimeraLinea = !!isPrimeraLineaFromDepts;
  }

  log("Viewer (después de roles + deptos):", Viewer);

  // --------------------------------------------------------------------
  // 8) Decidir quién ve qué filtros del sidebar
  // --------------------------------------------------------------------
  // Detectar subordinados del viewer
  const hasSubordinates = SubordinateIds.size > 0;

  // Exponer snapshot para otros módulos
  KB.VIEWER = {
    ...Viewer,
    hasSubordinates,
  };

  const isAdminOrPres = Viewer.isAdmin || Viewer.isPres;
  const isDirectorOrPrimera = Viewer.isDirector || Viewer.isPrimeraLinea;
  const isJefe = Viewer.isJefe;
  const isAnalista = Viewer.isAnalista;

  let canSeeSidebar = false;
  let canSeeDeptFilter = false;
  let canSeeEmpFilter = false;

  if (isAdminOrPres) {
    // Admin / Presidencia → ven ambos filtros
    canSeeSidebar = true;
    canSeeDeptFilter = true;
    canSeeEmpFilter = true;
  } else if (isDirectorOrPrimera) {
    // Director / Primera línea → sólo empleados
    canSeeSidebar = true;
    canSeeDeptFilter = false;
    canSeeEmpFilter = true;
  } else if (isJefe) {
    // Jefe → sólo empleados y sólo si tiene subordinados
    canSeeSidebar = hasSubordinates;
    canSeeDeptFilter = false;
    canSeeEmpFilter = hasSubordinates;
  } else if (isAnalista) {
    // Analista → ningún filtro de sidebar
    canSeeSidebar = false;
    canSeeDeptFilter = false;
    canSeeEmpFilter = false;
  } else {
    // Otros roles → sin filtros de sidebar
    canSeeSidebar = false;
    canSeeDeptFilter = false;
    canSeeEmpFilter = false;
  }

  // Aplicar visibilidad real en el DOM
  if (sidebarFiltersEl) {
    if (!canSeeSidebar) {
      sidebarFiltersEl.classList.add("is-hidden-by-role");
    } else {
      sidebarFiltersEl.classList.remove("is-hidden-by-role");
    }
  }

  if (sidebarDeptFieldEl) {
    if (!canSeeDeptFilter) {
      sidebarDeptFieldEl.style.display = "none";
      sidebarDeptFieldEl.setAttribute("aria-hidden", "true");
    } else {
      sidebarDeptFieldEl.style.removeProperty("display");
      sidebarDeptFieldEl.removeAttribute("aria-hidden");
    }
  }

  if (sidebarEmpFieldEl) {
    if (!canSeeEmpFilter) {
      sidebarEmpFieldEl.style.display = "none";
      sidebarEmpFieldEl.setAttribute("aria-hidden", "true");
    } else {
      sidebarEmpFieldEl.style.removeProperty("display");
      sidebarEmpFieldEl.removeAttribute("aria-hidden");
    }
  }

  // --------------------------------------------------------------------
  // 9) Construir opciones para filtros (solo si los puede ver)
  // --------------------------------------------------------------------
  const allowedDeptIds = new Set();

  if (isAdminOrPres) {
    depts.forEach((d) => {
      if (d?.id != null) {
        allowedDeptIds.add(Number(d.id));
      }
    });
  } else if (Viewer.deptId != null) {
    allowedDeptIds.add(Number(Viewer.deptId));
  }

  // Quitar Presidencia del combo de departamentos
  PRES_DEPT_IDS.forEach((id) => allowedDeptIds.delete(id));

  log(
    "allowedDeptIds para filtros (sin Presidencia):",
    Array.from(allowedDeptIds)
  );

  let empleadosForFilter = [];

  if (isAdminOrPres) {
    empleadosForFilter = empleados;
  } else if (Viewer.deptId != null) {
    empleadosForFilter = empleados.filter(
      (e) => Number(e.departamento_id) === Number(Viewer.deptId)
    );
  } else {
    empleadosForFilter = empleados;
  }

  log(
    "Empleados visibles para combo (tras jerarquía):",
    empleadosForFilter.length,
    empleadosForFilter
  );

  const deptOptions = canSeeDeptFilter
    ? Array.from(allowedDeptIds).map((id) => {
        const dep = State.departamentosIndex.get(id);
        const label = dep ? dep.nombre : `Depto ${id}`;
        return { value: id, label };
      })
    : [];

  const empOptions = canSeeEmpFilter
    ? empleadosForFilter.map((emp) => {
        const label =
          emp.nombre_completo ||
          [emp.nombre, emp.apellidos].filter(Boolean).join(" ") ||
          `Empleado ${emp.id}`;
        return {
          value: emp.id,
          label,
        };
      })
    : [];

  const procesosOptions = procesos.map((p) => ({
    value: p.id,
    label: p.descripcion?.trim() || `Proceso ${p.id}`,
  }));

  const tramitesOptions = tramites.map((t) => ({
    value: t.id,
    label: t.nombre || `Trámite ${t.id}`,
  }));

  // --------------------------------------------------------------------
  // 10) UI – Filtros + tablero
  // --------------------------------------------------------------------
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

  // Sidebar listo → quitar clase de boot y mostrar si aplica
  if (sidebarFiltersEl) {
    sidebarFiltersEl.classList.remove("kb-filters-boot-hidden");
    if (
      canSeeSidebar &&
      !sidebarFiltersEl.classList.contains("is-hidden-by-role")
    ) {
      sidebarFiltersEl.classList.add("kb-filters-ready");
    }
  }

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
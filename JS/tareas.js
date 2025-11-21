// /JS/tareas.js – Demo local tablero de tareas (sin endpoints)
"use strict";

/* ============================================================================
   Config
   ========================================================================== */
const KB = {
  DEBUG: true,
  CURRENT_USER_ID: 12, // demo: para "Solo mis tareas"

  STATUS: {
    TODO: 1,
    PROCESO: 2,
    REVISAR: 3,
    HECHO: 4,
    PAUSA: 5,
  },
};

const log = (...a) => KB.DEBUG && console.log("[KB]", ...a);
const warn = (...a) => KB.DEBUG && console.warn("[KB]", ...a);

/* ============================================================================
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

function calcAgeChip(task) {
  const base = task.fecha_inicio || task.created_at;
  const d = diffDays(base); // 0,1,2,...
  if (d == null) return null;

  // Días reales transcurridos (no negativos)
  const realDays = d < 0 ? 0 : d;

  // Índice de paleta: 1–9 según días, 10 = rojo (10+ días)
  let paletteIndex;
  if (realDays >= 10) {
    paletteIndex = 10; // 10 días o más → siempre rojo pastel
  } else if (realDays === 0) {
    paletteIndex = 1; // hoy mismo → primer color
  } else {
    paletteIndex = realDays; // 1..9 días
  }

  // Número que se ve en la card:
  // 0..99 → el número; 100+ → "99+"
  let display;
  if (realDays >= 100) {
    display = "99+";
  } else {
    display = String(Math.min(realDays, 99));
  }

  return {
    classIndex: paletteIndex, // para kb-age-X
    display, // texto que se ve
    realDays, // para tooltip
  };
}

/* ============================================================================
   Mock data (demo local)
   ========================================================================== */

// Procesos de demo (solo para mostrar nombre de proceso)
const MOCK_PROCESOS = {
  9: "Proceso: Fuga de agua",
  10: "Proceso: Bacheo",
  11: "Proceso: Poda de árbol",
  12: "Proceso: Manual",
  13: "Proceso: Difusor",
};

// Tareas de demo (basadas en tu JSON)
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
].map((t, idx) => ({
  ...t,
  folio: `REQ-${String(15000 + t.id).padStart(9, "0")}`,
  proceso_titulo: MOCK_PROCESOS[t.proceso_id] || `Proceso ${t.proceso_id}`,
  // display largo asignado
  asignado_display:
    t.asignado_display || `${t.asignado_nombre} ${t.asignado_apellidos}`,
}));

/* ============================================================================
   State
   ========================================================================== */

const State = {
  tasks: MOCK_TAREAS,
  selectedId: null,
  filters: {
    mine: true, // "Solo mis tareas" activo por defecto (como en tu captura)
    search: "",
  },
};

/* ============================================================================
   DOM refs
   ========================================================================== */

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

/* ============================================================================
   Render cards
   ========================================================================== */

function passesFilters(task) {
  // Solo mis tareas
  if (State.filters.mine && task.asignado_a !== KB.CURRENT_USER_ID)
    return false;

  // Buscar por folio o proceso
  const q = State.filters.search.trim().toLowerCase();
  if (q) {
    const hay =
      task.folio.toLowerCase().includes(q) ||
      task.proceso_titulo.toLowerCase().includes(q) ||
      String(task.id).includes(q);
    if (!hay) return false;
  }

  return true;
}

function createCard(task) {
  const age = calcAgeChip(task);

  const art = document.createElement("article");
  art.className = "kb-card";
  art.dataset.id = String(task.id);

  // Contenido principal
  const main = document.createElement("div");
  main.className = "kb-task-main";

  // Línea título: {proceso} / {id}
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

  // Folio
  const lineFolio = document.createElement("div");
  lineFolio.className = "kb-task-line";
  lineFolio.innerHTML = `<span class="kb-task-label">Folio:</span> <span class="kb-task-value kb-task-folio">${task.folio}</span>`;

  // Asignado
  const lineAsig = document.createElement("div");
  lineAsig.className = "kb-task-line";
  lineAsig.innerHTML = `<span class="kb-task-label">Asignado a:</span> <span class="kb-task-value kb-task-asignado">${task.asignado_display}</span>`;

  // Fecha de proceso
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

  // Click → abrir drawer (si no viene de un drag)
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
  Object.entries(CNT_IDS).forEach(([status, sel]) => {
    const lbl = $(sel);
    if (lbl) lbl.textContent = "(0)";
  });

  // Pintar tareas
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

/* ============================================================================
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

  // Mostrar cuerpo y ocultar texto vacío
  $("#kb-d-empty").hidden = true;
  $("#kb-d-body").hidden = false;

  // Abrir drawer + overlay
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

/* ============================================================================
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
    // Por ahora "Recientes" no hace nada especial en demo
    chipRecent.addEventListener("click", () => {
      chipRecent.classList.toggle("is-active");
      // TODO: lógica de recientes si quieres
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

/* ============================================================================
   Drag & drop (Sortable)
   ========================================================================== */

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
      onEnd(evt) {
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
          // si ya estaba abierto, actualiza highlight
          highlightSelected();
        }
      },
    });
  });
}

/* ============================================================================
   Init
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  try {
    setupToolbar();
    renderBoard();
    setupDragAndDrop();

    // Cierre del drawer
    const btnClose = $("#kb-d-close");
    const overlay = $("#kb-d-overlay");
    if (btnClose) btnClose.addEventListener("click", closeDetails);
    if (overlay) overlay.addEventListener("click", closeDetails);

    log("Tablero de tareas demo listo", {
      tareas: State.tasks.length,
    });
  } catch (e) {
    console.error("[KB] init error:", e);
  }
});

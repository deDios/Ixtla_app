// /JS/tareas.js
"use strict";

/* ============================================================================
   Configuración
   ========================================================================== */
const KB = {
  STORAGE_KEY: "kanban_demo_v2",
  DEBUG: true,
  // Columnas del tablero
  COLUMNS: [
    { id: "todo",    title: "Por Hacer"   },
    { id: "proceso", title: "En proceso"  },
    { id: "revisar", title: "Por revisar" },
    { id: "hecho",   title: "Hecho"       },
  ],
};

/* ============================================================================
   Helpers
   ========================================================================== */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const log  = (...a)=> KB.DEBUG && console.log("[KB]", ...a);
const warn = (...a)=> KB.DEBUG && console.warn("[KB]", ...a);

function uid() { return "k" + Math.random().toString(36).slice(2, 9); }

function formatDateMX(v) {
  if (!v) return "—";
  const d = new Date(String(v).replace(" ", "T"));
  if (isNaN(d)) return v;
  return d.toLocaleDateString("es-MX",{year:"numeric",month:"2-digit",day:"2-digit"});
}

/* ============================================================================
   Estado / Persistencia
   ========================================================================== */
let State = {
  // Mapa id -> item
  items: {},
  // Orden por columna (array de ids)
  lanes: {
    todo:    [],
    proceso: [],
    revisar: [],
    hecho:   [],
  },
  selectedId: null,
};

function loadState() {
  try {
    const raw = localStorage.getItem(KB.STORAGE_KEY);
    if (!raw) return null;
    const st = JSON.parse(raw);
    if (!st || !st.items || !st.lanes) return null;
    return st;
  } catch {
    return null;
  }
}
function saveState() {
  try {
    localStorage.setItem(KB.STORAGE_KEY, JSON.stringify(State));
  } catch(e) { warn("No se pudo guardar en localStorage:", e); }
}

/* ============================================================================
   Seed local (demo)
   ========================================================================== */
function seedMock() {
  const now  = new Date();
  const d = (iso) => iso; // ya damos fechas como 'YYYY-MM-DD' para mostrar bonito.

  // pequeña utilidad para crear ítems
  const mk = (o)=> {
    const id = o.id || uid();
    return [id, {
      id,
      folio: o.folio || null,
      tramite: o.tramite || "Otros",
      descripcion: o.descripcion || "",
      asignado: o.asignado || "(el usuario)",
      contacto: o.contacto || "—",
      tel: o.tel || "—",
      direccion: o.direccion || "—",
      creado: o.creado || formatDateMX(now),
      evidencias: Array.isArray(o.evidencias) ? o.evidencias : [],
    }];
  };

  const sampleImg = "/ASSETS/demo/evid1.jpg"; // sustituye por una imagen real si la tienes

  const rows = [
    { id: "9001", folio: "REQ-000009001", tramite: "Fuga de agua",
      descripcion: "Vimos una fuga de agua en una casa amarilla de dos pisos; ya lleva más de 3 horas tirando agua.",
      asignado: "(el usuario)", contacto: "Luis Enrique Mendez", tel: "33 3333 3333",
      direccion: "Vicente Guerrero #13, 45850, Centro",
      creado: d("2025-09-02"),
      evidencias: [sampleImg]
    },
    { id: "9002", folio: "REQ-000009002", tramite: "Fuga de drenaje",
      descripcion: "Sale agua con olor a drenaje frente a la guardería.",
      asignado: "(el usuario)", contacto: "Elsa Diana Rubio", tel: "33 3816 0436",
      direccion: "Independencia, Ixtlahuacán",
      creado: d("2025-09-02")
    },
    { id: "9003", folio: "REQ-000009003", tramite: "No disponemos de agua",
      descripcion: "Llevamos dos días sin agua por ruptura de mangueras.",
      asignado: "(el usuario)", contacto: "Oscar Contreras", tel: "33 1546 8423",
      direccion: "Jesús Barajas 49, Luis García",
      creado: d("2025-09-02")
    },
    { id: "9004", folio: "REQ-000009004", tramite: "Reportar Bache",
      descripcion: "Bache grande que se llena de agua y afecta el tránsito.",
      asignado: "(el usuario)", contacto: "María Fernanda", tel: "33 2217 8987",
      direccion: "Privada La Lima 30-7, Puerta del Sol",
      creado: d("2025-10-08")
    },
    { id: "9005", folio: "REQ-000009005", tramite: "Lámpara Apagada",
      descripcion: "Luminaria frente al domicilio no enciende.",
      asignado: "(el usuario)", contacto: "Alberto Ascencio", tel: "33 1450 3516",
      direccion: "Privada F. I. Madero #220",
      creado: d("2025-10-02")
    },
    // más tarjetas para llenar columnas
    { id: "9006", folio: "REQ-000009006", tramite: "Otros",
      descripcion: "Solicitud general.",
      asignado: "(el usuario)", contacto: "Pamela Montes", tel: "33 2761 5370",
      direccion: "Loma Azul #200",
      creado: d("2025-10-08")
    },
    { id: "9007", folio: "REQ-000009007", tramite: "Fuga de agua",
      descripcion: "Fuga en banqueta frente a #76.",
      asignado: "(el usuario)", contacto: "Santiago Manzo", tel: "33 1752 9218",
      direccion: "Olivo Japonés #76, Valle de los Olivos",
      creado: d("2025-10-23")
    },
    { id: "9008", folio: "REQ-000009008", tramite: "Fuga de drenaje",
      descripcion: "Olor a drenaje en esquina.",
      asignado: "(el usuario)", contacto: "Sandra C. Andrade", tel: "33 1215 8080",
      direccion: "Camino a la Estación #305",
      creado: d("2025-10-20")
    },
    { id: "9009", folio: "REQ-000009009", tramite: "Otros",
      descripcion: "Petición varias.",
      asignado: "(el usuario)", contacto: "Nayeli Ochoa", tel: "33 1721 2434",
      direccion: "C. Cristóbal Colón #85",
      creado: d("2025-10-02")
    },
    { id: "9010", folio: "REQ-000009010", tramite: "No disponemos de agua",
      descripcion: "Varias viviendas afectadas.",
      asignado: "(el usuario)", contacto: "Antonio Carmona", tel: "33 3198 0882",
      direccion: "García Herrera #19",
      creado: d("2025-10-03")
    },
  ];

  const items = {};
  rows.forEach(r => {
    const [id, obj] = mk(r);
    items[id] = obj;
  });

  // repartir items en columnas para la demo
  const ids = Object.keys(items);
  return {
    items,
    lanes: {
      todo:    ids.slice(0, 4),
      proceso: ids.slice(4, 7),
      revisar: ids.slice(7, 9),
      hecho:   ids.slice(9),
    },
    selectedId: ids[0] || null,
  };
}

/* ============================================================================
   Render UI
   ========================================================================== */
function ensureBoardHTML() {
  // Dentro de .hs-main insertamos el tablero si no existe
  const main = document.querySelector(".hs-main");
  if (!main) return;

  if (!$("#kb-board", main)) {
    const wrap = document.createElement("div");
    wrap.className = "kb-wrap";
    wrap.innerHTML = `
      <section class="kb-board" id="kb-board" aria-label="Tablero Kanban">
        <div class="kb-cols" id="kb-cols"></div>
        <aside class="kb-details" id="kb-details">
          <div class="kb-d-empty">Selecciona una tarjeta para ver sus detalles</div>
          <div class="kb-d-body" hidden>
            <h3>Detalles de la asignación</h3>
            <p class="kb-d-field"><strong>Reporte:</strong><br><span id="kb-d-title">—</span></p>
            <p class="kb-d-field"><strong>Descripción:</strong><br><span id="kb-d-desc">—</span></p>
            <p class="kb-d-field"><strong>Asignado a:</strong><br><span id="kb-d-asignado">—</span></p>
            <p class="kb-d-field"><strong>Reportado por:</strong><br><span id="kb-d-contacto">—</span></p>
            <p class="kb-d-field"><strong>Fecha de solicitado:</strong><br><span id="kb-d-creado">—</span></p>
            <p class="kb-d-field"><strong>Dirección:</strong><br><span id="kb-d-direccion">—</span></p>
            <p class="kb-d-field"><strong>Teléfono del contacto:</strong><br><span id="kb-d-tel">—</span></p>
            <div class="kb-d-field">
              <strong>Evidencias:</strong>
              <div id="kb-d-evidencias" class="kb-evid-grid"></div>
            </div>
          </div>
        </aside>
      </section>
    `;
    main.appendChild(wrap);
  }
}

function renderColumns() {
  const cols = $("#kb-cols");
  if (!cols) return;

  cols.innerHTML = KB.COLUMNS.map(c => `
    <div class="kb-col" data-col="${c.id}">
      <div class="kb-col-head">${c.title}</div>
      <div class="kb-col-body" data-drop="${c.id}" aria-label="${c.title}" tabindex="0"></div>
    </div>
  `).join("");

  // rellenar tarjetas
  KB.COLUMNS.forEach(c => {
    const body = $(`.kb-col-body[data-drop="${c.id}"]`, cols);
    (State.lanes[c.id] || []).forEach(id => {
      const item = State.items[id];
      if (item) body.appendChild(cardEl(item));
    });
  });

  bindDnD();
}

function cardEl(item) {
  const el = document.createElement("article");
  el.className = "kb-card";
  el.draggable = true;
  el.setAttribute("data-id", item.id);
  el.innerHTML = `
    <div class="kb-card-bar"></div>
    <div class="kb-card-title">${item.tramite || "—"}</div>
    <div class="kb-card-meta">
      <div class="line"><span class="muted">Asignado a:</span> ${item.asignado || "(el usuario)"}</div>
      <div class="line"><span class="muted">Fecha Solicitado:</span> ${formatDateMX(item.creado)}</div>
    </div>
  `;

  // selección → panel de detalles
  el.addEventListener("click", () => {
    State.selectedId = item.id;
    showDetails(item);
    highlightSelected();
  });
  // drag data
  el.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", item.id);
    e.dataTransfer.effectAllowed = "move";
    el.classList.add("is-dragging");
  });
  el.addEventListener("dragend", () => el.classList.remove("is-dragging"));
  return el;
}

function highlightSelected() {
  $$(".kb-card").forEach(c => c.classList.remove("is-selected"));
  if (State.selectedId) {
    const sel = $(`.kb-card[data-id="${CSS.escape(State.selectedId)}"]`);
    sel?.classList.add("is-selected");
  }
}

function showDetails(row) {
  const panel = $("#kb-details");
  const empty = $(".kb-d-empty", panel);
  const body  = $(".kb-d-body", panel);

  if (!row) {
    empty.hidden = false;
    body.hidden = true;
    return;
  }
  empty.hidden = true;
  body.hidden = false;

  $("#kb-d-title").textContent     = row.tramite || "—";
  $("#kb-d-desc").textContent      = row.descripcion || "—";
  $("#kb-d-asignado").textContent  = row.asignado || "(el usuario)";
  $("#kb-d-contacto").textContent  = row.contacto || "—";
  $("#kb-d-creado").textContent    = formatDateMX(row.creado);
  $("#kb-d-tel").textContent       = row.tel || "—";
  $("#kb-d-direccion").textContent = row.direccion || "—";

  // evidencias
  const wrap = $("#kb-d-evidencias");
  wrap.innerHTML = "";
  const evids = Array.isArray(row.evidencias) ? row.evidencias : [];
  if (!evids.length) {
    wrap.innerHTML = `<div class="muted" style="color:#6b7a78;font-size:.85rem;">Sin evidencias</div>`;
  } else {
    evids.forEach((src, i) => {
      const img = new Image();
      img.alt = `Evidencia ${i+1}`;
      img.src = src;
      wrap.appendChild(img);
    });
  }
}

/* ============================================================================
   Drag & Drop
   ========================================================================== */
function bindDnD() {
  // zonas de drop: las .kb-col-body
  $$(".kb-col-body").forEach(drop => {
    drop.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      drop.classList.add("is-over");
    });
    drop.addEventListener("dragleave", () => {
      drop.classList.remove("is-over");
    });
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      drop.classList.remove("is-over");
      const id = e.dataTransfer.getData("text/plain");
      if (!id) return;

      // mover visualmente
      const card = document.querySelector(`.kb-card[data-id="${CSS.escape(id)}"]`);
      if (card) drop.appendChild(card);

      // actualizar estado
      const targetCol = drop.getAttribute("data-drop");
      moveCardToColumn(id, targetCol);

      // opcionalmente seleccionar al soltar
      State.selectedId = id;
      showDetails(State.items[id]);
      highlightSelected();
      saveState();
    });
  });
}

function moveCardToColumn(cardId, colId) {
  // limpiar de todas las columnas
  Object.keys(State.lanes).forEach(k => {
    State.lanes[k] = State.lanes[k].filter(id => id !== cardId);
  });
  // agregar al final de la nueva
  if (!State.lanes[colId]) State.lanes[colId] = [];
  State.lanes[colId].push(cardId);
  log("mover", { cardId, colId, lanes: State.lanes });
}

/* ============================================================================
   Init
   ========================================================================== */
window.addEventListener("DOMContentLoaded", () => {
  try {
    ensureBoardHTML();

    const stored = loadState();
    if (stored) {
      State = stored;
    } else {
      State = seedMock();
      saveState();
    }

    renderColumns();
    highlightSelected();
    if (State.selectedId) showDetails(State.items[State.selectedId]);

    log("kanban listo", { items: Object.keys(State.items).length });
  } catch (e) {
    console.error("[KB] init error:", e);
  }
});

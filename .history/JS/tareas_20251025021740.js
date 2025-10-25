// /JS/tareas.js (DEMO LOCAL)
"use strict";

/* =================== Config =================== */
const KB = {
  DEBUG: true,
  STATUS_COLUMNS: [0, 3, 1, 6], // columnas presentes en el HTML
  LABEL_BY_STATUS: {
    0: "Solicitud",
    1: "Revisión",
    2: "Asignación",
    3: "En proceso",
    4: "Pausado",
    5: "Cancelado",
    6: "Finalizado",
  },
  LS_KEY: "kb_demo_rows_v1"
};

const log  = (...a)=> KB.DEBUG && console.log("[KanbanDemo]", ...a);
const warn = (...a)=> KB.DEBUG && console.warn("[KanbanDemo]", ...a);

/* =================== Helpers =================== */
const $id = (id)=>document.getElementById(id);
const $qs = (s,root=document)=>root.querySelector(s);
const escapeHtml = (s)=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");

/* =================== Mock data =================== */
function seedMock() {
  // Si ya hay datos en localStorage, no sobrescribas
  const existing = localStorage.getItem(KB.LS_KEY);
  if (existing) return JSON.parse(existing);

  const now = new Date();
  const base = [
    { id: 3623, folio: "REQ-0000003623", tramite: "Fuga de agua", departamento: "SAMAPA", asignado: "Juan Pablo", tel: "3318310524", creado: now.toISOString(), estatus: 3, contacto: "Karla ochoa", descripcion: "Entre la casa 58 y 60 existe una fuga." },
    { id: 3636, folio: "REQ-0000003636", tramite: "Fuga de drenaje", departamento: "SAMAPA", asignado: "Juan Pablo", tel: "3314386864", creado: now.toISOString(), estatus: 1, contacto: "Esmeralda Fuentes", descripcion: "Sale agua del drenaje junto a local." },
    { id: 15141, folio: "REQ-0000015141", tramite: "Lámpara Apagada", departamento: "Alumbrado Público", asignado: "Sin asignar", tel: "3317529218", creado: now.toISOString(), estatus: 0, contacto: "Santiago Manzo", descripcion: "Lámpara apagada en Olivo Japonés #76." },
    { id: 14421, folio: "REQ-0000014421", tramite: "No disponemos de agua", departamento: "SAMAPA", asignado: "Juan Pablo", tel: "3315468423", creado: now.toISOString(), estatus: 6, contacto: "Oscar Contreras", descripcion: "Se tronaron mangueras por maquinaria." },
    { id: 14429, folio: "REQ-0000014429", tramite: "Calle dañada", departamento: "Obras Públicas", asignado: "—", tel: "3318753264", creado: now.toISOString(), estatus: 0, contacto: "Guadalupe Diane", descripcion: "Tramo con escurrimientos fuertes." },
  ];
  localStorage.setItem(KB.LS_KEY, JSON.stringify(base));
  return base;
}

function loadRows() {
  try {
    const raw = localStorage.getItem(KB.LS_KEY);
    return raw ? JSON.parse(raw) : seedMock();
  } catch {
    return seedMock();
  }
}

function saveRows(rows) {
  localStorage.setItem(KB.LS_KEY, JSON.stringify(rows));
}

/* =================== Store (para métricas) =================== */
const BoardStore = {
  list: [],
  index: new Map(), // id -> row
  load(rows) {
    this.list = Array.from(rows || []);
    this.index.clear();
    for (const r of this.list) this.index.set(r.id, r);
  },
  setStatus(id, estatus) {
    const r = this.index.get(id);
    if (!r) return;
    r.estatus = estatus;
    saveRows(this.list);
    window.dispatchEvent(new CustomEvent("kanban:changed", { detail: { id, estatus }}));
  },
  counts() {
    const out = {};
    for (const r of this.list) out[r.estatus] = (out[r.estatus] || 0) + 1;
    return out;
  },
  snapshot() {
    return { total: this.list.length, counts: this.counts() };
  }
};
window.getKanbanSnapshot = () => BoardStore.snapshot();

/* =================== Render =================== */
function clearBoard() {
  document.querySelectorAll(".kb-list").forEach(col => col.innerHTML = "");
  KB.STATUS_COLUMNS.forEach(s => {
    const el = $id(`kb-cnt-${s}`); if (el) el.textContent = "(0)";
  });
  showDetails(null);
}

function renderRows(rows = []) {
  BoardStore.load(rows);
  clearBoard();

  const colOf = (code) => $id(`kb-col-${code}`);
  const incCount = (code) => {
    const el = $id(`kb-cnt-${code}`);
    if (!el) return;
    const n = parseInt(String(el.textContent).replace(/\D/g,"") || "0", 10);
    el.textContent = `(${n+1})`;
  };

  rows.forEach(r => {
    const code = Number(r.estatus ?? 0);
    const target = colOf(KB.STATUS_COLUMNS.includes(code) ? code : 0);
    if (!target) return;

    const card = document.createElement("article");
    card.className = "kb-card";
    card.dataset.id = r.id;
    const folio = r.folio || ("REQ-" + String(r.id).padStart(11,"0"));

    card.innerHTML = `
      <div class="kb-title">${escapeHtml(r.tramite || "—")}</div>
      <div class="kb-meta">
        <span class="kb-folio">${escapeHtml(folio)}</span>
        <span class="kb-asignado">${escapeHtml(r.asignado || "Sin asignar")}</span>
      </div>
    `;
    card.addEventListener("click", () => showDetails(r));

    target.appendChild(card);
    incCount(code);
  });
}

/* =================== Detalles =================== */
function showDetails(row) {
  const panel = $id("kb-details");
  const empty = $qs(".kb-d-empty", panel);
  const body  = $qs(".kb-d-body", panel);

  if (!row) {
    empty.hidden = false;
    body.hidden = true;
    return;
  }
  empty.hidden = true;
  body.hidden = false;

  const folio = row.folio || ("REQ-" + String(row.id).padStart(11,"0"));
  $id("kb-d-title").textContent = row.tramite || "—";
  $id("kb-d-folio").textContent = folio;
  $id("kb-d-asignado").textContent = row.asignado || "Sin asignar";
  $id("kb-d-depto").textContent = row.departamento || "—";
  $id("kb-d-contacto").textContent = row.contacto || "—";
  $id("kb-d-tel").textContent = row.tel || "—";
  $id("kb-d-creado").textContent = row.creado || "—";
  $id("kb-d-status").textContent = KB.LABEL_BY_STATUS[row.estatus] || "—";
  $id("kb-d-desc").textContent = row.descripcion || "—";
}

/* =================== DnD =================== */
function initDnd() {
  document.querySelectorAll(".kb-list").forEach(list => {
    new Sortable(list, {
      group: "kanban",
      animation: 150,
      ghostClass: "is-ghost",
      dragClass: "is-dragging",
      onAdd: handleMove,
    });
  });
}

function handleMove(evt) {
  const el = evt.item;
  const id = Number(el?.dataset?.id);
  const toCol   = evt.to?.closest(".kb-col");
  const fromCol = evt.from?.closest(".kb-col");
  if (!Number.isFinite(id) || !toCol || !fromCol) return;

  const newStatus = Number(toCol.dataset.status);
  const oldStatus = Number(fromCol.dataset.status);
  log("move", { id, oldStatus, newStatus });

  // Guardamos en Store + localStorage (optimista, sin servidor)
  BoardStore.setStatus(id, newStatus);
  updateColumnCounts();
}

function updateColumnCounts() {
  const counts = KB.STATUS_COLUMNS.reduce((acc, s)=>(acc[s]=0,acc),{});
  document.querySelectorAll(".kb-col").forEach(col=>{
    const status = Number(col.dataset.status);
    const n = col.querySelectorAll(".kb-card").length;
    if (status in counts) counts[status] = n;
  });
  Object.entries(counts).forEach(([s,n])=>{
    const el = $id(`kb-cnt-${s}`); if (el) el.textContent = `(${n})`;
  });
}

/* =================== Init =================== */
window.addEventListener("DOMContentLoaded", () => {
  initDnd();
  const rows = loadRows();   // localStorage / seed
  renderRows(rows);

  // Atajo útil para exportar el tablero actual a consola
  window.exportKanban = () => {
    const snap = BoardStore.snapshot();
    console.log("KANBAN_SNAPSHOT", { rows: BoardStore.list, snapshot: snap });
    return { rows: BoardStore.list, snapshot: snap };
  };
});

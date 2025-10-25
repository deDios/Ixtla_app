 // /JS/tareas.js
"use strict";

/* =================== Config =================== */
const KB = {
  DEBUG: true,
  PAGE_SIZE_FETCH: 200,
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
};

const log  = (...a)=> KB.DEBUG && console.log("[Kanban]", ...a);
const warn = (...a)=> KB.DEBUG && console.warn("[Kanban]", ...a);

/* =================== API =================== */
import {
  planScope,
  fetchScope,
  parseReq,
  updateRequerimiento,
} from "/JS/api/requerimientos.js";
import { Session } from "/JS/auth/session.js";

/* =================== Store para métricas =================== */
const BoardStore = {
  // id -> { id, estatus, raw }
  byId: new Map(),
  load(rows = []) {
    this.byId.clear();
    for (const r of rows) {
      const code = Number(r?.estatus?.code ?? r?.raw?.estatus ?? -1);
      this.byId.set(r.id, { id: r.id, estatus: code, r });
    }
  },
  setStatus(id, estatus) {
    const cur = this.byId.get(id);
    if (!cur) return;
    const next = { ...cur, estatus };
    this.byId.set(id, next);
    window.dispatchEvent(new CustomEvent("kanban:changed", { detail: { id, estatus }}));
  },
  counts() {
    const out = {};
    for (const { estatus } of this.byId.values())
      out[estatus] = (out[estatus] || 0) + 1;
    return out;
  },
  snapshot() {
    return { total: this.byId.size, counts: this.counts() };
  }
};
window.getKanbanSnapshot = () => BoardStore.snapshot();

/* =================== Render =================== */
function byId(id){ return document.getElementById(id); }
function qs(sel,root=document){ return root.querySelector(sel); }

function clearBoard() {
  document.querySelectorAll(".kb-list").forEach(col => col.innerHTML = "");
  KB.STATUS_COLUMNS.forEach(s => {
    const el = byId(`kb-cnt-${s}`); if (el) el.textContent = "(0)";
  });
  showDetails(null);
}

function renderRows(rows = []) {
  BoardStore.load(rows);
  clearBoard();

  const colOf = (code) => byId(`kb-col-${code}`);
  const incCount = (code) => {
    const el = byId(`kb-cnt-${code}`);
    if (!el) return;
    const n = parseInt(String(el.textContent).replace(/\D/g,"") || "0", 10);
    el.textContent = `(${n+1})`;
  };

  rows.forEach(r => {
    // dest columna: si no existe la columna para su estatus, caemos en "Por Hacer" (0)
    const code = Number(r?.estatus?.code ?? r?.raw?.estatus ?? 0);
    const target = colOf(KB.STATUS_COLUMNS.includes(code) ? code : 0);
    if (!target) return;

    const card = document.createElement("article");
    card.className = "kb-card";
    card.dataset.id = r.id;

    // título = tramite / asunto; folio y asignado
    const folio = r.folio || ("REQ-" + String(r.id).padStart(11,"0"));
    card.innerHTML = `
      <div class="kb-title">${escapeHtml(r.tramite || r.asunto || "—")}</div>
      <div class="kb-meta">
        <span class="kb-folio">${escapeHtml(folio)}</span>
        <span class="kb-asignado">${escapeHtml(r.asignado || "Sin asignar")}</span>
      </div>
    `;

    // click = mostrar detalle
    card.addEventListener("click", () => showDetails(r));

    target.appendChild(card);
    incCount(target.id.split("kb-col-")[1] | 0);
  });
}

function escapeHtml(s){
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

/* =================== Detalles =================== */
function showDetails(row) {
  const panel = byId("kb-details");
  const empty = qs(".kb-d-empty", panel);
  const body  = qs(".kb-d-body", panel);

  if (!row) {
    empty.hidden = false;
    body.hidden = true;
    return;
  }
  empty.hidden = true;
  body.hidden = false;

  const folio = row.folio || ("REQ-" + String(row.id).padStart(11,"0"));
  byId("kb-d-title").textContent = row.tramite || row.asunto || "—";
  byId("kb-d-folio").textContent = folio;
  byId("kb-d-asignado").textContent = row.asignado || "Sin asignar";
  byId("kb-d-depto").textContent = row.departamento || row.raw?.departamento_nombre || "—";
  byId("kb-d-contacto").textContent = row.contacto || row.raw?.contacto_nombre || "—";
  byId("kb-d-tel").textContent = row.tel || row.raw?.contacto_telefono || "—";
  byId("kb-d-creado").textContent = row.creado || row.raw?.created_at || "—";
  const code = Number(row?.estatus?.code ?? row?.raw?.estatus ?? -1);
  byId("kb-d-status").textContent = KB.LABEL_BY_STATUS[code] || "—";
  byId("kb-d-desc").textContent = row.raw?.descripcion || "—";
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

async function handleMove(evt) {
  const el = evt.item;
  const id = Number(el?.dataset?.id);
  const toCol   = evt.to?.closest(".kb-col");
  const fromCol = evt.from?.closest(".kb-col");
  if (!Number.isFinite(id) || !toCol || !fromCol) return;

  const newStatus = Number(toCol.dataset.status);
  const oldStatus = Number(fromCol.dataset.status);
  log("move", { id, oldStatus, newStatus });

  // Optimistic UI: actualizamos store ya
  BoardStore.setStatus(id, newStatus);
  updateColumnCounts();

  try {
    await updateRequerimiento({ id, estatus: newStatus });
  } catch (e) {
    warn("PATCH falló, rollback", e);
    // Rollback visual
    const ref = evt.from.children[evt.oldIndex] || null;
    evt.from.insertBefore(el, ref);
    BoardStore.setStatus(id, oldStatus);
    updateColumnCounts();
  }
}

function updateColumnCounts() {
  const counts = KB.STATUS_COLUMNS.reduce((acc, s) => (acc[s]=0, acc), {});
  document.querySelectorAll(".kb-col").forEach(col => {
    const status = Number(col.dataset.status);
    const n = col.querySelectorAll(".kb-card").length;
    if (status in counts) counts[status] = n;
  });
  Object.entries(counts).forEach(([s,n])=>{
    const el = byId(`kb-cnt-${s}`); if (el) el.textContent = `(${n})`;
  });
}

/* =================== Data load =================== */
async function loadRows() {
  const s = Session?.get?.() || {};
  const viewerId  = s?.empleado_id ?? s?.id_empleado ?? null;
  const viewerDep = s?.departamento_id ?? null;
  if (!viewerId) {
    warn("Sin sesión/empleado_id."); 
    renderRows([]); 
    return [];
  }

  // Plan + fetch (usa la misma lógica consolidada del módulo de requerimientos)
  const plan = await planScope({ viewerId, viewerDeptId: viewerDep });
  const { items } = await fetchScope({ plan, filtros: {} });

  // parse UI
  const rows = items.map(parseReq);
  log("rows", rows.length);
  return rows;
}

/* =================== Init =================== */
window.addEventListener("DOMContentLoaded", async () => {
  try {
    initDnd();
    const rows = await loadRows();
    renderRows(rows);
  } catch (e) {
    warn("init error:", e);
  }
});

/* Opcional: si desde otra parte quieres re-renderizar */
window.addEventListener("kanban:render", async () => {
  const rows = await loadRows();
  renderRows(rows);
});

// /JS/ui/drawer.js
import { $, toggle } from "/JS/core/dom.js";
import { updateRequerimiento } from "/JS/api/requerimientos.js";
import { listMedia } from "/JS/api/media.js";

const TAG = "[Drawer]";
const drawer = $("#drawer-req");
const state = {
  open: false,
  row: null,
  mediaCache: {}
};

export const ReqDrawer = {
  open,
  close
};

// ====== ESTATUS ======
const ESTATUS = {
  0: { clave: "solicitud",  nombre: "Solicitud" },
  1: { clave: "revision",   nombre: "Revisión" },
  2: { clave: "asignacion", nombre: "Asignación" },
  3: { clave: "enProceso",  nombre: "En proceso" },
  4: { clave: "pausado",    nombre: "Pausado" },
  5: { clave: "cancelado",  nombre: "Cancelado" },
  6: { clave: "finalizado", nombre: "Finalizado" }
};

// ====== API ======
async function open(row) {
  if (!row) return;
  state.row = row;

  drawer?.setAttribute("aria-hidden", "false");
  toggle(drawer, true);
  state.open = true;

  // Popular datos básicos
  $("#d-folio").textContent       = row.folio || "—";
  $("#d-asunto").textContent      = row.asunto || "—";
  $("#d-descripcion").textContent = row.descripcion || "—";
  $("#d-dep").textContent         = row.departamento_nombre || "—";
  $("#d-contacto").textContent    = row.contacto_nombre || "—";
  $("#d-telefono").textContent    = row.contacto_telefono || "—";

  // Montar selects de estatus y media
  const el = {
    statusSel: $("#d-status"),
    img: {
      viewSel: $("#d-img-status-view"),
      upSel:   $("#d-img-status-up")
    }
  };

  mountStatusSelects(el.statusSel, el.img.viewSel, el.img.upSel);

  if (el.statusSel) el.statusSel.value = String(row.estatus ?? 0);
  if (el.img.viewSel) el.img.viewSel.value = String(row.estatus ?? 0);
  if (el.img.upSel)   el.img.upSel.value   = String(row.estatus ?? 0);

  // Cargar galería
  await loadGallery(row.folio, row.estatus);
}

function close() {
  toggle(drawer, false);
  drawer?.setAttribute("aria-hidden", "true");
  state.open = false;
  state.row = null;
}

// ====== STATUS SELECTS ======
function mountStatusSelects(...sels) {
  sels.forEach(sel => {
    if (!sel || !(sel instanceof HTMLElement) || sel.tagName !== "SELECT") return;
    sel.innerHTML = "";
    Object.keys(ESTATUS).forEach(k => {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = ESTATUS[k].nombre;
      sel.appendChild(o);
    });
  });
}

// ====== GALERÍA ======
async function loadGallery(folio, estatus) {
  const key = `${folio}-${estatus}`;
  if (state.mediaCache[key]) {
    renderGallery(state.mediaCache[key]);
    return;
  }
  try {
    const j = await listMedia(folio, estatus, 1, 50);
    state.mediaCache[key] = j;
    renderGallery(j);
  } catch (err) {
    console.error(TAG, "list media Error:", err);
    renderGallery({ data: [] }); // UI vacía
  }
}

function renderGallery(j) {
  const wrap = $("#d-gallery");
  if (!wrap) return;
  wrap.innerHTML = "";

  const arr = j?.data || [];
  if (!arr.length) {
    wrap.innerHTML = `<p class="muted">Sin imágenes para este estatus.</p>`;
    return;
  }

  arr.forEach(m => {
    const div = document.createElement("div");
    div.className = "img-thumb";
    div.innerHTML = `<img src="${m.url}" alt="${m.name}">`;
    wrap.appendChild(div);
  });
}

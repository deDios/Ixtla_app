// /JS/ui/drawer.js
import { updateRequerimiento } from "/JS/api/requerimientos.js";
import { setupMedia, listMedia, uploadMedia } from "/JS/api/media.js";

const TAG = "[Drawer]";

const ESTATUS = {
  0: { clave: "solicitud",  nombre: "Solicitud"  },
  1: { clave: "revision",   nombre: "Revisión"   },
  2: { clave: "asignacion", nombre: "Asignación" },
  3: { clave: "enProceso",  nombre: "En proceso" },
  4: { clave: "pausado",    nombre: "Pausado"    },
  5: { clave: "cancelado",  nombre: "Cancelado"  },
  6: { clave: "finalizado", nombre: "Finalizado" }
};

function nowISO() {
  const d = new Date(), p = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * Inicializa el drawer y devuelve controladores { open, close }
 * @param {{getSessionUserId:()=>number, onRowUpdated:(row:any)=>void}} opts
 */
export function initDrawer(opts = {}) {
  const overlay = document.getElementById("drawer-overlay");
  const panel   = document.getElementById("drawer-req");
  if (!panel) {
    console.warn(TAG, "No se encontró #drawer-req");
    return { open(){}, close(){} };
  }

  const el = {
    // header / meta
    folio:       document.getElementById("d-folio"),
    badge:       document.getElementById("d-badge"),
    dep:         document.getElementById("d-dep"),
    contacto:    document.getElementById("d-contacto"),
    telefono:    document.getElementById("d-telefono"),
    // detalle
    asunto:      document.getElementById("d-asunto"),
    descripcion: document.getElementById("d-descripcion"),
    // selects
    statusSel:         document.getElementById("d-status"),
    imgViewSel:        document.getElementById("d-img-status-view"),
    imgUpSel:          document.getElementById("d-img-status-up"),
    // imágenes
    imgFiles:          document.getElementById("d-img-files"),
    imgUploadBtn:      document.getElementById("d-img-upload"),
    gallery:           document.getElementById("d-gallery"),
    // cierre
    btnClose:          document.getElementById("d-close"),
  };

  const state = {
    open: false,
    row: null,
    mediaCache: {} // key "FOLIO-STATUS" => respuesta listMedia
  };

  // ---------- UI helpers ----------
  function show(open) {
    if (!panel) return;
    panel.hidden = false;
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    if (overlay) {
      overlay.hidden = !open;
      requestAnimationFrame(() => overlay.classList.toggle("open", open));
    }
    document.body.style.overflow = open ? "hidden" : "";
  }

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

  function fillHeader(r) {
    if (el.folio)    el.folio.textContent = r.folio || "—";
    if (el.dep)      el.dep.textContent = r.departamento_nombre || "—";
    if (el.contacto) el.contacto.textContent = r.contacto_nombre || "—";
    if (el.telefono) el.telefono.textContent = r.contacto_telefono || "—";

    const est = ESTATUS[Number(r.estatus)];
    if (el.badge) {
      el.badge.dataset.k = est?.clave || "";
      el.badge.textContent = est?.nombre || "—";
    }
    if (el.statusSel) el.statusSel.value = String(r.estatus ?? 0);
  }

  function fillDetalle(r) {
    if (el.asunto)      el.asunto.textContent = r.asunto || "—";
    if (el.descripcion) el.descripcion.textContent = r.descripcion || "—";
  }

  async function loadGallery(folio, status, force = false) {
    if (!el.gallery) return;
    const key = `${folio}-${status}`;
    if (!force && state.mediaCache[key]) {
      renderGallery(state.mediaCache[key]);
      return;
    }
    try {
      const resp = await listMedia(folio, status, 1, 100);
      state.mediaCache[key] = resp;
      renderGallery(resp);
    } catch (err) {
      console.error(TAG, "list media", err);
      renderGallery({ data: [] }); // vacío sin romper
    }
  }

  function renderGallery(resp) {
    const arr = resp?.data || [];
    el.gallery.innerHTML = "";
    if (!arr.length) {
      el.gallery.innerHTML = `<p class="muted">Sin imágenes para este estatus.</p>`;
      return;
    }
    arr.forEach(it => {
      const card = document.createElement("div");
      card.className = "img-thumb";
      const isImg = /^image\//.test(it.mime || "") && !/heic|heif/i.test(it.mime || "");
      card.innerHTML = isImg
        ? `<img src="${it.url}" alt="${it.name}">`
        : `<div style="height:160px;display:flex;align-items:center;justify-content:center;color:#6b7280">Archivo: ${it.mime?.split("/")[1] || "bin"}</div>`;
      el.gallery.appendChild(card);
    });
  }

  // ---------- API público ----------
  async function open(row) {
    if (!row) return;
    state.row = row;

    // idempotente: pre-crea directorios/urls para galería (si existe el endpoint)
    setupMedia(row.folio).catch(e => console.debug(TAG, "setupMedia opcional:", e?.message || e));

    // datos
    fillHeader(row);
    fillDetalle(row);

    // selects
    mountStatusSelects(el.statusSel, el.imgViewSel, el.imgUpSel);
    if (el.statusSel)  el.statusSel.value  = String(row.estatus ?? 0);
    if (el.imgViewSel) el.imgViewSel.value = String(row.estatus ?? 0);
    if (el.imgUpSel)   el.imgUpSel.value   = String(row.estatus ?? 0);

    // galería
    await loadGallery(row.folio, Number(row.estatus || 0), true);

    // abrir
    state.open = true;
    show(true);
  }

  function close() {
    state.open = false;
    show(false);
  }

  // ---------- Eventos ----------
  overlay?.addEventListener("click", close);
  el.btnClose?.addEventListener("click", close);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && state.open) close(); });

  // Cambiar estatus desde header
  el.statusSel?.addEventListener("change", async () => {
    if (!state.row) return;
    const newSt = Number(el.statusSel.value);
    const updatedBy = Number(opts.getSessionUserId?.() || 1);

    const payload = (newSt === 6)
      ? { id: state.row.id, estatus: 6, cerrado_en: nowISO(), updated_by: updatedBy }
      : { id: state.row.id, estatus: newSt, clear_cerrado: true, updated_by: updatedBy };

    try {
      const updated = await updateRequerimiento(payload);
      console.log(TAG, "Estatus actualizado:", updated);
      state.row = updated;
      fillHeader(updated);
      fillDetalle(updated);
      opts.onRowUpdated?.(updated);
      // refrescar galería para el estatus que se está viendo (si coincide con el nuevo)
      if (el.imgViewSel) {
        el.imgViewSel.value = String(newSt);
        loadGallery(updated.folio, newSt, true);
      }
    } catch (err) {
      console.error(TAG, "status change", err);
      // revertir UI
      if (el.statusSel) el.statusSel.value = String(state.row.estatus ?? 0);
    }
  });

  // Cambiar estatus “ver evidencia de”
  el.imgViewSel?.addEventListener("change", () => {
    if (!state.row) return;
    const st = Number(el.imgViewSel.value);
    loadGallery(state.row.folio, st, true);
  });

  // Subir evidencia
  el.imgUploadBtn?.addEventListener("click", async () => {
    if (!state.row) return;
    const files = el.imgFiles?.files || [];
    if (!files.length) {
      console.warn(TAG, "No hay archivos a subir.");
      return;
    }
    const dest = Number(el.imgUpSel?.value || state.row.estatus || 0);
    try {
      const r = await uploadMedia({ folio: state.row.folio, status: dest, files });
      console.log(TAG, "upload resp:", r);
      // refrescar si estamos viendo ese mismo status
      const v = Number(el.imgViewSel?.value || dest);
      if (v === dest) loadGallery(state.row.folio, dest, true);
      if (el.imgFiles) el.imgFiles.value = "";
    } catch (err) {
      console.error(TAG, "upload", err);
    }
  });

  return { open, close };
}

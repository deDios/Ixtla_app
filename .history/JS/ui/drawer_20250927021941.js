// /JS/ui/drawer.js
import { updateRequerimiento } from "/JS/api/requerimientos.js";
import { setupMedia, listMedia, uploadMedia } from "/JS/api/media.js";

const TAG = "[Drawer]";

const ESTATUS = {
  0: { clave: "solicitud",  nombre: "Solicitud"  },
  1: { clave: "revicion",   nombre: "Revición"   },
  2: { clave: "asignacion", nombre: "Asignación" },
  3: { clave: "enProceso",  nombre: "En proceso" },
  4: { clave: "pausado",    nombre: "Pausado"    },
  5: { clave: "cancelado",  nombre: "Cancelado"  },
  6: { clave: "finalizado", nombre: "Finalizado" }
};

function nowISO() {
  const d = new Date(), p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function initDrawer({ getSessionUserId, onRowUpdated }) {
  const overlay = document.querySelector('[data-drawer="overlay"]');
  const panel   = document.querySelector('[data-drawer="panel"]');
  if (!overlay || !panel) {
    console.warn(TAG, "No hay overlay o panel del drawer");
    return {};
  }

  const state = {
    open: false,
    row: null,       // objeto del requerimiento (como viene del listado)
    mediaCache: {},  // key `${folio}-${status}` -> {count, data[]}
  };

  // Elements
  const el = {
    folio: panel.querySelector(".ix-drw-folio"),
    badge: panel.querySelector(".badge-status"),
    meta: {
      tramite: panel.querySelector('[data-field="tramite_nombre"]'),
      dep:     panel.querySelector('[data-field="departamento_nombre"]'),
      asign:   panel.querySelector('[data-field="asignado_nombre_completo"]'),
      creado:  panel.querySelector('[data-field="created_at"]'),
    },
    // tabs
    tabs:     panel.querySelectorAll(".ix-drawer__tabs .tab"),
    panes:    panel.querySelectorAll(".drw-pane"),
    // detalle
    d: {
      asunto: panel.querySelector('[data-field="asunto"]'),
      desc:   panel.querySelector('[data-field="descripcion"]'),
      prio:   panel.querySelector('[data-field="prioridad"]'),
      canal:  panel.querySelector('[data-field="canal"]'),
      cnom:   panel.querySelector('[data-field="contacto_nombre"]'),
      ctel:   panel.querySelector('[data-field="contacto_telefono"]'),
      cemail: panel.querySelector('[data-field="contacto_email"]'),
      ccp:    panel.querySelector('[data-field="contacto_cp"]'),
      ccalle: panel.querySelector('[data-field="contacto_calle"]'),
      ccol:   panel.querySelector('[data-field="contacto_colonia"]'),
    },
    // form editar
    form: panel.querySelector(".ix-drawer__form"),
    // header status select
    statusSel: panel.querySelector('[data-drawer="statusSelect"]'),
    // imagenes
    img: {
      viewSel: panel.querySelector('[data-img="viewStatus"]'),
      upSel:   panel.querySelector('[data-img="uploadStatus"]'),
      files:   panel.querySelector('[data-img="files"]'),
      btn:     panel.querySelector('[data-img="uploadBtn"]'),
      grid:    panel.querySelector('[data-img="grid"]'),
      empty:   panel.querySelector('[data-img="empty"]'),
    },
    // footer
    btnEdit:   panel.querySelector('[data-action="editar"]'),
    btnSave:   panel.querySelector('[data-action="guardar"]'),
    btnDelete: panel.querySelector('[data-action="eliminar"]'),
    btnClose:  panel.querySelector('[data-drawer="close"]'),
  };

  // ---- Open/Close ----
  function open(row) {
    state.row = row;
    fillHeader(row);
    fillDetalle(row);
    fillForm(row);
    mountStatusSelects(el.statusSel, el.img.viewSel, el.img.upSel, row.estatus);

    // Setup media dirs (idempotente)
    setupMedia(row.folio).catch(err => console.warn(TAG, "setupMedia", err));

    // Por default, mostrar evidencia del estatus actual
    if (el.img.viewSel) {
      el.img.viewSel.value = String(row.estatus ?? 0);
      loadGallery(row.folio, Number(el.img.viewSel.value));
    }

    document.body.style.overflow = "hidden";
    overlay.hidden = false; panel.hidden = false;
    requestAnimationFrame(() => { overlay.classList.add("open"); panel.classList.add("open"); });
    state.open = true;
  }

  function close() {
    overlay.classList.remove("open");
    panel.classList.remove("open");
    document.body.style.overflow = "";
    setTimeout(() => { overlay.hidden = true; panel.hidden = true; state.open = false; }, 200);
  }

  overlay.addEventListener("click", close);
  el.btnClose?.addEventListener("click", close);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && state.open) close(); });

  // ---- Tabs ----
  el.tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      el.tabs.forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const tab = btn.dataset.tab;
      el.panes.forEach(p => p.classList.toggle("is-active", p.dataset.pane === tab));
    });
  });

  // ---- Header: cambiar estatus ----
  el.statusSel?.addEventListener("change", async () => {
    if (!state.row) return;
    const newStatus = Number(el.statusSel.value);
    const updatedBy = Number(getSessionUserId?.() || 1);
    const payload = (newStatus === 6)
      ? { id: state.row.id, estatus: 6, cerrado_en: nowISO(), updated_by: updatedBy }
      : { id: state.row.id, estatus: newStatus, clear_cerrado: true, updated_by: updatedBy };

    try {
      const updated = await updateRequerimiento(payload);
      gcToast("Estatus actualizado.", "exito");
      state.row = updated;
      // refrescar header, detalle y tabla externa
      fillHeader(updated);
      fillDetalle(updated);
      onRowUpdated?.(updated);
      // refrescar galería al nuevo estatus seleccionado
      if (el.img.viewSel) {
        el.img.viewSel.value = String(newStatus);
        loadGallery(updated.folio, newStatus, true);
      }
    } catch (err) {
      console.error(TAG, "status change", err);
      gcToast("Hubo un error, inténtalo más tarde.", "warning");
      // revert UI
      el.statusSel.value = String(state.row.estatus ?? 0);
    }
  });

  // ---- Footer: Editar/Guardar/Eliminar ----
  el.btnEdit?.addEventListener("click", () => {
    // Ir a tab Editar
    panel.querySelector('[data-tab="editar"]')?.click();
    el.btnSave.disabled = false;
  });

  el.btnSave?.addEventListener("click", async () => {
    if (!state.row || !el.form) return;
    const fd = new FormData(el.form);
    const patch = {};
    for (const [k,v] of fd.entries()) {
      if (k === "id" || k === "updated_by") continue;
      if (v !== "" && v !== null) patch[k] = v;
    }
    patch.id = state.row.id;
    patch.updated_by = Number(getSessionUserId?.() || 1);

    // Ajuste de tipos
    if (patch.prioridad) patch.prioridad = Number(patch.prioridad);
    if (patch.estatus)   patch.estatus   = Number(patch.estatus);
    if (patch.asignado_a) patch.asignado_a = Number(patch.asignado_a);

    // Reglas de cerrado_en
    if (Number(patch.estatus) === 6) {
      patch.cerrado_en = nowISO();
    } else if (patch.estatus !== undefined) {
      patch.clear_cerrado = true;
    }

    try {
      const updated = await updateRequerimiento(patch);
      gcToast("Guardado correctamente.", "exito");
      state.row = updated;
      fillHeader(updated);
      fillDetalle(updated);
      fillForm(updated);
      onRowUpdated?.(updated);
    } catch (err) {
      console.error(TAG, "save", err);
      gcToast("Hubo un error, inténtalo más tarde.", "warning");
    }
  });

  // Soft delete (cancelado=5)
  const modal = document.querySelector('[data-modal="delete"]');
  el.btnDelete?.addEventListener("click", () => {
    if (!modal) return;
    modal.hidden = false;
  });
  modal?.querySelector('[data-del="cancel"]')?.addEventListener("click", () => { modal.hidden = true; });
  modal?.querySelector('[data-del="confirm"]')?.addEventListener("click", async () => {
    if (!state.row) return;
    try {
      const updated = await updateRequerimiento({ id: state.row.id, estatus: 5, clear_cerrado: true, updated_by: Number(getSessionUserId?.() || 1) });
      gcToast("Requerimiento cancelado.", "exito");
      modal.hidden = true;
      state.row = updated;
      onRowUpdated?.(updated);
      close();
    } catch (err) {
      console.error(TAG, "soft delete", err);
      gcToast("Hubo un error, inténtalo más tarde.", "warning");
    }
  });

  // ---- Imágenes: listar/subir ----
  el.img.viewSel?.addEventListener("change", () => {
    if (!state.row) return;
    const st = Number(el.img.viewSel.value);
    loadGallery(state.row.folio, st, true);
  });

  el.img.btn?.addEventListener("click", async () => {
    if (!state.row) return;
    const files = el.img.files?.files || [];
    if (!files.length) { gcToast("Selecciona al menos un archivo.", "warning"); return; }
    const dest = Number(el.img.upSel?.value || state.row.estatus || 0);
    try {
      const j = await uploadMedia({ folio: state.row.folio, status: dest, files });
      console.log(TAG, "upload", j);
      if (j?.saved?.length) gcToast("Subida completada.", "exito");
      if (j?.failed?.length) console.warn(TAG, "Fallidos:", j.failed);
      // refrescar la vista actual si coincide con el dest
      const viewSt = Number(el.img.viewSel?.value || dest);
      if (viewSt === dest) {
        loadGallery(state.row.folio, dest, true);
      }
      // limpiar input
      el.img.files.value = "";
    } catch (err) {
      console.error(TAG, "upload", err);
      gcToast("Hubo un error, inténtalo más tarde.", "warning");
    }
  });

  // ---- Helpers de UI ----
  function mountStatusSelects(...sels) {
    sels.forEach(sel => {
      if (!sel) return;
      sel.innerHTML = "";
      Object.keys(ESTATUS).forEach(k => {
        const o = document.createElement("option");
        o.value = k;
        o.textContent = ESTATUS[k].nombre;
        sel.appendChild(o);
      });
      sel.value = String(state.row?.estatus ?? 0);
    });
  }

  function fillHeader(r) {
    el.folio.textContent = r.folio || "—";
    const est = ESTATUS[Number(r.estatus)];
    el.badge.dataset.k = est?.clave || "";
    el.badge.textContent = est?.nombre || "—";
    el.meta.tramite.textContent = r.tramite_nombre || "—";
    el.meta.dep.textContent = r.departamento_nombre || "—";
    el.meta.asign.textContent = r.asignado_nombre_completo || "—";
    el.meta.creado.textContent = r.created_at || "—";
    if (el.statusSel) el.statusSel.value = String(r.estatus ?? 0);
  }

  function fillDetalle(r) {
    el.d.asunto.textContent = r.asunto || "—";
    el.d.desc.textContent   = r.descripcion || "—";
    el.d.prio.textContent   = String(r.prioridad ?? "—");
    el.d.canal.textContent  = String(r.canal ?? "—");
    el.d.cnom.textContent   = r.contacto_nombre || "—";
    el.d.ctel.textContent   = r.contacto_telefono || "—";
    el.d.cemail.textContent = r.contacto_email || "—";
    el.d.ccp.textContent    = r.contacto_cp || "—";
    el.d.ccalle.textContent = r.contacto_calle || "—";
    el.d.ccol.textContent   = r.contacto_colonia || "—";
  }

  function fillForm(r) {
    if (!el.form) return;
    const m = new Map(Object.entries({
      id: r.id, asunto: r.asunto, descripcion: r.descripcion,
      prioridad: r.prioridad, estatus: r.estatus, asignado_a: r.asignado_a,
      contacto_nombre: r.contacto_nombre, contacto_telefono: r.contacto_telefono,
      contacto_email: r.contacto_email, contacto_cp: r.contacto_cp,
      contacto_calle: r.contacto_calle, contacto_colonia: r.contacto_colonia,
      updated_by: 0
    }));
    m.forEach((v,k) => { const f = el.form.elements.namedItem(k); if (f) f.value = (v ?? ""); });
    // estatus options
    const sel = el.form.querySelector('[name="estatus"]');
    if (sel && !sel.options.length) {
      Object.keys(ESTATUS).forEach(k => {
        const o = document.createElement("option"); o.value = k; o.textContent = ESTATUS[k].nombre; sel.appendChild(o);
      });
    }
  }

  async function loadGallery(folio, status, force = false) {
    const key = `${folio}-${status}`;
    if (!force && state.mediaCache[key]) {
      renderGallery(state.mediaCache[key]);
      return;
    }
    try {
      const j = await listMedia(folio, status, 1, 100);
      state.mediaCache[key] = j;
      renderGallery(j);
    } catch (err) {
      console.error(TAG, "list media", err);
      gcToast("No se pudo cargar la evidencia.", "warning");
    }
  }

  function renderGallery(resp) {
    const items = resp?.data || [];
    el.img.grid.innerHTML = "";
    el.img.empty.hidden = !!items.length;

    items.forEach(it => {
      const card = document.createElement("div");
      card.className = "img-card";
      const isImg = /^image\//.test(it.mime) && !/heic|heif/i.test(it.mime);
      const inner = isImg
        ? `<img src="${it.url}" loading="lazy" alt="${it.name}">`
        : `<div style="height:160px;display:flex;align-items:center;justify-content:center;color:#6b7280">Archivo: ${it.mime.split("/")[1] || it.mime}</div>`;
      card.innerHTML = `
        <div class="img-actions"></div>
        ${inner}
        <div class="img-name" title="${it.name}">${it.name}</div>
      `;
      el.img.grid.appendChild(card);
    });
  }

  return { open, close };
}

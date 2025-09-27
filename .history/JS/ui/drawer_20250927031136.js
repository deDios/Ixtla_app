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
 * Inicializa el drawer y devuelve { open, close }
 * @param {{getSessionUserId?:()=>number, onRowUpdated?:(row:any)=>void}} opts
 */
export function initDrawer(opts = {}) {
  const panel = document.querySelector('[data-drawer="panel"]');
  if (!panel) {
    console.warn(TAG, "No se encontró [data-drawer='panel']");
    return { open(){}, close(){} };
  }

  // ----- Elementos (HTML que compartiste) -----
  const el = {
    // header / meta
    folio: panel.querySelector(".ix-drw-folio"),
    badge: panel.querySelector(".badge-status"),
    meta: {
      tramite: panel.querySelector('[data-field="tramite_nombre"]'),
      dep: panel.querySelector('[data-field="departamento_nombre"]'),
      asignado: panel.querySelector('[data-field="asignado_nombre_completo"]'),
      creado: panel.querySelector('[data-field="created_at"]'),
    },
    // header status
    statusSelectHdr: panel.querySelector('[data-drawer="statusSelect"]'),

    // tabs
    tabs: Array.from(panel.querySelectorAll(".ix-drawer__tabs .tab")),
    panes: Array.from(panel.querySelectorAll(".ix-drawer__content .drw-pane")),

    // pane: detalle
    det: {
      asunto: panel.querySelector('[data-field="asunto"]'),
      descripcion: panel.querySelector('[data-field="descripcion"]'),
      prioridad: panel.querySelector('[data-field="prioridad"]'),
      canal: panel.querySelector('[data-field="canal"]'),
      c_nombre: panel.querySelector('[data-field="contacto_nombre"]'),
      c_tel: panel.querySelector('[data-field="contacto_telefono"]'),
      c_email: panel.querySelector('[data-field="contacto_email"]'),
      c_cp: panel.querySelector('[data-field="contacto_cp"]'),
      c_calle: panel.querySelector('[data-field="contacto_calle"]'),
      c_colonia: panel.querySelector('[data-field="contacto_colonia"]'),
    },

    // pane: editar (form)
    form: panel.querySelector(".ix-drawer__form"),
    f: {
      asunto: panel.querySelector("#f-asunto"),
      descripcion: panel.querySelector("#f-descripcion"),
      prioridad: panel.querySelector("#f-prioridad"),
      estatus: panel.querySelector("#f-estatus"),
      asignado: panel.querySelector("#f-asignado"),
      c_nombre: panel.querySelector("#f-contacto_nombre"),
      c_tel: panel.querySelector("#f-contacto_telefono"),
      c_email: panel.querySelector("#f-contacto_email"),
      c_cp: panel.querySelector("#f-contacto_cp"),
      c_calle: panel.querySelector("#f-contacto_calle"),
      c_colonia: panel.querySelector("#f-contacto_colonia"),
      id: panel.querySelector('input[name="id"]'),
      updated_by: panel.querySelector('input[name="updated_by"]'),
    },

    // pane: imágenes
    img: {
      viewSel: panel.querySelector('[data-img="viewStatus"]'),
      upSel:   panel.querySelector('[data-img="uploadStatus"]'),
      files:   panel.querySelector('[data-img="files"]'),
      btn:     panel.querySelector('[data-img="uploadBtn"]'),
      grid:    panel.querySelector('[data-img="grid"]'),
      empty:   panel.querySelector('[data-img="empty"]'),
    },

    // footer acciones
    act: {
      editar: panel.querySelector('[data-action="editar"]'),
      guardar: panel.querySelector('[data-action="guardar"]'),
      eliminar: panel.querySelector('[data-action="eliminar"]'),
    },

    // close
    closeBtn: panel.querySelector('[data-drawer="close"]'),
  };

  const state = {
    open: false,
    row: null,
    dirty: false,
    mediaCache: {} // key: `${folio}-${status}` => {data:[]...}
  };

  // -------- Helpers de UI --------
  function show(open) {
    if (open) {
      panel.classList.add("open");
      panel.setAttribute("aria-modal", "true");
    } else {
      panel.classList.remove("open");
      panel.removeAttribute("aria-modal");
    }
    state.open = open;
    document.body.style.overflow = open ? "hidden" : "";
  }

  function setActiveTab(name) {
    el.tabs.forEach(b => b.classList.toggle("is-active", b.dataset.tab === name));
    el.panes.forEach(p => p.classList.toggle("is-active", p.dataset.pane === name));
  }

  function fillHeader(r) {
    const est = ESTATUS[Number(r.estatus)];
    if (el.folio) el.folio.textContent = r.folio || "—";
    if (el.badge) {
      el.badge.dataset.k = est?.clave || "";
      el.badge.textContent = est?.nombre || "—";
    }
    if (el.meta.tramite)  el.meta.tramite.textContent  = r.tramite_nombre || "—";
    if (el.meta.dep)      el.meta.dep.textContent      = r.departamento_nombre || "—";
    if (el.meta.asignado) el.meta.asignado.textContent = r.asignado_nombre_completo || "—";
    if (el.meta.creado)   el.meta.creado.textContent   = r.created_at || "—";

    if (el.statusSelectHdr) el.statusSelectHdr.value = String(r.estatus ?? 0);
  }

  function fillDetalle(r) {
    if (!el.det) return;
    el.det.asunto && (el.det.asunto.textContent = r.asunto || "—");
    el.det.descripcion && (el.det.descripcion.textContent = r.descripcion || "—");
    el.det.prioridad && (el.det.prioridad.textContent = r.prioridad ?? "—");
    el.det.canal && (el.det.canal.textContent = r.canal ?? "—");

    el.det.c_nombre && (el.det.c_nombre.textContent = r.contacto_nombre || "—");
    el.det.c_tel    && (el.det.c_tel.textContent    = r.contacto_telefono || "—");
    el.det.c_email  && (el.det.c_email.textContent  = r.contacto_email || "—");
    el.det.c_cp     && (el.det.c_cp.textContent     = r.contacto_cp || "—");
    el.det.c_calle  && (el.det.c_calle.textContent  = r.contacto_calle || "—");
    el.det.c_colonia&& (el.det.c_colonia.textContent= r.contacto_colonia || "—");
  }

  function fillForm(r) {
    if (!el.form) return;
    el.f.asunto.value       = r.asunto || "";
    el.f.descripcion.value  = r.descripcion || "";
    el.f.prioridad.value    = String(r.prioridad ?? 2);
    el.f.estatus.value      = String(r.estatus ?? 0);
    el.f.asignado.value     = r.asignado_a != null ? String(r.asignado_a) : "";

    el.f.c_nombre.value     = r.contacto_nombre || "";
    el.f.c_tel.value        = r.contacto_telefono || "";
    el.f.c_email.value      = r.contacto_email || "";
    el.f.c_cp.value         = r.contacto_cp || "";
    el.f.c_calle.value      = r.contacto_calle || "";
    el.f.c_colonia.value    = r.contacto_colonia || "";

    el.f.id.value           = String(r.id);
    const uid = Number(opts.getSessionUserId?.() || 1);
    el.f.updated_by.value   = String(uid);

    setDirty(false);
  }

  function setDirty(v) {
    state.dirty = !!v;
    if (el.act.guardar) el.act.guardar.disabled = !state.dirty;
  }

  // -------- Galería --------
  async function loadGallery(folio, status, force = false) {
    if (!el.img.grid) return;
    const key = `${folio}-${status}`;
    if (!force && state.mediaCache[key]) {
      renderGallery(state.mediaCache[key]);
      return;
    }
    try {
      const r = await listMedia(folio, status, 1, 100);
      state.mediaCache[key] = r;
      renderGallery(r);
    } catch (err) {
      console.error(TAG, "listMedia", err);
      renderGallery({ data: [] });
    }
  }

  function renderGallery(resp) {
    const arr = resp?.data || [];
    el.img.grid.innerHTML = "";
    if (!arr.length) {
      if (el.img.empty) el.img.empty.hidden = false;
      return;
    }
    if (el.img.empty) el.img.empty.hidden = true;

    arr.forEach(m => {
      const card = document.createElement("div");
      card.className = "img-card";
      card.innerHTML = `
        <div class="img-actions"></div>
        ${/^image\//.test(m.mime || "") && !/heic|heif/i.test(m.mime || "")
          ? `<img src="${m.url}" loading="lazy" alt="${m.name}">`
          : `<div style="height:160px;display:flex;align-items:center;justify-content:center;color:#6b7280">Archivo: ${m.mime?.split("/")[1] || "bin"}</div>`
        }
        <div class="img-name" title="${m.name}">${m.name}</div>
      `;
      el.img.grid.appendChild(card);
    });
  }

  // -------- API público --------
  async function open(row) {
    if (!row) return;
    state.row = row;

    // Setup de carpetas/urls (idempotente; si no existe el endpoint no rompe)
    setupMedia(row.folio).catch(e => console.debug(TAG, "setupMedia opcional:", e?.message || e));

    // Pintar UI
    fillHeader(row);
    fillDetalle(row);
    fillForm(row);

    // selects de imágenes
    if (el.img.viewSel) el.img.viewSel.value = String(row.estatus ?? 0);
    if (el.img.upSel)   el.img.upSel.value   = String(row.estatus ?? 0);

    // Galería del estatus actual
    await loadGallery(row.folio, Number(row.estatus || 0), true);

    // Mostrar
    setActiveTab("detalle");
    show(true);
  }

  function close() {
    show(false);
    state.row = null;
    setDirty(false);
  }

  // -------- Eventos --------

  // Tabs
  el.tabs.forEach(b => {
    b.addEventListener("click", () => setActiveTab(b.dataset.tab));
  });

  // Cerrar
  el.closeBtn?.addEventListener("click", close);
  window.addEventListener("keydown", (e) => { if (state.open && e.key === "Escape") close(); });

  // Header: cambiar estatus
  el.statusSelectHdr?.addEventListener("change", async () => {
    if (!state.row) return;
    const newSt = Number(el.statusSelectHdr.value);
    const uid = Number(opts.getSessionUserId?.() || 1);

    const payload = (newSt === 6)
      ? { id: state.row.id, estatus: 6, cerrado_en: nowISO(), updated_by: uid }
      : { id: state.row.id, estatus: newSt, clear_cerrado: true, updated_by: uid };

    try {
      const updated = await updateRequerimiento(payload);
      console.log(TAG, "estatus (header) ->", updated);
      state.row = updated;
      fillHeader(updated);
      fillDetalle(updated);
      fillForm(updated);
      opts.onRowUpdated?.(updated);
      // refresca galería si el selector de vista coincide
      if (el.img.viewSel && Number(el.img.viewSel.value) === newSt) {
        loadGallery(updated.folio, newSt, true);
      }
    } catch (err) {
      console.error(TAG, "status change (header)", err);
      // revert
      el.statusSelectHdr.value = String(state.row.estatus ?? 0);
    }
  });

  // Form: detectar cambios para habilitar "Guardar"
  if (el.form) {
    el.form.addEventListener("input", () => setDirty(true));
    el.form.addEventListener("change", () => setDirty(true));
  }

  // Footer: Editar → activa pestaña Editar
  el.act.editar?.addEventListener("click", () => setActiveTab("editar"));

  // Footer: Guardar
  el.act.guardar?.addEventListener("click", async () => {
    if (!state.row || !state.dirty) return;
    const uid = Number(opts.getSessionUserId?.() || 1);

    const estSel = Number(el.f.estatus.value);
    const payload = {
      id: Number(el.f.id.value),
      asunto: el.f.asunto.value.trim(),
      descripcion: el.f.descripcion.value.trim(),
      prioridad: Number(el.f.prioridad.value),
      estatus: estSel,
      asignado_a: el.f.asignado.value ? Number(el.f.asignado.value) : null,
      contacto_nombre: el.f.c_nombre.value.trim(),
      contacto_telefono: el.f.c_tel.value.trim(),
      contacto_email: el.f.c_email.value.trim() || null,
      contacto_cp: el.f.c_cp.value.trim(),
      contacto_calle: el.f.c_calle.value.trim(),
      contacto_colonia: el.f.c_colonia.value.trim(),
      updated_by: uid
    };

    // manejo de cerrado_en
    if (estSel === 6) {
      payload.cerrado_en = nowISO();
    } else {
      payload.clear_cerrado = true;
    }

    try {
      const updated = await updateRequerimiento(payload);
      console.log(TAG, "guardar ->", updated);
      state.row = updated;
      fillHeader(updated);
      fillDetalle(updated);
      fillForm(updated);
      setActiveTab("detalle");
      opts.onRowUpdated?.(updated);
      // refresca galería si procede
      if (el.img.viewSel && Number(el.img.viewSel.value) === estSel) {
        loadGallery(updated.folio, estSel, true);
      }
    } catch (err) {
      console.error(TAG, "guardar", err);
    }
  });

  // Footer: Eliminar (soft delete en 2 pasos)
  el.act.eliminar?.addEventListener("click", async () => {
    if (!state.row) return;
    const ok1 = confirm("¿Seguro que quieres eliminar este requerimiento?\nSe marcará como inactivo (soft delete).");
    if (!ok1) return;
    const ok2 = confirm("Confirmación final: Esta acción marcará el requerimiento como inactivo.\n¿Deseas continuar?");
    if (!ok2) return;

    const uid = Number(opts.getSessionUserId?.() || 1);
    try {
      const updated = await updateRequerimiento({ id: state.row.id, status: 0, updated_by: uid });
      console.log(TAG, "soft delete ->", updated);
      // Notificamos al caller y cerramos
      opts.onRowUpdated?.(updated);
      close();
    } catch (err) {
      console.error(TAG, "soft delete", err);
    }
  });

  // Imágenes: cambiar vista por estatus
  el.img.viewSel?.addEventListener("change", () => {
    if (!state.row) return;
    const st = Number(el.img.viewSel.value);
    loadGallery(state.row.folio, st, true);
  });

  // Imágenes: subir
  el.img.btn?.addEventListener("click", async () => {
    if (!state.row) return;
    const files = el.img.files?.files || [];
    if (!files.length) {
      console.warn(TAG, "No hay archivos para subir");
      return;
    }
    const dest = Number(el.img.upSel?.value || state.row.estatus || 0);
    try {
      const r = await uploadMedia({ folio: state.row.folio, status: dest, files });
      console.log(TAG, "upload ->", r);
      // Si estamos viendo el mismo estatus, refresca
      const v = Number(el.img.viewSel?.value || dest);
      if (v === dest) loadGallery(state.row.folio, dest, true);
      if (el.img.files) el.img.files.value = "";
    } catch (err) {
      console.error(TAG, "upload", err);
    }
  });

  return { open, close };
}

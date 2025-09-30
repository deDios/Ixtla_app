// /JS/ui/drawer.js
export const Drawer = (() => {
  "use strict";
  const TAG = "[Drawer]";

  // --- Endpoints ---
  const EP_UPDATE = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_u_requerimiento.php";
  const EP_FOLDERS = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_u_requerimiento_folders.php";
  const EP_MEDIA_UP = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_u_requerimiento_media.php";

  // --- Estado runtime ---
  let root = null;
  let paneDetalle, paneEditar, paneImagenes;
  let tabs = [];
  let btnEdit, btnSave, btnDelete, btnClose;
  let formEdit;
  let previewsWrap, gridWrap, emptyMsg;
  let selectViewStatus, selectUploadStatus, inputFiles, btnUpload;

  // Datos del requerimiento seleccionado
  let current = null;          // objeto completo del req
  let isEditing = false;       // modo editar
  let isBusy = false;          // bloqueo general
  let initialFormData = null;  // para detectar cambios
  let galleryCache = {};       // { statusNum: [ {url, name} ] }
  let fileQueue = [];          // archivos seleccionados p/subir (previews)

  const sess = window.__ixSession || null;
  const UPDATED_BY = Number(sess?.id_usuario ?? 0);

  // ===== Utils =====
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  const setBusy = (flag) => {
    isBusy = !!flag;
    if (!root) return;
    root.classList.toggle("is-busy", isBusy);
  };

  const toInt = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };

  const escapeHtml = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  function formToObject(form) {
    const fd = new FormData(form);
    const obj = {};
    for (const [k, v] of fd.entries()) obj[k] = v;
    return obj;
  }

  function diffPayload(initial, current) {
    const out = {};
    for (const k of Object.keys(current)) {
      if (current[k] !== initial[k]) out[k] = current[k];
    }
    return out;
  }

  function emit(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function toastOk(msg){ try{ gcToast(msg, "exito"); }catch{} }
  function toastWarn(msg){ try{ gcToast(msg, "warning"); }catch{} }

  // ===== Tabs =====
  function switchTab(tabName) {
    tabs.forEach(btn => btn.classList.toggle("is-active", btn.dataset.tab === tabName));
    $$('.drw-pane', root).forEach(p => p.classList.toggle('is-active', p.dataset.pane === tabName));
    // Lazy load 
    if (tabName === "imagenes") {
      loadGallery().catch(err => {
        console.error(TAG, "loadGallery()", err);
      });
    }
  }

  // ===== Modo editar =====
  function setEditMode(flag) {
    isEditing = !!flag;
    btnSave.disabled = !isEditing;
    // habilitar/inhabilitar inputs del form
    $$('input, select, textarea', formEdit).forEach(el => {
      if (el.type === "hidden") return;
      el.disabled = !isEditing;
    });
    // En modo detalle, no hacemos nada más (los <p> se quedan)
  }

  // ===== Pintar Detalle =====
  function fillDetalle(data) {
    const map = [
      "folio", "tramite_nombre", "departamento_nombre",
      "asignado_nombre_completo", "created_at", "asunto", "descripcion",
      "prioridad", "canal", "contacto_nombre", "contacto_telefono",
      "contacto_email", "contacto_cp", "contacto_calle", "contacto_colonia"
    ];
    map.forEach(k => {
      const el = $(`[data-field="${k}"]`, root);
      if (el) el.innerHTML = escapeHtml(data?.[k] ?? "—");
    });
  }

  // ===== Pintar Form Editar =====
  function fillForm(data) {
    // Rellenar inputs
    const names = [
      "asunto","descripcion","prioridad","estatus","asignado_a",
      "contacto_nombre","contacto_telefono","contacto_email",
      "contacto_cp","contacto_calle","contacto_colonia","id","updated_by"
    ];
    names.forEach(n => {
      const el = formEdit.elements[n];
      if (!el) return;
      let val = data?.[n];
      if (n === "prioridad" || n === "estatus" || n === "asignado_a") {
        val = (val ?? "") === "" ? "" : String(val);
      } else if (n === "id" || n === "updated_by") {
        val = String(val ?? "");
      } else {
        val = data?.[n] ?? "";
      }
      el.value = val ?? "";
    });
    // snapshot inicial p/ diff
    initialFormData = formToObject(formEdit);
  }

  // ===== Abrir/Cerrar =====
  function open(rowData) {
    try {
      if (!root) throw new Error("Drawer no inicializado");
      current = rowData || {};
      galleryCache = {};
      fileQueue = [];

      // Header folio
      const folioEl = $('[data-field="folio"]', root);
      if (folioEl) folioEl.textContent = current.folio || "REQ-—";

      // Rellenar detalle y form
      fillDetalle(current);
      // aseguramos updated_by
      current.updated_by ??= UPDATED_BY;
      fillForm({ ...current, updated_by: UPDATED_BY });

      // Estado UI
      setEditMode(false);
      // tabs por defecto: Detalle
      switchTab("detalle");

      // Limpiar zona de imágenes
      if (previewsWrap) previewsWrap.innerHTML = "";
      if (gridWrap) gridWrap.innerHTML = "";
      if (emptyMsg) emptyMsg.hidden = false;

      // Seleccionar estatus actual en selects de imágenes
      const estActual = Number(current.estatus ?? 0);
      if (selectViewStatus) selectViewStatus.value = String(estActual);
      if (selectUploadStatus) selectUploadStatus.value = String(estActual);

      // Mostrar panel
      root.classList.add("open");
      emit("drawer:open", { id: current.id, folio: current.folio });
    } catch (err) {
      console.error(TAG, "open()", err);
      toastWarn("Hubo un error, inténtalo más tarde.");
    }
  }

  function close() {
    if (!root) return;
    // si hay cambios sin guardar en modo editar, confirm
    if (isEditing) {
      const now = formToObject(formEdit);
      const changes = diffPayload(initialFormData, now);
      const hasChanges = Object.keys(changes).length > 0;
      if (hasChanges) {
        const ok = confirm("Tienes cambios sin guardar. ¿Cerrar de todos modos?");
        if (!ok) return;
      }
    }
    root.classList.remove("open");
    emit("drawer:close", { id: current?.id });
    current = null;
    fileQueue = [];
    galleryCache = {};
  }

  // ===== Guardar (update de requerimiento) =====
  async function save() {
    if (!current) return;
    try {
      setBusy(true);
      const now = formToObject(formEdit);
      now.updated_by = String(UPDATED_BY);
      const changes = diffPayload(initialFormData, now);
      // no mandamos hidden id/updated_by en diff, pero sí en payload
      const payload = { id: Number(now.id || current.id), updated_by: UPDATED_BY, ...changes };

      // Si no hay cambios: salimos
      const keys = Object.keys(changes).filter(k => k !== "id" && k !== "updated_by");
      if (!keys.length) {
        setEditMode(false);
        setBusy(false);
        return;
      }

      const resp = await fetch(EP_UPDATE, {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) {
        throw new Error(data?.error || `Error ${resp.status}`);
      }

      // Actualizamos caches y UI
      current = data.data || current; // la API devuelve el registro completo
      fillDetalle(current);
      fillForm({ ...current, updated_by: UPDATED_BY });
      setEditMode(false);

      emit("drawer:update", { id: current.id, changes, data: current });
      toastOk("Cambios guardados");
    } catch (err) {
      console.error(TAG, "save()", err);
      toastWarn("Hubo un error, inténtalo más tarde.");
    } finally {
      setBusy(false);
    }
  }

  // ===== Eliminar (soft delete mediante status=0) =====
  async function softDelete() {
    if (!current) return;
    try {
      const c1 = confirm(`¿Eliminar el requerimiento ${current.folio}?`);
      if (!c1) return;
      const c2 = confirm("Esta acción es reversible pero ocultará el registro de las vistas operativas. ¿Continuar?");
      if (!c2) return;

      setBusy(true);
      const payload = { id: Number(current.id), status: 0, updated_by: UPDATED_BY };
      const resp = await fetch(EP_UPDATE, {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) {
        throw new Error(data?.error || `Error ${resp.status}`);
      }

      emit("drawer:delete", { id: current.id });
      toastOk("Registro eliminado");
      close();
    } catch (err) {
      console.error(TAG, "softDelete()", err);
      toastWarn("Hubo un error, inténtalo más tarde.");
    } finally {
      setBusy(false);
    }
  }

  // ===== Imágenes: Previews locales =====
  function bytesToKB(n){ return Math.round((n/1024) * 10)/10; }
  function addPreviews(files) {
    if (!files || !files.length) return;
    [...files].forEach((file, idx) => {
      const url = URL.createObjectURL(file);
      const card = document.createElement("div");
      card.className = "preview-card";
      card.innerHTML = `
        <img src="${url}" alt="${escapeHtml(file.name)}" loading="lazy">
        <button class="preview-remove" type="button" aria-label="Quitar">✕</button>
        <div class="preview-info" title="${escapeHtml(file.name)}">
          ${escapeHtml(file.name)} · ${bytesToKB(file.size)} KB
        </div>
      `;
      // quitar de la cola
      on(card.querySelector(".preview-remove"), "click", () => {
        const i = fileQueue.indexOf(file);
        if (i >= 0) fileQueue.splice(i, 1);
        URL.revokeObjectURL(url);
        card.remove();
      });
      previewsWrap.appendChild(card);
      fileQueue.push(file);
    });
    btnUpload.disabled = fileQueue.length === 0;
  }

  // ===== Imágenes: Cargar galería (sin endpoint de listado) =====
  async function loadGallery() {
    if (!current) return;
    try {
      const viewSts = Number(selectViewStatus?.value ?? current.estatus ?? 0);

      // Si ya tenemos cache local (por subidas en esta sesión):
      const cache = galleryCache[viewSts] || [];
      renderGallery(cache);

      // Intento de preparar carpetas para asegurar ruta (no lista archivos)
      await setupFolders(current.folio);
      // Sin endpoint de listado no podemos descubrir archivos del servidor.
      // Estrategia: mostrar lo que se subió en esta sesión (cache). Si no hay, "empty".
    } catch (err) {
      console.error(TAG, "loadGallery()", err);
      // no molestamos al usuario con toast aquí
    }
  }

  function renderGallery(files = []) {
    gridWrap.innerHTML = "";
    if (!files.length) {
      emptyMsg.hidden = false;
      return;
    }
    emptyMsg.hidden = true;
    files.forEach(f => {
      const card = document.createElement("div");
      card.className = "img-card";
      card.innerHTML = `
        <div class="img-actions"></div>
        <img src="${f.url}" alt="${escapeHtml(f.name || "")}" loading="lazy">
        <div class="img-name" title="${escapeHtml(f.name || "")}">${escapeHtml(f.name || "")}</div>
      `;
      on(card.querySelector("img"), "click", () => {
        try { window.open(f.url, "_blank", "noopener"); } catch {}
      });
      gridWrap.appendChild(card);
    });
  }

  // ===== Imágenes: Subir (multipart) =====
  async function setupFolders(folio) {
    try {
      const resp = await fetch(EP_FOLDERS, {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=utf-8" },
        body: JSON.stringify({ folio })
      });
      // Puede devolver ok true siempre; no necesitamos usar el cuerpo ahora
      await resp.text(); // ignoramos
    } catch (err) {
      console.error(TAG, "setupFolders()", err);
      // silencioso
    }
  }

  async function uploadFiles() {
    if (!current || !fileQueue.length) return;
    try {
      setBusy(true);

      const destStatus = Number(selectUploadStatus?.value ?? current.estatus ?? 0);
      await setupFolders(current.folio);

      const fd = new FormData();
      fd.append("folio", String(current.folio));
      fd.append("status", String(destStatus));
      fileQueue.forEach(f => fd.append("files[]", f, f.name));

      const resp = await fetch(EP_MEDIA_UP, { method: "POST", body: fd });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error || `Error ${resp.status}`);
      }

      // Guardar en cache local para poder listar
      const prev = galleryCache[destStatus] || [];
      const added = (json.saved || []).map(it => ({ url: it.url, name: it.name }));
      galleryCache[destStatus] = prev.concat(added);

      // Limpiar previews y cola
      fileQueue = [];
      previewsWrap.innerHTML = "";
      btnUpload.disabled = true;

      // Si se está viendo el mismo estatus, refrescar
      if (Number(selectViewStatus.value) === destStatus) {
        renderGallery(galleryCache[destStatus]);
      }

      toastOk("Imágenes subidas");
    } catch (err) {
      console.error(TAG, "uploadFiles()", err);
      toastWarn("Hubo un error, inténtalo más tarde.");
    } finally {
      setBusy(false);
    }
  }

  // ===== Init (enlaza con el HTML del drawer que me pasaste) =====
  function initDrawer(rootSelector = ".ix-drawer") {
    root = document.querySelector(rootSelector);
    if (!root) {
      console.warn(TAG, "No se encontró el drawer:", rootSelector);
      return;
    }

    // panes & tabs
    paneDetalle  = $('[data-pane="detalle"]', root);
    paneEditar   = $('[data-pane="editar"]', root);
    paneImagenes = $('[data-pane="imagenes"]', root);
    tabs         = $$('.ix-drawer__tabs .tab', root);

    // header actions
    btnEdit   = $('[data-action="editar"]', root);
    btnSave   = $('[data-action="guardar"]', root);
    btnDelete = $('[data-action="eliminar"]', root);
    btnClose  = $('[data-drawer="close"]', root);

    // form
    formEdit = $('.ix-drawer__form', root);

    // imágenes
    previewsWrap      = $('[data-img="previews"]', root);
    gridWrap          = $('[data-img="grid"]', root);
    emptyMsg          = $('[data-img="empty"]', root);
    selectViewStatus  = $('[data-img="viewStatus"]', root);
    selectUploadStatus= $('[data-img="uploadStatus"]', root);
    inputFiles        = $('[data-img="files"]', root);
    btnUpload         = $('[data-img="uploadBtn"]', root);

    // eventos
    tabs.forEach(btn => on(btn, "click", () => switchTab(btn.dataset.tab)));

    on(btnEdit,   "click", () => setEditMode(!isEditing));
    on(btnSave,   "click", save);
    on(btnDelete, "click", softDelete);
    on(btnClose,  "click", close);

    // ctrl/cmd + S para guardar
    on(root, "keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!btnSave.disabled) save();
      }
      if (e.key === "Escape" && !isBusy) {
        // Cierra solo si no hay cambios pendientes
        if (!isEditing) return close();
        const now = formToObject(formEdit);
        const changes = diffPayload(initialFormData, now);
        if (Object.keys(changes).length === 0) close();
      }
    });

    // imágenes
    on(selectViewStatus, "change", loadGallery);
    on(inputFiles, "change", (e) => {
      addPreviews(e.target.files);
      // limpiar input para permitir volver a elegir los mismos nombres
      try { e.target.value = ""; } catch {}
    });
    on(btnUpload, "click", uploadFiles);

    // deshabilitar botones al inicio
    btnSave.disabled = true;
    btnUpload.disabled = true;

    // Por UX, siempre arrancamos en Detalle
    switchTab("detalle");

    console.log(TAG, "init OK");
  }

  // API pública
  return { init: initDrawer, open, close };
})();

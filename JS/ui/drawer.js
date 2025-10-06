// /JS/ui/drawer.js
import { setupMedia, listMedia, uploadMedia } from "/JS/api/media.js";
import { updateRequerimiento } from "/JS/api/requerimientos.js";

/* ========= Constantes ========= */
const FOLIO_RX = /^REQ-\d{10}$/;
const MAX_FILES_CLIENT = 3;
const MAX_BYTES_CLIENT = 1 * 1024 * 1024; // 1 MB
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/* ========= Utils del DOM ========= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const setText = (el, txt) => { if (el) el.textContent = (txt ?? "—"); };
const setVal = (el, val) => { if (el) el.value = (val ?? ""); };
const toast = (m, t = "info") => { try { window.gcToast?.(m, t); } catch { } };
const setBusy = (root, on) => root.classList.toggle("is-busy", !!on);
const clone = (o) => (window.structuredClone ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
const setVisible = (el, show) => { if (!el) return; el.hidden = !show; el.style.display = show ? "" : "none"; };

/* ========= UI ========= */
function mapToFields(root, data = {}) {
  $$("[data-field]", root).forEach(el => {
    const key = el.getAttribute("data-field");
    if (!key) return;
    setText(el, data[key] ?? "—");
  });
  const hidId = root.querySelector('input[name="id"][data-field="id"]');
  if (hidId && data.id != null) hidId.value = data.id;
}
function mapToForm(root, data = {}) {
  $$("[data-edit][name]", root).forEach(el => {
    const key = el.getAttribute("name");
    const v = data[key];
    setVal(el, v ?? "");
  });
  const hidId = root.querySelector('input[name="id"]');
  const hidUb = root.querySelector('input[name="updated_by"]');
  if (hidId && data.id != null) hidId.value = data.id;
  if (hidUb) hidUb.value = (window.__ixSession?.id_usuario ?? 1);
}

/* ========= Galería ========= */
function paintGallery(root, resp) {
  const grid = $('[data-img="grid"]', root);
  const empty = $('[data-img="empty"]', root);
  if (!grid || !empty) return;
  grid.innerHTML = "";
  const list = (resp?.data || []).filter(Boolean);
  if (!list.length) { empty.hidden = false; return; }
  empty.hidden = true;
  const frag = document.createDocumentFragment();
  list.forEach(it => {
    const a = document.createElement("a");
    a.className = "ixd-card";
    a.href = it.url || "#";
    a.target = "_blank";
    a.rel = "noopener";
    a.innerHTML = `
      <img src="${it.url}" loading="lazy" alt="${(it.name || 'evidencia')}">
      <div class="nm" title="${it.name || ''}">${it.name || ''}</div>
    `;
    frag.appendChild(a);
  });
  grid.appendChild(frag);
}

/* ========= Previews locales ========= */
function buildPreview(file, container) {
  const url = URL.createObjectURL(file);
  const wrap = document.createElement("div");
  wrap.className = "ixd-prevItem";
  wrap.innerHTML = `
    <img src="${url}" alt="${file.name}" loading="lazy">
    <div class="ixd-prevName">${file.name}</div>
  `;
  container.appendChild(wrap);
}

/* ========= Drawer ========= */
export const Drawer = (() => { //clases para no jerrarle
  let panel;                  // <aside class="ix-drawer" data-drawer="panel">
  let overlay;                // .ix-drawer-overlay [data-drawer="overlay"]

  let btnClose;               // [data-drawer="close"]
  let btnEdit;                // [data-action="editar"]
  let btnSave;                // [data-action="guardar"]
  let btnCancel;              // [data-action="cancelar"]
  let btnPause;               // [data-action="pausar"]
  let btnDelete;              // [data-action="eliminar"]

  let heroImg;                // [data-img="hero"]
  let pickBtn;                // [data-img="pick"]
  let fileInput;              // [data-img="file"]
  let previewsBox;            // [data-img="previews"]
  let uploadBtn;              // [data-img="uploadBtn"]
  let viewStatusSel;          // [data-img="viewStatus"] 

  let escHandlerBound = null;
  let snapshot = null;
  let saving = false, deleting = false;

  /* ----- init ----- */
  function init(selector = ".ix-drawer") {
    panel = $(selector);
    overlay = $('[data-drawer="overlay"]') || $(".ix-drawer-overlay");

    if (!panel) { console.warn("[Drawer] no se encontró", selector); return; }
    if (panel.__inited) return;
    panel.__inited = true;

    // grab DOM
    btnClose = $('[data-drawer="close"]', panel);
    btnEdit = $('[data-action="editar"]', panel);
    btnSave = $('[data-action="guardar"]', panel);
    btnCancel = $('[data-action="cancelar"]', panel);
    btnPause = $('[data-action="pausar"]', panel);
    btnDelete = $('[data-action="eliminar"]', panel);

    heroImg = $('[data-img="hero"]', panel);
    pickBtn = $('[data-img="pick"]', panel);
    fileInput = $('[data-img="file"]', panel);
    previewsBox = $('[data-img="previews"]', panel);
    uploadBtn = $('[data-img="uploadBtn"]', panel);
    viewStatusSel = $('[data-img="viewStatus"]', panel);

    // listeners UI principales
    btnClose?.addEventListener("click", close);
    overlay?.addEventListener("click", close);

    btnEdit?.addEventListener("click", () => setEditMode(true));
    btnSave?.addEventListener("click", onSave);
    btnCancel?.addEventListener("click", onCancel);
    btnPause?.addEventListener("click", onPauseToggle);
    btnDelete?.addEventListener("click", onDelete);

    // imagenes
    if (pickBtn && fileInput) {
      pickBtn.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", onFilesPicked);
    }
    if (uploadBtn) {
      uploadBtn.disabled = true;
      uploadBtn.addEventListener("click", onUpload);
    }

    // ver galeria por estatus
    viewStatusSel?.addEventListener("change", async () => {
      const folio = String($(".ixd-folio", panel)?.textContent || "").trim();
      if (!FOLIO_RX.test(folio)) return;
      const st = Number(viewStatusSel.value || panel._row?.estatus || 0);
      setBusy(panel, true);
      try { const resp = await listMedia(folio, st, 1, 100); paintGallery(panel, resp); }
      finally { setBusy(panel, false); }
    });

    // lectura por default
    forceReadMode();
  }

  /* ----- modos ----- */
  function forceReadMode() {
    // mostrar textos, ocultar inputs
    $$(".ixd-field p", panel).forEach(p => p.hidden = false);
    $$("[data-edit]", panel).forEach(i => i.hidden = true);

    // botones
    setVisible(btnSave, false); btnSave && (btnSave.disabled = true);
    setVisible(btnCancel, false);
    setVisible(btnDelete, true);
    setVisible(btnPause, true);

    panel.classList.remove("editing", "mode-edit");
  }
  function setEditMode(on) {
    panel.classList.toggle("editing", !!on);
    panel.classList.toggle("mode-edit", !!on);

    $$(".ixd-field p", panel).forEach(p => p.hidden = !!on);
    $$("[data-edit]", panel).forEach(i => i.hidden = !on);

    setVisible(btnSave, on); if (btnSave) btnSave.disabled = !on;
    setVisible(btnCancel, on);
    setVisible(btnDelete, !on);
    setVisible(btnPause, !on);
  }

  /* ----- abrir / cerrar ----- */
  function bindEsc() {
    if (escHandlerBound) return;
    escHandlerBound = (e) => {
      if (e.key === "Escape") {
        const isEditing = panel.classList.contains("editing") || panel.classList.contains("mode-edit");
        if (isEditing) onCancel(); else close();
      }
    };
    document.addEventListener("keydown", escHandlerBound);
  }
  function unbindEsc() {
    if (!escHandlerBound) return;
    document.removeEventListener("keydown", escHandlerBound);
    escHandlerBound = null;
  }

  function open(row = {}, callbacks = {}) {
    if (!panel) { console.warn("[Drawer] init() primero"); return; }
    forceReadMode();

    panel._row = row; panel._callbacks = callbacks;
    snapshot = clone(row);

    // header/meta
    const folioEl = $(".ixd-folio", panel);
    setText(folioEl, row.folio || "REQ-0000000000");
    mapToFields(panel, row);
    mapToForm(panel, row);

    // Hero
    if (heroImg) { heroImg.src = row.hero_url || ""; heroImg.alt = row.folio || "Evidencia"; }

    // Estatus select inicial (único select)
    const st = Number(row.estatus ?? 0);
    if (viewStatusSel) viewStatusSel.value = String(st);

    // mostrar panel + overlay
    panel.classList.add("open");
    if (overlay) { overlay.hidden = false; overlay.classList.add("open"); }

    // foco mínimo
    try { $('[data-action="editar"]', panel)?.focus(); } catch { }

    // Esc global
    bindEsc();

    // cargar galeria
    const folio = row.folio || "";
    if (FOLIO_RX.test(folio)) {
      setBusy(panel, true);
      listMedia(folio, st, 1, 100)
        .then(resp => paintGallery(panel, resp))
        .finally(() => setBusy(panel, false));
    }
  }

  function close() {
    if (!panel) return;
    panel.classList.remove("open");
    if (overlay) { overlay.classList.remove("open"); overlay.hidden = true; }
    clearPreviews();
    forceReadMode();
    unbindEsc();
    try { panel._callbacks?.onClose?.(); } catch { }
  }

  /* ----- archivos ----- */
  function onFilesPicked() {
    if (!previewsBox || !fileInput) return;
    previewsBox.innerHTML = "";

    const all = Array.from(fileInput.files || []);
    const valid = [];
    const errors = [];

    all.forEach(f => {
      if (f.size > MAX_BYTES_CLIENT) { errors.push(`"${f.name}" excede 1 MB`); return; }
      if (!ALLOWED_MIME.includes(f.type)) { errors.push(`"${f.name}" tipo no permitido (${f.type || "?"})`); return; }
      valid.push(f);
    });
    if (valid.length > MAX_FILES_CLIENT) {
      errors.push(`Máximo ${MAX_FILES_CLIENT} archivos por subida`);
      valid.splice(MAX_FILES_CLIENT);
    }
    valid.forEach(f => buildPreview(f, previewsBox));
    if (errors.length) toast(errors.join("\n"), "warning");

    if (uploadBtn) uploadBtn.disabled = valid.length === 0;
  }
  function clearPreviews() {
    if (previewsBox) previewsBox.innerHTML = "";
    if (fileInput) fileInput.value = "";
    if (uploadBtn) uploadBtn.disabled = true;
  }

  async function onUpload() {
    const folio = String($(".ixd-folio", panel)?.textContent || "").trim();
    const status = Number(viewStatusSel?.value || panel._row?.estatus || 0);
    const files = Array.from(fileInput?.files || []);

    if (!FOLIO_RX.test(folio)) { toast("Folio inválido", "warning"); return; }
    if (!files.length) return;

    // Validación final en cliente
    const valid = [];
    const invalid = [];
    for (const f of files) {
      if (f.size > MAX_BYTES_CLIENT) { invalid.push(`"${f.name}" > 1 MB`); continue; }
      if (!ALLOWED_MIME.includes(f.type)) { invalid.push(`"${f.name}" tipo ${f.type || "?"}`); continue; }
      valid.push(f);
    }
    if (!valid.length) { toast(invalid.join("\n") || "Archivos no válidos", "warning"); return; }

    setBusy(panel, true);
    try {
      // preparar carpetas (best-effort)
      try { await setupMedia(folio); } catch { }

      const r = await uploadMedia({ folio, status, files: valid });
      const ok = r.ok && (r.saved?.length || 0) > 0;
      toast(`Subida: ${r.saved?.length || 0} ok, ${r.failed?.length || 0} error${r.skipped?.length ? `, ${r.skipped.length} omitido(s)` : ""}`, ok ? "exito" : "warning");

      clearPreviews();

      // refrescar galería del estado visible
      const viewSt = Number(viewStatusSel?.value || status || 0);
      const resp = await listMedia(folio, viewSt, 1, 100);
      paintGallery(panel, resp);
    } catch (err) {
      console.error("[Drawer] upload error:", err);
      toast(String(err?.message || err), "warning");
    } finally {
      setBusy(panel, false);
    }
  }

  /* ----- guardar / cancelar / eliminar / pausar ----- */
  async function onSave(ev) {
    ev?.preventDefault?.();
    if (saving) return;
    saving = true;
    setBusy(panel, true);
    if (btnSave) btnSave.disabled = true;

    const getStr = (name) => {
      const v = $(`[name="${name}"][data-edit]`, panel)?.value ?? "";
      const t = v.trim();
      return t === "" ? null : t;
    };
    const getNum = (name) => {
      const raw = $(`[name="${name}"][data-edit]`, panel)?.value;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };

    try {
      const id = Number($('input[name="id"]', panel)?.value || NaN);
      if (!id) throw new Error("Falta id");

      const asunto = getStr("asunto");
      const descripcion = getStr("descripcion");
      if (!asunto) throw new Error("Asunto es requerido");
      if ((descripcion || "").length < 5) throw new Error("Descripción muy corta");

      const payload = {
        id,
        asunto,
        descripcion,
        prioridad: getNum("prioridad"),
        canal: getNum("canal"),
        contacto_nombre: getStr("contacto_nombre"),
        contacto_telefono: getStr("contacto_telefono"),
        contacto_email: getStr("contacto_email"),
        contacto_cp: getStr("contacto_cp"),
        contacto_calle: getStr("contacto_calle"),
        contacto_colonia: getStr("contacto_colonia"),
        estatus: getNum("estatus"),
        updated_by: Number($('input[name="updated_by"]', panel)?.value || (window.__ixSession?.id_usuario ?? 1)) || 1,
      };

      const updated = await updateRequerimiento(payload);
      mapToFields(panel, updated);
      mapToForm(panel, updated);
      panel._row = updated;
      snapshot = clone(updated);
      setEditMode(false);
      try { panel._callbacks?.onUpdated?.(updated); } catch { }
      toast("Requerimiento actualizado", "exito");
    } catch (err) {
      console.error("[Drawer] save error:", err);
      try { panel._callbacks?.onError?.(err); } catch { }
      toast(String(err?.message || err), "warning");
    } finally {
      saving = false;
      setBusy(panel, false);
      if (btnSave) btnSave.disabled = !(panel.classList.contains("editing") || panel.classList.contains("mode-edit"));
    }
  }

  function onCancel() {
    if (!confirm("¿Descartar cambios?")) return;
    if (snapshot) {
      mapToFields(panel, snapshot);
      mapToForm(panel, snapshot);
      panel._row = snapshot;
    }
    clearPreviews();
    setEditMode(false);
  }

  async function onDelete(ev) {
    ev?.preventDefault?.();
    if (!panel || deleting) return;
    if (!btnDelete) return;

    // confirmación 2 pasos
    if (!btnDelete.dataset.confirm) {
      btnDelete.dataset.confirm = "1";
      const og = btnDelete.textContent;
      btnDelete.dataset.original = og;
      btnDelete.textContent = "¿Confirmar borrado?";
      btnDelete.classList.add("danger");
      setTimeout(() => {
        btnDelete.textContent = btnDelete.dataset.original || "Eliminar";
        btnDelete.removeAttribute("data-confirm");
        btnDelete.classList.remove("danger");
      }, 5000);
      return;
    }

    deleting = true;
    btnDelete.disabled = true;
    setBusy(panel, true);

    try {
      const id = Number($('input[name="id"]', panel)?.value || NaN);
      if (!id) throw new Error("Falta id");
      const updated_by = Number($('input[name="updated_by"]', panel)?.value || (window.__ixSession?.id_usuario ?? 1)) || 1;

      const updated = await updateRequerimiento({ id, status: 0, updated_by }); // soft delete
      try { panel._callbacks?.onUpdated?.(updated); } catch { }
      close();
      toast("Requerimiento eliminado", "exito");
    } catch (err) {
      console.error("[Drawer] delete error:", err);
      try { panel._callbacks?.onError?.(err); } catch { }
      toast(String(err?.message || err), "warning");
    } finally {
      deleting = false;
      setBusy(panel, false);
      btnDelete.disabled = false;
    }
  }

  function paintPauseButton(estatus) {
    if (!btnPause) return;
    const st = Number(estatus ?? panel._row?.estatus ?? 0);
    if (st === 4) { // Pausado
      btnPause.textContent = "Reanudar";
      btnPause.classList.remove("warning");
      btnPause.classList.add("success");
      btnPause.dataset.mode = "resume";
    } else {
      btnPause.textContent = "Pausar";
      btnPause.classList.remove("success");
      btnPause.classList.add("warning");
      btnPause.dataset.mode = "pause";
    }
  }

  async function onPauseToggle() {
    if (!btnPause) return;
    const row = panel._row || {};
    const id = Number(row.id || 0);
    if (!id) return;

    const mode = btnPause.dataset.mode || "pause";
    const next = (mode === "pause") ? 4 : 0; // 4 = Pausado, 0 = Solicitud (ajusta si quieres otro flujo)

    try {
      btnPause.disabled = true;
      const updated = await updateRequerimiento({ id, estatus: next, updated_by: (window.__ixSession?.id_usuario ?? 1) });
      panel._row = updated;
      mapToFields(panel, updated);
      mapToForm(panel, updated);
      paintPauseButton(updated?.estatus);
      toast("Estatus actualizado", "info");
    } catch (e) {
      console.error("[Drawer] pause/resume error:", e);
      toast("No se pudo actualizar estatus", "warning");
    } finally {
      btnPause.disabled = false;
    }
  }

  // expone API
  return { init, open, close, setEditMode, paintPauseButton };
})();

// /JS/ui/drawer.js

const API_BASE = 'https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/';

// Endpoints
const EP_UPDATE = API_BASE + 'ixtla01_u_requerimiento.php';          // (asumimos igual)
const EP_MEDIA_LIST = API_BASE + 'ixtla01_c_requerimiento_img.php';
const EP_MEDIA_UPLOAD = API_BASE + 'ixtla01_ins_requerimiento_img.php';

// Regex folio
const FOLIO_RX = /^REQ-\d{10}$/;

// Límites cliente (validación previa)
const MAX_FILES_CLIENT = 3;
const MAX_BYTES_CLIENT = 1 * 1024 * 1024; // 1 MB por archivo
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

// Utils DOM
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function setText(el, txt) { if (el) el.textContent = (txt ?? '—'); }
function setVal(el, val) { if (el) el.value = (val ?? ''); }

// Mapear campos visibles (p[data-field]) y hidden id
function mapToFields(root, data = {}) {
  $all('[data-field]', root).forEach(el => {
    const key = el.getAttribute('data-field');
    if (!key) return;
    setText(el, data[key] ?? '—');
  });
  const hidId = root.querySelector('input[name="id"][data-field="id"]');
  if (hidId && data.id != null) hidId.value = data.id;
}

// Mapear valores a inputs de edición (tienen [data-edit] y name=...)
function mapToForm(root, data = {}) {
  $all('[data-edit][name]', root).forEach(el => {
    const key = el.getAttribute('name');
    const v = data[key];
    if (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      setVal(el, v ?? '');
    }
  });
  const hidId = root.querySelector('input[name="id"]');
  const hidUb = root.querySelector('input[name="updated_by"]');
  if (hidId && data.id != null) hidId.value = data.id;
  if (hidUb) hidUb.value = (window.__ixSession?.id_usuario ?? 1);
}

function toggleEditFields(root, on) {
  // Mostrar/ocultar los inputs que vienen con atributo hidden
  $all('[data-edit]', root).forEach(el => {
    el.hidden = !on; // en tu HTML vienen con hidden; aquí lo gestionamos
  });
}

function setBusy(panel, on) {
  panel.classList.toggle('is-busy', !!on);
}

function makeToast(msg, type = 'info') {
  try { if (typeof window.gcToast === 'function') window.gcToast(msg, type); }
  catch (_) { /* no-op */ }
}

// ======= API helpers =======
async function listMedia({ folio, status, page = 1, per_page = 60 }) {
  if (!FOLIO_RX.test(String(folio))) {
    console.warn('[Drawer] listMedia: folio inválido →', folio);
    return { ok: true, data: [], count: 0 };
  }
  const body = { folio, status: (status ?? null), page, per_page };
  try {
    const res = await fetch(EP_MEDIA_LIST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    });
    const txt = await res.text();
    if (!res.ok) throw new Error(`list ${res.status} ${txt}`);
    const json = JSON.parse(txt);
    return { ok: !!json.ok, data: json.data || [], count: json.count || 0, page: json.page, per_page: json.per_page };
  } catch (e) {
    console.error('[Drawer] listMedia error:', e);
    return { ok: false, data: [], count: 0 };
  }
}

async function uploadMedia({ folio, status, files }) {
  if (!FOLIO_RX.test(String(folio))) throw new Error('folio inválido en upload');
  const fd = new FormData();
  fd.append('folio', folio);
  fd.append('status', String(status));
  [...files].forEach(f => fd.append('files[]', f, f.name));

  // NO seteamos Content-Type: el navegador define boundary
  const res = await fetch(EP_MEDIA_UPLOAD, { method: 'POST', body: fd });
  const txt = await res.text();

  if (res.status === 429) {
    let retry = 0;
    try { retry = (JSON.parse(txt)?.retry_after) || 0; } catch (_) { }
    throw new Error(`Rate limit: espera ${retry}s`);
  }
  if (!res.ok) throw new Error(`upload ${res.status} ${txt}`);

  const json = JSON.parse(txt);
  if (!json.ok && (!json.saved || !json.saved.length)) {
    throw new Error(json.error || 'Upload no OK');
  }
  return json;
}

async function updateRequerimiento(payload) {
  // Mantengo endpoint de update (si cambia me dices y ajusto)
  const res = await fetch(EP_UPDATE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`update ${res.status} ${txt}`);
  const json = JSON.parse(txt);
  if (!json.ok) throw new Error(json.error || 'Update no OK');
  return json.data;
}

// ======= Render galería =======
function ensureGalleryDom(root) {
  // si no existen, crea contenedores mínimos
  let grid = $('[data-img="grid"]', root);
  let empty = $('[data-img="empty"]', root);
  if (!grid) {
    grid = document.createElement('div');
    grid.className = 'ixd-gallery';
    grid.setAttribute('data-img', 'grid');
    // insertamos después de la fila de upload si existe
    const upRow = $('[data-img="uploadBtn"]', root)?.closest('.ixd-uploadRow') || $('.ixd-body', root) || root;
    upRow.insertAdjacentElement('afterend', grid);
  }
  if (!empty) {
    empty = document.createElement('div');
    empty.setAttribute('data-img', 'empty');
    empty.textContent = 'Sin evidencia para este estado.';
    empty.style.margin = '10px 0 0';
    empty.style.color = '#6b7280';
    grid.insertAdjacentElement('beforebegin', empty);
  }
  return { grid, empty };
}

function paintGallery(root, resp) {
  const { grid, empty } = ensureGalleryDom(root);
  grid.innerHTML = '';
  const list = (resp?.data || []).filter(Boolean);
  if (!list.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  const frag = document.createDocumentFragment();
  list.forEach(it => {
    const a = document.createElement('a');
    a.className = 'ixd-card';
    a.href = it.url || '#';
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = `
      <img src="${it.url}" loading="lazy" alt="${(it.name || 'evidencia')}">
      <div class="nm" title="${it.name || ''}">${it.name || ''}</div>
    `;
    frag.appendChild(a);
  });
  grid.appendChild(frag);
}

// Previews locales (selección del usuario antes de subir)
function buildPreview(file, container) {
  const url = URL.createObjectURL(file);
  const wrap = document.createElement('div');
  wrap.className = 'ixd-prevItem';
  const img = document.createElement('img');
  img.src = url; img.alt = file.name; img.loading = 'lazy';
  const name = document.createElement('div');
  name.className = 'ixd-prevName';
  name.textContent = file.name;
  wrap.appendChild(img);
  wrap.appendChild(name);
  container.appendChild(wrap);
}

// ======= Drawer =======
export const Drawer = (() => {
  let el;           // <aside class="ix-drawer">
  let heroImg;      // [data-img="hero"]
  let pickBtn;      // [data-img="pick"]
  let fileInput;    // [data-img="file"]
  let previewsBox;  // [data-img="previews"]
  let uploadBtn;    // [data-img="uploadBtn"]
  let uploadStatus; // [data-img="uploadStatus"]
  let cancelBtn;    // [data-action="cancelar"]
  let saving = false;
  let deleting = false;
  let snapshot = null;  // estado original para cancelar

  function init(selector = '.ix-drawer') {
    el = document.querySelector(selector);
    if (!el) { console.warn('[Drawer] no se encontró', selector); return; }
    if (el.__inited) { return; }
    el.__inited = true;

    heroImg = $('[data-img="hero"]', el);
    pickBtn = $('[data-img="pick"]', el);
    fileInput = $('[data-img="file"]', el);
    previewsBox = $('[data-img="previews"]', el);
    uploadBtn = $('[data-img="uploadBtn"]', el);
    uploadStatus = $('[data-img="uploadStatus"]', el);

    // Cerrar
    $all('[data-drawer="close"]', el).forEach(b => b.addEventListener('click', close));

    // Inyectar botón Cancelar si no existe
    cancelBtn = el.querySelector('[data-action="cancelar"]');
    if (!cancelBtn) {
      const footer = el.querySelector('.ixd-actions--footer') || el.querySelector('.ixd-actions') || el;
      const btn = document.createElement('button');
      btn.className = 'btn ghost ixd-cancel';
      btn.setAttribute('data-action', 'cancelar');
      btn.type = 'button';
      btn.textContent = 'Cancelar';
      btn.style.display = 'none';
      footer.insertBefore(btn, footer.querySelector('[data-action="guardar"]') || null);
      cancelBtn = btn;
    }

    const btnEdit = el.querySelector('[data-action="editar"]');
    const btnSave = el.querySelector('[data-action="guardar"]');
    const btnDelete = el.querySelector('[data-action="eliminar"]');

    btnEdit?.addEventListener('click', () => setEditMode(true));
    btnSave?.addEventListener('click', onSave);
    cancelBtn?.addEventListener('click', onCancel);
    btnDelete?.addEventListener('click', onDelete);

    // Imagen: solo permitir elección en edición
    if (pickBtn && fileInput) {
      pickBtn.addEventListener('click', () => {
        if (!el.classList.contains('editing') && !el.classList.contains('mode-edit')) return;
        fileInput.click();
      });
      fileInput.addEventListener('change', onFilesPicked);
    }

    // Subida
    if (uploadBtn) {
      uploadBtn.addEventListener('click', onUpload);
      uploadBtn.disabled = true;
    }

    // Atajos
    el.addEventListener('keydown', (ev) => {
      const isEditing = el.classList.contains('editing') || el.classList.contains('mode-edit');
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
        if (isEditing) { ev.preventDefault(); onSave(); }
      } else if (ev.key === 'Escape') {
        if (isEditing) { onCancel(); }
        else { close(); }
      }
    });

    console.log('[Drawer] init OK');
  }

  function open(row, callbacks = {}) {
    if (!el) return console.warn('[Drawer] init() primero');
    el._row = row || {};
    el._callbacks = callbacks || {};

    mapToFields(el, row || {});
    mapToForm(el, row || {});
    snapshot = structuredClone ? structuredClone(row || {}) : JSON.parse(JSON.stringify(row || {}));

    // Folio visible
    const folioEl = $('.ixd-folio', el);
    if (folioEl) setText(folioEl, row?.folio || 'REQ-0000000000');

    // Hero
    if (heroImg) {
      heroImg.src = row?.hero_url || '';
      heroImg.alt = row?.folio || 'Evidencia';
    }

    // Estado inicial: lectura
    setEditMode(false);

    // Abre panel
    el.classList.add('open');

    // Cargar galería del estatus actual (si hay contenedores)
    const folio = row?.folio || '';
    const st = Number(row?.estatus ?? 0);
    if (FOLIO_RX.test(folio)) {
      listMedia({ folio, status: st }).then(resp => paintGallery(el, resp));
    }
  }

  function close() {
    if (!el) return;
    el.classList.remove('open');
    setEditMode(false);
    clearPreviews();
    try { el._callbacks?.onClose?.(); } catch (e) { console.error(e); }
  }

  function setEditMode(on) {
    el.classList.toggle('mode-edit', !!on);
    el.classList.toggle('editing', !!on); // compat con tu CSS
    toggleEditFields(el, !!on);

    const btnSave = el.querySelector('[data-action="guardar"]');
    const btnDelete = el.querySelector('[data-action="eliminar"]');

    if (btnSave) btnSave.disabled = !on;
    if (btnDelete) btnDelete.style.display = on ? 'none' : '';
    if (cancelBtn) cancelBtn.style.display = on ? '' : 'none';
  }

  function clearPreviews() {
    if (previewsBox) previewsBox.innerHTML = '';
    if (fileInput) fileInput.value = '';
    if (uploadBtn) uploadBtn.disabled = true;
  }

  // ===== Files picked =====
  function onFilesPicked() {
    if (!previewsBox || !fileInput) return;

    previewsBox.innerHTML = '';
    const files = Array.from(fileInput.files || []);

    const valid = [];
    const errors = [];

    files.forEach(f => {
      if (f.size > MAX_BYTES_CLIENT) {
        errors.push(`"${f.name}": excede ${Math.round(MAX_BYTES_CLIENT / 1024)} KB`);
        return;
      }
      // Intentar detectar MIME real con extension+type (en cliente es limitado)
      const typeOk = ALLOWED_MIME.includes(f.type);
      if (!typeOk) {
        errors.push(`"${f.name}": tipo no permitido (${f.type || 'desconocido'})`);
        return;
      }
      valid.push(f);
    });

    if (valid.length > MAX_FILES_CLIENT) {
      errors.push(`Se permiten máx ${MAX_FILES_CLIENT} archivos por subida`);
      valid.splice(MAX_FILES_CLIENT); // limitar
    }

    valid.forEach(f => buildPreview(f, previewsBox));

    if (errors.length) {
      makeToast(errors.join('\n'), 'warning');
    }

    if (uploadBtn) uploadBtn.disabled = valid.length === 0;
    // Reescribir FileList no es trivial; dejamos el input tal cual,
    // pero validaremos otra vez justo antes de subir.
  }

  async function onUpload() {
    try {
      const folio = String($('.ixd-folio', el)?.textContent || '').trim();
      const status = Number(uploadStatus?.value || el._row?.estatus || 0);
      const files = Array.from(fileInput?.files || []);

      if (!FOLIO_RX.test(folio)) throw new Error('Folio inválido');
      if (!files.length) return;

      // Validación cliente
      const invalid = [];
      const valid = [];
      for (const f of files) {
        if (f.size > MAX_BYTES_CLIENT) { invalid.push(`"${f.name}" > 1 MB`); continue; }
        if (!ALLOWED_MIME.includes(f.type)) { invalid.push(`"${f.name}" tipo ${f.type || 'desconocido'}`); continue; }
        valid.push(f);
      }
      if (valid.length === 0) {
        makeToast(invalid.join('\n') || 'Archivos no válidos', 'warning');
        return;
      }
      if (valid.length > MAX_FILES_CLIENT) {
        makeToast(`Máximo ${MAX_FILES_CLIENT} archivos por subida`, 'warning');
        valid.splice(MAX_FILES_CLIENT);
      }

      setBusy(el, true);
      const r = await uploadMedia({ folio, status, files: valid });
      makeToast(`Subida completa: ${r.saved?.length || 0} ok, ${r.failed?.length || 0} con error`, 'exito');

      clearPreviews();

      // Refrescar galería del status visible
      const viewSt = Number(uploadStatus?.value || el._row?.estatus || 0);
      const resp = await listMedia({ folio, status: viewSt });
      paintGallery(el, resp);

    } catch (err) {
      console.error('[Drawer] upload error', err);
      makeToast(String(err?.message || err), 'warning');
    } finally {
      setBusy(el, false);
    }
  }

  async function onSave(ev) {
    ev?.preventDefault?.();

    if (saving) return;
    saving = true;
    setBusy(el, true);

    const btnSave = el.querySelector('[data-action="guardar"]');
    if (btnSave) btnSave.disabled = true;

    // helpers para leer
    const getStr = (name) => {
      const v = $(`[name="${name}"][data-edit]`, el)?.value;
      const t = (v ?? '').trim();
      return t === '' ? null : t;
    };
    const getNum = (name) => {
      const raw = $(`[name="${name}"][data-edit]`, el)?.value;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };

    try {
      const id = Number($('input[name="id"]', el)?.value || NaN);
      if (!id) throw new Error('Falta parámetro obligatorio: id');

      // Validaciones mínimas
      const asunto = getStr('asunto');
      const descripcion = getStr('descripcion');
      if (!asunto) throw new Error('Asunto es requerido');
      if ((descripcion || '').length < 5) throw new Error('Descripción muy corta');

      const payload = {
        id,
        asunto,
        descripcion,
        prioridad: getNum('prioridad'),
        canal: getNum('canal'),
        contacto_nombre: getStr('contacto_nombre'),
        contacto_telefono: getStr('contacto_telefono'),
        contacto_email: getStr('contacto_email'),
        contacto_cp: getStr('contacto_cp'),
        contacto_calle: getStr('contacto_calle'),
        contacto_colonia: getStr('contacto_colonia'),
        updated_by: Number($('input[name="updated_by"]', el)?.value || (window.__ixSession?.id_usuario ?? 1)) || 1,
      };

      const updated = await updateRequerimiento(payload);

      // Remapear UI con respuesta
      mapToFields(el, updated);
      mapToForm(el, updated);
      el._row = updated;
      snapshot = structuredClone ? structuredClone(updated) : JSON.parse(JSON.stringify(updated));

      setEditMode(false);
      try { el._callbacks?.onUpdated?.(updated); } catch (e) { console.error(e); }
      makeToast('Requerimiento actualizado', 'exito');

    } catch (err) {
      console.error('[Drawer] save error:', err);
      try { el._callbacks?.onError?.(err); } catch (e) { console.error(e); }
      makeToast(String(err?.message || err), 'warning');
    } finally {
      saving = false;
      setBusy(el, false);
      if (btnSave) btnSave.disabled = !(el.classList.contains('editing') || el.classList.contains('mode-edit'));
    }
  }

  async function onDelete(ev) {
    ev?.preventDefault?.();
    if (!el || deleting) return;

    const btn = el.querySelector('[data-action="eliminar"]');
    if (!btn) return;

    // Confirmación de 2 pasos
    if (!btn.dataset.confirm) {
      btn.dataset.confirm = "1";
      const originalTxt = btn.textContent;
      btn.dataset.original = originalTxt;
      btn.textContent = "¿Confirmar borrado?";
      btn.classList.add("danger");
      setTimeout(() => {
        if (!btn) return;
        btn.textContent = btn.dataset.original || "Eliminar";
        btn.removeAttribute("data-confirm");
        btn.removeAttribute("data-original");
      }, 5000);
      return;
    }

    deleting = true;
    btn.disabled = true;
    setBusy(el, true);

    try {
      const id = Number(el.querySelector('input[name="id"]')?.value || NaN);
      if (!id) throw new Error("Falta parámetro obligatorio: id");

      const updated_by =
        Number(el.querySelector('input[name="updated_by"]')?.value ||
          (window.__ixSession?.id_usuario ?? 1)) || 1;

      const payload = { id, status: 0, updated_by }; // soft delete
      const updated = await updateRequerimiento(payload);

      try { el._callbacks?.onUpdated?.(updated); } catch (e) { console.error(e); }
      close();
      makeToast('Requerimiento eliminado', 'exito');

    } catch (err) {
      console.error("[Drawer] delete error:", err);
      try { el._callbacks?.onError?.(err); } catch (e) { console.error(e); }
      makeToast(String(err?.message || err), 'warning');
    } finally {
      deleting = false;
      setBusy(el, false);
      if (btn) btn.disabled = false;
    }
  }

  function onCancel() {
    const hasChanges = true; // simple: asumimos cambios al entrar en edición
    if (hasChanges) {
      const ok = confirm('¿Descartar cambios?');
      if (!ok) return;
    }
    // Revertir a snapshot
    if (snapshot) {
      mapToFields(el, snapshot);
      mapToForm(el, snapshot);
      el._row = snapshot;
    }
    clearPreviews();
    setEditMode(false);
  }

  return { init, open, close, setEditMode };
})();

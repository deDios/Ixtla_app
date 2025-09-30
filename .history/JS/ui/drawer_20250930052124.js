// /JS/ui/drawer.js

const API_BASE = 'https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/';

// Endpoints
const EP_UPDATE = API_BASE + 'ixtla01_u_requerimiento.php';
const EP_FOLDERS = API_BASE + 'ixtla01_u_requerimiento_folders.php';
const EP_MEDIA_LIST = API_BASE + 'ixtla01_c_requerimiento_media.php';    // si no existe, se ignora 404
const EP_MEDIA_UPLOAD = API_BASE + 'ixtla01_u_requerimiento_media.php';

// Regex folio
const FOLIO_RX = /^REQ-\d{10}$/;

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function setText(el, txt) { if (el) el.textContent = (txt ?? '—'); }
function setVal(el, val) { if (el) el.value = (val ?? ''); }

function mapToFields(root, data = {}) {
  $all('[data-field]', root).forEach(el => {
    const key = el.getAttribute('data-field');
    if (!key) return;
    setText(el, data[key] ?? '—');
  });
  // hidden id si existe:
  const hidId = root.querySelector('input[name="id"][data-field="id"]');
  if (hidId && data.id != null) hidId.value = data.id;
}

function mapToForm(root, data = {}) {
  // inputs de edición llevan name=... y data-edit
  $all('[data-edit][name]', root).forEach(el => {
    const key = el.getAttribute('name');
    const v = data[key];
    if (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      setVal(el, v ?? '');
    }
  });
  // hidden obligatorios
  const hidId = root.querySelector('input[name="id"]');
  const hidUb = root.querySelector('input[name="updated_by"]');
  if (hidId && data.id != null) hidId.value = data.id;
  if (hidUb) hidUb.value = (window.__ixSession?.id_usuario ?? 1);
}

function setEditMode(panel, on) {
  panel.classList.toggle('mode-edit', !!on);
  // Guardar habilitado sólo en modo edición
  $all('[data-action="guardar"]', panel).forEach(b => b.disabled = !on);
}

async function ensureFolders(folio) {
  if (!FOLIO_RX.test(String(folio))) {
    console.warn('[Drawer] ensureFolders: folio inválido →', folio);
    return { ok: false, skipped: true };
  }
  const body = { folio, create_status_txt: true };
  console.log('[Drawer] FOLDERS →', EP_FOLDERS, body);
  const res = await fetch(EP_FOLDERS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const txt = await res.text();
  console.log('[Drawer] FOLDERS ←', res.status, txt);
  if (!res.ok) throw new Error(`folders ${res.status}`);
  try { return JSON.parse(txt); } catch { return { ok: false, raw: txt }; }
}

async function listMedia(folio, status) {
  if (!FOLIO_RX.test(String(folio))) {
    console.warn('[Drawer] listMedia: folio inválido →', folio);
    return { ok: true, data: [] };
  }
  const body = { folio, status: Number(status) };
  console.log('[Drawer] LIST MEDIA →', EP_MEDIA_LIST, body);
  const res = await fetch(EP_MEDIA_LIST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const txt = await res.text();
  console.log('[Drawer] LIST MEDIA ←', res.status, txt);
  if (res.status === 404) {
    // endpoint aún no existe: fallback silencioso
    return { ok: true, data: [] };
  }
  if (!res.ok) throw new Error(`list media ${res.status}`);
  try { return JSON.parse(txt); } catch (e) { console.error(e); return { ok: false, raw: txt }; }
}

async function uploadMedia({ folio, status, files }) {
  if (!FOLIO_RX.test(String(folio))) {
    throw new Error('folio inválido en upload');
  }
  const fd = new FormData();
  fd.append('folio', folio);
  fd.append('status', String(status));
  [...files].forEach(f => fd.append('files[]', f));

  console.log('[Drawer] UPLOAD →', EP_MEDIA_UPLOAD, { folio, status, files: files.length });
  const res = await fetch(EP_MEDIA_UPLOAD, { method: 'POST', body: fd });
  const txt = await res.text();
  console.log('[Drawer] UPLOAD ←', res.status, txt);
  if (!res.ok) throw new Error(`upload ${res.status}`);
  return JSON.parse(txt);
}

async function updateRequerimiento(payload) {
  console.log('[Drawer] UPDATE →', EP_UPDATE, payload);
  const res = await fetch(EP_UPDATE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const txt = await res.text();
  console.log('[Drawer] UPDATE ←', res.status, txt);
  if (!res.ok) throw new Error(`update ${res.status}`);
  const json = JSON.parse(txt);
  if (!json.ok) throw new Error(json.error || 'Update no OK');
  return json.data;
}

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

export const Drawer = (() => {
  let el;           // <aside class="ix-drawer">
  let bodyEl;       // .ixd-body
  let formRoot;     // raíz de inputs
  let heroImg;      // [data-img="hero"]
  let pickBtn;      // [data-img="pick"]
  let fileInput;    // [data-img="file"]
  let previewsBox;  // [data-img="previews"]
  let uploadBtn;    // [data-img="uploadBtn"]
  let uploadStatus; // [data-img="uploadStatus"]
  let saving = false;

  function init(selector = '.ix-drawer') {
    el = document.querySelector(selector);
    if (!el) { console.warn('[Drawer] no se encontró', selector); return; }

    if (el.__inited) {
      console.warn('[Drawer] init ignorado (ya inicializado)');
      return;
    }
    el.__inited = true;

    bodyEl = $('.ixd-body', el) || el;
    formRoot = el;
    heroImg = $('[data-img="hero"]', el);
    pickBtn = $('[data-img="pick"]', el);
    fileInput = $('[data-img="file"]', el);
    previewsBox = $('[data-img="previews"]', el);
    uploadBtn = $('[data-img="uploadBtn"]', el);
    uploadStatus = $('[data-img="uploadStatus"]', el);

    // Cerrar
    $all('[data-drawer="close"]', el).forEach(b => b.addEventListener('click', close));

    // Acciones (sólo footer)
    const btnEdit = el.querySelector('[data-action="editar"]');
    const btnSave = el.querySelector('[data-action="guardar"]');
    const btnDelete = el.querySelector('[data-action="eliminar"]');
    btnEdit?.addEventListener('click', () => setEditMode(el, true));
    btnSave?.addEventListener('click', onSave);
    btnDelete?.addEventListener('click', onDelete);

    // Imagen: elegir archivo
    if (pickBtn && fileInput) {
      pickBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        if (!previewsBox) return;
        previewsBox.innerHTML = '';
        const files = fileInput.files || [];
        [...files].forEach(f => buildPreview(f, previewsBox));
        if (uploadBtn) uploadBtn.disabled = files.length === 0;
      });
    }

    // Subida
    if (uploadBtn) {
      uploadBtn.addEventListener('click', async () => {
        try {
          const folio = String($('.ixd-folio', el)?.textContent || '').trim();
          const status = Number(uploadStatus?.value || 0);
          const files = fileInput?.files || [];
          if (!FOLIO_RX.test(folio)) throw new Error('folio inválido antes de subir');
          if (!files.length) return;

          await ensureFolders(folio); // crea dirs si no existen
          const r = await uploadMedia({ folio, status, files });
          console.log('[Drawer] upload ok →', r);
          // limpiar previews
          if (previewsBox) previewsBox.innerHTML = '';
          if (fileInput) fileInput.value = '';
          if (uploadBtn) uploadBtn.disabled = true;

          // TODO: refrescar galería si ya tienes listMedia activo
        } catch (err) {
          console.error('[Drawer] upload error', err);
        }
      });
    }

    console.log('[Drawer] init OK');
  }

  function open(row, callbacks = {}) {
    if (!el) return console.warn('[Drawer] init() primero');
    console.log('[Drawer] open(row) →', row);

    // Guarda el raw para referencia
    el._row = row || {};
    el._callbacks = callbacks || {};

    // Mapeo de campos e inputs
    mapToFields(el, row || {});
    mapToForm(el, row || {});

    // Verificación extra de id
    const hidId = $('input[name="id"]', el);
    console.log('[Drawer] hidden id actual →', hidId?.value, 'row.id →', row?.id);
    if (!hidId || !hidId.value) {
      // intenta setearlo si está en row
      if (row?.id != null && hidId) {
        hidId.value = row.id;
        console.warn('[Drawer] id faltante en hidden, se corrigió con row.id');
      }
    }

    // Folio visible
    const folioEl = $('.ixd-folio', el);
    if (folioEl) setText(folioEl, row?.folio || 'REQ-0000000000');

    // Imagen hero opcional
    if (heroImg) {
      heroImg.src = row?.hero_url || '';
      heroImg.alt = row?.folio || 'Evidencia';
      console.log('[Drawer] hero img →', heroImg.src);
    }

    // Estado inicial: lectura
    setEditMode(el, false);

    // Abre el panel
    el.classList.add('open');

    // Folders (best-effort)
    const folio = row?.folio || '';
    if (FOLIO_RX.test(folio)) {
      ensureFolders(folio).catch(err => console.warn('[Drawer] folders warn:', err));
    } else {
      console.warn('[Drawer] folio no válido, no se consultan carpetas/galería:', folio);
    }
  }

  function close() {
    if (!el) return;
    el.classList.remove('open');
    setEditMode(el, false);
    // limpia previews
    if (previewsBox) previewsBox.innerHTML = '';
    if (fileInput) fileInput.value = '';
    if (uploadBtn) uploadBtn.disabled = true;
    try { el._callbacks?.onClose?.(); } catch (e) { console.error(e); }
  }

  async function onSave(ev) {
    ev?.preventDefault?.();

    if (saving) {
      console.warn('[Drawer] save() ignorado: ya hay una operación en curso');
      return;
    }
    saving = true;

    const btnSave = el.querySelector('[data-action="guardar"]');
    if (btnSave) btnSave.disabled = true;

    // helpers para leer y normalizar
    const getStr = (name) => {
      const v = $(`[name="${name}"][data-edit]`, el)?.value;
      const t = (v ?? '').trim();
      return t === '' ? null : t;
    };
    const getNum = (name) => {
      const raw = $(`[name="${name}"][data-edit]`, el)?.value;
      const n = Number(raw);
      return Number.isFinite(n) && n !== 0 ? n : (n === 0 ? 0 : null);
    };

    try {
      const id = Number($('input[name="id"]', el)?.value || NaN);
      if (!id) throw new Error('Falta parámetro obligatorio: id');

      const payload = {
        id,
        asunto: getStr('asunto'),
        descripcion: getStr('descripcion'),
        prioridad: getNum('prioridad'),
        canal: getNum('canal'),

        contacto_nombre: getStr('contacto_nombre'),
        contacto_telefono: getStr('contacto_telefono'),
        contacto_email: getStr('contacto_email'),
        contacto_cp: getStr('contacto_cp'),
        contacto_calle: getStr('contacto_calle'),
        contacto_colonia: getStr('contacto_colonia'),

        // estatus: getNum('estatus'),

        updated_by: Number($('input[name="updated_by"]', el)?.value || (window.__ixSession?.id_usuario ?? 1)) || 1,
      };

      console.log('[Drawer] save() payload →', payload);

      const updated = await updateRequerimiento(payload);

      mapToFields(el, updated);
      mapToForm(el, updated);
      setEditMode(el, false);

      try { el._callbacks?.onUpdated?.(updated); } catch (e) { console.error(e); }

    } catch (err) {
      console.error('[Drawer] save() error:', err);
      try { el._callbacks?.onError?.(err); } catch (e) { console.error(e); }
    } finally {
      saving = false;
      if (btnSave) btnSave.disabled = !el.classList.contains('mode-edit');
    }
  }


  let deleting = false;
  let deleteConfirmTO = null;

  async function onDelete(ev) {
    ev?.preventDefault?.();
    if (!el) return;

    const btn = el.querySelector('[data-action="eliminar"]');
    if (!btn) return;

    if (!btn.dataset.confirm) {
      btn.dataset.confirm = "1";
      const originalTxt = btn.textContent;
      btn.dataset.original = originalTxt;
      btn.textContent = "¿Confirmar borrado?";
      btn.classList.add("danger"); 

      clearTimeout(deleteConfirmTO);
      deleteConfirmTO = setTimeout(() => {
        if (!btn) return;
        btn.textContent = btn.dataset.original || "Eliminar";
        btn.removeAttribute("data-confirm");
        btn.removeAttribute("data-original");
      }, 5000);
      return; 
    }

    if (deleting) {
      console.warn("[Drawer] delete() ignorado: operación en curso");
      return;
    }
    deleting = true;
    btn.disabled = true;

    // Limpia confirmación visual
    clearTimeout(deleteConfirmTO);
    btn.textContent = btn.dataset.original || "Eliminar";
    btn.removeAttribute("data-confirm");
    btn.removeAttribute("data-original");

    try {
      const id = Number(el.querySelector('input[name="id"]')?.value || NaN);
      if (!id) throw new Error("Falta parámetro obligatorio: id");

      const updated_by =
        Number(el.querySelector('input[name="updated_by"]')?.value ||
          (window.__ixSession?.id_usuario ?? 1)) || 1;

      const payload = {
        id,
        status: 0,        //  activo(1) → inactivo(0)
        updated_by
      };

      console.log("[Drawer] soft delete →", payload);

      const updated = await updateRequerimiento(payload);

      try { el._callbacks?.onUpdated?.(updated); } catch (e) { console.error(e); }
      close();

    } catch (err) {
      console.error("[Drawer] delete() error:", err);
      try { el._callbacks?.onError?.(err); } catch (e) { console.error(e); }
    } finally {
      deleting = false;
      if (btn) btn.disabled = false;
    }
  }


  function paintGallery(resp) {
    const grid = $('[data-img="grid"]', el);
    const empty = $('[data-img="empty"]', el);
    if (!grid || !empty) return;
    grid.innerHTML = '';
    const list = (resp?.data || []).filter(Boolean);
    if (!list.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    grid.innerHTML = list.map(it => `
      <div class="img-card">
        <div class="img-actions"></div>
        <img src="${it.url}" loading="lazy" alt="${it.name || ''}">
        <div class="img-name" title="${it.name || ''}">${it.name || ''}</div>
      </div>`).join('');
  }

  return { init, open, close, setEditMode };
})();

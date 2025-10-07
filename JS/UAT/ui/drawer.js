// /JS/ui/drawer.js
import { setupMedia, listMedia, uploadMedia } from "/UAT/JS/api/media.js";
import { updateRequerimiento } from "/UAT/JS/api/requerimientos.js";

/* ====== Const ====== */
const FOLIO_RX = /^REQ-\d{10}$/;
const MAX_FILES_CLIENT  = 3;
const MAX_BYTES_CLIENT  = 1 * 1024 * 1024; // 1 MB
const ALLOWED_MIME = ["image/jpeg","image/png","image/webp","image/heic","image/heif"];

/* ====== CP/Colonia (catálogo + cache) ====== */
const CP_EP =
  window.IX_CFG_REQ?.ENDPOINTS?.cpcolonia ||
  window.IX_CFG_DEPS?.ENDPOINTS?.cpcolonia ||
  "/db/WEB/ixtla01_c_cpcolonia.php";

const CP_CACHE_KEY = "ix_cpcolonia_cache_v1";
const CP_CACHE_TTL = 10 * 60 * 1000; // 10 min
let CP_MAP = null;   // { "45850": ["Centro","X","Y"] }
let CP_LIST = null;

function cpCacheGet(){
  try{
    const raw = sessionStorage.getItem(CP_CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || Date.now()-obj.t > (obj.ttl||CP_CACHE_TTL)) {
      sessionStorage.removeItem(CP_CACHE_KEY);
      return null;
    }
    return obj;
  } catch { return null; }
}
function cpCacheSet(map,list){
  try{
    sessionStorage.setItem(CP_CACHE_KEY, JSON.stringify({t:Date.now(), ttl:CP_CACHE_TTL, map, list}));
  } catch {}
}
function cpExtract(json){
  const arr = Array.isArray(json?.data) ? json.data :
              (Array.isArray(json) ? json : []);
  const tmp = {};
  for (const it of arr){
    const cp  = String(it.cp ?? it.CP ?? it.codigo_postal ?? it.codigoPostal ?? "").trim();
    const col = String(it.colonia ?? it.Colonia ?? it.asentamiento ?? it.neighborhood ?? "").trim();
    if (!cp || !col) continue;
    if (!tmp[cp]) tmp[cp] = new Set();
    tmp[cp].add(col);
  }
  const map = Object.fromEntries(Object.entries(tmp).map(([k,v]) => [k, [...v].sort((a,b)=>a.localeCompare(b,'es'))]));
  const list = Object.keys(map).sort();
  return { map, list };
}
async function ensureCpCatalog(){
  if (CP_MAP && CP_LIST) return;
  const hit = cpCacheGet();
  if (hit?.map && hit?.list){ CP_MAP = hit.map; CP_LIST = hit.list; return; }
  const r = await fetch(CP_EP, {
    method: "POST",
    headers: { "Content-Type":"application/json", "Accept":"application/json" },
    body: JSON.stringify({ all: true })
  });
  const j = await r.json().catch(()=>null);
  const { map, list } = cpExtract(j || {});
  CP_MAP = map; CP_LIST = list;
  cpCacheSet(CP_MAP, CP_LIST);
}
function makeOpt(v,l,o={}){ const el=document.createElement("option"); el.value=v; el.textContent=l; if(o.disabled)el.disabled=true; if(o.selected)el.selected=true; return el; }

/* ====== DOM utils ====== */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const setText = (el, txt) => { if (el) el.textContent = (txt ?? "—"); };
const setVal  = (el, val) => { if (el) el.value = (val ?? ""); };
const toast = (m,t="info") => { try{ window.gcToast?.(m,t); }catch{} };
const setBusy = (root,on) => root.classList.toggle("is-busy", !!on);

/* ====== Map data → UI ====== */
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

/* ====== Galería ====== */
function ensureGalleryDom(root) {
  let grid  = $('[data-img="grid"]', root);
  let empty = $('[data-img="empty"]', root);
  if (!grid) {
    grid = document.createElement("div");
    grid.className = "ixd-gallery";
    grid.setAttribute("data-img","grid");
    ($(".ixd-body", root) || root).appendChild(grid);
  }
  if (!empty) {
    empty = document.createElement("p");
    empty.className = "muted";
    empty.setAttribute("data-img","empty");
    empty.hidden = true;
    empty.textContent = "No hay imágenes para este estado.";
    grid.parentElement.insertBefore(empty, grid);
  }
  return { grid, empty };
}
function paintGallery(root, resp) {
  const { grid, empty } = ensureGalleryDom(root);
  grid.innerHTML = "";
  const list = (resp?.data || []).filter(Boolean);
  if (!list.length) { empty.hidden = false; return; }
  empty.hidden = true;
  const frag = document.createDocumentFragment();
  list.forEach(it => {
    const a = document.createElement("a");
    a.className = "ixd-card";
    a.href   = it.url || "#";
    a.target = "_blank";
    a.rel    = "noopener";
    a.innerHTML = `
      <img src="${it.url}" loading="lazy" alt="${(it.name||'evidencia')}">
      <div class="nm" title="${it.name||''}">${it.name || ''}</div>
    `;
    frag.appendChild(a);
  });
  grid.appendChild(frag);
}

/* ====== Previews locales ====== */
function buildPreview(file, container) {
  const url  = URL.createObjectURL(file);
  const wrap = document.createElement("div");
  wrap.className = "ixd-prevItem";
  wrap.innerHTML = `
    <img src="${url}" alt="${file.name}" loading="lazy">
    <div class="ixd-prevName">${file.name}</div>
  `;
  container.appendChild(wrap);
}

/* ====== Drawer ====== */
export const Drawer = (() => {
  let el;                 // panel <aside class="ix-drawer">
  let overlayEl;          // overlay [data-drawer="overlay"]
  let closeBtn;           // botón cerrar [data-drawer="close"]

  let heroImg, pickBtn, fileInput, previewsBox, uploadBtn;
  let statusSelView; // [data-img="viewStatus"]
  let statusSelUp;   // [data-img="uploadStatus"]
  let btnSave, btnDelete, btnEdit, btnCancel;

  // CP/Colonia selects (en edición)
  let cpInputSel, colInputSel;

  let saving=false, deleting=false, snapshot=null;

  function showOverlay(flag){
    if (!overlayEl) return;
    overlayEl.hidden = !flag;
    overlayEl.classList.toggle("open", !!flag);
    overlayEl.setAttribute("aria-hidden", String(!flag));
    document.body.style.overflow = flag ? "hidden" : "";
  }

  function init(selector = ".ix-drawer") {
    el = document.querySelector(selector);
    overlayEl = document.querySelector('[data-drawer="overlay"]');
    if (!el) { console.warn("[Drawer] no se encontró", selector); return; }
    if (el.__inited) return; el.__inited = true;

    // A11y: hacer focuseable el dialog
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex","-1");

    closeBtn    = $('[data-drawer="close"]', el);
    heroImg     = $('[data-img="hero"]', el);
    pickBtn     = $('[data-img="pick"]', el);
    fileInput   = $('[data-img="file"]', el);
    previewsBox = $('[data-img="previews"]', el);
    uploadBtn   = $('[data-img="uploadBtn"]', el);

    // selects de estatus (preferimos "viewStatus")
    statusSelView = $('[data-img="viewStatus"]', el);
    statusSelUp   = $('[data-img="uploadStatus"]', el);

    btnSave   = $('[data-action="guardar"]', el);
    btnDelete = $('[data-action="eliminar"]', el);
    btnEdit   = $('[data-action="editar"]', el);
    btnCancel = $('[data-action="cancelar"]', el);

    // Insertar Cancelar si falta
    if (!btnCancel) {
      const footer = $(".ixd-actions--footer", el) || el;
      btnCancel = document.createElement("button");
      btnCancel.className = "btn ixd-cancel";
      btnCancel.type = "button";
      btnCancel.dataset.action = "cancelar";
      btnCancel.textContent = "Cancelar";
      btnCancel.hidden = true;
      btnCancel.style.display = "none";
      footer.insertBefore(btnCancel, btnDelete || null);
    }

    // Eventos de cerrar
    closeBtn?.addEventListener("click", close);
    overlayEl?.addEventListener("click", close);

    // Botonera
    btnEdit?.addEventListener("click", () => setEditMode(true));
    btnSave?.addEventListener("click", onSave);
    btnCancel?.addEventListener("click", onCancel);
    btnDelete?.addEventListener("click", onDelete);

    // Picker/Files
    if (pickBtn && fileInput) {
      pickBtn.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", onFilesPicked);
    }
    if (uploadBtn) {
      uploadBtn.disabled = true;
      uploadBtn.addEventListener("click", onUpload);
    }

    // Cambio de estatus de vista → recarga galería
    (statusSelView || statusSelUp)?.addEventListener("change", async () => {
      const folio = String($(".ixd-folio", el)?.textContent || "").trim();
      if (!FOLIO_RX.test(folio)) return;
      const st = Number((statusSelView || statusSelUp).value || el._row?.estatus || 0);
      setBusy(el, true);
      try { const resp = await listMedia(folio, st, 1, 100); paintGallery(el, resp); }
      finally { setBusy(el, false); }
    });

    // Atajos (incluye Escape para cerrar)
    el.addEventListener("keydown", (ev) => {
      const isEditing = el.classList.contains("editing") || el.classList.contains("mode-edit");
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") {
        if (isEditing) { ev.preventDefault(); onSave(); }
      } else if (ev.key === "Escape") {
        if (isEditing) onCancel(); else close();
      }
    });

    forceReadMode();
  }

  function forceReadMode() {
    $$(".ixd-field p", el).forEach(p => p.hidden = false);
    $$("[data-edit]", el).forEach(i => i.hidden = true);
    if (btnSave)   { btnSave.hidden = true; btnSave.style.display = "none"; btnSave.disabled = true; }
    if (btnDelete) btnDelete.style.display = "";
    if (btnCancel) { btnCancel.hidden = true; btnCancel.style.display = "none"; }
    el.classList.remove("editing","mode-edit");
  }

  function ensureCpColoniaInputs(row={}){
    cpInputSel  = el.querySelector('.ixd-input[name="contacto_cp"][data-edit]');
    colInputSel = el.querySelector('.ixd-input[name="contacto_colonia"][data-edit]');
    if (!cpInputSel || !colInputSel) return;

    // poblar CPs
    cpInputSel.innerHTML = "";
    cpInputSel.appendChild(makeOpt("", "Selecciona C.P.", {disabled:true, selected:true}));
    (CP_LIST || []).forEach(cp => cpInputSel.appendChild(makeOpt(cp, cp)));

    const cpVal = String(row.contacto_cp ?? "").trim();
    if (cpVal && !CP_MAP?.[cpVal]) cpInputSel.appendChild(makeOpt(cpVal, cpVal));
    if (cpVal) cpInputSel.value = cpVal;

    populateColoniasForCP(cpVal, row.contacto_colonia);
    cpInputSel.onchange = () => populateColoniasForCP(cpInputSel.value, null);
  }
  function populateColoniasForCP(cp, selectedCol){
    if (!colInputSel) return;
    const list = CP_MAP?.[String(cp)] || [];
    colInputSel.innerHTML = "";
    colInputSel.appendChild(makeOpt("", "Selecciona colonia", {disabled:true, selected:true}));
    list.forEach(c => colInputSel.appendChild(makeOpt(c, c)));
    colInputSel.disabled = list.length === 0;
    if (selectedCol && list.includes(selectedCol)) colInputSel.value = selectedCol;
  }

  function setEditMode(on) {
    el.classList.toggle("editing", !!on);
    el.classList.toggle("mode-edit", !!on);
    $$(".ixd-field p", el).forEach(p => p.hidden = !!on);
    $$("[data-edit]", el).forEach(i => i.hidden = !on);
    if (btnSave)   { btnSave.hidden = !on; btnSave.style.display = on ? "" : "none"; btnSave.disabled = !on; }
    if (btnDelete) btnDelete.style.display = on ? "none" : "";
    if (btnCancel) { btnCancel.hidden = !on; btnCancel.style.display = on ? "" : "none"; }

    // Cargar catálogo CP/Colonia y encadenar selects al entrar a edición
    if (on) {
      ensureCpCatalog()
        .then(() => ensureCpColoniaInputs(el._row || {}))
        .catch(() => {/* silencioso */});
    }
  }

  function open(row={}, callbacks={}) {
    if (!el) return console.warn("[Drawer] init() primero");
    forceReadMode();

    el._row = row; el._callbacks = callbacks;
    snapshot = JSON.parse(JSON.stringify(row));

    // Header/Meta
    const folioEl = $(".ixd-folio", el);
    setText(folioEl, row.folio || "REQ-0000000000");
    mapToFields(el, row);
    mapToForm(el, row);

    // Hero
    if (heroImg) { heroImg.src = row.hero_url || ""; heroImg.alt = row.folio || "Evidencia"; }

    // Estatus select inicial
    const st = Number(row.estatus ?? 0);
    if (statusSelView) statusSelView.value = String(st);
    if (statusSelUp)   statusSelUp.value   = String(st);

    // Abre panel + overlay
    el.classList.add("open");
    el.setAttribute("aria-hidden","false");
    showOverlay(true);

    // Cargar galería
    const folio = row.folio || "";
    if (FOLIO_RX.test(folio)) {
      setBusy(el, true);
      listMedia(folio, st, 1, 100)
        .then(resp => paintGallery(el, resp))
        .finally(() => setBusy(el, false));
    }

    // Asegurar foco accesible
    try { el.focus?.(); } catch {}
  }

  function close() {
    if (!el) return;
    el.classList.remove("open");
    el.setAttribute("aria-hidden","true");
    showOverlay(false);
    clearPreviews();
    forceReadMode();
    // Reset de confirmación de borrado (por si se quedó en 2do paso)
    if (btnDelete) {
      btnDelete.textContent = btnDelete.dataset.original || btnDelete.textContent || "Eliminar";
      btnDelete.classList.remove("danger");
      btnDelete.removeAttribute("data-confirm");
      btnDelete.removeAttribute("data-original");
    }
    try { el._callbacks?.onClose?.(); } catch {}
  }

  function onFilesPicked() {
    if (!previewsBox || !fileInput) return;
    previewsBox.innerHTML = "";

    const all = Array.from(fileInput.files || []);
    const valid = [];
    const errors = [];

    all.forEach(f => {
      if (f.size > MAX_BYTES_CLIENT) { errors.push(`"${f.name}" excede 1 MB`); return; }
      if (!ALLOWED_MIME.includes(f.type)) { errors.push(`"${f.name}" tipo no permitido (${f.type||"?"})`); return; }
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
    const folio = String($(".ixd-folio", el)?.textContent || "").trim();
    const status = Number((statusSelUp || statusSelView)?.value || el._row?.estatus || 0);
    const files = Array.from(fileInput?.files || []); // eslint-disable-line no-undef

    if (!FOLIO_RX.test(folio)) { toast("Folio inválido", "warning"); return; }
    if (!files.length) return;

    // Validación final en cliente
    const valid = [];
    const invalid = [];
    for (const f of files) {
      if (f.size > MAX_BYTES_CLIENT) { invalid.push(`"${f.name}" > 1 MB`); continue; }
      if (!ALLOWED_MIME.includes(f.type)) { invalid.push(`"${f.name}" tipo ${f.type||"?"}`); continue; }
      valid.push(f);
    }
    if (!valid.length) { toast(invalid.join("\n") || "Archivos no válidos", "warning"); return; }

    setBusy(el, true);
    try {
      // Preparar carpetas (best-effort, sin romper si falla)
      try { await setupMedia(folio); } catch {}

      const r = await uploadMedia({ folio, status, files: valid });
      const ok = r.ok && (r.saved?.length || 0) > 0;
      toast(`Subida: ${r.saved?.length||0} ok, ${r.failed?.length||0} error${r.skipped?.length?`, ${r.skipped.length} omitido(s)`:""}`, ok ? "exito" : "warning");

      clearPreviews();

      // refrescar galería según estatus visible
      const viewSt = Number((statusSelView || statusSelUp)?.value || status || 0);
      const resp = await listMedia(folio, viewSt, 1, 100);
      paintGallery(el, resp);
    } catch (err) {
      console.error("[Drawer] upload error:", err);
      toast(String(err?.message || err), "warning");
    } finally {
      setBusy(el, false);
    }
  }

  async function onSave(ev) {
    ev?.preventDefault?.();
    if (saving) return;
    saving = true;
    setBusy(el, true);
    if (btnSave) btnSave.disabled = true;

    const getStr = (name) => {
      const v = $(`[name="${name}"][data-edit]`, el)?.value ?? "";
      const t = v.trim();
      return t === "" ? null : t;
    };
    const getNum = (name) => {
      const raw = $(`[name="${name}"][data-edit]`, el)?.value;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };

    try {
      const id = Number($('input[name="id"]', el)?.value || NaN);
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
        updated_by: Number($('input[name="updated_by"]', el)?.value || (window.__ixSession?.id_usuario ?? 1)) || 1,
      };

      const updated = await updateRequerimiento(payload);
      mapToFields(el, updated);
      mapToForm(el, updated);
      el._row = updated;
      snapshot = JSON.parse(JSON.stringify(updated));
      setEditMode(false);
      try { el._callbacks?.onUpdated?.(updated); } catch {}
      toast("Requerimiento actualizado", "exito");
    } catch (err) {
      console.error("[Drawer] save error:", err);
      try { el._callbacks?.onError?.(err); } catch {}
      toast(String(err?.message || err), "warning");
    } finally {
      saving = false;
      setBusy(el, false);
      if (btnSave) btnSave.disabled = !(el.classList.contains("editing") || el.classList.contains("mode-edit"));
    }
  }

  async function onDelete(ev) {
    ev?.preventDefault?.();
    if (!el || deleting) return;
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
    setBusy(el, true);

    try {
      const id = Number($('input[name="id"]', el)?.value || NaN);
      if (!id) throw new Error("Falta id");
      const updated_by = Number($('input[name="updated_by"]', el)?.value || (window.__ixSession?.id_usuario ?? 1)) || 1;

      const updated = await updateRequerimiento({ id, status: 0, updated_by }); // soft delete
      try { el._callbacks?.onUpdated?.(updated); } catch {}
      close();
      toast("Requerimiento eliminado", "exito");
    } catch (err) {
      console.error("[Drawer] delete error:", err);
      try { el._callbacks?.onError?.(err); } catch {}
      toast(String(err?.message || err), "warning");
    } finally {
      deleting = false;
      setBusy(el, false);
      btnDelete.disabled = false;
    }
  }

  function onCancel() {
    if (!confirm("¿Descartar cambios?")) return;
    if (snapshot) {
      mapToFields(el, snapshot);
      mapToForm(el, snapshot);
      el._row = snapshot;
    }
    clearPreviews();
    forceReadMode();
  }

  return { init, open, close, setEditMode };
})();

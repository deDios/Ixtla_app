// /JS/ui/drawer.js

import { updateRequerimiento } from "/JS/api/requerimientos.js";
import { listMedia, uploadMedia } from "/JS/api/media.js";

/* ====== Constantes de UI ====== */
const ESTATUS = {
  0: { clave: "solicitud",  nombre: "Solicitud"   },
  1: { clave: "revision",   nombre: "Revisión"    },
  2: { clave: "asignacion", nombre: "Asignación"  },
  3: { clave: "enProceso",  nombre: "En proceso"  },
  4: { clave: "pausado",    nombre: "Pausado"     },
  5: { clave: "cancelado",  nombre: "Cancelado"   },
  6: { clave: "finalizado", nombre: "Finalizado"  },
};
const PRIORIDAD = { 1: "Baja", 2: "Media", 3: "Alta" };

// CP/Colonia endpoint
const CP_EP =
  window.IX_CFG_REQ?.ENDPOINTS?.cpcolonia ||
  window.IX_CFG_DEPS?.ENDPOINTS?.cpcolonia ||
  "/DB/WEB/ixtla01_c_cpcolonia.php";
const CP_CACHE_KEY = "ix_cpcolonia_cache_v1";
const CP_CACHE_TTL = 10 * 60 * 1000;

/* ====== Utils DOM ====== */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const setText = (el, txt) => { if (el) el.textContent = (txt ?? "—"); };
const setVal  = (el, val) => { if (el) el.value = (val ?? ""); };
const getSessUserId = () => window.__ixSession?.id_usuario ?? 1;
const fmtDate = (str) => {
  if (!str) return "—";
  try {
    const d = (str instanceof Date) ? str : new Date(String(str).replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? String(str) : d.toLocaleString();
  } catch { return String(str); }
};
function htm(html){ const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }

/* ====== CP/Colonia (cache opcional) ====== */
let CP_MAP = null; let CP_LIST = null;
function cpCacheGet(){ try{ const raw=sessionStorage.getItem(CP_CACHE_KEY); if(!raw) return null; const obj=JSON.parse(raw); if(!obj||Date.now()-obj.t>(obj.ttl||CP_CACHE_TTL)){ sessionStorage.removeItem(CP_CACHE_KEY); return null;} return obj;}catch{return null;} }
function cpCacheSet(map,list){ try{ sessionStorage.setItem(CP_CACHE_KEY, JSON.stringify({t:Date.now(), ttl:CP_CACHE_TTL, map, list})); }catch{} }
function cpExtract(json){ const arr=Array.isArray(json?.data)?json.data:(Array.isArray(json)?json:[]); const tmp={}; for(const it of arr){ const cp=String(it.cp??it.CP??it.codigo_postal??it.codigoPostal??"").trim(); const col=String(it.colonia??it.Colonia??it.asentamiento??it.neighborhood??"").trim(); if(!cp||!col) continue; if(!tmp[cp]) tmp[cp]=new Set(); tmp[cp].add(col);} const map=Object.fromEntries(Object.entries(tmp).map(([k,v])=>[k,[...v].sort((a,b)=>a.localeCompare(b,'es'))])); const list=Object.keys(map).sort(); return {map,list}; }
async function ensureCpCatalog(){ if(CP_MAP&&CP_LIST) return; const hit=cpCacheGet(); if(hit?.map&&hit?.list){ CP_MAP=hit.map; CP_LIST=hit.list; return; } const r=await fetch(CP_EP,{ method:"POST", headers:{"Content-Type":"application/json", Accept:"application/json"}, body: JSON.stringify({all:true})}); const j=await r.json().catch(()=>null); const {map,list}=cpExtract(j||{}); CP_MAP=map; CP_LIST=list; cpCacheSet(CP_MAP,CP_LIST); }
function makeOpt(v,l,o={}){ const el=document.createElement("option"); el.value=v; el.textContent=l; if(o.disabled) el.disabled=true; if(o.selected) el.selected=true; return el; }

/* ====== Drawer ====== */
export const Drawer = (() => {
  let el, overlayEl; let bodyEl;
  let btnEdit, btnSave, btnDelete, btnCancel, btnPause;
  let heroImg, pickBtn, fileInput, previewsBox, uploadBtn;
  let galleryGrid, galleryEmpty, galleryStatusSel; // único select
  let cpInputSel, colInputSel;

  // anti-race para la galería
  let galleryToken = 0;

  let saving=false, deleting=false, uploading=false;

  function init(selector = ".ix-drawer"){
    el = document.querySelector(selector);
    overlayEl = document.querySelector('[data-drawer="overlay"]');
    if (!el) { console.warn("[Drawer] no se encontró", selector); return; }
    if (el.__inited) return; el.__inited = true;

    bodyEl = $(".ixd-body", el) || el;

    // Cerrar
    $$('[data-drawer="close"]', el).forEach(b => b.addEventListener('click', close));
    el.addEventListener('keydown', (ev)=>{ if(ev.key==='Escape') close(); });
    overlayEl?.addEventListener('click', close);

    // Footer
    btnEdit   = $('[data-action="editar"]', el);
    btnSave   = $('[data-action="guardar"]', el);
    btnDelete = $('[data-action="eliminar"]', el);
    btnCancel = $('[data-action="cancelar"]', el);
    btnPause  = $('[data-action="pausar"]', el);

    if (!btnCancel){
      btnCancel = htm('<button class="btn ixd-cancel" data-action="cancelar" type="button" style="display:none">Cancelar</button>');
      $(".ixd-actions--footer", el)?.insertBefore(btnCancel, btnDelete || null);
    }

    btnEdit?.addEventListener('click', ()=> setEditMode(true));
    btnSave?.addEventListener('click', onSave);
    btnCancel?.addEventListener('click', onCancel);
    btnDelete?.addEventListener('click', onDelete);
    btnPause?.addEventListener('click', onPauseToggle);

    // Imagen / Uploader
    heroImg    = $('[data-img="hero"]', el);
    pickBtn    = $('[data-img="pick"]', el);
    fileInput  = $('[data-img="file"]', el);
    previewsBox= $('[data-img="previews"]', el);
    uploadBtn  = $('[data-img="uploadBtn"]', el);

    // Unificar selects: usar solo viewStatus; remover uploadStatus si existe
    galleryStatusSel = $('[data-img="viewStatus"]', el) || $('[data-img="galleryStatus"]', el) || $('[name="gallery_status"]', el);
    const dupUpload = $('[data-img="uploadStatus"]', el); if (dupUpload && dupUpload !== galleryStatusSel) dupUpload.remove();

    // pick siempre disponible (también en vista)
    if (pickBtn && fileInput){ pickBtn.addEventListener('click', ()=> fileInput.click()); }

    // build previews + auto-upload si se abrió picker desde el botón "Subir"
    if (fileInput){ fileInput.addEventListener('change', ()=>{
      buildPreviews();
      if (el._intentUploadAfterPick){ el._intentUploadAfterPick=false; doUpload(); }
    }); }

    if (uploadBtn){
      uploadBtn.disabled = false;
      uploadBtn.addEventListener('click', ()=>{
        const hasFiles = (fileInput?.files?.length || 0) > 0;
        if (!hasFiles){ el._intentUploadAfterPick = true; fileInput?.click(); return; }
        doUpload();
      });
    }

    // Galería
    galleryGrid = $('[data-img="grid"]', el);
    if (!galleryGrid){
      const wrap = htm('<div class="ixd-viewRow"><div class="ixd-gallery" data-img="grid"></div></div>');
      bodyEl.appendChild(wrap);
      galleryGrid = $('[data-img="grid"]', el);
    }
    galleryEmpty = $('[data-img="empty"]', el) || htm('<p class="muted" data-img="empty" hidden>No hay imágenes para este estado.</p>');
    if (!galleryEmpty.isConnected) galleryGrid.parentElement.insertBefore(galleryEmpty, galleryGrid);

    galleryStatusSel?.addEventListener('change', ()=>{
      const fol = getFolio(); const st=getSelectedGalleryStatus();
      if (/^REQ-\d{10}$/.test(fol)) refreshGallery(fol, st);
    });

    resetModeToRead();
  }

  function getFolio(){ return String($(".ixd-folio", el)?.textContent || "").trim(); }
  function getSelectedGalleryStatus(){ return Number(galleryStatusSel?.value ?? $("[name=\"estatus\"]", el)?.value ?? 0) || 0; }

  function buildPreviews(){
    if (!previewsBox) return;
    if (el._previewURLs){ el._previewURLs.forEach(u=>URL.revokeObjectURL(u)); }
    el._previewURLs = [];
    previewsBox.innerHTML = "";
    const files = Array.from(fileInput?.files || []);
    files.forEach(f=>{
      const url = URL.createObjectURL(f); el._previewURLs.push(url);
      const fig = htm(`<div class="thumb"><img src="${url}" alt="${f.name}"><button class="rm" type="button">Quitar</button></div>`);
      fig.querySelector('.rm')?.addEventListener('click', ()=>{
        const arr = Array.from(fileInput.files || []); const idx = arr.indexOf(f);
        const dt = new DataTransfer(); arr.forEach((it,i)=>{ if(i!==idx) dt.items.add(it); }); fileInput.files = dt.files;
        URL.revokeObjectURL(url); fig.remove();
      });
      previewsBox.appendChild(fig);
    });
  }

  async function doUpload(){
    if (uploading) return;
    const folio = getFolio(); if (!/^REQ-\d{10}$/.test(folio)) return;
    const files = fileInput?.files || []; const status = getSelectedGalleryStatus();
    try{
      uploading = true; el.setAttribute('aria-busy','true');
      const res = await uploadMedia({ folio, status, files });
      if (!res?.ok){
        const detail = (res?._clientRejected?.length)
          ? "\n" + res._clientRejected.map(r => `• ${r.name}: ${r.reason}`).join("\n")
          : "";
        window.gcToast?.(`No se pudo subir: ${res?.error || "error"}` + detail, "alerta");
        return;
      }
      // limpiar previews y file input
      if (previewsBox) previewsBox.innerHTML = "";
      if (fileInput) fileInput.value = "";
      if (el._previewURLs){ el._previewURLs.forEach(u=>URL.revokeObjectURL(u)); el._previewURLs = []; }
      await refreshGallery(folio, status);
      window.gcToast?.("Archivo(s) subido(s)", "exito");
    }catch(e){ console.error('[Drawer] upload error', e); window.gcToast?.("No se pudieron subir las imágenes", "alerta"); }
    finally { uploading=false; el.removeAttribute('aria-busy'); }
  }

  /* ====== Mapear data → UI ====== */
  function mapToFields(data={}){
    // General: pinta todos los <p data-field>
    $$(".ixd-field [data-field]", el).forEach(p=>{
      const k = p.getAttribute('data-field');
      let val = data[k];
      if (k === 'prioridad') val = PRIORIDAD[Number(val)] || val || '—';
      if (k === 'estatus' || k === 'estatus_txt'){
        const ev = Number(data.estatus); val = ESTATUS[ev]?.nombre ?? String(ev ?? '—');
      }
      if (k === 'created_at') val = fmtDate(val);
      setText(p, val ?? '—');
    });

    // Folio en header
    setText($(".ixd-folio", el), data.folio || "REQ-0000000000");

    // Imagen hero (opcional)
    if (heroImg){ heroImg.src = data.hero_url || heroImg.src || ""; heroImg.alt = data.folio || "Evidencia"; }

    // Meta header explícitas (por robustez):
    setText($('[data-field="tramite_nombre"]', el), data.tramite_nombre ?? data.tramite ?? data.tipo_tramite ?? '—');
    setText($('[data-field="departamento_nombre"]', el), data.departamento_nombre ?? data.depto_nombre ?? data.departamento ?? data.depto ?? '—');
    setText($('[data-field="asignado_nombre_completo"]', el), data.asignado_nombre_completo ?? data.asignado_nombre ?? data.asignado_a ?? data.responsable_nombre ?? '—');
    setText($('[data-field="created_at"]', el), fmtDate(data.created_at ?? data.fecha_creacion ?? data.creado));
  }

  function mapToForm(data={}){
    $$('[data-edit][name]', el).forEach(i=>{ const name=i.getAttribute('name'); setVal(i, data[name] ?? ''); });
    const pr = $('[name="prioridad"][data-edit]', el); if (pr && !pr.value) pr.value = String(data.prioridad ?? 2);
    const st = $('[name="estatus"][data-edit]', el); if (st) st.value = String(data.estatus ?? 0);
    const hidId = $('input[name="id"]', el); if (hidId && data.id!=null) hidId.value = data.id;
    const hidUb = $('input[name="updated_by"]', el); if (hidUb) hidUb.value = getSessUserId();
  }

  /* ====== CP/Colonia en edición ====== */
  function ensureCpColoniaInputs(row={}){
    // En tu HTML ya son <select>; solo poblar opciones y dependencias
    cpInputSel = $('.ixd-input[name="contacto_cp"]', el);
    colInputSel= $('.ixd-input[name="contacto_colonia"]', el);
    if (!cpInputSel || !colInputSel) return;

    cpInputSel.innerHTML = '';
    cpInputSel.appendChild(makeOpt('', 'Selecciona C.P.', {disabled:true, selected:true}));
    (CP_LIST || []).forEach(cp=> cpInputSel.appendChild(makeOpt(cp, cp)));
    const cpVal = String(row.contacto_cp ?? '').trim();
    if (cpVal && !CP_MAP?.[cpVal]) cpInputSel.appendChild(makeOpt(cpVal, cpVal));
    if (cpVal) cpInputSel.value = cpVal;
    populateColoniasForCP(cpVal, row.contacto_colonia);
    cpInputSel.onchange = ()=> populateColoniasForCP(cpInputSel.value, null);
  }
  function populateColoniasForCP(cp, selectedCol){
    if (!colInputSel) return;
    colInputSel.innerHTML = '';
    colInputSel.appendChild(makeOpt('', 'Selecciona colonia', {disabled:true, selected:true}));
    const list = CP_MAP?.[cp] || []; list.forEach(c=> colInputSel.appendChild(makeOpt(c, c)));
    colInputSel.disabled = list.length === 0;
    if (selectedCol && list.includes(selectedCol)) colInputSel.value = selectedCol;
  }

  /* ====== Modo edición ====== */
  function toggleSave(show){ if (btnSave){ btnSave.hidden=!show; btnSave.style.display = show? '' : 'none'; btnSave.disabled=!show; } }
  function toggleCancel(show){ if (btnCancel){ btnCancel.hidden=!show; btnCancel.style.display = show? '' : 'none'; } }
  function toggleDelete(show){ if (btnDelete){ btnDelete.hidden=!show; } }
  function togglePause(show){ if (btnPause){ btnPause.hidden=!show; } }

  function setEditMode(on){
    el.classList.toggle('mode-edit', !!on);
    el.classList.toggle('editing',  !!on);
    toggleSave(on); toggleCancel(on); toggleDelete(!on); togglePause(!on);
    if (on){ ensureCpCatalog().then(()=> ensureCpColoniaInputs(el._row || {})).catch(()=>{});
      setTimeout(()=>{ const first=$('[data-edit]:not([hidden])', el); first?.focus?.(); }, 0);
    }
  }
  function resetModeToRead(){ el.classList.remove('editing','mode-edit'); toggleSave(false); toggleCancel(false); toggleDelete(true); togglePause(true); }

  /* ====== Abrir / Cerrar ====== */
  function open(row, callbacks={}){
    if (!el) return console.warn('[Drawer] init() primero');
    el._row = row || {}; el._orig = JSON.parse(JSON.stringify(row || {})); el._callbacks = callbacks || {};

    mapToFields(row); mapToForm(row); paintPauseButton(row?.estatus);

    // forzar el selector de galería al estatus del req abierto (evita arrastre de otro req)
    if (galleryStatusSel) galleryStatusSel.value = String(row?.estatus ?? 0);

    el.classList.add('open');
    overlayEl?.removeAttribute('hidden');
    resetModeToRead();

    galleryToken++; const myTok = galleryToken;
    const st = getSelectedGalleryStatus() || Number(row?.estatus ?? 0);
    const fol = row?.folio || '';
    if (/^REQ-\d{10}$/.test(fol)) refreshGallery(fol, st, myTok);
  }

  async function refreshGallery(folio, status, myTok=galleryToken){
    try{
      el.setAttribute('aria-busy','true');
      const { ok, data } = await listMedia(folio, status, 1, 100);
      if (myTok !== galleryToken) return; // respuesta tardía → ignorar
      const list = ok && Array.isArray(data) ? data : [];
      galleryGrid.innerHTML = '';
      if (!list.length){ galleryEmpty.hidden = false; return; }
      galleryEmpty.hidden = true;
      const frag = document.createDocumentFragment();
      list.forEach(it=>{
        const card = htm(`<a class="ixd-card" href="${it.url}" target="_blank" rel="noopener"><img src="${it.url}" loading="lazy" alt="${it.name||''}"><div class="ixd-name" style="padding:6px 8px;font-size:.85rem;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${it.name||''}</div></a>`);
        frag.appendChild(card);
      });
      galleryGrid.appendChild(frag);
    }catch(e){ console.warn('[Drawer] gallery error:', e); galleryGrid.innerHTML=''; galleryEmpty.hidden=false; }
    finally{ el.removeAttribute('aria-busy'); }
  }

  function close(){
    if (!el) return; el.classList.remove('open'); overlayEl?.setAttribute('hidden','');
    resetModeToRead();
    if (previewsBox) previewsBox.innerHTML = '';
    if (fileInput) fileInput.value = '';
    if (el._previewURLs){ el._previewURLs.forEach(u=>URL.revokeObjectURL(u)); el._previewURLs = []; }
    // limpiar header corto
    setText($(".ixd-folio", el), "REQ-0000000000");
    try{ el._callbacks?.onClose?.(); }catch{}
  }

  /* ====== Guardar / Cancelar / Eliminar / Pausar ====== */
  async function onSave(ev){
    ev?.preventDefault?.(); if (saving) return; saving=true; if (btnSave) btnSave.disabled = true;
    const getStr = (name)=>{ const v=$(`[name="${name}"][data-edit]`, el)?.value; const t=(v??'').trim(); return t===''? null : t; };
    const getNum = (name)=>{ const raw=$(`[name="${name}"][data-edit]`, el)?.value; const n=Number(raw); return Number.isFinite(n)? n : null; };
    try{
      const id = Number($('input[name="id"]', el)?.value || NaN); if (!id) throw new Error('Falta id');
      const payload = {
        id,
        asunto: getStr('asunto'), descripcion: getStr('descripcion'), prioridad: getNum('prioridad'), canal: getNum('canal'),
        contacto_nombre: getStr('contacto_nombre'), contacto_telefono: getStr('contacto_telefono'), contacto_email: getStr('contacto_email'), contacto_cp: getStr('contacto_cp'), contacto_calle: getStr('contacto_calle'), contacto_colonia: getStr('contacto_colonia'),
        estatus: getNum('estatus'),
        updated_by: Number($('input[name="updated_by"]', el)?.value || getSessUserId()) || getSessUserId(),
      };
      const updated = await updateRequerimiento(payload);
      el._row = updated; el._orig = JSON.parse(JSON.stringify(updated));
      mapToFields(updated); mapToForm(updated); paintPauseButton(updated?.estatus); setEditMode(false);
      try{ el._callbacks?.onUpdated?.(updated); }catch{}
      window.gcToast?.('Requerimiento actualizado', 'exito');
    }catch(err){ console.error('[Drawer] save error:', err); try{ el._callbacks?.onError?.(err); }catch{} window.gcToast?.('No se pudo guardar', 'alerta'); }
    finally{ saving=false; if (btnSave) btnSave.disabled=false; }
  }

  function onCancel(){ const row=el._orig || {}; mapToFields(row); mapToForm(row); paintPauseButton(row?.estatus); setEditMode(false); }

  async function onDelete(){
    if (deleting) return; if (!confirm('¿Desactivar este requerimiento?')) return;
    try{
      deleting = true; if (btnDelete) btnDelete.disabled = true;
      const id = Number($('input[name="id"]', el)?.value || NaN); if (!id) throw new Error('Falta id');
      const updated = await updateRequerimiento({ id, status: 0, updated_by: getSessUserId() });
      try{ el._callbacks?.onUpdated?.(updated); }catch{}
      close();
    }catch(e){ console.error('[Drawer] delete error:', e); window.gcToast?.('No se pudo desactivar', 'alerta'); }
    finally{ deleting=false; if (btnDelete) btnDelete.disabled=false; }
  }

  function paintPauseButton(estatus){
    const st = Number(estatus ?? 0); if (!btnPause) return;
    if (st === 4){ btnPause.textContent='Reanudar'; btnPause.classList.remove('warning'); btnPause.classList.add('success'); btnPause.dataset.mode='resume'; }
    else { btnPause.textContent='Pausar';   btnPause.classList.remove('success'); btnPause.classList.add('warning'); btnPause.dataset.mode='pause'; }
  }

  async function onPauseToggle(){
    const row=el._row || {}; const id=Number(row.id || 0); if (!id) return;
    const mode=btnPause?.dataset.mode || 'pause'; const next = (mode==='pause')? 4 : 0; // 4=Pausado, 0=Solicitud
    try{
      btnPause.disabled = true;
      const updated = await updateRequerimiento({ id, estatus: next, updated_by: getSessUserId() });
      el._row = updated; el._orig = JSON.parse(JSON.stringify(updated));
      mapToFields(updated); mapToForm(updated); paintPauseButton(updated?.estatus);
      try{ el._callbacks?.onUpdated?.(updated); }catch{}
      window.gcToast?.('Estatus actualizado', 'info');
    }catch(e){ console.error('[Drawer] pause/resume error:', e); window.gcToast?.('No se pudo actualizar estatus', 'alerta'); }
    finally{ btnPause.disabled = false; }
  }

  // API pública
  return { init, open, close, setEditMode };
})();

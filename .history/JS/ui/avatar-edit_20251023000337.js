// /JS/ui/avatar-edit.js
"use strict";

/* ====================== Config ====================== */
const DEFAULT_ENDPOINT = "/db/WEB/ixtla01_u_usuario_avatar.php";
const MAX_BYTES = 1 * 1024 * 1024;
const VALID_TYPES = ["image/jpeg","image/png","image/webp","image/heic","image/heif"];

/* ====================== Session / Utils ====================== */
function getSession() {
  try { if (window.Session?.get) return window.Session.get(); } catch {}
  try {
    const name = "ix_emp=";
    const pair = document.cookie.split("; ").find(c => c.startsWith(name));
    if (!pair) return null;
    const raw = decodeURIComponent(pair.slice(name.length));
    return JSON.parse(decodeURIComponent(escape(atob(raw))));
  } catch {}
  return null;
}
const toast = (m,t="info") => window.gcToast ? gcToast(m,t) : console.log(`[avatar] ${t}: ${m}`);
const cacheBust = (u) => (u.split("?")[0]) + (u.includes("?")?"&":"?") + "t=" + Date.now();

/** Refresca avatar en sidebar/header móvil/desktop */
function refreshAvatarEverywhere(url) {
  const bust = cacheBust(url);
  const img = document.getElementById("hs-avatar");
  if (img) img.src = bust;
  document.querySelectorAll(".actions .img-perfil, .user-icon-mobile img").forEach(el => el.src = bust);
}

/* ====================== Upload ====================== */
async function uploadAvatar(file, usuarioId, endpoint=DEFAULT_ENDPOINT) {
  if (!file) return;
  if (!VALID_TYPES.includes(file.type)) {
    toast("Formato no permitido. Usa JPG/PNG/WEBP/HEIC/HEIF.","warning");
    return;
  }
  if (file.size > MAX_BYTES) {
    toast("La imagen supera 1MB. Se optimizará en el servidor.","warning");
  }

  const fd = new FormData();
  fd.append("usuario_id", String(usuarioId));
  fd.append("avatar", file);

  const res  = await fetch(endpoint, { method:"POST", body: fd });
  const data = await res.json().catch(()=> ({}));
  if (!res.ok || data.ok === false || data.error) {
    toast(data.error || "No se pudo actualizar el avatar.", "error");
    throw new Error(data.error || "upload failed");
  }
  if (data.url) refreshAvatarEverywhere(data.url);
  toast("Imagen de perfil actualizada", "exito");
  return data;
}

/* ====================== Modal (EDA) ====================== */
/** LocalStorage para recientes */
const EDA_RECENTS_KEY = "eda:recientes:v1";
const recents = {
  load() { try { return JSON.parse(localStorage.getItem(EDA_RECENTS_KEY) || "[]"); } catch { return []; } },
  save(arr) { try { localStorage.setItem(EDA_RECENTS_KEY, JSON.stringify(arr.slice(0,8))); } catch {} },
  async remember(file) {
    try {
      const du = await fileToDataUrl(file, 512);
      const arr = recents.load(); arr.unshift({ dataUrl: du, ts: Date.now() });
      recents.save(arr);
    } catch {}
  }
};

function canAccept(file) {
  if (!file) return { ok:false, msg:"No se recibió archivo." };
  if (!VALID_TYPES.includes(file.type)) return { ok:false, msg:"Formato no permitido. Usa JPG/PNG/WEBP/HEIC/HEIF." };
  return { ok:true };
}

function dataUrlToFile(dataUrl, filename="avatar.png") {
  const arr = dataUrl.split(",");
  const mime = (arr[0].match(/:(.*?);/) || [,"image/png"])[1];
  const bstr = atob(arr[1]);
  const u8 = new Uint8Array(bstr.length);
  for (let i=0;i<bstr.length;i++) u8[i]=bstr.charCodeAt(i);
  return new File([u8], filename, { type:mime });
}

function fileToDataUrl(file, maxSize=1024) {
  return new Promise((resolve, reject)=>{
    const fr = new FileReader();
    fr.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const cw = Math.round(img.width*scale), ch = Math.round(img.height*scale);
        const cvs = document.createElement("canvas"); cvs.width=cw; cvs.height=ch;
        const ctx = cvs.getContext("2d");
        ctx.drawImage(img, 0, 0, cw, ch);
        resolve(cvs.toDataURL("image/png", 0.92));
      };
      img.onerror = reject;
      img.src = fr.result;
    };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

function ensureEditorDom() {
  let overlay = document.getElementById("eda-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.className = "eda-overlay";
  overlay.id = "eda-overlay";
  overlay.innerHTML = `
    <div class="eda-modal" role="dialog" aria-modal="true" aria-labelledby="eda-title">
      <div class="eda-header">
        <div class="eda-title" id="eda-title">Editar avatar</div>
        <div class="eda-actions"><button class="btn" id="eda-close" type="button">Cerrar</button></div>
      </div>
      <div class="eda-body">
        <div class="eda-left">
          <div class="eda-drop" id="eda-drop" aria-label="Zona para arrastrar y soltar imágenes">
            <div class="eda-drop-cta">
              <strong>Arrastra una imagen</strong> o 
              <button class="btn btn-outline" id="eda-choose" type="button">Elegir archivo</button>
              <div class="eda-hint">También puedes pegar con <kbd>Ctrl</kbd>+<kbd>V</kbd></div>
            </div>
          </div>
          <div class="eda-preview">
            <div class="eda-preview-wrap">
              <img id="eda-preview-img" alt="Vista previa" />
              <div class="eda-mask" aria-hidden="true"></div>
            </div>
          </div>
        </div>
        <div class="eda-right">
          <div class="eda-recents">
            <div class="eda-recents-title">Recientes</div>
            <div class="eda-recents-grid" id="eda-recents-grid"><div class="eda-empty">Sin recientes</div></div>
          </div>
        </div>
      </div>
      <div class="eda-footer">
        <div class="eda-hint">JPG, PNG, WebP, HEIC/HEIF · Máx 1MB</div>
        <div class="eda-actions">
          <button class="btn" id="eda-cancel" type="button">Cancelar</button>
          <button class="btn blue" id="eda-save" type="button" disabled>Guardar</button>
        </div>
      </div>
      <input type="file" id="eda-file" accept="${VALID_TYPES.join(",")}" hidden />
    </div>`;
  document.body.appendChild(overlay);
  return overlay;
}

function renderRecentsGrid(root) {
  const grid = root.querySelector("#eda-recents-grid");
  if (!grid) return;
  const arr = recents.load();
  grid.innerHTML = "";
  if (!arr.length) { grid.innerHTML = `<div class="eda-empty">Sin recientes</div>`; return; }
  arr.forEach((item, idx)=>{
    const cell = document.createElement("button");
    cell.className = "eda-recent";
    cell.title = "Usar este";
    cell.innerHTML = `<img src="${item.dataUrl}" alt="Avatar reciente ${idx+1}" />`;
    cell.dataset.dataUrl = item.dataUrl;
    grid.appendChild(cell);
  });
}

function openEditorDeAvatar({ usuarioId, endpoint }) {
  const overlay = ensureEditorDom();
  const modal   = overlay.querySelector(".eda-modal");
  const fileInp = overlay.querySelector("#eda-file");
  const drop    = overlay.querySelector("#eda-drop");
  const choose  = overlay.querySelector("#eda-choose");
  const prevImg = overlay.querySelector("#eda-preview-img");
  const btnSave = overlay.querySelector("#eda-save");
  const btnCancel = overlay.querySelector("#eda-cancel");
  const btnClose  = overlay.querySelector("#eda-close");
  const recentsGrid = overlay.querySelector("#eda-recents-grid");

  let selectedFile = null;
  let pasteHandler = null;

  function setSelectedFile(file) {
    const v = canAccept(file);
    if (!v.ok) { toast(v.msg, "warning"); return; }
    selectedFile = file;
    prevImg.src = URL.createObjectURL(file);
    btnSave.disabled = false;
  }

  function onPaste(e) {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const it of items) {
      if (it.type && it.type.startsWith("image/")) {
        const f = it.getAsFile();
        if (f) setSelectedFile(f);
        e.preventDefault();
        break;
      }
    }
  }

  function close() {
    overlay.classList.remove("open");
    document.body.classList.remove("eda-lock");
    btnSave.disabled = true;
    selectedFile = null;
    prevImg.removeAttribute("src");
    if (pasteHandler) { document.removeEventListener("paste", pasteHandler); pasteHandler = null; }
  }

  // Bindings
  choose.onclick = () => fileInp.click();
  fileInp.onchange = () => {
    const f = fileInp.files && fileInp.files[0];
    if (f) setSelectedFile(f);
    fileInp.value = "";
  };

  drop.addEventListener("dragover", (e)=>{ e.preventDefault(); drop.classList.add("drag"); });
  drop.addEventListener("dragleave", ()=> drop.classList.remove("drag"));
  drop.addEventListener("drop", (e)=>{
    e.preventDefault(); drop.classList.remove("drag");
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) setSelectedFile(f);
  });

  btnCancel.onclick = close;
  btnClose.onclick  = close;
  overlay.addEventListener("click", (e)=>{ if (e.target.id === "eda-overlay") close(); });
  document.addEventListener("keydown", (e)=>{ if (overlay.classList.contains("open") && e.key==="Escape") close(); });

  btnSave.onclick = async ()=>{
    if (!selectedFile) return;
    try {
      await uploadAvatar(selectedFile, usuarioId, endpoint);
      await recents.remember(selectedFile);
      close();
    } catch (e) {
      console.error("[avatar] upload error:", e);
      toast("Error al subir la imagen. Intenta de nuevo.", "error");
    }
  };

  // Recientes
  renderRecentsGrid(modal);
  recentsGrid?.addEventListener("click", (e)=>{
    const btn = e.target.closest(".eda-recent"); if (!btn) return;
    const du = btn.dataset.dataUrl; if (!du) return;
    const f = dataUrlToFile(du, "reciente.png");
    setSelectedFile(f);
  });

  // Mostrar
  overlay.classList.add("open");
  document.body.classList.add("eda-lock");
  pasteHandler = onPaste;
  document.addEventListener("paste", pasteHandler);
}

/* ====================== Inicialización (botón del sidebar) ====================== */
function ensureButtonDom() {
  const prof = document.querySelector(".hs-profile");
  const img  = document.getElementById("hs-avatar");
  if (!prof || !img) return null;

  // Contenedor circular (si no existe)
  let shell = img.closest(".avatar-shell");
  if (!shell) {
    shell = document.createElement("div");
    shell.className = "avatar-shell";
    img.parentNode.insertBefore(shell, img);
    shell.appendChild(img);
  }
  let circle = img.closest(".avatar-circle");
  if (!circle) {
    circle = document.createElement("div");
    circle.className = "avatar-circle";
    shell.insertBefore(circle, img);
    circle.appendChild(img);
  }
  // Botón (si no existe)
  let btn = shell.querySelector(".avatar-edit");
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-btn avatar-edit";
    btn.setAttribute("aria-label","Cambiar foto de perfil");
    btn.title = "Cambiar foto";
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83z"></path>
      </svg>`;
    shell.appendChild(btn);
  }
  return { btn };
}

function init(endpoint = DEFAULT_ENDPOINT) {
  const sess = getSession();
  const usuarioId = sess?.id_usuario ?? sess?.usuario_id ?? sess?.empleado_id ?? sess?.id_empleado ?? null;

  const parts = ensureButtonDom();
  if (!parts) return; // no hay bloque de perfil
  const { btn } = parts;

  if (!usuarioId) {
    btn.disabled = true;
    btn.title = "Inicia sesión para cambiar tu foto";
    return;
  }
  btn.disabled = false;
  btn.title = "Cambiar foto";

  // Abrir modal EDA al clic
  btn.onclick = (e)=>{
    e.preventDefault();
    openEditorDeAvatar({ usuarioId, endpoint });
  };
}

/* ====================== Auto-init ====================== */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => init());
} else {
  init();
}

/* Exponer por si se necesita re-inicializar con otro endpoint */
window.gcInitAvatarEdit = init;

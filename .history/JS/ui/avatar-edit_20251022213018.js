// db\WEB\ixtla01_u_usuario_avatar.php
"use strict";

const DEFAULT_ENDPOINT = "/db/WEB/ixtla01_u_usuario_avatar.php";
const MAX_BYTES = 1 * 1024 * 1024;
const VALID_TYPES = ["image/jpeg","image/png","image/webp","image/heic","image/heif"];

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

function refreshAvatarEverywhere(url) {
  const bust = cacheBust(url);
  const img = document.getElementById("hs-avatar");
  if (img) img.src = bust;
  document.querySelectorAll(".actions .img-perfil, .user-icon-mobile img").forEach(el => el.src = bust);
}

async function uploadAvatar(file, usuarioId, endpoint=DEFAULT_ENDPOINT) {
  if (!file) return;
  if (!VALID_TYPES.includes(file.type)) { toast("Formato no permitido. Usa JPG/PNG/WEBP/HEIC/HEIF.","warning"); return; }
  if (file.size > MAX_BYTES) toast("La imagen supera 1MB. Se optimizará en el servidor.","warning");

  const fd = new FormData();
  fd.append("usuario_id", String(usuarioId));
  fd.append("avatar", file);

  const res = await fetch(endpoint, { method:"POST", body: fd });
  const data = await res.json().catch(()=> ({}));
  if (!res.ok || data.ok === false || data.error) {
    toast(data.error || "No se pudo actualizar el avatar.", "error");
    throw new Error(data.error || "upload failed");
  }
  if (data.url) refreshAvatarEverywhere(data.url);
  toast("Imagen de perfil actualizada", "exito");
}

function ensureDom() {
  const prof = document.querySelector(".hs-profile");
  const img  = document.getElementById("hs-avatar");
  if (!prof || !img) return null;

  // shell + circle
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
  // botón
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

  // input file único
  let fileInput = document.getElementById("gc-avatar-file");
  if (!fileInput) {
    fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.id = "gc-avatar-file";
    fileInput.accept = VALID_TYPES.join(",");
    fileInput.hidden = true;
    document.body.appendChild(fileInput);
  }
  return { btn, fileInput };
}

function init(endpoint = DEFAULT_ENDPOINT) {
  const sess = getSession();
  const usuarioId = sess?.id_usuario ?? sess?.usuario_id ?? sess?.empleado_id ?? sess?.id_empleado ?? null;

  const parts = ensureDom();
  if (!parts) return; // no está el DOM de perfil en esta página
  const { btn, fileInput } = parts;

  if (!usuarioId) {
    btn.disabled = true;
    btn.title = "Inicia sesión para cambiar tu foto";
    return;
  }
  btn.disabled = false;
  btn.title = "Cambiar foto";

  btn.onclick = (e)=>{ e.preventDefault(); fileInput.click(); };
  fileInput.onchange = async (e)=>{
    const f = e.target.files?.[0];
    try { await uploadAvatar(f, usuarioId, endpoint); }
    catch (err) { console.error(err); }
    finally { fileInput.value = ""; }
  };
}

// Auto-init cuando el DOM esté listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => init());
} else {
  init();
}

window.gcInitAvatarEdit = init;

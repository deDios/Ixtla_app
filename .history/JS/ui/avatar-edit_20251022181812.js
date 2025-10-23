// /JS/avatar-edit.js
"use strict";

/**
 *
 * Opciones:
 * - endpoint: URL del endpoint PHP que recibe (usuario_id, avatar)
 * - getSession: fn que regresa el objeto de sesión (por defecto intenta Session.get())
 */
export async function initAvatarEdit({
  endpoint = "/db/WEB/ixtla01_u_avatar.php",
  getSession = () => (window.Session?.get?.() || null),
} = {}) {
  const prof = document.querySelector(".hs-profile");
  const img  = document.getElementById("hs-avatar");
  if (!prof || !img) return;

  // ── Sesión / usuario id ─────────────────────────────────────────────────────
  const s = await Promise.resolve(getSession());
  const usuarioId =
    s?.id_usuario ?? s?.usuario_id ?? s?.empleado_id ?? s?.id_empleado ?? null;

  // ── Asegurar estructura para overlay (sin tocar HTML) ───────────────────────
  // <div class="avatar-shell"><div class="avatar-circle"> [img] </div> [btn] </div>
  let shell = img.closest(".avatar-shell");
  let circle = img.closest(".avatar-circle");
  if (!shell) {
    shell = document.createElement("div");
    shell.className = "avatar-shell";
    img.parentNode.insertBefore(shell, img);
    shell.appendChild(img);
  }
  if (!circle) {
    circle = document.createElement("div");
    circle.className = "avatar-circle";
    shell.insertBefore(circle, img);
    circle.appendChild(img);
  }

  // ── Inyectar botón si no existe ─────────────────────────────────────────────
  let btn = shell.querySelector(".avatar-edit");
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-btn avatar-edit";
    btn.setAttribute("aria-label", "Cambiar foto de perfil");
    btn.title = usuarioId ? "Cambiar foto" : "Inicia sesión para cambiar tu foto";
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83z" fill="currentColor"></path>
      </svg>`;
    shell.appendChild(btn);
  }

  // ── Hidden input file (1 por página) ────────────────────────────────────────
  let fileInput = document.getElementById("gc-avatar-file");
  if (!fileInput) {
    fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.id   = "gc-avatar-file";
    fileInput.accept = "image/png, image/jpeg, image/webp, image/heic, image/heif";
    fileInput.hidden = true;
    document.body.appendChild(fileInput);
  }

  // ── Habilitar/deshabilitar según sesión ─────────────────────────────────────
  if (!usuarioId) {
    btn.disabled = true;
    btn.title = "Inicia sesión para cambiar tu foto";
    return;
  } else {
    btn.disabled = false;
    btn.title = "Cambiar foto";
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const MAX_BYTES = 1 * 1024 * 1024; // 1MB
  const okType = (f) =>
    ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(f.type);

  function cacheBust(url) {
    const u = url.split("?")[0];
    const sep = u.includes("?") ? "&" : "?";
    return `${u}${sep}t=${Date.now()}`;
  }
  function refreshAvatarEverywhere(newUrl) {
    const bust = cacheBust(newUrl);
    // avatar en sidebar
    img.src = bust;
    // header / mobile si existen
    document.querySelectorAll(".actions .img-perfil, .user-icon-mobile img")
      .forEach(el => { el.src = bust; });
  }
  function toast(msg, type="info") {
    // Usa tu gcToast si existe
    if (window.gcToast) { window.gcToast(msg, type); return; }
    console.log(`[avatar] ${type}:`, msg);
  }

  // ── Upload ──────────────────────────────────────────────────────────────────
  async function uploadAvatar(file) {
    if (!file) return;
    if (!okType(file)) { toast("Formato no permitido. Usa JPG/PNG/WEBP/HEIC/HEIF.", "warning"); return; }
    if (file.size > MAX_BYTES) {
      // El server ya recorta/comprime a PNG <= 1MB; avisamos por UX.
      toast("La imagen pesa más de 1MB. Intentaremos optimizarla al subir.", "warning");
    }
    const fd = new FormData();
    fd.append("usuario_id", String(usuarioId));
    fd.append("avatar", file);

    const res = await fetch(endpoint, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false || data.error) {
      toast(data.error || "No se pudo actualizar el avatar.", "error");
      throw new Error(data.error || "upload failed");
    }
    // Esperamos { ok:true, url:"/ASSETS/user/userImgs/img{ID}.png" }
    if (data.url) refreshAvatarEverywhere(data.url);
    toast("Imagen de perfil actualizada", "exito");
  }

  // ── Eventos ─────────────────────────────────────────────────────────────────
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    fileInput.click();
  });
  fileInput.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    try { await uploadAvatar(f); }
    catch (err) { console.error(err); }
    finally { fileInput.value = ""; }
  });
}

// (Opcional) export alias para compatibilidad con tu otro módulo
export const initAvatarUpload = initAvatarEdit;

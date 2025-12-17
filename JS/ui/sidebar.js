// /JS/ui/sidebar.js
"use strict";

import { Session } from "/JS/auth/session.js";
import { getEmpleadoById, updateEmpleado } from "/JS/api/usuarios.js";

const TAG = "[Sidebar]";
const CFG = {
  DEBUG: true,

  AVATAR_UPLOAD_URL:
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_u_usuario_avatar.php",

  DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",
  MAX_BYTES: 1 * 1024 * 1024,

  // Perfil “nuevo” (hs-*)
  SEL: {
    avatar: "#hs-avatar",
    profileName: "#hs-profile-name",
    profileBadge: "#hs-profile-badge",

    editAvatarBtn: ".avatar-edit",
    editProfileBtn: '.edit-profile,[data-open="#modal-perfil"]',

    // Sidebar Home “viejo” (por si acaso)
    legacyAvatar: ".home-sidebar .profile-card img.avatar",
    legacyName: "#h-user-nombre",
    legacyBadge: ".home-sidebar .profile-card .profile-dep",

    // Filtros opcionales
    statusGroup: "#hs-states",

    // Modal perfil (EXACTO de tu HTML)
    modal: "#modal-perfil",
    modalContent: "#modal-perfil .modal-content",
    modalClose: "#modal-perfil .modal-close",
    form: "#modal-perfil #form-perfil",

    // Inputs por ID (así vienen en tu HTML)
    inpNombre: "#perfil-nombre",
    inpApellidos: "#perfil-apellidos",
    inpCorreo: "#perfil-email",
    inpTelefono: "#perfil-telefono",
    inpPass: "#perfil-password",
    inpPass2: "#perfil-password2",
    inpDepto: "#perfil-departamento",
    inpReporta: "#perfil-reporta",
    inpStatus: "#perfil-status",
  },

  ALLOWED_EXT: ["jpg", "jpeg", "png", "webp", "heic", "heif", "jfif", "avif"],
  ALLOWED_MIME: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "image/avif",
  ],
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const log = (...a) => CFG.DEBUG && console.log(TAG, ...a);
const warn = (...a) => CFG.DEBUG && console.warn(TAG, ...a);
const err = (...a) => console.error(TAG, ...a);
const toast = (m, t = "info") =>
  window.gcToast ? gcToast(m, t) : log("[toast]", t, m);

/* =========================================================
 * Sesión “like” (Session.get() o cookie)
 * ========================================================= */

function readCookie(name) {
  const m = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : "";
}

function readCookiePayload() {
  const raw = readCookie("ix_emp");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    warn("Cookie ix_emp inválida:", e);
    return null;
  }
}

function getSessionLike() {
  try {
    const s = Session?.get?.();
    if (s) return s;
  } catch {}
  return readCookiePayload();
}

function pickUserId(s) {
  return (
    s?.id_usuario ??
    s?.usuario_id ??
    s?.empleado_id ??
    s?.id_empleado ??
    s?.id ??
    null
  );
}

/* =========================================================
 * DOM: soporta hs-* y home viejo
 * ========================================================= */

function getAvatarEl() {
  return $(CFG.SEL.avatar) || $(CFG.SEL.legacyAvatar);
}
function getNameEl() {
  return $(CFG.SEL.profileName) || $(CFG.SEL.legacyName);
}
function getBadgeEl() {
  return $(CFG.SEL.profileBadge) || $(CFG.SEL.legacyBadge);
}

function setText(el, value) {
  if (!el) return;
  el.textContent = value ?? "—";
}

function setAvatarImage(imgEl, sessionLike) {
  if (!imgEl) return;

  // Si alguien ya instaló un helper global, úsalo
  if (window.gcSetAvatarSrc) {
    window.gcSetAvatarSrc(imgEl, sessionLike);
    return;
  }

  const idu = sessionLike?.id_usuario;
  const candidates = sessionLike?.avatarUrl
    ? [sessionLike.avatarUrl]
    : idu
    ? [
        `/ASSETS/user/userImgs/img_${idu}.png`,
        `/ASSETS/user/userImgs/img_${idu}.jpg`,
      ]
    : [];

  let i = 0;
  const tryNext = () => {
    if (i >= candidates.length) {
      imgEl.src = CFG.DEFAULT_AVATAR;
      return;
    }
    imgEl.onerror = () => {
      i++;
      tryNext();
    };
    imgEl.src = `${candidates[i]}?v=${Date.now()}`;
  };
  tryNext();
}

/* =========================================================
 * Avatar: aceptar formatos raros + compresión (si se puede)
 * ========================================================= */

function getExt(filename = "") {
  const m = String(filename)
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/i);
  return m ? m[1] : "";
}

function isAllowedFile(file) {
  const mime = String(file?.type || "").toLowerCase();
  const ext = getExt(file?.name || "");
  const okMime = mime ? CFG.ALLOWED_MIME.includes(mime) : false;
  const okExt = ext ? CFG.ALLOWED_EXT.includes(ext) : false;
  return okMime || okExt; // soporte a “type vacío”
}

function canDrawInCanvas(file) {
  const mime = String(file?.type || "").toLowerCase();
  const ext = getExt(file?.name || "");
  return (
    mime === "image/jpeg" ||
    mime === "image/png" ||
    mime === "image/webp" ||
    mime === "image/avif" ||
    ["jpg", "jpeg", "png", "webp", "avif"].includes(ext)
  );
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("FileReader error"));
    fr.onload = () => resolve(String(fr.result || ""));
    fr.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("No se pudo decodificar la imagen en el navegador"));
    img.src = dataUrl;
  });
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), mime, quality)
  );
}

async function compressToUnder1MB(file) {
  if (!canDrawInCanvas(file)) {
    log("compress: no drawable → se sube original", {
      name: file.name,
      type: file.type,
      size: file.size,
    });
    return file;
  }

  const dataUrl = await fileToDataURL(file);
  const img = await loadImage(dataUrl);

  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;

  const maxBox = 1024;
  const factor = Math.min(1, maxBox / Math.max(w, h));
  w = Math.max(1, Math.round(w * factor));
  h = Math.max(1, Math.round(h * factor));

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);

  // Preferimos webp
  let q = 0.9;
  let blob = await canvasToBlob(canvas, "image/webp", q);

  if (!blob) {
    warn("compress: toBlob(webp)=null → fallback jpeg");
    q = 0.85;
    blob = await canvasToBlob(canvas, "image/jpeg", q);
  }

  let loops = 0;
  while (blob && blob.size > CFG.MAX_BYTES && loops < 10) {
    loops++;
    q = Math.max(0.35, q - 0.08);
    blob = await canvasToBlob(canvas, blob.type || "image/jpeg", q);
    log("compress loop", { loops, q, size: blob?.size });
  }

  if (!blob) return file;

  const outName =
    file.name.replace(/\.[a-z0-9]+$/i, "") +
    (blob.type === "image/webp" ? ".webp" : ".jpg");
  const out = new File([blob], outName, {
    type: blob.type,
    lastModified: Date.now(),
  });

  log("compress result", {
    from: file.size,
    to: out.size,
    type: out.type,
    name: out.name,
    loops,
  });
  return out;
}

async function uploadAvatar(usuarioId, file) {
  const fd = new FormData();
  fd.append("usuario_id", String(usuarioId));
  fd.append("avatar", file, file.name);

  const t0 = performance.now?.() ?? Date.now();
  log("uploadAvatar → start", {
    usuarioId,
    name: file.name,
    type: file.type,
    size: file.size,
  });

  const res = await fetch(CFG.AVATAR_UPLOAD_URL, { method: "POST", body: fd });
  const dt = Math.round((performance.now?.() ?? Date.now()) - t0);

  let json = null;
  try {
    json = await res.json();
  } catch (e) {
    const text = await res.text().catch(() => "(sin cuerpo)");
    throw new Error(`Respuesta no-JSON (${res.status}) ${text}`);
  }

  if (!res.ok || !json?.ok) {
    warn("uploadAvatar → fail", { status: res.status, dt, json });
    throw new Error(json?.error || `HTTP ${res.status}`);
  }

  log("uploadAvatar → ok", {
    dt,
    url: json.url,
    size: json.size,
    mime: json.mime,
  });
  return json;
}

function ensureAvatarFileInput() {
  let input = document.getElementById("ix-avatar-input");
  if (input) return input;

  input = document.createElement("input");
  input.type = "file";
  input.id = "ix-avatar-input";
  input.accept =
    "image/*,image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,.jpg,.jpeg,.png,.webp,.heic,.heif,.jfif,.avif";
  input.hidden = true;
  document.body.appendChild(input);
  return input;
}

function wireAvatarEdit() {
  const btn = $(CFG.SEL.editAvatarBtn);
  const imgEl = getAvatarEl();
  if (!btn || !imgEl) return;

  const input = ensureAvatarFileInput();

  btn.addEventListener("click", () => {
    log("avatar-edit click");
    input.value = "";
    input.click();
  });

  input.addEventListener("change", async () => {
    try {
      const s = getSessionLike();
      const uid = pickUserId(s);
      const file = input.files?.[0];

      log("avatar change", {
        uid,
        file: file
          ? { name: file.name, type: file.type, size: file.size }
          : null,
      });

      if (!uid) return toast("No se detectó usuario en sesión.", "error");
      if (!file) return;

      if (!isAllowedFile(file)) {
        toast("Formato no permitido. Usa JPG/PNG/WEBP/HEIC/HEIF.", "warning");
        warn("Formato bloqueado", { name: file.name, type: file.type });
        return;
      }

      let upFile = file;
      if (file.size > CFG.MAX_BYTES) {
        toast("La imagen pesa más de 1MB. Intentando optimizar…", "info");
        try {
          upFile = await compressToUnder1MB(file);
        } catch (e) {
          // HEIC/HEIF típicamente caen aquí (no decode) -> subimos original, backend intenta
          warn("Compress falló (subo original):", e);
          upFile = file;
        }
      }

      const r = await uploadAvatar(uid, upFile);

      // Actualiza vista
      setAvatarImage(imgEl, { id_usuario: uid, avatarUrl: r.url });
      toast("Avatar actualizado ✅", "success");
    } catch (e) {
      err("avatar upload error:", e);
      toast(e?.message || "No se pudo actualizar el avatar.", "error");
    }
  });
}

/* =========================================================
 * Modal perfil: open/close + prefill + submit
 * ========================================================= */

function openModal(modal) {
  modal.classList.add("active");
  document.body.classList.add("modal-open");
  const first = modal.querySelector(
    "input,button,select,textarea,[tabindex]:not([tabindex='-1'])"
  );
  first?.focus?.();
}
function closeModal(modal) {
  modal.classList.remove("active");
  document.body.classList.remove("modal-open");
}

function wireProfileModal() {
  const modal = $(CFG.SEL.modal);
  if (!modal) return;

  const content = $(CFG.SEL.modalContent);
  const closeBtn = $(CFG.SEL.modalClose);
  const form = $(CFG.SEL.form);

  const openers = $$(CFG.SEL.editProfileBtn);
  openers.forEach((el) =>
    el.addEventListener("click", async (e) => {
      e.preventDefault();
      openModal(modal);

      try {
        const s = getSessionLike();
        const empId = s?.empleado_id ?? pickUserId(s);
        if (!empId) {
          warn("Sin empleado_id en sesión");
          return;
        }

        const emp = await getEmpleadoById(empId);
        log("prefill empleado:", emp);

        // EDITABLES (por IDs exactos)
        const inpNombre = $(CFG.SEL.inpNombre, modal);
        const inpApellidos = $(CFG.SEL.inpApellidos, modal);
        const inpCorreo = $(CFG.SEL.inpCorreo, modal);
        const inpTel = $(CFG.SEL.inpTelefono, modal);
        const inpPass = $(CFG.SEL.inpPass, modal);
        const inpPass2 = $(CFG.SEL.inpPass2, modal);

        if (inpNombre) inpNombre.value = emp?.nombre || "";
        if (inpApellidos) inpApellidos.value = emp?.apellidos || "";
        if (inpCorreo)
          inpCorreo.value = (emp?.email || emp?.correo || "").toLowerCase();
        if (inpTel) inpTel.value = emp?.telefono || "";
        if (inpPass) inpPass.value = "";
        if (inpPass2) inpPass2.value = "";

        // SOLO LECTURA
        const inpDepto = $(CFG.SEL.inpDepto, modal);
        const inpReporta = $(CFG.SEL.inpReporta, modal);
        const inpStatus = $(CFG.SEL.inpStatus, modal);

        if (inpDepto)
          inpDepto.value = emp?.departamento_nombre || emp?.departamento || "—";
        if (inpReporta) inpReporta.value = emp?.reporta_a_nombre || "—";
        if (inpStatus) {
          const st = Number(emp?.status ?? emp?.estatus);
          inpStatus.value = st === 1 ? "Activo" : "Inactivo";
        }
      } catch (e2) {
        err("prefill modal error:", e2);
      }
    })
  );

  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    closeModal(modal);
  });

  modal.addEventListener("mousedown", (e) => {
    if (e.target === modal && !content.contains(e.target)) closeModal(modal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("active"))
      closeModal(modal);
  });

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        const s = getSessionLike();
        const empId = s?.empleado_id ?? pickUserId(s);
        if (!empId) return toast("No se detectó usuario.", "error");

        const inpNombre = $(CFG.SEL.inpNombre, modal);
        const inpApellidos = $(CFG.SEL.inpApellidos, modal);
        const inpCorreo = $(CFG.SEL.inpCorreo, modal);
        const inpTel = $(CFG.SEL.inpTelefono, modal);
        const inpPass = $(CFG.SEL.inpPass, modal);
        const inpPass2 = $(CFG.SEL.inpPass2, modal);

        const password = (inpPass?.value || "").trim();
        const password2 = (inpPass2?.value || "").trim();

        if ((password || password2) && password !== password2) {
          toast("Las contraseñas no coinciden.", "warning");
          return;
        }

        // OJO: Home “no actualiza password” por defecto, pero tu modal sí lo contempla como opcional:
        // si viene vacío, no lo mandamos.
        const payload = {
          id: Number(empId),
          nombre: inpNombre?.value?.trim() || "",
          apellidos: inpApellidos?.value?.trim() || "",
          correo: inpCorreo?.value?.trim() || "",
          telefono: inpTel?.value?.trim() || "",
        };
        if (password) payload.password = password;

        log("updateEmpleado payload:", payload);

        const r = await updateEmpleado(payload);
        log("updateEmpleado OK:", r);

        // Refresca nombre en sidebar
        const name = [payload.nombre, payload.apellidos]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (name) setText(getNameEl(), name);

        toast("Perfil actualizado ✅", "success");
        closeModal(modal);
      } catch (e2) {
        err("updateEmpleado error:", e2);
        toast(e2?.message || "No se pudo actualizar el perfil.", "error");
      }
    });
  }
}

/* =========================================================
 * Sidebar base (siempre): perfil + avatar + modal
 * ========================================================= */

async function hydrateProfileBar() {
  const s = getSessionLike();
  if (!s) return warn("Sin sesión (Session.get/cookie).");

  const uid = pickUserId(s);
  const nameEl = getNameEl();
  const badgeEl = getBadgeEl();
  const avatarEl = getAvatarEl();

  const name =
    [s?.nombre, s?.apellidos].filter(Boolean).join(" ").trim() || "—";
  setText(nameEl, name);

  // dept badge (si viene)
  const deptName =
    s?.deptName || s?.departamento_nombre || s?.departamento || "—";
  if (badgeEl) setText(badgeEl, deptName);

  setAvatarImage(avatarEl, {
    id_usuario: uid,
    avatarUrl: s?.avatarUrl || s?.avatar,
    nombre: s?.nombre,
    apellidos: s?.apellidos,
  });

  log("Perfil sidebar OK", { uid, name, deptName });
}

function wireOptionalFilters() {
  // Si NO existe #hs-states (ej sidebar de comentarios), no hace nada.
  const group = $(CFG.SEL.statusGroup);
  if (!group) return log("No #hs-states → sin filtros");

  log("Sidebar con filtros detectado (#hs-states).");
  // aquí no tocamos filtros: solo dejamos listo el módulo para que Home lo maneje
  // si tú quieres emitir evento, lo hacemos luego.
}

export async function IxSidebar_init() {
  log("init…");
  await hydrateProfileBar();
  wireAvatarEdit();
  wireProfileModal();
  wireOptionalFilters();
  log("init OK");
}

// Auto-init
const ready = (fn) =>
  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", fn)
    : fn();
ready(() => IxSidebar_init());

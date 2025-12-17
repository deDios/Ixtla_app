// /JS/ui/sidebar.js
"use strict";

/* ============================================================================
   Sidebar Module (perfil + avatar + modal perfil)
   - Funciona en Home (sidebar con filtros) y en Requerimiento (sidebar con comments)
   - Siempre: avatar + nombre + badge depto + editar perfil + editor avatar
   ========================================================================== */

const TAG = "[Sidebar]";
const dev = true;

const log = (...a) => dev && console.log(TAG, ...a);
const warn = (...a) => dev && console.warn(TAG, ...a);
const err = (...a) => dev && console.error(TAG, ...a);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const toast = (m, t = "info") =>
  window.gcToast ? gcToast(m, t) : log("[toast]", t, m);

/* =========================
 * Config
 * ========================= */
const API_BASE =
  "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/";
const ENDPOINTS = {
  avatarUpload: API_BASE + "ixtla01_u_usuario_avatar.php",
};

const CFG = {
  DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",

  // Soporta 2 layouts:
  // - Home.php:  img.avatar + #h-user-nombre + .profile-dep
  // - Requerimiento.php: #hs-avatar + #hs-profile-name + #hs-profile-badge
  SEL: {
    // wrappers detectores
    homeSidebar: ".home-sidebar",
    hsSidebar: ".hs-sidebar",

    // perfil (Home)
    homeAvatar: ".home-sidebar .profile-card img.avatar",
    homeName: "#h-user-nombre",
    homeBadge: ".home-sidebar .profile-card .profile-dep",

    // perfil (HS/Requerimiento)
    hsAvatar: "#hs-avatar",
    hsName: "#hs-profile-name",
    hsBadge: "#hs-profile-badge",

    // modal perfil
    modalId: "modal-perfil",

    // Form fields (según tu HTML del modal; si no existen, el módulo no truena)
    fNombre: "#perfil-nombre",
    fApellidos: "#perfil-apellidos",
    fEmail: "#perfil-email",
    fTelefono: "#perfil-telefono",
    fPuesto: "#perfil-puesto",
    fDep: "#perfil-dep",
    fUsuario: "#perfil-usuario",
    fReporta: "#perfil-reporta",
    fStatus: "#perfil-status",

    // contraseña (si la tienes en el modal)
    fPw1: "#perfil-password",
    fPw2: "#perfil-password2",

    // Avatar editor (EDA) — viene en tu HTML del requerimiento
    edaOverlay: "#eda-overlay",
    edaClose: "#eda-close",
    edaCancel: "#eda-cancel",
    edaSave: "#eda-save",
    edaDrop: "#eda-drop",
    edaFile: "#eda-file",
    edaPreviewImg: "#eda-preview img, #eda-preview-img, .eda-preview img",
    edaRecentsGrid: "#eda-recents-grid",
    avatarEditBtn: ".avatar-edit",
  },

  // Deptos fallback (por si el endpoint no está o falla)
  DEPT_API: API_BASE + "ixtla01_c_departamento.php",
  DEPT_FALLBACK_NAMES: {
    6: "Presidencia",
  },
};

/* =========================
 * Session helpers
 * ========================= */
function readCookiePayload() {
  try {
    const name = "ix_emp=";
    const pair = document.cookie.split("; ").find((c) => c.startsWith(name));
    if (!pair) return null;
    const raw = decodeURIComponent(pair.slice(name.length));
    return JSON.parse(decodeURIComponent(escape(atob(raw))));
  } catch (e) {
    warn("readCookiePayload() fallo:", e);
    return null;
  }
}

function getSessionLike() {
  return window.Session?.get?.() || readCookiePayload() || null;
}

function getUsuarioIdFromSession(s) {
  return (
    s?.id_usuario ?? s?.usuario_id ?? s?.empleado_id ?? s?.id_empleado ?? null
  );
}

/* =========================
 * Dept name resolver (cache)
 * ========================= */
const __DEPT_CACHE = new Map();

async function resolveDeptName(deptId, api = CFG.DEPT_API) {
  if (!deptId) return "—";
  const idNum = Number(deptId);

  if (CFG.DEPT_FALLBACK_NAMES[idNum]) return CFG.DEPT_FALLBACK_NAMES[idNum];
  if (__DEPT_CACHE.has(idNum)) return __DEPT_CACHE.get(idNum);

  try {
    const res = await fetch(api, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ page: 1, page_size: 200, status: 1 }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    const found = (json?.data || []).find((d) => Number(d.id) === idNum);
    const name = found?.nombre || `Depto ${deptId}`;
    __DEPT_CACHE.set(idNum, name);
    return name;
  } catch (e) {
    warn("resolveDeptName() fallback:", e);
    return `Depto ${deptId}`;
  }
}

/* =========================
 * Avatar loader (fallback)
 * ========================= */
function setAvatarImage(
  imgEl,
  sessionLike,
  defaultAvatar = CFG.DEFAULT_AVATAR
) {
  if (!imgEl) return;

  // si tienes helper global en tu proyecto
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
        `/ASSETS/user/userImgs/img_${idu}.webp`,
      ]
    : [];

  let i = 0;
  const tryNext = () => {
    if (i >= candidates.length) {
      imgEl.src = defaultAvatar;
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

/* =========================
 * Detect DOM (home vs hs)
 * ========================= */
function pickProfileEls() {
  const isHS =
    !!$(CFG.SEL.hsSidebar) || !!$(CFG.SEL.hsAvatar) || !!$(CFG.SEL.hsName);
  const isHome = !!$(CFG.SEL.homeSidebar) || !!$(CFG.SEL.homeName);

  if (isHS) {
    return {
      mode: "hs",
      avatar: $(CFG.SEL.hsAvatar),
      name: $(CFG.SEL.hsName),
      badge: $(CFG.SEL.hsBadge),
    };
  }

  if (isHome) {
    return {
      mode: "home",
      avatar: $(CFG.SEL.homeAvatar),
      name: $(CFG.SEL.homeName),
      badge: $(CFG.SEL.homeBadge),
    };
  }

  return { mode: "none", avatar: null, name: null, badge: null };
}

/* =========================
 * Modal open/close (perfil)
 * ========================= */
function wireProfileModalOpeners() {
  const modal = document.getElementById(CFG.SEL.modalId);
  if (!modal) return;

  const openers = document.querySelectorAll(
    `.edit-profile,[data-open="#${CFG.SEL.modalId}"]`
  );
  const closeBtn = modal.querySelector(".modal-close");
  const content = modal.querySelector(".modal-content");

  const open = () => {
    modal.classList.add("active");
    document.body.classList.add("modal-open");
    const first = modal.querySelector(
      "input,button,select,textarea,[tabindex]:not([tabindex='-1'])"
    );
    first?.focus?.();
  };

  const close = () => {
    modal.classList.remove("active");
    document.body.classList.remove("modal-open");
  };

  openers.forEach((el) =>
    el.addEventListener("click", (e) => {
      e.preventDefault();
      open();
    })
  );

  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    close();
  });

  modal.addEventListener("mousedown", (e) => {
    if (e.target === modal && content && !content.contains(e.target)) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("active")) close();
  });
}

/* =========================
 * API Usuarios (lazy import)
 * ========================= */
let UsuariosAPI = null;

async function loadUsuariosApi() {
  if (UsuariosAPI) return UsuariosAPI;

  // Si lo expones global (opcional)
  if (window.APIUsuarios) {
    UsuariosAPI = window.APIUsuarios;
    return UsuariosAPI;
  }

  // Import dinámico (evita romper vistas donde no está)
  try {
    const mod = await import("/JS/api/usuarios.js");
    UsuariosAPI = mod;
    return UsuariosAPI;
  } catch (e) {
    warn(
      "No pude importar /JS/api/usuarios.js (se sigue sin guardar perfil):",
      e
    );
    UsuariosAPI = null;
    return null;
  }
}

/* =========================
 * Hidratar perfil + form
 * ========================= */
function fillModalFromSession(modal, s, deptName) {
  if (!modal || !s) return;

  const setVal = (sel, v) => {
    const el = $(sel, modal);
    if (!el) return;
    el.value = v ?? "";
  };

  setVal(CFG.SEL.fNombre, s.nombre ?? "");
  setVal(CFG.SEL.fApellidos, s.apellidos ?? "");
  setVal(CFG.SEL.fEmail, s.email ?? "");
  setVal(CFG.SEL.fTelefono, s.telefono ?? "");
  setVal(CFG.SEL.fPuesto, s.puesto ?? "");
  setVal(CFG.SEL.fDep, deptName ?? "");
  setVal(CFG.SEL.fUsuario, s.username ?? s.usuario ?? "");
  setVal(CFG.SEL.fReporta, s.reporta_a_nombre ?? "");
  setVal(CFG.SEL.fStatus, s.status ?? "");
}

async function hydrateProfile() {
  const els = pickProfileEls();
  if (els.mode === "none") {
    warn("No detecté sidebar en DOM (skip).");
    return;
  }

  const s = getSessionLike();
  if (!s) {
    warn("Sin sesión (Session.get o cookie ix_emp).");
    return;
  }

  const usuario_id = getUsuarioIdFromSession(s);
  const nombre =
    [s?.nombre, s?.apellidos].filter(Boolean).join(" ").trim() || "—";
  const deptId = s?.departamento_id ?? s?.dept_id ?? null;
  const deptName = await resolveDeptName(deptId, CFG.DEPT_API);

  if (els.name) els.name.textContent = nombre;
  if (els.badge) els.badge.textContent = deptName || "—";

  setAvatarImage(els.avatar, {
    id_usuario: usuario_id,
    avatarUrl: s.avatarUrl || s.avatar,
    nombre: s.nombre,
    apellidos: s.apellidos,
  });

  // modal: precarga valores
  const modal = document.getElementById(CFG.SEL.modalId);
  if (modal) fillModalFromSession(modal, s, deptName);

  log("Perfil OK", { mode: els.mode, usuario_id, nombre, deptId, deptName });
}

/* =========================
 * Guardar perfil (modal)
 * ========================= */
function wireProfileSave() {
  const modal = document.getElementById(CFG.SEL.modalId);
  if (!modal) return;

  const form = modal.querySelector("form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const s = getSessionLike();
    const usuario_id = getUsuarioIdFromSession(s);
    if (!usuario_id) {
      toast("No hay usuario_id en sesión.", "warning");
      return;
    }

    const nombre = $(CFG.SEL.fNombre, modal)?.value?.trim() ?? "";
    const apellidos = $(CFG.SEL.fApellidos, modal)?.value?.trim() ?? "";
    const email = $(CFG.SEL.fEmail, modal)?.value?.trim() ?? "";
    const telefono = $(CFG.SEL.fTelefono, modal)?.value?.trim() ?? "";

    const pw1 = $(CFG.SEL.fPw1, modal)?.value ?? "";
    const pw2 = $(CFG.SEL.fPw2, modal)?.value ?? "";

    log("Guardar perfil submit", {
      usuario_id,
      nombre,
      apellidos,
      email,
      telefono,
      wantsPw: !!pw1 || !!pw2,
    });

    try {
      const api = await loadUsuariosApi();
      if (!api?.updatePerfilBasico) {
        toast("API de usuarios no disponible para guardar perfil.", "warning");
        return;
      }

      // 1) Perfil básico
      const updated = await api.updatePerfilBasico({
        id: Number(usuario_id),
        nombre,
        apellidos,
        email,
        telefono,
        updated_by: Number(usuario_id),
      });

      // 2) Password (opcional)
      if (pw1 || pw2) {
        if (pw1 !== pw2) throw new Error("Las contraseñas no coinciden.");
        if (!api?.changePassword)
          throw new Error("changePassword() no disponible en API usuarios.");

        await api.changePassword({
          id: Number(usuario_id),
          password: pw1,
          updated_by: Number(usuario_id),
        });

        // limpia campos pw
        if ($(CFG.SEL.fPw1, modal)) $(CFG.SEL.fPw1, modal).value = "";
        if ($(CFG.SEL.fPw2, modal)) $(CFG.SEL.fPw2, modal).value = "";
      }

      toast("Perfil actualizado correctamente.", "success");

      // refresca sidebar con lo nuevo (sin depender de re-login)
      await hydrateProfile();

      log("Perfil actualizado OK", updated);
    } catch (e2) {
      err("Error guardando perfil:", e2);
      toast(e2?.message || "No se pudo guardar el perfil.", "error");
    }
  });
}

/* =========================
 * Avatar Editor (EDA)
 * ========================= */

// Si el navegador puede decodificar, intentamos comprimir a <= 1MB.
// Si NO puede decodificar (ej HEIC en Chrome Windows), subimos el archivo tal cual y dejamos que el PHP lo procese.
// (Si el PHP tiene Imagick, lo va a leer; si no, te regresará 415.)
async function compressIfNeeded(file, targetBytes = 1024 * 1024) {
  const meta = { name: file?.name, type: file?.type, size: file?.size };

  if (!file || file.size <= targetBytes) {
    log("compressIfNeeded: skip (ya <= 1MB)", meta);
    return { file, didCompress: false, reason: "already_small" };
  }

  // Intento de decode
  let bitmap = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch (e) {
    warn(
      "compressIfNeeded: createImageBitmap FALLÓ (formato no decodificable por browser)",
      {
        ...meta,
        error: String(e?.message || e),
      }
    );

    // no podemos comprimir en cliente
    return { file, didCompress: false, reason: "browser_cant_decode" };
  }

  // Canvas
  const maxBox = 1024;
  const w = bitmap.width;
  const h = bitmap.height;
  const factor = Math.min(1, maxBox / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * factor));
  const th = Math.max(1, Math.round(h * factor));

  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d", { alpha: true });

  ctx.drawImage(bitmap, 0, 0, tw, th);

  // Intento: JPG (más control por quality) manteniendo peso bajo
  let quality = 0.85;
  let outBlob = null;

  for (let i = 0; i < 10; i++) {
    outBlob = await new Promise((res) =>
      canvas.toBlob(res, "image/jpeg", quality)
    );
    const size = outBlob?.size ?? 0;

    log("compressIfNeeded: iter", {
      i,
      quality,
      inSize: file.size,
      outSize: size,
      tw,
      th,
    });

    if (size > 0 && size <= targetBytes) break;

    // baja quality agresivo
    quality = Math.max(0.4, quality - 0.08);
    if (quality <= 0.4 && i >= 6) break;
  }

  // fallback: si no logró bajar
  if (!outBlob || outBlob.size > targetBytes) {
    warn("compressIfNeeded: no se logró <=1MB; se sube original", {
      ...meta,
      outSize: outBlob?.size,
    });
    return { file, didCompress: false, reason: "cant_reach_target" };
  }

  const outFile = new File([outBlob], "avatar.jpg", { type: "image/jpeg" });
  return { file: outFile, didCompress: true, reason: "compressed_to_jpeg" };
}

function previewFileInImg(file, imgEl) {
  if (!file || !imgEl) return;
  try {
    const url = URL.createObjectURL(file);
    imgEl.onload = () => URL.revokeObjectURL(url);
    imgEl.onerror = () => URL.revokeObjectURL(url);
    imgEl.src = url;
  } catch (e) {
    warn("previewFileInImg falló:", e);
  }
}

function wireAvatarEditor() {
  const overlay = $(CFG.SEL.edaOverlay);
  const btnEdit = $(CFG.SEL.avatarEditBtn); // en HS sidebar
  const input = $(CFG.SEL.edaFile);
  const btnClose = $(CFG.SEL.edaClose);
  const btnCancel = $(CFG.SEL.edaCancel);
  const btnSave = $(CFG.SEL.edaSave);
  const drop = $(CFG.SEL.edaDrop);

  if (!overlay || !input || !btnSave) {
    // Si esta vista no tiene EDA, no hacemos nada.
    return;
  }

  // Para "formatos raros": mejor no restringir tanto el file picker.
  // Si tu HTML tiene accept limitado, aquí lo abrimos:
  try {
    input.setAttribute("accept", "image/*,.heic,.heif,.webp,.png,.jpg,.jpeg");
  } catch {}

  let pickedOriginal = null;
  let pickedToUpload = null;

  const open = () => {
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    btnSave.disabled = true;
    pickedOriginal = null;
    pickedToUpload = null;
    log("EDA: open()");
  };

  const close = () => {
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
    btnSave.disabled = true;
    // IMPORTANT: reset input para que el mismo archivo dispare change la siguiente vez
    input.value = "";
    log("EDA: close()");
  };

  // Abrir EDA al click en el lapicito (si existe)
  btnEdit?.addEventListener("click", (e) => {
    e.preventDefault();
    open();
  });

  btnClose?.addEventListener("click", (e) => {
    e.preventDefault();
    close();
  });

  btnCancel?.addEventListener("click", (e) => {
    e.preventDefault();
    close();
  });

  // Click en dropzone abre file picker
  drop?.addEventListener("click", (e) => {
    e.preventDefault();
    log("EDA: drop click -> input.click()");
    input.click();
  });

  // Drag & drop
  drop?.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("is-drag");
  });
  drop?.addEventListener("dragleave", () => drop.classList.remove("is-drag"));
  drop?.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("is-drag");
    const f = e.dataTransfer?.files?.[0] || null;
    if (f) handlePick(f, "drop");
  });

  // Change del input
  input.addEventListener("change", () => {
    const f = input.files?.[0] || null;
    log("EDA: input change", {
      hasFile: !!f,
      name: f?.name,
      type: f?.type,
      size: f?.size,
    });
    if (f) handlePick(f, "picker");
  });

  async function handlePick(file, from) {
    pickedOriginal = file;

    // Preview (si hay IMG)
    const imgPrev = $(CFG.SEL.edaPreviewImg) || $("#hs-avatar"); // fallback: no ideal, pero útil
    if (imgPrev) previewFileInImg(file, imgPrev);

    // Cliente: compresión si > 1MB (si el browser puede decode)
    const {
      file: maybeCompressed,
      didCompress,
      reason,
    } = await compressIfNeeded(file, 1024 * 1024);

    pickedToUpload = maybeCompressed;

    btnSave.disabled = false;

    log("EDA: picked", {
      from,
      original: { name: file.name, type: file.type, size: file.size },
      toUpload: {
        name: pickedToUpload.name,
        type: pickedToUpload.type,
        size: pickedToUpload.size,
      },
      didCompress,
      reason,
    });

    if (
      file.size > 1024 * 1024 &&
      !didCompress &&
      reason !== "browser_cant_decode"
    ) {
      toast(
        "La imagen pesa > 1MB y no pude comprimirla en navegador. Se intentará en servidor.",
        "warning"
      );
    }
    if (!didCompress && reason === "browser_cant_decode") {
      toast(
        "Formato no decodificable por el navegador. Se subirá tal cual para que el servidor lo procese.",
        "info"
      );
    }
  }

  btnSave.addEventListener("click", async (e) => {
    e.preventDefault();

    const s = getSessionLike();
    const usuario_id = getUsuarioIdFromSession(s);
    if (!usuario_id) {
      toast("No hay usuario_id en sesión.", "warning");
      return;
    }
    if (!pickedToUpload) {
      toast("Selecciona una imagen primero.", "info");
      return;
    }

    btnSave.disabled = true;

    const fd = new FormData();
    fd.append("usuario_id", String(usuario_id));
    fd.append("avatar", pickedToUpload, pickedToUpload.name);

    log("EDA: upload start", {
      usuario_id,
      file: {
        name: pickedToUpload.name,
        type: pickedToUpload.type,
        size: pickedToUpload.size,
      },
      endpoint: ENDPOINTS.avatarUpload,
    });

    try {
      const res = await fetch(ENDPOINTS.avatarUpload, {
        method: "POST",
        body: fd,
      });
      const text = await res.text().catch(() => "");
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      log("EDA: upload response", {
        ok: res.ok,
        status: res.status,
        json,
        raw: text,
      });

      if (!res.ok || !json?.ok) {
        const msg = json?.error || `Error subiendo avatar (HTTP ${res.status})`;
        throw new Error(msg);
      }

      toast("Avatar actualizado.", "success");

      // refresca avatar en sidebar (cache bust)
      await hydrateProfile();

      close();
    } catch (e2) {
      err("EDA: upload error", e2);
      toast(e2?.message || "No se pudo actualizar el avatar.", "error");
      btnSave.disabled = false;
    }
  });
}

/* =========================
 * Filtros opcionales (si existen)
 * - Si no hay filtros, no rompe (requerimiento sidebar comments)
 * ========================= */
const STATUS_LABEL = {
  todos: "Todos los status",
  solicitud: "Solicitud",
  revision: "Revisión",
  asignacion: "Asignación",
  proceso: "En proceso",
  pausado: "Pausado",
  cancelado: "Cancelado",
  finalizado: "Finalizado",
};

function normalizeStatusKey(k) {
  if (!k) return "";
  let s = String(k)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\s_-]+/g, "");
  if (s === "enproceso") return "proceso";
  if (s === "revision") return "revision";
  if (s === "asignacion") return "asignacion";
  return s;
}

const State = {
  filterKey: "todos",
  onChange: null,
};

function initOptionalFiltersIfPresent() {
  // Home (tu primer HTML) usa .status-item, pero tu home real (copy) usa nav.item[data-status]
  const buttons =
    $$(".status-item") ||
    $$("nav.status-nav .item[data-status]") ||
    $$('[data-status][role="radio"]');

  if (!buttons || buttons.length === 0) return;

  const setActive = (btn) => {
    buttons.forEach((b) => b.classList.remove("active", "is-active"));
    btn.classList.add("active", "is-active");
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const raw =
        btn.getAttribute("data-status") ||
        btn.querySelector(".label")?.textContent ||
        "todos";
      const key = normalizeStatusKey(raw);
      State.filterKey = key || "todos";
      setActive(btn);
      log("Filtro sidebar:", State.filterKey);
      State.onChange?.(State.filterKey);
    });
  });
}

/* =========================
 * Public API
 * ========================= */
export function IxSidebar_onFilterChange(fn) {
  State.onChange = typeof fn === "function" ? fn : null;
}

export function IxSidebar_getFilter() {
  return State.filterKey;
}

export async function IxSidebar_refreshProfile(sess) {
  // si te pasan una sesión nueva desde otra vista, úsala
  if (sess && typeof sess === "object") {
    try {
      const els = pickProfileEls();
      const usuario_id = getUsuarioIdFromSession(sess);
      const nombre =
        [sess?.nombre, sess?.apellidos].filter(Boolean).join(" ").trim() || "—";
      const deptId = sess?.departamento_id ?? sess?.dept_id ?? null;
      const deptName = await resolveDeptName(deptId, CFG.DEPT_API);

      els.name && (els.name.textContent = nombre);
      els.badge && (els.badge.textContent = deptName || "—");
      setAvatarImage(els.avatar, {
        id_usuario: usuario_id,
        avatarUrl: sess.avatarUrl || sess.avatar,
      });

      log("refreshProfile(sess) OK", { usuario_id, nombre, deptName });
    } catch (e) {
      warn("IxSidebar_refreshProfile error:", e);
    }
    return;
  }

  // si no te pasan nada, hidrata normal
  await hydrateProfile();
}

/* =========================
 * Boot
 * ========================= */
async function bootSidebar() {
  wireProfileModalOpeners();
  wireProfileSave();
  wireAvatarEditor();

  await hydrateProfile();
  initOptionalFiltersIfPresent();

  log("bootSidebar OK");
}

bootSidebar();

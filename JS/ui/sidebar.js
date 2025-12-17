// /JS/ui/sidebar.js
"use strict";

import { Session } from "/JS/auth/session.js";
import { getEmpleadoById, updateEmpleado } from "/JS/api/usuarios.js";

const TAG = "[Sidebar]";
const CFG = {
  DEBUG: true,
  DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",
  DEPT_API:
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php",
  DEPT_FALLBACK_NAMES: { 6: "Presidencia" },

  // Sidebar (común)
  SEL: {
    avatar: "#hs-avatar",
    name: "#hs-profile-name",
    badge: "#hs-profile-badge",
    profileWrap: ".hs-profile",

    // Modal perfil
    modalId: "modal-perfil",
  },
};

const log = (...a) => CFG.DEBUG && console.log(TAG, ...a);
const warn = (...a) => CFG.DEBUG && console.warn(TAG, ...a);
const err = (...a) => console.error(TAG, ...a);

const $ = (s, r = document) => r.querySelector(s);
const setText = (sel, txt) => {
  const el = $(sel);
  if (el) el.textContent = String(txt ?? "");
};

function readCookiePayload() {
  try {
    const name = "ix_emp=";
    const pair = document.cookie.split("; ").find((c) => c.startsWith(name));
    if (!pair) return null;
    const raw = decodeURIComponent(pair.slice(name.length));
    return JSON.parse(decodeURIComponent(escape(atob(raw))));
  } catch {
    return null;
  }
}

function writeCookiePayload(obj, { maxAgeDays = 30 } = {}) {
  try {
    const json = JSON.stringify(obj || {});
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const maxAge = Math.max(1, Math.floor(maxAgeDays * 86400));
    document.cookie = `ix_emp=${encodeURIComponent(
      b64
    )}; path=/; max-age=${maxAge}; samesite=lax`;
  } catch (e) {
    warn("No se pudo escribir cookie ix_emp:", e);
  }
}

function readSessionSafe() {
  let s = null;
  try {
    s = Session?.get?.() || null;
  } catch {}
  if (!s) s = readCookiePayload();
  return s || {};
}

function normalizeRoles(arr) {
  return Array.isArray(arr) ? arr.map((r) => String(r).toUpperCase()) : [];
}

function getSessionIds(s) {
  const empleado_id = s?.empleado_id ?? s?.id_empleado ?? null;
  const dept_id = s?.departamento_id ?? s?.dept_id ?? null;
  const id_usuario = s?.id_usuario ?? s?.cuenta_id ?? s?.usuario_id ?? null;
  const roles = normalizeRoles(s?.roles);
  return { empleado_id, dept_id, id_usuario, roles };
}

/* =========================
 * Dept name resolver (cache)
 * ========================= */
const __DEPT_CACHE = new Map();

async function resolveDeptName(deptId) {
  if (!deptId) return "—";
  const idNum = Number(deptId);

  if (CFG.DEPT_FALLBACK_NAMES[idNum]) return CFG.DEPT_FALLBACK_NAMES[idNum];
  if (__DEPT_CACHE.has(idNum)) return __DEPT_CACHE.get(idNum);

  try {
    const res = await fetch(CFG.DEPT_API, {
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
    warn("No pude resolver depto:", deptId, e);
    return `Depto ${deptId}`;
  }
}

/* =========================
 * Avatar src helper
 * (sin subir archivos: solo set src)
 * ========================= */
function setAvatarImage(imgEl, sessionLike) {
  if (!imgEl) return;

  // Si tienes helper global, úsalo
  if (window.gcSetAvatarSrc) {
    window.gcSetAvatarSrc(imgEl, sessionLike);
    return;
  }

  const idu = sessionLike?.id_usuario;
  const candidates = idu
    ? [
        `/ASSETS/user/userImgs/img_${idu}.png`,
        `/ASSETS/user/userImgs/img_${idu}.jpg`,
        `/ASSETS/user/userImgs/img_${idu}.webp`,
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

/* =========================
 * Ensure "Administrar perfil" button (si falta)
 * ========================= */
function ensureEditProfileButton() {
  const section = $(CFG.SEL.profileWrap);
  if (!section) return;

  const existing = section.querySelector(".edit-profile");
  if (existing) return existing;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "gc-btn gc-btn-ghost edit-profile";
  btn.setAttribute("data-open", `#${CFG.SEL.modalId}`);
  btn.setAttribute("aria-haspopup", "dialog");
  btn.setAttribute("aria-controls", CFG.SEL.modalId);
  btn.textContent = "Administrar perfil ›";

  const badgeEl = $(CFG.SEL.badge, section);
  section.insertBefore(btn, badgeEl || null);
  log("Inserté botón .edit-profile (no existía).");
  return btn;
}

/* =========================
 * Hydrate sidebar (nombre/badge/avatar)
 * ========================= */
async function hydrateSidebarProfile() {
  const s = readSessionSafe();
  const ids = getSessionIds(s);

  log("Sesión:", ids);

  // Nombre (preferimos nombre+apellidos de sesión)
  const nombreFull =
    [s?.nombre, s?.apellidos].filter(Boolean).join(" ").trim() || "—";
  setText(CFG.SEL.name, nombreFull);

  // Badge depto
  const badge = $(CFG.SEL.badge);
  if (badge) badge.textContent = await resolveDeptName(ids.dept_id);

  // Avatar
  const img = $(CFG.SEL.avatar);
  if (img) {
    setAvatarImage(img, {
      id_usuario: ids.id_usuario ?? ids.empleado_id,
      avatarUrl: s?.avatarUrl || s?.avatar,
      nombre: s?.nombre,
      apellidos: s?.apellidos,
    });
  }
}

/* =========================
 * Modal Perfil (open/close + prefill + submit)
 * ========================= */
function wireModalOpenClose(modal) {
  const content = modal.querySelector(".modal-content");
  const closeBtn = modal.querySelector(".modal-close");

  const open = () => {
    modal.classList.add("active");
    document.body.classList.add("modal-open");
  };
  const close = () => {
    modal.classList.remove("active");
    document.body.classList.remove("modal-open");
  };

  // Openers: .edit-profile o data-open
  const openers = document.querySelectorAll(
    `.edit-profile,[data-open="#${CFG.SEL.modalId}"]`
  );
  openers.forEach((el) =>
    el.addEventListener("click", (e) => {
      e.preventDefault();
      open();
      modal.dispatchEvent(new CustomEvent("perfil:open"));
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

  return { open, close };
}

function pickInputs(modal) {
  // EDITABLES
  const inpNombre = modal.querySelector("#perfil-nombre");
  const inpApellidos = modal.querySelector("#perfil-apellidos");
  const inpEmail = modal.querySelector("#perfil-email");
  const inpTel = modal.querySelector("#perfil-telefono");
  const inpPass = modal.querySelector("#perfil-password");
  const inpPass2 = modal.querySelector("#perfil-password2");

  // READONLY
  const inpDepto = modal.querySelector("#perfil-departamento");
  const inpReporta = modal.querySelector("#perfil-reporta");
  const inpStatus = modal.querySelector("#perfil-status");

  const miss = [];
  if (!inpNombre) miss.push("#perfil-nombre");
  if (!inpApellidos) miss.push("#perfil-apellidos");
  if (!inpEmail) miss.push("#perfil-email");
  if (!inpTel) miss.push("#perfil-telefono");
  if (!inpDepto) miss.push("#perfil-departamento");
  if (!inpReporta) miss.push("#perfil-reporta");
  if (!inpStatus) miss.push("#perfil-status");

  if (miss.length) warn("Inputs faltantes en modal:", miss);

  return {
    inpNombre,
    inpApellidos,
    inpEmail,
    inpTel,
    inpPass,
    inpPass2,
    inpDepto,
    inpReporta,
    inpStatus,
  };
}

async function prefillPerfil(modal, ids) {
  const I = pickInputs(modal);

  if (!ids.empleado_id) {
    warn("Sin empleado_id en sesión; no puedo prefillear perfil.");
    return { empleado: null };
  }

  try {
    const empleado = await getEmpleadoById(ids.empleado_id);
    log("Empleado actual:", empleado);

    // editables
    if (I.inpNombre) I.inpNombre.value = empleado?.nombre || "";
    if (I.inpApellidos) I.inpApellidos.value = empleado?.apellidos || "";
    if (I.inpEmail) I.inpEmail.value = (empleado?.email || "").toLowerCase();
    if (I.inpTel) I.inpTel.value = empleado?.telefono || "";
    if (I.inpPass) I.inpPass.value = "";
    if (I.inpPass2) I.inpPass2.value = "";

    // depto readonly
    const deptId = empleado?.departamento_id ?? ids.dept_id ?? null;
    if (I.inpDepto) I.inpDepto.value = await resolveDeptName(deptId);

    // reporta a readonly
    let reportaTxt = "—";
    const reportaId =
      empleado?.cuenta?.reporta_a ?? empleado?.reporta_a ?? null;

    if (reportaId) {
      try {
        const jefe = await getEmpleadoById(reportaId);
        reportaTxt =
          [jefe?.nombre, jefe?.apellidos].filter(Boolean).join(" ") ||
          `Empleado #${reportaId}`;
      } catch (e) {
        warn("No pude consultar reporta_a:", reportaId, e);
        reportaTxt = `Empleado #${reportaId}`;
      }
    }
    if (I.inpReporta) I.inpReporta.value = reportaTxt;

    // status readonly (backend trae status num)
    if (I.inpStatus) {
      const st = Number(empleado?.status);
      I.inpStatus.value = st === 1 ? "Activo" : "Inactivo";
    }

    return { empleado };
  } catch (e) {
    err("Error prefill perfil:", e);
    return { empleado: null };
  }
}

async function submitPerfil(modal, empleadoActual, ids, close) {
  const form = modal.querySelector("#form-perfil");
  if (!form) {
    warn("No existe #form-perfil en modal.");
    return;
  }

  const I = pickInputs(modal);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!empleadoActual?.id) {
      warn("No hay empleadoActual para actualizar.");
      return;
    }

    // password opcional
    const pass = (I.inpPass?.value || "").trim();
    const pass2 = (I.inpPass2?.value || "").trim();
    if (pass || pass2) {
      if (pass !== pass2) {
        window.gcToast?.("Las contraseñas no coinciden.", "warning");
        warn("Password mismatch.");
        return;
      }
    }

    const payload = {
      id: Number(empleadoActual.id),
      nombre: (I.inpNombre?.value || "").trim(),
      apellidos: (I.inpApellidos?.value || "").trim(),
      email: (I.inpEmail?.value || "").trim().toLowerCase(),
      telefono: (I.inpTel?.value || "").trim(),
      ...(pass ? { password: pass } : {}),
      updated_by: ids.empleado_id || null,
    };

    log("updateEmpleado payload:", payload);

    try {
      const result = await updateEmpleado(payload);
      log("updateEmpleado OK:", result);

      // 1) Refrescar UI sidebar
      const full =
        [payload.nombre, payload.apellidos].filter(Boolean).join(" ") || "—";
      setText(CFG.SEL.name, full);

      // 2) Persistir sesión (para que otras views ya lo lean)
      try {
        const cur = readSessionSafe();
        const next = {
          ...cur,
          nombre: payload.nombre || cur.nombre,
          apellidos: payload.apellidos || cur.apellidos,
          email: payload.email || cur.email,
          telefono: payload.telefono || cur.telefono,
          empleado_id: cur.empleado_id ?? ids.empleado_id,
          departamento_id: cur.departamento_id ?? ids.dept_id,
          roles: cur.roles ?? ids.roles,
          id_usuario: cur.id_usuario ?? ids.id_usuario,
        };
        Session?.set?.(next);
        writeCookiePayload(next);
        log("Sesión persistida (Session + cookie).");
      } catch (se) {
        warn("No pude persistir sesión:", se);
      }

      // 3) Aviso + cerrar
      window.gcToast?.("Perfil actualizado correctamente.", "success");
      close();

      // 4) Re-hidratar (por si cambió algo más)
      await hydrateSidebarProfile();
    } catch (e2) {
      err("Error al actualizar perfil:", e2);
      window.gcToast?.(
        "Error al actualizar perfil. Intenta de nuevo.",
        "error"
      );
    }
  });
}

function initProfileModalIfPresent() {
  const modal = document.getElementById(CFG.SEL.modalId);
  if (!modal) {
    log("No existe #modal-perfil (OK, es opcional en esta vista).");
    return;
  }

  const s = readSessionSafe();
  const ids = getSessionIds(s);

  const { close } = wireModalOpenClose(modal);

  let empleadoActual = null;

  // Cuando se abre, prefillea
  modal.addEventListener("perfil:open", async () => {
    const out = await prefillPerfil(modal, ids);
    empleadoActual = out.empleado;

    // Focus primer input si existe
    const first = modal.querySelector(
      "input,button,select,textarea,[tabindex]:not([tabindex='-1'])"
    );
    first?.focus?.();
  });

  // Wire submit una sola vez
  submitPerfil(modal, empleadoActual, ids, close);

  // Si el modal viene abierto por HTML (class active), también prefillea
  if (modal.classList.contains("active")) {
    log("Modal ya estaba activo al cargar, haciendo prefill…");
    modal.dispatchEvent(new CustomEvent("perfil:open"));
  }
}

/* =========================
 * Boot
 * ========================= */
function boot() {
  ensureEditProfileButton();
  hydrateSidebarProfile();
  initProfileModalIfPresent();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}

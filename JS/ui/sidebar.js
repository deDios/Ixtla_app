// /JS/ui/sidebar.js
"use strict";

import { getEmpleadoById, updateEmpleado } from "/JS/api/usuarios.js";

/* ======================================
 * Helpers + logs
 * ====================================== */
const TAG = "[Sidebar]";
const DEBUG = true;
const log = (...a) => DEBUG && console.log(TAG, ...a);
const warn = (...a) => DEBUG && console.warn(TAG, ...a);
const err = (...a) => console.error(TAG, ...a);
const toast = (m, t = "info") =>
  window.gcToast ? gcToast(m, t) : log("[toast]", t, m);

const $ = (s, r = document) => r.querySelector(s);

/* ======================================
 * Config (copiado de home.js en lo esencial)
 * ====================================== */
const CONFIG = {
  DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",
  DEPT_FALLBACK_NAMES: { 6: "Presidencia" },
  DEPT_ENDPOINT:
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php",
};

const SEL = {
  avatar: "#hs-avatar",
  profileName: "#hs-profile-name",
  profileBadge: "#hs-profile-badge",

  modalPerfil: "#modal-perfil",
  formPerfil: "#form-perfil",
};

/* ======================================
 * Cookie sesión (mismo patrón de home.js)
 * ====================================== */
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

function getSessionSafe() {
  return readCookiePayload() || {};
}

function cacheBust(url) {
  const base = String(url || "").split("?")[0];
  return base + (base.includes("?") ? "&" : "?") + "v=" + Date.now();
}

/* ======================================
 * Avatar (solo set src, NO upload)
 * ====================================== */
function setAvatarSrc(img, idUsuario) {
  if (!img) return;
  const id = Number(idUsuario);
  if (!id) {
    img.src = CONFIG.DEFAULT_AVATAR;
    return;
  }

  const candidates = [
    `/ASSETS/user/userImgs/img_${id}.png`,
    `/ASSETS/user/userImgs/img_${id}.jpg`,
    `/ASSETS/user/userImgs/img_${id}.webp`,
  ];

  let i = 0;
  const tryNext = () => {
    if (i >= candidates.length) {
      img.onerror = null;
      img.src = CONFIG.DEFAULT_AVATAR;
      return;
    }
    img.onerror = () => {
      i++;
      tryNext();
    };
    img.src = cacheBust(candidates[i]);
  };

  tryNext();
}

/* ======================================
 * Resolver nombre de departamento (igual home.js)
 * ====================================== */
const __DEPT_CACHE = new Map();

async function resolveDeptName(deptId) {
  if (!deptId) return "—";

  const key = Number(deptId);
  if (CONFIG.DEPT_FALLBACK_NAMES[key]) return CONFIG.DEPT_FALLBACK_NAMES[key];
  if (__DEPT_CACHE.has(key)) return __DEPT_CACHE.get(key);

  try {
    const res = await fetch(CONFIG.DEPT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ page: 1, page_size: 200, status: 1 }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    const arr = json?.data || [];
    const found = arr.find((d) => Number(d.id) === key);
    const name = found?.nombre ? String(found.nombre) : `Depto ${deptId}`;
    __DEPT_CACHE.set(key, name);
    return name;
  } catch (e) {
    warn("resolveDeptName() fallback:", deptId, e);
    return `Depto ${deptId}`;
  }
}

/* ======================================
 * Resolver "Reporta a" (por cuenta.reporta_a)
 * ====================================== */
async function resolveReportaA(empleado) {
  const reportaId = empleado?.cuenta?.reporta_a ?? null;
  if (!reportaId) return "—";

  try {
    const jefe = await getEmpleadoById(reportaId);
    const nombre = [jefe?.nombre, jefe?.apellidos]
      .filter(Boolean)
      .join(" ")
      .trim();
    return nombre || `Empleado #${reportaId}`;
  } catch (e) {
    warn("resolveReportaA() error:", reportaId, e);
    return `Empleado #${reportaId}`;
  }
}

/* ======================================
 * Hidratar sidebar (nombre/badge/avatar)
 * ====================================== */
async function hydrateSidebar() {
  const s = getSessionSafe();
  const idUsuario = s?.id_usuario ?? s?.empleado_id ?? null;
  const deptId = s?.dept_id ?? s?.departamento_id ?? null;

  const nombre =
    [s?.nombre, s?.apellidos].filter(Boolean).join(" ").trim() || "—";
  const nameEl = $(SEL.profileName);
  if (nameEl) nameEl.textContent = nombre;

  const img = $(SEL.avatar);
  if (img) setAvatarSrc(img, idUsuario);

  const badge = $(SEL.profileBadge);
  if (badge) badge.textContent = await resolveDeptName(deptId);

  log("hydrateSidebar()", { idUsuario, deptId, nombre });
}

/* ======================================
 * Modal Perfil (open/close + prefill + submit)
 * ====================================== */
function wirePerfilModal() {
  const modal = $(SEL.modalPerfil);
  if (!modal) return;

  const content = modal.querySelector(".modal-content");
  const closeBtn = modal.querySelector(".modal-close");
  const form = modal.querySelector(SEL.formPerfil);

  // Inputs (IDs reales del modal de producción)
  const inpNombre = modal.querySelector("#perfil-nombre");
  const inpApellidos = modal.querySelector("#perfil-apellidos");
  const inpEmail = modal.querySelector("#perfil-email");
  const inpTelefono = modal.querySelector("#perfil-telefono");
  const inpPass = modal.querySelector("#perfil-password");
  const inpPass2 = modal.querySelector("#perfil-password2");

  const inpDepto = modal.querySelector("#perfil-departamento");
  const inpReporta = modal.querySelector("#perfil-reporta");
  const inpStatus = modal.querySelector("#perfil-status");

  let empleadoActual = null;

  const open = async () => {
    modal.classList.add("active");
    document.body.classList.add("modal-open");

    const s = getSessionSafe();
    const empId = s?.empleado_id ?? null;

    if (!empId) {
      toast("No se detectó tu sesión.", "warning");
      return;
    }

    try {
      empleadoActual = await getEmpleadoById(empId);
      log("empleadoActual:", empleadoActual);

      // Editables
      if (inpNombre) inpNombre.value = empleadoActual?.nombre || "";
      if (inpApellidos) inpApellidos.value = empleadoActual?.apellidos || "";
      if (inpEmail)
        inpEmail.value = (empleadoActual?.email || "").toLowerCase();
      if (inpTelefono) inpTelefono.value = empleadoActual?.telefono || "";
      if (inpPass) inpPass.value = "";
      if (inpPass2) inpPass2.value = "";

      // Departamento: usa empleado.departamento_id (prioridad) y fallback 6=Presidencia
      const deptId =
        empleadoActual?.departamento_id ??
        s?.dept_id ??
        s?.departamento_id ??
        null;
      const deptName = await resolveDeptName(deptId);
      if (inpDepto) inpDepto.value = deptName;

      // Badge sidebar: también lo sincronizamos
      const badge = $(SEL.profileBadge);
      if (badge) badge.textContent = deptName;

      // Reporta a: usa empleado.cuenta.reporta_a
      if (inpReporta) inpReporta.value = await resolveReportaA(empleadoActual);

      // Status readonly
      if (inpStatus) {
        const st = Number(empleadoActual?.status);
        inpStatus.value = st === 1 ? "Activo" : "Inactivo";
      }
    } catch (e) {
      err("open perfil error:", e);
      toast("No se pudo cargar tu perfil.", "error");
    }
  };

  const close = () => {
    modal.classList.remove("active");
    document.body.classList.remove("modal-open");
  };

  // Openers (tu HTML actual)
  document
    .querySelectorAll(`.edit-profile,[data-open="#modal-perfil"]`)
    .forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        open();
      });
    });

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

  // Submit (usa empleadoActual del closure → mismo patrón que home.js)
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!empleadoActual?.id) {
      warn("No hay empleadoActual para actualizar.");
      toast("Aún se está cargando tu perfil. Intenta de nuevo.", "warning");
      return;
    }

    const p1 = (inpPass?.value || "").trim();
    const p2 = (inpPass2?.value || "").trim();
    if ((p1 || p2) && p1 !== p2) {
      toast("Las contraseñas no coinciden.", "warning");
      return;
    }

    const payload = {
      id: empleadoActual.id,
      nombre: (inpNombre?.value || "").trim(),
      apellidos: (inpApellidos?.value || "").trim(),
      email: (inpEmail?.value || "").trim().toLowerCase(),
      telefono: (inpTelefono?.value || "").trim(),
      ...(p1 ? { password: p1 } : {}),
    };

    log("updateEmpleado payload:", payload);

    try {
      const updated = await updateEmpleado(payload);
      log("updateEmpleado OK:", updated);

      // UI sidebar inmediata
      const full =
        [payload.nombre, payload.apellidos].filter(Boolean).join(" ").trim() ||
        "—";
      const nameEl = $(SEL.profileName);
      if (nameEl) nameEl.textContent = full;

      // Persistir sesión cookie para que otras views lo lean
      const s = getSessionSafe();
      writeCookiePayload({
        ...s,
        nombre: payload.nombre || s.nombre,
        apellidos: payload.apellidos || s.apellidos,
        email: payload.email || s.email,
        telefono: payload.telefono || s.telefono,
      });

      toast("Perfil actualizado correctamente.", "success");
      close();
    } catch (e2) {
      err("update perfil error:", e2);
      toast("Error al actualizar perfil. Intenta de nuevo.", "error");
    }
  });

  log("wirePerfilModal(): OK");
}

/* ======================================
 * Boot
 * ====================================== */
function boot() {
  hydrateSidebar();
  wirePerfilModal();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}

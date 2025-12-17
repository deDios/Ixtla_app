// /JS/ui/sidebar.js
"use strict";

import { getEmpleadoById, updateEmpleado } from "/JS/api/usuarios.js";

/* ======================================
 * Helpers + logs
 * ====================================== */
const TAG = "[Sidebar]";
const DEBUG = true;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const log = (...a) => DEBUG && console.log(TAG, ...a);
const warn = (...a) => DEBUG && console.warn(TAG, ...a);
const err = (...a) => console.error(TAG, ...a);
const toast = (m, t = "info") =>
  window.gcToast ? gcToast(m, t) : log("[toast]", t, m);

/* ======================================
 * Selectores comunes del sidebar
 * ====================================== */
const SEL = {
  avatar: "#hs-avatar",
  profileName: "#hs-profile-name",
  profileBadge: "#hs-profile-badge",
  profileSection: ".hs-profile",

  // Modal perfil (tu producción)
  modalPerfil: "#modal-perfil",
  formPerfil: "#form-perfil",
};

/* ======================================
 * Cookie sesión (igual al patrón de home.js)
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
    warn("No pude escribir cookie ix_emp:", e);
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
const DEFAULT_AVATAR = "/ASSETS/user/img_user1.png";

function setAvatarSrc(img, idUsuario) {
  if (!img) return;
  const id = Number(idUsuario);
  if (!id) {
    img.src = DEFAULT_AVATAR;
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
      img.src = DEFAULT_AVATAR;
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
 * Departamento (fallback simple)
 * (si en tu sesión ya viene dept_name, úsalo)
 * ====================================== */
async function resolveDeptNameFromSessionOrEmp(session, empleado) {
  if (session?.dept_name) return session.dept_name;

  // si empleado trae depto textual
  if (empleado?.departamento_nombre) return empleado.departamento_nombre;

  // si no, usa id numérico como fallback visible
  const deptId = session?.dept_id ?? empleado?.departamento_id ?? null;
  return deptId ? `Depto ${deptId}` : "—";
}

/* ======================================
 * Hidratar sidebar (nombre/badge/avatar)
 * ====================================== */
async function hydrateSidebar() {
  const s = getSessionSafe();
  const empleadoId = s?.empleado_id ?? null;
  const deptId = s?.dept_id ?? null;
  const idUsuario = s?.id_usuario ?? s?.empleado_id ?? null;

  // Nombre (si viene en sesión)
  const nombre =
    [s?.nombre, s?.apellidos].filter(Boolean).join(" ").trim() || "—";
  const nameEl = $(SEL.profileName);
  if (nameEl) nameEl.textContent = nombre;

  // Avatar (solo src)
  const img = $(SEL.avatar);
  if (img) setAvatarSrc(img, idUsuario);

  // Badge dept (mejoramos cuando abrimos modal y ya tenemos empleado)
  const badge = $(SEL.profileBadge);
  if (badge) badge.textContent = deptId ? `Depto ${deptId}` : "—";

  log("hydrateSidebar()", { empleadoId, deptId, idUsuario, nombre });
}

/* ======================================
 * Modal Perfil (MISMO PATRÓN DE home.js)
 * ====================================== */
function wirePerfilModal() {
  const modal = $(SEL.modalPerfil);
  if (!modal) {
    log("No hay #modal-perfil en esta vista (OK).");
    return;
  }

  const content = modal.querySelector(".modal-content");
  const closeBtn = modal.querySelector(".modal-close");
  const form = modal.querySelector(SEL.formPerfil);

  // Inputs (IDs reales en tu HTML)
  const inpNombre = modal.querySelector("#perfil-nombre");
  const inpApellidos = modal.querySelector("#perfil-apellidos");
  const inpEmail = modal.querySelector("#perfil-email");
  const inpTelefono = modal.querySelector("#perfil-telefono");
  const inpPass = modal.querySelector("#perfil-password");
  const inpPass2 = modal.querySelector("#perfil-password2");

  const inpDepto = modal.querySelector("#perfil-departamento");
  const inpReporta = modal.querySelector("#perfil-reporta");
  const inpStatus = modal.querySelector("#perfil-status");

  // 🔑 Este es el punto clave: empleadoActual vive en el closure, como home.js
  let empleadoActual = null;

  const focusFirst = () => {
    const first = modal.querySelector(
      "input,button,select,textarea,[tabindex]:not([tabindex='-1'])"
    );
    first?.focus?.();
  };

  const open = async () => {
    modal.classList.add("active");
    document.body.classList.add("modal-open");

    const s = getSessionSafe();
    const empId = s?.empleado_id ?? null;
    if (!empId) {
      warn("[Perfil] Sin empleado_id en sesión");
      toast("No se detectó tu sesión.", "warning");
      return;
    }

    try {
      // 1) Traer empleado actual (igual que home.js)
      empleadoActual = await getEmpleadoById(empId);
      log("[Perfil] empleado actual:", empleadoActual);

      // 2) Prefill editables
      if (inpNombre) inpNombre.value = empleadoActual?.nombre || "";
      if (inpApellidos) inpApellidos.value = empleadoActual?.apellidos || "";
      if (inpEmail)
        inpEmail.value = (empleadoActual?.email || "").toLowerCase();
      if (inpTelefono) inpTelefono.value = empleadoActual?.telefono || "";
      if (inpPass) inpPass.value = "";
      if (inpPass2) inpPass2.value = "";

      // 3) Readonly fields
      if (inpDepto)
        inpDepto.value = await resolveDeptNameFromSessionOrEmp(
          s,
          empleadoActual
        );

      // Reporta a (si backend trae un id o texto)
      let reportaTxt = "—";
      const reportaId =
        empleadoActual?.cuenta?.reporta_a ?? empleadoActual?.reporta_a ?? null;

      if (
        typeof empleadoActual?.reporta_a_nombre === "string" &&
        empleadoActual.reporta_a_nombre.trim()
      ) {
        reportaTxt = empleadoActual.reporta_a_nombre.trim();
      } else if (reportaId) {
        try {
          const jefe = await getEmpleadoById(reportaId);
          reportaTxt =
            [jefe?.nombre, jefe?.apellidos].filter(Boolean).join(" ") ||
            `Empleado #${reportaId}`;
        } catch {
          reportaTxt = `Empleado #${reportaId}`;
        }
      }
      if (inpReporta) inpReporta.value = reportaTxt;

      // Status
      if (inpStatus) {
        const st = Number(empleadoActual?.status);
        inpStatus.value = st === 1 ? "Activo" : "Inactivo";
      }

      // 4) Refresca badge dept con algo más bonito si ya tenemos
      const badge = $(SEL.profileBadge);
      if (badge && inpDepto?.value) badge.textContent = inpDepto.value;

      focusFirst();
    } catch (e) {
      err("[Perfil] error al abrir:", e);
      toast("No se pudo cargar tu perfil.", "error");
    }
  };

  const close = () => {
    modal.classList.remove("active");
    document.body.classList.remove("modal-open");
  };

  // Openers (tu producción)
  const openers = document.querySelectorAll(
    `.edit-profile,[data-open="#modal-perfil"]`
  );
  openers.forEach((btn) =>
    btn.addEventListener("click", (e) => {
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

  // Guardar (igual patrón home.js: usa empleadoActual del closure)
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!empleadoActual?.id) {
      warn("No hay empleadoActual para actualizar.");
      toast("Aún se está cargando tu perfil. Intenta de nuevo.", "warning");
      return;
    }

    // password opcional
    const p1 = (inpPass?.value || "").trim();
    const p2 = (inpPass2?.value || "").trim();
    if ((p1 || p2) && p1 !== p2) {
      toast("Las contraseñas no coinciden.", "warning");
      return;
    }

    const nombre = (inpNombre?.value || "").trim();
    let apellidos = (inpApellidos?.value || "").trim();
    // mismo “fallback” que usabas en home: si metes todo en nombre
    if (!apellidos && nombre.includes(" ")) {
      const parts = nombre.split(/\s+/);
      apellidos = parts.slice(1).join(" ");
    }

    const payload = {
      id: empleadoActual.id,
      nombre,
      apellidos,
      email: (inpEmail?.value || "").trim().toLowerCase(),
      telefono: (inpTelefono?.value || "").trim(),
      ...(p1 ? { password: p1 } : {}),
    };

    log("[Perfil] update payload:", payload);

    try {
      await updateEmpleado(payload);

      // 1) UI sidebar inmediata
      const full =
        [payload.nombre, payload.apellidos].filter(Boolean).join(" ").trim() ||
        "—";
      const nameEl = $(SEL.profileName);
      if (nameEl) nameEl.textContent = full;

      // 2) Persistir sesión cookie (sin recargar)
      const s = getSessionSafe();
      const next = {
        ...s,
        nombre: payload.nombre || s.nombre,
        apellidos: payload.apellidos || s.apellidos,
        email: payload.email || s.email,
        telefono: payload.telefono || s.telefono,
      };
      writeCookiePayload(next);

      toast("Perfil actualizado correctamente.", "success");
      close();
    } catch (e2) {
      err("[Perfil] error al actualizar:", e2);
      toast("Error al actualizar perfil. Intenta de nuevo.", "error");
    }
  });

  log("wirePerfilModal(): OK", { openers: openers.length });
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

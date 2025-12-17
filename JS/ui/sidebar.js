// /JS/ui/sidebar.js
// Sidebar global: hidrata perfil + modal "Administrar perfil" (NO avatar upload)
// Requiere: /JS/auth/session.js (window.Session), /JS/api/usuarios.js (updatePerfilBasico, changePassword)
"use strict";

import { updatePerfilBasico, changePassword } from "../api/usuarios.js";

const TAG = "[Sidebar]";
const DEBUG = true;

const log = (...a) => DEBUG && console.log(TAG, ...a);
const warn = (...a) => DEBUG && console.warn(TAG, ...a);
const err = (...a) => DEBUG && console.error(TAG, ...a);
const toast = (m, t = "info") => (window.gcToast ? gcToast(m, t) : log("[toast]", t, m));

/* ========================================================================== */
/* Selectores tolerantes (Home / Requerimiento / otras)                        */
/* ========================================================================== */
const SEL = {
  // Avatar en sidebar (puede ser id o class)
  avatarCandidates: [
    "#hs-avatar",
    ".home-sidebar .profile-card img.avatar",
    ".home-sidebar .profile-card .avatar",
    ".profile-card img.avatar",
    ".profile-card .avatar",
    "aside .profile-card img",
  ],
  // Nombre en sidebar
  nameCandidates: ["#hs-profile-name", "#h-user-nombre", ".profile-name"],
  // Badge / departamento
  deptCandidates: ["#hs-dept-badge", ".profile-dep.badge", ".profile-dep"],
  // Openers del modal perfil
  perfilOpeners: ['a[href="#perfil"]', "[data-open-perfil]", "[data-act='open-perfil']"],
  // Modal perfil
  modalPerfil: "#modal-perfil",
  modalClose: "#modal-perfil .modal-close, #modal-perfil [data-close], #modal-perfil .btn-close",
  formPerfil: "#form-perfil",
};

/* ========================================================================== */
/* Cookie fallback (igual que Home)                                            */
/* ========================================================================== */
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
    document.cookie = `ix_emp=${encodeURIComponent(b64)}; path=/; max-age=${maxAge}; samesite=lax`;
  } catch (e) {
    warn("No pude escribir cookie ix_emp:", e);
  }
}

function getSession() {
  // 1) Session module
  try {
    const s = window.Session?.get?.();
    if (s) return s;
  } catch {}
  // 2) cookie fallback
  return readCookiePayload();
}

/* ========================================================================== */
/* Helpers DOM                                                                 */
/* ========================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function pickFirst(selectors, root = document) {
  for (const s of selectors) {
    const el = $(s, root);
    if (el) return el;
  }
  return null;
}

function setText(el, text) {
  if (!el) return;
  el.textContent = text ?? "—";
}

function cacheBust(url) {
  if (!url) return "";
  const base = String(url).split("?")[0];
  return base + (base.includes("?") ? "&" : "?") + "v=" + Date.now();
}

function resolveUserId(sess) {
  return (
    sess?.id_usuario ??
    sess?.usuario_id ??
    sess?.id_empleado ??
    sess?.empleado_id ??
    null
  );
}

function setSidebarAvatarFromSession(sess) {
  const img = pickFirst(SEL.avatarCandidates);
  if (!img) return;

  // Si avatar-edit.js expone helper global, úsalo; si no, fallback a candidatos por id
  const idu = resolveUserId(sess);
  const candidates = [];

  // 1) si en sesión viene avatarUrl/avatar
  const direct = sess?.avatarUrl || sess?.avatar;
  if (direct) candidates.push(direct);

  // 2) fallback a rutas conocidas (ajusta si tu path final es distinto)
  if (idu) {
    candidates.push(`/ASSETS/user/userImgs/img_${idu}.png`);
    candidates.push(`/ASSETS/user/userImgs/img_${idu}.jpg`);
    candidates.push(`/ASSETS/user/userImgs/img_${idu}.webp`);
  }

  // 3) default
  const DEFAULT_AVATAR = "/ASSETS/user/img_user1.png";
  candidates.push(DEFAULT_AVATAR);

  let i = 0;
  const tryNext = () => {
    const src = candidates[i++];
    if (!src) return;
    img.onerror = () => tryNext();
    img.src = cacheBust(src);
  };

  tryNext();
}

function updateSidebarProfileUI(sess) {
  const nameEl = pickFirst(SEL.nameCandidates);
  const deptEl = pickFirst(SEL.deptCandidates);

  const nombre = [sess?.nombre, sess?.apellidos].filter(Boolean).join(" ").trim() || "—";
  const deptName =
    sess?.departamento_nombre ||
    sess?.dept_name ||
    sess?.departamento ||
    sess?.dep_nombre ||
    ""; // si lo traes en sesión

  setText(nameEl, nombre);
  if (deptEl) setText(deptEl, deptName || deptEl.textContent || "—");

  setSidebarAvatarFromSession(sess);
}

/* ========================================================================== */
/* Modal Perfil                                                                */
/* ========================================================================== */
function isOpen(modal) {
  return modal?.getAttribute("aria-hidden") === "false" || modal?.classList.contains("is-open");
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function fillPerfilFormFromSession(sess) {
  const form = $(SEL.formPerfil);
  if (!form) return;

  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el && v != null) el.value = String(v);
  };

  // OJO: tu input es name="correo" pero en backend se llama email.
  setVal("perfil-nombre", sess?.nombre || "");
  setVal("perfil-apellidos", sess?.apellidos || "");
  setVal("perfil-email", sess?.email || sess?.correo || "");
  setVal("perfil-telefono", sess?.telefono || "");

  // Limpia password fields (opcional)
  setVal("perfil-password", "");
  setVal("perfil-password2", "");
}

function wirePerfilModal() {
  const modal = $(SEL.modalPerfil);
  const form = $(SEL.formPerfil);
  if (!modal || !form) {
    log("No hay modal-perfil en esta vista (OK).");
    return;
  }

  // Openers
  $$(SEL.perfilOpeners).forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const sess = getSession();
      if (!sess) {
        toast("No hay sesión activa.", "warning");
        return;
      }
      fillPerfilFormFromSession(sess);
      openModal(modal);
      log("Modal perfil abierto.");
    });
  });

  // Close: botón
  $$(SEL.modalClose).forEach((btn) => btn.addEventListener("click", () => closeModal(modal)));

  // Close: click overlay (si tu overlay es el #modal-perfil)
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal(modal);
  });

  // Close: ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen(modal)) closeModal(modal);
  });

  // Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const sess = getSession();
    const id = sess?.empleado_id ?? sess?.id_empleado ?? sess?.id ?? null;
    const updated_by = sess?.empleado_id ?? null;

    if (!id) {
      toast("No pude detectar tu empleado_id en sesión.", "error");
      warn("Sesión sin empleado_id:", sess);
      return;
    }

    const nombre = ($("#perfil-nombre")?.value || "").trim();
    const apellidos = ($("#perfil-apellidos")?.value || "").trim();
    const correo = ($("#perfil-email")?.value || "").trim();
    const telefono = ($("#perfil-telefono")?.value || "").trim();

    const pass1 = ($("#perfil-password")?.value || "").trim();
    const pass2 = ($("#perfil-password2")?.value || "").trim();

    log("Submit perfil:", {
      id,
      nombre,
      apellidos,
      email: correo,
      telefono,
      wantsPasswordChange: !!pass1,
      updated_by,
    });

    if (!nombre || !apellidos) {
      toast("Nombre y apellidos son obligatorios.", "warning");
      return;
    }

    if (pass1 || pass2) {
      if (pass1.length < 8) {
        toast("La contraseña debe tener al menos 8 caracteres.", "warning");
        return;
      }
      if (pass1 !== pass2) {
        toast("Las contraseñas no coinciden.", "warning");
        return;
      }
    }

    // UI lock
    const btn = form.querySelector('button[type="submit"]');
    btn && (btn.disabled = true);

    try {
      // 1) Perfil básico
      const emp = await updatePerfilBasico({
        id,
        nombre,
        apellidos,
        email: correo,
        telefono,
        updated_by,
      });

      log("updatePerfilBasico OK:", emp);

      // 2) Password (opcional)
      if (pass1) {
        const emp2 = await changePassword({ id, password: pass1, updated_by });
        log("changePassword OK:", emp2);
      }

      // 3) Persistir sesión (Session + cookie) para que TODA la UI se actualice sin reload
      const cur = sess || {};
      const next = {
        ...cur,
        nombre,
        apellidos,
        email: correo || cur.email,
        telefono: telefono || cur.telefono,
        // conserva ids/roles/depto
        empleado_id: cur.empleado_id ?? cur.id_empleado ?? id,
        departamento_id: cur.departamento_id ?? cur.dept_id ?? cur.departamento_id,
        roles: cur.roles ?? [],
        id_usuario: cur.id_usuario ?? cur.usuario_id ?? cur.id_usuario,
      };

      try {
        window.Session?.set?.(next);
      } catch (se) {
        warn("Session.set falló:", se);
      }
      writeCookiePayload(next);

      // 4) Refrescar sidebar + header si existen hooks
      updateSidebarProfileUI(next);
      window.gcRefreshHeader?.(next);

      // 5) Notificar a otros módulos (por si requerimientos/tareas escuchan)
      window.dispatchEvent(new CustomEvent("ix:perfil-updated", { detail: next }));

      toast("Perfil actualizado correctamente.", "exito");
      closeModal(modal);
    } catch (e2) {
      err("Error actualizando perfil:", e2);
      toast("Error al actualizar perfil. Revisa consola.", "error");
    } finally {
      btn && (btn.disabled = false);
    }
  });

  log("Modal perfil cableado.");
}

/* ========================================================================== */
/* Boot                                                                        */
/* ========================================================================== */
function boot() {
  const sess = getSession();
  if (!sess) {
    warn("Sin sesión (ix_emp) para hidratar sidebar.");
  } else {
    updateSidebarProfileUI(sess);
    log("Sidebar perfil hidratado:", {
      nombre: [sess.nombre, sess.apellidos].filter(Boolean).join(" "),
      empleado_id: sess.empleado_id ?? sess.id_empleado,
      id_usuario: resolveUserId(sess),
    });
  }

  wirePerfilModal();
}

boot();

/* ========================================================================== */
/* API pública                       */
/* ========================================================================== */
export function IxSidebar_refresh() {
  const sess = getSession();
  if (sess) updateSidebarProfileUI(sess);
}

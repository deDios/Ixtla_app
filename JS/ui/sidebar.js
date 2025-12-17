// /JS/ui/sidebar.js
// ================= Ixtla – Sidebar (perfil + modal perfil + filtros opcionales) =================
"use strict";

import { Session } from "/JS/auth/session.js";
import { getEmpleadoById, updateEmpleado } from "/JS/api/usuarios.js";

/* -------------------- Config -------------------- */
const CFG = {
  DEBUG: true,
  DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",

  // Endpoint para resolver nombres de departamento (fallback si no existe usuarios.js)
  DEPT_API:
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php",
  DEPT_FALLBACK_NAMES: { 6: "Presidencia" },

  SEL: {
    avatar: "#hs-avatar",
    profileName: "#hs-profile-name",
    profileBadge: "#hs-profile-badge",
    profileSection: ".hs-profile",

    modalId: "modal-perfil",

    // Filtros (opcionales)
    statusGroup: "#hs-states",
    statusItems: "#hs-states .item",
    legendStatus: "#hs-legend-status",
    searchInput: "#hs-search",
    cnt: {
      todos: "#cnt-todos",
      solicitud: "#cnt-solicitud",
      revision: "#cnt-revision",
      asignacion: "#cnt-asignacion",
      proceso: "#cnt-proceso",
      pausado: "#cnt-pausado",
      cancelado: "#cnt-cancelado",
      finalizado: "#cnt-finalizado",
    },
  },
};

/* -------------------- Helpers -------------------- */
const TAG = "[Sidebar]";
const log = (...a) => CFG.DEBUG && console.log(TAG, ...a);
const warn = (...a) => CFG.DEBUG && console.warn(TAG, ...a);
const err = (...a) => console.error(TAG, ...a);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const toast = (m, t = "info") =>
  window.gcToast ? gcToast(m, t) : log("[toast]", t, m);

const setText = (sel, txt) => {
  const el = $(sel);
  if (el) el.textContent = String(txt ?? "—");
};

function readCookieSession() {
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

function getSessionSafe() {
  // 1) Session module
  try {
    const s = Session?.get?.();
    if (s) return s;
  } catch {}
  // 2) window.Session (por si lo cargas en otro bundle)
  try {
    const s = window.Session?.get?.();
    if (s) return s;
  } catch {}
  // 3) cookie ix_emp
  return readCookieSession();
}

function cacheBust(url) {
  if (!url) return url;
  const base = String(url).split("?")[0];
  return base + (base.includes("?") ? "&" : "?") + "v=" + Date.now();
}

/** Construye la ruta de avatar local (tu patrón actual en producción) */
function buildAvatarUrl(id_usuario) {
  if (!id_usuario) return CFG.DEFAULT_AVATAR;
  return `/ASSETS/user/userImgs/img_${id_usuario}.png`;
}

function setAvatarImage(
  imgEl,
  { id_usuario, avatarUrl, nombre, apellidos } = {}
) {
  if (!imgEl) return;
  const alt = [nombre, apellidos].filter(Boolean).join(" ").trim() || "Avatar";
  imgEl.alt = alt;

  const url =
    avatarUrl ||
    imgEl.getAttribute("data-src-resolved") ||
    buildAvatarUrl(id_usuario) ||
    CFG.DEFAULT_AVATAR;

  imgEl.src = cacheBust(url);

  // fallback si el archivo no existe
  imgEl.onerror = () => {
    imgEl.onerror = null;
    imgEl.src = CFG.DEFAULT_AVATAR;
  };
}

/* -------------------- Dept resolver (para badge) -------------------- */
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
    const list = Array.isArray(json?.data) ? json.data : [];
    for (const d of list) __DEPT_CACHE.set(Number(d.id), d.nombre);
    return __DEPT_CACHE.get(idNum) || "—";
  } catch (e) {
    warn("resolveDeptName() fallback:", e);
    return "—";
  }
}

/* -------------------- PERFIL (siempre) -------------------- */
async function refreshProfile(sess = null) {
  const s = sess || getSessionSafe();
  if (!s) return;

  const id_usuario =
    s.id_usuario ?? s.usuario_id ?? s.empleado_id ?? s.id_empleado;
  const name = [s.nombre, s.apellidos].filter(Boolean).join(" ").trim();

  if (name) setText(CFG.SEL.profileName, name);

  const avatarEl = $(CFG.SEL.avatar);
  setAvatarImage(avatarEl, {
    id_usuario,
    avatarUrl: s.avatarUrl || s.avatar,
    nombre: s.nombre,
    apellidos: s.apellidos,
  });

  // badge dept
  const badgeEl = $(CFG.SEL.profileBadge);
  if (badgeEl) {
    const deptId = s.dept_id ?? s.departamento_id ?? s.deptId;
    badgeEl.textContent = await resolveDeptName(deptId);
  }
}

/* -------------------- MODAL PERFIL (opcional) -------------------- */
function openModal(modal) {
  if (!modal) return;
  modal.classList.add("active");
  modal.removeAttribute("aria-hidden");
  document.body.classList.add("modal-open");
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function wireModalClose(modal) {
  if (!modal) return;

  const closeBtns = [
    ...modal.querySelectorAll(
      '[data-close="1"], .modal-close, .btn-close, .close'
    ),
  ];

  closeBtns.forEach((b) =>
    b.addEventListener("click", () => closeModal(modal), { passive: true })
  );

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal(modal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("active"))
      closeModal(modal);
  });
}

async function fillPerfilModal(modal, empleadoId) {
  const $m = (sel) => modal.querySelector(sel);

  try {
    log("fillPerfilModal() empleadoId:", empleadoId);
    const emp = await getEmpleadoById(empleadoId); // tu API
    if (!emp) throw new Error("Empleado no encontrado");

    // OJO: no precargamos password
    const deptName = await resolveDeptName(emp.departamento_id);

    const set = (id, v) => {
      const el = $m("#" + id);
      if (el) el.value = v ?? "";
    };

    set("perfil-nombre", emp.nombre);
    set("perfil-apellidos", emp.apellidos);
    set("perfil-email", emp.correo);
    set("perfil-telefono", emp.telefono);

    set("perfil-depto", deptName);
    set("perfil-reporta", emp.reporta_a_nombre || "");
    set("perfil-status", emp.status);

    // limpia passwords
    set("perfil-password", "");
    set("perfil-password2", "");
  } catch (e) {
    warn("fillPerfilModal() error:", e);
    toast("No se pudo cargar tu perfil.", "warning");
  }
}

function wirePerfilSubmit(modal, empleadoId) {
  const form = modal.querySelector("form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());

    const pass1 = String(payload.password || "").trim();
    const pass2 = String(payload.password2 || "").trim();

    // validación rápida
    if (pass1 || pass2) {
      if (pass1.length < 6) {
        toast("La contraseña debe tener al menos 6 caracteres.", "warning");
        return;
      }
      if (pass1 !== pass2) {
        toast("Las contraseñas no coinciden.", "warning");
        return;
      }
    }

    const req = {
      id: empleadoId,
      nombre: payload.nombre?.trim(),
      apellidos: payload.apellidos?.trim(),
      correo: payload.correo?.trim(),
      telefono: payload.telefono?.trim(),
      ...(pass1 ? { password: pass1 } : {}), // solo si escribió
    };

    try {
      log("updateEmpleado() payload:", req);
      await updateEmpleado(req);

      toast("Perfil actualizado", "exito");

      // refresca UI sidebar con datos nuevos
      const s = getSessionSafe() || {};
      const merged = { ...s, ...req };
      try {
        // si tu Session soporta set/update, úsalo
        Session?.set?.(merged);
      } catch {}
      await refreshProfile(merged);

      closeModal(modal);
    } catch (e2) {
      err("updateEmpleado() error:", e2);
      toast("No se pudo actualizar el perfil.", "error");
    }
  });
}

function wireProfileModalOpeners() {
  const modal = document.getElementById(CFG.SEL.modalId);
  if (!modal) {
    log("No hay #modal-perfil en esta vista (OK).");
    return;
  }

  wireModalClose(modal);

  // Botones que abren el modal
  const openers = document.querySelectorAll(
    `.edit-profile, [data-open="#${CFG.SEL.modalId}"]`
  );

  openers.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();

      const s = getSessionSafe();
      const empleadoId = s?.empleado_id ?? s?.id_empleado ?? s?.id_usuario;
      if (!empleadoId) {
        toast("No se detectó tu sesión.", "warning");
        return;
      }

      openModal(modal);
      await fillPerfilModal(modal, empleadoId);
      wirePerfilSubmit(modal, empleadoId); // idempotente: si te preocupa duplicar, avísame y lo blindamos
    });
  });

  log("Modal perfil cableado:", openers.length, "openers");
}

/* -------------------- FILTROS (opcionales) -------------------- */
function normalizeStatusKey(k) {
  if (!k) return "todos";
  let s = String(k)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\s_-]+/g, "");
  if (s === "enproceso") return "proceso";
  return s;
}

function applyActiveUI(filterKey) {
  const group = $(CFG.SEL.statusGroup);
  if (!group) return;
  $$(CFG.SEL.statusItems, group).forEach((btn) => {
    const active = normalizeStatusKey(btn.dataset.status) === filterKey;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-checked", active ? "true" : "false");
    btn.tabIndex = active ? 0 : -1;
  });
}

const S = {
  filterKey: "todos",
  onChange: null,
};

function bindFiltersIfExist() {
  const group = $(CFG.SEL.statusGroup);
  if (!group) return;

  group.addEventListener("click", (e) => {
    const btn = e.target.closest(CFG.SEL.statusItems);
    if (!btn) return;
    const key = normalizeStatusKey(btn.dataset.status);
    S.filterKey = key;
    applyActiveUI(key);
    S.onChange?.({ type: "filter", value: key });
  });

  // initial UI
  applyActiveUI(S.filterKey);
}

/* -------------------- Public API (por si la vista quiere usarlo) -------------------- */
export const Sidebar = {
  refreshProfile,
  setCounts(map = {}) {
    const wrap = (n) => (n == null ? "" : `(${n})`);
    setText(CFG.SEL.cnt.todos, wrap(map.todos));
    setText(CFG.SEL.cnt.solicitud, wrap(map.solicitud));
    setText(CFG.SEL.cnt.revision, wrap(map.revision));
    setText(CFG.SEL.cnt.asignacion, wrap(map.asignacion));
    setText(CFG.SEL.cnt.proceso, wrap(map.proceso));
    setText(CFG.SEL.cnt.pausado, wrap(map.pausado));
    setText(CFG.SEL.cnt.cancelado, wrap(map.cancelado));
    setText(CFG.SEL.cnt.finalizado, wrap(map.finalizado));
  },
  onChange(fn) {
    S.onChange = fn;
  },
};

window.IxtlaSidebar = Sidebar;

/* -------------------- Boot -------------------- */
async function bootSidebar() {
  log("boot()");
  await refreshProfile();
  wireProfileModalOpeners();
  bindFiltersIfExist();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootSidebar);
} else {
  bootSidebar();
}

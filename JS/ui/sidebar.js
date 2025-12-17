// /JS/ui/sidebar.js
// Sidebar universal: perfil (avatar + nombre + depto) + modal perfil + editor avatar (UI)
// Compatible con layouts: hs-* (requerimiento) y home-sidebar/profile-card (home legacy)
"use strict";

/* ========================================================================== */
/* Imports                                                                     */
/* ========================================================================== */
import { getEmpleadoById, updateEmpleado } from "/JS/api/usuarios.js";

/* ========================================================================== */
/* Config                                                                      */
/* ========================================================================== */
const CFG = {
  DEBUG: true,
  DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",
  DEPT_API:
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php",
  DEPT_FALLBACK_NAMES: { 6: "Presidencia" },

  // Detecta el “scheme” según HTML presente
  SCHEMES: [
    {
      key: "hs",
      root: ".hs-sidebar",
      profileWrap: ".hs-profile",
      avatar: "#hs-avatar",
      name: "#hs-profile-name",
      badge: "#hs-profile-badge",
      openers: [".edit-profile", '[data-open="#modal-perfil"]'],
      avatarEditBtn: ".avatar-edit",
    },
    {
      key: "homeLegacy",
      root: ".home-sidebar",
      profileWrap: ".home-sidebar .profile-card",
      avatar: ".home-sidebar .profile-card img.avatar",
      name: "#h-user-nombre",
      badge: ".home-sidebar .profile-card .profile-dep",
      openers: [
        ".home-sidebar .profile-card .profile-link",
        '[data-open="#modal-perfil"]',
      ],
      avatarEditBtn: null, // en home legacy no hay botón lápiz por defecto
    },
  ],

  MODAL: {
    id: "modal-perfil",
    form: "#form-perfil",
    close: ".modal-close",
    content: ".modal-content",

    // Inputs (según tu HTML) :contentReference[oaicite:1]{index=1}
    inp: {
      nombre: "#perfil-nombre",
      apellidos: "#perfil-apellidos",
      email: "#perfil-email",
      tel: "#perfil-telefono",
      pass: "#perfil-password",
      pass2: "#perfil-password2",
      depto: "#perfil-departamento",
      reporta: "#perfil-reporta",
      status: "#perfil-status",
    },
  },

  AVATAR_EDITOR: {
    overlay: "#eda-overlay",
    close: "#eda-close",
    cancel: "#eda-cancel",
    save: "#eda-save",
    choose: "#eda-choose",
    drop: "#eda-drop",
    file: "#eda-file",
    previewImg: "#eda-preview-img",
    recentsGrid: "#eda-recents-grid",
    maxBytes: 1_000_000,
    allowed: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/heic",
      "image/heif",
    ],
    recentsKey: "ix_avatar_recents_v1",
    recentsMax: 8,
  },

  // Extras opcionales (si hay filtros en ese sidebar)
  FILTERS: {
    group: "#hs-states",
    items: "#hs-states .item",
    legend: "#hs-legend-status",
    search: "#hs-search",
  },
};

/* ========================================================================== */
/* Helpers                                                                     */
/* ========================================================================== */
const log = (...a) => CFG.DEBUG && console.log("[Sidebar]", ...a);
const warn = (...a) => CFG.DEBUG && console.warn("[Sidebar]", ...a);
const err = (...a) => CFG.DEBUG && console.error("[Sidebar]", ...a);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const toast = (m, t = "info") =>
  window.gcToast ? gcToast(m, t) : log("[toast]", t, m);

function setText(selOrEl, txt) {
  const el = typeof selOrEl === "string" ? $(selOrEl) : selOrEl;
  if (el) el.textContent = String(txt ?? "");
}

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
  } catch {}
}

function getSession() {
  return window.Session?.get?.() || readCookiePayload() || null;
}

function setSession(next) {
  try {
    window.Session?.set?.(next);
  } catch {}
  writeCookiePayload(next);
}

function detectScheme() {
  for (const s of CFG.SCHEMES) {
    if ($(s.root) && $(s.profileWrap) && $(s.avatar)) return s;
  }
  return null;
}

function setAvatarImage(
  imgEl,
  sessionLike,
  defaultAvatar = CFG.DEFAULT_AVATAR
) {
  if (!imgEl) return;

  // Si ya existe helper global, úsalo (tú ya lo manejas en tu proyecto)
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

/* ========================================================================== */
/* Dept name cache                                                             */
/* ========================================================================== */
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
  } catch {
    return `Depto ${deptId}`;
  }
}

/* ========================================================================== */
/* Perfil: hidratar sidebar                                                    */
/* ========================================================================== */
async function refreshProfile(sess = null) {
  const s = sess || getSession();
  if (!s) return;

  const scheme = detectScheme();
  if (!scheme) return;

  const fullName =
    [s.nombre, s.apellidos].filter(Boolean).join(" ").trim() || "—";
  setText(scheme.name, fullName);

  const deptId = s?.departamento_id ?? s?.dept_id ?? null;
  setText(scheme.badge, await resolveDeptName(deptId));

  const avatarEl = $(scheme.avatar);
  setAvatarImage(avatarEl, {
    id_usuario: s.id_usuario ?? s.usuario_id ?? s.id_empleado ?? s.empleado_id,
    avatarUrl: s.avatarUrl || s.avatar,
    nombre: s.nombre,
    apellidos: s.apellidos,
  });

  log("Perfil OK", { scheme: scheme.key, fullName, deptId });
}

/* ========================================================================== */
/* Modal perfil: open/close + prefill + submit                                 */
/* ========================================================================== */
function wireProfileModal() {
  const modal = document.getElementById(CFG.MODAL.id);
  if (!modal) return;

  const form = $(CFG.MODAL.form, modal);
  const closeBtn = $(CFG.MODAL.close, modal);
  const content = $(CFG.MODAL.content, modal);

  const I = CFG.MODAL.inp;
  const inpNombre = $(I.nombre, modal);
  const inpApellidos = $(I.apellidos, modal);
  const inpEmail = $(I.email, modal);
  const inpTel = $(I.tel, modal);
  const inpPass = $(I.pass, modal);
  const inpPass2 = $(I.pass2, modal);
  const inpDepto = $(I.depto, modal);
  const inpReporta = $(I.reporta, modal);
  const inpStatus = $(I.status, modal);

  let empleadoActual = null;

  const open = async () => {
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    const sess = getSession();
    const empId = sess?.empleado_id ?? null;
    if (!empId) {
      warn("[Perfil] sin empleado_id en sesión");
      return;
    }

    try {
      empleadoActual = await getEmpleadoById(empId);

      if (inpNombre) inpNombre.value = empleadoActual?.nombre || "";
      if (inpApellidos) inpApellidos.value = empleadoActual?.apellidos || "";
      if (inpEmail)
        inpEmail.value = (empleadoActual?.email || "").toLowerCase();
      if (inpTel) inpTel.value = empleadoActual?.telefono || "";

      // IMPORTANTÍSIMO: no precargar password (solo se cambia si escribe)
      if (inpPass) inpPass.value = "";
      if (inpPass2) inpPass2.value = "";

      const deptId = empleadoActual?.departamento_id ?? sess?.dept_id ?? null;
      if (inpDepto) inpDepto.value = await resolveDeptName(deptId);

      // Reporta a: en tu API viene en "cuenta.reporta_a" :contentReference[oaicite:2]{index=2}
      if (inpReporta) {
        const rep =
          empleadoActual?.cuenta?.reporta_a ??
          empleadoActual?.reporta_a ??
          null;
        inpReporta.value = rep ? `Empleado #${rep}` : "—";
      }

      if (inpStatus) {
        const st = Number(empleadoActual?.status);
        inpStatus.value = st === 1 ? "Activo" : "Inactivo";
      }
    } catch (e) {
      err("[Perfil] prefill error:", e);
      toast("No se pudo cargar tu perfil.", "error");
    }
  };

  const close = () => {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  };

  // Wire openers según scheme + fallback genérico
  const scheme = detectScheme();
  const openerSelectors = Array.from(
    new Set([
      ...(scheme?.openers || []),
      ".edit-profile",
      `[data-open="#${CFG.MODAL.id}"]`,
    ])
  );
  openerSelectors.forEach((sel) => {
    $$(sel).forEach((el) =>
      el.addEventListener("click", (e) => {
        e.preventDefault();
        open();
      })
    );
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

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const sess = getSession() || {};
    const empId = Number(sess?.empleado_id || 0);
    if (!empId) return;

    const pass = (inpPass?.value || "").trim();
    const pass2 = (inpPass2?.value || "").trim();

    // Si intentó cambiar password, validar
    if (pass || pass2) {
      if (pass.length < 6) {
        toast("La contraseña debe tener al menos 6 caracteres.", "warning");
        return;
      }
      if (pass !== pass2) {
        toast("Las contraseñas no coinciden.", "warning");
        return;
      }
    }

    const payload = {
      // TU API exige patch.id, NO empleado_id
      id: empId,
      nombre: (inpNombre?.value || "").trim(),
      apellidos: (inpApellidos?.value || "").trim(),
      email: (inpEmail?.value || "").trim(),
      telefono: (inpTel?.value || "").trim(),
      ...(pass ? { password: pass } : {}),
      updated_by: Number(sess?.empleado_id || 0) || null,
    };

    log("[Perfil] updateEmpleado payload:", payload);

    try {
      await updateEmpleado(payload);

      // Actualizar “sesión” local (sin password)
      const next = {
        ...sess,
        empleado_id: empId,
        nombre: payload.nombre || sess.nombre,
        apellidos: payload.apellidos || sess.apellidos,
        email: payload.email || sess.email,
        telefono: payload.telefono || sess.telefono,
      };

      setSession(next);
      window.gcRefreshHeader?.(next);

      await refreshProfile(next);

      toast("Perfil actualizado.", "success");
      close();
    } catch (e2) {
      err("[Perfil] update error:", e2);
      toast("Error al actualizar perfil.", "error");
    }
  });
}

/* ========================================================================== */
/* Editor Avatar (UI)                                                          */
/* NOTA: aquí SOLO wiring UI. El upload real lo conectas donde dice TODO.      */
/* ========================================================================== */
function wireAvatarEditor() {
  const overlay = $(CFG.AVATAR_EDITOR.overlay);
  if (!overlay) return;

  const closeBtn = $(CFG.AVATAR_EDITOR.close);
  const cancelBtn = $(CFG.AVATAR_EDITOR.cancel);
  const saveBtn = $(CFG.AVATAR_EDITOR.save);
  const chooseBtn = $(CFG.AVATAR_EDITOR.choose);
  const drop = $(CFG.AVATAR_EDITOR.drop);
  const fileInput = $(CFG.AVATAR_EDITOR.file);
  const previewImg = $(CFG.AVATAR_EDITOR.previewImg);
  const recentsGrid = $(CFG.AVATAR_EDITOR.recentsGrid);

  let currentFile = null;

  const readRecents = () => {
    try {
      return JSON.parse(
        localStorage.getItem(CFG.AVATAR_EDITOR.recentsKey) || "[]"
      );
    } catch {
      return [];
    }
  };

  const writeRecents = (arr) => {
    try {
      localStorage.setItem(CFG.AVATAR_EDITOR.recentsKey, JSON.stringify(arr));
    } catch {}
  };

  const paintRecents = () => {
    if (!recentsGrid) return;
    const recents = readRecents();
    recentsGrid.innerHTML = "";

    if (!recents.length) {
      recentsGrid.innerHTML = `<div class="eda-empty">Sin recientes</div>`;
      return;
    }

    recents.forEach((src) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "eda-recent";
      btn.innerHTML = `<img alt="Reciente" src="${src}">`;
      btn.addEventListener("click", () => {
        if (previewImg) previewImg.src = src;
        if (saveBtn) saveBtn.disabled = false;
        currentFile = null; // usando imagen previa (base64) por ahora
      });
      recentsGrid.appendChild(btn);
    });
  };

  const open = () => {
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    paintRecents();
  };

  const close = () => {
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    currentFile = null;
    if (saveBtn) saveBtn.disabled = true;
    if (previewImg) previewImg.removeAttribute("src");
  };

  // Abrir desde botón lápiz (solo en scheme hs)
  const scheme = detectScheme();
  if (scheme?.avatarEditBtn) {
    $$(scheme.avatarEditBtn).forEach((b) =>
      b.addEventListener("click", (e) => {
        e.preventDefault();
        open();
      })
    );
  }

  closeBtn?.addEventListener("click", close);
  cancelBtn?.addEventListener("click", close);
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("active")) close();
  });

  const validateFile = (f) => {
    if (!f) return "Archivo inválido.";
    if (!CFG.AVATAR_EDITOR.allowed.includes(f.type))
      return "Formato no permitido.";
    if (f.size > CFG.AVATAR_EDITOR.maxBytes) return "El archivo excede 1MB.";
    return null;
  };

  const setFile = async (f) => {
    const msg = validateFile(f);
    if (msg) {
      toast(msg, "warning");
      return;
    }

    currentFile = f;

    const reader = new FileReader();
    reader.onload = () => {
      if (previewImg) previewImg.src = String(reader.result || "");
      if (saveBtn) saveBtn.disabled = false;

      // Guardar en recientes (base64)
      const src = String(reader.result || "");
      if (src.startsWith("data:")) {
        const recents = readRecents();
        const next = [src, ...recents.filter((x) => x !== src)].slice(
          0,
          CFG.AVATAR_EDITOR.recentsMax
        );
        writeRecents(next);
        paintRecents();
      }
    };
    reader.readAsDataURL(f);
  };

  chooseBtn?.addEventListener("click", () => fileInput?.click());
  fileInput?.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    if (f) setFile(f);
    fileInput.value = "";
  });

  // Drag & drop
  if (drop) {
    drop.addEventListener("dragover", (e) => {
      e.preventDefault();
      drop.classList.add("is-drag");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("is-drag"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      drop.classList.remove("is-drag");
      const f = e.dataTransfer?.files?.[0];
      if (f) setFile(f);
    });
  }

  // Paste Ctrl+V
  window.addEventListener("paste", (e) => {
    if (!overlay.classList.contains("active")) return;
    const item = Array.from(e.clipboardData?.items || []).find(
      (it) => it.kind === "file"
    );
    const f = item?.getAsFile?.();
    if (f) setFile(f);
  });

  // Guardar (aquí se conecta tu upload real)
  saveBtn?.addEventListener("click", async () => {
    if (saveBtn.disabled) return;

    const sess = getSession() || {};
    const id_usuario = sess?.id_usuario ?? null;

    // TODO: aquí debes llamar tu endpoint real para subir avatar y obtener URL/ruta final.
    //  - Si tu backend guarda la imagen con nombre por id_usuario, luego solo refrescamos el avatar:
    //    setSession({ ...sess, avatarUrl: null }) y refreshProfile()
    //  - Si retorna una URL: setSession({ ...sess, avatarUrl: url })

    toast("Avatar guardado (hook listo). Falta conectar upload real.", "info");

    // Refrescar avatar en sidebar
    await refreshProfile();
    close();
  });
}

/* ========================================================================== */
/* Filtros opcionales: solo expone hook (no impone lógica)                     */
/* ========================================================================== */
const FilterState = { onChange: null, timer: null };

function initOptionalFilters() {
  const group = $(CFG.FILTERS.group);
  if (!group) return;

  const items = $$(CFG.FILTERS.items, group);
  group.addEventListener("click", (e) => {
    const btn = e.target.closest(".item");
    if (!btn) return;
    const key = btn.dataset.status || "todos";
    FilterState.onChange?.({ type: "filter", value: key });
  });

  const input = $(CFG.FILTERS.search);
  if (input) {
    input.addEventListener("input", (e) => {
      clearTimeout(FilterState.timer);
      const val = (e.target.value || "").trim();
      FilterState.timer = setTimeout(() => {
        FilterState.onChange?.({ type: "search", value: val });
      }, 250);
    });
  }
}

/* ========================================================================== */
/* API pública                                                                 */
/* ========================================================================== */
const API = {
  async refreshProfile(sess) {
    await refreshProfile(sess);
  },
  resolveDeptName,
  onChange(fn) {
    FilterState.onChange = typeof fn === "function" ? fn : null;
  },
  openProfileModal() {
    document.querySelector(`[data-open="#${CFG.MODAL.id}"]`)?.click?.();
  },
};

/* ========================================================================== */
/* Boot                                                                        */
/* ========================================================================== */
async function boot() {
  await refreshProfile();
  wireProfileModal();
  wireAvatarEditor();
  initOptionalFilters();

  window.IxSidebar = API;
  log("boot OK");
}

window.addEventListener("DOMContentLoaded", boot);

export default API;
export { API as IxSidebar };

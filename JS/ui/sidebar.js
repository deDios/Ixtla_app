// /JS/ui/sidebar.js
"use strict";

/* ==========================================================================
   Imports
   ========================================================================== */
import { getEmpleadoById, updateEmpleado } from "/JS/api/usuarios.js";

/* ==========================================================================
   Config
   ========================================================================== */
const CFG = {
  DEBUG: true,
  DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",
  DEPT_API:
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php",
  DEPT_FALLBACK_NAMES: { 6: "Presidencia" },

  // Detecta el layout del sidebar
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
      avatarEditBtn: null,
    },
  ],

  MODAL: {
    id: "modal-perfil",
    form: "#form-perfil",
    close: ".modal-close",
    content: ".modal-content",
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
    maxBytes: 1_000_000, // 1MB
    recentsKey: "ix_avatar_recents_v1",
    recentsMax: 8,
  },

  FILTERS: {
    group: "#hs-states",
    items: "#hs-states .item",
    search: "#hs-search",
  },
};

/* ==========================================================================
   Helpers
   ========================================================================== */
const log = (...a) => CFG.DEBUG && console.log("[Sidebar]", ...a);
const warn = (...a) => CFG.DEBUG && console.warn("[Sidebar]", ...a);
const err = (...a) => CFG.DEBUG && console.error("[Sidebar]", ...a);
const toast = (m, t = "info") =>
  window.gcToast ? gcToast(m, t) : log("[toast]", t, m);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

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

/* ==========================================================================
   Dept name cache
   ========================================================================== */
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

/* ==========================================================================
   Perfil: hidratar sidebar
   ========================================================================== */
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

/* ==========================================================================
   Modal perfil: open/close + prefill + submit
   ========================================================================== */
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
      const empleado = await getEmpleadoById(empId);

      if (inpNombre) inpNombre.value = empleado?.nombre || "";
      if (inpApellidos) inpApellidos.value = empleado?.apellidos || "";
      if (inpEmail) inpEmail.value = (empleado?.email || "").toLowerCase();
      if (inpTel) inpTel.value = empleado?.telefono || "";

      // IMPORTANTÍSIMO: no precargar password
      if (inpPass) inpPass.value = "";
      if (inpPass2) inpPass2.value = "";

      const deptId = empleado?.departamento_id ?? sess?.dept_id ?? null;
      if (inpDepto) inpDepto.value = await resolveDeptName(deptId);

      if (inpReporta) {
        const rep = empleado?.cuenta?.reporta_a ?? empleado?.reporta_a ?? null;
        inpReporta.value = rep ? `Empleado #${rep}` : "—";
      }

      if (inpStatus) {
        const st = Number(empleado?.status);
        inpStatus.value = st === 1 ? "Activo" : "Inactivo";
      }

      log("[Perfil] prefill OK", { empId });
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

  // Openers por scheme + fallback
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
      // tu API exige patch.id
      id: empId,
      nombre: (inpNombre?.value || "").trim(),
      apellidos: (inpApellidos?.value || "").trim(),
      email: (inpEmail?.value || "").trim(),
      telefono: (inpTel?.value || "").trim(),
      ...(pass ? { password: pass } : {}),
      updated_by: Number(sess?.empleado_id || 0) || null,
    };

    log("[Perfil] updateEmpleado payload:", {
      ...payload,
      password: payload.password ? "(set)" : "(not sent)",
    });

    try {
      await updateEmpleado(payload);

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

/* ==========================================================================
   Avatar: aceptar formatos raros + recomprimir > 1MB
   ========================================================================== */
const AV = {
  TAG: "[Avatar]",
  MAX_BYTES: CFG.AVATAR_EDITOR.maxBytes,
  MAX_W: 1024,
  MAX_H: 1024,
  TARGET_MIME: "image/jpeg",
  QUALITY_START: 0.88,
  QUALITY_MIN: 0.45,
  QUALITY_STEP: 0.07,
};

const avLog = (...a) => console.log(AV.TAG, ...a);
const avWarn = (...a) => console.warn(AV.TAG, ...a);
const avErr = (...a) => console.error(AV.TAG, ...a);
const bytesToKB = (b) => Math.round((b / 1024) * 10) / 10;
const ext = (name = "") => (name.split(".").pop() || "").toLowerCase();

function isProbablyImage(file) {
  const e = ext(file?.name || "");
  const byType = !!file?.type && file.type.startsWith("image/");
  const byExt = [
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif",
    "bmp",
    "tif",
    "tiff",
    "jfif",
    "heic",
    "heif",
    "avif",
  ].includes(e);
  return byType || byExt;
}

async function decodeToBitmap(file) {
  try {
    if ("createImageBitmap" in window) {
      const bmp = await createImageBitmap(file);
      avLog("decode OK via createImageBitmap", {
        w: bmp.width,
        h: bmp.height,
        type: file.type,
        name: file.name,
      });
      return bmp;
    }
  } catch (e) {
    avWarn("createImageBitmap failed", e);
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = (er) => reject(er);
      im.src = url;
    });
    avLog("decode OK via Image()", {
      w: img.naturalWidth,
      h: img.naturalHeight,
      type: file.type,
      name: file.name,
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function fitSize(w, h, maxW, maxH) {
  const r = Math.min(1, maxW / w, maxH / h);
  return {
    w: Math.max(1, Math.round(w * r)),
    h: Math.max(1, Math.round(h * r)),
    r,
  };
}

async function canvasToBlob(canvas, mime, quality) {
  return await new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

async function ensureUnder1MB(file, opts = {}) {
  const maxBytes = opts.maxBytes ?? AV.MAX_BYTES;

  avLog("incoming file", {
    name: file?.name,
    type: file?.type || "(empty)",
    sizeKB: bytesToKB(file?.size || 0),
  });

  if (!file || !isProbablyImage(file)) throw new Error("NOT_IMAGE");

  // Si ya está bajo 1MB, igual confirmamos decode para evitar “formatos fantasmas”
  if (file.size <= maxBytes) {
    try {
      await decodeToBitmap(file);
      avLog("file already under limit, keep as-is");
      return {
        blob: file,
        mime: file.type || "application/octet-stream",
        note: "as-is",
      };
    } catch (e) {
      avErr("decode failed even though size ok", e);
      throw new Error("DECODE_FAIL");
    }
  }

  let bmp;
  try {
    bmp = await decodeToBitmap(file);
  } catch (e) {
    avErr(
      "decode failed (likely unsupported format like HEIC on this browser)",
      e
    );
    throw new Error("DECODE_FAIL");
  }

  const srcW = bmp.width || bmp.naturalWidth;
  const srcH = bmp.height || bmp.naturalHeight;

  let { w, h } = fitSize(srcW, srcH, AV.MAX_W, AV.MAX_H);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(bmp, 0, 0, w, h);

  let q = AV.QUALITY_START;
  let blob = await canvasToBlob(canvas, AV.TARGET_MIME, q);

  avLog("compress start", {
    target: AV.TARGET_MIME,
    w,
    h,
    q,
    sizeKB: bytesToKB(blob?.size || 0),
  });

  while (blob && blob.size > maxBytes && q > AV.QUALITY_MIN) {
    q = Math.max(AV.QUALITY_MIN, q - AV.QUALITY_STEP);
    blob = await canvasToBlob(canvas, AV.TARGET_MIME, q);
    avLog("compress step", { q, sizeKB: bytesToKB(blob?.size || 0) });
  }

  let tries = 0;
  while (blob && blob.size > maxBytes && tries < 3) {
    tries++;
    w = Math.max(320, Math.round(w * 0.85));
    h = Math.max(320, Math.round(h * 0.85));
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(bmp, 0, 0, w, h);

    q = Math.min(q, 0.75);
    blob = await canvasToBlob(canvas, AV.TARGET_MIME, q);
    avLog("resize+compress", {
      tries,
      w,
      h,
      q,
      sizeKB: bytesToKB(blob?.size || 0),
    });
  }

  if (!blob) throw new Error("BLOB_FAIL");

  if (blob.size > maxBytes) {
    avWarn("could not compress under limit", { finalKB: bytesToKB(blob.size) });
  } else {
    avLog("final under limit", { finalKB: bytesToKB(blob.size), q, w, h });
  }

  return { blob, mime: AV.TARGET_MIME, note: "recompressed" };
}

/* ==========================================================================
   Editor Avatar (UI + procesamiento)
   ========================================================================== */
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
  let picking = false;

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
        currentFile = null;
        avLog("selected recent image (base64)", { len: src.length });
      });
      recentsGrid.appendChild(btn);
    });
  };

  const open = () => {
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    paintRecents();
    avLog("editor open");
  };

  const close = () => {
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    currentFile = null;
    if (saveBtn) saveBtn.disabled = true;
    if (previewImg) previewImg.removeAttribute("src");
    avLog("editor close");
  };

  // Abrir desde botón lápiz (hs)
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

  // Lock para evitar click doble (si reabre, no pasa nada, pero evita loops raros)
  chooseBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!fileInput) return;
    if (picking) return;
    picking = true;
    avLog("open file picker");
    fileInput.click();
  });

  window.addEventListener("focus", () => {
    setTimeout(() => (picking = false), 250);
  });

  async function setFile(f) {
    try {
      const { blob, mime, note } = await ensureUnder1MB(f, {
        maxBytes: CFG.AVATAR_EDITOR.maxBytes,
      });

      // Preview
      const url = URL.createObjectURL(blob);
      if (previewImg) previewImg.src = url;

      // Guardar file listo para upload
      currentFile = new File([blob], "avatar.jpg", { type: mime });

      if (saveBtn) saveBtn.disabled = false;

      avLog("ready for upload", {
        note,
        inName: f.name,
        inType: f.type || "(empty)",
        inKB: bytesToKB(f.size),
        outName: currentFile.name,
        outType: currentFile.type,
        outKB: bytesToKB(currentFile.size),
      });

      // Guardar en recientes como base64 (si previewImg está listo)
      try {
        // si el archivo ya venía como dataURL por recientes no aplica aquí
        // guardamos el preview actual como dataURL solo si es posible (opcional)
      } catch {}
    } catch (e) {
      avErr("setFile failed", e);

      if (String(e.message) === "DECODE_FAIL") {
        toast(
          "Ese formato no se puede leer en este navegador. Convierte a JPG/PNG y vuelve a intentar.",
          "warning"
        );
      } else if (String(e.message) === "NOT_IMAGE") {
        toast("Ese archivo no parece ser una imagen.", "warning");
      } else {
        toast("No se pudo procesar la imagen.", "error");
      }
    }
  }

  fileInput?.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    avLog("file selected", {
      name: f.name,
      type: f.type || "(empty)",
      sizeKB: bytesToKB(f.size),
    });
    setFile(f);
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

  // Paste
  window.addEventListener("paste", (e) => {
    if (!overlay.classList.contains("active")) return;
    const item = Array.from(e.clipboardData?.items || []).find(
      (it) => it.kind === "file"
    );
    const f = item?.getAsFile?.();
    if (f) setFile(f);
  });

  // Recientes: guardamos dataURL cuando podamos (si vienes de archivo)
  function pushRecentDataUrl(dataUrl) {
    if (!dataUrl || !dataUrl.startsWith("data:")) return;
    const recents = readRecents();
    const next = [dataUrl, ...recents.filter((x) => x !== dataUrl)].slice(
      0,
      CFG.AVATAR_EDITOR.recentsMax
    );
    writeRecents(next);
    paintRecents();
  }

  // Hook: si quieres guardar recientes con dataURL al seleccionar archivo
  // (lo hacemos cuando se puede convertir currentFile a dataURL rápido)
  async function tryStoreCurrentAsRecent() {
    try {
      if (!currentFile) return;
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(currentFile);
      });
      pushRecentDataUrl(dataUrl);
      avLog("saved recent from processed file", { len: dataUrl.length });
    } catch (e) {
      avWarn("could not save recent", e);
    }
  }

  // Guardar (aquí conectas tu endpoint real)
  saveBtn?.addEventListener("click", async () => {
    if (saveBtn.disabled) return;

    const sess = getSession() || {};
    avLog("save avatar clicked", {
      empleado_id: sess?.empleado_id,
      id_usuario: sess?.id_usuario,
    });

    // ✅ Opcional: guardar en recientes como dataURL del archivo procesado
    await tryStoreCurrentAsRecent();

    // TODO: Conectar upload real:
    // - Enviar currentFile (multipart/form-data) al endpoint.
    // - Si tu backend guarda como img_{id_usuario}.png/jpg:
    //    solo haces refreshProfile() y listo.
    // - Si devuelve URL:
    //    setSession({ ...sess, avatarUrl: url }); refreshProfile()

    toast(
      "Avatar listo (procesado). Falta conectar endpoint de upload.",
      "info"
    );

    await refreshProfile();
    close();
  });
}

/* ==========================================================================
   Filtros opcionales (no impone lógica)
   ========================================================================== */
const FilterState = { onChange: null, timer: null };

function initOptionalFilters() {
  const group = $(CFG.FILTERS.group);
  if (!group) return;

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

/* ==========================================================================
   API pública
   ========================================================================== */
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

/* ==========================================================================
   Boot
   ========================================================================== */
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

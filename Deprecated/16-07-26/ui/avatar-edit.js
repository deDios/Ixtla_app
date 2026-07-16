// /JS/ui/avatar-edit.js
"use strict";

/* ====================== Config ====================== */
const DEFAULT_ENDPOINT = "/db/WEB/ixtla01_u_usuario_avatar.php";
const MAX_BYTES = 1 * 1024 * 1024;

// MIMEs “ideales”
const VALID_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
];

// Extensiones permitidas (fallback cuando file.type viene vacío o raro)
const VALID_EXTS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "jfif",
  "avif",
];

// Debug
const DEBUG = true;
const TAG = "[AvatarEdit]";
const log = (...a) => DEBUG && console.log(TAG, ...a);
const warn = (...a) => DEBUG && console.warn(TAG, ...a);
const err = (...a) => DEBUG && console.error(TAG, ...a);

const toast = (m, t = "info") =>
  window.gcToast ? gcToast(m, t) : console.log(`[avatar] ${t}: ${m}`);

/* ====================== Session / Utils ====================== */
function getSession() {
  try {
    if (window.Session?.get) return window.Session.get();
  } catch {}
  try {
    const name = "ix_emp=";
    const pair = document.cookie.split("; ").find((c) => c.startsWith(name));
    if (!pair) return null;
    const raw = decodeURIComponent(pair.slice(name.length));
    return JSON.parse(decodeURIComponent(escape(atob(raw))));
  } catch {}
  return null;
}

const cacheBust = (u) =>
  String(u).split("?")[0] +
  (String(u).includes("?") ? "&" : "?") +
  "t=" +
  Date.now();

/** Refresca avatar en sidebar/header móvil/desktop */
function refreshAvatarEverywhere(url) {
  const bust = cacheBust(url);
  const img = document.getElementById("hs-avatar");
  if (img) img.src = bust;
  document
    .querySelectorAll(".actions .img-perfil, .user-icon-mobile img")
    .forEach((el) => {
      try {
        el.src = bust;
      } catch {}
    });
}

/* ====================== Validación (MIME + extensión) ====================== */
function getExt(name = "") {
  const m = String(name)
    .trim()
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

function isAllowedByMimeOrExt(file) {
  const mime = (file?.type || "").toLowerCase().trim();
  const ext = getExt(file?.name || "");
  const okMime = !!mime && VALID_TYPES.includes(mime);
  const okExt = !!ext && VALID_EXTS.includes(ext);
  return { ok: okMime || okExt, mime, ext, okMime, okExt };
}

function canAccept(file) {
  if (!file) return { ok: false, msg: "No se recibió archivo." };

  const v = isAllowedByMimeOrExt(file);
  log("canAccept()", {
    name: file.name,
    size: file.size,
    type: file.type,
    ext: v.ext,
    okMime: v.okMime,
    okExt: v.okExt,
  });

  if (!v.ok)
    return {
      ok: false,
      msg: "Formato no permitido. Usa JPG/PNG/WEBP/HEIC/HEIF/AVIF.",
    };

  return { ok: true };
}

/* ====================== Compresión cliente (DEBE quedar <= 1MB) ====================== */
/**
 * REGLA:
 * - Si pesa >1MB, intentamos comprimir en cliente.
 * - Si NO podemos decodificar (HEIC/HEIF en muchos browsers), NO subimos -> error claro.
 */
async function compressToUnder1MB_orThrow(file) {
  if (!file) throw new Error("Sin archivo.");
  if (file.size <= MAX_BYTES) return file;

  const v = isAllowedByMimeOrExt(file);
  const mime = v.mime;
  const ext = v.ext;

  // HEIC/HEIF suelen NO decodificar en canvas sin librerías.
  if (
    mime.includes("heic") ||
    mime.includes("heif") ||
    ext === "heic" ||
    ext === "heif"
  ) {
    // No intentamos: si pesa >1MB lo rechazamos (porque el server también lo rechazará)
    throw new Error(
      "Tu imagen HEIC/HEIF pesa más de 1MB. Convierte a JPG/PNG o elige una versión más ligera (<1MB)."
    );
  }

  // Intentar decodificar
  let bmp;
  try {
    bmp = await createImageBitmap(file);
  } catch (e) {
    // Si no se puede decodificar, no podemos garantizar bajar de peso
    throw new Error(
      "No pude leer esa imagen para optimizarla. Prueba con JPG/PNG o una imagen más ligera (<1MB)."
    );
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: true });

  // Tamaño base
  let w = bmp.width;
  let h = bmp.height;

  // Empezar con caja 1200
  const maxBox = 1200;
  const factor0 = Math.min(1, maxBox / Math.max(w, h));
  w = Math.max(1, Math.round(w * factor0));
  h = Math.max(1, Math.round(h * factor0));

  // Probamos formatos: webp, luego jpeg
  const formats = [
    { mime: "image/webp", ext: "webp" },
    { mime: "image/jpeg", ext: "jpg" },
  ];

  for (const fmt of formats) {
    let scale = 1;

    for (let pass = 0; pass < 12; pass++) {
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));

      canvas.width = cw;
      canvas.height = ch;

      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(bmp, 0, 0, cw, ch);

      const quality = Math.max(0.4, 0.92 - pass * 0.06);
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, fmt.mime, quality)
      );

      if (!blob) {
        warn("toBlob devolvió null", { fmt: fmt.mime, quality, cw, ch });
        scale *= 0.88;
        continue;
      }

      log("compress pass", {
        fmt: fmt.mime,
        quality: Number(quality.toFixed(2)),
        cw,
        ch,
        bytes: blob.size,
      });

      if (blob.size <= MAX_BYTES) {
        const outNameBase = (file.name || "avatar").replace(/\.[^/.]+$/, "");
        const outName = `${outNameBase}.${fmt.ext}`;
        const out = new File([blob], outName, {
          type: fmt.mime,
          lastModified: Date.now(),
        });

        log("compress OK", {
          from: file.size,
          to: out.size,
          type: out.type,
          name: out.name,
        });
        return out;
      }

      // Si sigue grande, baja escala
      scale *= 0.88;
      if (cw <= 320 || ch <= 320) break;
    }
  }

  // Si no logramos bajar a <=1MB, lo rechazamos para no pegarle al server.
  throw new Error(
    "No pude optimizar la imagen por debajo de 1MB. Prueba con otra imagen o recórtala antes de subir."
  );
}

/* ====================== Upload (con regla dura <=1MB) ====================== */
async function uploadAvatar(file, usuarioId, endpoint = DEFAULT_ENDPOINT) {
  if (!file) return;

  const v = isAllowedByMimeOrExt(file);
  if (!(v.okMime || v.okExt)) {
    toast("Formato no permitido. Usa JPG/PNG/WEBP/HEIC/HEIF/AVIF.", "warning");
    warn("Rechazado por formato:", {
      name: file.name,
      type: file.type,
      ext: v.ext,
    });
    return;
  }

  // Regla dura de peso
  let toSend = file;

  if (file.size > MAX_BYTES) {
    toast("La imagen supera 1MB. Optimizando…", "warning");
    try {
      toSend = await compressToUnder1MB_orThrow(file);
    } catch (e) {
      warn("Optimización bloqueó upload:", e);
      toast(
        e.message || "La imagen supera 1MB y no se pudo optimizar.",
        "warning"
      );
      return; // 👈 importante: NO subir si no cumple
    }
  }

  if (toSend.size > MAX_BYTES) {
    // Doble seguro
    toast(
      "La imagen sigue pesando más de 1MB. Elige otra o reduce tamaño.",
      "warning"
    );
    warn("Bloqueo final: sigue >1MB", {
      size: toSend.size,
      name: toSend.name,
      type: toSend.type,
    });
    return;
  }

  const fd = new FormData();
  fd.append("usuario_id", String(usuarioId));
  fd.append("avatar", toSend, toSend.name);

  log("POST avatar:", {
    endpoint,
    usuarioId,
    name: toSend.name,
    type: toSend.type,
    size: toSend.size,
    original: { name: file.name, type: file.type, size: file.size },
  });

  const res = await fetch(endpoint, { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.ok === false || data.error) {
    err("Upload error:", { status: res.status, data });
    toast(data.error || "No se pudo actualizar el avatar.", "error");
    return;
  }

  if (data.url) refreshAvatarEverywhere(data.url);
  toast("Imagen de perfil actualizada", "exito");
  return data;
}

/* ====================== Mini helpers para recientes (opcionales) ====================== */
const EDA_RECENTS_KEY = "eda:recientes:v1";
const recents = {
  load() {
    try {
      return JSON.parse(localStorage.getItem(EDA_RECENTS_KEY) || "[]");
    } catch {
      return [];
    }
  },
  save(arr) {
    try {
      localStorage.setItem(EDA_RECENTS_KEY, JSON.stringify(arr.slice(0, 8)));
    } catch {}
  },
  async remember(file) {
    try {
      // Solo guardamos preview si el navegador puede leerlo
      const du = await fileToDataUrlSafe(file);
      if (!du) return;
      const arr = recents.load();
      arr.unshift({ dataUrl: du, ts: Date.now() });
      recents.save(arr);
    } catch {}
  },
};

function fileToDataUrlSafe(file) {
  // Si es HEIC y el browser no lo decodifica, no guardamos reciente.
  const v = isAllowedByMimeOrExt(file);
  if (
    v.ext === "heic" ||
    v.ext === "heif" ||
    v.mime.includes("heic") ||
    v.mime.includes("heif")
  ) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onerror = () => resolve(null);
    fr.onload = () => resolve(String(fr.result || ""));
    fr.readAsDataURL(file);
  });
}

/* ====================== Modal EDA ====================== */
function ensureEditorDom() {
  let overlay = document.getElementById("eda-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.className = "eda-overlay";
  overlay.id = "eda-overlay";
  overlay.setAttribute("aria-hidden", "true");

  overlay.innerHTML = `
    <div class="eda-modal" role="dialog" aria-modal="true" aria-labelledby="eda-title">
      <div class="eda-header">
        <div class="eda-title" id="eda-title">Editar avatar</div>
        <div class="eda-actions">
          <button class="btn" id="eda-close" type="button">Cerrar</button>
        </div>
      </div>

      <div class="eda-body">
        <div class="eda-left">
          <div class="eda-drop" id="eda-drop">
            <div class="eda-drop-cta">
              <strong>Arrastra una imagen</strong> o
              <button class="btn btn-outline" id="eda-choose" type="button">Elegir archivo</button>
              <div class="eda-hint">JPG/PNG/WebP/HEIC/HEIF/AVIF · Máx 1MB</div>
            </div>
          </div>

          <div class="eda-preview">
            <div class="eda-preview-wrap">
              <img id="eda-preview-img" alt="Vista previa" />
              <div class="eda-mask" aria-hidden="true"></div>
            </div>
          </div>
        </div>

        <div class="eda-right">
          <div class="eda-recents">
            <div class="eda-recents-title">Recientes</div>
            <div class="eda-recents-grid" id="eda-recents-grid"><div class="eda-empty">Sin recientes</div></div>
          </div>
        </div>
      </div>

      <div class="eda-footer">
        <div class="eda-hint">Si tu imagen pesa más de 1MB, la optimizamos (si el navegador puede leerla).</div>
        <div class="eda-actions">
          <button class="btn" id="eda-cancel" type="button">Cancelar</button>
          <button class="btn blue" id="eda-save" type="button" disabled>Guardar</button>
        </div>
      </div>

      <input type="file" id="eda-file"
        accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif"
        hidden />
    </div>`;

  document.body.appendChild(overlay);
  return overlay;
}

function renderRecentsGrid(root) {
  const grid = root.querySelector("#eda-recents-grid");
  if (!grid) return;
  const arr = recents.load();
  grid.innerHTML = "";
  if (!arr.length) {
    grid.innerHTML = `<div class="eda-empty">Sin recientes</div>`;
    return;
  }

  arr.forEach((item, idx) => {
    const cell = document.createElement("button");
    cell.className = "eda-recent";
    cell.title = "Usar este";
    cell.innerHTML = `<img src="${item.dataUrl}" alt="Avatar reciente ${
      idx + 1
    }" />`;
    cell.dataset.dataUrl = item.dataUrl;
    grid.appendChild(cell);
  });
}

function openEditorDeAvatar({ usuarioId, endpoint }) {
  const overlay = ensureEditorDom();
  const fileInp = overlay.querySelector("#eda-file");
  const drop = overlay.querySelector("#eda-drop");
  const choose = overlay.querySelector("#eda-choose");
  const prevImg = overlay.querySelector("#eda-preview-img");
  const btnSave = overlay.querySelector("#eda-save");
  const btnCancel = overlay.querySelector("#eda-cancel");
  const btnClose = overlay.querySelector("#eda-close");

  let selectedFile = null;

  function close() {
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("eda-lock");
    btnSave.disabled = true;
    selectedFile = null;
    if (prevImg) prevImg.removeAttribute("src");
  }

  function setSelectedFile(file) {
    const v = canAccept(file);
    if (!v.ok) {
      toast(v.msg, "warning");
      return;
    }

    selectedFile = file;
    btnSave.disabled = false;

    // Preview: si es HEIC/HEIF puede fallar; no bloqueamos selección.
    try {
      prevImg.src = URL.createObjectURL(file);
    } catch {
      prevImg.removeAttribute("src");
    }

    log("Archivo seleccionado:", {
      name: file.name,
      size: file.size,
      type: file.type,
    });
  }

  // Abrir
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("eda-lock");
  renderRecentsGrid(overlay);

  choose.onclick = (e) => {
    e.preventDefault();
    log("Click elegir archivo → file picker");
    fileInp.click();
  };

  fileInp.onchange = () => {
    const f = fileInp.files && fileInp.files[0];
    log("fileInp.onchange", {
      hasFile: !!f,
      name: f?.name,
      size: f?.size,
      type: f?.type,
    });
    if (f) setSelectedFile(f);
    fileInp.value = "";
  };

  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("drag");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("drag"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("drag");
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    log("drop", { hasFile: !!f, name: f?.name, size: f?.size, type: f?.type });
    if (f) setSelectedFile(f);
  });

  btnCancel.onclick = close;
  btnClose.onclick = close;
  overlay.addEventListener("click", (e) => {
    if (e.target.id === "eda-overlay") close();
  });

  document.addEventListener(
    "keydown",
    (e) => {
      if (overlay.classList.contains("open") && e.key === "Escape") close();
    },
    { once: true }
  );

  btnSave.onclick = async () => {
    if (!selectedFile) return;

    btnSave.disabled = true;
    try {
      const r = await uploadAvatar(selectedFile, usuarioId, endpoint);
      if (r) await recents.remember(selectedFile);
      close();
    } catch (e) {
      err("Error guardando avatar:", e);
      btnSave.disabled = false;
    }
  };

  // Click en recientes (solo si es dataURL PNG/jpg normal)
  overlay.querySelector("#eda-recents-grid")?.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest && e.target.closest(".eda-recent");
    if (!btn) return;
    const du = btn.dataset.dataUrl;
    if (!du) return;

    // Convertimos a File PNG (siempre decodificable)
    const f = dataUrlToPngFile(du, "avatar.png");
    setSelectedFile(f);
  });
}

function dataUrlToPngFile(dataUrl, filename = "avatar.png") {
  const arr = dataUrl.split(",");
  const bstr = atob(arr[1] || "");
  const u8 = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
  return new File([u8], filename, {
    type: "image/png",
    lastModified: Date.now(),
  });
}

/* ====================== Botón lápiz ====================== */
function ensureButtonDom() {
  const img = document.getElementById("hs-avatar");
  if (!img) return null;

  let shell = img.closest(".avatar-shell");
  if (!shell) {
    shell = document.createElement("div");
    shell.className = "avatar-shell";
    img.parentNode.insertBefore(shell, img);
    shell.appendChild(img);
  }

  let circle = img.closest(".avatar-circle");
  if (!circle) {
    circle = document.createElement("div");
    circle.className = "avatar-circle";
    shell.insertBefore(circle, img);
    circle.appendChild(img);
  }

  let btn = shell.querySelector(".avatar-edit");
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-btn avatar-edit";
    btn.setAttribute("aria-label", "Cambiar foto de perfil");
    btn.title = "Cambiar foto";
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path fill="currentColor"
          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83z"></path>
      </svg>`;
    shell.appendChild(btn);
  }

  return { btn };
}

function init(endpoint = DEFAULT_ENDPOINT) {
  const sess = getSession();
  const usuarioId =
    sess?.id_usuario ??
    sess?.usuario_id ??
    sess?.empleado_id ??
    sess?.id_empleado ??
    null;

  const parts = ensureButtonDom();
  if (!parts) return;

  const { btn } = parts;

  if (!usuarioId) {
    btn.disabled = true;
    btn.title = "Inicia sesión para cambiar tu foto";
    warn("Sin usuarioId en sesión; avatar-edit deshabilitado.", sess);
    return;
  }

  btn.disabled = false;
  btn.title = "Cambiar foto";

  // SOLO abre modal (no file picker directo)
  btn.onclick = (e) => {
    e.preventDefault();
    log("Click lápiz → abrir modal EDA", { usuarioId, endpoint });
    openEditorDeAvatar({ usuarioId, endpoint });
  };
}

/* ====================== Auto-init ====================== */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => init());
} else {
  init();
}

window.gcInitAvatarEdit = init;

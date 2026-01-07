// /JS/UAT/api/media.js
const TAG = "[API:Media]";

/* ====== Config ====== */
const HOST =
  "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net";
const ENDPOINTS = {
  // DB\WEB\ixtla01_u_requerimiento_folders.php
  setup: `${HOST}/db/WEB/ixtla01_u_requerimiento_folders.php`, // crea /ASSETS/requerimientos/<folio>/{0..6}
  // db/WEB/ixtla01_c_requerimiento_img.php
  list: `${HOST}/db/WEB/ixtla01_c_requerimiento_img.php`, // lista evidencias (archivos + links) por folio/estatus
  // db/WEB/ixtla01_in(s)_requerimiento_img.php
  upload: `${HOST}/db/WEB/ixtla01_in_requerimiento_img.php`, // subida: multipart = archivos, JSON = links
};

const FETCH_TIMEOUT = 15000;
const MAX_MB = 1; // límite del servidor (1 MB por imagen)
const ACCEPT_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

/* ====== Helpers ====== */
function withTimeout(ms = FETCH_TIMEOUT) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(t) };
}

async function postJSON(url, body, { signal } = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      Accept: "application/json",
    },
    body: JSON.stringify(body || {}),
    signal,
  });
  // intenta parsear JSON incluso en HTTP no-OK para rescatar mensaje de error del backend
  let json = null;
  try {
    json = await res.json();
  } catch {}
  if (!res.ok || json?.ok === false) {
    const msg = json?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json || {};
}

function toArray(files) {
  if (!files) return [];
  return files instanceof FileList ? Array.from(files) : Array.from(files);
}

/* ====== API ====== */

/**
 * Crea (si no existen) las carpetas del folio: 0..6 y status.txt.
 */
export async function setupMedia(
  folio,
  { create_status_txt = true, force_status_txt = false } = {}
) {
  if (!/^REQ-\d{10}$/.test(String(folio || "")))
    throw new Error("Folio inválido");
  const { signal, done } = withTimeout();
  try {
    return await postJSON(
      ENDPOINTS.setup,
      { folio, create_status_txt, force_status_txt },
      { signal }
    );
  } finally {
    done();
  }
}

/**
 * Lista evidencias del folio.
 *
 * 🔹 Ahora el backend puede regresar:
 *   - kind: "file" → archivos físicos (imágenes, pdf, etc.)
 *   - kind: "link" → enlaces guardados en links.json (Drive, Mega, etc.)
 *
 * Devuelve el JSON del backend (esperado: { ok, data:[{name,url,kind,...}], ... }).
 */
export async function listMedia(
  folio,
  status = null,
  page = 1,
  per_page = 100
) {
  if (!/^REQ-\d{10}$/.test(String(folio || "")))
    throw new Error("Folio inválido");
  const payload = { folio, page, per_page };
  if (status !== null && status !== undefined) payload.status = Number(status);

  const { signal, done } = withTimeout();
  try {
    return await postJSON(ENDPOINTS.list, payload, { signal });
  } finally {
    done();
  }
}

/**
 * Sube imágenes al folio/estatus.
 *
 * 🔹 Usa multipart/form-data (modo "file" del endpoint PHP).
 * 🔹 Hace validación local (≤1MB y MIME permitido).
 * 🔹 Acepta FileList o Array<File>.
 * 🔹 Retorna el JSON del backend con un campo extra "skipped" para archivos descartados localmente.
 */
export async function uploadMedia({ folio, status = 0, files }) {
  if (!/^REQ-\d{10}$/.test(String(folio || "")))
    throw new Error("Folio inválido");
  const st = Number(status);
  if (!Number.isInteger(st) || st < 0 || st > 6)
    throw new Error("Status inválido (0..6)");

  const arr = toArray(files);
  if (!arr.length) throw new Error("Sin archivos a subir");

  // filtro local (evita 413 del servidor)
  const skipped = [];
  const send = [];
  for (const f of arr) {
    const tooBig = f.size > MAX_MB * 1024 * 1024;
    const badMime = !ACCEPT_MIME.includes(f.type);
    if (tooBig || badMime) {
      skipped.push({
        name: f.name,
        error: tooBig
          ? `Excede ${MAX_MB} MB`
          : `Tipo no permitido (${f.type || "desconocido"})`,
      });
    } else {
      send.push(f);
    }
  }
  if (!send.length)
    return { ok: false, folio, status: st, saved: [], failed: [], skipped };

  // multipart
  const fd = new FormData();
  fd.append("folio", folio);
  fd.append("status", String(st));
  send.forEach((f) => fd.append("files[]", f, f.name));

  const { signal, done } = withTimeout();
  try {
    const res = await fetch(ENDPOINTS.upload, {
      method: "POST",
      body: fd,
      signal,
    });
    let json = null;
    try {
      json = await res.json();
    } catch {}

    // arma respuesta consistente
    const saved = json?.saved || [];
    const failed = json?.failed || [];

    const ok = json?.ok === true || (saved.length > 0 && res.ok);
    if (!ok) {
      const msg = json?.error || `Error upload (HTTP ${res.status})`;
      console.warn(TAG, msg, { json });
    }

    return {
      ok,
      folio,
      status: st,
      saved,
      failed,
      skipped,
      httpStatus: res.status,
    };
  } finally {
    done();
  }
}

/**
 * Sube un LINK de evidencia (URL externa) al folio/estatus.
 *
 * 🔹 Usa application/json (modo "link" del endpoint PHP).
 * 🔹 No sube archivos, solo registra un enlace (Drive, Mega, etc.) en links.json.
 *
 * Parámetros:
 *   - folio:  string "REQ-0000000000"
 *   - status: int (0..6) → carpeta del requerimiento
 *   - url:    string URL válida (https://...)
 *   - label:  string (opcional) texto amigable para mostrar en la UI;
 *             si se omite, el backend usará la propia URL como label.
 *
 * Respuesta esperada del backend:
 *   {
 *     ok: true,
 *     folio: "REQ-0000000000",
 *     status: 2,
 *     type: "link",
 *     saved: [ { id, url, label, estatus, created_at } ],
 *     failed: []
 *   }
 */
export async function uploadMediaLink({ folio, status = 0, url, label = "" }) {
  if (!/^REQ-\d{10}$/.test(String(folio || ""))) {
    throw new Error("Folio inválido");
  }
  const st = Number(status);
  if (!Number.isInteger(st) || st < 0 || st > 6) {
    throw new Error("Status inválido (0..6)");
  }

  const cleanUrl = String(url || "").trim();
  if (!cleanUrl) {
    throw new Error("URL requerida");
  }

  // Ya no validamos el formato de la URL aquí.
  // El backend decidirá si la acepta o no.
  const payload = {
    folio,
    status: st,
    url: cleanUrl,
    label: String(label || "").trim(),
  };

  const { signal, done } = withTimeout();
  try {
    // El endpoint detecta Content-Type: application/json y guarda en links.json
    const json = await postJSON(ENDPOINTS.upload, payload, { signal });
    return json;
  } finally {
    done();
  }
}

export const Media = { setupMedia, listMedia, uploadMedia, uploadMediaLink };
export default Media;

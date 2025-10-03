// /JS/api/media.js

const TAG = "[API:Media]";

const FALLBACK = {
  MAX_MB: 1,
  ACCEPT_MIME: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ],
  ACCEPT_EXT: [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"],
  ENDPOINTS: {
    mediaList:
      "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/ixtla01_c_requerimiento_img.php",
    mediaUpload:
      "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/ixtla01_c_requerimiento_media.php",
  },
};

const CFG = (() => {
  const src = window.IX_CFG_REQ || {};
  const out = JSON.parse(JSON.stringify(FALLBACK));
  if (src.MAX_MB) out.MAX_MB = Number(src.MAX_MB) || FALLBACK.MAX_MB;
  if (Array.isArray(src.ACCEPT_MIME)) out.ACCEPT_MIME = src.ACCEPT_MIME.slice();
  if (Array.isArray(src.ACCEPT_EXT)) out.ACCEPT_EXT = src.ACCEPT_EXT.slice();
  if (src.ENDPOINTS) {
    out.ENDPOINTS = Object.assign({}, FALLBACK.ENDPOINTS, src.ENDPOINTS);
  }
  return out;
})();

/** = listMedia =
 * @param {string} folio 'REQ-0000000000'
 * @param {number} status 0..6
 * @param {number} page   default 1
 * @param {number} per_page default 50
 * @returns {Promise<{ok:boolean, count:number, data:Array, error?:string}>}
 */
export async function listMedia(folio, status = 0, page = 1, per_page = 50) {
  const url = CFG.ENDPOINTS.mediaList;
  const payload = { folio, status, page, per_page };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    const j = await resp.json().catch(() => ({}));
    if (!resp.ok || !j?.ok) {
      const err = j?.error || `HTTP ${resp.status}`;
      console.error(TAG, "listMedia error:", err);
      return { ok: false, count: 0, data: [], error: err };
    }
    const list = Array.isArray(j.data)
      ? j.data
      : Array.isArray(j.items)
      ? j.items
      : [];
    const count = Number(j.count ?? list.length);
    return { ok: true, count, data: list };
  } catch (e) {
    console.error(TAG, "listMedia exception:", e);
    return { ok: false, count: 0, data: [], error: String(e?.message || e) };
  }
}

/**  Validacion  */
function toMB(bytes) {
  return bytes / (1024 * 1024);
}
function hasAcceptedExt(name) {
  const ix = name?.lastIndexOf(".");
  if (ix < 0) return false;
  const ext = name.slice(ix).toLowerCase();
  return CFG.ACCEPT_EXT.includes(ext);
}
function hasAcceptedMime(mime) {
  return CFG.ACCEPT_MIME.includes(String(mime || "").toLowerCase());
}

/**
 * @param {FileList|File[]} files
 * @returns {{accepted: File[], rejected: Array<{name:string, size:number, mime:string, reason:string}>}}
 */
function validateFiles(files) {
  const accepted = [];
  const rejected = [];
  const arr = Array.from(files || []);

  for (const f of arr) {
    const sizeMb = toMB(f.size || 0);
    const mimeOk = hasAcceptedMime(f.type);
    const extOk = hasAcceptedExt(f.name);
    if (sizeMb > CFG.MAX_MB) {
      rejected.push({
        name: f.name,
        size: f.size,
        mime: f.type,
        reason: `Excede ${CFG.MAX_MB} MB`,
      });
      continue;
    }
    if (!(mimeOk || extOk)) {
      rejected.push({
        name: f.name,
        size: f.size,
        mime: f.type,
        reason: "Tipo no permitido",
      });
      continue;
    }
    accepted.push(f);
  }
  return { accepted, rejected };
}

/** = uploadMedia =
 * @param {{folio:string, status:number, files:FileList|File[]}} params
 * @returns {Promise<{ok:boolean, saved?:any, failed?:any, error?:string, _clientRejected?:Array}>}
 */
export async function uploadMedia({ folio, status = 0, files }) {
  if (!folio || !/^REQ-\\d{10}$/.test(String(folio))) {
    return { ok: false, error: "Folio inválido" };
  }
  const { accepted, rejected } = validateFiles(files);
  if (!accepted.length) {
    return {
      ok: false,
      error: "No hay archivos válidos para subir",
      _clientRejected: rejected,
    };
  }

  const fd = new FormData();
  fd.append("folio", folio);
  fd.append("status", String(status));
  accepted.forEach((f) => fd.append("files[]", f, f.name));

  const url = CFG.ENDPOINTS.mediaUpload;

  try {
    const resp = await fetch(url, { method: "POST", body: fd });
    // algunos PHP devuelven 200 con texto plano si hay error; intentamos JSON y si no, texto
    const text = await resp.text();
    let j;
    try {
      j = JSON.parse(text);
    } catch {
      j = { ok: false, error: text?.slice(0, 200) || `HTTP ${resp.status}` };
    }

    if (!resp.ok || !j?.ok) {
      const err = j?.error || `HTTP ${resp.status}`;
      console.error(TAG, "uploadMedia error:", err, j);
      j.ok = false;
      j.error = err;
      j._clientRejected = rejected;
      return j;
    }
    j._clientRejected = rejected;
    return j;
  } catch (e) {
    console.error(TAG, "uploadMedia exception:", e);
    return {
      ok: false,
      error: String(e?.message || e),
      _clientRejected: rejected,
    };
  }
}

// Exportamos helpers por si otras views los quieren mostrar en UI
export const MediaClientConfig = {
  get MAX_MB() {
    return CFG.MAX_MB;
  },
  get ACCEPT_MIME() {
    return CFG.ACCEPT_MIME.slice();
  },
  get ACCEPT_EXT() {
    return CFG.ACCEPT_EXT.slice();
  },
  get ENDPOINTS() {
    return Object.assign({}, CFG.ENDPOINTS);
  },
  setEndpoint(key, val) {
    if (CFG.ENDPOINTS[key]) CFG.ENDPOINTS[key] = String(val);
  },
};

export function explainRejected(filesRejected = []) {
  if (!filesRejected.length) return "";
  return filesRejected.map((r) => `• ${r.name}: ${r.reason}`).join("\\n");
}

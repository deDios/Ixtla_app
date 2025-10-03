// /JS/api/media.js
const TAG = "[API:Media]";

// Con 
const FALLBACK = {
  MAX_MB: 1,
  ACCEPT_MIME: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
  ACCEPT_EXT:  [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"],
  ENDPOINTS: {
    mediaList:  "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/ixtla01_c_requerimiento_img.php",
    mediaUpload:"https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/ixtla01_ins_requerimiento_img.php",
  },
};
const CFG = Object.assign({}, FALLBACK, (window.IX_CFG_REQ || {}));

//  Helpers 
const isInt = (v) => Number.isInteger(Number(v));
const inRange = (n, a, b) => n >= a && n <= b;
const extOf = (name="") => {
  const n = String(name).toLowerCase();
  const i = n.lastIndexOf(".");
  return i >= 0 ? n.slice(i) : "";
};

/**
 * Valida una lista de archivos contra tamaño y tipo permitidos.
 * Devuelve { accepted: File[], rejected: {file, reason}[], ok:boolean }
 */
export function validateFiles(files = []) {
  const accepted = [];
  const rejected = [];
  for (const f of files) {
    const tooBig = f.size > (CFG.MAX_MB * 1024 * 1024);
    const okMime = (CFG.ACCEPT_MIME || []).includes(f.type);
    const okExt  = (CFG.ACCEPT_EXT  || []).includes(extOf(f.name));
    if (tooBig) {
      rejected.push({ file: f, reason: `Excede ${CFG.MAX_MB} MB` });
    } else if (!okMime && !okExt) {
      rejected.push({ file: f, reason: "Tipo no permitido" });
    } else {
      accepted.push(f);
    }
  }
  return { accepted, rejected, ok: rejected.length === 0 };
}

/**
 * Lista media por folio y (opcional) status 0..6
 * @param {string} folio REQ-0000000000
 * @param {number|null} status 0..6 o null para todos
 * @param {number} page
 * @param {number} per_page
 * @returns {Promise<{ok:boolean, folio:string, status:number|null, count:number, data:Array}>}
 */
export async function listMedia(folio, status = null, page = 1, per_page = 100) {
  if (!/^REQ-\d{10}$/.test(String(folio))) {
    throw new Error("Folio inválido. Formato: REQ-0000000000");
  }
  if (status !== null && !(isInt(status) && inRange(Number(status), 0, 6))) {
    throw new Error("Status inválido (0..6 o null).");
  }

  const payload = { folio, page: Number(page) || 1, per_page: Number(per_page) || 100 };
  if (status !== null) payload.status = Number(status);

  const r = await fetch(CFG.ENDPOINTS.mediaList, {
    method: "POST",
    headers: { "Content-Type": "application/json;charset=utf-8", "Accept": "application/json" },
    body: JSON.stringify(payload),
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) {
    console.error(TAG, "LIST error:", j || (await r.text?.()));
    throw new Error(j?.error || `Error ${r.status}`);
  }
  return j;
}

/**
 * Sube media a un status para un folio
 * @param {{folio:string, status:number, files:FileList|File[]}} opts
 * @returns {Promise<{ok:boolean, saved:Array, failed:Array, status:number, folio:string}>}
 */
export async function uploadMedia({ folio, status, files }) {
  if (!/^REQ-\d{10}$/.test(String(folio))) throw new Error("Folio inválido.");
  const st = Number(status);
  if (!isInt(st) || !inRange(st, 0, 6)) throw new Error("Status inválido (0..6).");

  const list = Array.from(files || []);
  const { accepted, rejected } = validateFiles(list);
  if (!accepted.length) {
    const msg = rejected[0]?.reason || "Archivos no válidos";
    throw new Error(msg);
  }

  const fd = new FormData();
  fd.append("folio", folio);
  fd.append("status", String(st));
  accepted.forEach((f) => fd.append("files[]", f, f.name));

  const r = await fetch(CFG.ENDPOINTS.mediaUpload, { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));

  if (!r.ok || !j) throw new Error(`Upload ${r.status || ""}`.trim());
  if (!j.ok) console.warn(TAG, "upload partial", j);

  j._clientRejected = rejected;
  return j;
}

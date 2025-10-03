// /JS/api/media.js 

const API_BASE = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/";
const ENDPOINTS = {
  mediaList:   API_BASE + "ixtla01_c_requerimiento_img.php",    // POST (listar)
  mediaUpload: API_BASE + "ixtla01_ins_requerimiento_img.php",  // POST (subir)
};

// Reglas de validacion
const MAX_MB = 1;
const ACCEPT_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const ACCEPT_EXT  = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

const TAG = "[API:Media]";

function toMB(bytes){ return bytes / (1024*1024); }
function hasAcceptedExt(name){
  const i = name?.lastIndexOf("."); if (i < 0) return false;
  return ACCEPT_EXT.includes(name.slice(i).toLowerCase());
}
function hasAcceptedMime(m){ return ACCEPT_MIME.includes(String(m || "").toLowerCase()); }
function validateFiles(files){
  const accepted = [], rejected = [];
  for (const f of Array.from(files || [])){
    const sizeMb = toMB(f.size || 0);
    const mimeOk = hasAcceptedMime(f.type);
    const extOk  = hasAcceptedExt(f.name);
    if (sizeMb > MAX_MB){ rejected.push({ name:f.name, size:f.size, mime:f.type, reason:`Excede ${MAX_MB} MB` }); continue; }
    if (!(mimeOk || extOk)){ rejected.push({ name:f.name, size:f.size, mime:f.type, reason:`Tipo no permitido` }); continue; }
    accepted.push(f);
  }
  return { accepted, rejected };
}

class MediaAPI {
  /** Consultar/listar evidencias por folio + estatus */
  async c({ folio, status=0, page=1, per_page=50, signal } = {}){
    if (!folio || !/^REQ-\d{10}$/.test(String(folio))) {
      return { ok:false, count:0, data:[], error:"Folio inválido" };
    }
    try {
      const resp = await fetch(ENDPOINTS.mediaList, {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=utf-8", Accept: "application/json" },
        body: JSON.stringify({ folio, status, page, per_page }),
        signal,
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j?.ok){
        const err = j?.error || `HTTP ${resp.status}`;
        return { ok:false, count:0, data:[], error: err };
      }
      const list = Array.isArray(j.data) ? j.data : (Array.isArray(j.items) ? j.items : []);
      const count = Number(j.count ?? list.length);
      return { ok:true, count, data:list };
    } catch (e) {
      console.error(TAG, "list error:", e);
      return { ok:false, count:0, data:[], error:String(e?.message || e) };
    }
  }

  /** Insertar/subir evidencias (multipart/form-data) */
  async i({ folio, status=0, files, signal } = {}){
    if (!folio || !/^REQ-\d{10}$/.test(String(folio))) {
      return { ok:false, error:"Folio inválido" };
    }
    const { accepted, rejected } = validateFiles(files);
    if (!accepted.length){
      return { ok:false, error:"No hay archivos válidos para subir", _clientRejected: rejected };
    }
    try {
      const fd = new FormData();
      fd.append("folio", folio);
      fd.append("status", String(status));
      accepted.forEach(f => fd.append("files[]", f, f.name));
      const resp = await fetch(ENDPOINTS.mediaUpload, { method:"POST", body: fd, signal });
      const raw = await resp.text();
      let j; try { j = JSON.parse(raw); } catch { j = { ok:false, error: raw?.slice(0,200) || `HTTP ${resp.status}` }; }
      if (!resp.ok || !j?.ok){
        const err = j?.error || `HTTP ${resp.status}`;
        j.ok = false; j.error = err; j._clientRejected = rejected;
        return j;
      }
      j._clientRejected = rejected;
      return j;
    } catch (e) {
      console.error(TAG, "upload error:", e);
      return { ok:false, error:String(e?.message || e) };
    }
  }
}

export const media = new MediaAPI();
export default media;

// Aliases 
export const listMedia   = (folio, status=0, page=1, per_page=50) => media.c({ folio, status, page, per_page });
export const uploadMedia = ({ folio, status=0, files }) => media.i({ folio, status, files });

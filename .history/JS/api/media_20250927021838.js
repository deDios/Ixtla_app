// /JS/api/media.js
const TAG = "[API:Media]";

// === Ajusta estas URLs a tus rutas reales ===
const URL_SETUP  = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_setup_requerimiento_media.php"; // el que crea 0..6 y regresa urls
const URL_LIST   = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_requerimiento_media.php";     // listado (el que acabamos de definir)
const URL_UPLOAD = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_i_requerimiento_media.php";     // tu endpoint de subida (el que mandaste)

export async function setupMedia(folio) {
  const r = await fetch(URL_SETUP, {
    method: "POST",
    headers: { "Content-Type": "application/json;charset=utf-8" },
    body: JSON.stringify({ folio })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) throw new Error(j?.error || "Error setup media");
  return j;
}

export async function listMedia(folio, status = null, page = 1, per_page = 100) {
  const payload = { folio, page, per_page };
  if (status !== null && status !== undefined) payload.status = status;
  const r = await fetch(URL_LIST, {
    method: "POST",
    headers: { "Content-Type": "application/json;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) throw new Error(j?.error || "Error list media");
  return j;
}

export async function uploadMedia({ folio, status, files }) {
  const fd = new FormData();
  fd.append("folio", folio);
  fd.append("status", String(status));
  // el endpoint acepta 'files' o 'file' — usamos 'files'
  [...files].forEach(f => fd.append("files[]", f));

  const r = await fetch(URL_UPLOAD, { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j) throw new Error("Error upload");
  if (!j.ok) {
    console.warn(TAG, "upload partial", j);
  }
  return j; // { ok, saved[], failed[] }
}

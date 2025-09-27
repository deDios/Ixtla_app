// /JS/api/requerimientos.js
const TAG = "[API:Requerimientos]";
const API_URL = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/ixtla01_c_requerimiento.php";

/**
 * fetchRequerimientos
 * @param {Object} p
 * @param {number} p.departamento_id    // requerido
 * @param {number} [p.page=1]
 * @param {number} [p.per_page=50]      // get a todo para paginar despues
 * @param {string} [p.search=""]
 * @param {number|number[]|null} [p.estatus=null] // 0..4 o arreglo; null = todos
 */

export async function fetchRequerimientos(p = {}) {
  const payload = {
    departamento_id: p.departamento_id,
    page: p.page ?? 1,
    per_page: p.per_page ?? 50,
  };

  if (p.search) payload.search = p.search;
  if (p.estatus !== null && p.estatus !== undefined) payload.estatus = p.estatus;

  let resp, raw;
  try {
    resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    raw = await resp.text();
  } catch (netErr) {
    console.error(TAG, "Network error:", netErr);
    throw new Error("NETWORK");
  }

  // Log de depuración util
  console.log(TAG, "HTTP", resp.status, "url:", resp.url, "payload:", payload, "preview:", raw?.slice?.(0, 220));

  let data;
  try { data = raw ? JSON.parse(raw) : null; }
  catch (e) {
    console.error(TAG, "JSON parse error:", e, "raw:", raw);
    throw new Error("BAD_JSON");
  }

  if (!resp.ok || data?.ok === false) {
    const msg = data?.error || data?.message || `HTTP ${resp.status}`;
    throw new Error(msg);
  }

  // normalizar
  return {
    ok: true,
    count: Number(data?.count ?? 0),
    page: Number(data?.page ?? payload.page),
    per_page: Number(data?.per_page ?? payload.per_page),
    rows: Array.isArray(data?.data) ? data.data : [],
    raw: data
  };
}

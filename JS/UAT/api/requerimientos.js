// /JS/api/requerimientos.js
const TAG = "[API:Requerimientos]";

const API_BASE =
  "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/";
const URL_LIST = API_BASE + "ixtla01_c_requerimiento.php";
const URL_UPDATE = API_BASE + "ixtla01_upd_requerimiento.php";

/**
 * Lista requerimientos (paginado)
 * @param {{page?:number, per_page?:number}} params
 * @returns {Promise<{ok:boolean, rows:any[], count:number}>}
 */
export async function fetchRequerimientos(params = {}) {
  const body = {
    page: Number(params.page ?? 1),
    per_page: Number(params.per_page ?? 50),
  };

  const resp = await fetch(URL_LIST, {
    method: "POST",
    headers: { "Content-Type": "application/json;charset=utf-8" },
    body: JSON.stringify(body),
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json?.ok) {
    console.error(TAG, "LIST error:", json || (await resp.text()));
    throw new Error(json?.error || `Error ${resp.status}`);
  }

  return {
    ok: true,
    rows: Array.isArray(json.data) ? json.data : [],
    count: Number(json.count ?? (json.data?.length || 0)),
  };
}

/**
 * Actualiza un requerimiento
 * @param {object} payload // mínimo: { id, updated_by, ... }
 * @returns {Promise<any>} // objeto actualizado (json.data)
 */
export async function updateRequerimiento(payload) {
  const resp = await fetch(URL_UPDATE, {
    method: "POST",
    headers: { "Content-Type": "application/json;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json?.ok) {
    console.error(TAG, "UPDATE error:", json || (await resp.text()));
    throw new Error(json?.error || `Error ${resp.status}`);
  }
  return json.data;
}

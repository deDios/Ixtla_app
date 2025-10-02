// /JS/api/requerimientos.js
const TAG = "[API:Requerimientos]";

// Endpoints 
const URL_LIST = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/ixtla01_c_requerimiento.php";
const URL_UPDATE = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_u_requerimiento.php";

/**
 * Lista requerimientos por departamento (cliente)
 * @param {{departamento_id:number,page?:number,per_page?:number}} params
 * @returns {Promise<{ok:boolean, rows:any[], count:number}>}
 */

export async function fetchRequerimientos(params = {}) {
    const body = {
        departamento_id: Number(params.departamento_id ?? 1),
        page: Number(params.page ?? 1),
        per_page: Number(params.per_page ?? 50)
    };

    const resp = await fetch(URL_LIST, {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=utf-8" },
        body: JSON.stringify(body),
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json?.ok) {
        console.error(TAG, "LIST error:", json || await resp.text());
        throw new Error(json?.error || `Error ${resp.status}`);
    }

    // Normaliza la forma esperada por home.js
    return {
        ok: true,
        rows: Array.isArray(json.data) ? json.data : [],
        count: Number(json.count ?? (json.data?.length || 0)),
    };
}

/**
 * Actualiza un requerimiento (estatus, campos, etc.)
 * @param {object} payload  // minimo: { id, updated_by, ... }
 * @returns {Promise<any>}  // devuelve el objeto actualizado (json.data)
 */
export async function updateRequerimiento(payload) {
    const resp = await fetch(URL_UPDATE, {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=utf-8" },
        body: JSON.stringify(payload),
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json?.ok) {
        console.error(TAG, "UPDATE error:", json || await resp.text());
        throw new Error(json?.error || `Error ${resp.status}`);
    }
    return json.data; // home/drawer esperan el registro actualizado en data
}

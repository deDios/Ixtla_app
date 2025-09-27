// /JS/api/requerimientos.js
export async function updateRequerimiento(patch) {
    const url = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_u_requerimiento.php";
    const TAG = "[API:Requerimientos:UPDATE]";

    if (!patch || !Number.isFinite(patch.id)) {
        throw new Error("updateRequerimiento: falta 'id'");
    }

    // Limpieza mínima de payload (evita mandar vacíos/undefined)
    const body = {};
    for (const k of Object.keys(patch)) {
        const v = patch[k];
        if (v !== undefined) body[k] = v;
    }

    // Debug útil
    console.log(TAG, "PATCH >", { ...body, _url: url });

    const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=utf-8" },
        body: JSON.stringify(body),
    });

    const text = await resp.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { ok: false, error: text || "Respuesta no JSON" }; }

    if (!resp.ok || !json?.ok) {
        const msg = json?.error || `Error HTTP ${resp.status}`;
        console.error(TAG, "(err)", msg, { text });
        throw new Error(msg);
    }

    console.log(TAG, "OK <", json?.data);
    return json.data; // registro actualizado
}

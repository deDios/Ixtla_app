// /JS/api/http.js
/**
 * POST JSON con timeout, manejo básico de errores y opción de reintentos.
 * aun no se usarlo pero voy a comenzar a usar esto seguido
 * @param {string} url
 * @param {object} body
 * @param {object} [opts]
 * @param {Record<string,string>} [opts.headers]
 * @param {number} [opts.timeout=15000] ms
 * @param {number} [opts.retries=0]    numero de reintentos
 * @returns {Promise<any>}             objeto JSON parseado
 */
export async function postJSON(url, body, { headers = {}, timeout = 15000, retries = 0 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  const fetchOnce = async () => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
      credentials: "include",
    });
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { ok: false, message: "Respuesta no-JSON", raw: text }; }
    if (!res.ok) {
      const msg = json?.message || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.payload = json;
      throw err;
    }
    return json;
  };

  try {
    return await fetchOnce();
  } catch (err) {
    if (retries > 0) {
      return postJSON(url, body, { headers, timeout, retries: retries - 1 });
    }
    throw err;
  } finally {
    clearTimeout(t);
  }
}

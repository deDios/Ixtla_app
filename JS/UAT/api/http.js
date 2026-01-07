// /JS/api/http.js

/**
 * Helper genérico para hacer peticiones JSON (POST, PUT, PATCH, etc.) con
 * timeout, manejo básico de errores y opción de reintentos.
 *
 * @param {"POST"|"PUT"|"PATCH"|"GET"|"DELETE"} method
 * @param {string} url
 * @param {object} body
 * @param {object} [opts]
 * @param {Record<string,string>} [opts.headers]
 * @param {number} [opts.timeout=15000] ms
 * @param {number} [opts.retries=0]    número de reintentos
 * @returns {Promise<any>}             objeto JSON parseado
 */
async function requestJSON(
  method,
  url,
  body,
  { headers = {}, timeout = 15000, retries = 0 } = {}
) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);

  const fetchOnce = async () => {
    const init = {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      signal: controller.signal,
      credentials: "include",
    };

    if (body != null) {
      init.body = JSON.stringify(body ?? {});
    }

    const res = await fetch(url, init);
    const text = await res.text();

    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { ok: false, message: "Respuesta no-JSON", raw: text };
    }

    if (!res.ok) {
      const msg = json?.message || json?.error || `HTTP ${res.status}`;
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
      return requestJSON(method, url, body, {
        headers,
        timeout,
        retries: retries - 1,
      });
    }
    throw err;
  } finally {
    clearTimeout(t);
  }
}

/**
 * POST JSON con timeout, manejo básico de errores y opción de reintentos.
 * aun no se usarlo pero voy a comenzar a usar esto seguido
 */
export function postJSON(url, body, opts) {
  return requestJSON("POST", url, body, opts);
}

/**
 * PATCH JSON (para updates parciales, por ejemplo cambiar el status de una tarea).
 */
export function patchJSON(url, body, opts) {
  return requestJSON("PATCH", url, body, opts);
}

/**
 * PUT JSON (por si el backend lo requiere en otros módulos).
 */
export function putJSON(url, body, opts) {
  return requestJSON("PUT", url, body, opts);
}

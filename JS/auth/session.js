// /JS/auth/session.js
const COOKIE_NAME = "ix_emp";
const COOKIE_TTL_MS = 1 * 60 * 1000; // 10 minutos

function b64e(json) { return btoa(unescape(encodeURIComponent(JSON.stringify(json)))); }
function b64d(str)  { try { return JSON.parse(decodeURIComponent(escape(atob(str)))); } catch { return null; } }

// Borrar cookie
function __clearCookie() {
  const parts = [
    `${encodeURIComponent(COOKIE_NAME)}=`,
    "expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
    "path=/",
    "SameSite=Lax",
  ];
  if (location.protocol === "https:") parts.push("Secure");
  document.cookie = parts.join("; ");
}

// Escribe la cookie
function __writeCookie(value, ttlMs = COOKIE_TTL_MS) {
  const maxAge = Math.max(1, Math.floor(ttlMs / 1000)); // segundos
  const expires = new Date(Date.now() + maxAge * 1000).toUTCString();
  const parts = [
    `${encodeURIComponent(COOKIE_NAME)}=${encodeURIComponent(value)}`,
    `Max-Age=${maxAge}`,
    `expires=${expires}`,
    "path=/",
    "SameSite=Lax",
  ];
  if (location.protocol === "https:") parts.push("Secure");
  document.cookie = parts.join("; ");
}

/**
 * Crea/reemplaza la sesion.
 * - Borra primero cualquier cookie existente.
 * - crear cookie con un fecha de vencimiento en cookie TTL (la variable de hasta arriba)
 * @param {Object} emp  Datos del usuario
 * @param {number} [ttlMs=COOKIE_TTL_MS]  
 * @returns {Object} payload guardado
 */

export function setSession(emp, ttlMs = COOKIE_TTL_MS) {
  const now = Date.now();
  const exp = now + ttlMs;

  // lo que contiene la cookie
  const payload = {
    id_usuario: emp.id_usuario ?? 1,
    nombre: emp.nombre,
    apellidos: emp.apellidos,
    email: emp.email,
    telefono: emp.telefono,
    puesto: emp.puesto ?? "Empleado",
    departamento_id: emp.departamento_id ?? 1,
    roles: emp.roles ?? ["Programador"],
    status_empleado: emp.status_empleado ?? 1,
    status_cuenta: emp.status_cuenta ?? 1,
    created_by: emp.created_by ?? 1,
    username: emp.username ?? "",
    ts: now,       // fecha de creacion
    exp: exp       // fecha de vencimiento
  };

  const value = b64e(payload);

  // destruir cookie antigua
  __clearCookie();
  __writeCookie(value, ttlMs);

  return payload;
}

/**
 * Lee la sesion desde cookie.
 * - Si está expirada segun el "payload.exp", la borra y devuelve null.
 * @returns {Object|null}
 */

export function getSession() {
  const pair = document.cookie.split("; ").find(c => c.startsWith(encodeURIComponent(COOKIE_NAME) + "="));
  if (!pair) return null;

  const raw = decodeURIComponent(pair.split("=")[1] || "");
  const data = b64d(raw);
  if (!data || typeof data !== "object") return null;

  // borrar si se "vencio" la cookie
  if (typeof data.exp === "number" && Date.now() > data.exp) {
    try { __clearCookie(); } catch {}
    return null;
  }
  return data;
}

//borrar cookie pasada
export function clearSession() {
  __clearCookie();
}

export const Session = { set: setSession, get: getSession, clear: clearSession };

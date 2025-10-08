// /JS/auth/session.js
"use strict";

const COOKIE_NAME   = "ix_emp";
const COOKIE_TTL_MS = 20 * 60 * 1000; // 20 minutos

// ---- Debug toggle
const DEBUG = false;
const log  = (...a) => { if (DEBUG) console.log("[Session]", ...a); };
const warn = (...a) => { if (DEBUG) console.warn("[Session]", ...a); };

// Base64 JSON helpers
function b64e(json) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(json))));
}
function b64d(str) {
  try { return JSON.parse(decodeURIComponent(escape(atob(str)))); }
  catch { return null; }
}

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
  log("cookie cleared");
}

// Escribir cookie
function __writeCookie(value, ttlMs = COOKIE_TTL_MS) {
  const maxAge  = Math.max(1, Math.floor(ttlMs / 1000)); // seg
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
  log("cookie written", { maxAge, expires });
}

/* ============================================================================
   Normalizadores
   ==========================================================================*/

// Convierte roles (objetos/strings) → ["ADMIN","ANALISTA", ...]
function rolesToCodes(roles) {
  if (!Array.isArray(roles)) return [];
  return roles.map(r => (typeof r === "string" ? r : r?.codigo)).filter(Boolean);
}

// Construye el payload a partir del JSON de auth { data:{ empleado, cuenta, roles } }
function buildPayloadFromAuth(authLike, ttlMs = COOKIE_TTL_MS) {
  const src   = authLike?.data ? authLike.data : (authLike || {});
  const emp   = src.empleado || {};
  const acc   = src.cuenta   || {};
  const roles = rolesToCodes(src.roles);

  const now = Date.now();
  const exp = now + ttlMs;

  const empleadoId = Number(emp.id) || null;
  const cuentaId   = Number(acc.id) || null;

  // Canon + aliases de compat
  const payload = {
    schema: "ix-1",

    // Canon
    empleado_id: empleadoId,
    cuenta_id:   cuentaId,

    // Aliases de compatibilidad
    id_empleado: empleadoId,
    id_cuenta:   cuentaId,
    id_usuario:  cuentaId, // histórico: muchos módulos lo leen así

    username: String(acc.username || ""),
    nombre:   String(emp.nombre   || ""),
    apellidos:String(emp.apellidos|| ""),
    email:    emp.email    || "",
    telefono: emp.telefono || "",
    puesto:   emp.puesto   || "Empleado",

    departamento_id: emp.departamento_id != null ? Number(emp.departamento_id) : null,
    roles, // solo códigos
    status_empleado: emp.status != null ? Number(emp.status) : 1,
    status_cuenta:   acc.status != null ? Number(acc.status) : 1,

    created_by: 1,
    avatar_url: null,

    ts:  now,
    exp: exp,
  };

  return payload;
}

function looksLikeAuthResponse(obj) {
  if (!obj || typeof obj !== "object") return false;
  if ("empleado" in obj && "cuenta" in obj) return true;
  if ("data" in obj && obj.data && typeof obj.data === "object"
      && "empleado" in obj.data && "cuenta" in obj.data) return true;
  return false;
}

/* ============================================================================
   API pública
   ==========================================================================*/

// Crea la cookie desde el JSON de login (la respuesta del endpoint de auth)
export function setSessionFromAuth(authJson, ttlMs = COOKIE_TTL_MS) {
  const payload = buildPayloadFromAuth(authJson, ttlMs);
  log("setSessionFromAuth() payload =", payload);

  const value = b64e(payload);
  __clearCookie();
  __writeCookie(value, ttlMs);
  return payload;
}

// Crea la cookie desde un objeto “ligero” (legacy)
export function setSession(emp, ttlMs = COOKIE_TTL_MS) {
  if (looksLikeAuthResponse(emp)) {
    warn("setSession(): objeto parece authJson; delegando a setSessionFromAuth()");
    return setSessionFromAuth(emp, ttlMs);
  }

  const now = Date.now();
  const exp = now + ttlMs;

  const empleadoId = emp.empleado_id ?? emp.id_empleado ?? null;
  const cuentaId   = emp.cuenta_id   ?? emp.id_cuenta   ?? emp.id_usuario ?? null;

  const roles = Array.isArray(emp.roles) ? rolesToCodes(emp.roles) : (emp.roles ? [String(emp.roles)] : []);

  const payload = {
    schema: "ix-1",

    empleado_id: empleadoId != null ? Number(empleadoId) : null,
    cuenta_id:   cuentaId   != null ? Number(cuentaId)   : null,

    // Aliases
    id_empleado: empleadoId != null ? Number(emp.empleado_id ?? emp.id_empleado) : null,
    id_cuenta:   cuentaId   != null ? Number(emp.cuenta_id   ?? emp.id_cuenta   ?? emp.id_usuario) : null,
    id_usuario:  cuentaId   != null ? Number(emp.id_usuario ?? cuentaId) : null,

    username:        emp.username ?? "",
    nombre:          emp.nombre   ?? "",
    apellidos:       emp.apellidos?? "",
    email:           emp.email    ?? "",
    telefono:        emp.telefono ?? "",
    puesto:          emp.puesto   ?? "Empleado",
    departamento_id: emp.departamento_id ?? 1,
    roles:           roles.length ? roles : ["Empleado"],

    status_empleado: emp.status_empleado ?? 1,
    status_cuenta:   emp.status_cuenta   ?? 1,
    created_by:      emp.created_by      ?? 1,
    avatar_url:      emp.avatar_url      ?? null,

    ts:  now,
    exp: exp,
  };

  log("setSession() payload (legacy) =", payload);
  const value = b64e(payload);
  __clearCookie();
  __writeCookie(value, ttlMs);
  return payload;
}

// Leer cookie (null si expirada o inválida)
export function getSession() {
  const pair = document.cookie
    .split("; ")
    .find((c) => c.startsWith(encodeURIComponent(COOKIE_NAME) + "="));
  if (!pair) return null;

  const raw  = decodeURIComponent(pair.split("=")[1] || "");
  const data = b64d(raw);
  if (!data || typeof data !== "object") return null;

  if (typeof data.exp === "number" && Date.now() > data.exp) {
    try { __clearCookie(); } catch {}
    warn("getSession(): expiró, cookie borrada");
    return null;
  }
  log("getSession():", data);
  return data;
}

// Borrar cookie
export function clearSession() {
  __clearCookie();
}

// (Opcional) helper de IDs por si te resulta útil en otros scripts
export function getIds() {
  const s = getSession();
  const id_empleado = s?.empleado_id ?? s?.id_empleado ?? null;
  const id_cuenta   = s?.cuenta_id   ?? s?.id_cuenta   ?? s?.id_usuario ?? null;
  return {
    id_empleado: Number.isFinite(Number(id_empleado)) ? Number(id_empleado) : null,
    id_cuenta:   Number.isFinite(Number(id_cuenta))   ? Number(id_cuenta)   : null,
  };
}

export const Session = {
  set: setSession,
  setFromAuth: setSessionFromAuth,
  get: getSession,
  clear: clearSession,
  getIds,
};

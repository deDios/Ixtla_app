// /PRI/JS/auth/session.js
"use strict";

const COOKIE_NAME = "red_user";
const COOKIE_TTL_MS = 1 * 60 * 60 * 1000; // 1 hora

const DEBUG = false;
const log = (...a) => { if (DEBUG) console.log("[Session RED]", ...a); };
const warn = (...a) => { if (DEBUG) console.warn("[Session RED]", ...a); };

function b64e(json) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(json))));
}

function b64d(str) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(str))));
  } catch {
    return null;
  }
}

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

function __writeCookie(value, ttlMs = COOKIE_TTL_MS) {
  const maxAge = Math.max(1, Math.floor(ttlMs / 1000));
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

function rolesToCodes(roles) {
  if (!Array.isArray(roles)) return [];

  return roles
    .map((r) => {
      if (typeof r === "string") return r;
      return r?.codigo || r?.nombre || "";
    })
    .filter(Boolean);
}

function buildPayloadFromRedAuth(authJson, ttlMs = COOKIE_TTL_MS) {
  const src = authJson?.data ? authJson.data : authJson || {};

  const usuario = src.usuario || {};
  const persona = src.persona || {};
  const rol = src.rol || {};

  const now = Date.now();

  let exp = now + ttlMs;

  if (src.expires_at) {
    const serverExp = new Date(src.expires_at.replace(" ", "T")).getTime();
    if (Number.isFinite(serverExp)) exp = serverExp;
  }

  const usuarioId = Number(usuario.usuario_id) || null;
  const personaId = Number(usuario.persona_id ?? persona.persona_id) || null;
  const rolId = Number(rol.rol_id) || null;

  const nombre = String(usuario.nombre || persona.nombres || "");
  const apellidos = [
    usuario.apellido_paterno || persona.apellido_paterno || "",
    usuario.apellido_materno || persona.apellido_materno || "",
  ].filter(Boolean).join(" ");

  const roles = rol.codigo ? [String(rol.codigo)] : ["Usuario"];

  return {
    schema: "red-1",

    token: src.token || "",
    token_type: src.token_type || "Bearer",
    expires_at: src.expires_at || "",
    expires_in_seconds: src.expires_in_seconds ?? null,

    usuario_id: usuarioId,
    id_usuario: usuarioId,

    persona_id: personaId,
    rol_id: rolId,
    rol_codigo: rol.codigo || "",
    rol_nombre: rol.nombre || "",
    nivel_jerarquico: rol.nivel_jerarquico ?? null,
    roles,

    uuid: usuario.uuid || "",
    username: usuario.username || "",
    nombre,
    apellidos,
    nombre_completo: [nombre, apellidos].filter(Boolean).join(" "),
    email: usuario.email || "",
    telefono: usuario.telefono || "",

    requiere_cambio_password: !!usuario.requiere_cambio_password,
    ultimo_login_at: usuario.ultimo_login_at || "",
    total_hijos_directos: usuario.total_hijos_directos ?? 0,

    reporta_a: src.reporta_a || null,
    territorios: Array.isArray(src.territorios) ? src.territorios : [],

    ts: now,
    exp,
  };
}

function looksLikeRedAuthResponse(obj) {
  const src = obj?.data ? obj.data : obj;

  return !!(
    src &&
    typeof src === "object" &&
    ("usuario" in src || "rol" in src || "token" in src)
  );
}

export function setSessionFromAuth(authJson, ttlMs = COOKIE_TTL_MS) {
  const payload = buildPayloadFromRedAuth(authJson, ttlMs);

  log("setSessionFromAuth() payload =", payload);

  const value = b64e(payload);

  __clearCookie();
  __writeCookie(value, payload.exp - Date.now());

  return payload;
}

export function setSession(data, ttlMs = COOKIE_TTL_MS) {
  if (looksLikeRedAuthResponse(data)) {
    warn("setSession(): objeto parece respuesta RED auth; delegando a setSessionFromAuth()");
    return setSessionFromAuth(data, ttlMs);
  }

  const now = Date.now();
  const exp = now + ttlMs;

  const usuarioId = data.usuario_id ?? data.id_usuario ?? null;
  const roles = Array.isArray(data.roles)
    ? rolesToCodes(data.roles)
    : data.roles
      ? [String(data.roles)]
      : [];

  const payload = {
    schema: "red-1",

    token: data.token || "",
    token_type: data.token_type || "Bearer",
    expires_at: data.expires_at || "",
    expires_in_seconds: data.expires_in_seconds ?? null,

    usuario_id: usuarioId != null ? Number(usuarioId) : null,
    id_usuario: usuarioId != null ? Number(usuarioId) : null,

    persona_id: data.persona_id ?? null,
    rol_id: data.rol_id ?? null,
    rol_codigo: data.rol_codigo || "",
    rol_nombre: data.rol_nombre || "",
    nivel_jerarquico: data.nivel_jerarquico ?? null,
    roles: roles.length ? roles : ["Usuario"],

    uuid: data.uuid || "",
    username: data.username || "",
    nombre: data.nombre || "",
    apellidos: data.apellidos || "",
    nombre_completo: data.nombre_completo || [data.nombre, data.apellidos].filter(Boolean).join(" "),
    email: data.email || "",
    telefono: data.telefono || "",

    requiere_cambio_password: !!data.requiere_cambio_password,
    ultimo_login_at: data.ultimo_login_at || "",
    total_hijos_directos: data.total_hijos_directos ?? 0,

    reporta_a: data.reporta_a || null,
    territorios: Array.isArray(data.territorios) ? data.territorios : [],

    ts: now,
    exp,
  };

  log("setSession() payload =", payload);

  const value = b64e(payload);

  __clearCookie();
  __writeCookie(value, ttlMs);

  return payload;
}

export function getSession() {
  const pair = document.cookie
    .split("; ")
    .find((c) => c.startsWith(encodeURIComponent(COOKIE_NAME) + "="));

  if (!pair) return null;

  const raw = decodeURIComponent(pair.split("=")[1] || "");
  const data = b64d(raw);

  if (!data || typeof data !== "object") return null;

  if (typeof data.exp === "number" && Date.now() > data.exp) {
    try {
      __clearCookie();
    } catch {}

    warn("getSession(): expiró, cookie borrada");
    return null;
  }

  log("getSession():", data);
  return data;
}

export function clearSession() {
  __clearCookie();
}

export function getIds() {
  const s = getSession();

  const id_usuario = s?.usuario_id ?? s?.id_usuario ?? null;
  const persona_id = s?.persona_id ?? null;
  const rol_id = s?.rol_id ?? null;

  return {
    id_usuario: Number.isFinite(Number(id_usuario)) ? Number(id_usuario) : null,
    persona_id: Number.isFinite(Number(persona_id)) ? Number(persona_id) : null,
    rol_id: Number.isFinite(Number(rol_id)) ? Number(rol_id) : null,
  };
}

export function getAuthHeader() {
  const s = getSession();

  if (!s?.token) return {};

  return {
    Authorization: `${s.token_type || "Bearer"} ${s.token}`,
  };
}

export const Session = {
  set: setSession,
  setFromAuth: setSessionFromAuth,
  get: getSession,
  clear: clearSession,
  getIds,
  getAuthHeader,
};
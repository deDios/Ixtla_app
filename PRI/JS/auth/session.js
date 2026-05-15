// /PRI/JS/auth/session.js
"use strict";

const COOKIE_NAME = "red_user";
const COOKIE_TTL_MS = 1 * 60 * 60 * 1000; // 1 hora

const DEBUG = false;

const log = (...a) => {
  if (DEBUG) console.log("[Session RED]", ...a);
};

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

function clearCookie() {
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

function writeCookie(value, ttlMs = COOKIE_TTL_MS) {
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

function getExpiration(src, ttlMs = COOKIE_TTL_MS) {
  const now = Date.now();

  if (src?.expires_at) {
    const serverExp = new Date(String(src.expires_at).replace(" ", "T")).getTime();

    if (Number.isFinite(serverExp)) {
      return serverExp;
    }
  }

  return now + ttlMs;
}

function buildPayloadFromRedAuth(authJson, ttlMs = COOKIE_TTL_MS) {
  const src = authJson?.data ? authJson.data : authJson || {};

  const usuario = src.usuario || {};
  const persona = src.persona || {};
  const rol = src.rol || {};

  const now = Date.now();
  const exp = getExpiration(src, ttlMs);

  return {
    schema: "red-1",

    usuario_id: Number(usuario.usuario_id) || null,
    username: usuario.username || "",

    nombre: usuario.nombre || persona.nombres || "",
    apellido_paterno: usuario.apellido_paterno || persona.apellido_paterno || "",
    apellido_materno: usuario.apellido_materno || persona.apellido_materno || "",

    persona_id: Number(usuario.persona_id ?? persona.persona_id) || null,

    rol: {
      rol_id: Number(rol.rol_id) || null,
      codigo: rol.codigo || "",
      nombre: rol.nombre || "",
      nivel_jerarquico: rol.nivel_jerarquico ?? null,
    },

    ts: now,
    exp,
  };
}

export function setSessionFromAuth(authJson, ttlMs = COOKIE_TTL_MS) {
  const payload = buildPayloadFromRedAuth(authJson, ttlMs);

  log("setSessionFromAuth() payload =", payload);

  const value = b64e(payload);

  clearCookie();
  writeCookie(value, payload.exp - Date.now());

  return payload;
}

export function setSession(data, ttlMs = COOKIE_TTL_MS) {
  return setSessionFromAuth(data, ttlMs);
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
    clearCookie();
    return null;
  }

  return data;
}

export function clearSession() {
  clearCookie();
}

export function getIds() {
  const s = getSession();

  const usuario_id = s?.usuario_id ?? null;
  const persona_id = s?.persona_id ?? null;
  const rol_id = s?.rol?.rol_id ?? null;

  return {
    usuario_id: Number.isFinite(Number(usuario_id)) ? Number(usuario_id) : null,
    persona_id: Number.isFinite(Number(persona_id)) ? Number(persona_id) : null,
    rol_id: Number.isFinite(Number(rol_id)) ? Number(rol_id) : null,
  };
}

export const Session = {
  set: setSession,
  setFromAuth: setSessionFromAuth,
  get: getSession,
  clear: clearSession,
  getIds,
};
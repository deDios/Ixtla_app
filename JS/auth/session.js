const COOKIE_NAME = "ix_emp";
const COOKIE_DAYS = 7;

function b64e(json) { return btoa(unescape(encodeURIComponent(JSON.stringify(json)))); }
function b64d(str)  { try { return JSON.parse(decodeURIComponent(escape(atob(str)))); } catch { return null; } }

export function setSession(emp, days = COOKIE_DAYS) {
  // guardamos solo lo necesario
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
    ts: Date.now()
  };

  const value = b64e(payload);
  const d = new Date(); d.setTime(d.getTime() + (days*24*60*60*1000));

  const parts = [
    `${COOKIE_NAME}=${value}`,
    `expires=${d.toUTCString()}`,
    "path=/",
    "SameSite=Lax"
  ];
  if (location.protocol === "https:") parts.push("Secure");

  document.cookie = parts.join("; ");
  return payload;
}

export function getSession() {
  const match = document.cookie.split("; ").find(c => c.startsWith(COOKIE_NAME + "="));
  if (!match) return null;
  const raw = match.split("=")[1];
  return b64d(raw);
}

export function clearSession() {
  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

export const Session = { set: setSession, get: getSession, clear: clearSession };

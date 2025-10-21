// /JS/api/usuarios.js
"use strict";

/* ============================================================================
   API Usuarios (empleado + cuenta + roles)
   Endpoints PHP (server):
   - c: ixtla01_c_empleado.php (consulta por id o listado con filtros)
   - i: ixtla01_i_empleado.php (crear)
   - u: ixtla01_u_empleado.php (actualizar / reemplazo de roles)
   ========================================================================== */

const TAG = "[API:Usuarios]";

// Ajusta si cambias la base:
const API_BASE = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/";

const API = {
  c_empleado: API_BASE + "ixtla01_c_empleado.php",
  i_empleado: API_BASE + "ixtla01_i_empleado.php",
  u_empleado: API_BASE + "ixtla01_u_empleado.php",
};

const dev = true;
const log  = (...a)=>{ if (dev) console.log(TAG, ...a); };
const warn = (...a)=>{ if (dev) console.warn(TAG, ...a); };
const group = (l)=>{ if (dev) console.group?.(l); };
const groupEnd = ()=>{ if (dev) console.groupEnd?.(); };

/* --------------------------------- fetch ---------------------------------- */
async function postJSON(url, body) {
  const t0 = performance.now?.() ?? Date.now();
  group(`${TAG} POST ${url}`);
  log("payload:", body);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type":"application/json", "Accept":"application/json" },
      body: JSON.stringify(body || {}),
    });
    const dt = Math.round((performance.now?.() ?? Date.now()) - t0);
    if (!res.ok) {
      const text = await res.text().catch(()=>"(sin cuerpo)");
      warn(`HTTP ${res.status} (${dt}ms) @ ${url} — body:`, text);
      throw new Error(`HTTP ${res.status} @ ${url}`);
    }
    const json = await res.json().catch(()=>null);
    log(`OK (${dt}ms)`, { keys: json ? Object.keys(json) : null });
    groupEnd();
    return json;
  } catch (e) { groupEnd(); throw e; }
}

/* --------------------------------- cache ---------------------------------- */
const CACHE_TTL_MS = 60_000;
const _cache = new Map();
function cacheGet(k){ const v=_cache.get(k); if(!v) return null; if(Date.now()-v.t> CACHE_TTL_MS){ _cache.delete(k); return null; } return v.data; }
function cacheSet(k,d){ _cache.set(k,{t:Date.now(),data:d}); }

/* ------------------------------- normalizers ------------------------------- */
function buildNombreCompleto(emp){
  const n = [emp?.nombre, emp?.apellidos].filter(Boolean).join(" ").trim();
  return n || "—";
}
function mapEmpleadoOut(raw){
  if (!raw) return null;
  return {
    id: Number(raw.id),
    nombre: raw.nombre || "",
    apellidos: raw.apellidos || "",
    email: raw.email || "",
    telefono: raw.telefono || "",
    puesto: raw.puesto || "",
    departamento_id: raw.departamento_id != null ? Number(raw.departamento_id) : null,
    status: Number(raw.status ?? 1),
    created_at: raw.created_at || null,
    updated_at: raw.updated_at || null,
    created_by: raw.created_by != null ? Number(raw.created_by) : null,
    updated_by: raw.updated_by != null ? Number(raw.updated_by) : null,
    cuenta: raw.cuenta ? {
      id: Number(raw.cuenta.id),
      username: raw.cuenta.username || "",
      reporta_a: raw.cuenta.reporta_a != null ? Number(raw.cuenta.reporta_a) : null,
      debe_cambiar_pw: Number(raw.cuenta.debe_cambiar_pw || 0),
      intentos_fallidos: Number(raw.cuenta.intentos_fallidos || 0),
      status: Number(raw.cuenta.status ?? 1),
      ultima_sesion: raw.cuenta.ultima_sesion || null,
      roles: Array.isArray(raw.cuenta.roles) ? raw.cuenta.roles.map(r => ({
        id: Number(r.id), codigo: String(r.codigo || ""), nombre: String(r.nombre || "")
      })) : [],
    } : null,
    nombre_completo: buildNombreCompleto(raw),
  };
}
function mapCollectionOut(arr){
  return (Array.isArray(arr)?arr:[]).map(mapEmpleadoOut);
}

/* ============================== Consultas (C) ============================== */

/** getEmpleadoById(id:number) */
export async function getEmpleadoById(id){
  const key = `emp|id|${id}`;
  const hit = cacheGet(key); if (hit) return hit;
  const json = await postJSON(API.c_empleado, { id: Number(id) });
  const emp = mapEmpleadoOut(json?.data);
  cacheSet(key, emp);
  return emp;
}

/**
 * searchEmpleados({ q?, departamento_id?, rol_codigo?, status_empleado?, status_cuenta?, page?, page_size? })
 * Devuelve { items, total, page, page_size }
 */
export async function searchEmpleados(filters = {}){
  const body = {
    q: filters.q ?? null,
    departamento_id: filters.departamento_id ?? null,
    rol_codigo: filters.rol_codigo ?? null,
    status_empleado: filters.status_empleado ?? null,
    status_cuenta: filters.status_cuenta ?? null,
    page: filters.page ?? 1,
    page_size: Math.min( Math.max(1, filters.page_size ?? 50), 500 ),
  };
  const key = `emp|list|${JSON.stringify(body)}`;
  const hit = cacheGet(key); if (hit) return hit;

  const json = await postJSON(API.c_empleado, body);
  const meta = json?.meta || {};
  const out = {
    items: mapCollectionOut(json?.data),
    total: Number(meta.total ?? 0),
    page: Number(meta.page ?? body.page),
    page_size: Number(meta.page_size ?? body.page_size),
  };
  cacheSet(key, out);
  return out;
}

/* ============================== Crear (I) ================================== */
/**
 * createEmpleado(payload)
 * payload requerido por el backend:
 * {
 *   nombre, apellidos, email, puesto, username, password, roles:[ "JEFE","ANALISTA", ... ],
 *   telefono?, departamento_id?, reporta_a?, debe_cambiar_pw?, status_empleado?, status_cuenta?, created_by?
 * }
 * Respuesta: { empleado, cuenta, roles }
 */
export async function createEmpleado(payload = {}){
  // Validaciones mínimas del lado cliente
  const req = ["nombre","apellidos","email","puesto","username","password","roles"];
  for (const k of req){
    if (k === "roles" && !Array.isArray(payload.roles)) throw new Error("roles debe ser un arreglo no vacío");
    if (k !== "roles" && (!payload[k] || String(payload[k]).trim()===""))
      throw new Error(`Falta parámetro obligatorio: ${k}`);
  }
  const json = await postJSON(API.i_empleado, payload);
  // No mapeamos aquí a que ya viene armado por el backend:
  return {
    empleado: mapEmpleadoOut(json?.data?.empleado),
    cuenta: json?.data?.cuenta || null,
    roles: Array.isArray(json?.data?.roles) ? json.data.roles : [],
  };
}

/* ============================== Actualizar (U) ============================= */
/**
 * updateEmpleado(patch)
 * patch soportado por el backend (dinámico):
 *  id (obligatorio)
 *  Empleado:    nombre?, apellidos?, email?, telefono?, puesto?, departamento_id?(null=limpiar), status_empleado?
 *  Cuenta:      username?, reporta_a?(null=limpiar), debe_cambiar_pw?, status_cuenta?, password?
 *  Roles:       roles? (array de códigos) => reemplaza completamente; [] los limpia
 *  updated_by?
 * Respuesta: { empleado:{}, cuenta:{...roles:[] } }
 */
export async function updateEmpleado(patch = {}){
  if (!patch?.id) throw new Error("updateEmpleado(): falta 'id'");
  const json = await postJSON(API.u_empleado, patch);
  const emp = mapEmpleadoOut({ ...json?.data?.empleado, cuenta: json?.data?.cuenta });
  return emp; // ya incluye cuenta/roles normalizados
}

/* ============================ Helpers de alto nivel ======================== */
/** updatePerfilBasico({ id, nombre, apellidos, email, telefono, fecha_nacimiento? }) */
export async function updatePerfilBasico({ id, nombre, apellidos, email, telefono, fecha_nacimiento, updated_by }){
  // el endpoint u_empleado no recibe fecha_nacimiento explicitamente en tu PHP;
  // si decides agregarlo, pásalo aquí. Por ahora, ignorado para backend.
  const patch = {
    id, nombre, apellidos, email, telefono,
    updated_by,
  };
  return updateEmpleado(patch);
}

/** changePassword({ id, password, updated_by? }) */
export async function changePassword({ id, password, updated_by }){
  if (!password || password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
  return updateEmpleado({ id, password, updated_by });
}

/** setRolesPorCodigos({ id, roles: ["DIRECTOR","JEFE"], updated_by? }) */
export async function setRolesPorCodigos({ id, roles, updated_by }){
  if (!Array.isArray(roles)) throw new Error("roles debe ser un array");
  return updateEmpleado({ id, roles, updated_by });
}

/* ============================== Utils públicos ============================ */
export function nombreCorto(emp){
  if (!emp) return "—";
  if (emp.nombre && emp.apellidos) return `${emp.nombre} ${emp.apellidos.split(" ")[0]}`;
  return emp.nombre || emp.apellidos || "—";
}

// /JS/api/requerimientos.js

/* ============================================================================
   CONFIG / CONSTANTES
   ========================================================================== */
const TAG = "[API:Requerimientos]";
export const DEBUG_LOGS = true;              // activa/desactiva logs 
const MAX_PER_PAGE       = 200;              // tope de page size
const DEFAULT_RANGE_DAYS = 90;
const CACHE_TTL_MS       = 60_000;           // cache (1 minuto)

/* Nota: algunos entornos sirven /db/WEB/ y otros /DB/WEB/ */
const API_BASE_LOWER = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/";

/* Endpoints (usamos el lower por defecto; si falla, probamos el upper) */
const API = {
  requerimientos: API_BASE_LOWER + "ixtla01_c_requerimiento.php",
  empleados:      API_BASE_LOWER + "ixtla01_c_empleado.php",
  departamentos:  API_BASE_LOWER + "ixtla01_c_departamento.php",
  updReq:         API_BASE_LOWER + "ixtla01_upd_requerimiento.php",
};

/* ============================================================================
   LOGGING
   ========================================================================== */
const dev = DEBUG_LOGS;
function log (...a){ if (dev) console.log(TAG, ...a); }
function warn(...a){ if (dev) console.warn(TAG, ...a); }
function group(label){ if (dev) console.group?.(label); }
function groupEnd(){ if (dev) console.groupEnd?.(); }

/* ============================================================================
   ESTATUS
   ========================================================================== */
export const ESTATUS = {
  0: { key: "solicitud",  label: "Solicitud",   badge: "badge--neutral" },
  1: { key: "revision",   label: "Revisión",    badge: "badge--info"    },
  2: { key: "asignacion", label: "Asignación",  badge: "badge--info"    },
  3: { key: "proceso",    label: "En proceso",  badge: "badge--warn"    },
  4: { key: "pausado",    label: "Pausado",     badge: "badge--pending" },
  5: { key: "cancelado",  label: "Cancelado",   badge: "badge--error"   },
  6: { key: "finalizado", label: "Finalizado",  badge: "badge--success" },
};
export function isCerrado(r) {
  return r?.estatus === 6 || r?.estatus === 5 || !!r?.cerrado_en;
}

/* ============================================================================
   UTILS BASE
   ========================================================================== */
function getSessionSafe(){ try { return window.Session?.get?.() || null; } catch { return null; } }
function rolesFromSession(){
  const s  = getSessionSafe();
  const rs = Array.isArray(s?.roles) ? s.roles : [];
  const out = rs.map(r => String(r).toUpperCase());
  log("rolesFromSession()", out);
  return out;
}
function isAdminRole(roleCodes){ return (roleCodes || []).includes("ADMIN"); }

function todayISO(){ return new Date().toISOString().slice(0,10); }
function addDaysISO(iso, days){
  const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}

/* Partir nombre completo en nombre / apellidos (heurística simple) */
function splitFullName(full = ""){
  const s = String(full).trim().replace(/\s+/g, " ");
  if (!s) return { nombre: "", apellidos: "" };
  const parts = s.split(" ");
  if (parts.length === 1) return { nombre: parts[0], apellidos: "" };
  return { nombre: parts.slice(0, -1).join(" "), apellidos: parts.slice(-1).join(" ") };
}

/* ============================================================================
   FETCH JSON + FALLBACK DE RUTA (db/WEB vs DB/WEB)
   ========================================================================== */
function altCaseUrl(url){
  // Cambia el casing /db/WEB/ ↔ /DB/WEB/
  if (url.includes("/db/WEB/")) return url.replace("/db/WEB/", "/DB/WEB/");
  if (url.includes("/DB/WEB/")) return url.replace("/DB/WEB/", "/db/WEB/");
  return url;
}

async function postJSONOnce(url, body){
  const t0 = performance.now?.() ?? Date.now();
  group(`${TAG} POST ${url}`);
  log("payload:", body);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type":"application/json", "Accept":"application/json" },
    body: JSON.stringify(body || {})
  });
  const dt = Math.round((performance.now?.() ?? Date.now()) - t0);

  if (!res.ok) {
    const text = await res.text().catch(()=>"(sin cuerpo)");
    warn(`HTTP ${res.status} (${dt}ms) @ ${url} — body:`, text);
    throw new Error(`HTTP ${res.status} @ ${url}`);
  }
  const json = await res.json().catch(() => null);
  log(`OK (${dt}ms)`, { keys: json ? Object.keys(json) : null });
  groupEnd();
  return json;
}

/** Hace POST y si falla por casing, intenta con la ruta alternativa */
async function postJSON(url, body){
  try {
    return await postJSONOnce(url, body);
  } catch (e) {
    // Si es un endpoint bajo /db/WEB/ o /DB/WEB/, intenta la variante alterna
    const alt = altCaseUrl(url);
    if (alt !== url) {
      warn("Reintentando con ruta alterna:", alt);
      try { return await postJSONOnce(alt, body); } catch { /* cae al throw de abajo */ }
    }
    throw e;
  }
}

/* ============================================================================
   CACHE SIMPLE EN MEMORIA
   ========================================================================== */
const _cache = new Map();
function cacheGet(k){
  const v = _cache.get(k);
  if (!v) return null;
  if (Date.now() - v.t > CACHE_TTL_MS) { _cache.delete(k); return null; }
  return v.data;
}
function cacheSet(k, data){ _cache.set(k, { t: Date.now(), data }); }

/* ============================================================================
   EMPLEADOS
   ========================================================================== */
export async function loadEmpleados({ q=null, page_size=200, status_empleado=1 } = {}){
  const key = `emp|${q||""}|${page_size}|${status_empleado}`;
  const hit = cacheGet(key);
  if (hit){ log("loadEmpleados() cache HIT", { key, total: hit.length }); return hit; }

  group(`${TAG} loadEmpleados()`);
  log("params:", { q, page_size, status_empleado, url: API.empleados });

  let page = 1, out = [];
  try {
    while (true) {
      const payload = { q, page, page_size, status_empleado };
      const json = await postJSON(API.empleados, payload);
      const list = json?.data || [];
      const meta = json?.meta || {};
      const total = Number(meta?.total ?? list.length);

      log(`page ${page}`, { received: list.length, total });
      out = out.concat(list);

      if ((page * page_size) >= total) break;
      page++;
      if (page > 50) { warn("safety break @ page>50"); break; }
    }
    cacheSet(key, out);
    log("out length:", out.length);
    groupEnd();
    return out;
  } catch (e) {
    warn("loadEmpleados() error:", e);
    groupEnd();
    throw e;
  }
}

/* Cache específico para /c_empleado por id (para hidratar asignados) */
const _empByIdCache = new Map();
export async function fetchEmpleadoByIdCached(id){
  const empId = Number(id);
  if (!empId) return null;
  if (_empByIdCache.has(empId)) return _empByIdCache.get(empId);

  const payload = { id: empId, status: 1 };
  try {
    const json = await postJSON(API.empleados, payload);
    const data = json?.data;
    const emp  = Array.isArray(data) ? data[0] : data;
    if (emp && emp.id) {
      _empByIdCache.set(empId, emp);
      log("fetchEmpleadoByIdCached HIT", { id: empId, nombre: emp?.nombre, apellidos: emp?.apellidos });
      return emp;
    }
  } catch (e) {
    warn("fetchEmpleadoByIdCached error:", e);
  }
  return null;
}

/* ============================================================================
   REQUERIMIENTOS — LISTADOS
   ========================================================================== */
function pickFiltros(f){
  const out = {};
  if (f?.estatus       != null) out.estatus       = f.estatus;
  if (f?.prioridad     != null) out.prioridad     = f.prioridad;
  if (f?.canal         != null) out.canal         = f.canal;
  if (f?.q)                 out.q             = f.q;
  if (f?.created_from)      out.created_from  = f.created_from;
  if (f?.created_to)        out.created_to    = f.created_to;
  if (f?.all         != null) out.all         = !!f.all;
  if (f?.per_page    != null) out.per_page    = Math.min(MAX_PER_PAGE, f.per_page);
  if (f?.page        != null) out.page        = f.page;
  return out;
}

export async function listByAsignado(asignadoId, filtros={}){
  const body = { asignado_a: asignadoId, per_page: MAX_PER_PAGE, ...pickFiltros(filtros) };
  group(`${TAG} listByAsignado(${asignadoId})`); log("body:", body);
  const json = await postJSON(API.requerimientos, body);
  const arr  = json?.data || [];
  log("received:", arr.length);
  groupEnd();
  return arr;
}

export async function listByDepto(departamentoId, filtros={}){
  const body = { departamento_id: departamentoId, per_page: MAX_PER_PAGE, ...pickFiltros(filtros) };
  group(`${TAG} listByDepto(${departamentoId})`); log("body:", body);
  const json = await postJSON(API.requerimientos, body);
  const arr  = json?.data || [];
  log("received:", arr.length);
  groupEnd();
  return arr;
}

/** Une, deduplica y ordena por fecha de creación desc (fallback id) */
function mergeDedupOrder(lists, { order="created_at_desc" } = {}){
  const map = new Map();
  lists.flat().forEach(r => {
    const key = r?.id ?? r?.folio ?? `${Math.random()}`;
    if (!map.has(key)) map.set(key, r);
  });
  let arr = Array.from(map.values());
  if (order === "created_at_desc") {
    arr.sort((a,b) =>
      String(b.created_at).localeCompare(String(a.created_at)) ||
      ((b.id||0) - (a.id||0))
    );
  }
  log("mergeDedupOrder()", { inputLists: lists.length, out: arr.length });
  return arr;
}

/* ============================================================================
   SCOPE (ADMIN vs no-ADMIN)
   ========================================================================== */
async function listAllRequerimientos({ perPage=MAX_PER_PAGE, maxPages=50 } = {}){
  group(`${TAG} listAllRequerimientos()`);
  const all = [];
  try {
    for (let page=1; page<=maxPages; page++) {
      const body = { page, per_page: perPage };
      log("page body:", body);
      const json = await postJSON(API.requerimientos, body);
      const arr = json?.data || [];
      all.push(...arr);
      log(`page ${page} received:`, arr.length);
      if (arr.length < perPage) { log("last page reached"); break; }
    }
    log("TOTAL:", all.length);
    groupEnd();
    return all;
  } catch (e) {
    warn("listAllRequerimientos() error:", e);
    groupEnd();
    throw e;
  }
}

export async function planScope({ viewerId, viewerDeptId=null, empleadosAll=null, rangeDays=DEFAULT_RANGE_DAYS } = {}){
  if (!viewerId) throw new Error("planScope(): viewerId requerido");

  const sessionRoles = rolesFromSession();
  const admin = isAdminRole(sessionRoles);

  if (admin) {
    const created_to   = todayISO();
    const created_from = addDaysISO(created_to, -Math.abs(rangeDays));
    const plan = {
      viewerId, role: "ADMIN", isAdmin: true, isPresidencia:false,
      mineId: viewerId, teamIds: [], deptIds: [],
      defaultRange: { created_from, created_to }
    };
    log("planScope()[ADMIN]", plan);
    return plan;
  }

  // No ADMIN → construir jerarquía
  const empleados = empleadosAll || await loadEmpleados();
  const viewer    = empleados.find(e => e.id === viewerId) || null;

  // Rol a partir del empleado; si no hay match, cae a ANALISTA
  const empRoles = viewer?.cuenta?.roles?.map(r => r.codigo) || sessionRoles || [];
  let role = "ANALISTA";
  if (empRoles.includes("DIRECTOR")) role = "DIRECTOR";
  else if (empRoles.includes("JEFE")) role = "JEFE";
  else if (empRoles.includes("ANALISTA")) role = "ANALISTA";

  const teamIds = buildTeamIds(viewerId, role, empleados);
  const deptIds = viewerDeptId ? [viewerDeptId] : (viewer?.departamento_id ? [viewer.departamento_id] : []);

  const created_to   = todayISO();
  const created_from = addDaysISO(created_to, -Math.abs(rangeDays));

  const plan = {
    viewerId, role, isAdmin:false, isPresidencia:false,
    mineId: viewerId, teamIds, deptIds,
    defaultRange: { created_from, created_to }
  };
  log("planScope()", plan);
  return plan;
}

export async function fetchScope({ plan, filtros={} }){
  if (!plan) throw new Error("fetchScope(): plan requerido");

  if (plan.isAdmin) {
    const all   = await listAllRequerimientos({ perPage: MAX_PER_PAGE });
    const items = mergeDedupOrder([all], { order: "created_at_desc" });
    log("fetchScope[ADMIN] done", { total: items.length });
    return { items, counts:{ mine:0, team:0, dept:0 }, filtros };
  }

  const useFiltros = { ...filtros };
  if (!useFiltros.created_from && !useFiltros.created_to && (plan.deptIds.length > 1 || plan.teamIds.length > 5)) {
    Object.assign(useFiltros, plan.defaultRange);
  }

  group(`${TAG} fetchScope() no-ADMIN`);
  log("plan:", plan);
  log("filtros:", useFiltros);

  const promises = [];
  if (plan.mineId)  promises.push(listByAsignado(plan.mineId, useFiltros));
  for (const subId of (plan.teamIds || [])) promises.push(listByAsignado(subId, useFiltros));
  for (const depId of (plan.deptIds || [])) promises.push(listByDepto(depId, useFiltros));

  const results = await Promise.allSettled(promises);
  const okLists = results.filter(r => r.status === "fulfilled").map(r => r.value || []);
  const items   = mergeDedupOrder(okLists, { order: "created_at_desc" });

  const counts = {
    mine: (okLists[0] || []).length,
    team: (plan.teamIds?.length || 0)
      ? okLists.slice(1, 1 + plan.teamIds.length).reduce((a, l) => a + (l?.length || 0), 0)
      : 0,
    dept: okLists.slice(1 + (plan.teamIds?.length || 0)).reduce((a, l) => a + (l?.length || 0), 0)
  };

  const statuses = results.map(r => r.status + (r.status === "rejected" ? `: ${r.reason}` : ""));
  log("fetchScope results:", { totalItems: items.length, counts, statuses });
  groupEnd();

  return { items, counts, filtros: useFiltros };
}

/* ============================================================================
   UPDATES
   ========================================================================== */
export async function updateRequerimiento(patch = {}){
  if (!patch?.id) throw new Error("updateRequerimiento(): falta 'id'");
  group(`${TAG} updateRequerimiento(${patch.id})`); log("patch:", patch);
  const json = await postJSON(API.updReq, patch);
  if (json?.ok === false) {
    warn("updateRequerimiento() backend error:", json?.error);
    groupEnd();
    throw new Error(json?.error || "Error al actualizar requerimiento");
  }
  const data = json?.data || json;
  log("updated:", { id: data?.id, estatus: data?.estatus, asignado_a: data?.asignado_a });
  groupEnd();
  return data;
}

export async function reassignReq(id, asignado_a, { updated_by=null } = {}) {
  return updateRequerimiento({ id, asignado_a, ...(updated_by ? { updated_by } : {}) });
}
export async function setPrioridadReq(id, prioridad, { updated_by=null } = {}) {
  return updateRequerimiento({ id, prioridad, ...(updated_by ? { updated_by } : {}) });
}
export async function transferirDeptoReq(id, departamento_id, { tramite_id=null, updated_by=null } = {}) {
  const patch = { id, departamento_id };
  if (tramite_id != null) patch.tramite_id = tramite_id;
  if (updated_by)         patch.updated_by = updated_by;
  return updateRequerimiento(patch);
}
export async function setEstatusReq(id, estatus, opts = {}) {
  const patch = { id, estatus };
  if (opts.cerrado_en    != null) patch.cerrado_en   = opts.cerrado_en;
  if (opts.clear_cerrado === true) patch.clear_cerrado = true;
  if (opts.updated_by    != null) patch.updated_by   = opts.updated_by;
  return updateRequerimiento(patch);
}
export async function finalizarReq(id, { cerrado_en=null, updated_by=null } = {}) {
  const patch = { id, estatus: 6 };
  if (cerrado_en)      patch.cerrado_en = cerrado_en;
  if (updated_by != null) patch.updated_by = updated_by;
  return updateRequerimiento(patch);
}
export async function cancelarReq(id, { updated_by=null } = {}) {
  const patch = { id, estatus: 5 };
  if (updated_by != null) patch.updated_by = updated_by;
  return updateRequerimiento(patch);
}

/* ============================================================================
   HIDRATACIÓN DE ASIGNADO (cuando solo llega asignado_a)
   ========================================================================== */
/**
 * Completa `asignado_nombre_completo` cuando falte, buscando por `asignado_a`.
 * No muta tu arreglo original; regresa un NUEVO arreglo con los campos hidratados.
 */
export async function hydrateAsignadoFields(rawList = []){
  const needIds = new Set();
  for (const r of rawList) {
    const hasId   = r?.asignado_a != null && Number(r.asignado_a) > 0;
    const missing = !r?.asignado_nombre_completo || String(r.asignado_nombre_completo).trim() === "";
    if (hasId && missing) needIds.add(Number(r.asignado_a));
  }

  const lookups = await Promise.all(
    Array.from(needIds).map(async (id) => [id, await fetchEmpleadoByIdCached(id)])
  );
  const byId = new Map(lookups);

  const out = rawList.map((r) => {
    const hasId   = r?.asignado_a != null && Number(r.asignado_a) > 0;
    const missing = !r?.asignado_nombre_completo || String(r.asignado_nombre_completo).trim() === "";
    if (hasId && missing) {
      const emp = byId.get(Number(r.asignado_a));
      if (emp) {
        const full = [emp?.nombre, emp?.apellidos].filter(Boolean).join(" ").trim();
        return { ...r, asignado_nombre_completo: full };
      }
    }
    return r;
  });

  log("[hydrateAsignadoFields]", {
    solicitados: needIds.size,
    completados: Array.from(byId.values()).filter(Boolean).length,
    cacheSize: _empByIdCache.size,
  });

  return out;
}

/* ============================================================================
   PRESENTACIÓN (parseo a forma de UI)
   ========================================================================== */
/** parseReq: adapta un registro crudo para la UI */
export function parseReq(raw){
  const e = ESTATUS[raw?.estatus] || { key: "desconocido", label: "—", badge: "badge" };

  // 1) Candidatos que suelen venir del backend
  const fullFromApi =
    (typeof raw?.asignado_nombre_completo === "string" && raw.asignado_nombre_completo.trim()) ||
    (typeof raw?.asignado_fullname        === "string" && raw.asignado_fullname.trim()) ||
    "";

  const candNombre = (typeof raw?.asignado_nombre    === "string" && raw.asignado_nombre.trim())    || "";
  const candApe    = (typeof raw?.asignado_apellidos === "string" && raw.asignado_apellidos.trim()) || "";

  // 2) Normalización
  let asignadoNombre    = candNombre;
  let asignadoApellidos = candApe;

  if (!asignadoNombre && fullFromApi) {
    const { nombre, apellidos } = splitFullName(fullFromApi);
    asignadoNombre    = nombre;
    asignadoApellidos = asignadoApellidos || apellidos;
  }

  asignadoNombre    = (asignadoNombre || "").replace(/\s+/g, " ").trim();
  asignadoApellidos = (asignadoApellidos || "").replace(/\s+/g, " ").trim();

  const asignadoFull =
    (asignadoNombre || asignadoApellidos)
      ? [asignadoNombre, asignadoApellidos].filter(Boolean).join(" ").trim()
      : (fullFromApi || (raw?.asignado_a != null ? `#${raw.asignado_a}` : "")).trim();

  if (!asignadoNombre && !fullFromApi && dev) {
    // Log de ayuda para detectar por qué quedó "Sin asignar"
    console.warn(`${TAG} parseReq — sin nombre de asignado`, {
      id: raw?.id, asignado_a: raw?.asignado_a,
      asignado_nombre: raw?.asignado_nombre,
      asignado_apellidos: raw?.asignado_apellidos,
      asignado_nombre_completo: raw?.asignado_nombre_completo
    });
  }

  return {
    id:    raw?.id,
    folio: raw?.folio,

    departamento: (raw?.departamento_nombre || "").trim() || String(raw?.departamento_id ?? "—"),
    tramite:      (raw?.tramite_nombre      || "").trim() || String(raw?.tramite_id      ?? "—"),

    asunto:    raw?.asunto || "—",
    prioridad: raw?.prioridad === 1 ? "Baja" : raw?.prioridad === 2 ? "Media" : raw?.prioridad === 3 ? "Alta" : "—",
    canal:     (raw?.canal != null ? `Canal ${raw.canal}` : "—"),

    contacto:  raw?.contacto_nombre   || "—",
    tel:       raw?.contacto_telefono || "—",
    mail:      raw?.contacto_email    || "—",

    creado:      raw?.created_at,
    actualizado: raw?.updated_at,
    cerrado:     raw?.cerrado_en,

    // Variantes de asignado
    asignadoNombre:   asignadoNombre || (fullFromApi ? (splitFullName(fullFromApi).nombre || fullFromApi) : ""),
    asignadoApellidos: asignadoApellidos || "",
    asignadoFull:     asignadoFull || "Sin asignar",

    // Compat con Home: mostrar SOLO nombre (o full si no hubo split)
    asignado: (asignadoNombre || fullFromApi || "").trim() || "Sin asignar",

    estatus:  { code: raw?.estatus, ...e },
    isCerrado: isCerrado(raw),
    raw
  };
}

/* ============================================================================
   TRÁMITES (catálogo)
   ========================================================================== */
const API_TRAMITES = API_BASE_LOWER + "ixtla01_c_tramite.php";

export async function loadTramitesCatalog(opts = {}){
  const body = {
    estatus: 1,
    all: true,
    ...(opts.departamento_id ? { departamento_id: opts.departamento_id } : {})
  };
  try {
    const res = await postJSON(API_TRAMITES, body);
    const arr = res?.data || res || [];
    return arr.map(x => ({
      id: Number(x.id),
      nombre: String(x.nombre || "Otros").replace(/\.\s*$/, "").trim()
    })).filter(t => t.nombre);
  } catch (e) {
    warn("[Trámites] catálogo no disponible:", e);
    return [];
  }
}

/* ============================================================================
   HELPERS DE JERARQUÍA (equipos)
   ========================================================================== */
function buildIndexByManager(empleados){
  const byManager = new Map();
  empleados.forEach(e => {
    const rep = e?.cuenta?.reporta_a ?? null;
    if (rep == null) return;
    if (!byManager.has(rep)) byManager.set(rep, []);
    byManager.get(rep).push(e.id);
  });
  return byManager;
}

function buildTeamIds(viewerId, role, empleados){
  const byManager = buildIndexByManager(empleados);
  const direct = byManager.get(viewerId) || [];
  log("buildTeamIds()", { viewerId, role, direct });

  if (role === "JEFE") return direct.slice();

  if (role === "DIRECTOR") {
    const out = new Set();
    const q = [...direct];
    while (q.length) {
      const cur = q.shift();
      if (out.has(cur)) continue;
      out.add(cur);
      const next = byManager.get(cur) || [];
      next.forEach(n => q.push(n));
    }
    log("buildTeamIds() deep", { total: out.size });
    return Array.from(out);
  }
  return [];
}

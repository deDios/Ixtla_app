// /JS/api/requerimientos.js

/* CON */
const TAG = "[API:Requerimientos]";

const API_BASE = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/";

const API = {
  requerimientos: API_BASE + "ixtla01_c_requerimiento.php",
  empleados:      API_BASE + "ixtla01_c_empleado.php",
  departamentos:  API_BASE + "ixtla01_c_departamento.php",
  updReq:         API_BASE + "ixtla01_upd_requerimiento.php",
};

const MAX_PER_PAGE        = 200;     // tope de page size
const DEFAULT_RANGE_DAYS  = 90;      
const CACHE_TTL_MS        = 60_000;  // cache (1 minuto)

/* ============================ Estatus ============================ */
export const ESTATUS = {
  0: { key: "solicitud",   label: "Solicitud",   badge: "badge--neutral" },
  1: { key: "revision",    label: "Revisión",    badge: "badge--info" },
  2: { key: "asignacion",  label: "Asignación",  badge: "badge--info" },
  3: { key: "proceso",     label: "En proceso",  badge: "badge--warn" },
  4: { key: "pausado",     label: "Pausado",     badge: "badge--pending" },
  5: { key: "cancelado",   label: "Cancelado",   badge: "badge--error" },
  6: { key: "finalizado",  label: "Finalizado",  badge: "badge--success" },
};
export function isCerrado(r) {
  return r?.estatus === 6 || r?.estatus === 5 || !!r?.cerrado_en;
}

/* ========================== Logging utils ======================== */
const dev = true; 
function log(...a){ if (dev) console.log(TAG, ...a); }
function warn(...a){ if (dev) console.warn(TAG, ...a); }
function group(label){ if (dev) console.group?.(label); }
function groupEnd(){ if (dev) console.groupEnd?.(); }

/* =========================== Utils base ========================== */
function getSessionSafe() {
  try { return window.Session?.get?.() || null; } catch { return null; }
}
function rolesFromSession() {
  const s = getSessionSafe();
  const rs = Array.isArray(s?.roles) ? s.roles : [];
  const out = rs.map(r => String(r).toUpperCase());
  log("rolesFromSession()", out);
  return out;
}
function isAdminRole(roleCodes) {
  return (roleCodes || []).includes("ADMIN");
}

async function postJSON(url, body) {
  const t0 = performance.now?.() ?? Date.now();
  group(`${TAG} POST ${url}`);
  log("payload:", body);
  try {
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
  } catch (e) {
    groupEnd();
    throw e;
  }
}

function todayISO() { return new Date().toISOString().slice(0,10); }
function addDaysISO(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}

/* ============================ Cache ============================== */
const _cache = new Map();
function cacheGet(k) {
  const v = _cache.get(k);
  if (!v) return null;
  if (Date.now() - v.t > CACHE_TTL_MS) { _cache.delete(k); return null; }
  return v.data;
}
function cacheSet(k, data) { _cache.set(k, { t: Date.now(), data }); }

/* ======================= Empleados / Org ========================= */
export async function loadEmpleados({ q=null, page_size=200, status_empleado=1 } = {}) {
  const key = `emp|${q||""}|${page_size}|${status_empleado}`;
  const hit = cacheGet(key);
  if (hit) { log("loadEmpleados() cache HIT", { key, total: hit.length }); return hit; }

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

// Construye índice reporta_a -> [empleado_id]
function buildIndexByManager(empleados) {
  const byManager = new Map();
  empleados.forEach(e => {
    const rep = e?.cuenta?.reporta_a ?? null;
    if (rep == null) return;
    if (!byManager.has(rep)) byManager.set(rep, []);
    byManager.get(rep).push(e.id);
  });
  return byManager;
}

/** Devuelve ids subordinados directos o toda la rama según rol */
function buildTeamIds(viewerId, role, empleados) {
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

/* ======================== Reqs unitarias ========================= */
function pickFiltros(f) {
  const out = {};
  if (f?.estatus != null) out.estatus = f.estatus;
  if (f?.prioridad != null) out.prioridad = f.prioridad;
  if (f?.canal != null) out.canal = f.canal;
  if (f?.q) out.q = f.q;
  if (f?.created_from) out.created_from = f.created_from;
  if (f?.created_to) out.created_to = f.created_to;
  if (f?.all != null) out.all = !!f.all;
  if (f?.per_page != null) out.per_page = Math.min(MAX_PER_PAGE, f.per_page);
  if (f?.page != null) out.page = f.page;
  return out;
}

export async function listByAsignado(asignadoId, filtros={}) {
  const body = { asignado_a: asignadoId, per_page: MAX_PER_PAGE, ...pickFiltros(filtros) };
  group(`${TAG} listByAsignado(${asignadoId})`);
  log("body:", body);
  const json = await postJSON(API.requerimientos, body);
  const arr = json?.data || [];
  log("received:", arr.length);
  groupEnd();
  return arr;
}

export async function listByDepto(departamentoId, filtros={}) {
  const body = { departamento_id: departamentoId, per_page: MAX_PER_PAGE, ...pickFiltros(filtros) };
  group(`${TAG} listByDepto(${departamentoId})`);
  log("body:", body);
  const json = await postJSON(API.requerimientos, body);
  const arr = json?.data || [];
  log("received:", arr.length);
  groupEnd();
  return arr;
}

/* ==================== Unión / orden y dedupe ===================== */
function mergeDedupOrder(lists, { order="created_at_desc" } = {}) {
  const map = new Map();
  lists.flat().forEach(r => {
    const key = r?.id ?? r?.folio ?? `${Math.random()}`;
    if (!map.has(key)) map.set(key, r);
  });
  let arr = Array.from(map.values());
  if (order === "created_at_desc") {
    arr.sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)) || ((b.id||0) - (a.id||0)));
  }
  log("mergeDedupOrder()", { inputLists: lists.length, out: arr.length });
  return arr;
}

/* ======================== ADMIN: global ========================== */
async function listAllRequerimientos({ perPage=MAX_PER_PAGE, maxPages=50 } = {}) {
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

/* ============================ Scope ============================== */
/**
 * planScope: construye el plan de alcance (ADMIN global, o subordinados+depto)
 * @param {number} viewerId
 * @param {number|null} viewerDeptId  — pásalo desde Home (Session.departamento_id)
 */
export async function planScope({ viewerId, viewerDeptId=null, empleadosAll=null, rangeDays=DEFAULT_RANGE_DAYS } = {}) {
  if (!viewerId) throw new Error("planScope(): viewerId requerido");

  const sessionRoles = rolesFromSession();
  const admin = isAdminRole(sessionRoles);

  if (admin) {
    const created_to = todayISO();
    const created_from = addDaysISO(created_to, -Math.abs(rangeDays));
    const plan = {
      viewerId,
      role: "ADMIN",
      isAdmin: true,
      isPresidencia: false,
      mineId: viewerId,
      teamIds: [],
      deptIds: [],
      defaultRange: { created_from, created_to }
    };
    log("planScope()[ADMIN]", plan);
    return plan;
  }

  // No ADMIN → construir jerarquía
  const empleados = empleadosAll || await loadEmpleados();
  const viewer = empleados.find(e => e.id === viewerId) || null;

  // Rol a partir del empleado; si no hay match, cae a ANALISTA
  const empRoles = viewer?.cuenta?.roles?.map(r => r.codigo) || sessionRoles || [];
  let role = "ANALISTA";
  if (empRoles.includes("DIRECTOR")) role = "DIRECTOR";
  else if (empRoles.includes("JEFE")) role = "JEFE";
  else if (empRoles.includes("ANALISTA")) role = "ANALISTA";

  const teamIds = buildTeamIds(viewerId, role, empleados);
  const deptIds = viewerDeptId ? [viewerDeptId] : (viewer?.departamento_id ? [viewer.departamento_id] : []);

  const created_to = todayISO();
  const created_from = addDaysISO(created_to, -Math.abs(rangeDays));

  const plan = {
    viewerId,
    role,
    isAdmin:false,
    isPresidencia:false,
    mineId: viewerId,
    teamIds,
    deptIds,
    defaultRange: { created_from, created_to }
  };
  log("planScope()", plan);
  return plan;
}

/**
 * fetchScope: ejecuta el plan
 * - ADMIN: baja todo (paginado) y ordena
 * - otros: combina mine + team + dept
 */
export async function fetchScope({ plan, filtros={} }) {
  if (!plan) throw new Error("fetchScope(): plan requerido");

  if (plan.isAdmin) {
    const all = await listAllRequerimientos({ perPage: MAX_PER_PAGE });
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
  if (plan.mineId) promises.push(listByAsignado(plan.mineId, useFiltros));
  for (const subId of (plan.teamIds || [])) promises.push(listByAsignado(subId, useFiltros));
  for (const depId of (plan.deptIds || [])) promises.push(listByDepto(depId, useFiltros));

  const results = await Promise.allSettled(promises);
  const okLists = results.filter(r => r.status === "fulfilled").map(r => r.value || []);
  const items = mergeDedupOrder(okLists, { order: "created_at_desc" });

  const counts = {
    mine: (okLists[0] || []).length,
    team: (plan.teamIds?.length || 0) ? okLists.slice(1, 1 + plan.teamIds.length).reduce((a, l) => a + (l?.length || 0), 0) : 0,
    dept: okLists.slice(1 + (plan.teamIds?.length || 0)).reduce((a, l) => a + (l?.length || 0), 0)
  };

  const statuses = results.map((r, i) => r.status + (r.status === "rejected" ? `: ${r.reason}` : ""));
  log("fetchScope results:", { totalItems: items.length, counts, statuses });
  groupEnd();

  return { items, counts, filtros: useFiltros };
}

/* ============================ Updates ============================ */
export async function updateRequerimiento(patch = {}) {
  if (!patch?.id) throw new Error("updateRequerimiento(): falta 'id'");
  group(`${TAG} updateRequerimiento(${patch.id})`);
  log("patch:", patch);
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
  if (updated_by) patch.updated_by = updated_by;
  return updateRequerimiento(patch);
}
export async function setEstatusReq(id, estatus, opts = {}) {
  const patch = { id, estatus };
  if (opts.cerrado_en != null) patch.cerrado_en = opts.cerrado_en;
  if (opts.clear_cerrado === true) patch.clear_cerrado = true;
  if (opts.updated_by != null) patch.updated_by = opts.updated_by;
  return updateRequerimiento(patch);
}
export async function finalizarReq(id, { cerrado_en=null, updated_by=null } = {}) {
  const patch = { id, estatus: 6 };
  if (cerrado_en) patch.cerrado_en = cerrado_en;
  if (updated_by != null) patch.updated_by = updated_by;
  return updateRequerimiento(patch);
}
export async function cancelarReq(id, { updated_by=null } = {}) {
  const patch = { id, estatus: 5 };
  if (updated_by != null) patch.updated_by = updated_by;
  return updateRequerimiento(patch);
}

/* ========================= Presentación ========================= */
function mapPrioridad(p) {
  if (p === 1) return "Baja";
  if (p === 2) return "Media";
  if (p === 3) return "Alta";
  return "—";
}
function mapCanal(c) {
  return (c != null ? `Canal ${c}` : "—");
}

/** parseReq: adapta un registro crudo para la UI */
export function parseReq(raw) {
  const e = ESTATUS[raw?.estatus] || { key: "desconocido", label: "—", badge: "badge" };
  return {
    id: raw?.id,
    folio: raw?.folio,
    departamento: raw?.departamento_nombre || raw?.departamento_id,
    tramite: raw?.tramite_nombre || raw?.tramite_id,
    asunto: raw?.asunto || "—",
    prioridad: mapPrioridad(raw?.prioridad),
    canal: mapCanal(raw?.canal),
    contacto: raw?.contacto_nombre || "—",
    tel: raw?.contacto_telefono || "—",
    mail: raw?.contacto_email || "—",
    creado: raw?.created_at,
    actualizado: raw?.updated_at,
    cerrado: raw?.cerrado_en,
    asignado: raw?.asignado_nombre_completo || raw?.asignado_a || "Sin asignar",
    estatus: { code: raw?.estatus, ...e },
    isCerrado: isCerrado(raw),
    raw
  };
}

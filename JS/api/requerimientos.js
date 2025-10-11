// /JS/api/requerimientos.js
const TAG = "[API:Requerimientos]";

/* CON */
const API_BASE =
  window.API?.BASE ||
  "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/";

const API = {
  // Consulta de requerimientos
  requerimientos: window.API?.requerimientos || (API_BASE + "c_requerimiento.php"),
  // Consulta de empleados 
  empleados:      window.API?.empleados      || (API_BASE + "c_empleado.php"),
  // Consulta de departamentos
  departamentos:  window.API?.departamentos  || (API_BASE + "c_departamento.php"),
  // Update de requerimiento 
  updReq:         window.API?.updRequerimiento || (API_BASE + "ixtla01_upd_requerimiento.php"),
};

const MAX_PER_PAGE = 200;                 // cantidad por pagina
const DEFAULT_RANGE_DAYS = 90;
const CACHE_TTL_MS = 60 * 1000;

/* Estatus */
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

/* Cache */
const _cache = new Map();
function cacheGet(k) {
  const v = _cache.get(k);
  if (!v) return null;
  if (Date.now() - v.t > CACHE_TTL_MS) { _cache.delete(k); return null; }
  return v.data;
}
function cacheSet(k, data) { _cache.set(k, { t: Date.now(), data }); }

/* Utils HTTP / fechas */
async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(body || {})
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
  return res.json();
}
function todayISO() { return new Date().toISOString().slice(0,10); }
function addDaysISO(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}

/* Empleados y Organizacion */
export async function loadEmpleados({ q=null, page_size=200, status_empleado=1 } = {}) {
  const key = `emp|${q||""}|${page_size}|${status_empleado}`;
  const hit = cacheGet(key); if (hit) return hit;

  let page = 1, out = [];
  while (true) {
    const payload = { q, page, page_size, status_empleado };
    const json = await postJSON(API.empleados, payload);
    const list = json?.data || [];
    out = out.concat(list);
    const meta = json?.meta || {};
    const total = meta?.total ?? list.length;
    if ((page * page_size) >= total) break;
    page++;
    if (page > 25) break; 
  }
  cacheSet(key, out);
  return out;
}

function resolveViewerRole(viewer, { departamentosAll=[] } = {}) {
  const roles = viewer?.cuenta?.roles?.map(r => r.codigo) || [];
  const isAdmin = roles.includes("ADMIN");
  const deptoId = viewer?.departamento_id ?? null;

  const isPresidencia = (() => {
    const dep = departamentosAll.find(d => d?.id === deptoId || (d?.nombre||"").toLowerCase() === "presidencia");
    if (!dep) return false;
    return (dep?.nombre||"").toLowerCase() === "presidencia";
  })();

  let role = "OTRO";
  if (roles.includes("DIRECTOR")) role = "DIRECTOR";
  else if (roles.includes("JEFE")) role = "JEFE";
  else if (roles.includes("ANALISTA")) role = "ANALISTA";

  return { role, deptoId, isAdmin, isPresidencia };
}

function buildTeamIds(viewerId, role, empleados) {
  const byManager = new Map();
  empleados.forEach(e => {
    const rep = e?.cuenta?.reporta_a ?? null;
    if (rep == null) return;
    if (!byManager.has(rep)) byManager.set(rep, []);
    byManager.get(rep).push(e.id);
  });

  const direct = byManager.get(viewerId) || [];
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
    return Array.from(out);
  }
  return [];
}

async function buildDeptIds({ viewerId, role, isAdmin, isPresidencia, viewerDeptId }) {
  try {
    const all = API.departamentos
      ? (await postJSON(API.departamentos, { page:1, page_size:500 }))?.data || []
      : [];
    if (isAdmin || isPresidencia) return all.map(d => d.id);
    if (role === "DIRECTOR") {
      return all
        .filter(d => (d.director === viewerId) || (d.director_id === viewerId))
        .map(d => d.id);
    }
    return viewerDeptId ? [viewerDeptId] : [];
  } catch (e) {
    console.warn(TAG, "buildDeptIds error (fallback a depto propio):", e);
    return viewerDeptId ? [viewerDeptId] : [];
  }
}

/* Requerimientos unitarios */
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
  console.log(TAG, "listByAsignado()", { asignadoId, body }); // LOG 
  const json = await postJSON(API.requerimientos, body);
  return json?.data || [];
}

export async function listByDepto(departamentoId, filtros={}) {
  const body = { departamento_id: departamentoId, per_page: MAX_PER_PAGE, ...pickFiltros(filtros) };
  console.log(TAG, "listByDepto()", { departamentoId, body }); // LOG 
  const json = await postJSON(API.requerimientos, body);
  return json?.data || [];
}

/* concat / dedup / orden */
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
  return arr;
}

/* plan + fetch */
export async function planScope({ viewerId, empleadosAll=null, departamentosAll=null, rangeDays=DEFAULT_RANGE_DAYS } = {}) {
  if (!viewerId) throw new Error("planScope(): viewerId requerido");
  const empleados = empleadosAll || await loadEmpleados();
  const departamentos = departamentosAll || (API.departamentos ? (await postJSON(API.departamentos, { page:1, page_size:500 }))?.data || [] : []);
  const viewer = empleados.find(e => e.id === viewerId);
  if (!viewer) throw new Error("planScope(): viewer no encontrado");

  const roleInfo = resolveViewerRole(viewer, { departamentosAll: departamentos });
  const { role, deptoId, isAdmin, isPresidencia } = roleInfo;
  const teamIds = buildTeamIds(viewerId, role, empleados);
  const deptIds = await buildDeptIds({ viewerId, role, isAdmin, isPresidencia, viewerDeptId: deptoId });

  const created_to = todayISO();
  const created_from = addDaysISO(created_to, -Math.abs(rangeDays));

  const plan = {
    viewerId,
    role,
    isAdmin,
    isPresidencia,
    mineId: viewerId,
    teamIds,
    deptIds,
    defaultRange: { created_from, created_to }
  };
  console.log(TAG, "planScope()", plan); // LOG 3
  return plan;
}

export async function fetchScope({ plan, filtros={} }) {
  if (!plan) throw new Error("fetchScope(): plan requerido");
  const isGlobal = plan.isAdmin || plan.isPresidencia;

  const useFiltros = { ...filtros };
  if (!useFiltros.created_from && !useFiltros.created_to && (isGlobal || plan.deptIds.length > 1 || plan.teamIds.length > 5)) {
    Object.assign(useFiltros, plan.defaultRange);
  }

  const promises = [];

  // mine
  if (plan.mineId) promises.push(listByAsignado(plan.mineId, useFiltros));

  // team
  for (const subId of (plan.teamIds || [])) {
    promises.push(listByAsignado(subId, useFiltros));
  }

  // dept
  for (const depId of (plan.deptIds || [])) {
    promises.push(listByDepto(depId, useFiltros));
  }

  const results = await Promise.allSettled(promises);
  const okLists = results.filter(r => r.status === "fulfilled").map(r => r.value || []);
  const items = mergeDedupOrder(okLists, { order: "created_at_desc" });

  const counts = {
    mine: (okLists[0] || []).length,
    team: (plan.teamIds?.length || 0) ? sumLengths(okLists.slice(1, 1 + plan.teamIds.length)) : 0,
    dept: sumLengths(okLists.slice(1 + (plan.teamIds?.length || 0)))
  };

  console.log(TAG, "fetchScope() done", {
    total: items.length,
    counts,
    filtros: useFiltros
  }); // LOG 

  return { items, counts, filtros: useFiltros };
}
function sumLengths(arr) { return arr.reduce((a, l) => a + (l?.length || 0), 0); }

/* update (usa ixtla01_upd_requerimiento.php) */
export async function updateRequerimiento(patch = {}) {
  if (!patch?.id) throw new Error("updateRequerimiento(): falta 'id'");
  console.log(TAG, "updateRequerimiento()", patch); // LOG update
  const json = await postJSON(API.updReq, patch);
  if (json?.ok === false) throw new Error(json?.error || "Error al actualizar requerimiento");
  return json?.data || json;
}

export async function reassignReq(id, asignado_a, { updated_by=null } = {}) {
  return updateRequerimiento({ id, asignado_a, ...(updated_by ? { updated_by } : {}) });
}

export async function setPrioridadReq(id, prioridad, { updated_by=null } = {}) {
  return updateRequerimiento({ id, prioridad, ...(updated_by ? { updated_by } : {}) });
}

export async function transferirDeptoReq(id, departamento_id, { tramite_id=null, updated_by=null } = {}) {
  // Si mandas tramite_id, el server valida coherencia y ajusta el depto si hace falta
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
  // delete
  const patch = { id, estatus: 5 };
  if (updated_by != null) patch.updated_by = updated_by;
  return updateRequerimiento(patch);
}

/* Helpers de presentacion */
export function parseReq(raw) {
  const e = ESTATUS[raw?.estatus] || { key: "desconocido", label: "—", badge: "badge" };
  return {
    id: raw?.id,
    folio: raw?.folio,
    departamento: raw?.departamento_nombre || raw?.departamento_id,
    tramite: raw?.tramite_nombre || raw?.tramite_id,
    asunto: raw?.asunto || "—",
    prioridad: raw?.prioridad ?? null,
    canal: raw?.canal ?? null,
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

// /JS/api/procesos.js
import { API } from "./endpoints.js";
import { postJSON } from "./http.js";

/**
 * Crea un proceso de requerimiento.
 * @param {{requerimiento_id:number|string, empleado_id?:number|string|null, descripcion?:string, status?:number, created_by?:number|string}} payload
 */
export function createProceso(payload) {
  const body = {
    requerimiento_id: payload.requerimiento_id,
    empleado_id: payload.empleado_id ?? null,
    descripcion: payload.descripcion ?? null,
    status: payload.status ?? 1,
    created_by: payload.created_by ?? payload.empleado_id ?? null,
  };
  return postJSON(API.PROCESOS.CREATE, body);
}

/**
 * Actualiza un proceso.
 * @param {{id:number|string, descripcion?:string, status?:number, empleado_id?:number|string|null, updated_by:number|string}} payload
 */
export function updateProceso(payload) {
  const body = {
    id: payload.id,
    descripcion: payload.descripcion,
    status: payload.status,
    empleado_id: payload.empleado_id ?? null,
    updated_by: payload.updated_by,
  };
  return postJSON(API.PROCESOS.UPDATE, body);
}

/**
 * Lista procesos por requerimiento (paginado).
 * @param {{requerimiento_id:number|string, status?:number, page?:number, page_size?:number}} q
 */
export function listProcesos(q) {
  const body = {
    requerimiento_id: q.requerimiento_id,
    status: q.status ?? 1,
    page: q.page ?? 1,
    page_size: q.page_size ?? 100,
  };
  return postJSON(API.PROCESOS.LIST, body);
}

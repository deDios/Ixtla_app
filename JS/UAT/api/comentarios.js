// /JS/api/comentarios.js
import { API } from "./endpoints.js";
import { postJSON } from "./http.js";

/**
 * Inserta un comentario de requerimiento.
 * @param {{requerimiento_id:number|string, empleado_id?:number|string|null, comentario:string, status?:number, created_by?:number|string}} payload
 * @returns {Promise<{ok:boolean, data?:any, message?:string}>}
 */
export function createComentario(payload) {
  const body = {
    requerimiento_id: payload.requerimiento_id,
    empleado_id: payload.empleado_id ?? null,
    comentario: String(payload.comentario ?? "").trim(),
    status: payload.status ?? 1,
    created_by: payload.created_by ?? payload.empleado_id ?? null,
  };
  return postJSON(API.COMENTARIOS.CREATE, body);
}

/**
 * Actualiza un comentario.
 * @param {{id:number|string, comentario?:string, status?:number, empleado_id?:number|string|null, updated_by:number|string}} payload
 */
export function updateComentario(payload) {
  const body = {
    id: payload.id,
    comentario: payload.comentario,
    status: payload.status,
    empleado_id: payload.empleado_id ?? null,
    updated_by: payload.updated_by,
  };
  return postJSON(API.COMENTARIOS.UPDATE, body);
}

/**
 * Lista comentarios por requerimiento (paginado).
 * @param {{requerimiento_id:number|string, status?:number, page?:number, page_size?:number}} q
 */
export function listComentarios(q) {
  const body = {
    requerimiento_id: q.requerimiento_id,
    status: q.status ?? 1,
    page: q.page ?? 1,
    page_size: q.page_size ?? 100,
  };
  return postJSON(API.COMENTARIOS.LIST, body);
}

// /JS/api/tareas.js
import { API } from "./endpoints.js";
import { postJSON } from "./http.js";

/**
 * Crea una tarea dentro de un proceso.
 * @param {{
 *   proceso_id:number|string,
 *   asignado_a?:number|string|null,
 *   titulo:string,
 *   descripcion?:string|null,
 *   esfuerzo:number,
 *   fecha_inicio?:string|null, // "YYYY-MM-DD HH:mm:ss"
 *   fecha_fin?:string|null,    // "YYYY-MM-DD HH:mm:ss"
 *   status?:number,
 *   created_by?:number|string
 * }} payload
 */
export function createTarea(payload) {
  const body = {
    proceso_id: payload.proceso_id,
    asignado_a: payload.asignado_a ?? null,
    titulo: String(payload.titulo ?? "").trim(),
    descripcion: payload.descripcion ?? null,
    esfuerzo: Number(payload.esfuerzo ?? 0),
    fecha_inicio: payload.fecha_inicio ?? null,
    fecha_fin: payload.fecha_fin ?? null,
    status: payload.status ?? 1,
    created_by: payload.created_by ?? payload.asignado_a ?? null,
  };
  return postJSON(API.TAREAS.CREATE, body);
}

/**
 * Actualiza una tarea.
 * @param {{
 *   id:number|string,
 *   titulo?:string,
 *   descripcion?:string|null,
 *   esfuerzo?:number,
 *   asignado_a?:number|string|null,
 *   fecha_inicio?:string|null,
 *   fecha_fin?:string|null,
 *   status?:number,
 *   updated_by:number|string
 * }} payload
 */
export function updateTarea(payload) {
  const body = {
    id: payload.id,
    titulo: payload.titulo,
    descripcion: payload.descripcion,
    esfuerzo: (payload.esfuerzo != null) ? Number(payload.esfuerzo) : undefined,
    asignado_a: (payload.asignado_a === undefined) ? undefined : (payload.asignado_a ?? null),
    fecha_inicio: payload.fecha_inicio,
    fecha_fin: payload.fecha_fin,
    status: payload.status,
    updated_by: payload.updated_by,
  };
  return postJSON(API.TAREAS.UPDATE, body);
}

/**
 * Lista tareas por proceso (paginado).
 * @param {{proceso_id:number|string, status?:number, page?:number, page_size?:number}} q
 */
export function listTareas(q) {
  const body = {
    proceso_id: q.proceso_id,
    status: q.status ?? 1,
    page: q.page ?? 1,
    page_size: q.page_size ?? 100,
  };
  return postJSON(API.TAREAS.LIST, body);
}

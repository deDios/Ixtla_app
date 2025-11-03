// /JS/api/requerimientoDetalle.js
import { API } from "./endpoints.js";
import { postJSON } from "./http.js";

/** Safeguard para BIGINT: preferimos string si llega muy grande */
const toIdString = (v) => (v == null ? null : String(v));

/** Combina calle/colonia si existen */
const buildDireccion = (calle, colonia) => {
  const a = String(calle || "").trim();
  const b = String(colonia || "").trim();
  return [a, b].filter(Boolean).join(", ");
};

/** Normaliza un registro crudo del backend al shape que necesita la vista */
export function normalizeRequerimiento(raw = {}) {
  const id = toIdString(raw.id ?? raw.requerimiento_id);
  const folio = String(raw.folio ?? raw.folio_requerimiento ?? "").trim();

  // Título / descripción
  const tramite = String(raw.tramite ?? raw.tramite_nombre ?? raw.nombre_tramite ?? "").trim();
  const asunto  = String(raw.asunto ?? raw.titulo ?? "").trim();
  const descripcion = String(raw.descripcion ?? raw.detalle ?? "").trim();

  // Contacto
  const contacto_nombre   = String(raw.contacto_nombre ?? raw.nombre_contacto ?? raw.contacto ?? "").trim();
  const contacto_telefono = String(raw.contacto_telefono ?? raw.telefono_contacto ?? raw.telefono ?? "").trim();
  const contacto_email    = String(raw.contacto_email ?? raw.email_contacto ?? raw.correo ?? "").trim();
  const contacto_calle    = String(raw.contacto_calle ?? raw.direccion ?? raw.calle ?? "").trim();
  const contacto_colonia  = String(raw.contacto_colonia ?? raw.colonia ?? "").trim();
  const contacto_cp       = String(raw.contacto_cp ?? raw.cp ?? raw.codigo_postal ?? "").trim();
  const direccion_reporte = buildDireccion(contacto_calle, contacto_colonia);

  // Asignación
  const asignado_a        = toIdString(raw.asignado_a ?? raw.empleado_id ?? raw.asignado_id);
  const asignado_nombre   = String(raw.asignado_nombre ?? raw.nombre_asignado ?? raw.empleado_nombre ?? "").trim();
  const asignado_apellidos= String(raw.asignado_apellidos ?? raw.empleado_apellidos ?? "").trim();
  const asignado_full     = String(raw.asignado_full || [asignado_nombre, asignado_apellidos].filter(Boolean).join(" ")).trim();

  // Estatus / meta
  const estatus_code = Number(
    raw.estatus_code ?? raw.estatus ?? raw.status ?? raw.estado ?? 0
  );
  const prioridad = (raw.prioridad != null) ? Number(raw.prioridad) : null;
  const canal     = (raw.canal != null) ? Number(raw.canal) : null;

  // Fechas
  const creado_at      = String(raw.creado_at ?? raw.created_at ?? raw.fecha_creacion ?? "").trim();
  const actualizado_at = String(raw.actualizado_at ?? raw.updated_at ?? "").trim();
  const cerrado_en     = raw.cerrado_en != null ? String(raw.cerrado_en).trim() : null;

  return {
    id, folio,
    tramite, asunto, descripcion,
    contacto_nombre, contacto_telefono, contacto_email,
    contacto_calle, contacto_colonia, contacto_cp, direccion_reporte,
    asignado_a, asignado_nombre, asignado_apellidos, asignado_full,
    estatus_code, prioridad, canal,
    creado_at, actualizado_at, cerrado_en,
    raw,
  };
}

/** GET por ID (sin filtrar por status) */
export async function getById(id) {
  const body = { id };
  const json = await postJSON(API.REQUERIMIENTO.GET, body);
  if (json?.ok === false) throw new Error(json?.message || "Error en consulta de requerimiento");
  const raw = json?.data ?? json; // por si el PHP regresa el registro directo
  return { ok: true, data: normalizeRequerimiento(raw) };
}

/**
 * UPDATE (estatus, asignado, descripcion, etc.)
 * payload esperado (ejemplo):
 * {
 *   id: "3623",
 *   estatus: 3,
 *   asignado_a: 45,
 *   descripcion: "texto...",
 *   updated_by: 45,
 *   ...otros campos permitidos por el PHP
 * }
 */
export async function update(payload = {}) {
  if (!payload.id) throw new Error("Falta id en update()");
  if (!payload.updated_by) throw new Error("Falta updated_by en update()");

  const json = await postJSON(API.REQUERIMIENTO.UPDATE, payload);
  if (json?.ok === false) throw new Error(json?.message || "Error al actualizar requerimiento");
  const raw = json?.data ?? json;
  return { ok: true, data: normalizeRequerimiento(raw) };
}

/**
 * CREATE (opcional, si lo usarás ahora o después)
 * payload mínimo sugerido:
 * {
 *   tramite: "Fuga de agua",
 *   asunto: "Reporte...",
 *   descripcion: "...",
 *   contacto_nombre: "...",
 *   contacto_telefono: "...",
 *   contacto_email: "...",
 *   contacto_calle: "...",
 *   contacto_colonia: "...",
 *   contacto_cp: "45850",
 *   asignado_a: 45,
 *   estatus: 0,
 *   prioridad: 2,
 *   canal: 1,
 *   created_by: 45
 * }
 */
export async function create(payload = {}) {
  const json = await postJSON(API.REQUERIMIENTO.CREATE, payload);
  if (json?.ok === false) throw new Error(json?.message || "Error al crear requerimiento");
  const raw = json?.data ?? json;
  // si el insert regresa solo {id}, respetamos y no normalizamos
  if (raw && (raw.id != null || raw.requerimiento_id != null)) {
    return { ok: true, data: normalizeRequerimiento(raw) };
  }
  return { ok: true, data: raw };
}

/** (Opcional) Resuelve nombre de asignado si el backend solo regresó el id */
export async function enrichAsignadoFull(requerimiento) {
  if (requerimiento.asignado_full && requerimiento.asignado_full.trim()) return requerimiento;
  if (!requerimiento.asignado_a) return requerimiento;

  // Algunos backends aceptan { id } o { ids: [] }. Probamos con { id }.
  const emp = await postJSON(API.EMPLEADOS.GET, { id: requerimiento.asignado_a });
  const rec = emp?.data ?? emp;
  const nombre = String(rec?.nombre ?? rec?.empleado_nombre ?? "").trim();
  const ap     = String(rec?.apellidos ?? rec?.empleado_apellidos ?? "").trim();
  const full   = [nombre, ap].filter(Boolean).join(" ");
  return { ...requerimiento, asignado_nombre: nombre, asignado_apellidos: ap, asignado_full: full };
}

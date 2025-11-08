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
function normalizeRequerimiento(raw = {}) {
  console.groupCollapsed("[api/requerimientoDetalle] normalizeRequerimiento: IN");
  console.log(raw);
  console.groupEnd();

  const toId = (v) => (v == null ? null : String(v));
  const id = toId(raw.id ?? raw.requerimiento_id);
  const folio = String(raw.folio ?? raw.folio_requerimiento ?? "").trim();

  const tramite = String(raw.tramite ?? raw.tramite_nombre ?? raw.nombre_tramite ?? "").trim();
  const tramite_nombre = String(raw.tramite_nombre ?? tramite ?? "").trim();
  const asunto = String(raw.asunto ?? raw.titulo ?? "").trim();
  const descripcion = String(raw.descripcion ?? raw.detalle ?? "").trim();

  const contacto_nombre   = String(raw.contacto_nombre ?? raw.nombre_contacto ?? raw.contacto ?? "").trim();
  const contacto_telefono = String(raw.contacto_telefono ?? raw.telefono_contacto ?? raw.telefono ?? "").trim();
  const contacto_email    = String(raw.contacto_email ?? raw.email_contacto ?? raw.correo ?? "").trim();
  const contacto_calle    = String(raw.contacto_calle ?? raw.direccion ?? raw.calle ?? "").trim();
  const contacto_colonia  = String(raw.contacto_colonia ?? raw.colonia ?? "").trim();
  const contacto_cp       = String(raw.contacto_cp ?? raw.cp ?? raw.codigo_postal ?? "").trim();
  const direccion_reporte = buildDireccion(contacto_calle, contacto_colonia);

  // === Asignado (nunca caemos en solicitante; si no hay, quedará sin asignar)
  const asignado_id = raw.asignado_a != null && raw.asignado_a !== "" ? String(raw.asignado_a) : null;
  const asignado_full = (() => {
    const fullApi = String(raw.asignado_nombre_completo || "").trim();
    if (fullApi) return fullApi;
    const n = String(raw.asignado_nombre || "").trim();
    const a = String(raw.asignado_apellidos || "").trim();
    const joined = [n, a].filter(Boolean).join(" ").trim();
    return joined || ""; // vacío => la UI mostrará "Sin asignar"
  })();

  // === Departamento / líder (si vienen)
  const departamento_nombre = String(raw.departamento_nombre || "").trim() || "—";
  const departamento_director_nombre =
    String(raw.departamento_director_nombre || raw.director_nombre || "").trim() || "";

  const estatus_code = Number(raw.estatus_code ?? raw.estatus ?? raw.status ?? raw.estado ?? 0);
  const prioridad = (raw.prioridad != null) ? Number(raw.prioridad) : null;
  const canal = (raw.canal != null) ? Number(raw.canal) : null;

  const creado_at      = String(raw.creado_at ?? raw.created_at ?? raw.fecha_creacion ?? "").trim();
  const actualizado_at = String(raw.actualizado_at ?? raw.updated_at ?? "").trim();
  const cerrado_en     = raw.cerrado_en != null ? String(raw.cerrado_en).trim() : null;

  const out = {
    id, folio,
    tramite, tramite_nombre, asunto, descripcion,
    contacto_nombre, contacto_telefono, contacto_email,
    contacto_calle, contacto_colonia, contacto_cp, direccion_reporte,
    asignado_id, asignado_full,
    departamento_nombre, departamento_director_nombre,
    estatus_code, prioridad, canal,
    creado_at, actualizado_at, cerrado_en,
    raw
  };

  console.groupCollapsed("[api/requerimientoDetalle] normalizeRequerimiento: OUT");
  console.log(out);
  console.groupEnd();

  return out;
}

/** GET por ID  */
export async function getById(id) {
  const body = { id };
  console.groupCollapsed("[api/requerimientoDetalle] GET →", API.REQUERIMIENTO.GET);
  console.log("payload:", body);
  const json = await postJSON(API.REQUERIMIENTO.GET, body);
  console.log("response:", json);
  console.groupEnd();

  if (json?.ok === false) throw new Error(json?.message || "Error en consulta de requerimiento");

  let raw = json?.data ?? json;
  if (Array.isArray(raw)) raw = raw[0] || {};
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

  console.groupCollapsed("[api/requerimientoDetalle] UPDATE →", API.REQUERIMIENTO.UPDATE);
  console.log("payload:", payload);
  const json = await postJSON(API.REQUERIMIENTO.UPDATE, payload);
  console.log("response:", json);
  console.groupEnd();

  if (json?.ok === false) throw new Error(json?.message || "Error al actualizar requerimiento");

  let raw = json?.data ?? json;
  if (Array.isArray(raw)) raw = raw[0] || {};
  return { ok: true, data: normalizeRequerimiento(raw) };
}

/**
 * CREATE (opcional)
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
 *   asignado_a: 45,          // opcional
 *   estatus: 0,
 *   prioridad: 2,
 *   canal: 1,
 *   created_by: 45
 * }
 */
export async function create(payload = {}) {
  console.groupCollapsed("[api/requerimientoDetalle] CREATE →", API.REQUERIMIENTO.CREATE);
  console.log("payload:", payload);
  const json = await postJSON(API.REQUERIMIENTO.CREATE, payload);
  console.log("response:", json);
  console.groupEnd();

  if (json?.ok === false) throw new Error(json?.message || "Error al crear requerimiento");

  let raw = json?.data ?? json;
  // si el insert regresa sólo {id} o el registro completo:
  if (raw && (raw.id != null || raw.requerimiento_id != null)) {
    if (Array.isArray(raw)) raw = raw[0] || raw;
    return { ok: true, data: normalizeRequerimiento(raw) };
  }
  return { ok: true, data: raw };
}

/** (Opcional) Resuelve nombre de asignado si el backend sólo regresó el id */
export async function enrichAsignadoFull(requerimiento) {
  // Si ya hay display, no hacemos nada
  if (requerimiento.asignado_full && requerimiento.asignado_full.trim()) return requerimiento;

  // OJO: nuestro shape usa asignado_id
  const asignadoId = requerimiento.asignado_id ?? requerimiento.asignado_a ?? null;
  if (!asignadoId) return requerimiento;

  console.groupCollapsed("[api/requerimientoDetalle] ENRICH asignado →", API.EMPLEADOS.GET);
  console.log("asignadoId:", asignadoId);
  const emp = await postJSON(API.EMPLEADOS.GET, { id: Number(asignadoId), status: 1 });
  console.log("response:", emp);
  console.groupEnd();

  const rec = emp?.data ?? emp;
  const nombre = String(rec?.nombre ?? rec?.empleado_nombre ?? "").trim();
  const ap     = String(rec?.apellidos ?? rec?.empleado_apellidos ?? "").trim();
  const full   = [nombre, ap].filter(Boolean).join(" ").trim();

  return {
    ...requerimiento,
    asignado_nombre: nombre,
    asignado_apellidos: ap,
    asignado_full: full
  };
}

// /JS/ui/exportXLSXHome.js
export function initExportXLSXHome({
  buttonId = "hs-btn-export-req",
  State,
  normalizeStatusKey,
  formatDateMXShort,
  toast,
  mode = "view", // "view" = respeta filtros/búsqueda | "all" = todo visible por rol
} = {}) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    try {
      if (!window.XLSX) {
        console.error("[ExportXLSX] XLSX no cargado. Falta xlsx.full.min.js");
        toast?.("No se pudo exportar (XLSX no cargado).", "error");
        return;
      }
      exportXLSX({ State, normalizeStatusKey, formatDateMXShort, toast, mode });
    } catch (err) {
      console.error("[ExportXLSX] error:", err);
      toast?.("No se pudo exportar. Revisa consola.", "error");
    }
  });
}

function exportXLSX({
  State,
  normalizeStatusKey,
  formatDateMXShort,
  toast,
  mode,
}) {
  const rows =
    mode === "all"
      ? Array.isArray(State.rows)
        ? State.rows
        : []
      : getRowsForViewExport(State, normalizeStatusKey);

  if (!rows.length) {
    toast?.("No hay requerimientos para exportar.", "warn");
    return;
  }

  // === Columnas “para empleados” (operativas) ===
  const data = rows.map((r) => {
    const raw = r?.raw || r?.__raw || r || {};

    const departamento =
      r?.departamento ||
      raw?.departamento_nombre ||
      raw?.departamento?.nombre ||
      "—";

    const tramite =
      r?.tramite || raw?.tramite_nombre || raw?.tramite?.nombre || "—";

    const asignado =
      r?.asignadoFull ||
      r?.asignadoNombre ||
      r?.asignado ||
      raw?.asignado_nombre_completo ||
      "Sin asignar";

    const tel = r?.tel || raw?.contacto_telefono || "—";
    const solicitadoRaw = r?.creado || raw?.created_at || r?.created_at || null;
    const solicitado = formatDateMXShort
      ? formatDateMXShort(solicitadoRaw)
      : safeDateMXShort(solicitadoRaw);

    return {
      Folio: r?.folio || raw?.folio || "—",
      Departamento: departamento,
      "Tipo de trámite": tramite,
      Asunto: r?.asunto || raw?.asunto || "—",
      Asignado: asignado,
      Teléfono: tel,
      Solicitado: solicitado || "—",
      Estatus: r?.estatus?.label || "—",
      //Prioridad: mapPrioridad(raw?.prioridad), comentado porque prioridad no sirve mostrarlo
      Canal: mapCanal(raw?.canal),
      "Contacto nombre": raw?.contacto_nombre || "—",
      "Contacto correo": raw?.contacto_email || "—",
      Calle: raw?.contacto_calle || "—",
      Colonia: raw?.contacto_colonia || "—",
      CP: raw?.contacto_cp || "—",
      Actualizado: raw?.updated_at || r?.updated_at || "—",
      "Cerrado en": raw?.cerrado_en || "—",
    };
  });

  const XLSX = window.XLSX;

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Requerimientos");

  // Autofiltro (Excel dropdowns) :contentReference[oaicite:3]{index=3}
  const range = XLSX.utils.decode_range(ws["!ref"]);
  ws["!autofilter"] = { ref: XLSX.utils.encode_range(range) };

  // Anchos
  ws["!cols"] = [
    { wch: 16 }, // Folio
    { wch: 22 }, // Depto
    { wch: 26 }, // Trámite
    { wch: 30 }, // Asunto
    { wch: 18 }, // Asignado
    { wch: 14 }, // Tel
    { wch: 12 }, // Solicitado
    { wch: 14 }, // Estatus
    { wch: 10 }, // Prioridad
    { wch: 10 }, // Canal
    { wch: 18 }, // Contacto nombre
    { wch: 22 }, // Contacto correo
    { wch: 18 }, // Calle
    { wch: 16 }, // Colonia
    { wch: 10 }, // CP
    { wch: 18 }, // Actualizado
    { wch: 18 }, // Cerrado en
  ];

  // Freeze header: algunas builds lo soportan, otras no. recordar tener cuidado con esto pero jala
  // Si no lo soporta, no pasa nada.
  try {
    ws["!freeze"] = {
      xSplit: 0,
      ySplit: 1,
      topLeftCell: "A2",
      activePane: "bottomLeft",
      state: "frozen",
    };
  } catch (_) {}

  const filename = makeFilename("requerimientos");
  XLSX.writeFile(wb, filename);

  toast?.(`Exportados: ${rows.length} requerimiento(s).`, "success");
}

function getRowsForViewExport(State, normalizeStatusKey) {
  const all = Array.isArray(State.rows) ? State.rows : [];
  let filtered = all;

  if (State.filterKey && State.filterKey !== "todos") {
    if (State.filterKey === "activo") {
      filtered = filtered.filter((r) => {
        const k = normalizeStatusKey(r.estatus?.key || "");
        return k !== "pausado" && k !== "cancelado" && k !== "finalizado";
      });
    } else {
      filtered = filtered.filter(
        (r) => normalizeStatusKey(r.estatus?.key) === State.filterKey,
      );
    }
  }

  if (State.search) {
    const q = String(State.search || "").toLowerCase();
    filtered = filtered.filter((r) => {
      const asunto = String(r.asunto || "").toLowerCase();
      const asign = String(r.asignado || r.asignadoNombre || "").toLowerCase();
      const est = String(r.estatus?.label || "").toLowerCase();
      const folio = String(r.folio || "").toLowerCase();
      const depto = String(r.departamento || "").toLowerCase();
      return (
        asunto.includes(q) ||
        asign.includes(q) ||
        est.includes(q) ||
        depto.includes(q) ||
        folio.includes(q)
      );
    });
  }

  return filtered;
}

function mapPrioridad(p) {
  const n = Number(p);
  if (n === 1) return "Baja";
  if (n === 2) return "Media";
  if (n === 3) return "Alta";
  return "—";
}
function mapCanal(c) {
  const n = Number(c);
  if (!Number.isFinite(n)) return "—";
  return `Canal ${n}`;
}
function safeDateMXShort(v) {
  if (!v) return "—";
  const d = new Date(String(v).replace(" ", "T"));
  if (isNaN(d)) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}
function makeFilename(prefix) {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${prefix}_${yyyy}-${mm}-${dd}.xlsx`;
}

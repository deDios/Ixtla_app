// /JS/UAT/ui/exportCSVHome.js
export function initExportCSVHome({
  buttonId = "hs-btn-export-req",
  State,
  normalizeStatusKey,
  formatDateMXShort,
  toast,
  getFilePrefix = () => "requerimientos",
} = {}) {
  if (!State || typeof normalizeStatusKey !== "function") {
    console.warn("[ExportCSVHome] faltan dependencias (State/normalizeStatusKey).");
    return;
  }

  const btn = document.getElementById(buttonId);
  if (!btn) return;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    try {
      exportCSV({
        State,
        normalizeStatusKey,
        formatDateMXShort,
        toast,
        getFilePrefix,
      });
    } catch (err) {
      console.error("[ExportCSVHome] error:", err);
      try {
        toast?.("No se pudo exportar. Revisa consola.", "error");
      } catch {}
    }
  });
}

/* ========================= Core ========================= */

function exportCSV({
  State,
  normalizeStatusKey,
  formatDateMXShort,
  toast,
  getFilePrefix,
}) {
  const rows = getRowsForExport(State, normalizeStatusKey);

  if (!rows.length) {
    try {
      toast?.("No hay requerimientos para exportar.", "warn");
    } catch {}
    return;
  }

  const sep = pickSeparator(); // ';' para es, ',' para otros
  const headers = [
    "Folio",
    "Departamento",
    "Tipo de trámite",
    "Asunto",
    "Asignado",
    "Teléfono",
    "Solicitado",
    "Estatus",
    // Si quieres ampliar “presentable” con más info sin hacerlo técnico:
    "Prioridad",
    "Canal",
  ];

  const data = rows.map((r) => {
    const raw = r?.raw || r?.__raw || r || {};

    const folio = r?.folio || raw?.folio || "—";
    const departamento =
      r?.departamento ||
      r?.depto ||
      r?.depto_nombre ||
      r?.departamento_nombre ||
      raw?.departamento_nombre ||
      raw?.departamento?.nombre ||
      "—";

    const tramite = r?.tramite || raw?.tramite_nombre || raw?.tramite?.nombre || (r?.asunto || raw?.asunto || "—");
    const asunto = r?.asunto || raw?.asunto || "—";

    const asignado =
      r?.asignadoFull ||
      r?.asignadoNombre ||
      r?.asignado ||
      raw?.asignado_nombre_completo ||
      "Sin asignar";

    const tel = r?.tel || raw?.contacto_telefono || "—";

    const solicitadoRaw =
      r?.creado || raw?.created_at || r?.created_at || r?.fecha_creacion || null;
    const solicitado = formatDateMXShort
      ? formatDateMXShort(solicitadoRaw)
      : safeDateMXShort(solicitadoRaw);

    const estatus = r?.estatus?.label || "—";

    const prioridad = mapPrioridad(raw?.prioridad);
    const canal = mapCanal(raw?.canal);

    return [
      folio,
      departamento,
      tramite,
      asunto,
      asignado,
      tel,
      solicitado || "—",
      estatus,
      prioridad,
      canal,
    ];
  });

  const csv = toCSV(headers, data, sep);

  const filename = makeFilename(getFilePrefix?.() || "requerimientos");
  downloadText(filename, csv);

  try {
    toast?.(`Exportados: ${rows.length} requerimiento(s).`, "success");
  } catch {}
}

/* ========================= Pipeline-like ========================= */
/**
 * Replica el comportamiento de la vista:
 * - Universo: State.rows (ya trae RBAC aplicado en Home)
 * - Aplica filtros de estatus y búsqueda igual que applyPipelineAndRender
 */
function getRowsForExport(State, normalizeStatusKey) {
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
        (r) => normalizeStatusKey(r.estatus?.key) === State.filterKey
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
      const idTxt = String(r.id || "");
      return (
        asunto.includes(q) ||
        asign.includes(q) ||
        est.includes(q) ||
        depto.includes(q) ||
        folio.includes(q) ||
        idTxt.includes(q)
      );
    });
  }

  return filtered;
}

/* ========================= CSV helpers ========================= */

function pickSeparator() {
  const lang = (navigator.language || "").toLowerCase();
  // Excel en español suele partir mejor con ';'
  return lang.startsWith("es") ? ";" : ",";
}

function csvEscape(v, sep) {
  const s = String(v ?? "");
  const needsQuotes = s.includes('"') || s.includes("\n") || s.includes("\r") || s.includes(sep);
  if (!needsQuotes) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

function toCSV(headers, rows, sep) {
  const BOM = "\uFEFF";
  const head = headers.map((h) => csvEscape(h, sep)).join(sep);
  const body = rows
    .map((r) => r.map((c) => csvEscape(c, sep)).join(sep))
    .join("\n");
  return BOM + head + "\n" + body + "\n";
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function makeFilename(prefix) {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${prefix}_${yyyy}-${mm}-${dd}.csv`;
}

/* ========================= Value maps ========================= */

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

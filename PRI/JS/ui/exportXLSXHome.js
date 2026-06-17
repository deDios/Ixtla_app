// /JS/ui/exportXLSXHome.js
export function initExportXLSXHome({
  buttonId = "red-btn-export",
  fetchRows,
  toast,
} = {}) {
  const btn = document.getElementById(buttonId);
  if (!btn || typeof fetchRows !== "function") return;

  btn.addEventListener("click", async (event) => {
    event.preventDefault();

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Exportando...";

    try {
      if (!window.XLSX) {
        throw new Error("XLSX no está cargado en la vista.");
      }

      const rows = await fetchRows();

      if (!Array.isArray(rows) || !rows.length) {
        toast?.("No hay personas para exportar.", "warning");
        return;
      }

      const data = rows.map(mapPersonRowForExcel);
      downloadWorkbook(data, makeFilename("red_personas"));
      toast?.(`Exportadas: ${rows.length} persona(s).`, "exito");
    } catch (err) {
      console.error("[ExportXLSXHome] error:", err);
      toast?.("No se pudo exportar el archivo de Excel.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}

function mapPersonRowForExcel(row) {
  const raw = row?.raw || {};
  const participacion = raw?.participacion || {};
  const territorio = raw?.territorio || {};
  const responsable = raw?.responsable || row?.responsable || {};

  const nombreCompleto =
    raw?.nombre_completo ||
    row?.nombre ||
    [
      raw?.nombres,
      raw?.apellido_paterno,
      raw?.apellido_materno,
    ].filter(Boolean).join(" ").trim() ||
    "Sin nombre";

  const seccion =
    territorio?.seccion?.codigo ||
    raw?.seccion_codigo ||
    row?.seccion ||
    "—";

  const zona =
    territorio?.zona?.nombre ||
    territorio?.zona?.codigo ||
    raw?.zona_nombre ||
    row?.zona ||
    "—";

  const responsableNombre =
    responsable?.nombre_completo ||
    [
      responsable?.nombre,
      responsable?.apellido_paterno,
      responsable?.apellido_materno,
    ].filter(Boolean).join(" ").trim() ||
    responsable?.username ||
    "—";

  const telefonoPrincipal = raw?.telefono || raw?.whatsapp || row?.telefono || "—";
  const observaciones = [raw?.persona_observaciones, participacion?.observaciones]
    .filter((value, index, arr) => value && arr.indexOf(value) === index)
    .join(" | ");

  return {
    ID: row?.id || raw?.persona_id || "—",
    "Nombre completo": nombreCompleto,
    "Tipo de participación": formatTipoParticipacion(
      participacion?.tipo_actual ||
      participacion?.tipo_participacion ||
      raw?.tipo_participacion ||
      row?.tipo
    ),
    Estatus: raw?.participacion_estatus_nombre || row?.estatus_nombre || "Sin estatus",
    Validez: row?.validez ? "Válido" : "Pendiente",
    Sección: seccion,
    Zona: zona,
    Domicilio: raw?.domicilio_texto || row?.domicilio || "—",
    "Teléfono principal": telefonoPrincipal,
    WhatsApp: raw?.whatsapp || "—",
    Email: raw?.email || "—",
    CURP: raw?.curp || "—",
    "Clave de elector": raw?.clave_elector || "—",
    "Fecha de nacimiento": formatDate(raw?.fecha_nacimiento),
    Sexo: formatSexo(raw?.sexo),
    "Año de registro": raw?.anio_registro || "—",
    Emisión: raw?.emision || "—",
    "Vigencia inicio": raw?.vigencia_inicio || "—",
    "Vigencia fin": raw?.vigencia_fin || "—",
    Responsable: responsableNombre,
    "Fecha de registro": formatDateTime(
      participacion?.fecha_registro || raw?.fecha_captura || raw?.created_at
    ),
    "Fecha de afiliación": formatDate(participacion?.fecha_afiliacion),
    "Última actualización": formatDateTime(raw?.updated_at || participacion?.updated_at),
    Observaciones: observaciones || "—",
  };
}

function downloadWorkbook(rows, filename) {
  const XLSX = window.XLSX;
  const headers = Object.keys(rows[0] || {});
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  worksheet["!cols"] = headers.map((header) => ({
    wch: Math.max(
      12,
      Math.min(
        40,
        String(header).length + 4,
        ...rows.map((row) => String(normalizeCellValue(row[header])).length + 2),
      ),
    ),
  }));

  if (worksheet["!ref"]) {
    const range = XLSX.utils.decode_range(worksheet["!ref"]);
    worksheet["!autofilter"] = { ref: XLSX.utils.encode_range(range) };
  }

  try {
    worksheet["!freeze"] = {
      xSplit: 0,
      ySplit: 1,
      topLeftCell: "A2",
      activePane: "bottomLeft",
      state: "frozen",
    };
  } catch (_) { }

  XLSX.utils.book_append_sheet(workbook, worksheet, "Personas RED");
  XLSX.writeFile(workbook, filename);
}

function formatTipoParticipacion(value) {
  const clean = String(value ?? "").trim().toLowerCase();

  if (clean === "afiliado") return "Afiliado";
  if (clean === "promotor") return "Promotor";
  if (clean === "simpatizante") return "Simpatizante";

  return clean ? capitalizeWords(clean.replaceAll("_", " ")) : "Simpatizante";
}

function formatSexo(value) {
  const clean = String(value ?? "").trim().toUpperCase();

  if (clean === "H") return "Hombre";
  if (clean === "M") return "Mujer";
  if (clean === "X") return "No especificado";

  return clean || "—";
}

function formatDate(value) {
  if (!value) return "—";

  const normalized = String(value).trim();
  const date = new Date(normalized.includes("T") ? normalized : normalized.replace(" ", "T"));

  if (Number.isNaN(date.getTime())) return normalized;

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "—";

  const normalized = String(value).trim();
  const date = new Date(normalized.includes("T") ? normalized : normalized.replace(" ", "T"));

  if (Number.isNaN(date.getTime())) return normalized;

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(date);
}

function normalizeCellValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function capitalizeWords(value) {
  return String(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function makeFilename(prefix) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  return `${prefix}_${yyyy}-${mm}-${dd}.xlsx`;
}

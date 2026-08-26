/** Exporta las retros actualmente visibles por los filtros del tablero. */
export function initExportXLSXRetro({
  buttonId = "hs-btn-export-retro",
  State,
  formatPhone = (value) => value ?? "",
  formatRetroStatus = (value) => value ?? "",
  toast,
  mode = "view",
} = {}) {
  const button = document.getElementById(buttonId);
  if (!button) return;

  button.addEventListener("click", (event) => {
    event.preventDefault();

    try {
      if (!window.XLSX) {
        toast?.("No se pudo exportar: XLSX no está cargado.", "error");
        return;
      }

      // "view" respeta el estatus y la búsqueda que el usuario está viendo.
      const rows = mode === "all" ? State?.rows : State?.filtered;
      if (!Array.isArray(rows) || !rows.length) {
        toast?.("No hay registros para exportar.", "warn");
        return;
      }

      const data = rows.map((item) => {
        const row = item?.raw || item?.__raw || item || {};
        const status = Number(row.status ?? row.estatus);

        return {
          Folio: spreadsheetText(row.folio ?? row.requerimiento_folio),
          "Estado de retroalimentación": spreadsheetText(
            formatRetroStatus(row.status ?? row.estatus),
          ),
          Calificación: spreadsheetText(formatRating(row.calificacion, status)),
          Departamento: spreadsheetText(row.departamento_nombre),
          "Tipo de trámite": spreadsheetText(row.tramite_nombre),
          Asignado: spreadsheetText(row.asignado_nombre_completo),
          Teléfono: spreadsheetText(
            formatPhone(row.contacto_telefono ?? row.telefono ?? row.celular),
          ),
          Comentario: spreadsheetText(row.comentario, "Sin comentario"),
          "Fecha de creación": spreadsheetText(formatDate(row.created_at ?? row.fecha)),
          "Última actualización": spreadsheetText(formatDate(row.updated_at)),
        };
      });

      const XLSX = window.XLSX;
      const sheet = XLSX.utils.json_to_sheet(data);
      const range = XLSX.utils.decode_range(sheet["!ref"]);
      sheet["!autofilter"] = { ref: XLSX.utils.encode_range(range) };
      sheet["!cols"] = [
        { wch: 18 }, { wch: 25 }, { wch: 16 }, { wch: 24 }, { wch: 30 },
        { wch: 28 }, { wch: 18 }, { wch: 52 }, { wch: 22 }, { wch: 22 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Retro ciudadana");
      XLSX.writeFile(workbook, `retro-ciudadana-${fileDate()}.xlsx`);
      toast?.("Exportación realizada correctamente.", "success");
    } catch (error) {
      console.error("[exportXLSXRetro] Error al exportar:", error);
      toast?.("No se pudo exportar la información.", "error");
    }
  });
}

function formatRating(value, status) {
  const rating = Number(value);
  if (status !== 2 || !Number.isInteger(rating)) return "Sin respuesta";

  return ({ 1: "Malo", 2: "Regular", 3: "Bueno", 4: "Excelente" }[rating]
    || "Sin respuesta");
}

function formatDate(value) {
  const text = String(value ?? "").trim();
  // La API entrega fechas MySQL sin zona horaria; se conserva su valor para no
  // desplazar la fecha por la configuración local de Excel o del navegador.
  return text || "—";
}

function spreadsheetText(value, fallback = "—") {
  const text = String(value ?? "").trim() || fallback;
  // Evita que Excel interprete texto controlado por usuarios como fórmula.
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function fileDate() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

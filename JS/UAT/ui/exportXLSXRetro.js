// /JS/ui/UAT/exportXLSXRetro.js
// Requiere XLSX (SheetJS) ya deberia estar cargado en la pagina

export function initExportXLSXRetro({
  buttonId = "hs-btn-export-retro",
  State,
  formatPhone,
  formatRetroStatus,
  toast,
} = {}) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  btn.addEventListener("click", () => {
    try {
      if (!window.XLSX) {
        console.error("[exportXLSXRetro] XLSX no está disponible en window");
        toast?.("No se pudo exportar el archivo.", "error");
        return;
      }

      const rows = Array.isArray(State?.filtered) ? State.filtered : [];

      if (!rows.length) {
        toast?.("No hay retroalimentaciones para exportar.", "warning");
        return;
      }

      const data = rows.map((r) => ({
        "ID retro": safeNumber(r?.id),
        "ID requerimiento": safeNumber(r?.requerimiento_id),
        "Folio": safeText(r?.folio),
        "Departamento": safeText(r?.departamento_nombre),
        "Tipo de trámite": safeText(r?.tramite_nombre),
        "Asignado": safeText(r?.asignado_nombre_completo),
        "Teléfono": formatPhone
          ? formatPhone(r?.contacto_telefono)
          : safeText(r?.contacto_telefono),
        "Estatus": formatRetroStatus
          ? formatRetroStatus(r?.status)
          : safeText(r?.status),
        "Calificación": mapCalificacion(r?.calificacion),
        "Comentario": safeText(r?.comentario, "Sin comentario"),
        "Creado": safeText(r?.created_at),
        "Actualizado": safeText(r?.updated_at),
        "Link": safeText(r?.link),
      }));

      const XLSX = window.XLSX;
      const worksheet = XLSX.utils.json_to_sheet(data);

      const range = XLSX.utils.decode_range(worksheet["!ref"]);
      worksheet["!autofilter"] = {
        ref: XLSX.utils.encode_range(range),
      };

      worksheet["!cols"] = [
        { wch: 10 }, // ID retro
        { wch: 16 }, // ID requerimiento
        { wch: 18 }, // Folio
        { wch: 20 }, // Departamento
        { wch: 24 }, // Tipo de trámite
        { wch: 18 }, // Asignado
        { wch: 16 }, // Teléfono
        { wch: 16 }, // Estatus
        { wch: 14 }, // Calificación
        { wch: 34 }, // Comentario
        { wch: 18 }, // Creado
        { wch: 18 }, // Actualizado
        { wch: 52 }, // Link
      ];

      try {
        worksheet["!freeze"] = {
          xSplit: 0,
          ySplit: 1,
          topLeftCell: "A2",
          activePane: "bottomLeft",
          state: "frozen",
        };
      } catch (_) {
        // Algunas versiones de SheetJS pueden ignorar freeze
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Retroalimentaciones");

      const fileName = `retroalimentaciones_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;

      XLSX.writeFile(workbook, fileName);

      toast?.("Exportación realizada correctamente.", "success");
    } catch (error) {
      console.error("[exportXLSXRetro] error:", error);
      toast?.("Error al exportar retroalimentaciones.", "error");
    }
  });
}

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function safeNumber(value, fallback = "—") {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapCalificacion(value) {
  const n = Number(value);
  if (n === 1) return "Malo";
  if (n === 2) return "Regular";
  if (n === 3) return "Bueno";
  if (n === 4) return "Excelente";
  return "Sin respuesta";
}
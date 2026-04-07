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
      const rows = Array.isArray(State?.filtered) ? State.filtered : [];

      if (!rows.length) {
        toast?.("No hay datos para exportar", "warning");
        return;
      }

      const data = rows.map((r) => ({
        "ID retro": Number(r?.id || 0),
        "ID requerimiento": Number(r?.requerimiento_id || 0),
        "Folio": String(r?.folio || "").trim(),
        "Departamento": String(r?.departamento_nombre || "").trim(),
        "Tipo de trámite": String(r?.tramite_nombre || "").trim(),
        "Asignado": String(r?.asignado_nombre_completo || "").trim(),
        "Teléfono": formatPhone ? formatPhone(r?.contacto_telefono) : String(r?.contacto_telefono || "").trim(),
        "Estatus": formatRetroStatus ? formatRetroStatus(r?.status) : String(r?.status ?? ""),
        "Calificación":
          Number(r?.calificacion) === 1 ? "Malo" :
          Number(r?.calificacion) === 2 ? "Regular" :
          Number(r?.calificacion) === 3 ? "Bueno" :
          Number(r?.calificacion) === 4 ? "Excelente" :
          "Sin respuesta",
        "Comentario": String(r?.comentario || "Sin comentario").trim(),
        "Creado": String(r?.created_at || "").trim(),
        "Actualizado": String(r?.updated_at || "").trim(),
        "Link": String(r?.link || "").trim(),
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Retroalimentaciones");

      const fileName = `retroalimentaciones_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast?.("Exportación realizada correctamente", "success");
    } catch (error) {
      console.error("[exportXLSXRetro] error:", error);
      toast?.("Error al exportar", "error");
    }
  });
}
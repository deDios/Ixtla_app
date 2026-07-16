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

    if (!window.XLSX) {
      toast?.("No se pudo exportar: XLSX no está cargado.", "error");
      return;
    }

    const rows = mode === "all" ? State?.rows : State?.filtered;
    if (!Array.isArray(rows) || !rows.length) {
      toast?.("No hay registros para exportar.", "warn");
      return;
    }

    const data = rows.map((item) => {
      const row = item?.raw || item?.__raw || item || {};
      return {
        Folio: row.folio ?? row.requerimiento_folio ?? "",
        Estado: formatRetroStatus(row.status ?? row.estatus ?? ""),
        Fecha: row.created_at ?? row.fecha ?? "",
        Nombre: row.nombre ?? row.nombre_completo ?? "",
        Teléfono: formatPhone(row.telefono ?? row.celular ?? ""),
        Colonia: row.colonia ?? "",
        Comentario: row.comentario ?? row.descripcion ?? "",
      };
    });

    const workbook = window.XLSX.utils.book_new();
    const sheet = window.XLSX.utils.json_to_sheet(data);
    window.XLSX.utils.book_append_sheet(workbook, sheet, "Retro ciudadana");
    window.XLSX.writeFile(workbook, "retro-ciudadana-uat.xlsx");
  });
}

"use strict";

import { getDeviceContext } from "/PRI/JS/ui/deviceContext.js";

const PREVIEW_LIMIT = 5;
const FILE_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function initExportXLSXHome({
  buttonId = "red-btn-export",
  fetchRows,
  toast,
} = {}) {
  const btn = document.getElementById(buttonId);
  if (!btn || typeof fetchRows !== "function") return;

  const modal = ensureExportPreviewModal();
  if (!modal) return;

  btn.addEventListener("click", async (event) => {
    event.preventDefault();

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Preparando...";

    try {
      if (!window.XLSX) {
        throw new Error("XLSX no está cargado en la vista.");
      }

      const rows = await fetchRows();

      if (!Array.isArray(rows) || !rows.length) {
        toast?.("No hay personas para exportar.", "warning");
        return;
      }

      const device = getDeviceContext();

      if (device.isDesktop) {
        const exportFile = buildWorkbookFile(rows);
        downloadFile(exportFile);
        toast?.(`Exportadas: ${rows.length} persona(s).`, "exito");
        return;
      }

      openExportPreviewModal({
        modal,
        rows,
        toast,
      });
    } catch (err) {
      console.error("[ExportXLSXHome] error:", err);
      toast?.(err?.message || "No se pudo exportar el archivo de Excel.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}

function ensureExportPreviewModal() {
  let modal = document.getElementById("red-export-preview-modal");
  if (modal) return modal;

  modal = document.createElement("section");
  modal.id = "red-export-preview-modal";
  modal.className = "red-export-preview-modal";
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");

  modal.innerHTML = `
    <div class="red-export-preview-overlay" data-red-export-close></div>

    <article class="red-export-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="red-export-preview-title">
      <header class="red-export-preview-header">
        <div class="red-export-preview-titlebox">
          <p class="red-export-preview-kicker">Exportación RED</p>
          <h2 id="red-export-preview-title">Vista previa para compartir</h2>
          <p id="red-export-preview-summary" class="red-export-preview-summary"></p>
        </div>

        <button type="button" class="red-export-preview-close" data-red-export-close aria-label="Cerrar">
          ×
        </button>
      </header>

      <div class="red-export-preview-body">
        <div id="red-export-preview-list" class="red-export-preview-list"></div>
      </div>

      <footer class="red-export-preview-footer">
        <button type="button" id="red-export-preview-share" class="red-export-preview-share">
          Compartir
        </button>
      </footer>
    </article>
  `;

  document.body.appendChild(modal);

  modal.querySelectorAll("[data-red-export-close]").forEach((node) => {
    node.addEventListener("click", () => closeExportPreviewModal(modal));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (modal.hidden) return;

    closeExportPreviewModal(modal);
  });

  return modal;
}

function openExportPreviewModal({
  modal,
  rows,
  toast,
}) {
  const summary = modal.querySelector("#red-export-preview-summary");
  const list = modal.querySelector("#red-export-preview-list");
  const shareBtn = modal.querySelector("#red-export-preview-share");

  const previewRows = rows.slice(0, PREVIEW_LIMIT);

  if (summary) {
    summary.textContent = `Se compartirán ${rows.length} personas. Vista previa de ${previewRows.length}.`;
  }

  if (list) {
    list.innerHTML = previewRows.map((row, index) => {
      const raw = row?.raw || {};
      const nombre =
        raw?.nombre_completo ||
        row?.nombre ||
        [
          raw?.nombres,
          raw?.apellido_paterno,
          raw?.apellido_materno,
        ].filter(Boolean).join(" ").trim() ||
        "Sin nombre";

      const tipo = formatTipoParticipacion(
        raw?.participacion?.tipo_actual ||
        raw?.participacion?.tipo_participacion ||
        raw?.tipo_participacion ||
        row?.tipo
      );

      const seccion =
        raw?.territorio?.seccion?.nombre ||
        raw?.territorio?.seccion?.codigo ||
        raw?.seccion_nombre ||
        raw?.seccion_codigo ||
        row?.seccion ||
        "—";

      return `
        <article class="red-export-preview-card">
          <span class="red-export-preview-index">#${index + 1}</span>
          <h3>${escapeHTML(nombre)}</h3>
          <p><strong>Tipo:</strong> ${escapeHTML(tipo)}</p>
          <p><strong>Sección:</strong> ${escapeHTML(String(seccion))}</p>
        </article>
      `;
    }).join("");
  }

  if (shareBtn) {
    shareBtn.disabled = false;
    shareBtn.textContent = "Compartir";
    shareBtn.onclick = async () => {
      const originalText = shareBtn.textContent;
      shareBtn.disabled = true;
      shareBtn.textContent = "Preparando...";

      try {
        const exportFile = buildWorkbookFile(rows);
        await shareOrDownloadFile(exportFile, rows.length, toast);
        closeExportPreviewModal(modal);
      } catch (err) {
        console.error("[ExportXLSXHome][share] error:", err);
        toast?.(err?.message || "No se pudo compartir el archivo.", "error");
      } finally {
        shareBtn.disabled = false;
        shareBtn.textContent = originalText;
      }
    };
  }

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("red-export-preview-open");
}

function closeExportPreviewModal(modal) {
  if (!modal) return;

  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("red-export-preview-open");
}

async function shareOrDownloadFile(exportFile, totalRows, toast) {
  const canShareFiles =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [exportFile.file] });

  if (canShareFiles) {
    await navigator.share({
      title: exportFile.filename,
      text: `Exportación RED (${totalRows} personas)`,
      files: [exportFile.file],
    });
    toast?.(`Archivo listo para compartir: ${totalRows} persona(s).`, "exito");
    return;
  }

  downloadFile(exportFile);
  toast?.("Tu navegador no permite compartir archivos. Se descargó el Excel.", "warning");
}

function buildWorkbookFile(rows) {
  const data = rows.map(mapPersonRowForExcel);
  const workbook = buildWorkbook(data);
  const filename = makeFilename("red_personas");
  const arrayBuffer = window.XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([arrayBuffer], { type: FILE_MIME });
  const file = new File([blob], filename, { type: FILE_MIME });

  return {
    filename,
    blob,
    file,
  };
}

function buildWorkbook(rows) {
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
  return workbook;
}

function downloadFile(exportFile) {
  const objectUrl = URL.createObjectURL(exportFile.blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = exportFile.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1200);
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

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

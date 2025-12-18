// /JS/expediente.js
function txt(sel, root=document){
  const el = root.querySelector(sel);
  return (el?.textContent || "").trim();
}
function aTxt(attrSel, root=document){
  const el = root.querySelector(attrSel);
  return (el?.getAttribute("data-contact-text") ? el.textContent.trim() : "");
}
function allRows(containerSel, rowSel){
  const root = document.querySelector(containerSel);
  return Array.from(root ? root.querySelectorAll(rowSel) : []);
}

function buildHTMLExpediente() {
  const folio = txt("#req-folio") || "REQ-0000000000";
  const depto = txt("#req-departamento") || "—";
  const fecha = txt("#req-fecha-solicitud") || "—";
  const titulo = (document.querySelector(".exp-title h1")?.textContent || "Requerimiento").trim();

  // Contacto
  const contacto = {
    nombre: document.querySelector('[data-contact-text="contacto_nombre"]')?.textContent?.trim() || "—",
    telefono: document.querySelector('[data-contact-text="contacto_telefono"]')?.textContent?.trim() || "—",
    email: document.querySelector('[data-contact-text="contacto_email"]')?.textContent?.trim() || "—",
    cp: document.querySelector('[data-contact-text="contacto_cp"]')?.textContent?.trim() || "—",
    calle: document.querySelector('[data-contact-text="contacto_calle"]')?.textContent?.trim() || "—",
    colonia: document.querySelector('[data-contact-text="contacto_colonia"]')?.textContent?.trim() || "—",
  };

  // Detalles
  const detalles = {
    tramite: document.querySelector('[data-detalle-text="tramite"]')?.textContent?.trim() || "—",
    asignado: document.querySelector('[data-detalle-text="asignado"]')?.textContent?.trim() || "—",
    descripcion: document.querySelector('[data-detalle-text="descripcion"]')?.textContent?.trim() || "—",
    estatus: document.querySelector('[data-role="status-badge"]')?.textContent?.trim() || "—",
    motivoPC: document.querySelector('#req-motivo-wrap')?.textContent?.trim() || "—",
  };

  // Planeación 
  const procSecciones = allRows('#planeacion-list','section.exp-accordion--fase');
  const planeacion = procSecciones.map(sec => {
    const procTitulo = sec.querySelector('.fase-title')?.textContent?.trim() || 'Proceso';
    const procInicio = sec.querySelector('.fase-date')?.textContent?.trim() || '—';
    const filas = allRows(sec,'.exp-row').map(r => ({
      actividad: r.querySelector('.actividad')?.textContent?.trim() || '—',
      responsable: r.querySelector('.responsable')?.textContent?.trim() || '—',
      estatus: r.querySelector('.estatus')?.textContent?.trim() || '—',
      porcentaje: r.querySelector('.porcentaje .bar')?.style?.width || '0%',
      fecha: r.querySelector('.fecha')?.textContent?.trim() || '—',
    }));
    return { procTitulo, procInicio, filas };
  });

  const styles = `
    <style>
      *{box-sizing:border-box} body{font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#111827;margin:24px;}
      h1{font-size:20px;margin:0 0 8px} h2{font-size:16px;margin:24px 0 8px}
      .meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px}
      .card{border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin:12px 0;background:#fff}
      table{width:100%;border-collapse:collapse;margin-top:6px}
      th,td{border:1px solid #e5e7eb;padding:8px 10px;text-align:left;vertical-align:top}
      th{background:#f9fafb}
      .muted{color:#6b7280}
      .k{color:#374151}
      .v{font-weight:600}
    </style>
  `;

  const planeacionHTML = planeacion.map(p => {
    const rows = p.filas.map(f => `
      <tr>
        <td>${f.actividad}</td>
        <td>${f.responsable}</td>
        <td>${f.estatus}</td>
        <td>${f.porcentaje}</td>
        <td>${f.fecha}</td>
      </tr>
    `).join("");
    return `
      <div class="card">
        <div><strong>Proceso:</strong> ${p.procTitulo} &nbsp; <span class="muted">Inicio:</span> ${p.procInicio}</div>
        <table>
          <thead><tr><th>Actividad</th><th>Responsable</th><th>Estatus</th><th>%</th><th>Fecha inicio</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="5" class="muted">Sin actividades</td></tr>`}</tbody>
        </table>
      </div>
    `;
  }).join("");

  const html = `
  <!doctype html>
  <html lang="es"><head><meta charset="utf-8"><title>Expediente ${folio}</title>${styles}</head>
  <body>
    <h1>${titulo}</h1>
    <div class="meta">
      <div><span class="k">Folio:</span> <span class="v">${folio}</span></div>
      <div><span class="k">Departamento:</span> <span class="v">${depto}</span></div>
      <div><span class="k">Fecha de solicitud:</span> <span class="v">${fecha}</span></div>
    </div>

    <h2>Contacto</h2>
    <div class="card">
      <table>
        <tbody>
          <tr><th>Nombre</th><td>${contacto.nombre}</td></tr>
          <tr><th>Teléfono</th><td>${contacto.telefono}</td></tr>
          <tr><th>Correo</th><td>${contacto.email}</td></tr>
          <tr><th>C.P.</th><td>${contacto.cp}</td></tr>
          <tr><th>Domicilio</th><td>${contacto.calle}</td></tr>
          <tr><th>Colonia</th><td>${contacto.colonia}</td></tr>
        </tbody>
      </table>
    </div>

    <h2>Detalles</h2>
    <div class="card">
      <table>
        <tbody>
          <tr><th>Trámite</th><td>${detalles.tramite}</td></tr>
          <tr><th>Asignado</th><td>${detalles.asignado}</td></tr>
          <tr><th>Estatus</th><td>${detalles.estatus}</td></tr>
          <tr><th>Motivo Pausa/Cancelación</th><td>${detalles.motivoPC}</td></tr>
          <tr><th>Descripción</th><td>${detalles.descripcion}</td></tr>
        </tbody>
      </table>
    </div>

    <h2>Planeación</h2>
    ${planeacionHTML || `<div class="card muted">Sin procesos/planeación</div>`}

    <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300));</script>
  </body></html>`;

  return { html, folio };
}

function openPrintable() {
  const { html, folio } = buildHTMLExpediente();
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `Expediente_${folio}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export function initExpedienteButton(){
  const btn = document.getElementById("btn-expediente");
  if (btn && !btn.__wired){
    btn.__wired = true;
    btn.addEventListener("click", openPrintable);
  }
}

document.addEventListener("DOMContentLoaded", initExpedienteButton);

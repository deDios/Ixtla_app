(() => {
  "use strict";

  const API = {
    departamentos: "/db/web/ixtla01_c_departamentos.php",
    byTramite:     "/db/web/req_stats_by_tramite.php",
    byStatus:      "/db/web/req_stats_by_status.php",
    openClosed:    "/db/web/req_stats_open_closed.php",
    colonias:      "/db/web/ixtla01_c_cpcolonia_latlon.php" 
  };

  const STATUS_LABELS = ["Solicitud", "Revisión", "Asignación", "En proceso", "Pausado", "Cancelado", "Finalizado"];
  const DEPT_ICONS = {
    "Todos": "▦", "Parques y Jardines": "🌳", "Ecología": "🍃",
    "Padrón y Licencias": "📋", "Alumbrado Público": "💡",
    "Obras Públicas": "🏗️", "Aseo Público": "🧹", "SAMAPA": "💧"
  };

  let currentDept = null;
  let currentMonth = "";
  let map = null, heatLayer = null;

  async function fetchJSON(url, opts = {}) {
    const r = await fetch(url, {
      method: opts.method || "GET",
      headers: { "Content-Type": "application/json" },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: "include"
    });
    return r.json();
  }

  /* ====== GRÁFICA DE DONA FIDELIDAD ====== */
  function drawFidelityDonut(canvas, a, c) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const total = a + c;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 80;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (total === 0) return;

    const slices = [
      { value: a, color: "#22c55e", label: "Abiertos" }, // Verde
      { value: c, color: "#334155", label: "Cerrados" }  // Gris oscuro
    ];

    let startAngle = -Math.PI / 2;

    slices.forEach(slice => {
      const sliceAngle = (slice.value / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.lineWidth = 40;
      ctx.strokeStyle = slice.color;
      ctx.stroke();

      const midAngle = startAngle + sliceAngle / 2;
      const xLine = centerX + Math.cos(midAngle) * (radius + 20);
      const yLine = centerY + Math.sin(midAngle) * (radius + 20);

      ctx.beginPath();
      ctx.moveTo(centerX + Math.cos(midAngle) * radius, centerY + Math.sin(midAngle) * radius);
      ctx.lineTo(xLine, yLine);
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.stroke();

      const pct = Math.round((slice.value / total) * 100);
      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 11px Inter";
      ctx.textAlign = xLine > centerX ? "left" : "right";
      ctx.fillText(`${slice.label}: ${slice.value} (${pct}%)`, xLine + (xLine > centerX ? 5 : -5), yLine);

      startAngle += sliceAngle;
    });

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 28px Inter";
    ctx.fillStyle = "#1e293b";
    ctx.fillText(total, centerX, centerY);
  }

  /* ====== MAPA: AUTO-CENTRADO E INTENSIDAD ====== */
  function initMap() {
    const el = document.getElementById("map-colonias");
    if (!el || map) return;
    map = L.map(el, { zoomControl: true }).setView([20.55, -103.2], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);
  }

  async function loadHeatmap() {
    initMap();
    try {
      const resp = await fetchJSON(API.colonias, { 
        method: "POST", 
        body: { departamento_id: currentDept, month: currentMonth } 
      });
      
      let maxVal = 0;
      const points = (resp.data || []).map(r => {
          const val = parseFloat(r.total) || 1;
          if (val > maxVal) maxVal = val;
          return [parseFloat(r.lat), parseFloat(r.lon), val];
      });
      
      if (heatLayer) map.removeLayer(heatLayer);
      
      if (points.length > 0) {
        // Configuramos intensidad máxima basada en los datos reales
        heatLayer = L.heatLayer(points, { 
            radius: 30, 
            blur: 20, 
            max: maxVal * 0.8 // Reducir un poco el máximo fuerza a que los colores se vean más cálidos/rojos
        }).addTo(map);
        
        // Auto Centrado del mapa a los puntos obtenidos
        const bounds = L.latLngBounds(points.map(p => [p[0], p[1]]));
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
      }
    } catch (e) { console.error("Error mapa:", e); }
  }

  /* ====== CARGA PRINCIPAL ====== */
  async function reloadDashboard() {
    const payload = { departamento_id: currentDept, month: currentMonth };

    const [tramites, status, oc] = await Promise.all([
      fetchJSON(API.byTramite, { method: "POST", body: payload }),
      fetchJSON(`${API.byStatus}?departamento_id=${currentDept || ''}&month=${currentMonth}`),
      fetchJSON(`${API.openClosed}?departamento_id=${currentDept || ''}&month=${currentMonth}`)
    ]);

    // Llenar la Tabla
    document.getElementById("tbl-tramites-body").innerHTML = (tramites.data || []).map(r => `
      <tr>
        <td>${r.tramite}</td>
        <td class="ta-right">${r.abiertos}</td>
        <td class="ta-right">${r.cerrados}</td>
        <td class="ta-right"><strong>${r.total}</strong></td>
      </tr>
    `).join("");

    // Llenar TODOS los 7 Estatus dinámicamente en el encabezado
    document.getElementById("status-summary-header").innerHTML = STATUS_LABELS.map((label, i) => `
      <div class="header-count-item">
        <span>${label}</span>
        <strong>${status[i] || 0}</strong>
      </div>
    `).join("");

    drawFidelityDonut(document.getElementById("donut-canvas"), parseInt(oc.abiertos || 0), parseInt(oc.cerrados || 0));
    loadHeatmap();
  }

  // Renderizar las pestañas de departamentos
  function renderDepts(list) {
    const wrap = document.getElementById("chips-departamentos");
    wrap.innerHTML = [{id: null, nombre: "Todos"}, ...list].map(d => `
      <div class="ix-chip" aria-selected="${currentDept === d.id}" onclick="window.setDept(${d.id})">
        <span class="ix-chip-icon">${DEPT_ICONS[d.nombre] || "📁"}</span>
        <span class="ix-chip-name">${d.nombre}</span>
      </div>
    `).join("");
  }

  window.setDept = (id) => { 
      currentDept = id; 
      reloadDashboard(); 
      fetchJSON(API.departamentos, { method: "POST", body: { all: true, status: 1 } }).then(r => renderDepts(r.data)); 
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("filtro-mes").onchange = (e) => { 
        currentMonth = e.target.value; 
        reloadDashboard(); 
    };
    fetchJSON(API.departamentos, { method: "POST", body: { all: true, status: 1 } }).then(r => renderDepts(r.data));
    reloadDashboard();
  });

})();
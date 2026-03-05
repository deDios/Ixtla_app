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
  let map = null, bubbleLayer = null;

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
    const radius = 75;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (total === 0) return;

    const slices = [
      { value: a, color: "#22c55e", label: "Abiertos" }, // Verde
      { value: c, color: "#334155", label: "Cerrados" }  // Gris
    ];

    let startAngle = -Math.PI / 2;

    slices.forEach(slice => {
      if (slice.value === 0) return;
      const sliceAngle = (slice.value / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.lineWidth = 35;
      ctx.strokeStyle = slice.color;
      ctx.stroke();

      const midAngle = startAngle + sliceAngle / 2;
      const xLine = centerX + Math.cos(midAngle) * (radius + 15);
      const yLine = centerY + Math.sin(midAngle) * (radius + 15);

      ctx.beginPath();
      ctx.moveTo(centerX + Math.cos(midAngle) * radius, centerY + Math.sin(midAngle) * radius);
      ctx.lineTo(xLine, yLine);
      ctx.strokeStyle = "#cbd5e1";
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
    ctx.font = "bold 26px Inter";
    ctx.fillStyle = "#1e293b";
    ctx.fillText(total, centerX, centerY);
  }

  /* ====== MAPA DE BURBUJAS (Alternativa Visual) ====== */
  function initMap() {
    const el = document.getElementById("map-colonias");
    if (!el || map) return;
    map = L.map(el, { zoomControl: true }).setView([20.55, -103.2], 12);
    // Mapa base claro y limpio
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);
  }

  async function loadBubbleMap() {
    initMap();
    try {
      const resp = await fetchJSON(API.colonias, { 
        method: "POST", 
        body: { departamento_id: currentDept, month: currentMonth } 
      });
      
      const data = resp.data || [];
      if (bubbleLayer) map.removeLayer(bubbleLayer);
      bubbleLayer = L.layerGroup().addTo(map);

      if (data.length === 0) return;

      // Calcular el valor máximo para escalar las burbujas
      const maxVal = Math.max(...data.map(r => parseFloat(r.total) || 0));
      const bounds = [];

      data.forEach(r => {
        const val = parseFloat(r.total) || 0;
        const lat = parseFloat(r.lat);
        const lon = parseFloat(r.lon);

        if (isNaN(lat) || isNaN(lon) || val === 0) return;

        bounds.push([lat, lon]);

        // Cálculo de tamaño y color
        const ratio = val / maxVal;
        let color = "#3b82f6"; // Azul para bajos
        if (ratio > 0.7) color = "#ef4444"; // Rojo para altos
        else if (ratio > 0.3) color = "#f59e0b"; // Naranja para medios

        const radius = 10 + (ratio * 20); // Tamaño entre 10px y 30px

        const circle = L.circleMarker([lat, lon], {
          radius: radius,
          fillColor: color,
          color: "#ffffff",
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.7
        }).addTo(bubbleLayer);

        circle.bindTooltip(`<strong>${r.colonia || 'Zona'}</strong><br>Requerimientos: ${val}`, {direction: 'top'});
      });

      // Auto Centrado
      if (bounds.length > 0) {
        map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 15 });
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

    // Tabla
    document.getElementById("tbl-tramites-body").innerHTML = (tramites.data || []).map(r => `
      <tr>
        <td>${r.tramite}</td>
        <td class="ta-right">${r.abiertos}</td>
        <td class="ta-right">${r.cerrados}</td>
        <td class="ta-right"><strong>${r.total}</strong></td>
      </tr>
    `).join("");

    // Todos los Estatus
    document.getElementById("status-summary-header").innerHTML = STATUS_LABELS.map((label, i) => `
      <div class="header-count-item">
        <span>${label}</span>
        <strong>${status[i] || 0}</strong>
      </div>
    `).join("");

    drawFidelityDonut(document.getElementById("donut-canvas"), parseInt(oc.abiertos || 0), parseInt(oc.cerrados || 0));
    loadBubbleMap();
  }

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
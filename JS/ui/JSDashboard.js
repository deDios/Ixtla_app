(() => {
  "use strict";

  const API = {
    departamentos: "/db/web/ixtla01_c_departamentos.php",
    byTramite:     "/db/web/req_stats_by_tramite.php",
    byStatus:      "/db/web/req_stats_by_status.php",
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

  /* ====== GRÁFICA DE DONA (Limpia sin textos extra) ====== */
  function drawFidelityDonut(canvas, dataSlices) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 80;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const total = dataSlices.reduce((sum, slice) => sum + slice.value, 0);
    if (total === 0) return;

    let startAngle = -Math.PI / 2;

    dataSlices.forEach(slice => {
      if (slice.value === 0) return;
      const sliceAngle = (slice.value / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.lineWidth = 35;
      ctx.strokeStyle = slice.color;
      ctx.stroke();
      startAngle += sliceAngle;
    });

    // Texto Central
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 28px Inter";
    ctx.fillStyle = "#1e293b";
    ctx.fillText(total, centerX, centerY);
  }

  function renderDonutLegend(dataSlices) {
    const container = document.getElementById("donut-legend");
    const total = dataSlices.reduce((sum, slice) => sum + slice.value, 0);
    
    container.innerHTML = dataSlices.map(d => {
        const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
        return `
          <div class="donut-legend-item">
            <div class="donut-legend-color" style="background:${d.color}"></div>
            <span>${d.label}</span>
            <span class="donut-legend-val">${d.value} (${pct}%)</span>
          </div>
        `;
    }).join("");
  }

  /* ====== MAPA DE BURBUJAS (Punto inicial fino) ====== */
  function initMap() {
    const el = document.getElementById("map-colonias");
    if (!el || map) return;
    map = L.map(el, { zoomControl: true }).setView([20.55, -103.2], 12);
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
      const bounds = [];

      data.forEach(r => {
        const val = parseFloat(r.total) || 0;
        const lat = parseFloat(r.lat);
        const lon = parseFloat(r.lon);

        if (isNaN(lat) || isNaN(lon) || val === 0) return;
        bounds.push([lat, lon]);

        // AJUSTE: Base más chica (5px) y crecimiento más controlado
        const increments = Math.floor(val / 25);
        const radius = Math.min(2 + (increments * 2), 20); // Base 5px, tope máximo 35px

        // Color basado en el volumen
        let color = "#3b82f6"; // Azul para bajos
        if (val >= 50) color = "#ef4444"; // Rojo para altos
        else if (val >= 25) color = "#f59e0b"; // Naranja para medios

        const circle = L.circleMarker([lat, lon], {
          radius: radius,
          fillColor: color,
          color: "#ffffff",
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.8
        }).addTo(bubbleLayer);

        circle.bindTooltip(`<strong>${r.colonia || 'Zona'}</strong><br>Requerimientos: ${val}`, {direction: 'top'});
      });

      if (bounds.length > 0) {
        map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 15 });
      }
    } catch (e) { console.error("Error mapa:", e); }
  }

  /* ====== CARGA PRINCIPAL ====== */
  async function reloadDashboard() {
    const payload = { departamento_id: currentDept, month: currentMonth };

    const [tramites, status] = await Promise.all([
      fetchJSON(API.byTramite, { method: "POST", body: payload }),
      fetchJSON(`${API.byStatus}?departamento_id=${currentDept || ''}&month=${currentMonth}`)
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

    // Configuración de la Dona
    const abiertos = (status[0]||0) + (status[1]||0) + (status[2]||0) + (status[3]||0);
    const finalizados = status[6]||0;
    const pausados = status[4]||0;
    const cancelados = status[5]||0;

    const donutData = [
      { label: "Abiertos", value: abiertos, color: "#22c55e" }, // Verde
      { label: "Finalizados", value: finalizados, color: "#334155" }, // Gris Oscuro
      { label: "Pausados", value: pausados, color: "#f59e0b" }, // Naranja
      { label: "Cancelados", value: cancelados, color: "#ef4444" } // Rojo
    ];

    drawFidelityDonut(document.getElementById("donut-canvas"), donutData);
    renderDonutLegend(donutData);

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
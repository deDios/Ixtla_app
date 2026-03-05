(() => {
  "use strict";

  const API = {
    departamentos: "/db/web/ixtla01_c_departamentos.php",
    byTramite:     "/db/web/req_stats_by_tramite.php",
    byStatus:      "/db/web/req_stats_by_status.php",
    colonias:      "/db/web/ixtla01_c_cpcolonia_latlon.php",
    kpis:          "/db/web/req_stats_kpis.php" // Conexión a tu nuevo script
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
    try {
        const r = await fetch(url, {
        method: opts.method || "GET",
        headers: { "Content-Type": "application/json" },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        credentials: "include"
        });
        return await r.json();
    } catch(e) {
        console.error("Error fetching", url, e);
        return {};
    }
  }

  /* ====== GRÁFICA DE DONA ====== */
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
          </div>`;
    }).join("");
  }

  /* ====== MAPA Y CÁLCULO DE TOP CP ====== */
  function initMap() {
    const el = document.getElementById("map-colonias");
    if (!el || map) return;
    map = L.map(el, { zoomControl: true }).setView([20.55, -103.2], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);
  }

  function processBubbleMap(geoData) {
    initMap();
    if (bubbleLayer) map.removeLayer(bubbleLayer);
    bubbleLayer = L.layerGroup().addTo(map);

    let topZone = { cp: "--", colonia: "Sin reportes", total: -1 };
    if (!geoData || geoData.length === 0) return topZone;
    
    const bounds = [];
    geoData.forEach(r => {
      const val = parseFloat(r.total) || 0;
      const lat = parseFloat(r.lat);
      const lon = parseFloat(r.lon);

      // Obtener el registro top
      if (val > topZone.total) {
          topZone = { cp: r.cp || '--', colonia: r.colonia || 'Desconocida', total: val };
      }

      if (isNaN(lat) || isNaN(lon) || val === 0) return;
      bounds.push([lat, lon]);

      const increments = Math.floor(val / 25);
      const radius = Math.min(5 + (increments * 5), 35);

      let color = "#3b82f6";
      if (val >= 50) color = "#ef4444";
      else if (val >= 25) color = "#f59e0b";

      const circle = L.circleMarker([lat, lon], {
        radius: radius, fillColor: color, color: "#ffffff", weight: 1.5, opacity: 1, fillOpacity: 0.8
      }).addTo(bubbleLayer);

      circle.bindTooltip(`<strong>${r.colonia || 'Zona'}</strong><br>Requerimientos: ${val}`, {direction: 'top'});
    });

    if (bounds.length > 0) map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 15 });
    return topZone;
  }

  /* ====== ORQUESTADOR PRINCIPAL ====== */
  async function reloadDashboard() {
    const payload = { departamento_id: currentDept, month: currentMonth };

    const [tramites, status, kpis, geo] = await Promise.all([
      fetchJSON(API.byTramite, { method: "POST", body: payload }),
      fetchJSON(`${API.byStatus}?departamento_id=${currentDept || ''}&month=${currentMonth}`),
      fetchJSON(API.kpis, { method: "POST", body: payload }),
      fetchJSON(API.colonias, { method: "POST", body: payload })
    ]);

    // Llenar Tabla
    document.getElementById("tbl-tramites-body").innerHTML = (tramites.data || []).map(r => `
      <tr>
        <td>${r.tramite}</td>
        <td class="ta-right">${r.abiertos}</td>
        <td class="ta-right">${r.cerrados}</td>
        <td class="ta-right"><strong>${r.total}</strong></td>
      </tr>
    `).join("");

    // Llenar Estatus
    document.getElementById("status-summary-header").innerHTML = STATUS_LABELS.map((label, i) => `
      <div class="header-count-item">
        <span>${label}</span>
        <strong>${status[i] || 0}</strong>
      </div>
    `).join("");

    // Dona
    const abiertos = (status[0]||0) + (status[1]||0) + (status[2]||0) + (status[3]||0);
    const finalizados = status[6]||0;
    const pausados = status[4]||0;
    const cancelados = status[5]||0;
    const donutData = [
      { label: "Abiertos", value: abiertos, color: "#22c55e" }, 
      { label: "Finalizados", value: finalizados, color: "#334155" },
      { label: "Pausados", value: pausados, color: "#f59e0b" },
      { label: "Cancelados", value: cancelados, color: "#ef4444" }
    ];
    drawFidelityDonut(document.getElementById("donut-canvas"), donutData);
    renderDonutLegend(donutData);

    // Mapa y Top CP
    const topCP = processBubbleMap(geo.data);

    // Inyectar KPIs desde la BD y el Mapa
    document.getElementById("kpi-val-semana").textContent = kpis.promedio_semanal || "0";
    document.getElementById("kpi-val-tiempo").textContent = (kpis.tiempo_resolucion || "0") + " Días";
    document.getElementById("kpi-val-cp").textContent = topCP.total > -1 ? topCP.cp : "--";
    document.getElementById("kpi-sub-cp").textContent = topCP.colonia;
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
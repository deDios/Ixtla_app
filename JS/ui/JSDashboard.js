(() => {
  "use strict";

  const API = {
    departamentos: "/db/web/ixtla01_c_departamentos.php",
    byTramite:     "/db/web/req_stats_by_tramite.php",
    byStatus:      "/db/web/req_stats_by_status.php",
    openClosed:    "/db/web/req_stats_open_closed.php",
    colonias:      "/db/web/ixtla01_c_cpcolonia_latlon.php" 
  };

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
    const radius = 85;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (total === 0) return;

    const slices = [
      { value: a, color: "#14b8a6", label: "Abiertos" },
      { value: c, color: "#334155", label: "Cerrados" }
    ];

    let startAngle = -Math.PI / 2;

    slices.forEach(slice => {
      const sliceAngle = (slice.value / total) * 2 * Math.PI;
      
      // Arco
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.lineWidth = 40;
      ctx.strokeStyle = slice.color;
      ctx.stroke();

      // Etiquetas y Líneas
      const midAngle = startAngle + sliceAngle / 2;
      const xLine = centerX + Math.cos(midAngle) * (radius + 20);
      const yLine = centerY + Math.sin(midAngle) * (radius + 20);

      ctx.beginPath();
      ctx.moveTo(centerX + Math.cos(midAngle) * radius, centerY + Math.sin(midAngle) * radius);
      ctx.lineTo(xLine, yLine);
      ctx.strokeStyle = "#e2e8f0";
      ctx.stroke();

      const pct = Math.round((slice.value / total) * 100);
      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 12px Inter";
      ctx.textAlign = xLine > centerX ? "left" : "right";
      ctx.fillText(`${slice.value} (${pct}%)`, xLine + (xLine > centerX ? 5 : -5), yLine);

      startAngle += sliceAngle;
    });

    // Texto Central
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 28px Inter";
    ctx.fillStyle = "#1e293b";
    ctx.fillText(total, centerX, centerY);
  }

  /* ====== MAPA (SATELITAL + CALOR) ====== */
  function initMap() {
    const el = document.getElementById("map-colonias");
    if (!el || map) return;
    map = L.map(el, { zoomControl: false }).setView([20.55, -103.2], 12);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Esri'
    }).addTo(map);
  }

  async function reloadDashboard() {
    initMap();
    const payload = { departamento_id: currentDept, month: currentMonth };

    const [tramites, status, oc, geo] = await Promise.all([
      fetchJSON(API.byTramite, { method: "POST", body: payload }),
      fetchJSON(`${API.byStatus}?departamento_id=${currentDept || ''}&month=${currentMonth}`),
      fetchJSON(`${API.openClosed}?departamento_id=${currentDept || ''}&month=${currentMonth}`),
      fetchJSON(API.colonias, { method: "POST", body: payload })
    ]);

    // Tabla
    document.getElementById("tbl-tramites-body").innerHTML = (tramites.data || []).map(r => `
      <tr>
        <td>${r.tramite}</td>
        <td>${r.abiertos}</td>
        <td>${r.cerrados}</td>
        <td class="ta-right"><strong>${r.total}</strong></td>
      </tr>
    `).join("");

    // Resumen Superior Tabla
    document.getElementById("status-summary-header").innerHTML = `
      <div class="stat-item"><span>Finalizado</span><strong>${status[6] || 0}</strong></div>
      <div class="stat-item"><span>Asignación</span><strong>${status[2] || 0}</strong></div>
      <div class="stat-item"><span>En proceso</span><strong>${status[3] || 0}</strong></div>
    `;

    // Gráfica
    drawFidelityDonut(document.getElementById("donut-canvas"), parseInt(oc.abiertos), parseInt(oc.cerrados));

    // Mapa de Calor
    const points = (geo.data || []).map(r => [parseFloat(r.lat), parseFloat(r.lon), 1]);
    if (heatLayer) map.removeLayer(heatLayer);
    heatLayer = L.heatLayer(points, { radius: 25, blur: 15 }).addTo(map);
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
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
    "Todos": "🔲", "Parques y Jardines": "🌳", "Ecología": "🍃",
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

  /* ====== GRÁFICA DE DONA CON ETIQUETAS ====== */
  function drawDonutWithLabels(canvas, a, c) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const total = a + c;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 80;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (total === 0) return;

    const data = [
        { label: "Abiertos", value: a, color: "#26c6da" }, // Teal del mockup
        { label: "Cerrados", value: c, color: "#455a64" }  // Gris oscuro
    ];

    let startAngle = -Math.PI / 2;

    data.forEach(item => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;
      
      // Dibujar Arco
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.lineWidth = 45;
      ctx.strokeStyle = item.color;
      ctx.stroke();

      // Dibujar Etiquetas y Líneas
      const midAngle = startAngle + sliceAngle / 2;
      const lineX = centerX + Math.cos(midAngle) * (radius + 30);
      const lineY = centerY + Math.sin(midAngle) * (radius + 30);
      
      ctx.beginPath();
      ctx.moveTo(centerX + Math.cos(midAngle) * radius, centerY + Math.sin(midAngle) * radius);
      ctx.lineTo(lineX, lineY);
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.stroke();

      const pct = Math.round((item.value / total) * 100);
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 12px Inter";
      ctx.textAlign = lineX > centerX ? "left" : "right";
      ctx.fillText(`${item.value} (${pct}%)`, lineX + (lineX > centerX ? 5 : -5), lineY);

      startAngle += sliceAngle;
    });

    // Texto Central
    ctx.textAlign = "center";
    ctx.font = "bold 24px Inter";
    ctx.fillStyle = "#0f172a";
    ctx.fillText(total, centerX, centerY + 10);
  }

  /* ====== MAPA ====== */
  function initMap() {
    const el = document.getElementById("map-colonias");
    if (!el || map) return;
    map = L.map(el, { zoomControl: false }).setView([20.55, -103.2], 12);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(map);
  }

  async function reloadDashboard() {
    initMap();
    const [tramites, status, openClosed, geo] = await Promise.all([
      fetchJSON(API.byTramite, { method: "POST", body: { departamento_id: currentDept, month: currentMonth } }),
      fetchJSON(`${API.byStatus}?departamento_id=${currentDept || ''}&month=${currentMonth}`),
      fetchJSON(`${API.openClosed}?departamento_id=${currentDept || ''}&month=${currentMonth}`),
      fetchJSON(API.colonias, { method: "POST", body: { departamento_id: currentDept, month: currentMonth } })
    ]);

    // Render Tabla
    document.getElementById("tbl-tramites-body").innerHTML = (tramites.data || []).map(r => `
      <tr>
        <td>${r.tramite}</td>
        <td>${r.abiertos}</td>
        <td>${r.cerrados}</td>
        <td><strong>${r.total}</strong></td>
      </tr>
    `).join("");

    // Render Status Headers (Header de la tabla)
    const statusLabels = ["Finalizado", "Asignación", "En proceso"];
    document.getElementById("cards-estatus-header").innerHTML = `
        <div class="header-count-item"><span>Finalizado</span><strong>${status[6] || 0}</strong></div>
        <div class="header-count-item"><span>Asignación</span><strong>${status[2] || 0}</strong></div>
        <div class="header-count-item"><span>En proceso</span><strong>${status[3] || 0}</strong></div>
    `;

    // Gráfica
    drawDonutWithLabels(document.getElementById("donut-open-close-canvas"), parseInt(openClosed.abiertos), parseInt(openClosed.cerrados));

    // Heatmap
    const points = (geo.data || []).map(r => [parseFloat(r.lat), parseFloat(r.lon), 1]);
    if (heatLayer) map.removeLayer(heatLayer);
    heatLayer = L.heatLayer(points, { radius: 20, blur: 15 }).addTo(map);
  }

  function renderDepts(list) {
    const wrap = document.getElementById("chips-departamentos");
    wrap.innerHTML = [{id: null, nombre: "Todos"}, ...list].map(d => `
      <div class="ix-chip" aria-selected="${currentDept === d.id}" onclick="window.filterDept(${d.id})">
        <span class="ix-chip-icon">${DEPT_ICONS[d.nombre] || "📁"}</span>
        <span class="ix-chip-name">${d.nombre}</span>
      </div>
    `).join("");
  }

  window.filterDept = (id) => {
    currentDept = id;
    reloadDashboard();
    fetchJSON(API.departamentos, { method: "POST", body: { all: true, status: 1 } }).then(r => renderDepts(r.data));
  };

  document.addEventListener("DOMContentLoaded", () => {
    fetchJSON(API.departamentos, { method: "POST", body: { all: true, status: 1 } }).then(r => renderDepts(r.data));
    reloadDashboard();
  });

})();
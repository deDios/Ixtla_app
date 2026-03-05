(() => {
  "use strict";

  const API = {
    departamentos: "/db/web/ixtla01_c_departamentos.php",
    byTramite:     "/db/web/req_stats_by_tramite.php",
    byStatus:      "/db/web/req_stats_by_status.php",
    colonias:      "/db/web/ixtla01_c_cpcolonia_latlon.php",
    kpis:          "/db/web/req_stats_kpis.php"
  };

  const STATUS_LABELS = ["Solicitud", "Revisión", "Asignación", "En proceso", "Pausado", "Cancelado", "Finalizado"];
  const DEPT_ICONS = { "Todos": "▦", "Parques y Jardines": "🌳", "Ecología": "🍃", "Padrón y Licencias": "📋", "Alumbrado Público": "💡", "Obras Públicas": "🏗️", "Aseo Público": "🧹", "SAMAPA": "💧" };

  let currentDept = null;
  let currentMonth = "";
  let map = null, bubbleLayer = null;

  let globalDeptList = []; 
  let demoInterval = null;

  // FETCH CON CACHE-BUSTING
  async function fetchJSON(url, opts = {}) {
    try {
        const noCacheUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
        const r = await fetch(noCacheUrl, {
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

  /* ====== SELECTOR DE MES ====== */
  function initCustomSelect() {
      const header = document.getElementById("multiselect-header");
      const dropdown = document.getElementById("multiselect-dropdown");
      const radios = document.querySelectorAll(".month-radio");
      const title = document.getElementById("multiselect-title");

      header.addEventListener("click", () => dropdown.classList.toggle("show"));
      document.addEventListener("click", (e) => {
          if (!header.contains(e.target) && !dropdown.contains(e.target)) dropdown.classList.remove("show");
      });

      radios.forEach(radio => {
          radio.addEventListener("change", (e) => {
              currentMonth = e.target.value;
              title.textContent = currentMonth === "" ? "Todos los meses" : e.target.getAttribute('data-label');
              dropdown.classList.remove("show");
              reloadDashboard();
          });
      });
  }

  /* ====== GRÁFICA DE DONA ====== */
  function drawFidelityDonut(canvas, dataSlices) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const centerX = canvas.width / 2, centerY = canvas.height / 2, radius = 75;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const total = dataSlices.reduce((sum, slice) => sum + slice.value, 0);
    if (total === 0) return;
    
    let startAngle = -Math.PI / 2;
    dataSlices.forEach(slice => {
      if (slice.value === 0) return;
      const sliceAngle = (slice.value / total) * 2 * Math.PI;
      ctx.beginPath(); ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.lineWidth = 32; ctx.strokeStyle = slice.color; ctx.stroke();
      startAngle += sliceAngle;
    });
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 28px Inter"; ctx.fillStyle = "#1e293b";
    ctx.fillText(total, centerX, centerY);
  }

  function renderDonutLegend(dataSlices) {
    const container = document.getElementById("donut-legend");
    const total = dataSlices.reduce((sum, slice) => sum + slice.value, 0);
    // Renderizado en Lista Vertical
    container.innerHTML = dataSlices.map(d => {
        const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
        return `<div class="donut-legend-item">
                  <div class="donut-legend-color" style="background:${d.color}"></div>
                  <span>${d.label}</span>
                  <span class="donut-legend-val">${d.value} (${pct}%)</span>
                </div>`;
    }).join("");
  }

  /* ====== MAPA ESTILO CALLES CLARAS ====== */
  function initMap() {
    const el = document.getElementById("map-colonias");
    if (!el || map) return;
    
    map = L.map("map-colonias", { zoomControl: true }).setView([20.55, -103.2], 12);
    
    // Cambiado a CartoDB Light (Calles limpias, claras, sin verde de vegetación)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { 
        maxZoom: 18,
        attribution: '© OpenStreetMap, © CARTO'
    }).addTo(map);
    
    bubbleLayer = L.layerGroup().addTo(map);
  }

  function processBubbleMap(geoData) {
    initMap();
    
    // Forzamos al mapa a recalcular su tamaño
    setTimeout(() => { if (map) map.invalidateSize(); }, 300);
    
    bubbleLayer.clearLayers(); 

    let topZone = { cp: "--", colonia: "Sin reportes", total: -1 };
    if (!geoData || geoData.length === 0) return topZone;
    
    const bounds = [];
    geoData.forEach(r => {
      const val = parseFloat(r.total) || 0, lat = parseFloat(r.lat), lon = parseFloat(r.lon);
      if (val > topZone.total) topZone = { cp: r.cp || '--', colonia: r.colonia || 'Desconocida', total: val };
      if (isNaN(lat) || isNaN(lon) || val === 0) return;
      bounds.push([lat, lon]);

      const radius = Math.min(5 + (Math.floor(val / 25) * 5), 35);
      let color = val >= 50 ? "#ef4444" : (val >= 25 ? "#f59e0b" : "#3b82f6");

      L.circleMarker([lat, lon], { radius: radius, fillColor: color, color: "#ffffff", weight: 1.5, opacity: 1, fillOpacity: 0.8 })
       .addTo(bubbleLayer)
       .bindTooltip(`<strong>${r.colonia || 'Zona'}</strong><br>Requerimientos: ${val}`, {direction: 'top'});
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

    document.getElementById("tbl-tramites-body").innerHTML = (tramites.data || []).map(r => `<tr><td>${r.tramite}</td><td class="ta-right">${r.abiertos}</td><td class="ta-right">${r.cerrados}</td><td class="ta-right"><strong>${r.total}</strong></td></tr>`).join("");
    document.getElementById("status-summary-header").innerHTML = STATUS_LABELS.map((label, i) => `<div class="header-count-item"><span>${label}</span><strong>${status[i] || 0}</strong></div>`).join("");

    const abiertos = (status[0]||0) + (status[1]||0) + (status[2]||0) + (status[3]||0);
    const finalizados = status[6]||0, pausados = status[4]||0, cancelados = status[5]||0;
    const donutData = [
        { label: "Abiertos", value: abiertos, color: "#22c55e" }, 
        { label: "Finalizados", value: finalizados, color: "#334155" }, 
        { label: "Pausados", value: pausados, color: "#f59e0b" }, 
        { label: "Cancelados", value: cancelados, color: "#ef4444" }
    ];
    
    drawFidelityDonut(document.getElementById("donut-canvas"), donutData);
    renderDonutLegend(donutData);

    const topCP = processBubbleMap(geo.data);

    document.getElementById("kpi-val-semana").textContent = kpis.promedio_semanal || "0";
    document.getElementById("kpi-val-tiempo").textContent = (kpis.tiempo_resolucion || "0") + " Días";
    document.getElementById("kpi-val-incidencias").textContent = topCP.total > -1 ? topCP.total : "0";
    document.getElementById("kpi-sub-cp").textContent = topCP.total > -1 ? `${topCP.colonia} / CP ${topCP.cp}` : "Sin datos";
  }

  /* ====== DEPARTAMENTOS Y DEMO ====== */
  function renderDepts(list) {
    const wrap = document.getElementById("chips-departamentos");
    wrap.innerHTML = [{id: null, nombre: "Todos"}, ...list].map(d => `
      <div class="ix-chip" aria-selected="${currentDept === d.id}" onclick="window.setDept(${d.id})">
        <span class="ix-chip-icon">${DEPT_ICONS[d.nombre] || "📁"}</span>
        <span class="ix-chip-name">${d.nombre}</span>
      </div>
    `).join("");

    setTimeout(() => {
        const activeChip = document.querySelector('.ix-chip[aria-selected="true"]');
        if (activeChip) activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 100);
  }

  window.setDept = (id) => { currentDept = id; renderDepts(globalDeptList); reloadDashboard(); };

  function toggleDemoMode(isActive) {
      if (isActive) {
          demoInterval = setInterval(() => {
              const allIds = [null, ...globalDeptList.map(d => d.id)];
              let nextIndex = (allIds.indexOf(currentDept) + 1) % allIds.length;
              currentDept = allIds[nextIndex];
              renderDepts(globalDeptList);
              reloadDashboard();
          }, 20000);
      } else {
          if (demoInterval) clearInterval(demoInterval);
          demoInterval = null;
      }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initCustomSelect();

    const demoCheck = document.getElementById("demo-mode-checkbox");
    if (demoCheck) demoCheck.addEventListener("change", (e) => toggleDemoMode(e.target.checked));

    fetchJSON(API.departamentos, { method: "POST", body: { all: true, status: 1 } }).then(r => {
        globalDeptList = r.data || [];
        renderDepts(globalDeptList);
    });
    reloadDashboard();
  });

})();
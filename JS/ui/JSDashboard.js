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
    "Todos": "🏢",
    "Parques y Jardines": "🌳",
    "Ecología": "🌿",
    "Padrón y Licencias": "📜",
    "Alumbrado Público": "💡",
    "Obras Públicas": "🏗️",
    "Aseo Público": "🧹",
    "SAMAPA": "🚰"
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

  /* ====== GESTIÓN DEL MAPA ====== */
  function initMap() {
    const el = document.getElementById("map-colonias");
    if (!el || map) return;
    map = L.map(el, { zoomControl: true, attributionControl: false }).setView([20.55, -103.2], 12);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(map);
  }

  async function loadHeatmap() {
    initMap();
    try {
      const resp = await fetchJSON(API.colonias, { 
        method: "POST", 
        body: { departamento_id: currentDept, month: currentMonth } 
      });
      const points = (resp.data || [])
        .map(r => [parseFloat(r.lat), parseFloat(r.lon), parseInt(r.total)])
        .filter(p => !isNaN(p[0]) && !isNaN(p[1]));
      
      if (heatLayer) map.removeLayer(heatLayer);
      if (points.length > 0) {
        heatLayer = L.heatLayer(points, { radius: 25, blur: 15, max: 1.0 }).addTo(map);
      }
    } catch (e) { console.error("Error cargando mapa:", e); }
  }

  /* ====== CARGA DE COMPONENTES ====== */
  async function reloadDashboard() {
    loadHeatmap();
    loadTramitesTable();
    loadStatusBadges();
    loadOpenClosedStats();
    updateKPIs();
  }

  function updateKPIs() {
    // Ejemplo de actualización visual de totalizadores
    document.getElementById('kpi-val-semana').textContent = "14.2";
    document.getElementById('kpi-val-tiempo').textContent = "2d 6h";
    document.getElementById('kpi-val-cp').textContent = "45405";
  }

  function renderDeptSelector(list) {
    const wrap = document.getElementById("chips-departamentos");
    if (!wrap) return;
    wrap.innerHTML = "";
    
    const items = [{id: null, nombre: "Todos"}, ...list];
    items.forEach(d => {
      const btn = document.createElement("button");
      btn.className = "ix-chip";
      btn.setAttribute("aria-selected", currentDept === d.id ? "true" : "false");
      btn.innerHTML = `<span class="ix-chip-icon">${DEPT_ICONS[d.nombre] || "📂"}</span><span>${d.nombre}</span>`;
      btn.onclick = () => {
        currentDept = d.id;
        renderDeptSelector(list);
        reloadDashboard();
      };
      wrap.appendChild(btn);
    });
  }

  async function loadTramitesTable() {
    const resp = await fetchJSON(API.byTramite, { method: "POST", body: { departamento_id: currentDept, month: currentMonth } });
    const tbody = document.getElementById("tbl-tramites-body");
    if (!tbody) return;
    tbody.innerHTML = (resp.data || []).map(r => `
      <div class="ix-row">
        <div>${r.tramite}</div>
        <div class="ta-right">${r.abiertos}</div>
        <div class="ta-right">${r.cerrados}</div>
        <div class="ta-right"><strong>${r.total}</strong></div>
      </div>
    `).join("");
  }

  async function loadStatusBadges() {
    const url = `${API.byStatus}?departamento_id=${currentDept || ''}&month=${currentMonth}`;
    const resp = await fetchJSON(url);
    const labels = ["Solicitud", "Revisión", "Asignación", "En proceso", "Pausado", "Cancelado", "Finalizado"];
    const wrap = document.getElementById("cards-estatus");
    if (!wrap) return;
    wrap.innerHTML = labels.map((l, i) => `
      <div class="ix-badge"><div>${l}</div><strong>${resp[i] || 0}</strong></div>
    `).join("");
  }

  async function loadOpenClosedStats() {
    // Lógica para actualizar las gráficas de dona
    const url = `${API.openClosed}?departamento_id=${currentDept || ''}&month=${currentMonth}`;
    const resp = await fetchJSON(url);
    // (Integración con la función drawDonut existente)
  }

  /* ====== INICIALIZACIÓN ====== */
  document.addEventListener("DOMContentLoaded", () => {
    const monthSelect = document.getElementById("filtro-mes");
    if (monthSelect) {
      monthSelect.onchange = () => { 
        currentMonth = monthSelect.value; 
        reloadDashboard(); 
      };
    }
    
    // Carga inicial de departamentos y dashboard
    fetchJSON(API.departamentos, { method: "POST", body: { all: true, status: 1 } })
      .then(resp => renderDeptSelector(resp.data || []));
      
    reloadDashboard();
  });
})();
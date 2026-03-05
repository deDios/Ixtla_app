/* JSDashboard.js - Versión Corregida y Funcional */
(() => {
  "use strict";
  if (window.__gcGlobalInit) return;
  window.__gcGlobalInit = true;

  /* ===================== CONFIG & HELPERS ===================== */
  const GC_DEFAULT_CONFIG = {
    PATHS: { ASSETS: "/ASSETS", VIEWS: "/VIEWS" },
    ROUTES: { publicHome: "/index.php", appHome: "/VIEWS/home.php", login: "/VIEWS/login.php" },
    ASSETS: { DEFAULT_AVATAR: "/ASSETS/user/img_user1.png", AVATAR_BASE: "/ASSETS/user/userImgs" },
    SOCIAL: { facebook: "https://www.facebook.com", instagram: "https://www.instagram.com", youtube: "https://www.youtube.com", x: "https://twitter.com" },
    FLAGS: { stickyHeaderOffset: 50, animateOnView: true },
  };

  const CFG = (function merge(base) {
    const out = structuredClone ? structuredClone(base) : JSON.parse(JSON.stringify(base));
    const src = window.GC_CONFIG || {};
    function deepMerge(target, from) {
      for (const k of Object.keys(from || {})) {
        if (from[k] && typeof from[k] === "object" && !Array.isArray(from[k])) { 
          target[k] = target[k] && typeof target[k] === "object" ? target[k] : {}; 
          deepMerge(target[k], from[k]); 
        } else { target[k] = from[k]; }
      }
    }
    deepMerge(out, src); return out;
  })(GC_DEFAULT_CONFIG);

  const COOKIE_NAME = "ix_emp";
  function b64d(str) { try { return JSON.parse(decodeURIComponent(escape(atob(str)))); } catch { return null; } }

  function getIxSession() {
    try {
      const pair = document.cookie.split("; ").find((c) => c.startsWith(encodeURIComponent(COOKIE_NAME) + "="));
      if (!pair) return null;
      const raw = decodeURIComponent(pair.split("=")[1] || "");
      const data = b64d(raw);
      if (!data || typeof data.exp === "number" && Date.now() > data.exp) return null;
      return data;
    } catch { return null; }
  }

  /* ===================== LÓGICA DASHBOARD ===================== */
  const API = {
    departamentos: "/db/web/ixtla01_c_departamentos.php",
    byTramite:     "/db/web/req_stats_by_tramite.php",
    byStatus:      "/db/web/req_stats_by_status.php",
    openClosed:    "/db/web/req_stats_open_closed.php",
    colonias:      "/db/web/ixtla01_c_cpcolonia_latlon.php" 
  };

  if (!window.ixFilters) window.ixFilters = { tramite: null };

  const $chipsWrap    = document.querySelector("#chips-departamentos");
  const $monthInput   = document.querySelector("#filtro-mes");
  const $tblBody      = document.querySelector("#tbl-tramites-body");
  const $cardsEstatus = document.querySelector("#cards-estatus");
  const $donut2       = document.querySelector("#donut-open-close-2");
  const $legend2      = document.querySelector("#legend-open-close-2");

  const STATUS_LABELS = ["Solicitud","Revisión","Asignación","En proceso","Pausado","Cancelado","Finalizado"];
  let currentDept  = null;
  let currentMonth = null;
  let donutCache   = { abiertos: 0, cerrados: 0 };
  let map, groupLayer;

  async function fetchJSON(url, opts = {}) {
    const r = await fetch(url, {
      method: opts.method || "GET",
      headers: { "Content-Type": "application/json" },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: "include"
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  function publishFiltersChanged(source) {
    window.dispatchEvent(new CustomEvent('ix:filters-changed', { 
      detail: { source, tramite: window.ixFilters.tramite, dept: currentDept, month: currentMonth } 
    }));
  }

  /* ====== 1. KPIs ====== */
  function updateKPICards() {
    // Aquí irán las fórmulas reales. Por ahora valores base:
    document.getElementById('kpi-val-semana').textContent = "12.5";
    document.getElementById('kpi-val-tiempo').textContent = "2d 4h";
    document.getElementById('kpi-val-cp').textContent = "45400";
  }

  /* ====== 2. Departamentos ====== */
  function buildDeptChips(list) {
    if (!$chipsWrap) return;
    $chipsWrap.innerHTML = "";
    const make = (id, label, selected) => {
      const b = document.createElement("button");
      b.className = "ix-chip";
      b.setAttribute("aria-selected", selected ? "true" : "false");
      b.innerHTML = `<div class="ix-chip-icon">👤</div><div>${label}</div>`;
      b.onclick = () => {
        $chipsWrap.querySelectorAll(".ix-chip").forEach(x => x.setAttribute("aria-selected", "false"));
        b.setAttribute("aria-selected", "true");
        currentDept = id;
        reloadAll();
        publishFiltersChanged('dept-chip');
      };
      return b;
    };
    $chipsWrap.appendChild(make(null, "Todos", true));
    list.forEach(d => $chipsWrap.appendChild(make(d.id, d.nombre, false)));
  }

  async function initDepartments() {
    try {
      const resp = await fetchJSON(API.departamentos, { method: "POST", body: { all: true, status: 1 } });
      buildDeptChips(resp.data || []);
    } catch (e) { console.error("Error deptos:", e); }
  }

  /* ====== 3. Tabla ====== */
  function renderTable(rows) {
    if (!$tblBody) return;
    $tblBody.innerHTML = rows.map(r => `
      <div class="ix-row ix-row--4cols" style="cursor:pointer">
        <div>${r.tramite}</div>
        <div class="ta-right">${r.abiertos}</div>
        <div class="ta-right">${r.cerrados}</div>
        <div class="ta-right">${r.total}</div>
      </div>
    `).join("");
  }

  function hookTableSelection() {
    if (!$tblBody) return;
    $tblBody.onclick = (ev) => {
      const row = ev.target.closest('.ix-row');
      if (!row) return;
      const clicked = row.children[0].textContent;
      const wasSelected = row.classList.contains('ix-row--selected');
      
      $tblBody.querySelectorAll('.ix-row').forEach(r => r.classList.remove('ix-row--selected'));
      if (!wasSelected) {
        row.classList.add('ix-row--selected');
        window.ixFilters.tramite = clicked;
      } else {
        window.ixFilters.tramite = null;
      }
      publishFiltersChanged('tramites-table');
    };
  }

  /* ====== 4. Estatus & Donut ====== */
  function renderStatus(mapData) {
    if (!$cardsEstatus) return;
    $cardsEstatus.innerHTML = STATUS_LABELS.map((label, i) => `
      <div class="ix-badge">
        <div>${label}</div>
        <div class="n">${mapData[i] || 0}</div>
      </div>
    `).join("");
  }

  function drawDonut(canvas, a, c) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const total = a + c;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Dibujo simplificado para el ejemplo
    ctx.beginPath();
    ctx.arc(160, 160, 100, 0, Math.PI * 2);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 30;
    ctx.stroke();
    
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "center";
    ctx.fillText(total, 160, 170);

    if ($legend2) {
      $legend2.innerHTML = `<div>Abiertos: ${a} | Cerrados: ${c}</div>`;
    }
  }

  /* ====== 5. Mapa (Heatmap) ====== */
  function initMap() {
    if (!document.getElementById("map-colonias") || map) return;
    map = L.map("map-colonias").setView([20.55, -103.2], 12);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(map);
    groupLayer = L.layerGroup().addTo(map);
  }

  async function loadMapColonias() {
    initMap();
    try {
      const resp = await fetchJSON(API.colonias, { 
        method: "POST", 
        body: { departamento_id: currentDept, month: currentMonth, tramite: window.ixFilters.tramite } 
      });
      const rows = resp.data || [];
      groupLayer.clearLayers();
      
      const points = rows.map(r => [parseFloat(r.lat), parseFloat(r.lon), parseInt(r.total)]);
      if (points.length && L.heatLayer) {
        L.heatLayer(points, { radius: 25, blur: 15 }).addTo(groupLayer);
      }
    } catch (e) { console.error("Error mapa:", e); }
  }

  /* ====== Ejecución ====== */
  async function reloadAll() {
    await Promise.all([
      loadByTramite(),
      loadByStatus(),
      loadOpenClosed(),
      loadMapColonias(),
      updateKPICards()
    ]);
  }

  async function loadByTramite() {
    const resp = await fetchJSON(API.byTramite, { method: "POST", body: { departamento_id: currentDept, month: currentMonth } });
    renderTable(resp.data || []);
  }

  async function loadByStatus() {
    const resp = await fetchJSON(API.byStatus + `?departamento_id=${currentDept || ''}&month=${currentMonth || ''}&tramite=${window.ixFilters.tramite || ''}`);
    renderStatus(resp || {});
  }

  async function loadOpenClosed() {
    const resp = await fetchJSON(API.openClosed + `?departamento_id=${currentDept || ''}&month=${currentMonth || ''}&tramite=${window.ixFilters.tramite || ''}`);
    donutCache = { abiertos: parseInt(resp.abiertos || 0), cerrados: parseInt(resp.cerrados || 0) };
    drawDonut($donut2, donutCache.abiertos, donutCache.cerrados);
  }

  document.addEventListener("DOMContentLoaded", () => {
    initDepartments();
    hookTableSelection();
    if ($monthInput) {
      $monthInput.onchange = () => {
        currentMonth = $monthInput.value;
        reloadAll();
      };
    }
    reloadAll();
  });

  window.addEventListener('ix:filters-changed', () => {
    loadByStatus();
    loadOpenClosed();
    loadMapColonias();
  });

})();
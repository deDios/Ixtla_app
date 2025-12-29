// /JS/ui/mapRequerimientos_points.js
(() => {
  const API_POINTS = "/db/web/ixtla01_c_cpcolonia_latlon.php"; // POST JSON

  // DOM
  const mapEl    = document.getElementById("map-colonias");
  const legendEl = document.getElementById("map-legend");
  if (!mapEl) return;

  // Filtros (reuso del dashboard)
  const getSelectedDept = () => {
    const sel = document.querySelector(".ix-dept-chips .ix-chip[aria-selected='true']");
    const v = sel?.dataset?.dept ?? "";
    return v === "" ? null : Number(v);
  };
  const getSelectedMonth = () => (document.getElementById("filtro-mes")?.value || "").trim();

  // Leaflet base
  const map = L.map(mapEl, { zoomControl: true, attributionControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  let groupLayer = L.layerGroup().addTo(map);

  // Escala y helpers
  const PALETTE = ["#e8f7ef","#bfead2","#95ddb6","#6bcf99","#41c27d","#22b468","#1a8f53","#146b3f","#0e482c"];
  const colorFor = (value, max) => {
    if (max <= 0) return "#94a3b8";
    const idx = Math.min(PALETTE.length - 1, Math.floor((value / max) * (PALETTE.length - 1)));
    return PALETTE[idx];
  };
  const radiusFor = (value, max) => {
    if (max <= 0) return 80;             // metros
    const minR = 80, maxR = 400;
    return minR + (maxR - minR) * (value / max);
  };

  function renderLegend(max) {
    if (!legendEl) return;
    const blocks = PALETTE.map(c => `<span style="background:${c}"></span>`).join("");
    legendEl.innerHTML = `
      <div>Requerimientos por colonia (puntos)</div>
      <div class="scale">${blocks}</div>
      <div style="margin-top:6px;font-size:.85rem;color:#64748b">0 &nbsp;–&nbsp; ${max}</div>
    `;
  }

  async function fetchPoints() {
    const body = {
      departamento_id: getSelectedDept(),             // null = Todos
      month: (getSelectedMonth() || null),            // null = todos los meses/años
      page_size: 10000,
      only_with_data: 1
    };
    // Remueve claves vacías
    Object.keys(body).forEach(k => {
      if (body[k] === null || body[k] === '' || body[k] === undefined) delete body[k];
    });

    const r = await fetch(API_POINTS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const t = await r.text().catch(()=> "");
      throw new Error(`HTTP ${r.status} :: ${t}`);
    }
    const j = await r.json();
    return Array.isArray(j?.data) ? j.data : [];
  }

  async function loadAndRender() {
    const rows = await fetchPoints();
    groupLayer.clearLayers();

    if (!rows.length) {
      map.setView([20.55,-103.2], 12);   // centro aprox
      renderLegend(0);
      return;
    }

    let max = 0;
    rows.forEach(r => { const n = Number(r.total||0); if (n > max) max = n; });

    const bounds = [];
    rows.forEach(r => {
      const lat = Number(r.lat), lon = Number(r.lon), total = Number(r.total || 0);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || total <= 0) return;

      const circle = L.circle([lat, lon], {
        radius: radiusFor(total, max),
        color: "#0f172a22",
        weight: 1,
        fillColor: colorFor(total, max),
        fillOpacity: 0.9
      });

      circle.bindTooltip(
        `<strong>${r.colonia}</strong><br>CP ${r.cp}<br><strong>${total}</strong> requerimiento${total===1?"":"s"}`,
        { sticky: true, direction: "auto", opacity: 0.95 }
      );

      const label = L.marker([lat, lon], {
        icon: L.divIcon({
          className: "ix-map-count",
          html: `<div>${total}</div>`,
          iconSize: [24,24],
          iconAnchor: [12,24]
        }),
        interactive: false
      });

      circle.addTo(groupLayer);
      label.addTo(groupLayer);
      bounds.push([lat, lon]);
    });

    if (bounds.length) map.fitBounds(bounds, { padding: [20,20] });
    renderLegend(max);
    setTimeout(() => map.invalidateSize(), 0);
  }

  // Listeners de filtros existentes
  document.addEventListener("click", (ev) => {
    const t = ev.target;
    if (t?.classList?.contains("ix-chip")) {
      setTimeout(() => loadAndRender().catch(console.error), 0);
    }
  });
  const month = document.getElementById("filtro-mes");
  if (month) month.addEventListener("change", () => loadAndRender().catch(console.error));

  // Primera carga
  document.addEventListener("DOMContentLoaded", () => {
    loadAndRender().catch(console.error);
  });

  window.addEventListener("resize", () => map.invalidateSize());
})();

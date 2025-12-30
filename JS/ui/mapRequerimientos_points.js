// /JS/ui/mapRequerimientos_points.js
(() => {
  const API_POINTS = "/db/web/ixtla01_c_cpcolonia_latlon.php"; // POST JSON

  // DOM
  const mapEl = document.getElementById("map-colonias");
  const legendEl = document.getElementById("map-legend");
  if (!mapEl) return;

  // Filtros (reuso del dashboard)
  const getSelectedDept = () => {
    const sel = document.querySelector(".ix-dept-chips .ix-chip[aria-selected='true']");
    const v = sel?.dataset?.dept ?? "";
    return v === "" ? null : Number(v);
  };
  const getSelectedMonth = () => (document.getElementById("filtro-mes")?.value || "").trim();

  // Leaflet base - estilo plano (Carto Positron)
  const map = L.map(mapEl, { zoomControl: true, attributionControl: false });
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      maxZoom: 20,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> ' +
        '&copy; <a href="https://carto.com/attributions">CARTO</a>'
    }
  ).addTo(map);

  // Pane dedicado para asegurar que los badges estén por encima
  const BADGE_PANE = "badgePane";
  map.createPane(BADGE_PANE);
  map.getPane(BADGE_PANE).style.zIndex = 750;      // > markerPane (600) y overlayPane (400)
  map.getPane(BADGE_PANE).style.pointerEvents = "auto";

  let groupLayer = L.layerGroup().addTo(map);

  function renderLegend(max) {
    if (!legendEl) return;
    legendEl.innerHTML = `
      <div>Requerimientos por colonia</div>
      <div style="margin-top:6px;font-size:.85rem;color:#64748b">Total máx.: ${max || 0}</div>
    `;
  }

  async function fetchPoints() {
    const body = {
      departamento_id: getSelectedDept() ?? undefined, // undefined = Todos
      month: (getSelectedMonth() || undefined),        // undefined = todos los meses/años
      page_size: 10000,
      only_with_data: 1
    };
    const r = await fetch(API_POINTS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`HTTP ${r.status} :: ${t}`);
    }
    const j = await r.json();
    return Array.isArray(j?.data) ? j.data : [];
  }

  async function loadAndRender() {
    const rows = await fetchPoints();
    groupLayer.clearLayers();

    if (!rows.length) {
      map.setView([20.55, -103.2], 12); // centro aprox
      renderLegend(0);
      return;
    }

    // Solo para referencia en la leyenda
    let max = 0;
    rows.forEach(r => { const n = Number(r.total || 0); if (n > max) max = n; });

    const bounds = [];
    rows.forEach(r => {
      const lat = Number(r.lat), lon = Number(r.lon), total = Number(r.total || 0);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || total <= 0) return;

      // (opcional) halo sutil para depurar que el punto está
      const halo = L.circle([lat, lon], {
        radius: 55,                // fijo, muy discreto
        color: "transparent",
        weight: 0,
        fillColor: "#000",
        fillOpacity: 0.06,
        pane: BADGE_PANE
      });

      // Marcador HTML de tamaño fijo (badge circular verde con número)
      const marker = L.marker([lat, lon], {
        pane: BADGE_PANE,
        icon: L.divIcon({
          className: "ix-map-badge",   // ver CSS
          html: `<div>${total}</div>`,
          iconSize: [56, 56],          // diámetro del badge (coincidir con CSS)
          iconAnchor: [28, 28]         // centra el badge en el punto
        })
      });

      marker.bindTooltip(
        `<strong>${r.colonia}</strong><br>CP ${r.cp}<br><strong>${total}</strong> requerimiento${total === 1 ? "" : "s"}`,
        { sticky: true, direction: "auto", opacity: 0.96, pane: BADGE_PANE }
      );

      halo.addTo(groupLayer);
      marker.addTo(groupLayer);
      bounds.push([lat, lon]);
    });

    if (bounds.length) map.fitBounds(bounds, { padding: [20, 20] });
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

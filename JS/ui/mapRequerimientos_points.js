// /JS/ui/mapRequerimientos_points.js
(() => {
  const API_POINTS = "/db/web/ixtla01_c_cpcolonia_latlon.php"; // POST JSON

  // DOM
  const mapEl    = document.getElementById("map-colonias");
  const legendEl = document.getElementById("map-legend");
  if (!mapEl) return;

  // Estado global compartido (si no existe, créalo)
  if (!window.ixFilters) window.ixFilters = { tramite: null };

  // Filtros del header/chips (reuso del dashboard)
  const getSelectedDept = () => {
    const sel = document.querySelector(".ix-dept-chips .ix-chip[aria-selected='true']");
    const v = sel?.dataset?.dept ?? "";
    return v === "" ? null : Number(v);
  };
  const getSelectedMonth   = () => (document.getElementById("filtro-mes")?.value || "").trim();
  const getSelectedTramite = () => (window.ixFilters?.tramite ? String(window.ixFilters.tramite) : null);

  // Leaflet base - estilo plano (Carto Positron)
  const map = L.map(mapEl, { zoomControl: true, attributionControl: false });
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    { maxZoom: 19 }
  ).addTo(map);

  let groupLayer = L.layerGroup().addTo(map);

  // ====== Color (monocromo verde, intensidad por valor) ======
  const H = 142, S = 62;
  function colorFor(value, max) {
    if (!max || max <= 0) return "hsl(210 5% 75%)"; // gris suave
    const t = Math.pow(value / max, 0.60);
    const L = 92 - t * 52; // 92% -> ~40%
    return `hsl(${H} ${S}% ${Math.max(38, Math.min(92, L))}%)`;
  }

  // ====== Radio fijo en metros (tamaño uniforme) ======
  const R_FIXED = 90;          // círculo ~90 m
  const R_HALO  = R_FIXED * 1.2; // halo suave alrededor

  function renderLegend(max) {
    if (!legendEl) return;
    if (!max || max <= 0) {
      legendEl.innerHTML = `<div>Sin datos para mostrar</div>`;
      return;
    }
    const steps = 9;
    const chips = Array.from({ length: steps }, (_, i) => {
      const v = Math.round((i / (steps - 1)) * max);
      return `<span style="background:${colorFor(v, max)}"></span>`;
    }).join("");
    legendEl.innerHTML = `
      <div>Requerimientos por colonia (puntos)</div>
      <div class="scale">${chips}</div>
      <div style="margin-top:6px;font-size:.85rem;color:#64748b">0 &nbsp;–&nbsp; ${max}</div>
    `;
  }

  async function fetchPoints() {
    const body = {
      departamento_id: getSelectedDept() ?? undefined,
      month: (getSelectedMonth() || undefined),
      tramite: (getSelectedTramite() || undefined),   // <<< filtro por trámite
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
      map.setView([20.55, -103.2], 12);   // centro aprox
      renderLegend(0);
      return;
    }

    let max = 0;
    rows.forEach(r => { const n = Number(r.total || 0); if (n > max) max = n; });

    const bounds = [];
    rows.forEach(r => {
      const lat = Number(r.lat), lon = Number(r.lon), total = Number(r.total || 0);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || total <= 0) return;

      const fill = colorFor(total, max);

      // Halo fijo
      const halo = L.circle([lat, lon], {
        radius: R_HALO,
        color: "transparent",
        weight: 0,
        fillColor: "#000",
        fillOpacity: 0.08
      });

      // Círculo principal (tamaño fijo)
      const circle = L.circle([lat, lon], {
        radius: R_FIXED,
        color: "rgba(15,23,42,.25)",
        weight: 1,
        fillColor: fill,
        fillOpacity: 0.92
      });

      circle.on("mouseover", () => circle.setStyle({ weight: 2, color: "rgba(15,23,42,.45)" }));
      circle.on("mouseout",  () => circle.setStyle({ weight: 1, color: "rgba(15,23,42,.25)" }));

      circle.bindTooltip(
        `<strong>${r.colonia}</strong><br>CP ${r.cp}<br><strong>${total}</strong> requerimiento${total===1?"":"s"}`,
        { sticky: true, direction: "auto", opacity: 0.96 }
      );

      // Etiqueta con el número
      const label = L.marker([lat, lon], {
        icon: L.divIcon({
          className: "ix-map-count",
          html: `<div>${total}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 24]
        }),
        interactive: false
      });

      halo.addTo(groupLayer);
      circle.addTo(groupLayer);
      label.addTo(groupLayer);
      bounds.push([lat, lon]);
    });

    if (bounds.length) map.fitBounds(bounds, { padding: [20, 20] });
    renderLegend(max);
    setTimeout(() => map.invalidateSize(), 0);
  }

  // Listeners: chips/mes y CAMBIO DE FILTROS GLOBALES (incluye trámite)
  document.addEventListener("click", (ev) => {
    const t = ev.target;
    if (t?.classList?.contains("ix-chip")) {
      setTimeout(() => loadAndRender().catch(console.error), 0);
    }
  });
  const month = document.getElementById("filtro-mes");
  if (month) month.addEventListener("change", () => loadAndRender().catch(console.error));

  // Se recarga cuando alguien cambie window.ixFilters (como la tabla de trámites)
  window.addEventListener("ix:filters-changed", () => {
    loadAndRender().catch(console.error);
  });

  // Primera carga
  document.addEventListener("DOMContentLoaded", () => {
    loadAndRender().catch(console.error);
  });

  window.addEventListener("resize", () => map.invalidateSize());
})();

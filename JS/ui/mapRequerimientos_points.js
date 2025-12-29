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

  // Leaflet base - estilo plano (Carto Positron)
  const map = L.map(mapEl, { zoomControl: true, attributionControl: false });
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> ' +
        '&copy; <a href="https://carto.com/attributions">CARTO</a>'
    }
  ).addTo(map);

  let groupLayer = L.layerGroup().addTo(map);

  // ====== Estilo de puntos (monocromo) ======
  // Tono base (verde MSC). Ajusta H y S si prefieres otro color.
  const H = 142;  // 142 ~ verde
  const S = 62;   // saturación
  // Gradiente por luminosidad (más claro = menor valor, más oscuro = mayor valor)
  function colorFor(value, max) {
    if (!max || max <= 0) return "hsl(210 5% 75%)"; // gris suave de fallback
    // Curva sublineal para más contraste en rangos bajos
    const t = Math.pow(value / max, 0.60); // 0.60 = más contraste al inicio
    const L = 92 - t * 52;                // de 92% (claro) a ~40% (oscuro)
    return `hsl(${H} ${S}% ${Math.max(38, Math.min(92, L))}%)`;
  }

  // Radio (metros) según conteo, con halo leve
  function radiusFor(value, max) {
    if (!max || max <= 0) return 70; // metros
    const minR = 70, maxR = 360;
    return minR + (maxR - minR) * (value / max);
  }

  function renderLegend(max) {
    if (!legendEl) return;
    if (!max || max <= 0) {
      legendEl.innerHTML = `<div>Sin datos para mostrar</div>`;
      return;
    }
    // 9 pasos de luminosidad
    const steps = 9;
    const chips = Array.from({length: steps}, (_, i) => {
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
      departamento_id: getSelectedDept() ?? undefined, // null/undefined = Todos
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

      const fill = colorFor(total, max);
      const radius = radiusFor(total, max);

      // Halo (sombra suave) para resaltar sobre el fondo
      const halo = L.circle([lat, lon], {
        radius: radius * 1.12,
        color: "transparent",
        weight: 0,
        fillColor: "#000000",
        fillOpacity: 0.08
      });

      // Círculo principal
      const circle = L.circle([lat, lon], {
        radius,
        color: "rgba(15,23,42,.25)", // trazo sutil (gris-azul)
        weight: 1,
        fillColor: fill,
        fillOpacity: 0.92
      });

      // Hover: un poco más grande y trazo más marcado
      circle.on("mouseover", () => {
        circle.setStyle({ weight: 2, color: "rgba(15,23,42,.45)" });
      });
      circle.on("mouseout", () => {
        circle.setStyle({ weight: 1, color: "rgba(15,23,42,.25)" });
      });

      circle.bindTooltip(
        `<strong>${r.colonia}</strong><br>CP ${r.cp}<br><strong>${total}</strong> requerimiento${total===1?"":"s"}`,
        { sticky: true, direction: "auto", opacity: 0.96 }
      );

      // Data label encima
      const label = L.marker([lat, lon], {
        icon: L.divIcon({
          className: "ix-map-count",
          html: `<div>${total}</div>`,
          iconSize: [24,24],
          iconAnchor: [12,24]
        }),
        interactive: false
      });

      halo.addTo(groupLayer);
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

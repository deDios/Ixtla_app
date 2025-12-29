/* Mapa por colonias (choropleth) */
(() => {
  // ---------- Config ----------
  const GEOJSON_URL = "/static/geo/colonias.geojson";
  const DATA_URL    = "/db/web/ixtla01_c_cpcolonia_latlon.php";

  // Cómo identificar la colonia en el GeoJSON y en el dataset
  const pickKeyFromFeature = f =>
    (f?.properties?.colonia_id ?? f?.properties?.nombre ?? "").toString().trim().toUpperCase();

  const pickKeyFromRow = r =>
    (r?.colonia_id ?? r?.colonia ?? "").toString().trim().toUpperCase();

  const pickCount = r => Number(r?.count ?? r?.total ?? 0);

  // DOM
  const mapEl     = document.getElementById("map-colonias");
  const legendEl  = document.getElementById("map-legend");
  if (!mapEl) return;

  // Helpers para filtros actuales (reutilizamos DOM sin tocar tu otro JS)
  const getSelectedDept = () => {
    const sel = document.querySelector(".ix-dept-chips .ix-chip[aria-selected='true']");
    const v = sel?.dataset?.dept ?? "";
    return v === "" ? null : Number(v);
  };
  const getSelectedMonth = () => {
    const v = (document.getElementById("filtro-mes")?.value || "").trim();
    return v || "";
  };

  const qs = o => {
    const sp = new URLSearchParams();
    Object.entries(o).forEach(([k,v]) => {
      if (v!==null && v!==undefined && v!=="") sp.append(k,String(v));
    });
    return sp.toString();
  };

  // ---------- Leaflet base ----------
  const map = L.map(mapEl, { zoomControl: true, attributionControl: false });
  // Base en blanco (solo polígonos); si quieres tiles, descomenta la siguiente línea:
  // L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  let gjLayer = null; // capa choropleth

  // Escala de colores (verde -> gris)
  const PALETTE = ["#e8f7ef","#bfead2","#95ddb6","#6bcf99","#41c27d","#22b468","#1a8f53","#146b3f","#0e482c"];
  const colorFor = (value, max) => {
    if (max <= 0) return "#f1f5f9";
    const idx = Math.min(PALETTE.length - 1, Math.floor((value / max) * (PALETTE.length - 1)));
    return PALETTE[idx];
  };

  // Render de leyenda
  function renderLegend(max) {
    if (!legendEl) return;
    const steps = PALETTE.length;
    const labels = [];
    for (let i = 0; i < steps; i++) {
      const from = Math.round((i/steps) * max);
      const to   = Math.round(((i+1)/steps) * max);
      labels.push({ from, to, color: PALETTE[i] });
    }
    const scale = labels.map(l => `<span style="background:${l.color}"></span>`).join("");
    legendEl.innerHTML = `
      <div>Requerimientos por colonia</div>
      <div class="scale" aria-hidden="true">${scale}</div>
      <div style="margin-top:6px;font-size:.85rem;color:#64748b">0 &nbsp;–&nbsp; ${max}</div>
    `;
  }

  // Carga y pinta
  async function loadAndRender() {
    // 1) Cargar datos de negocio
    const url = `${DATA_URL}?${qs({ departamento_id: getSelectedDept(), month: getSelectedMonth() })}`;
    const resp = await fetch(url, { credentials: "include" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${url}`);
    const json = await resp.json();

    const rows = Array.isArray(json?.data) ? json.data : [];
    const counts = new Map(); // key -> count
    let max = 0;
    rows.forEach(r => {
      const k = pickKeyFromRow(r);
      const v = pickCount(r);
      if (!k) return;
      counts.set(k, (counts.get(k) || 0) + v);
      if (v > max) max = Math.max(max, counts.get(k));
    });

    // 2) Cargar GeoJSON (si no existe ya en memoria)
    if (!loadAndRender._geojson) {
      const gj = await fetch(GEOJSON_URL, { credentials: "include" });
      if (!gj.ok) throw new Error(`HTTP ${gj.status} ${GEOJSON_URL}`);
      loadAndRender._geojson = await gj.json();
      // Fit bounds una sola vez
      try {
        const tmp = L.geoJSON(loadAndRender._geojson);
        map.fitBounds(tmp.getBounds(), { padding: [10,10] });
      } catch {}
    }

    // 3) Pintar capa
    if (gjLayer) { gjLayer.remove(); gjLayer = null; }

    gjLayer = L.geoJSON(loadAndRender._geojson, {
      style: (feature) => {
        const k = pickKeyFromFeature(feature);
        const v = counts.get(k) || 0;
        return {
          color: "#e5e7eb",
          weight: 1,
          fillColor: colorFor(v, max),
          fillOpacity: 0.9
        };
      },
      onEachFeature: (feature, layer) => {
        const k = pickKeyFromFeature(feature);
        const v = counts.get(k) || 0;
        const name = feature?.properties?.nombre ?? k ?? "Colonia";
        layer.bindTooltip(`${name}<br><strong>${v}</strong> requerimiento${v===1?"":"s"}`, {
          sticky: true,
          direction: "auto",
          opacity: 0.95
        });
        layer.on("mouseover", () => layer.setStyle({ weight: 2, color: "#94a3b8" }));
        layer.on("mouseout",  () => layer.setStyle({ weight: 1, color: "#e5e7eb" }));
      }
    }).addTo(map);

    renderLegend(max);
  }

  // Listeners a filtros existentes
  document.addEventListener("click", (ev) => {
    const t = ev.target;
    if (t?.classList?.contains("ix-chip")) {
      // Esperar a que el otro JS cambie aria-selected
      setTimeout(() => loadAndRender().catch(console.error), 0);
    }
  });
  const month = document.getElementById("filtro-mes");
  if (month) month.addEventListener("change", () => loadAndRender().catch(console.error));

  // Primera carga
  document.addEventListener("DOMContentLoaded", () => {
    loadAndRender().catch(console.error);
  });

  // Redimensionado (recalcula canvas de Leaflet)
  window.addEventListener("resize", () => {
    map.invalidateSize();
  });
})();

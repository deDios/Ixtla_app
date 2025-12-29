/* Mapa por colonias (choropleth con fallback a puntos)
   - Conteos por colonia/cp desde /db/web/req_stats_by_cpcolonia.php
   - Si no existe /static/geo/colonias.geojson -> dibuja puntos usando /db/web/ixtla01_c_cpcolonia_latlon.php
*/
(() => {
  // ---------- Endpoints ----------
  const GEOJSON_URL = "/static/geo/colonias.geojson";                 // choropleth (si existe)
  const DATA_URL    = "/db/web/req_stats_by_cpcolonia.php";           // GET ?departamento_id=&month=
  const LATLON_URL  = "/db/web/ixtla01_c_cpcolonia_latlon.php";       // POST { all:1, estatus:1, page_size:10000 }

  // Cómo identificar la colonia en el GeoJSON y en tu dataset de negocio
  const pickKeyFromFeature = f =>
    (f?.properties?.colonia_id ?? f?.properties?.nombre ?? "").toString().trim().toUpperCase();

  // El API nuevo regresa { colonia, cp, total }
  // Clave: preferimos colonia; si no hay, usamos CP
  const pickKeyFromRow = r =>
    (r?.colonia ?? r?.cp ?? "").toString().trim().toUpperCase();

  const pickCount = r => Number(r?.total ?? 0);

  // DOM
  const mapEl    = document.getElementById("map-colonias");
  const legendEl = document.getElementById("map-legend");
  if (!mapEl) return;

  // Helpers (reutilizamos los filtros actuales del dashboard)
  const getSelectedDept = () => {
    const sel = document.querySelector(".ix-dept-chips .ix-chip[aria-selected='true']");
    const v = sel?.dataset?.dept ?? "";
    return v === "" ? null : Number(v);
  };
  const getSelectedMonth = () => (document.getElementById("filtro-mes")?.value || "").trim();

  const qs = o => {
    const sp = new URLSearchParams();
    Object.entries(o).forEach(([k,v]) => { if (v!==null && v!==undefined && v!=="") sp.append(k,String(v)); });
    return sp.toString();
  };

  // ---------- Leaflet ----------
  const map = L.map(mapEl, { zoomControl: true, attributionControl: false });
  // Si quieres tiles base, descomenta:
  // L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  let gjLayer = null;      // capa choropleth
  let ptLayer = null;      // capa de puntos (fallback)

  // Escala de colores
  const PALETTE = ["#e8f7ef","#bfead2","#95ddb6","#6bcf99","#41c27d","#22b468","#1a8f53","#146b3f","#0e482c"];
  const colorFor = (value, max) => {
    if (max <= 0) return "#f1f5f9";
    const idx = Math.min(PALETTE.length - 1, Math.floor((value / max) * (PALETTE.length - 1)));
    return PALETTE[idx];
  };

  function renderLegend(max, mode = "areas") {
    if (!legendEl) return;
    const scale = PALETTE.map(c => `<span style="background:${c}"></span>`).join("");
    legendEl.innerHTML = `
      <div>Requerimientos por colonia ${mode === "points" ? "(puntos)" : "(áreas)"}</div>
      <div class="scale" aria-hidden="true">${scale}</div>
      <div style="margin-top:6px;font-size:.85rem;color:#64748b">0 &nbsp;–&nbsp; ${max}</div>
    `;
  }

  // --------- Core: carga datos de negocio (conteos por colonia/cp) ----------
  async function fetchCounts() {
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
      const acc = (counts.get(k) || 0) + v;
      counts.set(k, acc);
      if (acc > max) max = acc;
    });
    return { counts, max };
  }

  // --------- Choropleth ----------
  async function renderChoropleth(counts, max) {
    // Cargar GeoJSON (cache en memoria)
    if (!renderChoropleth._geojson) {
      const res = await fetch(GEOJSON_URL, { credentials: "include" });
      if (!res.ok) throw new Error(`GeoJSON not found: ${GEOJSON_URL}`);
      renderChoropleth._geojson = await res.json();

      // Fit una vez
      try {
        const tmp = L.geoJSON(renderChoropleth._geojson);
        map.fitBounds(tmp.getBounds(), { padding: [10,10] });
      } catch {}
    }

    // limpiar capas previas
    if (ptLayer) { ptLayer.remove(); ptLayer = null; }
    if (gjLayer) { gjLayer.remove(); gjLayer = null; }

    // pintar
    gjLayer = L.geoJSON(renderChoropleth._geojson, {
      style: (feature) => {
        const k = pickKeyFromFeature(feature);
        const v = counts.get(k) || 0;
        return { color:"#e5e7eb", weight:1, fillColor: colorFor(v, max), fillOpacity:0.9 };
      },
      onEachFeature: (feature, layer) => {
        const k = pickKeyFromFeature(feature);
        const v = counts.get(k) || 0;
        const name = feature?.properties?.nombre ?? k ?? "Colonia";
        layer.bindTooltip(`${name}<br><strong>${v}</strong> requerimiento${v===1?"":"s"}`, {
          sticky:true, direction:"auto", opacity:0.95
        });
        layer.on("mouseover", () => layer.setStyle({ weight: 2, color: "#94a3b8" }));
        layer.on("mouseout",  () => layer.setStyle({ weight: 1, color: "#e5e7eb" }));
      }
    }).addTo(map);

    renderLegend(max, "areas");
  }

  // --------- Fallback a puntos (burbujas) ----------
  async function renderPoints(counts, max) {
    // pedir catálogo cp_colonia con lat/lon
    const resp = await fetch(LATLON_URL, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      credentials: "include",
      body: JSON.stringify({ all: 1, estatus: 1, page_size: 10000 })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${LATLON_URL}`);
    const json = await resp.json();
    const rows = Array.isArray(json?.data) ? json.data : [];

    // limpiar capas previas
    if (gjLayer) { gjLayer.remove(); gjLayer = null; }
    if (ptLayer) { ptLayer.remove(); ptLayer = null; }

    // construir puntos
    const group = L.layerGroup();
    rows.forEach(r => {
      // clave para empatar con counts: colonia (upper) o cp
      const key = (r?.colonia ?? r?.cp ?? "").toString().trim().toUpperCase();
      const n   = counts.get(key) || 0;
      const lat = (r?.lat != null) ? Number(r.lat) : NaN;
      const lon = (r?.lon != null) ? Number(r.lon) : NaN;
      if (!n || !Number.isFinite(lat) || !Number.isFinite(lon)) return;

      // tamaño: raíz para suavizar diferencias
      const radius = 4 + 12 * Math.sqrt(n / Math.max(1, max));
      const fill   = colorFor(n, max);

      const m = L.circleMarker([lat, lon], {
        radius, color: "#334155", weight: 1,
        fillColor: fill, fillOpacity: 0.85
      });
      const label = r.colonia ? `${r.colonia}` : (r.cp ? `CP ${r.cp}` : "Colonia");
      m.bindTooltip(`${label}<br><strong>${n}</strong> req.`, { sticky:true });
      group.addLayer(m);
    });

    ptLayer = group.addTo(map);

    // ajustar vista si hay puntos
    try {
      const b = ptLayer.getBounds();
      if (b.isValid()) map.fitBounds(b, { padding:[20,20] });
    } catch {}

    renderLegend(max, "points");
  }

  // --------- Orquestador ----------
  async function loadAndRender() {
    const { counts, max } = await fetchCounts();

    // Intentar choropleth; si falla, dibujar puntos
    try {
      await renderChoropleth(counts, max);
    } catch (e) {
      console.warn("[map] Choropleth no disponible, usando fallback a puntos:", e?.message || e);
      await renderPoints(counts, max);
    }
  }

  // --------- Listeners de filtros existentes ----------
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

  // Recalcular canvas en resize
  window.addEventListener("resize", () => {
    map.invalidateSize();
  });
})();

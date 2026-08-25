// Consulta y muestra la geolocalización persistida del requerimiento.
(function () {
  "use strict";

  const HOST =
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net";
  const ENDPOINT = `${HOST}/db/WEB/ixtla01_c_requerimiento_geolocalizacion.php`;
  const STORAGE_KEY = "ixtla_uat_geolocalizaciones_pendientes";
  const $ = (selector, root = document) => root.querySelector(selector);
  let map = null;
  let marker = null;
  let accuracyCircle = null;

  function readRecords() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveRecords(records) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      // El panel seguirá mostrando el estado vacío si el navegador bloquea storage.
    }
  }

  function seedDemoRecords(req) {
    if (new URLSearchParams(window.location.search).get("geoDemo") !== "1") {
      return;
    }

    const id = Number(req?.id);
    if (!Number.isFinite(id)) return;

    const folio = String(req?.folio || "").trim();
    const existing = readRecords().filter(
      (row) => !row?.demo || Number(row?.requerimiento_id) !== id,
    );
    const now = Date.now();
    const samples = [
      {
        latitud: 20.548972,
        longitud: -103.191643,
        direccion: "Centro, Ixtlahuacán de los Membrillos, Jalisco",
        presicion_metros: 18,
        validada: 0,
        minutesAgo: 45,
      },
      {
        latitud: 20.550105,
        longitud: -103.19411,
        direccion: "Calle Juárez, Ixtlahuacán de los Membrillos, Jalisco",
        presicion_metros: 12,
        validada: 1,
        minutesAgo: 20,
      },
      {
        latitud: 20.551327,
        longitud: -103.196295,
        direccion: "Av. Santiago, Ixtlahuacán de los Membrillos, Jalisco",
        presicion_metros: 8,
        validada: 1,
        minutesAgo: 5,
      },
    ].map((sample) => {
      const capturedAt = new Date(now - sample.minutesAgo * 60 * 1000).toISOString();
      return {
        id: null,
        requerimiento_id: id,
        folio,
        latitud: sample.latitud,
        longitud: sample.longitud,
        presicion_metros: sample.presicion_metros,
        direccion: sample.direccion,
        validada: sample.validada,
        status: 1,
        created_at: capturedAt,
        captured_at: capturedAt,
        demo: true,
      };
    });

    saveRecords([...existing, ...samples]);
  }

  function findLocalRecord(req) {
    const id = Number(req?.id);
    const folio = String(req?.folio || "").trim();

    return readRecords()
      .filter((row) =>
        (Number.isFinite(id) && Number(row?.requerimiento_id) === id) ||
        (folio && String(row?.folio || "").trim() === folio),
      )
      .sort((a, b) => Date.parse(b?.created_at || 0) - Date.parse(a?.created_at || 0))[0];
  }

  async function fetchRecord(req) {
    const id = Number(req?.id);
    if (!Number.isFinite(id) || id < 1) return findLocalRecord(req);
    try {
      const response = await fetch(
        `${ENDPOINT}?requerimiento_id=${encodeURIComponent(id)}`,
        { method: "GET", headers: { Accept: "application/json" }, credentials: "omit" },
      );
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.ok === false) {
        throw new Error(json?.error || `HTTP ${response.status}`);
      }
      return Array.isArray(json?.data) ? json.data[0] || null : json?.data || null;
    } catch (error) {
      console.warn("[ReqGeolocalizacion] No se pudo consultar el endpoint:", error);
      return findLocalRecord(req);
    }
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  function setText(pane, selector, value) {
    const element = $(selector, pane);
    if (element) element.textContent = value || "—";
  }

  function renderMap(pane, lat, lng, precision) {
    const element = $("[data-geo-map]", pane);
    if (!element || !window.L) return;

    const latLng = [lat, lng];
    const accuracy = Number.isFinite(Number(precision))
      ? Math.max(1, Number(precision))
      : 1;

    if (!map) {
      map = window.L.map(element, {
        attributionControl: true,
        zoomControl: true,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: false,
        doubleClickZoom: true,
        boxZoom: false,
        keyboard: true,
      });
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
    }

    if (!marker) marker = window.L.marker(latLng).addTo(map);
    else marker.setLatLng(latLng);

    if (!accuracyCircle) {
      accuracyCircle = window.L.circle(latLng, {
        radius: accuracy,
        color: "#82978a",
        weight: 1,
        fillColor: "#a9b9ae",
        fillOpacity: 0.2,
      }).addTo(map);
    } else {
      accuracyCircle.setLatLng(latLng).setRadius(accuracy);
    }

    map.setView(latLng, 16, { animate: false });
    requestAnimationFrame(() => {
      map.invalidateSize();
      map.fitBounds(accuracyCircle.getBounds(), {
        padding: [28, 28],
        maxZoom: 17,
        animate: false,
      });
    });
  }

  async function render(req) {
    const pane = $('.exp-geo-pane[data-tab="geolocalizacion"]');
    if (!pane) return;

    const empty = $("[data-geo-empty]", pane);
    const content = $("[data-geo-content]", pane);
    seedDemoRecords(req);
    const record = await fetchRecord(req);
    const lat = Number(record?.latitud);
    const lng = Number(record?.longitud);
    const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);

    if (!record || !hasCoordinates) {
      if (empty) empty.hidden = false;
      if (content) content.hidden = true;
      return;
    }

    if (empty) empty.hidden = true;
    if (content) content.hidden = false;

    const validated = Number(record.validada) === 1 || record.validada === true;
    const status = $("[data-geo-status]", pane);
    if (status) {
      status.textContent = validated ? "Geolocalización validada" : "Pendiente de validación";
      status.className = `exp-geo-status ${validated ? "is-validated" : "is-pending"}`;
    }

    setText(pane, "[data-geo-direccion]", record.direccion);
    setText(
      pane,
      "[data-geo-precision]",
      Number.isFinite(Number(record.precision_metros ?? record.presicion_metros))
        ? `${Math.round(Number(record.precision_metros ?? record.presicion_metros))} m`
        : "No disponible",
    );
    setText(pane, "[data-geo-captured-at]", formatDate(record.captured_at || record.created_at));
    renderMap(pane, lat, lng, record.precision_metros ?? record.presicion_metros);

    const mapLink = $("[data-geo-map-link]", pane);
    if (mapLink) {
      mapLink.href = `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
      mapLink.hidden = false;
    }
  }

  document.addEventListener("req:loaded", (event) => render(event.detail));

  document.addEventListener("click", (event) => {
    const tab = event.target.closest(".exp-tab");
    if (!tab || !/geolocalización/i.test(tab.textContent || "")) return;
    setTimeout(() => map?.invalidateSize(), 50);
  });

  window.addEventListener("resize", () => map?.invalidateSize());

  if (window.__REQ__) render(window.__REQ__);
})();

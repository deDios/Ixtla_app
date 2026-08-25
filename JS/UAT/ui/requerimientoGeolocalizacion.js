// Muestra la captura local de UAT hasta que exista el endpoint de geolocalización.
(function () {
  "use strict";

  const STORAGE_KEY = "ixtla_uat_geolocalizaciones_pendientes";
  const $ = (selector, root = document) => root.querySelector(selector);

  function readRecords() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function findRecord(req) {
    const id = Number(req?.id);
    const folio = String(req?.folio || "").trim();

    return readRecords()
      .filter((row) =>
        (Number.isFinite(id) && Number(row?.requerimiento_id) === id) ||
        (folio && String(row?.folio || "").trim() === folio),
      )
      .sort((a, b) => Date.parse(b?.created_at || 0) - Date.parse(a?.created_at || 0))[0];
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

  function render(req) {
    const pane = $('.exp-geo-pane[data-tab="geolocalizacion"]');
    if (!pane) return;

    const empty = $("[data-geo-empty]", pane);
    const content = $("[data-geo-content]", pane);
    const record = findRecord(req);
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

    setText(pane, "[data-geo-latitud]", lat.toFixed(6));
    setText(pane, "[data-geo-longitud]", lng.toFixed(6));
    setText(pane, "[data-geo-direccion]", record.direccion);
    setText(
      pane,
      "[data-geo-precision]",
      Number.isFinite(Number(record.presicion_metros))
        ? `${Math.round(Number(record.presicion_metros))} m`
        : "No disponible",
    );
    setText(pane, "[data-geo-captured-at]", formatDate(record.captured_at || record.created_at));

    const mapLink = $("[data-geo-map-link]", pane);
    if (mapLink) {
      mapLink.href = `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
      mapLink.hidden = false;
    }
  }

  document.addEventListener("req:loaded", (event) => render(event.detail));

  if (window.__REQ__) render(window.__REQ__);
})();

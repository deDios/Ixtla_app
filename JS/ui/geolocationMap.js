// Componente compartido para los mapas de geolocalización de Ixtla App.
(function (global) {
  "use strict";

  function create({
    element,
    mode = "readonly",
    pinMode = "anchored",
    staticPinElement = null,
    onPendingChange = null,
  } = {}) {
    if (!element || !global.L) return null;

    let map = null;
    let accuracyCircle = null;
    let marker = null;
    let editing = false;

    function isEditable() {
      return mode === "editable";
    }

    function updatePending(latLng) {
      if (!isEditable() || !editing || !latLng) return;
      onPendingChange?.({
        latitud: Number(latLng.lat),
        longitud: Number(latLng.lng),
      });
    }

    function ensureMap() {
      if (map) return map;

      const readonly = mode === "readonly";
      map = global.L.map(element, {
        attributionControl: true,
        zoomControl: true,
        dragging: readonly,
        touchZoom: true,
        scrollWheelZoom: "center",
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        zoomSnap: 0.5,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 90,
        bounceAtZoomLimits: false,
      });
      global.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      if (readonly) element.classList.add("ix-geo-map--explorable");

      map.on("movestart", () => {
        if (isEditable() && editing) onPendingChange?.(null);
      });
      map.on("moveend", () => {
        if (isEditable() && editing) updatePending(map.getCenter());
      });
      map.on("click", (event) => {
        if (!isEditable() || !editing || !event?.latlng) return;
        map.setView(event.latlng, map.getZoom(), { animate: true });
        updatePending(event.latlng);
      });
      return map;
    }

    function ensureAnchoredMarker(latLng) {
      if (pinMode !== "anchored") return;
      if (staticPinElement) staticPinElement.hidden = true;

      if (!marker) {
        marker = global.L.marker(latLng, {
          interactive: false,
          keyboard: false,
          icon: global.L.divIcon({
            className: "ix-geo-map-marker",
            html: "<span></span>",
            iconSize: [34, 46],
            iconAnchor: [17, 46],
          }),
        }).addTo(ensureMap());
      } else {
        marker.setLatLng(latLng);
      }
    }

    function setLocation({ latitud, longitud, precisionMetros = null, fit = true } = {}) {
      const lat = Number(latitud);
      const lng = Number(longitud);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const leafletMap = ensureMap();
      const latLng = [lat, lng];
      const precision = Number(precisionMetros);
      const hasPrecision = Number.isFinite(precision) && precision > 0;

      ensureAnchoredMarker(latLng);
      if (hasPrecision) {
        if (!accuracyCircle) {
          accuracyCircle = global.L.circle(latLng, {
            radius: precision,
            color: "#82978A",
            weight: 1,
            fillColor: "#a9b9ae",
            fillOpacity: 0.18,
            interactive: false,
          }).addTo(leafletMap);
        } else {
          accuracyCircle.setLatLng(latLng).setRadius(precision);
        }
      } else if (accuracyCircle) {
        leafletMap.removeLayer(accuracyCircle);
        accuracyCircle = null;
      }

      leafletMap.setView(latLng, 16, { animate: false });
      if (!fit) return;
      requestAnimationFrame(() => {
        leafletMap.invalidateSize();
        if (accuracyCircle) {
          leafletMap.fitBounds(accuracyCircle.getBounds(), {
            padding: [18, 18],
            maxZoom: precision <= 25 ? 19 : 17,
          });
        } else {
          leafletMap.setView(latLng, 16, { animate: false });
        }
      });
    }

    function setEditing(enabled) {
      if (!isEditable()) return;
      editing = Boolean(enabled);
      onPendingChange?.(null);
      const leafletMap = ensureMap();
      leafletMap.dragging[editing ? "enable" : "disable"]();
      // El zoom siempre está disponible; sólo el movimiento del mapa queda
      // condicionado al modo de corrección en el formulario.
      leafletMap.touchZoom.enable();
      leafletMap.scrollWheelZoom.enable();
      element.classList.toggle("ix-geo-map--explorable", editing);
    }

    return {
      get map() {
        return map;
      },
      setLocation,
      setEditing,
      invalidateSize: () => map?.invalidateSize(),
      destroy: () => map?.remove(),
    };
  }

  global.IxtlaGeolocationMap = { create };
})(window);

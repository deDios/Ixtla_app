// Consulta y muestra la geolocalización persistida del requerimiento.
(function () {
  "use strict";

  const HOST =
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net";
  const ENDPOINT = `${HOST}/db/WEB/ixtla01_c_requerimiento_geolocalizacion.php`;
  const UPDATE_ENDPOINT = "/db/WEB/ixtla01_u_requerimiento_geolocalizacion.php";
  const DEPARTMENTS_ENDPOINT = `${HOST}/db/WEB/ixtla01_c_departamento.php`;
  const STORAGE_KEY = "ixtla_uat_geolocalizaciones_pendientes";
  const $ = (selector, root = document) => root.querySelector(selector);
  let map = null;
  let accuracyCircle = null;
  let currentRecord = null;
  let currentRequirement = null;
  let departmentsPromise = null;

  function readSession() {
    try {
      const fromApi = window.Session?.get?.();
      if (fromApi) return fromApi;
    } catch {}
    try {
      const pair = document.cookie.split("; ").find((item) => item.startsWith("ix_emp="));
      if (!pair) return null;
      const raw = decodeURIComponent(pair.slice("ix_emp=".length));
      return JSON.parse(decodeURIComponent(escape(atob(raw))));
    } catch {
      return null;
    }
  }

  function fetchDepartments() {
    if (departmentsPromise) return departmentsPromise;
    departmentsPromise = fetch(DEPARTMENTS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "omit",
      body: JSON.stringify({ all: true, status: 1 }),
    })
      .then(async (response) => {
        const json = await response.json().catch(() => null);
        if (!response.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${response.status}`);
        return Array.isArray(json?.data) ? json.data : [];
      })
      .catch((error) => {
        departmentsPromise = null;
        throw error;
      });
    return departmentsPromise;
  }

  async function canValidateGeolocation(req) {
    const session = readSession();
    const employeeId = Number(session?.empleado_id ?? session?.id_empleado ?? 0);
    const departmentId = Number(session?.departamento_id ?? 0);
    const requirementDepartmentId = Number(req?.departamento_id ?? req?.raw?.departamento_id ?? 0);
    const roles = Array.isArray(session?.roles)
      ? session.roles.map((role) => String(role).toUpperCase())
      : [];

    if (!employeeId) return false;
    if (roles.includes("ADMIN") || departmentId === 6) return true;

    const sameDepartment = departmentId > 0 && departmentId === requirementDepartmentId;
    if (sameDepartment && roles.includes("DIRECTOR")) return true;
    if (
      sameDepartment &&
      roles.some((role) => ["PRIMERA_LINEA", "PRIMERA LINEA", "PL"].includes(role))
    ) return true;

    try {
      const departments = await fetchDepartments();
      const requirementDepartment = departments.find(
        (department) => Number(department?.id) === requirementDepartmentId,
      );
      return Boolean(
        requirementDepartment &&
        (Number(requirementDepartment.director) === employeeId ||
          Number(requirementDepartment.primera_linea) === employeeId),
      );
    } catch (error) {
      console.warn("[ReqGeolocalizacion] No se pudo resolver el RBAC:", error);
      return false;
    }
  }

  async function updateValidationControl(pane, req, record, validated) {
    const button = $("[data-geo-validate]", pane);
    if (!button) return;
    button.hidden = true;
    button.disabled = false;
    if (validated || Number(record?.id) < 1) return;
    button.hidden = !(await canValidateGeolocation(req));
  }

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
        dragging: false,
        touchZoom: "center",
        scrollWheelZoom: "center",
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        zoomSnap: 0.5,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 90,
        bounceAtZoomLimits: false,
      });
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
    }

    if (!accuracyCircle) {
      accuracyCircle = window.L.circle(latLng, {
        radius: accuracy,
        color: "#82978A",
        weight: 1,
        fillColor: "#a9b9ae",
        fillOpacity: 0.18,
        interactive: false,
      }).addTo(map);
    } else {
      accuracyCircle.setLatLng(latLng).setRadius(accuracy);
    }

    map.setView(latLng, 16, { animate: false });
    requestAnimationFrame(() => {
      map.invalidateSize();
      map.fitBounds(accuracyCircle.getBounds(), {
        padding: [18, 18],
        // Con precisiones pequeñas (p. ej. 13 m), a zoom 17 el círculo
        // queda completamente oculto por la aguja central. Acercamos el
        // mapa sin alterar el radio geográfico real.
        maxZoom: accuracy <= 25 ? 19 : 17,
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
    currentRecord = record;
    currentRequirement = req;
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
    void updateValidationControl(pane, req, record, validated);

    const mapLink = $("[data-geo-map-link]", pane);
    if (mapLink) {
      mapLink.href = `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
      mapLink.hidden = false;
    }
  }

  document.addEventListener("req:loaded", (event) => render(event.detail));

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-geo-validate]");
    if (!button || !currentRecord || !currentRequirement) return;
    if (!(await canValidateGeolocation(currentRequirement))) {
      button.hidden = true;
      window.gcToast?.("No tienes permiso para validar esta ubicación.", "warning");
      return;
    }
    if (!window.confirm("¿Confirmas que la ubicación corresponde al reporte?")) return;

    button.disabled = true;
    button.textContent = "Validando…";
    try {
      const response = await fetch(UPDATE_ENDPOINT, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: Number(currentRecord.id), validada: 1 }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${response.status}`);
      currentRecord = json?.data || { ...currentRecord, validada: 1 };
      const pane = $('.exp-geo-pane[data-tab="geolocalizacion"]');
      const status = pane && $("[data-geo-status]", pane);
      if (status) {
        status.textContent = "Geolocalización validada";
        status.className = "exp-geo-status is-validated";
      }
      button.hidden = true;
      window.gcToast?.("Geolocalización validada correctamente.", "success");
    } catch (error) {
      console.error("[ReqGeolocalizacion] Error validando:", error);
      window.gcToast?.(error.message || "No se pudo validar la ubicación.", "danger");
      button.disabled = false;
      button.textContent = "Validar ubicación";
    }
  });

  document.addEventListener("click", (event) => {
    const tab = event.target.closest(".exp-tab");
    if (!tab || !/geolocalización/i.test(tab.textContent || "")) return;
    setTimeout(() => map?.invalidateSize(), 50);
  });

  window.addEventListener("resize", () => map?.invalidateSize());

  if (window.__REQ__) render(window.__REQ__);
})();

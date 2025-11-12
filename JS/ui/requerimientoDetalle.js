// /JS/ui/requerimientoDetalle.js
(function () {
  "use strict";

  const TAG = "[ReqDetalle]";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const log = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);

  /* =========================
   * Helpers de texto
   * ========================= */
  const norm = (s = "") =>
    String(s).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

  /* =========================
   * Endpoints usados sólo para resolver Líder/Depto
   * (idénticos fallbacks a los que tenías)
   * ========================= */
  const ENDPOINTS = {
    DEPT_LIST_PRIMARY:
      "http://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php",
    DEPT_LIST_LOCAL: "/db/WEB/ixtla01_c_departamento.php",
    DEPT_LIST_UPPER: "/DB/WEB/ixtla01_c_departamento.php",
  };

  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body || {}),
    });
    const txt = await res.text();
    let json; try { json = JSON.parse(txt); } catch { json = { raw: txt }; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return json;
  }

  async function fetchDeptsWithFallback() {
    const payload = { page: 1, page_size: 200, status: 1 };
    const urls = [ENDPOINTS.DEPT_LIST_PRIMARY, ENDPOINTS.DEPT_LIST_LOCAL, ENDPOINTS.DEPT_LIST_UPPER];
    for (const url of urls) {
      try {
        const res = await postJSON(url, payload);
        const arr = Array.isArray(res?.data) ? res.data : [];
        if (arr.length) return arr;
      } catch (e) { warn("[Dept] fallo endpoint:", url, e); }
    }
    return [];
  }

  async function getDeptByIdOrName({ id, nombre }) {
    const wantedId = id != null ? Number(id) : null;
    const wantedName = nombre ? norm(nombre) : null;
    const arr = await fetchDeptsWithFallback();
    if (!arr.length) return { dept: null, director: null };

    let dept = null;
    if (wantedId) dept = arr.find((x) => Number(x.id) === wantedId) || null;
    if (!dept && wantedName) {
      dept =
        arr.find((x) => norm(x?.nombre || "") === wantedName) ||
        arr.find((x) => norm(x?.nombre || "").startsWith(wantedName)) ||
        null;
    }
    if (!dept && arr.length === 1) dept = arr[0] || null;
    if (!dept) return { dept: null, director: null };

    const info = {
      id: Number(dept.id),
      nombre: String(dept.nombre || "—"),
      director_id: Number(dept.director ?? 0) || null,
      director_nombre: String(dept.director_nombre || ""),
      director_apellidos: String(dept.director_apellidos || ""),
    };

    const fullDir = [info.director_nombre, info.director_apellidos].filter(Boolean).join(" ").trim();
    const director = fullDir ? { id: info.director_id, nombre: fullDir } : null;
    return { dept: { id: info.id, nombre: info.nombre }, director };
  }

  /* =========================
   * Pintado del TAB "detalles"
   * ========================= */
  function putDetalle(labelStartsWith, value, { asLink = false } = {}) {
    const grid = $('.exp-pane[role="tabpanel"][data-tab="detalles"] .exp-grid');
    if (!grid) return false;
    const row = Array.from(grid.querySelectorAll(".exp-field")).find((r) => {
      const t = (r.querySelector("label")?.textContent || "").trim().toLowerCase();
      return t.startsWith(labelStartsWith.toLowerCase());
    });
    const dd = row?.querySelector(".exp-val");
    if (!dd) return false;

    if (asLink) {
      const a = dd.querySelector("a") || document.createElement("a");
      a.textContent = value || "—";
      if (value) a.href = "#"; else a.removeAttribute("href");
      if (!dd.contains(a)) { dd.innerHTML = ""; dd.appendChild(a); }
    } else {
      dd.textContent = value ?? "—";
    }
    return true;
  }

  async function paintDetalles(req) {
    log("[Detalles] pintar con req.id:", req?.id);

    // Nombre del Requerimiento
    putDetalle("Nombre del Requerimiento", req.asunto || req.tramite_nombre || "—");

    // Departamento + Líder (director)
    const { dept, director } = await getDeptByIdOrName({
      id: req.departamento_id,
      nombre: req.departamento_nombre,
    });

    // Líder del Departamento (link)
    putDetalle("Líder del Departamento", director?.nombre || "—", { asLink: true });

    // Departamento (texto)
    const depNode = $("#req-departamento");
    if (depNode) depNode.textContent = dept?.nombre || req.departamento_nombre || "—";

    // Asignado (link)
    const asignado =
      req.asignado_id && (req.asignado_full || "").trim() ? req.asignado_full : "Sin asignar";
    putDetalle("Asignado", asignado, { asLink: true });

    // Descripción
    putDetalle("Descripción", req.descripcion || "—");

    // Fechas (inicio/cierre)
    putDetalle("Fecha de inicio", (req.creado_at || "").split(" ")[0] || "—");
    putDetalle("Fecha de terminado", req.cerrado_en ? String(req.cerrado_en).split(" ")[0] : "—");
  }

  /* =========================
   * Wiring con el fetch original
   * ========================= */
  function resetDetallesSkeleton() {
    const grid = $('.exp-pane[role="tabpanel"][data-tab="detalles"] .exp-grid');
    if (!grid) return;
    // Solo limpiamos valores de la grid "detalles"
    $$(".exp-field .exp-val", grid).forEach((n) => {
      if (n.id === "req-status") return; // NO tocar estatus (lo maneja el archivo principal)
      const a = n.querySelector("a");
      if (a) { a.textContent = "—"; a.removeAttribute("href"); }
      else n.textContent = "—";
    });
  }

  function bootListeners() {
    // Cuando el archivo principal termine de traer el requerimiento:
    document.addEventListener("req:loaded", async (e) => {
      try {
        resetDetallesSkeleton();
        const req = e.detail;
        await paintDetalles(req);
      } catch (err) { warn("paintDetalles error:", err); }
    }, { passive: true });

    // Respaldo: si el principal ya colocó __REQ__ antes de cargar este script
    if (window.__REQ__) {
      resetDetallesSkeleton();
      paintDetalles(window.__REQ__).catch((e) => warn("paintDetalles fallback error:", e));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootListeners, { once: true });
  } else bootListeners();
})();

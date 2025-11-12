// /JS/ui/requerimientoDetalle.js
(function () {
  "use strict";

  /* =========================================================================
   * Helpers básicos (usan _rvHelpers si existe)
   * =========================================================================*/
  const H = window._rvHelpers || {};
  const $  = H.$  || ((s, r=document)=>r.querySelector(s));
  const $$ = H.$$ || ((s, r=document)=>Array.from(r.querySelectorAll(s)));
  const toast = H.toast || ((m,t="info")=>console.log("[toast]", t, m));
  const log   = (...a)=>console.log("[ReqDetalle]", ...a);
  const warn  = (...a)=>console.warn("[ReqDetalle]", ...a);
  const err   = (...a)=>console.error("[ReqDetalle]", ...a);

  // Elementos clave del DOM (coloca estos IDs/clases en tu HTML)
  const SEL = {
    asignadoDisplay:  "#req-asignado-display",   // <a> donde va el nombre o "Sin asignar"
    btnAsignar:       "#btn-asignar-req",        // botón lápiz junto al asignado
    modal:            "#modal-asignar-req",      // overlay del modal
    modalClose:       ".modal-close",            // botón ✕ dentro del modal
    form:             "#form-asignar-req",       // form del modal
    select:           "#sel-asignado-req",       // <select> de empleados
  };

  /* =========================================================================
   * API (usa window.API si existe, si no, fallbacks)
   * =========================================================================*/
  const API = (window.API || {
    EMPLEADOS: { LIST: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_empleado.php" },
    DEPTS:     { LIST: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php" },
    REQ:       { UPDATE: null } // se resuelve con fallback abajo si no existe
  });

  // ⚠️ Ajusta esta ruta si tu update difiere (u = update suele ser tu convención)
  const REQ_UPDATE_FALLBACK = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_u_requerimiento.php";
  const REQ_UPDATE_URL = API.REQ?.UPDATE || REQ_UPDATE_FALLBACK;

  async function postJSON(url, body) {
    const group = `[HTTP][ReqDetalle] ${url}`;
    console.groupCollapsed(group);
    console.log("→ payload:", body);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body || {})
      });
      const txt = await res.text();
      let json = null;
      try { json = JSON.parse(txt); } catch {}
      console.log("← status:", res.status, "json:", json || txt);
      console.groupEnd();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      if (json?.ok === false) throw new Error(json?.error || "Operación no exitosa");
      return json ?? {};
    } catch (e) {
      console.groupEnd();
      throw e;
    }
  }

  /* =========================================================================
   * Sesión (idéntico patrón a Planeación)
   * =========================================================================*/
  function safeGetSession() {
    try { if (window.Session?.get) return window.Session.get(); } catch {}
    try {
      const pair = document.cookie.split("; ").find(c => c.startsWith("ix_emp="));
      if (!pair) return null;
      const raw = decodeURIComponent(pair.split("=")[1] || "");
      const json = JSON.parse(decodeURIComponent(escape(atob(raw))));
      if (json && typeof json === "object") return json;
    } catch {}
    return null;
  }
  function getEmpleadoId() {
    const s = safeGetSession();
    return s?.empleado_id ?? s?.id_empleado ?? s?.id_usuario ?? s?.cuenta_id ?? null;
  }
  function getDeptId() {
    const s = safeGetSession();
    return s?.departamento_id ?? s?.dept_id ?? null;
  }
  function getRoles() {
    const s = safeGetSession();
    const r = Array.isArray(s?.roles) ? s.roles.map(x => String(x).toUpperCase()) : [];
    return r;
  }

  /* =========================================================================
   * RBAC (compacto, mismo criterio de Planeación)
   * =========================================================================*/
  function normalizeEmpleadoFromAPI(r) {
    const reporta_a =
      (r.reporta_a != null ? r.reporta_a : (r.cuenta && r.cuenta.reporta_a != null ? r.cuenta.reporta_a : null));
    const roles = Array.isArray(r.cuenta?.roles) ? r.cuenta.roles.map(x => x?.codigo).filter(Boolean) : [];
    const rolCodes = roles.map(x => String(x).toUpperCase());
    return {
      id: Number(r.id),
      full: [r.nombre, r.apellidos].filter(Boolean).join(" ").trim() || `Empleado #${r.id}`,
      departamento_id: (r.departamento_id != null ? Number(r.departamento_id) : null),
      reporta_a: (reporta_a != null ? Number(reporta_a) : null),
      rolCodes,
    };
  }

  async function fetchEmpleadosAll() {
    const j = await postJSON(API.EMPLEADOS.LIST, { page: 1, page_size: 500, status: 1 });
    const arr = Array.isArray(j?.data) ? j.data : [];
    return arr.map(normalizeEmpleadoFromAPI);
  }

  async function fetchDepartamentos() {
    const j = await postJSON(API.DEPTS.LIST, { page: 1, page_size: 200, status: 1 });
    const arr = Array.isArray(j?.data) ? j.data : [];
    return arr.map(d => ({
      id: Number(d.id),
      director: (d.director != null ? Number(d.director) : null),
      primera_linea: (d.primera_linea != null ? Number(d.primera_linea) : null),
    }));
  }

  function getReportesTransitivos(universe, jefeId) {
    const mapByBoss = new Map();
    universe.forEach(emp => {
      const boss = emp.reporta_a != null ? Number(emp.reporta_a) : null;
      if (boss == null) return;
      if (!mapByBoss.has(boss)) mapByBoss.set(boss, []);
      mapByBoss.get(boss).push(emp);
    });
    const visited = new Set();
    const queue = [Number(jefeId)];
    const out = [];
    while (queue.length) {
      const cur = queue.shift();
      const kids = mapByBoss.get(cur) || [];
      for (const k of kids) {
        if (visited.has(k.id)) continue;
        visited.add(k.id);
        out.push(k);
        queue.push(k.id);
      }
    }
    return out;
  }

  async function buildAsignablesList() {
    const yoId   = Number(getEmpleadoId());
    const deptId = Number(getDeptId());
    const roles  = getRoles();
    const isAdmin = roles.includes("ADMIN");
    const isDirector = roles.includes("DIRECTOR");
    const isPL = roles.includes("PRIMERA_LINEA") || roles.includes("PL") || roles.includes("PRIMERA LINEA");
    const isJefe = roles.includes("JEFE");

    const universe = await fetchEmpleadosAll();

    if (isAdmin) return universe;

    const PRES_DEPT_IDS = [6]; // excepción como en Planeación
    if (PRES_DEPT_IDS.includes(deptId)) return universe;

    if (isDirector || isPL) {
      const depts = await fetchDepartamentos();
      const visibleDeptIds = new Set(
        depts.filter(d => d.director === yoId || d.primera_linea === yoId).map(d => d.id)
      );
      if (deptId) visibleDeptIds.add(deptId);

      const inDepts = universe.filter(e => visibleDeptIds.has(Number(e.departamento_id)));
      const reports = getReportesTransitivos(universe, yoId);
      const self = universe.find(e => e.id === yoId);

      const map = new Map();
      [...inDepts, ...reports, ...(self ? [self] : [])].forEach(e => map.set(e.id, e));
      return Array.from(map.values());
    }

    if (isJefe) {
      const self = universe.find(e => e.id === yoId);
      const direct = universe.filter(e => e.reporta_a === yoId);
      const map = new Map();
      if (self) map.set(self.id, self);
      direct.forEach(e => map.set(e.id, e));
      return Array.from(map.values());
    }

    const self = universe.find(e => e.id === yoId);
    return self ? [self] : [];
  }

  async function populateAsignadoSelect(sel) {
    if (!sel) return;
    sel.innerHTML = `<option value="" disabled selected>Selecciona responsable…</option>`;

    const visibles = await buildAsignablesList();
    visibles.sort((a,b) => (a.full || "").localeCompare(b.full || "", "es"));

    const yoId = Number(getEmpleadoId());
    const roles = getRoles();
    const isAnalista = roles.includes("ANALISTA");

    for (const emp of visibles) {
      const opt = document.createElement("option");
      opt.value = String(emp.id);
      opt.textContent = emp.full || `Empleado #${emp.id}`;
      sel.appendChild(opt);
    }

    if (isAnalista && yoId) {
      sel.value = String(yoId);
      sel.setAttribute("disabled", "true");
      sel.title = "Como Analista solo puedes asignarte a ti mismo.";
    } else {
      sel.removeAttribute("disabled");
      sel.title = "";
    }
  }

  /* =========================================================================
   * UI: abrir/cerrar modal + submit
   * =========================================================================*/
  function openModal(modal) {
    if (!modal) return;
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }
  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  function wireAsignarRequerimiento() {
    const btnEdit   = $(SEL.btnAsignar);
    const modal     = $(SEL.modal);
    const form      = $(SEL.form);
    const sel       = $(SEL.select);
    const btnClose  = modal?.querySelector(SEL.modalClose);
    const displayEl = $(SEL.asignadoDisplay);

    if (!btnEdit || !modal || !form || !sel || !displayEl) {
      warn("No se encontraron elementos del modal de asignación; omitiendo bind.");
      return;
    }

    // abrir modal
    btnEdit.addEventListener("click", (e) => {
      e.preventDefault();
      openModal(modal);
      populateAsignadoSelect(sel).catch((e)=>toast("No se pudo cargar la lista de empleados.","danger"));
      setTimeout(()=> sel?.focus(), 30);
    });

    // cerrar modal (overlay, ✕, Esc)
    btnClose?.addEventListener("click", (e) => { e.preventDefault(); closeModal(modal); });
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(modal); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("active")) closeModal(modal);
    });

    // submit → update requerimiento
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const req = window.__REQ__;
      const val = sel.value;

      if (!req?.id)       { toast("No hay requerimiento cargado.", "danger"); return; }
      if (!val)           { toast("Selecciona un responsable.", "warning"); sel.focus(); return; }
      if (!REQ_UPDATE_URL){ toast("Configura el endpoint de actualización.", "danger"); return; }

      try {
        const updated_by = getEmpleadoId() ?? null;
        await postJSON(REQ_UPDATE_URL, { id: Number(req.id), asignado_a: Number(val), updated_by });

        // Actualiza UI
        const txt = sel.options[sel.selectedIndex]?.textContent || `Empleado #${val}`;
        displayEl.textContent = txt;
        displayEl.removeAttribute("href");

        // Refresca objeto global y emite evento
        window.__REQ__ = { ...(req || {}), asignado_id: String(val), asignado_full: txt };
        document.dispatchEvent(new CustomEvent("req:asignado:changed", {
          detail: { id: Number(req.id), asignado_a: Number(val), asignado_full: txt }
        }));

        toast("Asignación actualizada", "success");
        closeModal(modal);
      } catch (e2) {
        err("update asignado error:", e2);
        toast(e2?.message || "No se pudo actualizar la asignación.", "danger");
      }
    });
  }

  /* =========================================================================
   * Pintado inicial del bloque "Asignado"
   * =========================================================================*/
  function paintAsignadoFromReq(req) {
    const el = $(SEL.asignadoDisplay);
    if (!el) return;
    const txt =
      req?.asignado_full ||
      req?.asignado_display ||
      req?.asignado_nombre && req?.asignado_apellidos
        ? `${req.asignado_nombre} ${req.asignado_apellidos}`.trim()
        : null;

    el.textContent = txt || "Sin asignar";
    if (el.textContent === "Sin asignar") {
      el.setAttribute("href", "#");
    } else {
      el.removeAttribute("href");
    }
  }

  /* =========================================================================
   * API pública
   * =========================================================================*/
  async function init() {
    // 1) Pintar el asignado si el req ya está cargado
    if (window.__REQ__) paintAsignadoFromReq(window.__REQ__);

    // 2) Escuchar cuando el req termine de cargar
    document.addEventListener("req:loaded", (e) => {
      const req = e?.detail || window.__REQ__;
      if (req) paintAsignadoFromReq(req);
    }, { once: true });

    // 3) Enlazar el modal/botón
    wireAsignarRequerimiento();

    log("init OK (Detalles enlazado)");
  }

  // Exponer (por si necesitas invocarlo manual)
  window.ReqDetalle = { init };

  // Auto-init cuando el DOM esté listo (si no lo llamas desde otro lado)
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(init, 0);
  } else {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  }

})();

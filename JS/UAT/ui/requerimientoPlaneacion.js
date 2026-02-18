// /JS/ui/requerimientoPlaneacion.js
(function () {
  "use strict";

  /* ==========================================================================
     Planeación (Procesos / Tareas)
     - Este módulo SOLO controla los acordeones de procesos (.exp-accordion--fase)
     - El acordeón de Evidencias debe ser controlado por requerimientoView.js
     ========================================================================== */

  /* =========================
     Helpers básicos
     ========================= */
  const H = window._rvHelpers || {};
  const $ = H.$ || ((s, r = document) => r.querySelector(s));
  const $$ = H.$$ || ((s, r = document) => Array.from(r.querySelectorAll(s)));

  const toast =
    H.toast ||
    ((m, t = "info", ms = 4500) => {
      const map = {
        success: "success",
        exito: "success",
        ok: "success",
        info: "info",
        warning: "warning",
        warn: "warning",
        danger: "error",
        error: "error",
      };
      const type = map[String(t || "info").toLowerCase()] || "info";
      if (typeof window.gcToast === "function")
        return window.gcToast(String(m || ""), type, ms);
      console.log("[toast]", type, m);
    });

  const log = (...a) => console.log("[Planeación]", ...a);
  const warn = (...a) => console.warn("[Planeación]", ...a);
  const err = (...a) => console.error("[Planeación]", ...a);

  /* =========================
     Selectores
     ========================= */
  const SEL = {
    toolbar: {
      addProceso: "#btn-add-proceso",
      addTarea: "#btn-add-tarea",
    },
    planeacionList: "#planeacion-list",

    // Modal Nueva Tarea
    modalT: "#modal-tarea",
    formT: "#form-tarea",
    selProceso: "#tarea-proceso",
    inpTitulo: "#tarea-titulo",
    inpEsfuerzo: "#tarea-esfuerzo",
    selAsignado: "#tarea-asignado",
    txtDesc: "#tarea-desc",

    // Modal Nuevo Proceso
    modalP: "#modal-proceso",
    formP: "#form-proceso",
    inpPTitulo: "#proceso-titulo",
    inpPInicio: "#proceso-inicio",
  };

  /* =========================
     Eventos: notificar cambios
     ========================= */
  function emitPlaneacionChanged(reason = "") {
    try {
      document.dispatchEvent(
        new CustomEvent("planeacion:changed", {
          detail: { reason: String(reason || "") },
        }),
      );
    } catch (_) {}
  }

  /* =========================
     Flags internos
     ========================= */
  let _boundToolbar = false;
  let _boundModalT = false;
  let _boundModalP = false;
  let _creatingProceso = false;

  let _canManagePlaneacionPromise = null;
  let _canDeleteTasksPromise = null;

  let _delModalBound = false;
  let _delTarget = { kind: null, tareaId: null, procesoId: null };

  /* =========================
     API endpoints
     ========================= */
  const API_FBK = {
    PROCESOS: {
      CREATE:
        "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_i_proceso_requerimiento.php",
      UPDATE:
        "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_u_proceso_requerimiento.php",
      LIST: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_proceso_requerimiento.php",
    },
    TAREAS: {
      CREATE:
        "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_i_tarea_proceso.php",
      UPDATE:
        "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_u_tarea_proceso.php",
      LIST: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_tarea_proceso.php",
    },
    EMPLEADOS: {
      LIST: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_empleado.php",
    },
    DEPTS: {
      LIST: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php",
    },
  };
  const API = window.API || API_FBK;

  /* =========================
     HTTP helpers
     ========================= */
  async function requestJSON(url, method, body) {
    const group = `[HTTP][Planeación] ${method} ${url}`;
    console.groupCollapsed(group);
    console.log("→ payload:", body);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body || {}),
      });
      const txt = await res.text();
      let json = null;
      try {
        json = JSON.parse(txt);
      } catch {}
      console.log("← status:", res.status, "json:", json || txt);
      console.groupEnd();

      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      if (json?.ok === false)
        throw new Error(json?.error || "Operación no exitosa");
      return json ?? {};
    } catch (e) {
      console.groupEnd();
      throw e;
    }
  }
  const postJSON = (url, body) => requestJSON(url, "POST", body);
  const patchJSON = (url, body) => requestJSON(url, "PATCH", body);

  /* =========================
     Session helpers (cookie ix_emp)
     ========================= */
  function safeGetSession() {
    try {
      if (window.Session?.get) return window.Session.get();
    } catch {}
    try {
      const pair = document.cookie
        .split("; ")
        .find((c) => c.startsWith("ix_emp="));
      if (!pair) return null;
      const raw = decodeURIComponent(pair.split("=")[1] || "");
      const json = JSON.parse(decodeURIComponent(escape(atob(raw))));
      return json && typeof json === "object" ? json : null;
    } catch {}
    return null;
  }
  function getEmpleadoId() {
    const s = safeGetSession();
    return (
      s?.empleado_id ?? s?.id_empleado ?? s?.id_usuario ?? s?.cuenta_id ?? null
    );
  }
  function getDeptId() {
    const s = safeGetSession();
    return s?.departamento_id ?? s?.dept_id ?? null;
  }
  function getRoles() {
    const s = safeGetSession();
    return Array.isArray(s?.roles)
      ? s.roles.map((x) => String(x).toUpperCase())
      : [];
  }

  /* =========================
     Utilidades
     ========================= */
  function collectProcesos() {
    return $$("#planeacion-list .exp-accordion--fase[data-proceso-id]");
  }
  function todayISO() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function fmtMXDate(s) {
    if (!s) return "—";
    const parts = String(s)
      .slice(0, 19)
      .replace("T", " ")
      .split(" ")[0]
      .split("-");
    if (parts.length !== 3) return s;
    const [Y, M, D] = parts;
    return `${D}/${M}/${Y}`;
  }
  function escapeHtml(s = "") {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /* =========================
     RBAC
     ========================= */
  async function fetchDepartamentos() {
    const j = await postJSON(API.DEPTS.LIST, {
      page: 1,
      page_size: 200,
      status: 1,
    });
    const arr = Array.isArray(j?.data) ? j.data : [];
    return arr.map((d) => ({
      id: Number(d.id),
      nombre: String(d.nombre || "").trim(),
      director: d.director != null ? Number(d.director) : null,
      primera_linea: d.primera_linea != null ? Number(d.primera_linea) : null,
    }));
  }

  function canManagePlaneacion() {
    if (_canManagePlaneacionPromise) return _canManagePlaneacionPromise;

    _canManagePlaneacionPromise = (async () => {
      const yoIdRaw = getEmpleadoId();
      const deptIdRaw = getDeptId();
      const yoId = yoIdRaw != null ? Number(yoIdRaw) : null;
      const deptId = deptIdRaw != null ? Number(deptIdRaw) : null;

      const roles = getRoles();
      const isAdmin = roles.includes("ADMIN");
      const isPres = deptId === 6;

      if (isAdmin || isPres) return true;
      if (!yoId) return false;

      try {
        const deps = await fetchDepartamentos();
        const isDir = deps.some((d) => Number(d.director || 0) === yoId);
        const isPL = deps.some((d) => Number(d.primera_linea || 0) === yoId);
        return Boolean(isDir || isPL);
      } catch (e) {
        warn("[RBAC] canManagePlaneacion() fallo catálogo:", e);
        return false;
      }
    })();

    return _canManagePlaneacionPromise;
  }

  function canDeleteTasks() {
    if (_canDeleteTasksPromise) return _canDeleteTasksPromise;

    _canDeleteTasksPromise = (async () => {
      const yoIdRaw = getEmpleadoId();
      const deptIdRaw = getDeptId();
      const yoId = yoIdRaw != null ? Number(yoIdRaw) : null;
      const deptId = deptIdRaw != null ? Number(deptIdRaw) : null;

      const roles = getRoles();
      const isAdmin = roles.includes("ADMIN");
      if (isAdmin) return true;
      if (deptId === 6) return true; // Presidencia

      if (!yoId) return false;

      try {
        const deps = await fetchDepartamentos();
        return deps.some(
          (d) =>
            Number(d.director || 0) === yoId ||
            Number(d.primera_linea || 0) === yoId,
        );
      } catch (e) {
        warn("[RBAC] canDeleteTasks() fallo catálogo:", e);
        return false;
      }
    })();

    return _canDeleteTasksPromise;
  }

  /* =========================
     Normalizadores + list/create
     ========================= */
  function normalizeProceso(r = {}) {
    return {
      id: Number(r.id),
      reqId: Number(r.requerimiento_id),
      empleado_id: r.empleado_id != null ? Number(r.empleado_id) : null,
      titulo: (r.descripcion || "").trim() || "Proceso",
      descripcion: (r.descripcion || "").trim() || "",
      status: r.status != null ? Number(r.status) : 1,
      created_at: r.created_at || null,
      updated_at: r.updated_at || null,
    };
  }
  function normalizeTarea(r = {}) {
    return {
      id: Number(r.id),
      proceso_id: Number(r.proceso_id),
      asignado_a: r.asignado_a != null ? Number(r.asignado_a) : null,
      asignado_display:
        r.asignado_display ||
        [r.asignado_nombre, r.asignado_apellidos].filter(Boolean).join(" ") ||
        "—",
      titulo: (r.titulo || "").trim() || "Tarea",
      descripcion: (r.descripcion || "").trim() || "",
      esfuerzo: Number(r.esfuerzo) || 0,
      fecha_inicio: r.fecha_inicio || null,
      fecha_fin: r.fecha_fin || null,
      status: r.status != null ? Number(r.status) : 1,
      created_at: r.created_at || null,
      updated_at: r.updated_at || null,
    };
  }

  async function listProcesos(reqId, { page = 1, page_size = 50 } = {}) {
    const payload = {
      requerimiento_id: Number(reqId),
      status: 1,
      page: Number(page),
      page_size: Number(page_size),
    };
    const j = await postJSON(API.PROCESOS.LIST, payload);
    const arr = Array.isArray(j?.data) ? j.data : [];
    const procesos = arr.map(normalizeProceso);
    return procesos.filter((p) => Number(p.status ?? 0) !== 0);
  }

  async function listTareas(proceso_id, { page = 1, page_size = 100 } = {}) {
    const payload = { proceso_id: Number(proceso_id), page, page_size };
    const j = await postJSON(API.TAREAS.LIST, payload);
    const arr = Array.isArray(j?.data) ? j.data : [];
    const mapped = arr.map(normalizeTarea);
    return mapped.filter((x) => Number(x.status ?? 0) !== 0);
  }

  async function createProceso({
    requerimiento_id,
    descripcion,
    empleado_id,
    created_by,
  }) {
    const payload = {
      requerimiento_id: Number(requerimiento_id),
      empleado_id: empleado_id ?? null,
      descripcion: String(descripcion || "").trim(),
      status: 1,
      created_by: created_by ?? empleado_id ?? null,
    };
    return postJSON(API.PROCESOS.CREATE, payload);
  }

  async function createTarea({
    proceso_id,
    titulo,
    esfuerzo,
    asignado_a,
    descripcion,
    fecha_inicio,
    fecha_fin,
    created_by,
  }) {
    const payload = {
      proceso_id: Number(proceso_id),
      asignado_a: asignado_a != null ? Number(asignado_a) : null,
      titulo: String(titulo || "").trim(),
      descripcion: String(descripcion || "").trim() || null,
      esfuerzo: Number(esfuerzo),
      fecha_inicio: fecha_inicio || null,
      fecha_fin: fecha_fin || null,
      status: 1,
      created_by: created_by ?? asignado_a ?? null,
    };
    return postJSON(API.TAREAS.CREATE, payload);
  }

  /* =========================
     Porcentajes
     ========================= */
  const SCORE_BY_STATUS = { 0: 0, 1: 0, 2: 0.5, 3: 0.8, 4: 1.0, 5: 0 };
  function taskPct(t) {
    const s = Number(t.status ?? 0);
    const score = SCORE_BY_STATUS[s] ?? 0;
    return Math.round(score * 100);
  }
  function processPct(tareas = []) {
    if (!tareas.length) return 0;
    const sum = tareas.reduce((acc, t) => acc + taskPct(t), 0);
    return Math.round(sum / tareas.length);
  }

  /* =========================
     Toolbar por estatus del requerimiento
     ========================= */
  function getReqStatusCode(req) {
    if (!req) req = window.__REQ__ || null;
    if (!req) return null;
    return req.estatus_code != null
      ? Number(req.estatus_code)
      : req.estatus != null
        ? Number(req.estatus)
        : req.raw && req.raw.estatus != null
          ? Number(req.raw.estatus)
          : null;
  }

  function updateToolbarForReq(req) {
    const btnProceso = document.querySelector(SEL.toolbar.addProceso);
    const btnTarea = document.querySelector(SEL.toolbar.addTarea);
    if (!btnProceso && !btnTarea) return;

    const code = getReqStatusCode(req);
    const disableByStatus = code === 0 || code === 1 || code === 6;

    [btnProceso, btnTarea].forEach((btn) => {
      if (!btn) return;
      if (disableByStatus) {
        btn.classList.add("planeacion-btn-disabled");
        btn.title =
          code === 6
            ? "No disponible: el requerimiento está Finalizado."
            : "No disponible en estatus Solicitud / Revisión.";
      } else {
        btn.classList.remove("planeacion-btn-disabled");
        btn.title = "";
      }
    });

    // RBAC visual: si no tiene permiso, se oculta (pero NO cambiamos la lógica de estatus)
    canManagePlaneacion()
      .then((allowed) => {
        [btnProceso, btnTarea].forEach((btn) => {
          if (!btn) return;
          btn.style.display = allowed ? "" : "none";
        });
      })
      .catch((e) => warn("[RBAC] canManagePlaneacion(toolbar) error:", e));
  }

  /* =========================
     Acordeón de proceso (chevron)
     ========================= */
  function bindProcessAccordion(acc) {
    if (!acc) return;

    const head = acc.querySelector(".exp-acc-head");
    const body = acc.querySelector(".exp-acc-body");
    const chev = acc.querySelector(".chev");

    if (!head || !body) return;
    if (acc._boundAccordion) return;
    acc._boundAccordion = true;

    const setOpen = (open) => {
      head.setAttribute("aria-expanded", open ? "true" : "false");
      body.hidden = !open;
      acc.classList.toggle("is-collapsed", !open);
    };

    // init desde aria-expanded (default: abierto)
    setOpen(head.getAttribute("aria-expanded") !== "false");

    // Header completo (excepto botón de eliminar/inputs/links)
    head.addEventListener("click", (e) => {
      if (
        e.target.closest(".proceso-del-btn") ||
        e.target.closest("a") ||
        e.target.closest("input, select, textarea")
      ) {
        return;
      }
      const isOpen = head.getAttribute("aria-expanded") === "true";
      setOpen(!isOpen);
    });

    // Chevron click (por si aplica)
    if (chev) {
      chev.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = head.getAttribute("aria-expanded") === "true";
        setOpen(!isOpen);
      });
    }
  }

  /* =========================
     UI: render procesos / tareas
     ========================= */
  function makeProcesoSection(p) {
    const list = $(SEL.planeacionList);
    if (!list) return null;

    const sec = document.createElement("section");
    sec.className = "exp-accordion exp-accordion--fase";
    sec.setAttribute("data-proceso-id", String(p.id));

    const pct = 0;
    const hoyMx = fmtMXDate(p.created_at || todayISO());

    sec.innerHTML = `
      <button class="exp-acc-head" type="button" aria-expanded="true">
        <div class="fase-left">
          <div class="fase-head">
            <span class="fase-title">${escapeHtml(p.titulo)}</span>
            <small class="fase-meta">0 actividades</small>
          </div>
        </div>

        <div class="fase-right">
          <span class="fase-label">Estatus</span>
          <span class="exp-progress" aria-label="${pct}%">
            <span class="bar" style="width:${pct}%"></span>
            <span class="pct">${pct}%</span>
          </span>

          <span class="fase-label">Fecha de inicio</span>
          <span class="fase-date">${hoyMx}</span>

          <span class="proceso-del-btn"
            role="button"
            tabindex="0"
            data-proceso-id="${escapeHtml(String(p.id))}"
            aria-label="Eliminar proceso"
            title="Eliminar proceso">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM6 9h2v9H6V9z"></path>
            </svg>
          </span>

          <span class="chev" aria-hidden="true"></span>
        </div>
      </button>

      <div class="exp-acc-body">
        <div class="exp-table exp-table--planeacion is-card">
          <div class="exp-thead">
            <div>Actividad</div>
            <div>Responsable</div>
            <div>Estatus</div>
            <div>Porcentaje</div>
            <div>Fecha de inicio</div>
            <div>Acciones</div>
          </div>
        </div>
      </div>
    `;

    list.appendChild(sec);
    bindProcessAccordion(sec);
    return sec;
  }

  function addTareaRow(sec, t, allowDelete = false) {
    const table = sec.querySelector(".exp-table--planeacion");
    if (!table) return;

    const STATUS_TEXT = {
      0: "Inactivo",
      1: "Por hacer",
      2: "En proceso",
      3: "Por revisar",
      4: "Hecho",
      5: "Bloqueada",
    };
    const s = Number(t.status ?? 0);
    const badgeText = STATUS_TEXT[s] || "—";
    const badgeClass =
      s === 4
        ? "is-success"
        : s === 5
          ? "is-warning"
          : s === 3
            ? "is-info"
            : s === 2
              ? "is-info"
              : s === 0 || s === 1
                ? "is-muted"
                : "is-info";

    const rawPct = taskPct(t);
    const pct = s === 5 ? 100 : rawPct;
    const progressExtraClass = s === 5 ? " warning" : "";

    const row = document.createElement("div");
    row.className = "exp-row";
    row.innerHTML = `
      <div class="actividad">${escapeHtml(t.titulo)}</div>
      <div class="responsable">${escapeHtml(t.asignado_display || "—")}</div>
      <div class="estatus"><span class="exp-badge ${badgeClass}">${badgeText}</span></div>
      <div class="porcentaje">
        <span class="exp-progress xs${progressExtraClass}">
          <span class="bar" style="width:${pct}%"></span>
        </span>
      </div>
      <div class="fecha">${fmtMXDate(t.fecha_inicio)}</div>
      <div class="acciones">
        ${
          allowDelete
            ? `<button type="button" class="tarea-del-btn"
                data-tarea-id="${escapeHtml(String(t.id))}"
                data-proceso-id="${escapeHtml(String(t.proceso_id))}"
                aria-label="Eliminar tarea" title="Eliminar tarea">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM6 9h2v9H6V9z"></path>
                </svg>
              </button>`
            : ""
        }
      </div>
    `;
    table.appendChild(row);
  }

  function updateProcesoHeaderStats(sec, tareas) {
    const head = sec.querySelector(".exp-acc-head");
    const meta = head?.querySelector(".fase-meta");
    const pctBar = head?.querySelector(".exp-progress .bar");
    const pctTxt = head?.querySelector(".exp-progress .pct");
    if (!meta || !pctBar || !pctTxt) return;

    const total = tareas.length;
    const pct = processPct(tareas);

    meta.textContent = `${total} ${total === 1 ? "actividad" : "actividades"}`;
    pctBar.style.width = `${pct}%`;
    pctTxt.textContent = `${pct}%`;
    pctBar.parentElement?.setAttribute("aria-label", `${pct}%`);
  }

  async function renderProcesosYtareas(requerimiento_id) {
    const host = $(SEL.planeacionList);
    if (!host) return;

    host.innerHTML = "";

    let canManage = false;
    try {
      canManage = await canManagePlaneacion();
    } catch (e) {
      canManage = false;
      warn("[RBAC] canManagePlaneacion() falló:", e);
    }

    host.classList.toggle("no-actions", !canManage);

    try {
      const procesos = await listProcesos(requerimiento_id, {
        page: 1,
        page_size: 100,
      });

      if (!procesos.length) {
        const empty = document.createElement("div");
        empty.className = "exp-row";
        empty.style.padding = "12px";
        empty.textContent = "Sin procesos";
        host.appendChild(empty);
        return;
      }

      for (const p of procesos) {
        const sec = makeProcesoSection(p);
        if (!sec) continue;

        try {
          const tareas = await listTareas(p.id, { page: 1, page_size: 100 });
          tareas.forEach((t) => addTareaRow(sec, t, canManage));
          updateProcesoHeaderStats(sec, tareas);
        } catch (e) {
          warn("Error listando tareas del proceso", p.id, e);
          updateProcesoHeaderStats(sec, []);
        }
      }
    } catch (e) {
      err("Error listando procesos:", e);
      toast("No se pudieron cargar los procesos.", "danger");
    }
  }

  /* =========================
     Modales (open/close)
     ========================= */
  function openOverlay(modalEl) {
    modalEl.classList.add("open", "active");
    modalEl.setAttribute("aria-hidden", "false");
    document.body.classList.add("me-modal-open");
  }
  function closeOverlay(modalEl) {
    modalEl.classList.remove("open", "active");
    modalEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("me-modal-open");
  }

  /* =========================
     Modal Nueva Tarea
     ========================= */
  function openTareaModal({ preferProcesoId = null } = {}) {
    const modal = document.querySelector(SEL.modalT);
    const modalContent = modal?.querySelector(".modal-content");
    if (!modal || !modalContent) return;

    const form = document.querySelector(SEL.formT);
    if (form) form.reset();
    fillProcesoSelect(preferProcesoId);

    openOverlay(modal);

    if (!_boundModalT) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeOverlay(modal);
      });
      modalContent.addEventListener(
        "click",
        (e) => {
          if (e.target.closest(".modal-close")) closeOverlay(modal);
        },
        { capture: true },
      );
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.classList.contains("open"))
          closeOverlay(modal);
      });
      bindSubmitNuevaTarea();
      _boundModalT = true;
    }

    populateAsignadoSelect().catch((e) =>
      warn("populateAsignadoSelect error:", e),
    );
    setTimeout(() => $(SEL.selProceso)?.focus(), 30);
  }

  function fillProcesoSelect(preferId = null) {
    const sel = $(SEL.selProceso);
    if (!sel) return;

    sel.innerHTML =
      '<option value="" disabled selected>Selecciona un proceso…</option>';
    const procesos = collectProcesos();
    procesos.forEach((sec) => {
      const id = sec.getAttribute("data-proceso-id");
      const title =
        sec.querySelector(".fase-title")?.textContent?.trim() || "Proceso";
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = title;
      sel.appendChild(opt);
    });
    if (preferId) sel.value = String(preferId);
  }

  // ====== Empleados / asignables (se mantiene lógica original) ======
  function normalizeEmpleadoFromAPI(r) {
    const reporta_a =
      r.reporta_a != null
        ? r.reporta_a
        : r.cuenta && r.cuenta.reporta_a != null
          ? r.cuenta.reporta_a
          : null;

    const roles = Array.isArray(r.cuenta?.roles)
      ? r.cuenta.roles.map((x) => x?.codigo).filter(Boolean)
      : [];
    const rolCodes = roles.map((x) => String(x).toUpperCase());

    return {
      id: Number(r.id),
      full: [r.nombre, r.apellidos].filter(Boolean).join(" ").trim(),
      departamento_id:
        r.departamento_id != null ? Number(r.departamento_id) : null,
      reporta_a: reporta_a != null ? Number(reporta_a) : null,
      rolCodes,
    };
  }

  async function fetchEmpleadosAll() {
    const j = await postJSON(API.EMPLEADOS.LIST, {
      page: 1,
      page_size: 500,
      status: 1,
    });
    const arr = Array.isArray(j?.data) ? j.data : [];
    return arr.map(normalizeEmpleadoFromAPI);
  }

  function getReportesTransitivos(universe, jefeId) {
    const mapByBoss = new Map();
    universe.forEach((emp) => {
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
    const yoIdRaw = getEmpleadoId();
    const deptIdRaw = getDeptId();
    const yoId = yoIdRaw != null ? Number(yoIdRaw) : null;
    const deptId = deptIdRaw != null ? Number(deptIdRaw) : null;

    const roles = getRoles();
    const isAdmin = roles.includes("ADMIN");
    const isAnalista = roles.includes("ANALISTA");
    const isJefe = roles.includes("JEFE");

    let isDirector = roles.includes("DIRECTOR");
    let isPL =
      roles.includes("PRIMERA_LINEA") ||
      roles.includes("PL") ||
      roles.includes("PRIMERA LINEA");

    const universe = await fetchEmpleadosAll();

    if (isAdmin) return universe;
    if (deptId === 6) return universe; // Presidencia

    // Detectar DIR/PL por catálogo (robusto)
    let depts = [];
    try {
      depts = await fetchDepartamentos();
    } catch (e) {
      warn("[RBAC] No se pudieron cargar departamentos:", e);
      depts = [];
    }

    if (yoId) {
      const isDirectorFromDepts = depts.some(
        (d) => Number(d.director) === yoId,
      );
      const isPLFromDepts = depts.some((d) => Number(d.primera_linea) === yoId);
      if (!isDirector && isDirectorFromDepts) isDirector = true;
      if (!isPL && isPLFromDepts) isPL = true;
    }

    if (isDirector || isPL) {
      const visibleDeptIds = new Set(
        depts
          .filter(
            (d) =>
              Number(d.director) === yoId || Number(d.primera_linea) === yoId,
          )
          .map((d) => Number(d.id)),
      );
      if (deptId) visibleDeptIds.add(deptId);

      const inDepts = universe.filter((e) =>
        visibleDeptIds.has(Number(e.departamento_id)),
      );
      const reports = yoId ? getReportesTransitivos(universe, yoId) : [];
      const self = yoId ? universe.find((e) => e.id === yoId) : null;

      const map = new Map();
      [...inDepts, ...reports, ...(self ? [self] : [])].forEach((e) =>
        map.set(e.id, e),
      );
      return Array.from(map.values());
    }

    if (isJefe && yoId) {
      const self = universe.find((e) => e.id === yoId);
      const direct = universe.filter((e) => e.reporta_a === yoId);
      const map = new Map();
      if (self) map.set(self.id, self);
      direct.forEach((e) => map.set(e.id, e));
      return Array.from(map.values());
    }

    const self = yoId ? universe.find((e) => e.id === yoId) : null;
    return self ? [self] : [];
  }

  async function populateAsignadoSelect() {
    const sel = $(SEL.selAsignado);
    if (!sel) return;

    sel.innerHTML = `<option value="" disabled selected>Selecciona responsable…</option>`;

    const visibles = await buildAsignablesList();
    visibles.sort((a, b) => (a.full || "").localeCompare(b.full || "", "es"));

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

  function bindSubmitNuevaTarea() {
    const form = document.querySelector(SEL.formT);
    if (!form) return;

    if (form.dataset.boundSubmitTarea === "1") return;
    form.dataset.boundSubmitTarea = "1";

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const procesoId = $(SEL.selProceso)?.value || "";
      const titulo = ($(SEL.inpTitulo)?.value || "").trim();
      const esfuerzo = Number($(SEL.inpEsfuerzo)?.value || 0);
      const asignadoId = $(SEL.selAsignado)?.value || "";
      const desc = ($(SEL.txtDesc)?.value || "").trim();

      if (!procesoId) return toast("Selecciona un proceso.", "warning");
      if (!titulo) return toast("Escribe un título.", "warning");
      if (!(esfuerzo > 0))
        return toast("Define el esfuerzo (mínimo 1).", "warning");
      if (!asignadoId) return toast("Selecciona un responsable.", "warning");

      const empleadoId = getEmpleadoId();

      try {
        const res = await createTarea({
          proceso_id: Number(procesoId),
          titulo,
          esfuerzo,
          asignado_a: Number(asignadoId),
          descripcion: desc || null,
          fecha_inicio: null,
          fecha_fin: null,
          created_by: empleadoId ?? Number(asignadoId),
        });
        if (res?.ok === false)
          throw new Error(res?.error || "No se pudo crear la tarea");

        toast("Tarea creada", "success");
        emitPlaneacionChanged("create-tarea");

        const modal = document.querySelector(SEL.modalT);
        if (modal) closeOverlay(modal);

        const sec = $(
          `#planeacion-list .exp-accordion--fase[data-proceso-id="${CSS.escape(String(procesoId))}"]`,
        );

        if (sec) {
          const tareas = await listTareas(Number(procesoId), {
            page: 1,
            page_size: 200,
          });
          sec
            .querySelectorAll(".exp-table--planeacion .exp-row")
            .forEach((r) => r.remove());
          const allowDelete2 = await canDeleteTasks();
          tareas.forEach((t) => addTareaRow(sec, t, allowDelete2));
          updateProcesoHeaderStats(sec, tareas);
        } else {
          const req = window.__REQ__;
          if (req?.id) await renderProcesosYtareas(req.id);
        }
      } catch (e2) {
        err("createTarea error:", e2);
        toast(e2?.message || "No se pudo crear la tarea.", "danger");
      }
    });
  }

  /* =========================
     Modal Nuevo Proceso
     ========================= */
  function openProcesoModal() {
    const modal = document.querySelector(SEL.modalP);
    const content = modal?.querySelector(".modal-content");

    // fallback (prompt) si no existe modal
    if (!modal || !content) {
      const titulo = window.prompt("Título / Descripción del nuevo proceso:");
      if (!titulo) return;
      if (_creatingProceso) return;

      _creatingProceso = true;
      Promise.resolve(makeProcesoFromAPI(titulo)).finally(() => {
        _creatingProceso = false;
      });
      return;
    }

    const form = document.querySelector(SEL.formP);
    if (form) form.reset();

    const inpInicio = $(SEL.inpPInicio);
    if (inpInicio) inpInicio.value = todayISO();

    openOverlay(modal);

    if (!_boundModalP) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeOverlay(modal);
      });
      content.addEventListener(
        "click",
        (e) => {
          if (e.target.closest(".modal-close")) closeOverlay(modal);
        },
        { capture: true },
      );
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.classList.contains("open"))
          closeOverlay(modal);
      });
      bindSubmitNuevoProceso();
      _boundModalP = true;
    }

    setTimeout(() => $(SEL.inpPTitulo)?.focus(), 30);
  }

  function bindSubmitNuevoProceso() {
    const form = document.querySelector(SEL.formP);
    if (!form) return;
    if (form.dataset.boundSubmitProceso === "1") return;
    form.dataset.boundSubmitProceso = "1";

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (_creatingProceso) return;

      _creatingProceso = true;
      const btnSubmit = form.querySelector(
        'button[type="submit"], .btn-submit',
      );
      if (btnSubmit) btnSubmit.disabled = true;

      try {
        const titulo = ($(SEL.inpPTitulo)?.value || "").trim();
        if (!titulo) {
          toast("Escribe un título para el proceso.", "warning");
          $(SEL.inpPTitulo)?.focus();
          return;
        }
        await makeProcesoFromAPI(titulo);
        const modal = document.querySelector(SEL.modalP);
        if (modal) closeOverlay(modal);
      } finally {
        _creatingProceso = false;
        if (btnSubmit) btnSubmit.disabled = false;
      }
    });
  }

  async function makeProcesoFromAPI(titulo) {
    const req = window.__REQ__;
    if (!req?.id) return toast("No hay requerimiento cargado.", "danger");

    const empleadoId = getEmpleadoId();

    try {
      const res = await createProceso({
        requerimiento_id: Number(req.id),
        descripcion: titulo,
        empleado_id: empleadoId ?? null,
        created_by: empleadoId ?? null,
      });
      if (res?.ok === false)
        throw new Error(res?.error || "No se pudo crear el proceso");
      toast("Proceso creado", "success");
      await renderProcesosYtareas(req.id);
      emitPlaneacionChanged("create-proceso");
    } catch (e) {
      err("createProceso error:", e);
      toast(e?.message || "No se pudo crear el proceso.", "danger");
    }
  }

  /* =========================
     Modal confirmación (delete)
     ========================= */
  function ensureDeleteModal() {
    let modal = document.querySelector("#modal-del-tarea");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modal-del-tarea";
      modal.className = "modal-overlay";
      modal.setAttribute("aria-hidden", "true");
      modal.innerHTML = `
        <div class="modal-content ix-del-modal" role="dialog" aria-modal="true" aria-labelledby="del-tarea-title">
          <button class="modal-close" type="button" aria-label="Cerrar">×</button>
          <h2 id="del-tarea-title" class="ix-del-title">Eliminar tarea</h2>
          <p class="ix-del-text">¿Seguro que quieres eliminar esta tarea?</p>
          <div class="ix-del-actions">
            <button type="button" class="btn ix-del-cancel" id="btn-del-tarea-cancel">Cancelar</button>
            <button type="button" class="btn ix-del-confirm" id="btn-del-tarea-confirm">Confirmar</button>
          </div>
          <p class="modal-note ix-del-note">Esta acción no se puede deshacer.</p>
        </div>
      `;
      document.body.appendChild(modal);
    } else {
      modal.classList.add("modal-overlay");
      if (!modal.getAttribute("aria-hidden"))
        modal.setAttribute("aria-hidden", "true");
    }

    return modal;
  }

  function openDeleteModal({ kind, procesoId = null, tareaId = null } = {}) {
    const modal = ensureDeleteModal();

    const titleEl =
      modal.querySelector("#del-tarea-title") ||
      modal.querySelector(".ix-del-title");
    const msgEl = modal.querySelector(".ix-del-text");
    const isProceso = kind === "proceso";

    if (titleEl)
      titleEl.textContent = isProceso ? "Eliminar proceso" : "Eliminar tarea";
    if (msgEl) {
      msgEl.textContent = isProceso
        ? "¿Seguro que quieres eliminar este proceso?"
        : "¿Seguro que quieres eliminar esta tarea?";
    }

    _delTarget = {
      kind: isProceso ? "proceso" : "tarea",
      tareaId: tareaId != null ? Number(tareaId) : null,
      procesoId: procesoId != null ? Number(procesoId) : null,
    };

    openOverlay(modal);
  }

  function bindDeleteModalButtons() {
    const modal = ensureDeleteModal();
    if (modal._ixBoundDelete) return;
    modal._ixBoundDelete = true;

    const btnCancel = modal.querySelector("#btn-del-tarea-cancel");
    const btnConfirm = modal.querySelector("#btn-del-tarea-confirm");
    const btnClose = modal.querySelector(".modal-close");

    const close = () => closeOverlay(modal);

    btnCancel && btnCancel.addEventListener("click", close);
    btnClose && btnClose.addEventListener("click", close);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("open")) close();
    });

    btnConfirm &&
      btnConfirm.addEventListener("click", async () => {
        try {
          const empleadoId = getEmpleadoId();
          if (!empleadoId)
            return toast("No se detectó tu sesión (empleado_id).", "danger");

          if (_delTarget?.kind === "proceso") {
            const procesoId = Number(_delTarget?.procesoId || 0) || null;
            if (!procesoId) return;

            // Regla: solo si NO hay tareas activas
            const tareas = await listTareas(procesoId, {
              page: 1,
              page_size: 200,
            });
            const activas = (tareas || []).filter(
              (t) => Number(t?.status ?? 0) !== 0,
            );
            if (activas.length)
              return toast(
                "No puedes eliminar el proceso: tiene tareas activas.",
                "warning",
              );

            await patchJSON(API.PROCESOS.UPDATE, {
              id: procesoId,
              updated_by: empleadoId,
              status: 0,
            });

            toast("Proceso eliminado", "success");
            close();
            const req = window.__REQ__;
            if (req?.id) await renderProcesosYtareas(req.id);
            emitPlaneacionChanged("delete-proceso");
            return;
          }

          // TAREA
          const tareaId = Number(_delTarget?.tareaId || 0) || null;
          const procesoId = Number(_delTarget?.procesoId || 0) || null;
          if (!tareaId) return;

          await postJSON(API.TAREAS.UPDATE, {
            id: tareaId,
            updated_by: empleadoId,
            status: 0,
          });

          toast("Tarea eliminada", "success");
          close();

          const sec = procesoId
            ? $(
                `#planeacion-list .exp-accordion--fase[data-proceso-id="${CSS.escape(String(procesoId))}"]`,
              )
            : null;

          if (sec && procesoId) {
            const tareas = await listTareas(Number(procesoId), {
              page: 1,
              page_size: 200,
            });
            sec
              .querySelectorAll(".exp-table--planeacion .exp-row")
              .forEach((r) => r.remove());
            const allowDelete2 = await canDeleteTasks();
            (tareas || []).forEach((t) => addTareaRow(sec, t, allowDelete2));
            updateProcesoHeaderStats(sec, tareas || []);
          } else {
            const req = window.__REQ__;
            if (req?.id) await renderProcesosYtareas(req.id);
          }
          emitPlaneacionChanged("delete-tarea");
        } catch (e2) {
          err("Error en confirm delete:", e2);
          toast(e2?.message || "No se pudo eliminar.", "danger");
        }
      });
  }

  function bindDeleteDelegation() {
    bindDeleteModalButtons();

    const list = $(SEL.planeacionList);
    if (!list)
      return warn("bindDeleteDelegation(): no existe #planeacion-list");
    if (_delModalBound) return;
    _delModalBound = true;

    list.addEventListener("click", async (e) => {
      const tareaBtn = e.target.closest?.(".tarea-del-btn");
      const procBtn = e.target.closest?.(".proceso-del-btn");

      if (tareaBtn) {
        e.preventDefault();
        e.stopPropagation();

        let allow = false;
        try {
          allow = await canDeleteTasks();
        } catch {}
        if (!allow)
          return toast("No tienes permiso para eliminar tareas.", "warning");

        const tareaId =
          Number(tareaBtn.getAttribute("data-tarea-id") || 0) || null;
        const procesoId =
          Number(tareaBtn.getAttribute("data-proceso-id") || 0) || null;
        if (!tareaId) return;

        openDeleteModal({ kind: "tarea", tareaId, procesoId });
        return;
      }

      if (procBtn) {
        e.preventDefault();
        e.stopPropagation();

        let allow = false;
        try {
          allow = await canDeleteTasks();
        } catch {}
        if (!allow)
          return toast("No tienes permiso para eliminar procesos.", "warning");

        const procesoId =
          Number(procBtn.getAttribute("data-proceso-id") || 0) || null;
        if (!procesoId) return;

        // Pre-check: si hay tareas activas, no abrimos modal
        try {
          procBtn.classList.add("is-busy");
          const tareas = await listTareas(procesoId, {
            page: 1,
            page_size: 200,
          });
          const activas = (tareas || []).filter(
            (t) => Number(t?.status ?? 0) !== 0,
          );
          if (activas.length)
            return toast(
              "No se pueden eliminar procesos con tareas activas",
              "warning",
            );
        } catch (eList) {
          warn("precheck tareas proceso (delete):", eList);
          return toast(
            "No se pudo validar si el proceso tiene tareas. Intenta de nuevo.",
            "warning",
          );
        } finally {
          procBtn.classList.remove("is-busy");
        }

        openDeleteModal({ kind: "proceso", procesoId });
      }
    });
  }

  /* =========================
     Toolbar
     ========================= */
  function bindToolbar() {
    if (_boundToolbar) return;

    const btnProceso = document.querySelector(SEL.toolbar.addProceso);
    const btnTarea = document.querySelector(SEL.toolbar.addTarea);

    btnProceso?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openProcesoModal();
    });

    btnTarea?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const procesos = collectProcesos();
      if (procesos.length === 0)
        return toast("Primero crea un proceso.", "warning");
      const prefer =
        procesos.length === 1
          ? procesos[0].getAttribute("data-proceso-id")
          : null;
      openTareaModal({ preferProcesoId: prefer });
    });

    _boundToolbar = true;
  }

  /* =========================
     API pública
     ========================= */
  window.Planeacion = {
    async init() {
      $$("#planeacion-list .exp-accordion--fase").forEach(bindProcessAccordion);
      bindToolbar();
      bindDeleteDelegation();

      // Cuando el req carga/re-carga
      document.addEventListener(
        "req:loaded",
        async (e) => {
          const req = e?.detail || window.__REQ__;
          if (!req?.id) return;
          updateToolbarForReq(req);
          await renderProcesosYtareas(Number(req.id));
        },
        { passive: true },
      );

      // Fallback si __REQ__ ya existe
      if (window.__REQ__?.id) {
        updateToolbarForReq(window.__REQ__);
        await renderProcesosYtareas(Number(window.__REQ__.id));
      }

      log("init OK");
    },

    reload: async () => {
      const req = window.__REQ__;
      if (req?.id) {
        updateToolbarForReq(req);
        await renderProcesosYtareas(Number(req.id));
      }
    },
  };

  // Auto-init
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => window.Planeacion.init(),
      { once: true },
    );
  } else {
    window.Planeacion.init();
  }
})();

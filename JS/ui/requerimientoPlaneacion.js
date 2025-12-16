// /JS/ui/requerimientoPlaneacion.js
(function () {
  "use strict";

  // ===== Helpers (desde requerimientoView o fallback) =====
  const H = window._rvHelpers || {};
  const $ = H.$ || ((s, r = document) => r.querySelector(s));
  const $$ = H.$$ || ((s, r = document) => Array.from(r.querySelectorAll(s)));
  const toast = H.toast || ((m, t = "info") => console.log("[toast]", t, m));
  const setAccordionOpen =
    window.setAccordionOpen ||
    ((h, b, open) => {
      b.hidden = !open;
    });

  const log = (...a) => console.log("[Planeación]", ...a);
  const warn = (...a) => console.warn("[Planeación]", ...a);
  const err = (...a) => console.error("[Planeación]", ...a);

  // ===== Selectores / referencias de UI =====
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

  // ===== Estado interno / flags =====
  let _boundToolbar = false;
  let _boundModalT = false;
  let _boundModalP = false;

  // ====== API endpoints ======
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

  async function postJSON(url, body) {
    const group = `[HTTP][Planeación] ${url}`;
    console.groupCollapsed(group);
    console.log("→ payload:", body);
    try {
      const res = await fetch(url, {
        method: "POST",
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

  // ===== Session helper =====
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
      if (json && typeof json === "object") return json;
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
    const r = Array.isArray(s?.roles)
      ? s.roles.map((x) => String(x).toUpperCase())
      : [];
    return r;
  }

  // ===== Utilidades =====
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

  // ====== Empleados + RBAC para SELECT de asignado ======
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
      nombre: String(r.nombre || "").trim(),
      apellidos: String(r.apellidos || "").trim(),
      full: [r.nombre, r.apellidos].filter(Boolean).join(" ").trim(),
      departamento_id:
        r.departamento_id != null ? Number(r.departamento_id) : null,
      reporta_a: reporta_a != null ? Number(reporta_a) : null,
      rolCodes,
    };
  }
  async function fetchEmpleadosAll() {
    log("[RBAC] fetchEmpleadosAll");
    const j = await postJSON(API.EMPLEADOS.LIST, {
      page: 1,
      page_size: 500,
      status: 1,
    });
    const arr = Array.isArray(j?.data) ? j.data : [];
    const norm = arr.map(normalizeEmpleadoFromAPI);
    return norm;
  }
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

    // (roles + lookup por departamentos)
    let isDirector = roles.includes("DIRECTOR");
    let isPL =
      roles.includes("PRIMERA_LINEA") ||
      roles.includes("PL") ||
      roles.includes("PRIMERA LINEA");

    const isJefe = roles.includes("JEFE");
    const isAnalista = roles.includes("ANALISTA"); // (se usa despues en populateAsignadoSelect)

    const universe = await fetchEmpleadosAll();

    if (isAdmin) return universe;

    const PRES_DEPT_IDS = [6];
    if (deptId && PRES_DEPT_IDS.includes(deptId)) return universe;

    // ==============================
    // 1) Detectar DIRECTOR / PRIMERA_LINEA por JSON de departamentos
    // ==============================
    let depts = [];
    try {
      depts = await fetchDepartamentos();
    } catch (e) {
      warn(
        "[RBAC] No se pudieron cargar departamentos para detectar director/PL:",
        e
      );
      depts = [];
    }

    if (yoId) {
      const isDirectorFromDepts = depts.some(
        (d) => Number(d.director) === yoId
      );
      const isPLFromDepts = depts.some((d) => Number(d.primera_linea) === yoId);

      if (!isDirector && isDirectorFromDepts) {
        isDirector = true;
        log(
          "[RBAC] DIRECTOR detectado por departamentos (aunque no venga en roles). yoId=",
          yoId
        );
      }

      if (!isPL && isPLFromDepts) {
        isPL = true;
        log(
          "[RBAC] PRIMERA_LINEA detectado por departamentos (aunque no venga en roles). yoId=",
          yoId
        );
      }
    }

    // ==============================
    // 2) Director y Primera línea => MISMAS REGLAS
    // ==============================
    if (isDirector || isPL) {
      const visibleDeptIds = new Set(
        depts
          .filter(
            (d) =>
              Number(d.director) === yoId || Number(d.primera_linea) === yoId
          )
          .map((d) => Number(d.id))
      );

      if (deptId) visibleDeptIds.add(deptId);

      const inDepts = universe.filter((e) =>
        visibleDeptIds.has(Number(e.departamento_id))
      );

      const reports = yoId ? getReportesTransitivos(universe, yoId) : [];
      const self = yoId ? universe.find((e) => e.id === yoId) : null;

      const map = new Map();
      [...inDepts, ...reports, ...(self ? [self] : [])].forEach((e) =>
        map.set(e.id, e)
      );

      log("[RBAC] Asignables (DIR/PL)", {
        yoId,
        deptId,
        isDirector,
        isPL,
        visibleDeptIds: Array.from(visibleDeptIds),
        count: map.size,
      });

      return Array.from(map.values());
    }

    // ==============================
    // 3) JEFE => self + reportes directos
    // ==============================
    if (isJefe && yoId) {
      const self = universe.find((e) => e.id === yoId);
      const direct = universe.filter((e) => e.reporta_a === yoId);

      const map = new Map();
      if (self) map.set(self.id, self);
      direct.forEach((e) => map.set(e.id, e));

      log("[RBAC] Asignables (JEFE)", { yoId, deptId, count: map.size });
      return Array.from(map.values());
    }

    // ==============================
    // 4) Default => solo self
    // ==============================
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

  // ====== LAYER: Procesos / Tareas (LIST / CREATE) ======
  async function listProcesos(
    requerimiento_id,
    { page = 1, page_size = 100 } = {}
  ) {
    const payload = {
      requerimiento_id: Number(requerimiento_id),
      page,
      page_size,
    };
    const j = await postJSON(API.PROCESOS.LIST, payload);
    const arr = Array.isArray(j?.data) ? j.data : [];
    return arr.map(normalizeProceso);
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

  async function listTareas(proceso_id, { page = 1, page_size = 100 } = {}) {
    const payload = { proceso_id: Number(proceso_id), page, page_size };
    const j = await postJSON(API.TAREAS.LIST, payload);
    const arr = Array.isArray(j?.data) ? j.data : [];
    return arr.map(normalizeTarea);
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

  // ===== Normalizadores =====
  function normalizeProceso(r = {}) {
    return {
      id: Number(r.id),
      reqId: Number(r.requerimiento_id),
      empleado_id: r.empleado_id != null ? Number(r.empleado_id) : null,
      empleado_display:
        r.empleado_display ||
        [r.empleado_nombre, r.empleado_apellidos].filter(Boolean).join(" ") ||
        "—",
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

  /* =========================================================================
   *  PORCENTAJES (basado 100% en status de tarea)
   * =========================================================================*/
  // 0: Inactivo    → 0%
  // 1: Por hacer   → 0%
  // 2: En proceso  → 50%
  // 3: Por revisar → 80%
  // 4: Hecho       → 100%
  // 5: Bloqueada   → 0% (pero se pinta como 100% solo a nivel de UI)
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

  /* =========================================================================
   *  ESTATUS DEL REQ + TOOLBAR
   * =========================================================================*/

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

  // Regla: botones de procesos/tareas NO habilitados en
  // estatus Solicitud (0) ni Revisión (1). En los demás, sí.
  function updateToolbarForReq(req) {
    const btnProceso = document.querySelector(SEL.toolbar.addProceso);
    const btnTarea = document.querySelector(SEL.toolbar.addTarea);
    if (!btnProceso && !btnTarea) return;

    const code = getReqStatusCode(req);

    const disable = code === 0 || code === 1;

    [btnProceso, btnTarea].forEach((btn) => {
      if (!btn) return;
      if (disable) {
        btn.setAttribute("disabled", "true");
        btn.classList.add("planeacion-btn-disabled");
        btn.title = "No disponible en estatus Solicitud / Revisión.";
      } else {
        btn.removeAttribute("disabled");
        btn.classList.remove("planeacion-btn-disabled");
        btn.title = "";
      }
    });

    log("[Toolbar] estatus req =", code, "disable planeación:", disable);
  }

  /* ====== Pintado de UI (reutiliza tu markup) ====== */
  function bindProcessAccordion(sec) {
    const head = sec.querySelector(".exp-acc-head");
    const body = sec.querySelector(".exp-acc-body");
    const chev = head?.querySelector(".chev");
    if (!head || !body || !chev) return;

    const initOpen = head.getAttribute("aria-expanded") === "true";
    body.hidden = !initOpen;
    if (!initOpen) body.style.height = "0px";

    head.addEventListener("click", (e) => {
      if (!e.target.closest(".chev")) return;
    });
    chev.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = head.getAttribute("aria-expanded") === "true";
      setAccordionOpen(head, body, !isOpen);
    });
  }

  function makeProcesoSection(p) {
    const list = $(SEL.planeacionList);
    if (!list) return null;

    const sec = document.createElement("section");
    sec.className = "exp-accordion exp-accordion--fase";
    sec.setAttribute("data-proceso-id", String(p.id));

    const pct = 0;
    const hoyMx = fmtMXDate(p.created_at || todayISO());

    sec.innerHTML = `
      <!-- HEADER -->
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
          <span class="chev" aria-hidden="true"></span>
        </div>
      </button>

      <!-- BODY -->
      <div class="exp-acc-body">
        <div class="exp-table exp-table--planeacion is-card">
          <div class="exp-thead">
            <div>Actividad</div>
            <div>Responsable</div>
            <div>Estatus</div>
            <div>Porcentaje</div>
            <div>Fecha de inicio</div>
          </div>
          <!-- filas .exp-row aquí -->
        </div>
      </div>
    `;
    $(SEL.planeacionList).appendChild(sec);
    bindProcessAccordion(sec);
    return sec;
  }

  function addTareaRow(sec, t) {
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

  // ===== Carga/Render: Procesos + Tareas =====
  async function renderProcesosYtareas(requerimiento_id) {
    const host = $(SEL.planeacionList);
    if (!host) return;

    host.innerHTML = "";

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
          tareas.forEach((t) => addTareaRow(sec, t));
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

  // ===== Helpers de modal (compatibilidad .open/.active) =====
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

  // ===== Modal Nueva Tarea =====
  function openTareaModal({ preferProcesoId = null } = {}) {
    const modal = document.querySelector(SEL.modalT);
    const modalContent = modal?.querySelector(".modal-content");
    if (!modal || !modalContent) return;

    fillProcesoSelect(preferProcesoId);
    const form = document.querySelector(SEL.formT);
    form && form.reset();

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
        { capture: true }
      );
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.classList.contains("open"))
          closeOverlay(modal);
      });
      bindSubmitNuevaTarea();
      _boundModalT = true;
    }

    populateAsignadoSelect().catch((e) =>
      warn("populateAsignadoSelect error:", e)
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
        sec.querySelector(".fase-title")?.textContent?.trim() || `Proceso`;
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = title;
      sel.appendChild(opt);
    });
    if (preferId) sel.value = String(preferId);
  }
  function bindSubmitNuevaTarea() {
    const form = document.querySelector(SEL.formT);
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const procesoId = $(SEL.selProceso)?.value || "";
      const titulo = ($(SEL.inpTitulo)?.value || "").trim();
      const esfuerzo = Number($(SEL.inpEsfuerzo)?.value || 0);
      const asignadoId = $(SEL.selAsignado)?.value || "";
      const desc = ($(SEL.txtDesc)?.value || "").trim();

      if (!procesoId) {
        toast("Selecciona un proceso.", "warning");
        $(SEL.selProceso)?.focus();
        return;
      }
      if (!titulo) {
        toast("Escribe un título.", "warning");
        $(SEL.inpTitulo)?.focus();
        return;
      }
      if (!(esfuerzo > 0)) {
        toast("Define el esfuerzo (mínimo 1).", "warning");
        $(SEL.inpEsfuerzo)?.focus();
        return;
      }
      if (!asignadoId) {
        toast("Selecciona un responsable.", "warning");
        $(SEL.selAsignado)?.focus();
        return;
      }

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

        const modal = document.querySelector(SEL.modalT);
        if (modal) closeOverlay(modal);

        const sec = $(
          `#planeacion-list .exp-accordion--fase[data-proceso-id="${CSS.escape(
            String(procesoId)
          )}"]`
        );
        if (sec) {
          const tareas = await listTareas(Number(procesoId), {
            page: 1,
            page_size: 100,
          });
          sec
            .querySelectorAll(".exp-table--planeacion .exp-row")
            .forEach((r) => r.remove());
          tareas.forEach((t) => addTareaRow(sec, t));
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

  // ===== Modal Nuevo Proceso =====
  function openProcesoModal() {
    const modal = document.querySelector(SEL.modalP);
    const content = modal?.querySelector(".modal-content");
    if (!modal || !content) {
      const titulo = window.prompt("Título / Descripción del nuevo proceso:");
      if (!titulo) return;
      makeProcesoFromAPI(titulo);
      return;
    }

    const form = document.querySelector(SEL.formP);
    form && form.reset();
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
        { capture: true }
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
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const titulo = ($(SEL.inpPTitulo)?.value || "").trim();
      if (!titulo) {
        toast("Escribe un título para el proceso.", "warning");
        $(SEL.inpPTitulo)?.focus();
        return;
      }
      await makeProcesoFromAPI(titulo);

      const modal = document.querySelector(SEL.modalP);
      if (modal) closeOverlay(modal);
    });
  }
  async function makeProcesoFromAPI(titulo) {
    const req = window.__REQ__;
    if (!req?.id) {
      toast("No hay requerimiento cargado.", "danger");
      return;
    }
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
    } catch (e) {
      err("createProceso error:", e);
      toast(e?.message || "No se pudo crear el proceso.", "danger");
    }
  }

  // ===== Toolbar (botones principales) =====
  function bindToolbar() {
    if (_boundToolbar) return;

    const btnProceso = document.querySelector(SEL.toolbar.addProceso);
    const btnTarea = document.querySelector(SEL.toolbar.addTarea);

    //const PRES_DEPT_IDS = [6]; // Presidencia

    // el if de presidencia por si acaso lo dejo
    //if (PRES_DEPT_IDS.includes(deptId) && !isAdmin) {
    //  if (btnProceso) btnProceso.style.display = "none";
    //  if (btnTarea) btnTarea.style.display = "none";
    //  _boundToolbar = true;
    //  console.log(
    //    "[Planeación] Toolbar oculta para Presidencia sin rol ADMIN (dept:",
    //    deptId,
    //    ")"
    //  );
    //  return;
    //}

    btnProceso?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openProcesoModal();
    });

    btnTarea?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const procesos = collectProcesos();
      if (procesos.length === 0) {
        toast("Primero crea un proceso.", "warning");
        return;
      }
      const prefer =
        procesos.length === 1
          ? procesos[0].getAttribute("data-proceso-id")
          : null;
      openTareaModal({ preferProcesoId: prefer });
    });

    _boundToolbar = true;
    log("Toolbar enlazada");
  }

  // ===== API pública =====
  window.Planeacion = {
    async init() {
      $$("#planeacion-list .exp-accordion--fase").forEach(bindProcessAccordion);
      bindToolbar();

      // Actualizar planeación y toolbar CADA vez que llegue un req
      document.addEventListener(
        "req:loaded",
        async (e) => {
          const req = e?.detail || window.__REQ__;
          if (!req?.id) return;

          updateToolbarForReq(req);
          await renderProcesosYtareas(Number(req.id));
        },
        { passive: true }
      );

      // Fallback si __REQ__ ya está listo al cargar este JS
      if (window.__REQ__?.id) {
        updateToolbarForReq(window.__REQ__);
        await renderProcesosYtareas(Number(window.__REQ__.id));
      }

      log("init OK (API conectada)");
    },
    reload: async () => {
      const req = window.__REQ__;
      if (req?.id) {
        updateToolbarForReq(req);
        await renderProcesosYtareas(Number(req.id));
      }
    },
  };

  // ==== AUTO-INIT ====
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => window.Planeacion.init(),
      { once: true }
    );
  } else {
    window.Planeacion.init();
  }
})();

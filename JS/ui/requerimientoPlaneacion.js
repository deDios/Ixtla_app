// /JS/ui/requerimientoPlaneacion.js
(function () {
  "use strict";

  // ===== Helpers (desde requerimientoView o fallback) =====
  const H = window._rvHelpers || {};
  const $  = H.$  || ((s, r=document)=>r.querySelector(s));
  const $$ = H.$$ || ((s, r=document)=>Array.from(r.querySelectorAll(s)));
  const toast = H.toast || ((m,t="info")=>console.log("[toast]", t, m));
  const setAccordionOpen = window.setAccordionOpen || ((h,b,open)=>{ b.hidden=!open; });

  const TAG  = "[Planeación]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);
  const err  = (...a)=>console.error(TAG, ...a);

  // ===== Selectores / referencias de UI =====
  const SEL = {
    toolbar: {
      addProceso: "#btn-add-proceso",
      addTarea:   "#btn-add-tarea",
    },
    planeacionList: "#planeacion-list",

    // Modal Nueva Tarea
    modalT:        "#modal-tarea",
    formT:         "#form-tarea",
    selProceso:    "#tarea-proceso",
    inpTitulo:     "#tarea-titulo",
    inpEsfuerzo:   "#tarea-esfuerzo",
    inpAsignado:   "#tarea-asignado",  // <select id="tarea-asignado">
    txtDesc:       "#tarea-desc",

    // Modal Nuevo Proceso
    modalP:        "#modal-proceso",
    formP:         "#form-proceso",
    inpPTitulo:    "#proceso-titulo",
    inpPInicio:    "#proceso-inicio",
  };

  // ===== Estado interno / flags =====
  let _boundToolbar = false;
  let _boundModalT  = false;
  let _boundModalP  = false;

  // ====== API endpoints (fallback locales por si no tienes import) ======
  const API_FBK = {
    PROCESOS: {
      CREATE: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_i_proceso_requerimiento.php",
      UPDATE: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_u_proceso_requerimiento.php",
      LIST:   "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_proceso_requerimiento.php",
    },
    TAREAS: {
      CREATE: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_i_tarea_proceso.php",
      UPDATE: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_u_tarea_proceso.php",
      LIST:   "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_tarea_proceso.php",
    },
    EMPLEADOS: {
      // ajusta si tu endpoint se llama distinto
      LIST:   "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_empleado.php",
    }
  };
  const API = (window.API || API_FBK);

  async function postJSON(url, body) {
    const group = `[HTTP][Planeación] ${url}`;
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

  // ===== Session helper (mismo patrón que requerimientoView.safeGetSession)
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
  function getRolesUp() {
    const s = safeGetSession();
    const r = Array.isArray(s?.roles) ? s.roles : [];
    return r.map(x => String(x).toUpperCase());
  }
  function getNombreSesion() {
    const s = safeGetSession();
    return [s?.nombre, s?.apellidos].filter(Boolean).join(" ").trim() || "Yo";
  }

  // ===== Utilidades varias =====
  function collectProcesos() {
    return $$('#planeacion-list .exp-accordion--fase[data-proceso-id]');
  }

  function todayISO() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function fmtMXDate(s) {
    if (!s) return "—";
    const parts = String(s).slice(0, 19).replace("T"," ").split(" ")[0].split("-");
    if (parts.length !== 3) return s;
    const [Y,M,D] = parts;
    return `${D}/${M}/${Y}`;
  }

  // ====== LAYER: Procesos / Tareas (LIST / CREATE) ======
  async function listProcesos(requerimiento_id, { status=1, page=1, page_size=100 } = {}) {
    const payload = { requerimiento_id: Number(requerimiento_id), status, page, page_size };
    const j = await postJSON(API.PROCESOS.LIST, payload);
    const arr = Array.isArray(j?.data) ? j.data : [];
    return arr.map(normalizeProceso);
  }
  async function createProceso({ requerimiento_id, descripcion, empleado_id, created_by }) {
    const payload = {
      requerimiento_id: Number(requerimiento_id),
      empleado_id: empleado_id ?? null,
      descripcion: String(descripcion || "").trim(),
      status: 1,
      created_by: created_by ?? empleado_id ?? null
    };
    return postJSON(API.PROCESOS.CREATE, payload);
  }

  async function listTareas(proceso_id, { status=1, page=1, page_size=100 } = {}) {
    const payload = { proceso_id: Number(proceso_id), status, page, page_size };
    const j = await postJSON(API.TAREAS.LIST, payload);
    const arr = Array.isArray(j?.data) ? j.data : [];
    return arr.map(normalizeTarea);
  }
  
  async function createTarea({ proceso_id, titulo, esfuerzo, asignado_a, descripcion, fecha_inicio, fecha_fin, created_by }) {
    const payload = {
      proceso_id: Number(proceso_id),
      asignado_a: asignado_a != null ? Number(asignado_a) : null,
      titulo: String(titulo || "").trim(),
      descripcion: String(descripcion || "").trim() || null,
      esfuerzo: Number(esfuerzo),
      fecha_inicio: fecha_inicio || null,
      fecha_fin: fecha_fin || null,
      status: 1,
      created_by: created_by ?? asignado_a ?? null
    };
    return postJSON(API.TAREAS.CREATE, payload);
  }

  // ===== Normalizadores =====
  function normalizeProceso(r = {}) {
    return {
      id: Number(r.id),
      reqId: Number(r.requerimiento_id),
      empleado_id: r.empleado_id != null ? Number(r.empleado_id) : null,
      empleado_display: r.empleado_display || [r.empleado_nombre, r.empleado_apellidos].filter(Boolean).join(" ") || "—",
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
      asignado_display: r.asignado_display || [r.asignado_nombre, r.asignado_apellidos].filter(Boolean).join(" ") || "—",
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

  // ====== Pintado de UI (reutiliza tu markup) ======
  function bindProcessAccordion(sec) {
    const head = sec.querySelector(".exp-acc-head");
    const body = sec.querySelector(".exp-acc-body");
    const chev = head?.querySelector(".chev");
    if (!head || !body || !chev) return;

    const initOpen = head.getAttribute("aria-expanded") === "true";
    body.hidden = !initOpen; if (!initOpen) body.style.height = "0px";

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

  function escapeHtml(s="") {
    return String(s)
      .replaceAll("&","&amp;").replaceAll("<","&lt;")
      .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  function addTareaRow(sec, t) {
    const table = sec.querySelector(".exp-table--planeacion");
    if (!table) return;

    const row = document.createElement("div");
    row.className = "exp-row";

    // Estatus visual de tarea
    let badgeClass = "is-info";
    let badgeText  = "Por hacer";
    if (t.fecha_fin) { badgeClass = "is-success"; badgeText = "Finalizado"; }
    else if (t.fecha_inicio) { badgeClass = "is-info"; badgeText = "Activo"; }

    const pct = t.fecha_fin ? 100 : (t.fecha_inicio ? 50 : 0);

    row.innerHTML = `
      <div class="actividad">${escapeHtml(t.titulo)}</div>
      <div class="responsable">${escapeHtml(t.asignado_display || "—")}</div>
      <div class="estatus"><span class="exp-badge ${badgeClass}">${badgeText}</span></div>
      <div class="porcentaje"><span class="exp-progress xs"><span class="bar" style="width:${pct}%"></span></span></div>
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
    const done  = tareas.filter(t => !!t.fecha_fin).length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    meta.textContent = `${total} ${total === 1 ? "actividad" : "actividades"}`;
    pctBar.style.width = `${pct}%`;
    pctTxt.textContent = `${pct}%`;
    pctBar.parentElement?.setAttribute("aria-label", `${pct}%`);
  }

  // ===== Carga/Render: Procesos + Tareas
  async function renderProcesosYtareas(requerimiento_id) {
    const host = $(SEL.planeacionList);
    if (!host) return;

    host.innerHTML = "";

    try {
      const procesos = await listProcesos(requerimiento_id, { status: 1, page: 1, page_size: 100 });

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
          const tareas = await listTareas(p.id, { status: 1, page: 1, page_size: 100 });
          tareas.forEach(t => addTareaRow(sec, t));
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

  /* =====================================================================================
   * RBAC + Empleados (para el <select id="tarea-asignado">)
   * ===================================================================================*/

  // Lista de empleados con aliases robustos para jerarquía
  async function fetchEmpleadosAll({ page=1, page_size=500 } = {}) {
    console.groupCollapsed(`${TAG} [RBAC] fetchEmpleadosAll`);
    try {
      const j = await postJSON(API.EMPLEADOS.LIST, { page, page_size, status: 1 });
      const arr = Array.isArray(j?.data) ? j.data : [];
      const mapped = arr.map(e => {
        const depId =
          e.departamento_id ?? e.depto_id ?? e.id_departamento ?? null;

        // Alias para “reporta a”
        const repA =
          e.reporta_a ?? e.cuenta_reporta_a ?? e.jefe_id ?? e.superior_id ??
          e.reporta ?? e.manager_id ?? e.id_jefe ?? null;

        return {
          id: Number(e.id),
          nombre: String(e.nombre || "").trim(),
          apellidos: String(e.apellidos || "").trim(),
          departamento_id: depId != null ? Number(depId) : null,
          reporta_a: repA != null ? Number(repA) : null,
          display: [e.nombre, e.apellidos].filter(Boolean).join(" ").trim() || `Empleado #${e.id}`
        };
      });

      console.log("Total empleados en universo:", mapped.length);
      console.log("Muestra (5):", mapped.slice(0,5));
      console.groupEnd();
      return mapped;
    } catch (e) {
      console.groupEnd();
      warn("No se pudo listar empleados:", e);
      return [];
    }
  }

  function unionById(a = [], b = []) {
    const map = new Map();
    a.forEach(x => x?.id && map.set(Number(x.id), x));
    b.forEach(x => x?.id && map.set(Number(x.id), x));
    return Array.from(map.values());
  }

  // Cadena de reportes transitiva
  function getReportsTransitive(universe, managerId) {
    const byBoss = new Map();
    for (const e of universe) {
      const key = Number(e.reporta_a ?? -1);
      if (!byBoss.has(key)) byBoss.set(key, []);
      byBoss.get(key).push(e);
    }
    const out = [];
    const seen = new Set();
    const q = [Number(managerId)];
    while (q.length) {
      const boss = q.shift();
      const directs = byBoss.get(boss) || [];
      for (const emp of directs) {
        const k = Number(emp.id);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(emp);
        q.push(k);
      }
    }
    return out;
  }

  function readRBACFlags() {
    const rolesUp = getRolesUp();
    const deptId  = getDeptId();
    const yoId    = getEmpleadoId();

    const isAdmin = rolesUp.includes("ADMIN");
    const isPres  = (deptId != null && Number(deptId) === 6) || rolesUp.includes("PRESIDENCIA");
    const isDir   = rolesUp.includes("DIRECTOR");
    const soyPL   = rolesUp.includes("PRIMERA_LINEA") || rolesUp.includes("PRIMERA LINEA") || rolesUp.includes("PRIMERA-LINEA");
    const isJefe  = rolesUp.includes("JEFE");
    const isAnal  = rolesUp.includes("ANALISTA");

    console.groupCollapsed(`${TAG} [RBAC] flags`);
    console.log("roles:", rolesUp);
    console.log("deptId:", deptId, "yoId:", yoId);
    console.log({ isAdmin, isPres, isDir, soyPL, isJefe, isAnal });
    console.groupEnd();

    return { rolesUp, deptId, yoId, isAdmin, isPres, isDir, soyPL, isJefe, isAnal };
  }

  async function setupAsignadoOptions(selectEl) {
    if (!selectEl) return;

    const { rolesUp, deptId, yoId, isAdmin, isPres, isDir, soyPL, isJefe, isAnal } = readRBACFlags();
    const yoName = getNombreSesion();

    const universe = await fetchEmpleadosAll();
    console.groupCollapsed(`${TAG} [RBAC] universo`);
    console.log("universe total:", universe.length);
    console.log("yoId:", yoId, "yoName:", yoName, "deptId:", deptId);
    console.groupEnd();

    let visibles = [];
    if (isAdmin || isPres) {
      visibles = universe.slice();
      console.log(`${TAG} [RBAC] modo ADMIN/PRESIDENCIA → todo el universo (${visibles.length})`);
    } else if (isDir || soyPL) {
      const sameDept = universe.filter(e => Number(e.departamento_id) === Number(deptId));
      const reports  = getReportsTransitive(universe, yoId);
      visibles = unionById(sameDept, reports);
      console.log(`${TAG} [RBAC] modo DIRECTOR/PRIMERA_LINEA → depto(${sameDept.length}) + reports(${reports.length}) = ${visibles.length}`);
      if (!visibles.some(e => Number(e.id) === Number(yoId))) {
        visibles.unshift({ id: yoId, display: yoName, departamento_id: deptId, reporta_a: null });
      }
    } else if (isJefe) {
      const reports = getReportsTransitive(universe, yoId);
      if (reports.length) {
        visibles = unionById(reports, [{ id: yoId, display: yoName, departamento_id: deptId, reporta_a: null }]);
        console.log(`${TAG} [RBAC] modo JEFE → reports(${reports.length}) + yo(1) = ${visibles.length}`);
      } else {
        const sameDept = universe.filter(e => Number(e.departamento_id) === Number(deptId));
        visibles = unionById(sameDept, [{ id: yoId, display: yoName, departamento_id: deptId, reporta_a: null }]);
        console.log(`${TAG} [RBAC] modo JEFE (sin reports) → depto(${sameDept.length}) + yo(1) = ${visibles.length}`);
      }
    } else if (isAnal) {
      visibles = [{ id: yoId, display: yoName, departamento_id: deptId, reporta_a: null }];
      console.log(`${TAG} [RBAC] modo ANALISTA → solo yo (1)`);
    } else {
      visibles = [{ id: yoId, display: yoName, departamento_id: deptId, reporta_a: null }];
      console.log(`${TAG} [RBAC] modo RESTO → solo yo (1)`);
    }

    visibles.sort((a, b) => a.display.localeCompare(b.display, "es"));

    // Poblado del select
    selectEl.innerHTML = "";
    const optP = document.createElement("option");
    optP.value = "";
    optP.disabled = true;
    optP.selected = true;
    optP.textContent = "Selecciona responsable…";
    selectEl.appendChild(optP);

    for (const e of visibles) {
      const op = document.createElement("option");
      op.value = String(e.id);
      op.textContent = e.display || `Empleado #${e.id}`;
      selectEl.appendChild(op);
    }

    // Forzar selección y bloqueo para ANALISTA
    if (isAnal && yoId != null) {
      selectEl.value = String(yoId);
      selectEl.disabled = true;
      console.log(`${TAG} [RBAC] ANALISTA: select bloqueado en id=${yoId}`);
    } else {
      selectEl.disabled = false;
    }

    console.groupCollapsed(`${TAG} [RBAC] resumen visibles`);
    console.table(visibles.slice(0, 10));
    console.log(`Total visibles: ${visibles.length}`);
    console.groupEnd();
  }

  // ===== Modal Nueva Tarea =====
  function openTareaModal({ preferProcesoId = null } = {}) {
    const modal = document.querySelector(SEL.modalT);
    const modalContent = modal?.querySelector(".modal-content");
    if (!modal || !modalContent) return;

    fillProcesoSelect(preferProcesoId);
    const form = document.querySelector(SEL.formT);
    form && form.reset();

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("me-modal-open");

    // Poblamos el combo de asignados según RBAC (cada apertura, por si cambió sesión)
    const selAsignado = $(SEL.inpAsignado);
    setupAsignadoOptions(selAsignado).catch(e => warn("setupAsignadoOptions error:", e));

    if (!_boundModalT) {
      modal.addEventListener("click", (e)=>{ if (e.target === modal) closeTareaModal(); });
      modalContent.addEventListener("click", (e)=>{ if (e.target.closest(".modal-close")) closeTareaModal(); }, { capture: true });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.classList.contains("open")) closeTareaModal();
      });
      bindSubmitNuevaTarea();
      _boundModalT = true;
    }

    setTimeout(() => $(SEL.selProceso)?.focus(), 30);
  }
  function closeTareaModal() {
    const modal = document.querySelector(SEL.modalT);
    if (!modal) return;
    modal.classList.remove("open", "active");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("me-modal-open");
  }
  function fillProcesoSelect(preferId = null) {
    const sel = $(SEL.selProceso); if (!sel) return;
    sel.innerHTML = '<option value="" disabled selected>Selecciona un proceso…</option>';
    const procesos = collectProcesos();
    procesos.forEach((sec) => {
      const id = sec.getAttribute('data-proceso-id');
      const title = sec.querySelector('.fase-title')?.textContent?.trim() || `Proceso`;
      const opt = document.createElement('option');
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
      const titulo    = ($(SEL.inpTitulo)?.value || "").trim();
      const esfuerzo  = Number($(SEL.inpEsfuerzo)?.value || 0);
      const asignadoIdStr = ($(SEL.inpAsignado)?.value || "").trim(); // ahora es <select>: viene ID
      const desc      = ($(SEL.txtDesc)?.value || "").trim();

      if (!procesoId) { toast("Selecciona un proceso.", "warning"); $(SEL.selProceso)?.focus(); return; }
      if (!titulo)    { toast("Escribe un título.", "warning"); $(SEL.inpTitulo)?.focus(); return; }
      if (!(esfuerzo > 0)) { toast("Define el esfuerzo (mínimo 1).", "warning"); $(SEL.inpEsfuerzo)?.focus(); return; }

      const empleadoId = getEmpleadoId();
      const asignado_id = asignadoIdStr ? Number(asignadoIdStr) : null;

      console.groupCollapsed(`${TAG} submit Tarea`);
      console.log("payload (prev):", { procesoId, titulo, esfuerzo, asignado_id, desc, empleadoId });
      console.groupEnd();

      try {
        const res = await createTarea({
          proceso_id: Number(procesoId),
          titulo,
          esfuerzo,
          asignado_a: asignado_id,        // ← ahora sí mandamos el ID seleccionado
          descripcion: desc || null,
          fecha_inicio: null, 
          fecha_fin: null,
          created_by: empleadoId ?? asignado_id ?? null
        });
        if (res?.ok === false) throw new Error(res?.error || "No se pudo crear la tarea");
        toast("Tarea creada", "success");
        closeTareaModal();

        // refrescar solo ese proceso
        const sec = $(`#planeacion-list .exp-accordion--fase[data-proceso-id="${CSS.escape(String(procesoId))}"]`);
        if (sec) {
          const tareas = await listTareas(Number(procesoId), { status:1, page:1, page_size:100 });
          sec.querySelectorAll(".exp-table--planeacion .exp-row").forEach(r => r.remove());
          tareas.forEach(t => addTareaRow(sec, t));
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

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("me-modal-open");

    if (!_boundModalP) {
      modal.addEventListener("click", (e)=>{ if (e.target === modal) closeProcesoModal(); });
      content.addEventListener("click", (e)=>{ if (e.target.closest(".modal-close")) closeProcesoModal(); }, { capture: true });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.classList.contains("open")) closeProcesoModal();
      });
      bindSubmitNuevoProceso();
      _boundModalP = true;
    }

    setTimeout(() => $(SEL.inpPTitulo)?.focus(), 30);
  }
  function closeProcesoModal() {
    const modal = document.querySelector(SEL.modalP);
    if (!modal) return;
    modal.classList.remove("open", "active");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("me-modal-open");
  }
  function bindSubmitNuevoProceso() {
    const form = document.querySelector(SEL.formP);
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const titulo = ($(SEL.inpPTitulo)?.value || "").trim();
      if (!titulo) { toast("Escribe un título para el proceso.", "warning"); $(SEL.inpPTitulo)?.focus(); return; }
      await makeProcesoFromAPI(titulo);
      closeProcesoModal();
    });
  }
  async function makeProcesoFromAPI(titulo) {
    const req = window.__REQ__;
    if (!req?.id) { toast("No hay requerimiento cargado.", "danger"); return; }
    const empleadoId = getEmpleadoId();

    try {
      const res = await createProceso({
        requerimiento_id: Number(req.id),
        descripcion: titulo,
        empleado_id: empleadoId ?? null,
        created_by: empleadoId ?? null
      });
      if (res?.ok === false) throw new Error(res?.error || "No se pudo crear el proceso");
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
    const btnTarea   = document.querySelector(SEL.toolbar.addTarea);

    btnProceso?.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      openProcesoModal();
    });

    btnTarea?.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const procesos = collectProcesos();
      if (procesos.length === 0) {
        toast("Primero crea un proceso.", "warning");
        return;
      }
      const prefer = (procesos.length === 1) ? (procesos[0].getAttribute("data-proceso-id")) : null;
      openTareaModal({ preferProcesoId: prefer });
    });

    _boundToolbar = true;
    log("Toolbar enlazada");
  }

  // ===== API pública =====
  window.Planeacion = {
    async init() {
      $$('#planeacion-list .exp-accordion--fase').forEach(bindProcessAccordion);
      bindToolbar();

      document.addEventListener("req:loaded", async (e) => {
        const req = e?.detail || window.__REQ__;
        if (!req?.id) return;
        await renderProcesosYtareas(Number(req.id));
      }, { once: true });

      if (window.__REQ__?.id) {
        await renderProcesosYtareas(Number(window.__REQ__.id));
      }
      log("init OK (API conectada)");
    },
    reload: async () => {
      const req = window.__REQ__; if (!req?.id) return;
      await renderProcesosYtareas(Number(req.id));
    }
  };

})();

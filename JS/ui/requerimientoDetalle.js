// /JS/ui/requerimientoDetalle.js
(function () {
  "use strict";

  const TAG = "[ReqDetalle]";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const log = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);
  const err = (...a) => console.error(TAG, ...a);
  const toast = (m, t = "info") =>
    window.gcToast ? gcToast(m, t) : log("[toast]", t, m);

  const norm = (s = "") =>
    String(s)
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();

  /* =========================
   * Endpoints
   * ========================= */
  const ENDPOINTS = {
    EMPLEADOS_LIST:
      "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_empleado.php",
    DEPTS_LIST:
      "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php",
    REQ_UPDATE: "/db/WEB/ixtla01_upd_requerimiento.php",
    CCP_LIST: "https://ixtla-app.com/db/web/ixtla01_c_ccp.php",
    // Catálogo de trámites (para editar "Trámite")
    TRAMITES_LIST:
      "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/ixtla01_c_tramite.php",
  };

  async function postJSON(url, body) {
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
    } catch {
      json = { raw: txt };
    }

    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
    if (json?.ok === false)
      throw new Error(json?.error || "Operación no exitosa");

    return json ?? {};
  }

  /* =========================
   * Session helpers
   * ========================= */

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
    return s?.empleado_id ?? s?.id_empleado ?? null;
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
   * RBAC empleados (para modal Asignar)
   * ========================= */

  function normalizeEmpleadoFromAPI(r = {}) {
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
      full:
        [r.nombre, r.apellidos].filter(Boolean).join(" ").trim() ||
        `Empleado #${r.id}`,
      departamento_id:
        r.departamento_id != null ? Number(r.departamento_id) : null,
      reporta_a: reporta_a != null ? Number(reporta_a) : null,
      rolCodes,
    };
  }

  async function fetchEmpleadosAll() {
    const j = await postJSON(ENDPOINTS.EMPLEADOS_LIST, {
      page: 1,
      page_size: 500,
      status: 1,
    });
    const arr = Array.isArray(j?.data) ? j.data : [];
    return arr.map(normalizeEmpleadoFromAPI);
  }

  async function fetchDepartamentosRBAC() {
    const j = await postJSON(ENDPOINTS.DEPTS_LIST, {
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
      director_nombre: String(d.director_nombre || ""),
      director_apellidos: String(d.director_apellidos || ""),
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
    const yoId = Number(getEmpleadoId());
    const deptId = Number(getDeptId());
    const roles = getRoles();
    const isAdmin = roles.includes("ADMIN");
    const isDirector = roles.includes("DIRECTOR");
    const isPL =
      roles.includes("PRIMERA_LINEA") ||
      roles.includes("PL") ||
      roles.includes("PRIMERA LINEA");
    const isJefe = roles.includes("JEFE");

    const universe = await fetchEmpleadosAll();
    if (isAdmin) return universe;

    const PRES_DEPT_IDS = [6];
    if (PRES_DEPT_IDS.includes(deptId)) return universe;

    if (isDirector || isPL) {
      const depts = await fetchDepartamentosRBAC();
      const visibleDeptIds = new Set(
        depts
          .filter((d) => d.director === yoId || d.primera_linea === yoId)
          .map((d) => d.id)
      );
      if (deptId) visibleDeptIds.add(deptId);

      const inDepts = universe.filter((e) =>
        visibleDeptIds.has(Number(e.departamento_id))
      );
      const reports = getReportesTransitivos(universe, yoId);
      const self = universe.find((e) => e.id === yoId);

      const map = new Map();
      [...inDepts, ...reports, ...(self ? [self] : [])].forEach((e) =>
        map.set(e.id, e)
      );

      return Array.from(map.values());
    }

    if (isJefe) {
      const self = universe.find((e) => e.id === yoId);
      const direct = universe.filter((e) => e.reporta_a === yoId);
      const map = new Map();
      if (self) map.set(self.id, self);
      direct.forEach((e) => map.set(e.id, e));
      return Array.from(map.values());
    }

    const self = universe.find((e) => e.id === yoId);
    return self ? [self] : [];
  }

  /* =========================
   * Departamentos (para Director + nombre)
   * ========================= */

  async function fetchDeptsWithFallback() {
    const payload = { page: 1, page_size: 200, status: 1 };
    const urls = [
      ENDPOINTS.DEPTS_LIST,
      "/db/WEB/ixtla01_c_departamento.php", // relativo para dev
    ];

    for (const url of urls) {
      try {
        const res = await postJSON(url, payload);
        const arr = Array.isArray(res?.data) ? res.data : [];
        if (arr.length) return arr;
      } catch (e) {
        warn("[Dept] fallo endpoint:", url, e);
      }
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
      director_id: dept.director != null ? Number(dept.director) : null,
      director_nombre: String(dept.director_nombre || ""),
      director_apellidos: String(dept.director_apellidos || ""),
    };

    const fullDir = [info.director_nombre, info.director_apellidos]
      .filter(Boolean)
      .join(" ")
      .trim();

    const director = fullDir ? { id: info.director_id, nombre: fullDir } : null;

    return { dept: { id: info.id, nombre: info.nombre }, director };
  }

  /* =========================
   * Helpers Detalles (grid + filas)
   * ========================= */

  function findDetallesGrid() {
    return (
      $('.exp-pane[role="tabpanel"][data-tab="detalles"] .exp-grid') ||
      $('.exp-pane[role="tabpanel"][data-tab="Detalles"] .exp-grid')
    );
  }

  function findRowByLabel(grid, labels) {
    if (!grid) return null;
    const lowers = labels.map((l) => String(l).toLowerCase());
    return (
      Array.from(grid.querySelectorAll(".exp-field")).find((r) => {
        const t = (r.querySelector("label")?.textContent || "")
          .trim()
          .toLowerCase();
        return lowers.some((lbl) => t.startsWith(lbl));
      }) || null
    );
  }

  /* =========================
   * Pintar TAB "detalles"
   * ========================= */

  function putDetalle(labelStartsWith, value, keyName) {
    const grid = findDetallesGrid();
    if (!grid) return false;

    const row = findRowByLabel(grid, [labelStartsWith]);
    const dd = row?.querySelector(".exp-val");
    if (!dd) return false;

    // Si está en modo edición, no pisar el contenido
    if (dd.dataset.editing === "1") return false;

    let target = null;
    if (keyName) {
      target = dd.querySelector(`[data-detalle-text="${keyName}"]`);
    }
    if (!target) {
      target = dd.querySelector("[data-detalle-text]");
    }

    if (target) {
      target.textContent = value ?? "—";
    } else {
      dd.textContent = value ?? "—";
    }
    return true;
  }

  function attachAsignarButton() {
    const grid = findDetallesGrid();
    if (!grid) return null;

    const row = findRowByLabel(grid, ["asignado"]);
    if (!row) return null;

    const dd = row.querySelector(".exp-val");
    if (!dd) return null;

    if (dd.querySelector('[data-act="assign-req"]')) return dd;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-btn";
    btn.style.marginLeft = "8px";
    btn.setAttribute("title", "Asignar requerimiento");
    btn.setAttribute("aria-label", "Asignar requerimiento");
    btn.dataset.act = "assign-req";
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor"
          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83z"/>
      </svg>
    `;
    dd.appendChild(btn);
    btn.addEventListener("click", openAsignarModal);
    return dd;
  }

  async function paintDetalles(req) {
    log("[Detalles] pintando con req:", req?.id, req);

    // Trámite (antes "Nombre del Requerimiento")
    const tituloReq = req.tramite_nombre || req.asunto || "—";
    // Intentar first "Trámite", luego legacy "Nombre del Requerimiento"
    if (
      !putDetalle("Trámite", tituloReq, "tramite") &&
      !putDetalle("Tramite", tituloReq, "tramite")
    ) {
      putDetalle("Nombre del Requerimiento", tituloReq, "tramite");
    }

    // Departamento + Director
    try {
      const { dept, director } = await getDeptByIdOrName({
        id: req.departamento_id,
        nombre: req.departamento_nombre,
      });

      putDetalle("Director", director?.nombre || "—");

      const depNode = $("#req-departamento");
      if (depNode)
        depNode.textContent = dept?.nombre || req.departamento_nombre || "—";
    } catch (e) {
      warn("[Detalles] error obteniendo departamento/director:", e);
      putDetalle("Director", "—");
    }

    // Asignado
    const asignado =
      req.asignado_id && (req.asignado_full || "").trim()
        ? req.asignado_full
        : "Sin asignar";
    putDetalle("Asignado", asignado);
    attachAsignarButton();

    // Descripción
    putDetalle("Descripción", req.descripcion || "—", "descripcion");

    // Código numérico de estatus
    const est = Number(
      req.estatus_code ??
        req.estatus ??
        (req.raw && req.raw.estatus != null ? req.raw.estatus : 0)
    );

    // Fecha de inicio (solo desde Proceso en adelante)
    let fechaInicio = "—";
    if (est >= 3) {
      const srcInicio =
        req.raw?.fecha_limite || req.creado_at || req.raw?.created_at || "";
      if (srcInicio) fechaInicio = String(srcInicio).split(" ")[0];
    }
    putDetalle("Fecha de inicio", fechaInicio);

    // Fecha de terminado (solo Finalizado)
    let fechaFin = "—";
    if (est === 6) {
      const srcFin = req.cerrado_en || req.raw?.cerrado_en || "";
      if (srcFin) fechaFin = String(srcFin).split(" ")[0];
    }
    putDetalle("Fecha de terminado", fechaFin);
  }

  function resetDetallesSkeleton() {
    const grid = findDetallesGrid();
    if (!grid) return;
    $$(".exp-field .exp-val", grid).forEach((n) => {
      if (n.id === "req-status") return; // NO tocar estatus (lo maneja otro JS)
      if (n.dataset.editing === "1") return;

      const span = n.querySelector("[data-detalle-text]");
      if (span) {
        span.textContent = "—";
      } else if (!n.querySelector("button")) {
        // Solo si no tiene botones fijos
        n.textContent = "—";
      }
    });
  }

  /* =========================
   * Detalles: edición Trámite + Descripción
   * ========================= */

  async function updateReqDetalles(id, changes) {
    const updated_by = getEmpleadoId() ?? null;
    const payload = {
      id: Number(id),
      updated_by,
      ...changes,
    };
    log("[Detalles] updateReqDetalles() payload", payload);
    const res = await postJSON(ENDPOINTS.REQ_UPDATE, payload);
    return res?.data ?? res;
  }

  async function fetchTramitesByDept(departamento_id) {
    const payload = {
      estatus: 1,
      all: true,
    };
    if (departamento_id) payload.departamento_id = Number(departamento_id);

    log("[Trámite] fetchTramitesByDept payload", payload);
    const res = await postJSON(ENDPOINTS.TRAMITES_LIST, payload);
    const arr = Array.isArray(res?.data) ? res.data : [];
    return arr.map((t) => ({
      id: Number(t.id),
      nombre: String(t.nombre || "").trim(),
      descripcion: String(t.descripcion || "").trim(),
    }));
  }

  async function openTramiteEditor(req) {
    const grid = findDetallesGrid();
    if (!grid) return;
    const row = findRowByLabel(grid, [
      "trámite",
      "tramite",
      "nombre del requerimiento",
    ]);
    if (!row) return;
    const dd = row.querySelector(".exp-val");
    if (!dd) return;

    if (dd.dataset.editing === "1") return;
    dd.dataset.editing = "1";

    const originalHTML = dd.innerHTML;

    const currentName = (req.tramite_nombre || req.asunto || "").trim() || "—";
    const select = document.createElement("select");
    select.className = "exp-input";
    select.setAttribute("aria-label", "Seleccionar trámite");

    const actions = document.createElement("div");
    actions.className = "exp-edit-actions";

    const btnCancel = document.createElement("button");
    btnCancel.type = "button";
    btnCancel.className = "btn-xs";
    btnCancel.textContent = "Cancelar";

    const btnSave = document.createElement("button");
    btnSave.type = "button";
    btnSave.className = "btn-xs primary";
    btnSave.textContent = "Guardar";

    actions.appendChild(btnCancel);
    actions.appendChild(btnSave);

    dd.innerHTML = "";
    dd.appendChild(select);
    dd.appendChild(actions);

    const restoreView = (mergedReq) => {
      dd.innerHTML = originalHTML;
      delete dd.dataset.editing;

      const finalReq = mergedReq || req;

      // Actualizamos solo el span del trámite
      const span = dd.querySelector('[data-detalle-text="tramite"]');
      const val = finalReq.tramite_nombre || finalReq.asunto || "—";
      if (span) span.textContent = val;

      // Re-wire de botones
      setupDetallesEditors(finalReq);
    };

    btnCancel.addEventListener("click", () => {
      restoreView(req);
    });

    try {
      const tramites = await fetchTramitesByDept(req.departamento_id);
      if (!tramites.length) {
        toast("No se encontraron trámites para este departamento.", "warning");
        restoreView(req);
        return;
      }

      // Llenar opciones
      const opt0 = document.createElement("option");
      opt0.value = "";
      opt0.disabled = true;
      opt0.textContent = "Selecciona un trámite…";
      select.appendChild(opt0);

      let selectedId = req.tramite_id != null ? Number(req.tramite_id) : null;

      tramites.forEach((t) => {
        const o = document.createElement("option");
        o.value = String(t.id);
        o.textContent = t.nombre || `Trámite #${t.id}`;
        select.appendChild(o);
      });

      if (selectedId) {
        select.value = String(selectedId);
      } else {
        // Intento por nombre actual
        const match = tramites.find(
          (t) =>
            t.nombre.toLowerCase() === currentName.toLowerCase() ||
            t.nombre.toLowerCase().startsWith(currentName.toLowerCase())
        );
        if (match) select.value = String(match.id);
        else select.value = "";
      }
    } catch (e) {
      warn("[Trámite] error cargando trámites:", e);
      toast("No se pudieron cargar los trámites.", "danger");
      restoreView(req);
      return;
    }

    btnSave.addEventListener("click", async () => {
      const val = select.value;
      if (!val) {
        select.focus();
        return;
      }

      const newId = Number(val);
      const selectedOpt = select.querySelector(
        `option[value="${CSS.escape(String(newId))}"]`
      );
      const newName = selectedOpt?.textContent || `Trámite #${newId}`;

      const originalId = req.tramite_id != null ? Number(req.tramite_id) : null;
      const originalName =
        (req.tramite_nombre || req.asunto || "").trim() || "";

      if (newId === originalId || newName === originalName) {
        restoreView(req);
        return;
      }

      btnSave.disabled = true;
      btnSave.textContent = "Guardando…";

      try {
        // Actualizamos tramite_id y de paso asunto para mantener título consistente
        await updateReqDetalles(req.id, {
          tramite_id: newId,
          asunto: newName,
        });

        toast("Trámite actualizado correctamente.", "success");

        const merged = {
          ...req,
          tramite_id: newId,
          tramite_nombre: newName,
          asunto: newName,
        };

        if (window.__REQ__ && String(window.__REQ__.id) === String(req.id)) {
          window.__REQ__ = { ...window.__REQ__, ...merged };
        }

        // Actualizamos el título principal
        const h1 = $(".exp-title h1");
        if (h1) h1.textContent = newName || "Requerimiento";

        restoreView(merged);
      } catch (e) {
        err("[Trámite] error al actualizar trámite:", e);
        toast("No se pudo actualizar el trámite.", "danger");
        btnSave.disabled = false;
        btnSave.textContent = "Guardar";
      }
    });
  }

  function openDescripcionEditor(req) {
    const grid = findDetallesGrid();
    if (!grid) return;
    const row = findRowByLabel(grid, ["descripción", "descripcion"]);
    if (!row) return;
    const dd = row.querySelector(".exp-val");
    if (!dd) return;

    if (dd.dataset.editing === "1") return;
    dd.dataset.editing = "1";

    const originalHTML = dd.innerHTML;

    const spanCurrent = dd.querySelector('[data-detalle-text="descripcion"]');
    const currentFromDOM =
      (spanCurrent?.textContent || "").trim() || req.descripcion || "";

    dd.innerHTML = "";

    const textarea = document.createElement("textarea");
    textarea.className = "exp-input exp-textarea";
    textarea.rows = 3;
    textarea.value = currentFromDOM;
    textarea.placeholder = "Escribe la descripción…";

    const actions = document.createElement("div");
    actions.className = "exp-edit-actions";

    const btnCancel = document.createElement("button");
    btnCancel.type = "button";
    btnCancel.className = "btn-xs";
    btnCancel.textContent = "Cancelar";

    const btnSave = document.createElement("button");
    btnSave.type = "button";
    btnSave.className = "btn-xs primary";
    btnSave.textContent = "Guardar";

    actions.appendChild(btnCancel);
    actions.appendChild(btnSave);

    dd.appendChild(textarea);
    dd.appendChild(actions);

    const restoreView = (mergedReq) => {
      dd.innerHTML = originalHTML;
      delete dd.dataset.editing;

      const finalReq = mergedReq || req;
      const span = dd.querySelector('[data-detalle-text="descripcion"]');
      if (span) span.textContent = finalReq.descripcion || "—";

      setupDetallesEditors(finalReq);
    };

    btnCancel.addEventListener("click", () => {
      restoreView(req);
    });

    btnSave.addEventListener("click", async () => {
      const newVal = (textarea.value || "").trim();
      const originalVal = (req.descripcion || "").trim();

      if (newVal === originalVal) {
        restoreView(req);
        return;
      }

      btnSave.disabled = true;
      btnSave.textContent = "Guardando…";

      try {
        await updateReqDetalles(req.id, { descripcion: newVal });
        toast("Descripción actualizada correctamente.", "success");

        const merged = { ...req, descripcion: newVal };

        if (window.__REQ__ && String(window.__REQ__.id) === String(req.id)) {
          window.__REQ__ = { ...window.__REQ__, descripcion: newVal };
        }

        restoreView(merged);
      } catch (e) {
        err("[Descripción] error al actualizar:", e);
        toast("No se pudo actualizar la descripción.", "danger");
        btnSave.disabled = false;
        btnSave.textContent = "Guardar";
      }
    });
  }

  function setupDetallesEditors(req) {
    const grid = findDetallesGrid();
    if (!grid) return;

    // Trámite
    const rowTramite = findRowByLabel(grid, [
      "trámite",
      "tramite",
      "nombre del requerimiento",
    ]);
    if (rowTramite) {
      const btn = rowTramite.querySelector(
        'button.icon-btn[data-detalle-edit="tramite"]'
      );
      if (btn && !btn._bound) {
        btn._bound = true;
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          openTramiteEditor(req || window.__REQ__ || {});
        });
      }
    }

    // Descripción
    const rowDesc = findRowByLabel(grid, ["descripción", "descripcion"]);
    if (rowDesc) {
      const btn = rowDesc.querySelector(
        'button.icon-btn[data-detalle-edit="descripcion"]'
      );
      if (btn && !btn._bound) {
        btn._bound = true;
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          openDescripcionEditor(req || window.__REQ__ || {});
        });
      }
    }
  }

  /* =========================
   * CCP (Motivo de Pausa / Cancelación)
   * ========================= */

  function getMotivoElements() {
    const field = document.getElementById("req-motivo-field");
    const wrap = document.getElementById("req-motivo-wrap");

    if (!field || !wrap) {
      warn("[CCP] getMotivoElements(): faltan nodos", {
        field: !!field,
        wrap: !!wrap,
      });
      return null;
    }

    return { field, wrap };
  }

  async function fetchCCPByReqId(
    requerimiento_id,
    { tipo = null, status = null } = {}
  ) {
    const payload = { requerimiento_id: Number(requerimiento_id) };

    // Solo enviamos filtros si vienen definidos
    if (tipo != null) payload.tipo = Number(tipo);
    if (status != null) payload.status = Number(status);

    log("[CCP] fetchCCPByReqId → payload", payload);

    const res = await postJSON(ENDPOINTS.CCP_LIST, payload);

    log("[CCP] fetchCCPByReqId → respuesta cruda", res);

    // Puede venir como objeto o como arreglo
    let baseArr = [];
    if (Array.isArray(res?.data)) {
      baseArr = res.data;
    } else if (res?.data && typeof res.data === "object") {
      baseArr = [res.data];
    }

    if (!baseArr.length) {
      warn("[CCP] fetchCCPByReqId → sin registros para req", requerimiento_id);
      return null;
    }

    // Filtro por tipo en el cliente (por si el backend ignora payload.tipo)
    let arr = baseArr;
    if (tipo != null) {
      const filtered = baseArr.filter(
        (item) => Number(item.tipo) === Number(tipo)
      );
      if (filtered.length) {
        arr = filtered;
      } else {
        warn(
          "[CCP] fetchCCPByReqId → sin registros con tipo",
          tipo,
          "uso lista completa"
        );
      }
    }

    // Ordenar por fecha de creación desc (más reciente primero) y, de respaldo, por id desc
    arr.sort((a, b) => {
      const da = Date.parse(a.created_at || "") || 0;
      const db = Date.parse(b.created_at || "") || 0;
      if (db !== da) return db - da; // más nuevo primero
      const ia = Number(a.id) || 0;
      const ib = Number(b.id) || 0;
      return ib - ia;
    });

    // Elegir registro: si se pide status, preferimos ese; si no, el más reciente
    let ccp = null;
    if (status == null) {
      ccp = arr[0];
    } else {
      ccp =
        arr.find((item) => Number(item.status) === Number(status)) || arr[0];
    }

    log("[CCP] fetchCCPByReqId → ccp elegido", ccp);
    return ccp || null;
  }

  async function paintMotivoCCP(req) {
    const els = getMotivoElements();
    if (!els) {
      warn("[CCP] paintMotivoCCP(): no hay elementos en la vista, salgo.");
      return;
    }

    const { field, wrap } = els;

    // El campo SIEMPRE visible
    field.style.display = "";

    const code =
      req && req.estatus_code != null
        ? Number(req.estatus_code)
        : req && req.estatus != null
        ? Number(req.estatus)
        : req && req.raw && req.raw.estatus != null
        ? Number(req.raw.estatus)
        : null;

    log("[CCP] paintMotivoCCP(): estatus detectado", code, "req.id:", req?.id);

    // Si no está Pausado (4) ni Cancelado (5), dejamos el campo visible pero sin motivo
    if (code !== 4 && code !== 5) {
      wrap.textContent = "—";
      log("[CCP] Estatus no requiere motivo, dejo campo visible con '—'.");
      return;
    }

    wrap.textContent = "Cargando motivo…";

    // Mapear estatus → tipo CCP
    // 4 = Pausado  → tipo 1
    // 5 = Cancelado → tipo 2
    const tipoFiltro = code === 4 ? 1 : 2;

    try {
      // status: null → no mandamos filtro al backend;
      // adentro se ordena por fecha y se prefiere status 1 si existe
      const ccp = await fetchCCPByReqId(req.id, {
        tipo: tipoFiltro,
        status: null,
      });
      log("[CCP] paintMotivoCCP(): ccp recibido", ccp);

      if (ccp && ccp.comentario) {
        wrap.textContent = ccp.comentario;
      } else {
        wrap.textContent = "Sin motivo registrado.";
      }
    } catch (e) {
      warn("[CCP] error pintando motivo:", e);
      wrap.textContent = "Sin motivo registrado.";
    }
  }

  /* =========================
   * Modal "Asignar requerimiento"
   * ========================= */

  function ensureAsignarModal() {
    let modal = document.getElementById("modal-asignar-req");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "modal-asignar-req";
    modal.className = "modal-overlay";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="asignar-title">
        <button class="modal-close" type="button" aria-label="Cerrar">×</button>
        <h2 id="asignar-title">Asignar requerimiento</h2>
        <form id="form-asignar-req" novalidate>
          <div class="form-row">
            <label for="asignar-select">Empleado</label>
            <select id="asignar-select" required>
              <option value="" disabled selected>Cargando…</option>
            </select>
          </div>
          <div class="form-row">
            <button type="submit" class="btn-submit">Asignar</button>
          </div>
        </form>
        <p class="modal-note">Se actualizará el responsable del requerimiento.</p>
      </div>`;
    document.body.appendChild(modal);

    const content = modal.querySelector(".modal-content");
    const close = () => {
      modal.setAttribute("aria-hidden", "true");
      modal.classList.remove("open", "active");
      document.body.classList.remove("me-modal-open");
    };

    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
    content.querySelector(".modal-close")?.addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("open")) close();
    });

    return modal;
  }

  async function openAsignarModal() {
    const modal = ensureAsignarModal();
    const form = modal.querySelector("#form-asignar-req");
    const sel = modal.querySelector("#asignar-select");

    sel.innerHTML = `<option value="" disabled selected>Cargando…</option>`;

    try {
      const visibles = await buildAsignablesList();
      visibles.sort((a, b) => (a.full || "").localeCompare(b.full || "", "es"));

      sel.innerHTML = `<option value="" disabled selected>Selecciona responsable…</option>`;
      for (const emp of visibles) {
        const opt = document.createElement("option");
        opt.value = String(emp.id);
        opt.textContent = emp.full;
        sel.appendChild(opt);
      }

      const roles = getRoles();
      const isAnalista = roles.includes("ANALISTA");
      const yoId = Number(getEmpleadoId());
      if (isAnalista && yoId) {
        sel.value = String(yoId);
        sel.setAttribute("disabled", "true");
        sel.title = "Como Analista solo puedes asignarte a ti mismo.";
      } else {
        sel.removeAttribute("disabled");
        sel.title = "";
      }
    } catch (e) {
      warn("RBAC list error:", e);
      sel.innerHTML = `<option value="" disabled selected>Sin opciones disponibles</option>`;
    }

    form.onsubmit = async (e) => {
      e.preventDefault();
      const value = sel.value;
      if (!value) {
        sel.focus();
        return;
      }
      await doAsignarRequerimiento(Number(value)).catch((error) => {
        warn("assign error:", error);
        toast("No se pudo asignar.", "danger");
      });

      modal.setAttribute("aria-hidden", "true");
      modal.classList.remove("open", "active");
      document.body.classList.remove("me-modal-open");
    };

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("me-modal-open");
    setTimeout(() => sel?.focus(), 30);
  }

  async function doAsignarRequerimiento(asignadoId) {
    const req = window.__REQ__;
    if (!req?.id) {
      toast("No hay requerimiento cargado.", "danger");
      return;
    }

    const updated_by = getEmpleadoId() ?? null;
    const payload = {
      id: Number(req.id),
      asignado_a: Number(asignadoId),
      updated_by,
    };

    log("[Asignar] payload", payload);

    await postJSON(ENDPOINTS.REQ_UPDATE, payload);
    await refreshAsignadoUI(asignadoId);
    toast("Asignación actualizada", "success");

    if (window.__REQ__) {
      window.__REQ__.asignado_id = String(asignadoId);
    }
  }

  async function refreshAsignadoUI(asignadoId) {
    const grid = findDetallesGrid();
    if (!grid) return;

    const row = findRowByLabel(grid, ["asignado"]);
    const dd = row?.querySelector(".exp-val");
    if (dd) {
      const sel = document.querySelector("#modal-asignar-req #asignar-select");
      const opt = sel
        ? sel.querySelector(`option[value="${CSS.escape(String(asignadoId))}"]`)
        : null;
      const display = opt?.textContent || `Empleado #${asignadoId}`;
      dd.textContent = display;
      attachAsignarButton();
    }

    const ddE = $(".exp-meta > div:nth-child(2) dd");
    if (ddE) {
      const sel = document.querySelector("#modal-asignar-req #asignar-select");
      const opt = sel
        ? sel.querySelector(`option[value="${CSS.escape(String(asignadoId))}"]`)
        : null;
      ddE.textContent = opt?.textContent || `Empleado #${asignadoId}`;
    }
  }

  /* =========================
   * Wiring
   * ========================= */

  function bootListeners() {
    log("[Boot] Detalle: instalando listeners…");

    document.addEventListener(
      "req:loaded",
      async (e) => {
        const req = e.detail;
        log("[Boot] evento req:loaded recibido en Detalle:", req?.id, req);

        try {
          resetDetallesSkeleton();
          await paintDetalles(req);
          await paintMotivoCCP(req);
          setupDetallesEditors(req);
        } catch (error) {
          warn("[Boot] error al pintar Detalle/CCP:", error);
        }
      },
      { passive: true }
    );

    // Fallback si __REQ__ ya estaba listo antes de que cargara este JS
    if (window.__REQ__) {
      const req = window.__REQ__;
      log("[Boot] __REQ__ ya definido, pinto Detalle de inmediato:", req?.id);

      resetDetallesSkeleton();
      paintDetalles(req)
        .then(() => paintMotivoCCP(req))
        .then(() => setupDetallesEditors(req))
        .catch((error) => warn("[Boot] paintDetalles fallback error:", error));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootListeners, {
      once: true,
    });
  } else {
    bootListeners();
  }
})();

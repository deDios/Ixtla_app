// /JS/requerimientoView.js
(function () {
  "use strict";

  /* ============================
   * Helpers básicos
   * ============================*/
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const log = (...a) => console.log("[ReqView]", ...a);
  const warn = (...a) => console.warn("[ReqView][WARN]", ...a);
  const err = (...a) => console.error("[ReqView][ERR]", ...a);
  const toast = (m, t = "info") =>
    window.gcToast ? gcToast(m, t) : console.log("[toast]", t, m);
  window._rvHelpers = { $, $$, toast }; // para Planeación

  // Normalizadores
  const normName = (s = "") =>
    String(s).trim().toLowerCase().replace(/\s+/g, " ");
  const norm = (s = "") =>
    String(s)
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");

  /* ============================
   * Endpoints (ajustados a tu backend)
   * ============================*/
  const ENDPOINTS = {
    REQUERIMIENTO_GET: "/db/WEB/ixtla01_c_requerimiento.php",
    REQUERIMIENTO_UPDATE: "/db/WEB/ixtla01_upd_requerimiento.php",
    EMPLEADOS_GET: "/db/WEB/ixtla01_c_empleado.php",
    // ¡OJO al case de DB! usa el mismo que ya te funciona en prod:
    DEPT_LIST: "/DB/WEB/ixtla01_c_departamento.php",
    COMENT_LIST: "/db/WEB/ixtla01_c_comentario_requerimiento.php",
    COMENT_CREATE: "/db/WEB/ixtla01_i_comentario_requerimiento.php",
    PROCESOS_LIST: "/db/WEB/ixtla01_c_proceso_requerimiento.php",
    TAREAS_LIST: "/db/WEB/ixtla01_c_tarea_proceso.php",
  };

  async function postJSON(url, body) {
    console.groupCollapsed("[HTTP] POST", url);
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
      let json;
      try {
        json = JSON.parse(txt);
      } catch {
        json = { raw: txt };
      }
      console.log("← status:", res.status, "json:", json);
      console.groupEnd();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return json;
    } catch (e) {
      console.groupEnd();
      throw e;
    }
  }

  /* ============================
   * Utilidades
   * ============================*/
  function safeGetSession() {
    try {
      if (window.Session?.get) return window.Session.get();
    } catch {}
    try {
      const c = document.cookie
        .split("; ")
        .find((x) => x.startsWith("ix_emp="));
      if (!c) return null;
      const raw = decodeURIComponent(c.split("=")[1] || "");
      return JSON.parse(decodeURIComponent(escape(atob(raw))));
    } catch {}
    return null;
  }
  function getEmpleadoIdFromSession() {
    const s = safeGetSession();
    const empId = s?.empleado_id ?? s?.id_empleado ?? null;
    if (!empId) {
      warn("[Sesion] NO hay empleado_id en la cookie/sesión. Sesión:", s);
    } else {
      log("[Sesion] empleado_id detectado:", empId);
    }
    return empId;
  }
  function relShort(when) {
    if (!when) return "—";
    const t = Date.parse(String(when).replace("T", " ").replace(/-/g, "/"));
    const diff = Date.now() - (Number.isFinite(t) ? t : Date.now());
    const s = Math.max(0, Math.floor(diff / 1000));
    if (s < 10) return "ahora";
    if (s < 60) return `hace ${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `hace ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 48) return `hace ${h} h`;
    const d = Math.floor(h / 24);
    return `hace ${d} d`;
  }
  const firstTwo = (full = "") =>
    String(full).trim().split(/\s+/).filter(Boolean).slice(0, 2).join(" ") ||
    "—";

  /* ============================
   * Stepper / estatus
   * ============================*/
  const statusLabel = (s) =>
    ({
      0: "Solicitud",
      1: "Revisión",
      2: "Asignación",
      3: "Proceso",
      4: "Pausado",
      5: "Cancelado",
      6: "Finalizado",
    }[Number(s)] || "—");
  const statusBadgeClass = (s) =>
    ({
      0: "is-muted",
      1: "is-info",
      2: "is-info",
      3: "is-info",
      4: "is-warning",
      5: "is-danger",
      6: "is-success",
    }[Number(s)] || "is-info");

  function paintStepper(next) {
    const items = $$(".step-menu li");
    items.forEach((li) => {
      const s = Number(li.dataset.status);
      li.classList.remove("current");
      if (s < next) li.classList.add("complete");
      else li.classList.remove("complete");
      if (s === next) li.classList.add("current");
    });
  }
  window.paintStepper = paintStepper;

  function getCurrentStatusCode() {
    const cur = $(".step-menu li.current");
    return cur ? Number(cur.getAttribute("data-status")) : 0;
  }
  function updateStatusUI(code) {
    code = Number(code);
    const badge = $('#req-status [data-role="status-badge"]');
    if (badge) {
      badge.classList.remove(
        "is-info",
        "is-muted",
        "is-warning",
        "is-danger",
        "is-success"
      );
      badge.classList.add(statusBadgeClass(code));
      badge.textContent = statusLabel(code);
    }
    const sel = $('#req-status [data-role="status-select"]');
    if (sel) sel.value = String(code);
    paintStepper(code);
    log("[UI] updateStatusUI →", code, statusLabel(code));
  }

  const makeBtn = (txt, cls = "", act = "") => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `btn-xs ${cls}`.trim();
    b.textContent = txt;
    b.dataset.act = act;
    return b;
  };
  function getButtonsForStatus(code) {
    switch (Number(code)) {
      case 0:
        return [
          makeBtn("Iniciar revisión", "primary", "start-revision"),
          makeBtn("Cancelar", "danger", "cancel"),
        ];
      case 1:
        return [
          makeBtn("Pausar", "warn", "pause"),
          makeBtn("Cancelar", "danger", "cancel"),
          makeBtn("Asignar a departamento", "", "assign-dept"),
        ];
      case 2:
        return [
          makeBtn("Pausar", "warn", "pause"),
          makeBtn("Cancelar", "danger", "cancel"),
          makeBtn("Iniciar proceso", "primary", "start-process"),
        ];
      case 3:
        return [
          makeBtn("Pausar", "warn", "pause"),
          makeBtn("Cancelar", "danger", "cancel"),
        ];
      case 4:
        return [
          makeBtn("Reanudar", "primary", "resume"),
          makeBtn("Cancelar", "danger", "cancel"),
        ];
      case 5:
        return [makeBtn("Reabrir", "primary", "reopen")];
      case 6:
        return [makeBtn("Reabrir", "primary", "reopen")];
      default:
        return [makeBtn("Iniciar revisión", "primary", "start-revision")];
    }
  }
  function renderActions(code = getCurrentStatusCode()) {
    const wrap = $("#req-actions");
    if (!wrap) return;
    wrap.innerHTML = "";
    getButtonsForStatus(code).forEach((b) => {
      b.addEventListener("click", () => onAction(b.dataset.act));
      wrap.appendChild(b);
    });
    log(
      "[UI] renderActions:",
      code,
      "=>",
      [...wrap.querySelectorAll("button")].map((x) => x.dataset.act)
    );
  }

  function askMotivo(titulo = "Motivo") {
    return new Promise((resolve, reject) => {
      const overlay = $("#modal-estado");
      const title = $("#estado-title");
      const form = $("#form-estado");
      const txt = $("#estado-motivo");
      if (!overlay || !form || !txt) return reject("sin modal motivo");
      title.textContent = titulo;
      txt.value = "";
      overlay.setAttribute("aria-hidden", "false");
      document.body.classList.add("me-modal-open");
      const onSubmit = (e) => {
        e.preventDefault();
        const v = txt.value.trim();
        if (!v) return txt.focus();
        cleanup();
        resolve(v);
      };
      const onClose = () => {
        cleanup();
        reject("cancel");
      };
      form.addEventListener("submit", onSubmit);
      overlay.querySelector(".modal-close")?.addEventListener("click", onClose);
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) onClose();
      });
      function cleanup() {
        form.removeEventListener("submit", onSubmit);
        overlay
          .querySelector(".modal-close")
          ?.removeEventListener("click", onClose);
        overlay.removeEventListener("click", onClose);
        overlay.setAttribute("aria-hidden", "true");
        document.body.classList.remove("me-modal-open");
      }
    });
  }

  async function updateReqStatus({ id, estatus, motivo }) {
    const updated_by = getEmpleadoIdFromSession();
    const body = { id: Number(id), estatus: Number(estatus), updated_by };
    if (motivo) body.motivo = String(motivo).trim();
    log("[API] REQUERIMIENTO_UPDATE →", body);
    const res = await postJSON(ENDPOINTS.REQUERIMIENTO_UPDATE, body);
    log("[API] REQUERIMIENTO_UPDATE ←", res);
    return res?.data ?? res;
  }

  async function hasAtLeastOneProcesoAndTask(reqId) {
    try {
      const p = await postJSON(ENDPOINTS.PROCESOS_LIST, {
        requerimiento_id: Number(reqId),
        status: 1,
        page: 1,
        page_size: 50,
      });
      const procesos = Array.isArray(p?.data) ? p.data : [];
      log("[Check] procesos:", procesos.length);
      for (const pr of procesos) {
        const t = await postJSON(ENDPOINTS.TAREAS_LIST, {
          proceso_id: Number(pr.id),
          status: 1,
          page: 1,
          page_size: 50,
        });
        const tareas = Array.isArray(t?.data) ? t.data : [];
        log(`[Check] proc ${pr.id} tareas:`, tareas.length);
        if (tareas.length > 0) return true;
      }
      return false;
    } catch (e) {
      warn("[Check] procesos/tareas error", e);
      return false;
    }
  }

  async function onAction(act) {
    let next = getCurrentStatusCode();
    const id = __CURRENT_REQ_ID__;
    if (!id) {
      toast("No hay id de requerimiento en la URL", "danger");
      return;
    }
    log("[Action]", act, "status:", next, "req:", id);

    try {
      if (act === "start-revision") {
        next = 1;
        await updateReqStatus({ id, estatus: next });
        updateStatusUI(next);
        toast("Estado cambiado a Revisión", "info");
      } else if (act === "assign-dept") {
        next = 2;
        await updateReqStatus({ id, estatus: next });
        updateStatusUI(next);
        toast("Asignado a departamento", "success");
      } else if (act === "start-process") {
        const ok = await hasAtLeastOneProcesoAndTask(id);
        if (!ok) {
          toast(
            "Para iniciar proceso necesitas al menos un proceso y una tarea.",
            "warning"
          );
          return;
        }
        next = 3;
        await updateReqStatus({ id, estatus: next });
        updateStatusUI(next);
        toast("Proceso iniciado", "success");
      } else if (act === "pause") {
        const motivo = await askMotivo("Motivo de la pausa");
        next = 4;
        await updateReqStatus({ id, estatus: next, motivo });
        updateStatusUI(next);
        toast("Pausado", "warn");
      } else if (act === "resume") {
        next = 1;
        await updateReqStatus({ id, estatus: next });
        updateStatusUI(next);
        toast("Reanudado (Revisión)", "success");
      } else if (act === "cancel") {
        const motivo = await askMotivo("Motivo de la cancelación");
        next = 5;
        await updateReqStatus({ id, estatus: next, motivo });
        updateStatusUI(next);
        toast("Cancelado", "danger");
      } else if (act === "reopen") {
        next = 1;
        await updateReqStatus({ id, estatus: next });
        updateStatusUI(next);
        toast("Reabierto (Revisión)", "info");
      }
    } catch (e) {
      if (e !== "cancel") {
        err(e);
        toast("No se pudo actualizar el estado.", "danger");
      }
    }
    renderActions(next);
  }

  /* ============================
   * Normalización (sin fallbacks raros)
   * ============================*/
  function normalizeRequerimiento(raw = {}) {
    console.groupCollapsed("[Normalize] IN");
    console.log(raw);
    console.groupEnd();
    const out = {
      id: String(raw.id ?? raw.requerimiento_id ?? ""),
      folio: String(raw.folio ?? ""),
      departamento_id:
        raw.departamento_id != null ? Number(raw.departamento_id) : null,
      departamento_nombre: String(raw.departamento_nombre || "").trim(),
      tramite_id: raw.tramite_id != null ? Number(raw.tramite_id) : null,
      tramite_nombre: String(raw.tramite_nombre || "").trim(),
      asignado_id: raw.asignado_a != null ? String(raw.asignado_a) : null,
      asignado_full: String(raw.asignado_nombre_completo || "").trim(),
      asunto: String(raw.asunto || "").trim(),
      descripcion: String(raw.descripcion || "").trim(),
      prioridad: raw.prioridad != null ? Number(raw.prioridad) : null,
      estatus_code:
        raw.estatus != null
          ? Number(raw.estatus)
          : raw.status != null
          ? Number(raw.status)
          : 0,
      canal: raw.canal != null ? Number(raw.canal) : null,
      contacto_nombre: String(raw.contacto_nombre || "").trim(),
      contacto_telefono: String(raw.contacto_telefono || "").trim(),
      contacto_email: String(raw.contacto_email || "").trim(),
      contacto_calle: String(raw.contacto_calle || "").trim(),
      contacto_colonia: String(raw.contacto_colonia || "").trim(),
      contacto_cp: String(raw.contacto_cp || "").trim(),
      creado_at: String(raw.created_at || "").trim(),
      cerrado_en: raw.cerrado_en ? String(raw.cerrado_en).trim() : null,
      raw,
    };
    console.groupCollapsed("[Normalize] OUT");
    console.log(out);
    console.groupEnd();
    return out;
  }

  /* ============================
   * Fetch básicos
   * ============================*/
  async function getRequerimientoById(id) {
    log("[API] REQUERIMIENTO_GET →", { id });
    const res = await postJSON(ENDPOINTS.REQUERIMIENTO_GET, { id });
    const data = res?.data ?? res;
    return normalizeRequerimiento(Array.isArray(data) ? data[0] || {} : data);
  }

  // ===== Empleados cache =====
  const EMP_CACHE = new Map(); // id -> { id, nombre, avatar }
  async function getEmpleadoById(id) {
    if (id == null) return null;
    const key = Number(id);
    if (EMP_CACHE.has(key)) return EMP_CACHE.get(key);

    console.groupCollapsed("[Empleado] GET BY ID →", key);
    const res = await postJSON(ENDPOINTS.EMPLEADOS_GET, { id: key, status: 1 });
    const payload = res?.data ?? res;
    let emp = null;

    if (Array.isArray(payload)) {
      emp =
        payload.find((e) => Number(e?.id ?? e?.empleado_id) === key) ||
        payload[0] ||
        null;
    } else if (payload && typeof payload === "object") {
      emp = payload;
    }

    const nombre =
      [emp?.nombre, emp?.nombres, emp?.empleado_nombre, emp?.first_name].find(
        Boolean
      ) || "";
    const apellidos =
      [emp?.apellidos, emp?.empleado_apellidos, emp?.last_name].find(Boolean) ||
      "";
    const full =
      [nombre, apellidos].filter(Boolean).join(" ").trim() ||
      (emp?.empleado_display || "").trim() ||
      "—";

    const avatar =
      emp?.avatar_url ||
      emp?.foto_url ||
      emp?.foto ||
      emp?.img ||
      emp?.img_perfil ||
      emp?.imagen_url ||
      emp?.path_imagen ||
      emp?.imagen ||
      null;

    const info = {
      id: key,
      nombre: full,
      avatar: avatar
        ? avatar.startsWith("/")
          ? avatar
          : `/${String(avatar).replace(/^\/+/, "")}`
        : null,
    };

    console.log("[Empleado] OUT:", info);
    console.groupEnd();
    EMP_CACHE.set(key, info);
    return info;
  }

  /* ============================
   * Departamentos: siempre lista + filtro en cliente
   * ============================*/
  async function getDeptByIdOrName({ id, nombre }) {
    const wantedId = id != null ? Number(id) : null;
    const wantedName = nombre ? norm(nombre) : null;

    const payload = { page: 1, page_size: 200, status: 1 /*, all: true*/ };
    console.groupCollapsed(
      "[Dept][HTTP] POST (lista completa)",
      ENDPOINTS.DEPT_LIST
    );
    console.log(
      "→ payload:",
      payload,
      "(el back ignora filtro por id; filtramos en cliente)"
    );
    let res;
    try {
      res = await postJSON(ENDPOINTS.DEPT_LIST, payload);
    } catch (e) {
      console.groupEnd();
      warn("[Dept] fallo fetch lista completa:", e);
      return { dept: null, director: null, primeraLinea: null };
    }
    const arr = Array.isArray(res?.data) ? res.data : [];
    console.log("← rows:", arr.length);
    console.groupEnd();

    console.groupCollapsed("[Dept][DATA] primeros 5");
    console.log(arr.slice(0, 5));
    console.groupEnd();

    let dept = null;
    if (wantedId) {
      dept = arr.find((x) => Number(x.id) === wantedId) || null;
    }
    if (!dept && wantedName) {
      dept =
        arr.find((x) => norm(x?.nombre || "") === wantedName) ||
        arr.find((x) => norm(x?.nombre || "").startsWith(wantedName)) ||
        null;
    }
    if (!dept && arr.length === 1) dept = arr[0] || null;

    if (!dept) {
      warn("[Dept][Pick] No se encontró dept con:", {
        wantedId,
        wantedName,
        len: arr.length,
        sample: arr.map((d) => ({ id: d.id, nombre: d.nombre })).slice(0, 8),
      });
      return { dept: null, director: null, primeraLinea: null };
    }

    const infoDept = {
      id: Number(dept.id),
      nombre: String(dept.nombre || "—"),
      director_id: Number(dept.director ?? 0) || null,
      director_nombre: String(dept.director_nombre || ""),
      director_apellidos: String(dept.director_apellidos || ""),
      primera_linea_id: Number(dept.primera_linea ?? 0) || null,
      primera_nombre: String(dept.primera_nombre || ""),
      primera_apellidos: String(dept.primera_apellidos || ""),
    };

    console.groupCollapsed("[Dept][Pick] seleccionado");
    console.table(infoDept);
    console.groupEnd();

    // Director
    let director = null;
    if (infoDept.director_id) {
      try {
        director = await getEmpleadoById(infoDept.director_id);
        console.groupCollapsed("[Dept][Director] via empleado_id");
        console.log(director);
        console.groupEnd();
      } catch (e) {
        warn("[Dept] getEmpleadoById(director) error:", e);
      }
    }
    if (!director) {
      const full =
        [infoDept.director_nombre, infoDept.director_apellidos]
          .filter(Boolean)
          .join(" ")
          .trim() || "—";
      director = { id: infoDept.director_id, nombre: full, avatar: null };
      console.groupCollapsed("[Dept][Director] from dept fields");
      console.log(director);
      console.groupEnd();
    }

    // Primera línea
    let primeraLinea = null;
    if (infoDept.primera_linea_id) {
      try {
        primeraLinea = await getEmpleadoById(infoDept.primera_linea_id);
      } catch {}
    }
    if (!primeraLinea) {
      const full = [infoDept.primera_nombre, infoDept.primera_apellidos]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (full)
        primeraLinea = {
          id: infoDept.primera_linea_id,
          nombre: full,
          avatar: null,
        };
    }

    return {
      dept: { id: infoDept.id, nombre: infoDept.nombre },
      director,
      primeraLinea,
    };
  }

  /* ============================
   * Pintado UI (a tu HTML)
   * ============================*/
  function paintContacto(req) {
    log("[UI] Pintar Contacto");
    const p = $('.exp-pane[role="tabpanel"][data-tab="Contacto"] .exp-grid');
    if (!p) return;
    const set = (labelText, val) => {
      const row = Array.from(p.querySelectorAll(".exp-field")).find((r) => {
        const txt = (r.querySelector("label")?.textContent || "")
          .trim()
          .toLowerCase();
        return txt.startsWith(labelText.toLowerCase());
      });
      const dd = row?.querySelector(".exp-val");
      if (!dd) return;
      if (labelText.toLowerCase().includes("correo")) {
        const a = dd.querySelector("a") || document.createElement("a");
        a.textContent = val || "—";
        if (val) a.href = `mailto:${val}`;
        else a.removeAttribute("href");
        if (!dd.contains(a)) {
          dd.innerHTML = "";
          dd.appendChild(a);
        }
      } else {
        dd.textContent = val || "—";
      }
    };
    set("Nombre", req.contacto_nombre || "—");
    set("Teléfono", req.contacto_telefono || "—");
    set(
      "Dirección del reporte",
      [req.contacto_calle, req.contacto_colonia].filter(Boolean).join(", ")
    );
    set("Correo", req.contacto_email || "—");
    set("C.P", req.contacto_cp || "—");
  }

  function paintHeaderMeta(req) {
    const ddC = $(".exp-meta > div:nth-child(1) dd");
    const ddE = $(".exp-meta > div:nth-child(2) dd");
    const ddF = $(".exp-meta > div:nth-child(3) dd");
    if (ddC) ddC.textContent = req.contacto_nombre || "—";

    // Encargado (Asignado) — si no hay, “Sin asignar”
    const asignado =
      req.asignado_id && (req.asignado_full || "").trim()
        ? req.asignado_full
        : "Sin asignar";
    if (ddE) ddE.textContent = asignado;

    if (ddF) ddF.textContent = (req.creado_at || "—").replace("T", " ");
  }

  async function paintDetalles(req) {
    log("[UI] Pintar Detalles");
    const grid = $('.exp-pane[role="tabpanel"][data-tab="detalles"] .exp-grid');
    if (!grid) return;

    const put = (labelStartsWith, value, asLink = false) => {
      const row = Array.from(grid.querySelectorAll(".exp-field")).find((r) => {
        const t = (r.querySelector("label")?.textContent || "")
          .trim()
          .toLowerCase();
        return t.startsWith(labelStartsWith.toLowerCase());
      });
      const dd = row?.querySelector(".exp-val");
      if (!dd) return;
      if (asLink) {
        const a = dd.querySelector("a") || document.createElement("a");
        a.textContent = value || "—";
        if (value) a.href = "#";
        else a.removeAttribute("href");
        if (!dd.contains(a)) {
          dd.innerHTML = "";
          dd.appendChild(a);
        }
      } else {
        dd.textContent = value ?? "—";
      }
    };

    // Nombre del Requerimiento:
    put("Nombre del Requerimiento", req.asunto || req.tramite_nombre || "—");

    // Departamento + Director (líder del departamento)
    log("[UI] Dept lookup with", {
      req_departamento_id: req.departamento_id,
      req_departamento_nombre: req.departamento_nombre,
    });
    const { dept, director, primeraLinea } = await getDeptByIdOrName({
      id: req.departamento_id,
      nombre: req.departamento_nombre,
    });
    console.groupCollapsed("[UI] Dept/Director/PrimeraLinea (para pintar)");
    console.log({ dept, director, primeraLinea });
    console.groupEnd();

    // Líder del Departamento:
    put("Líder del Departamento", director?.nombre || "—", true);
    // Departamento:
    const depNode = $("#req-departamento");
    if (depNode)
      depNode.textContent = dept?.nombre || req.departamento_nombre || "—";

    // Asignado:
    const asignado =
      req.asignado_id && (req.asignado_full || "").trim()
        ? req.asignado_full
        : "Sin asignar";
    put("Asignado", asignado, true);

    // Estatus badge:
    updateStatusUI(req.estatus_code);
    renderActions(req.estatus_code);

    // Descripción:
    put("Descripción", req.descripcion || "—");

    // Fechas:
    put("Fecha de inicio", (req.creado_at || "").split(" ")[0] || "—");
    put(
      "Fecha de terminado",
      req.cerrado_en ? String(req.cerrado_en).split(" ")[0] : "—"
    );
  }

  /* ============================
   * Comentarios (con logs y avatars por empleado_id)
   * ============================*/
  async function listComentariosAPI({
    requerimiento_id,
    status = 1,
    page = 1,
    page_size = 100,
  }) {
    const payload = {
      requerimiento_id: Number(requerimiento_id),
      status,
      page,
      page_size,
    };
    log("[API] COMENT_LIST →", payload);
    const res = await postJSON(ENDPOINTS.COMENT_LIST, payload);
    log("[API] COMENT_LIST ←", res);
    const raw = res?.data ?? res?.items ?? res;
    return Array.isArray(raw) ? raw : Array.isArray(raw?.rows) ? raw.rows : [];
  }
  async function createComentarioAPI({
    requerimiento_id,
    empleado_id,
    comentario,
    status = 1,
    created_by,
  }) {
    const payload = {
      requerimiento_id: Number(requerimiento_id),
      empleado_id: empleado_id ?? null, // EMPLEADO
      comentario,
      status,
      created_by: created_by ?? empleado_id ?? null, // EMPLEADO
    };
    log("[API] COMENT_CREATE →", payload);
    const r = await postJSON(ENDPOINTS.COMENT_CREATE, payload);
    log("[API] COMENT_CREATE ←", r);
    return r;
  }

  function placeholderAvatar() {
    return "/ASSETS/user/img_user1.png";
  }
  function srcNeedsBust(src) {
    return !src.includes("/ASSETS/user/img_user1.png");
  }

  async function renderCommentsList(items = [], reqId) {
    console.groupCollapsed("[Comentarios][UI] render");
    console.log("items(raw):", items);
    const feed = $(".c-feed");
    if (!feed) {
      console.groupEnd();
      return;
    }
    feed.innerHTML = "";

    for (const r of items) {
      const nombre =
        r.empleado_display ||
        [r.empleado_nombre, r.empleado_apellidos].filter(Boolean).join(" ") ||
        r.nombre ||
        r.autor ||
        "—";
      const texto = r.comentario || r.texto || "";
      const cuando = relShort(r.created_at || r.fecha || "");

      // === DECISIÓN: usar empleado_id como fuente principal; fallback a created_by
      const empleadoId =
        (Number(r.empleado_id) > 0 && Number(r.empleado_id)) ||
        (Number(r.created_by) > 0 && Number(r.created_by)) ||
        null;

      console.log("[Comentarios][Autor]", {
        comentario_id: r.id,
        empleado_id_raw: r.empleado_id,
        created_by_raw: r.created_by,
        empleado_id_usado: empleadoId,
        nombrePlano: nombre,
      });

      // Avatares tipo sidebar: /ASSETS/user/userImgs/img_{empleadoId}.{ext}?v=...
      const bust = `?v=${Date.now()}`;
      const localCandidates = empleadoId
        ? [
            `/ASSETS/user/userImgs/img_${empleadoId}.png${bust}`,
            `/ASSETS/user/userImgs/img_${empleadoId}.jpg${bust}`,
          ]
        : [];

      // Intento de avatar desde endpoint empleado (por si existiera una URL guardada)
      let endpointUrl = null;
      try {
        const emp = empleadoId ? await getEmpleadoById(empleadoId) : null;
        endpointUrl = emp?.avatar || null;
      } catch (e) {
        warn("[Avatar] getEmpleadoById fallo:", e);
      }

      const sources = [
        ...localCandidates,
        endpointUrl,
        placeholderAvatar(),
      ].filter(Boolean);

      const art = document.createElement("article");
      art.className = "msg";
      const img = document.createElement("img");
      img.className = "avatar";
      img.alt = "";

      let i = 0;
      const tryNext = () => {
        if (i >= sources.length) {
          img.src = placeholderAvatar();
          return;
        }
        const src = `${sources[i]}${
          srcNeedsBust(sources[i])
            ? sources[i].includes("?")
              ? ""
              : `?v=${Date.now()}`
            : ""
        }`;
        log(`[Avatar][load] trying[${i}] →`, src);
        img.onerror = () => {
          log(`[Avatar][error]`, src);
          i++;
          tryNext();
        };
        img.onload = () => {
          log(`[Avatar][ok]`, src);
        };
        img.src = src;
      };
      tryNext();

      art.appendChild(img);
      const box = document.createElement("div");
      box.innerHTML = `
        <div class="who"><span class="name">${firstTwo(
          String(nombre)
        )}</span> <span class="time">${cuando}</span></div>
        <div class="text" style="white-space:pre-wrap;word-break:break-word;"></div>
      `;
      $(".text", box).textContent = texto;
      art.appendChild(box);
      feed.appendChild(art);
    }

    const scroller = feed.parentElement || feed;
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
    console.groupEnd();
  }

  async function loadComentarios(reqId) {
    console.groupCollapsed("[Comentarios] list");
    try {
      const arr = await listComentariosAPI({
        requerimiento_id: reqId,
        status: 1,
        page: 1,
        page_size: 100,
      });

      // Prefetch empleados (por performance, IDs únicos de empleado_id y created_by)
      const ids = Array.from(
        new Set(
          arr
            .flatMap((r) => [
              Number(r.empleado_id) || null,
              Number(r.created_by) || null,
            ])
            .filter(Boolean)
        )
      );
      log("[Comentarios] prefetch empleado IDs:", ids);
      await Promise.all(ids.map((id) => getEmpleadoById(id).catch(() => null)));

      await renderCommentsList(arr, reqId);
    } catch (e) {
      warn("Error listando comentarios:", e);
      await renderCommentsList([], reqId);
    } finally {
      console.groupEnd();
    }
  }

  function interceptComposer(reqId) {
  const ta = $(".composer textarea");
  const btn = $(".composer .send-fab");
  if (!ta || !btn) return;

  const s = safeGetSession();
  // Solo usamos empleado_id para todo (empleado_id y created_by)
  const empleado_id = s?.empleado_id ?? s?.id_empleado ?? null;

  console.log("[Comentarios][Send] ids de sesión (solo empleado)", {
    empleado_id,
    tiene_id_usuario: !!(s?.id_usuario ?? s?.usuario_id),
    tiene_cuenta_id: !!(s?.cuenta_id ?? s?.id_cuenta),
  });

  const send = async () => {
    const texto = (ta.value || "").trim();
    if (!texto) return;
    if (!empleado_id) {
      console.error("[Comentarios][Send] No hay empleado_id en sesión; abort");
      toast("No se encontró tu empleado en la sesión.", "danger");
      return;
    }
    btn.disabled = true;
    try {
      await createComentarioAPI({
        requerimiento_id: reqId,
        empleado_id,      // ← EMPLEADO
        comentario: texto,
        status: 1,
        created_by: empleado_id,  // ← EMPLEADO también
      });
      ta.value = "";
      await loadComentarios(reqId);
    } catch (e) {
      err("crear comentario:", e);
      toast("No se pudo enviar el comentario.", "danger");
    } finally {
      btn.disabled = false;
    }
  };

  btn.addEventListener("click", (e) => { e.preventDefault(); send(); });
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
}


  /* ============================
   * Reset y Boot
   * ============================*/
  function resetTemplate() {
    // Limpia lo visible
    const contactVals = $$('.exp-pane[data-tab="Contacto"] .exp-grid .exp-val');
    contactVals.forEach((n) => {
      const a = n.querySelector("a");
      if (a) {
        a.textContent = "—";
        a.removeAttribute("href");
      } else n.textContent = "—";
    });
    const detallesVals = $$(
      '.exp-pane[data-tab="detalles"] .exp-grid .exp-val'
    );
    detallesVals.forEach((n) => {
      if (n.id === "req-status") {
        const b = n.querySelector('[data-role="status-badge"]');
        if (b) {
          b.className = "exp-badge is-info";
          b.textContent = "—";
        }
      } else n.textContent = "—";
    });
    $(".exp-title h1") && ($(".exp-title h1").textContent = "—");
    $$(".exp-meta dd").forEach((dd) => (dd.textContent = "—"));
    // comentarios de demo fuera
    const feed = $(".c-feed");
    if (feed) feed.innerHTML = "";
  }

  let __CURRENT_REQ_ID__ = null;

  async function boot() {
    resetTemplate();

    // stepper (solo UI)
    const stepItems = $$(".step-menu li");
    stepItems.forEach((li) => {
      li.addEventListener("click", () => {
        stepItems.forEach((x) => x.classList.remove("current"));
        li.classList.add("current");
        updateStatusUI(Number(li.dataset.status));
        renderActions(Number(li.dataset.status));
      });
    });

    const params = new URL(window.location.href).searchParams;
    const reqId = params.get("id");
    __CURRENT_REQ_ID__ = reqId;
    log("[Boot] reqId:", reqId);

    if (!reqId) {
      warn("Sin ?id=");
      return;
    }

    try {
      const req = await getRequerimientoById(reqId);
      // Título
      const h1 = $(".exp-title h1");
      if (h1)
        h1.textContent = req.asunto || req.tramite_nombre || "Requerimiento";

      paintHeaderMeta(req);
      paintContacto(req);
      await paintDetalles(req);

      // exp-status select sync
      const sel = $('#req-status [data-role="status-select"]');
      if (sel) sel.value = String(req.estatus_code ?? 0);

      // Notificar a Planeación
      try {
        window.__REQ__ = req;
        document.dispatchEvent(new CustomEvent("req:loaded", { detail: req }));
      } catch (e) {
        warn("req:loaded dispatch err:", e);
      }
    } catch (e) {
      err("Error consultando requerimiento:", e);
    }

    await loadComentarios(reqId);
    interceptComposer(reqId);
    renderActions(getCurrentStatusCode());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else boot();
})();

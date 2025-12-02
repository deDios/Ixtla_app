// /JS/requerimientoView.js
(function () {
  "use strict";

  /* ======================================
   *  Helpers básicos + logs
   * ======================================*/
  const TAG = "[ReqView]";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const log = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);
  const err = (...a) => console.error(TAG, ...a);
  const toast = (m, t = "info") =>
    window.gcToast ? gcToast(m, t) : log("[toast]", t, m);

  const DEFAULT_AVATAR = "/ASSETS/user/img_user1.png";

  const relShort = (when) => {
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
  };

  /* ======================================
   *  HTTP helpers
   * ======================================*/
  async function sendJSON(url, body, method = "POST") {
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
      let json;
      try {
        json = JSON.parse(txt);
      } catch {
        json = { raw: txt };
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return json;
    } catch (e) {
      throw e;
    }
  }

  async function postJSON(url, body) {
    return sendJSON(url, body, "POST");
  }

  /* ======================================
   *  Config / endpoints
   * ======================================*/
  const ENDPOINTS = {
    REQUERIMIENTO_GET: "/db/WEB/ixtla01_c_requerimiento.php",
    REQUERIMIENTO_UPDATE: "/db/WEB/ixtla01_upd_requerimiento.php",
    EMPLEADOS_GET: "/db/WEB/ixtla01_c_empleado.php",
    COMENT_LIST: "/db/WEB/ixtla01_c_comentario_requerimiento.php",
    COMENT_CREATE: "/db/WEB/ixtla01_i_comentario_requerimiento.php",
    PROCESOS_LIST: "/db/WEB/ixtla01_c_proceso_requerimiento.php",
    TAREAS_LIST: "/db/WEB/ixtla01_c_tarea_proceso.php",
    CCP_CREATE: "https://ixtla-app.com/db/web/ixtla01_i_ccp.php",
    CCP_UPDATE: "https://ixtla-app.com/db/web/ixtla01_u_ccp.php",
    CCP_LIST: "https://ixtla-app.com/db/web/ixtla01_c_ccp.php",
  };

  /* ======================================
   *  ¿Todos los procesos tienen todas sus tareas terminadas?
   *  (tarea terminada = status === 4 según el endpoint de tareas)
   * ======================================*/
  async function areAllProcesosAndTasksDone(reqId) {
    log("areAllProcesosAndTasksDone() → start", { reqId: Number(reqId) });

    try {
      const p = await postJSON(ENDPOINTS.PROCESOS_LIST, {
        requerimiento_id: Number(reqId),
        status: 1,
        page: 1,
        page_size: 50,
      });
      log("areAllProcesosAndTasksDone() → PROCESOS_LIST resp:", p);

      const procesos = Array.isArray(p?.data) ? p.data : [];
      log("areAllProcesosAndTasksDone() → procesos count:", procesos.length);

      if (!procesos.length) {
        warn(
          "areAllProcesosAndTasksDone() → sin procesos activos, devolviendo false"
        );
        return false;
      }

      let totalTareas = 0;

      for (const pr of procesos) {
        log("areAllProcesosAndTasksDone() → consultando tareas para proceso:", {
          proceso_id: pr.id,
          nombre: pr.nombre || pr.titulo || pr.descripcion || "",
          raw: pr,
        });

        const t = await postJSON(ENDPOINTS.TAREAS_LIST, {
          proceso_id: Number(pr.id),
          page: 1,
          page_size: 50,
        });

        log(
          "areAllProcesosAndTasksDone() → TAREAS_LIST resp proceso",
          pr.id,
          t
        );

        const tareas = Array.isArray(t?.data) ? t.data : [];
        log(
          "areAllProcesosAndTasksDone() → tareas count para proceso",
          pr.id,
          ":",
          tareas.length
        );

        if (!tareas.length) {
          warn(
            "areAllProcesosAndTasksDone() → proceso sin tareas, abortando con false",
            { proceso_id: pr.id }
          );
          return false; // proceso sin tareas => no está listo
        }

        totalTareas += tareas.length;

        const todasHechas = tareas.every((ta) => {
          const est = Number(ta.status ?? ta.estatus ?? 0);
          const isDone = est === 4; // usamos directamente el status de tareas (4 = Hecho)

          log("areAllProcesosAndTasksDone() → tarea evaluada:", {
            tarea_id: ta.id,
            status_raw: {
              status: ta.status,
              estatus: ta.estatus,
            },
            estatus_num: est,
            isDone,
            raw: ta,
          });

          return isDone;
        });

        if (!todasHechas) {
          warn(
            "areAllProcesosAndTasksDone() → al menos una tarea NO está hecha en proceso",
            pr.id
          );
          return false;
        }
      }

      const result = totalTareas > 0;
      log("areAllProcesosAndTasksDone() → FIN", {
        totalTareas,
        allDone: result,
      });
      return result;
    } catch (e) {
      warn("areAllProcesosAndTasksDone() → error:", e);
      return false;
    }
  }

  /* ======================================
   *  CCP (Motivo de pausa / cancelación)
   * ======================================*/

  // Devuelve el motivo CCP más reciente para el requerimiento.
  // Preferimos status=1 (activo); si no hay, el más nuevo aunque esté inactivo.
  async function listCCPByReqId(reqId) {
    const payload = {
      requerimiento_id: Number(reqId),
      page: 1,
      per_page: 50,
    };

    try {
      const res = await postJSON(ENDPOINTS.CCP_LIST, payload);
      let arr = Array.isArray(res?.data) ? res.data : [];

      if (!arr.length) return null;

      // Ordenar por fecha de creación desc (más reciente primero) y luego id desc
      arr.sort((a, b) => {
        const da = Date.parse(a.created_at || "") || 0;
        const db = Date.parse(b.created_at || "") || 0;
        if (db !== da) return db - da;
        const ia = Number(a.id) || 0;
        const ib = Number(b.id) || 0;
        return ib - ia;
      });

      // Preferimos el que esté activo (status 1); si no, el más reciente
      const activo = arr.find((item) => Number(item.status) === 1);
      return activo || arr[0];
    } catch (e) {
      warn("[CCP] listCCPByReqId error:", e);
      return null;
    }
  }

  // Siempre crea un nuevo motivo (no edita anteriores)
  async function upsertCCP({
    requerimiento_id,
    comentario,
    tipo = 2, // 1 = pausa, 2 = cancelación
    status = 1, // 1 = activo, 0 = inactivo
  }) {
    const { empleado_id } = getUserAndEmpleadoFromSession();

    const payload = {
      requerimiento_id: Number(requerimiento_id),
      empleado_id: empleado_id || null,
      tipo: Number(tipo),
      comentario: comentario != null ? String(comentario).trim() : "",
      status: typeof status === "number" ? status : 1,
      created_by: empleado_id || 1,
    };

    log("[CCP] creando nuevo motivo CCP", payload);

    const res = await postJSON(ENDPOINTS.CCP_CREATE, payload);
    return res?.data ?? res;
  }

  // Marca como inactivo (status 0) el motivo más reciente del requerimiento
  async function deactivateCCPForReq(requerimiento_id) {
    const { empleado_id } = getUserAndEmpleadoFromSession();
    const existente = await listCCPByReqId(requerimiento_id).catch(() => null);
    if (!existente || !existente.id) return null;

    const payload = {
      id: Number(existente.id),
      status: 0,
      updated_by: empleado_id || 1,
    };

    const res = await sendJSON(ENDPOINTS.CCP_UPDATE, payload, "PUT");
    return res?.data ?? res;
  }

  /* ======================================
   *  Sesión (usuario_id y empleado_id)
   * ======================================*/
  function readCookiePayload() {
    try {
      const name = "ix_emp=";
      const pair = document.cookie.split("; ").find((c) => c.startsWith(name));
      if (!pair) return null;
      const raw = decodeURIComponent(pair.slice(name.length));
      return JSON.parse(decodeURIComponent(escape(atob(raw))));
    } catch {
      return null;
    }
  }
  function safeGetSession() {
    try {
      if (window.Session?.get) return window.Session.get();
    } catch { }
    return readCookiePayload() || null;
  }
  function getUserAndEmpleadoFromSession() {
    const s = safeGetSession() || {};
    const usuario_id = s?.id_usuario ?? s?.usuario_id ?? null;
    const empleado_id = s?.empleado_id ?? s?.id_empleado ?? null;
    return { usuario_id, empleado_id };
  }

  /* ======================================
   *  Empleados (cache mín.)
   * ======================================*/
  const EMP_CACHE = new Map();
  async function getEmpleadoById(id) {
    const key = Number(id);
    if (!key) return null;
    if (EMP_CACHE.has(key)) return EMP_CACHE.get(key);
    const res = await postJSON(ENDPOINTS.EMPLEADOS_GET, { id: key, status: 1 });
    const payload = res?.data ?? res;
    let emp = null;
    if (Array.isArray(payload)) {
      emp =
        payload.find((e) => Number(e?.id ?? e?.empleado_id) === key) ||
        payload[0] ||
        null;
    } else if (payload && typeof payload === "object") emp = payload;

    const nombre =
      [emp?.nombre, emp?.nombres, emp?.empleado_nombre, emp?.first_name].find(
        Boolean
      ) || "";
    const apellidos =
      [emp?.apellidos, emp?.empleado_apellidos, emp?.last_name].find(Boolean) ||
      "";
    const out = {
      id: key,
      nombre: [nombre, apellidos].filter(Boolean).join(" ").trim() || "—",
      avatar:
        emp?.avatar_url || emp?.foto_url || emp?.img || emp?.imagen || null,
      departamento_id: emp?.departamento_id ?? null,
    };
    EMP_CACHE.set(key, out);
    return out;
  }

  /* ======================================
   *  UI: Stepper / estatus
   * ======================================*/
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
    $$(".step-menu li").forEach((li) => {
      const s = Number(li.dataset.status);
      li.classList.remove("current");
      if (s < next) li.classList.add("complete");
      else li.classList.remove("complete");
      if (s === next) li.classList.add("current");
    });
  }
  function getCurrentStatusCode() {
    const cur = $(".step-menu li.current");
    const code = cur ? Number(cur.getAttribute("data-status")) : 0;
    log("getCurrentStatusCode() →", code);
    return code;
  }
  function updateStatusUI(code) {
    code = Number(code);
    log("updateStatusUI() →", code);
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
  }

  // === recargar requerimiento y refrescar UI (header + tabs) ===
  async function reloadReqUI() {
    const id = __CURRENT_REQ_ID__;
    if (!id) return;

    log("reloadReqUI() → id:", id);

    try {
      const req = await getRequerimientoById(id);

      window.__REQ__ = req;

      paintHeaderMeta(req);
      paintContacto(req);
      updateStatusUI(req.estatus_code);

      document.dispatchEvent(new CustomEvent("req:loaded", { detail: req }));

      // Regenera acciones y revisa si debe aparecer "Finalizar"
      renderActions(req.estatus_code);
      await injectFinalizeButtonIfReady();
    } catch (e) {
      err("Error al recargar requerimiento después de actualizar estado:", e);
    }
  }

  /* ======================================
   *  Acciones de estatus
   * ======================================*/
  async function updateReqStatus({ id, estatus, motivo }) {
    const { empleado_id } = getUserAndEmpleadoFromSession();
    const body = {
      id: Number(id),
      estatus: Number(estatus),
      updated_by: empleado_id || null,
    };

    // =========================
    // Fechas automáticas
    // =========================
    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10); // YYYY-MM-DD

    // Cuando entra a PROCESO (3) → fecha de inicio (fecha_limite)
    if (Number(estatus) === 3) {
      body.fecha_limite = todayISO; // última vez que entró a Proceso
    }

    // Cuando entra a FINALIZADO (6) → fecha de terminado (cerrado_en)
    if (Number(estatus) === 6) {
      // formato "YYYY-MM-DD HH:MM:SS"
      const fechaHora = now.toISOString().slice(0, 19).replace("T", " ");
      body.cerrado_en = fechaHora;
    }

    if (motivo) body.motivo = String(motivo).trim();

    log("updateReqStatus() → payload:", body);

    const res = await postJSON(ENDPOINTS.REQUERIMIENTO_UPDATE, body);
    log("updateReqStatus() → resp:", res);
    return res?.data ?? res;
  }

  async function hasAtLeastOneProcesoAndTask(reqId) {
    log("hasAtLeastOneProcesoAndTask() → start", { reqId: Number(reqId) });
    try {
      const p = await postJSON(ENDPOINTS.PROCESOS_LIST, {
        requerimiento_id: Number(reqId),
        status: 1,
        page: 1,
        page_size: 50,
      });
      log("hasAtLeastOneProcesoAndTask() → PROCESOS_LIST resp:", p);
      const procesos = Array.isArray(p?.data) ? p.data : [];
      for (const pr of procesos) {
        const t = await postJSON(ENDPOINTS.TAREAS_LIST, {
          proceso_id: Number(pr.id),
          page: 1,
          page_size: 50,
        });
        log(
          "hasAtLeastOneProcesoAndTask() → TAREAS_LIST resp proceso",
          pr.id,
          t
        );
        const tareas = Array.isArray(t?.data) ? t.data : [];
        if (tareas.length > 0) {
          log(
            "hasAtLeastOneProcesoAndTask() → proceso con tareas, devolviendo true",
            { proceso_id: pr.id, tareas: tareas.length }
          );
          return true;
        }
      }
      log("hasAtLeastOneProcesoAndTask() → no hay procesos con tareas, false");
      return false;
    } catch (e) {
      warn("hasAtLeastOneProcesoAndTask() → error:", e);
      return false;
    }
  }

  function makeBtn(txt, cls = "", act = "") {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `btn-xs ${cls}`.trim();
    b.textContent = txt;
    b.dataset.act = act;
    return b;
  }
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
    log("renderActions() → status code:", code);
    wrap.innerHTML = "";
    getButtonsForStatus(code).forEach((b) => {
      b.addEventListener("click", () => onAction(b.dataset.act));
      wrap.appendChild(b);
    });
  }

  // Inserta / quita el botón "Finalizar requerimiento" según el estado real
  async function injectFinalizeButtonIfReady() {
    const wrap = $("#req-actions");
    if (!wrap) {
      warn("injectFinalizeButtonIfReady() → no existe #req-actions");
      return;
    }

    const existing = wrap.querySelector('[data-act="finish-req"]');
    const status = getCurrentStatusCode();
    const id = __CURRENT_REQ_ID__;

    log("injectFinalizeButtonIfReady() → inicio", {
      status,
      reqId: id,
      hasExistingBtn: !!existing,
    });

    // Solo tiene sentido en PROCESO (3)
    if (status !== 3) {
      log(
        "injectFinalizeButtonIfReady() → status distinto de 3, removiendo botón si existe"
      );
      if (existing) existing.remove();
      return;
    }

    if (!id) {
      warn("injectFinalizeButtonIfReady() → no hay __CURRENT_REQ_ID__");
      return;
    }

    const ready = await areAllProcesosAndTasksDone(id);
    log("injectFinalizeButtonIfReady() → resultado areAllProcesosAndTasksDone:", {
      ready,
    });

    if (!ready) {
      if (existing) {
        log(
          "injectFinalizeButtonIfReady() → ready=false, removiendo botón existente"
        );
        existing.remove();
      }
      return;
    }

    // Ya estaba puesto
    if (existing) {
      log("injectFinalizeButtonIfReady() → botón ya existe, no se duplica");
      return;
    }

    log("injectFinalizeButtonIfReady() → creando botón Finalizar requerimiento");

    const btn = makeBtn("Finalizar requerimiento", "success", "finish-req");
    btn.dataset.act = "finish-req";
    btn.addEventListener("click", () => onAction("finish-req"));
    wrap.appendChild(btn);
  }

  async function askMotivo(titulo = "Motivo") {
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
      const closeBtn = overlay.querySelector(".modal-close");
      if (closeBtn) closeBtn.addEventListener("click", onClose);

      const onOverlayClick = (e) => {
        if (e.target === overlay) onClose();
      };
      overlay.addEventListener("click", onOverlayClick);

      function cleanup() {
        form.removeEventListener("submit", onSubmit);
        if (closeBtn) closeBtn.removeEventListener("click", onClose);
        overlay.removeEventListener("click", onOverlayClick);
        overlay.setAttribute("aria-hidden", "true");
        document.body.classList.remove("me-modal-open");
      }
    });
  }

  async function onAction(act) {
    let next = getCurrentStatusCode();
    const id = __CURRENT_REQ_ID__;
    if (!id) {
      toast("No hay id de requerimiento en la URL", "danger");
      return;
    }

    log("onAction() →", { act, currentStatus: next, reqId: id });

    let didUpdate = false;

    try {
      if (act === "start-revision") {
        next = 1;
        await updateReqStatus({ id, estatus: next });
        didUpdate = true;
        updateStatusUI(next);
        toast("Estado cambiado a Revisión", "info");
      } else if (act === "assign-dept") {
        next = 2;
        await updateReqStatus({ id, estatus: next });
        didUpdate = true;
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
        didUpdate = true;
        updateStatusUI(next);
        toast("Proceso iniciado", "success");
      } else if (act === "pause") {
        const motivo = await askMotivo("Motivo de la pausa");
        next = 4;

        // 1) Actualizamos estatus del requerimiento
        await updateReqStatus({ id, estatus: next, motivo });

        // 2) Creamos nuevo motivo CCP (tipo 1 = pausa, status 1 = activo)
        try {
          await upsertCCP({
            requerimiento_id: id,
            comentario: motivo,
            tipo: 1, // PAUSA
            status: 1,
          });
        } catch (e) {
          warn("[CCP] no se pudo guardar motivo de pausa:", e);
        }

        didUpdate = true;
        updateStatusUI(next);
        toast("Pausado", "warn");
      } else if (act === "resume") {
        next = 1;
        await updateReqStatus({ id, estatus: next });

        // Al reanudar, desactivamos el CCP (status 0)
        try {
          await deactivateCCPForReq(id);
        } catch (e) {
          warn("[CCP] no se pudo desactivar CCP al reanudar:", e);
        }

        didUpdate = true;
        updateStatusUI(next);
        toast("Reanudado (Revisión)", "success");
      } else if (act === "cancel") {
        const motivo = await askMotivo("Motivo de la cancelación");
        next = 5;

        // 1) Actualizamos estatus del requerimiento
        await updateReqStatus({ id, estatus: next, motivo });

        // 2) Creamos nuevo motivo CCP (tipo 2 = cancelación, activo)
        try {
          await upsertCCP({
            requerimiento_id: id,
            comentario: motivo,
            tipo: 2, // CANCELACIÓN
            status: 1,
          });
        } catch (e) {
          warn("[CCP] no se pudo guardar motivo de cancelación:", e);
        }

        didUpdate = true;
        updateStatusUI(next);
        toast("Cancelado", "danger");
      } else if (act === "reopen") {
        next = 1;
        await updateReqStatus({ id, estatus: next });

        // Al reabrir desde cancelado, igual desactivamos CCP
        try {
          await deactivateCCPForReq(id);
        } catch (e) {
          warn("[CCP] no se pudo desactivar CCP al reabrir:", e);
        }

        didUpdate = true;
        updateStatusUI(next);
        toast("Reabierto (Revisión)", "info");
      } else if (act === "finish-req") {
        log("onAction('finish-req') → verificando procesos/tareas antes de finalizar");

        const ready = await areAllProcesosAndTasksDone(id);
        log("onAction('finish-req') → ready =", ready);
        if (!ready) {
          toast(
            "Aún hay procesos o tareas pendientes. Revisa la planeación antes de finalizar.",
            "warning"
          );
          return;
        }

        next = 6;
        // updateReqStatus ya setea cerrado_en con now cuando estatus === 6
        await updateReqStatus({ id, estatus: next });

        didUpdate = true;
        updateStatusUI(next);
        toast("Requerimiento finalizado", "success");
      }

      // Si realmente hicimos un update, recargamos el requerimiento completo
      if (didUpdate) {
        log("onAction() → didUpdate = true, recargando UI del requerimiento");
        await reloadReqUI();
        return;
      }
    } catch (e) {
      if (e !== "cancel") {
        err(e);
        toast("No se pudo actualizar el estado.", "danger");
      }
    }

    renderActions(next);
  }

  /* ======================================
   *  Requerimiento: fetch + normalize
   * ======================================*/
  async function getRequerimientoById(id) {
    log("getRequerimientoById() →", id);
    const res = await postJSON(ENDPOINTS.REQUERIMIENTO_GET, { id });
    log("getRequerimientoById() → resp:", res);
    const data = res?.data ?? res;
    const raw = Array.isArray(data) ? data[0] || {} : data || {};

    // Fechas base desde el backend
    const creado_at = String(
      raw.creado_at ?? raw.created_at ?? raw.fecha_creacion ?? ""
    ).trim();
    const fecha_limite =
      raw.fecha_limite != null && raw.fecha_limite !== ""
        ? String(raw.fecha_limite).trim()
        : null;
    const cerrado_en =
      raw.cerrado_en != null && raw.cerrado_en !== ""
        ? String(raw.cerrado_en).trim()
        : null;

    const normalized = {
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

      // Fechas
      creado_at,
      fecha_inicio: fecha_limite, // alias semántico
      fecha_fin: cerrado_en,
      cerrado_en,

      raw,
    };

    log("getRequerimientoById() → normalized:", normalized);
    return normalized;
  }

  /* ======================================
   *  UI: Header/meta + Contacto
   * ======================================*/
  function paintContacto(req) {
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

  // helper simple para folio, por si viene raro
function formatFolio(folio, id) {
  if (folio && /^REQ-\d+$/i.test(String(folio).trim())) {
    return String(folio).trim();
  }
  const digits = String(folio ?? "").match(/\d+/)?.[0];
  if (digits) return "REQ-" + digits.padStart(11, "0");
  if (id != null) return "REQ-" + String(id).padStart(11, "0");
  return "—";
}

function paintHeaderMeta(req) {
  const ddC = $(".exp-meta > div:nth-child(1) dd"); // antes Contacto → ahora Folio
  const ddE = $(".exp-meta > div:nth-child(2) dd"); // antes Encargado → ahora Departamento
  const ddF = $(".exp-meta > div:nth-child(3) dd"); // Fecha de solicitud

  // 1) FOLIO (REQ-000...)
  if (ddC) {
    ddC.textContent = formatFolio(req.folio, req.id);
  }

  // 2) DEPARTAMENTO (SAMAPA ...)
  if (ddE) {
    const depNombre =
      (req.departamento_nombre && req.departamento_nombre.trim()) ||
      (req.raw?.departamento_nombre &&
        String(req.raw.departamento_nombre).trim()) ||
      "—";
    ddE.textContent = depNombre || "—";
  }

  // 3) FECHA DE SOLICITUD (igual que antes)
  if (ddF) {
    ddF.textContent = (req.creado_at || "—").replace("T", " ");
  }
}


  /* ======================================
   *  Comentarios
   * ======================================*/
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
    const res = await postJSON(ENDPOINTS.COMENT_LIST, payload);
    const raw = res?.data ?? res?.items ?? res;
    return Array.isArray(raw) ? raw : Array.isArray(raw?.rows) ? raw.rows : [];
  }
  async function createComentarioAPI({
    requerimiento_id,
    comentario,
    status = 1,
    created_by,
    empleado_id,
  }) {
    const payload = {
      requerimiento_id: Number(requerimiento_id),
      comentario,
      status,
      created_by: Number(created_by),
      empleado_id: empleado_id != null ? Number(empleado_id) : null,
    };
    return await postJSON(ENDPOINTS.COMENT_CREATE, payload);
  }
  const firstTwo = (full = "") =>
    String(full).trim().split(/\s+/).filter(Boolean).slice(0, 2).join(" ") ||
    "—";

  function makeAvatarSourcesByUsuarioId(usuarioId) {
    const v = `?v=${Date.now()}`;
    const cand = [];
    if (usuarioId) {
      cand.push(`/ASSETS/user/userImgs/img_${usuarioId}.png${v}`);
      cand.push(`/ASSETS/user/userImgs/img_${usuarioId}.jpg${v}`);
    }
    cand.push(DEFAULT_AVATAR);
    return cand;
  }

  // === parseo de badges tipo "Tarea-{id}" ===
  function buildCommentTextWithTaskTags(text) {
    const frag = document.createDocumentFragment();
    const str = String(text || "");

    const re = /(Tarea-\d+)/g;
    let lastIndex = 0;
    let match;

    while ((match = re.exec(str)) !== null) {
      const idx = match.index;

      if (idx > lastIndex) {
        frag.appendChild(
          document.createTextNode(str.slice(lastIndex, idx))
        );
      }

      const span = document.createElement("span");
      span.className = "task-tag";
      span.textContent = match[1];
      frag.appendChild(span);

      lastIndex = re.lastIndex;
    }

    if (lastIndex < str.length) {
      frag.appendChild(
        document.createTextNode(str.slice(lastIndex))
      );
    }

    return frag;
  }

  async function renderCommentsList(items = []) {
    const feed = $(".c-feed");
    if (!feed) return;
    feed.innerHTML = "";

    const ordered = [...items].sort((a, b) => {
      const aDate = Date.parse(a.created_at || a.fecha || "") || 0;
      const bDate = Date.parse(b.created_at || b.fecha || "") || 0;
      return bDate - aDate; // descendente (nuevo → viejo)
    });

    for (const r of ordered) {
      let display = "";
      try {
        const empId = Number(r.empleado_id) > 0 ? Number(r.empleado_id) : null;
        if (empId) display = (await getEmpleadoById(empId))?.nombre || "";
      } catch { }
      if (!display) {
        display =
          r.empleado_display ||
          [r.empleado_nombre, r.empleado_apellidos]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          r.nombre ||
          r.autor ||
          "—";
      }
      const texto = r.comentario || r.texto || "";
      const cuando = relShort(r.created_at || r.fecha || "");
      const usuarioId =
        (Number(r.created_by) > 0 && Number(r.created_by)) ||
        (Number(r.cuenta_id) > 0 && Number(r.cuenta_id)) ||
        null;
      const sources = makeAvatarSourcesByUsuarioId(usuarioId);

      const art = document.createElement("article");
      art.className = "msg";

      const img = document.createElement("img");
      img.className = "avatar";
      img.alt = "";
      let i = 0;
      const tryNext = () => {
        if (i >= sources.length) {
          img.src = DEFAULT_AVATAR;
          return;
        }
        img.onerror = () => {
          i++;
          tryNext();
        };
        img.src = sources[i];
      };
      tryNext();
      art.appendChild(img);

      const box = document.createElement("div");
      box.innerHTML = `
        <div class="who">
          <span class="name">${firstTwo(display)}</span>
          <span class="time">${cuando}</span>
        </div>
        <div class="text" style="white-space:pre-wrap;word-break:break-word;"></div>
      `;

      const textEl = $(".text", box);
      textEl.textContent = "";
      textEl.appendChild(buildCommentTextWithTaskTags(texto));

      art.appendChild(box);

      feed.appendChild(art);
    }

    const scroller = feed.parentElement || feed;
    scroller.scrollTo({ top: 0, behavior: "auto" });
  }

  async function loadComentarios(reqId) {
    try {
      const arr = await listComentariosAPI({
        requerimiento_id: reqId,
        status: 1,
        page: 1,
        page_size: 100,
      });
      const ids = Array.from(
        new Set(arr.map((r) => Number(r.empleado_id) || null).filter(Boolean))
      );
      await Promise.all(ids.map((id) => getEmpleadoById(id).catch(() => null)));
      await renderCommentsList(arr);
    } catch (e) {
      warn("Error listando comentarios:", e);
      await renderCommentsList([]);
    }
  }

  function interceptComposer(reqId) {
    const ta = $(".composer textarea");
    const btn = $(".composer .send-fab");
    if (!ta || !btn) return;
    const { usuario_id, empleado_id } = getUserAndEmpleadoFromSession();
    const send = async () => {
      const texto = (ta.value || "").trim();
      if (!texto) return;
      if (!usuario_id) {
        toast("No se encontró tu usuario en la sesión.", "danger");
        return;
      }
      btn.disabled = true;
      try {
        await createComentarioAPI({
          requerimiento_id: reqId,
          comentario: texto,
          status: 1,
          created_by: usuario_id,
          empleado_id: empleado_id,
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
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      send();
    });
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
  }

  /* ======================================
   *  Reset + Boot
   * ======================================*/
  function resetTemplate() {
    const contactVals = $$('.exp-pane[data-tab="Contacto"] .exp-grid .exp-val');
    contactVals.forEach((n) => {
      const a = n.querySelector("a");
      if (a) {
        a.textContent = "—";
        a.removeAttribute("href");
      } else n.textContent = "—";
    });

    const h1 = $(".exp-title h1");
    if (h1) h1.textContent = "—";
    $$(".exp-meta dd").forEach((dd) => (dd.textContent = "—"));
    const feed = $(".c-feed");
    if (feed) feed.innerHTML = "";
  }

  let __CURRENT_REQ_ID__ = null;
  window.__defineGetter__ &&
    Object.defineProperty(window, "__CURRENT_REQ_ID__", {
      get: () => __CURRENT_REQ_ID__,
    });

  async function boot() {
    resetTemplate();

    const stepItems = $$(".step-menu li");
    stepItems.forEach((li) => {
      // click desactivado, status se controla por backend
    });

    const params = new URL(window.location.href).searchParams;
    const reqId = params.get("id");
    __CURRENT_REQ_ID__ = reqId;
    log("boot() → reqId desde URL:", reqId);
    if (!reqId) {
      warn("Sin ?id=");
      return;
    }

    try {
      const req = await getRequerimientoById(reqId);

      const h1 = $(".exp-title h1");
      if (h1)
        h1.textContent = req.asunto || req.tramite_nombre || "Requerimiento";
      paintHeaderMeta(req);
      paintContacto(req);

      updateStatusUI(req.estatus_code);
      const sel = $('#req-status [data-role="status-select"]');
      if (sel) sel.value = String(req.estatus_code ?? 0);

      log("boot() → estatus inicial:", req.estatus_code);

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
    await injectFinalizeButtonIfReady();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else boot();
})();
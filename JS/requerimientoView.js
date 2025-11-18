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
  const toast = (m, t = "info") => (window.gcToast ? gcToast(m, t) : log("[toast]", t, m));

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
    CCP_LIST: "/db/WEB/ixtla01_c_ccp.php",
    CCP_INSERT: "/db/WEB/ixtla01_i_ccp.php",
    CCP_UPDATE: "/db/WEB/ixtla01_u_ccp.php",
  };

  /* ======================================
   *  Fetch helper genérico
   * ======================================*/
  async function postJSON(url, body) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const txt = await res.text();
      let json = null;
      try { json = JSON.parse(txt); } catch { /* texto plano */ }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return json;
    } catch (e) { throw e; }
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
    } catch (e) {
      warn("No se pudo leer cookie ix_emp:", e);
      return null;
    }
  }

  function getUserAndEmpleadoFromSession() {
    const payload = readCookiePayload();
    if (!payload || typeof payload !== "object") return { usuario_id: null, empleado_id: null };
    const usuario_id = payload.usuario_id != null ? Number(payload.usuario_id) : null;
    const empleado_id = payload.empleado_id != null ? Number(payload.empleado_id) : null;
    return { usuario_id, empleado_id };
  }

  /* ======================================
   *  Avatares (por usuario)
   * ======================================*/
  function makeAvatarSourcesByUsuarioId(usuarioId) {
    const id = Number(usuarioId);
    if (!id) return [DEFAULT_AVATAR];
    return [
      `/ASSETS/user/img_user${id}.webp`,
      `/ASSETS/user/img_user${id}.png`,
      `/ASSETS/user/img_user${id}.jpg`,
      DEFAULT_AVATAR,
    ];
  }

  /* ======================================
   *  Empleados (cache mín.)
   * ======================================*/
  const EMP_CACHE = new Map();
  async function getEmpleadoById(id) {
    const key = Number(id); if (!key) return null;
    if (EMP_CACHE.has(key)) return EMP_CACHE.get(key);
    const res = await postJSON(ENDPOINTS.EMPLEADOS_GET, { id: key, status: 1 });
    const payload = res?.data ?? res;
    let emp = null;
    if (Array.isArray(payload)) {
      emp = payload.find((e) => Number(e?.id ?? e?.empleado_id) === key) || payload[0] || null;
    } else if (payload && typeof payload === "object") emp = payload;

    const nombre = [emp?.nombre, emp?.nombres, emp?.empleado_nombre, emp?.first_name].find(Boolean) || "";
    const apellidos = [emp?.apellidos, emp?.empleado_apellidos, emp?.last_name].find(Boolean) || "";
    const out = {
      id: key,
      nombre: [nombre, apellidos].filter(Boolean).join(" ").trim() || "—",
      avatar: emp?.avatar_url || emp?.foto_url || emp?.img || emp?.imagen || null,
      departamento_id: emp?.departamento_id ?? null,
    };
    EMP_CACHE.set(key, out);
    return out;
  }

  /* ======================================
   *  UI: Stepper / estatus (se quedan aquí)
   * ======================================*/
  const statusLabel = (s) => ({
    0: "Solicitud", 1: "Revisión", 2: "Asignación",
    3: "Proceso",   4: "Pausado",  5: "Cancelado", 6: "Finalizado",
  }[Number(s)] || "—");

  const statusBadgeClass = (s) => ({
    0: "is-muted", 1: "is-info", 2: "is-info",
    3: "is-info",  4: "is-warning", 5: "is-danger", 6: "is-success",
  }[Number(s)] || "is-info");

  function paintStepper(next) {
    $$(".step-menu li").forEach((li) => {
      const s = Number(li.dataset.status);
      li.classList.remove("is-current", "is-done");
      if (s < next) li.classList.add("is-done");
      else if (s === next) li.classList.add("is-current");
    });
  }

  function getCurrentStatusCode() {
    const badge = $('#req-status [data-role="status-badge"]');
    if (!badge) return 0;
    const sel = $('#req-status [data-role="status-select"]');
    if (sel && sel.value) return Number(sel.value);
    const txt = (badge.textContent || "").trim().toLowerCase();
    const map = {
      "solicitud": 0, "revisión": 1, "revision": 1, "asignación": 2, "asignacion": 2,
      "proceso": 3, "pausado": 4, "cancelado": 5, "finalizado": 6,
    };
    return map[txt] ?? 0;
  }

  function updateStatusUI(code) {
    const badge = $('#req-status [data-role="status-badge"]');
    if (badge) {
      badge.classList.remove("is-info", "is-muted", "is-warning", "is-danger", "is-success");
      badge.classList.add(statusBadgeClass(code));
      badge.textContent = statusLabel(code);
    }
    const sel = $('#req-status [data-role="status-select"]');
    if (sel) sel.value = String(code);
    paintStepper(code);
  }

  /* ======================================
   *  Acciones de estatus
   * ======================================*/
  function makeBtn(label, tone, act) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-xs";
    if (tone === "primary") btn.classList.add("is-primary");
    else if (tone === "danger") btn.classList.add("is-danger");
    else if (tone === "warn" || tone === "warning") btn.classList.add("is-warning");
    btn.dataset.act = act;
    btn.textContent = label;
    return btn;
  }

  function getButtonsForStatus(code) {
    switch (Number(code)) {
      case 0:
        // Solicitud
        return [
          makeBtn("Iniciar revisión", "primary", "start-revision"),
          makeBtn("Cancelar", "danger", "cancel"),
        ];
      case 1:
        // Revisión
        return [
          makeBtn("Pausar", "warn", "pause"),
          makeBtn("Cancelar", "danger", "cancel"),
          makeBtn("Asignar a departamento", "", "assign-dept"),
        ];
      case 2:
        // Asignación
        return [
          makeBtn("Pausar", "warn", "pause"),
          makeBtn("Cancelar", "danger", "cancel"),
          makeBtn("Iniciar proceso", "primary", "start-process"),
        ];
      case 3:
        // Proceso
        return [
          makeBtn("Pausar", "warn", "pause"),
          makeBtn("Cancelar", "danger", "cancel"),
        ];
      case 4:
        // Pausado
        return [
          makeBtn("Reanudar", "primary", "resume"),
          makeBtn("Cancelar", "danger", "cancel"),
        ];
      case 5:
        // Cancelado
        return [makeBtn("Reabrir", "primary", "reopen")];
      case 6:
        // Finalizado
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
      overlay.classList.add("is-open");
      txt.focus();

      const close = () => {
        overlay.classList.remove("is-open");
        overlay.setAttribute("aria-hidden", "true");
      };

      const onSubmit = (ev) => {
        ev.preventDefault();
        const v = (txt.value || "").trim();
        if (!v) return;
        form.removeEventListener("submit", onSubmit);
        btnCancel.removeEventListener("click", onCancel);
        close();
        resolve(v);
      };
      const onCancel = () => {
        form.removeEventListener("submit", onSubmit);
        btnCancel.removeEventListener("click", onCancel);
        close();
        reject("cancel");
      };

      const btnCancel = $("#estado-cancel");
      form.addEventListener("submit", onSubmit);
      if (btnCancel) btnCancel.addEventListener("click", onCancel);
    });
  }

  async function updateReqStatus({ id, estatus/*, motivo*/ }) {
    const { empleado_id } = getUserAndEmpleadoFromSession();
    const body = { id: Number(id), estatus: Number(estatus), updated_by: empleado_id || null };
    const res = await postJSON(ENDPOINTS.REQUERIMIENTO_UPDATE, body);
    return res?.data ?? res;
  }

  // Registra motivo de pausa/cancelación en CCP
  async function createMotivoCCP({ requerimiento_id, tipo, comentario }) {
    const { empleado_id } = getUserAndEmpleadoFromSession();
    const payload = {
      requerimiento_id: Number(requerimiento_id),
      empleado_id: empleado_id || null,
      tipo: Number(tipo),
      comentario: String(comentario || "").trim(),
      status: 1,
      created_by: empleado_id || null,
    };
    const res = await postJSON(ENDPOINTS.CCP_INSERT, payload);
    if (res && res.ok === false) {
      throw new Error(res.error || "Error registrando motivo");
    }
    return res;
  }

  async function hasAtLeastOneProcesoAndTask(reqId) {
    try {
      const resP = await postJSON(ENDPOINTS.PROCESOS_LIST, { requerimiento_id: Number(reqId), status: 1 });
      const procesos = resP?.data ?? resP?.rows ?? resP ?? [];
      if (!Array.isArray(procesos) || procesos.length === 0) return false;
      const anyProcesoId = Number(procesos[0]?.id ?? procesos[0]?.proceso_id ?? 0);
      if (!anyProcesoId) return false;
      const resT = await postJSON(ENDPOINTS.TAREAS_LIST, { proceso_id: anyProcesoId, status: 1 });
      const tareas = resT?.data ?? resT?.rows ?? resT ?? [];
      return Array.isArray(tareas) && tareas.length > 0;
    } catch (e) {
      warn("Error verificando procesos/tareas:", e);
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

    try {
      if (act === "start-revision") {
        // 0 -> 1
        next = 1;
        await updateReqStatus({ id, estatus: next });
        updateStatusUI(next);
        toast("Estado cambiado a Revisión", "info");
      } else if (act === "assign-dept") {
        // 1 -> 2
        next = 2;
        await updateReqStatus({ id, estatus: next });
        updateStatusUI(next);
        toast("Asignado a departamento", "success");
      } else if (act === "start-process") {
        // 2 -> 3 (requiere al menos un proceso y una tarea)
        const ok = await hasAtLeastOneProcesoAndTask(id);
        if (!ok) {
          toast("Para iniciar proceso necesitas al menos un proceso y una tarea.", "warning");
          return;
        }
        next = 3;
        await updateReqStatus({ id, estatus: next });
        updateStatusUI(next);
        toast("Proceso iniciado", "success");
      } else if (act === "pause") {
        // Crea motivo tipo 2 (pausa) y cambia a 4
        const motivo = await askMotivo("Motivo de la pausa");
        if (!motivo) return;
        await createMotivoCCP({ requerimiento_id: id, tipo: 2, comentario: motivo });
        next = 4;
        await updateReqStatus({ id, estatus: next });
        updateStatusUI(next);
        toast("Pausado", "warn");
      } else if (act === "resume") {
        // 4 -> 1 (Revisión)
        next = 1;
        await updateReqStatus({ id, estatus: next });
        updateStatusUI(next);
        toast("Reanudado (Revisión)", "success");
      } else if (act === "cancel") {
        // Crea motivo tipo 1 (cancelación) y cambia a 5
        const motivo = await askMotivo("Motivo de la cancelación");
        if (!motivo) return;
        await createMotivoCCP({ requerimiento_id: id, tipo: 1, comentario: motivo });
        next = 5;
        await updateReqStatus({ id, estatus: next });
        updateStatusUI(next);
        toast("Cancelado", "danger");
      } else if (act === "reopen") {
        // 5/6 -> 1
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

  /* ======================================
   *  Requerimiento: fetch + normalize
   * ======================================*/
  async function getRequerimientoById(id) {
    const res = await postJSON(ENDPOINTS.REQUERIMIENTO_GET, { id });
    const data = res?.data ?? res;
    const raw = Array.isArray(data) ? data[0] || {} : data || {};

    const estatus =
      raw.estatus != null ? Number(raw.estatus) :
      raw.status  != null ? Number(raw.status)  : 0;

    return {
      id: String(raw.id ?? raw.requerimiento_id ?? ""),
      folio: String(raw.folio ?? ""),
      departamento_id: raw.departamento_id != null ? Number(raw.departamento_id) : null,
      departamento_nombre: String(raw.departamento_nombre || "").trim(),
      tramite_id: raw.tramite_id != null ? Number(raw.tramite_id) : null,
      tramite_nombre: String(raw.tramite_nombre || "").trim(),
      asignado_id: raw.asignado_a != null ? String(raw.asignado_a) : null,
      asignado_full: String(raw.asignado_nombre_completo || "").trim(),
      asunto: String(raw.asunto || "").trim(),
      descripcion: String(raw.descripcion || "").trim(),
      prioridad: raw.prioridad != null ? Number(raw.prioridad) : null,
      estatus_code: estatus,
      canal: raw.canal != null ? Number(raw.canal) : null,
      contacto_nombre: String(raw.contacto_nombre || "").trim(),
      contacto_telefono: String(raw.contacto_telefono || "").trim(),
      contacto_email: String(raw.contacto_email || "").trim(),
      contacto_calle: String(raw.contacto_calle || "").trim(),
      contacto_colonia: String(raw.contacto_colonia || "").trim(),
      contacto_cp: String(raw.contacto_cp || "").trim(),
      fecha_limite: raw.fecha_limite ? String(raw.fecha_limite).trim() : null,
      creado_at: String(raw.created_at || "").trim(),
      cerrado_en: raw.cerrado_en ? String(raw.cerrado_en).trim() : null,
      raw,
    };
  }

  /* ======================================
   *  UI: Header/meta + Contacto (se quedan)
   * ======================================*/
  function paintContacto(req) {
    const p = $('.exp-pane[role="tabpanel"][data-tab="Contacto"] .exp-grid');
    if (!p) return;
    const set = (labelText, val) => {
      const row = Array.from(p.querySelectorAll(".exp-field")).find((r) => {
        const txt = (r.querySelector("label")?.textContent || "").trim().toLowerCase();
        return txt.startsWith(labelText.toLowerCase());
      });
      const dd = row?.querySelector(".exp-val");
      if (!dd) return;
      if (labelText.toLowerCase().includes("correo") && val && val !== "—") {
        dd.innerHTML = "";
        const a = document.createElement("a");
        a.href = `mailto:${val}`;
        a.textContent = val;
        dd.appendChild(a);
      } else if (labelText.toLowerCase().includes("teléfono") && val && val !== "—") {
        dd.innerHTML = "";
        const a = document.createElement("a");
        a.href = `tel:${val}`;
        a.textContent = val;
        dd.appendChild(a);
      } else {
        dd.textContent = val || "—";
      }
    };

    set("Nombre", req.contacto_nombre || "—");
    set("Teléfono", req.contacto_telefono || "—");
    set("Correo", req.contacto_email || "—");
    set("Calle", req.contacto_calle || "—");
    set("Colonia", req.contacto_colonia || "—");
    set("C.P.", req.contacto_cp || "—");
  }

  function paintHeader(req) {
    const h1 = $(".exp-title h1");
    if (h1) h1.textContent = req.asunto || "—";
    const meta = $$(".exp-meta dd");
    if (meta[0]) meta[0].textContent = req.contacto_nombre || "—";
    if (meta[1]) meta[1].textContent = req.asignado_full || "—";
    if (meta[2]) meta[2].textContent = req.creado_at || "—";
  }

  /* ======================================
   *  Comentarios (se quedan tal cual + orden)
   * ======================================*/
  async function listComentariosAPI({ requerimiento_id, status = 1, page = 1, page_size = 100 }) {
    const payload = { requerimiento_id: Number(requerimiento_id), status, page, page_size };
    const res = await postJSON(ENDPOINTS.COMENT_LIST, payload);
    const raw = res?.data ?? res?.items ?? res;
    return Array.isArray(raw) ? raw : Array.isArray(raw?.rows) ? raw.rows : [];
  }

  async function createComentarioAPI({ requerimiento_id, comentario, status = 1, created_by, empleado_id }) {
    const payload = {
      requerimiento_id: Number(requerimiento_id),
      comentario,
      status,
      created_by: Number(created_by),
      empleado_id: empleado_id != null ? Number(empleado_id) : null,
    };
    const res = await postJSON(ENDPOINTS.COMENT_CREATE, payload);
    return res?.data ?? res;
  }

  async function renderCommentsList(items = []) {
    const feed = $(".c-feed");
    if (!feed) return;
    feed.innerHTML = "";

    for (const r of items) {
      let display = "";
      try {
        const empId = Number(r.empleado_id) > 0 ? Number(r.empleado_id) : null;
        if (empId) display = (await getEmpleadoById(empId))?.nombre || "";
      } catch {}
      if (!display) {
        display = r.empleado_display ||
          [r.empleado_nombre, r.empleado_apellidos].filter(Boolean).join(" ").trim() ||
          r.nombre || r.autor || "—";
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
      img.className = "avatar"; img.alt = "";
      let i = 0;
      const tryNext = () => {
        if (i >= sources.length) { img.src = DEFAULT_AVATAR; return; }
        img.onerror = () => { i++; tryNext(); };
        img.src = sources[i];
      };
      tryNext();

      art.appendChild(img);
      const box = document.createElement("div");
      box.innerHTML = `
        <div class="who"><span class="name">${firstTwo(display)}</span> <span class="time">${cuando}</span></div>
        <div class="text" style="white-space:pre-wrap;word-break:break-word;"></div>
      `;
      $(".text", box).textContent = texto;
      art.appendChild(box);
      feed.appendChild(art);
    }
    const scroller = feed.parentElement || feed;
    scroller.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function loadComentarios(reqId) {
    try {
      const arr = await listComentariosAPI({
        requerimiento_id: reqId,
        status: 1,
        page: 1,
        page_size: 100,
      });

      // Ordenar de más reciente a más antiguo
      const ordered = [...arr].sort((a, b) => {
        const da = Date.parse(a.created_at || a.creado_en || a.fecha || "") || 0;
        const db = Date.parse(b.created_at || b.creado_en || b.fecha || "") || 0;
        if (db !== da) return db - da;
        const ida = Number(a.id || a.comentario_id || 0);
        const idb = Number(b.id || b.comentario_id || 0);
        return idb - ida;
      });

      const ids = Array.from(
        new Set(ordered.map((r) => Number(r.empleado_id) || null).filter(Boolean))
      );
      await Promise.all(ids.map((id) => getEmpleadoById(id).catch(() => null)));
      await renderCommentsList(ordered);
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
      if (!usuario_id) { toast("No se encontró tu usuario en la sesión.", "danger"); return; }
      btn.disabled = true;
      try {
        await createComentarioAPI({
          requerimiento_id: reqId,
          comentario: texto,
          status: 1,
          created_by: usuario_id,
          empleado_id,
        });
        ta.value = "";
        await loadComentarios(reqId);
      } catch (e) {
        err("Error creando comentario:", e);
        toast("No se pudo enviar el comentario.", "danger");
      } finally {
        btn.disabled = false;
      }
    };
    btn.addEventListener("click", send);
    ta.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        send();
      }
    });
  }

  /* ======================================
   *  Limpieza / fallback (sin reqId)
   * ======================================*/
  function clearAll() {
    const contactVals = $$('.exp-pane[role="tabpanel"][data-tab="Contacto"] .exp-val');
    contactVals.forEach((n) => {
      const a = n.querySelector("a");
      if (a) { a.textContent = "—"; a.removeAttribute("href"); }
      else n.textContent = "—";
    });

    // No tocamos el tab "detalles" aquí (lo rellenará el nuevo modulo)

    const h1 = $(".exp-title h1"); if (h1) h1.textContent = "—";
    $$(".exp-meta dd").forEach((dd) => (dd.textContent = "—"));
    const feed = $(".c-feed"); if (feed) feed.innerHTML = "";
  }

  let __CURRENT_REQ_ID__ = null;
  window.__defineGetter__("REQ_VIEW_ID", () => __CURRENT_REQ_ID__);

  /* ======================================
   *  Boot
   * ======================================*/
  async function boot() {
    try {
      const params = new URLSearchParams(window.location.search);
      const reqId = params.get("id") || params.get("req") || params.get("requerimiento");
      if (!reqId) {
        warn("Sin id de requerimiento en la URL");
        clearAll();
        return;
      }
      __CURRENT_REQ_ID__ = String(reqId);
      log("[Boot] reqId:", __CURRENT_REQ_ID__);

      const req = await getRequerimientoById(__CURRENT_REQ_ID__);
      log("[API] REQUERIMIENTO_GET →", req);

      paintHeader(req);
      paintContacto(req);
      updateStatusUI(req.estatus_code);
      renderActions(req.estatus_code);
      paintStepper(req.estatus_code);

      // Comentarios
      await loadComentarios(__CURRENT_REQ_ID__);
      interceptComposer(__CURRENT_REQ_ID__);
    } catch (e) {
      err("Error en boot():", e);
      toast("No se pudo cargar el requerimiento.", "danger");
      clearAll();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

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
  };

  /* ======================================
   *  HTTP helper
   * ======================================*/
  async function postJSON(url, body) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body || {}),
      });
      const txt = await res.text();
      let json; try { json = JSON.parse(txt); } catch { json = { raw: txt }; }
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
    } catch { return null; }
  }
  function safeGetSession() {
    try { if (window.Session?.get) return window.Session.get(); } catch {}
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
      li.classList.remove("current");
      if (s < next) li.classList.add("complete"); else li.classList.remove("complete");
      if (s === next) li.classList.add("current");
    });
  }
  function getCurrentStatusCode() {
    const cur = $(".step-menu li.current");
    return cur ? Number(cur.getAttribute("data-status")) : 0;
  }
  function updateStatusUI(code) {
    code = Number(code);
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
  async function updateReqStatus({ id, estatus, motivo }) {
    const { empleado_id } = getUserAndEmpleadoFromSession();
    const body = { id: Number(id), estatus: Number(estatus), updated_by: empleado_id || null };
    if (motivo) body.motivo = String(motivo).trim();
    const res = await postJSON(ENDPOINTS.REQUERIMIENTO_UPDATE, body);
    return res?.data ?? res;
  }

  async function hasAtLeastOneProcesoAndTask(reqId) {
    try {
      const p = await postJSON(ENDPOINTS.PROCESOS_LIST, {
        requerimiento_id: Number(reqId), status: 1, page: 1, page_size: 50,
      });
      const procesos = Array.isArray(p?.data) ? p.data : [];
      for (const pr of procesos) {
        const t = await postJSON(ENDPOINTS.TAREAS_LIST, {
          proceso_id: Number(pr.id), status: 1, page: 1, page_size: 50,
        });
        const tareas = Array.isArray(t?.data) ? t.data : [];
        if (tareas.length > 0) return true;
      }
      return false;
    } catch { return false; }
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
      case 0: return [makeBtn("Iniciar revisión","primary","start-revision"), makeBtn("Cancelar","danger","cancel")];
      case 1: return [makeBtn("Pausar","warn","pause"), makeBtn("Cancelar","danger","cancel"), makeBtn("Asignar a departamento","","assign-dept")];
      case 2: return [makeBtn("Pausar","warn","pause"), makeBtn("Cancelar","danger","cancel"), makeBtn("Iniciar proceso","primary","start-process")];
      case 3: return [makeBtn("Pausar","warn","pause"), makeBtn("Cancelar","danger","cancel")];
      case 4: return [makeBtn("Reanudar","primary","resume"), makeBtn("Cancelar","danger","cancel")];
      case 5: return [makeBtn("Reabrir","primary","reopen")];
      case 6: return [makeBtn("Reabrir","primary","reopen")];
      default: return [makeBtn("Iniciar revisión","primary","start-revision")];
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
      document.body.classList.add("me-modal-open");
      const onSubmit = (e) => {
        e.preventDefault();
        const v = txt.value.trim();
        if (!v) return txt.focus();
        cleanup(); resolve(v);
      };
      const onClose = () => { cleanup(); reject("cancel"); };
      form.addEventListener("submit", onSubmit);
      overlay.querySelector(".modal-close")?.addEventListener("click", onClose);
      overlay.addEventListener("click", (e) => { if (e.target === overlay) onClose(); });
      function cleanup() {
        form.removeEventListener("submit", onSubmit);
        overlay.querySelector(".modal-close")?.removeEventListener("click", onClose);
        overlay.removeEventListener("click", onClose);
        overlay.setAttribute("aria-hidden", "true");
        document.body.classList.remove("me-modal-open");
      }
    });
  }

  async function onAction(act) {
    let next = getCurrentStatusCode();
    const id = __CURRENT_REQ_ID__;
    if (!id) { toast("No hay id de requerimiento en la URL", "danger"); return; }

    try {
      if (act === "start-revision") {
        next = 1; await updateReqStatus({ id, estatus: next }); updateStatusUI(next); toast("Estado cambiado a Revisión", "info");
      } else if (act === "assign-dept") {
        next = 2; await updateReqStatus({ id, estatus: next }); updateStatusUI(next); toast("Asignado a departamento", "success");
      } else if (act === "start-process") {
        const ok = await hasAtLeastOneProcesoAndTask(id);
        if (!ok) { toast("Para iniciar proceso necesitas al menos un proceso y una tarea.","warning"); return; }
        next = 3; await updateReqStatus({ id, estatus: next }); updateStatusUI(next); toast("Proceso iniciado","success");
      } else if (act === "pause") {
        const motivo = await askMotivo("Motivo de la pausa");
        next = 4; await updateReqStatus({ id, estatus: next, motivo }); updateStatusUI(next); toast("Pausado","warn");
      } else if (act === "resume") {
        next = 1; await updateReqStatus({ id, estatus: next }); updateStatusUI(next); toast("Reanudado (Revisión)","success");
      } else if (act === "cancel") {
        const motivo = await askMotivo("Motivo de la cancelación");
        next = 5; await updateReqStatus({ id, estatus: next, motivo }); updateStatusUI(next); toast("Cancelado","danger");
      } else if (act === "reopen") {
        next = 1; await updateReqStatus({ id, estatus: next }); updateStatusUI(next); toast("Reabierto (Revisión)","info");
      }
    } catch (e) {
      if (e !== "cancel") { err(e); toast("No se pudo actualizar el estado.","danger"); }
    }
    renderActions(next);
  }

  /* ======================================
   *  Requerimiento: fetch + normalize
   * (se mantiene aquí; Detalles se pinta en módulo aparte)
   * ======================================*/
  async function getRequerimientoById(id) {
    const res = await postJSON(ENDPOINTS.REQUERIMIENTO_GET, { id });
    const data = res?.data ?? res;
    const raw = Array.isArray(data) ? data[0] || {} : data || {};
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
      estatus_code: raw.estatus != null ? Number(raw.estatus) :
                    raw.status  != null ? Number(raw.status)  : 0,
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
      if (labelText.toLowerCase().includes("correo")) {
        const a = dd.querySelector("a") || document.createElement("a");
        a.textContent = val || "—";
        if (val) a.href = `mailto:${val}`; else a.removeAttribute("href");
        if (!dd.contains(a)) { dd.innerHTML = ""; dd.appendChild(a); }
      } else {
        dd.textContent = val || "—";
      }
    };
    set("Nombre", req.contacto_nombre || "—");
    set("Teléfono", req.contacto_telefono || "—");
    set("Dirección del reporte", [req.contacto_calle, req.contacto_colonia].filter(Boolean).join(", "));
    set("Correo", req.contacto_email || "—");
    set("C.P", req.contacto_cp || "—");
  }

  function paintHeaderMeta(req) {
    const ddC = $(".exp-meta > div:nth-child(1) dd");
    const ddE = $(".exp-meta > div:nth-child(2) dd");
    const ddF = $(".exp-meta > div:nth-child(3) dd");
    if (ddC) ddC.textContent = req.contacto_nombre || "—";
    const asignado = req.asignado_id && (req.asignado_full || "").trim() ? req.asignado_full : "Sin asignar";
    if (ddE) ddE.textContent = asignado;
    if (ddF) ddF.textContent = (req.creado_at || "—").replace("T", " ");
  }

  /* ======================================
   *  Comentarios (se quedan tal cual)
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
    return await postJSON(ENDPOINTS.COMENT_CREATE, payload);
  }
  const firstTwo = (full = "") => String(full).trim().split(/\s+/).filter(Boolean).slice(0, 2).join(" ") || "—";
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
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
  }
  async function loadComentarios(reqId) {
    try {
      const arr = await listComentariosAPI({ requerimiento_id: reqId, status: 1, page: 1, page_size: 100 });
      const ids = Array.from(new Set(arr.map((r) => Number(r.empleado_id) || null).filter(Boolean)));
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
      if (!usuario_id) { toast("No se encontró tu usuario en la sesión.", "danger"); return; }
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
    btn.addEventListener("click", (e) => { e.preventDefault(); send(); });
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });
  }

  /* ======================================
   *  Reset + Boot
   * ======================================*/
  function resetTemplate() {
    const contactVals = $$('.exp-pane[data-tab="Contacto"] .exp-grid .exp-val');
    contactVals.forEach((n) => {
      const a = n.querySelector("a");
      if (a) { a.textContent = "—"; a.removeAttribute("href"); }
      else n.textContent = "—";
    });

    // No tocamos el tab "detalles" aquí (lo rellenará el nuevo módulo)

    const h1 = $(".exp-title h1"); if (h1) h1.textContent = "—";
    $$(".exp-meta dd").forEach((dd) => (dd.textContent = "—"));
    const feed = $(".c-feed"); if (feed) feed.innerHTML = "";
  }

  let __CURRENT_REQ_ID__ = null;
  window.__defineGetter__ && Object.defineProperty(window, "__CURRENT_REQ_ID__", {
    get: () => __CURRENT_REQ_ID__,
  });

  async function boot() {
    resetTemplate();

    // stepper (UI deja estatus en este archivo)
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
    if (!reqId) { warn("Sin ?id="); return; }

    try {
      const req = await getRequerimientoById(reqId);

      // Título y meta + contacto
      const h1 = $(".exp-title h1");
      if (h1) h1.textContent = req.asunto || req.tramite_nombre || "Requerimiento";
      paintHeaderMeta(req);
      paintContacto(req);

      // Estatus inicial (badge/select/stepper)
      updateStatusUI(req.estatus_code);
      const sel = $('#req-status [data-role="status-select"]');
      if (sel) sel.value = String(req.estatus_code ?? 0);

      // Aviso a otros módulos (Detalles, Planeación, Evidencias…)
      try {
        window.__REQ__ = req;
        document.dispatchEvent(new CustomEvent("req:loaded", { detail: req }));
      } catch (e) { warn("req:loaded dispatch err:", e); }
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

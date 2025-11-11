// /JS/requerimientoView.js
(function () {
  "use strict";

  /* =====================
   * Helpers
   * ===================*/
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const log = (...a) => console.log("[ReqView]", ...a);
  const warn = (...a) => console.warn("[ReqView][WARN]", ...a);
  const err = (...a) => console.error("[ReqView][ERR]", ...a);
  const toast = (m, t = "info") =>
    window.gcToast ? gcToast(m, t) : console.log("[toast]", t, m);

  const norm = (s = "") =>
    String(s)
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();
  const firstTwo = (full = "") =>
    String(full).trim().split(/\s+/).filter(Boolean).slice(0, 2).join(" ") ||
    "—";

  // Normaliza textos (minúsculas, sin acentos, espacios compactados)
  function _normLabel(s = "") {
    return String(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // set value por label de forma robusta + logs
  function putLabelValue({ gridSel, labelQuery, value, asLink = false }) {
    const grid = document.querySelector(gridSel);
    if (!grid) {
      console.warn("[Detalles][put] grid no encontrado:", gridSel);
      return;
    }

    const wanted = _normLabel(labelQuery);
    const rows = Array.from(grid.querySelectorAll(".exp-field"));

    let row = rows.find((r) =>
      _normLabel(r.querySelector("label")?.textContent || "").startsWith(wanted)
    );
    if (!row) {
      // fallback: contiene
      row = rows.find((r) =>
        _normLabel(r.querySelector("label")?.textContent || "").includes(wanted)
      );
    }

    if (!row) {
      console.warn(
        "[Detalles][put] fila no encontrada para label:",
        labelQuery,
        "labels disponibles:",
        rows.map((r) => r.querySelector("label")?.textContent?.trim())
      );
      return;
    }

    const dd = row.querySelector(".exp-val");
    if (!dd) {
      console.warn("[Detalles][put] .exp-val no encontrado para", labelQuery);
      return;
    }

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
    console.log("[Detalles][put] OK:", { label: labelQuery, value });
  }

  /* =====================
   * Endpoints
   * ===================*/
  const ENDPOINTS = {
    REQUERIMIENTO_GET: "/db/WEB/ixtla01_c_requerimiento.php",
    REQUERIMIENTO_UPDATE: "/db/WEB/ixtla01_upd_requerimiento.php",
    DEPT_LIST: "/DB/WEB/ixtla01_c_departamento.php",
    EMPLEADOS_GET: "/db/WEB/ixtla01_c_empleado.php",
    COMENT_LIST: "/db/WEB/ixtla01_c_comentario_requerimiento.php",
    COMENT_CREATE: "/db/WEB/ixtla01_i_comentario_requerimiento.php",
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

  /* =====================
   * Sesión
   * ===================*/
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

  /* =====================
   * UI utils
   * ===================*/
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
  function getCurrentStatusCode() {
    const cur = $(".step-menu li.current");
    return cur ? Number(cur.getAttribute("data-status")) : 0;
  }
  function updateStatusUI(code) {
    code = Number(code);
    const badge = $('#req-status [data-role="status-badge"]');
    if (badge) {
      badge.className = "exp-badge " + statusBadgeClass(code);
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
    const s = safeGetSession();
    const updated_by = s?.empleado_id ?? s?.id_empleado ?? null;
    const body = { id: Number(id), estatus: Number(estatus), updated_by };
    if (motivo) body.motivo = String(motivo).trim();
    log("[API] REQUERIMIENTO_UPDATE →", body);
    const res = await postJSON(ENDPOINTS.REQUERIMIENTO_UPDATE, body);
    log("[API] REQUERIMIENTO_UPDATE ←", res);
    return res?.data ?? res;
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
        next = 1;
        await updateReqStatus({ id, estatus: next });
        updateStatusUI(next);
      } else if (act === "assign-dept") {
        next = 2;
        await updateReqStatus({ id, estatus: next });
        updateStatusUI(next);
      } else if (act === "start-process") {
        next = 3;
        await updateReqStatus({ id, estatus: next });
        updateStatusUI(next);
      } else if (act === "pause") {
        const motivo = await askMotivo("Motivo de la pausa");
        next = 4;
        await updateReqStatus({ id, estatus: next, motivo });
        updateStatusUI(next);
      } else if (act === "resume") {
        next = 1;
        await updateReqStatus({ id, estatus: next });
        updateStatusUI(next);
      } else if (act === "cancel") {
        const motivo = await askMotivo("Motivo de la cancelación");
        next = 5;
        await updateReqStatus({ id, estatus: next, motivo });
        updateStatusUI(next);
      } else if (act === "reopen") {
        next = 1;
        await updateReqStatus({ id, estatus: next });
        updateStatusUI(next);
      }
    } catch (e) {
      if (e !== "cancel") {
        err(e);
        toast("No se pudo actualizar el estado.", "danger");
      }
    }
    renderActions(next);
  }

  /* =====================
   * Requerimiento
   * ===================*/
  function normalizeRequerimiento(raw = {}) {
    return {
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
  }

  async function getRequerimientoById(id) {
    log("[API] REQUERIMIENTO_GET →", { id });
    const res = await postJSON(ENDPOINTS.REQUERIMIENTO_GET, { id });
    const data = res?.data ?? res;
    return normalizeRequerimiento(Array.isArray(data) ? data[0] || {} : data);
  }

  /* =====================
   * Empleados (para nombre/avatar fallback)
   * ===================*/
  // ===== Empleados cache =====
  const EMP_CACHE = new Map(); // id -> { id, nombre, avatar? }

  async function getEmpleadoById(id) {
    if (id == null) return null;
    const key = Number(id);
    if (EMP_CACHE.has(key)) return EMP_CACHE.get(key);

    console.groupCollapsed(
      "[Empleado] GET BY ID →",
      key,
      ENDPOINTS.EMPLEADOS_GET
    );
    try {
      const res = await fetch(ENDPOINTS.EMPLEADOS_GET, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ id: key, status: 1 }),
      });
      console.log("[Empleado] HTTP status:", res.status);
      const json = await res.json().catch(() => ({}));
      console.log("[Empleado] payload:", json);
      if (!res.ok) throw new Error("HTTP " + res.status);

      const payload = json?.data ?? json;
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
        [emp?.apellidos, emp?.empleado_apellidos, emp?.last_name].find(
          Boolean
        ) || "";
      const full = [nombre, apellidos].filter(Boolean).join(" ").trim() || "—";

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
    } catch (e) {
      console.warn("[Empleado] error:", e);
      console.groupEnd();
      return null;
    }
  }

  /* =====================
   * UI: Contacto/Detalles
   * ===================*/
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
      "Dirección",
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
    const asignado =
      req.asignado_id && (req.asignado_full || "").trim()
        ? req.asignado_full
        : "Sin asignar";
    if (ddE) ddE.textContent = asignado;
    if (ddF) ddF.textContent = (req.creado_at || "—").replace("T", " ");
  }

  async function paintDetalles(req) {
    console.log("[UI] Pintar Detalles · req", {
      departamento_id: req.departamento_id,
      departamento_nombre: req.departamento_nombre,
    });

    const gridSel = '.exp-pane[role="tabpanel"][data-tab="detalles"] .exp-grid';

    // Nombre del Requerimiento
    putLabelValue({
      gridSel,
      labelQuery: "Nombre del Requerimiento",
      value: req.asunto || req.tramite_nombre || "—",
    });

    // Lookup de Depto + Director
    let dept = null,
      director = null,
      primeraLinea = null;
    try {
      const resp = await getDeptByIdOrName({
        id: req.departamento_id,
        nombre: req.departamento_nombre,
      });
      dept = resp?.dept || null;
      director = resp?.director || null;
      primeraLinea = resp?.primeraLinea || null;
      console.log("[UI] Dept lookup OK:", { dept, director, primeraLinea });
    } catch (e) {
      console.warn("[UI] Dept lookup error:", e);
    }

    // Pintar Líder del Departamento (enlace)
    putLabelValue({
      gridSel,
      labelQuery: "Líder del Departamento",
      value: director?.nombre || "—",
      asLink: !!director?.nombre,
    });

    // Departamento visible (nodo con id específico)
    const depNode = document.getElementById("req-departamento");
    if (depNode)
      depNode.textContent = dept?.nombre || req.departamento_nombre || "—";

    // Asignado
    const asignado =
      req.asignado_id && (req.asignado_full || "").trim()
        ? req.asignado_full
        : "Sin asignar";
    putLabelValue({
      gridSel,
      labelQuery: "Asignado",
      value: asignado,
      asLink: true,
    });

    // Estatus (badge + acciones existentes)
    updateStatusUI(req.estatus_code);
    renderActions(req.estatus_code);

    // Descripción
    putLabelValue({
      gridSel,
      labelQuery: "Descripción",
      value: req.descripcion || "—",
    });

    // Fechas
    putLabelValue({
      gridSel,
      labelQuery: "Fecha de inicio",
      value: (req.creado_at || "").split(" ")[0] || "—",
    });
    putLabelValue({
      gridSel,
      labelQuery: "Fecha de terminado",
      value: req.cerrado_en ? String(req.cerrado_en).split(" ")[0] : "—",
    });
  }

  /* =====================
   * Comentarios
   * ===================*/
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

  // created_by = id_usuario; enviamos también empleado_id para que el back pueda poblar nombres
  async function createComentarioAPI({
    requerimiento_id,
    usuario_id,
    empleado_id,
    comentario,
    status = 1,
  }) {
    const rid = Number(requerimiento_id);
    const uid = Number(usuario_id);
    const eid = empleado_id != null ? Number(empleado_id) : null;
    const txt = String(comentario || "").trim();

    if (!Number.isFinite(rid)) throw new Error("Falta requerimiento_id válido");
    if (!txt) throw new Error("Falta comentario (no puede ir vacío)");
    if (!Number.isFinite(uid))
      throw new Error("Falta id de usuario (created_by)");

    const payload = {
      requerimiento_id: rid,
      comentario: txt,
      status: Number(status) || 1,
      created_by: uid, // requerido por el endpoint
      empleado_id: eid ?? null, // opcional, nos ayuda a nombre/joins
    };

    console.groupCollapsed("[API] COMENT_CREATE →");
    console.log(payload);
    console.groupEnd();

    const r = await postJSON(ENDPOINTS.COMENT_CREATE, payload);
    console.log("[API] COMENT_CREATE ←", r);
    if (r?.ok === false)
      throw new Error(r?.error || "Error al crear comentario");
    return r;
  }

  function placeholderAvatar() {
    return "/ASSETS/user/img_user1.png";
  }

  async function renderCommentsList(items = []) {
    console.groupCollapsed("[Comentarios][UI] render");
    console.log("items(raw):", items);
    const feed = $(".c-feed");
    if (!feed) {
      console.groupEnd();
      return;
    }
    feed.innerHTML = "";

    for (const r of items) {
      let display =
        r.empleado_display ||
        [r.empleado_nombre, r.empleado_apellidos]
          .filter(Boolean)
          .join(" ")
          .trim();

      const texto = r.comentario || r.texto || "";
      const cuando = relShort(r.created_at || r.fecha || "");

      const idUsuario =
        (Number(r.created_by) > 0 && Number(r.created_by)) || null;
      const idEmpleado =
        (Number(r.empleado_id) > 0 && Number(r.empleado_id)) || null;

      // Si no traemos nombre, intenta hidratarlo por empleado_id
      if (!display && idEmpleado) {
        try {
          const emp = await getEmpleadoById(idEmpleado);
          display = emp?.full || display;
        } catch (e) {
          /* noop */
        }
      }
      display = display || "—";

      console.log("[Comentarios][Autor]", {
        comentario_id: r.id,
        created_by_raw: r.created_by,
        empleado_id_raw: r.empleado_id,
        nombre_resuelto: display,
      });

      const bust = `?v=${Date.now()}`;
      const userCandidates = idUsuario
        ? [
            `/ASSETS/user/userImgs/img_${idUsuario}.png${bust}`,
            `/ASSETS/user/userImgs/img_${idUsuario}.jpg${bust}`,
          ]
        : [];
      const empCandidates =
        idEmpleado && idEmpleado !== idUsuario
          ? [
              `/ASSETS/user/userImgs/img_${idEmpleado}.png${bust}`,
              `/ASSETS/user/userImgs/img_${idEmpleado}.jpg${bust}`,
            ]
          : [];
      const sources = [
        ...userCandidates,
        ...empCandidates,
        placeholderAvatar(),
      ];

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
        const src = sources[i++];
        log(`[Avatar][load] trying →`, src);
        img.onerror = () => {
          log(`[Avatar][error]`, src);
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
          display
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
      await renderCommentsList(arr);
    } catch (e) {
      warn("Error listando comentarios:", e);
      await renderCommentsList([]);
    } finally {
      console.groupEnd();
    }
  }

  function interceptComposer(reqId) {
    const ta = $(".composer textarea");
    const btn = $(".composer .send-fab");
    if (!ta || !btn) return;

    const s = safeGetSession();
    const usuario_id = s?.id_usuario ?? s?.usuario_id ?? s?.cuenta_id ?? null;
    const empleado_id = s?.empleado_id ?? s?.id_empleado ?? null;

    console.log("[Comentarios][Send] ids de sesión", {
      usuario_id,
      empleado_id,
    });

    const send = async () => {
      const texto = (ta.value || "").trim();
      if (!texto) return;
      if (!usuario_id) {
        console.error("[Comentarios][Send] No hay id_usuario en sesión; abort");
        toast("No se encontró tu usuario en la sesión.", "danger");
        return;
      }
      btn.disabled = true;
      try {
        await createComentarioAPI({
          requerimiento_id: reqId,
          usuario_id, // created_by
          empleado_id, // ayuda a poblar nombre
          comentario: texto,
          status: 1,
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

  /* =====================
   * Dept helper (ligero)
   * ===================*/
  async function getDeptByIdOrName({ id, nombre }) {
    const wantedId = id != null ? Number(id) : null;
    const wantedName = nombre ? norm(nombre) : null;
    let res;
    try {
      res = await postJSON(ENDPOINTS.DEPT_LIST, {
        page: 1,
        page_size: 200,
        status: 1,
      });
    } catch {
      return { dept: null, director: null, primeraLinea: null };
    }
    const arr = Array.isArray(res?.data) ? res.data : [];
    let dept = null;
    if (wantedId) dept = arr.find((x) => Number(x.id) === wantedId) || null;
    if (!dept && wantedName) {
      dept =
        arr.find((x) => norm(x?.nombre || "") === wantedName) ||
        arr.find((x) => norm(x?.nombre || "").startsWith(wantedName)) ||
        null;
    }
    if (!dept && arr.length === 1) dept = arr[0] || null;
    if (!dept) return { dept: null, director: null, primeraLinea: null };
    return {
      dept: { id: Number(dept.id), nombre: String(dept.nombre || "—") },
      director: null,
      primeraLinea: null,
    };
  }

  /* =====================
   * Reset & boot
   * ===================*/
  function resetTemplate() {
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
    const feed = $(".c-feed");
    if (feed) feed.innerHTML = "";
  }

  let __CURRENT_REQ_ID__ = null;

  async function boot() {
    resetTemplate();

    // Stepper UI
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
      const h1 = $(".exp-title h1");
      if (h1)
        h1.textContent = req.asunto || req.tramite_nombre || "Requerimiento";
      paintHeaderMeta(req);
      paintContacto(req);
      await paintDetalles(req);
      const sel = $('#req-status [data-role="status-select"]');
      if (sel) sel.value = String(req.estatus_code ?? 0);
      try {
        window.__REQ__ = req;
        document.dispatchEvent(new CustomEvent("req:loaded", { detail: req }));
      } catch {}
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

// /JS/ui/tareasDetalle.js – Lógica del drawer de detalle de tarea
"use strict";

export function createTaskDetailsModule({
  State,
  KB,
  ReqCache,
  fetchRequerimientoById,
  formatFolio,
  log,
  warn,
  toast,
  highlightSelected,
  getTaskById,
  API_MEDIA,
  postJSON,
}) {
  const $ = (sel, root = document) => root.querySelector(sel);

  /* ==========================================================================
   *  Helpers de sesión (copiados de requerimientoView.js)
   * ========================================================================*/

  function readCookiePayload() {
    try {
      const name = "ix_emp=";
      const pair = document.cookie.split("; ").find((c) => c.startsWith(name));
      if (!pair) return null;
      const raw = decodeURIComponent(pair.slice(name.length));
      // decode base64 → utf8 → JSON
      // eslint-disable-next-line no-undef
      return JSON.parse(decodeURIComponent(escape(atob(raw))));
    } catch {
      return null;
    }
  }

  function safeGetSession() {
    try {
      if (window.Session?.get) return window.Session.get();
    } catch {
      /* ignore */
    }
    return readCookiePayload() || null;
  }

  function getUserAndEmpleadoFromSession() {
    const s = safeGetSession() || {};
    const usuario_id = s?.id_usuario ?? s?.usuario_id ?? null;
    const empleado_id = s?.empleado_id ?? s?.id_empleado ?? null;
    return { usuario_id, empleado_id };
  }

  function relShort(when) {
    if (!when) return "—";
    const t = Date.parse(String(when).replace(" ", "T"));
    if (Number.isNaN(t)) return when;

    const diffMs = Date.now() - t;
    const sec = Math.floor(diffMs / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);

    if (sec < 60) return "Hace unos segundos";
    if (min < 60) return `Hace ${min} min`;
    if (hr < 24) return `Hace ${hr} h`;
    if (day === 1) return "Hace 1 día";
    if (day < 7) return `Hace ${day} días`;
    const d = new Date(t);
    return d.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  /* ==========================================================================
   *  Endpoints de comentarios (mismo host, rutas relativas)
   * ========================================================================*/

  const ENDPOINTS = {
    COMENT_LIST: "/db/WEB/ixtla01_c_comentario_requerimiento.php",
    COMENT_CREATE: "/db/WEB/ixtla01_i_comentario_requerimiento.php",
  };

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
    log("[KB] COMENT LIST →", ENDPOINTS.COMENT_LIST, payload);
    const res = await postJSON(ENDPOINTS.COMENT_LIST, payload);
    const raw = res?.data ?? res?.items ?? res;
    const arr = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.rows)
        ? raw.rows
        : [];
    log("[KB] Comentarios crudos:", arr);
    return arr;
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
    log("[KB] COMENT CREATE →", ENDPOINTS.COMENT_CREATE, payload);
    return await postJSON(ENDPOINTS.COMENT_CREATE, payload);
  }

  /* ==========================================================================
   *  Media / Evidencias
   * ========================================================================*/

  function normalizarMediaItem(raw) {
    if (!raw) return null;

    const id = Number(raw.id ?? raw.media_id ?? raw.archivo_id ?? 0) || null;

    const url =
      raw.url ||
      raw.archivo_url ||
      raw.ruta ||
      raw.path ||
      raw.archivo ||
      "";

    const nombre = raw.nombre || raw.titulo || raw.descripcion || "Archivo";

    const tipo =
      raw.tipo ||
      raw.mime_type ||
      (typeof raw.extension === "string" ? raw.extension.toLowerCase() : "") ||
      "";

    const created_at = raw.created_at || raw.fecha || raw.fecha_creacion || "";
    const created_by =
      raw.created_by_display ||
      raw.created_by_nombre ||
      raw.subido_por ||
      "";

    return {
      id,
      url,
      nombre,
      tipo,
      created_at,
      created_by,
    };
  }

  async function getFolioForRequerimiento(reqId) {
    if (!reqId) return null;

    // 1) Buscar en las tareas cargadas
    if (Array.isArray(State.tasks) && State.tasks.length) {
      const found = State.tasks.find(
        (t) => Number(t.requerimiento_id) === Number(reqId)
      );
      if (found?.folio) {
        return found.folio;
      }
    }

    // 2) Buscar en cache de requerimientos
    if (ReqCache && typeof ReqCache.get === "function") {
      const reqCached = ReqCache.get(reqId);
      if (reqCached?.folio || reqCached?.id) {
        return formatFolio(reqCached.folio, reqCached.id);
      }
    }

    // 3) Último recurso: consultar al backend
    try {
      const req = await fetchRequerimientoById(reqId);
      if (!req) return null;
      return formatFolio(req.folio, req.id);
    } catch (e) {
      warn("[KB] Error al resolver folio de requerimiento", reqId, e);
      return null;
    }
  }

  async function fetchMediaForRequerimiento(reqId) {
    if (!reqId) return [];

    const folio = await getFolioForRequerimiento(reqId);

    if (!folio) {
      warn("MEDIA LIST → no se pudo resolver folio para reqId", reqId);
      return [];
    }

    const payload = { folio };

    try {
      log("MEDIA LIST →", API_MEDIA.LIST, payload);
      const res = await postJSON(API_MEDIA.LIST, payload);
      log("MEDIA LIST respuesta cruda:", res);

      const raw = res?.data ?? res?.items ?? res;
      const arr = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.rows)
          ? raw.rows
          : [];

      return arr
        .map(normalizarMediaItem)
        .filter(Boolean)
        .sort((a, b) => {
          const ta = Date.parse(a.created_at || "") || 0;
          const tb = Date.parse(b.created_at || "") || 0;
          return tb - ta;
        });
    } catch (e) {
      console.error("[KB] Error al listar media:", e);
      toast("No se pudieron cargar las evidencias.", "error");
      return [];
    }
  }

  function renderMediaGrid(items) {
    const wrap = $("#kb-d-evidencias");
    if (!wrap) return;

    wrap.innerHTML = "";

    if (!items || !items.length) {
      const empty = document.createElement("p");
      empty.className = "kb-evid-empty";
      empty.textContent = "Aún no hay evidencias para este requerimiento.";
      wrap.appendChild(empty);
      return;
    }

    for (const it of items) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "kb-evid-item";

      const thumb = document.createElement("div");
      thumb.className = "kb-evid-thumb";

      if (it.url) {
        const img = document.createElement("img");
        img.src = it.url;
        img.alt = it.nombre || "Archivo";
        img.loading = "lazy";
        thumb.appendChild(img);
      } else {
        thumb.textContent = "Archivo";
      }

      const meta = document.createElement("div");
      meta.className = "kb-evid-meta";

      const title = document.createElement("div");
      title.className = "kb-evid-name";
      title.textContent = it.nombre || "Archivo";

      const info = document.createElement("div");
      info.className = "kb-evid-info";
      const by = it.created_by || "";
      const when = relShort(it.created_at);
      info.textContent = by ? `${by} · ${when}` : when;

      meta.appendChild(title);
      meta.appendChild(info);

      card.appendChild(thumb);
      card.appendChild(meta);

      card.addEventListener("click", () => {
        if (it.url) {
          window.open(it.url, "_blank", "noopener");
        }
      });

      wrap.appendChild(card);
    }
  }

  async function loadEvidenciasForTask(taskOrId) {
    const task =
      typeof taskOrId === "object" && taskOrId
        ? taskOrId
        : getTaskById(taskOrId);

    if (!task?.requerimiento_id) {
      renderMediaGrid([]);
      return;
    }

    const reqId = task.requerimiento_id;
    const wrap = $("#kb-d-evidencias");
    if (wrap) {
      // placeholders de carga
      wrap.innerHTML = "";
      for (let i = 0; i < 3; i++) {
        const ph = document.createElement("div");
        ph.className = "kb-evid-placeholder is-loading";
        wrap.appendChild(ph);
      }
    }

    const items = await fetchMediaForRequerimiento(reqId);
    renderMediaGrid(items);
  }

  async function uploadMediaForTask(task, files) {
    if (!task?.requerimiento_id || !files?.length) return;

    const reqId = task.requerimiento_id;

    // Resolver folio del requerimiento antes de subir
    const folio = await getFolioForRequerimiento(reqId);

    if (!folio) {
      toast("No se pudo obtener el folio del requerimiento.", "error");
      return;
    }

    for (const file of files) {
      const fd = new FormData();

      // Enviamos ambos por si el backend usa alguno de los dos
      fd.append("requerimiento_id", reqId);
      fd.append("folio", folio);
      fd.append("archivo", file);

      try {
        log("MEDIA UPLOAD →", API_MEDIA.UPLOAD, {
          requerimiento_id: reqId,
          folio,
          name: file.name,
          size: file.size,
        });

        const resp = await fetch(API_MEDIA.UPLOAD, {
          method: "POST",
          body: fd,
        });

        const json = await resp.json().catch(() => null);
        log("MEDIA UPLOAD respuesta:", json);

        if (json?.ok === false) {
          toast(`No se pudo subir "${file.name}"`, "error");
        }
      } catch (e) {
        console.error("[KB] Error al subir media:", e);
        toast(`Error al subir "${file.name}"`, "error");
      }
    }

    toast("Evidencia subida correctamente", "success");
    await loadEvidenciasForTask(task);
  }

  let evidenciasBound = false;
  function setupEvidenciasUpload() {
    if (evidenciasBound) return;
    evidenciasBound = true;

    const btn = $("#kb-evid-upload");
    const input = $("#kb-evid-input");

    if (!btn || !input) {
      warn("[KB] No se encontraron controles de evidencias en el DOM.");
      return;
    }

    btn.addEventListener("click", () => {
      if (!State.selectedId) {
        toast("Selecciona primero una tarea del tablero.", "warning");
        return;
      }
      input.value = "";
      input.click();
    });

    input.addEventListener("change", async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;

      const task = getTaskById(State.selectedId);
      if (!task) {
        toast("No se encontró la tarea seleccionada.", "error");
        return;
      }

      await uploadMediaForTask(task, files);
    });
  }

  /* ==========================================================================
   *  Comentarios de la tarea (Tarea-{id})
   * ========================================================================*/

  function parseTaskTagFromComment(rawComment, tareaId) {
    const text = String(rawComment || "");
    if (!tareaId) {
      return {
        tag: null,
        cleanText: text.trim(),
      };
    }

    const prefix = `Tarea-${tareaId}`;
    const re = new RegExp(`^${prefix}\\b\\s*`, "i");
    if (!re.test(text)) {
      return {
        tag: null,
        cleanText: text.trim(),
      };
    }

    let cleanText = text.replace(re, "").trim();
    cleanText = cleanText.replace(/^[:\-–\s]+/, "").trim();

    return {
      tag: `TAREA-${tareaId}`,
      cleanText,
    };
  }

  function renderTaskComments(task, items) {
    const feed = $("#kb-comments-feed");
    const lblCount = $("#kb-comments-count");
    if (!feed) return;

    feed.innerHTML = "";

    if (!task) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "Selecciona una tarea para ver sus comentarios.";
      feed.appendChild(p);
      if (lblCount) lblCount.textContent = "0 comentarios";
      return;
    }

    const tareaId = task.id;
    const reqId = task.requerimiento_id;

    if (!reqId) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent =
        "Esta tarea no está ligada a un requerimiento, no hay comentarios.";
      feed.appendChild(p);
      if (lblCount) lblCount.textContent = "0 comentarios";
      return;
    }

    const all = Array.isArray(items) ? items : [];

    if (!all.length) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "Aún no hay comentarios para esta tarea.";
      feed.appendChild(p);
      if (lblCount) lblCount.textContent = "0 comentarios";
      return;
    }

    // Orden igual que en requerimientoView: más nuevos arriba
    const ordered = [...all].sort((a, b) => {
      const aDate = Date.parse(a.created_at || a.fecha || "") || 0;
      const bDate = Date.parse(b.created_at || b.fecha || "") || 0;
      return bDate - aDate;
    });

    for (const c of ordered) {
      const originalText = c.comentario || c.texto || "";
      // Detectamos prefix Tarea-{id} y limpiamos texto
      const { tag, cleanText } = parseTaskTagFromComment(originalText, tareaId);
      const texto = cleanText || originalText;

      // Normalizar nombre como en requerimientoView
      let display =
        c.empleado_display ||
        [c.empleado_nombre, c.empleado_apellidos].filter(Boolean).join(" ").trim() ||
        c.nombre ||
        c.autor ||
        "—";

      const cuando = relShort(c.created_at || c.fecha || "");

      // Mismo cálculo de usuarioId que en requerimientoView
      const usuarioId =
        (Number(c.created_by) > 0 && Number(c.created_by)) ||
        (Number(c.cuenta_id) > 0 && Number(c.cuenta_id)) ||
        null;

      const sources = makeAvatarSourcesByUsuarioId(usuarioId);

      const article = document.createElement("article");
      article.className = "msg";

      // Avatar con mismo comportamiento (fallbacks)
      const avatarWrap = document.createElement("div");
      avatarWrap.className = "avatar";
      const img = document.createElement("img");
      img.alt = display || "";
      avatarWrap.appendChild(img);

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

      // Body
      const body = document.createElement("div");
      body.className = "body";

      const who = document.createElement("div");
      who.className = "who";

      const nameEl = document.createElement("span");
      nameEl.className = "name";
      nameEl.textContent = display;

      const timeEl = document.createElement("span");
      timeEl.className = "time";
      timeEl.textContent = cuando;

      who.appendChild(nameEl);
      who.appendChild(timeEl);

      const textWrap = document.createElement("div");
      textWrap.className = "text";
      // Misma forma de mostrar texto: pre-wrap + break-word
      textWrap.style.whiteSpace = "pre-wrap";
      textWrap.style.wordBreak = "break-word";

      // Badge TAREA-#### solo si el comentario trae el prefijo
      if (tag) {
        const badge = document.createElement("span");
        badge.className = "task-tag";
        badge.textContent = tag;
        textWrap.appendChild(badge);
      }

      const p = document.createElement("p");
      p.className = "comment-body";
      p.textContent = texto;
      textWrap.appendChild(p);

      body.appendChild(who);
      body.appendChild(textWrap);

      article.appendChild(avatarWrap);
      article.appendChild(body);

      feed.appendChild(article);
    }

    if (lblCount) {
      const total = all.length;
      lblCount.textContent =
        total === 1 ? "1 comentario" : `${total} comentarios`;
    }

    // Igual que en requerimientoView: subir scroll al inicio
    const scroller = feed.parentElement || feed;
    scroller.scrollTo({ top: 0, behavior: "auto" });
  }


  async function loadComentariosDeTarea(taskOrId) {
    const task =
      typeof taskOrId === "object" && taskOrId
        ? taskOrId
        : getTaskById(taskOrId);

    const feed = $("#kb-comments-feed");
    const lblCount = $("#kb-comments-count");

    if (!task?.requerimiento_id) {
      if (feed) {
        feed.innerHTML = "";
        const p = document.createElement("p");
        p.className = "empty";
        p.textContent =
          "Esta tarea no está ligada a un requerimiento, no hay comentarios.";
        feed.appendChild(p);
      }
      if (lblCount) lblCount.textContent = "0 comentarios";
      return;
    }

    const reqId = task.requerimiento_id;

    try {
      const items = await listComentariosAPI({
        requerimiento_id: reqId,
        status: 1,
        page: 1,
        page_size: 100,
      });
      renderTaskComments(task, items);
    } catch (e) {
      console.error("[KB] Error al cargar comentarios de tarea:", e);
      if (feed) {
        feed.innerHTML = "";
        const p = document.createElement("p");
        p.className = "empty";
        p.textContent = "No se pudieron cargar los comentarios.";
        feed.appendChild(p);
      }
      if (lblCount) lblCount.textContent = "0 comentarios";
    }
  }

  let commentsBound = false;
  function setupTaskCommentsComposer() {
    if (commentsBound) return;
    commentsBound = true;

    const ta = $("#kb-comment-text");
    const fab = $("#kb-comment-send");
    const btn = $("#kb-comment-btn");

    if (!ta || !fab || !btn) {
      warn("[KB] Controles de comentarios no encontrados en el DOM.");
      return;
    }

    const { usuario_id, empleado_id } = getUserAndEmpleadoFromSession();

    const send = async () => {
      const texto = (ta.value || "").trim();
      if (!texto) return;

      if (!State.selectedId) {
        toast("Selecciona una tarjeta para comentar.", "warning");
        return;
      }

      const task = getTaskById(State.selectedId);
      if (!task?.requerimiento_id) {
        toast(
          "Esta tarea no está ligada a un requerimiento, no se puede comentar.",
          "warning"
        );
        return;
      }

      if (!usuario_id) {
        toast("No se encontró tu usuario en la sesión.", "danger");
        return;
      }

      const tagPrefix = `Tarea-${task.id}`;
      const comentario = `${tagPrefix} ${texto}`;

      fab.disabled = true;
      btn.disabled = true;

      try {
        await createComentarioAPI({
          requerimiento_id: task.requerimiento_id,
          comentario,
          status: 1,
          created_by: usuario_id,
          empleado_id: empleado_id,
        });

        ta.value = "";
        await loadComentariosDeTarea(task);
      } catch (e) {
        console.error("[KB] Error al enviar comentario de tarea:", e);
        toast("No se pudo enviar el comentario.", "danger");
      } finally {
        fab.disabled = false;
        btn.disabled = false;
      }
    };

    fab.addEventListener("click", (e) => {
      e.preventDefault();
      send();
    });

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      send();
    });

    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        send();
      }
    });
  }

  /* ==========================================================================
   *  Detalle de la tarea (datos principales + abrir/cerrar drawer)
   * ========================================================================*/

  function fillDetails(task) {
    const folioEl = $("#kb-d-folio");
    const procEl = $("#kb-d-proceso");
    const tareaEl = $("#kb-d-tarea");
    const asigEl = $("#kb-d-asignado");
    const esfEl = $("#kb-d-esfuerzo");
    const descEl = $("#kb-d-desc");
    const creadoPorEl = $("#kb-d-creado-por");
    const autorizaEl = $("#kb-d-autoriza");

    if (!task) {
      if (folioEl) folioEl.textContent = "—";
      if (procEl) procEl.textContent = "—";
      if (tareaEl) tareaEl.textContent = "—";
      if (asigEl) asigEl.textContent = "—";
      if (esfEl) esfEl.textContent = "—";
      if (descEl) descEl.textContent = "—";
      if (creadoPorEl) creadoPorEl.textContent = "—";
      if (autorizaEl) autorizaEl.textContent = "—";
      return;
    }

    if (folioEl) folioEl.textContent = task.folio || "—";
    if (procEl) procEl.textContent = task.proceso_titulo || "—";
    if (tareaEl) tareaEl.textContent = task.titulo || `Tarea ${task.id}`;
    if (asigEl) asigEl.textContent = task.asignado_display || "—";
    if (esfEl) esfEl.textContent =
      task.esfuerzo != null ? `${task.esfuerzo}` : "—";
    if (descEl) descEl.textContent = task.descripcion || "—";
    if (creadoPorEl)
      creadoPorEl.textContent = task.created_by_nombre || "—";
    if (autorizaEl)
      autorizaEl.textContent = task.autoriza_nombre || "—";
  }

  function openDetails(taskOrId) {
    const task =
      typeof taskOrId === "object" && taskOrId
        ? taskOrId
        : getTaskById(taskOrId);

    if (!task) {
      toast("No se encontró la tarea seleccionada.", "warning");
      return;
    }

    State.selectedId = task.id;
    highlightSelected();

    const empty = $("#kb-d-empty");
    const body = $("#kb-d-body");
    if (empty) empty.hidden = true;
    if (body) body.hidden = false;

    fillDetails(task);
    setupTaskCommentsComposer();

    loadEvidenciasForTask(task).catch((e) =>
      console.error("[KB] Error al cargar evidencias:", e)
    );
    loadComentariosDeTarea(task).catch((e) =>
      console.error("[KB] Error al cargar comentarios:", e)
    );

    const aside = $("#kb-details");
    const overlay = $("#kb-d-overlay");

    if (aside) {
      aside.classList.add("is-open");
      aside.setAttribute("aria-hidden", "false");
    }
    if (overlay) {
      overlay.classList.add("is-open");
      overlay.hidden = false;
    }

    const btnClose = $("#kb-d-close");
    if (btnClose && !btnClose._kbBound) {
      btnClose._kbBound = true;
      btnClose.addEventListener("click", () => {
        closeDetails();
      });
    }
  }

  function closeDetails() {
    State.selectedId = null;
    highlightSelected();

    const empty = $("#kb-d-empty");
    const body = $("#kb-d-body");
    if (empty) empty.hidden = false;
    if (body) body.hidden = true;

    const aside = $("#kb-details");
    const overlay = $("#kb-d-overlay");

    if (aside) {
      aside.classList.remove("is-open");
      aside.setAttribute("aria-hidden", "true");
    }
    if (overlay) {
      overlay.classList.remove("is-open");
      overlay.hidden = true;
    }
  }

  return {
    openDetails,
    closeDetails,
    setupEvidenciasUpload,
    loadEvidenciasForTask,
  };
}

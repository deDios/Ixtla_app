// JS/ui/tareasDetalle.js – Lógica del drawer de detalle de tarea
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
  Session,
  API_COMENTARIOS, // <-- Nuevo parámetro
}) {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const DEFAULT_AVATAR = "/ASSETS/user/img_user1.png";

  /* ========================================================================
     Helpers
     ====================================================================== */

  function formatDateMX(str, withTime = true) {
    if (!str) return "—";
    const d = new Date(String(str).replace(" ", "T"));
    if (Number.isNaN(d.getTime())) return "—";
    const options = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    };
    if (withTime) {
      options.hour = "2-digit";
      options.minute = "2-digit";
      options.hour12 = false;
    }
    return d.toLocaleDateString("es-MX", options);
  }

  function getUserAvatar(empleadoId) {
    // Lógica temporal para avatar: asumiendo que podrías tener una ruta basada en ID
    if (empleadoId) {
      return `/ASSETS/user/avatar_${empleadoId}.png`;
    }
    return DEFAULT_AVATAR;
  }
  
  /* ========================================================================
     Comentarios
     ====================================================================== */

  function resetCommentsSkeleton() {
    const list = $("#kb-d-comments-list");
    if (list) {
      list.innerHTML = `<li class="kb-comment-skeleton"></li><li class="kb-comment-skeleton"></li>`;
    }
  }

  function createCommentItem(comment) {
    const li = document.createElement("li");
    li.className = "kb-comment-item";
    li.dataset.id = comment.id;

    const empId = comment.empleado_id ?? comment.created_by;
    const isMine = Session.getIds()?.id_empleado === empId;

    let display = comment.empleado_display || comment.empleado_nombre || "Usuario Desconocido";
    // Fallback si no hay nombre (usa created_by si empleado_id es null)
    if (!comment.empleado_display && !comment.empleado_nombre && !comment.empleado_apellidos) {
        display = `Usuario ID ${empId || comment.created_by}`;
    }
    if (isMine) {
        display += " (Tú)";
    }

    li.innerHTML = `
      <div class="kb-comment-avatar">
        <img src="${getUserAvatar(empId)}" alt="${display}" loading="lazy" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}';" />
      </div>
      <div class="kb-comment-content">
        <div class="kb-comment-header">
          <span class="kb-comment-author">${display}</span>
          <span class="kb-comment-date">${formatDateMX(comment.created_at)}</span>
        </div>
        <div class="kb-comment-text">
          <p>${comment.comentario.replace(/\n/g, '<br>')}</p>
        </div>
      </div>
    `;

    return li;
  }

  async function fetchCommentsForRequirement(reqId) {
    if (!reqId) {
      log("No requerimiento_id para cargar comentarios.");
      return [];
    }
    if (!API_COMENTARIOS || !API_COMENTARIOS.LIST) {
      warn("API_COMENTARIOS no definida o incompleta.");
      return [];
    }

    const payload = {
      requerimiento_id: reqId,
      status: 1, 
      page: 1,
      page_size: 100, 
    };

    try {
      log("COMENTARIOS LIST →", API_COMENTARIOS.LIST, payload);
      const json = await postJSON(API_COMENTARIOS.LIST, payload);
      log("COMENTARIOS LIST respuesta:", json);

      if (!json || !Array.isArray(json.data)) {
        warn("Respuesta inesperada de COMENTARIOS LIST", json);
        return [];
      }
      return json.data;
    } catch (e) {
      console.error("[KB] Error al listar comentarios:", e);
      toast("Error al cargar comentarios.", "error");
      return [];
    }
  }

  function renderComments(comments) {
    const list = $("#kb-d-comments-list");
    const countEl = $("#kb-d-comments-count");
    if (!list) return;

    list.innerHTML = "";
    if (!comments.length) {
        list.innerHTML = '<li class="kb-comment-empty">No hay comentarios aún.</li>';
        if (countEl) countEl.textContent = "(0)";
        return;
    }

    // Ordenar por fecha de creación (los más recientes al final)
    const sorted = comments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    sorted.forEach(comment => {
        list.appendChild(createCommentItem(comment));
    });

    if (countEl) countEl.textContent = `(${comments.length})`;

    // Scroll al último comentario (el más nuevo)
    list.scrollTop = list.scrollHeight;
  }

  async function loadCommentsForTask(task) {
    const reqId = task.requerimiento_id;

    resetCommentsSkeleton();

    if (!reqId) {
      log("Tarea T-" + task.id + " no tiene requerimiento_id para comentarios.");
      renderComments([]);
      return;
    }

    try {
      const comments = await fetchCommentsForRequirement(reqId);
      renderComments(comments);
    } catch (e) {
      console.error("[KB] Error cargando comentarios:", e);
      renderComments([]);
    }
  }

  /* ========================================================================
     Media / Evidencias
     ====================================================================== */

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

    if (!url) return null;

    return { id, url, nombre, raw };
  }

  async function resolveReqFolio(reqId) {
    if (!reqId) return "—";

    const cached = ReqCache.get(reqId);
    if (cached) return formatFolio(cached.folio, cached.id);

    const taskWithFolio = State.tasks.find(
      (t) => t.requerimiento_id === reqId && t.folio && t.folio !== "—"
    );

    if (taskWithFolio) return taskWithFolio.folio;

    const req = await fetchRequerimientoById(reqId);
    if (req) {
      return formatFolio(req.folio, req.id);
    }
    return `REQ-ID-${reqId}`;
  }

  async function fetchMediaItems(reqId) {
    if (!reqId) return [];

    const payload = {
      requerimiento_id: reqId,
      status: 1, // Asumiendo que 1 es el status para activos
    };

    try {
      log("MEDIA LIST →", API_MEDIA.LIST, payload);
      const json = await postJSON(API_MEDIA.LIST, payload);
      log("MEDIA LIST respuesta:", json);

      if (!json || !Array.isArray(json.data)) {
        warn("Respuesta inesperada de MEDIA LIST", json);
        return [];
      }
      return json.data.map(normalizarMediaItem).filter(Boolean);
    } catch (e) {
      console.error("[KB] Error al listar media:", e);
      return [];
    }
  }

  function createMediaItem(item) {
    const div = document.createElement("div");
    div.className = "kb-evid-item";
    div.innerHTML = `<img src="${item.url}" alt="${item.nombre}" loading="lazy" />`;
    div.addEventListener("click", () => {
      // Abrir en modal o nueva pestaña
      window.open(item.url, "_blank");
    });
    return div;
  }

  function renderEvidencias(mediaItems) {
    const evidWrap = $("#kb-d-evidencias");
    if (!evidWrap) return;

    evidWrap.innerHTML = "";

    if (!mediaItems.length) {
      evidWrap.innerHTML =
        '<div class="kb-evid-empty">No hay evidencias cargadas.</div>';
      return;
    }

    mediaItems.forEach((item) => {
      evidWrap.appendChild(createMediaItem(item));
    });

    // Rellenar con placeholders si hay menos de 3 para mantener el layout
    const remaining = 3 - mediaItems.length;
    for (let i = 0; i < remaining; i++) {
      const ph = document.createElement("div");
      ph.className = "kb-evid-placeholder";
      evidWrap.appendChild(ph);
    }
  }

  function resetEvidenciasSkeleton() {
    const evidWrap = $("#kb-d-evidencias");
    if (evidWrap) {
      evidWrap.innerHTML = "";
      for (let i = 0; i < 3; i++) {
        const ph = document.createElement("div");
        ph.className = "kb-evid-placeholder kb-evid-skeleton";
        evidWrap.appendChild(ph);
      }
    }
  }

  async function loadEvidenciasForTask(task) {
    const reqId = task.requerimiento_id;
    resetEvidenciasSkeleton();

    if (!reqId) {
      log("Tarea T-" + task.id + " no tiene requerimiento_id para evidencias.");
      renderEvidencias([]);
      return;
    }

    try {
      const items = await fetchMediaItems(reqId);
      renderEvidencias(items);
    } catch (e) {
      console.error("[KB] Error cargando evidencias:", e);
      renderEvidencias([]);
    }
  }
  
  function setupEvidenciasUpload() {
      // **TO DO**: Implementar lógica completa de subida de archivos (modal, file input, postJSON a API_MEDIA.UPLOAD)
      // log("setupEvidenciasUpload stubbed. Needs full implementation for file handling.");
  }


  /* ========================================================================
     Detalles / Main
     ====================================================================== */

  /** Rellena la sección superior del drawer con datos de la tarea. */
  async function fillDetails(task) {
    const reqId = task.requerimiento_id;

    // Titulo y Proceso
    $("#kb-d-title").textContent = task.titulo;
    $("#kb-d-proceso").textContent = task.proceso_titulo;
    $("#kb-d-id").textContent = `T-${task.id}`;
    $("#kb-d-description-text").textContent =
      task.descripcion || "Sin descripción.";
    
    // Folio (puede requerir fetch si el requerimiento no está cacheado)
    const folio = await resolveReqFolio(reqId);
    $("#kb-d-folio").textContent = folio;

    // Status
    const statusTextMap = {
      [KB.STATUS.TODO]: "Por Hacer",
      [KB.STATUS.PROCESO]: "En Proceso",
      [KB.STATUS.REVISAR]: "En Revisión",
      [KB.STATUS.HECHO]: "Completada",
      [KB.STATUS.PAUSA]: "En Pausa",
    };
    const statusEl = $("#kb-d-status");
    statusEl.textContent = statusTextMap[task.status] || "Desconocido";
    statusEl.className = `kb-d-status kb-status-${task.status}`;

    // Asignado a
    $("#kb-d-asignado").textContent = task.asignado_display;

    // Fechas
    $("#kb-d-fecha-inicio").textContent = formatDateMX(task.fecha_inicio || task.created_at, false);
    $("#kb-d-fecha-fin").textContent = formatDateMX(task.fecha_fin || "—", false);
    
    // Esfuerzo / Horas
    const esfuerzo = task.esfuerzo != null ? `${task.esfuerzo}h` : "—";
    $("#kb-d-esfuerzo").textContent = esfuerzo;

    // Tramite
    const tramite = task.tramite_nombre || "—";
    $("#kb-d-tramite").textContent = tramite;

    // Creado por
    $("#kb-d-created-by").textContent = task.created_by_nombre;
  }

  function openDetails(id) {
    const task = getTaskById(id);
    if (!task) return;

    State.selectedId = task.id;

    fillDetails(task);
    highlightSelected();

    loadEvidenciasForTask(task).catch((e) =>
      console.error("[KB] Error cargando evidencias:", e)
    );
    
    // CAMBIO: Se añade la carga de comentarios aquí
    loadCommentsForTask(task).catch((e) =>
      console.error("[KB] Error cargando comentarios:", e)
    );

    const empty = $("#kb-d-empty");
    const body = $("#kb-d-body");
    const aside = $("#kb-details");
    const overlay = $("#kb-d-overlay");

    if (empty) empty.hidden = true;
    if (body) body.hidden = false;

    if (aside) {
      aside.classList.add("is-open");
      aside.setAttribute("aria-hidden", "false");
    }
    if (overlay) {
      overlay.classList.add("is-open");
      overlay.hidden = false;
    }
  }

  function closeDetails() {
    State.selectedId = null;
    highlightSelected();
    
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
    loadCommentsForTask, 
    loadEvidenciasForTask,
  };
}
// JS\ui\tareasDetalle.js – Lógica del drawer de detalle de tarea
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
}) {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ========================================================================\
   * Endpoints (AJUSTA ESTAS URLS A TU ENTORNO REAL)
   * ======================================================================== */
  const API_ROOT = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB";
  const ENDPOINTS = {
      // Endpoint para LISTAR comentarios
      COMMENTS_LIST: `${API_ROOT}/ixtla01_c_comentarios.php`,
      // Endpoint para INSERTAR comentarios
      COMMENTS_INSERT: `${API_ROOT}/ixtla01_i_comentario.php`,
  };


  /* ========================================================================
     Media / Evidencias (Lógica Original del Usuario)
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

  /**
   * Resolver folio real para un requerimiento dado su ID.
   */
  async function getFolioForRequerimiento(reqId) {
    const id = Number(reqId);
    if (!id) return null;

    // 1) Intentar desde las tareas en memoria
    const fromTask =
      (State.tasks || []).find(
        (t) => Number(t.requerimiento_id) === id
      ) || null;

    if (fromTask?.folio && fromTask.folio !== "—") {
      return fromTask.folio;
    }

    // 2) Intentar desde el caché de requerimientos
    if (ReqCache.has(id)) {
      const reqCached = ReqCache.get(id);
      if (reqCached) {
        return formatFolio(reqCached.folio, reqCached.id);
      }
    }

    // 3) Último recurso: consultar al backend
    const req = await fetchRequerimientoById(id);
    if (!req) return null;

    return formatFolio(req.folio, req.id);
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

      const data = Array.isArray(res?.data) ? res.data : [];
      const out = data.map(normalizarMediaItem).filter(Boolean);

      log("Media normalizada para req", reqId, ":", out);
      return out;
    } catch (e) {
      console.error("[KB] Error al listar media:", e);
      return [];
    }
  }

  function paintEvidencias(mediaList) {
    const wrap = $("#kb-d-evidencias");
    if (!wrap) return;

    wrap.innerHTML = "";

    if (!mediaList.length) {
      // Sin media -> placeholders
      for (let i = 0; i < 3; i++) {
        const ph = document.createElement("div");
        ph.className = "kb-evid-placeholder";
        wrap.appendChild(ph);
      }
      return;
    }

    mediaList.slice(0, 3).forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "kb-evid-thumb";
      btn.title = item.nombre;

      const isImg = /\.(png|jpe?g|webp|gif|bmp)$/i.test(item.url);

      if (isImg) {
        const img = document.createElement("img");
        img.src = item.url;
        img.alt = item.nombre;
        btn.appendChild(img);
      } else {
        const span = document.createElement("span");
        span.className = "kb-evid-file-icon";
        span.textContent = "📎";
        btn.appendChild(span);

        const label = document.createElement("span");
        label.className = "kb-evid-file-name";
        label.textContent = item.nombre;
        btn.appendChild(label);
      }

      btn.addEventListener("click", () => {
        window.open(item.url, "_blank");
      });

      wrap.appendChild(btn);
    });
  }

  async function loadEvidenciasForTask(task) {
    const wrap = $("#kb-d-evidencias");
    if (!wrap) return;

    // Estado inicial: placeholders mientras carga
    wrap.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const ph = document.createElement("div");
      ph.className = "kb-evid-placeholder is-loading";
      wrap.appendChild(ph);
    }

    if (!task?.requerimiento_id) {
      log("Tarea sin requerimiento_id, no se cargan evidencias:", task?.id);
      return;
    }

    const media = await fetchMediaForRequerimiento(task.requerimiento_id);
    paintEvidencias(media);
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

  function setupEvidenciasUpload() {
    const btn = $("#kb-evid-upload");
    const input = $("#kb-evid-input");
    if (!btn || !input) return;

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


  /* ========================================================================\
     Comentarios: Lógica de Carga y Renderizado (NUEVO)
     ======================================================================== */

  /** Renderiza un solo item de comentario. */
  function paintCommentItem(item) {
      const fecha = item.fecha_registro ? new Date(item.fecha_registro).toLocaleString() : 'Fecha desconocida';
      const autor = item.empleado_nombre || 'Usuario Desconocido';
      const cuerpo = item.comentario || '';
      const avatar = item.empleado_avatar_url || '/ASSETS/user/img_user1.png'; 

      return `
          <article class="kb-d-comment-item" data-comment-id="${item.id}">
              <div class="kb-d-comment-meta">
                  <img class="kb-d-comment-avatar" src="${avatar}" alt="Avatar de ${autor}">
                  <div class="kb-d-comment-info">
                      <span class="kb-d-comment-author">${autor}</span>
                      <time class="kb-d-comment-date">${fecha}</time>
                  </div>
              </div>
              <p class="kb-d-comment-body">${cuerpo}</p>
          </article>
      `;
  }

  /** Renderiza la lista completa de comentarios. */
  function paintComentarios(list) {
      const container = $("#kb-d-comentarios"); 
      if (!container) return;

      if (!list || list.length === 0) {
          container.innerHTML = `<p class="kb-d-no-data">Sin comentarios.</p>`;
          return;
      }
      
      // Ordenar para mostrar los más antiguos arriba
      list.sort((a, b) => new Date(a.fecha_registro) - new Date(b.fecha_registro));

      container.innerHTML = list.map(paintCommentItem).join("");
      // Desplazar al final para ver los comentarios más recientes
      container.scrollTop = container.scrollHeight; 
  }

  /** Carga los comentarios para el requerimiento asociado a la tarea. */
  async function loadComentariosForTask(task) {
      const requerimientoId = Number(task.requerimiento_id); 
      const container = $("#kb-d-comentarios");
      if (container) container.innerHTML = '<p class="kb-d-loading">Cargando comentarios...</p>';


      if (!requerimientoId) {
          paintComentarios([]); 
          return;
      }

      try {
          const resp = await postJSON(ENDPOINTS.COMMENTS_LIST, {
              id: requerimientoId, // ID del requerimiento
          });

          const comments = resp.comentarios || [];
          paintComentarios(comments);
          return comments; 
      } catch (e) {
          warn("[KB] Error cargando comentarios:", e);
          if (container) container.innerHTML = `<p class="kb-d-error">Error al cargar comentarios. Intente de nuevo.</p>`;
          return [];
      }
  }


  /* ========================================================================\
     Comentarios: Lógica de Inserción (NUEVO)
     ======================================================================== */

  /** Maneja el envío del formulario para agregar un nuevo comentario. */
  async function handleNewComment(e) {
      e.preventDefault();
      
      const form = e.currentTarget;
      const input = $("#kb-d-comment-input");
      const btn = $('button[type="submit"]', form);
      const tarea = getTaskById(State.selectedId);

      if (!tarea || !input || !btn) return;
      
      const requerimientoId = Number(tarea.requerimiento_id); 
      const comentario = input.value.trim();
      // Obtenemos el ID del usuario logueado usando la sesión
      const empleadoId = Session.getIds()?.empleado_id; 

      if (!comentario) {
          toast("El comentario no puede estar vacío.", "warning");
          return;
      }
      if (!requerimientoId) {
          toast("No se encontró el requerimiento asociado. No se puede comentar.", "error");
          return;
      }
      if (!empleadoId) {
          toast("No se pudo identificar al usuario actual. Por favor, recargue.", "error");
          return;
      }

      // Deshabilitar UI durante el envío
      btn.disabled = true;
      input.disabled = true;
      btn.textContent = 'Enviando...';

      try {
          const payload = {
              requerimiento_id: requerimientoId,
              empleado_id: empleadoId,
              comentario: comentario,
          };

          const resp = await postJSON(ENDPOINTS.COMMENTS_INSERT, payload);

          if (resp.ok || resp.id) {
              // 1. Éxito: Limpiar campo
              toast("Comentario agregado.", "success");
              input.value = ""; 
              
              // 2. Actualización en tiempo real: recargar la lista
              await loadComentariosForTask(tarea);
          } else {
              toast(resp.msg || "Error al guardar el comentario.", "error");
          }

      } catch (error) {
          warn("[KB] Error al insertar comentario:", error);
          toast("Error de conexión al agregar el comentario.", "error");
      } finally {
          // Restaurar UI
          btn.disabled = false;
          input.disabled = false;
          btn.textContent = 'Enviar';
      }
  }

  /** Inicializa los listeners del formulario de comentarios. */
  function setupCommentForm(task) {
      const form = $("#kb-d-comment-form"); 
      
      // 1. Limpiar el listener existente (para evitar duplicados)
      if (form) {
          form.removeEventListener("submit", handleNewComment);
          
          // 2. Asignar el nuevo listener
          form.addEventListener("submit", handleNewComment);

          // 3. Ocultar el formulario si no hay requerimiento válido
          form.hidden = !task.requerimiento_id;
      }
      // 4. Limpiar el campo de texto
      const input = $("#kb-d-comment-input"); 
      if (input) input.value = '';
  }


  /* ========================================================================
     Drawer – Detalle de la tarea (Lógica Original del Usuario)
     ====================================================================== */

  function fillDetails(task) {
    const dFolio = $("#kb-d-folio");
    const dProc = $("#kb-d-proceso");
    const dTarea = $("#kb-d-tarea");
    const dAsignado = $("#kb-d-asignado");
    const dEsfuerzo = $("#kb-d-esfuerzo");
    const dDesc = $("#kb-d-desc");
    const dCreado = $("#kb-d-creado-por");
    const dAutoriza = $("#kb-d-autoriza");

    if (dFolio) dFolio.textContent = task.folio || "—";
    if (dProc) dProc.textContent = task.proceso_titulo || "—";
    if (dTarea) dTarea.textContent = task.titulo || "—";
    if (dAsignado) dAsignado.textContent = task.asignado_display || "—";
    if (dEsfuerzo)
      dEsfuerzo.textContent =
        task.esfuerzo != null ? `${task.esfuerzo} h` : "—";
    if (dDesc) dDesc.textContent = task.descripcion || "—";
    if (dCreado) dCreado.textContent = task.created_by_nombre || "—";
    if (dAutoriza) dAutoriza.textContent = task.autoriza_nombre || "—";

    const evidWrap = $("#kb-d-evidencias");
    if (evidWrap) {
      evidWrap.innerHTML = "";
      for (let i = 0; i < 3; i++) {
        const ph = document.createElement("div");
        ph.className = "kb-evid-placeholder";
        evidWrap.appendChild(ph);
      }
    }
  }

  function openDetails(id) {
    const task = getTaskById(id);
    if (!task) return;

    State.selectedId = task.id;

    fillDetails(task);
    highlightSelected();

    // Carga de Evidencias (Existente)
    loadEvidenciasForTask(task).catch((e) =>
      console.error("[KB] Error cargando evidencias:", e)
    );
    
    // Carga de Comentarios (NUEVO)
    loadComentariosForTask(task).catch((e) =>
        console.error("[KB] Error cargando comentarios:", e)
    );
    
    // Configuración del Formulario de Comentarios (NUEVO)
    setupCommentForm(task);


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
    
    // Limpiar el contenedor de comentarios al cerrar (NUEVO)
    const commentsContainer = $("#kb-d-comentarios");
    if (commentsContainer) commentsContainer.innerHTML = '';


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
    loadComentariosForTask, 
  };
}
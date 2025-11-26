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
}) {
  const $ = (sel, root = document) => root.querySelector(sel);

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

  /**
   * Resolver folio real para un requerimiento dado su ID.
   * Usa:
   *  - State.tasks (si ya viene folio en alguna tarea)
   *  - ReqCache (si ya se consultó el requerimiento)
   *  - fetchRequerimientoById como último recurso
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

  /* ========================================================================
     Drawer – Detalle de la tarea
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

    loadEvidenciasForTask(task).catch((e) =>
      console.error("[KB] Error cargando evidencias:", e)
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
    loadEvidenciasForTask,
  };
}
// /JS/ui/tareasDetalle.js
// Lógica del drawer "Detalle de la tarea":
// - Cargar comentarios del requerimiento relacionados a la tarea.
// - Insertar comentarios desde la tarea, concatenando un tag "Tarea-{id}".
// - Renderizar badge TAREA-{id} + texto en el feed.

import { postJSON } from "../api/http.js";

(function () {
  "use strict";

  const TAG = "[KBTareasDetalle]";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const log = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);
  const err = (...a) => console.error(TAG, ...a);
  const toast = (m, t = "info") =>
    window.gcToast ? gcToast(m, t) : log("[toast]", t, m);

  // Host base (mismo que en tareas.js)
  const API_HOST =
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net";

  const API = {
    COMENT_LIST: `${API_HOST}/db/WEB/ixtla01_c_comentario_requerimiento.php`,
    COMENT_CREATE: `${API_HOST}/db/WEB/ixtla01_i_comentario_requerimiento.php`,
    EMPLEADOS_GET: `${API_HOST}/db/WEB/ixtla01_c_empleado.php`,
  };

  const TASK_TAG_PREFIX = "Tarea-";   // lo que se guarda en BD
  const TASK_TAG_BADGE_PREFIX = "TAREA-"; // cómo se muestra en el badge

  let CURRENT_TASK = null; // { id, requerimiento_id, ... }

  /* ======================================
   *  Session helpers
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
    } catch {}
    return readCookiePayload() || null;
  }

  function getUserAndEmpleadoFromSession() {
    const s = safeGetSession() || {};
    const usuario_id = s?.id_usuario ?? s?.usuario_id ?? null;
    const empleado_id = s?.empleado_id ?? s?.id_empleado ?? null;
    return { usuario_id, empleado_id };
  }

  /* ======================================
   *  Empleados (cache mínima)
   * ======================================*/

  const EMP_CACHE = new Map();

  async function getEmpleadoById(id) {
    const key = Number(id);
    if (!key) return null;
    if (EMP_CACHE.has(key)) return EMP_CACHE.get(key);

    const res = await postJSON(API.EMPLEADOS_GET, { id: key, status: 1 });
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

  const firstTwo = (full = "") =>
    String(full).trim().split(/\s+/).filter(Boolean).slice(0, 2).join(" ") ||
    "—";

  const relShort = (when) => {
    if (!when) return "—";
    const t = Date.parse(String(when));
    if (!t || Number.isNaN(t)) return "—";
    const diff = Date.now() - t;
    const mins = Math.round(diff / 60000);
    if (mins < 1) return "Hace un momento";
    if (mins < 60) return `Hace ${mins} min`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `Hace ${hrs} h`;
    const days = Math.round(hrs / 24);
    if (days === 1) return "Ayer";
    if (days < 7) return `Hace ${days} días`;
    const d = new Date(t);
    return d.toLocaleDateString("es-MX");
  };

  /* ======================================
   *  API Comentarios (requerimiento)
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
    log("COMENT LIST →", API.COMENT_LIST, payload);
    const res = await postJSON(API.COMENT_LIST, payload);
    const raw = res?.data ?? res?.items ?? res;
    const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.rows) ? raw.rows : [];
    log("COMENT LIST respuesta:", arr);
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
    log("COMENT CREATE →", API.COMENT_CREATE, payload);
    const res = await postJSON(API.COMENT_CREATE, payload);
    log("COMENT CREATE respuesta:", res);
    return res;
  }

  /* ======================================
   *  Parse / render helpers de Tarea-{id}
   * ======================================*/

  function parseTaskTagFromText(text, tareaId) {
    const raw = String(text || "");
    const re = /Tarea[-\s]?(\d+)/i;
    const match = raw.match(re);
    if (!match) {
      return {
        isFromTask: false,
        tag: null,
        cleanText: raw.trim(),
        tareaIdFromTag: null,
      };
    }
    const idFromTag = Number(match[1]) || null;
    const isFromTask = tareaId ? idFromTag === Number(tareaId) : true;
    const cleanText = raw.replace(match[0], "").trim();
    const tagLabel = `${TASK_TAG_BADGE_PREFIX}${idFromTag || ""}`;
    return {
      isFromTask,
      tag: tagLabel,
      cleanText,
      tareaIdFromTag: idFromTag,
    };
  }

  function buildFinalCommentTextForTask(tareaId, userText) {
    const base = String(userText || "").trim();
    if (!base) return "";
    const prefix = `${TASK_TAG_PREFIX}${tareaId}`;
    // Evitar duplicar si el usuario ya escribió algo similar
    if (base.toLowerCase().startsWith(prefix.toLowerCase())) {
      return base;
    }
    return `${prefix} ${base}`;
  }

  /* ======================================
   *  Render de comentarios en el drawer
   * ======================================*/

  function updateCommentsCount(count) {
    const pill = $("#kb-comments-count");
    if (!pill) return;
    const n = Number(count) || 0;
    if (n === 0) pill.textContent = "0 comentarios";
    else if (n === 1) pill.textContent = "1 comentario";
    else pill.textContent = `${n} comentarios`;
  }

  function renderEmptyComments() {
    const feed = $("#kb-comments-feed");
    if (!feed) return;
    feed.innerHTML =
      '<p class="empty">Aún no hay comentarios para esta tarea.</p>';
    updateCommentsCount(0);
  }

  async function renderCommentsForTask({ requerimiento_id, tareaId }) {
    const feed = $("#kb-comments-feed");
    if (!feed) return;

    if (!requerimiento_id) {
      warn("Tarea sin requerimiento_id, no se cargan comentarios");
      renderEmptyComments();
      return;
    }

    feed.innerHTML =
      '<p class="empty">Cargando comentarios de la tarea…</p>';

    try {
      const raw = await listComentariosAPI({
        requerimiento_id,
        status: 1,
        page: 1,
        page_size: 200,
      });

      // Filtrar solo los que traen tag de esta tarea
      const filtrados = raw
        .map((r) => ({
          r,
          parsed: parseTaskTagFromText(r.comentario || r.texto || "", tareaId),
        }))
        .filter((p) => p.parsed.isFromTask);

      feed.innerHTML = "";

      if (!filtrados.length) {
        renderEmptyComments();
        return;
      }

      const ids = Array.from(
        new Set(
          filtrados
            .map((p) => Number(p.r.empleado_id) || null)
            .filter(Boolean)
        )
      );
      await Promise.all(ids.map((id) => getEmpleadoById(id).catch(() => null)));

      for (const { r, parsed } of filtrados.sort((a, b) => {
        const aDate = Date.parse(a.r.created_at || a.r.fecha || "") || 0;
        const bDate = Date.parse(b.r.created_at || b.r.fecha || "") || 0;
        return bDate - aDate;
      })) {
        const rec = r;
        const when = relShort(rec.created_at || rec.fecha || "");
        let display = "";

        try {
          const empId =
            Number(rec.empleado_id) > 0 ? Number(rec.empleado_id) : null;
          if (empId) {
            display = (await getEmpleadoById(empId))?.nombre || "";
          }
        } catch {}

        if (!display) {
          display =
            rec.empleado_display ||
            [rec.empleado_nombre, rec.empleado_apellidos]
              .filter(Boolean)
              .join(" ")
              .trim() ||
            rec.nombre ||
            rec.autor ||
            "—";
        }

        const usuarioId =
          (Number(rec.created_by) > 0 && Number(rec.created_by)) ||
          (Number(rec.cuenta_id) > 0 && Number(rec.cuenta_id)) ||
          null;

        const art = document.createElement("article");
        art.className = "msg";

        // Avatar como <img> (recuerda: aquí va la foto real, no texto)
        const img = document.createElement("img");
        img.className = "avatar";
        img.alt = "";
        const avatarSources = [];
        if (usuarioId) {
          const v = `?v=${Date.now()}`;
          avatarSources.push(`/ASSETS/user/userImgs/img_${usuarioId}.png${v}`);
          avatarSources.push(`/ASSETS/user/userImgs/img_${usuarioId}.jpg${v}`);
        }
        avatarSources.push("/ASSETS/user/img_user1.png");

        let i = 0;
        const tryNext = () => {
          if (i >= avatarSources.length) return;
          img.onerror = () => {
            i++;
            tryNext();
          };
          img.src = avatarSources[i];
        };
        tryNext();
        art.appendChild(img);

        // Cuerpo del comentario
        const body = document.createElement("div");
        body.className = "body";
        body.innerHTML = `
          <div class="who">
            <span class="name">${firstTwo(display)}</span>
            <span class="time">${when}</span>
          </div>
          <div class="text">
            ${
              parsed.tag
                ? `<span class="task-tag">${parsed.tag}</span>`
                : ""
            }
            <span class="comment-body"></span>
          </div>
        `;
        const bodyTextNode = body.querySelector(".comment-body");
        if (bodyTextNode) bodyTextNode.textContent = parsed.cleanText || "";
        art.appendChild(body);

        feed.appendChild(art);
      }

      updateCommentsCount(filtrados.length);
    } catch (e) {
      err("Error renderCommentsForTask:", e);
      renderEmptyComments();
      toast("No se pudieron cargar los comentarios de la tarea.", "warning");
    }
  }

  /* ======================================
   *  Composer (enviar comentario)
   * ======================================*/

  function bindComposerEvents() {
    const ta = $("#kb-comment-text");
    const fab = $("#kb-comment-send");
    const btn = $("#kb-comment-btn");
    if (!ta || !fab || !btn) {
      warn("Composer de comentarios no encontrado en DOM");
      return;
    }

    const send = async () => {
      const task = CURRENT_TASK;
      if (!task || !task.requerimiento_id) {
        toast("No hay tarea seleccionada para comentar.", "danger");
        return;
      }

      const rawText = (ta.value || "").trim();
      if (!rawText) return;

      const { usuario_id, empleado_id } = getUserAndEmpleadoFromSession();
      if (!usuario_id) {
        toast("No se encontró tu usuario en la sesión.", "danger");
        return;
      }

      const finalText = buildFinalCommentTextForTask(task.id, rawText);
      fab.disabled = true;
      btn.disabled = true;

      try {
        await createComentarioAPI({
          requerimiento_id: task.requerimiento_id,
          comentario: finalText,
          status: 1,
          created_by: usuario_id,
          empleado_id,
        });

        ta.value = "";
        await renderCommentsForTask({
          requerimiento_id: task.requerimiento_id,
          tareaId: task.id,
        });
        toast("Comentario agregado a la tarea.", "success");
      } catch (e) {
        err("Error creando comentario desde tarea:", e);
        toast("No se pudo agregar el comentario.", "danger");
      } finally {
        fab.disabled = false;
        btn.disabled = false;
      }
    };

    fab.addEventListener("click", (ev) => {
      ev.preventDefault();
      send();
    });

    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      send();
    });

    ta.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        send();
      }
    });
  }

  /* ======================================
   *  API pública del módulo
   * ======================================*/

  async function openForTask(task) {
    CURRENT_TASK = task || null;
    if (!task) {
      renderEmptyComments();
      return;
    }
    await renderCommentsForTask({
      requerimiento_id: task.requerimiento_id,
      tareaId: task.id,
    });
  }

  // Exponer en window para que tareas.js lo pueda usar
  window.KBTaskComments = {
    openForTask,
  };

  // Bind composer una sola vez cuando el DOM esté listo
  document.addEventListener("DOMContentLoaded", () => {
    bindComposerEvents();
  });
})();

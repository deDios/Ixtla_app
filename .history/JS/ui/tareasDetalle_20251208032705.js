// /JS/ui/tareasDetalle.js – Logica del drawer de detalle de tarea
"use strict";

import { listMedia, uploadMedia, setupMedia } from "/JS/api/media.js";

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

  /* ==========================================================================
   *  Endpoints de comentarios (mismo host, rutas relativas)
   * ========================================================================*/

  const ENDPOINTS = {
    COMENT_LIST: "/db/WEB/ixtla01_c_comentario_requerimiento.php",
    COMENT_CREATE: "/db/WEB/ixtla01_i_comentario_requerimiento.php",
  };

  // Nuevo: endpoint de departamentos
  const API_DEPARTAMENTOS = "/db/WEB/ixtla01_c_departamento.php";

  // Resuelve y cachea el nombre de quien autoriza (director del departamento)
  async function resolveAutorizaNombre(task) {
    log("[KB] resolveAutorizaNombre() task:", task);

    if (!task) return null;

    // Si ya lo resolvimos antes, reutilizar
    if (task.autoriza_nombre && task.autoriza_nombre !== "—") {
      log("[KB] autoriza ya cacheado en la tarea:", task.autoriza_nombre);
      return task.autoriza_nombre;
    }

    // 1) Resolver departamento_id desde varias posibles props de la tarea
    let departamentoId =
      task.departamento_id ??
      task.departamento ??
      task.depto_id ??
      task.dept_id ??
      task.deptId ??
      null;

    log("[KB] resolveAutorizaNombre() dept id inicial desde tarea:", departamentoId);

    // Si no viene en la tarea, lo sacamos del requerimiento
    if (!departamentoId && task.requerimiento_id) {
      try {
        let req =
          (ReqCache && typeof ReqCache.get === "function"
            ? ReqCache.get(task.requerimiento_id)
            : null) || null;

        if (!req && typeof fetchRequerimientoById === "function") {
          req = await fetchRequerimientoById(task.requerimiento_id);
        }

        log("[KB] resolveAutorizaNombre() req usado para depto:", req);

        departamentoId =
          req?.departamento_id ??
          req?.departamento ??
          req?.depto_id ??
          req?.dept_id ??
          req?.deptId ??
          null;

        log("[KB] resolveAutorizaNombre() dept id desde req:", departamentoId);
      } catch (e) {
        warn("[KB] Error al resolver departamento desde requerimiento:", e);
      }
    }

    if (!departamentoId) {
      warn("[KB] No se pudo determinar departamento para la tarea", task.id);
      return null;
    }

    // 2) Intentar primero leer del índice de departamentos ya cargado en KB
    try {
      const deptIdx =
        (KB && (KB.deptIndex || KB.indexDepartamentos || KB.deptsIdx || KB.departamentosIdx)) ||
        null;

      if (deptIdx && typeof deptIdx.get === "function") {
        const dFromIdx = deptIdx.get(Number(departamentoId));
        log("[KB] resolveAutorizaNombre() dept desde índice KB:", dFromIdx);

        if (dFromIdx) {
          const nombreDirectorIdx = [
            dFromIdx.director_nombre,
            dFromIdx.director_apellidos,
          ]
            .filter(Boolean)
            .join(" ")
            .trim();

          if (nombreDirectorIdx) {
            task.autoriza_nombre = nombreDirectorIdx;
            log("[KB] autoriza resuelto desde índice KB:", nombreDirectorIdx);
            return nombreDirectorIdx;
          }
        }
      }
    } catch (e) {
      warn("[KB] Error leyendo índice de departamentos en KB:", e);
    }

    // 3) Si por algo no está en el índice, consultar al backend
    try {
      const payload = { id: Number(departamentoId) };
      log("[KB] DEPTO GET →", API_DEPARTAMENTOS, payload);

      const res = await postJSON(API_DEPARTAMENTOS, payload);
      log("[KB] DEPTO GET respuesta cruda:", res);

      // En tu endpoint real: { ok, count, data: [ ... ] }
      const raw = res?.data ?? res?.items ?? res?.rows ?? res;
      const arr = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : [];

      if (!arr.length) {
        warn("[KB] DEPTO GET sin arreglo de departamentos para id:", departamentoId);
        return null;
      }

      // Buscar por id exacto dentro del arreglo
      const d =
        arr.find((row) => Number(row.id) === Number(departamentoId)) ||
        arr[0] ||
        null;

      if (!d) {
        warn("[KB] DEPTO GET sin resultados para id:", departamentoId);
        return null;
      }

      const nombreDirector = [d.director_nombre, d.director_apellidos]
        .filter(Boolean)
        .join(" ")
        .trim();

      if (!nombreDirector) {
        warn(
          "[KB] DEPTO GET sin nombre de director para id:",
          departamentoId,
          d
        );
        return null;
      }

      // cachear en la tarea para siguientes aperturas
      task.autoriza_nombre = nombreDirector;
      log("[KB] autoriza resuelto desde API:", nombreDirector);
      return nombreDirector;
    } catch (e) {
      warn("[KB] Error al consultar departamento para autoriza:", e);
      return null;
    }
  }

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
   *  Media / Evidencias (usando /JS/api/media.js)
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
      raw.src ||
      "";

    const nombre =
      raw.nombre ||
      raw.titulo ||
      raw.descripcion ||
      raw.name ||
      raw.filename ||
      "Archivo";

    const created_at =
      raw.created_at ||
      raw.fecha ||
      raw.fecha_creacion ||
      raw.updated_at ||
      "";

    const created_by =
      raw.created_by_display ||
      raw.created_by_nombre ||
      raw.subido_por ||
      raw.quien ||
      raw.quien_cargo ||
      raw.created_by_name ||
      raw.created_by ||
      "";

    return {
      id,
      url: String(url).trim(),
      nombre: String(nombre).trim(),
      created_at: String(created_at).trim(),
      created_by: String(created_by).trim(),
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

    try {
      log("[KB] listMedia() desde tareasDetalle, folio:", folio);
      const res = await listMedia(folio, null, 1, 100);

      const rawList = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.items)
            ? res.items
            : Array.isArray(res?.rows)
              ? res.rows
              : Array.isArray(res?.data?.rows)
                ? res.data.rows
                : [];

      const items = rawList
        .map(normalizarMediaItem)
        .filter(Boolean)
        .sort((a, b) => {
          const ta = Date.parse(a.created_at || "") || 0;
          const tb = Date.parse(b.created_at || "") || 0;
          return tb - ta;
        });

      return items;
    } catch (e) {
      console.error("[KB] Error al listar media (listMedia):", e);
      toast("No se pudieron cargar las evidencias.", "error");
      return [];
    }
  }

  // ===== Helpers para preview (reusando la idea de requerimientoView) =====












  // ===== Helpers para preview (reusando la idea de requerimientoView) =====

  function isImageUrl(u = "") {
    const clean = (u.split("?")[0] || "").toLowerCase();
    return /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(clean);
  }

  function iconFor(url = "") {
    const ext =
      (url.split("?")[0].match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() ||
      "";

    if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif"].includes(ext))
      return "/ASSETS/filetypes/img.png";
    if (["mp4", "webm", "mov", "m4v"].includes(ext))
      return "/ASSETS/filetypes/video.png";
    if (ext === "pdf") return "/ASSETS/filetypes/pdf.png";

    return "/ASSETS/filetypes/file.png";
  }

  function ensurePreviewModal() {
    if (document.getElementById("modal-media")) return;

    if (!document.getElementById("media-modal-css")) {
      const style = document.createElement("style");
      style.id = "media-modal-css";
      style.textContent = `
        #modal-media.modal-overlay {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(17,24,39,.6);
          -webkit-backdrop-filter: blur(1px);
          backdrop-filter: blur(1px);
          z-index: 99999;
          opacity: 0;
          visibility: hidden;
          transition: opacity .15s ease;
        }
        #modal-media[aria-hidden="false"] {
          opacity: 1;
          visibility: visible;
        }
        #modal-media .modal-content {
          position: relative;
          max-width: min(92vw, 980px);
          max-height: 90vh;
          overflow: auto;
          background: #fff;
          border-radius: 12px;
          padding: 16px 16px 20px;
          box-shadow: 0 12px 48px rgba(0,0,0,.28);
        }
        #modal-media .modal-close {
          position: absolute;
          top: 8px;
          right: 10px;
          border: 0;
          background: transparent;
          font-size: 28px;
          line-height: 1;
          cursor: pointer;
        }
        #modal-media .media-body { margin-top: 8px; }
        #modal-media img#media-img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 0 auto;
          border-radius: 8px;
        }
        body.me-modal-open { overflow: hidden; }
      `;
      document.head.appendChild(style);
    }

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div id="modal-media" class="modal-overlay" aria-hidden="true">
        <div class="modal-content">
          <button class="modal-close" aria-label="Cerrar">&times;</button>
          <div class="media-head" style="margin-bottom:10px;">
            <h3 id="media-title" style="margin:0; font-size:1.05rem; font-weight:700;"></h3>
            <div id="media-meta" style="color:#6b7280; font-size:.85rem; margin-top:4px;"></div>
          </div>
          <div class="media-body">
            <img id="media-img" alt="">
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap.firstElementChild);
  }

  function openPreview({ src, title, who, date }) {
    ensurePreviewModal();
    const overlay = document.getElementById("modal-media");
    const img = document.getElementById("media-img");
    const ttl = document.getElementById("media-title");
    const meta = document.getElementById("media-meta");
    const closeBtn = overlay.querySelector(".modal-close");

    img.src = src;
    ttl.textContent = title || "Evidencia";
    meta.textContent = [who, date].filter(Boolean).join(" • ");

    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("me-modal-open");

    const close = () => {
      overlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("me-modal-open");
      img.src = "";
      overlay.removeEventListener("click", onBackdrop);
      closeBtn.removeEventListener("click", close);
      document.removeEventListener("keydown", onEsc);
    };
    const onBackdrop = (e) => {
      if (e.target === overlay) close();
    };
    const onEsc = (e) => {
      if (e.key === "Escape") close();
    };

    overlay.addEventListener("click", onBackdrop);
    closeBtn.addEventListener("click", close);
    document.addEventListener("keydown", onEsc);
  }

  function bindMediaPreviewForGrid() {
    const wrap = $("#kb-d-evidencias");
    if (!wrap || wrap.__previewBound) return;
    wrap.__previewBound = true;

    wrap.addEventListener("click", (e) => {
      const card = e.target.closest(".kb-evid-item");
      if (!card) return;

      const src =
        card.getAttribute("data-src") ||
        card.dataset.src ||
        "";

      if (!src) return;

      // Si no es imagen → abre en pestaña nueva
      if (!isImageUrl(src)) {
        window.open(src, "_blank", "noopener");
        return;
      }

      e.preventDefault();

      openPreview({
        src,
        title:
          card.getAttribute("data-title") ||
          card.dataset.title ||
          card.querySelector(".kb-evid-name")?.textContent ||
          "Evidencia",
        who:
          card.getAttribute("data-who") ||
          card.dataset.who ||
          "",
        date:
          card.getAttribute("data-date") ||
          card.dataset.date ||
          "",
      });
    });
  }

  function getDomainFromUrl(url) {
    try {
      const u = new URL(url);
      return (u.hostname || "").replace(/^www\./, "");
    } catch {
      return "";
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

      bindMediaPreviewForGrid();
      return;
    }

    for (const it of items) {
      const url = String(it.url || "").trim();
      const isImg = isImageUrl(url);

      const card = document.createElement("button");
      card.type = "button";
      card.className = "kb-evid-item";

      if (url) card.setAttribute("data-src", url);
      if (it.nombre) card.setAttribute("data-title", it.nombre);
      if (it.created_by) card.setAttribute("data-who", it.created_by);
      if (it.created_at) card.setAttribute("data-date", it.created_at);

      const thumb = document.createElement("div");
      thumb.className = "kb-evid-thumb";

      if (isImg && url) {
        const img = document.createElement("img");
        img.src = url;
        img.alt = it.nombre || "Archivo";
        img.loading = "lazy";
        img.classList.add("is-thumb");
        thumb.appendChild(img);
      } else {
        // Link / archivo no imagen → iconito bonito
        const icon = document.createElement("span");
        icon.className = "kb-evid-file-icon";
        icon.textContent = "🔗";
        thumb.classList.add("is-link");
        thumb.appendChild(icon);
      }

      const meta = document.createElement("div");
      meta.className = "kb-evid-meta";

      const title = document.createElement("div");
      title.className = "kb-evid-name";
      title.textContent = it.nombre || (url ? getDomainFromUrl(url) : "Archivo");

      const info = document.createElement("div");
      info.className = "kb-evid-info";

      const host = url ? getDomainFromUrl(url) : "";
      const by = it.created_by || "";
      const when = relShort(it.created_at);

      const parts = [];
      if (host) parts.push(host);
      if (by) parts.push(by);
      if (when) parts.push(when);

      info.textContent = parts.join(" • ");

      meta.appendChild(title);
      meta.appendChild(info);

      card.appendChild(thumb);
      card.appendChild(meta);

      wrap.appendChild(card);
    }

    bindMediaPreviewForGrid();
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
    const folio = await getFolioForRequerimiento(reqId);

    if (!folio) {
      toast("No se pudo obtener el folio del requerimiento.", "error");
      return;
    }

    // Opcional: detectar status para carpeta destino (mismo patrón de requerimientoView)
    const status = (() => {
      const sel = document.querySelector('#req-status [data-role="status-select"]');
      if (sel) return Number(sel.value || 0);
      const cur = document.querySelector(".step-menu li.current");
      return cur ? Number(cur.getAttribute("data-status")) : 0;
    })();

    try {
      log("[KB] setupMedia() →", folio);
      try {
        await setupMedia(folio);
      } catch (e) {
        // si falla no rompemos, uploadMedia puede seguir si el backend lo maneja
        console.warn("[KB] setupMedia() falló (no crítico):", e);
      }

      log("[KB] uploadMedia() → folio, status, files:", folio, status, files);
      const out = await uploadMedia({ folio, status, files });

      const saved = out?.saved?.length || 0;
      const failed = out?.failed?.length || 0;
      const skipped = out?.skipped?.length || 0;

      if (saved) toast(`Subida exitosa: ${saved} archivo(s).`, "success");
      if (failed) toast(`Fallo servidor: ${failed} archivo(s).`, "danger");
      if (skipped) toast(`Descartados localmente: ${skipped}.`, "warn");

      await loadEvidenciasForTask(task);
    } catch (e) {
      console.error("[KB] Error en uploadMedia():", e);
      toast("No se pudo subir la evidencia.", "error");
    }
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

  function parseTaskTagFromComment(rawComment) {
    const text = String(rawComment || "").trim();
    if (!text) {
      return {
        tag: null,
        cleanText: "",
      };
    }

    // Detecta "Tarea-123 " al inicio (sin importar mayúsculas/minúsculas)
    const match = text.match(/^Tarea-(\d+)\b\s*/i);
    if (!match) {
      return {
        tag: null,
        cleanText: text,
      };
    }

    const tareaId = match[1];

    let cleanText = text.slice(match[0].length).trim();
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

    const ordered = [...all].sort((a, b) => {
      const aDate = Date.parse(a.created_at || a.fecha || "") || 0;
      const bDate = Date.parse(b.created_at || b.fecha || "") || 0;
      return bDate - aDate;
    });

    for (const c of ordered) {
      const originalText = c.comentario || c.texto || "";
      const { tag, cleanText } = parseTaskTagFromComment(originalText);
      const texto = cleanText || originalText;

      let display =
        c.empleado_display ||
        [c.empleado_nombre, c.empleado_apellidos].filter(Boolean).join(" ").trim() ||
        c.nombre ||
        c.autor ||
        "—";

      const cuando = relShort(c.created_at || c.fecha || "");

      const usuarioId =
        (Number(c.created_by) > 0 && Number(c.created_by)) ||
        (Number(c.cuenta_id) > 0 && Number(c.cuenta_id)) ||
        null;

      const sources = makeAvatarSourcesByUsuarioId(usuarioId);

      const article = document.createElement("article");
      article.className = "msg";

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
      textWrap.style.whiteSpace = "pre-wrap";
      textWrap.style.wordBreak = "break-word";

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
      lblCount.textContent = total === 1 ? "1 comentario" : `${total} comentarios`;
    }

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

  // =======================================================================
  //  Generar expediente de la tarea (solo datos principales)
  // =======================================================================
  async function generarExpedienteDeTarea(taskOrId) {
    // Resolver la tarea a partir de id u objeto
    const task =
      taskOrId && typeof taskOrId === "object"
        ? taskOrId
        : getTaskById(taskOrId);

    if (!task) {
      toast("No se encontró la tarea seleccionada.", "warning");
      return;
    }

    // Intentar traer el requerimiento para folio / depto / trámite (opcional)
    let req = null;
    if (task.requerimiento_id) {
      try {
        req =
          (ReqCache && typeof ReqCache.get === "function"
            ? ReqCache.get(task.requerimiento_id)
            : null) || null;

        if (!req && typeof fetchRequerimientoById === "function") {
          req = await fetchRequerimientoById(task.requerimiento_id);
        }
      } catch (e) {
        warn("[KB] Error al resolver requerimiento para expediente:", e);
      }
    }

    // Folio: si hay req usamos el real, si no lo que traiga la task
    let folio = task.folio || "—";
    if (req && (req.folio || req.id != null)) {
      try {
        folio = formatFolio ? formatFolio(req.folio, req.id) : folio;
      } catch (e) {
        // si por algo formatFolio no está disponible, ignoramos
        console.error("[KB] Error usando formatFolio en expediente:", e);
      }
    }

    // Status legible
    const S = KB.STATUS || {};
    const statusLabels = {
      [S.TODO]: "Por hacer",
      [S.PROCESO]: "En proceso",
      [S.REVISAR]: "En revisión",
      [S.HECHO]: "Terminado",
      [S.PAUSA]: "Bloqueado",
    };
    const statusLabel = statusLabels[task.status] || "—";

    // Fechas principales
    const fechaCreacion = task.created_at || "—";
    const fechaInicio = task.fecha_inicio || "—";
    const fechaFin = task.fecha_fin || "—";

    // Textos de apoyo
    const tramite = task.tramite_nombre || req?.tramite_nombre || "—";
    const proceso = task.proceso_titulo || "—";
    const tituloTarea = task.titulo || `Tarea ${task.id}`;
    const asignado =
      task.asignado_display ||
      task.asignado_nombre ||
      (task.asignado_a != null ? `Empleado ${task.asignado_a}` : "—");

    const creadoPor = task.creado_por_display || task.creado_por || "—";
    const depto =
      req?.departamento_nombre ||
      req?.departamento ||
      task.departamento_nombre ||
      "—";

    // Descripción corta
    const descripcion =
      task.descripcion ||
      task.desc ||
      "Sin descripción registrada para esta tarea.";

    // IMPORTANTE: NO incluimos evidencias ni comentarios aquí.
    // Solo datos principales de la tarea / requerimiento.

    const today = new Date();
    const fechaHoy = today.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Expediente de Tarea ${task.id}</title>
  <style>
    * {
      box-sizing: border-box;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
        sans-serif;
    }
    body {
      margin: 24px;
      font-size: 13px;
      color: #111827;
    }
    h1 {
      font-size: 20px;
      margin: 0 0 4px;
      color: #111827;
    }
    h2 {
      font-size: 14px;
      margin: 24px 0 8px;
      color: #111827;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .exp-header {
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .exp-header-meta {
      font-size: 12px;
      text-align: right;
      color: #6b7280;
    }
    .exp-chip {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 11px;
      border: 1px solid #d1d5db;
      color: #374151;
      background: #f9fafb;
      margin-left: 4px;
    }
    .exp-table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0 12px;
    }
    .exp-table th,
    .exp-table td {
      border: 1px solid #e5e7eb;
      padding: 6px 8px;
      vertical-align: top;
    }
    .exp-table th {
      width: 32%;
      background: #f3f4f6;
      font-weight: 600;
      text-align: left;
      color: #374151;
    }
    .exp-desc {
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      background: #f9fafb;
      padding: 8px 10px;
      font-size: 12px;
      line-height: 1.4;
      white-space: pre-wrap;
    }
    .exp-footer {
      margin-top: 32px;
      font-size: 11px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
  </style>
</head>
<body>
  <header class="exp-header">
    <div>
      <h1>Expediente de Tarea ${task.id}</h1>
      <div>Folio relacionado: <strong>${folio}</strong></div>
      <div>Trámite: <strong>${tramite}</strong></div>
    </div>
    <div class="exp-header-meta">
      <div>Generado el ${fechaHoy}</div>
      <div>Status:
        <span class="exp-chip">${statusLabel}</span>
      </div>
    </div>
  </header>

  <h2>Datos principales</h2>
  <table class="exp-table">
    <tr>
      <th>Título de la tarea</th>
      <td>${tituloTarea}</td>
    </tr>
    <tr>
      <th>Proceso</th>
      <td>${proceso}</td>
    </tr>
    <tr>
      <th>Departamento</th>
      <td>${depto}</td>
    </tr>
    <tr>
      <th>Asignado a</th>
      <td>${asignado}</td>
    </tr>
    <tr>
      <th>Creado por</th>
      <td>${creadoPor}</td>
    </tr>
    <tr>
      <th>Fechas</th>
      <td>
        Creación: ${fechaCreacion}<br/>
        Inicio: ${fechaInicio}<br/>
        Cierre: ${fechaFin}
      </td>
    </tr>
  </table>

  <h2>Descripción</h2>
  <div class="exp-desc">${descripcion}</div>

  <div class="exp-footer">
    <div>Este expediente fue generado desde el tablero de tareas de Ixtla.</div>
    <div>Solo incluye los <strong>datos principales</strong> de la tarea (sin evidencias ni comentarios).</div>
  </div>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) {
      toast("No se pudo abrir la ventana para el expediente (pop-up bloqueado).", "warning");
      return;
    }

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    // Si quieres lanzar inmediatamente el diálogo de impresión / PDF:
    // win.print();
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

    if (creadoPorEl) {
      creadoPorEl.textContent =
        task.created_by_nombre ||
        task.creado_por_nombre ||
        task.creado_por_display ||
        "—";
    }

    if (autorizaEl) {
      autorizaEl.textContent = task.autoriza_nombre || "—";
    }
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

    resolveAutorizaNombre(task)
      .then((nombre) => {
        if (!nombre) return;
        const autorizaEl = $("#kb-d-autoriza");
        if (autorizaEl) autorizaEl.textContent = nombre;
      })
      .catch((e) =>
        console.error("[KB] Error al resolver quien autoriza:", e)
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
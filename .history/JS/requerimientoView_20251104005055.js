// /JS/requerimientoView.js
(function () {
  "use strict";

  /* ========================================================================
   * Helpers base (expuestos a Planeación)
   * ======================================================================*/
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const log   = (...a) => console.log("[RequerimientoView]", ...a);
  const warn  = (...a) => console.warn("[RequerimientoView]", ...a);
  const err   = (...a) => console.error("[RequerimientoView]", ...a);
  const toast = (m, t = "info") =>
    (window.gcToast ? gcToast(m, t) : console.log("[toast]", t, m));

  const firstTwo = (full="") => String(full).trim().split(/\s+/).filter(Boolean).slice(0,2).join(" ") || "—";

  // Exponer helpers mínimos para otros módulos (Planeación)
  window._rvHelpers = { $, $$, toast };

  /* ========================================================================
   * Animaciones / acordeones (compartido con Planeación)
   * ======================================================================*/
  function animateOpen(el) {
    el.hidden = false;
    el.style.overflow = "hidden";
    el.style.height = "0px";
    el.getBoundingClientRect();
    const h = el.scrollHeight;
    el.style.transition = "height 180ms ease";
    el.style.height = h + "px";
    const done = () => {
      el.style.transition = ""; el.style.height = ""; el.style.overflow = "";
      el.removeEventListener("transitionend", done);
    };
    el.addEventListener("transitionend", done);
  }
  function animateClose(el) {
    el.style.overflow = "hidden";
    const h = el.offsetHeight;
    el.style.height = h + "px";
    el.getBoundingClientRect();
    el.style.transition = "height 160ms ease";
    el.style.height = "0px";
    const done = () => {
      el.hidden = true;
      el.style.transition = ""; el.style.height = ""; el.style.overflow = "";
      el.removeEventListener("transitionend", done);
    };
    el.addEventListener("transitionend", done);
  }
  function setAccordionOpen(head, body, open) {
    head.setAttribute("aria-expanded", open ? "true" : "false");
    open ? animateOpen(body) : animateClose(body);
  }
  window.setAccordionOpen = setAccordionOpen; // usado por Planeación

  /* ========================================================================
   * Evidencias (UI)
   * ======================================================================*/
  function findEvidenciasAccordion() {
    return (
      document.querySelector('[data-acc="evidencias"]') ||
      document.querySelector('.exp-accordion--evidencias') ||
      document.querySelector('#evidencias-accordion') ||
      (() => {
        const accs = document.querySelectorAll('.exp-accordion');
        for (const acc of accs) {
          const headText = (acc.querySelector('.exp-acc-head')?.textContent || '').toLowerCase();
          if (headText.includes('evidencia')) return acc;
        }
        return null;
      })()
    );
  }
  function findEvidenciasTable() {
    const acc = findEvidenciasAccordion();
    return acc ? acc.querySelector('.exp-table') : null;
  }

  function initAccordionsEvidencias() {
    const acc = findEvidenciasAccordion();
    if (!acc) return;
    const head = $(".exp-acc-head", acc), body = $(".exp-acc-body", acc);
    if (!head || !body) return;
    const initOpen = head.getAttribute("aria-expanded") === "true";
    body.hidden = !initOpen; if (!initOpen) body.style.height = "0px";
    head.addEventListener("click", () => {
      const isOpen = head.getAttribute("aria-expanded") === "true";
      setAccordionOpen(head, body, !isOpen);
    });
    head.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); head.click(); }
    });
  }

  function initSortableTables() {
    const table = findEvidenciasTable();
    if (!table) return;
    const head = $(".exp-thead", table);
    const rows = () => $$(".exp-row", table);
    if (!head) return;

    head.addEventListener("click", (e) => {
      const sortSpan = e.target.closest(".sort"); if (!sortSpan) return;
      const th = sortSpan.closest("div");
      const headers = $$(".exp-thead > div", table);
      const idx = headers.indexOf(th); if (idx < 0) return;

      const dir = sortSpan.dataset.dir === "asc" ? "desc" : "asc";
      headers.forEach(h => { const s = $(".sort", h); if (s && s !== sortSpan) s.dataset.dir = ""; });
      sortSpan.dataset.dir = dir;

      const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
      const arr = rows();
      arr.sort((a, b) => {
        const av = (a.children[idx]?.textContent || "").trim();
        const bv = (b.children[idx]?.textContent || "").trim();
        const cmp = collator.compare(av, bv);
        return dir === "asc" ? cmp : -cmp;
      });
      arr.forEach(r => r.parentElement.appendChild(r));
    });
  }

  /* ========================================================================
   * Stepper
   * ======================================================================*/
  const statusLabel = (s) =>
    ({ 0: "Solicitud", 1: "Revisión", 2: "Asignación", 3: "Proceso", 4: "Pausado", 5: "Cancelado", 6: "Finalizado" })[Number(s)] || "—";
  const statusBadgeClass = (s) =>
    ({ 0: "is-muted", 1: "is-info", 2: "is-info", 3: "is-info", 4: "is-warning", 5: "is-danger", 6: "is-success" })[Number(s)] || "is-info";

  function paintStepper(next) {
    const items = $$(".step-menu li");
    items.forEach(li => {
      const s = Number(li.dataset.status);
      li.classList.remove("current");
      if (s < next) li.classList.add("complete"); else li.classList.remove("complete");
      if (s === next) li.classList.add("current");
    });
    const container = document.querySelector('.container');
    const current = document.querySelector('.step-menu li.current');
    if (container && current) {
      const cRect = container.getBoundingClientRect();
      const iRect = current.getBoundingClientRect();
      const delta = (iRect.left + iRect.width/2) - (cRect.left + cRect.width/2);
      container.scrollBy({ left: delta, behavior: 'smooth' });
    }
  }
  window.paintStepper = paintStepper;

  function initStepper() {
    const menu = $(".step-menu"); if (!menu) return;
    menu.addEventListener("click", (e) => {
      const li = e.target.closest("li"); if (!li) return;
      $$("li", menu).forEach(it => it.classList.remove("current"));
      li.classList.add("current");
    });
  }

  /* ========================================================================
   * Reset plantilla (valores vacíos)
   * ======================================================================*/
  const fillText = (sel, txt) => { const n = $(sel); if (n) n.textContent = (txt ?? "—"); };
  function resetTemplate() {
    const h1 = $(".exp-title h1"); if (h1) h1.textContent = "—";
    $$(".exp-meta dd").forEach(dd => dd.textContent = "—");

    const contactoVals = $$('.exp-pane[data-tab="Contacto"] .exp-grid .exp-val');
    contactoVals.forEach((n, i) => {
      if (i === 3) {
        const a = n.querySelector("a");
        if (a) { a.textContent = "—"; a.removeAttribute("href"); }
        else n.textContent = "—";
      } else n.textContent = "—";
    });

    const detallesVals = $$('.exp-pane[data-tab="detalles"] .exp-grid .exp-val');
    detallesVals.forEach((n, i) => {
      if (i === 3) n.innerHTML = '<span class="exp-badge is-info">—</span>';
      else n.textContent = "—";
    });

    const evTable = findEvidenciasTable();
    if (evTable) evTable.querySelectorAll('.exp-row').forEach(r => r.remove());

    const items = $$(".step-menu li");
    items.forEach(li => li.classList.remove("current", "complete"));
    const sol = items.find(li => Number(li.dataset.status) === 0);
    sol?.classList.add("current");

    const feed = $(".c-feed"); if (feed) feed.innerHTML = "";
  }

  /* ========================================================================
   * HTTP + Session
   * ======================================================================*/
  const ENDPOINTS = {
    REQUERIMIENTO_GET:  "/db/WEB/ixtla01_c_requerimiento.php",
    COMENT_LIST:        "/db/WEB/ixtla01_c_comentario_requerimiento.php",
    COMENT_CREATE:      "/db/WEB/ixtla01_i_comentario_requerimiento.php",
  };

  async function postJSON(url, body) {
    console.groupCollapsed("[HTTP] POST", url);
    console.log("→ payload:", body);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {})
      });
      const txt = await res.text();
      let json;
      try { json = JSON.parse(txt); } catch { json = { raw: txt }; }
      console.log("← status:", res.status, "json:", json);
      console.groupEnd();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return json;
    } catch (e) {
      console.groupEnd();
      throw e;
    }
  }

  // Lee cookie ix_emp segura (usa Session.get() si existe)
  function safeGetSession() {
    try {
      if (window.Session?.get) return window.Session.get();
    } catch {}
    try {
      const pair = document.cookie.split("; ").find(c => c.startsWith("ix_emp="));
      if (!pair) return null;
      const raw = decodeURIComponent(pair.split("=")[1] || "");
      const json = JSON.parse(decodeURIComponent(escape(atob(raw))));
      if (json && typeof json === "object") return json;
    } catch {}
    return null;
  }

  /* ========================================================================
   * Normalización requerimiento + UI
   * ======================================================================*/
  function buildDireccion(calle, colonia) {
    const a = String(calle || "").trim();
    const b = String(colonia || "").trim();
    return [a, b].filter(Boolean).join(", ");
  }

  function normalizeRequerimiento(raw = {}) {
    const toId = (v)=> (v==null? null : String(v));
    const id = toId(raw.id ?? raw.requerimiento_id);
    const folio = String(raw.folio ?? raw.folio_requerimiento ?? "").trim();

    const tramite = String(raw.tramite ?? raw.tramite_nombre ?? raw.nombre_tramite ?? "").trim();
    const asunto  = String(raw.asunto ?? raw.titulo ?? "").trim();
    const descripcion = String(raw.descripcion ?? raw.detalle ?? "").trim();

    const contacto_nombre   = String(raw.contacto_nombre ?? raw.nombre_contacto ?? raw.contacto ?? "").trim();
    const contacto_telefono = String(raw.contacto_telefono ?? raw.telefono_contacto ?? raw.telefono ?? "").trim();
    const contacto_email    = String(raw.contacto_email ?? raw.email_contacto ?? raw.correo ?? "").trim();
    const contacto_calle    = String(raw.contacto_calle ?? raw.direccion ?? raw.calle ?? "").trim();
    const contacto_colonia  = String(raw.contacto_colonia ?? raw.colonia ?? "").trim();
    const contacto_cp       = String(raw.contacto_cp ?? raw.cp ?? raw.codigo_postal ?? "").trim();
    const direccion_reporte = buildDireccion(contacto_calle, contacto_colonia);

    const asignado_nombre   = String(raw.asignado_nombre ?? raw.nombre_asignado ?? raw.empleado_nombre ?? "").trim();
    const asignado_apellidos= String(raw.asignado_apellidos ?? raw.empleado_apellidos ?? "").trim();
    const asignado_full     = String(raw.asignado_full || [asignado_nombre, asignado_apellidos].filter(Boolean).join(" ")).trim();

    const estatus_code = Number(raw.estatus_code ?? raw.estatus ?? raw.status ?? raw.estado ?? 0);
    const prioridad    = (raw.prioridad != null) ? Number(raw.prioridad) : null;
    const canal        = (raw.canal != null) ? Number(raw.canal) : null;

    const creado_at      = String(raw.creado_at ?? raw.created_at ?? raw.fecha_creacion ?? "").trim();
    const actualizado_at = String(raw.actualizado_at ?? raw.updated_at ?? "").trim();
    const cerrado_en     = raw.cerrado_en != null ? String(raw.cerrado_en).trim() : null;

    return {
      id, folio,
      tramite, asunto, descripcion,
      contacto_nombre, contacto_telefono, contacto_email,
      contacto_calle, contacto_colonia, contacto_cp, direccion_reporte,
      asignado_full,
      estatus_code, prioridad, canal,
      creado_at, actualizado_at, cerrado_en,
      raw
    };
  }

  async function getRequerimientoById(id) {
    const payload = { id };
    const res = await postJSON(ENDPOINTS.REQUERIMIENTO_GET, payload);
    let data = res?.data ?? res;
    if (Array.isArray(data)) data = data[0] || {};
    return normalizeRequerimiento(data);
  }

  function paintRequerimiento(req) {
    console.groupCollapsed("[UI] Pintar requerimiento");
    console.log("req:", req);

    const titulo = req.tramite || req.asunto || "Requerimiento";
    const h1 = $(".exp-title h1"); if (h1) h1.textContent = titulo;

    // Encabezado: Contacto (nombre completo), Encargado, Fecha solicitado
    const ddC = $(".exp-meta > div:nth-child(1) dd");
    const ddE = $(".exp-meta > div:nth-child(2) dd");
    const ddF = $(".exp-meta > div:nth-child(3) dd");
    if (ddC) ddC.textContent = (req.contacto_nombre || "—");   // ← nombre completo
    if (ddE) ddE.textContent = req.asignado_full || "—";
    if (ddF) ddF.textContent = (req.creado_at || "—").replace("T"," ");

    // Tab Contacto (nombre completo)
    const contactoGrid = $('.exp-pane[role="tabpanel"][data-tab="Contacto"] .exp-grid');
    if (contactoGrid) {
      const set = (nth, val) => {
        const node = $(`.exp-field:nth-child(${nth}) .exp-val`, contactoGrid);
        if (!node) return;
        if (nth === 4) {
          const a = node.querySelector("a");
          if (a) { a.textContent = val || "—"; val ? (a.href = `mailto:${val}`) : a.removeAttribute("href"); }
          else node.textContent = val || "—";
        } else {
          node.textContent = val || "—";
        }
      };
      set(1, (req.contacto_nombre || "—")); // ← completo
      set(2, req.contacto_telefono || "—");
      set(3, [req.contacto_calle, req.contacto_colonia].filter(Boolean).join(", "));
      set(4, req.contacto_email || "—");
      set(5, req.contacto_cp || "—");
    }

    // Tab Detalles
    const detalles = $('.exp-pane[role="tabpanel"][data-tab="detalles"] .exp-grid');
    if (detalles) {
      const put = (nth, value, isHTML=false) => {
        const node = $(`.exp-field:nth-child(${nth}) .exp-val`, detalles);
        if (!node) return;
        if (isHTML) node.innerHTML = value;
        else node.textContent = value ?? "—";
      };
      put(1, titulo);
      put(2, req.asignado_full || "—");
      put(3, (req.contacto_nombre || "—")); // “Asignado” (si luego cambia, ajústalo)
      // Estatus (badge)
      const badgeWrap = $(`.exp-field:nth-child(4) .exp-val`, detalles);
      if (badgeWrap) {
        const cls = statusBadgeClass(req.estatus_code);
        const lbl = statusLabel(req.estatus_code);
        badgeWrap.innerHTML = `<span class="exp-badge ${cls}">${lbl}</span>`;
      }
      // Descripción
      const descNode = $(`.exp-field.exp-field--full .exp-val`, detalles);
      if (descNode) descNode.textContent = req.descripcion || "—";
      // Fechas
      const fIni = $(`.exp-field:nth-child(6) .exp-val`, detalles);
      if (fIni) fIni.textContent = (req.creado_at || "").split(" ")[0] || "—";
      const fFin = $(`.exp-field:nth-child(7) .exp-val`, detalles);
      if (fFin) fFin.textContent = req.cerrado_en ? String(req.cerrado_en).split(" ")[0] : "—";
    }

    // Stepper
    if (window.paintStepper) window.paintStepper(Number(req.estatus_code ?? 0));

    console.groupEnd();
  }

  /* ========================================================================
   * Comentarios: listar / crear
   * ======================================================================*/
  async function listComentariosAPI({ requerimiento_id, status=1, page=1, page_size=100 }) {
    const payload = { requerimiento_id: Number(requerimiento_id), status, page, page_size };
    const res = await postJSON(ENDPOINTS.COMENT_LIST, payload);
    const raw = res?.data ?? res?.items ?? res;
    const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.rows) ? raw.rows : []);
    return arr;
  }

  async function createComentarioAPI({ requerimiento_id, empleado_id, comentario, status=1, created_by }) {
    const payload = {
      requerimiento_id: Number(requerimiento_id),
      empleado_id: empleado_id ?? null,
      comentario,
      status,
      created_by: created_by ?? empleado_id ?? null
    };
    return postJSON(ENDPOINTS.COMENT_CREATE, payload);
  }

  function renderCommentsList(items = [], requerimiento_id) {
    console.groupCollapsed("[Comentarios][UI] render");
    console.log("items crudos (antes de map):", items);

    // Filtrado defensivo por si la API ignora el parámetro
    const filtered = items.filter(r => {
      const rid = r.requerimiento_id ?? r.req_id ?? r.requerimiento ?? null;
      return rid == null ? true : String(rid) === String(requerimiento_id);
    });

    console.log("items filtrados:", filtered);

    const feed = $(".c-feed"); if (!feed) { console.groupEnd(); return; }
    feed.innerHTML = "";
    filtered.forEach(r => {
      const nombre = r.nombre || r.empleado_nombre || r.autor || r.created_by || "—";
      const texto  = r.comentario || r.texto || "";
      const cuando = r.created_at || r.fecha || "ahora";

      const art = document.createElement("article");
      art.className = "msg";
      art.innerHTML = `
        <img class="avatar" src="/ASSETS/user/img_user1.png" alt="">
        <div>
          <div class="who"><span class="name">${firstTwo(nombre)}</span> <span class="time">${cuando}</span></div>
          <div class="text" style="white-space:pre-wrap;word-break:break-word;"></div>
        </div>`;
      $(".text", art).textContent = texto;
      feed.appendChild(art);
    });
    const scroller = feed.parentElement || feed;
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
    console.groupEnd();
  }

  async function loadComentarios(requerimiento_id) {
    console.groupCollapsed("[Comentarios] list");
    try {
      const arr = await listComentariosAPI({ requerimiento_id, status: 1, page: 1, page_size: 100 });
      renderCommentsList(arr, requerimiento_id);
    } catch (e) {
      warn("Error listando comentarios:", e);
      renderCommentsList([], requerimiento_id);
    } finally {
      console.groupEnd();
    }
  }

  function interceptComposer(requerimiento_id) {
    const ta = $(".composer textarea");
    const btn = $(".composer .send-fab");
    if (!ta || !btn) return;

    const sess = safeGetSession();
    const empleado_id =
      sess?.empleado_id ?? sess?.id_empleado ??
      sess?.id_usuario ?? sess?.cuenta_id ?? null;

    const send = async () => {
      const texto = (ta.value || "").trim();
      if (!texto) return;

      const payload = {
        requerimiento_id,
        empleado_id: empleado_id ?? null,
        comentario: texto,
        status: 1,
        created_by: empleado_id ?? null
      };

      console.groupCollapsed("[Comentarios] create");
      console.log("→ payload:", payload);
      try {
        btn.disabled = true;
        const res = await createComentarioAPI(payload);
        console.log("← respuesta:", res);
        ta.value = "";
        await loadComentarios(requerimiento_id);
      } catch (e) {
        err("Error creando comentario:", e);
        toast("No se pudo enviar el comentario (revisa permisos/credenciales).", "danger");
      } finally {
        btn.disabled = false;
        console.groupEnd();
      }
    };

    // Interceptar para evitar que algo más lo capture
    btn.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); send(); }, { capture: true });
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.stopPropagation(); e.preventDefault(); send();
      }
    }, { capture: true });
  }

  /* ========================================================================
   * Boot
   * ======================================================================*/
  async function boot() {
    resetTemplate();
    initAccordionsEvidencias();
    initSortableTables();
    initStepper();

    // Inicializa Planeación (UI puro por ahora)
    if (window.Planeacion?.init) {
      try { window.Planeacion.init(); } catch (e) { warn("Planeacion.init() error:", e); }
    }

    console.groupCollapsed("[Boot] Detalle");
    const params = new URL(window.location.href).searchParams;
    const reqId = params.get("id");
    console.log("URL:", window.location.href, "reqId:", reqId);

    if (!reqId) {
      console.warn("Sin ?id= en URL; no se consultará backend.");
      console.groupEnd();
      return;
    }

    // Detalle
    try {
      const req = await getRequerimientoById(reqId);
      console.log("Requerimiento (normalizado):", req);
      paintRequerimiento(req);
    } catch (e) {
      warn("Error consultando requerimiento:", e);
    }

    // Comentarios + composer
    await loadComentarios(reqId);
    interceptComposer(reqId);

    console.groupEnd();
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

})();

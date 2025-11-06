// /JS/requerimientoPlaneacion.js
(function () {
  "use strict";

  // ===== Helpers (desde requerimientoView o fallback) =====
  const H = window._rvHelpers || {};
  const $  = H.$  || ((s, r=document)=>r.querySelector(s));
  const $$ = H.$$ || ((s, r=document)=>Array.from(r.querySelectorAll(s)));
  const toast = H.toast || ((m,t="info")=>console.log("[toast]", t, m));
  const setAccordionOpen = window.setAccordionOpen || ((h,b,open)=>{ b.hidden=!open; });

  const log  = (...a)=>console.log("[Planeación]", ...a);
  const warn = (...a)=>console.warn("[Planeación]", ...a);
  const err  = (...a)=>console.error("[Planeación]", ...a);

  // ===== Endpoints (ajusta PROCESO_CREATE si es necesario) =====
  const ENDPOINTS = {
    PROCESO_CREATE: "/db/WEB/ixtla01_i_proceso.php",
  };

  // ===== Selectores / referencias de UI =====
  const SEL = {
    toolbar: {
      addProceso: "#btn-add-proceso",
      addTarea:   "#btn-add-tarea",
    },
    planeacionList: "#planeacion-list",

    // Modal Nueva Tarea
    modalT:        "#modal-tarea",
    formT:         "#form-tarea",
    selProceso:    "#tarea-proceso",
    inpTitulo:     "#tarea-titulo",
    inpEsfuerzo:   "#tarea-esfuerzo",
    inpInicio:     "#tarea-inicio",
    inpFin:        "#tarea-fin",
    inpAsignado:   "#tarea-asignado",
    txtDesc:       "#tarea-desc",

    // Modal Nuevo Proceso (HTML que pegaste)
    modalP:   "#modal-proceso",
    formP:    "#form-proceso",
    txtDescP: "#proceso-desc",
  };

  // ===== Estado interno / flags para evitar doble binding =====
  let _boundToolbar = false;
  let _boundModalT  = false;
  let _boundModalP  = false;

  // ===== Utils HTTP + sesión (locales a este módulo) =====
  async function postJSON(url, body) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {})
      });
      const txt = await res.text();
      let json; try { json = JSON.parse(txt); } catch { json = { raw: txt }; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return json;
    } catch (e) { throw e; }
  }

  function safeGetSession() {
    try { if (window.Session?.get) return window.Session.get(); } catch {}
    try {
      const pair = document.cookie.split("; ").find(c => c.startsWith("ix_emp="));
      if (!pair) return null;
      const raw = decodeURIComponent(pair.split("=")[1] || "");
      return JSON.parse(decodeURIComponent(escape(atob(raw))));
    } catch {}
    return null;
  }

  // ===== API: crear proceso =====
  async function createProcesoAPI({ requerimiento_id, empleado_id, descripcion, status = 1, created_by }) {
    const payload = {
      requerimiento_id: Number(requerimiento_id),
      empleado_id,
      descripcion,
      status,
      created_by
    };
    return postJSON(ENDPOINTS.PROCESO_CREATE, payload);
  }

  // ===== Utilidades =====
  function collectProcesos() {
    return $$('#planeacion-list .exp-accordion--fase[data-proceso-id]');
  }

  function bindProcessAccordion(sec) {
    const head = sec.querySelector(".exp-acc-head");
    const body = sec.querySelector(".exp-acc-body");
    const chev = head?.querySelector(".chev");
    if (!head || !body || !chev) return;

    const initOpen = head.getAttribute("aria-expanded") === "true";
    body.hidden = !initOpen; if (!initOpen) body.style.height = "0px";

    head.addEventListener("click", (e) => {
      if (!e.target.closest(".chev")) return; // solo chevron abre/cierra
    });

    chev.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = head.getAttribute("aria-expanded") === "true";
      setAccordionOpen(head, body, !isOpen);
    });
  }

  function fillProcesoSelect(preferId = null) {
    const sel = $(SEL.selProceso); if (!sel) return;
    sel.innerHTML = '<option value="" disabled selected>Selecciona un proceso…</option>';
    const procesos = collectProcesos();
    procesos.forEach((sec, idx) => {
      const id = sec.getAttribute('data-proceso-id') || `p${idx+1}`;
      const title = sec.querySelector('.fase-title')?.textContent?.trim() || `Proceso ${idx+1}`;
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = title;
      sel.appendChild(opt);
    });
    if (preferId) sel.value = preferId;
  }

  // ACEPTA id opcional para usar el devuelto por el backend
  function createProcess({ id: givenId, title, fechaInicio, porcentaje = 0 } = {}) {
    const list = $(SEL.planeacionList);
    if (!list) { toast("No existe el contenedor de planeación.", "danger"); return null; }

    const count = collectProcesos().length;
    const id = givenId != null ? String(givenId) : `p${Date.now()}`;
    const name = (title || "").trim() || `Proceso ${count + 1}`;
    const fechaIso = fechaInicio || new Date().toISOString().slice(0,10);
    const pct = Math.max(0, Math.min(100, Number(porcentaje || 0)));

    const sec = document.createElement("section");
    sec.className = "exp-accordion exp-accordion--fase";
    sec.setAttribute("data-proceso-id", id);

    sec.innerHTML = `
      <!-- HEADER -->
      <button class="exp-acc-head" type="button" aria-expanded="true">
        <div class="fase-left">
          <div class="fase-head">
            <span class="fase-title">${name}</span>
            <small class="fase-meta">0 actividades</small>
          </div>
        </div>

        <div class="fase-right">
          <span class="fase-label">Estatus</span>
          <span class="exp-progress" aria-label="${pct}%">
            <span class="bar" style="width:${pct}%"></span>
            <span class="pct">${pct}%</span>
          </span>
          <span class="fase-label">Fecha de inicio</span>
          <span class="fase-date">${fechaIso.split("-").reverse().join("/")}</span>
          <span class="chev" aria-hidden="true"></span>
        </div>
      </button>

      <!-- BODY -->
      <div class="exp-acc-body">
        <div class="exp-table exp-table--planeacion is-card">
          <div class="exp-thead">
            <div>Actividad</div>
            <div>Responsable</div>
            <div>Estatus</div>
            <div>Porcentaje</div>
            <div>Fecha de inicio</div>
          </div>
          <!-- filas .exp-row se insertarán aquí -->
        </div>
      </div>
    `;

    list.appendChild(sec);
    bindProcessAccordion(sec);

    // Si el modal de tarea está abierto, refrescamos su select
    const modalT = document.querySelector(SEL.modalT);
    if (modalT && (modalT.classList.contains("open") || modalT.getAttribute("aria-hidden")==="false")) {
      fillProcesoSelect(id);
    }

    return sec;
  }

  function addTaskToProcess(procesoId, tarea) {
    const sec = $(`#planeacion-list .exp-accordion--fase[data-proceso-id="${CSS.escape(procesoId)}"]`);
    if (!sec) { toast("No se encontró el proceso seleccionado.", "danger"); return false; }

    const head  = sec.querySelector(".exp-acc-head");
    const body  = sec.querySelector(".exp-acc-body");
    const table = sec.querySelector(".exp-table--planeacion");
    if (!table) { toast("No existe la tabla de planeación en ese proceso.", "danger"); return false; }

    const row = document.createElement("div");
    row.className = "exp-row";
    const pct = Math.max(0, Math.min(100, Number(tarea.porcentaje ?? 0)));

    row.innerHTML = `
      <div class="actividad"></div>
      <div class="responsable"></div>
      <div class="estatus"><span class="exp-badge is-info">Activo</span></div>
      <div class="porcentaje"><span class="exp-progress xs"><span class="bar" style="width:${pct}%"></span></span></div>
      <div class="fecha"></div>
    `;
    row.querySelector(".actividad").textContent   = tarea.titulo || "Nueva actividad";
    row.querySelector(".responsable").textContent = tarea.asignado || "—";
    row.querySelector(".fecha").textContent       = tarea.fecha_inicio || "—";
    table.appendChild(row);

    const meta = head?.querySelector(".fase-meta");
    if (meta) {
      const match = meta.textContent.match(/(\d+)/);
      const num = match ? parseInt(match[1], 10) : 0;
      meta.textContent = `${num + 1} actividades`;
    }

    if (head && body && head.getAttribute("aria-expanded") !== "true") {
      setAccordionOpen(head, body, true);
    }

    return true;
  }

  // ===== Modal Nueva Tarea =====
  function openTareaModal({ preferProcesoId = null } = {}) {
    const modal = document.querySelector(SEL.modalT);
    const modalContent = modal?.querySelector(".modal-content");
    if (!modal || !modalContent) return;

    fillProcesoSelect(preferProcesoId);
    const form = document.querySelector(SEL.formT);
    form && form.reset();

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("me-modal-open");

    if (!_boundModalT) {
      modal.addEventListener("click", (e)=>{ if (e.target === modal) closeTareaModal(); });
      modalContent.addEventListener("mousedown", (e)=>{
        if (e.target.closest(".modal-close")) return;
        if (e.target.closest("[data-modal-pass]")) return;
        e.stopPropagation();
      }, { capture: true });
      modalContent.addEventListener("click", (e)=>{
        if (e.target.closest(".modal-close")) closeTareaModal();
      }, { capture: true });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.classList.contains("open")) closeTareaModal();
      });
      bindSubmitNuevaTarea();
      _boundModalT = true;
    }

    setTimeout(() => $(SEL.selProceso)?.focus(), 30);
  }

  function closeTareaModal() {
    const modal = document.querySelector(SEL.modalT);
    if (!modal) return;
    modal.classList.remove("open", "active");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("me-modal-open");
  }

  function bindSubmitNuevaTarea() {
    const form = document.querySelector(SEL.formT);
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const procesoId = $(SEL.selProceso)?.value || "";
      const titulo    = ($(SEL.inpTitulo)?.value || "").trim();
      const esfuerzo  = Number($(SEL.inpEsfuerzo)?.value || 0);
      const fechaI    = $(SEL.inpInicio)?.value || "";
      const fechaF    = $(SEL.inpFin)?.value || "";
      const asignado  = ($(SEL.inpAsignado)?.value || "").trim();
      const desc      = ($(SEL.txtDesc)?.value || "").trim();

      if (!procesoId) { toast("Selecciona un proceso.", "warning"); $(SEL.selProceso)?.focus(); return; }
      if (!titulo)    { toast("Escribe un título.", "warning"); $(SEL.inpTitulo)?.focus(); return; }
      if (!(esfuerzo > 0)) { toast("Define el esfuerzo (mínimo 1).", "warning"); $(SEL.inpEsfuerzo)?.focus(); return; }

      const ok = addTaskToProcess(procesoId, {
        titulo, esfuerzo, fecha_inicio: fechaI, fecha_fin: fechaF, asignado, descripcion: desc, porcentaje: 0
      });
      if (ok) {
        toast("Tarea creada en el proceso seleccionado", "success");
        closeTareaModal();
      }
    });
  }

  // ===== Modal Nuevo Proceso =====
  function openProcesoModal() {
    const modal = document.querySelector(SEL.modalP);
    const content = modal?.querySelector(".modal-content");
    const txt = document.querySelector(SEL.txtDescP);
    if (!modal || !content || !txt) { warn("Modal de proceso no está en el DOM"); return; }

    txt.value = "";

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("me-modal-open");

    if (!_boundModalP) {
      modal.addEventListener("click", (e)=>{ if (e.target === modal) closeProcesoModal(); });
      content.addEventListener("click", (e)=>{
        if (e.target.closest(".modal-close")) closeProcesoModal();
      }, { capture: true });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.classList.contains("open")) closeProcesoModal();
      });

      bindSubmitNuevoProceso();
      _boundModalP = true;
    }

    setTimeout(()=>txt.focus(), 20);
  }

  function closeProcesoModal() {
    const modal = document.querySelector(SEL.modalP);
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("me-modal-open");
  }

  function bindSubmitNuevoProceso() {
    const form = document.querySelector(SEL.formP);
    const txt  = document.querySelector(SEL.txtDescP);
    if (!form || !txt) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const descripcion = (txt.value || "").trim();
      if (!descripcion) { txt.focus(); return; }

      // requerimiento_id de la URL
      const params = new URL(window.location.href).searchParams;
      const requerimiento_id = params.get("id");

      // empleado_id / created_by de la sesión
      const sess = safeGetSession();
      const empleado_id = sess?.empleado_id ?? sess?.id_empleado ?? sess?.id_usuario ?? sess?.cuenta_id ?? null;
      const created_by  = empleado_id;

      if (!requerimiento_id || !empleado_id) {
        toast("Faltan datos de sesión o requerimiento para crear el proceso.", "danger");
        return;
      }

      try {
        const res = await createProcesoAPI({ requerimiento_id, empleado_id, descripcion, status: 1, created_by });
        const newId =
          res?.id ??
          res?.data?.id ??
          res?.insert_id ??
          res?.data?.insert_id ??
          null;

        // Pintar el proceso con el ID del backend
        const sec = createProcess({ id: newId != null ? String(newId) : undefined, title: descripcion, porcentaje: 0 });
        if (sec) {
          toast("Proceso creado.", "success");
          // Si sólo hay un proceso ahora, enfocar su cabecera
          try { sec.querySelector(".exp-acc-head")?.focus?.(); } catch {}
        }

        // Aviso para otros módulos si necesitan engancharse
        document.dispatchEvent(new CustomEvent('planeacion:proceso:create', {
          detail: { id: newId, requerimiento_id, descripcion, created_by }
        }));

        closeProcesoModal();
      } catch (e) {
        err("Error creando proceso:", e);
        toast("No se pudo crear el proceso.", "danger");
      }
    });
  }

  // ===== Toolbar (botones principales) =====
  function bindToolbar() {
    if (_boundToolbar) return;

    const btnProceso = document.querySelector(SEL.toolbar.addProceso);
    const btnTarea   = document.querySelector(SEL.toolbar.addTarea);

    // AHORA: el botón “Nuevo proceso +” abre el modal (no crea local directo)
    btnProceso?.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      openProcesoModal();
    });

    btnTarea?.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const procesos = collectProcesos();
      if (procesos.length === 0) {
        toast("Primero crea un proceso.", "warning");
        return;
      }
      const prefer = (procesos.length === 1) ? (procesos[0].getAttribute("data-proceso-id")) : null;
      openTareaModal({ preferProcesoId: prefer });
    });

    _boundToolbar = true;
    log("Toolbar enlazada");
  }

  // ===== API pública =====
  window.Planeacion = {
    init() {
      // Re-bindea acordeones existentes (si los hay en HTML)
      $$('#planeacion-list .exp-accordion--fase').forEach(bindProcessAccordion);
      // Enlaza toolbar
      bindToolbar();
      log("init OK");
    },
    // Expuestos por si los necesitas
    createProcess,
    openTareaModal,
    addTaskToProcess,
  };

})();

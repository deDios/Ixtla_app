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
  };

  // ===== Estado interno / flags para evitar doble binding =====
  let _boundToolbar = false;
  let _boundModalT  = false;

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

  function createProcess({ title, fechaInicio, porcentaje = 0 } = {}) {
    const list = $(SEL.planeacionList);
    if (!list) { toast("No existe el contenedor de planeación.", "danger"); return null; }

    const count = collectProcesos().length;
    const id = `p${Date.now()}`;
    const name = (title || "").trim() || `Proceso ${count + 1}`;
    const fecha = fechaInicio || new Date().toISOString().slice(0,10);
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
          <span class="fase-date">${fecha.split("-").reverse().join("/")}</span>
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

    // Si el modal está abierto, refrescamos el select
    const modalOpen = document.querySelector(SEL.modalT)?.classList.contains("open");
    if (modalOpen) fillProcesoSelect(id);

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

  // ===== Toolbar (botones principales) =====
  function bindToolbar() {
    if (_boundToolbar) return;

    const btnProceso = document.querySelector(SEL.toolbar.addProceso);
    const btnTarea   = document.querySelector(SEL.toolbar.addTarea);

    btnProceso?.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const sec = createProcess({ porcentaje: 0 });
      if (sec) {
        toast("Se creó un nuevo tablero de procesos", "success");
        sec.scrollIntoView({ behavior: "smooth", block: "start" });
      }
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
    // (opcionales por si luego los necesitas desde otros scripts)
    createProcess,
    openTareaModal,
    addTaskToProcess,
  };

})();


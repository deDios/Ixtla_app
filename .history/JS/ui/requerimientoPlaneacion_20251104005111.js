// /JS/requerimientoPlaneacion.js
(function(){
  "use strict";

  // Helpers desde el core
  const $    = (window._rvHelpers && window._rvHelpers.$)    || ((s,r=document)=>r.querySelector(s));
  const $$   = (window._rvHelpers && window._rvHelpers.$$)   || ((s,r=document)=>Array.from(r.querySelectorAll(s)));
  const toast= (window._rvHelpers && window._rvHelpers.toast)|| ((m,t)=>console.log("[toast]", t||"info", m));

  const setAccordionOpen = window.setAccordionOpen || function(){};

  // ====== Refs del modal "Nueva tarea" ======
  const modalT        = $("#modal-tarea");
  const formT         = $("#form-tarea");
  const selProceso    = $("#tarea-proceso");
  const inpTitulo     = $("#tarea-titulo");
  const inpEsfuerzo   = $("#tarea-esfuerzo");
  const inpInicio     = $("#tarea-inicio");
  const inpFin        = $("#tarea-fin");
  const inpAsignado   = $("#tarea-asignado");
  const txtDesc       = $("#tarea-desc");
  const btnCloseT     = modalT?.querySelector(".modal-close");
  const modalContentT = modalT?.querySelector(".modal-content");

  let _modalTBound = false;

  // ====== Utils Planeación ======
  function collectProcesos() {
    return $$('#planeacion-list .exp-accordion--fase[data-proceso-id]');
  }

  function fillProcesoSelect(preferId = null) {
    if (!selProceso) return;
    selProceso.innerHTML = '<option value="" disabled selected>Selecciona un proceso…</option>';
    const procesos = collectProcesos();
    procesos.forEach((sec, idx) => {
      const id = sec.getAttribute('data-proceso-id') || `p${idx+1}`;
      const title = $('.fase-title', sec)?.textContent?.trim() || `Proceso ${idx+1}`;
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = title;
      selProceso.appendChild(opt);
    });
    if (preferId) selProceso.value = preferId;
  }

  function bindProcessAccordion(sec) {
    const head = sec.querySelector(".exp-acc-head");
    const body = sec.querySelector(".exp-acc-body");
    const chev = head?.querySelector(".chev");
    if (!head || !body || !chev) return;

    const initOpen = head.getAttribute("aria-expanded") === "true";
    body.hidden = !initOpen; if (!initOpen) body.style.height = "0px";

    head.addEventListener("click", (e) => {
      if (!e.target.closest(".chev")) return; // solo chevron
    });

    chev.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = head.getAttribute("aria-expanded") === "true";
      setAccordionOpen(head, body, !isOpen);
    });
  }

  function createProcess({ title, fechaInicio, porcentaje = 0 } = {}) {
    const list = $("#planeacion-list");
    if (!list) { toast("No existe el contenedor de planeación.", "error"); return null; }

    const count = collectProcesos().length;
    const id = `p${Date.now()}`; // id único temporal (hasta que tengamos id de BD)
    const name = (title || "").trim() || `Proceso ${count + 1}`;
    const fecha = fechaInicio || new Date().toISOString().slice(0,10); // YYYY-MM-DD
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

    // Si el modal de tarea está abierto, refrescar el select y preseleccionar el nuevo
    if ($("#modal-tarea")?.classList.contains("open")) {
      fillProcesoSelect(id);
    }

    return sec;
  }

  function openTareaModal({ preferProcesoId = null } = {}) {
    if (!modalT || !modalContentT) return;
    fillProcesoSelect(preferProcesoId);
    formT?.reset();

    modalT.classList.add("open");
    modalT.setAttribute("aria-hidden", "false");
    document.body.classList.add("me-modal-open");

    if (!_modalTBound) {
      modalT.addEventListener("click", onBackdropClickT);
      // permitir clics en .modal-close pasar
      modalContentT.addEventListener("mousedown", stopT, { capture: true });
      modalContentT.addEventListener("click",      stopT, { capture: true });
      _modalTBound = true;
    }
    setTimeout(() => (selProceso?.focus()), 40);
  }
  function stopT(e){
    if (e.target.closest(".modal-close")) return;
    if (e.target.closest("[data-modal-pass]")) return;
    e.stopPropagation();
  }
  function onBackdropClickT(e){ if (e.target === modalT) closeTareaModal(); }
  function closeTareaModal() {
    if (!modalT) return;
    modalT.classList.remove("open", "active");
    modalT.setAttribute("aria-hidden", "true");
    document.body.classList.remove("me-modal-open");
  }
  btnCloseT?.addEventListener("click", closeTareaModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalT?.classList.contains("open")) closeTareaModal();
  });
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("#modal-tarea .modal-close");
    if (btn && document.querySelector("#modal-tarea")?.classList.contains("open")) {
      e.preventDefault();
      closeTareaModal();
    }
  });
  document.addEventListener("click", (e) => {
    const modalEl = document.querySelector("#modal-tarea");
    if (!modalEl) return;
    if (e.target === modalEl && e.target.classList.contains("open")) {
      closeTareaModal();
    }
  });

  // Insertar tarea en el acordeón/tabla (UI)
  function addTaskToProcess(procesoId, tarea) {
    const sec = $(`#planeacion-list .exp-accordion--fase[data-proceso-id="${CSS.escape(procesoId)}"]`);
    if (!sec) { toast("No se encontró el proceso seleccionado.", "error"); return false; }

    const head = $(".exp-acc-head", sec);
    const body = $(".exp-acc-body", sec);
    const table = $(".exp-table--planeacion", sec);
    if (!table) { toast("No existe la tabla de planeación en ese proceso.", "error"); return false; }

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
    $(".actividad", row).textContent = tarea.titulo || "Nueva actividad";
    $(".responsable", row).textContent = tarea.asignado || "—";
    $(".fecha", row).textContent = tarea.fecha_inicio || "—";

    table.appendChild(row);

    const meta = $(".fase-meta", head);
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

  // Submit modal tarea (UI)
  formT?.addEventListener("submit", (e) => {
    e.preventDefault();
    const procesoId = selProceso?.value || "";
    const titulo    = (inpTitulo?.value || "").trim();
    const esfuerzo  = Number(inpEsfuerzo?.value || 0);
    const fechaI    = inpInicio?.value || "";
    const fechaF    = inpFin?.value || "";
    const asignado  = (inpAsignado?.value || "").trim();
    const desc      = (txtDesc?.value || "").trim();

    if (!procesoId) { toast("Selecciona un proceso.", "warning"); selProceso?.focus(); return; }
    if (!titulo)    { toast("Escribe un título.", "warning"); inpTitulo?.focus(); return; }
    if (!(esfuerzo > 0)) { toast("Define el esfuerzo (mínimo 1).", "warning"); inpEsfuerzo?.focus(); return; }

    const ok = addTaskToProcess(procesoId, {
      titulo, esfuerzo, fecha_inicio: fechaI, fecha_fin: fechaF, asignado, descripcion: desc, porcentaje: 0
    });
    if (ok) {
      toast("Tarea creada en el proceso seleccionado", "success");
      closeTareaModal();
    }
  });

  // Toolbar Planeación
  function initPlaneacionToolbar() {
    const btnProceso = $("#btn-add-proceso");
    const btnTarea   = $("#btn-add-tarea");

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
  }

  // Acordeones de procesos existentes (al cargar)
  function initAccordionsPlaneacion() {
    const list = $("#planeacion-list");
    if (!list) return;

    $$(".exp-accordion--fase", list).forEach(acc => {
      bindProcessAccordion(acc);
    });
  }

  // API pública
  window.Planeacion = {
    init() {
      initAccordionsPlaneacion();
      initPlaneacionToolbar();
    },
    collectProcesos,
    fillProcesoSelect,
    createProcess,
    addTaskToProcess,
    openTareaModal,
  };

})();

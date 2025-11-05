// /JS/requerimientoView.js
(function () {
  "use strict";

  /* ========================================================================
   * Helpers base
   * ======================================================================*/
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const log  = (...a) => console.log("[RequerimientoView]", ...a);
  const warn = (...a) => console.warn("[RequerimientoView]", ...a);
  const err  = (...a) => console.error("[RequerimientoView]", ...a);
  const toast = (m, t = "info") =>
    (window.gcToast ? gcToast(m, t) : console.log("[toast]", t, m));

  // Exponer helpers mínimos para otros módulos
  if (!window._rvHelpers) window._rvHelpers = { $, $$, toast };

  /* ========================================================================
   * Estado del requerimiento (códigos)
   * ======================================================================*/
  const STATUS = {
    solicitud: 0,
    revision: 1,
    asignacion: 2,
    enProceso: 3,
    pausado: 4,
    cancelado: 5,
    finalizado: 6,
  };

  // Fuente de estado actual (DOM)
  function getCurrentStatus() {
    const v1 = Number(document.body.getAttribute("data-req-status"));
    if (!Number.isNaN(v1)) return v1;

    const tag = $("[data-status-code]");
    if (tag) {
      const v2 = Number(tag.getAttribute("data-status-code"));
      if (!Number.isNaN(v2)) return v2;
    }

    // fallback
    return STATUS.revision;
  }

  function setCurrentStatus(next) {
    document.body.setAttribute("data-req-status", String(next));
  }

  /* ========================================================================
   * Modal Estado (pausar / cancelar / etc.)
   * ======================================================================*/
  const ModalEstado = (() => {
    const modal = $("#modal-estado");          // <div id="modal-estado" class="modal-overlay">
    if (!modal) return null;

    const closeBtn = modal.querySelector(".modal-close");

    function open() {
      modal.setAttribute("aria-hidden", "false");
      modal.classList.add("active");
    }
    function close() {
      modal.setAttribute("aria-hidden", "true");
      modal.classList.remove("active");
    }

    // Cerrar al hacer click en overlay
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });

    // Botón "x"
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        close();
      });
    }

    // Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") {
        close();
      }
    });

    // Exponer
    return { open, close, el: modal };
  })();

  // Acceso por consola si se requiere
  if (ModalEstado) window.modalEstado = ModalEstado;

  /* ========================================================================
   * Acciones por estado (toolbar)
   * ======================================================================*/
  function actionsContainer() {
    return $("#estado-actions") || $(".estado-actions") || null;
  }

  // Mostrar / ocultar por data-act
  function setVisible(act, show) {
    const c = actionsContainer();
    if (!c) return;
    const el = c.querySelector(`[data-act="${act}"]`);
    if (!el) return;
    el.style.display = show ? "" : "none";
    el.toggleAttribute("hidden", !show);
  }

  // Reordenar botones dentro del contenedor
  function orderActions(orderArr) {
    const c = actionsContainer();
    if (!c) return;
    orderArr.forEach((act) => {
      const el = c.querySelector(`[data-act="${act}"]`);
      if (el) c.appendChild(el);
    });
  }

  // Pintar UI de acciones según estado
  function renderActionsByStatus(currentStatus) {
    const all = ["asignar","iniciar","pausar","cancelar","finalizar","reanudar"];
    all.forEach((a) => setVisible(a, false));

    if (currentStatus === STATUS.revision) {
      // En revisión: pausar, cancelar, asignar a departamento
      setVisible("pausar",   true);
      setVisible("cancelar", true);
      setVisible("asignar",  true);
      orderActions(["pausar","cancelar","asignar"]);
    }

    if (currentStatus === STATUS.asignacion) {
      // "Iniciar proceso" solo desde ASIGNACIÓN
      setVisible("iniciar",  true);
      // (si deseas permitir pausar/cancelar aquí, quedan visibles)
      setVisible("pausar",   true);
      setVisible("cancelar", true);
      orderActions(["pausar","cancelar","iniciar"]);
    }

    if (currentStatus === STATUS.enProceso) {
      // En proceso: pausar, cancelar, finalizar (en ese orden)
      setVisible("pausar",    true);
      setVisible("cancelar",  true);
      setVisible("finalizar", true);
      orderActions(["pausar","cancelar","finalizar"]);
    }

    if (currentStatus === STATUS.pausado) {
      // En pausado: mostrar "Reanudar" (etiqueta corta)
      const c = actionsContainer();
      if (c) {
        const btnRe = c.querySelector(`[data-act="reanudar"]`);
        if (btnRe) btnRe.textContent = "Reanudar";
      }
      setVisible("reanudar", true);
      setVisible("cancelar", true); // opcional
      orderActions(["reanudar","cancelar"]);
    }

    if (currentStatus === STATUS.cancelado || currentStatus === STATUS.finalizado) {
      // Estados terminales: no mostrar acciones
    }
  }

  // Handlers (UI-only por ahora)
  function wireActionHandlers() {
    const c = actionsContainer();
    if (!c) return;

    // Reanudar -> vuelve a Revisión
    const re = c.querySelector(`[data-act="reanudar"]`);
    if (re) {
      re.addEventListener("click", (e) => {
        e.preventDefault();
        setCurrentStatus(STATUS.revision);
        renderActionsByStatus(STATUS.revision);
        toast("Requerimiento reanudado: estado 'Revisión'.", "success");
      });
    }

    // Iniciar (visible solo en asignación; aquí sin backend)
    const ini = c.querySelector(`[data-act="iniciar"]`);
    if (ini) {
      ini.addEventListener("click", (e) => {
        e.preventDefault();
        toast("Iniciar proceso (pendiente de backend).", "info");
      });
    }

    // Pausar / Cancelar / Finalizar (placeholders)
    ["pausar","cancelar","finalizar","asignar"].forEach((act) => {
      const btn = c.querySelector(`[data-act="${act}"]`);
      if (btn) {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          // Podemos abrir el modal de estado si aplica
          if (ModalEstado && (act === "pausar" || act === "cancelar")) {
            ModalEstado.open();
          } else {
            toast(`Acción "${act}" (pendiente de backend).`, "info");
          }
        });
      }
    });
  }

  /* ========================================================================
   * Observador de cambios (si algún otro módulo cambia data-req-status)
   * ======================================================================*/
  function observeStatusAttribute() {
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "attributes" && m.attributeName === "data-req-status") {
          const st = getCurrentStatus();
          renderActionsByStatus(st);
        }
      }
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ["data-req-status"] });
  }

  /* ========================================================================
   * Init
   * ======================================================================*/
  function init() {
    log("Boot requerimientoView.js");
    const st = getCurrentStatus();
    renderActionsByStatus(st);
    wireActionHandlers();
    observeStatusAttribute();

    // Exponer controlador de acciones (útil desde otros scripts)
    window._rvActions = {
      STATUS,
      getStatus: getCurrentStatus,
      setStatus: (next) => {
        setCurrentStatus(next);
        renderActionsByStatus(next);
      },
      refresh: () => renderActionsByStatus(getCurrentStatus()),
    };

    log("Detalle listo");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();


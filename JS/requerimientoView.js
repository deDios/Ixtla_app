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

  /* ========================================================================
   * Contenedor de acciones
   * ======================================================================*/
  // 🔴 Ahora apunta al contenedor real del HTML: #req-actions.exp-actions
  function actionsContainer() {
    return $("#req-actions") || $(".exp-actions") || $("#estado-actions") || $(".estado-actions") || null;
  }

  // Etiquetas por acción
  const ACTION_LABEL = {
    asignar:   "Asignar a departamento",
    iniciar:   "Iniciar proceso",
    pausar:    "Pausar",
    cancelar:  "Cancelar",
    finalizar: "Finalizar",
    reanudar:  "Reanudar",
  };

  // Crea los botones si no existen (idempotente)
  function ensureActions() {
    const c = actionsContainer();
    if (!c) return null;

    const acts = ["asignar","iniciar","pausar","cancelar","finalizar","reanudar"];
    acts.forEach((act) => {
      let btn = c.querySelector(`[data-act="${act}"]`);
      if (!btn) {
        btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("data-act", act);
        // clases genéricas y no intrusivas (ajústalas si tienes un estilo específico)
        btn.className = "exp-btn action-btn";
        btn.textContent = ACTION_LABEL[act] || act;
        c.appendChild(btn);
      } else {
        // asegurar la etiqueta correcta (p.ej. Reanudar sin “proceso”)
        btn.textContent = ACTION_LABEL[act] || act;
      }
    });
    return c;
  }

  /* ========================================================================
   * Modal Estado (pausar / cancelar)
   * ======================================================================*/
  const ModalEstado = (() => {
    const modal = $("#modal-estado");
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

    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        close();
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") close();
    });

    return { open, close, el: modal };
  })();
  if (ModalEstado) window.modalEstado = ModalEstado;

  /* ========================================================================
   * Estado actual (leer/escribir)
   * ======================================================================*/
  function getCurrentStatus() {
    const v1 = Number(document.body.getAttribute("data-req-status"));
    if (!Number.isNaN(v1)) return v1;

    const tag = $("[data-status-code]");
    if (tag) {
      const v2 = Number(tag.getAttribute("data-status-code"));
      if (!Number.isNaN(v2)) return v2;
    }
    return STATUS.revision;
  }
  function setCurrentStatus(next) {
    document.body.setAttribute("data-req-status", String(next));
  }

  /* ========================================================================
   * Mostrar/ocultar/orden de acciones
   * ======================================================================*/
  function setVisible(act, show) {
    const c = actionsContainer();
    if (!c) return;
    const el = c.querySelector(`[data-act="${act}"]`);
    if (!el) return;
    el.style.display = show ? "" : "none";
    el.toggleAttribute("hidden", !show);
  }
  function orderActions(orderArr) {
    const c = actionsContainer();
    if (!c) return;
    orderArr.forEach((act) => {
      const el = c.querySelector(`[data-act="${act}"]`);
      if (el) c.appendChild(el);
    });
  }

  function renderActionsByStatus(currentStatus) {
    ensureActions(); // garantiza que existan
    const all = ["asignar","iniciar","pausar","cancelar","finalizar","reanudar"];
    all.forEach((a) => setVisible(a, false));

    if (currentStatus === STATUS.revision) {
      // Solo ver: pausar, cancelar, asignar a departamento
      setVisible("pausar",   true);
      setVisible("cancelar", true);
      setVisible("asignar",  true);
      orderActions(["pausar","cancelar","asignar"]);
    }

    if (currentStatus === STATUS.asignacion) {
      // "Iniciar proceso" aparece desde ASIGNACIÓN
      setVisible("iniciar",  true);
      setVisible("pausar",   true);
      setVisible("cancelar", true);
      orderActions(["pausar","cancelar","iniciar"]);
    }

    if (currentStatus === STATUS.enProceso) {
      // Orden: pausar, cancelar, finalizar
      setVisible("pausar",    true);
      setVisible("cancelar",  true);
      setVisible("finalizar", true);
      orderActions(["pausar","cancelar","finalizar"]);
    }

    if (currentStatus === STATUS.pausado) {
      // Reanudar (etiqueta corta) y opcionalmente cancelar
      const c = actionsContainer();
      if (c) {
        const btnRe = c.querySelector(`[data-act="reanudar"]`);
        if (btnRe) btnRe.textContent = "Reanudar";
      }
      setVisible("reanudar", true);
      setVisible("cancelar", true);
      orderActions(["reanudar","cancelar"]);
    }

    // cancelado/finalizado => sin acciones
  }

  /* ========================================================================
   * Handlers
   * ======================================================================*/
  function wireActionHandlers() {
    const c = ensureActions();
    if (!c) return;

    // Reanudar => vuelve a Revisión
    c.querySelectorAll(`[data-act="reanudar"]`).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        setCurrentStatus(STATUS.revision);
        renderActionsByStatus(STATUS.revision);
        toast("Requerimiento reanudado: estado 'Revisión'.", "success");
      });
    });

    // Iniciar (placeholder)
    c.querySelectorAll(`[data-act="iniciar"]`).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        toast("Iniciar proceso (pendiente de backend).", "info");
      });
    });

    // Pausar / Cancelar / Finalizar / Asignar (placeholder + modal en pausar/cancelar)
    ["pausar","cancelar","finalizar","asignar"].forEach((act) => {
      c.querySelectorAll(`[data-act="${act}"]`).forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          if (ModalEstado && (act === "pausar" || act === "cancelar")) {
            ModalEstado.open();
          } else {
            toast(`Acción "${ACTION_LABEL[act] || act}" (pendiente de backend).`, "info");
          }
        });
      });
    });
  }

  /* ========================================================================
   * Observer de cambios en data-req-status
   * ======================================================================*/
  function observeStatusAttribute() {
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "attributes" && m.attributeName === "data-req-status") {
          renderActionsByStatus(getCurrentStatus());
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
    ensureActions();                        // crea botones si no existen
    renderActionsByStatus(getCurrentStatus());
    wireActionHandlers();
    observeStatusAttribute();

    window._rvActions = {
      STATUS,
      getStatus: getCurrentStatus,
      setStatus: (next) => { setCurrentStatus(next); renderActionsByStatus(next); },
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



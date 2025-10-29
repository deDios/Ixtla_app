// /JS/requerimientoView.js
(() => {
  "use strict";

  /* ============================ Helpers ============================ */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const toast = (m, t = "info") => (window.gcToast ? gcToast(m, t) : console.log("[toast]", t, m));

  const STATUS = {
    0: "Solicitud",
    1: "Revisión",
    2: "Asignación",
    3: "Proceso",
    4: "Pausado",
    5: "Cancelado",
    6: "Finalizado",
  };

  /* ============================ Stepper ============================ */
  function stepperReset(defaultStatus = 0) {
    const items = $$(".step-menu li");
    if (!items.length) return;
    items.forEach((li) => {
      li.classList.remove("current", "complete");
    });
    // marca sólo el estado por defecto como current
    const current = items.find((li) => Number(li.dataset.status) === Number(defaultStatus));
    if (current) current.classList.add("current");
  }

  function paintStepper(nextStatus = 0) {
    const items = $$(".step-menu li");
    items.forEach((li) => {
      const s = Number(li.dataset.status);
      li.classList.remove("current", "complete");
      if (s < nextStatus) li.classList.add("complete");
      if (s === nextStatus) li.classList.add("current");
    });
  }
  // expone para otros módulos
  window.paintStepper = paintStepper;

  function initStepperClicks() {
    const menu = $(".step-menu");
    if (!menu) return;
    menu.addEventListener("click", (e) => {
      const li = e.target.closest("li[role='button']");
      if (!li) return;
      // Visual solamente (la lógica de negocio la hace el módulo de Acciones)
      $$("li", menu).forEach((it) => it.classList.remove("current"));
      li.classList.add("current");
      // refresca acciones por si dependemos del current visual
      window.ReqActions?.refresh();
    });
  }

  /* ============================ Acordeones con animación ============================ */
  function animateOpen(el) {
    el.hidden = false;
    el.style.overflow = "hidden";
    el.style.height = "0px";
    // forzar reflow
    el.getBoundingClientRect();
    el.style.transition = "height 180ms ease";
    el.style.height = el.scrollHeight + "px";
    const done = () => {
      el.style.transition = "";
      el.style.height = "";
      el.style.overflow = "";
      el.removeEventListener("transitionend", done);
    };
    el.addEventListener("transitionend", done);
  }

  function animateClose(el) {
    el.style.overflow = "hidden";
    el.style.height = el.offsetHeight + "px";
    el.getBoundingClientRect();
    el.style.transition = "height 160ms ease";
    el.style.height = "0px";
    const done = () => {
      el.hidden = true;
      el.style.transition = "";
      el.style.height = "";
      el.style.overflow = "";
      el.removeEventListener("transitionend", done);
    };
    el.addEventListener("transitionend", done);
  }

  function setAccordionOpen(head, body, open) {
    head.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) animateOpen(body);
    else animateClose(body);
  }

  function initAccordions() {
    const accs = $$(".exp-accordion");
    accs.forEach((acc) => {
      const head = $(".exp-acc-head", acc);
      const body = $(".exp-acc-body", acc);
      if (!head || !body) return;
      const initOpen = head.getAttribute("aria-expanded") === "true";
      body.hidden = !initOpen;
      head.addEventListener("click", () => {
        const isOpen = head.getAttribute("aria-expanded") === "true";
        setAccordionOpen(head, body, !isOpen);
      });
      head.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          head.click();
        }
      });
    });
  }

  /* ============================ Tablas ordenables ============================ */
  function initSortableTables() {
    const tables = $$(".exp-table");
    tables.forEach((table) => {
      const head = $(".exp-thead", table);
      const rows = () => $$(".exp-row", table);
      if (!head) return;

      head.addEventListener("click", (e) => {
        const sortSpan = e.target.closest(".sort");
        if (!sortSpan) return;
        const th = sortSpan.closest("div");
        const headers = $$(".exp-thead > div", table);
        const idx = headers.indexOf(th);
        if (idx < 0) return;

        const dir = sortSpan.dataset.dir === "asc" ? "desc" : "asc";
        headers.forEach((h) => {
          const s = $(".sort", h);
          if (s && s !== sortSpan) s.dataset.dir = "";
        });
        sortSpan.dataset.dir = dir;

        const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
        const arr = rows();
        arr.sort((a, b) => {
          const av = (a.children[idx]?.textContent || "").trim();
          const bv = (b.children[idx]?.textContent || "").trim();
          const cmp = collator.compare(av, bv);
          return dir === "asc" ? cmp : -cmp;
        });
        arr.forEach((r) => r.parentElement.appendChild(r));
      });
    });
  }

  /* ============================ Reset de plantilla ============================ */
  function resetTemplate() {
    // Título
    const h1 = $(".exp-title h1");
    if (h1) h1.textContent = "—";

    // Metas (Contacto, Encargado, Fecha…)
    const metaDDs = $$(".exp-meta dd");
    metaDDs.forEach((dd) => (dd.textContent = "—"));

    // Panel Contacto
    const setText = (sel, val = "—") => {
      const el = $(sel);
      if (el) el.textContent = val;
    };
    setText('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(1) .exp-val'); // nombre
    setText('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(2) .exp-val'); // tel
    setText('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(3) .exp-val'); // dirección
    const mailA = $('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(4) .exp-val a');
    if (mailA) {
      mailA.textContent = "—";
      mailA.removeAttribute("href");
    }
    setText('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(5) .exp-val'); // CP

    // Panel Detalles
    setText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(1) .exp-val'); // nombre req
    const liderA = $('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(2) .exp-val a');
    if (liderA) liderA.textContent = "—";
    const asignadoA = $('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(3) .exp-val a');
    if (asignadoA) asignadoA.textContent = "—";
    const badgeWrap = $('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(4) .exp-val');
    if (badgeWrap) badgeWrap.innerHTML = `<span class="exp-badge is-info">—</span>`;
    setText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field.exp-field--full .exp-val', "—"); // descripción
    setText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(6) .exp-val'); // fecha inicio
    setText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(7) .exp-val', "—"); // fecha fin

    // Stepper y acciones
    stepperReset(0);
    const actionsHost = $("#req-actions");
    if (actionsHost) actionsHost.innerHTML = "";
  }

  /* ============================ Hidratar desde datos ============================ */
  function statusLabel(s) {
    return STATUS[Number(s)] ?? "—";
  }

  function applyReqToDom(req) {
    if (!req) return;

    // Título
    const h1 = $(".exp-title h1");
    if (h1) h1.textContent = req.tramite_nombre || req.asunto || "Requerimiento";

    // Metas: Contacto, Encargado, Fecha de solicitado
    const metaDDs = $$(".exp-meta dd");
    if (metaDDs[0]) metaDDs[0].textContent = req.contacto_nombre || "—";
    if (metaDDs[1]) metaDDs[1].textContent = req.asignado_nombre_completo || "—";
    if (metaDDs[2]) metaDDs[2].textContent = req.created_at || "—";

    // Panel Contacto
    const setText = (sel, val = "—") => {
      const el = $(sel);
      if (el) el.textContent = val;
    };
    setText('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(1) .exp-val', req.contacto_nombre);
    setText('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(2) .exp-val', req.contacto_telefono);
    setText(
      '.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(3) .exp-val',
      [req.contacto_calle, req.contacto_colonia].filter(Boolean).join(", ")
    );
    const mailA = $('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(4) .exp-val a');
    if (mailA) {
      const mail = req.contacto_email || "";
      mailA.textContent = mail || "—";
      mailA.href = mail ? `mailto:${mail}` : "#";
    }
    setText('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(5) .exp-val', req.contacto_cp);

    // Panel Detalles
    setText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(1) .exp-val', req.tramite_nombre || req.asunto);
    const liderA = $('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(2) .exp-val a');
    if (liderA) liderA.textContent = req.asignado_nombre_completo || "—";
    const asignadoA = $('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(3) .exp-val a');
    if (asignadoA) asignadoA.textContent = req.contacto_nombre || "—";
    const badgeWrap = $('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(4) .exp-val');
    if (badgeWrap) badgeWrap.innerHTML = `<span class="exp-badge is-info">${statusLabel(req.estatus)}</span>`;
    setText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field.exp-field--full .exp-val', req.descripcion);
    setText(
      '.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(6) .exp-val',
      (req.created_at || "").split(" ")[0] || "—"
    );
    setText(
      '.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(7) .exp-val',
      req.cerrado_en ? req.cerrado_en.split(" ")[0] : "—"
    );

    // Stepper + acciones
    paintStepper(Number(req.estatus ?? 0));
    window.__REQ_DATA__ = req; // por si otro módulo lo necesita
    window.ReqActions?.refresh();
  }

  /* ============================ Boot de datos (API o DEMO) ============================ */
  const API = {
    // Ajusta este endpoint a tu backend si quieres traer por id
    verRequerimiento: "/db/WEB/ixtla01_c_requerimiento.php?id=",
  };

  function getReqIdFromUrl() {
    try {
      return Number(new URLSearchParams(location.search).get("id")) || null;
    } catch {
      return null;
    }
  }

  async function fetchById(id) {
    try {
      const res = await fetch(API.verRequerimiento + encodeURIComponent(id));
      const data = await res.json();
      if (data && data.ok && data.data) return data.data;
    } catch (e) {
      console.warn("[fetchById] error:", e);
    }
    return null;
  }

  function seedDemoIfMissing() {
    if (localStorage.getItem("REQ_DEMO")) return;
    const demo = {
      ok: true,
      data: {
        id: 3623,
        folio: "REQ-0000003623",
        departamento_id: 1,
        tramite_id: 1,
        asignado_a: 12,
        asunto: "Reporte Fuga de agua",
        descripcion:
          "Entre la casa 58 y 60 de la calle Jesús macias existe una fuga de agua, ya tiene tiempo. A simple vista no se ve chorro de agua pero siempre corre agua por las tardes.",
        prioridad: 2,
        estatus: 0, // arrancamos en Solicitud para demo
        canal: 1,
        contacto_nombre: "Karla ochoa",
        contacto_email: "Omelettelaguna@gmail.com",
        contacto_telefono: "3318310524",
        contacto_calle: "Jesus macias 60",
        contacto_colonia: "Luis García",
        contacto_cp: "45850",
        fecha_limite: null,
        cerrado_en: "2025-10-08 14:12:56",
        status: 1,
        created_at: "2025-10-03 18:08:38",
        updated_at: "2025-10-13 21:12:55",
        created_by: null,
        updated_by: 1,
        departamento_nombre: "SAMAPA",
        tramite_nombre: "Fuga de agua",
        asignado_nombre_completo: "Juan Pablo García ANALISTA",
      },
    };
    localStorage.setItem("REQ_DEMO", JSON.stringify(demo));
  }

  async function bootData() {
    resetTemplate();

    const urlId = getReqIdFromUrl();
    if (urlId) {
      const data = await fetchById(urlId);
      if (data) {
        applyReqToDom(data);
        return;
      }
      toast("No se pudo cargar el requerimiento. Mostrando demo…", "warning");
    }

    // DEMO
    seedDemoIfMissing();
    try {
      const obj = JSON.parse(localStorage.getItem("REQ_DEMO") || "{}");
      if (obj && obj.data) {
        // fuerza a 0 para demo de flujo
        obj.data.estatus = 0;
        applyReqToDom(obj.data);
      }
    } catch (e) {
      console.warn("[bootData] demo parse:", e);
    }
  }

  /* ============================ Acciones contextualizadas ============================ */
  (() => {
    const API_ACT = {
      cambiarEstado: "/db/WEB/ixtla01_u_requerimiento_estado.php", // POST { id, status, motivo? }
      asignarDepto: "/VIEWS/Tareas.php?asignar=", // demo: redirección
    };

    // Modal (pausar/cancelar)
    const modal = $("#modal-estado");
    const form = $("#form-estado");
    const txt = $("#estado-motivo");
    const title = $("#estado-title");
    const btnClose = modal?.querySelector(".modal-close");

    let pending = null; // { type, nextStatus, id }

    function openEstadoModal({ type, nextStatus, id }) {
      pending = { type, nextStatus, id };
      title.textContent = type === "cancelar" ? "Motivo de cancelación" : "Motivo de pausa";
      txt.value = "";
      modal.setAttribute("aria-hidden", "false");
      modal.classList.add("open");
      setTimeout(() => txt?.focus(), 40);
    }
    function closeEstadoModal() {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      pending = null;
    }

    btnClose?.addEventListener("click", closeEstadoModal);
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) closeEstadoModal();
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!pending) return;
      const motivo = (txt.value || "").trim();
      if (!motivo) {
        toast("Describe el motivo, por favor.", "warning");
        txt.focus();
        return;
      }
      const { id, nextStatus, type } = pending;
      try {
        const fd = new FormData();
        fd.append("id", String(id));
        fd.append("status", String(nextStatus));
        fd.append("motivo", motivo);

        const res = await fetch(API_ACT.cambiarEstado, { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false || data.error) {
          throw new Error(data.error || "No se pudo actualizar el estado");
        }
        paintStepper(nextStatus);
        toast(type === "cancelar" ? "Requerimiento cancelado" : "Requerimiento en pausa", "exito");
        closeEstadoModal();

        // Actualiza cache local si estamos en demo
        if (window.__REQ_DATA__) {
          window.__REQ_DATA__.estatus = nextStatus;
          window.ReqActions?.refresh();
        }
      } catch (err) {
        console.error(err);
        toast("Error al cambiar el estado.", "error");
      }
    });

    function getCurrentStatusFromStepper() {
      const li = $(".step-menu li.current");
      return li ? Number(li.dataset.status) : null;
    }

    function renderActions() {
      const host = $("#req-actions");
      if (!host) return;
      host.innerHTML = "";

      const req = window.__REQ_DATA__ || {};
      const id = req.id ?? getReqIdFromUrl() ?? 0;
      const status = getCurrentStatusFromStepper();

      if (status == null) return;

      const mk = (txt, cls = "btn-xs", onClick = () => {}) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = cls;
        b.textContent = txt;
        b.addEventListener("click", onClick);
        return b;
      };

      // Estado: SOLICITUD (0) -> Iniciar revisión
      if (status === 0) {
        host.appendChild(
          mk("Iniciar revisión", "btn-xs primary", async () => {
            try {
              const fd = new FormData();
              fd.append("id", String(id));
              fd.append("status", "1");
              const res = await fetch(API_ACT.cambiarEstado, { method: "POST", body: fd });
              const data = await res.json().catch(() => ({}));
              if (!res.ok || data.ok === false || data.error) throw new Error(data.error || "fail");
              paintStepper(1);
              toast("Requerimiento en revisión", "exito");
              if (window.__REQ_DATA__) window.__REQ_DATA__.estatus = 1;
              renderActions();
            } catch (e) {
              console.error(e);
              toast("No se pudo iniciar la revisión", "error");
            }
          })
        );
        return;
      }

      // Estado: REVISIÓN (1) -> Asignar + Pausar + Cancelar
      if (status === 1) {
        host.appendChild(
          mk("Asignar a departamento", "btn-xs primary", () => {
            window.location.href = API_ACT.asignarDepto + encodeURIComponent(id);
          })
        );
        host.appendChild(mk("Pausar", "btn-xs warn", () => openEstadoModal({ type: "pausar", nextStatus: 4, id })));
        host.appendChild(
          mk("Cancelar", "btn-xs danger", () => openEstadoModal({ type: "cancelar", nextStatus: 5, id }))
        );
        return;
      }

      // Últimos estados: 4/5/6 -> Reactivar a Revisión (1)
      if (status === 4 || status === 5 || status === 6) {
        host.appendChild(
          mk("Reactivar", "btn-xs primary", async () => {
            try {
              const fd = new FormData();
              fd.append("id", String(id));
              fd.append("status", "1");
              const res = await fetch(API_ACT.cambiarEstado, { method: "POST", body: fd });
              const data = await res.json().catch(() => ({}));
              if (!res.ok || data.ok === false || data.error) throw new Error(data.error || "fail");
              paintStepper(1);
              toast("Reactivado a Revisión", "exito");
              if (window.__REQ_DATA__) window.__REQ_DATA__.estatus = 1;
              renderActions();
            } catch (e) {
              console.error(e);
              toast("No se pudo reactivar", "error");
            }
          })
        );
        return;
      }

      // Otros estados (2,3): sin botones adicionales por ahora (puedes extender aquí)
    }

    // expone para re-render
    window.ReqActions = { refresh: renderActions };
  })();

  /* ============================ Boot general ============================ */
  async function boot() {
    // El HTML trae un stepper pintado en "Proceso"; lo reseteamos a 0
    stepperReset(0);

    initStepperClicks();
    initAccordions();
    initSortableTables();

    await bootData(); // carga API o demo y pinta todo
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  // API simple para inyectar datos desde fuera si lo necesitas
  window.ReqView = {
    reset: resetTemplate,
    setData: (req) => {
      resetTemplate();
      applyReqToDom(req);
    },
  };
})();

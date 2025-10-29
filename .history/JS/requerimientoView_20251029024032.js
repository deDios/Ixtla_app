// /JS/requerimientoView.js
(function () {
  "use strict";

  /* =========================================================================
     Helpers
     ========================================================================= */
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const toast = (m,t="info") => (window.gcToast ? gcToast(m,t) : console.log("[toast]", t, m));

  const normalize = (s) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

  function on(el, evt, sel, handler) {
    if (!el) return;
    el.addEventListener(evt, (e) => {
      const t = e.target.closest(sel);
      if (t && el.contains(t)) handler(e, t);
    });
  }

  /* =========================================================================
     Estado DEMO (100% localStorage, sin API)
     ========================================================================= */
  const DEMO_KEY = "REQ_DEMO";

  const DEMO_FALLBACK = {
    ok: true,
    data: {
      id: 3623,
      folio: "REQ-0000003623",
      departamento_id: 1,
      tramite_id: 1,
      asignado_a: 12,
      asunto: "Reporte Fuga de agua",
      descripcion:
        "Entre la casa 58 y 60 de la calle Jesús macias existe una fuga de agua, ya tiene tiempo. A simple vista no se ve chorro de agua, pero corre agua por las tardes cuando bombean.",
      prioridad: 2,
      estatus: 0, // ← comenzamos en SOLICITUD para la demo
      canal: 1,
      contacto_nombre: "Karla Ochoa",
      contacto_email: "Omelettelaguna@gmail.com",
      contacto_telefono: "3318310524",
      contacto_calle: "Jesús Macías 60",
      contacto_colonia: "Luis García",
      contacto_cp: "45850",
      fecha_limite: null,
      cerrado_en: null,
      status: 1,
      created_at: "2025-10-03 18:08:38",
      updated_at: "2025-10-13 21:12:55",
      created_by: null,
      updated_by: 1,
      departamento_nombre: "SAMAPA",
      tramite_nombre: "Fuga de agua",
      asignado_nombre_completo: "Juan Pablo García · ANALISTA",
      evidencias: [
        {
          id: 1,
          nombre: "Evidencia Fuga de Agua",
          quien: "Luis Enrique",
          fecha: "2025-09-02 14:25:00",
          tipo: "img",
          url: "#",
        },
      ],
      actividades: [
        {
          id: 1,
          nombre: "Reparación de Llave",
          responsable: "Juan Pablo",
          estatus: "Activo",
          porcentaje: 70,
          fecha: "2025-06-02",
        },
        {
          id: 2,
          nombre: "Revisión de toma",
          responsable: "Juan Pablo",
          estatus: "Finalizado",
          porcentaje: 100,
          fecha: "2025-06-10",
        },
        {
          id: 3,
          nombre: "Cierre de toma",
          responsable: "Juan Pablo",
          estatus: "Finalizado",
          porcentaje: 100,
          fecha: "2025-05-10",
        },
      ],
      comentarios: [
        { id: 1, quien: "Juan Pablo",  hace: "hace 2 min", texto: "¿Pueden validar si la cuadrilla ya salió a la zona?" },
        { id: 2, quien: "María López", hace: "hace 1 min", texto: "Confirmado. Llegan en 10 minutos. Dejo fotos cuando estén en sitio." },
        { id: 3, quien: "Sergio",      hace: "ahora",      texto: "Recibido ✅" },
      ],
    },
  };

  function loadDemo() {
    try {
      const raw = localStorage.getItem(DEMO_KEY);
      if (!raw) {
        localStorage.setItem(DEMO_KEY, JSON.stringify(DEMO_FALLBACK));
        return DEMO_FALLBACK;
      }
      const obj = JSON.parse(raw);
      if (!obj || obj.ok === false || !obj.data) {
        localStorage.setItem(DEMO_KEY, JSON.stringify(DEMO_FALLBACK));
        return DEMO_FALLBACK;
      }
      return obj;
    } catch {
      localStorage.setItem(DEMO_KEY, JSON.stringify(DEMO_FALLBACK));
      return DEMO_FALLBACK;
    }
  }

  function saveDemo(data) {
    const wrapper = { ok: true, data };
    localStorage.setItem(DEMO_KEY, JSON.stringify(wrapper));
    return wrapper;
  }

  /* =========================================================================
     Reset de plantilla (deja todo en "—" / placeholders)
     ========================================================================= */
  function resetTemplate() {
    // Título
    const h1 = $(".exp-title h1");
    if (h1) h1.textContent = "—";

    // Meta
    const meta = $$(".exp-meta dd");
    meta.forEach((dd) => (dd.textContent = "—"));

    // Panel Contacto (5 campos)
    const contactoVals = $$('.exp-pane[data-tab="Contacto"] .exp-grid .exp-val');
    contactoVals.forEach((n, i) => {
      if (i === 3) {
        const a = n.querySelector("a");
        if (a) {
          a.textContent = "—";
          a.removeAttribute("href");
        } else n.textContent = "—";
      } else {
        n.textContent = "—";
      }
    });

    // Panel Detalles
    const detallesVals = $$('.exp-pane[data-tab="detalles"] .exp-grid .exp-val');
    detallesVals.forEach((n, i) => {
      if (i === 3) n.innerHTML = '<span class="exp-badge is-info">—</span>';
      else n.textContent = "—";
    });

    // Evidencias (sólo deja la cabecera; no borra el primer ejemplo si no existe .exp-row dinámica)
    const evRows = $$(".exp-accordion .exp-table .exp-row");
    evRows.forEach((r) => r.remove());

    // Comentarios (sidebar demo)
    // dejamos los de ejemplo que ya están en el HTML para no “vaciar” la UI;
    // si quisieras limpiarlos, descomenta:
    // const msgs = $$('.demo-comments .c-feed .msg');
    // msgs.forEach(m => m.remove());

    // Stepper
    const items = $$(".step-menu li");
    items.forEach((li) => li.classList.remove("current", "complete"));
    // por defecto, marcamos Solicitud como current visualmente
    const sol = items.find((li) => Number(li.dataset.status) === 0);
    if (sol) sol.classList.add("current");
  }

  /* =========================================================================
     Animaciones acordeones (height auto → height px)
     ========================================================================= */
  function animateOpen(el) {
    el.hidden = false;
    el.style.overflow = "hidden";
    el.style.height = "0px";
    el.getBoundingClientRect(); // reflow
    const target = el.scrollHeight;
    el.style.transition = "height 180ms ease";
    el.style.height = target + "px";
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
    const start = el.offsetHeight;
    el.style.height = start + "px";
    el.getBoundingClientRect(); // reflow
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

  /* =========================================================================
     Tablas ordenables
     ========================================================================= */
  function initSortableTables() {
    const tables = $$(".exp-table");
    tables.forEach((table) => {
      const head = $(".exp-thead", table);
      const rows = () => $$(".exp-row", table);
      if (!head) return;

      on(head, "click", ".sort", (e, sortSpan) => {
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

        const collator = new Intl.Collator("es", {
          numeric: true,
          sensitivity: "base",
        });
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

  /* =========================================================================
     Stepper + etiquetas de estado
     ========================================================================= */
  function statusLabel(s) {
    switch (Number(s)) {
      case 0: return "Solicitud";
      case 1: return "Revisión";
      case 2: return "Asignación";
      case 3: return "Proceso";
      case 4: return "Pausado";
      case 5: return "Cancelado";
      case 6: return "Finalizado";
      default: return "—";
    }
  }

  function statusBadgeClass(s) {
    switch (Number(s)) {
      case 0: return "is-muted";
      case 1: return "is-info";
      case 2: return "is-info";
      case 3: return "is-info";
      case 4: return "is-warn";
      case 5: return "is-danger";
      case 6: return "is-success";
      default: return "is-info";
    }
  }

  function paintStepper(nextStatus) {
    const items = $$(".step-menu li");
    items.forEach((li) => {
      const s = Number(li.dataset.status);
      li.classList.remove("current");
      if (s < nextStatus) li.classList.add("complete");
      else li.classList.remove("complete");
      if (s === nextStatus) li.classList.add("current");
    });
    // micro-interacción al cambiar paso
    const current = items.find((li) => li.classList.contains("current"));
    if (current) {
      current.style.transform = "scale(0.98)";
      current.style.transition = "transform 120ms ease";
      requestAnimationFrame(() => {
        current.style.transform = "scale(1)";
        setTimeout(() => (current.style.transition = ""), 140);
      });
    }
  }
  window.paintStepper = paintStepper;

  /* =========================================================================
     Hidratar vista con datos (modo demo)
     ========================================================================= */
  function fillText(sel, txt) {
    const n = $(sel);
    if (!n) return;
    n.textContent = txt ?? "—";
  }

  function hydrateFromData(req) {
    // Título
    const h1 = $(".exp-title h1");
    if (h1) h1.textContent = req.tramite_nombre || req.asunto || "Requerimiento";

    // Meta
    const ddContacto = $(".exp-meta > div:nth-child(1) dd");
    const ddEncarg   = $(".exp-meta > div:nth-child(2) dd");
    const ddFecha    = $(".exp-meta > div:nth-child(3) dd");
    if (ddContacto) ddContacto.textContent = req.contacto_nombre || "—";
    if (ddEncarg)   ddEncarg.textContent   = req.asignado_nombre_completo || "—";
    if (ddFecha)    ddFecha.textContent    = (req.created_at || "—").replace(" ", " ");

    // Panel: Contacto (en el orden del HTML)
    fillText('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(1) .exp-val', req.contacto_nombre);
    fillText('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(2) .exp-val', req.contacto_telefono);
    fillText(
      '.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(3) .exp-val',
      [req.contacto_calle, req.contacto_colonia].filter(Boolean).join(", ")
    );
    const mailA = document.querySelector('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(4) .exp-val a');
    if (mailA) {
      mailA.textContent = req.contacto_email || "—";
      if (req.contacto_email) mailA.href = `mailto:${req.contacto_email}`;
      else mailA.removeAttribute("href");
    }
    fillText('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(5) .exp-val', req.contacto_cp);

    // Panel: Detalles
    fillText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(1) .exp-val', req.tramite_nombre || req.asunto);
    const liderA = document.querySelector('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(2) .exp-val a');
    if (liderA) liderA.textContent = req.asignado_nombre_completo || "—";
    const asignadoA = document.querySelector('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(3) .exp-val a');
    if (asignadoA) asignadoA.textContent = req.contacto_nombre || "—";

    const badgeWrap = document.querySelector('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(4) .exp-val');
    if (badgeWrap) {
      const cls = statusBadgeClass(req.estatus);
      const lbl = statusLabel(req.estatus);
      badgeWrap.innerHTML = `<span class="exp-badge ${cls} pulse-once">${lbl}</span>`;
      // micro-animación (pulse)
      setTimeout(() => {
        const b = badgeWrap.querySelector(".pulse-once");
        if (b) b.classList.remove("pulse-once");
      }, 220);
    }

    fillText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field.exp-field--full .exp-val', req.descripcion);
    fillText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(6) .exp-val', req.created_at?.split(" ")[0]);
    fillText(
      '.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(7) .exp-val',
      req.cerrado_en ? req.cerrado_en.split(" ")[0] : "—"
    );

    // Evidencias (si existen en la data demo)
    const evTable = $(".exp-accordion .exp-table");
    if (evTable && Array.isArray(req.evidencias)) {
      req.evidencias.forEach((ev) => {
        const a = document.createElement("a");
        a.className = "exp-row";
        a.href = ev.url || "#";
        a.innerHTML = `
          <div class="file"><img class="ico" src="/ASSETS/filetypes/${ev.tipo || "file"}.png" alt=""><span>${ev.nombre || "Archivo"}</span></div>
          <div class="who">${ev.quien || "—"}</div>
          <div class="date">${(ev.fecha || "").replace(" ", " ") || "—"}</div>
        `;
        evTable.appendChild(a);
      });
    }

    // Stepper
    paintStepper(Number(req.estatus ?? 0));

    // Acciones de cabecera
    ReqActions.refresh();

    // Comentarios: permitir agregar nuevos (mock)
    initCommentsDemo(req);
  }

  /* =========================================================================
     Acciones contextualizadas del requerimiento (demo)
     ========================================================================= */
  const ReqActions = (() => {
    const hostSel = "#req-actions";

    function renderActions() {
      const host = $(hostSel);
      if (!host) return;

      const data = loadDemo().data;
      const status = Number(data.estatus ?? 0);

      host.innerHTML = "";

      // Helper botón
      const mk = (txt, cls = "btn-xs", onClick = () => {}) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = cls;
        b.textContent = txt;
        b.addEventListener("click", onClick);
        return b;
      };

      // Estado: SOLICITUD (0) -> "Iniciar revisión" (pasa a 1)
      if (status === 0) {
        host.appendChild(
          mk("Iniciar revisión", "btn-xs primary", () => {
            data.estatus = 1;
            saveDemo(data);
            paintStepper(1);
            hydrateFromData(data);
            toast("Requerimiento en revisión", "success");
          })
        );
        return;
      }

      // Estado: REVISIÓN (1) -> "Asignar a departamento" + "Pausar" + "Cancelar"
      if (status === 1) {
        host.appendChild(
          mk("Asignar a departamento", "btn-xs primary", () => {
            toast("(Demo) Abrir flujo de asignación…", "info");
          })
        );
        host.appendChild(
          mk("Pausar", "btn-xs warn", () => openEstadoModal({ type: "pausar", nextStatus: 4 }))
        );
        host.appendChild(
          mk("Cancelar", "btn-xs danger", () => openEstadoModal({ type: "cancelar", nextStatus: 5 }))
        );
        return;
      }

      // No usaremos "Proceso (3)" todavía (según indicación)

      // Estados “últimos”: Pausado(4), Cancelado(5), Finalizado(6) -> Reactivar a Revisión(1)
      if (status === 4 || status === 5 || status === 6) {
        host.appendChild(
          mk("Reactivar", "btn-xs primary", () => {
            data.estatus = 1;
            saveDemo(data);
            paintStepper(1);
            hydrateFromData(data);
            toast("Reactivado a Revisión", "success");
          })
        );
        return;
      }

      // Asignación (2) u otros: sin acciones especiales por ahora
    }

    return { refresh: renderActions };
  })();
  window.ReqActions = ReqActions;

  /* =========================================================================
     Modal genérico (pausar / cancelar) — sólo demo, persiste en localStorage
     ========================================================================= */
  const modal = $("#modal-estado");
  const form  = $("#form-estado");
  const txt   = $("#estado-motivo");
  const title = $("#estado-title");
  const btnClose = modal?.querySelector(".modal-close");

  let _pendingAction = null; // { type: "pausar"|"cancelar", nextStatus:number }

  function openEstadoModal({ type, nextStatus }) {
    _pendingAction = { type, nextStatus };
    title.textContent = type === "cancelar" ? "Motivo de cancelación" : "Motivo de pausa";
    txt.value = "";
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("open");
    setTimeout(() => txt?.focus(), 50);
  }

  function closeEstadoModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    _pendingAction = null;
  }

  btnClose?.addEventListener("click", closeEstadoModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeEstadoModal();
  });

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!_pendingAction) return;
    const motivo = (txt.value || "").trim();
    if (!motivo) {
      toast("Describe el motivo, por favor.", "warning");
      txt.focus();
      return;
    }
    const data = loadDemo().data;
    data.estatus = _pendingAction.nextStatus;
    // podrías guardar motivo en una bitácora en data.demoNotes si gustas
    saveDemo(data);
    paintStepper(data.estatus);
    hydrateFromData(data);
    toast(
      _pendingAction.type === "cancelar" ? "Requerimiento cancelado" : "Requerimiento en pausa",
      "success"
    );
    closeEstadoModal();
  });

  /* =========================================================================
     Comentarios DEMO (agregar nuevos al feed sin backend)
     ========================================================================= */
  function initCommentsDemo(req) {
    const wrap = $(".demo-comments");
    if (!wrap) return;

    const textarea = $(".composer textarea", wrap);
    const sendBtn  = $(".composer .send-fab", wrap);
    const feed     = $(".c-feed", wrap);

    const addMsg = (texto) => {
      const art = document.createElement("article");
      art.className = "msg enter"; // enter = animación suave por CSS si la tienes
      art.innerHTML = `
        <img class="avatar" src="/ASSETS/user/img_user1.png" alt="">
        <div>
          <div class="who"><span class="name">Tú</span> <span class="time">ahora</span></div>
          <div class="text"></div>
        </div>
      `;
      $(".text", art).textContent = texto;
      feed.appendChild(art);
      // ligera animación
      requestAnimationFrame(() => art.classList.remove("enter"));
      feed.scrollTop = feed.scrollHeight;
    };

    const handleSend = () => {
      const val = (textarea.value || "").trim();
      if (!val) return;
      addMsg(val);
      textarea.value = "";
      toast("Comentario agregado (demo).", "success");
    };

    sendBtn?.addEventListener("click", handleSend);
    textarea?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
  }

  /* =========================================================================
     Init Stepper (clic visual)
     ========================================================================= */
  function initStepper() {
    const menu = $(".step-menu");
    if (!menu) return;
    on(menu, "click", "li", (e, li) => {
      // Solo visual; el negocio lo maneja ReqActions
      $$("li", menu).forEach((it) => it.classList.remove("current"));
      li.classList.add("current");
    });
  }

  /* =========================================================================
     Boot
     ========================================================================= */
  function boot() {
    try {
      resetTemplate();         // ← limpia la UI
      const demo = loadDemo(); // ← obtiene (o crea) el demo en localStorage
      hydrateFromData(demo.data);
      initAccordions();
      initSortableTables();
      initStepper();
    } catch (e) {
      console.error("[RequerimientoView] init error:", e);
      toast("No se pudo cargar el requerimiento. Mostrando demo…", "warning");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

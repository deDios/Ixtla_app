// /JS/requerimientoView.js
(function () {
  "use strict";

  /* =============== Helpers =============== */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const log   = (...a) => console.log("[RequerimientoView]", ...a);
  const toast = (m, t = "info") =>
    (window.gcToast ? gcToast(m, t) : console.log("[toast]", t, m));

  const firstTwoNames = (full = "") => {
    const parts = String(full).trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, Math.min(2, parts.length)).join(" ") || full || "—";
  };

  /* =============== Local DEMO (persistencia mínima) =============== */
  const DEMO_KEY = "REQ_DEMO";
  const DEMO_FALLBACK = {
    ok: true,
    data: {
      id: 3623, folio: "REQ-0000003623",
      asunto: "Reporte Fuga de agua", tramite_nombre: "Fuga de agua",
      descripcion: "Entre la casa 58 y 60 de la calle Jesús macias existe una fuga de agua...",
      prioridad: 2, estatus: 3, canal: 1,
      contacto_nombre: "Karla ochoa", contacto_email: "Omelettelaguna@gmail.com",
      contacto_telefono: "3318310524",
      contacto_calle: "Jesus macias 60", contacto_colonia: "Luis García", contacto_cp: "45850",
      created_at: "2025-10-03 18:08:38", cerrado_en: null,
      asignado_nombre_completo: "Juan Pablo García · ANALISTA",
      evidencias: [
        { id: 1, nombre: "Evidencia Fuga de Agua", quien: "Luis Enrique", fecha: "2025-09-02 14:25:00", tipo: "img", url: "#" }
      ],
      comentarios: [
        { id: 1, nombre: "Juan Pablo García Casillas3", texto: "¿Pueden validar si la cuadrilla ya salió a la zona?", cuando: Date.now() - 120000 },
        { id: 2, nombre: "María López", texto: "Confirmado. Llegan en 10 minutos. Dejo fotos cuando estén en sitio.", cuando: Date.now() - 60000 },
        { id: 3, nombre: "Sergio", texto: "Recibido ✅", cuando: Date.now() - 10000 }
      ]
    }
  };

  const loadDemo = () => {
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
      if (!Array.isArray(obj.data.comentarios)) obj.data.comentarios = [];
      return obj;
    } catch {
      localStorage.setItem(DEMO_KEY, JSON.stringify(DEMO_FALLBACK));
      return DEMO_FALLBACK;
    }
  };

  const saveDemo = (data) => {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify({ ok: true, data })); }
    catch (e) { console.warn("No se pudo persistir DEMO", e); }
    return data;
  };

  /* =============== Evidencias: helpers DOM =============== */
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

  /* =============== Reset plantilla =============== */
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

  /* =============== Animación de acordeones =============== */
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

  // Evidencias: el header completo es clickeable
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

  // Planeación: SOLO el chevron controla el colapso
  function initAccordionsPlaneacion() {
    const list = $("#planeacion-list");
    if (!list) return;

    $$(".exp-accordion--fase", list).forEach(acc => {
      const head = $(".exp-acc-head", acc);
      const body = $(".exp-acc-body", acc);
      const chev = $(".chev", head);
      if (!head || !body || !chev) return;

      const initOpen = head.getAttribute("aria-expanded") === "true";
      body.hidden = !initOpen; if (!initOpen) body.style.height = "0px";

      head.addEventListener("click", (e) => {
        if (!e.target.closest(".chev")) return; // bloquear clicks fuera del chevron
      });

      chev.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = head.getAttribute("aria-expanded") === "true";
        setAccordionOpen(head, body, !isOpen);
      });
    });
  }

  /* =============== Sort en tabla Evidencias =============== */
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

  /* =============== Stepper + badge (general) =============== */
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

  /* =============== Comentarios (demo) =============== */
  function relTime(ts) {
    const diff = Math.max(0, Date.now() - ts);
    const s = Math.floor(diff / 1000);
    if (s < 10) return "ahora";
    if (s < 60) return `hace ${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `hace ${m} min`;
    const h = Math.floor(m / 60);
    return `hace ${h} h`;
  }

  function renderComments(req) {
    const feed = $(".c-feed"); if (!feed) return;
    feed.innerHTML = "";
    (req.comentarios || []).forEach(c => {
      const art = document.createElement("article");
      art.className = "msg";
      const nombre = firstTwoNames(c.nombre || "Anónimo");
      art.innerHTML = `
        <img class="avatar" src="/ASSETS/user/img_user1.png" alt="">
        <div>
          <div class="who"><span class="name">${nombre}</span> <span class="time">${relTime(c.cuando || Date.now())}</span></div>
          <div class="text" style="white-space:pre-wrap;word-break:break-word;"></div>
        </div>`;
      art.querySelector(".text").textContent = c.texto || "";
      feed.appendChild(art);
    });
    const scroller = feed.parentElement || feed;
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
  }

  function setupComposer(req) {
    const ta = $(".composer textarea");
    const btn = $(".composer .send-fab");
    if (!ta || !btn) return;

    const getAutor = () => firstTwoNames($("#hs-profile-name")?.textContent?.trim() || "Tú");

    const updateBtn = () => {
      const has = (ta.value || "").trim().length > 0;
      btn.disabled = !has;
      btn.style.opacity = has ? "1" : ".6";
      btn.style.pointerEvents = has ? "auto" : "none";
    };
    updateBtn();

    const send = () => {
      const texto = (ta.value || "").trim();
      if (!texto) return;
      const c = { id: Date.now(), nombre: getAutor(), texto, cuando: Date.now() };
      req.comentarios = Array.isArray(req.comentarios) ? req.comentarios : [];
      req.comentarios.push(c);
      saveDemo(req);
      renderComments(req);
      ta.value = "";
      updateBtn();
      toast("Comentario enviado", "success");
    };

    ta.addEventListener("input", updateBtn);
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });
    btn.addEventListener("click", send);
  }

  /* =============== Hidratar vista básica =============== */
  const fillText = (sel, txt) => { const n = $(sel); if (n) n.textContent = (txt ?? "—"); };

  function hydrateFromData(req) {
    const h1 = $(".exp-title h1"); if (h1) h1.textContent = req.tramite_nombre || req.asunto || "Requerimiento";

    const ddC = $(".exp-meta > div:nth-child(1) dd");
    const ddE = $(".exp-meta > div:nth-child(2) dd");
    const ddF = $(".exp-meta > div:nth-child(3) dd");
    if (ddC) ddC.textContent = firstTwoNames(req.contacto_nombre || "—");
    if (ddE) ddE.textContent = req.asignado_nombre_completo || "—";
    if (ddF) ddF.textContent = (req.created_at || "—").replace(" ", " ");

    fillText('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(1) .exp-val', firstTwoNames(req.contacto_nombre));
    fillText('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(2) .exp-val', req.contacto_telefono);
    fillText('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(3) .exp-val', [req.contacto_calle, req.contacto_colonia].filter(Boolean).join(", "));
    const mailA = document.querySelector('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(4) .exp-val a');
    if (mailA) { mailA.textContent = req.contacto_email || "—"; if (req.contacto_email) mailA.href = `mailto:${req.contacto_email}`; else mailA.removeAttribute("href"); }
    fillText('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(5) .exp-val', req.contacto_cp);

    fillText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(1) .exp-val', req.tramite_nombre || req.asunto);
    const liderA = document.querySelector('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(2) .exp-val a'); if (liderA) liderA.textContent = req.asignado_nombre_completo || "—";
    const asignadoA = document.querySelector('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(3) .exp-val a'); if (asignadoA) asignadoA.textContent = firstTwoNames(req.contacto_nombre || "—");
    const badgeWrap = document.querySelector('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(4) .exp-val');
    if (badgeWrap) {
      const cls = statusBadgeClass(req.estatus); const lbl = statusLabel(req.estatus);
      badgeWrap.innerHTML = `<span class="exp-badge ${cls}">${lbl}</span>`;
    }
    fillText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field.exp-field--full .exp-val', req.descripcion);
    fillText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(6) .exp-val', req.created_at?.split(" ")[0]);
    fillText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(7) .exp-val', req.cerrado_en ? req.cerrado_en.split(" ")[0] : "—");

    const evTable = findEvidenciasTable();
    if (evTable) {
      evTable.querySelectorAll('.exp-row').forEach(r => r.remove());
      (req.evidencias || []).forEach(ev => {
        const a = document.createElement("a");
        a.className = "exp-row";
        a.href = ev.url || "#";
        a.innerHTML = `
          <span>${ev.nombre || "Archivo"}</span>
          <div class="who">${ev.quien || "—"}</div>
          <div class="date">${(ev.fecha || "").replace(" ", " ") || "—"}</div>`;
        evTable.appendChild(a);
      });
      if ((req.evidencias || []).length === 0) {
        const empty = document.createElement("div");
        empty.className = "exp-row";
        empty.innerHTML = `
          <span>Sin evidencias</span>
          <div class="who">—</div>
          <div class="date">—</div>`;
        evTable.appendChild(empty);
      }
    }

    paintStepper(Number(req.estatus ?? 0));
    ReqActions.refresh();

    renderComments(req);
    setupComposer(req);
  }

  /* =============== Acciones por estado (demo) =============== */
  const ReqActions = (() => {
    const hostSel = "#req-actions";

    function setStatusAndRefresh(next) {
      const data = loadDemo().data;
      data.estatus = next;
      saveDemo(data);
      paintStepper(next);
      hydrateFromData(data);
    }

    function ensureModalOrFallback(type, next) {
      const modal = $("#modal-estado");
      if (modal) {
        openEstadoModal({ type, nextStatus: next });
      } else {
        setStatusAndRefresh(next);
        toast(type === "cancelar" ? "Requerimiento cancelado" : "Requerimiento en pausa", "warning");
      }
    }

    function render() {
      const host = $(hostSel); if (!host) return;
      host.innerHTML = "";

      const data = loadDemo().data;
      const status = Number(data.estatus ?? 0);

      const mk = (txt, cls = "btn-xs", onClick = () => {}) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = cls; b.textContent = txt;
        b.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); onClick(); });
        return b;
      };

      if (status === 0) {
        host.appendChild(mk("Iniciar revisión", "btn-xs primary",
          () => { setStatusAndRefresh(1); toast("Requerimiento en revisión", "success"); })); return;
      }
      if (status === 1) {
        host.appendChild(mk("Asignar a departamento", "btn-xs primary",
          () => { setStatusAndRefresh(2); toast("Asignado a departamento", "success"); }));
        host.appendChild(mk("Pausar", "btn-xs warn",     () => ensureModalOrFallback("pausar",   4)));
        host.appendChild(mk("Cancelar", "btn-xs danger", () => ensureModalOrFallback("cancelar", 5))); return;
      }
      if (status === 2) {
        host.appendChild(mk("Iniciar proceso", "btn-xs primary",
          () => { setStatusAndRefresh(3); toast("Iniciado Proceso", "success"); }));
        host.appendChild(mk("Pausar", "btn-xs warn",     () => ensureModalOrFallback("pausar",   4)));
        host.appendChild(mk("Cancelar", "btn-xs danger", () => ensureModalOrFallback("cancelar", 5))); return;
      }
      if (status === 3) {
        host.appendChild(mk("Pausar", "btn-xs warn",     () => ensureModalOrFallback("pausar",   4)));
        host.appendChild(mk("Cancelar", "btn-xs danger", () => ensureModalOrFallback("cancelar", 5))); return;
      }
      if (status === 4 || status === 5 || status === 6) {
        host.appendChild(mk("Reactivar", "btn-xs primary",
          () => { setStatusAndRefresh(1); toast("Reactivado a Revisión", "success"); })); return;
      }
    }

    return { refresh: render };
  })();
  window.ReqActions = ReqActions;

  /* =============== Modal Pausar/Cancelar =============== */
  const modal         = $("#modal-estado");
  const form          = $("#form-estado");
  const txt           = $("#estado-motivo");
  const title         = $("#estado-title");
  const btnClose      = modal?.querySelector(".modal-close");
  const modalContent  = modal?.querySelector(".modal-content");

  let _pendingAction = null;
  let _modalBound = false;

  function openEstadoModal({ type, nextStatus }) {
    if (!modal || !modalContent) return;
    _pendingAction = { type, nextStatus };
    title.textContent = type === "cancelar" ? "Motivo de cancelación" : "Motivo de pausa";
    if (txt) txt.value = "";

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("me-modal-open");

    if (!_modalBound) {
      modal.addEventListener("click", onBackdropClick);
      // permitir que .modal-close y [data-modal-pass] no se bloqueen
      modalContent.addEventListener("mousedown", stop, { capture: true });
      modalContent.addEventListener("click",      stop, { capture: true });
      _modalBound = true;
    }

    setTimeout(() => txt?.focus(), 40);
  }
  function stop(e){
    if (e.target.closest(".modal-close")) return;
    if (e.target.closest("[data-modal-pass]")) return;
    e.stopPropagation();
  }
  function onBackdropClick(e){ if (e.target === modal) closeEstadoModal(); }

  function closeEstadoModal() {
    if (!modal) return;
    modal.classList.remove("open", "active");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("me-modal-open");
    _pendingAction = null;
  }

  btnClose?.addEventListener("click", closeEstadoModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.classList.contains("open")) closeEstadoModal();
  });
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("#modal-estado .modal-close");
    if (btn && document.querySelector("#modal-estado")?.classList.contains("open")) {
      e.preventDefault();
      closeEstadoModal();
    }
  });
  document.addEventListener("click", (e) => {
    const modalEl = document.querySelector("#modal-estado");
    if (!modalEl) return;
    if (e.target === modalEl && modalEl.classList.contains("open")) {
      closeEstadoModal();
    }
  });

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!_pendingAction) return;
    const motivo = (txt?.value || "").trim();
    if (!motivo) { toast("Describe el motivo, por favor.", "warning"); txt?.focus(); return; }

    const data = loadDemo().data;
    data.estatus = _pendingAction.nextStatus;
    saveDemo(data);
    paintStepper(data.estatus);
    hydrateFromData(data);
    toast(_pendingAction.type === "cancelar" ? "Requerimiento cancelado" : "Requerimiento en pausa", "success");
    closeEstadoModal();
  });

  /* =============== Modal NUEVA TAREA =============== */
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

  // Detectar procesos y llenar <select>
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
    if (e.target === modalEl && modalEl.classList.contains("open")) {
      closeTareaModal();
    }
  });

  // Insertar tarea en el acordeón/tabla
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

  // Submit modal tarea
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

  /* =============== Stepper visual (clic simple) =============== */
  function initStepper() {
    const menu = $(".step-menu"); if (!menu) return;
    menu.addEventListener("click", (e) => {
      const li = e.target.closest("li"); if (!li) return;
      $$("li", menu).forEach(it => it.classList.remove("current"));
      li.classList.add("current");
    });
  }

  /* =============== Planeación: crear y bindear NUEVOS PROCESOS =============== */
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
    const id = `p${Date.now()}`; // id único
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

  /* =============== Toolbar Planeación =============== */
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

  /* =============== Boot =============== */
  function boot() {
    resetTemplate();
    const demo = loadDemo();
    hydrateFromData(demo.data);
    initAccordionsEvidencias();
    initAccordionsPlaneacion();
    initSortableTables();
    initStepper();
    initPlaneacionToolbar();
    log("Boot OK. Estatus actual:", loadDemo().data.estatus);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

})();






(function () {
  // ====== Config ======
  const ENDPOINTS = {
    REQUERIMIENTO_GET:  "/db/WEB/ixtla01_c_requerimiento.php",
    COMENT_LIST:        "/db/WEB/ixtla01_c_comentario_requerimiento.php",
    COMENT_CREATE:      "/db/WEB/ixtla01_i_comentario_requerimiento.php",
    // Si tu app no está en el mismo dominio, usa las URLs absolutas completas
    // REQUERIMIENTO_GET: "https://.../ixtla01_c_requerimiento.php",
    // ...
  };

  // ====== Helpers mínimos ======
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const log = (...a) => console.log("[Detalle][inline]", ...a);
  const warn= (...a) => console.warn("[Detalle][inline]", ...a);
  const err = (...a) => console.error("[Detalle][inline]", ...a);
  const firstTwo = (full="") => String(full).trim().split(/\s+/).filter(Boolean).slice(0,2).join(" ") || "—";

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
      // Muchos PHP devuelven 'application/json' o 'text/html'; parseamos manual
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

    const asignado_a        = toId(raw.asignado_a ?? raw.empleado_id ?? raw.asignado_id);
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
      asignado_a, asignado_nombre, asignado_apellidos, asignado_full,
      estatus_code, prioridad, canal,
      creado_at, actualizado_at, cerrado_en,
      raw
    };
  }

  async function getRequerimientoById(id) {
    const payload = { id };
    const res = await postJSON(ENDPOINTS.REQUERIMIENTO_GET, payload);
    // Formatos posibles: {ok:true,data:{...}} | { ...obj } | [{...}] | {data:[...]}
    let data = res?.data ?? res;
    if (Array.isArray(data)) data = data[0] || {};
    return normalizeRequerimiento(data);
  }

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

  // ====== UI: Pintar detalle (re-usa tu DOM actual) ======
  function paintRequerimiento(req) {
    console.groupCollapsed("[UI] Pintar requerimiento");
    console.log("req:", req);

    const titulo = req.tramite || req.asunto || "Requerimiento";
    const h1 = $(".exp-title h1"); if (h1) h1.textContent = titulo;

    const ddC = $(".exp-meta > div:nth-child(1) dd");
    const ddE = $(".exp-meta > div:nth-child(2) dd");
    const ddF = $(".exp-meta > div:nth-child(3) dd");
    if (ddC) ddC.textContent = firstTwo(req.contacto_nombre || "—");
    if (ddE) ddE.textContent = req.asignado_full || "—";
    if (ddF) ddF.textContent = (req.creado_at || "—").replace("T"," ");

    // Tab Contacto
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
      set(1, firstTwo(req.contacto_nombre));
      set(2, req.contacto_telefono || "—");
      set(3, [req.contacto_calle, req.contacto_colonia].filter(Boolean).join(", "));
      set(4, req.contacto_email || "—");
      set(5, req.contacto_cp || "—");
    }

    // Tab Detalles
    const detalles = $('.exp-pane[role="tabpanel"][data-tab="detalles"] .exp-grid');
    if (detalles) {
      const put = (nth, value) => {
        const node = $(`.exp-field:nth-child(${nth}) .exp-val`, detalles);
        if (node) node.textContent = value ?? "—";
      };
      put(1, titulo);
      put(2, req.asignado_full || "—");
      put(3, firstTwo(req.contacto_nombre || "—"));
      // badge
      const badgeWrap = $(`.exp-field:nth-child(4) .exp-val`, detalles);
      if (badgeWrap) {
        const statusLabel = (s) => ({0:"Solicitud",1:"Revisión",2:"Asignación",3:"Proceso",4:"Pausado",5:"Cancelado",6:"Finalizado"}[Number(s)]||"—");
        const statusBadgeClass = (s) => ({0:"is-muted",1:"is-info",2:"is-info",3:"is-info",4:"is-warning",5:"is-danger",6:"is-success"}[Number(s)]||"is-info");
        const cls = statusBadgeClass(req.estatus_code);
        const lbl = statusLabel(req.estatus_code);
        badgeWrap.innerHTML = `<span class="exp-badge ${cls}">${lbl}</span>`;
      }
      // descripción
      const descNode = $(`.exp-field.exp-field--full .exp-val`, detalles);
      if (descNode) descNode.textContent = req.descripcion || "—";
      // fechas
      const fIni = $(`.exp-field:nth-child(6) .exp-val`, detalles);
      if (fIni) fIni.textContent = (req.creado_at || "").split(" ")[0] || "—";
      const fFin = $(`.exp-field:nth-child(7) .exp-val`, detalles);
      if (fFin) fFin.textContent = req.cerrado_en ? String(req.cerrado_en).split(" ")[0] : "—";
    }

    // Stepper
    if (window.paintStepper) window.paintStepper(Number(req.estatus_code ?? 0));

    console.groupEnd();
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

  function interceptComposer(requerimiento_id, empleado_id = null) {
    const ta = $(".composer textarea");
    const btn = $(".composer .send-fab");
    if (!ta || !btn) return;

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
      } finally {
        btn.disabled = false;
        console.groupEnd();
      }
    };

    // Evita que el handler demo también se dispare
    btn.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); send(); }, { capture: true });
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.stopPropagation(); e.preventDefault(); send();
      }
    }, { capture: true });
  }

  // ====== Boot ======
  async function bootInlineIntegration() {
    console.groupCollapsed("[Boot inline] Detalle");
    const params = new URL(window.location.href).searchParams;
    const reqId = params.get("id");
    console.log("URL:", window.location.href, "reqId:", reqId);

    if (!reqId) { console.warn("Sin ?id= en URL; se queda en modo demo."); console.groupEnd(); return; }

    // Apaga el demo para no mezclar
    try { localStorage.removeItem("REQ_DEMO"); } catch {}

    // Si manejas sesión, coloca el empleado_id aquí:
    const empleado_id = null; // p.ej. window.SESSION?.empleado_id || null;

    try {
      const req = await getRequerimientoById(reqId);
      console.log("Requerimiento (normalizado):", req);
      paintRequerimiento(req);
    } catch (e) {
      warn("Error consultando requerimiento:", e);
    }

    await loadComentarios(reqId);
    interceptComposer(reqId, empleado_id);

    console.groupEnd();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootInlineIntegration, { once: true });
  } else {
    bootInlineIntegration();
  }
})();
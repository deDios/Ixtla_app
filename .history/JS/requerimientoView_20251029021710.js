// /JS/requerimientoView.js
(function () {
  "use strict";

  /* ============================ Helpers ============================ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

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

  /* ============================ Tabs ============================ */
  function initTabs() {
    const tabsBar = $(".exp-tabs");
    const panes = $$(".exp-pane");
    if (!tabsBar || !panes.length) return;

    const paneMap = new Map();
    panes.forEach((p) => {
      const key = normalize(
        p.getAttribute("data-tab") || p.getAttribute("aria-label") || p.id
      );
      if (key) paneMap.set(key, p);
    });

    const setActive = (key) => {
      panes.forEach((p) => p.classList.remove("is-active"));
      $$(".exp-tab", tabsBar).forEach((b) => {
        b.classList.remove("is-active");
        b.setAttribute("aria-selected", "false");
      });
      const pane = paneMap.get(key);
      const btn = $$(".exp-tab", tabsBar).find(
        (b) => normalize(b.dataset.tab || b.textContent) === key
      );
      if (pane) pane.classList.add("is-active");
      if (btn) {
        btn.classList.add("is-active");
        btn.setAttribute("aria-selected", "true");
        btn.focus();
      }
    };

    $$(".exp-tab", tabsBar).forEach((b) => {
      if (!b.dataset.tab) b.dataset.tab = normalize(b.textContent);
      if (!paneMap.has(normalize(b.dataset.tab))) {
        const fallback = panes[0];
        if (fallback) paneMap.set(normalize(b.dataset.tab), fallback);
      }
    });

    on(tabsBar, "click", ".exp-tab", (e, btn) => {
      e.preventDefault();
      const key = normalize(btn.dataset.tab || btn.textContent);
      setActive(key);
    });

    on(tabsBar, "keydown", ".exp-tab", (e, btn) => {
      const buttons = $$(".exp-tab", tabsBar);
      const i = buttons.indexOf(btn);
      let j = i;
      if (e.key === "ArrowRight") j = (i + 1) % buttons.length;
      if (e.key === "ArrowLeft") j = (i - 1 + buttons.length) % buttons.length;
      if (j !== i) {
        e.preventDefault();
        buttons[j].focus();
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        btn.click();
      }
    });

    const initialBtn =
      $(".exp-tab.is-active", tabsBar) || $(".exp-tab", tabsBar);
    const initialKey = initialBtn
      ? normalize(initialBtn.dataset.tab || initialBtn.textContent)
      : null;
    if (initialKey) setActive(initialKey);
  }

  /* ============================ Acordeones (con animación) ============================ */
  function animateOpen(el) {
    el.hidden = false; // asegurar que existe tamaño medible
    el.style.overflow = "hidden";
    const start = el.offsetHeight; // 0 si estaba hidden
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
    if (!accs.length) return;

    accs.forEach((acc) => {
      const head = $(".exp-acc-head", acc);
      const body = $(".exp-acc-body", acc);
      if (!head || !body) return;

      const initOpen = head.getAttribute("aria-expanded") === "true";
      // estado inicial sin “parpadeo”
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

  /* ============================ Stepper (visual) ============================ */
  function initStepper() {
    const menu = $(".step-menu");
    if (!menu) return;
    on(menu, "click", "li", (e, li) => {
      // Visual solamente (negocio lo maneja el módulo de Acciones)
      $$("li", menu).forEach((it) => it.classList.remove("current"));
      li.classList.add("current");
    });
  }

  // Exponer util a otros bloques
  window.paintStepper = function paintStepper(nextStatus) {
    const items = $$(".step-menu li");
    items.forEach((li) => {
      const s = Number(li.dataset.status);
      li.classList.remove("current");
      if (s < nextStatus) li.classList.add("complete");
      else li.classList.remove("complete");
      if (s === nextStatus) li.classList.add("current");
    });
  };

  /* ============================ Boot ============================ */
  document.addEventListener("DOMContentLoaded", () => {
    try {
      initTabs();
      initAccordions();
      initSortableTables();
      initStepper();
    } catch (e) {
      console.error("[RequerimientoView] init error:", e);
    }
  });
})();


// ======================= Acciones contextualizadas del requerimiento =======================
(() => {
  "use strict";

  // ---- Config: actualiza estos endpoints según tu backend ----
  const API = {
    cambiarEstado: "/db/WEB/ixtla01_u_requerimiento_estado.php", // <- POST { id, status, motivo? }
    asignarDepto:  "/VIEWS/Tareas.php?asignar="                   // <- demo redirección
  };

  // ---- Utils ----
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const toast = (m,t="info") => window.gcToast ? gcToast(m,t) : console.log("[req]", t, m);

  function getReqIdFromUrl() {
    try { return Number(new URLSearchParams(location.search).get("id")) || null; }
    catch { return null; }
  }
  function getCurrentStatus() {
    const li = $(".step-menu li.current");
    return li ? Number(li.dataset.status) : null;
  }

  // ---- Modal genérico de motivo (pausar/cancelar) ----
  const modal = $("#modal-estado");
  const form  = $("#form-estado");
  const txt   = $("#estado-motivo");
  const title = $("#estado-title");
  const btnClose = modal?.querySelector(".modal-close");

  let _pendingAction = null; // { type: "pausar"|"cancelar", nextStatus:number, id:number }

  function openEstadoModal({ type, nextStatus, id }) {
    _pendingAction = { type, nextStatus, id };
    title.textContent = type === "cancelar" ? "Motivo de cancelación" : "Motivo de pausa";
    txt.value = "";
    modal.setAttribute("aria-hidden","false");
    modal.classList.add("open");
    setTimeout(()=> txt?.focus(), 50);
  }

  function closeEstadoModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden","true");
    _pendingAction = null;
  }

  btnClose?.addEventListener("click", closeEstadoModal);
  modal?.addEventListener("click", (e) => { if (e.target === modal) closeEstadoModal(); });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!_pendingAction) return;
    const motivo = (txt.value || "").trim();
    if (!motivo) { toast("Describe el motivo, por favor.","warning"); txt.focus(); return; }

    const { id, nextStatus, type } = _pendingAction;

    try {
      const fd = new FormData();
      fd.append("id", String(id));
      fd.append("status", String(nextStatus));
      fd.append("motivo", motivo);

      const res  = await fetch(API.cambiarEstado, { method: "POST", body: fd });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok || data.ok === false || data.error) {
        throw new Error(data.error || "No se pudo actualizar el estado");
      }

      window.paintStepper?.(nextStatus);
      toast(type === "cancelar" ? "Requerimiento cancelado" : "Requerimiento en pausa", "exito");
      closeEstadoModal();
      ReqActions.refresh(); // refresca botones segun nuevo estado
    } catch (err) {
      console.error(err);
      toast("Error al cambiar el estado.", "error");
    }
  });

  // ---- Render de acciones en host #req-actions ----
  function renderActions() {
    const host   = $("#req-actions");
    if (!host) return;

    const id     = getReqIdFromUrl() ?? (window.__REQ_DEMO__?.id ?? null);
    const status = getCurrentStatus(); // 0..6

    host.innerHTML = "";
    if (status == null) return;

    const mk = (txt, cls="btn-xs", onClick=()=>{}) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = cls;
      b.textContent = txt;
      b.addEventListener("click", onClick);
      return b;
    };

    // Estado: SOLICITUD (0) -> "Iniciar revisión"
    if (status === 0) {
      host.appendChild(
        mk("Iniciar revisión", "btn-xs primary", async () => {
          try {
            const fd = new FormData();
            fd.append("id", String(id));
            fd.append("status", "1"); // revisión
            const res  = await fetch(API.cambiarEstado, { method:"POST", body: fd });
            const data = await res.json().catch(()=> ({}));
            if (!res.ok || data.ok === false || data.error) throw new Error(data.error || "fail");
            window.paintStepper?.(1);
            toast("Requerimiento en revisión","exito");
            ReqActions.refresh();
          } catch (e) {
            console.error(e); toast("No se pudo iniciar la revisión","error");
          }
        })
      );
      return;
    }

    // Estado: REVISIÓN (1) -> "Asignar a departamento" + "Pausar" + "Cancelar"
    if (status === 1) {
      host.appendChild(
        mk("Asignar a departamento", "btn-xs primary", () => {
          window.location.href = API.asignarDepto + encodeURIComponent(id);
        })
      );
      host.appendChild(
        mk("Pausar", "btn-xs warn", () => openEstadoModal({ type:"pausar", nextStatus:4, id }))
      );
      host.appendChild(
        mk("Cancelar", "btn-xs danger", () => openEstadoModal({ type:"cancelar", nextStatus:5, id }))
      );
      return;
    }

    // Estados “últimos”: Pausado(4), Cancelado(5), Finalizado(6) -> Reactivar a Revisión(1)
    if (status === 4 || status === 5 || status === 6) {
      host.appendChild(
        mk("Reactivar", "btn-xs primary", async () => {
          try {
            const fd = new FormData();
            fd.append("id", String(id));
            fd.append("status", "1"); // volver a Revisión
            const res  = await fetch(API.cambiarEstado, { method:"POST", body: fd });
            const data = await res.json().catch(()=> ({}));
            if (!res.ok || data.ok === false || data.error) throw new Error(data.error || "fail");
            window.paintStepper?.(1);
            toast("Reactivado a Revisión","exito");
            ReqActions.refresh();
          } catch (e) {
            console.error(e); toast("No se pudo reactivar","error");
          }
        })
      );
      return;
    }

    // Otros estados (p.e. Asignación (2)) -> sin botones especiales por ahora
  }

  function mount() {
    try { renderActions(); } catch (e) { console.error(e); }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once:true });
  } else {
    mount();
  }

  window.ReqActions = { refresh: renderActions };
})();


// ======================= DEMO: hidratar vista desde localStorage.REQ_DEMO =======================
(() => {
  "use strict";
  const $ = (s, r=document) => r.querySelector(s);

  function applyReqToDom(req) {
    // Título
    const h1 = document.querySelector(".exp-title h1");
    if (h1) h1.textContent = req.tramite_nombre || req.asunto || "Requerimiento";

    // Meta
    const meta = {
      contacto: `${req.contacto_nombre || "—"}`,
      encargado: `${req.asignado_nombre_completo || "—"}`,
      fecha: `${(req.created_at || "").replace(" ", " ") || "—"}`
    };
    const dd0 = document.querySelector(".exp-meta dd:nth-child(2)");
    const dd1 = document.querySelector(".exp-meta dd:nth-child(4)");
    const dd2 = document.querySelector(".exp-meta dd:nth-child(6)");
    if (dd0) dd0.textContent = meta.contacto;
    if (dd1) dd1.textContent = meta.encargado;
    if (dd2) dd2.textContent = meta.fecha;

    // Panel Contacto
    const setText = (sel, val) => { const n = $(sel); if (n) n.textContent = val || "—"; };
    setText('.exp-pane[data-tab="contacto"] .exp-grid .exp-field:nth-child(1) .exp-val', req.contacto_nombre);
    setText('.exp-pane[data-tab="contacto"] .exp-grid .exp-field:nth-child(2) .exp-val', req.contacto_telefono);
    setText('.exp-pane[data-tab="contacto"] .exp-grid .exp-field:nth-child(3) .exp-val', `${req.contacto_calle || ""}, ${req.contacto_colonia || ""}`);
    const mailA = document.querySelector('.exp-pane[data-tab="contacto"] .exp-grid .exp-field:nth-child(4) .exp-val a');
    if (mailA) { mailA.textContent = req.contacto_email || "—"; mailA.href = `mailto:${req.contacto_email || ""}`; }
    setText('.exp-pane[data-tab="contacto"] .exp-grid .exp-field:nth-child(5) .exp-val', req.contacto_cp);

    // Panel Detalles
    setText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(1) .exp-val', req.tramite_nombre || req.asunto);
    const liderA = document.querySelector('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(2) .exp-val a');
    if (liderA) liderA.textContent = req.asignado_nombre_completo || "—";
    setText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(3) .exp-val a', req.contacto_nombre);
    const badge = document.querySelector('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(4) .exp-val');
    if (badge) badge.innerHTML = `<span class="exp-badge is-info">${statusLabel(req.estatus)}</span>`;
    setText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field.exp-field--full .exp-val', req.descripcion);
    setText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(6) .exp-val', req.created_at?.split(" ")[0]);
    setText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(7) .exp-val', req.cerrado_en ? req.cerrado_en.split(" ")[0] : "—");

    // Stepper según estatus
    const est = Number(req.estatus ?? 0);
    window.paintStepper?.(est);
    // y refrescar acciones
    window.ReqActions?.refresh();
  }

  function statusLabel(s){
    switch(Number(s)){
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

  function bootFromLocalStorage(){
    try {
      const raw = localStorage.getItem("REQ_DEMO");
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (!obj || obj.ok === false || !obj.data) return;
      window.__REQ_DEMO__ = obj.data;
      // Si quieres forzar que inicie en Solicitud para demo, descomenta:
      window.__REQ_DEMO__.estatus = 0;
      applyReqToDom(window.__REQ_DEMO__);
    } catch (e) {
      console.warn("[Requerimiento DEMO] no se pudo parsear REQ_DEMO:", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootFromLocalStorage, { once:true });
  } else {
    bootFromLocalStorage();
  }
})();

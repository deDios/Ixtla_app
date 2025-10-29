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

    // Index panes por data-tab (normalizado) o por el texto del botón
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

    // Enlaza data-tab normalizado a cada botón
    $$(".exp-tab", tabsBar).forEach((b) => {
      if (!b.dataset.tab) b.dataset.tab = normalize(b.textContent);
      // Si el pane no existe con ese nombre, intenta mapear a uno existente
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

    // Accesibilidad por teclado
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

    // Activa el primer tab marcado o el primero de la barra
    const initialBtn =
      $(".exp-tab.is-active", tabsBar) || $(".exp-tab", tabsBar);
    const initialKey = initialBtn
      ? normalize(initialBtn.dataset.tab || initialBtn.textContent)
      : null;
    if (initialKey) setActive(initialKey);
  }

  /* ============================ Acordeones ============================ */
  /* ============================ Acordeones ============================ */
  function initAccordions() {
    const accs = $$(".exp-accordion");
    if (!accs.length) return;

    accs.forEach((acc) => {
      const head = $(".exp-acc-head", acc);
      const body = $(".exp-acc-body", acc);
      if (!head || !body) return;

      // Mostrar/ocultar solo con aria-expanded; NADA de transform aquí
      const setOpen = (open) => {
        head.setAttribute("aria-expanded", open ? "true" : "false");
        // usa 'hidden' para evitar estilos inline conflictivos
        body.hidden = !open;
      };

      // Estado inicial: true si aria-expanded="true"
      const initOpen = head.getAttribute("aria-expanded") === "true";
      setOpen(initOpen);

      head.addEventListener("click", () => {
        const isOpen = head.getAttribute("aria-expanded") === "true";
        setOpen(!isOpen);
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
      const rows = () => $$(".exp-row", table); // dinámico por si cambian
      if (!head) return;

      on(head, "click", ".sort", (e, sortSpan) => {
        const th = sortSpan.closest("div");
        const headers = $$(".exp-thead > div", table);
        const idx = headers.indexOf(th);
        if (idx < 0) return;

        // Alterna dirección
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
        // Reinyectar en orden
        arr.forEach((r) => r.parentElement.appendChild(r));
      });
    });
  }

  /* ============================ Stepper (visual) ============================ */
  function initStepper() {
    const menu = $(".step-menu");
    if (!menu) return;
    on(menu, "click", "li", (e, li) => {
      // Sólo manejo visual; no persisto ni valido negocio aquí
      $$("li", menu).forEach((it) => it.classList.remove("current"));
      li.classList.add("current");
    });
  }

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
    asignarDepto:  "/VIEWS/Tareas.php?asignar=" // <- ejemplo redirección; cámbialo si usas drawer/flujo propio
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

  // Marca visual en el stepper después de un cambio
  function paintStepper(nextStatus) {
    const items = $$(".step-menu li");
    items.forEach((li) => {
      const s = Number(li.dataset.status);
      li.classList.remove("current");
      if (s < nextStatus) li.classList.add("complete");
      else li.classList.remove("complete");
      if (s === nextStatus) li.classList.add("current");
    });
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

      paintStepper(nextStatus);
      toast(type === "cancelar" ? "Requerimiento cancelado" : "Requerimiento en pausa", "exito");
      closeEstadoModal();
    } catch (err) {
      console.error(err);
      toast("Error al cambiar el estado.", "error");
    }
  });

  // ---- Render de acciones en host #req-actions ----
  function renderActions() {
    const host   = $("#req-actions");
    if (!host) return;

    const id     = getReqIdFromUrl();
    const status = getCurrentStatus(); // 0..6

    host.innerHTML = "";
    if (status == null) return;

    // helpers UI
    const btn = (txt, cls="btn-xs", onClick=()=>{}) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = cls;
      b.textContent = txt;
      b.addEventListener("click", onClick);
      return b;
    };

    // Estado: SOLICITUD (0) -> mostrar "Iniciar revisión"
    if (status === 0) {
      host.appendChild(
        btn("Iniciar revisión", "btn-xs primary", async () => {
          try {
            const fd = new FormData();
            fd.append("id", String(id));
            fd.append("status", "1"); // revisión
            const res  = await fetch(API.cambiarEstado, { method:"POST", body: fd });
            const data = await res.json().catch(()=> ({}));
            if (!res.ok || data.ok === false || data.error) throw new Error(data.error || "fail");
            paintStepper(1);
            toast("Requerimiento en revisión","exito");
          } catch (e) {
            console.error(e); toast("No se pudo iniciar la revisión","error");
          }
        })
      );
      return; // sólo ese botón en este estado
    }

    // Estado: REVISIÓN (1) -> "Asignar a departamento" + "Pausar" + "Cancelar"
    if (status === 1) {
      host.appendChild(
        btn("Asignar a departamento", "btn-xs primary", () => {
          // Si tu flujo abre drawer/modal, invócalo aquí.
          // Como fallback, redirigimos a una vista de asignación con el id:
          window.location.href = API.asignarDepto + encodeURIComponent(id);
        })
      );
      host.appendChild(
        btn("Pausar", "btn-xs warn", () => openEstadoModal({ type:"pausar", nextStatus:4, id }))
      );
      host.appendChild(
        btn("Cancelar", "btn-xs danger", () => openEstadoModal({ type:"cancelar", nextStatus:5, id }))
      );
      return;
    }

    // Estado: PROCESO (3) -> puedes querer "Pausar" y "Cancelar" también
    if (status === 3) {
      host.appendChild(
        btn("Pausar", "btn-xs warn", () => openEstadoModal({ type:"pausar", nextStatus:4, id }))
      );
      host.appendChild(
        btn("Cancelar", "btn-xs danger", () => openEstadoModal({ type:"cancelar", nextStatus:5, id }))
      );
      return;
    }

    // Otros estados: opcionalmente podrías mostrar "Reanudar" cuando está en Pausado (4)
    if (status === 4) {
      host.appendChild(
        btn("Reanudar", "btn-xs primary", async () => {
          try {
            const fd = new FormData();
            fd.append("id", String(id));
            fd.append("status", "3"); // volver a Proceso
            const res  = await fetch(API.cambiarEstado, { method:"POST", body: fd });
            const data = await res.json().catch(()=> ({}));
            if (!res.ok || data.ok === false || data.error) throw new Error(data.error || "fail");
            paintStepper(3);
            toast("Reanudado a Proceso","exito");
          } catch (e) {
            console.error(e); toast("No se pudo reanudar","error");
          }
        })
      );
    }
  }

  // ---- Mount ----
  function mount() {
    try { renderActions(); } catch (e) { console.error(e); }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once:true });
  } else {
    mount();
  }

  // Si cambias el estatus desde otro script y quieres re-render:
  window.ReqActions = { refresh: renderActions, paintStepper };
})();

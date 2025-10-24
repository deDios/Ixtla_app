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
      const key = normalize(p.getAttribute("data-tab") || p.getAttribute("aria-label") || p.id);
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
    const initialBtn = $(".exp-tab.is-active", tabsBar) || $(".exp-tab", tabsBar);
    const initialKey = initialBtn ? normalize(initialBtn.dataset.tab || initialBtn.textContent) : null;
    if (initialKey) setActive(initialKey);
  }

  /* ============================ Acordeones ============================ */
  function initAccordions() {
    const accs = $$(".exp-accordion");
    if (!accs.length) return;

    accs.forEach((acc) => {
      const head = $(".exp-acc-head", acc);
      const body = $(".exp-acc-body", acc);
      if (!head || !body) return;

      const setOpen = (open) => {
        head.setAttribute("aria-expanded", open ? "true" : "false");
        body.style.display = open ? "block" : "none";
        const chev = $(".chev", head);
        if (chev) chev.style.transform = open ? "rotate(180deg)" : "rotate(0deg)";
      };

      // Estado inicial según aria-expanded
      const initOpen = head.getAttribute("aria-expanded") !== "false";
      setOpen(initOpen);

      head.addEventListener("click", () => setOpen(head.getAttribute("aria-expanded") !== "true"));
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

        const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
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

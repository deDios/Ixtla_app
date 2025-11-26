// /JS/ui/tareasFiltros.js – UI de filtros del tablero de tareas
"use strict";

/**
 * Módulo de filtros para el tablero de tareas.
 *
 * Recibe State, helpers y un callback renderBoard()
 * para no acoplarse a los detalles del tablero.
 */
export function createTaskFiltersModule({ State, KB, log, renderBoard, $, $$ }) {
  // Multi select (Departamentos / Empleados)
  const MultiFilters = {
    departamentos: null,
    empleados: null,
  };

  /* ------------------------------------------------------------------------
   * Multi select (Departamentos / Empleados)
   * ---------------------------------------------------------------------- */

  function createMultiFilter(fieldEl, key, options) {
    if (!fieldEl) return;

    const trigger = fieldEl.querySelector(".kb-multi-trigger");
    const placeholderEl = fieldEl.querySelector(".kb-multi-placeholder");
    const summaryEl = fieldEl.querySelector(".kb-multi-summary");
    const menu = fieldEl.querySelector(".kb-multi-menu");
    const searchInput = fieldEl.querySelector(".kb-multi-search-input");
    const list = fieldEl.querySelector(".kb-multi-options");

    const stateSet = State.filters[key] || (State.filters[key] = new Set());

    function renderOptions() {
      if (!list) return;
      list.innerHTML = "";
      options.forEach((opt) => {
        const li = document.createElement("li");
        li.className = "kb-multi-option";
        li.dataset.value = String(opt.value);
        li.textContent = opt.label;
        if (stateSet.has(opt.value)) {
          li.classList.add("is-selected");
        }
        li.addEventListener("click", () => toggleValue(opt.value));
        list.appendChild(li);
      });
    }

    function updateSummary() {
      const selected = options.filter((opt) => stateSet.has(opt.value));
      if (!selected.length) {
        if (placeholderEl) placeholderEl.hidden = false;
        if (summaryEl) {
          summaryEl.hidden = true;
          summaryEl.textContent = "";
        }
      } else {
        if (placeholderEl) placeholderEl.hidden = true;
        if (summaryEl) {
          summaryEl.hidden = false;
          if (selected.length === 1) {
            summaryEl.textContent = selected[0].label;
          } else {
            summaryEl.textContent = `${selected[0].label} +${
              selected.length - 1
            }`;
          }
        }
      }
    }

    function toggleValue(value) {
      if (stateSet.has(value)) {
        stateSet.delete(value);
      } else {
        stateSet.add(value);
      }

      if (list) {
        const li = list.querySelector(
          `.kb-multi-option[data-value="${value}"]`
        );
        if (li) li.classList.toggle("is-selected", stateSet.has(value));
      }

      updateSummary();
      renderBoard();
    }

    function openMenu() {
      if (!menu || !trigger) return;
      trigger.setAttribute("aria-expanded", "true");
      menu.hidden = false;
      fieldEl.classList.add("is-open");
    }

    function closeMenu() {
      if (!menu || !trigger) return;
      trigger.setAttribute("aria-expanded", "false");
      menu.hidden = true;
      fieldEl.classList.remove("is-open");
    }

    function toggleMenu() {
      const expanded = trigger.getAttribute("aria-expanded") === "true";
      if (expanded) {
        closeMenu();
      } else {
        openMenu();
        if (searchInput) searchInput.focus();
      }
    }

    if (trigger) {
      trigger.addEventListener("click", (ev) => {
        ev.stopPropagation();
        toggleMenu();
      });
    }

    if (searchInput && list) {
      searchInput.addEventListener("input", () => {
        const q = searchInput.value.trim().toLowerCase();
        const items = list.querySelectorAll(".kb-multi-option");
        items.forEach((li) => {
          const label = (li.textContent || "").toLowerCase();
          li.hidden = q && !label.includes(q);
        });
      });
    }

    document.addEventListener("click", (ev) => {
      if (!fieldEl.contains(ev.target)) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        closeMenu();
      }
    });

    renderOptions();
    updateSummary();

    MultiFilters[key] = {
      clear() {
        stateSet.clear();
        updateSummary();
        const items = list?.querySelectorAll(".kb-multi-option") || [];
        items.forEach((li) => li.classList.remove("is-selected"));
      },
    };
  }

  function setupSidebarFilters() {
    const btnClear = $("#kb-sidebar-clear");
    if (btnClear) {
      btnClear.addEventListener("click", () => {
        State.filters.departamentos.clear();
        State.filters.empleados.clear();

        if (MultiFilters.departamentos) MultiFilters.departamentos.clear();
        if (MultiFilters.empleados) MultiFilters.empleados.clear();

        renderBoard();
      });
    }
  }

  /* ------------------------------------------------------------------------
   * Toolbar (chips + search + combos proceso / trámite)
   * ---------------------------------------------------------------------- */

  function setupToolbarCombos({ procesosOptions, tramitesOptions }) {
    const selProc = $("#kb-filter-proceso");
    const selTram = $("#kb-filter-tramite");

    if (selProc) {
      selProc.innerHTML =
        '<option value="">Todos</option>' +
        procesosOptions
          .map((o) => `<option value="${o.value}">${o.label}</option>`)
          .join("");
      selProc.addEventListener("change", () => {
        const v = selProc.value;
        State.filters.procesoId = v ? Number(v) : null;
        log("Filtro ProcesoId →", State.filters.procesoId);
        renderBoard();
      });
    }

    if (selTram) {
      selTram.innerHTML =
        '<option value="">Todos</option>' +
        tramitesOptions
          .map((o) => `<option value="${o.value}">${o.label}</option>`)
          .join("");
      selTram.addEventListener("change", () => {
        const v = selTram.value;
        State.filters.tramiteId = v ? Number(v) : null;
        log("Filtro TramiteId →", State.filters.tramiteId);
        renderBoard();
      });
    }

    log("[KB] Opciones filtro Procesos:", procesosOptions);
    log("[KB] Opciones filtro Trámites:", tramitesOptions);
  }

  function setupToolbar() {
    const chipMine = $('.kb-chip[data-filter="mine"]');
    const chipRecent = $('.kb-chip[data-filter="recent"]');
    const inputSearch = $("#kb-filter-search");
    const btnClear = $("#kb-filter-clear");

    if (chipMine) {
      chipMine.classList.toggle("is-active", State.filters.mine);
      chipMine.addEventListener("click", () => {
        State.filters.mine = !State.filters.mine;
        chipMine.classList.toggle("is-active", State.filters.mine);
        log("Filtro 'Solo mis tareas' →", State.filters.mine);
        renderBoard();
      });
    }

    if (chipRecent) {
      chipRecent.addEventListener("click", () => {
        chipRecent.classList.toggle("is-active");
        log(
          "Filtro 'Recientes' toggled:",
          chipRecent.classList.contains("is-active")
        );
        // de momento solo visual; no afecta pipeline aún
      });
    }

    if (inputSearch) {
      inputSearch.addEventListener("input", () => {
        State.filters.search = inputSearch.value || "";
        log("Filtro search →", State.filters.search);
        renderBoard();
      });
    }

    if (btnClear) {
      btnClear.addEventListener("click", () => {
        State.filters.mine = false;
        State.filters.search = "";
        State.filters.procesoId = null;
        State.filters.tramiteId = null;

        if (chipMine) chipMine.classList.remove("is-active");
        if (chipRecent) chipRecent.classList.remove("is-active");
        if (inputSearch) inputSearch.value = "";

        const selProc = $("#kb-filter-proceso");
        const selTram = $("#kb-filter-tramite");
        if (selProc) selProc.value = "";
        if (selTram) selTram.value = "";

        log("Filtros rápidos limpiados");
        renderBoard();
      });
    }
  }

  /* ------------------------------------------------------------------------
   * API pública del módulo
   * ---------------------------------------------------------------------- */

  function init({ deptOptions, empOptions, procesosOptions, tramitesOptions }) {
    // Sidebar (botón limpiar)
    setupSidebarFilters();

    // Combos multi-select
    const fieldDept = $("#kb-filter-departamentos");
    const fieldEmp = $("#kb-filter-empleados");
    if (fieldDept && deptOptions.length) {
      createMultiFilter(fieldDept, "departamentos", deptOptions);
    }
    if (fieldEmp && empOptions.length) {
      createMultiFilter(fieldEmp, "empleados", empOptions);
    }

    // Toolbar principal
    setupToolbar();
    setupToolbarCombos({ procesosOptions, tramitesOptions });
  }

  return {
    init,
  };
}

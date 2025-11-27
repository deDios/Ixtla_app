// /JS/ui/tareasFiltros.js
"use strict";

/**
 * Módulo de UI de filtros del tablero de tareas.
 *
 * Se encarga de:
 *  - Sidebar (multi-combos de Departamentos y Empleados)
 *  - Toolbar (chips, búsqueda, combos Proceso / Trámite)
 *  - Filtros dinámicos: updateAvailableOptions(tasks)
 *
 * Recibe helpers y state desde tareas.js para no duplicar lógica.
 */

export function createTaskFiltersModule({
  State,
  KB,
  log,
  renderBoard,
  $,
  $$,
}) {
  /* ========================================================================
   * Estado local del módulo
   * ======================================================================*/

  const MultiFilters = {
    departamentos: null,
    empleados: null,
  };

  // refs de UI que usaremos también en updateAvailableOptions
  let fieldDept = null;
  let fieldEmp = null;
  let selProc = null;
  let selTram = null;

  /* ========================================================================
   * Helpers multi-combo sidebar
   * ======================================================================*/

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
            summaryEl.textContent = `${selected[0].label} +${selected.length - 1
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

  /* ========================================================================
   * Toolbar (chips + búsqueda + combos proceso / trámite)
   * ======================================================================*/

  function setupToolbarCombos({ procesosOptions, tramitesOptions }) {
    selProc = $("#kb-filter-proceso");
    selTram = $("#kb-filter-tramite");

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

    // --- Solo mis tareas ---
    if (chipMine) {
      // ahora State.filters.mine ya viene en false por defecto
      chipMine.classList.toggle("is-active", State.filters.mine);
      chipMine.addEventListener("click", () => {
        State.filters.mine = !State.filters.mine;
        chipMine.classList.toggle("is-active", State.filters.mine);
        log("Filtro 'Solo mis tareas' →", State.filters.mine);
        renderBoard();
      });
    }

    // --- Recientes (últimos 15 días) ---
    if (chipRecent) {
      const isActive = State.filters.recentDays != null;
      chipRecent.classList.toggle("is-active", isActive);

      chipRecent.addEventListener("click", () => {
        const nowActive = !chipRecent.classList.contains("is-active");
        chipRecent.classList.toggle("is-active", nowActive);

        // si está activo, usamos 15 días; si no, desactivamos el filtro
        State.filters.recentDays = nowActive ? 15 : null;
        log("Filtro 'Recientes (últimos días)' →", State.filters.recentDays);
        renderBoard();
      });
    }

    // --- Búsqueda ---
    if (inputSearch) {
      inputSearch.addEventListener("input", () => {
        State.filters.search = inputSearch.value || "";
        log("Filtro search →", State.filters.search);
        renderBoard();
      });
    }

    // --- Limpiar filtros rápidos ---
    if (btnClear) {
      btnClear.addEventListener("click", () => {
        State.filters.mine = false;
        State.filters.search = "";
        State.filters.procesoId = null;
        State.filters.tramiteId = null;
        State.filters.recentDays = null;

        if (chipMine) chipMine.classList.remove("is-active");
        if (chipRecent) chipRecent.classList.remove("is-active");
        if (inputSearch) inputSearch.value = "";

        if (selProc) selProc.value = "";
        if (selTram) selTram.value = "";

        log("Filtros rápidos limpiados");
        renderBoard();
      });
    }
  }

  /* ========================================================================
   * Filtros dinámicos – se llama desde renderBoard()
   * ======================================================================*/

  /**
   * Actualiza qué opciones están visibles en los filtros, según las tareas
   * que cumplen SOLO:
   *    - filtro "mine"
   *    - filtro de búsqueda (search)
   *
   * El resto de filtros (dept/emp/proceso/trámite) se aplican en passesFilters
   * dentro de tareas.js; aquí solo construimos el "universo" disponible.
   */
  function updateAvailableOptions(tasks) {
    if (!Array.isArray(tasks)) return;

    // Si no hay tareas (por ejemplo, filtro deja 0), mostramos todas las opciones.
    const noUniverse = tasks.length === 0;

    // ---------------- Departamentos ----------------
    // ---------------- Departamentos ----------------
    if (fieldDept) {
      const visibleDeptIds = new Set();

      // Usamos el departamento de la TAREA / REQUERIMIENTO,
      // NO el del empleado asignado.
      for (const t of tasks) {
        if (t.departamento_id != null) {
          visibleDeptIds.add(Number(t.departamento_id));
        }
      }

      const stateSet = State.filters.departamentos || new Set();
      const list = fieldDept.querySelector(".kb-multi-options");
      if (list) {
        list.querySelectorAll(".kb-multi-option").forEach((li) => {
          const value = Number(li.dataset.value);
          if (noUniverse) {
            // Si no hay tareas (por ejemplo, filtros dejaron 0),
            // mostramos todas las opciones
            li.hidden = false;
          } else if (
            visibleDeptIds.has(value) ||
            stateSet.has(value) // mantener visibles los que ya están seleccionados
          ) {
            li.hidden = false;
          } else {
            li.hidden = true;
          }
        });
      }
    }


    // ---------------- Empleados ----------------
    if (fieldEmp) {
      const visibleEmpIds = new Set();
      for (const t of tasks) {
        if (t.asignado_a != null) visibleEmpIds.add(Number(t.asignado_a));
      }

      const stateSet = State.filters.empleados || new Set();
      const list = fieldEmp.querySelector(".kb-multi-options");
      if (list) {
        list.querySelectorAll(".kb-multi-option").forEach((li) => {
          const value = Number(li.dataset.value);
          if (noUniverse) {
            li.hidden = false;
          } else if (
            visibleEmpIds.has(value) ||
            stateSet.has(value) // mantener visibles los seleccionados
          ) {
            li.hidden = false;
          } else {
            li.hidden = true;
          }
        });
      }
    }

    // ---------------- Procesos ----------------
    if (selProc) {
      const visibleProcIds = new Set();
      for (const t of tasks) {
        if (t.proceso_id != null) visibleProcIds.add(Number(t.proceso_id));
      }

      const selectedProcId = State.filters.procesoId;

      selProc.querySelectorAll("option").forEach((opt) => {
        if (!opt.value) {
          opt.hidden = false; // opción "Todos"
          return;
        }
        const value = Number(opt.value);
        if (noUniverse) {
          opt.hidden = false;
        } else if (
          visibleProcIds.has(value) ||
          (selectedProcId != null && selectedProcId === value)
        ) {
          opt.hidden = false;
        } else {
          opt.hidden = true;
        }
      });
    }

    // ---------------- Trámites ----------------
    if (selTram) {
      const visibleTramIds = new Set();
      for (const t of tasks) {
        if (t.tramite_id != null) visibleTramIds.add(Number(t.tramite_id));
      }

      const selectedTramId = State.filters.tramiteId;

      selTram.querySelectorAll("option").forEach((opt) => {
        if (!opt.value) {
          opt.hidden = false; // "Todos"
          return;
        }
        const value = Number(opt.value);
        if (noUniverse) {
          opt.hidden = false;
        } else if (
          visibleTramIds.has(value) ||
          (selectedTramId != null && selectedTramId === value)
        ) {
          opt.hidden = false;
        } else {
          opt.hidden = true;
        }
      });
    }

      // Reordena opciones: primero las activas, abajo las "apagadas"
  function reorderFilterOptions(list, activeSet, stateSet, noUniverse, dividerLabel) {
    if (!list) return;

    const items = Array.from(list.querySelectorAll(".kb-multi-option"));
    const enabled = [];
    const disabled = [];

    items.forEach((li) => {
      const value = Number(li.dataset.value);
      const isActive =
        noUniverse ||
        activeSet.has(value) ||
        stateSet.has(value); // mantener visibles las seleccionadas

      li.classList.toggle("is-disabled", !isActive);

      if (isActive) {
        enabled.push(li);
      } else {
        disabled.push(li);
      }
    });

    // Limpiar divisores previos
    Array.from(list.querySelectorAll(".kb-multi-divider")).forEach((d) =>
      d.remove()
    );

    // Reordenar en el DOM (no se pierden listeners)
    enabled.forEach((li) => list.appendChild(li));

    if (disabled.length) {
      const divider = document.createElement("li");
      divider.className = "kb-multi-divider";
      divider.textContent = dividerLabel || "Sin tareas en la vista actual";
      list.appendChild(divider);
      disabled.forEach((li) => list.appendChild(li));
    }
  }

  }

  /* ========================================================================
   * API pública del módulo
   * ======================================================================*/

  function init({ deptOptions, empOptions, procesosOptions, tramitesOptions }) {
    setupSidebarFilters();

    fieldDept = $("#kb-filter-departamentos");
    fieldEmp = $("#kb-filter-empleados");

    if (fieldDept && Array.isArray(deptOptions) && deptOptions.length) {
      createMultiFilter(fieldDept, "departamentos", deptOptions);
    }
    if (fieldEmp && Array.isArray(empOptions) && empOptions.length) {
      createMultiFilter(fieldEmp, "empleados", empOptions);
    }

    setupToolbar();
    setupToolbarCombos({ procesosOptions, tramitesOptions });
  }

  return {
    init,
    updateAvailableOptions,
  };
}

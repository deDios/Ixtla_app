// /JS/UAT/ui/tareasFiltros.js
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

        const row = document.createElement("label");
        row.className = "kb-multi-row";

        const check = document.createElement("input");
        check.type = "checkbox";
        check.className = "kb-multi-check";
        check.checked = stateSet.has(opt.value);

        const nameSpan = document.createElement("span");
        nameSpan.className = "kb-multi-name";
        nameSpan.textContent = opt.label;

        const meta = document.createElement("span");
        meta.className = "kb-multi-meta";

        const countSpan = document.createElement("span");
        countSpan.className = "kb-multi-count";
        countSpan.textContent = "0";

        const tagSpan = document.createElement("span");
        tagSpan.className = "kb-multi-tag";
        tagSpan.textContent = ""; // se llenará en updateAvailableOptions

        meta.appendChild(countSpan);
        meta.appendChild(tagSpan);

        row.appendChild(check);
        row.appendChild(nameSpan);
        row.appendChild(meta);

        li.appendChild(row);

        // click en el checkbox
        check.addEventListener("click", (ev) => {
          ev.stopPropagation();
          toggleValue(opt.value);
        });

        // click en toda la fila (texto, meta, etc.)
        row.addEventListener("click", (ev) => {
          // si fue directamente el checkbox, ya se maneja arriba
          if (ev.target.closest("input[type=checkbox]")) return;
          ev.preventDefault();
          ev.stopPropagation();
          toggleValue(opt.value);
        });

        // click en toda la fila (fallback)
        li.addEventListener("click", (ev) => {
          if (ev.target.closest("input[type=checkbox]")) return;
          toggleValue(opt.value);
        });

        if (stateSet.has(opt.value)) {
          li.classList.add("is-selected");
        }

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
        if (li) {
          const isSel = stateSet.has(value);
          li.classList.toggle("is-selected", isSel);
          const cb = li.querySelector(".kb-multi-check");
          if (cb) cb.checked = isSel;
        }
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
        items.forEach((li) => {
          li.classList.remove("is-selected", "is-disabled");
          li.removeAttribute("aria-disabled");
          const cb = li.querySelector(".kb-multi-check");
          if (cb) cb.checked = false;
        });
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
   * Helper para reordenar opciones (con tareas / sin tareas)
   * ======================================================================*/

  function reorderFilterOptions(fieldEl, countsMap, labelNoTasks) {
    const list = fieldEl.querySelector(".kb-multi-options");
    if (!list) return;

    const allLis = Array.from(list.querySelectorAll("li.kb-multi-option"));
    const withTasks = [];
    const withoutTasks = [];

    for (const li of allLis) {
      const value = Number(li.dataset.value);
      const count = countsMap.get(value) || 0;

      const countSpan = li.querySelector(".kb-multi-count");
      if (countSpan) {
        countSpan.textContent = String(count);
      }

      const tagSpan = li.querySelector(".kb-multi-tag");
      if (tagSpan) {
        tagSpan.textContent = count === 0 ? "SIN TAREAS EN LA VISTA" : "";
      }

      if (count > 0) {
        li.dataset.hasTasks = "1";
        withTasks.push(li);
      } else {
        li.dataset.hasTasks = "0";
        withoutTasks.push(li);
      }
    }

    // eliminar separadores previos
    Array.from(list.querySelectorAll("li.kb-multi-separator")).forEach((sep) =>
      sep.remove()
    );

    list.innerHTML = "";

    // primero los que sí tienen tareas
    withTasks.forEach((li) => list.appendChild(li));

    // luego separador + los que no tienen tareas
    if (withoutTasks.length) {
      const sep = document.createElement("li");
      sep.className = "kb-multi-separator";
      sep.setAttribute("data-role", "separator");
      sep.innerHTML = `<span>${labelNoTasks}</span>`;
      list.appendChild(sep);

      withoutTasks.forEach((li) => list.appendChild(li));
    }
  }

  /* ========================================================================
   * Filtros dinámicos – se llama desde renderBoard()
   * ======================================================================*/

  /**
   * Actualiza qué opciones están visibles / cómo se presentan en los filtros.
   *
   * - El filtro que se está usando (departamentos o empleados) NO
   *   deshabilita sus propias opciones.
   * - El otro filtro sí se recalcula con base en las tareas visibles.
   */
  function updateAvailableOptions(tasks) {
    if (!Array.isArray(tasks)) return;

    const allTasks =
      Array.isArray(State.tasks) && State.tasks.length ? State.tasks : tasks;

    const hasDeptFilter =
      State.filters.departamentos &&
      State.filters.departamentos.size &&
      State.filters.departamentos.size > 0;

    const hasEmpFilter =
      State.filters.empleados &&
      State.filters.empleados.size &&
      State.filters.empleados.size > 0;

    // Si hay filtro de empleados pero NO de deptos,
    // entonces los deptos se calculan con las tareas visibles (tasks).
    // En cualquier otro caso, usan todas las tareas del tablero.
    const tasksForDeptCounts =
      hasEmpFilter && !hasDeptFilter ? tasks : allTasks;

    // Si hay filtro de deptos pero NO de empleados,
    // entonces los empleados se calculan con las tareas visibles (tasks).
    // En cualquier otro caso, usan todas las tareas del tablero.
    const tasksForEmpCounts = hasDeptFilter && !hasEmpFilter ? tasks : allTasks;

    // ---------------- Departamentos ----------------
    if (fieldDept && !fieldDept.hidden) {
      const countsDept = new Map();

      for (const t of tasksForDeptCounts) {
        if (t.departamento_id != null) {
          const id = Number(t.departamento_id);
          countsDept.set(id, (countsDept.get(id) || 0) + 1);
        }
      }

      const stateSet = State.filters.departamentos || new Set();
      const list = fieldDept.querySelector(".kb-multi-options");

      if (list) {
        reorderFilterOptions(
          fieldDept,
          countsDept,
          "DEPARTAMENTOS SIN TAREAS EN LA VISTA"
        );

        list.querySelectorAll(".kb-multi-option").forEach((li) => {
          const value = Number(li.dataset.value);
          const count = countsDept.get(value) || 0;
          const isSelected = stateSet.has(value);

          li.classList.toggle("is-selected", isSelected);

          const cb = li.querySelector(".kb-multi-check");
          if (cb) cb.checked = isSelected;

          if (count === 0 && !isSelected) {
            li.classList.add("is-disabled");
            li.setAttribute("aria-disabled", "true");
          } else {
            li.classList.remove("is-disabled");
            li.removeAttribute("aria-disabled");
          }

          li.hidden = false;
        });
      }
    }

    // ---------------- Empleados ----------------
    if (fieldEmp && !fieldEmp.hidden) {
      const countsEmp = new Map();

      for (const t of tasksForEmpCounts) {
        if (t.asignado_a != null) {
          const id = Number(t.asignado_a);
          countsEmp.set(id, (countsEmp.get(id) || 0) + 1);
        }
      }

      const stateSet = State.filters.empleados || new Set();
      const list = fieldEmp.querySelector(".kb-multi-options");

      if (list) {
        reorderFilterOptions(
          fieldEmp,
          countsEmp,
          "EMPLEADOS SIN TAREAS EN LA VISTA"
        );

        list.querySelectorAll(".kb-multi-option").forEach((li) => {
          const value = Number(li.dataset.value);
          const count = countsEmp.get(value) || 0;
          const isSelected = stateSet.has(value);

          li.classList.toggle("is-selected", isSelected);

          const cb = li.querySelector(".kb-multi-check");
          if (cb) cb.checked = isSelected;

          if (count === 0 && !isSelected) {
            li.classList.add("is-disabled");
            li.setAttribute("aria-disabled", "true");
          } else {
            li.classList.remove("is-disabled");
            li.removeAttribute("aria-disabled");
          }

          li.hidden = false;
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
        if (tasks.length === 0) {
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
        if (tasks.length === 0) {
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
  }
  
    /* ========================================================================
   * API pública del módulo
   * ======================================================================*/

  function init({ deptOptions, empOptions, procesosOptions, tramitesOptions }) {
    fieldDept = $("#kb-filter-departamentos");
    fieldEmp = $("#kb-filter-empleados");

    const sidebarFiltersBox = $("#kb-sidebar-filters");

    // Si no existe el contenedor de sidebar, sólo montamos toolbar
    if (!sidebarFiltersBox) {
      setupToolbar();
      setupToolbarCombos({ procesosOptions, tramitesOptions });
      return;
    }

    // IMPORTANTE:
    // Toda la lógica de "quién ve qué filtros" ya la hace tareas.js
    // (roles, jerarquías, etc.). Aquí NO volvemos a ocultar nada
    // ni tocamos display del sidebar. Sólo inicializamos los combos
    // que sigan visibles en el DOM.

    // Botón "Limpiar filtros" (sólo tiene sentido si el bloque está visible)
    setupSidebarFilters();

    // ¿El campo de Departamentos está visible? (tareas.js pudo poner display:none)
    const canUseDept =
      fieldDept &&
      getComputedStyle(fieldDept).display !== "none" &&
      Array.isArray(deptOptions) &&
      deptOptions.length > 0;

    if (canUseDept) {
      createMultiFilter(fieldDept, "departamentos", deptOptions);
    }

    // ¿El campo de Empleados está visible?
    const canUseEmp =
      fieldEmp &&
      getComputedStyle(fieldEmp).display !== "none" &&
      Array.isArray(empOptions) &&
      empOptions.length > 0;

    if (canUseEmp) {
      createMultiFilter(fieldEmp, "empleados", empOptions);
    }

    // Toolbar (chips, búsqueda, combos proceso/trámite)
    setupToolbar();
    setupToolbarCombos({ procesosOptions, tramitesOptions });

    log("[KB] Filtros sidebar inicializados (UI)", {
      deptOptions: canUseDept ? deptOptions.length : 0,
      empOptions: canUseEmp ? empOptions.length : 0,
    });
  }

  return {
    init,
    updateAvailableOptions,
  };
}
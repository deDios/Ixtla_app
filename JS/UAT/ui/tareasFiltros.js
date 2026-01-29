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
          `.kb-multi-option[data-value="${value}"]`,
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

  function setupSidebarCollapsible() {
    const box = document.getElementById("kb-sidebar-filters");
    const btn = document.getElementById("kb-sidebar-filters-toggle");
    const body = document.getElementById("kb-sidebar-filters-body");
    if (!box || !btn || !body) return;

    // Solo aplica en mobile
    const isMobile = window.matchMedia("(max-width: 900px)").matches;

    // Estado inicial (por defecto abierto)
    if (isMobile) {
      box.setAttribute("aria-expanded", "true");
    } else {
      box.setAttribute("aria-expanded", "true");
      return;
    }

    btn.addEventListener("click", () => {
      const open = box.getAttribute("aria-expanded") === "true";
      box.setAttribute("aria-expanded", open ? "false" : "true");
    });
  }

  function setupToolbarCollapsible() {
    const box = document.getElementById("kb-toolbar");
    const btn = document.getElementById("kb-toolbar-toggle");
    if (!box || !btn) return;

    const isMobile = window.matchMedia("(max-width: 900px)").matches;

    // En desktop siempre abierto
    if (!isMobile) {
      box.setAttribute("aria-expanded", "true");
      return;
    }

    btn.addEventListener("click", () => {
      const open = box.getAttribute("aria-expanded") === "true";
      box.setAttribute("aria-expanded", open ? "false" : "true");
      btn.setAttribute("aria-expanded", open ? "false" : "true");
    });
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
      sep.remove(),
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
  function updateAvailableOptions(allTasks) {
    // Recalcular available con base en tareas actuales (ya filtradas por "vista")
    const tasks = Array.isArray(allTasks) ? allTasks : [];

    const hasEmpFilter = State.selectedEmpleados.size > 0;
    const hasDeptFilter = State.selectedDepartamentos.size > 0;

    // Helpers para obtener IDs aunque el objeto venga con nombres distintos
    const getDeptId = (t) => {
      const v =
        t?.departamento_id ??
        t?.departamentoId ??
        t?.dept_id ??
        t?.depto_id ??
        t?.departamento ??
        null;
      const n = v != null ? Number(v) : null;
      return Number.isFinite(n) ? n : null;
    };

    const getEmpId = (t) => {
      const v =
        t?.asignado_a ??
        t?.asignadoA ??
        t?.empleado_id ??
        t?.empleadoId ??
        t?.proceso_empleado_id ??
        null;
      const n = v != null ? Number(v) : null;
      return Number.isFinite(n) ? n : null;
    };

    const getProcesoId = (t) => {
      const v = t?.proceso_id ?? t?.procesoId ?? t?.proceso ?? null;
      const n = v != null ? Number(v) : null;
      return Number.isFinite(n) ? n : null;
    };

    const getTramiteId = (t) => {
      const v = t?.tramite_id ?? t?.tramiteId ?? t?.tramite ?? null;
      const n = v != null ? Number(v) : null;
      return Number.isFinite(n) ? n : null;
    };

    // =========================
    // Counts por EMPLEADO
    // - si hay dept seleccionado, contar sobre el subconjunto actual (tasks) ya filtrado por dept
    // - si no hay dept seleccionado, contar sobre todo el universo visible de la vista (tasks)
    // =========================
    const empCounts = new Map();
    for (const t of tasks) {
      const empId = getEmpId(t);
      if (!empId) continue;
      empCounts.set(empId, (empCounts.get(empId) || 0) + 1);
    }

    // Pintar counts en el multi-filter de empleados
    if (els.empleadosMulti) {
      const lis = els.empleadosMulti.querySelectorAll(".kb-multi-tag");
      lis.forEach((li) => {
        const id = Number(li.dataset.value);
        const cnt = empCounts.get(id) || 0;
        const badge = li.querySelector(".kb-multi-count");
        if (badge) badge.textContent = String(cnt);
        li.classList.toggle("is-empty", cnt === 0);
      });
    }

    // =========================
    // Counts por DEPARTAMENTO
    // Aquí suele romperse si la tarea NO trae departamento_id.
    // Regla UX:
    // - Si hay filtro de empleados activo (y no hay dept seleccionado aún),
    //   que el count muestre "cuántas tareas quedarían si elijo este dept".
    // - Si no, contar sobre el universo visible actual (tasks).
    // =========================
    const tasksForDeptCounts =
      hasEmpFilter && !hasDeptFilter
        ? tasks.filter((t) => {
            const empId = getEmpId(t);
            return empId != null && State.selectedEmpleados.has(empId);
          })
        : tasks;

    const deptCounts = new Map();
    for (const t of tasksForDeptCounts) {
      const deptId = getDeptId(t);
      if (!deptId) continue;
      deptCounts.set(deptId, (deptCounts.get(deptId) || 0) + 1);
    }

    // Pintar counts en el multi-filter de departamentos
    if (els.departamentosMulti) {
      const lis = els.departamentosMulti.querySelectorAll(".kb-multi-tag");
      lis.forEach((li) => {
        const id = Number(li.dataset.value);
        const cnt = deptCounts.get(id) || 0;
        const badge = li.querySelector(".kb-multi-count");
        if (badge) badge.textContent = String(cnt);
        li.classList.toggle("is-empty", cnt === 0);
      });
    }

    // =========================
    // Selects: Proceso / Trámite
    // (se habilitan/deshabilitan según existan tareas con ese id)
    // =========================
    const procesosAvail = new Set();
    const tramitesAvail = new Set();

    for (const t of tasks) {
      const pid = getProcesoId(t);
      const tid = getTramiteId(t);
      if (pid) procesosAvail.add(pid);
      if (tid) tramitesAvail.add(tid);
    }

    // Proceso select
    if (els.procesoSelect) {
      const opts = Array.from(els.procesoSelect.options || []);
      opts.forEach((opt) => {
        const v = opt.value;
        if (!v || v === "all") return; // "Todos"
        const id = Number(v);
        const ok = procesosAvail.has(id);
        opt.disabled = !ok;
      });
    }

    // Trámite select
    if (els.tramiteSelect) {
      const opts = Array.from(els.tramiteSelect.options || []);
      opts.forEach((opt) => {
        const v = opt.value;
        if (!v || v === "all") return; // "Todos"
        const id = Number(v);
        const ok = tramitesAvail.has(id);
        opt.disabled = !ok;
      });
    }

    // =========================
    // Mantener los "selected counts" visibles (chips seleccionados)
    // =========================
    const applySelectedCounts = (containerEl, countsMap) => {
      if (!containerEl) return;
      const selected = containerEl.querySelectorAll(
        ".kb-multi-tag.is-selected",
      );
      selected.forEach((li) => {
        const id = Number(li.dataset.value);
        const cnt = countsMap.get(id) || 0;
        const badge = li.querySelector(".kb-multi-count");
        if (badge) badge.textContent = String(cnt);
        li.classList.toggle("is-empty", cnt === 0);
      });
    };

    applySelectedCounts(els.empleadosMulti, empCounts);
    applySelectedCounts(els.departamentosMulti, deptCounts);
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
    // inicializar los chevron para los filtros colapsables en mobile
    setupSidebarCollapsible();

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
    setupToolbarCollapsible();

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

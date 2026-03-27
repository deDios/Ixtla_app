(() => {
  const state = {
    items: [],
    filteredItems: [],
    query: "",
    employees: [],
    drawer: {
      isOpen: false,
      mode: "view", // view | edit | create
      selectedId: null,
      draft: null,
      original: null,
      errors: {},
      confirmDelete: false,
    },
  };

  const MOCK_DEPARTAMENTOS = [
    {
      id: 8,
      nombre: "Parques y Jardines",
      descripcion:
        "Atención a reportes y solicitudes relacionadas con parques, áreas verdes y arbolado urbano, con el fin de dar seguimiento y brindar una solución oportuna a la ciudadanía.",
      director: 52,
      primera_linea: 53,
      status: 1,
      created_at: "2026-01-15 14:15:41",
      updated_at: "2026-02-04 10:17:35",
      created_by: 1,
      updated_by: null,
      director_nombre: "Alfredo",
      director_apellidos: "Gonzáles Vazquez",
      primera_nombre: "ReqParques",
      primera_apellidos: "y Jardines",
      imagen: "/ASSETS/main_logo_shield.png",
    },
    {
      id: 5,
      nombre: "Ecología",
      descripcion:
        "Área encargada de promover la conservación del medio ambiente, el cuidado de áreas verdes, la reducción de la contaminación y el manejo sostenible de los recursos urbanos.",
      director: 18,
      primera_linea: 18,
      status: 1,
      created_at: "2025-09-09 11:10:14",
      updated_at: "2025-12-02 01:44:16",
      created_by: 1,
      updated_by: null,
      director_nombre: "Erick Alberto",
      director_apellidos: "Duarte Molina",
      primera_nombre: "Erick Alberto",
      primera_apellidos: "Duarte Molina",
      imagen: "/ASSETS/main_logo_shield.png",
    },
    {
      id: 1,
      nombre: "SAMAPA",
      descripcion:
        "Atención con problemas relacionados con el servicio de agua, con el fin de dar seguimiento y brindar una solución oportuna.",
      director: 60,
      primera_linea: 59,
      status: 1,
      director_nombre: "Rosa",
      director_apellidos: "Mendoza Santos",
      primera_nombre: "Dayann",
      primera_apellidos: "Rubio Correa",
      imagen: "/ASSETS/main_logo_shield.png",
    },
    {
      id: 2,
      nombre: "Aseo Público",
      descripcion:
        "Atención a reportes relacionados con la recolección de residuos, barrido, limpieza de espacios públicos y mantenimiento general.",
      director: 59,
      primera_linea: 59,
      status: 1,
      director_nombre: "Dayann",
      director_apellidos: "Rubio Correa",
      primera_nombre: "Dayann",
      primera_apellidos: "Rubio Correa",
      imagen: "/ASSETS/main_logo_shield.png",
    },
    {
      id: 3,
      nombre: "Obras Públicas",
      descripcion:
        "Área encargada de planear, ejecutar y dar mantenimiento a la infraestructura urbana, así como coordinar los servicios públicos.",
      director: 60,
      primera_linea: 60,
      status: 1,
      director_nombre: "Rosa",
      director_apellidos: "Mendoza Santos",
      primera_nombre: "Rosa",
      primera_apellidos: "Mendoza Santos",
      imagen: "/ASSETS/main_logo_shield.png",
    },
    {
      id: 4,
      nombre: "Alumbrado Público",
      descripcion:
        "Atención y mantenimiento del alumbrado público, reparación de luminarias y administración de la red de servicios urbanos.",
      director: 58,
      primera_linea: 57,
      status: 1,
      director_nombre: "Hugo",
      director_apellidos: "Hernandez",
      primera_nombre: "Jose Abel",
      primera_apellidos: "Martinez",
      imagen: "/ASSETS/main_logo_shield.png",
    },
    {
      id: 6,
      nombre: "Padrón y Licencias",
      descripcion:
        "Atención a reportes y trámites relacionados con padrón y licencias comerciales, con el fin de dar seguimiento y brindar respuesta.",
      director: 56,
      primera_linea: 55,
      status: 1,
      director_nombre: "Gabriel",
      director_apellidos: "Huerta",
      primera_nombre: "Francisco",
      primera_apellidos: "Hastorga",
      imagen: "/ASSETS/main_logo_shield.png",
    },
  ];

  const MOCK_EMPLOYEES = [
    {
      id: 60,
      nombre: "Rosa",
      apellidos: "Mendoza Santos",
      puesto: "Secretaria de Requerimientos",
      departamento_id: 3,
      status: 1,
      cuenta: {
        roles: [{ id: 3, codigo: "JEFE", nombre: "Jefe" }],
      },
    },
    {
      id: 59,
      nombre: "Dayann",
      apellidos: "Rubio Correa",
      puesto: "Secretaria de Requerimientos",
      departamento_id: 2,
      status: 1,
      cuenta: {
        roles: [{ id: 3, codigo: "JEFE", nombre: "Jefe" }],
      },
    },
    {
      id: 58,
      nombre: "Hugo",
      apellidos: "Hernandez",
      puesto: "Inspector",
      departamento_id: 7,
      status: 1,
      cuenta: {
        roles: [{ id: 3, codigo: "JEFE", nombre: "Jefe" }],
      },
    },
    {
      id: 57,
      nombre: "Jose Abel",
      apellidos: "Martinez",
      puesto: "Inspector",
      departamento_id: 7,
      status: 1,
      cuenta: {
        roles: [{ id: 3, codigo: "JEFE", nombre: "Jefe" }],
      },
    },
    {
      id: 56,
      nombre: "Gabriel",
      apellidos: "Huerta",
      puesto: "Inspector",
      departamento_id: 7,
      status: 1,
      cuenta: {
        roles: [{ id: 3, codigo: "JEFE", nombre: "Jefe" }],
      },
    },
    {
      id: 55,
      nombre: "Francisco",
      apellidos: "Hastorga",
      puesto: "Inspector",
      departamento_id: 7,
      status: 1,
      cuenta: {
        roles: [{ id: 3, codigo: "JEFE", nombre: "Jefe" }],
      },
    },
    {
      id: 18,
      nombre: "Erick Alberto",
      apellidos: "Duarte Molina",
      puesto: "Director",
      departamento_id: 5,
      status: 1,
      cuenta: {
        roles: [{ id: 2, codigo: "DIRECTOR", nombre: "Director" }],
      },
    },
    {
      id: 52,
      nombre: "Alfredo",
      apellidos: "Gonzáles Vazquez",
      puesto: "Director",
      departamento_id: 8,
      status: 1,
      cuenta: {
        roles: [{ id: 2, codigo: "DIRECTOR", nombre: "Director" }],
      },
    },
    {
      id: 53,
      nombre: "ReqParques",
      apellidos: "y Jardines",
      puesto: "Jefe",
      departamento_id: 8,
      status: 1,
      cuenta: {
        roles: [{ id: 3, codigo: "JEFE", nombre: "Jefe" }],
      },
    },
  ];

  function init() {
    state.items = clone(MOCK_DEPARTAMENTOS);
    state.employees = clone(MOCK_EMPLOYEES);
    applyDerivedLabels();
    applyFilters();
  }

  function applyDerivedLabels() {
    state.items = state.items.map((item) => {
      const director = getEmployeeById(item.director);
      const primeraLinea = getEmployeeById(item.primera_linea);

      return {
        ...item,
        director_nombre: director?.nombre || item.director_nombre || "",
        director_apellidos: director?.apellidos || item.director_apellidos || "",
        primera_nombre: primeraLinea?.nombre || item.primera_nombre || "",
        primera_apellidos: primeraLinea?.apellidos || item.primera_apellidos || "",
      };
    });
  }

  function applyFilters() {
    const q = String(state.query || "")
      .trim()
      .toLowerCase();

    let base = state.items.filter((item) => Number(item.status) === 1);

    if (q) {
      base = base.filter((item) => {
        const director = getEmployeeFullNameById(item.director);
        const primera = getEmployeeFullNameById(item.primera_linea);

        return (
          String(item.id || "").includes(q) ||
          String(item.nombre || "").toLowerCase().includes(q) ||
          String(item.descripcion || "").toLowerCase().includes(q) ||
          director.toLowerCase().includes(q) ||
          primera.toLowerCase().includes(q)
        );
      });
    }

    state.filteredItems = base;
  }

  function render() {
    return `
      <section class="admin-module admin-module--departamentos">
        <div class="admin-module__head">
          <div class="admin-module__titlebox">
            <h2 class="admin-module__title">Gestión de departamentos</h2>
          </div>

          <div class="admin-module__toolbar">
            <label class="search" aria-label="Buscar departamento">
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M10 4a6 6 0 0 1 4.472 9.931l4.298 4.297l-1.414 1.415l-4.297-4.298A6 6 0 1 1 10 4m0 2a4 4 0 1 0 0 8a4 4 0 0 0 0-8"></path>
              </svg>
              <input
                id="admin-departamentos-search"
                type="search"
                placeholder="Buscar departamento"
                value="${escapeHtml(state.query)}"
              />
            </label>

            <button
              type="button"
              class="hs-btn"
              id="btn-add-departamento"
            >
              + Agregar Departamento
            </button>
          </div>
        </div>

        <div class="admin-module__body">
          <div class="hs-table table-wrap">
            <table class="gc">
              <thead>
                <tr>
                  <th>Departamento</th>
                  <th>Descripción</th>
                  <th>Imagen</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${renderRows()}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      ${renderDrawer()}
    `;
  }

  function renderRows() {
    if (!state.filteredItems.length) {
      return `
        <tr>
          <td colspan="5">
            <div class="muted">No se encontraron departamentos.</div>
          </td>
        </tr>
      `;
    }

    return state.filteredItems
      .map((item) => {
        const status = getStatusMeta(item.status);

        return `
          <tr data-id="${item.id}">
            <td>
              <strong>${escapeHtml(item.nombre)}</strong>
            </td>

            <td title="${escapeHtml(item.descripcion)}">
              ${escapeHtml(truncate(item.descripcion, 145))}
            </td>

            <td>
              <img
                src="${escapeHtml(item.imagen || "/ASSETS/main_logo_shield.png")}"
                alt="${escapeHtml(item.nombre)}"
                style="width:48px;height:48px;object-fit:contain;display:block;margin:auto;"
              />
            </td>

            <td>
              <span class="badge-status" data-k="${status.key}">
                ${status.label}
              </span>
            </td>

            <td>
              <button
                type="button"
                class="hs-btn js-edit-departamento"
                data-id="${item.id}"
              >
                Editar Departamento
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderDrawer() {
    const isOpen = state.drawer.isOpen;
    const mode = state.drawer.mode;
    const item = state.drawer.draft;

    if (!isOpen || !item) {
      return `
        <div
          class="admin-drawer-overlay"
          id="admin-departamentos-drawer-overlay"
          aria-hidden="true"
        ></div>
      `;
    }

    const isEdit = mode === "edit" || mode === "create";
    const isCreate = mode === "create";
    const titleText = isCreate
      ? "Nuevo departamento"
      : isEdit
        ? "Editar departamento"
        : "Detalle de departamento";

    const errors = state.drawer.errors || {};
    const statusLabel = Number(item.status) === 1 ? "Activo" : "Inactivo";
    const saveDisabled = isCreate
      ? !isDrawerValid()
      : !(isDrawerValid() && hasDrawerChanges());

    const directorLabel = getEmployeeLabelById(item.director);
    const primeraLineaLabel = getEmployeeLabelById(item.primera_linea);

    return `
  <div
    class="admin-drawer-overlay is-open"
    id="admin-departamentos-drawer-overlay"
    aria-hidden="false"
  >
    <aside
      class="admin-drawer admin-drawer--right is-open"
      id="admin-departamentos-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-departamentos-drawer-title"
    >
      <div class="admin-drawer__head">
        <div>
          <h3 class="admin-drawer__title" id="admin-departamentos-drawer-title">${escapeHtml(titleText)}</h3>
        </div>

        <button
          type="button"
          class="admin-drawer__close js-drawer-close"
          aria-label="Cerrar drawer"
          title="Cerrar"
        >
          ×
        </button>
      </div>

      <div class="admin-drawer__body">
        <div class="admin-drawer__image-block">
          <div class="admin-drawer__image-wrap ${!item.imagen ? "is-empty" : ""}">
            ${item.imagen
        ? `<img src="${escapeHtml(item.imagen)}" alt="${escapeHtml(
          item.nombre || "Vista previa"
        )}" class="admin-drawer__image" />`
        : `<span class="admin-drawer__image-placeholder">🖼️</span>`
      }
          </div>

          <div class="admin-drawer__image-actions">
            <button
              type="button"
              class="admin-drawer__ghost-btn"
              disabled
              title="Más adelante conectaremos media"
            >
              Cambiar imagen
            </button>
            <button
              type="button"
              class="admin-drawer__ghost-btn"
              disabled
              title="Más adelante conectaremos media"
            >
              Eliminar imagen
            </button>
          </div>
        </div>

        <label class="admin-drawer__field">
          <span class="admin-drawer__label">Nombre</span>
          <input
            type="text"
            class="admin-drawer__input js-drawer-input ${errors.nombre ? "is-error" : ""}"
            data-field="nombre"
            value="${escapeAttr(item.nombre || "")}"
            ${isEdit ? "" : "readonly"}
          />
          ${errors.nombre
        ? `<span class="admin-drawer__error">${escapeHtml(errors.nombre)}</span>`
        : ""
      }
        </label>

        <label class="admin-drawer__field">
          <span class="admin-drawer__label">Descripción</span>
          <textarea
            class="admin-drawer__textarea js-drawer-input ${errors.descripcion ? "is-error" : ""}"
            data-field="descripcion"
            ${isEdit ? "" : "readonly"}
          >${escapeHtml(item.descripcion || "")}</textarea>
          ${errors.descripcion
        ? `<span class="admin-drawer__error">${escapeHtml(errors.descripcion)}</span>`
        : ""
      }
        </label>

        <label class="admin-drawer__field">
          <span class="admin-drawer__label">Estado</span>
          ${isEdit
        ? `
                <select class="admin-drawer__select js-drawer-input" data-field="status">
                  <option value="1" ${Number(item.status) === 1 ? "selected" : ""}>Activo</option>
                  <option value="0" ${Number(item.status) === 0 ? "selected" : ""}>Inactivo</option>
                </select>
              `
        : `
                <div class="admin-drawer__readonly-pill admin-drawer__readonly-pill--status admin-drawer__readonly-pill--${Number(item.status) === 1 ? "activo" : "inactivo"}">
                 ${escapeHtml(statusLabel)}
                </div>
              `
      }
        </label>

        <label class="admin-drawer__field">
          <span class="admin-drawer__label">Director</span>

          ${isEdit
        ? `
                <select
                  class="admin-drawer__select js-drawer-input ${errors.director ? "is-error" : ""}"
                  data-field="director"
                >
                  <option value="">Selecciona un director</option>
                  ${renderEmployeeOptions(item.director)}
                </select>
              `
        : `
                <div class="admin-drawer__readonly-value">
                  ${escapeHtml(directorLabel || "Sin asignar")}
                </div>
              `
      }

          ${errors.director
        ? `<span class="admin-drawer__error">${escapeHtml(errors.director)}</span>`
        : ""
      }

          ${isEdit
        ? `
                <small class="admin-drawer__hint">
                  ${escapeHtml(directorLabel || "Sin selección")}
                </small>
              `
        : ""
      }
        </label>

        <label class="admin-drawer__field">
          <span class="admin-drawer__label">Primera línea</span>

          ${isEdit
        ? `
                <select
                  class="admin-drawer__select js-drawer-input ${errors.primera_linea ? "is-error" : ""}"
                  data-field="primera_linea"
                >
                  <option value="">Selecciona primera línea</option>
                  ${renderEmployeeOptions(item.primera_linea)}
                </select>
              `
        : `
                <div class="admin-drawer__readonly-value">
                  ${escapeHtml(primeraLineaLabel || "Sin asignar")}
                </div>
              `
      }

          ${errors.primera_linea
        ? `<span class="admin-drawer__error">${escapeHtml(errors.primera_linea)}</span>`
        : ""
      }

          ${isEdit
        ? `
                <small class="admin-drawer__hint">
                  ${escapeHtml(primeraLineaLabel || "Sin selección")}
                </small>
              `
        : ""
      }

        ${state.drawer.confirmDelete && !isCreate
        ? `
              <div class="admin-drawer__confirm">
                <p class="admin-drawer__confirm-text">
                  ¿Seguro que deseas eliminar este departamento? Se ocultará del listado mock y se marcará con status 0.
                </p>

                <div class="admin-drawer__confirm-actions">
                  <button type="button" class="admin-drawer__danger-btn js-confirm-delete">
                    Sí, eliminar
                  </button>
                  <button type="button" class="admin-drawer__secondary-btn js-cancel-delete">
                    No, volver
                  </button>
                </div>
              </div>
            `
        : ""
      }
      </div>

      <div class="admin-drawer__footer">
        ${renderDrawerFooterButtons(saveDisabled)}
      </div>
    </aside>
  </div>
`;
  }

  function renderEmployeeOptions(selectedId) {
    return getActiveEmployeesSorted()
      .map((emp) => {
        const label = getEmployeeFullName(emp);
        return `
          <option value="${emp.id}" ${Number(selectedId) === Number(emp.id) ? "selected" : ""}>
            ${escapeHtml(label)}
          </option>
        `;
      })
      .join("");
  }

  function renderDrawerFooterButtons(saveDisabled) {
    const mode = state.drawer.mode;

    if (mode === "create") {
      return `
        <button type="button" class="admin-drawer__primary-btn js-save-drawer" ${saveDisabled ? "disabled" : ""}>
          Guardar departamento
        </button>
        <button type="button" class="admin-drawer__secondary-btn js-cancel-edit">
          Cancelar
        </button>
      `;
    }

    if (mode === "edit") {
      return `
        <button type="button" class="admin-drawer__primary-btn js-save-drawer" ${saveDisabled ? "disabled" : ""}>
          Guardar cambios
        </button>
        <button type="button" class="admin-drawer__secondary-btn js-cancel-edit">
          Cancelar
        </button>
      `;
    }

    return `
      <button type="button" class="admin-drawer__primary-btn js-edit-drawer">
        Editar
      </button>
      <button type="button" class="admin-drawer__danger-btn js-ask-delete">
        Eliminar
      </button>
      <button type="button" class="admin-drawer__secondary-btn js-drawer-close">
        Cerrar
      </button>
    `;
  }

  function bind() {
    const root = document.querySelector("#admin-view-root");
    if (!root) return;

    const inputSearch = root.querySelector("#admin-departamentos-search");
    const btnAdd = root.querySelector("#btn-add-departamento");

    if (inputSearch) {
      inputSearch.addEventListener("input", (e) => {
        state.query = e.target.value || "";
        refreshView();
      });
    }

    if (btnAdd) {
      btnAdd.addEventListener("click", openCreateDrawer);
    }

    root.querySelectorAll(".js-edit-departamento").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const item = state.items.find((d) => d.id === id);
        if (!item) return;
        openDrawer(item);
      });
    });

    bindDrawer(root);
  }

  function bindDrawer(root) {
    const overlay = root.querySelector("#admin-departamentos-drawer-overlay");

    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeDrawer();
      });
    }

    root.querySelectorAll(".js-drawer-close").forEach((btn) => {
      btn.addEventListener("click", closeDrawer);
    });

    const btnEdit = root.querySelector(".js-edit-drawer");
    if (btnEdit) {
      btnEdit.addEventListener("click", () => {
        state.drawer.mode = "edit";
        state.drawer.confirmDelete = false;
        validateDrawer();
        refreshView();
        focusDrawerField();
      });
    }

    const btnAskDelete = root.querySelector(".js-ask-delete");
    if (btnAskDelete) {
      btnAskDelete.addEventListener("click", () => {
        state.drawer.confirmDelete = true;
        refreshView();
      });
    }

    const btnCancelDelete = root.querySelector(".js-cancel-delete");
    if (btnCancelDelete) {
      btnCancelDelete.addEventListener("click", () => {
        state.drawer.confirmDelete = false;
        refreshView();
      });
    }

    const btnConfirmDelete = root.querySelector(".js-confirm-delete");
    if (btnConfirmDelete) {
      btnConfirmDelete.addEventListener("click", handleDeleteDepartment);
    }

    const btnCancelEdit = root.querySelector(".js-cancel-edit");
    if (btnCancelEdit) {
      btnCancelEdit.addEventListener("click", () => {
        if (state.drawer.mode === "create") {
          closeDrawer();
          return;
        }

        state.drawer.mode = "view";
        state.drawer.confirmDelete = false;
        state.drawer.draft = clone(state.drawer.original);
        state.drawer.errors = {};
        refreshView();
      });
    }

    const btnSave = root.querySelector(".js-save-drawer");
    if (btnSave) {
      btnSave.addEventListener("click", handleSaveDepartment);
    }

    root.querySelectorAll(".js-drawer-input").forEach((field) => {
      const eventName = field.tagName === "SELECT" ? "change" : "input";

      field.addEventListener(eventName, (e) => {
        const key = e.target.dataset.field;
        if (!key || !state.drawer.draft) return;

        const value = e.target.value;

        if (key === "status" || key === "director" || key === "primera_linea") {
          state.drawer.draft[key] = value === "" ? null : Number(value);
        } else {
          state.drawer.draft[key] = value;
        }

        syncDraftLabels();
        validateDrawer();

        if (key === "status" || key === "director" || key === "primera_linea") {
          refreshView();
        } else {
          syncDrawerUi(root);
        }
      });
    });
  }

  function syncDraftLabels() {
    const draft = state.drawer.draft;
    if (!draft) return;

    const director = getEmployeeById(draft.director);
    const primeraLinea = getEmployeeById(draft.primera_linea);

    draft.director_nombre = director?.nombre || "";
    draft.director_apellidos = director?.apellidos || "";
    draft.primera_nombre = primeraLinea?.nombre || "";
    draft.primera_apellidos = primeraLinea?.apellidos || "";
  }

  function syncDrawerUi(root) {
    if (!root) return;

    const errors = state.drawer.errors || {};
    const mode = state.drawer.mode;
    const isCreate = mode === "create";
    const saveDisabled = isCreate
      ? !isDrawerValid()
      : !(isDrawerValid() && hasDrawerChanges());

    root.querySelectorAll(".js-drawer-input").forEach((field) => {
      const key = field.dataset.field;
      if (!key) return;

      const hasError = Boolean(errors[key]);
      field.classList.toggle("is-error", hasError);

      const fieldWrap = field.closest(".admin-drawer__field");
      if (!fieldWrap) return;

      let errorNode = fieldWrap.querySelector(".admin-drawer__error");
      const errorText = errors[key] || "";

      if (errorText) {
        if (!errorNode) {
          errorNode = document.createElement("span");
          errorNode.className = "admin-drawer__error";
          fieldWrap.appendChild(errorNode);
        }
        errorNode.textContent = errorText;
      } else if (errorNode) {
        errorNode.remove();
      }
    });

    const saveBtn = root.querySelector(".js-save-drawer");
    if (saveBtn) {
      saveBtn.disabled = saveDisabled;
    }
  }

  function openDrawer(item) {
    state.drawer.isOpen = true;
    state.drawer.mode = "view";
    state.drawer.selectedId = item.id;
    state.drawer.original = clone(item);
    state.drawer.draft = clone(item);
    state.drawer.confirmDelete = false;
    state.drawer.errors = {};
    syncDraftLabels();
    refreshView();
  }

  function openCreateDrawer() {
    const firstEmployee = getActiveEmployeesSorted()[0] || null;

    const blank = {
      id: getNextId(),
      nombre: "",
      descripcion: "",
      director: firstEmployee?.id || null,
      primera_linea: firstEmployee?.id || null,
      status: 1,
      created_at: "",
      updated_at: "",
      created_by: null,
      updated_by: null,
      director_nombre: firstEmployee?.nombre || "",
      director_apellidos: firstEmployee?.apellidos || "",
      primera_nombre: firstEmployee?.nombre || "",
      primera_apellidos: firstEmployee?.apellidos || "",
      imagen: "/ASSETS/main_logo_shield.png",
    };

    state.drawer.isOpen = true;
    state.drawer.mode = "create";
    state.drawer.selectedId = blank.id;
    state.drawer.original = clone(blank);
    state.drawer.draft = clone(blank);
    state.drawer.confirmDelete = false;
    state.drawer.errors = {};
    validateDrawer();
    refreshView();
    setTimeout(focusDrawerField, 0);
  }

  function closeDrawer() {
    state.drawer.isOpen = false;
    state.drawer.mode = "view";
    state.drawer.selectedId = null;
    state.drawer.draft = null;
    state.drawer.original = null;
    state.drawer.confirmDelete = false;
    state.drawer.errors = {};
    refreshView();
  }

  function handleSaveDepartment() {
    validateDrawer();
    if (!isDrawerValid()) {
      refreshView();
      focusDrawerField();
      return;
    }

    const payload = clone(state.drawer.draft);

    if (state.drawer.mode === "create") {
      payload.id = getNextId();
      state.items.unshift(payload);
      console.log("[AdminDepartamentos] Crear departamento:", buildDepartmentPayload(payload));
    } else {
      const index = state.items.findIndex((item) => item.id === state.drawer.selectedId);
      if (index !== -1) {
        state.items[index] = {
          ...state.items[index],
          ...payload,
        };
      }
      console.log("[AdminDepartamentos] Editar departamento:", buildDepartmentPayload(payload));
    }

    applyDerivedLabels();
    applyFilters();
    closeDrawer();
  }

  function buildDepartmentPayload(draft) {
    return {
      nombre: String(draft.nombre || "").trim(),
      descripcion: String(draft.descripcion || "").trim(),
      director: Number(draft.director),
      primera_linea: Number(draft.primera_linea),
      status: Number(draft.status ?? 1),
    };
  }

  function handleDeleteDepartment() {
    const index = state.items.findIndex((item) => item.id === state.drawer.selectedId);
    if (index === -1) return;

    state.items[index].status = 0;
    console.log(
      "[AdminDepartamentos] Eliminar departamento (soft delete):",
      state.items[index]
    );

    applyFilters();
    closeDrawer();
  }

  function refreshView(keepFocus = true) {
    applyFilters();
    const root = document.querySelector("#admin-view-root");
    if (!root) return;

    const active = keepFocus ? document.activeElement : null;
    const focusMeta =
      active && active.dataset
        ? {
          field: active.dataset.field || null,
          id: active.id || null,
          selectionStart:
            typeof active.selectionStart === "number" ? active.selectionStart : null,
          selectionEnd:
            typeof active.selectionEnd === "number" ? active.selectionEnd : null,
        }
        : null;

    root.innerHTML = render();
    bind();

    if (!keepFocus || !focusMeta) return;

    let next = null;
    if (focusMeta.field) {
      next = root.querySelector(`.js-drawer-input[data-field="${focusMeta.field}"]`);
    } else if (focusMeta.id) {
      next = root.querySelector(`#${focusMeta.id}`);
    }

    if (next) {
      next.focus({ preventScroll: true });
      if (
        typeof next.setSelectionRange === "function" &&
        focusMeta.selectionStart !== null &&
        focusMeta.selectionEnd !== null
      ) {
        next.setSelectionRange(focusMeta.selectionStart, focusMeta.selectionEnd);
      }
    }
  }

  function validateDrawer() {
    const draft = state.drawer.draft || {};
    const errors = {};

    if (!String(draft.nombre || "").trim()) {
      errors.nombre = "El nombre del departamento es obligatorio.";
    }

    if (!String(draft.descripcion || "").trim()) {
      errors.descripcion = "La descripción es obligatoria.";
    }

    if (!Number(draft.director)) {
      errors.director = "Debes seleccionar un director.";
    }

    if (!Number(draft.primera_linea)) {
      errors.primera_linea = "Debes seleccionar una primera línea.";
    }

    state.drawer.errors = errors;
    return errors;
  }

  function isDrawerValid() {
    return Object.keys(state.drawer.errors || {}).length === 0;
  }

  function hasDrawerChanges() {
    if (!state.drawer.draft || !state.drawer.original) return false;
    return JSON.stringify(state.drawer.draft) !== JSON.stringify(state.drawer.original);
  }

  function focusDrawerField() {
    const root = document.querySelector("#admin-view-root");
    if (!root) return;

    const target = root.querySelector('.js-drawer-input[data-field="nombre"]');
    if (target) target.focus();
  }

  function getStatusMeta(status) {
    if (Number(status) === 1) {
      return { label: "Activo", key: "activo" };
    }
    return { label: "Inactivo", key: "inactivo" };
  }

  function getActiveEmployeesSorted() {
    return state.employees
      .filter((emp) => Number(emp.status) === 1)
      .sort((a, b) =>
        getEmployeeFullName(a).localeCompare(getEmployeeFullName(b), "es")
      );
  }

  function getEmployeeById(id) {
    return state.employees.find((emp) => Number(emp.id) === Number(id)) || null;
  }

  function getEmployeeFullName(emp) {
    return `${emp?.nombre || ""} ${emp?.apellidos || ""}`.trim();
  }

  function getEmployeeFullNameById(id) {
    const emp = getEmployeeById(id);
    return emp ? getEmployeeFullName(emp) : "";
  }

  function getEmployeeLabelById(id) {
    const emp = getEmployeeById(id);
    if (!emp) return "";
    return getEmployeeFullName(emp);
  }

  function getNextId() {
    return state.items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
  }

  function truncate(text, max = 120) {
    const value = String(text || "").trim();
    if (value.length <= max) return value;
    return `${value.slice(0, max).trim()}...`;
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }

  window.AdminDepartamentos = {
    init,
    render,
    bind,
  };
})();
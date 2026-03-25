(() => {
  const state = {
    items: [],
    filteredItems: [],
    query: "",
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
      id: 1,
      nombre: "Presidencia",
      descripcion:
        "Coordinación general de la administración pública municipal y seguimiento de asuntos estratégicos.",
      director: 101,
      primera_linea: 201,
      status: 1,
      created_at: "2026-03-20 10:20:00",
      updated_at: "2026-03-20 12:00:00",
      created_by: 1,
      updated_by: 1,
      director_nombre: "Juan",
      director_apellidos: "Pérez López",
      primera_nombre: "María",
      primera_apellidos: "Gómez Ruiz",
      imagen: "/ASSETS/main_logo_shield.png",
    },
    {
      id: 2,
      nombre: "Obras Públicas",
      descripcion:
        "Gestión de proyectos de infraestructura, mantenimiento urbano y supervisión de obra pública.",
      director: 102,
      primera_linea: 202,
      status: 1,
      created_at: "2026-03-20 10:20:00",
      updated_at: "2026-03-20 12:00:00",
      created_by: 1,
      updated_by: 1,
      director_nombre: "Carlos",
      director_apellidos: "Sánchez Díaz",
      primera_nombre: "Ana",
      primera_apellidos: "Torres Vega",
      imagen: "/ASSETS/main_logo_shield.png",
    },
    {
      id: 3,
      nombre: "Servicios Públicos",
      descripcion:
        "Atención de alumbrado, limpia, parques y jardines, así como operación de servicios municipales.",
      director: 103,
      primera_linea: 203,
      status: 0,
      created_at: "2026-03-20 10:20:00",
      updated_at: "2026-03-20 12:00:00",
      created_by: 1,
      updated_by: 1,
      director_nombre: "Luis",
      director_apellidos: "Hernández Cruz",
      primera_nombre: "Patricia",
      primera_apellidos: "Ramírez Solís",
      imagen: "/ASSETS/main_logo_shield.png",
    },
  ];

  function init() {
    state.items = clone(MOCK_DEPARTAMENTOS);
    applyFilters();
  }

  function applyFilters() {
    const q = String(state.query || "").trim().toLowerCase();

    let base = state.items.filter((item) => Number(item.status) === 1);

    if (q) {
      base = base.filter((item) => {
        return [
          item.nombre,
          item.descripcion,
          item.director_nombre,
          item.director_apellidos,
          item.primera_nombre,
          item.primera_apellidos,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
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
              <span aria-hidden="true">🔍</span>
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
              <h3 class="admin-drawer__title" id="admin-departamentos-drawer-title">${escapeHtml(
      titleText
    )}</h3>
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
                class="admin-drawer__textarea js-drawer-input ${errors.descripcion ? "is-error" : ""
      }"
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
                  <div class="admin-drawer__readonly-pill">
                    ${escapeHtml(statusLabel)}
                  </div>
                `
      }
            </label>

            <div class="admin-drawer__grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <label class="admin-drawer__field">
                <span class="admin-drawer__label">Director nombre</span>
                <input
                  type="text"
                  class="admin-drawer__input js-drawer-input"
                  data-field="director_nombre"
                  value="${escapeAttr(item.director_nombre || "")}"
                  ${isEdit ? "" : "readonly"}
                />
              </label>

              <label class="admin-drawer__field">
                <span class="admin-drawer__label">Director apellidos</span>
                <input
                  type="text"
                  class="admin-drawer__input js-drawer-input"
                  data-field="director_apellidos"
                  value="${escapeAttr(item.director_apellidos || "")}"
                  ${isEdit ? "" : "readonly"}
                />
              </label>

              <label class="admin-drawer__field">
                <span class="admin-drawer__label">Primera línea nombre</span>
                <input
                  type="text"
                  class="admin-drawer__input js-drawer-input"
                  data-field="primera_nombre"
                  value="${escapeAttr(item.primera_nombre || "")}"
                  ${isEdit ? "" : "readonly"}
                />
              </label>

              <label class="admin-drawer__field">
                <span class="admin-drawer__label">Primera línea apellidos</span>
                <input
                  type="text"
                  class="admin-drawer__input js-drawer-input"
                  data-field="primera_apellidos"
                  value="${escapeAttr(item.primera_apellidos || "")}"
                  ${isEdit ? "" : "readonly"}
                />
              </label>
            </div>

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
        state.drawer.draft[key] = key === "status" ? Number(value) : value;

        validateDrawer();

        if (key === "status") {
          refreshView();
        } else {
          syncDrawerUi(root);
        }
      });
    });
  }

  function openDrawer(item) {
    state.drawer.isOpen = true;
    state.drawer.mode = "view";
    state.drawer.selectedId = item.id;
    state.drawer.original = clone(item);
    state.drawer.draft = clone(item);
    state.drawer.confirmDelete = false;
    state.drawer.errors = {};
    refreshView();
  }

  function openCreateDrawer() {
    const nextId = getNextId();
    const blank = {
      id: nextId,
      nombre: "",
      descripcion: "",
      director: null,
      primera_linea: null,
      status: 1,
      created_at: "",
      updated_at: "",
      created_by: null,
      updated_by: null,
      director_nombre: "",
      director_apellidos: "",
      primera_nombre: "",
      primera_apellidos: "",
      imagen: "/ASSETS/main_logo_shield.png",
    };

    state.drawer.isOpen = true;
    state.drawer.mode = "create";
    state.drawer.selectedId = nextId;
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
      console.log("[AdminDepartamentos] Crear departamento:", payload);
    } else {
      const index = state.items.findIndex((item) => item.id === state.drawer.selectedId);
      if (index !== -1) {
        state.items[index] = {
          ...state.items[index],
          ...payload,
        };
      }
      console.log("[AdminDepartamentos] Editar departamento:", payload);
    }

    applyFilters();
    closeDrawer();
  }

  function handleDeleteDepartment() {
    const index = state.items.findIndex((item) => item.id === state.drawer.selectedId);
    if (index === -1) return;

    state.items[index].status = 0;
    console.log("[AdminDepartamentos] Eliminar departamento (soft delete):", state.items[index]);

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
(() => {
  const state = {
    items: [],
    filteredItems: [],
    query: "",
    activeDepartamentoId: 0,
    departamentos: [],
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

  function init() {
    loadMock();
    buildDepartamentos();
    applyFilters();
  }

  function loadMock() {
    state.items = [
      {
        id: 68,
        departamento_id: 5,
        nombre: "Otros",
        descripcion:
          "¿Desea reportar otra situación relacionada con temas ambientales o de salud pública? Favor de indicar la ubicación exacta y describir detalladamente el caso para canalizarlo al área correspondiente.",
        estatus: 1,
        departamento_nombre: "Ecología",
        imagen: "/ASSETS/main_logo_shield.png",
      },
      {
        id: 67,
        departamento_id: 5,
        nombre: "Contaminación de basura",
        descripcion:
          "¿Desea reportar contaminación por acumulación de basura? Favor de indicar la ubicación exacta y describir la situación (tiraderos clandestinos, residuos en vía pública, malos olores).",
        estatus: 1,
        departamento_nombre: "Ecología",
        imagen: "/ASSETS/main_logo_shield.png",
      },
      {
        id: 66,
        departamento_id: 5,
        nombre: "Contaminación auditiva",
        descripcion:
          "¿Desea reportar contaminación auditiva? Favor de indicar la ubicación exacta, horarios en que ocurre y describir la situación (música a alto volumen, maquinaria, eventos).",
        estatus: 1,
        departamento_nombre: "Ecología",
        imagen: "/ASSETS/main_logo_shield.png",
      },
      {
        id: 65,
        departamento_id: 5,
        nombre: "Quema en vía pública",
        descripcion:
          "¿Desea reportar quema en la vía pública? Favor de indicar la ubicación exacta y describir la situación (tipo de material, frecuencia, afectación por humo).",
        estatus: 1,
        departamento_nombre: "Ecología",
        imagen: "/ASSETS/main_logo_shield.png",
      },
      {
        id: 64,
        departamento_id: 5,
        nombre: "Contaminación por aguas residuales",
        descripcion:
          "¿Desea reportar contaminación por aguas residuales? Favor de indicar la ubicación exacta y describir la situación (escurrimientos, malos olores, afectación a la vía pública o domicilios).",
        estatus: 1,
        departamento_nombre: "Ecología",
        imagen: "/ASSETS/main_logo_shield.png",
      },
      {
        id: 63,
        departamento_id: 5,
        nombre: "Problemas de higiene con vecinos",
        descripcion:
          "¿Desea reportar problemas de higiene con vecinos? Favor de indicar la ubicación exacta y describir la situación (acumulación de basura, malos olores u otras condiciones insalubres).",
        estatus: 1,
        departamento_nombre: "Ecología",
        imagen: "/ASSETS/main_logo_shield.png",
      },
      {
        id: 62,
        departamento_id: 5,
        nombre: "Problemas de higiene por animales",
        descripcion:
          "¿Desea reportar problemas de higiene ocasionados por animales? Favor de indicar la ubicación exacta y describir la situación (acumulación de heces, malos olores, animales en la vía pública).",
        estatus: 1,
        departamento_nombre: "Ecología",
        imagen: "/ASSETS/main_logo_shield.png",
      },
      {
        id: 60,
        departamento_id: 8,
        nombre: "Poda preventiva cerca de alumbrado",
        descripcion:
          "¿Desea solicitar poda preventiva de árboles cercanos a alumbrado público? Favor de indicar la ubicación exacta y describir la situación (ramas en contacto con luminarias o cableado).",
        estatus: 1,
        departamento_nombre: "Parques y Jardines",
        imagen: "/ASSETS/main_logo_shield.png",
      },
      {
        id: 57,
        departamento_id: 8,
        nombre: "Poda de árboles preventiva",
        descripcion:
          "¿Desea solicitar poda preventiva de árboles? Favor de indicar la ubicación exacta y describir la situación (ramas en riesgo, cercanía a cables, afectación a paso peatonal o vial) para programar la revisión correspondiente.",
        estatus: 1,
        departamento_nombre: "Parques y Jardines",
        imagen: "/ASSETS/main_logo_shield.png",
      },
      {
        id: 58,
        departamento_id: 8,
        nombre: "Tala de árbol",
        descripcion:
          "¿Desea solicitar la tala de un árbol? Favor de indicar la ubicación exacta y describir los motivos (riesgo de caída, daño a infraestructura, árbol seco o enfermo) para iniciar la evaluación correspondiente.",
        estatus: 1,
        departamento_nombre: "Parques y Jardines",
        imagen: "/ASSETS/main_logo_shield.png",
      },
      {
        id: 59,
        departamento_id: 8,
        nombre: "Limpiar predios",
        descripcion:
          "¿Desea solicitar la limpieza de un predio? Favor de indicar la ubicación exacta y describir la situación (acumulación de basura, maleza, escombros).",
        estatus: 1,
        departamento_nombre: "Parques y Jardines",
        imagen: "/ASSETS/main_logo_shield.png",
      },
      {
        id: 61,
        departamento_id: 8,
        nombre: "Otro",
        descripcion:
          "¿Desea solicitar poda preventiva de árboles cercanos a alumbrado público? Favor de indicar la ubicación exacta y describir la situación (ramas en contacto con luminarias o cableado).",
        estatus: 1,
        departamento_nombre: "Parques y Jardines",
        imagen: "/ASSETS/main_logo_shield.png",
      },
      {
        id: 56,
        departamento_id: 4,
        nombre: "Otros",
        descripcion:
          "¿Desea reportar otra situación relacionada con el servicio de alumbrado público? Favor de indicar la ubicación exacta y describir detalladamente el caso para canalizarlo al área correspondiente.",
        estatus: 1,
        departamento_nombre: "Alumbrado Público",
        imagen: "/ASSETS/main_logo_shield.png",
      },
      {
        id: 55,
        departamento_id: 4,
        nombre: "Baja presión de agua",
        descripcion:
          "¿Experimentas baja presión? Indica ubicación y detalles; daremos seguimiento para mejorar el servicio.",
        estatus: 1,
        departamento_nombre: "Alumbrado Público",
        imagen: "/ASSETS/main_logo_shield.png",
      },
      {
        id: 54,
        departamento_id: 1,
        nombre: "Fuga de agua",
        descripcion:
          "¿Observaste una fuga de agua? Reporta ubicación y detalles; nos contactaremos para atenderla a la brevedad.",
        estatus: 1,
        departamento_nombre: "SAMAPA",
        imagen: "/ASSETS/main_logo_shield.png",
      },
      {
        id: 53,
        departamento_id: 1,
        nombre: "Fuga de drenaje",
        descripcion:
          "¿Detectaste una fuga de drenaje? Informa ubicación y detalles; tu reporte será atendido a la brevedad.",
        estatus: 1,
        departamento_nombre: "SAMAPA",
        imagen: "/ASSETS/main_logo_shield.png",
      },
      {
        id: 52,
        departamento_id: 1,
        nombre: "No disponemos de agua",
        descripcion:
          "¿No dispones de agua? Indícanos ubicación y detalles; daremos seguimiento para restablecer el servicio.",
        estatus: 1,
        departamento_nombre: "SAMAPA",
        imagen: "/ASSETS/main_logo_shield.png",
      },
    ];
  }

  function buildDepartamentos() {
    const map = new Map();

    state.items.forEach((item) => {
      if (!map.has(item.departamento_id)) {
        map.set(item.departamento_id, {
          id: item.departamento_id,
          nombre: item.departamento_nombre || `Departamento ${item.departamento_id}`,
          imagen: "/ASSETS/main_logo_shield.png",
        });
      }
    });

    state.departamentos = Array.from(map.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es")
    );
  }

  function applyFilters() {
    const q = String(state.query || "").trim().toLowerCase();

    state.filteredItems = state.items.filter((item) => {
      if (Number(item.status) === 0) return false;

      const matchesDept =
        state.activeDepartamentoId === 0 ||
        Number(item.departamento_id) === Number(state.activeDepartamentoId);

      if (!matchesDept) return false;
      if (!q) return true;

      return (
        String(item.id || "").includes(q) ||
        String(item.nombre || "").toLowerCase().includes(q) ||
        String(item.descripcion || "").toLowerCase().includes(q) ||
        String(item.departamento_nombre || "").toLowerCase().includes(q)
      );
    });
  }

  function renderDeptFilters() {
    const allClass = state.activeDepartamentoId === 0 ? "is-active" : "";

    return `
      <div class="admin-tramites__deptbar">
        <button
          type="button"
          class="admin-tramites__deptchip ${allClass}"
          data-dept-id="0"
        >
          <span class="admin-tramites__deptchip-label">Todos</span>
        </button>

        ${state.departamentos
        .map((dept) => {
          const activeClass =
            Number(state.activeDepartamentoId) === Number(dept.id) ? "is-active" : "";

          return `
              <button
                type="button"
                class="admin-tramites__deptchip ${activeClass}"
                data-dept-id="${dept.id}"
                title="${escapeHtml(dept.nombre)}"
              >
                <span class="admin-tramites__deptchip-img">
                  <img src="${escapeHtml(dept.imagen)}" alt="${escapeHtml(dept.nombre)}" />
                </span>
                <span class="admin-tramites__deptchip-label">${escapeHtml(dept.nombre)}</span>
              </button>
            `;
        })
        .join("")}
      </div>
    `;
  }

  function renderRows() {
    if (!state.filteredItems.length) {
      return `
        <tr>
          <td colspan="5">
            <div class="muted">No se encontraron tipos de trámite.</div>
          </td>
        </tr>
      `;
    }

    return state.filteredItems
      .map((item) => {
        const status = getStatusMeta(item.estatus);

        return `
          <tr data-id="${item.id}">
            <td>
              <strong>${escapeHtml(item.nombre)}</strong>
            </td>

            <td title="${escapeHtml(item.descripcion)}">
              ${escapeHtml(truncate(item.descripcion, 125))}
            </td>

            <td>
              <img
                src="${escapeHtml(item.imagen || "/ASSETS/main_logo_shield.png")}"
                alt="${escapeHtml(item.nombre)}"
                style="width:56px;height:40px;object-fit:cover;display:block;margin:auto;border-radius:4px;"
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
                class="hs-btn js-edit-tramite"
                data-id="${item.id}"
              >
                Editar Tipo de trámite
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
          id="admin-tramites-drawer-overlay"
          aria-hidden="true"
        ></div>
      `;
    }

    const isEdit = mode === "edit" || mode === "create";
    const isCreate = mode === "create";
    const titleText = isCreate
      ? "Nuevo tipo de trámite"
      : isEdit
        ? "Editar tipo de trámite"
        : "Detalle de tipo de trámite";

    const errors = state.drawer.errors || {};
    const drawerStatusLabel = Number(item.estatus) === 1 ? "Activo" : "Inactivo";
    const saveDisabled = isCreate
      ? !isDrawerValid()
      : !(isDrawerValid() && hasDrawerChanges());

    return `
      <div
        class="admin-drawer-overlay is-open"
        id="admin-tramites-drawer-overlay"
        aria-hidden="false"
      >
        <aside
          class="admin-drawer admin-drawer--right is-open"
          id="admin-tramites-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-tramites-drawer-title"
        >
          <div class="admin-drawer__head">
            <div>
              <h3 class="admin-drawer__title" id="admin-tramites-drawer-title">
                ${escapeHtml(titleText)}
              </h3>
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
              <span class="admin-drawer__label">Departamento</span>
              ${isEdit
        ? `
                  <select class="admin-drawer__select js-drawer-input" data-field="departamento_id">
                    ${state.departamentos
          .map(
            (dept) => `
                      <option
                        value="${dept.id}"
                        ${Number(item.departamento_id) === Number(dept.id) ? "selected" : ""}
                      >
                        ${escapeHtml(dept.nombre)}
                      </option>
                    `
          )
          .join("")}
                  </select>
                `
        : `
                  <div class="admin-drawer__readonly-pill">
                    ${escapeHtml(item.departamento_nombre || "Sin departamento")}
                  </div>
                `
      }
            </label>

            <label class="admin-drawer__field">
              <span class="admin-drawer__label">Estado</span>
              ${isEdit
        ? `
                  <select class="admin-drawer__select js-drawer-input" data-field="estatus">
                    <option value="1" ${Number(item.estatus) === 1 ? "selected" : ""}>Activo</option>
                    <option value="0" ${Number(item.estatus) === 0 ? "selected" : ""}>Inactivo</option>
                  </select>
                `
        : `
                  <div class="admin-drawer__readonly-pill">
                    ${escapeHtml(drawerStatusLabel)}
                  </div>
                `
      }
            </label>

            ${state.drawer.confirmDelete && !isCreate
        ? `
                <div class="admin-drawer__confirm">
                  <p class="admin-drawer__confirm-text">
                    ¿Seguro que deseas eliminar este tipo de trámite? Se ocultará del listado mock y se marcará con status 0.
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
          Guardar tipo de trámite
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

  function render() {
    return `
      <section class="admin-module admin-module--tramites">
        <div class="admin-module__head">
          <div class="admin-module__titlebox">
            <h2 class="admin-module__title">Gestión de Tipo de trámite</h2>
          </div>

          <div class="admin-module__toolbar">
            <label class="search" aria-label="Buscar tipo de trámite">
              <span aria-hidden="true">🔍</span>
              <input
                id="admin-tramites-search"
                type="search"
                placeholder="Buscar Tipo de trámite"
                value="${escapeHtml(state.query)}"
              />
            </label>

            <button
              type="button"
              class="hs-btn"
              id="btn-add-tramite"
            >
              + Agregar Tipo de trámite
            </button>
          </div>
        </div>

        <div class="admin-module__body">
          ${renderDeptFilters()}

          <div class="hs-table table-wrap">
            <table class="gc">
              <thead>
                <tr>
                  <th>Tipo de trámite</th>
                  <th>Descripción</th>
                  <th>imagen</th>
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

  function bind() {
    const root = document.querySelector("#admin-view-root");
    if (!root) return;

    const inputSearch = root.querySelector("#admin-tramites-search");
    const btnAdd = root.querySelector("#btn-add-tramite");

    if (inputSearch) {
      inputSearch.addEventListener("input", (e) => {
        state.query = e.target.value || "";
        refreshView();
      });
    }

    if (btnAdd) {
      btnAdd.addEventListener("click", openCreateDrawer);
    }

    root.querySelectorAll(".admin-tramites__deptchip").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeDepartamentoId = Number(btn.dataset.deptId || 0);
        refreshView();
      });
    });

    root.querySelectorAll(".js-edit-tramite").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const item = state.items.find((t) => t.id === id);
        if (!item) return;
        openDrawer(item);
      });
    });

    bindDrawer(root);
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

  function bindDrawer(root) {
    const overlay = root.querySelector("#admin-tramites-drawer-overlay");

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
      btnConfirmDelete.addEventListener("click", handleDeleteTramite);
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
      btnSave.addEventListener("click", handleSaveTramite);
    }

    root.querySelectorAll(".js-drawer-input").forEach((field) => {
      const eventName = field.tagName === "SELECT" ? "change" : "input";

      field.addEventListener(eventName, (e) => {
        const key = e.target.dataset.field;
        if (!key || !state.drawer.draft) return;

        const value = e.target.value;

        if (key === "estatus" || key === "departamento_id") {
          state.drawer.draft[key] = Number(value);
        } else {
          state.drawer.draft[key] = value;
        }

        if (key === "departamento_id") {
          const selectedDept = state.departamentos.find(
            (dept) => Number(dept.id) === Number(state.drawer.draft.departamento_id)
          );

          state.drawer.draft.departamento_nombre = selectedDept
            ? selectedDept.nombre
            : "";
        }

        validateDrawer();

        if (key === "departamento_id" || key === "estatus") {
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
    const defaultDept = state.departamentos[0] || {
      id: 0,
      nombre: "",
    };

    const blank = {
      id: getNextId(),
      departamento_id: Number(defaultDept.id) || 0,
      departamento_nombre: defaultDept.nombre || "",
      nombre: "",
      descripcion: "",
      estatus: 1,
      status: 1,
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

  function handleSaveTramite() {
    validateDrawer();
    if (!isDrawerValid()) {
      refreshView();
      focusDrawerField();
      return;
    }

    const payload = clone(state.drawer.draft);
    payload.status = Number(payload.estatus) === 0 ? 0 : 1;

    if (state.drawer.mode === "create") {
      payload.id = getNextId();
      state.items.unshift(payload);
      console.log("[AdminTramites] Crear tipo de trámite:", payload);
    } else {
      const index = state.items.findIndex((item) => item.id === state.drawer.selectedId);
      if (index !== -1) {
        state.items[index] = {
          ...state.items[index],
          ...payload,
        };
      }
      console.log("[AdminTramites] Editar tipo de trámite:", payload);
    }

    buildDepartamentos();
    applyFilters();
    closeDrawer();
  }

  function handleDeleteTramite() {
    const index = state.items.findIndex((item) => item.id === state.drawer.selectedId);
    if (index === -1) return;

    state.items[index].status = 0;
    state.items[index].estatus = 0;

    console.log("[AdminTramites] Eliminar tipo de trámite (soft delete):", state.items[index]);

    buildDepartamentos();
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
      errors.nombre = "El nombre del trámite es obligatorio.";
    } else if (String(draft.nombre || "").trim().length < 3) {
      errors.nombre = "El nombre debe tener al menos 3 caracteres.";
    }

    if (!String(draft.descripcion || "").trim()) {
      errors.descripcion = "La descripción es obligatoria.";
    } else if (String(draft.descripcion || "").trim().length < 10) {
      errors.descripcion = "La descripción debe tener al menos 10 caracteres.";
    }

    if (!Number(draft.departamento_id)) {
      errors.departamento_id = "Debes seleccionar un departamento.";
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

  function getStatusMeta(estatus) {
    if (Number(estatus) === 1) {
      return { label: "Activo", key: "activo" };
    }
    return { label: "Inactivo", key: "inactivo" };
  }

  function getNextId() {
    return state.items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
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

  function truncate(text, max = 110) {
    const value = String(text || "").trim();
    if (value.length <= max) return value;
    return `${value.slice(0, max).trim()}...`;
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  window.AdminTramites = {
    init,
    render,
    bind,
  };
})();
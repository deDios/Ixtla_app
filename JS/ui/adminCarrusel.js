(function () {
  "use strict";

  const state = {
    allItems: [],
    items: [],
    page: 1,
    limit: 4,
    total: 0,
    totalPages: 1,

    drawer: {
      isOpen: false,
      mode: "view", // view | edit | create
      selectedId: null,
      draft: null,
      original: null,
      confirmDelete: false,
    },
  };

  /* =========================================================
     INIT
     ========================================================= */
  function init() {

    if (!state.allItems.length) {
      state.allItems = buildMockItems();
    }

    loadMockPage(1);
  }

  function loadMockPage(page = 1) {
    const visibleItems = state.allItems.filter(
      (item) => Number(item.status ?? 1) !== 0
    );

    state.total = visibleItems.length;
    state.totalPages = Math.max(1, Math.ceil(state.total / state.limit));
    state.page = clamp(page, 1, state.totalPages);

    const start = (state.page - 1) * state.limit;
    const end = start + state.limit;
    state.items = visibleItems.slice(start, end);
  }

  function buildMockItems() {
    return [
      {
        id: 101,
        titulo: "¡Buenas noticias!",
        pie_pagina: "Para Capilla del Refugio y Residencial La Capilla.",
        descripcion:
          "Entregamos un nuevo pozo de agua que beneficiará a más de 6,000 habitantes, abatidiendo el rezago en el suministro del vital líquido.\n\nSeguimos trabajando con compromiso para llevar bienestar y servicios dignos a todas las comunidades de Ixtlahuacán de los Membrillos.",
        imagen: "/ASSETS/index/img1.png",
        estatus: 1,
        status: 1,
      },
      {
        id: 102,
        titulo: "Rehabilitación de vialidades",
        pie_pagina: "22 de julio del 2025",
        descripcion:
          "Estamos rehabilitando con asfalto las principales vialidades en la zona de la carretera estatal a La Capilla del Refugio, así como en las colonias Valle de los Olivos, Sabinos y Girasoles.",
        imagen: "/ASSETS/index/img2.png",
        estatus: 1,
        status: 1,
      },
      {
        id: 103,
        titulo: "Nueva jornada de limpieza",
        pie_pagina: "Comunidad activa",
        descripcion:
          "Seguimos trabajando en la limpieza de espacios públicos.",
        imagen: "",
        estatus: 1,
        status: 1,
      },
      {
        id: 104,
        titulo: "Programa de reforestación",
        pie_pagina: "Medio ambiente",
        descripcion:
          "Iniciamos una nueva etapa del programa de reforestación con especies adecuadas para las distintas zonas del municipio.",
        imagen: "",
        estatus: 0,
        status: 1,
      },
      {
        id: 105,
        titulo: "Rescate de espacios deportivos",
        pie_pagina: "Juventud y deporte",
        descripcion:
          "Estamos rehabilitando canchas y espacios recreativos para impulsar la convivencia y el deporte en nuestras comunidades.",
        imagen: "/ASSETS/noticia/NoticiasImg/noticia_img1_2.png",
        estatus: 1,
        status: 1,
      },
      {
        id: 106,
        titulo: "Mejoras en alumbrado público",
        pie_pagina: "Servicios públicos",
        descripcion:
          "Se realizaron trabajos de reposición y mantenimiento de luminarias en distintas colonias del municipio.",
        imagen: "",
        estatus: 1,
        status: 1,
      },
    ];
  }

  /* =========================================================
     RENDER
     ========================================================= */
  function render() {
    return `
      <section class="admin-module admin-module--carrusel">
        <div class="admin-module__head">
          <div class="admin-module__titlebox">
            <h2 class="admin-module__title">Gestión de carrusel de noticias.</h2>
            <p class="admin-module__subtitle">modulo de carrusel, si sale esto no trono.</p>
          </div>
        </div>

        <div class="admin-module__body">
          <div class="admin-carousel">
            <div class="admin-carousel__grid">
              ${renderCards()}
            </div>

            ${renderPagination()}

            <button
              type="button"
              class="admin-carousel-fab"
              id="btn-add-carrusel"
              aria-label="Agregar noticia"
              title="Agregar noticia"
            >
              <span class="admin-carousel-fab__icon">+</span>
              <span class="admin-carousel-fab__tooltip">Agregar noticia</span>
            </button>
          </div>
        </div>
      </section>

      ${renderDrawer()}
    `;
  }

  function renderCards() {
    if (!state.items.length) {
      return `
        <div class="admin-placeholder">
          <div class="admin-placeholder__inner">
            <h3 class="admin-placeholder__title">No hay noticias en el carrusel</h3>
            <p class="admin-placeholder__text">
              Cuando existan registros, aparecerán aquí.
            </p>
          </div>
        </div>
      `;
    }

    return state.items
      .map((item) => {
        const statusLabel = Number(item.estatus) === 1 ? "Activo" : "Inactivo";
        const checked = Number(item.estatus) === 1 ? "checked" : "";

        return `
          <article
            class="admin-carousel-card admin-carousel-card--readonly js-carrusel-card"
            data-id="${item.id}"
            role="button"
            tabindex="0"
            aria-label="Abrir noticia ${escapeHtml(item.titulo)}"
          >
            <div class="admin-carousel-card__head">
              <h3 class="admin-carousel-card__title">${escapeHtml(item.titulo || "Título")}</h3>

              <div class="admin-carousel-card__actions">
                <span class="admin-carousel-card__status-label">${statusLabel}</span>

                <label class="admin-switch" title="Cambiar estatus">
                  <input
                    type="checkbox"
                    class="js-toggle-status"
                    data-id="${item.id}"
                    ${checked}
                  />
                  <span class="admin-switch__track">
                    <span class="admin-switch__text admin-switch__text--off"></span>
                    <span class="admin-switch__text admin-switch__text--on"></span>
                    <span class="admin-switch__thumb"></span>
                  </span>
                </label>
              </div>
            </div>

            <div class="admin-carousel-card__top">
              <div class="admin-carousel-card__image-wrap ${!item.imagen ? "is-empty" : ""}">
                ${item.imagen
            ? `<img src="${escapeHtml(item.imagen)}" alt="${escapeHtml(item.titulo)}" class="admin-carousel-card__image" />`
            : `<span class="admin-carousel-card__image-placeholder">🖼️</span>`
          }
              </div>

              <div class="admin-carousel-card__fields">
                <div class="admin-carousel-field">
                  <span class="admin-carousel-field__label">Título</span>
                  <div class="admin-carousel-field__readonly">
                    ${escapeHtml(item.titulo || "Título")}
                  </div>
                </div>

                <div class="admin-carousel-field">
                  <span class="admin-carousel-field__label">Pie de pagina</span>
                  <div class="admin-carousel-field__readonly">
                    ${escapeHtml(item.pie_pagina || "Pie de pagina")}
                  </div>
                </div>
              </div>
            </div>

            <div class="admin-carousel-field admin-carousel-field--full">
              <span class="admin-carousel-field__label">Descripción</span>
              <div class="admin-carousel-field__readonly admin-carousel-field__readonly--textarea">
                ${formatText(item.descripcion || "Descripción")}
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderPagination() {
    if (state.totalPages <= 1) return "";

    const pages = buildPagination(state.page, state.totalPages);

    return `
      <div class="admin-pagination">
        <div class="admin-pagination__info">
          Mostrando ${state.items.length} de ${state.total} noticias
        </div>

        <div class="admin-pagination__controls">
          <button
            type="button"
            class="admin-pagination__btn"
            data-page="${state.page - 1}"
            ${state.page <= 1 ? "disabled" : ""}
          >
            ‹
          </button>

          ${pages
        .map((p) => {
          if (p === "...") {
            return `<span class="admin-pagination__dots">...</span>`;
          }

          return `
                <button
                  type="button"
                  class="admin-pagination__page ${p === state.page ? "is-active" : ""}"
                  data-page="${p}"
                >
                  ${p}
                </button>
              `;
        })
        .join("")}

          <button
            type="button"
            class="admin-pagination__btn"
            data-page="${state.page + 1}"
            ${state.page >= state.totalPages ? "disabled" : ""}
          >
            ›
          </button>
        </div>
      </div>
    `;
  }

  function renderDrawer() {
    const isOpen = state.drawer.isOpen;
    const mode = state.drawer.mode;
    const item = state.drawer.draft;

    if (!isOpen || !item) {
      return `
        <div
          class="admin-drawer-overlay"
          id="admin-carrusel-drawer-overlay"
          aria-hidden="true"
        ></div>
      `;
    }

    const isEdit = mode === "edit" || mode === "create";
    const isCreate = mode === "create";
    const titleText = isCreate
      ? "Nueva noticia"
      : isEdit
        ? "Editar noticia"
        : "Detalle de noticia";

    const drawerStatusLabel = Number(item.estatus) === 1 ? "Activo" : "Inactivo";

    return `
      <div
        class="admin-drawer-overlay is-open"
        id="admin-carrusel-drawer-overlay"
        aria-hidden="false"
      >
        <aside
          class="admin-drawer admin-drawer--right is-open"
          id="admin-carrusel-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-carrusel-drawer-title"
        >
          <div class="admin-drawer__head">
            <div>
              <h3 class="admin-drawer__title" id="admin-carrusel-drawer-title">${escapeHtml(titleText)}</h3>
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
        ? `<img src="${escapeHtml(item.imagen)}" alt="${escapeHtml(item.titulo || "Vista previa")}" class="admin-drawer__image" />`
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
              <span class="admin-drawer__label">Título</span>
              <input
                type="text"
                class="admin-drawer__input js-drawer-input"
                data-field="titulo"
                value="${escapeAttr(item.titulo || "")}"
                ${isEdit ? "" : "readonly"}
              />
            </label>

            <label class="admin-drawer__field">
              <span class="admin-drawer__label">Pie de página</span>
              <input
                type="text"
                class="admin-drawer__input js-drawer-input"
                data-field="pie_pagina"
                value="${escapeAttr(item.pie_pagina || "")}"
                ${isEdit ? "" : "readonly"}
              />
            </label>

            <label class="admin-drawer__field">
              <span class="admin-drawer__label">Descripción</span>
              <textarea
                class="admin-drawer__textarea js-drawer-input"
                data-field="descripcion"
                ${isEdit ? "" : "readonly"}
              >${escapeHtml(item.descripcion || "")}</textarea>
            </label>

            <label class="admin-drawer__field">
              <span class="admin-drawer__label">Estado</span>
              ${isEdit
        ? `
                    <select
                      class="admin-drawer__select js-drawer-input"
                      data-field="estatus"
                    >
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
                      ¿Seguro que deseas eliminar esta noticia? Se ocultará del listado mock y se marcará con status 0.
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
            ${renderDrawerFooterButtons()}
          </div>
        </aside>
      </div>
    `;
  }

  function renderDrawerFooterButtons() {
    const mode = state.drawer.mode;
    const isCreate = mode === "create";
    const isEdit = mode === "edit";

    if (isCreate) {
      return `
        <button type="button" class="admin-drawer__primary-btn js-save-drawer">
          Guardar noticia
        </button>
        <button type="button" class="admin-drawer__secondary-btn js-cancel-edit">
          Cancelar
        </button>
      `;
    }

    if (isEdit) {
      return `
        <button type="button" class="admin-drawer__primary-btn js-save-drawer">
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

  /* =========================================================
     BIND
     ========================================================= */
  function bind() {
    const root = document.querySelector("#admin-view-root");
    if (!root) return;

    root.querySelectorAll(".js-carrusel-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (
          e.target.closest(".js-toggle-status") ||
          e.target.closest(".admin-switch")
        ) {
          return;
        }

        const id = Number(card.dataset.id);
        const item = state.allItems.find((x) => x.id === id);
        openDrawer(item);
      });

      card.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();

        const id = Number(card.dataset.id);
        const item = state.allItems.find((x) => x.id === id);
        openDrawer(item);
      });
    });

    root.querySelectorAll(".js-toggle-status").forEach((input) => {
      input.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      input.addEventListener("change", (e) => {
        const id = Number(e.target.dataset.id);
        const item = state.allItems.find((x) => x.id === id);
        if (!item) return;

        item.estatus = e.target.checked ? 1 : 0;
        refreshView();

        console.log("[AdminCarrusel] Cambiar estatus:", item);
      });
    });

    root.querySelectorAll("[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const page = Number(btn.dataset.page);
        if (!page || page < 1 || page > state.totalPages) return;

        loadMockPage(page);
        root.innerHTML = render();
        bind();
      });
    });

    const btnAdd = root.querySelector("#btn-add-carrusel");
    if (btnAdd) {
      btnAdd.addEventListener("click", () => {
        openCreateDrawer();
      });
    }

    bindDrawer(root);
  }

  function bindDrawer(root) {
    const overlay = root.querySelector("#admin-carrusel-drawer-overlay");
    const drawer = root.querySelector("#admin-carrusel-drawer");

    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          closeDrawer();
        }
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
        refreshView();
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
      btnConfirmDelete.addEventListener("click", () => {
        deleteCurrentItem();
      });
    }

    const btnCancelEdit = root.querySelector(".js-cancel-edit");
    if (btnCancelEdit) {
      btnCancelEdit.addEventListener("click", () => {
        cancelDrawerEdition();
      });
    }

    const btnSave = root.querySelector(".js-save-drawer");
    if (btnSave) {
      btnSave.addEventListener("click", () => {
        saveDrawer();
      });
    }

    if (drawer) {
      drawer.querySelectorAll(".js-drawer-input").forEach((input) => {
        input.addEventListener("input", onDrawerFieldChange);
        input.addEventListener("change", onDrawerFieldChange);
      });
    }
  }

  function onDrawerFieldChange(e) {
    const field = e.target.dataset.field;
    if (!field || !state.drawer.draft) return;

    let value = e.target.value;

    if (field === "estatus") {
      value = Number(value);
    }

    state.drawer.draft[field] = value;
  }

  /* =========================================================
     DRAWER ACTIONS
     ========================================================= */
  function openDrawer(item) {
    if (!item) return;

    state.drawer.isOpen = true;
    state.drawer.mode = "view";
    state.drawer.selectedId = Number(item.id);
    state.drawer.original = cloneItem(item);
    state.drawer.draft = cloneItem(item);
    state.drawer.confirmDelete = false;

    refreshView();
  }

  function openCreateDrawer() {
    const newItem = {
      id: getNextId(),
      titulo: "",
      pie_pagina: "",
      descripcion: "",
      imagen: "",
      estatus: 1,
      status: 1,
    };

    state.drawer.isOpen = true;
    state.drawer.mode = "create";
    state.drawer.selectedId = null;
    state.drawer.original = null;
    state.drawer.draft = newItem;
    state.drawer.confirmDelete = false;

    refreshView();
  }

  function closeDrawer() {
    state.drawer.isOpen = false;
    state.drawer.mode = "view";
    state.drawer.selectedId = null;
    state.drawer.original = null;
    state.drawer.draft = null;
    state.drawer.confirmDelete = false;

    refreshView();
  }

  function cancelDrawerEdition() {
    if (state.drawer.mode === "create") {
      closeDrawer();
      return;
    }

    state.drawer.mode = "view";
    state.drawer.confirmDelete = false;
    state.drawer.draft = cloneItem(state.drawer.original);

    refreshView();
  }

  function saveDrawer() {
    const draft = state.drawer.draft;
    if (!draft) return;

    if (!String(draft.titulo || "").trim()) {
      alert("El título es obligatorio.");
      return;
    }

    if (state.drawer.mode === "create") {
      state.allItems.unshift({
        ...cloneItem(draft),
        status: 1,
      });

      closeDrawer();
      loadMockPage(1);
      refreshView();
      return;
    }

    const index = state.allItems.findIndex(
      (item) => Number(item.id) === Number(state.drawer.selectedId)
    );

    if (index === -1) return;

    state.allItems[index] = {
      ...state.allItems[index],
      ...cloneItem(draft),
    };

    state.drawer.original = cloneItem(state.allItems[index]);
    state.drawer.draft = cloneItem(state.allItems[index]);
    state.drawer.mode = "view";
    state.drawer.confirmDelete = false;

    refreshView();

    console.log("[AdminCarrusel] Guardar cambios:", state.allItems[index]);
  }

  function deleteCurrentItem() {
    const id = Number(state.drawer.selectedId);
    const item = state.allItems.find((x) => Number(x.id) === id);
    if (!item) return;

    item.status = 0;

    const visibleAfterDelete = state.allItems.filter(
      (x) => Number(x.status ?? 1) !== 0
    ).length;

    const newTotalPages = Math.max(1, Math.ceil(visibleAfterDelete / state.limit));
    const safePage = clamp(state.page, 1, newTotalPages);

    closeDrawer();
    loadMockPage(safePage);
    refreshView();

    console.log("[AdminCarrusel] Noticia eliminada mock:", item);
  }

  function refreshView() {
    const root = document.querySelector("#admin-view-root");
    if (!root) return;

    loadMockPage(state.page);
    root.innerHTML = render();
    bind();
  }

  /* =========================================================
     UTILS
     ========================================================= */
  function getNextId() {
    const maxId = state.allItems.reduce((max, item) => {
      return Math.max(max, Number(item.id) || 0);
    }, 0);

    return maxId + 1;
  }

  function cloneItem(item) {
    return JSON.parse(JSON.stringify(item));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function buildPagination(current, total) {
    const pages = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
      return pages;
    }

    pages.push(1);

    if (current > 3) pages.push("...");

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (current < total - 2) pages.push("...");

    pages.push(total);

    return pages;
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
    return escapeHtml(value).replaceAll("\n", "&#10;");
  }

  function formatText(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  window.AdminCarrusel = {
    init,
    render,
    bind,
  };
})();
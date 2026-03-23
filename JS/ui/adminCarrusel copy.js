(function () {
  const state = {
    allItems: [],
    items: [],
    page: 1,
    limit: 4,
    total: 0,
    totalPages: 1,
  };

  /* =========================================================
     INIT
     ========================================================= */
  function init() {
    loadMockPage(1);
  }

  function loadMockPage(page = 1) {
    state.allItems = buildMockItems();
    state.total = state.allItems.length;
    state.totalPages = Math.max(1, Math.ceil(state.total / state.limit));
    state.page = clamp(page, 1, state.totalPages);

    const start = (state.page - 1) * state.limit;
    const end = start + state.limit;
    state.items = state.allItems.slice(start, end);
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
      },
      {
        id: 102,
        titulo: "Rehabilitación de vialidades",
        pie_pagina: "22 de julio del 2025",
        descripcion:
          "Estamos rehabilitando con asfalto las principales vialidades en la zona de la carretera estatal a La Capilla del Refugio, así como en las colonias Valle de los Olivos, Sabinos y Girasoles.",
        imagen: "/ASSETS/index/img2.png",
        estatus: 1,
      },
      {
        id: 103,
        titulo: "Nueva jornada de limpieza",
        pie_pagina: "Comunidad activa",
        descripcion:
          "Seguimos trabajando en la limpieza de espacios públicos.",
        imagen: "",
        estatus: 1,
      },
      {
        id: 104,
        titulo: "Programa de reforestación",
        pie_pagina: "Medio ambiente",
        descripcion:
          "Iniciamos una nueva etapa del programa de reforestación con especies adecuadas para las distintas zonas del municipio.",
        imagen: "",
        estatus: 0,
      },
      {
        id: 105,
        titulo: "Rescate de espacios deportivos",
        pie_pagina: "Juventud y deporte",
        descripcion:
          "Estamos rehabilitando canchas y espacios recreativos para impulsar la convivencia y el deporte en nuestras comunidades.",
        imagen: "/ASSETS/noticia/NoticiasImg/noticia_img1_2.png",
        estatus: 1,
      },
      {
        id: 106,
        titulo: "Mejoras en alumbrado público",
        pie_pagina: "Servicios públicos",
        descripcion:
          "Se realizaron trabajos de reposición y mantenimiento de luminarias en distintas colonias del municipio.",
        imagen: "",
        estatus: 1,
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
                    <span class="admin-switch__text admin-switch__text--off">OFF</span>
                    <span class="admin-switch__text admin-switch__text--on">ON</span>
                    <span class="admin-switch__thumb"></span>
                  </span>
                </label>

                <button
                  type="button"
                  class="admin-carousel-card__icon-btn js-delete-carrusel"
                  data-id="${item.id}"
                  aria-label="Eliminar noticia"
                  title="Eliminar noticia"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v8h-2V9zm4 0h2v8h-2V9zM7 9h2v8H7V9zm-1 11h12a2 2 0 0 0 2-2V7H4v11a2 2 0 0 0 2 2z"/>
                  </svg>
                </button>
              </div>
            </div>

            <div class="admin-carousel-card__top">
              <div class="admin-carousel-card__image-wrap ${!item.imagen ? "is-empty" : ""}">
                ${
                  item.imagen
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
          e.target.closest(".js-delete-carrusel") ||
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
        loadMockPage(state.page);
        root.innerHTML = render();
        bind();

        console.log("[AdminCarrusel] Cambiar estatus:", item);
      });
    });

    root.querySelectorAll(".js-delete-carrusel").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();

        const id = Number(btn.dataset.id);
        const item = state.allItems.find((x) => x.id === id);
        console.log("[AdminCarrusel] Eliminar noticia:", item);
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
        console.log("[AdminCarrusel] Agregar noticia");
        openDrawer(null);
      });
    }
  }

  /* =========================================================
     PLACEHOLDERS
     ========================================================= */
  function openDrawer(item) {
    console.log("[AdminCarrusel] Abrir drawer:", item);
  }

  /* =========================================================
     UTILS
     ========================================================= */
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

  function formatText(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  window.AdminCarrusel = {
    init,
    render,
    bind,
  };
})();
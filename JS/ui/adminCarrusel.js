(function (window, document) {
  "use strict";

  const DEFAULT_LIMIT = 6;

  const state = {
    page: 1,
    limit: DEFAULT_LIMIT,
    total: 0,
    totalPages: 1,
    items: [],
  };

  const mockResponse = {
    ok: true,
    page: 1,
    limit: 6,
    total: 14,
    total_pages: 3,
    data: [
      {
        id: 101,
        titulo: "¡Buenas noticias!",
        pie_pagina: "",
        descripcion:
          "Para Capilla del Refugio y Residencial La Capilla.\n\nEntregamos un nuevo pozo de agua que beneficiará a más de 6,000 habitantes, abatidiendo el rezago en el suministro del vital líquido.\n\nSeguimos trabajando con compromiso para llevar bienestar y servicios dignos a todas las comunidades de Ixtlahuacán de los Membrillos.",
        imagen: "/ASSETS/index/img1.png",
        estatus: 1,
        status: 1,
        created_at: "2026-03-20 10:20:00",
        updated_at: "2026-03-20 12:00:00",
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
        created_at: "2026-03-19 09:10:00",
        updated_at: "2026-03-20 10:15:00",
      },
      {
        id: 103,
        titulo: "Título",
        pie_pagina: "",
        descripcion: "",
        estatus: 1,
        status: 1,
        created_at: "2026-03-18 08:00:00",
        updated_at: "2026-03-18 08:30:00",
      },
      {
        id: 104,
        titulo: "Nueva jornada de limpieza",
        pie_pagina: "Comunidad activa",
        descripcion: "Seguimos trabajando en la limpieza de espacios públicos.",
        estatus: 1,
        status: 1,
        created_at: "2026-03-17 08:00:00",
        updated_at: "2026-03-17 08:30:00",
      },
      {
        id: 105,
        titulo: "Apoyo social",
        pie_pagina: "Atención ciudadana",
        descripcion: "Se entregaron apoyos a familias del municipio.",
        estatus: 1,
        status: 1,
        created_at: "2026-03-16 08:00:00",
        updated_at: "2026-03-16 08:30:00",
      },
      {
        id: 106,
        titulo: "Mejora de alumbrado",
        pie_pagina: "",
        descripcion: "Se reemplazaron luminarias en distintos puntos del municipio.",
        estatus: 1,
        status: 1,
        created_at: "2026-03-15 08:00:00",
        updated_at: "2026-03-15 08:30:00",
      },
      {
        id: 107,
        titulo: "Mantenimiento urbano",
        pie_pagina: "Zona centro",
        descripcion: "Se realizaron trabajos de mantenimiento en la plaza principal.",
        estatus: 0,
        status: 1,
        created_at: "2026-03-14 08:00:00",
        updated_at: "2026-03-14 08:30:00",
      },
      {
        id: 108,
        titulo: "Brigada de salud",
        pie_pagina: "Participación comunitaria",
        descripcion: "Se atendió a vecinos mediante una brigada médica municipal.",
        estatus: 1,
        status: 1,
        created_at: "2026-03-13 08:00:00",
        updated_at: "2026-03-13 08:30:00",
      },
      {
        id: 109,
        titulo: "Capacitación ciudadana",
        pie_pagina: "",
        descripcion: "Se impartieron talleres de orientación comunitaria.",
        estatus: 1,
        status: 1,
        created_at: "2026-03-12 08:00:00",
        updated_at: "2026-03-12 08:30:00",
      },
      {
        id: 110,
        titulo: "Supervisión de obra",
        pie_pagina: "Seguimiento",
        descripcion: "Avanza la supervisión de obras públicas prioritarias.",
        estatus: 1,
        status: 1,
        created_at: "2026-03-11 08:00:00",
        updated_at: "2026-03-11 08:30:00",
      },
      {
        id: 111,
        titulo: "Atención a reportes",
        pie_pagina: "",
        descripcion: "Se dio seguimiento a reportes ciudadanos recientes.",
        estatus: 1,
        status: 1,
        created_at: "2026-03-10 08:00:00",
        updated_at: "2026-03-10 08:30:00",
      },
      {
        id: 112,
        titulo: "Jornada de reforestación",
        pie_pagina: "Medio ambiente",
        descripcion: "Se plantaron árboles en distintas zonas del municipio.",
        estatus: 1,
        status: 1,
        created_at: "2026-03-09 08:00:00",
        updated_at: "2026-03-09 08:30:00",
      },
      {
        id: 113,
        titulo: "Recuperación de espacios",
        pie_pagina: "",
        descripcion: "Trabajamos en la recuperación de áreas comunitarias.",
        estatus: 1,
        status: 1,
        created_at: "2026-03-08 08:00:00",
        updated_at: "2026-03-08 08:30:00",
      },
      {
        id: 114,
        titulo: "Infraestructura básica",
        pie_pagina: "Servicios municipales",
        descripcion: "Continúan acciones de mejora en infraestructura básica.",
        estatus: 1,
        status: 1,
        created_at: "2026-03-07 08:00:00",
        updated_at: "2026-03-07 08:30:00",
      },
    ],
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatTextAreaValue(value) {
    return escapeHtml(value ?? "");
  }

  function normalizeSlide(raw) {
    return {
      id: Number(raw?.id ?? 0),
      titulo: String(raw?.titulo ?? ""),
      pie: String(raw?.pie_pagina ?? raw?.pie ?? ""),
      descripcion: String(raw?.descripcion ?? ""),
      imagen: String(raw?.imagen ?? ""),
      activo: Number(raw?.estatus ?? 0) === 1,
      estatus: Number(raw?.estatus ?? 0),
      status: Number(raw?.status ?? 1),
      createdAt: String(raw?.created_at ?? ""),
      updatedAt: String(raw?.updated_at ?? ""),
    };
  }

  function setPagination(meta) {
    state.page = Number(meta?.page) || 1;
    state.limit = Number(meta?.limit) || DEFAULT_LIMIT;
    state.total = Number(meta?.total) || 0;
    state.totalPages = Number(meta?.total_pages) || 1;
  }

  function loadMockPage(page) {
    const allItems = Array.isArray(mockResponse.data) ? mockResponse.data : [];
    const total = allItems.length;
    const totalPages = Math.max(1, Math.ceil(total / state.limit));
    const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const start = (safePage - 1) * state.limit;
    const end = start + state.limit;
    const items = allItems.slice(start, end).map(normalizeSlide);

    setPagination({
      page: safePage,
      limit: state.limit,
      total,
      total_pages: totalPages,
    });

    state.items = items;
  }

  async function fetchCarruselPage(page) {
    // Aquí luego irá el fetch real al endpoint.
    // Ejemplo futuro:
    // const res = await fetch(`/db/web/c_noticia_admin.php?page=${page}&limit=${state.limit}`);
    // const json = await res.json();
    // setPagination(json);
    // state.items = (json.data || []).map(normalizeSlide);

    loadMockPage(page);
  }

  function buildImageMarkup(slide) {
    if (slide.imagen) {
      return `
        <div class="admin-carousel-card__image-wrap">
          <img
            src="${escapeHtml(slide.imagen)}"
            alt="${escapeHtml(slide.titulo || "Noticia")}"
            class="admin-carousel-card__image"
          />
        </div>
      `;
    }

    return `
      <div class="admin-carousel-card__image-wrap is-empty">
        <div class="admin-carousel-card__image-placeholder">🖼️</div>
      </div>
    `;
  }

  function buildCard(slide) {
    const statusLabel = slide.activo ? "Activo" : "Inactivo";

    return `
      <article class="admin-carousel-card hs-card" data-slide-id="${slide.id}">
        <header class="admin-carousel-card__head">
          <h2 class="admin-carousel-card__title">${escapeHtml(slide.titulo || "Sin título")}</h2>

          <div class="admin-carousel-card__actions">
            <span class="admin-carousel-card__status-label">${escapeHtml(statusLabel)}</span>

            <label class="admin-switch" aria-label="Cambiar estado de ${escapeHtml(slide.titulo || "noticia")}">
              <input type="checkbox" ${slide.activo ? "checked" : ""} data-admin-switch="${slide.id}">
              <span class="admin-switch__track">
                <span class="admin-switch__text admin-switch__text--off"></span>
                <span class="admin-switch__text admin-switch__text--on"></span>
                <span class="admin-switch__thumb"></span>
              </span>
            </label>

            <button
              type="button"
              class="admin-carousel-card__icon-btn"
              title="Eliminar elemento"
              aria-label="Eliminar elemento"
              data-admin-delete="${slide.id}"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM6 9h2v9H6V9z"></path>
              </svg>
            </button>
          </div>
        </header>

        <div class="admin-carousel-card__top">
          ${buildImageMarkup(slide)}

          <div class="admin-carousel-card__fields">
            <label class="admin-carousel-field">
              <span class="admin-carousel-field__label">Título</span>
              <input
                type="text"
                value="${escapeHtml(slide.titulo)}"
                placeholder="Título"
                data-admin-field="titulo"
                data-slide-id="${slide.id}"
              >
            </label>

            <label class="admin-carousel-field">
              <span class="admin-carousel-field__label">Pie de pagina</span>
              <input
                type="text"
                value="${escapeHtml(slide.pie)}"
                placeholder="Pie de pagina"
                data-admin-field="pie"
                data-slide-id="${slide.id}"
              >
            </label>
          </div>
        </div>

        <label class="admin-carousel-field admin-carousel-field--full">
          <span class="admin-carousel-field__label">Descripción</span>
          <textarea
            placeholder="Descripción"
            data-admin-field="descripcion"
            data-slide-id="${slide.id}"
          >${formatTextAreaValue(slide.descripcion)}</textarea>
        </label>
      </article>
    `;
  }

  function buildPageNumbers() {
    const current = state.page;
    const totalPages = state.totalPages;
    const pages = [];

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i += 1) pages.push(i);
      return pages;
    }

    pages.push(1);

    if (current > 3) pages.push("dots-left");

    const start = Math.max(2, current - 1);
    const end = Math.min(totalPages - 1, current + 1);

    for (let i = start; i <= end; i += 1) {
      pages.push(i);
    }

    if (current < totalPages - 2) pages.push("dots-right");

    pages.push(totalPages);

    return [...new Set(pages)];
  }

  function buildPagination() {
    const from = state.total === 0 ? 0 : (state.page - 1) * state.limit + 1;
    const to = Math.min(state.page * state.limit, state.total);
    const pageItems = buildPageNumbers();

    return `
      <div class="admin-pagination" aria-label="Paginación de noticias">
        <div class="admin-pagination__info">
          Mostrando ${from}-${to} de ${state.total} noticias
        </div>

        <div class="admin-pagination__controls">
          <button
            type="button"
            class="admin-pagination__btn"
            data-admin-page-prev
            ${state.page <= 1 ? "disabled" : ""}
          >
            Anterior
          </button>

          ${pageItems
        .map((item) => {
          if (String(item).startsWith("dots")) {
            return `<span class="admin-pagination__dots">…</span>`;
          }

          const isActive = Number(item) === state.page;

          return `
                <button
                  type="button"
                  class="admin-pagination__page ${isActive ? "is-active" : ""}"
                  data-admin-page="${item}"
                  ${isActive ? 'aria-current="page"' : ""}
                >
                  ${item}
                </button>
              `;
        })
        .join("")}

          <button
            type="button"
            class="admin-pagination__btn"
            data-admin-page-next
            ${state.page >= state.totalPages ? "disabled" : ""}
          >
            Siguiente
          </button>
        </div>
      </div>
    `;
  }

  function render() {
    return `
      <section class="admin-module admin-module--carrusel">
        <header class="admin-module__head">
          <div class="admin-module__titlebox">
            <h1 class="admin-module__title">Gestión de carrusel de noticias.</h1>
            <p class="admin-module__subtitle">
              modulo de carrusel, si sale esto no trono.
            </p>
          </div>
        </header>

        <div class="admin-module__body">
          <div class="admin-carousel">
            <div class="admin-carousel__grid">
              ${state.items.map(buildCard).join("")}
            </div>

            ${buildPagination()}

            <button
              type="button"
              class="admin-carousel-fab"
              data-admin-action="nuevo-carrusel"
              aria-label="Agregar nueva noticia"
            >
              <span class="admin-carousel-fab__icon">+</span>
              <span class="admin-carousel-fab__tooltip">Agregar nueva noticia</span>
            </button>
          </div>
        </div>
      </section>
    `;
  }

  function bindSwitches(scope) {
    const switches = scope.querySelectorAll("[data-admin-switch]");

    switches.forEach((input) => {
      input.addEventListener("change", function () {
        const slideId = Number(this.getAttribute("data-admin-switch"));
        const slide = state.items.find((item) => item.id === slideId);

        if (slide) {
          slide.activo = this.checked;
          slide.estatus = this.checked ? 1 : 0;
        }

        const card = this.closest(".admin-carousel-card");
        const label = card?.querySelector(".admin-carousel-card__status-label");
        if (label) {
          label.textContent = this.checked ? "Activo" : "Inactivo";
        }

        console.log("[adminCarrusel] switch toggle:", {
          slideId,
          activo: this.checked,
        });
      });
    });
  }

  function bindDeleteButtons(scope) {
    const buttons = scope.querySelectorAll("[data-admin-delete]");

    buttons.forEach((button) => {
      button.addEventListener("click", function () {
        const slideId = Number(this.getAttribute("data-admin-delete"));
        console.log("[adminCarrusel] eliminar slide:", { slideId });
      });
    });
  }

  function bindInputs(scope) {
    const fields = scope.querySelectorAll("[data-admin-field]");

    fields.forEach((field) => {
      field.addEventListener("input", function () {
        const slideId = Number(this.getAttribute("data-slide-id"));
        const fieldName = this.getAttribute("data-admin-field");
        const slide = state.items.find((item) => item.id === slideId);

        if (slide) {
          if (fieldName === "titulo") slide.titulo = this.value;
          if (fieldName === "pie") slide.pie = this.value;
          if (fieldName === "descripcion") slide.descripcion = this.value;
        }

        if (fieldName === "titulo") {
          const card = this.closest(".admin-carousel-card");
          const title = card?.querySelector(".admin-carousel-card__title");
          if (title) {
            title.textContent = this.value.trim() || "Sin título";
          }
        }

        console.log("[adminCarrusel] campo actualizado:", {
          slideId,
          field: fieldName,
          value: this.value,
        });
      });
    });
  }

  function bindAddButton(scope) {
    const button = scope.querySelector('[data-admin-action="nuevo-carrusel"]');
    if (!button) return;

    button.addEventListener("click", function () {
      console.log("[adminCarrusel] agregar nueva noticia");
    });
  }

  async function goToPage(page) {
    const nextPage = Number(page);
    if (!Number.isFinite(nextPage)) return;
    if (nextPage < 1 || nextPage > state.totalPages) return;
    if (nextPage === state.page) return;

    await fetchCarruselPage(nextPage);

    const root = document.getElementById("admin-view-root");
    if (!root) return;

    root.innerHTML = render();
    bind();

    const top = root.getBoundingClientRect().top + window.scrollY - 120;
    window.scrollTo({ top, behavior: "smooth" });
  }

  function bindPagination(scope) {
    const prevBtn = scope.querySelector("[data-admin-page-prev]");
    const nextBtn = scope.querySelector("[data-admin-page-next]");
    const pageButtons = scope.querySelectorAll("[data-admin-page]");

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        goToPage(state.page - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        goToPage(state.page + 1);
      });
    }

    pageButtons.forEach((button) => {
      button.addEventListener("click", function () {
        goToPage(this.getAttribute("data-admin-page"));
      });
    });
  }

  function bind() {
    const scope = document.querySelector(".admin-module--carrusel");
    if (!scope) return;

    bindSwitches(scope);
    bindDeleteButtons(scope);
    bindInputs(scope);
    bindAddButton(scope);
    bindPagination(scope);
  }

  async function init() {
    await fetchCarruselPage(state.page);
  }

  window.AdminCarrusel = {
    init,
    render,
    bind,
    state,
  };
})(window, document);
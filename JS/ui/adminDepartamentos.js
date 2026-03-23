(function () {
  const state = {
    items: [],
    filteredItems: [],
    query: "",
  };

  function init() {
    loadMock();
    applyFilters();
  }

  function loadMock() {
    state.items = [
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
        status: 1,
        director_nombre: "Juan",
        director_apellidos: "Pérez García",
        primera_nombre: "Carlos",
        primera_apellidos: "Ramírez Soto",
        imagen: "/ASSETS/main_logo_shield.png",
      },
      {
        id: 2,
        nombre: "Aseo Público",
        descripcion:
          "Atención a reportes relacionados con la recolección de residuos, barrido, limpieza de espacios públicos y mantenimiento general.",
        status: 1,
        director_nombre: "María",
        director_apellidos: "López Núñez",
        primera_nombre: "Andrea",
        primera_apellidos: "Torres Díaz",
        imagen: "/ASSETS/main_logo_shield.png",
      },
      {
        id: 3,
        nombre: "Obras Públicas",
        descripcion:
          "Área encargada de planear, ejecutar y dar mantenimiento a la infraestructura urbana, así como coordinar los servicios públicos.",
        status: 1,
        director_nombre: "Luis",
        director_apellidos: "Hernández Ruiz",
        primera_nombre: "Pedro",
        primera_apellidos: "Mora Sánchez",
        imagen: "/ASSETS/main_logo_shield.png",
      },
      {
        id: 4,
        nombre: "Alumbrado Público",
        descripcion:
          "Atención y mantenimiento del alumbrado público, reparación de luminarias y administración de la red de servicios urbanos.",
        status: 1,
        director_nombre: "Sofía",
        director_apellidos: "Castillo Vega",
        primera_nombre: "Iván",
        primera_apellidos: "Ríos Lara",
        imagen: "/ASSETS/main_logo_shield.png",
      },
      {
        id: 6,
        nombre: "Padrón y Licencias",
        descripcion:
          "Atención a reportes y trámites relacionados con padrón y licencias comerciales, con el fin de dar seguimiento y brindar respuesta.",
        status: 1,
        director_nombre: "Ana",
        director_apellidos: "Gutiérrez Salas",
        primera_nombre: "Rubén",
        primera_apellidos: "Navarro Gil",
        imagen: "/ASSETS/main_logo_shield.png",
      },
    ];
  }

  function applyFilters() {
    const q = state.query.trim().toLowerCase();

    if (!q) {
      state.filteredItems = [...state.items];
      return;
    }

    state.filteredItems = state.items.filter((item) => {
      const director = `${item.director_nombre || ""} ${item.director_apellidos || ""}`.trim();
      const primera = `${item.primera_nombre || ""} ${item.primera_apellidos || ""}`.trim();

      return (
        String(item.id || "").includes(q) ||
        String(item.nombre || "").toLowerCase().includes(q) ||
        String(item.descripcion || "").toLowerCase().includes(q) ||
        director.toLowerCase().includes(q) ||
        primera.toLowerCase().includes(q)
      );
    });
  }

  function getStatusMeta(status) {
    if (Number(status) === 1) {
      return { label: "Activo", key: "activo" };
    }
    return { label: "Inactivo", key: "inactivo" };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function truncate(text, max = 120) {
    const value = String(text || "").trim();
    if (value.length <= max) return value;
    return `${value.slice(0, max).trim()}...`;
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
        applyFilters();
        root.innerHTML = render();
        bind();
      });
    }

    if (btnAdd) {
      btnAdd.addEventListener("click", () => {
        console.log("[AdminDepartamentos] Agregar departamento");
      });
    }

    root.querySelectorAll(".js-edit-departamento").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const item = state.items.find((d) => d.id === id);
        console.log("[AdminDepartamentos] Editar departamento:", item);
      });
    });
  }

  window.AdminDepartamentos = {
    init,
    render,
    bind,
  };
})();
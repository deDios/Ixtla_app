(function () {
  const state = {
    items: [],
    filteredItems: [],
    query: "",
    activeDepartamentoId: 0,
    departamentos: [],
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
    const q = state.query.trim().toLowerCase();

    state.filteredItems = state.items.filter((item) => {
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

  function getStatusMeta(estatus) {
    if (Number(estatus) === 1) {
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

  function truncate(text, max = 110) {
    const value = String(text || "").trim();
    if (value.length <= max) return value;
    return `${value.slice(0, max).trim()}...`;
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
        applyFilters();
        root.innerHTML = render();
        bind();
      });
    }

    if (btnAdd) {
      btnAdd.addEventListener("click", () => {
        console.log("[AdminTramites] Agregar tipo de trámite");
      });
    }

    root.querySelectorAll(".admin-tramites__deptchip").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeDepartamentoId = Number(btn.dataset.deptId || 0);
        applyFilters();
        root.innerHTML = render();
        bind();
      });
    });

    root.querySelectorAll(".js-edit-tramite").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const item = state.items.find((t) => t.id === id);
        console.log("[AdminTramites] Editar tipo de trámite:", item);
      });
    });
  }

  window.AdminTramites = {
    init,
    render,
    bind,
  };
})();
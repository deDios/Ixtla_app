(function (window, document) {
    //JS/ui/adminDepartamentos.js
  "use strict";

  function render() {
    return `
      <section class="admin-module admin-module--departamentos">
        <header class="admin-module__head">
          <div class="admin-module__titlebox">
            <h1 class="admin-module__title">Gestión de departamentos</h1>
            <p class="admin-module__subtitle">
              Módulo base listo para crecer a tabla, buscador y acciones mock antes de conectar endpoints.
            </p>
          </div>

          <div class="admin-module__toolbar">
            <label class="search" aria-label="Buscar departamento">
              <span>🔎</span>
              <input type="text" placeholder="Buscar departamento">
            </label>

            <button type="button" class="hs-btn hs-btn-new" data-admin-action="nuevo-departamento">
              + Agregar departamento
            </button>
          </div>
        </header>

        <div class="admin-module__body">
          <div class="admin-placeholder hs-card">
            <div class="admin-placeholder__inner">
              <h2 class="admin-placeholder__title">Vista Departamentos montada correctamente</h2>
              <p class="admin-placeholder__text">
                Esta vista ya vive dentro del shell del admin y puede evolucionar a tabla mock sin afectar
                el header, sidebar o footer.
              </p>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function bind() {
    const btnNuevo = document.querySelector('[data-admin-action="nuevo-departamento"]');
    if (!btnNuevo) return;

    btnNuevo.addEventListener("click", function () {
      console.log("[adminDepartamentos] Click en agregar departamento");
    });
  }

  window.AdminDepartamentos = {
    render,
    bind,
  };
})(window, document);
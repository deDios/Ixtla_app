(function (window, document) {
    //JS/ui/adminTramites.js
  "use strict";

  function render() {
    return `
      <section class="admin-module admin-module--tramites">
        <header class="admin-module__head">
          <div class="admin-module__titlebox">
            <h1 class="admin-module__title">Gestión de tipos de trámite</h1>
            <p class="admin-module__subtitle">
              Base visual preparada para filtros, tarjetas superiores y tabla mock en la siguiente fase.
            </p>
          </div>

          <div class="admin-module__toolbar">
            <label class="search" aria-label="Buscar trámite">
              <span>🔎</span>
              <input type="text" placeholder="Buscar tipo de trámite">
            </label>

            <button type="button" class="hs-btn hs-btn-new" data-admin-action="nuevo-tramite">
              + Agregar trámite
            </button>
          </div>
        </header>

        <div class="admin-module__body">
          <div class="admin-placeholder hs-card">
            <div class="admin-placeholder__inner">
              <h2 class="admin-placeholder__title">Vista Tipo de trámite montada correctamente</h2>
              <p class="admin-placeholder__text">
                El contenedor ya está listo para que en la siguiente iteración armemos el mock real del módulo,
                con una estructura consistente respecto a los demás layouts.
              </p>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function bind() {
    const btnNuevo = document.querySelector('[data-admin-action="nuevo-tramite"]');
    if (!btnNuevo) return;

    btnNuevo.addEventListener("click", function () {
      console.log("[adminTramites] Click en agregar trámite");
    });
  }

  window.AdminTramites = {
    render,
    bind,
  };
})(window, document);
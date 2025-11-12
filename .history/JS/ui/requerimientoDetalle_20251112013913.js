// /JS/ui/requerimientoDetalle.js
(function () {
  "use strict";

  /* ================= Helpers mínimos ================= */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  // Toast opcional (si existe tu gcToast)
  const toast = (m, t = "info") =>
    (window.gcToast ? gcToast(m, t) : console.log("[toast]", t, m));

  /* =============== Selectores usados en la vista =============== */
  const UI = {
    // Asignado (en la sección Detalles)
    asignadoDisplay: "#req-asignado-display",
    btnAsignar:      "#btn-asignar-req",

    // Modal de asignación
    modal:           "#modal-asignar-req",
    modalClose:      "#modal-asignar-req .modal-close",
    form:            "#form-asignar-req",
    select:          "#sel-asignado-req",
    hintActual:      "#asignar-actual", // opcional; si no existe, se ignora
    btnGuardar:      "#btn-guardar-asignacion",
  };

  /* =============== Abrir / Cerrar modal =============== */
  function openModal(modalSel) {
    const m = $(modalSel);
    if (!m) return;
    m.classList.add("active");           // tu CSS ya soporta .active
    document.body.classList.add("modal-open");
  }
  function closeModal(modalSel) {
    const m = $(modalSel);
    if (!m) return;
    m.classList.remove("active");
    document.body.classList.remove("modal-open");
  }

  /* =============== Modal: Asignar requerimiento =============== */

  // Por si quieres poblar el select desde algún lado:
  // - Si existe window.IxEmpleados (array de {id,nombre}), lo usamos.
  // - Si no, dejamos lo que ya tengas en el HTML.
  function populateSelectResponsables() {
    const sel = $(UI.select);
    if (!sel) return;

    if (Array.isArray(window.IxEmpleados) && window.IxEmpleados.length) {
      // Limpia y arma opciones
      const cur = sel.value;
      sel.innerHTML = `<option value="" disabled selected>Selecciona responsable…</option>`;
      for (const emp of window.IxEmpleados) {
        const opt = document.createElement("option");
        opt.value = emp.id;
        opt.textContent = emp.nombre;
        sel.appendChild(opt);
      }
      // restaura selección si existía
      if (cur) sel.value = cur;
    }
  }

  function openAsignarModal() {
    // Texto actual (lo que se ve al lado del label en Detalles)
    const curName = ($(UI.asignadoDisplay)?.textContent || "Sin asignar").trim();

    // Rellena el hint si está presente
    const hint = $(UI.hintActual);
    if (hint) hint.textContent = `Actual: ${curName}`;

    // Popular el select si procede
    populateSelectResponsables();

    // Enfocar el select
    openModal(UI.modal);
    $(UI.select)?.focus();
  }

  function onSubmitAsignacion(e) {
    e.preventDefault();
    const sel = $(UI.select);
    if (!sel || !sel.value) {
      toast("Selecciona un responsable", "warn");
      sel?.focus();
      return;
    }
    const txt = sel.options[sel.selectedIndex]?.text?.trim() || "—";

    // Actualiza el nombre mostrado en Detalles
    const out = $(UI.asignadoDisplay);
    if (out) out.textContent = txt;

    // Aquí luego pegas el fetch al endpoint real para persistir
    // Ejemplo:
    // fetch('/db/WEB/ixtla01_u_requerimiento_asignado.php', { method:'POST', body:... })

    toast("Responsable actualizado (demo local).", "success");
    closeModal(UI.modal);
  }

  /* =============== Wire-up inicial =============== */
  function wire() {
    on($(UI.btnAsignar), "click", openAsignarModal);
    on($(UI.modalClose), "click", () => closeModal(UI.modal));

    const overlay = $(UI.modal);
    on(overlay, "click", (ev) => {
      if (ev.target === overlay) closeModal(UI.modal);
    });

    on($(UI.form), "submit", onSubmitAsignacion);
  }

  document.addEventListener("DOMContentLoaded", wire);
})();

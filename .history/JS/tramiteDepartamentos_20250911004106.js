











//--------------------------------------------------- modal para SAMAPA
(() => {
  const modal = document.getElementById("ix-report-modal");
  if (!modal) {
    console.warn("[IX] No existe #ix-report-modal, me salgo.");
    return;
  }

  const overlay = modal.querySelector(".ix-modal__overlay");
  const dialog = modal.querySelector(".ix-modal__dialog");
  const btnCloses = modal.querySelectorAll("[data-ix-close]");

  const form = modal.querySelector("#ix-report-form");
  const feedback = modal.querySelector("#ix-report-feedback");

  const inpReq = modal.querySelector("#ix-report-req");
  const subTitle = modal.querySelector("#ix-report-subtitle");
  const timeMeta = modal.querySelector("#ix-report-date");
  const inpFecha = modal.querySelector("#ix-fecha");

  const inpNombre = modal.querySelector("#ix-nombre");
  const inpDom = modal.querySelector("#ix-domicilio");
  const inpCP = modal.querySelector("#ix-cp");
  const inpCol = modal.querySelector("#ix-colonia");
  const inpTel = modal.querySelector("#ix-telefono");
  const inpCorreo = modal.querySelector("#ix-correo");
  const inpDesc = modal.querySelector("#ix-descripcion");
  const cntDesc = modal.querySelector("#ix-desc-count");
  const chkCons = modal.querySelector("#ix-consent");
  const btnSend = modal.querySelector("#ix-submit");

  const upWrap = modal.querySelector(".ix-upload");
  const upInput = modal.querySelector("#ix-evidencia");
  const previews = modal.querySelector("#ix-evidencia-previews");

  const CFG = {
    MAX_FILES: 3,
    MAX_MB: 5, // por archivo
    TYPES: ["image/jpeg", "image/png"],
  };

  // estado interno (para previews y focus)
  let files = []; // File[]
  let openerBtn = null; // elemento que abrió el modal (para devolver foco)
  let trapHandler = null; // keydown handler del focus trap

  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  const pad2 = (n) => String(n).padStart(2, "0");
  const fmtAMPM = (d) => {
    const h = d.getHours(),
      m = d.getMinutes();
    const ampm = h >= 12 ? "pm" : "am";
    const hh = ((h + 11) % 12) + 1;
    return `${hh}:${pad2(m)} ${ampm}`;
  };

  // limpia feedback global
  const clearFeedback = () => {
    feedback.hidden = true;
    feedback.textContent = "";
  };
  const showFeedback = (msg) => {
    feedback.hidden = false;
    feedback.textContent = msg;
  };

  // marcar campo con error (agrega/remueve clase en .ix-field padre)
  const setFieldError = (inputEl, msg = "") => {
    const field = inputEl.closest(".ix-field");
    const help = field?.querySelector(".ix-help");
    if (!field) return;
    if (msg) {
      field.classList.add("ix-field--error");
      if (help) {
        help.hidden = false;
        help.textContent = msg;
      }
    } else {
      field.classList.remove("ix-field--error");
      if (help) {
        help.hidden = true;
        help.textContent = "";
      }
    }
  };

  // valida email muy simple
  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

  // normaliza teléfono y cp (solo dígitos)
  const digits = (s) => (s || "").replace(/\D+/g, "");

  // enable/disable submit según validez general + consentimiento
  const updateSubmitState = () => {
    const valid = validateForm(false);
    btnSend.disabled = !valid;
  };

  // =========================
  // Validaciones
  // =========================
  function validateForm(showErrors = true) {
    let ok = true;

    // nombre: 5+ chars o 2 palabras
    const nombre = (inpNombre.value || "").trim();
    if (!(nombre.length >= 5 || nombre.split(/\s+/).length >= 2)) {
      ok = false;
      if (showErrors) setFieldError(inpNombre, "Ingresa tu nombre completo.");
    } else setFieldError(inpNombre);

    // domicilio
    if (!(inpDom.value || "").trim()) {
      ok = false;
      if (showErrors) setFieldError(inpDom, "El domicilio es obligatorio.");
    } else setFieldError(inpDom);

    // colonia
    if (!(inpCol.value || "").trim()) {
      ok = false;
      if (showErrors) setFieldError(inpCol, "La colonia es obligatoria.");
    } else setFieldError(inpCol);

    // CP: 5 dígitos
    const cp = digits(inpCP.value);
    if (cp.length !== 5) {
      ok = false;
      if (showErrors) setFieldError(inpCP, "C.P. debe tener 5 dígitos.");
    } else setFieldError(inpCP);

    // teléfono: 10 dígitos
    const tel = digits(inpTel.value);
    if (tel.length !== 10) {
      ok = false;
      if (showErrors) setFieldError(inpTel, "Teléfono a 10 dígitos.");
    } else setFieldError(inpTel);

    // correo: opcional, si viene valida
    const mail = (inpCorreo.value || "").trim();
    if (mail && !isEmail(mail)) {
      ok = false;
      if (showErrors) setFieldError(inpCorreo, "Correo no válido.");
    } else setFieldError(inpCorreo);

    // descripción: 30–700
    const desc = (inpDesc.value || "").trim();
    if (desc.length < 30) {
      ok = false;
      if (showErrors)
        setFieldError(inpDesc, "Describe con al menos 30 caracteres.");
    } else setFieldError(inpDesc);

    // consentimiento
    if (!chkCons.checked) ok = false;

    // archivos: máximo 3, tipo y tamaño ok
    if (files.length > CFG.MAX_FILES) ok = false;

    return ok;
  }

  // contador de descripción
  const updateDescCount = () => {
    const len = (inpDesc.value || "").length;
    cntDesc.textContent = String(len);
  };

  // =========================
  // Uploader básico con previews
  // =========================
  function refreshPreviews() {
    previews.innerHTML = "";
    files.forEach((file, idx) => {
      const fig = document.createElement("figure");
      const img = document.createElement("img");
      const btn = document.createElement("button");
      img.src = URL.createObjectURL(file);
      img.alt = file.name;
      btn.type = "button";
      btn.textContent = "×";
      btn.setAttribute("aria-label", "Eliminar imagen");
      btn.addEventListener("click", () => {
        files.splice(idx, 1);
        refreshPreviews();
        updateSubmitState();
      });
      fig.appendChild(img);
      fig.appendChild(btn);
      previews.appendChild(fig);
    });
  }

  function handleFiles(list) {
    const incoming = Array.from(list || []);
    for (const f of incoming) {
      if (!CFG.TYPES.includes(f.type)) {
        showFeedback("Solo se permiten imágenes JPG o PNG.");
        continue;
      }
      if (f.size > CFG.MAX_MB * 1024 * 1024) {
        showFeedback(`Cada archivo debe pesar ≤ ${CFG.MAX_MB} MB.`);
        continue;
      }
      if (files.length >= CFG.MAX_FILES) {
        showFeedback(`Máximo ${CFG.MAX_FILES} imágenes.`);
        break;
      }
      files.push(f);
    }
    refreshPreviews();
    updateSubmitState();
  }

  // abrir el selector cuando se hace click en el área
  upWrap?.addEventListener("click", (e) => {
    // evita que click en el botón de eliminar burbujee
    if (e.target instanceof HTMLElement && e.target.tagName === "BUTTON")
      return;
    upInput?.click();
  });
  upInput?.addEventListener("change", (e) => handleFiles(e.target.files));

  // drag & drop
  ["dragenter", "dragover"].forEach((ev) =>
    upWrap?.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      upWrap.classList.add("is-drag");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    upWrap?.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      upWrap.classList.remove("is-drag");
    })
  );
  upWrap?.addEventListener("drop", (e) =>
    handleFiles(e.dataTransfer?.files || [])
  );

  // =========================
  // Focus trap + open/close
  // =========================
  const getFocusable = () =>
    Array.from(
      dialog.querySelectorAll(
        'a[href],button:not([disabled]),textarea,input:not([disabled]),select,[tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetParent !== null);

  function trap(e) {
    if (e.key !== "Tab") return;
    const list = getFocusable();
    if (!list.length) return;
    const first = list[0],
      last = list[list.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function openModal(
    { title = "Reporte", depKey = "samapa", itemId = "", sla = "" } = {},
    opener = null
  ) {
    openerBtn = opener || document.activeElement;
    // set texts
    subTitle.textContent = title;
    inpReq.value = title;
    clearFeedback();

    // reset form rápido
    form.reset();
    files = [];
    refreshPreviews();
    updateDescCount();
    updateSubmitState();

    // mostrar modal
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    // trap de foco + esc + click overlay
    trapHandler = (e) => {
      if (e.key === "Escape") {
        closeModal();
      } else trap(e);
    };
    document.addEventListener("keydown", trapHandler);
    overlay?.addEventListener("click", closeModal, { once: true });
    btnCloses.forEach((b) =>
      b.addEventListener("click", closeModal, { once: true })
    );

    // enfoque al primer campo
    setTimeout(() => {
      inpNombre.focus();
    }, 0);

    // evento público
    try {
      document.dispatchEvent(
        new CustomEvent("ix:report:open", {
          detail: { depKey, itemId, title, sla },
        })
      );
    } catch { }
  }

  function closeModal() {
    document.removeEventListener("keydown", trapHandler || (() => { }));
    trapHandler = null;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    // devolver foco
    if (openerBtn && typeof openerBtn.focus === "function") {
      openerBtn.focus();
    }
    openerBtn = null;

    // evento público
    try {
      document.dispatchEvent(new CustomEvent("ix:report:close"));
    } catch { }
  }

  // =========================
  // Interacciones del form
  // =========================
  // inputs que refrescan estado de submit y quitan errores en tiempo real
  [
    inpNombre,
    inpDom,
    inpCol,
    inpCP,
    inpTel,
    inpCorreo,
    inpDesc,
    chkCons,
  ].forEach((el) => {
    el?.addEventListener("input", () => {
      // normalizaciones suaves
      if (el === inpCP) el.value = digits(el.value).slice(0, 5);
      if (el === inpTel) el.value = digits(el.value).slice(0, 10);
      if (el === inpDesc) updateDescCount();

      // si el usuario teclea, quita el error visual del campo
      setFieldError(el);
      updateSubmitState();
    });
    el?.addEventListener("blur", () => {
      validateForm(true);
      updateSubmitState();
    });
  });

  // submit (simulado)
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearFeedback();
    if (!validateForm(true)) {
      // enfoca el primer campo con error
      const bad = modal.querySelector(
        ".ix-field.ix-field--error input, .ix-field.ix-field--error textarea"
      );
      bad?.focus();
      return;
    }

    // estado enviando (deshabilita)
    btnSend.disabled = true;
    btnSend.textContent = "Enviando…";
    Array.from(form.elements).forEach(
      (el) => (el.disabled = el === btnSend ? false : true)
    );

    // simulamos latencia
    setTimeout(() => {
      // folio simulado
      const stamp = Date.now() % 1000000;
      const folio = "ID" + String(stamp).padStart(5, "0");

      // guarda para que tu vista de seguimiento lo “rehidrate” fácil
      try {
        sessionStorage.setItem("ix_last_folio", folio);
      } catch { }

      // evento público con payload
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.telefono = digits(payload.telefono || "");
      payload.cp = digits(payload.cp || "");
      payload.folio = folio;
      payload._filesCount = files.length;

      try {
        document.dispatchEvent(
          new CustomEvent("ix:report:submit", { detail: payload })
        );
      } catch { }
      try {
        document.dispatchEvent(
          new CustomEvent("ix:report:success", { detail: { folio } })
        );
      } catch { }

      // toast de éxito (usa gcToast si existe)
      if (window.gcToast) {
        gcToast(`Reporte creado: ${folio}`, "exito", 3000);
      } else {
        alert(`Reporte creado: ${folio}`);
      }

      // reset UI y cerrar
      Array.from(form.elements).forEach((el) => (el.disabled = false));
      btnSend.textContent = "Mandar reporte";
      form.reset();
      files = [];
      refreshPreviews();
      updateDescCount();
      updateSubmitState();
      closeModal();
    }, 800);
  });

  // API pública
  window.ixReportModal = {
    open: (opts = {}, opener) => openModal(opts, opener),
    close: () => closeModal(),
  };

  // TIP: desde tu handler actual de .ix-dep-add, llama:
  //   ixReportModal.open({ title: itemTitle, depKey: btn.dataset.dep, itemId: btn.dataset.id, sla: '24h' }, btn);
})();

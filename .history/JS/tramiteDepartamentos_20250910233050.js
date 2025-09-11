//----------------------------- modulo de departamentos.
document.addEventListener("DOMContentLoaded", () => {
  const wrap = document.querySelector("#tramites .ix-wrap");
  if (!wrap) return;

  const grid = wrap.querySelector(".ix-grid");
  const note = wrap.querySelector(".ix-note");
  const h2 = wrap.querySelector("#deps-title");

  // ---------- Preferencia de vista ----------
  const VIEW_KEY = "ix_deps_view";
  const getView = () => sessionStorage.getItem(VIEW_KEY) || "list"; // 'list' | 'cards'
  const setView = (v) => sessionStorage.setItem(VIEW_KEY, v);

  // Crea el panel si no existe
  let panel = wrap.querySelector(".ix-dep-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.className = "ix-dep-panel view-" + getView();
    panel.hidden = true;
    panel.innerHTML = `
      <div class="ix-dep-toolbar">
        <h2 class="ix-dep-heading">Trámites disponibles</h2>
        <div class="ix-dep-actions">
          <button type="button" class="ix-action ix-action--list" aria-label="Vista de lista" aria-pressed="true">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <polyline points="4,6.5 6,8.5 9.5,4.5" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="12" y1="6.5" x2="20" y2="6.5" stroke-linecap="round"/>
              <polyline points="4,12 6,14 9.5,10" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="12" y1="12" x2="20" y2="12" stroke-linecap="round"/>
              <polyline points="4,17.5 6,19.5 9.5,15.5" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="12" y1="17.5" x2="20" y2="17.5" stroke-linecap="round"/>
            </svg>
          </button>
          <button type="button" class="ix-action ix-action--grid" aria-label="Vista de tarjetas" aria-pressed="false">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5"  y="5"  width="6" height="6" rx="1.2"/>
              <rect x="13" y="5"  width="6" height="6" rx="1.2"/>
              <rect x="5"  y="13" width="6" height="6" rx="1.2"/>
              <rect x="13" y="13" width="6" height="6" rx="1.2"/>
            </svg>
          </button>
        </div>
      </div>
      <ul class="ix-dep-list" id="ix-dep-list"></ul>
      <a class="ix-dep-back" href="/VIEWS/tramiteDepartamento.php">← Ver todos los departamentos</a>
    `;
    wrap.appendChild(panel);
  }

  const listEl = panel.querySelector("#ix-dep-list");
  const btnList = panel.querySelector(".ix-action--list");
  const btnGrid = panel.querySelector(".ix-action--grid");

  // ---------- Catálogo ----------
  const alias = (v) => (v === "simapa" ? "samapa" : v);

  const DEPS = {
    1: {
      name: "SAMAPA",
      title: "Trámites disponibles",
      inactive: false,
      items: [
        {
          id: "fuga-agua",
          title: "Fuga de agua",
          desc: "¿Observaste una fuga de agua? Reporta ubicación y detalles; nos contactaremos para atenderla a la brevedad.",
          icon: "/ASSETS/departamentos/modulosAssets/Simapa/fuga-agua.png",
          photo:
            "/ASSETS/departamentos/modulosAssets/Simapa/fuga-agua_card.png",
          sla: "24h",
        },
        {
          id: "fuga-drenaje",
          title: "Fuga de drenaje",
          desc: "¿Detectaste una fuga de drenaje? Informa ubicación y detalles; tu reporte será atendido a la brevedad.",
          icon: "/ASSETS/departamentos/modulosAssets/Simapa/fuga-drenaje.png",
          photo:
            "/ASSETS/departamentos/modulosAssets/Simapa/fuga-drenaje_card.png",
          sla: "24h",
        },
        {
          id: "sin-agua",
          title: "No disponemos de agua",
          desc: "¿No dispones de agua? Indícanos ubicación y detalles; daremos seguimiento para restablecer el servicio.",
          icon: "/ASSETS/departamentos/modulosAssets/Simapa/sin-agua.png",
          photo: "/ASSETS/departamentos/modulosAssets/Simapa/sin-agua_card.png",
          sla: "24h",
        },
        {
          id: "baja-presion",
          title: "Baja presión de agua",
          desc: "¿Experimentas baja presión? Indica ubicación y detalles; daremos seguimiento para mejorar el servicio.",
          icon: "/ASSETS/departamentos/modulosAssets/Simapa/baja-presion.png",
          photo:
            "/ASSETS/departamentos/modulosAssets/Simapa/baja-presion_card.png",
          sla: "24h",
        },
        {
          id: "otros",
          title: "Otros",
          desc: "¿Otro problema relacionado con el suministro? Compártenos ubicación y detalles para atenderlo.",
          icon: "/ASSETS/departamentos/modulosAssets/Simapa/otros.png",
          photo: "/ASSETS/departamentos/modulosAssets/Simapa/otros_card.png",
          sla: "24h",
        },
      ],
    },
    limpieza: { name: "Recolección y limpieza", inactive: true },
    obras: { name: "Obras y servicios públicos", inactive: true },
    alumbrado: { name: "Alumbrado y energía urbana", inactive: true },
    ambiental: { name: "Gestión ambiental y ecología", inactive: true },
  };

  // ---------- Renderers ----------
  const plusSvg = `
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M12 7v10M7 12h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`.trim();

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  function renderListItem(depKey, it) {
    return el(`
      <li class="ix-dep-item">
        <div class="ix-dep-media">${it.icon
        ? `<img src="${it.icon}" alt="" onerror="this.style.display='none'">`
        : ""
      }</div>
        <div class="ix-dep-content">
          <h3>${it.title}</h3>
          <p>${it.desc || ""}</p>
        </div>
        <button type="button" class="ix-dep-add" data-dep="${depKey}" data-id="${it.id
      }" data-title="${it.title}" aria-label="Iniciar ${it.title}">
          ${plusSvg}
        </button>
      </li>
    `);
  }

  function renderCardItem(depKey, it) {
    return el(`
      <li class="ix-dep-item ix-card">
        <div class="ix-card-img">${it.photo
        ? `<img src="${it.photo}" alt="" onerror="this.parentNode.style.display='none'">`
        : ""
      }</div>
        <div class="ix-card-body">
          <h3 class="ix-card-title">${it.title}</h3>
          <p class="ix-card-desc">${it.desc || ""}</p>
          <div class="ix-card-meta">
            <small>Tiempo aproximado: ${it.sla || "-"}</small>
            <button type="button" class="ix-dep-add ix-card-btn" data-dep="${depKey}" data-id="${it.id
      }" data-title="${it.title}">Crear</button>
          </div>
        </div>
      </li>
    `);
  }

  function renderInactive(depKey, conf) {
    listEl.innerHTML = `
      <li class="ix-dep-empty">
        <p><strong>${conf.name || depKey}</strong>: Módulo inactivo.</p>
        <p>Próximamente estará disponible esta sección.</p>
      </li>
    `;
  }

  function reRender(conf) {
    listEl.innerHTML = "";
    const v = getView(); // 'list' | 'cards'
    const renderer = v === "cards" ? renderCardItem : renderListItem;
    (conf.items || []).forEach((it) =>
      listEl.appendChild(renderer(panel.dataset.dep, it))
    );

    // toggle clases y estado visual de botones
    panel.classList.toggle("view-list", v === "list");
    panel.classList.toggle("view-cards", v === "cards");
    btnList.setAttribute("aria-pressed", String(v === "list"));
    btnGrid.setAttribute("aria-pressed", String(v === "cards"));
  }

  // ---------- Navegación de vista (toolbar) ----------
  btnList.addEventListener("click", () => {
    if (getView() === "list") return;
    setView("list");
    reRender(DEPS[panel.dataset.dep]);
  });
  btnGrid.addEventListener("click", () => {
    if (getView() === "cards") return;
    setView("cards");
    reRender(DEPS[panel.dataset.dep]);
  });

  // ---------- Estados de página ----------
  function showDefault() {
    panel.hidden = true;
    listEl.innerHTML = "";
    note.hidden = false;
    grid.style.display = "";
    h2.textContent = "Selecciona un Departamento";
    document.title = "Trámites / Departamentos";
  }

  function showDep(rawKey) {
    const key = alias((rawKey || "").toLowerCase());
    const conf = DEPS[key];
    if (!conf) return showDefault();

    grid.style.display = "none";
    note.hidden = true;
    panel.hidden = false;
    panel.dataset.dep = key;

    const depName = conf.name || key;
    h2.textContent = `${depName}`;
    panel.querySelector(".ix-dep-heading").textContent =
      conf.title || "Trámites disponibles";
    document.title = `Trámites – ${depName}`;

    if (conf.inactive) {
      renderInactive(key, conf);
      return;
    }
    reRender(conf);
  }

  // Click en “Crear” / “+” aca es donde ira cargando para cada modal
  panel.addEventListener("click", (e) => {
    const btn = e.target.closest(".ix-dep-add");
    if (!btn) return;

    // Dep actual e item seleccionado
    const depKey = panel.dataset.dep;             // ej. "1" (SAMAPA) o "samapa"
    const conf = DEPS[depKey];
    const itemId = btn.dataset.id;                // ej. "fuga-agua"
    const item = (conf?.items || []).find(x => x.id === itemId);

    const title = btn.dataset.title || item?.title || "Trámite";
    const sla = item?.sla || "-";

    // Abre el modal si está cargado; si no, fallback al toast
    if (window.ixReportModal?.open) {
      ixReportModal.open({ title, depKey, itemId, sla }, btn);
    } else {
      window.gcToast
        ? gcToast(`Abrir formulario: ${title}`, "info", 2200)
        : alert(`Abrir formulario: ${title}`);
    }
  });

  // Estado inicial por URL
  //depId=samapa
  const params = new URLSearchParams(window.location.search);
  const depParam = params.get("depId");
  depParam ? showDep(depParam) : showDefault();

  // back/forward (si cambian la URL)
  window.addEventListener("popstate", () => {
    const p = new URLSearchParams(window.location.search).get("dep");
    p ? showDep(p) : showDefault();
  });

  // Ajusta estado visual inicial de los botones según preferencia guardada
  const v = getView();
  btnList.setAttribute("aria-pressed", String(v === "list"));
  btnGrid.setAttribute("aria-pressed", String(v === "cards"));
  panel.classList.toggle("view-list", v === "list");
  panel.classList.toggle("view-cards", v === "cards");
});

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

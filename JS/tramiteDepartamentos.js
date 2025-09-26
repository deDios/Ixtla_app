(() => {
  /* ---------- config ---------- */
  const CFG = {
    // validaciones solo por si acaso
    NAME_MIN_CHARS: 5,
    DESC_MIN_CHARS: 30,
    PHONE_DIGITS: 10,

    // subida de imagenes
    MAX_FILES: 3, // maximo de archivos
    MIN_FILES: 0, // minimo de archivos
    MAX_MB: 20, // limite de tamaño
    ACCEPT_MIME: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ],
    ACCEPT_EXT: [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"],

    // Endpoints
    ENDPOINTS: {
      cpcolonia:
        "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_cpcolonia.php",
      insertReq:
        "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_i_requerimiento.php",
      fsBootstrap:
        "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_u_requerimiento_folders.php",
      uploadImg:
        "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_i_requerimiento_img.php",
    },

    // Timeout fetch
    FETCH_TIMEOUT: 12000,

    // para ver los console logs 
    DEBUG: true,
  };

  /* ---------- Estado interno ---------- */
  let files = []; // donde se guardan las imagenes
  let isSubmitting = false; 
  let hasAttemptedSubmit = false; 

  let currentDepId = "1";
  let currentItemId = "";
  let currentTitle = "Reporte";

  /* ---------- Utils ---------- */
  const digits = (s) => (s || "").replace(/\D+/g, "");
  const isEmail = (s) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
  const extOf = (name = "") => {
    const n = String(name).toLowerCase();
    const i = n.lastIndexOf(".");
    return i >= 0 ? n.slice(i) : "";
  };
  const hasAllowedExt = (f) => CFG.ACCEPT_EXT.includes(extOf(f?.name));
  const hasAllowedMime = (f) => CFG.ACCEPT_MIME.includes(f?.type);

  const norm = (s) =>
    (s ?? "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const isOtros = (title) => {
    const n = norm(title);
    return n === "otro";
  };

  function withTimeout(factory, ms = CFG.FETCH_TIMEOUT) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return factory(ctrl.signal)
      .then((r) => {
        clearTimeout(t);
        return r;
      })
      .catch((e) => {
        clearTimeout(t);
        throw e;
      });
  }

  /* ---------- DOM refs ---------- */
  const modal = document.getElementById("ix-report-modal");
  if (!modal) {
    console.warn("[IX] No existe #ix-report-modal");
    return;
  }

  const overlay = modal.querySelector(".ix-modal__overlay");
  const dialog = modal.querySelector(".ix-modal__dialog");
  const form = modal.querySelector("#ix-report-form");
  const feedback = modal.querySelector("#ix-report-feedback");

  // encabezado
  const subTitle = modal.querySelector("#ix-report-subtitle");
  const inpReq = modal.querySelector("#ix-report-req");
  const inpDepId = modal.querySelector("input[name='departamento_id']");
  const inpTramId = modal.querySelector("input[name='tramite_id']");
  const btnCloseList = modal.querySelectorAll("[data-ix-close]");

  // campos
  const inpNombre = modal.querySelector("#ix-nombre");
  const inpDom = modal.querySelector("#ix-domicilio");
  let inpCP = modal.querySelector("#ix-cp"); // puede mutar a <select>
  let inpCol = modal.querySelector("#ix-colonia"); // puede mutar a <select>
  const inpTel = modal.querySelector("#ix-telefono");
  const inpCorreo = modal.querySelector("#ix-correo");
  const inpDesc = modal.querySelector("#ix-descripcion");
  const cntDesc = modal.querySelector("#ix-desc-count");
  const chkCons = modal.querySelector("#ix-consent");
  const btnSend = modal.querySelector("#ix-submit");

  // bloque “asunto” solo para el formulario de “otro”
  const asuntoGroup = modal.querySelector("#ix-asunto-group");
  const inpAsunto = modal.querySelector("#ix-asunto");

  // uploader
  const upWrap = modal.querySelector(".ix-upload");
  const upInput = modal.querySelector("#ix-evidencia");
  const upCTA = modal.querySelector("#ix-evidencia-cta");
  const previews = modal.querySelector("#ix-evidencia-previews");

  // fecha que se llena automaticamente
  const inpFecha = modal.querySelector("#ix-fecha");
  const tDate = modal.querySelector("#ix-report-date");

  /* ---------- Helpers de UI ---------- */
  function clearFeedback() {
    if (feedback) {
      feedback.hidden = true;
      feedback.textContent = "";
    }
  }
  function showFeedback(msg) {
    if (feedback) {
      feedback.hidden = false;
      feedback.textContent = msg;
    }
  }

  function setFieldError(inputEl, msg = "") {
    const field = inputEl?.closest?.(".ix-field");
    const help = field?.querySelector(".ix-help");
    if (!field) return;
    if (msg) {
      field.classList.add("ix-field--error");
      inputEl?.setAttribute?.("aria-invalid", "true");
      if (help) {
        help.hidden = false;
        help.textContent = msg;
      }
    } else {
      field.classList.remove("ix-field--error");
      inputEl?.removeAttribute?.("aria-invalid");
      if (help) {
        help.hidden = true;
        help.textContent = "";
      }
    }
  }

  function updateDescCount() {
    if (!cntDesc || !inpDesc) return;
    cntDesc.textContent = String((inpDesc.value || "").length);
  }

  function setToday() {
    if (!inpFecha) return;
    const now = new Date();
    const visible = now
      .toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })
      .replace(",", " ·");
    inpFecha.value = visible;
    if (tDate) {
      tDate.dateTime = now.toISOString();
      tDate.textContent = "";
    }
  }

  // select helpers
  const makeOpt = (v, label, o = {}) => {
    const el = document.createElement("option");
    el.value = v;
    el.textContent = label;
    if (o.disabled) el.disabled = true;
    if (o.selected) el.selected = true;
    return el;
  };
  const ensureSelect = (el, { nameFallback, idFallback } = {}) => {
    if (el && el.tagName === "SELECT") return el;
    const sel = document.createElement("select");
    sel.id = el?.id || idFallback || "";
    sel.name = el?.name || nameFallback || "";
    sel.className = el?.className || "ix-select ix-select--quiet";
    sel.required = true;
    if (el) el.replaceWith(sel);
    return sel;
  };
  const ensureCpSelect = () =>
    (inpCP = ensureSelect(inpCP, {
      idFallback: "ix-cp",
      nameFallback: "contacto_cp",
    }));
  const ensureColSelect = () =>
    (inpCol = ensureSelect(inpCol, {
      idFallback: "ix-colonia",
      nameFallback: "contacto_colonia",
    }));

  // CP/Colonia
  const CP_CACHE_KEY = "ix_cpcolonia_cache_v1";
  let CP_MAP = {}; 
  let CP_LIST = []; 

  const getCpCache = () => {
    try {
      return JSON.parse(sessionStorage.getItem(CP_CACHE_KEY) || "null");
    } catch {
      return null;
    }
  };
  const setCpCache = (data) => {
    try {
      sessionStorage.setItem(CP_CACHE_KEY, JSON.stringify(data));
    } catch {}
  };
  const knownCP = (cp) =>
    Object.prototype.hasOwnProperty.call(CP_MAP, String(cp || ""));

  function extractCpColoniaArray(json) {
    const arr = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json)
      ? json
      : [];
    const out = [];
    for (const item of arr) {
      const cp = String(
        item.cp ?? item.CP ?? item.codigo_postal ?? item.codigoPostal ?? ""
      ).trim();
      const col = String(
        item.colonia ??
          item.Colonia ??
          item.asentamiento ??
          item.neighborhood ??
          ""
      ).trim();
      if (cp && col) out.push({ cp, colonia: col });
    }
    return out;
  }

  async function fetchCpColonia() {
    const hit = getCpCache();
    if (hit?.map && hit?.list) {
      CP_MAP = hit.map;
      CP_LIST = hit.list;
      return;
    }
    const json = await withTimeout((signal) =>
      fetch(CFG.ENDPOINTS.cpcolonia, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ all: true }),
        signal,
      }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
    );
    const rows = extractCpColoniaArray(json);
    const mapTemp = {};
    for (const r of rows) {
      const cp = String(r.cp).trim(),
        col = String(r.colonia).trim();
      if (!mapTemp[cp]) mapTemp[cp] = new Set();
      mapTemp[cp].add(col);
    }
    CP_MAP = Object.fromEntries(
      Object.entries(mapTemp).map(([k, v]) => [
        k,
        [...v].sort((a, b) => a.localeCompare(b, "es")),
      ])
    );
    CP_LIST = Object.keys(CP_MAP).sort();
    setCpCache({ map: CP_MAP, list: CP_LIST });
  }

  function populateCpOptions() {
    ensureCpSelect();
    inpCP.innerHTML = "";
    inpCP.appendChild(
      makeOpt("", "Selecciona C.P.", { disabled: true, selected: true })
    );
    CP_LIST.forEach((cp) => inpCP.appendChild(makeOpt(cp, cp)));
  }
  function resetColonia(msg = "Selecciona C.P. primero") {
    ensureColSelect();
    inpCol.innerHTML = "";
    inpCol.appendChild(makeOpt("", msg, { disabled: true, selected: true }));
    inpCol.disabled = true;
  }
  function populateColoniasForCP(cp) {
    ensureColSelect();
    inpCol.innerHTML = "";
    inpCol.appendChild(
      makeOpt("", "Selecciona colonia", { disabled: true, selected: true })
    );
    (CP_MAP[cp] || []).forEach((col) => inpCol.appendChild(makeOpt(col, col)));
    inpCol.disabled = false;
  }

  /* ---------- Uploader ---------- */
  function toggleUploadCTA() {
    if (!upCTA) return;
    const atLimit = files.length >= CFG.MAX_FILES;
    upCTA.disabled = atLimit;
    const tip = atLimit
      ? `Límite alcanzado (${files.length}/${CFG.MAX_FILES}).`
      : `Subir imágenes (${files.length}/${CFG.MAX_FILES}).`;
    upCTA.title = tip;
    upCTA.setAttribute("aria-label", tip);
  }

  function refreshPreviews() {
    if (!previews) return;
    previews.innerHTML = "";
    files.forEach((file, idx) => {
      const fig = document.createElement("figure");
      const img = document.createElement("img");
      const btn = document.createElement("button");

      const canPreview = /^(image\/jpeg|image\/png|image\/webp)$/i.test(
        file.type
      );
      img.src = canPreview
        ? URL.createObjectURL(file)
        : "/ASSETS/departamentos/placeholder_card.png";
      img.alt = canPreview ? file.name : "Vista previa no disponible";
      img.loading = "lazy";
      img.decoding = "async";

      btn.type = "button";
      btn.textContent = "×";
      btn.setAttribute("aria-label", "Eliminar imagen");
      btn.addEventListener("click", () => {
        files.splice(idx, 1);
        refreshPreviews();
        toggleUploadCTA();
        if (hasAttemptedSubmit) validateForm(true);
      });

      fig.appendChild(img);
      fig.appendChild(btn);
      previews.appendChild(fig);
    });

    if (hasAttemptedSubmit) {
      if (files.length < (CFG.MIN_FILES || 0)) {
        upWrap?.classList.add("ix-upload--error");
      } else {
        upWrap?.classList.remove("ix-upload--error");
      }
    }

    toggleUploadCTA();
  }

  function handleFiles(list) {
    const inc = Array.from(list || []);
    for (const f of inc) {
      const okMime = hasAllowedMime(f);
      const okExt = hasAllowedExt(f);
      if (!okMime && !okExt) {
        showFeedback("Solo JPG/PNG/WebP/HEIC/HEIF.");
        continue;
      }
      if (f.size > CFG.MAX_MB * 1024 * 1024) {
        showFeedback(`Cada archivo ≤ ${CFG.MAX_MB} MB.`);
        continue;
      }
      if (files.length >= CFG.MAX_FILES) {
        showFeedback(`Máximo ${CFG.MAX_FILES} imágenes.`);
        break;
      }
      files.push(f);
    }
    refreshPreviews();
  }

  function ensureUploadButton() {
    if (upInput) {
      upInput.setAttribute(
        "accept",
        [...CFG.ACCEPT_MIME, ...CFG.ACCEPT_EXT].join(",")
      );
    }
    if (upCTA) upCTA.addEventListener("click", () => upInput?.click());
    if (upInput)
      upInput.addEventListener("change", (e) => handleFiles(e.target.files));
    if (upWrap) {
      ["dragenter", "dragover"].forEach((ev) =>
        upWrap.addEventListener(ev, (e) => {
          e.preventDefault();
          e.stopPropagation();
          upWrap.classList.add("is-drag");
        })
      );
      ["dragleave", "drop"].forEach((ev) =>
        upWrap.addEventListener(ev, (e) => {
          e.preventDefault();
          e.stopPropagation();
          upWrap.classList.remove("is-drag");
        })
      );
      upWrap.addEventListener("drop", (e) =>
        handleFiles(e.dataTransfer?.files || [])
      );
    }
    toggleUploadCTA();
  }

  /* ---------- Validacion ---------- */
  function validateField(key, showErrors) {
    let ok = true,
      msg = "";

    switch (key) {
      case "nombre": {
        const v = (inpNombre?.value || "").trim();
        ok = v.length >= CFG.NAME_MIN_CHARS || v.split(/\s+/).length >= 2;
        msg = ok ? "" : "Ingresa tu nombre completo.";
        setFieldError(inpNombre, showErrors ? msg : "");
        break;
      }
      case "dom": {
        const v = (inpDom?.value || "").trim();
        ok = !!v;
        msg = ok ? "" : "El domicilio es obligatorio.";
        setFieldError(inpDom, showErrors ? msg : "");
        break;
      }
      case "cp": {
        const cp = inpCP?.value || "";
        ok = !!cp && knownCP(cp);
        msg = ok ? "" : "Selecciona un C.P. válido.";
        setFieldError(inpCP, showErrors ? msg : "");
        if (ok) {
          populateColoniasForCP(cp);
        }
        break;
      }
      case "col": {
        const cp = inpCP?.value || "";
        const col = inpCol?.value || "";
        const list = CP_MAP[cp] || [];
        ok = !!col && list.includes(col);
        msg = ok ? "" : "Selecciona una colonia válida.";
        setFieldError(inpCol, showErrors ? msg : "");
        break;
      }
      case "tel": {
        if (inpTel)
          inpTel.value = digits(inpTel.value).slice(0, CFG.PHONE_DIGITS);
        const tel = digits(inpTel?.value || "");
        ok = tel.length === CFG.PHONE_DIGITS;
        msg = ok ? "" : `Teléfono a ${CFG.PHONE_DIGITS} dígitos.`;
        setFieldError(inpTel, showErrors ? msg : "");
        break;
      }
      case "correo": {
        const mail = (inpCorreo?.value || "").trim();
        ok = !mail || isEmail(mail);
        msg = ok ? "" : "Correo no válido.";
        setFieldError(inpCorreo, showErrors ? msg : "");
        break;
      }
      case "desc": {
        const d = (inpDesc?.value || "").trim();
        ok = d.length >= CFG.DESC_MIN_CHARS;
        msg = ok
          ? ""
          : `Describe con al menos ${CFG.DESC_MIN_CHARS} caracteres.`;
        setFieldError(inpDesc, showErrors ? msg : "");
        break;
      }
      case "consent": {
        ok = !!chkCons?.checked;
        msg = ok ? "" : "Debes aceptar el consentimiento.";
        setFieldError(chkCons, showErrors ? msg : "");
        break;
      }
      case "asunto": {
        if (!asuntoGroup || asuntoGroup.hidden) {
          ok = true;
          break;
        }
        const v = (inpAsunto?.value || "").trim();
        ok = !!v;
        msg = ok ? "" : "Indica una clasificación.";
        setFieldError(inpAsunto, showErrors ? msg : "");
        break;
      }
    }
    return ok;
  }

  function validateForm(showErrors) {
    const keys = [
      "nombre",
      "dom",
      "cp",
      "col",
      "tel",
      "correo",
      "desc",
      "consent",
      "asunto",
    ];
    let firstBad = null;
    let allOk = true;
    for (const k of keys) {
      const ok = validateField(k, showErrors);
      if (!ok) {
        allOk = false;
        if (!firstBad) firstBad = k;
      }
    }
    // imágenes
    if (files.length > CFG.MAX_FILES) {
      allOk = false;
      showFeedback(`Máximo ${CFG.MAX_FILES} imágenes.`);
    }
    if (files.length < (CFG.MIN_FILES || 0)) {
      allOk = false;
      showFeedback(
        `Adjunta al menos ${CFG.MIN_FILES} imagen${
          CFG.MIN_FILES > 1 ? "es" : ""
        }.`
      );
      upWrap?.classList.add("ix-upload--error");
    } else {
      upWrap?.classList.remove("ix-upload--error");
    }
    return { ok: allOk, firstBad };
  }

  /* ---------- apertura / cierre del modal ---------- */
  function trap(e) {
    if (e.key !== "Tab") return;
    const focusables = Array.from(
      dialog.querySelectorAll(
        'a[href],button:not([disabled]),textarea,input:not([disabled]),select,[tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0],
      last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function toggleAsuntoForOtros(visible) {
    if (!asuntoGroup) return;
    asuntoGroup.hidden = !visible;
    asuntoGroup.style.display = visible ? "" : "none";
    if (!visible && inpAsunto) {
      inpAsunto.value = "";
      setFieldError(inpAsunto, "");
    }
  }

  function openModal(
    {
      title = "Reporte",
      depKey = "1",
      itemId = "",
      sla = "",
      mode = "normal",
    } = {},
    opener = null
  ) {
    // contexto
    currentDepId = String(depKey || "1");
    currentItemId = String(itemId || "");
    currentTitle = String(title || "Reporte");
    modal.dataset.mode = mode;

    // encabezado
    if (subTitle) subTitle.textContent = currentTitle;
    if (inpReq) inpReq.value = currentTitle;
    if (inpDepId) inpDepId.value = currentDepId;
    if (inpTramId) inpTramId.value = currentItemId;

    // reset UI
    clearFeedback();
    hasAttemptedSubmit = false;
    isSubmitting = false;
    form?.reset();
    files = [];
    refreshPreviews();
    updateDescCount();
    setToday();
    btnSend.disabled = false;

    // asunto visible SOLO si es el formulario de “otro”
    toggleAsuntoForOtros(mode === "otros");

    // cp/colonia
    ensureCpSelect();
    ensureColSelect();
    resetColonia();
    fetchCpColonia()
      .then(() => populateCpOptions())
      .catch(() => {});

    // mostrar
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    // eventos cerrar
    const onKey = (e) => {
      if (e.key === "Escape") closeModal();
      else trap(e);
    };
    document.addEventListener("keydown", onKey, { passive: false });
    overlay?.addEventListener("click", closeModal, { once: true });
    btnCloseList.forEach((b) =>
      b.addEventListener("click", closeModal, { once: true })
    );

    // foco inicial
    setTimeout(() => inpNombre?.focus(), 0);

    // guardar para remover
    modal._onKey = onKey;
  }

  function closeModal() {
    document.removeEventListener("keydown", modal._onKey || (() => {}));
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // API publica para integrarte con la grilla
  window.ixReportModal = {
    open: (opts = {}, opener) =>
      openModal(
        {
          ...opts,
          mode: opts.mode || (isOtros(opts.title) ? "otros" : "normal"),
        },
        opener
      ),
    close: () => closeModal(),
  };

  /* ---------- Listeners de input ---------- */
  // contador de descripcion SIEMPRE en vivo
  inpDesc?.addEventListener("input", () => {
    updateDescCount();
    if (hasAttemptedSubmit) validateField("desc", true);
  });

  [
    ["nombre", inpNombre],
    ["dom", inpDom],
    ["tel", inpTel],
    ["correo", inpCorreo],
    ["consent", chkCons],
    ["asunto", inpAsunto],
  ].forEach(([k, el]) => {
    el?.addEventListener("input", () => {
      if (hasAttemptedSubmit) validateField(k, true);
    });
  });

  modal.addEventListener("change", (e) => {
    const t = e.target;
    if (t && t.id === "ix-cp") {
      validateField("cp", true);
      resetColonia();
      populateColoniasForCP(t.value);
    }
    if (t && t.id === "ix-colonia") {
      if (hasAttemptedSubmit) validateField("col", true);
    }
  });

  /* ---------- Upload init ---------- */
  ensureUploadButton();

  /* ---------- Submit ---------- */
  form?.addEventListener("input", () => {
    const { ok } = validateForm(false);
    btnSend.disabled = !ok;
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    clearFeedback();
    hasAttemptedSubmit = true;

    const res = validateForm(true);
    if (!res.ok) {
      // enfocar el primer campo con error
      const sel = {
        nombre: "#ix-nombre",
        dom: "#ix-domicilio",
        cp: "#ix-cp",
        col: "#ix-colonia",
        tel: "#ix-telefono",
        correo: "#ix-correo",
        desc: "#ix-descripcion",
        consent: "#ix-consent",
        asunto: "#ix-asunto",
      }[res.firstBad];
      const badEl = sel ? modal.querySelector(sel) : null;
      badEl?.focus?.();
      return;
    }

    // payload
    const depId = Number(currentDepId || inpDepId?.value || 1);
    const tramId = Number(currentItemId || inpTramId?.value || 0);
    const modoOtros = modal.dataset.mode === "otros";

    const body = {
      departamento_id: depId,
      tramite_id: tramId || null,
      asignado_a: 1,
      asunto:
        modoOtros && inpAsunto?.value.trim()
          ? inpAsunto.value.trim()
          : `Reporte ${currentTitle}`,
      descripcion: (inpDesc?.value || "").trim(),
      prioridad: 2,
      estatus: 0, // solicitud
      canal: 1,
      contacto_nombre: (inpNombre?.value || "").trim(),
      contacto_email: (inpCorreo?.value || "").trim() || null,
      contacto_telefono: digits(inpTel?.value || ""),
      contacto_calle: (inpDom?.value || "").trim(),
      contacto_colonia: (inpCol?.value || "").trim(),
      contacto_cp: (inpCP?.value || "").trim(),
      fecha_limite: null,
      status: 1,
      created_by: 1,
    };

    // Enviando…
    isSubmitting = true;
    form.setAttribute("aria-busy", "true");
    const oldTxt = btnSend.textContent;
    btnSend.textContent = "Enviando…";
    Array.from(form.elements).forEach((el) => (el.disabled = true));

    try {
      // 1) Insertar
      const json = await withTimeout((signal) =>
        fetch(CFG.ENDPOINTS.insertReq, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
          signal,
        }).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
      );
      if (!json?.ok || !json?.data)
        throw new Error("Respuesta inesperada del servidor.");
      const folio =
        json.data.folio || `REQ-${String(Date.now() % 1e10).padStart(10, "0")}`;

      // 2) Preparar FS 
      try {
        await withTimeout((signal) =>
          fetch(CFG.ENDPOINTS.fsBootstrap, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ folio }),
            signal,
          }).then((r) => r.json())
        );
      } catch {}

      // 3) Subir imagenes (si hay)
      if (files.length) {
        const fd = new FormData();
        fd.append("folio", folio);
        fd.append("status", "0");
        files.forEach((f) => fd.append("files[]", f, f.name));
        try {
          await withTimeout((signal) =>
            fetch(CFG.ENDPOINTS.uploadImg, {
              method: "POST",
              body: fd,
              signal,
            }).then((r) => r.json())
          );
        } catch (e) {
          showFeedback(
            "El reporte se creó, pero algunas imágenes no se subieron."
          );
        }
      }

      // Reset y cerrar
      Array.from(form.elements).forEach((el) => (el.disabled = false));
      btnSend.textContent = oldTxt;
      form.reset();
      files = [];
      refreshPreviews();
      updateDescCount();
      closeModal();

      // Modal informativo (si lo tienes incluido en HTML/CSS)
      if (window.ixDoneModal?.open)
        window.ixDoneModal.open({ folio, title: currentTitle });
    } catch (err) {
      showFeedback(`No se pudo enviar el reporte. ${err?.message || err}`);
      Array.from(form.elements).forEach((el) => (el.disabled = false));
      btnSend.textContent = oldTxt;
      btnSend.disabled = false;
    } finally {
      isSubmitting = false;
      form.removeAttribute("aria-busy");
    }
  });
})();

// /JS/ui/requerimientosCanal2.js
(function () {
  "use strict";

  const TAG = "[ReqCanal2]";
  const log = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);
  const err = (...a) => console.error(TAG, ...a);

  // =========================
  // API HOST + Endpoints
  // (alineados a tareas.js)
  // =========================
  const HOST =
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net";

  const EP = {
    departamentos: `${HOST}/db/WEB/ixtla01_c_departamento.php`, // singular ✅
    tramites: `${HOST}/db/WEB/ixtla01_c_tramite.php`,
    cpcolonia: `${HOST}/db/WEB/ixtla01_c_cpcolonia.php`,
    insertReq: `/webpublic_proxy.php`,
    fsBootstrap: `${HOST}/db/WEB/ixtla01_u_requerimiento_folders.php`,
    uploadImg: `${HOST}/db/WEB/ixtla01_in_requerimiento_img.php`,
  };

  // =========================
  // DOM IDs esperados
  // =========================
  const IDS = {
    btnOpen: "hs-btn-new-req",
    modal: "ix-report-modal",

    deptSelect: "ix-departamento-select",
    tramSelect: "ix-tramite-select",

    cpSelect: "ix-cp",
    colSelect: "ix-colonia",

    hidDept: "ix-departamento-id",
    hidTram: "ix-tramite-id",
    hidReqTitle: "ix-report-req",

    subtitle: "ix-report-subtitle",

    asuntoGroup: "ix-asunto-group",
    asuntoInput: "ix-asunto",
  };

  // =========================
  // Reglas
  // =========================
  const PRESIDENCIA_DEPT_ID = 6; // excluir del combo
  const ADMIN_ROLES = ["ADMIN"]; // si viene role ADMIN
  // Nota: "Admin/Presidencia pueden cambiar depto" (pero Presidencia depto se excluye del listado)
  // = El usuario con depto 6 se considera "privilegiado" y puede seleccionar otro depto (no 6).

  // =========================
  // Helpers: POST sin credenciales
  // =========================
  async function postNoCreds(url, payload, { timeout = 15000 } = {}) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "omit", // 🔥 clave para evitar CORS con Allow-Credentials
        body: JSON.stringify(payload || {}),
        signal: controller.signal,
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          json?.error || json?.mensaje || `${res.status} ${res.statusText}`;
        throw new Error(msg);
      }
      if (json?.ok === false) {
        throw new Error(json?.error || json?.mensaje || "Respuesta ok:false");
      }
      return json || {};
    } finally {
      clearTimeout(t);
    }
  }

  // =========================
  // Helpers: normalización
  // =========================
  function norm(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function isOtros(nombreTramite) {
    return norm(nombreTramite) === "otros";
  }

  // =========================
  // Helpers: sesión
  // =========================
  function readIxCookie() {
    try {
      const name = "ix_emp=";
      const pair = document.cookie.split("; ").find((c) => c.startsWith(name));
      if (!pair) return null;
      const raw = decodeURIComponent(pair.slice(name.length));
      return JSON.parse(decodeURIComponent(escape(atob(raw))));
    } catch {
      return null;
    }
  }

  function readSession() {
    let s = null;
    try {
      s = window.Session?.get?.() || null;
    } catch {}
    if (!s) s = readIxCookie();

    const empleado_id = s?.empleado_id ?? s?.id_empleado ?? null;
    const dept_id =
      s?.departamento_id ?? s?.dept_id ?? s?.dept ?? s?.departamento ?? null;

    const roles = Array.isArray(s?.roles)
      ? s.roles.map((r) => String(r).toUpperCase())
      : [];

    return {
      empleado_id,
      dept_id: dept_id != null ? Number(dept_id) : null,
      roles,
    };
  }

  function computeRBAC(sess) {
    const dept = Number(sess?.dept_id);
    const roles = sess?.roles || [];
    const isAdmin = roles.some((r) => ADMIN_ROLES.includes(r));
    const isPres = dept === PRESIDENCIA_DEPT_ID;
    const canPickDept = isAdmin || isPres;
    return { isAdmin, isPres, canPickDept };
  }

  // =========================
  // Helpers: UI select
  // =========================
  function fillSelect(el, items, placeholder) {
    if (!el) return;
    el.innerHTML = "";

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.disabled = true;
    opt0.selected = true;
    opt0.textContent = placeholder || "Selecciona…";
    el.appendChild(opt0);

    items.forEach((it) => {
      const opt = document.createElement("option");
      opt.value = String(it.value);
      opt.textContent = String(it.label);
      if (it.dataset) {
        Object.entries(it.dataset).forEach(
          ([k, v]) => (opt.dataset[k] = String(v)),
        );
      }
      el.appendChild(opt);
    });
  }

  function setSubtitle(el, txt) {
    if (!el) return;
    el.textContent = txt || "Selecciona el tipo de trámite";
  }

  function showAsunto(groupEl, inputEl, on) {
    if (!groupEl || !inputEl) return;
    if (on) {
      groupEl.hidden = false;
      inputEl.required = true;
    } else {
      groupEl.hidden = true;
      inputEl.required = false;
      inputEl.value = "";
    }
  }

  // =========================
  // Modal open/close
  // =========================
  function openModal(modal) {
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    const first = modal.querySelector(
      "select, input, textarea, button, [tabindex]:not([tabindex='-1'])",
    );
    first?.focus?.();
  }

  function closeModal(modal) {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  // =========================
  // Caches
  // =========================
  let cacheDepartamentos = null; // [{id,nombre,status}]
  const cacheTramitesByDept = new Map(); // deptId -> [{id,nombre,descripcion,estatus}]
  let cacheCpCol = null; // { cps:[], map: {cp:[colonias]} }

  // =========================
  // Loaders: Departamentos
  // =========================
  async function loadDepartamentosActivosSinPresidencia() {
    // Mandamos ambos (status/estatus) para cubrir variaciones
    const json = await postNoCreds(EP.departamentos, {
      status: 1,
      estatus: 1,
      all: true,
      page: 1,
      page_size: 200,
    });

    const rows = Array.isArray(json?.data) ? json.data : [];

    const out = rows
      .map((d) => ({
        id: Number(d?.id ?? d?.departamento_id ?? 0),
        nombre: String(d?.nombre ?? d?.departamento_nombre ?? "").trim(),
        status: Number(d?.status ?? d?.estatus ?? 1),
      }))
      .filter((d) => d.id && d.nombre)
      // solo activos
      .filter((d) => Number(d.status) === 1)
      // excluir presidencia por id o por nombre
      .filter(
        (d) => d.id !== PRESIDENCIA_DEPT_ID && norm(d.nombre) !== "presidencia",
      )
      // ordenar A-Z
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    return out;
  }

  // =========================
  // Loaders: Trámites por dept
  // =========================
  async function loadTramitesPorDepartamento(deptId) {
    const key = String(deptId || "");
    if (!key) return [];

    if (cacheTramitesByDept.has(key)) return cacheTramitesByDept.get(key);

    const json = await postNoCreds(EP.tramites, {
      estatus: 1,
      all: true,
    });

    const rows = Array.isArray(json?.data) ? json.data : [];

    const out = rows
      .filter((t) => Number(t?.estatus ?? 1) === 1)
      .filter((t) => Number(t?.departamento_id) === Number(deptId))
      .map((t) => ({
        id: Number(t?.id),
        nombre: String(t?.nombre || "").trim(),
        descripcion: String(t?.descripcion || "").trim(),
        estatus: Number(t?.estatus ?? 1),
      }))
      .filter((t) => t.id && t.nombre)
      .sort((a, b) => a.id - b.id);

    cacheTramitesByDept.set(key, out);
    return out;
  }

  // =========================
  // Loaders: CP/Colonia
  // =========================
  function buildCpColMap(rows) {
    const map = {};
    for (const r of rows) {
      const cp = String(r?.cp ?? r?.CP ?? r?.codigo_postal ?? "").trim();
      const col = String(
        r?.colonia ?? r?.Colonia ?? r?.asentamiento ?? "",
      ).trim();
      if (!cp || !col) continue;
      if (!map[cp]) map[cp] = new Set();
      map[cp].add(col);
    }
    const finalMap = {};
    Object.keys(map).forEach((cp) => {
      finalMap[cp] = Array.from(map[cp]).sort((a, b) =>
        a.localeCompare(b, "es"),
      );
    });
    const cps = Object.keys(finalMap).sort();
    return { cps, map: finalMap };
  }

  async function ensureCpColonia() {
    if (cacheCpCol) return cacheCpCol;

    const json = await postNoCreds(EP.cpcolonia, {
      all: true,
      page: 1,
      page_size: 10000,
    });
    const rows = Array.isArray(json?.data) ? json.data : [];
    cacheCpCol = buildCpColMap(rows);
    return cacheCpCol;
  }

  // =========================
  // Main init
  // =========================
  async function init() {
    const btn = document.getElementById(IDS.btnOpen);
    const modal = document.getElementById(IDS.modal);
    if (!btn || !modal) return;

    const selDept = modal.querySelector(`#${IDS.deptSelect}`);
    const selTram = modal.querySelector(`#${IDS.tramSelect}`);
    const selCp = modal.querySelector(`#${IDS.cpSelect}`);
    const selCol = modal.querySelector(`#${IDS.colSelect}`);

    const hidDept = modal.querySelector(`#${IDS.hidDept}`);
    const hidTram = modal.querySelector(`#${IDS.hidTram}`);
    const hidReqTitle = modal.querySelector(`#${IDS.hidReqTitle}`);

    const subtitle = modal.querySelector(`#${IDS.subtitle}`);
    const asuntoGroup = modal.querySelector(`#${IDS.asuntoGroup}`);
    const asuntoInput = modal.querySelector(`#${IDS.asuntoInput}`);

    if (
      !selDept ||
      !selTram ||
      !selCp ||
      !selCol ||
      !hidDept ||
      !hidTram ||
      !hidReqTitle
    ) {
      warn("Faltan IDs del modal (selects/hidden). Revisa el HTML del modal.");
      return;
    }

    // close hooks
    modal.querySelectorAll("[data-ix-close]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        closeModal(modal);
      });
    });
    modal
      .querySelector(".ix-modal__overlay")
      ?.addEventListener("click", () => closeModal(modal));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) closeModal(modal);
    });

    // =========================
    // Conexión: Media + Submit
    // (misma lógica base que tramites)
    // =========================
    const toast = (msg, type = "info", ms = 3000) => {
      try {
        if (typeof window.gcToast === "function")
          return window.gcToast(msg, type, ms);
        if (window.ixToast?.[type]) return window.ixToast[type](msg, ms);
        console.log(TAG, "[toast]", type, msg);
      } catch {
        console.log(TAG, "[toast]", type, msg);
      }
    };

    const CFG = {
      NAME_MIN_CHARS: 5,
      DESC_MIN_CHARS: 10,
      PHONE_DIGITS: 10,
      MAX_FILES: 3,
      MIN_FILES: 0,
      MAX_MB: 1,
      ACCEPT_MIME: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif",
      ],
      ACCEPT_EXT: [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"],
      FETCH_TIMEOUT: 12000,
    };

    // Estado uploader
    let files = [];
    let isSubmitting = false;
    let hasAttemptedSubmit = false;

    // DOM del formulario
    const form = modal.querySelector("#ix-report-form");
    const feedback = modal.querySelector("#ix-report-feedback");

    const inpNombre = modal.querySelector("#ix-nombre");
    const inpDom = modal.querySelector("#ix-domicilio");
    const inpTel = modal.querySelector("#ix-telefono");
    const inpCorreo = modal.querySelector("#ix-correo");
    const inpDesc = modal.querySelector("#ix-descripcion");
    const cntDesc = modal.querySelector("#ix-desc-count");
    const chkCons = modal.querySelector("#ix-consent");
    const btnSend = modal.querySelector("#ix-submit");

    // Uploader
    const upWrap = modal.querySelector(".ix-upload");
    const upInput = modal.querySelector("#ix-evidencia");
    const upCTA = modal.querySelector("#ix-evidencia-cta");
    const previews = modal.querySelector("#ix-evidencia-previews");

    // Fecha visible (el backend usa NOW(); aquí solo UI)
    const inpFecha = modal.querySelector("#ix-fecha");

    const digits = (s) => String(s || "").replace(/\D+/g, "");
    const isEmail = (s) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
    const extOf = (name = "") => {
      const n = String(name).toLowerCase();
      const i = n.lastIndexOf(".");
      return i >= 0 ? n.slice(i) : "";
    };
    const hasAllowedExt = (f) => CFG.ACCEPT_EXT.includes(extOf(f?.name));
    const hasAllowedMime = (f) => CFG.ACCEPT_MIME.includes(f?.type);

    function clearFeedback() {
      if (!feedback) return;
      feedback.hidden = true;
      feedback.textContent = "";
    }
    function showFeedback(msg) {
      if (!feedback) return;
      feedback.hidden = false;
      feedback.textContent = msg || "";
    }

    function setToday() {
      if (!inpFecha) return;
      const now = new Date();
      inpFecha.value = now
        .toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })
        .replace(",", " ·");
    }

    function updateDescCount() {
      if (!cntDesc || !inpDesc) return;
      const max = Number(cntDesc.dataset.max || 500);
      const n = (inpDesc.value || "").length;
      cntDesc.textContent = `${n}/${max}`;
    }

    function refreshPreviews() {
      if (!previews) return;
      previews.innerHTML = "";

      files.forEach((f, idx) => {
        const fig = document.createElement("figure");

        const img = document.createElement("img");
        img.alt = f.name || `evidencia-${idx + 1}`;
        img.loading = "lazy";
        img.decoding = "async";

        if (!f._url) {
          try {
            f._url = URL.createObjectURL(f);
          } catch {}
        }
        if (f._url) img.src = f._url;

        const del = document.createElement("button");
        del.type = "button";
        del.setAttribute("aria-label", "Eliminar imagen");
        del.textContent = "×";
        del.addEventListener("click", () => {
          const gone = files.splice(idx, 1)[0];
          if (gone?._url) {
            try {
              URL.revokeObjectURL(gone._url);
            } catch {}
          }
          refreshPreviews();
          form?.dispatchEvent(new Event("input", { bubbles: true }));
        });

        fig.appendChild(img);
        fig.appendChild(del);
        previews.appendChild(fig);
      });
    }

    function ensureUploadUI() {
      if (upInput) {
        upInput.accept = [...CFG.ACCEPT_MIME, ...CFG.ACCEPT_EXT].join(",");
      }
      if (upCTA && upInput) {
        upCTA.addEventListener("click", (e) => {
          e.preventDefault();
          upInput.click();
        });
      }
      if (upInput) {
        upInput.addEventListener("change", () => {
          const picked = Array.from(upInput.files || []);
          if (!picked.length) return;
          const next = [...files, ...picked].slice(0, CFG.MAX_FILES);

          // valida por archivo
          const valid = [];
          for (const f of next) {
            const mb = (f.size || 0) / (1024 * 1024);
            const okType = hasAllowedMime(f) || hasAllowedExt(f);
            if (!okType) {
              toast(`Tipo no permitido: ${f.name}`, "warn", 3200);
              continue;
            }
            if (mb > CFG.MAX_MB) {
              toast(
                `Archivo muy pesado (máx ${CFG.MAX_MB}MB): ${f.name}`,
                "warn",
                3200,
              );
              continue;
            }
            valid.push(f);
          }
          files = valid.slice(0, CFG.MAX_FILES);

          // reset input para permitir volver a seleccionar mismo archivo
          upInput.value = "";
          refreshPreviews();
          form?.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }
      if (upWrap) {
        upWrap.addEventListener("dragover", (e) => {
          e.preventDefault();
          upWrap.classList.add("drag");
        });
        upWrap.addEventListener("dragleave", () =>
          upWrap.classList.remove("drag"),
        );
        upWrap.addEventListener("drop", (e) => {
          e.preventDefault();
          upWrap.classList.remove("drag");
          const dropped = Array.from(e.dataTransfer?.files || []);
          if (!dropped.length) return;
          // simula selección
          const dt = new DataTransfer();
          dropped.slice(0, CFG.MAX_FILES).forEach((f) => dt.items.add(f));
          if (upInput) upInput.files = dt.files;
          upInput?.dispatchEvent(new Event("change"));
        });
      }
    }

    function validateForm(focusOnFail = false) {
      const nombre = (inpNombre?.value || "").trim();
      const domicilio = (inpDom?.value || "").trim();
      const cp = (selCp?.value || "").trim();
      const col = (selCol?.value || "").trim();
      const tel = digits(inpTel?.value || "");
      const correo = (inpCorreo?.value || "").trim();
      const desc = (inpDesc?.value || "").trim();
      const consent = !!chkCons?.checked;

      const tramName = selTram?.selectedOptions?.[0]?.textContent?.trim() || "";
      const otros = isOtros(tramName);
      const asunto = (asuntoInput?.value || "").trim();

      // requeridos básicos
      if (nombre.length < CFG.NAME_MIN_CHARS)
        return { ok: false, firstBad: "nombre" };
      if (!domicilio) return { ok: false, firstBad: "dom" };
      if (!cp) return { ok: false, firstBad: "cp" };
      if (!col) return { ok: false, firstBad: "col" };
      if (tel.length !== CFG.PHONE_DIGITS)
        return { ok: false, firstBad: "tel" };
      if (correo && !isEmail(correo)) return { ok: false, firstBad: "correo" };
      if (desc.length < CFG.DESC_MIN_CHARS)
        return { ok: false, firstBad: "desc" };
      if (!consent) return { ok: false, firstBad: "consent" };
      if (otros && asunto.length < 3) return { ok: false, firstBad: "asunto" };

      // archivos (solo límites)
      if (files.length > CFG.MAX_FILES) return { ok: false, firstBad: "files" };

      return { ok: true };
    }

    // Conecta UI
    ensureUploadUI();
    updateDescCount();
    inpDesc?.addEventListener("input", updateDescCount);

    form?.addEventListener("input", () => {
      const { ok } = validateForm(false);
      if (btnSend) btnSend.disabled = !ok || isSubmitting;
      if (hasAttemptedSubmit) clearFeedback();
    });

    // Submit
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (isSubmitting) return;

      clearFeedback();
      hasAttemptedSubmit = true;

      const res = validateForm(true);
      if (!res.ok) {
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
        modal.querySelector(sel || "")?.focus?.();
        showFeedback(
          "Revisa los campos marcados. Hay información faltante o inválida.",
        );
        return;
      }

      const depId = Number(hidDept?.value || 1);
      const tramIdRaw = hidTram?.value || "";
      const tramId = tramIdRaw ? Number(tramIdRaw) : null;

      const tramName =
        selTram?.selectedOptions?.[0]?.textContent?.trim() || "Requerimiento";
      const otros = isOtros(tramName);

      const body = {
        departamento_id: depId,
        tramite_id: tramId,
        asunto: otros
          ? String(asuntoInput?.value || "").trim()
          : `Reporte ${tramName}`,
        descripcion: String(inpDesc?.value || "").trim(),
        contacto_nombre: String(inpNombre?.value || "").trim(),
        contacto_email: String(inpCorreo?.value || "").trim() || null,
        contacto_telefono: digits(inpTel?.value || ""),
        contacto_calle: String(inpDom?.value || "").trim(),
        contacto_colonia: String(selCol?.value || "").trim(),
        contacto_cp: String(selCp?.value || "").trim(),
      };

      // UI lock
      isSubmitting = true;
      form.setAttribute("aria-busy", "true");
      const oldTxt = btnSend?.textContent || "Enviar";
      if (btnSend) {
        btnSend.disabled = true;
        btnSend.textContent = "Enviando…";
      }

      const idempKey =
        (crypto?.randomUUID && crypto.randomUUID()) ||
        `idemp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      try {
        // 1) Insert requerimiento
        const json = await fetch(EP.insertReq, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "Idempotency-Key": idempKey,
          },
          body: JSON.stringify(body),
        }).then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        });

        if (!json?.ok || !json?.data)
          throw new Error("Respuesta inesperada del servidor.");
        const folio =
          json.data.folio ||
          `REQ-${String(Date.now() % 1e10).padStart(10, "0")}`;

        // 2) Bootstrap folders (best-effort)
        try {
          await postNoCreds(EP.fsBootstrap, {
            folio,
            create_status_txt: true,
            force_status_txt: false,
          });
        } catch (e2) {
          warn("fsBootstrap falló (no bloqueante):", e2);
        }

        // 3) Upload evidencias (multipart) estado 0
        // 2) Media (carpetas + upload) usando /JS/api/media.js
        if (files.length) {
          try {
            const { setupMedia, uploadMedia } =
              await import("/JS/api/media.js");
            await setupMedia(folio, {
              create_status_txt: true,
              force_status_txt: false,
            });
            const up = await uploadMedia({ folio, status: 0, files });
            if (up?.skipped?.length) {
              const names = up.skipped
                .map((s) => s?.name)
                .filter(Boolean)
                .join(", ");
              if (names)
                toast(`Se omitieron algunas imágenes: ${names}`, "warn", 4500);
            }
            if (up && up.ok === false) {
              toast("No se pudieron subir evidencias.", "warn", 3500);
            }
          } catch (eUp) {
            warn("media upload error:", eUp);
            toast(
              `Error al subir evidencias: ${eUp?.message || eUp}`,
              "warn",
              3800,
            );
          }
        }

        toast(`Reporte creado: ${folio}`, "ok", 3200);

        // reset
        try {
          form.reset();
        } catch {}
        setToday();
        files.forEach((f) => {
          if (f?._url) {
            try {
              URL.revokeObjectURL(f._url);
            } catch {}
          }
        });
        files = [];
        refreshPreviews();
        updateDescCount();

        closeModal(modal);
      } catch (e1) {
        err("submit error:", e1);
        toast("No se pudo enviar el reporte.", "err", 3500);
        showFeedback(`No se pudo enviar el reporte. ${e1?.message || e1}`);
      } finally {
        isSubmitting = false;
        form.removeAttribute("aria-busy");
        if (btnSend) {
          btnSend.textContent = oldTxt;
          const { ok } = validateForm(false);
          btnSend.disabled = !ok;
        }
      }
    });

    // --- helpers internos para pintar ---
    async function paintTramitesForDept(deptId) {
      // reset trámites/req_title
      hidTram.value = "";
      hidReqTitle.value = "";
      setSubtitle(subtitle, "Selecciona el tipo de trámite");
      showAsunto(asuntoGroup, asuntoInput, false);

      selTram.disabled = true;
      fillSelect(selTram, [], "Cargando trámites…");

      try {
        const tramites = await loadTramitesPorDepartamento(deptId);
        if (!tramites.length) {
          selTram.disabled = true;
          fillSelect(selTram, [], "No hay trámites disponibles");
          return;
        }

        selTram.disabled = false;
        fillSelect(
          selTram,
          tramites.map((t) => ({
            value: t.id,
            label: t.nombre,
            dataset: { desc: t.descripcion || "" },
          })),
          "Selecciona un trámite",
        );
      } catch (e) {
        err("Error cargando trámites:", e);
        selTram.disabled = true;
        fillSelect(selTram, [], "Error al cargar trámites");
      }
    }

    async function paintCpCol() {
      selCp.disabled = true;
      selCol.disabled = true;
      fillSelect(selCp, [], "Cargando C.P.…");
      fillSelect(selCol, [], "Selecciona colonia");

      try {
        const { cps, map } = await ensureCpColonia();
        selCp.disabled = false;
        fillSelect(
          selCp,
          cps.map((cp) => ({ value: cp, label: cp })),
          "Selecciona C.P.",
        );

        // colonia queda deshabilitada hasta que elijas CP
        selCol.disabled = true;
        fillSelect(selCol, [], "Selecciona colonia");

        // handler CP -> colonias
        selCp.onchange = () => {
          const cp = selCp.value || "";
          const cols = map[cp] || [];
          selCol.disabled = !cols.length;
          fillSelect(
            selCol,
            cols.map((c) => ({ value: c, label: c })),
            cols.length ? "Selecciona colonia" : "Sin colonias",
          );
        };
      } catch (e) {
        err("Error cargando CP/Colonia:", e);
        selCp.disabled = true;
        selCol.disabled = true;
        fillSelect(selCp, [], "Error al cargar C.P.");
        fillSelect(selCol, [], "Error al cargar colonia");
      }
    }

    async function hydrateOnOpen() {
      const sess = readSession();
      const rbac = computeRBAC(sess);

      log("sesión:", sess);
      log("rbac:", rbac);

      // reset hidden + UI
      hidDept.value = "";
      hidTram.value = "";
      hidReqTitle.value = "";
      setSubtitle(subtitle, "Selecciona el tipo de trámite");
      showAsunto(asuntoGroup, asuntoInput, false);

      // CP/Colonia (siempre)
      paintCpCol(); // no bloquea el resto; corre async internamente

      // Departamentos
      selDept.disabled = true;
      fillSelect(selDept, [], "Cargando departamentos…");

      try {
        cacheDepartamentos =
          cacheDepartamentos ||
          (await loadDepartamentosActivosSinPresidencia());

        fillSelect(
          selDept,
          cacheDepartamentos.map((d) => ({ value: d.id, label: d.nombre })),
          "Selecciona un departamento",
        );

        // RBAC dept locked/unlocked
        const myDept = sess?.dept_id != null ? Number(sess.dept_id) : null;

        if (rbac.canPickDept) {
          // admin/pres: puede elegir cualquiera (pero presidencia no aparece en lista)
          selDept.disabled = false;

          // si el depto actual del usuario NO está en lista (ej. 6), dejamos vacío
          if (
            myDept != null &&
            cacheDepartamentos.some((d) => Number(d.id) === Number(myDept))
          ) {
            selDept.value = String(myDept);
          } else {
            selDept.value = "";
          }
        } else {
          // no privilegiado: dept bloqueado al suyo
          selDept.disabled = true;
          selDept.value =
            myDept != null && cacheDepartamentos.some((d) => d.id === myDept)
              ? String(myDept)
              : "";
        }

        hidDept.value = selDept.value || "";

        // Trámites según dept actual
        if (hidDept.value) {
          await paintTramitesForDept(hidDept.value);
        } else {
          selTram.disabled = true;
          fillSelect(selTram, [], "Selecciona un departamento primero");
        }
      } catch (e) {
        err("Error cargando departamentos:", e);
        selDept.disabled = true;
        fillSelect(selDept, [], "Error al cargar departamentos");
        selTram.disabled = true;
        fillSelect(selTram, [], "No hay trámites disponibles");
      }
    }

    // =========================
    // Events
    // =========================
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      await hydrateOnOpen();
      setToday();
      clearFeedback();
      hasAttemptedSubmit = false;
      openModal(modal);
    });

    selDept.addEventListener("change", async () => {
      const deptId = selDept.value || "";
      hidDept.value = deptId;

      if (deptId) {
        await paintTramitesForDept(deptId);
      } else {
        selTram.disabled = true;
        fillSelect(selTram, [], "Selecciona un departamento primero");
      }
    });

    selTram.addEventListener("change", () => {
      const tramId = selTram.value || "";
      const tramName = selTram.selectedOptions?.[0]?.textContent?.trim() || "";

      hidTram.value = tramId;
      setSubtitle(subtitle, tramName);

      const otros = isOtros(tramName);
      showAsunto(asuntoGroup, asuntoInput, otros);

      if (!otros) {
        // req_title fijo
        hidReqTitle.value = tramName;
      } else {
        // req_title viene del input asunto
        hidReqTitle.value = "";
        setTimeout(() => asuntoInput?.focus?.(), 0);
      }

      log("selección:", {
        departamento_id: hidDept.value,
        tramite_id: hidTram.value,
        req_title: hidReqTitle.value,
        otros,
      });

      // actualiza estado del botón enviar
      try {
        const v = validateForm(false);
        if (btnSend) btnSend.disabled = !v.ok || isSubmitting;
      } catch (_) {}
    });

    if (asuntoInput) {
      asuntoInput.addEventListener("input", () => {
        if (asuntoGroup?.hidden) return;
        hidReqTitle.value = String(asuntoInput.value || "").trim();
      });
    }

    log("requerimientosCanal2.js listo ✅");
  }

  window.addEventListener("DOMContentLoaded", init);
})();

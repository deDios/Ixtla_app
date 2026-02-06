// /JS/ui/requerimientosCanal2.js
(function () {
  "use strict";

  const TAG = "[ReqCanal2]";
  const log = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);
  const err = (...a) => console.error(TAG, ...a);

  // =========================
  // API HOST + Endpoints
  // =========================
  const HOST =
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net";

  const EP = {
    departamentos: `${HOST}/db/WEB/ixtla01_c_departamento.php`,
    tramites: `${HOST}/db/WEB/ixtla01_c_tramite.php`,
    cpcolonia: `${HOST}/db/WEB/ixtla01_c_cpcolonia.php`,

    //  Canal 2:
    // 1) Creamos el requerimiento "default" (canal 1 / estatus default) directo al backend
    // 2) Enseguida hacemos UPDATE para forzar canal:2 y estatus:2 (si esta jalando)
    createReq: `/webpublic_proxy.php`,
    updateReq: `${HOST}/db/WEB/ixtla01_upd_requerimiento.php`,

    // Media
    uploadImg: `${HOST}/db/WEB/ixtla01_in_requerimiento_img.php`,
  };

  // Valores destino (canal 2)
  const CANAL_TARGET = 2;
  const ESTATUS_TARGET = 2;

  // =========================
  // Home: refresco sin reload (tabla)
  // =========================
  const TABLE_SEL = {
    tbody: "#hs-table-body",
  };

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function tryHookReloadTable() {
    const fns = [
      window.Home?.reloadRequerimientos,
      window.Home?.reload,
      window.IXHome?.reloadRequerimientos,
      window.HS?.reloadRequerimientos,
      window.RequerimientosTable?.reload,
      window.Requerimientos?.reload,
    ].filter((fn) => typeof fn === "function");
    if (!fns.length) return false;
    try {
      fns[0]();
      return true;
    } catch (e) {
      warn("Hook reload tabla falló:", e);
      return false;
    }
  }

  async function fetchReqById(id) {
    // Si existe un endpoint de consulta por id, úsalo para hidratar la fila
    const ep = `${HOST}/db/WEB/ixtla01_c_requerimiento.php`;
    try {
      const json = await postNoCreds(ep, { id });
      return json?.data || null;
    } catch (e) {
      warn("No se pudo consultar requerimiento recién creado:", e);
      return null;
    }
  }

  function mapReqToRow(req, fallback) {
    const folio = req?.folio || fallback?.folio || "REQ-—";
    const dept =
      req?.departamento_nombre ||
      req?.departamento ||
      fallback?.departamento ||
      "—";
    const tramite =
      req?.tramite_nombre || req?.tramite || fallback?.tramite || "—";
    const asignado =
      req?.asignado_display || req?.asignado_a_nombre || req?.asignado || "—";
    const tel =
      req?.contacto_telefono || req?.telefono || fallback?.telefono || "—";
    const fecha =
      req?.fecha_creacion ||
      req?.created_at ||
      req?.fecha ||
      fallback?.fecha ||
      "—";
    const est =
      req?.estatus_txt ||
      req?.estatus_nombre ||
      req?.estatus ||
      fallback?.estatus ||
      "—";
    return { folio, dept, tramite, asignado, tel, fecha, est };
  }

  function prependRowToHomeTable(row) {
    const tbody = document.querySelector(TABLE_SEL.tbody);
    if (!tbody) return false;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.folio)}</td>
      <td>${escapeHtml(row.dept)}</td>
      <td>${escapeHtml(row.tramite)}</td>
      <td>${escapeHtml(row.asignado)}</td>
      <td>${escapeHtml(row.tel)}</td>
      <td>${escapeHtml(row.fecha)}</td>
      <td>${escapeHtml(String(row.est))}</td>
    `;
    tbody.prepend(tr);
    return true;
  }

  function notifyReqCreated(detail) {
    try {
      document.dispatchEvent(new CustomEvent("ix:req:created", { detail }));
    } catch { }
  }

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
  const PRESIDENCIA_DEPT_ID = 6;
  const ADMIN_ROLES = ["ADMIN"];

  // =========================
  // Helpers: POST sin credenciales
  // =========================
  async function postNoCreds(
    url,
    payload,
    { timeout = 15000, headers = {} } = {},
  ) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...headers,
        },
        credentials: "omit",
        body: JSON.stringify(payload || {}),
        signal: controller.signal,
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          json?.error ||
          json?.mensaje ||
          json?.message ||
          `${res.status} ${res.statusText}`;
        throw new Error(msg);
      }
      if (json?.ok === false) {
        throw new Error(
          json?.error || json?.mensaje || json?.message || "Respuesta ok:false",
        );
      }
      return json || {};
    } finally {
      clearTimeout(t);
    }
  }

  // =========================
  // Helpers: POST same-origin (incluye cookies) — requerido por /webpublic_proxy.php
  // =========================
  async function postSameOrigin(
    url,
    payload,
    { timeout = 15000, headers = {} } = {},
  ) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...headers,
        },
        // IMPORTANTE: el proxy valida firma con sesión/cookies
        credentials: "include",
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
    } catch { }
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

  // para que aparezca o no aparezca el campo de titulo para requermientos en "otros"
  function showAsunto(groupEl, inputEl, on) {
    if (!groupEl || !inputEl) return;
    if (on) {
      groupEl.hidden = false;
      groupEl.style.display = ""; // vuelve a su display natural
      inputEl.required = true;
    } else {
      groupEl.hidden = true;
      groupEl.style.display = "none"; // se esconde denuevo
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
      .filter((d) => Number(d.status) === 1)
      .filter(
        (d) => d.id !== PRESIDENCIA_DEPT_ID && norm(d.nombre) !== "presidencia",
      )
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

    const json = await postNoCreds(EP.tramites, { estatus: 1, all: true });
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
    // Toast
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
      NAME_MIN_CHARS: 2,
      DESC_MIN_CHARS: 0,
      PHONE_DIGITS: 10,
      PHONE_DIGITS: 0,
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

    // Fecha visible
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
          } catch { }
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
            } catch { }
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
          const dt = new DataTransfer();
          dropped.slice(0, CFG.MAX_FILES).forEach((f) => dt.items.add(f));
          if (upInput) upInput.files = dt.files;
          upInput?.dispatchEvent(new Event("change"));
        });
      }
    }

    function validateForm() {
      const deptId = String(hidDept?.value || "").trim();
      const tramId = String(hidTram?.value || "").trim();

      const cp = String(selCp?.value || "").trim();
      const col = String(selCol?.value || "").trim();
      const consent = !!chkCons?.checked;

      const tramName = selTram?.selectedOptions?.[0]?.textContent?.trim() || "";
      const otros = isOtros(tramName);
      const asunto = String(asuntoInput?.value || "").trim();

      // solo checo campos importantes
      if (!deptId) return { ok: false, firstBad: "dept" };
      if (!tramId) return { ok: false, firstBad: "tram" };
      if (!cp) return { ok: false, firstBad: "cp" };
      if (!col) return { ok: false, firstBad: "col" };
      if (!consent) return { ok: false, firstBad: "consent" };
      if (otros && asunto.length < 3) return { ok: false, firstBad: "asunto" };

      //telefono
      const telDigits = digits(inpTel?.value || "");
      if (!telDigits) return { ok: false, firstBad: "tel" };
      if (telDigits.length < CFG.PHONE_DIGITS) return { ok: false, firstBad: "tel" };

      // Evidencias
      if (files.length > CFG.MAX_FILES) return { ok: false, firstBad: "files" };

      return { ok: true };
    }

    // aviso si hace falta algo
    function getMissingForTooltip() {
      const miss = [];

      const deptId = String(hidDept?.value || "").trim();
      const tramId = String(hidTram?.value || "").trim();
      const cp = String(selCp?.value || "").trim();
      const col = String(selCol?.value || "").trim();
      const consent = !!chkCons?.checked;

      const tramName = selTram?.selectedOptions?.[0]?.textContent?.trim() || "";
      const otros = isOtros(tramName);
      const asunto = String(asuntoInput?.value || "").trim();

      const telDigits = digits(inpTel?.value || "");


      if (!telDigits || telDigits.length < CFG.PHONE_DIGITS) miss.push("Teléfono (mín 10 dígitos)");
      if (!deptId) miss.push("Departamento");
      if (!tramId) miss.push("Trámite");
      if (!cp) miss.push("C.P.");
      if (!col) miss.push("Colonia");
      if (!consent) miss.push("Aceptar términos");
      if (otros && asunto.length < 3) miss.push("Asunto (mín 3)");

      if (files.length > CFG.MAX_FILES)
        miss.push(`Máx ${CFG.MAX_FILES} evidencias`);

      return miss;
    }

    function syncSubmitState() {
      const v = validateForm();
      const missing = getMissingForTooltip();

      if (btnSend) {
        btnSend.disabled = !v.ok || isSubmitting;

        // Tooltip nativo: title
        if (!v.ok && missing.length) {
          btnSend.title = "Falta:\n- " + missing.join("\n- ");
        } else {
          btnSend.removeAttribute("title");
        }
      }
    }

    // Conecta UI
    ensureUploadUI();
    updateDescCount();
    inpDesc?.addEventListener("input", updateDescCount);

    form?.addEventListener("input", () => {
      syncSubmitState();
      if (hasAttemptedSubmit) clearFeedback();
    });

    // =========================
    // Submit
    // =========================
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (isSubmitting) return;

      clearFeedback();
      hasAttemptedSubmit = true;

      const res = validateForm();

      if (!res.ok) {
        const sel = {
          dept: `#${IDS.deptSelect}`,
          tram: `#${IDS.tramSelect}`,
          cp: "#ix-cp",
          col: "#ix-colonia",
          consent: "#ix-consent",
          asunto: "#ix-asunto",
        }[res.firstBad];

        modal.querySelector(sel || "")?.focus?.();
        const missing = getMissingForTooltip();
        showFeedback(
          missing.length
            ? `Falta completar:\n- ${missing.join("\n- ")}`
            : "Revisa los campos marcados. Hay información faltante o inválida.",
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
        // 1) INSERT default (
        const rawBody = JSON.stringify(body);

        // 1) INSERT default vía proxy firmador
        const json = await fetch(EP.createReq, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "Idempotency-Key": idempKey,
          },
          // same-origin: manda cookies automáticamente en rutas relativas
          credentials: "include",
          body: rawBody,
        }).then(async (r) => {
          let j = null;
          try {
            j = await r.json();
          } catch { }
          if (!r.ok) {
            const msg = j?.error || j?.mensaje || `HTTP ${r.status}`;
            throw new Error(msg);
          }
          if (j?.ok === false)
            throw new Error(j?.error || j?.mensaje || "ok:false");
          return j || {};
        });

        if (!json?.ok || !json?.data)
          throw new Error("Respuesta inesperada del servidor.");

        const created = json.data || {};
        const newId =
          Number(created?.id ?? created?.requerimiento_id ?? 0) || null;
        const folio =
          created?.folio ||
          // fallback: si backend no manda folio (raro), seguimos usando el formato anterior
          `REQ-${String(Date.now() % 1e10).padStart(10, "0")}`;

        // 2) UPDATE (canal 2 / estatus 3) — workaround
        if (newId) {
          try {
            await postNoCreds(EP.updateReq, {
              id: newId,
              estatus: ESTATUS_TARGET,
              canal: CANAL_TARGET,
            });
            log("update canal2 ok:", {
              id: newId,
              estatus: ESTATUS_TARGET,
              canal: CANAL_TARGET,
            });
          } catch (e2) {
            warn("update canal2 falló (no bloquea):", e2);
            toast(
              "Reporte creado, pero no se pudo ajustar canal/estatus.",
              "warn",
              4200,
            );
          }
        } else {
          warn("No vino 'id' en el insert; no se pudo hacer update canal2.", {
            created,
          });
          toast(
            "Reporte creado, pero no se pudo ajustar canal/estatus (faltó id).",
            "warn",
            4500,
          );
        }

        // 3) Evidencias (multipart)
        if (files.length) {
          const fd = new FormData();
          fd.append("folio", folio);
          fd.append("status", "0");
          files.forEach((f) => fd.append("files[]", f, f.name));

          const upRes = await fetch(EP.uploadImg, {
            method: "POST",
            body: fd,
            credentials: "omit",
          });
          let upJson = null;
          try {
            upJson = await upRes.json();
          } catch { }

          if (!upRes.ok || upJson?.ok === false) {
            const msg =
              upJson?.error || `Error al subir imágenes (HTTP ${upRes.status})`;
            toast(msg, "warn", 3800);
          } else if (upJson?.skipped?.length) {
            const names = upJson.skipped
              .map((s) => s?.name)
              .filter(Boolean)
              .join(", ");
            if (names)
              toast(`Se omitieron algunas imágenes: ${names}`, "warn", 4500);
          }
        }

        toast(`Reporte creado: ${folio}`, "ok", 3200);

        // Mini modal secundario (igual que Trámites)
        window.ixDoneModal?.open?.({
          folio,
          title: hidReqTitle?.value || tramName,
        });

        // reset
        try {
          form.reset();
        } catch { }
        setToday();
        files.forEach((f) => {
          if (f?._url) {
            try {
              URL.revokeObjectURL(f._url);
            } catch { }
          }
        });
        files = [];
        refreshPreviews();
        updateDescCount();

        closeModal(modal);

        // Refleja el nuevo requerimiento sin refresh completo
        notifyReqCreated({ id: newId, folio });

        if (!tryHookReloadTable()) {
          // fallback: intenta hidratar y prependear en tabla si existe tbody
          const hydrated = newId ? await fetchReqById(newId) : null;
          const row = mapReqToRow(hydrated, {
            folio,
            telefono: body.contacto_telefono,
            departamento: selDept?.selectedOptions?.[0]?.textContent?.trim(),
            tramite: tramName,
            estatus: ESTATUS_TARGET,
            fecha: new Date().toLocaleString("es-MX"),
          });
          const ok = prependRowToHomeTable(row);
          if (!ok)
            warn(
              "No se encontró tbody (#hs-table-body). Agrega hook reload en home.js o ajusta selector.",
            );
        }
      } catch (e1) {
        err("submit error:", e1);
        toast("No se pudo enviar el reporte.", "err", 3500);
        showFeedback(`No se pudo enviar el reporte. ${e1?.message || e1}`);
      } finally {
        isSubmitting = false;
        form.removeAttribute("aria-busy");
        if (btnSend) {
          btnSend.textContent = oldTxt;
          syncSubmitState();
        }
      }
    });

    // --- helpers internos para pintar ---
    async function paintTramitesForDept(deptId) {
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

        selCol.disabled = true;
        fillSelect(selCol, [], "Selecciona colonia");

        selCp.onchange = () => {
          const cp = selCp.value || "";
          const cols = map[cp] || [];
          selCol.disabled = !cols.length;
          fillSelect(
            selCol,
            cols.map((c) => ({ value: c, label: c })),
            cols.length ? "Selecciona colonia" : "Sin colonias",
          );
          try {
            syncSubmitState();
          } catch (_) { }
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

      hidDept.value = "";
      hidTram.value = "";
      hidReqTitle.value = "";
      setSubtitle(subtitle, "Selecciona el tipo de trámite");
      showAsunto(asuntoGroup, asuntoInput, false);

      paintCpCol();

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

        const myDept = sess?.dept_id != null ? Number(sess.dept_id) : null;

        if (rbac.canPickDept) {
          selDept.disabled = false;

          if (
            myDept != null &&
            cacheDepartamentos.some((d) => Number(d.id) === Number(myDept))
          ) {
            selDept.value = String(myDept);
          } else {
            selDept.value = "";
          }
        } else {
          selDept.disabled = true;
          selDept.value =
            myDept != null && cacheDepartamentos.some((d) => d.id === myDept)
              ? String(myDept)
              : "";
        }

        hidDept.value = selDept.value || "";

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
      openModal(modal);
      setToday();
      clearFeedback();
      hasAttemptedSubmit = false;
      try {
        syncSubmitState();
      } catch (_) { }
    });

    selDept.addEventListener("change", async () => {
      const deptId = selDept.value || "";
      hidDept.value = deptId;

      if (deptId) {
        await paintTramitesForDept(deptId);
        try {
          syncSubmitState();
        } catch (_) { }
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
        hidReqTitle.value = tramName;
      } else {
        hidReqTitle.value = "";
        setTimeout(() => asuntoInput?.focus?.(), 0);
      }

      log("selección:", {
        departamento_id: hidDept.value,
        tramite_id: hidTram.value,
        req_title: hidReqTitle.value,
        otros,
      });

      try {
        syncSubmitState();
      } catch (_) { }
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

// ==============================
// Mini modal DONE: ixDoneModal
// (requiere que exista #ix-done-modal en el DOM)
// ==============================
(function () {
  const root = document.getElementById("ix-done-modal");
  if (!root) return;

  const overlay = root.querySelector("[data-ix-close], [data-close]");
  const closes = root.querySelectorAll("[data-ix-close], [data-close]");
  const subEl = root.querySelector("#ix-done-subtitle");
  const folioEl = root.querySelector("#ix-done-folio");

  function open({ folio = "—", title = "—" } = {}) {
    if (subEl) subEl.textContent = title || "—";
    if (folioEl) folioEl.textContent = folio || "—";
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
  }

  function close() {
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKey);
  }

  function onKey(e) {
    if (e.key === "Escape") close();
  }

  overlay?.addEventListener("click", close);
  closes.forEach((b) => b.addEventListener("click", close));

  // Estado inicial: aseguramos cerrado
  try {
    close();
  } catch { }

  window.ixDoneModal = { open, close };
})();

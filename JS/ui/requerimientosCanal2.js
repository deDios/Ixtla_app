// /JS/ui/requerimientosCanal2.js
(function () {
  "use strict";

  const TAG = "[ReqCanal2]";
  const log = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);
  const error = (...a) => console.error(TAG, ...a);

  // ===== Host/API (igual que tareas.js) =====
  const API_HOST =
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net";

  // Endpoints (ojo: departamento SINGULAR)
  const ENDPOINTS = {
    deps: `${API_HOST}/db/WEB/ixtla01_c_departamento.php`,
    tramites: `${API_HOST}/db/WEB/ixtla01_c_tramite.php`,
  };

  // ===== Config RBAC =====
  const CONFIG = {
    PRESIDENCIA_DEPT_IDS: [6],
    ADMIN_ROLES: ["ADMIN"],
  };

  // ===== IDs esperados en DOM =====
  const IDS = {
    btnOpen: "hs-btn-new-req",
    modal: "ix-report-modal",
    deptSelect: "ix-departamento-select",
    tramSelect: "ix-tramite-select",
    hidDept: "ix-departamento-id",
    hidTram: "ix-tramite-id",
    hidReqTitle: "ix-report-req",
    subtitle: "ix-report-subtitle",
    asuntoGroup: "ix-asunto-group",
    asuntoInput: "ix-asunto",
  };

  // =========================================================
  //  Helper: POST JSON SIN CREDENCIALES (para catálogos)
  // =========================================================
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
        // IMPORTANT: sin cookies
        credentials: "omit",
        body: JSON.stringify(payload || {}),
        signal: controller.signal,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText} ${txt}`.trim());
      }

      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  // =========================================================
  //  Sesión: Session.get() o cookie ix_emp (fallback)
  // =========================================================
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
    const dept_id = s?.departamento_id ?? s?.dept_id ?? null; // por si Home usa wrapper
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

    const isAdmin = roles.some((r) => CONFIG.ADMIN_ROLES.includes(r));
    const isPres = CONFIG.PRESIDENCIA_DEPT_IDS.includes(dept);

    return { isAdmin, isPres, canPickDept: isAdmin || isPres };
  }

  // =========================================================
  //  Modal open/close
  // =========================================================
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

  // =========================================================
  //  Helpers UI
  // =========================================================
  function setSubtitle(el, txt) {
    if (!el) return;
    el.textContent = txt || "Selecciona el tipo de trámite";
  }

  function normalizeName(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function isOtros(nombreTramite) {
    return normalizeName(nombreTramite) === "otros";
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

  function paintOptions(selectEl, items, placeholder) {
    selectEl.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.disabled = true;
    opt0.selected = true;
    opt0.textContent = placeholder || "Selecciona una opción";
    selectEl.appendChild(opt0);

    items.forEach((it) => {
      const opt = document.createElement("option");
      opt.value = String(it.value);
      opt.textContent = it.label;
      if (it.dataset) {
        Object.entries(it.dataset).forEach(
          ([k, v]) => (opt.dataset[k] = String(v)),
        );
      }
      selectEl.appendChild(opt);
    });
  }

  // =========================================================
  //  Data loaders
  // =========================================================
  async function fetchDepartamentos() {
    // patrón tareas.js: { all:true, page:1, page_size:100 }
    const json = await postNoCreds(ENDPOINTS.deps, {
      all: true,
      page: 1,
      page_size: 100,
    });

    const rows = Array.isArray(json?.data) ? json.data : [];
    // Soporta diferentes shapes (por si backend cambia nombres)
    const out = rows
      .map((r) => ({
        id: Number(r?.id),
        nombre: String(r?.nombre || r?.departamento_nombre || "").trim(),
        status: Number(r?.status ?? 1),
      }))
      .filter((d) => d.id && d.nombre)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    return out;
  }

  async function fetchTramites(depId) {
    // patrón tareas.js: { estatus:1, all:true } y luego filtrar por dept en client
    const json = await postNoCreds(ENDPOINTS.tramites, {
      estatus: 1,
      all: true,
    });
    const rows = Array.isArray(json?.data) ? json.data : [];

    const out = rows
      .filter((r) => Number(r?.estatus ?? 1) === 1)
      .filter((r) => Number(r?.departamento_id) === Number(depId))
      .map((r) => ({
        id: Number(r?.id),
        departamento_id: Number(r?.departamento_id),
        nombre: String(r?.nombre || "").trim(),
        descripcion: String(r?.descripcion || "").trim(),
      }))
      .filter((t) => t.id && t.nombre)
      .sort((a, b) => a.id - b.id);

    return out;
  }

  // =========================================================
  //  Init
  // =========================================================
  async function init() {
    const btn = document.getElementById(IDS.btnOpen);
    const modal = document.getElementById(IDS.modal);
    if (!btn || !modal) return;

    const selDept = modal.querySelector(`#${IDS.deptSelect}`);
    const selTram = modal.querySelector(`#${IDS.tramSelect}`);

    const hidDept = modal.querySelector(`#${IDS.hidDept}`);
    const hidTram = modal.querySelector(`#${IDS.hidTram}`);
    const hidReqTitle = modal.querySelector(`#${IDS.hidReqTitle}`);

    const subtitle = modal.querySelector(`#${IDS.subtitle}`);
    const asuntoGroup = modal.querySelector(`#${IDS.asuntoGroup}`);
    const asuntoInput = modal.querySelector(`#${IDS.asuntoInput}`);

    if (!selDept || !selTram || !hidDept || !hidTram || !hidReqTitle) {
      warn("Faltan elementos del modal (IDs). Revisa el HTML.");
      return;
    }

    // Close hooks
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

    // Cache para no refetchear siempre
    let depsCache = null;
    const tramCache = new Map(); // depId -> tramites[]

    async function hydrateForOpen() {
      const sess = readSession();
      const rbac = computeRBAC(sess);

      log("sesión:", sess);
      log("RBAC:", rbac);

      // reset visual + hidden
      hidDept.value = "";
      hidTram.value = "";
      hidReqTitle.value = "";
      setSubtitle(subtitle, "Selecciona el tipo de trámite");
      showAsunto(asuntoGroup, asuntoInput, false);

      // cargar departamentos
      selDept.disabled = true;
      paintOptions(selDept, [], "Cargando departamentos…");

      try {
        depsCache = depsCache || (await fetchDepartamentos());
      } catch (e) {
        error("No pude cargar departamentos:", e);
        paintOptions(selDept, [], "Error al cargar departamentos");
        return;
      }

      paintOptions(
        selDept,
        depsCache.map((d) => ({ value: d.id, label: d.nombre })),
        "Selecciona un departamento",
      );

      const myDept = sess?.dept_id != null ? Number(sess.dept_id) : null;

      if (!rbac.canPickDept) {
        selDept.disabled = true;
        selDept.value = myDept != null ? String(myDept) : "";
      } else {
        selDept.disabled = false;
        // precarga su dept si existe
        if (myDept != null) selDept.value = String(myDept);
      }

      hidDept.value = selDept.value || "";

      // trámites según dept actual
      if (selDept.value) {
        await paintTramitesForDept(selDept.value);
      } else {
        selTram.disabled = true;
        paintOptions(selTram, [], "Selecciona un departamento primero");
      }
    }

    async function paintTramitesForDept(depId) {
      // reset trámite
      hidTram.value = "";
      hidReqTitle.value = "";
      setSubtitle(subtitle, "Selecciona el tipo de trámite");
      showAsunto(asuntoGroup, asuntoInput, false);

      selTram.disabled = true;
      paintOptions(selTram, [], "Cargando trámites…");

      let rows = tramCache.get(String(depId));
      if (!rows) {
        try {
          rows = await fetchTramites(depId);
          tramCache.set(String(depId), rows);
        } catch (e) {
          error("No pude cargar trámites:", e);
          paintOptions(selTram, [], "Error al cargar trámites");
          return;
        }
      }

      if (!rows.length) {
        selTram.disabled = true;
        paintOptions(selTram, [], "No hay trámites disponibles");
        return;
      }

      selTram.disabled = false;
      paintOptions(
        selTram,
        rows.map((t) => ({
          value: t.id,
          label: t.nombre,
          dataset: { desc: t.descripcion || "" },
        })),
        "Selecciona un trámite",
      );
    }

    // ===== Events =====
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      await hydrateForOpen();
      openModal(modal);
    });

    selDept.addEventListener("change", async () => {
      const depId = selDept.value || "";
      hidDept.value = depId;

      // al cambiar dept, repinta trámites
      if (depId) await paintTramitesForDept(depId);
      else {
        selTram.disabled = true;
        paintOptions(selTram, [], "Selecciona un departamento primero");
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
        // Trámite normal: req_title fijo = nombre del trámite
        hidReqTitle.value = tramName;
      } else {
        // Otros: req_title lo decide el usuario con "asunto"
        hidReqTitle.value = "";
        setTimeout(() => asuntoInput?.focus?.(), 0);
      }

      log("selección:", {
        departamento_id: hidDept.value,
        tramite_id: hidTram.value,
        req_title: hidReqTitle.value,
        otros,
      });
    });

    // Si es "Otros": req_title se actualiza desde el input asunto
    if (asuntoInput) {
      asuntoInput.addEventListener("input", () => {
        if (asuntoGroup?.hidden) return;
        hidReqTitle.value = String(asuntoInput.value || "").trim();
      });
    }

    log("Listo: requerimientosCanal2.js (catálogos sin credenciales).");
  }

  window.addEventListener("DOMContentLoaded", init);
})();

// /JS/ui/requerimientosCanal2.js
import { postJSON } from "/JS/api/http.js";

(function () {
  "use strict";

  const TAG = "[ReqCanal2]";
  const log = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);
  const err = (...a) => console.error(TAG, ...a);

  // ===== Endpoints =====
  const ENDPOINTS = {
    deps: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamentos.php",
    tramites:
      "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_tramite.php",
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

  // ===== Helpers: sesión (Session.get / cookie ix_emp) =====
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
    const dept_id = s?.departamento_id ?? null;
    const roles = Array.isArray(s?.roles)
      ? s.roles.map((r) => String(r).toUpperCase())
      : [];

    return { empleado_id, dept_id, roles };
  }

  function computeRBAC(sess) {
    const dept = Number(sess?.dept_id);
    const roles = sess?.roles || [];
    const isAdmin = roles.some((r) => CONFIG.ADMIN_ROLES.includes(r));
    const isPres = CONFIG.PRESIDENCIA_DEPT_IDS.includes(dept);
    return { isAdmin, isPres, canPickDept: isAdmin || isPres };
  }

  // ===== Helpers modal =====
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

  // ===== Helpers UI =====
  function setSelectLoading(selectEl, on, placeholder = "Cargando…") {
    if (!selectEl) return;
    selectEl.disabled = !!on || selectEl.disabled;
    if (on) {
      selectEl.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
    }
  }

  function normalizeName(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function isOtros(tramiteNombre) {
    return normalizeName(tramiteNombre) === "otros";
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

  // ===== Data loaders =====
  async function fetchDepartamentos() {
    // en tramiteDepartamentos.js: { status: 1 }
    const json = await postJSON(
      ENDPOINTS.deps,
      { status: 1 },
      { timeout: 15000 },
    );
    const rows = Array.isArray(json?.data) ? json.data : [];
    // normaliza a {id, nombre}
    return rows
      .map((r) => ({
        id: Number(r?.id),
        nombre: String(r?.nombre || "").trim(),
        status: Number(r?.status ?? 1),
      }))
      .filter((d) => d.id && d.nombre)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  async function fetchTramitesByDept(depId) {
    const json = await postJSON(
      ENDPOINTS.tramites,
      { departamento_id: Number(depId), all: true },
      { timeout: 15000 },
    );
    const raw = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json)
        ? json
        : [];
    const rows = raw
      .filter((r) => Number(r?.departamento_id) === Number(depId))
      .filter((r) => r?.estatus === undefined || Number(r?.estatus) === 1)
      .map((r) => ({
        id: Number(r?.id),
        nombre: String(r?.nombre || "").trim(),
        descripcion: String(r?.descripcion || "").trim(),
      }))
      .filter((t) => t.id && t.nombre);

    // Orden asc por id, como tu render original
    rows.sort((a, b) => a.id - b.id);
    return rows;
  }

  // ===== Main init =====
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
      warn("Faltan IDs del modal (selects o hidden). Revisa el HTML.");
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

    // cache local (para no refetchear si vuelves a abrir)
    let depsCache = null;
    const tramitesCacheByDept = new Map(); // depId -> [{id,nombre,descripcion}]

    async function paintDepartamentosAndRBAC() {
      const sess = readSession();
      const rbac = computeRBAC(sess);

      log("sesión:", sess);
      log("RBAC:", rbac);

      // default values
      hidTram.value = "";
      hidReqTitle.value = "";
      if (subtitle) subtitle.textContent = "Selecciona el tipo de trámite";
      showAsunto(asuntoGroup, asuntoInput, false);

      // cargar deps
      setSelectLoading(selDept, true, "Cargando departamentos…");
      try {
        depsCache = depsCache || (await fetchDepartamentos());
      } catch (e) {
        err("No pude cargar departamentos:", e);
        selDept.innerHTML =
          '<option value="" disabled selected>Error al cargar departamentos</option>';
        return;
      }

      selDept.innerHTML =
        '<option value="" disabled selected>Selecciona un departamento</option>';

      depsCache.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = String(d.id);
        opt.textContent = d.nombre;
        selDept.appendChild(opt);
      });

      const myDept = sess?.dept_id != null ? Number(sess.dept_id) : null;

      if (!rbac.canPickDept) {
        selDept.disabled = true;
        selDept.value = myDept != null ? String(myDept) : "";
      } else {
        selDept.disabled = false;
        // sugerencia: precarga su depto si existe
        if (myDept != null) selDept.value = String(myDept);
      }

      // set hidden dept
      hidDept.value = selDept.value ? String(selDept.value) : "";

      // cargar trámites del dept actual (si ya hay valor)
      if (selDept.value) {
        await paintTramitesForDept(selDept.value);
      } else {
        selTram.innerHTML =
          '<option value="" disabled selected>Selecciona un departamento primero</option>';
      }
    }

    async function paintTramitesForDept(depId) {
      // reset trámite
      hidTram.value = "";
      hidReqTitle.value = "";
      if (subtitle) subtitle.textContent = "Selecciona el tipo de trámite";
      showAsunto(asuntoGroup, asuntoInput, false);

      // loading
      selTram.disabled = false;
      selTram.innerHTML =
        '<option value="" disabled selected>Cargando trámites…</option>';

      let rows = tramitesCacheByDept.get(String(depId));
      if (!rows) {
        try {
          rows = await fetchTramitesByDept(depId);
          tramitesCacheByDept.set(String(depId), rows);
        } catch (e) {
          err("No pude cargar trámites:", e);
          selTram.innerHTML =
            '<option value="" disabled selected>Error al cargar trámites</option>';
          return;
        }
      }

      selTram.innerHTML =
        '<option value="" disabled selected>Selecciona un trámite</option>';

      rows.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = String(t.id);
        opt.textContent = t.nombre;
        // guarda descripción por si luego quieres pintarla
        opt.dataset.desc = t.descripcion || "";
        selTram.appendChild(opt);
      });

      if (!rows.length) {
        selTram.innerHTML =
          '<option value="" disabled selected>No hay trámites disponibles</option>';
        selTram.disabled = true;
      }
    }

    // ===== Events =====
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      await paintDepartamentosAndRBAC();
      openModal(modal);
    });

    selDept.addEventListener("change", async () => {
      const depId = selDept.value ? String(selDept.value) : "";
      hidDept.value = depId;

      // al cambiar dept, hay que repintar trámites
      if (depId) {
        await paintTramitesForDept(depId);
      } else {
        selTram.innerHTML =
          '<option value="" disabled selected>Selecciona un departamento primero</option>';
      }
    });

    selTram.addEventListener("change", () => {
      const tramId = selTram.value ? String(selTram.value) : "";
      const tramName = selTram.selectedOptions?.[0]?.textContent?.trim() || "";

      hidTram.value = tramId;

      // Si NO es "Otros" → req_title = nombre del trámite
      // Si es "Otros" → se muestra clasificación y req_title se arma desde "asunto"
      const otros = isOtros(tramName);

      showAsunto(asuntoGroup, asuntoInput, otros);

      if (subtitle)
        subtitle.textContent = tramName || "Selecciona el tipo de trámite";

      if (!otros) {
        hidReqTitle.value = tramName; // fijo
      } else {
        hidReqTitle.value = ""; // lo llenaremos con asunto al escribir
        // focus al input de asunto para guiar
        setTimeout(() => asuntoInput?.focus?.(), 0);
      }

      log("selección:", {
        departamento_id: hidDept.value,
        tramite_id: hidTram.value,
        req_title: hidReqTitle.value,
        otros,
      });
    });

    // Si el trámite es "Otros", el req_title debe venir del input asunto
    if (asuntoInput) {
      asuntoInput.addEventListener("input", () => {
        // solo aplica cuando está visible / required
        const on = !asuntoGroup?.hidden;
        if (!on) return;
        hidReqTitle.value = String(asuntoInput.value || "").trim();
      });
    }

    log("Listo: requerimientosCanal2.js cargado (APIs + RBAC + modal).");
  }

  window.addEventListener("DOMContentLoaded", init);
})();

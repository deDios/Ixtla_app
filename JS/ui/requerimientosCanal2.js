// JS\ui\requerimientosCanal2.js
(function () {
  "use strict";

  const TAG = "[HomeReqModal]";
  const log = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);

  // ===== Selectores esperados =====
  const BTN_OPEN_ID = "hs-btn-new-req";
  const MODAL_ID = "ix-report-modal";

  // ===== Config RBAC (alineado a home.js / guard) =====
  const CONFIG = {
    ADMIN_ROLES: ["ADMIN"],
    PRESIDENCIA_DEPT_IDS: [6],
  };

  // ===== Helpers sesión: igual que guard/home (Session.get o cookie ix_emp) =====
  function readCookiePayload() {
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

  function readSessionLike() {
    let s = null;
    try {
      s = window.Session?.get?.() || null;
    } catch {}
    if (!s) s = readCookiePayload() || null;

    if (!s) {
      return { empleado_id: null, dept_id: null, roles: [], id_usuario: null };
    }

    const empleado_id = s?.empleado_id ?? s?.id_empleado ?? null;
    const dept_id = s?.departamento_id ?? null;
    const roles = Array.isArray(s?.roles)
      ? s.roles.map((r) => String(r).toUpperCase())
      : [];
    const id_usuario = s?.id_usuario ?? s?.cuenta_id ?? null;

    return { empleado_id, dept_id, roles, id_usuario };
  }

  function computeRBAC(session) {
    const { dept_id, roles } = session;
    const isAdmin = (roles || []).some((r) => CONFIG.ADMIN_ROLES.includes(r));
    const isPres = CONFIG.PRESIDENCIA_DEPT_IDS.includes(Number(dept_id));
    const isDir = (roles || []).includes("DIRECTOR");
    const isJefe = (roles || []).includes("JEFE");
    const isAnal = (roles || []).includes("ANALISTA");
    // NOTA: primera línea (PL) se calcula async en home.js, aquí lo dejamos en false para demo
    const soyPL = false;

    return { isAdmin, isPres, isDir, soyPL, isJefe, isAnal };
  }

  // ===== Modal open/close (usa hidden + aria-hidden) =====
  function openModal(modal) {
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    // focus al primer input/select
    const first = modal.querySelector(
      "select, input, textarea, button, [tabindex]:not([tabindex='-1'])"
    );
    first?.focus?.();
  }

  function closeModal(modal) {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  function init() {
    const btn = document.getElementById(BTN_OPEN_ID);
    const modal = document.getElementById(MODAL_ID);

    if (!btn) {
      warn("No encuentro el botón:", `#${BTN_OPEN_ID}`);
      return;
    }
    if (!modal) {
      warn("No encuentro el modal:", `#${MODAL_ID}`);
      return;
    }

    // hooks modal
    const closeEls = modal.querySelectorAll("[data-ix-close]");
    const overlay = modal.querySelector(".ix-modal__overlay");
    const subtitle = modal.querySelector("#ix-report-subtitle");

    // campos/modal
    const selDept = modal.querySelector("#ix-departamento-select");
    const selTram = modal.querySelector("#ix-tramite-select");

    const hidDept = modal.querySelector("#ix-departamento-id");
    const hidTram = modal.querySelector("#ix-tramite-id");
    const hidTitle = modal.querySelector("#ix-report-req");

    if (!selDept || !selTram || !hidDept || !hidTram || !hidTitle) {
      warn("Faltan elementos del modal (selects o hidden inputs). Revisa IDs.");
      return;
    }

    // ===== DEMO DATA (solo para probar roles/UI) =====
    const demoDepartamentos = [
      { id: 4, nombre: "Servicios Públicos" },
      { id: 6, nombre: "Presidencia" },
      { id: 7, nombre: "Obras Públicas" },
    ];

    const demoTramitesByDept = {
      4: [
        { id: 101, nombre: "Alumbrado público" },
        { id: 102, nombre: "Recolección de basura" },
      ],
      6: [
        { id: 201, nombre: "Atención ciudadana" },
        { id: 202, nombre: "Gestión interna" },
      ],
      7: [
        { id: 301, nombre: "Bacheo" },
        { id: 302, nombre: "Fuga de agua" },
      ],
    };

    function paintDeptOptions() {
      selDept.innerHTML =
        '<option value="" disabled selected>Selecciona un departamento</option>';
      demoDepartamentos.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = String(d.id);
        opt.textContent = d.nombre;
        selDept.appendChild(opt);
      });
    }

    function paintTramites(depId) {
      const arr = demoTramitesByDept[String(depId)] || [];
      selTram.innerHTML =
        '<option value="" disabled selected>Selecciona un trámite</option>';

      arr.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = String(t.id);
        opt.textContent = t.nombre;
        selTram.appendChild(opt);
      });

      // reset hidden relacionados
      hidTram.value = "";
      hidTitle.value = "";
      if (subtitle) subtitle.textContent = "Selecciona el tipo de trámite";
    }

    function applyRBACAndPrefill() {
      const session = readSessionLike();
      const rbac = computeRBAC(session);

      log("sesión detectada:", session);
      log("RBAC flags (demo):", rbac);

      const canPickDept = rbac.isAdmin || rbac.isPres;

      // Cargar combos
      paintDeptOptions();

      // Set dept por default (si no es admin/pres, lo fijamos)
      const myDept = session?.dept_id != null ? Number(session.dept_id) : null;

      if (!canPickDept) {
        // bloqueado al depto del usuario
        selDept.value = myDept != null ? String(myDept) : "";
        selDept.disabled = true;
      } else {
        // admin/pres puede cambiar
        selDept.disabled = false;
        // sugerencia: precargar su depto si existe
        selDept.value = myDept != null ? String(myDept) : "";
      }

      // refleja en hidden
      hidDept.value = selDept.value ? String(selDept.value) : "";

      // poblar trámites segun dept actual (si hay)
      if (selDept.value) paintTramites(selDept.value);
    }

    // ===== Eventos =====
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      applyRBACAndPrefill();
      openModal(modal);
    });

    closeEls.forEach((el) =>
      el.addEventListener("click", (e) => {
        e.preventDefault();
        closeModal(modal);
      })
    );

    overlay?.addEventListener("click", () => closeModal(modal));

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) closeModal(modal);
    });

    // Cuando cambia depto (solo admin/pres normalmente)
    selDept.addEventListener("change", () => {
      hidDept.value = selDept.value ? String(selDept.value) : "";
      paintTramites(selDept.value);
    });

    // Cuando cambia trámite: set hidden + subtitle + req_title demo
    selTram.addEventListener("change", () => {
      const tramId = selTram.value ? String(selTram.value) : "";
      const tramName = selTram.selectedOptions?.[0]?.textContent?.trim() || "";

      hidTram.value = tramId;
      hidTitle.value = tramName; // demo: req_title = nombre del trámite
      if (subtitle) subtitle.textContent = tramName || "Selecciona el tipo de trámite";

      log("tramite seleccionado:", { tramite_id: hidTram.value, req_title: hidTitle.value });
    });

    log("init OK: botón abre modal + RBAC demo + combos demo");
  }

  window.addEventListener("DOMContentLoaded", init);
})();

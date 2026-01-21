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

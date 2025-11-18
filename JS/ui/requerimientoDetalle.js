// /JS/ui/requerimientoDetalle.js
(function () {
  "use strict";

  const TAG = "[ReqDetalle]";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const log = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);
  const err = (...a) => console.error(TAG, ...a);
  const toast = (m, t = "info") =>
    window.gcToast ? gcToast(m, t) : log("[toast]", t, m);

  const norm = (s = "") =>
    String(s)
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();

  /* =========================
   * Endpoints
   * ========================= */
  const ENDPOINTS = {
    DEPT_LIST_PRIMARY:
      "http://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php",
    DEPT_LIST_LOCAL: "/db/WEB/ixtla01_c_departamento.php",
    DEPT_LIST_UPPER: "/DB/WEB/ixtla01_c_departamento.php",
    EMPLEADOS_LIST:
      "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_empleado.php",
    DEPTS_LIST:
      "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php",
    REQ_UPDATE: "/db/WEB/ixtla01_upd_requerimiento.php",
    CCP_LIST: "https://ixtla-app.com/db/web/ixtla01_c_ccp.php", // 🆕 motivos pausa/cancelación
  };

  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body || {}),
    });
    const txt = await res.text();
    let json;
    try {
      json = JSON.parse(txt);
    } catch {
      json = { raw: txt };
    }
    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
    if (json?.ok === false)
      throw new Error(json?.error || "Operación no exitosa");
    return json ?? {};
  }

  /* =========================
   * Session helpers (idéntico patrón Planeación)
   * ========================= */
  function safeGetSession() {
    try {
      if (window.Session?.get) return window.Session.get();
    } catch {}
    try {
      const pair = document.cookie
        .split("; ")
        .find((c) => c.startsWith("ix_emp="));
      if (!pair) return null;
      const raw = decodeURIComponent(pair.split("=")[1] || "");
      const json = JSON.parse(decodeURIComponent(escape(atob(raw))));
      if (json && typeof json === "object") return json;
    } catch {}
    return null;
  }
  function getEmpleadoId() {
    const s = safeGetSession();
    return s?.empleado_id ?? s?.id_empleado ?? null;
  }
  function getDeptId() {
    const s = safeGetSession();
    return s?.departamento_id ?? s?.dept_id ?? null;
  }
  function getRoles() {
    const s = safeGetSession();
    return Array.isArray(s?.roles)
      ? s.roles.map((x) => String(x).toUpperCase())
      : [];
  }

  /* =========================
   * RBAC empleados (traído de Planeación)
   * ========================= */
  function normalizeEmpleadoFromAPI(r = {}) {
    const reporta_a =
      r.reporta_a != null
        ? r.reporta_a
        : r.cuenta && r.cuenta.reporta_a != null
        ? r.cuenta.reporta_a
        : null;
    const roles = Array.isArray(r.cuenta?.roles)
      ? r.cuenta.roles.map((x) => x?.codigo).filter(Boolean)
      : [];
    const rolCodes = roles.map((x) => String(x).toUpperCase());
    return {
      id: Number(r.id),
      nombre: String(r.nombre || "").trim(),
      apellidos: String(r.apellidos || "").trim(),
      full:
        [r.nombre, r.apellidos].filter(Boolean).join(" ").trim() ||
        `Empleado #${r.id}`,
      departamento_id:
        r.departamento_id != null ? Number(r.departamento_id) : null,
      reporta_a: reporta_a != null ? Number(reporta_a) : null,
      rolCodes,
    };
  }
  async function fetchEmpleadosAll() {
    const j = await postJSON(ENDPOINTS.EMPLEADOS_LIST, {
      page: 1,
      page_size: 500,
      status: 1,
    });
    const arr = Array.isArray(j?.data) ? j.data : [];
    return arr.map(normalizeEmpleadoFromAPI);
  }
  async function fetchDepartamentosRBAC() {
    const j = await postJSON(ENDPOINTS.DEPTS_LIST, {
      page: 1,
      page_size: 200,
      status: 1,
    });
    const arr = Array.isArray(j?.data) ? j.data : [];
    return arr.map((d) => ({
      id: Number(d.id),
      nombre: String(d.nombre || "").trim(),
      director: d.director != null ? Number(d.director) : null,
      primera_linea: d.primera_linea != null ? Number(d.primera_linea) : null,
    }));
  }
  function getReportesTransitivos(universe, jefeId) {
    const mapByBoss = new Map();
    universe.forEach((emp) => {
      const boss = emp.reporta_a != null ? Number(emp.reporta_a) : null;
      if (boss == null) return;
      if (!mapByBoss.has(boss)) mapByBoss.set(boss, []);
      mapByBoss.get(boss).push(emp);
    });
    const visited = new Set();
    const queue = [Number(jefeId)];
    const out = [];
    while (queue.length) {
      const cur = queue.shift();
      const kids = mapByBoss.get(cur) || [];
      for (const k of kids) {
        if (visited.has(k.id)) continue;
        visited.add(k.id);
        out.push(k);
        queue.push(k.id);
      }
    }
    return out;
  }
  async function buildAsignablesList() {
    const yoId = Number(getEmpleadoId());
    const deptId = Number(getDeptId());
    const roles = getRoles();
    const isAdmin = roles.includes("ADMIN");
    const isDirector = roles.includes("DIRECTOR");
    const isPL =
      roles.includes("PRIMERA_LINEA") ||
      roles.includes("PL") ||
      roles.includes("PRIMERA LINEA");
    const isJefe = roles.includes("JEFE");

    const universe = await fetchEmpleadosAll();
    if (isAdmin) return universe;

    const PRES_DEPT_IDS = [6];
    if (PRES_DEPT_IDS.includes(deptId)) return universe;

    if (isDirector || isPL) {
      const depts = await fetchDepartamentosRBAC();
      const visibleDeptIds = new Set(
        depts
          .filter((d) => d.director === yoId || d.primera_linea === yoId)
          .map((d) => d.id)
      );
      if (deptId) visibleDeptIds.add(deptId);
      const inDepts = universe.filter((e) =>
        visibleDeptIds.has(Number(e.departamento_id))
      );
      const reports = getReportesTransitivos(universe, yoId);
      const self = universe.find((e) => e.id === yoId);
      const map = new Map();
      [...inDepts, ...reports, ...(self ? [self] : [])].forEach((e) =>
        map.set(e.id, e)
      );
      return Array.from(map.values());
    }

    if (isJefe) {
      const self = universe.find((e) => e.id === yoId);
      const direct = universe.filter((e) => e.reporta_a === yoId);
      const map = new Map();
      if (self) map.set(self.id, self);
      direct.forEach((e) => map.set(e.id, e));
      return Array.from(map.values());
    }

    const self = universe.find((e) => e.id === yoId);
    return self ? [self] : [];
  }

  /* =========================
   * Dept pick (para líder y nombre)
   * ========================= */
  async function fetchDeptsWithFallback() {
    const payload = { page: 1, page_size: 200, status: 1 };
    const urls = [
      ENDPOINTS.DEPT_LIST_PRIMARY,
      ENDPOINTS.DEPT_LIST_LOCAL,
      ENDPOINTS.DEPT_LIST_UPPER,
    ];
    for (const url of urls) {
      try {
        const res = await postJSON(url, payload);
        const arr = Array.isArray(res?.data) ? res.data : [];
        if (arr.length) return arr;
      } catch (e) {
        warn("[Dept] fallo endpoint:", url, e);
      }
    }
    return [];
  }
  async function getDeptByIdOrName({ id, nombre }) {
    const wantedId = id != null ? Number(id) : null;
    const wantedName = nombre ? norm(nombre) : null;
    const arr = await fetchDeptsWithFallback();
    if (!arr.length) return { dept: null, director: null };

    let dept = null;
    if (wantedId) dept = arr.find((x) => Number(x.id) === wantedId) || null;
    if (!dept && wantedName) {
      dept =
        arr.find((x) => norm(x?.nombre || "") === wantedName) ||
        arr.find((x) => norm(x?.nombre || "").startsWith(wantedName)) ||
        null;
    }
    if (!dept && arr.length === 1) dept = arr[0] || null;
    if (!dept) return { dept: null, director: null };

    const info = {
      id: Number(dept.id),
      nombre: String(dept.nombre || "—"),
      director_id: Number(dept.director ?? 0) || null,
      director_nombre: String(dept.director_nombre || ""),
      director_apellidos: String(dept.director_apellidos || ""),
    };
    const fullDir = [info.director_nombre, info.director_apellidos]
      .filter(Boolean)
      .join(" ")
      .trim();
    const director = fullDir ? { id: info.director_id, nombre: fullDir } : null;
    return { dept: { id: info.id, nombre: info.nombre }, director };
  }

  /* =========================
   * Motivos CCP (pausa / cancelación)
   * ========================= */
  async function fetchMotivosCCP(requerimientoId) {
    const j = await postJSON(ENDPOINTS.CCP_LIST, {
      requerimiento_id: Number(requerimientoId),
      status: 1,
      page: 1,
      per_page: 50,
    });
    const arr = Array.isArray(j?.data) ? j.data : [];
    return arr;
  }

  async function fillMotivoField(req, estatus) {
    const nodo = document.getElementById("req-motivo");
    if (!nodo) return;
    nodo.textContent = "—";

    // Solo aplica si está pausado o cancelado
    if (estatus !== 4 && estatus !== 5) return;

    const tipo = estatus === 4 ? 2 : 1; // 2 = pausa, 1 = cancelación

    try {
      const motivos = await fetchMotivosCCP(req.id);
      const filtrados = motivos.filter(
        (m) => Number(m.tipo) === tipo && (m.status == null || Number(m.status) === 1)
      );

      if (!filtrados.length) return;

      // Tomar el más reciente por fecha / id
      filtrados.sort((a, b) => {
        const da = Date.parse(a.created_at || a.fecha || "") || 0;
        const db = Date.parse(b.created_at || b.fecha || "") || 0;
        if (db !== da) return db - da;
        const ida = Number(a.id || 0);
        const idb = Number(b.id || 0);
        return idb - ida;
      });

      const motivo = filtrados[0]?.comentario || "—";
      nodo.textContent = motivo;
    } catch (e) {
      warn("Error cargando motivo CCP:", e);
      // dejamos "—"
    }
  }

  /* =========================
   * Pintar TAB "detalles"
   * ========================= */
  function putDetalle(labelStartsWith, value) {
    const grid = $('.exp-pane[role="tabpanel"][data-tab="detalles"] .exp-grid');
    if (!grid) return false;
    const row = Array.from(grid.querySelectorAll(".exp-field")).find((r) => {
      const t = (r.querySelector("label")?.textContent || "")
        .trim()
        .toLowerCase();
      return t.startsWith(labelStartsWith.toLowerCase());
    });
    const dd = row?.querySelector(".exp-val");
    if (!dd) return false;

    dd.textContent = value ?? "—";
    return true;
  }

  function attachAsignarButton() {
    // Ubica la fila "Asignado"
    const grid = $('.exp-pane[role="tabpanel"][data-tab="detalles"] .exp-grid');
    if (!grid) return null;
    const row = Array.from(grid.querySelectorAll(".exp-field")).find((r) => {
      const t = (r.querySelector("label")?.textContent || "")
        .trim()
        .toLowerCase();
      return t.startsWith("asignado");
    });
    if (!row) return null;

    const dd = row.querySelector(".exp-val");
    if (!dd) return null;

    // Si ya está el botón, no duplicar
    if (dd.querySelector('[data-act="assign-req"]')) return dd;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-btn";
    btn.style.marginLeft = "8px";
    btn.setAttribute("title", "Asignar requerimiento");
    btn.setAttribute("aria-label", "Asignar requerimiento");
    btn.dataset.act = "assign-req";
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor"
          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83z"/>
      </svg>
    `;
    dd.appendChild(btn);
    btn.addEventListener("click", openAsignarModal);
    return dd;
  }

  async function paintDetalles(req) {
    // Nombre del Requerimiento
    putDetalle(
      "Nombre del Requerimiento",
      req.asunto || req.tramite_nombre || "—"
    );

    // Departamento + Líder (director)
    const { dept, director } = await getDeptByIdOrName({
      id: req.departamento_id,
      nombre: req.departamento_nombre,
    });
    putDetalle("Director", director?.nombre || "—");

    const depNode = $("#req-departamento");
    if (depNode)
      depNode.textContent = dept?.nombre || req.departamento_nombre || "—";

    // Asignado (texto + botón)
    const asignado =
      req.asignado_id && (req.asignado_full || "").trim()
        ? req.asignado_full
        : "Sin asignar";
    putDetalle("Asignado", asignado);
    attachAsignarButton();

    // ================================
    //   DESCRIPCIÓN
    // ================================
    putDetalle("Descripción", req.descripcion || "—");

    // Estatus normalizado (0–6)
    const estatus = Number(req.estatus_code ?? req.estatus ?? 0);

    // ================================
    //   MOTIVO (pausa/cancelación)
    // ================================
    await fillMotivoField(req, estatus);

    // ================================
    //   FECHA DE INICIO (fecha_limite)
    // ================================
    //
    // Se muestra SOLO cuando el estatus está en:
    //  3 = En proceso
    //  4 = Pausado
    //  5 = Cancelado
    //  6 = Finalizado
    //
    let fechaInicio = "—";
    if (estatus >= 3) {
      const rawInicio = req.fecha_limite || "";
      if (rawInicio) {
        fechaInicio = String(rawInicio).split(" ")[0]; // YYYY-MM-DD
      }
    }
    putDetalle("Fecha de inicio", fechaInicio);

    // ================================
    //   FECHA DE TERMINADO (cerrado_en)
    // ================================
    //
    // Se muestra SOLO cuando el estatus está en:
    //  6 = Finalizado
    //
    let fechaFin = "—";
    if (estatus === 6) {
      const rawFin = req.cerrado_en || "";
      if (rawFin) {
        fechaFin = String(rawFin).split(" ")[0]; // YYYY-MM-DD
      }
    }
    putDetalle("Fecha de terminado", fechaFin);
  }

  function resetDetallesSkeleton() {
    const grid = $('.exp-pane[role="tabpanel"][data-tab="detalles"] .exp-grid');
    if (!grid) return;
    $$(".exp-field .exp-val", grid).forEach((n) => {
      if (n.id === "req-status") return; // NO tocar estatus
      n.textContent = "—";
    });
  }

  /* =========================
   * Modal "Asignar requerimiento"
   * ========================= */
  function ensureAsignarModal() {
    let modal = document.getElementById("modal-asignar-req");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "modal-asignar-req";
    modal.className = "modal-overlay";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="asignar-title">
        <button class="modal-close" type="button" aria-label="Cerrar">×</button>
        <h2 id="asignar-title">Asignar requerimiento</h2>
        <form id="form-asignar-req" novalidate>
          <div class="form-row">
            <label for="asignar-select">Empleado</label>
            <select id="asignar-select" required>
              <option value="" disabled selected>Cargando…</option>
            </select>
          </div>
          <div class="form-row">
            <button type="submit" class="btn-submit">Asignar</button>
          </div>
        </form>
        <p class="modal-note">Se actualizará el responsable del requerimiento.</p>
      </div>`;
    document.body.appendChild(modal);

    // wiring básico
    const content = modal.querySelector(".modal-content");
    const close = () => {
      modal.setAttribute("aria-hidden", "true");
      modal.classList.remove("open", "active");
      document.body.classList.remove("me-modal-open");
    };
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
    content.querySelector(".modal-close")?.addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("open")) close();
    });

    return modal;
  }

  async function openAsignarModal() {
    const modal = ensureAsignarModal();
    const form = modal.querySelector("#form-asignar-req");
    const sel = modal.querySelector("#asignar-select");

    // Rellenar select con RBAC
    sel.innerHTML = `<option value="" disabled selected>Cargando…</option>`;
    try {
      const visibles = await buildAsignablesList();
      visibles.sort((a, b) => (a.full || "").localeCompare(b.full || "", "es"));
      sel.innerHTML = `<option value="" disabled selected>Selecciona responsable…</option>`;
      for (const emp of visibles) {
        const opt = document.createElement("option");
        opt.value = String(emp.id);
        opt.textContent = emp.full;
        sel.appendChild(opt);
      }

      // regla: ANALISTA solo a sí mismo
      const roles = getRoles();
      const isAnalista = roles.includes("ANALISTA");
      const yoId = Number(getEmpleadoId());
      if (isAnalista && yoId) {
        sel.value = String(yoId);
        sel.setAttribute("disabled", "true");
        sel.title = "Como Analista solo puedes asignarte a ti mismo.";
      } else {
        sel.removeAttribute("disabled");
        sel.title = "";
      }
    } catch (e) {
      warn("RBAC list error:", e);
      sel.innerHTML = `<option value="" disabled selected>Sin opciones disponibles</option>`;
    }

    // submit
    form.onsubmit = async (e) => {
      e.preventDefault();
      const value = sel.value;
      if (!value) {
        sel.focus();
        return;
      }
      await doAsignarRequerimiento(Number(value)).catch((err) => {
        warn("assign error:", err);
        toast("No se pudo asignar.", "danger");
      });
      // cerrar si todo ok
      modal.setAttribute("aria-hidden", "true");
      modal.classList.remove("open", "active");
      document.body.classList.remove("me-modal-open");
    };

    // abrir
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("me-modal-open");
    setTimeout(() => sel?.focus(), 30);
  }

  async function doAsignarRequerimiento(asignadoId) {
    const req = window.__REQ__;
    if (!req?.id) {
      toast("No hay requerimiento cargado.", "danger");
      return;
    }

    const updated_by = getEmpleadoId() ?? null;
    const payload = {
      id: Number(req.id),
      asignado_a: Number(asignadoId),
      updated_by,
    };

    const r = await postJSON(ENDPOINTS.REQ_UPDATE, payload);
    // UI refresh
    await refreshAsignadoUI(asignadoId);
    toast("Asignación actualizada", "success");

    // guarda en memoria local
    if (window.__REQ__) {
      window.__REQ__.asignado_id = String(asignadoId);
      // dejamos el nombre ya resuelto en UI; si quieres, podríamos buscarlo en la lista y setear asignado_full aquí también
    }
  }

  async function refreshAsignadoUI(asignadoId) {
    const grid = $('.exp-pane[role="tabpanel"][data-tab="detalles"] .exp-grid');
    const row = Array.from(grid.querySelectorAll(".exp-field")).find((r) => {
      const t = (r.querySelector("label")?.textContent || "")
        .trim()
        .toLowerCase();
      return t.startsWith("asignado");
    });
    const dd = row?.querySelector(".exp-val");
    if (dd) {
      const sel = document.querySelector("#modal-asignar-req #asignar-select");
      const opt = sel
        ? sel.querySelector(`option[value="${CSS.escape(String(asignadoId))}"]`)
        : null;
      const display = opt?.textContent || `Empleado #${asignadoId}`;
      dd.textContent = display; // ← texto plano
      attachAsignarButton(); // re-asegura el botón al lado
    }

    // Encargado del encabezado (si existe esa sección)
    const ddE = $(".exp-meta > div:nth-child(2) dd");
    if (ddE) {
      const sel = document.querySelector("#modal-asignar-req #asignar-select");
      const opt = sel
        ? sel.querySelector(`option[value="${CSS.escape(String(asignadoId))}"]`)
        : null;
      ddE.textContent = opt?.textContent || `Empleado #${asignadoId}`;
    }
  }

  /* =========================
   * Wiring
   * ========================= */
  function bootListeners() {
    document.addEventListener(
      "req:loaded",
      async (e) => {
        try {
          resetDetallesSkeleton();
          const req = e.detail;
          await paintDetalles(req);
        } catch (err) {
          warn("paintDetalles error:", err);
        }
      },
      { passive: true }
    );

    // Fallback si __REQ__ ya estaba cargado
    if (window.__REQ__) {
      resetDetallesSkeleton();
      paintDetalles(window.__REQ__).catch((e) =>
        warn("paintDetalles fallback error:", e)
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootListeners, {
      once: true,
    });
  } else bootListeners();
})();

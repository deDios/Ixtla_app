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
      "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php",
    DEPT_LIST_LOCAL: "/db/WEB/ixtla01_c_departamento.php",
    DEPT_LIST_UPPER: "/DB/WEB/ixtla01_c_departamento.php",
    EMPLEADOS_LIST:
      "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_empleado.php",
    DEPTS_LIST:
      "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php",
    REQ_UPDATE: "/db/WEB/ixtla01_upd_requerimiento.php",
    CCP_LIST: "https://ixtla-app.com/db/web/ixtla01_c_ccp.php",
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

  /* =========================
 * CCP (Motivo de pausa / cancelación)
 * ========================= */

  // Ahora tratamos la respuesta como OBJETO (data: { ... })
  async function fetchCCPByReqId(
    requerimiento_id,
    status = 1,
    page = 1,
    per_page = 50
  ) {
    const payload = {
      requerimiento_id: Number(requerimiento_id),
      status,
      page,
      per_page,
    };

    log("[CCP] fetchCCPByReqId payload:", payload);

    const res = await postJSON(ENDPOINTS.CCP_LIST, payload);
    log("[CCP] fetchCCPByReqId raw response:", res);

    // La API regresa data como OBJETO, no arreglo
    const obj = res && res.data ? res.data : null;
    if (!obj) {
      log("[CCP] sin data en respuesta CCP");
    }
    return obj; // { id, comentario, ... } o null
  }

  // Ahora usamos los IDs reales del HTML:
  //  - #req-motivo-field  → toda la fila
  //  - #req-motivo-wrap   → el contenedor de texto (exp-val)
  function getMotivoElements() {
    const field = document.getElementById("req-motivo-field");
    const wrap = document.getElementById("req-motivo-wrap");

    if (!field || !wrap) {
      warn("[CCP] getMotivoElements: falta field o wrap", { field, wrap });
      return null;
    }
    return { field, wrap };
  }

  async function paintMotivoCCP(req) {
    const els = getMotivoElements();
    if (!els) {
      warn("[CCP] paintMotivoCCP: no hay elementos en DOM");
      return;
    }
    const { field, wrap } = els;

    // Codigo numérico de estatus (igual que en View)
    const code = req && (
      req.estatus_code != null
        ? Number(req.estatus_code)
        : req.raw && (req.raw.estatus != null ? Number(req.raw.estatus) : null)
    );

    log("[CCP] paintMotivoCCP status code:", code, "req.id:", req && req.id);

    // Solo mostramos motivo cuando el req está Pausado (4) o Cancelado (5)
    if (code !== 4 && code !== 5) {
      field.style.display = "none";
      wrap.textContent = "—";
      log("[CCP] status no requiere motivo, ocultando fila");
      return;
    }

    // Mostrar la fila y poner mensaje de carga
    field.style.display = "";
    wrap.textContent = "Cargando motivo…";

    try {
      const ccp = await fetchCCPByReqId(req.id, 1);
      log("[CCP] objeto CCP recibido:", ccp);

      if (ccp && ccp.comentario) {
        wrap.textContent = ccp.comentario;
        log("[CCP] motivo pintado en UI");
      } else {
        wrap.textContent = "Sin motivo registrado.";
        log("[CCP] no hay comentario en CCP, mostrando fallback");
      }
    } catch (e) {
      warn("[CCP] error pintando motivo:", e);
      wrap.textContent = "Sin motivo registrado.";
    }
  }


  // Ahora usamos los IDs reales del HTML:
  //  - #req-motivo-field  → toda la fila
  //  - #req-motivo-wrap   → el contenedor de texto (exp-val)
  function getMotivoElements() {
    const field = document.getElementById("req-motivo-field");
    const wrap = document.getElementById("req-motivo-wrap");

    if (!field || !wrap) {
      warn("[CCP] getMotivoElements: falta field o wrap", { field, wrap });
      return null;
    }
    return { field, wrap };
  }

  async function paintMotivoCCP(req) {
    const els = getMotivoElements();
    if (!els) {
      warn("[CCP] paintMotivoCCP: no hay elementos en DOM");
      return;
    }
    const { field, wrap } = els;

    // Codigo numérico de estatus (igual que en View)
    const code = req && (
      req.estatus_code != null
        ? Number(req.estatus_code)
        : req.raw && (req.raw.estatus != null ? Number(req.raw.estatus) : null)
    );

    log("[CCP] paintMotivoCCP status code:", code, "req.id:", req && req.id);

    // Solo mostramos motivo cuando el req está Pausado (4) o Cancelado (5)
    if (code !== 4 && code !== 5) {
      field.style.display = "none";
      wrap.textContent = "—";
      log("[CCP] status no requiere motivo, ocultando fila");
      return;
    }

    // Mostrar la fila y poner mensaje de carga
    field.style.display = "";
    wrap.textContent = "Cargando motivo…";

    try {
      const ccp = await fetchCCPByReqId(req.id, 1);
      log("[CCP] objeto CCP recibido:", ccp);

      if (ccp && ccp.comentario) {
        wrap.textContent = ccp.comentario;
        log("[CCP] motivo pintado en UI");
      } else {
        wrap.textContent = "Sin motivo registrado.";
        log("[CCP] no hay comentario en CCP, mostrando fallback");
      }
    } catch (e) {
      warn("[CCP] error pintando motivo:", e);
      wrap.textContent = "Sin motivo registrado.";
    }
  }


  function getMotivoElements() {
    const field = document.getElementById("req-motivo-field");
    const wrap = document.getElementById("req-motivo-wrap");

    if (!field || !wrap) {
      warn("[CCP] getMotivoElements → faltan nodos", { field, wrap });
      return null;
    }

    return { field, wrap };
  }

  async function paintMotivoCCP(req) {
    const els = getMotivoElements();
    if (!els) {
      warn("[CCP] paintMotivoCCP → no hay elementos de UI para motivo");
      return;
    }
    const { field, wrap } = els;

    log("[CCP] paintMotivoCCP → req recibido:", req);

    // Tomamos el código desde lo que trae el req
    const code =
      req &&
      (req.estatus_code != null
        ? Number(req.estatus_code)
        : req.raw && req.raw.estatus != null
          ? Number(req.raw.estatus)
          : null);

    log(
      "[CCP] estatus detectado:",
      code,
      " (estatus_code:",
      req?.estatus_code,
      "raw.estatus:",
      req?.raw?.estatus,
      ")"
    );

    // El renglón de motivo SIEMPRE existe, solo cambiamos el texto
    // Si NO está en Pausado (4) o Cancelado (5), mostramos guión
    if (code !== 4 && code !== 5) {
      log("[CCP] estado no es Pausado/Cancelado, mostrando '—'");
      wrap.textContent = "—";
      return;
    }

    wrap.textContent = "Cargando motivo…";

    try {
      const ccp = await fetchCCPByReqId(req.id, 1);
      log("[CCP] resultado fetchCCPByReqId:", ccp);

      if (ccp && ccp.comentario) {
        wrap.textContent = ccp.comentario;
        log("[CCP] motivo aplicado en UI:", ccp.comentario);
      } else {
        wrap.textContent = "Sin motivo registrado.";
        warn("[CCP] no se encontró comentario en CCP, usando fallback.");
      }
    } catch (e) {
      warn("[CCP] error pintando motivo:", e);
      wrap.textContent = "Sin motivo registrado.";
    }
  }


  function getMotivoElements() {
    const field = document.getElementById("req-motivo-field");
    const wrap = document.getElementById("req-motivo-wrap");
    if (!field || !wrap) return null;
    return { field, wrap };
  }

  async function paintMotivoCCP(req) {
    const els = getMotivoElements();
    if (!els) return;
    const { field, wrap } = els;

    const code =
      req &&
      (req.estatus_code != null
        ? Number(req.estatus_code)
        : req.raw && req.raw.estatus != null
          ? Number(req.raw.estatus)
          : null);

    // Solo mostramos motivo cuando el req está Pausado (4) o Cancelado (5)
    if (code !== 4 && code !== 5) {
      field.style.display = "none";
      wrap.textContent = "—";
      return;
    }

    field.style.display = "";
    wrap.textContent = "Cargando motivo…";

    try {
      const ccp = await fetchCCPByReqId(req.id, 1);
      log("[CCP] paintMotivoCCP ←", ccp);

      if (ccp && ccp.comentario) {
        wrap.textContent = ccp.comentario;
      } else {
        wrap.textContent = "Sin motivo registrado.";
      }
    } catch (e) {
      warn("[CCP] error pintando motivo:", e);
      wrap.textContent = "Sin motivo registrado.";
    }
  }



  function getMotivoElements() {
    const field = document.getElementById("req-motivo-field");
    const text = document.getElementById("req-motivo-text");
    if (!field || !text) return null;
    return { wrap: field, text };
  }

  async function paintMotivoCCP(req) {
    const els = getMotivoElements();
    if (!els || !req) return;

    const { wrap, text } = els;

    // Determinar código de estatus de forma robusta
    let code = null;

    if (req.estatus_code != null && !Number.isNaN(Number(req.estatus_code))) {
      code = Number(req.estatus_code);
    } else if (
      req.raw &&
      req.raw.estatus != null &&
      !Number.isNaN(Number(req.raw.estatus))
    ) {
      code = Number(req.raw.estatus);
    }

    log("[CCP] paintMotivoCCP →", {
      reqId: req.id,
      estatus_code: req.estatus_code,
      raw_estatus: req.raw?.estatus,
      code,
    });

    // Solo mostramos motivo cuando el req está Pausado (4) o Cancelado (5)
    if (code !== 4 && code !== 5) {
      wrap.style.display = "none";
      text.textContent = "—";
      return;
    }

    // Mostrar el renglón y cargar motivo
    wrap.style.display = "";
    text.textContent = "Cargando motivo...";

    try {
      const ccp = await fetchCCPByReqId(req.id, 1);

      log("[CCP] registro activo para pintar:", ccp);

      if (ccp && ccp.comentario) {
        text.textContent = ccp.comentario;
      } else {
        text.textContent = "Sin motivo registrado.";
      }
    } catch (e) {
      warn("[CCP] error pintando motivo:", e);
      text.textContent = "Sin motivo registrado.";
    }
  }


  function safeGetSession() {
    try {
      if (window.Session?.get) return window.Session.get();
    } catch { }
    try {
      const pair = document.cookie
        .split("; ")
        .find((c) => c.startsWith("ix_emp="));
      if (!pair) return null;
      const raw = decodeURIComponent(pair.split("=")[1] || "");
      const json = JSON.parse(decodeURIComponent(escape(atob(raw))));
      if (json && typeof json === "object") return json;
    } catch { }
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

    // Descripción + Fechas
    putDetalle("Descripción", req.descripcion || "—");

    // Código numérico de estatus
    const est = Number(req.estatus_code ?? req.raw?.estatus ?? 0);

    // ===== Fecha de inicio (fecha_limite = fecha inicio) =====
    let fechaInicio = "—";
    if (est >= 3) {
      // solo desde Proceso en adelante
      const srcInicio =
        req.raw?.fecha_limite || req.creado_at || req.raw?.created_at || "";
      if (srcInicio) {
        fechaInicio = String(srcInicio).split(" ")[0];
      }
    }
    putDetalle("Fecha de inicio", fechaInicio);

    // ===== Fecha de terminado (solo Finalizado) =====
    let fechaFin = "—";
    if (est === 6) {
      // solo Finalizado
      const srcFin = req.cerrado_en || req.raw?.cerrado_en || "";
      if (srcFin) {
        fechaFin = String(srcFin).split(" ")[0];
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
    log("[Boot] ReqDetalle listeners listos");

    document.addEventListener(
      "req:loaded",
      async (e) => {
        const req = e.detail;
        log("[Boot] evento req:loaded recibido en Detalle:", req && req.id);

        try {
          resetDetallesSkeleton();
          await paintDetalles(req);
          await paintMotivoCCP(req);
        } catch (err) {
          warn("paintDetalles / paintMotivoCCP error:", err);
        }
      },
      { passive: true }
    );

    // Fallback si __REQ__ ya estaba cargado
    if (window.__REQ__) {
      log("[Boot] __REQ__ ya presente en Detalle, pintando de inmediato:", window.__REQ__.id);
      resetDetallesSkeleton();
      paintDetalles(window.__REQ__)
        .then(() => paintMotivoCCP(window.__REQ__))
        .catch((e) => warn("paintDetalles fallback error:", e));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootListeners, {
      once: true,
    });
  } else {
    bootListeners();
  }



  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootListeners, {
      once: true,
    });
  } else bootListeners();
})();

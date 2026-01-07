// /auth/requerimientoGuard.js
(function () {
  "use strict";

  const TAG = "[ReqGuard]";

  /* ==========================================================================
     CONFIG
     ======================================================================== */
  const CONFIG = {
    DEBUG_LOGS: true,
    HOME_URL: "/VIEWS/home copy.php",            
    ADMIN_ROLES: ["ADMIN"],
    PRESIDENCIA_DEPT_IDS: [6],   
    DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",
  };

  const log  = (...a) => { if (CONFIG.DEBUG_LOGS) console.log(TAG, ...a); };
  const warn = (...a) => { if (CONFIG.DEBUG_LOGS) console.warn(TAG, ...a); };
  const err  = (...a) => console.error(TAG, ...a);

  /* ==========================================================================
     HELPERS BÁSICOS
     ======================================================================== */
  function getReqIdFromURL() {
    try {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      return id ? Number(id) : null;
    } catch {
      return null;
    }
  }

  // Igual que en home.js / requerimientoView.js (cookie ix_emp)
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
    } catch (e) {
      warn("Error leyendo Session.get:", e);
    }
    if (!s) s = readCookiePayload() || null;

    if (!s) {
      warn("Sin sesión (Session ni cookie ix_emp).");
      return {
        empleado_id: null,
        dept_id: null,
        roles: [],
        id_usuario: null,
      };
    }

    const empleado_id = s?.empleado_id ?? s?.id_empleado ?? null;
    const dept_id = s?.departamento_id ?? null;
    const roles = Array.isArray(s?.roles)
      ? s.roles.map((r) => String(r).toUpperCase())
      : [];
    const id_usuario = s?.id_usuario ?? s?.cuenta_id ?? null;

    log("Sesión detectada (guard):", { empleado_id, dept_id, roles, id_usuario });

    return { empleado_id, dept_id, roles, id_usuario };
  }

  function showForbiddenUI(message) {
    const msg = message || "No tienes permiso para ver este requerimiento.";

    try {
      if (window.gcToast) {
        window.gcToast(msg, "warning");
      } else {
        alert(msg);
      }
    } catch {}

    try {
      let cont = document.getElementById("req-forbidden-msg");
      if (!cont) {
        cont = document.createElement("div");
        cont.id = "req-forbidden-msg";
        cont.style.margin = "2rem auto";
        cont.style.maxWidth = "600px";
        cont.style.padding = "1rem 1.25rem";
        cont.style.borderRadius = "0.75rem";
        cont.style.background = "#fff3cd";
        cont.style.color = "#856404";
        cont.style.border = "1px solid #ffeeba";
        cont.style.fontFamily =
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        cont.style.fontSize = "0.95rem";
        cont.style.textAlign = "center";
        cont.style.boxShadow = "0 4px 10px rgba(0,0,0,0.06)";
        document.body.appendChild(cont);
      }
      cont.textContent = msg;
    } catch {}

    setTimeout(() => {
      try {
        window.location.href = CONFIG.HOME_URL;
      } catch (e) {
        warn("No se pudo redirigir a Home:", e);
      }
    }, 1400);
  }

  /* ==========================================================================
     HTTP HELPERS (mini)
     ======================================================================== */
  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body || {}),
      credentials: "include", // por si usas cookies de sesión PHP
    });
    const txt = await res.text();
    let json;
    try {
      json = JSON.parse(txt);
    } catch {
      json = { raw: txt };
    }
    return { res, json };
  }

  async function isPrimeraLinea(viewerId, deptId) {
    if (!viewerId || !deptId) return false;
    try {
      const url =
        "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php";
      const { res, json } = await postJSON(url, { all: true });
      if (!res.ok) return false;
      const arr = json?.data || [];
      const dep = arr.find((d) => Number(d.id) === Number(deptId));
      return !!(
        dep &&
        Number(dep.primera_linea) === Number(viewerId)
      );
    } catch (e) {
      warn("isPrimeraLinea error:", e);
      return false;
    }
  }

  // Trae solo lo mínimo del requerimiento para validar acceso
  async function fetchReqMinimal(reqId) {
    const url = "/db/WEB/ixtla01_c_requerimiento.php";
    const { res, json } = await postJSON(url, { id: reqId });

    if (res.status === 404) {
      return { status: 404, data: null };
    }
    if (res.status === 403) {
      return { status: 403, data: null };
    }
    if (!res.ok) {
      return { status: res.status, data: null, error: json };
    }

    const data = json?.data ?? json;
    const raw = Array.isArray(data) ? data[0] || {} : data || {};

    // Normalización mínima (alineado a getRequerimientoById)
    const out = {
      id: String(raw.id ?? raw.requerimiento_id ?? ""),
      departamento_id:
        raw.departamento_id != null ? Number(raw.departamento_id) : null,
      asignado_id:
        raw.asignado_a != null ? Number(raw.asignado_a) : null,
      created_by:
        raw.created_by != null ? Number(raw.created_by) : null,
      estatus:
        raw.estatus != null ? Number(raw.estatus) :
        raw.status  != null ? Number(raw.status)  : null,
      raw,
    };

    return { status: res.status, data: out };
  }

  /* ==========================================================================
     REGLA DE ACCESO (RBAC lado front, espejo simplificado de Home)
     ======================================================================== */
  async function canViewReqFront(req, session) {
    const { empleado_id, dept_id, roles, id_usuario } = session;
    if (!empleado_id && !id_usuario) return false;
    if (!req || !req.id) return false;

    const isAdmin = (roles || []).some((r) =>
      CONFIG.ADMIN_ROLES.includes(r)
    );
    const isPres = CONFIG.PRESIDENCIA_DEPT_IDS.includes(Number(dept_id));
    const isDir = (roles || []).includes("DIRECTOR");
    const isJefe = (roles || []).includes("JEFE");
    const isAnal = (roles || []).includes("ANALISTA");
    const soyPL = await isPrimeraLinea(empleado_id, dept_id);

    log("RBAC (guard):", {
      empleado_id,
      dept_id,
      roles,
      isAdmin,
      isPres,
      isDir,
      soyPL,
      isJefe,
      isAnal,
    });

    // 1) ADMIN / PRESIDENCIA: ven todo
    if (isAdmin || isPres) return true;

    // 2) DIRECTOR / PRIMERA LÍNEA: todo el depto
    if (isDir || soyPL) {
      if (req.departamento_id && dept_id && Number(req.departamento_id) === Number(dept_id)) {
        return true;
      }
      return false;
    }

    // 3) JEFE / ANALISTA: más estrictos, pero seguimos el mismo depto
    if (isJefe || isAnal) {
      // Regla base: mismo departamento → permitido
      if (req.departamento_id && dept_id && Number(req.departamento_id) === Number(dept_id)) {
        return true;
      }
      // Extra: si está asignado directamente a él/ella
      if (req.asignado_id && empleado_id && Number(req.asignado_id) === Number(empleado_id)) {
        return true;
      }
      return false;
    }

    // 4) Resto de personal: solo lo asignado al empleado
    if (empleado_id && req.asignado_id && Number(req.asignado_id) === Number(empleado_id)) {
      return true;
    }

    // 5) (Opcional) si el backend mete created_by como ciudadano/propietario
    if (id_usuario && req.created_by && Number(req.created_by) === Number(id_usuario)) {
      return true;
    }

    return false;
  }

  /* ==========================================================================
     CHECK COMPLETO
     ======================================================================== */
  async function checkReqAccess(reqId) {
    if (!reqId) {
      warn("Sin id de requerimiento en la URL.");
      showForbiddenUI("Requerimiento no especificado.");
      return false;
    }

    const sess = readSessionLike();
    if (!sess.empleado_id && !sess.id_usuario) {
      warn("Sin usuario autenticado, bloqueando acceso.");
      showForbiddenUI(
        "Debes iniciar sesión para consultar el detalle de un requerimiento."
      );
      return false;
    }

    // 1) Traer info mínima del requerimiento
    let min;
    try {
      min = await fetchReqMinimal(reqId);
    } catch (e) {
      err("Error consultando requerimiento (guard):", e);
      showForbiddenUI("No fue posible obtener el requerimiento.");
      return false;
    }

    log("Respuesta mínima req:", min);

    if (min.status === 404 || !min.data || !min.data.id) {
      showForbiddenUI("El requerimiento no existe o no está disponible.");
      return false;
    }

    if (min.status === 403) {
      // Si el backend ya valida, respetamos su decisión
      showForbiddenUI("No tienes permiso para ver este requerimiento.");
      return false;
    }

    // 2) Aplicar nuestra regla front (espejo de Home)
    const allowed = await canViewReqFront(min.data, sess);
    if (!allowed) {
      showForbiddenUI("No tienes permiso para ver este requerimiento.");
      return false;
    }

    // Si se permite, opcionalmente exponemos el raw para que lo use requerimientoView.js
    try {
      window.__REQ_MIN_FROM_GUARD__ = min.data;
    } catch {}

    log("Acceso permitido al requerimiento", { reqId });
    return true;
  }

  /* ==========================================================================
     INIT
     ======================================================================== */
  window.addEventListener("DOMContentLoaded", async () => {
    try {
      const reqId = getReqIdFromURL();
      const ok = await checkReqAccess(reqId);
      if (!ok) {
        log("Acceso denegado por guard (mensaje + redirección).");
      } else {
        log("Acceso aprobado por guard → detalle puede inicializarse normalmente.");
      }
    } catch (e) {
      err("Init guard error:", e);
    }
  });
})();

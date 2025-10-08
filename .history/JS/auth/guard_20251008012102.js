// /JS/auth/guard.js
import { getSession, clearSession } from "/JS/auth/session.js";

/**
 * Guardia de acceso por cookie de sesión (ix_emp)
 *
 * @param {Object} options
 * @param {boolean} [options.requireLogin=true]             Requiere sesión válida y activa.
 * @param {number[]} [options.allowEmpIds]                  Lista blanca por empleado_id (recomendado).
 * @param {number[]} [options.allowAccountIds]              Lista blanca por cuenta_id (id de empleado_cuenta).
 * @param {number[]} [options.allowIds]                     Back-compat: por id_usuario/cuenta_id.
 * @param {string[]} [options.allowUsernames]               Lista blanca por username (case-insensitive).
 * @param {string[]} [options.allowRoles]                   Lista blanca por roles (códigos o nombres).
 * @param {number} [options.maxAgeMs]                       Invalida sesiones muy antiguas comparado con payload.ts.
 * @param {boolean} [options.requireActive=true]            Verifica status_empleado===1 y status_cuenta===1.
 * @param {boolean} [options.stealth=true]                  Pinta “404/403 nginx” en vez de redirigir.
 * @param {"404"|"403"} [options.stealthCode="404"]         Código en modo stealth.
 * @param {string} [options.stealthServer="nginx"]          Nombre del servidor a mostrar.
 * @param {string} [options.stealthVersion="1.24.0"]        Versión que se imprime.
 * @param {string} [options.stealthTheme="nginx"]           Tema a usar en stealth ("nginx"|"plain").
 * @param {string} [options.redirectTo="/VIEWS/Login.php"]  Destino cuando stealth=false.
 * @param {"replace"|"assign"} [options.redirectMode="replace"]  Método de redirección.
 * @param {boolean} [options.devLog=false]                  Logs en consola para depurar.
 * @param {"home"|null} [options.onlyIn=null]               Si "home", solo aplica en home.php.
 * @param {boolean} [options.skipOnLogin=true]              No aplicar guard si ya estamos en la página de login.
 * @param {(sess:Object)=>void} [options.onOk]              Callback en acceso permitido.
 * @param {(reason:string)=>void} [options.onFail]          Callback en acceso denegado.
 */
export function guardPage(options = {}) {
  const cfg = {
    requireLogin: true,
    allowEmpIds: undefined,
    allowAccountIds: undefined,
    allowIds: undefined, // back-compat (id_usuario/cuenta_id)
    allowUsernames: undefined,
    allowRoles: undefined,
    maxAgeMs: undefined,
    requireActive: true,
    stealth: true,
    stealthCode: "404",
    stealthServer: "nginx",
    stealthVersion: "1.24.0",
    stealthTheme: "nginx",
    redirectTo: "/VIEWS/Login.php",
    redirectMode: "replace",
    devLog: false,
    onlyIn: null,      // "home" => ejecutar solo en home.php
    skipOnLogin: true, // evita bucles si ya estamos en login
    onOk: null,
    onFail: null,
    ...options,
  };

  // Sello por ruta para evitar ejecuciones dobles
  const SENT_KEY = "__IX_ROUTE_GUARD_ACTIVE__:" + location.pathname;
  if (window[SENT_KEY]) {
    try {
      document.documentElement.classList.remove("ix-guard-pending");
      document.documentElement.style.visibility = "";
    } catch {}
    return;
  }
  window[SENT_KEY] = true;

  const log = (...a) => { if (cfg.devLog) try { console.log("[guard]", ...a); } catch {} };

  // Helpers de ruta/URL
  const normalizePath = (p) => {
    try {
      return new URL(p, location.origin).pathname.replace(/\/+$/, "").toLowerCase();
    } catch {
      return String(p || "").replace(/\/+$/, "").toLowerCase();
    }
  };
  const samePath = (a, b) => normalizePath(a) === normalizePath(b);

  const isHomeLike = () => {
    const hrefL = (location.href || "").toLowerCase();
    const last  = (location.pathname.split("/").pop() || "").toLowerCase();
    return hrefL.includes("home.php") || last === "home.php";
  };

  const redirectWithNext = (to) => {
    const here = location.pathname + (location.search || "") + (location.hash || "");
    const url = new URL(to, location.origin);
    if (!url.searchParams.has("next")) url.searchParams.set("next", here);
    if (cfg.redirectMode === "assign") location.assign(url.toString());
    else location.replace(url.toString());
  };

  // onlyIn
  if (cfg.onlyIn === "home" && !isHomeLike()) {
    log("omitido (onlyIn=home y no estamos en home.php)");
    return;
  }

  // Evitar guard en la propia página de login (por defecto)
  if (cfg.skipOnLogin && samePath(location.pathname, cfg.redirectTo)) {
    log("estamos en la página de login; no se aplica guard");
    return;
  }

  // Sesión
  const sess = getSession();
  log("session:", sess);

  // Normalizadores
  const normalizeRoles = (r) =>
    Array.isArray(r)
      ? r
          .map((x) => (typeof x === "string" ? x : (x?.codigo || x?.nombre || "")))
          .filter(Boolean)
          .map((s) => String(s).toUpperCase())
      : [];

  const getIds = (s) => {
    // De acuerdo al schema "ix-1" guardamos:
    //   empleado_id, cuenta_id, id_usuario (compat)
    const empId    = Number(s?.empleado_id ?? s?.id_empleado ?? NaN);
    const acctId   = Number(s?.cuenta_id ?? NaN);
    const userId   = Number(s?.id_usuario ?? s?.id ?? acctId ?? NaN); // compat
    const username = (s?.username || "").toString();
    return {
      empId: Number.isFinite(empId) ? empId : null,
      accountId: Number.isFinite(acctId) ? acctId : null,
      userId: Number.isFinite(userId) ? userId : null,
      username,
    };
  };

  // Validadores
  const loginAllowed = (s) => {
    if (!cfg.requireLogin) return true;
    if (!s) return false;
    if (!cfg.requireActive) return true;
    return (s.status_empleado ?? 1) === 1 && (s.status_cuenta ?? 1) === 1;
  };

  const idAllowed = (s) => {
    // Si no se definió ningún filtro de ID/username, permitir
    const hasAnyIdFilter =
      (Array.isArray(cfg.allowEmpIds) && cfg.allowEmpIds.length) ||
      (Array.isArray(cfg.allowAccountIds) && cfg.allowAccountIds.length) ||
      (Array.isArray(cfg.allowIds) && cfg.allowIds.length) ||
      (Array.isArray(cfg.allowUsernames) && cfg.allowUsernames.length);

    if (!hasAnyIdFilter) return true;
    if (!s) return false;

    const { empId, accountId, userId, username } = getIds(s);
    let ok = true;

    if (Array.isArray(cfg.allowEmpIds) && cfg.allowEmpIds.length) {
      ok = ok && empId != null && cfg.allowEmpIds.includes(empId);
    }
    if (Array.isArray(cfg.allowAccountIds) && cfg.allowAccountIds.length) {
      ok = ok && accountId != null && cfg.allowAccountIds.includes(accountId);
    }
    if (Array.isArray(cfg.allowIds) && cfg.allowIds.length) {
      ok = ok && userId != null && cfg.allowIds.includes(userId);
    }
    if (Array.isArray(cfg.allowUsernames) && cfg.allowUsernames.length) {
      const want = cfg.allowUsernames.map((u) => String(u).toLowerCase());
      ok = ok && username && want.includes(username.toLowerCase());
    }

    return ok;
  };

  const rolesAllowed = (s) => {
    if (!Array.isArray(cfg.allowRoles) || !cfg.allowRoles.length) return true;
    if (!s) return false;
    const userRoles = normalizeRoles(s?.roles);
    const want = cfg.allowRoles.map((r) => String(r).toUpperCase());
    return userRoles.some((r) => want.includes(r));
  };

  const ageAllowed = (s) => {
    if (!cfg.maxAgeMs) return true;
    const ts = Number(s?.ts ?? 0);
    return Number.isFinite(ts) && Date.now() - ts <= cfg.maxAgeMs;
  };

  // Evaluación
  let ok = loginAllowed(sess);
  if (ok) ok = idAllowed(sess);
  if (ok) ok = rolesAllowed(sess);
  if (ok) ok = ageAllowed(sess);

  if (ok) {
    try { window.__ixSession = sess; } catch {}
    try {
      document.documentElement.classList.remove("ix-guard-pending");
      document.documentElement.style.visibility = "";
    } catch {}
    log("acceso permitido ✓");
    cfg.onOk?.(sess);
    return;
  }

  // Acceso denegado
  log("acceso denegado; limpiando y redirigiendo/renderizando");
  try { clearSession(); } catch {}
  cfg.onFail?.("DENY");

  if (cfg.stealth) {
    const delayMs = 120 + Math.floor(Math.random() * 360);
    setTimeout(
      () => renderStealth(cfg.stealthCode, cfg.stealthServer, cfg.stealthVersion, cfg.stealthTheme),
      delayMs
    );
  } else {
    redirectWithNext(cfg.redirectTo);
  }
}

/* Pinta una página de error “stealth” */
function renderStealth(code = "404", server = "nginx", version = "1.24.0", theme = "nginx") {
  if (theme === "plain") {
    try {
      document.open(); document.write("File not found."); document.close();
      try { document.title = "File not found."; } catch {}
    } catch { document.body.textContent = "File not found."; }
    return;
  }
  const title = code === "403" ? "403 Forbidden" : "404 Not Found";
  const html = `<!DOCTYPE html>
  <html><head><meta charset="utf-8">
  <title>${title}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
   html,body{height:100%;margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;background:#fff;color:#111;}
   .wrap{min-height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center}
   h1{font-weight:600;margin:0.6em 0}
   hr{border:none;border-top:1px solid #ddd;width:92%;max-width:680px;margin:1.2em auto}
   .foot{color:#555;margin:0.6em 0 1.8em;font-size:14px}
  </style>
  </head>
  <body>
    <div class="wrap">
      <center><h1>${title}</h1></center>
      <hr>
      <center class="foot">${server}/${version}</center>
    </div>
  </body></html>`;
  try { document.open(); document.write(html); document.close(); }
  catch { document.body.innerHTML = html; }
}

/* ===================== Ejemplos de uso =====================

<script type="module">
  import { guardPage } from "/JS/auth/guard.js";

  // 1) Solo sesión válida (activa)
  // guardPage();

  // 2) Solo ciertos EMPLEADOS (empleado_id)
  // guardPage({ allowEmpIds:[5,6], stealth:false, redirectTo:"/VIEWS/Login.php" });

  // 3) Por cuenta/usuario (cuenta_id o id_usuario legacy)
  // guardPage({ allowAccountIds:[2,4], allowIds:[2,4] });

  // 4) Por usernames
  // guardPage({ allowUsernames:["admin","pdedios"] });

  // 5) IDs + roles + antigüedad, con logs
  // guardPage({
  //   allowEmpIds:[5],
  //   allowRoles:["ADMIN","JEFE"],
  //   maxAgeMs: 7*24*60*60*1000,
  //   devLog:true
  // });

  // 6) Modo stealth 403
  // guardPage({ stealthCode:"403" });

  // 7) Sin stealth, redirigir a login con ?next=
  // guardPage({ stealth:false, redirectTo:"/VIEWS/Login.php" });

  // 8) Ejecutar guard solo en home.php
  // guardPage({ onlyIn:"home" });
</script>

*/

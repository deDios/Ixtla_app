// /JS/auth/guard.js
import { getSession, clearSession } from "/JS/auth/session.js";

/**
 * Guardia
 * @param {Object} options
 * @param {boolean} [options.requireLogin=true]            Requiere sesión valida (la cookie).
 * @param {number[]} [options.allowIds]                    Lista blanca de id_usuario permitidos.
 * @param {string[]} [options.allowRoles]                  Lista blanca de roles (ids o nombres) permitidos.
 * @param {number} [options.maxAgeMs]                      Invalida sesiones muy antiguas comparado con payload.ts.
 * @param {boolean} [options.stealth=true]                 Si true, pinta “404/403 nginx” en vez de redirigir.
 * @param {"404"|"403"} [options.stealthCode="404"]        Código a presentar en modo stealth.
 * @param {string} [options.stealthServer="nginx"]         Nombre del servidor a mostrar.
 * @param {string} [options.stealthVersion="1.24.0"]       Versión que se imprime.
 * @param {string} [options.stealthTheme="nginx"]          Tema a usar en stealth (nginx|plain).
 * @param {string} [options.redirectTo="/VIEWS/Login.php"] Destino si stealth=false.
 * @param {boolean} [options.devLog=false]                 Logs en consola para depurar.
 * @param {"home"|null} [options.onlyIn=null]              Si "home", solo aplica el guard en home.php.
 * @param {boolean} [options.skipOnLogin=true]             No aplicar el guard si ya estamos en la página de login.
 * @param {(sess:Object)=>void} [options.onOk]             Callback en acceso permitido.
 * @param {(reason:string)=>void} [options.onFail]         Callback en acceso denegado.
 */
export function guardPage(options = {}) {
  const cfg = {
    requireLogin: true,
    allowIds: undefined,
    allowRoles: undefined,
    maxAgeMs: undefined,
    stealth: true,
    stealthCode: "404",
    stealthServer: "nginx",
    stealthVersion: "1.24.0",
    stealthTheme: "nginx",
    redirectTo: "/VIEWS/Login.php",
    devLog: false,
    onlyIn: null,          // e.g. "home" para ejecutar guard solo en home.php
    skipOnLogin: true,     // evita bucles en la página de login
    onOk: null,
    onFail: null,
    ...options,
  };

  // Evita ejecutar dos veces por ruta
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

  // Helpers
  const samePath = (a, b) => {
    try {
      const A = new URL(a, location.origin).pathname.replace(/\/+$/, "").toLowerCase();
      const B = new URL(b, location.origin).pathname.replace(/\/+$/, "").toLowerCase();
      return A === B;
    } catch { return a === b; }
  };

  const isHomeLike = () => {
    const hrefL = (location.href || "").toLowerCase();
    const last  = (location.pathname.split("/").pop() || "").toLowerCase();
    return hrefL.includes("home.php") || last === "home.php";
  };

  const redirectWithNext = (to) => {
    const here = location.pathname + (location.search || "") + (location.hash || "");
    const url = new URL(to, location.origin);
    if (!url.searchParams.has("next")) url.searchParams.set("next", here);
    location.replace(url.toString());
  };

  // onlyIn: si se pide, aplicar solo donde corresponde
  if (cfg.onlyIn === "home" && !isHomeLike()) {
    log("omitido (onlyIn=home y no estamos en home.php)");
    return;
  }

  // Evitar bucle si ya estamos en redirectTo (login)
  if (cfg.skipOnLogin && samePath(location.pathname, cfg.redirectTo)) {
    log("estamos en la página de login; no se aplica guard");
    return;
  }

  const sess = getSession();
  log("session:", sess);

  const normalizeRoles = (r) =>
    Array.isArray(r)
      ? r
          .map((x) => (typeof x === "string" ? x : (x?.codigo || x?.nombre || "")))
          .filter(Boolean)
          .map((s) => String(s).toUpperCase())
      : [];

  // Validadores
  const idAllowed = (s) => {
    if (!Array.isArray(cfg.allowIds) || !cfg.allowIds.length) return true;
    const id = Number(s?.id_usuario ?? s?.id ?? NaN);
    return Number.isFinite(id) && cfg.allowIds.includes(id);
  };

  const rolesAllowed = (s) => {
    if (!Array.isArray(cfg.allowRoles) || !cfg.allowRoles.length) return true;
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
  let ok = true;

  if (cfg.requireLogin) {
    ok = !!sess && (sess.status_empleado ?? 1) === 1 && (sess.status_cuenta ?? 1) === 1;
  }

  if (ok) ok = idAllowed(sess);
  if (ok) ok = rolesAllowed(sess);
  if (ok) ok = ageAllowed(sess);

  if (ok) {
    // Sesión accesible globalmente si la necesitas
    try { window.__ixSession = sess; } catch {}
    // Revela en caso de cloak CSS
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
    const delayMs = 120 + Math.floor(Math.random() * 360); // un poco de jitter
    setTimeout(
      () => renderStealth(cfg.stealthCode, cfg.stealthServer, cfg.stealthVersion, cfg.stealthTheme),
      delayMs
    );
  } else {
    redirectWithNext(cfg.redirectTo);
  }
}

/* Pinta una pagina de error */
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

  // Caso 1: solo sesión válida (cualquier usuario)
  // guardPage();

  // Caso 2: sesión + SOLO ciertos IDs
  // guardPage({ allowIds: [1,2,9999], stealth:false, redirectTo:"/VIEWS/Login.php" });

  // Caso 3: sesión + IDs + roles
  // guardPage({ allowIds:[1,2], allowRoles:["JEFE","ADMIN"], devLog:true });

  // Caso 4: modo stealth 403 en lugar de 404
  // guardPage({ stealthCode:"403" });

  // Caso 5: sin stealth, redirige con ?next=<url-actual>
  // guardPage({ stealth:false, redirectTo:"/VIEWS/Login.php" });

  // Caso 6: invalidar sesiones con demasiada antigüedad (ej: 7 días)
  // guardPage({ maxAgeMs: 7*24*60*60*1000 });

  // Caso 7: solo aplicar el guard en home.php
  // guardPage({ onlyIn:"home" });
</script>

*/

// /JS/auth/guard.js
import { getSession, clearSession } from "/JS/auth/session.js";

/**
 * Guardia
 * @param {Object} options
 * @param {boolean} [options.requireLogin=true]            Requiere sesión valida (la cookie).
 * @param {number[]} [options.allowIds]                    Lista blanca de id_usuario permitidos.
 * @param {string[]} [options.allowRoles]                  Lista blanca de roles (ids o nombres) permitidos.
 * @param {number} [options.maxAgeMs]                      Si se define, invalida sesiones muy antiguas (comparado con payload.ts).
 * @param {boolean} [options.stealth=true]                 Si true, muestra falso error NGINX en lugar de redirigir.
 * @param {"404"|"403"} [options.stealthCode="404"]        Codigo a presentar.
 * @param {string} [options.stealthServer="nginx"]         Nombre del servidor a mostrar.
 * @param {string} [options.stealthVersion="1.24.0"]       Versión que se imprime.
 * @param {string} [options.redirectTo="/VIEWS/Login.php"] Destino si stealth=false.
 * @param {boolean} [options.devLog=false]                 Logs en consola para depurar.
 * hasta abajo viene la forma de importarlo
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
    ...options,
  };

  // evita ejecutar dos veces si el modulo se importa repetido (sello por ruta)
  const SENT_KEY = "__IX_ROUTE_GUARD_ACTIVE__:" + location.pathname;
  if (window[SENT_KEY]) {
    // si ya corrió, por si acaso quita el cloak para no dejar la pantalla oculta
    try {
      document.documentElement.classList.remove("ix-guard-pending");
      document.documentElement.style.visibility = "";
    } catch {}
    return;
  }
  window[SENT_KEY] = true;

  const log = (...a) => {
    if (cfg.devLog)
      try {
        console.log("[guard]", ...a);
      } catch {}
  };

  // Leer sesion
  const sess = getSession();
  log("session:", sess);

  // verificar lista blanca de IDs que solo podran ver esa vista en especifico
  function idAllowed(s) {
    if (!Array.isArray(cfg.allowIds) || !cfg.allowIds.length) return true;
    const id = Number(s?.id_usuario ?? NaN);
    return Number.isFinite(id) && cfg.allowIds.includes(id);
  }

  // verificar roles
  function rolesAllowed(s) {
    if (!Array.isArray(cfg.allowRoles) || !cfg.allowRoles.length) return true;
    const roles = Array.isArray(s?.roles) ? s.roles.map(String) : [];
    return roles.some((r) => cfg.allowRoles.includes(r));
  }

  // verificar antiguedad
  function ageAllowed(s) {
    if (!cfg.maxAgeMs) return true;
    const ts = Number(s?.ts ?? 0);
    return Number.isFinite(ts) && Date.now() - ts <= cfg.maxAgeMs;
  }

  // verificar condiciones
  let ok = true;

  if (cfg.requireLogin) {
    ok =
      !!sess &&
      (sess.status_empleado ?? 1) === 1 &&
      (sess.status_cuenta ?? 1) === 1;
  }

  if (ok) ok = idAllowed(sess);
  if (ok) ok = rolesAllowed(sess);
  if (ok) ok = ageAllowed(sess);

  if (ok) {
    log("acceso permitido");
    // REVELA el documento oculto por el cloak:
    try {
      document.documentElement.classList.remove("ix-guard-pending");
      document.documentElement.style.visibility = "";
    } catch {}
    return; // acceso exitoso
  }

  log("acceso denegado, fuera de aqui");

  // acceso denegado
  try {
    clearSession();
  } catch {}

  if (cfg.stealth) {
    // Renderizar error (un pequeño jitter para realismo)
    const delayMs = 120 + Math.floor(Math.random() * 360);
    setTimeout(
      () =>
        renderStealth(
          cfg.stealthCode,
          cfg.stealthServer,
          cfg.stealthVersion,
          cfg.stealthTheme
        ),
      delayMs
    );
  } else {
    // Redireccion
    location.replace(cfg.redirectTo);
  }
}

/* Pinta una pagina de error */
function renderStealth(
  code = "404",
  server = "nginx",
  version = "1.24.0",
  theme = "nginx"
) {
  if (theme === "plain") {
    try {
      document.open();
      document.write("File not found.");
      document.close();
      try {
        document.title = "File not found.";
      } catch {}
    } catch {
      document.body.textContent = "File not found.";
    }
    return;
  }

  // Tema “nginx”
  const title = code === "403" ? "403 Forbidden" : "404 Not Found";
  const html = `<!DOCTYPE html>
  <html>
  <head>
  <meta charset="utf-8">
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
  </body>
  </html>`;
  try {
    document.open();
    document.write(html);
    document.close();
  } catch {
    document.body.innerHTML = html;
  }
}

//manera de usarlo

//<script type="module">
//import { guardPage } from "/JS/auth/guard.js";

// Caso 1: solo exige sesión valida (cualquier usuario logueado)
// guardPage();

// Caso 2: exige sesion + SOLO ciertos IDs
// guardPage({ allowIds: [1, 2, 9999] });

// Caso 3 (mas preciso): exige sesión + ciertos IDs y roles
// guardPage({ allowIds: [1, 2], allowRoles: ["JEFE","ADMIN"], devLog: true });

// Caso 4: si prefieres 403 estilo nginx en lugar de 404
// guardPage({ stealthCode: "403" });

// Caso 5: sin “stealth”, redirige al login
// guardPage({ stealth: false, redirectTo: "/VIEWS/Login.php" });

// Caso 6: invalidar sesiones con demasiada antigüedad (ej: 7 días)
// guardPage({ maxAgeMs: 7*24*60*60*1000 });



//</script>

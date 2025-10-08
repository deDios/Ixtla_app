// /JS/login.js
import { setSession } from "/JS/auth/session.js";

(() => {
  "use strict";

  /* -------------- CONFIG -------------- */
  const ENDPOINT    = "/DB/WEB/ixtla01_auth_login.php";
  const REDIRECT_OK = "/VIEWS/home.php";

  const RECAPTCHA = {
    enabled: false,
    siteKey: "TU_SITE_KEY",
    action: "ixtla_login",
  };

  const MIN_FILL_MS    = 900;
  const RL_MAX_PER_MIN = 6;
  const RL_WINDOW_SEC  = 60;
  const RL_STORAGE_KEY = "ix_login_rl";

  const POW = {
    enabled: true,
    bitsDesktop: 18,
    bitsMobile: 16,
    timeoutMs: 1200,
  };

  // Autofill detection
  const AUTOFILL_POLL_MS = 150;
  const AUTOFILL_MAX_MS  = 4000;

  /* -------------- HELPERS -------------- */
  const toast = (msg, tipo = "exito") => {
    if (typeof window.gcToast === "function") window.gcToast(msg, tipo);
    else console[tipo === "error" ? "error" : "log"]("[toast]", tipo, msg);
  };

  function setLoading(btn, on) {
    if (!btn) return;
    btn.disabled = !!on;
    btn.textContent = on ? "Ingresando..." : "Iniciar sesión";
    btn.classList.toggle("is-loading", !!on);
  }

  function validarUsuario(u) {
    if (!u) return false;
    const v = u.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return true; 
    if (/^\+?\d{10,15}$/.test(v.replace(/\D/g, ""))) return true; // teléfono
    return v.length >= 3; // username
  }

  function clientThrottleCheck(max, windowSec, storageKey) {
    const now = Date.now();
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch {}
    arr = arr.filter((ts) => now - ts < windowSec * 1000);
    if (arr.length >= max) {
      localStorage.setItem(storageKey, JSON.stringify(arr));
      return { allowed: false, remainingMs: windowSec * 1000 - (now - arr[0]) };
    }
    arr.push(now);
    localStorage.setItem(storageKey, JSON.stringify(arr));
    return { allowed: true, remainingMs: 0 };
  }

  async function sha256hex(msg) {
    const enc = new TextEncoder().encode(msg);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
  }

  async function doPoW(bits, timeoutMs, salt) {
    const zerosHex = Math.floor(bits / 4);
    const want = "0".repeat(zerosHex);
    const start = Date.now();
    let nonce = 0;
    while (Date.now() - start < timeoutMs) {
      const h = await sha256hex(`${salt}:${nonce}`);
      if (h.startsWith(want)) return { nonce, hash: h, bits };
      nonce++;
      if (nonce % 2000 === 0) await new Promise(r => setTimeout(r, 0));
    }
    return null;
  }

  const isMobile = () =>
    /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent || "");

  async function getRecaptchaToken() {
    if (!RECAPTCHA.enabled) return "";
    if (!window.grecaptcha || !RECAPTCHA.siteKey) return "";
    try {
      await window.grecaptcha.enterprise.ready();
      return await window.grecaptcha.enterprise.execute(RECAPTCHA.siteKey, { action: RECAPTCHA.action });
    } catch { return ""; }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form      = document.querySelector(".auth-form");
    if (!form) return;

    const btn       = form.querySelector(".btn-login");
    const inputUser = form.querySelector('input[name="usuario"]');
    const inputPwd  = form.querySelector('input[name="password"]');

    // Sugerir atributos estándar para mejorar autofill
    try {
      inputUser?.setAttribute("autocomplete", "username");
      inputUser?.setAttribute("autocapitalize", "none");
      inputUser?.setAttribute("spellcheck", "false");
      inputPwd?.setAttribute("autocomplete", "current-password");
    } catch {}

    // Min fill time con soporte a autofill
    let firstInteractAt = 0;
    const markInteract = () => { if (!firstInteractAt) firstInteractAt = Date.now(); };

    ["focus", "input", "keydown", "pointerdown"].forEach((ev) =>
      form.addEventListener(ev, markInteract, { passive: true })
    );

    const startAutofillWatch = () => {
      const t0 = Date.now();
      const poll = setInterval(() => {
        const u = inputUser?.value || "";
        const p = inputPwd?.value || "";
        if ((u && u.length) || (p && p.length)) {
          firstInteractAt = Date.now() - (MIN_FILL_MS + 50);
          form.classList.add("autofill-detected");
          clearInterval(poll);
        }
        if (Date.now() - t0 > AUTOFILL_MAX_MS) clearInterval(poll);
      }, AUTOFILL_POLL_MS);

      // También re-checar cuando la pestaña vuelve a estar visible
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          if ((inputUser?.value?.length || 0) || (inputPwd?.value?.length || 0)) {
            firstInteractAt = Date.now() - (MIN_FILL_MS + 50);
            form.classList.add("autofill-detected");
          }
        }
      });
    };
    startAutofillWatch();

    // Submit
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();

      const username = (inputUser?.value || "").trim();
      const password = inputPwd?.value || "";

      if (!validarUsuario(username)) {
        toast("Ingresa un usuario válido (email, teléfono o usuario).", "advertencia");
        inputUser?.focus();
        return;
      }
      if (!password || password.length < 6) {
        toast("La contraseña debe tener al menos 6 caracteres.", "advertencia");
        inputPwd?.focus();
        return;
      }

      if (!firstInteractAt && (username || password)) {
        firstInteractAt = Date.now() - (MIN_FILL_MS + 50);
      }

      const delta = Date.now() - firstInteractAt;
      if (delta < MIN_FILL_MS) {
        toast("Inténtalo de nuevo.", "advertencia");
        return;
      }

      const th = clientThrottleCheck(RL_MAX_PER_MIN, RL_WINDOW_SEC, RL_STORAGE_KEY);
      if (!th.allowed) {
        toast(`Demasiados intentos desde este dispositivo. Intenta en ${Math.ceil(th.remainingMs / 1000)}s.`, "advertencia");
        return;
      }

      setLoading(btn, true);

      try {
        // PoW opcional
        let pow = null;
        if (POW.enabled) {
          const bits = isMobile() ? POW.bitsMobile : POW.bitsDesktop;
          pow = await doPoW(bits, POW.timeoutMs, `${location.hostname}|${username}|${Date.now()}`);
        }

        // reCAPTCHA opcional
        const recaptchaToken = await getRecaptchaToken();

        const resp = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({
            username,
            password,
            _pow_bits:  pow?.bits  || 0,
            _pow_nonce: typeof pow?.nonce === "number" ? String(pow.nonce) : "",
            _pow_hash:  pow?.hash  || "",
            ...(RECAPTCHA.enabled ? { recaptcha_token: recaptchaToken, recaptcha_action: RECAPTCHA.action } : {}),
          }),
          cache: "no-store",
        });

        const status = resp.status;
        const out = await resp.json().catch(() => null);

        if (status === 200 && out?.ok && out?.data) {
          const emp   = out.data.empleado || {};
          const acc   = out.data.cuenta   || {};
          const roles = Array.isArray(out.data.roles)
            ? out.data.roles.map((r) => r?.codigo || r?.nombre).filter(Boolean)
            : [];

          // Guardar cookie 
          setSession({
            empleado_id:     emp.id ?? null,
            cuenta_id:       acc.id ?? null,
            id_usuario:      acc.id ?? null, 
            username:        acc.username || username,
            nombre:          emp.nombre   || "",
            apellidos:       emp.apellidos || "",
            email:           emp.email     || "",
            telefono:        emp.telefono  || "",
            puesto:          emp.puesto    || "Empleado",
            departamento_id: emp.departamento_id ?? 1,
            roles:           roles.length ? roles : ["Empleado"],
            status_empleado: emp.status ?? 1,
            status_cuenta:   acc.status ?? 1,
            created_by:      1,
          },);

          toast("Bienvenido", "exito");
          setTimeout(() => { window.location.href = REDIRECT_OK; }, 600);
          return;
        }

        if (status === 401) { toast("Usuario o contraseña inválidos.", "error");      setLoading(btn, false); return; }
        if (status === 423) { toast("Cuenta temporalmente bloqueada. Intenta más tarde.", "advertencia"); setLoading(btn, false); return; }
        if (status === 429) {
          const retry = resp.headers.get("Retry-After") || out?.retry_after || "60";
          toast(`Demasiados intentos. Intenta nuevamente en ${retry}s.`, "advertencia");
          setLoading(btn, false);
          return;
        }
        if (status === 403) { toast("Verificación de seguridad fallida.", "advertencia"); setLoading(btn, false); return; }

        toast(out?.error || "No se pudo iniciar sesión. Intenta más tarde.", "error");
      } catch (err) {
        console.error("[login] error:", err);
        toast("Error de conexión. Intenta más tarde.", "error");
      } finally {
        setLoading(btn, false);
      }
    });
  });
})();

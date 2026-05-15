// /PRI/JS/login.js
import { setSession } from "/PRI/JS/auth/session.js";

(() => {
  "use strict";

  const ENDPOINT = "/PRI/db/WEB/ixtla_login.php";
  const REDIRECT_OK = "/PRI/Views/home.php";

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

  function validarUsuario(usuario) {
    const v = String(usuario || "").trim();

    if (!v) return false;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return true;
    if (v.length >= 3) return true;

    return false;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".auth-form");
    if (!form) return;

    const btn = form.querySelector(".btn-login");
    const inputUser = form.querySelector('input[name="usuario"]');
    const inputPwd = form.querySelector('input[name="password"]');

    inputUser?.setAttribute("autocomplete", "username");
    inputUser?.setAttribute("autocapitalize", "none");
    inputUser?.setAttribute("spellcheck", "false");
    inputPwd?.setAttribute("autocomplete", "current-password");

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();

      const username = (inputUser?.value || "").trim();
      const password = inputPwd?.value || "";

      if (!validarUsuario(username)) {
        toast("Ingresa un usuario válido.", "advertencia");
        inputUser?.focus();
        return;
      }

      if (!password || password.length < 6) {
        toast("La contraseña debe tener al menos 6 caracteres.", "advertencia");
        inputPwd?.focus();
        return;
      }

      setLoading(btn, true);

      try {
        const resp = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({
            username,
            password,
          }),
          cache: "no-store",
        });

        const status = resp.status;
        const out = await resp.json().catch(() => null);

        console.log("[RED login] status:", status);
        console.log("[RED login] response:", out);

        if (status === 200 && out?.ok && out?.data) {
          setSession(out);

          toast("Bienvenido", "exito");

          setTimeout(() => {
            window.location.href = REDIRECT_OK;
          }, 600);

          return;
        }

        if (status === 401) {
          toast("Usuario o contraseña inválidos.", "error");
          return;
        }

        if (status === 423) {
          toast(
            out?.error || "Cuenta temporalmente bloqueada. Intenta más tarde.",
            "advertencia"
          );
          return;
        }

        if (status === 429) {
          const retry =
            resp.headers.get("Retry-After") || out?.retry_after || "60";

          toast(
            `Demasiados intentos. Intenta nuevamente en ${retry}s.`,
            "advertencia"
          );
          return;
        }

        if (status === 403) {
          toast("Verificación de seguridad fallida.", "advertencia");
          return;
        }

        toast(
          out?.error || "No se pudo iniciar sesión. Intenta más tarde.",
          "error"
        );
      } catch (err) {
        console.error("[RED login] error:", err);
        toast("Error de conexión. Intenta más tarde.", "error");
      } finally {
        setLoading(btn, false);
      }
    });
  });
})();
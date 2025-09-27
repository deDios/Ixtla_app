import { setSession } from "/JS/auth/session";

(() => {
  "use strict";
  const TAG = "[Login]";

  // Empleado simulado
  const EMP_SIM = {
    id_usuario: 12,
    nombre: "Juan Pablo",
    apellidos: "García Casillas",
    email: "many5@gmail.com",
    telefono: "33 1381 2235",
    puesto: "Empleado",
    departamento_id: 1,
    roles: ["Programador"],
    status_empleado: 1,
    status_cuenta: 1,
    created_by: 1
  };

  // Credenciales válidas para el entorno de pruebas
  const VALID_USER = "many5@gmail.com";
  const VALID_PASS = "12345678";

  window.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("form.auth-form");
    if (!form) {
      console.warn(`${TAG} No se encontró el formulario .auth-form`);
      return;
    }

    const userEl = form.querySelector('[name="usuario"]');
    const passEl = form.querySelector('[name="password"]');
    const btn    = form.querySelector(".btn-login");

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();

      const u = (userEl?.value || "").trim();
      const p = (passEl?.value || "").trim();

      if (!u || !p) {
        gcToast("Usuario y contraseña son requeridos.", "warning");
        return;
      }

      // Bloquear UI mientras validamos
      if (btn) btn.disabled = true;

      try {
        if (u === VALID_USER && p === VALID_PASS) {
          // Setear username en el payload y crear sesión
          const sess = setSession({ ...EMP_SIM, username: u }, 7);
          console.log(TAG, "Login OK. Sesión creada:", sess);
          gcToast(`Bienvenido, ${sess.nombre}.`, "exito");

          // Redirigir a Home
          setTimeout(() => { window.location.href = "/VIEWS/Home.php"; }, 600);
          return;
        }

        // Credenciales invalidas
        console.warn(TAG, "Intento de login inválido", { providedUser: u });
        gcToast("Usuario o contraseña inválidos.", "warning");
      } catch (err) {
        console.error(TAG, "Error en login simulado:", err);
        gcToast("Hubo un error, inténtalo más tarde.", "warning");
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  });
})();

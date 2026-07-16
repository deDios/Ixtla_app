(() => {
  "use strict";

  const TAG = "[Contacto]";

  // -------- Helpers --------
  const byName = (form, name) => form.querySelector(`[name="${name}"]`);
  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((s || "").trim());
  const minLen = (s, n) => (s || "").trim().length >= n;

  function normalizePhone(raw) {
    if (!raw) return "";
    let s = String(raw).trim();
    const keepPlus = s.startsWith("+");
    s = s.replace(/[^\d]/g, "");
    return keepPlus ? "+" + s : s;
  }

  function send(payload, delay = 800) {
    return new Promise((resolve) => {
      console.log(`${TAG} payload:`, payload);
      setTimeout(() => {
        const resp = { ok: true, message: "enviado", ts: Date.now() };
        console.log(`${TAG} resp:`, resp);
        resolve(resp);
      }, delay);
    });
  }

  // -------- Main --------
  window.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("form.form");
    if (!form) {
      console.warn(`${TAG} No se encontró el formulario .form`);
      return;
    }

    const btn = form.querySelector(".btn-enviar");
    const nombreEl = byName(form, "nombre");
    const apellidosEl = byName(form, "apellidos");
    const emailEl = byName(form, "email");
    const telefonoEl = byName(form, "telefono");
    const mensajeEl = byName(form, "mensaje");

    let sending = false;

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (sending) return;

      const nombre = (nombreEl?.value || "").trim();
      const apellidos = (apellidosEl?.value || "").trim();
      const email = (emailEl?.value || "").trim();
      const telefono = normalizePhone(telefonoEl?.value || "");
      const mensaje = (mensajeEl?.value || "").trim();

      if (!minLen(nombre, 2)) { gcToast("Escribe tu nombre.", "warning"); return; }
      if (!minLen(apellidos, 2)) { gcToast("Escribe tus apellidos.", "warning"); return; }
      if (!isEmail(email)) { gcToast("Escribe un correo válido.", "warning"); return; }
      if (telefono && telefono.replace(/\D/g, "").length < 10) {
        gcToast("El número telefónico parece incompleto.", "warning"); return;
      }
      if (!minLen(mensaje, 10)) { gcToast("Cuéntanos más en el mensaje (mínimo 10 caracteres).", "warning"); return; }

      const payload = {
        nombre,
        apellidos,
        email,
        telefono,
        asunto: "Consulta general",
        mensaje,
        estatus: 0,
        canal: 1,
        status: 1,
        created_by: 1
      };

      // Bloquear UI
      sending = true;
      if (btn) {
        btn.disabled = true;
        btn.dataset._oldText = btn.textContent;
        btn.textContent = "Enviando…";
      }

      try {
        const res = await send(payload, 900);
        console.log(TAG, "Simulación completada:", res);

        gcToast("¡Gracias! envio exitoso.", "exito");
        form.reset();

      } catch (err) {
        console.error(TAG, "Error en envío:", err);
        gcToast("Hubo un error, inténtalo más tarde.", "warning");
      } finally {
        sending = false;
        if (btn) {
          btn.disabled = false;
          btn.textContent = btn.dataset._oldText || "Enviar";
        }
      }
    });

    mensajeEl?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        form.requestSubmit?.();
      }
    });

    console.log(`${TAG} Contacto (modo SIMULADO) listo.`);
  });
})();

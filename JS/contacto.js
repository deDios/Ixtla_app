(() => {
  "use strict";

  const TAG = "[Contacto]";

  // ------ Utils ------
  const hasToast = typeof window.gcToast === "object" && window.gcToast;
  const toast = {
    ok:   (msg) => hasToast ? gcToast.success(msg) : console.log(TAG, "(ok)", msg),
    warn: (msg) => hasToast ? gcToast.warn(msg)    : console.warn(TAG, "(warn)", msg),
    err:  (msg) => hasToast ? gcToast.error(msg)   : console.error(TAG, "(err)", msg),
  };

  const byName = (form, name) => form.querySelector(`[name="${name}"]`);

  function normalizePhone(raw) {
    if (!raw) return "";
    let s = String(raw).trim();
    const keepPlus = s.startsWith("+");
    s = s.replace(/[^\d]/g, ""); 
    if (keepPlus) s = "+" + s;
    return s;
  }

  function isEmail(str) {
    if (!str) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(str.trim());
  }

  function minLen(str, n) {
    return (str || "").trim().length >= n;
  }

  // ------ Envío ------
  async function sendContacto(payload) {
    const API_URL = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/ixtla01_i_contacto.php";
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const text = await resp.text();
    try {
      const json = text ? JSON.parse(text) : {};
      if (!resp.ok) {
        const msg = json?.message || json?.error || `Error ${resp.status}`;
        throw new Error(msg);
      }
      return json;
    } catch (e) {
      if (!resp.ok) throw new Error(text || `Error ${resp.status}`);
      return { ok: true, raw: text };
    }
  }

  // ------ Main ------
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

      if (!minLen(nombre, 2)) return toast.warn("Escribe tu nombre.");
      if (!minLen(apellidos, 2)) return toast.warn("Escribe tus apellidos.");
      if (!isEmail(email)) return toast.warn("Escribe un correo válido.");
      if (telefono && telefono.replace(/\D/g, "").length < 10) {
        return toast.warn("El número telefónico parece incompleto.");
      }
      if (!minLen(mensaje, 10)) return toast.warn("Cuéntanos más en el mensaje (mínimo 10 caracteres).");

      const payload = {
        nombre,
        apellidos,
        email,
        telefono,
        asunto: "Consulta general", // pendiente
        mensaje,
        estatus: 0,   // pendiente
        canal: 1,     // Web
        status: 1,    // activo
        created_by: 1 // ajustar cuando manejemos usuarios
      };

      // Bloquear UI
      sending = true;
      if (btn) {
        btn.disabled = true;
        btn.dataset._oldText = btn.textContent;
        btn.textContent = "Enviando…";
      }

      try {
        const res = await sendContacto(payload);
        console.log(TAG, "Respuesta:", res);
        toast.ok("¡Gracias! Tu mensaje fue enviado correctamente.");
        form.reset();
      } catch (err) {
        console.error(TAG, err);
        toast.err(err?.message || "No se pudo enviar tu mensaje. Intenta de nuevo.");
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
  });
})();

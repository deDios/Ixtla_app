(() => {
  "use strict";

  const TAG = "[Contacto]";

  // endpoint
  const API_URL =
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/ixtla01_i_contacto.php";

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

  async function postJSON(url, payload) {
    console.log(`${TAG} → POST JSON`, url, payload);
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const raw = await resp.text();
    console.log(`${TAG} ← RESP JSON`, resp.status, "url:", resp.url);
    return { resp, raw };
  }

  async function postForm(url, payload) {
    const fd = new FormData();
    Object.entries(payload).forEach(([k, v]) => fd.append(k, v ?? ""));
    console.log(`${TAG} → POST FormData`, url, { ...payload, _preview: "FormData" });
    const resp = await fetch(url, { method: "POST", body: fd });
    const raw = await resp.text();
    console.log(`${TAG} ← RESP FormData`, resp.status, "url:", resp.url);
    return { resp, raw };
  }

  async function sendContacto(payload) {
    let { resp, raw } = await postJSON(API_URL, payload);
    if (resp.ok) return { resp, raw, mode: "json" };

    const msg = (raw || "").toLowerCase();
    const looksLikeMissingParam =
      msg.includes("falta parámetro") ||
      msg.includes("falta parametro") ||
      msg.includes("par\u00E1metro obligatorio") ||
      resp.status === 400;

    if (looksLikeMissingParam) {
      console.warn(`${TAG} Backend no aceptó JSON (status ${resp.status}). Reintentando con FormData...`);
      const retry = await postForm(API_URL, payload);
      if (retry.resp.ok) return { resp: retry.resp, raw: retry.raw, mode: "form" };
      return { resp: retry.resp, raw: retry.raw, mode: "form" };
    }
    return { resp, raw, mode: "json" };
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

    console.log(`${TAG} API_URL configurada:`, API_URL);

    let sending = false;

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (sending) return;

      const nombre = (nombreEl?.value || "").trim();
      const apellidos = (apellidosEl?.value || "").trim();
      const email = (emailEl?.value || "").trim();
      const telefono = normalizePhone(telefonoEl?.value || "");
      const mensaje = (mensajeEl?.value || "").trim();

      if (!minLen(nombre, 2)) return gcToast("Escribe tu nombre.", "warning");
      if (!minLen(apellidos, 2)) return gcToast("Escribe tus apellidos.", "warning");
      if (!isEmail(email)) return gcToast("Escribe un correo válido.", "warning");
      if (telefono && telefono.replace(/\D/g, "").length < 10)
        return gcToast("El número telefónico parece incompleto.", "warning");
      if (!minLen(mensaje, 10))
        return gcToast("Cuéntanos más en el mensaje (mínimo 10 caracteres).", "warning");

      // Payload 
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
        created_by: 1,
      };

      sending = true;
      if (btn) {
        btn.disabled = true;
        btn.dataset._oldText = btn.textContent;
        btn.textContent = "Enviando…";
      }

      try {
        const { resp, raw, mode } = await sendContacto(payload);

        console.log(`${TAG} Resultado`, {
          status: resp.status,
          ok: resp.ok,
          modoEnvio: mode,
          resolvedURL: resp.url,
          raw,
        });

        if (!resp.ok) {
          console.error(`${TAG} Error HTTP`, resp.status, raw);
          gcToast("Hubo un error, inténtalo más tarde.", "warning");
          return;
        }

        let json;
        try {
          json = raw ? JSON.parse(raw) : { ok: true };
        } catch {
          json = { ok: true, raw };
        }

        console.log(`${TAG} Éxito`, json);
        gcToast("¡Gracias! Tu mensaje fue enviado correctamente.", "exito");
        form.reset();
      } catch (err) {
        console.error(`${TAG} Excepción`, err);
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
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) form.requestSubmit?.();
    });
  });
})();
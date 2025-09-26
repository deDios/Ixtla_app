(() => {
  "use strict";
  const TAG = "[Contacto]";

  // --------- Selectores base ----------
  const form = document.querySelector('#login .form');
  if (!form) return console.warn(TAG, "No se encontró el formulario de contacto.");

  const btn = form.querySelector('.btn-enviar');

  // Área para anunciar estados (accesibilidad)
  let live = document.getElementById('contacto-live');
  if (!live) {
    live = document.createElement('div');
    live.id = 'contacto-live';
    live.setAttribute('aria-live', 'polite');
    live.className = 'visually-hidden';
    form.appendChild(live);
  }

  // --------- Utils ----------
  const gcToastSafe = (msg, type = "success", dur = 3200) => {
    if (typeof window.gcToast === "function") {
      // Usa tu sistema de toasts global
      window.gcToast({ message: msg, type, duration: dur });
    } else {
      // Fallback por si no está cargado aún
      alert(msg);
    }
  };

  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
  const telOk   = (v) => {
    const s = String(v).replace(/\D+/g, "");
    return s.length >= 10; 
  };

  const setLoading = (on) => {
    if (!btn) return;
    btn.disabled = !!on;
    btn.classList.toggle('is-loading', !!on);
    btn.textContent = on ? "Enviando..." : "Enviar";
  };

  const getData = () => {
    const fd = new FormData(form);
    return {
      nombre:   (fd.get("nombre")   || "").toString().trim(),
      apellidos:(fd.get("apellidos")|| "").toString().trim(),
      email:    (fd.get("email")    || "").toString().trim(),
      telefono: (fd.get("telefono") || "").toString().trim(),
      mensaje:  (fd.get("mensaje")  || "").toString().trim(),
    };
  };

  // --------- Validación ligera ----------
  const validate = () => {
    const d = getData();

    if (d.nombre.length < 2)       return { ok:false, msg:"Escribe tu nombre." };
    if (!emailOk(d.email))         return { ok:false, msg:"Escribe un correo válido." };
    if (!telOk(d.telefono))        return { ok:false, msg:"Escribe un teléfono válido (10 dígitos)." };
    if (d.mensaje.length < 5)      return { ok:false, msg:"Cuéntanos brevemente tu solicitud." };

    return { ok:true, data: d };
  };

  // --------- Manejador de submit ----------
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();

    const v = validate();
    if (!v.ok) {
      gcToastSafe(v.msg, "warning", 3600);
      live.textContent = v.msg;
      if (v.msg.includes("nombre"))   form.elements["nombre"]?.focus();
      else if (v.msg.includes("correo")) form.elements["email"]?.focus();
      else if (v.msg.includes("tel")) form.elements["telefono"]?.focus();
      else form.elements["mensaje"]?.focus();
      return;
    }

    setLoading(true);
    live.textContent = "Enviando…";

    const MOCK_LATENCY = 1200;
    setTimeout(() => {
      console.log(TAG, "Payload simulado:", v.data);
      gcToastSafe("¡Gracias! Tu mensaje fue enviado correctamente.", "success", 3600);
      live.textContent = "Mensaje enviado correctamente.";

      form.reset();
      setLoading(false);
    }, MOCK_LATENCY);
  });

  const updateBtnState = () => {
    const d = getData();
    const ready = d.nombre && emailOk(d.email) && telOk(d.telefono) && d.mensaje.length >= 5;
    if (btn) btn.disabled = !ready;
  };

  form.addEventListener('input', updateBtnState);
  form.addEventListener('change', updateBtnState);
  updateBtnState();

})();

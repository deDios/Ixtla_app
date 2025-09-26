(() => {
  "use strict";
  const TAG = "[Cotizar]";

  // ------------------ Config ------------------
  const MIN_DESC = 10;        
  const MOCK_LATENCY = 1200;  

  const _tipoMap = {
    success: "exito",
    warning: "advertencia",
    warn:    "advertencia",
    error:   "error",
    info:    "info",
    exito:   "exito",
  };
  
  const gcToastSafe = (msg, type = "success", dur = 3200) => {
    const fn = window.gcToast;
    const tipoES = _tipoMap[type] || type || "exito";
    if (typeof fn === "function") return fn(msg, tipoES, dur);
    alert(msg);
  };

  // ------------------ Selectores base ------------------
  const root = document.getElementById("cotizar") || document;
  const form = root.querySelector(".form") || root.querySelector("[data-cotizar-form]");
  if (!form) return console.warn(TAG, "No se encontró el formulario de cotizar.");

  const btn  = form.querySelector(".btn-enviar");

  const el = {
    nombre:   form.elements["nombre"]    || null,
    apellidos:form.elements["apellidos"] || null,
    email:    form.elements["email"]     || null,
    telefono: form.elements["telefono"]  || null,
    servicio: form.elements["servicio"]  || form.elements["asunto"] || null, // select o input
    mensaje:  form.elements["mensaje"]   || null,
  };

  // ------------------ Region viva ------------------
  let live = document.getElementById("cotizar-live");
  if (!live) {
    live = document.createElement("div");
    live.id = "cotizar-live";
    live.setAttribute("aria-live", "polite");
    live.className = "visually-hidden";
    form.appendChild(live);
  }

  // ------------------ Utils ------------------
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
  const telOk   = (v) => String(v || "").replace(/\D+/g, "").length >= 10;

  const setLoading = (on) => {
    if (!btn) return;
    btn.disabled = !!on;
    btn.classList.toggle("is-loading", !!on);
    btn.textContent = on ? "Enviando..." : "Enviar";
  };

  const getData = () => {
    const fd = new FormData(form);
    const d = {
      nombre:    (fd.get("nombre")    || "").toString().trim(),
      apellidos: (fd.get("apellidos") || "").toString().trim(),
      email:     (fd.get("email")     || "").toString().trim(),
      telefono:  (fd.get("telefono")  || "").toString().trim(),
      servicio:  (fd.get("servicio")  || fd.get("asunto") || "").toString().trim(),
      mensaje:   (fd.get("mensaje")   || "").toString().trim(),
    };
    return d;
  };

  const validate = () => {
    const d = getData();
    if (!d.nombre || d.nombre.length < 2)     return { ok:false, msg:"Escribe tu nombre." };
    if (!emailOk(d.email))                    return { ok:false, msg:"Escribe un correo válido." };
    if (!telOk(d.telefono))                   return { ok:false, msg:"Escribe un teléfono válido (10 dígitos)." };
    if (el.servicio && !d.servicio)           return { ok:false, msg:"Selecciona o escribe el servicio/asunto." };
    if (!d.mensaje || d.mensaje.length < MIN_DESC)
                                              return { ok:false, msg:`El mensaje debe tener al menos ${MIN_DESC} caracteres.` };
    return { ok:true, data: d };
  };

  // ------------------ Contador de caracteres ------------------
  const outCounter =
    root.querySelector("#contador-descripcion") ||
    root.querySelector('.char-counter[data-cc-for="mensaje"]') ||
    null;

  const updateDescCount = () => {
    if (!el.mensaje || !outCounter) return;
    const len = (el.mensaje.value || "").length;
    const max = el.mensaje.maxLength > 0 ? el.mensaje.maxLength : null;
    outCounter.textContent = max
      ? `${len}/${max} — mínimo ${MIN_DESC} caracteres`
      : `${len} — mínimo ${MIN_DESC} caracteres`;
  };

  // ------------------ Habilitar boton si los campos ya estan validos ------------------
  const updateBtnState = () => {
    if (!btn) return;
    const d = getData();
    const ready =
      (!!d.nombre && d.nombre.length >= 2) &&
      emailOk(d.email) &&
      telOk(d.telefono) &&
      (!el.servicio || !!d.servicio) &&
      (!!d.mensaje && d.mensaje.length >= MIN_DESC);
    btn.disabled = !ready;
  };

  // ------------------ Submit ------------------
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const v = validate();
    if (!v.ok) {
      gcToastSafe(v.msg, "warning", 3600);
      live.textContent = v.msg;
      if (v.msg.includes("nombre"))        el.nombre?.focus();
      else if (v.msg.includes("correo"))   el.email?.focus();
      else if (v.msg.includes("teléfono")) el.telefono?.focus();
      else if (v.msg.includes("servicio")) el.servicio?.focus();
      else                                  el.mensaje?.focus();
      return;
    }

    setLoading(true);
    live.textContent = "Enviando…";
    setTimeout(() => {
      console.log(TAG, "Payload simulado:", v.data);
      gcToastSafe("¡Gracias! Tu solicitud de cotización fue enviada.", "success", 3600);
      live.textContent = "Cotización enviada correctamente.";
      form.reset();
      updateDescCount();
      updateBtnState();
      setLoading(false);
    }, MOCK_LATENCY);
  });

  // ------------------ Listeners ------------------
  form.addEventListener("input", () => {
    updateDescCount();
    updateBtnState();
  });
  form.addEventListener("change", () => {
    updateDescCount();
    updateBtnState();
  });

  updateDescCount();
  updateBtnState();
})();

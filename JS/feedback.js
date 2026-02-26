(function () {
  const $ = (s, r=document) => r.querySelector(s);

  const modal = $("#retro-modal");
  const sendBtn = $("#retro-send");

  // 1) Bloquear scroll de la página (modal “en regla”)
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";

  // 2) NO permitir cerrar: bloquear ESC y clicks fuera
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // Evita que el overlay haga algo (solo absorbe el click)
  const overlay = modal.querySelector(".ix-modal__overlay");
  overlay.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  // 3) Habilitar botón Enviar cuando hay rate
  function getRate(){
    const checked = document.querySelector("input[name='rate']:checked");
    return checked ? checked.value : "";
  }

  function refresh(){
    sendBtn.disabled = !getRate();
  }

  document.addEventListener("change", (e) => {
    if (e.target && e.target.name === "rate") refresh();
  });

  // (por ahora) click de enviar
  sendBtn.addEventListener("click", () => {
    // aquí luego conectamos endpoint real
    // por ahora solo demo:
    sendBtn.disabled = true;
    sendBtn.textContent = "Enviando...";
    setTimeout(() => {
      sendBtn.textContent = "Enviar";
      refresh();
      // aquí puedes abrir el mini-modal de gracias si quieres
    }, 800);
  });

  refresh();
})();
(function () {
  const $ = (s, r = document) => r.querySelector(s);

  const modal = $("#retro-modal");
  const sendBtn = $("#retro-send");

  // Mini modal
  const miniOverlay = $("#retro-overlay");
  const mini = $("#retro-mini");
  const miniTitle = $("#retro-mini-title");
  const miniMsg = $("#retro-mini-msg");
  const finishBtn = $("#retro-finish");

  // 1) Bloquear scroll
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";

  // 2) NO permitir cerrar
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  // el overlay no hace nada, solo es visual 
  const overlay = modal.querySelector(".ix-modal__overlay");
  overlay.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  // Helpers mini modal
  function openMini({ title = "Muchas gracias", message = "Tu retroalimentación fue registrada correctamente." } = {}) {
    if (miniTitle) miniTitle.textContent = title;
    if (miniMsg) miniMsg.textContent = message;

    // Mostrar (quita hidden)
    if (miniOverlay) miniOverlay.hidden = false;
    if (mini) mini.hidden = false;

    modal?.setAttribute("aria-hidden", "true");
  }

  function closeMini() {
    if (miniOverlay) miniOverlay.hidden = true;
    if (mini) mini.hidden = true;
    modal?.setAttribute("aria-hidden", "false");
  }

  finishBtn?.addEventListener("click", () => {
    // 1) cerrar mini modal
    closeMini();

    // 2) redirigir al index 
    window.location.href = "/index.php";
  });

  // 3) Habilitar botón Enviar cuando hay rate
  function getRate() {
    const checked = document.querySelector("input[name='rate']:checked");
    return checked ? checked.value : "";
  }

  function refresh() {
    sendBtn.disabled = !getRate();
  }

  document.addEventListener("change", (e) => {
    if (e.target && e.target.name === "rate") refresh();
  });

  // click de enviar
  sendBtn.addEventListener("click", () => {
    // aquí luego conectamos endpoint real
    sendBtn.disabled = true;
    sendBtn.textContent = "Enviando...";

    setTimeout(() => {
      sendBtn.textContent = "Enviar";
      refresh();

      // Mostrar mini modal de exito
      openMini({
        title: "Muchas gracias",
        message: "Tu retroalimentación fue registrada correctamente."
      });

      openMini({ title: "Muchas gracias", message: "Actualmente ya has respondido esta encuesta." });

    }, 800);
  });

  refresh();
})();
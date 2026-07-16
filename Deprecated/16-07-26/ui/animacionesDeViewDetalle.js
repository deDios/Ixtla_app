// tabs suaves
(() => {
  const tabs = Array.from(document.querySelectorAll(".exp-tab"));
  const panes = Array.from(document.querySelectorAll(".exp-pane"));
  const host = document.querySelector(".exp-panes");
  if (!tabs.length || !panes.length || !host) return;

  function setActive(i) {
    const cur = document.querySelector(".exp-pane.is-active");
    const oldH = cur ? cur.offsetHeight : host.offsetHeight;
    host.style.height = oldH + "px";

    tabs.forEach((t) => t.classList.remove("is-active"));
    panes.forEach((p) => p.classList.remove("is-active"));
    tabs[i].classList.add("is-active");
    panes[i].classList.add("is-active");

    const newH = panes[i].offsetHeight;
    requestAnimationFrame(() => {
      host.style.height = newH + "px";
      setTimeout(() => (host.style.height = "auto"), 200);
    });

    // Accesibilidad
    tabs.forEach((t, idx) =>
      t.setAttribute("aria-selected", String(idx === i))
    );
  }

  tabs.forEach((t, i) =>
    t.addEventListener("click", (e) => {
      e.preventDefault();
      setActive(i);
    })
  );
})();






// /JS/accordionFX.js — utilidades de animación para acordeones
(function () {
  "use strict";

  function animateOpen(el) {
    el.hidden = false;
    el.style.overflow = "hidden";
    el.style.height = "0px";
    el.getBoundingClientRect();            // reflow
    const h = el.scrollHeight;
    el.style.transition = "height 180ms ease";
    el.style.height = h + "px";
    const done = () => {
      el.style.transition = ""; el.style.height = ""; el.style.overflow = "";
      el.removeEventListener("transitionend", done);
    };
    el.addEventListener("transitionend", done);
  }

  function animateClose(el) {
    el.style.overflow = "hidden";
    const h = el.offsetHeight;
    el.style.height = h + "px";
    el.getBoundingClientRect();            // reflow
    el.style.transition = "height 160ms ease";
    el.style.height = "0px";
    const done = () => {
      el.hidden = true;
      el.style.transition = ""; el.style.height = ""; el.style.overflow = "";
      el.removeEventListener("transitionend", done);
    };
    el.addEventListener("transitionend", done);
  }

  function setAria(head, open) {
    head?.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function toggleByHead(head, body) {
    const isOpen = head?.getAttribute("aria-expanded") === "true";
    setAria(head, !isOpen);
    !isOpen ? animateOpen(body) : animateClose(body);
  }

  window.AccordionFX = {
    open:  (head, body) => { setAria(head, true);  animateOpen(body);  },
    close: (head, body) => { setAria(head, false); animateClose(body); },
    toggleByHead,
  };
})();

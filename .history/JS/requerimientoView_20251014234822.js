

// Evidencias: toggle aria-expanded del acordeón
(() => {
  const heads = document.querySelectorAll('.exp-accordion .exp-acc-head');
  heads.forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      // (Opcional) si luego quieres colapsar visualmente el body:
      const body = btn.nextElementSibling;
      if (!body) return;
      body.style.display = expanded ? 'none' : 'block';
    });
  });
})();

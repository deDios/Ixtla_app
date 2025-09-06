
(() => {
  const form = document.querySelector('.tram-form');
  if (!form) return;

  const field = form.querySelector('.tram-field');
  const input = form.querySelector('#tramId');
  const help  = form.querySelector('.tram-help');
  const panel = document.querySelector('.tram-result');

  const RE = /^ID\d{5}$/i;            // ID + 5 dígitos (ID00001)

  function setState(ok, msg){
    field.classList.toggle('is-ok', !!ok);
    field.classList.toggle('is-error', !ok);
    if (help){
      help.hidden = !!ok;
      if (!ok && msg) help.textContent = msg;
      else help.textContent = 'Formato: ID + 5 dígitos (p. ej. ID00001)';
    }
  }

  input.addEventListener('input', () => {
    input.value = input.value.toUpperCase().replace(/\s+/g,'');
    if (!input.value) { field.classList.remove('is-ok','is-error'); help.hidden = true; }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = (input.value || '').trim().toUpperCase();

    if (!RE.test(id)){
      setState(false, 'Ingresa un folio con el formato ID00001');
      window.gcToast?.('Folio inválido', 'warning', 3000);
      return;
    }

    setState(true);
    panel.innerHTML = `<p>Buscando el trámite <strong>${id}</strong>…</p>`;

    try {
      /* Conecta aquí tu backend real:
         const res = await fetch('/api/tramites/estado?id=' + encodeURIComponent(id));
         if (!res.ok) throw new Error('Error de servidor');
         const data = await res.json();
         panel.innerHTML = renderEstado(data);
      */
      // Demo (simulación):
      await new Promise(r => setTimeout(r, 600));
      panel.innerHTML = `
        <p><strong>${id}</strong> — <em>En proceso</em></p>
        <p>Última actualización: 22 de julio del 2025</p>
      `;
    } catch (err){
      setState(false, 'No fue posible consultar el trámite en este momento.');
      panel.innerHTML = `<p style="color:#b04c4c;">Ocurrió un error al consultar el trámite.</p>`;
      window.gcToast?.('Error al consultar', 'error', 3500);
    }
  });
})();


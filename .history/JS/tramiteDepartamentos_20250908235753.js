
(() => {
  const form = document.querySelector('.tram-form');
  if (!form) return;

  const field = form.querySelector('.tram-field');
  const input = form.querySelector('#tramId');
  const help = form.querySelector('.tram-help');
  const panel = document.querySelector('.tram-result');

  const RE = /^ID\d{5}$/i;            // ID + 5 dígitos (ID00001)

  function setState(ok, msg) {
    field.classList.toggle('is-ok', !!ok);
    field.classList.toggle('is-error', !ok);
    if (help) {
      help.hidden = !!ok;
      if (!ok && msg) help.textContent = msg;
      else help.textContent = 'Formato: ID + 5 dígitos (p. ej. ID00001)';
    }
  }

  input.addEventListener('input', () => {
    input.value = input.value.toUpperCase().replace(/\s+/g, '');
    if (!input.value) { field.classList.remove('is-ok', 'is-error'); help.hidden = true; }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = (input.value || '').trim().toUpperCase();

    if (!RE.test(id)) {
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
    } catch (err) {
      setState(false, 'No fue posible consultar el trámite en este momento.');
      panel.innerHTML = `<p style="color:#b04c4c;">Ocurrió un error al consultar el trámite.</p>`;
      window.gcToast?.('Error al consultar', 'error', 3500);
    }
  });
})();

//----------------------------- modulo de departamentos. 
// ===== Tramites: panel por departamento (SAMAPA activo; resto inactivo) =====
document.addEventListener('DOMContentLoaded', () => {
  const wrap = document.querySelector('#tramites .ix-wrap');
  if (!wrap) return;

  const grid = wrap.querySelector('.ix-grid');
  const note = wrap.querySelector('.ix-note');
  const h2 = wrap.querySelector('#deps-title');

  // Crea el panel si no existe
  let panel = wrap.querySelector('.ix-dep-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'ix-dep-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="ix-dep-toolbar">
        <h2 class="ix-dep-heading">Trámites disponibles</h2>
        <div class="ix-dep-actions" aria-hidden="true">
          <!-- Placeholder de acciones (vista/lista); sin funcionalidad aún -->
          <button type="button" class="ix-action" title="Vista de lista" aria-label="Vista de lista">≡</button>
          <button type="button" class="ix-action" title="Vista de tarjetas" aria-label="Vista de tarjetas">▦</button>
        </div>
      </div>
      <ul class="ix-dep-list" id="ix-dep-list"></ul>
      <a class="ix-dep-back" href="/VIEWS/tramiteDepartamento.php">← Ver todos los departamentos</a>
    `;
    wrap.appendChild(panel);
  }

  const list = panel.querySelector('#ix-dep-list');

  // ---------- Catálogo de deps ----------
  // Nota: aceptamos 'simapa' como alias de 'samapa' por si llega así en la URL.
  const alias = (v) => (v === 'simapa' ? 'samapa' : v);

  const DEPS = {
    samapa: {
      name: 'SAMAPA',
      title: 'Trámites disponibles',
      inactive: false,
      items: [
        {
          id: 'fuga-agua',
          title: 'Fuga de agua',
          desc:
            '¿Observaste una fuga de agua? Reporta ubicación y detalles; nos contactaremos para atenderla a la brevedad.',
          icon: '/ASSETS/departamentos/modulosAssets/Simapa/fuga-agua.png', // opcional, cambia si tienes los íconos
        },
        {
          id: 'fuga-drenaje',
          title: 'Fuga de drenaje',
          desc:
            '¿Detectaste una fuga de drenaje? Informa ubicación y detalles; tu reporte será atendido a la brevedad.',
          icon: '/ASSETS/departamentos/modulosAssets/Simapa/fuga-drenaje.png',
        },
        {
          id: 'sin-agua',
          title: 'No disponemos de agua',
          desc:
            '¿No dispones de agua? Indícanos ubicación y detalles; tu reporte será atendido para proteger el servicio.',
          icon: '/ASSETS/departamentos/modulosAssets/Simapa/sin-agua.png',
        },
        {
          id: 'baja-presion',
          title: 'Baja presión de agua',
          desc:
            '¿Experimentas baja presión? Indica ubicación y detalles; daremos seguimiento para mejorar el servicio.',
          icon: '/ASSETS/departamentos/modulosAssets/Simapa/baja-presion.png',
        },
        {
          id: 'otros',
          title: 'Otros',
          desc:
            '¿Otro problema relacionado con el suministro? Compártenos ubicación y detalles para atenderlo.',
          icon: '/ASSETS/departamentos/modulosAssets/Simapa/otros.png',
        },
      ],
    },
    limpieza: { name: 'Recolección y limpieza', inactive: true },
    obras: { name: 'Obras y servicios públicos', inactive: true },
    alumbrado: { name: 'Alumbrado y energía urbana', inactive: true },
    ambiental: { name: 'Gestión ambiental y ecología', inactive: true },
  };

  // ---------- Utilidades ----------
  const plusSvg = `
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M12 7v10M7 12h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`.trim();

  function renderItem(depKey, item, disabled) {
    const li = document.createElement('li');
    li.className = 'ix-dep-item' + (disabled ? ' is-disabled' : '');
    li.innerHTML = `
      <div class="ix-dep-media">
        ${item.icon ? `<img src="${item.icon}" alt="" onerror="this.style.display='none'">` : ''}
      </div>
      <div class="ix-dep-content">
        <h3>${item.title}</h3>
        <p>${item.desc || ''}</p>
      </div>
      <button type="button" class="ix-dep-add" data-dep="${depKey}" data-id="${item.id}" data-title="${item.title}" aria-label="Iniciar ${item.title}">
        ${plusSvg}
      </button>
    `;
    return li;
  }

  function renderInactive(depKey, conf) {
    list.innerHTML = `
      <li class="ix-dep-empty">
        <p><strong>${conf.name || depKey}</strong>: Módulo inactivo.</p>
        <p>Próximamente estará disponible esta sección.</p>
      </li>
    `;
  }

  function showDefault() {
    panel.hidden = true;
    list.innerHTML = '';
    note.hidden = false;
    grid.style.display = '';
    h2.textContent = 'Selecciona un Departamento';
    document.title = 'Trámites / Departamentos';
  }

  function showDep(rawKey) {
    const key = alias((rawKey || '').toLowerCase());
    const conf = DEPS[key];
    if (!conf) return showDefault();

    // Mostrar panel y ocultar grid
    grid.style.display = 'none';
    note.hidden = true;
    panel.hidden = false;
    panel.dataset.dep = key;

    // Títulos
    const depName = conf.name || key;
    h2.textContent = `Trámites de ${depName}`;
    panel.querySelector('.ix-dep-heading').textContent = conf.title || 'Trámites disponibles';
    document.title = `Trámites – ${depName}`;

    // Lista
    list.innerHTML = '';
    if (conf.inactive) {
      renderInactive(key, conf);
      return;
    }
    (conf.items || []).forEach(item => list.appendChild(renderItem(key, item, false)));
  }

  // Click en "+"
  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('.ix-dep-add');
    if (!btn) return;

    const key = panel.dataset.dep;
    const conf = DEPS[key];
    if (!conf || conf.inactive) {
      window.gcToast ? gcToast('Módulo inactivo', 'warning') : alert('Módulo inactivo');
      return;
    }

    const itemTitle = btn.dataset.title || 'Trámite';
    // Aquí integrarás el form real; por ahora solo aviso:
    window.gcToast
      ? gcToast(`Abrir formulario: ${itemTitle}`, 'exito', 2800)
      : alert(`Abrir formulario: ${itemTitle}`);
  });

  // Estado inicial por URL (?dep=…)
  const params = new URLSearchParams(window.location.search);
  const depParam = params.get('dep');
  depParam ? showDep(depParam) : showDefault();

  // Navegación con back/forward si la usas más adelante
  window.addEventListener('popstate', () => {
    const p = new URLSearchParams(window.location.search).get('dep');
    p ? showDep(p) : showDefault();
  });
});


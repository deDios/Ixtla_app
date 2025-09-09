
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
document.addEventListener('DOMContentLoaded', () => {
  const wrap = document.querySelector('#tramites .ix-wrap');
  if (!wrap) return;

  const grid = wrap.querySelector('.ix-grid');
  const note = wrap.querySelector('.ix-note');
  const h2   = wrap.querySelector('#deps-title');

  // ---------- Preferencia de vista ----------
  const VIEW_KEY = 'ix_deps_view';
  const getView = () => (sessionStorage.getItem(VIEW_KEY) || 'list'); // 'list' | 'cards'
  const setView = (v) => sessionStorage.setItem(VIEW_KEY, v);

  // Crea el panel si no existe
  let panel = wrap.querySelector('.ix-dep-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'ix-dep-panel view-' + getView();
    panel.hidden = true;
    panel.innerHTML = `
      <div class="ix-dep-toolbar">
        <h2 class="ix-dep-heading">Trámites disponibles</h2>
        <div class="ix-dep-actions">
          <button type="button" class="ix-action ix-action--list" aria-label="Vista de lista" aria-pressed="true">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <polyline points="4,6.5 6,8.5 9.5,4.5" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="12" y1="6.5" x2="20" y2="6.5" stroke-linecap="round"/>
              <polyline points="4,12 6,14 9.5,10" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="12" y1="12" x2="20" y2="12" stroke-linecap="round"/>
              <polyline points="4,17.5 6,19.5 9.5,15.5" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="12" y1="17.5" x2="20" y2="17.5" stroke-linecap="round"/>
            </svg>
          </button>
          <button type="button" class="ix-action ix-action--grid" aria-label="Vista de tarjetas" aria-pressed="false">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5"  y="5"  width="6" height="6" rx="1.2"/>
              <rect x="13" y="5"  width="6" height="6" rx="1.2"/>
              <rect x="5"  y="13" width="6" height="6" rx="1.2"/>
              <rect x="13" y="13" width="6" height="6" rx="1.2"/>
            </svg>
          </button>
        </div>
      </div>
      <ul class="ix-dep-list" id="ix-dep-list"></ul>
      <a class="ix-dep-back" href="/VIEWS/tramiteDepartamento.php">← Ver todos los departamentos</a>
    `;
    wrap.appendChild(panel);
  }

  const listEl = panel.querySelector('#ix-dep-list');
  const btnList = panel.querySelector('.ix-action--list');
  const btnGrid = panel.querySelector('.ix-action--grid');

  // ---------- Catálogo ----------
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
          desc: '¿Observaste una fuga de agua? Reporta ubicación y detalles; nos contactaremos para atenderla a la brevedad.',
          icon: '/ASSETS/departamentos/modulosAssets/Simapa/fuga-agua.png',
          photo: '/ASSETS/departamentos/modulosAssets/Simapa/fuga-agua.png',
          sla: '24h'
        },
        {
          id: 'fuga-drenaje',
          title: 'Fuga de drenaje',
          desc: '¿Detectaste una fuga de drenaje? Informa ubicación y detalles; tu reporte será atendido a la brevedad.',
          icon: '/ASSETS/departamentos/modulosAssets/Simapa/fuga-drenaje.png',
          photo: '/ASSETS/departamentos/modulosAssets/Simapa/fuga-drenaje_card.png',
          sla: '24h'
        },
        {
          id: 'sin-agua',
          title: 'No disponemos de agua',
          desc: '¿No dispones de agua? Indícanos ubicación y detalles; daremos seguimiento para restablecer el servicio.',
          icon: '/ASSETS/departamentos/modulosAssets/Simapa/sin-agua.png',
          photo: '/ASSETS/departamentos/modulosAssets/Simapa/sin-agua_card.png',
          sla: '24h'
        },
        {
          id: 'baja-presion',
          title: 'Baja presión de agua',
          desc: '¿Experimentas baja presión? Indica ubicación y detalles; daremos seguimiento para mejorar el servicio.',
          icon: '/ASSETS/departamentos/modulosAssets/Simapa/baja-presion.png',
          photo: '/ASSETS/departamentos/modulosAssets/Simapa/baja-presion_card.png',
          sla: '24h'
        },
        {
          id: 'otros',
          title: 'Otros',
          desc: '¿Otro problema relacionado con el suministro? Compártenos ubicación y detalles para atenderlo.',
          icon: '/ASSETS/departamentos/modulosAssets/Simapa/otros.png',
          photo: '/ASSETS/departamentos/modulosAssets/Simapa/otros_card.png',
          sla: '24h'
        },
      ],
    },
    limpieza:   { name: 'Recolección y limpieza',       inactive: true },
    obras:      { name: 'Obras y servicios públicos',    inactive: true },
    alumbrado:  { name: 'Alumbrado y energía urbana',    inactive: true },
    ambiental:  { name: 'Gestión ambiental y ecología',  inactive: true },
  };

  // ---------- Renderers ----------
  const plusSvg = `
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M12 7v10M7 12h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`.trim();

  function el(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstChild; }

  function renderListItem(depKey, it){
    return el(`
      <li class="ix-dep-item">
        <div class="ix-dep-media">${it.icon ? `<img src="${it.icon}" alt="" onerror="this.style.display='none'">` : ''}</div>
        <div class="ix-dep-content">
          <h3>${it.title}</h3>
          <p>${it.desc || ''}</p>
        </div>
        <button type="button" class="ix-dep-add" data-dep="${depKey}" data-id="${it.id}" data-title="${it.title}" aria-label="Iniciar ${it.title}">
          ${plusSvg}
        </button>
      </li>
    `);
  }

  function renderCardItem(depKey, it){
    return el(`
      <li class="ix-dep-item ix-card">
        <div class="ix-card-img">${it.photo ? `<img src="${it.photo}" alt="" onerror="this.parentNode.style.display='none'">` : ''}</div>
        <div class="ix-card-body">
          <h3 class="ix-card-title">${it.title}</h3>
          <p class="ix-card-desc">${it.desc || ''}</p>
          <div class="ix-card-meta">
            <small>Tiempo aproximado: ${it.sla || '-'}</small>
            <button type="button" class="ix-dep-add ix-card-btn" data-dep="${depKey}" data-id="${it.id}" data-title="${it.title}">Crear</button>
          </div>
        </div>
      </li>
    `);
  }

  function renderInactive(depKey, conf) {
    listEl.innerHTML = `
      <li class="ix-dep-empty">
        <p><strong>${conf.name || depKey}</strong>: Módulo inactivo.</p>
        <p>Próximamente estará disponible esta sección.</p>
      </li>
    `;
  }

  function reRender(conf){
    listEl.innerHTML = '';
    const v = getView(); // 'list' | 'cards'
    const renderer = v === 'cards' ? renderCardItem : renderListItem;
    (conf.items || []).forEach(it => listEl.appendChild(renderer(panel.dataset.dep, it)));

    // toggle clases y estado visual de botones
    panel.classList.toggle('view-list',  v === 'list');
    panel.classList.toggle('view-cards', v === 'cards');
    btnList.setAttribute('aria-pressed', String(v === 'list'));
    btnGrid.setAttribute('aria-pressed', String(v === 'cards'));
  }

  // ---------- Navegación de vista (toolbar) ----------
  btnList.addEventListener('click', () => {
    if (getView() === 'list') return;
    setView('list'); reRender(DEPS[panel.dataset.dep]);
  });
  btnGrid.addEventListener('click', () => {
    if (getView() === 'cards') return;
    setView('cards'); reRender(DEPS[panel.dataset.dep]);
  });

  // ---------- Estados de página ----------
  function showDefault() {
    panel.hidden = true; listEl.innerHTML = '';
    note.hidden = false; grid.style.display = '';
    h2.textContent = 'Selecciona un Departamento';
    document.title = 'Trámites / Departamentos';
  }

  function showDep(rawKey) {
    const key = alias((rawKey || '').toLowerCase());
    const conf = DEPS[key];
    if (!conf) return showDefault();

    grid.style.display = 'none';
    note.hidden = true;
    panel.hidden = false;
    panel.dataset.dep = key;

    const depName = conf.name || key;
    h2.textContent = `Trámites de ${depName}`;
    panel.querySelector('.ix-dep-heading').textContent = conf.title || 'Trámites disponibles';
    document.title = `Trámites – ${depName}`;

    if (conf.inactive) { renderInactive(key, conf); return; }
    reRender(conf);
  }

  // Click en “Crear” / “+”
  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('.ix-dep-add');
    if (!btn) return;
    const itemTitle = btn.dataset.title || 'Trámite';
    window.gcToast ? gcToast(`Abrir formulario: ${itemTitle}`, 'exito', 2800) : alert(`Abrir formulario: ${itemTitle}`);
  });

  // Estado inicial por URL
  const params = new URLSearchParams(window.location.search);
  const depParam = params.get('dep');
  depParam ? showDep(depParam) : showDefault();

  // back/forward (si cambian la URL)
  window.addEventListener('popstate', () => {
    const p = new URLSearchParams(window.location.search).get('dep');
    p ? showDep(p) : showDefault();
  });

  // Ajusta estado visual inicial de los botones según preferencia guardada
  const v = getView();
  btnList.setAttribute('aria-pressed', String(v === 'list'));
  btnGrid.setAttribute('aria-pressed', String(v === 'cards'));
  panel.classList.toggle('view-list',  v === 'list');
  panel.classList.toggle('view-cards', v === 'cards');
});
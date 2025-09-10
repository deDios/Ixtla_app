(() => {
  // --- true para ver logs
  if (typeof window.IX_DEBUG === "undefined") window.IX_DEBUG = true;
  const ixLog = (...a) => { if (window.IX_DEBUG) try { console.log("[IX]", ...a); } catch {} };

  const section = document.getElementById("tramites-busqueda");
  if (!section) { ixLog("No hay #tramites-busqueda, me salgo."); return; }

  // refs de la UI
  const form  = section.querySelector("#form-tramite");
  const input = section.querySelector("#folio");
  const panel = section.querySelector(".ix-result"); 

  if (!form || !input || !panel) { ixLog("Faltan refs del formulario/panel, me salgo."); return; }

  // --- estados del flujo 
  const STEPS = ["Solicitud", "Revisión", "Asignación", "En proceso", "Finalizado"];

  const REQS = [
    "Fuga de agua", "Alumbrado público", "Bache en calle",
    "Recolección de residuos", "Árbol caído", "Drenaje tapado"
  ];
  const CALLES = [
    "Francisco I. Madero", "Av. Hidalgo", "Juárez", "Morelos",
    "Independencia", "Allende", "Niños Héroes"
  ];
  const SOLICITANTES = ["Juan Pablo", "María López", "Carlos Ramírez", "Ana Torres", "Luis García"];

  const toAMPM = (h, m) => {
    const ampm = h >= 12 ? "pm" : "am";
    const hh = ((h + 11) % 12) + 1;              // 0→12, 13→1...
    const mm = String(m).padStart(2, "0");
    return `${hh}:${mm} ${ampm}`;
  };
  const pad2 = (n) => String(n).padStart(2, "0");
  const fmtFecha = (d) => `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`;
  const fmtHora  = (d) => toAMPM(d.getHours(), d.getMinutes());

  // --- validación del folio 
  const FOLIO_RE = /^ID\d{5,}$/; // ID + 5 o más dígitos (ej: ID00001)
  const normalizaFolio = (s) => (s || "").toUpperCase().trim();

  // --- “semilla” para la simulación a partir del folio (para que sea estable)
  const seedFromFolio = (folio) => {
    // tomamos la parte numérica; si no hay, 0
    const nums = (folio.match(/\d+/)?.[0]) || "0";
    let seed = 0;
    for (let i = 0; i < nums.length; i++) seed = (seed * 31 + (nums.charCodeAt(i) - 48)) % 1_000_000;
    return seed;
  };

  // --- genera un objeto “ticket” simulado (datos + estado + fechas) con base en la semilla
  const simulaTicket = (folio) => {
    const seed = seedFromFolio(folio);

    // estado actual (0..STEPS.length-1); truquito: que rara vez caiga en "Finalizado"
    const idx = seed % STEPS.length;                 // 0..4
    const estadoIdx = Math.min(idx, STEPS.length - 1);

    // requerimiento/dirección/solicitante “determinísticos” por seed (para que no cambien en refresh)
    const req  = REQS[seed % REQS.length];
    const calle= CALLES[(seed >> 3) % CALLES.length];
    const col  = ["Centro", "Col. CP", "Barrio Alto", "San Juan", "Las Flores"][(seed >> 5) % 5];
    const num  = (seed % 120) + 1;                   // #1..120
    const sol  = SOLICITANTES[(seed >> 7) % SOLICITANTES.length];

    // fecha de solicitud “fake” pero estable: 2025 con mes/día/hora/min en base al seed
    const d = new Date(2025, (seed % 12), ((seed % 27) + 1), (seed % 24), (seed % 60));
    const fechaTexto = fmtFecha(d);
    const horaTexto  = fmtHora(d);

    // descripción base (una por requerimiento) + recorte elegante
    const DESCS = {
      "Fuga de agua": `Quiero reportar una fuga de agua que se encuentra en la calle ${calle}, justo frente al número #${num}. Desde hace aproximadamente 1 hora, se observa que el agua brota de la banqueta y la calle, formando un charco que corre hacia el drenaje. La fuga es constante y parece venir de una línea principal.`,
      "Alumbrado público": `Luminaria apagada cerca de ${calle}, ${col}. La zona queda muy oscura por la noche y representa un riesgo para peatones y vehículos. Solicito revisión y reposición del servicio.`,
      "Bache en calle": `Se reporta bache pronunciado en ${calle} #${num}, ${col}. Dificulta el paso de vehículos y puede causar accidentes. Se solicita reparación y señalización temporal.`,
      "Recolección de residuos": `Retraso en la recolección de residuos en ${calle}, ${col}. Las bolsas llevan dos días sin ser levantadas. Se solicita apoyo para evitar acumulación y fauna nociva.`,
      "Árbol caído": `Árbol caído/derramado en ${calle} #${num}, ${col}. Obstruye parcialmente la banqueta y pone en riesgo a peatones. Se solicita poda o retiro.`,
      "Drenaje tapado": `Posible obstrucción de drenaje en ${calle}, ${col}. Se percibe mal olor y el agua se estanca cuando llueve. Se solicita inspección y desazolve.`
    };
    const descLarga = DESCS[req] || `Descripción del requerimiento en ${calle}, ${col}.`;

    return {
      folio,
      estadoIdx,
      estadoTxt: STEPS[estadoIdx],
      requerimiento: req,
      direccion: `${calle}, ${col}`,
      solicitante: sol,
      descripcion: descLarga,
      fecha: fechaTexto,
      hora: horaTexto
    };
  };

  // --- arma el HTML del panel tal cual tu mock (estructura clara + clases hook)
  const renderTicket = (t) => {
    // recorte de descripción para que no se “coma” todo el panel (tú ajustas en CSS si quieres)
    const descShort = t.descripcion.length > 280 ? t.descripcion.slice(0, 277) + "..." : t.descripcion;

    // stepper: marcamos done/current/pending según estadoIdx
    const stepsHtml = STEPS.map((label, i) => {
      const status =
        i <  t.estadoIdx ? "done" :
        i === t.estadoIdx ? "current" : "pending";
      return `
        <li class="ix-step ${status}">
          <span class="ix-step-dot" aria-hidden="true"></span>
          <span class="ix-step-label">${label}</span>
        </li>
      `;
    }).join("");

    panel.innerHTML = `
      <div class="ix-ticket">
        <div class="ix-ticket-head">
          <div class="ix-ticket-left">
            <p><strong>ID:</strong> <span class="mono">${t.folio}</span></p>
            <p><strong>Requerimiento:</strong> ${t.requerimiento}</p>
            <p><strong>Dirección:</strong> ${t.direccion}</p>
            <p><strong>Solicitante:</strong> ${t.solicitante}</p>
            <p><strong>Descripción:</strong> ${descShort}</p>
          </div>
          <div class="ix-ticket-right">
            <p><strong>Fecha de solicitado:</strong><br>${t.fecha}<br><span class="mono">${t.hora}</span></p>
          </div>
        </div>

        <div class="ix-stepper" aria-label="Progreso del trámite">
          <ul class="ix-steps">
            ${stepsHtml}
          </ul>
        </div>
      </div>
    `;
  };

  // --- helpers de UI (cositas suaves para UX)
  const setLoading = (is) => {
    section.classList.toggle("is-loading", !!is);
    // si quieres, aquí puedes cambiar el texto del botón o poner un spinner
  };

  const renderMsg = (texto) => {
    panel.innerHTML = `<p>${texto}</p>`;
  };

  // --- comportamiento del form
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();

    const raw = input.value;
    const folio = normalizaFolio(raw);

    if (folio !== raw) input.value = folio; // normalizamos visualmente
    if (!FOLIO_RE.test(folio)) {
      renderMsg("El folio no es válido. Usa el formato: ID seguido de 5 o más dígitos, por ejemplo: ID00001.");
      return;
    }

    // bloqueamos spam mínimo y “simulamos” una carga breve
    setLoading(true);
    setTimeout(() => {
      const t = simulaTicket(folio);
      ixLog("ticket simulado:", t);
      renderTicket(t);
      setLoading(false);

      // opcional: persistimos último folio por comodidad
      try { sessionStorage.setItem("ix_last_folio", folio); } catch {}
    }, 400);
  });

  // --- calidad de vida: uppercase on-the-fly + limpiar panel si cambian el folio
  input.addEventListener("input", () => {
    const val = normalizaFolio(input.value);
    if (val !== input.value) input.value = val;
    // si quieren, podemos limpiar resultados al editar:
    // renderMsg("Ingresa el N° de trámite y presiona Buscar.");
  });

  // --- rehidratar último folio (si lo hay) para demo continua
  try {
    const last = sessionStorage.getItem("ix_last_folio");
    if (last && FOLIO_RE.test(last)) {
      input.value = last;
      const t = simulaTicket(last);
      renderTicket(t);
    }
  } catch {}
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
    1: {
      name: 'SAMAPA',
      title: 'Trámites disponibles',
      inactive: false,
      items: [
        {
          id: 'fuga-agua',
          title: 'Fuga de agua',
          desc: '¿Observaste una fuga de agua? Reporta ubicación y detalles; nos contactaremos para atenderla a la brevedad.',
          icon: '/ASSETS/departamentos/modulosAssets/Simapa/fuga-agua.png',
          photo: '/ASSETS/departamentos/modulosAssets/Simapa/fuga-agua_card.png',
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
    h2.textContent = `${depName}`;
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
  //depId=samapa
  const params = new URLSearchParams(window.location.search);
  const depParam = params.get('depId');
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
(() => {

  if (typeof window.IX_DEBUG === "undefined") window.IX_DEBUG = true;
  const ixLog = (...a) => { if (window.IX_DEBUG) try { console.log("[IX]", ...a); } catch {} };


  const section = document.getElementById("tramites-busqueda");
  if (!section) { ixLog("No hay #tramites-busqueda, me salgo."); return; }

  // refs de la UI
  const form  = section.querySelector("#form-tramite");
  const input = section.querySelector("#folio");
  const panel = section.querySelector(".ix-result"); 
  if (!form || !input || !panel) { ixLog("Faltan refs del formulario/panel, me salgo."); return; }

  window.IX_SEGUIMIENTO = Object.assign({
    steps: ["Solicitud", "Revisión", "Asignación", "En proceso", "Finalizado"], 
    forceIndex: null,        
    autoCycle: true,          
    cycleMs: 2000,             
    cycleResetTo: 0,            
    persistLastFolio: true      
  }, window.IX_SEGUIMIENTO || {});
  const CFG = window.IX_SEGUIMIENTO;


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
    const hh = ((h + 11) % 12) + 1;
    const mm = String(m).padStart(2, "0");
    return `${hh}:${mm} ${ampm}`;
  };
  const pad2 = (n) => String(n).padStart(2, "0");
  const fmtFecha = (d) => `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`;
  const fmtHora  = (d) => toAMPM(d.getHours(), d.getMinutes());


  const FOLIO_RE = /^ID\d{5,}$/; 
  const normalizaFolio = (s) => (s || "").toUpperCase().trim();

  const seedFromFolio = (folio) => {
    const nums = (folio.match(/\d+/)?.[0]) || "0";
    let seed = 0;
    for (let i = 0; i < nums.length; i++) seed = (seed * 31 + (nums.charCodeAt(i) - 48)) % 1_000_000;
    return seed;
  };

  const clampIndex = (idx) => Math.max(0, Math.min(idx, CFG.steps.length - 1));

  // override por folio (si defines un índice para un folio en específico)
  const getOverrideIndexForFolio = (folio) => {
    try {
      const map = window.IX_STATUS_BY_FOLIO || null;
      if (map && Object.prototype.hasOwnProperty.call(map, folio)) {
        const n = Number(map[folio]);
        if (Number.isFinite(n)) return clampIndex(n); // 0..steps.length-1
      }
    } catch {}
    return null; // sin override
  };

  // decide el índice actual (prioridad: mapa por folio → forceIndex global → seed)
  const computeIndex = (folio) => {
    const ov = getOverrideIndexForFolio(folio);
    if (ov !== null) return ov;                              // 1) mapping por folio
    if (typeof CFG.forceIndex === "number" && Number.isFinite(CFG.forceIndex)) {
      return clampIndex(CFG.forceIndex);                     // 2) forzado global
    }
    const seed = seedFromFolio(folio);
    return clampIndex(seed % CFG.steps.length);              // 3) automático por seed
  };

  // genera ticket fake estable según folio (y el índice calculado)
  const simulaTicket = (folio, forcedIdx = null) => {
    const seed = seedFromFolio(folio);
    const estadoIdx = (typeof forcedIdx === "number")
      ? clampIndex(forcedIdx)
      : computeIndex(folio);

    const req   = REQS[seed % REQS.length];
    const calle = CALLES[(seed >> 3) % CALLES.length];
    const col   = ["Centro", "Col. CP", "Barrio Alto", "San Juan", "Las Flores"][(seed >> 5) % 5];
    const num   = (seed % 120) + 1;
    const sol   = SOLICITANTES[(seed >> 7) % SOLICITANTES.length];

    const d = new Date(2025, (seed % 12), ((seed % 27) + 1), (seed % 24), (seed % 60));
    const fechaTexto = fmtFecha(d);
    const horaTexto  = fmtHora(d);

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
      estadoTxt: CFG.steps[estadoIdx],
      requerimiento: req,
      direccion: `${calle}, ${col}`,
      solicitante: sol,
      descripcion: descLarga,
      fecha: fechaTexto,
      hora: horaTexto
    };
  };

  const renderTicket = (t) => {
    const descShort = t.descripcion.length > 280 ? t.descripcion.slice(0, 277) + "..." : t.descripcion;

    const stepsHtml = CFG.steps.map((label, i) => {
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

  const renderMsg = (texto) => { panel.innerHTML = `<p>${texto}</p>`; };
  const setLoading = (is) => { section.classList.toggle("is-loading", !!is); };

  // =======================
  // Estado interno del simulador (para el ciclo)
  // =======================
  let currentTicket = null;  // ← último ticket pintado
  let currentIndex  = null;  // ← índice del paso actual 
  let cycleTimer    = null;  // ← handler del setInterval

  const stopCycle = () => {
    if (cycleTimer) { clearInterval(cycleTimer); cycleTimer = null; }
  };
  const startCycle = () => {
    if (!currentTicket) return;
    stopCycle();
    if (typeof currentIndex !== "number") currentIndex = currentTicket.estadoIdx;

    cycleTimer = setInterval(() => {
      currentIndex = currentIndex + 1;
      if (currentIndex >= CFG.steps.length) {
        currentIndex = clampIndex(CFG.cycleResetTo); // reinicio al índice que tú digas (0 por default)
      }
      const t2 = simulaTicket(currentTicket.folio, currentIndex);
      renderTicket(t2);
      currentTicket = t2; // guardamos el último estado pintado
    }, Math.max(500, Number(CFG.cycleMs) || 2000)); // safety: mínimo 500ms para que se vea
  };

  // =======================
  // Hooks públicos (control manual desde consola)
  // =======================
  // - ixSegStart(): arranca el ciclo
  // - ixSegStop(): detiene el ciclo
  // - ixSegSet(n): fija el estado en n (0..steps-1) y pinta
  // - ixSegNext(): avanza un paso (con wrap)
  window.ixSegStart = () => { CFG.autoCycle = true; startCycle(); ixLog("autoCycle ON"); };
  window.ixSegStop  = () => { CFG.autoCycle = false; stopCycle(); ixLog("autoCycle OFF"); };
  window.ixSegSet   = (n) => {
    stopCycle();
    currentIndex = clampIndex(Number(n) || 0);
    if (currentTicket) {
      currentTicket = simulaTicket(currentTicket.folio, currentIndex);
      renderTicket(currentTicket);
    }
    CFG.forceIndex = currentIndex; // si quieres que quede “forzado”
    ixLog("set estadoIdx →", currentIndex);
  };
  window.ixSegNext  = () => window.ixSegSet((typeof currentIndex === "number" ? currentIndex : -1) + 1);

  // =======================
  // comportamiento del form
  // =======================
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();

    const raw = input.value;
    const folio = normalizaFolio(raw);
    if (folio !== raw) input.value = folio;

    if (!FOLIO_RE.test(folio)) {
      renderMsg("El folio no es válido. Usa el formato: ID seguido de 5 o más dígitos, por ejemplo: ID00001.");
      return;
    }

    setLoading(true);
    stopCycle(); // por si ya había un ciclo dando vueltas
    setTimeout(() => {
      currentIndex  = computeIndex(folio);             // índice inicial (mapa/force/seed)
      currentTicket = simulaTicket(folio, currentIndex);
      renderTicket(currentTicket);
      setLoading(false);
      ixLog("ticket simulado:", currentTicket);

      if (CFG.persistLastFolio) { try { sessionStorage.setItem("ix_last_folio", folio); } catch {} }
      if (CFG.autoCycle) startCycle();                 // si pediste autoCycle, empieza aquí
    }, 300);
  });

  // UX: uppercase on-the-fly (opcional)
  input.addEventListener("input", () => {
    const val = normalizaFolio(input.value);
    if (val !== input.value) input.value = val;
  });

  // rehidratar último folio (si existe) y, si autoCycle=true, arranca
  try {
    const last = CFG.persistLastFolio ? sessionStorage.getItem("ix_last_folio") : null;
    if (last && FOLIO_RE.test(last)) {
      input.value = last;
      currentIndex  = computeIndex(last);
      currentTicket = simulaTicket(last, currentIndex);
      renderTicket(currentTicket);
      if (CFG.autoCycle) startCycle();
    }
  } catch {}


  window.IX_STATUS_BY_FOLIO = window.IX_STATUS_BY_FOLIO || {
     "ID00001": 2,   // arrancará en el paso #3
     "ID00077": 4    // arrancará en el paso #5
  };
})();

//-------------------------------------------------- fin del bloque de seguimiento de tramites


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
(() => {
  if (typeof window.IX_DEBUG === "undefined") window.IX_DEBUG = true;
  const ixLog = (...a) => {
    if (window.IX_DEBUG)
      try {
        console.log("[IX]", ...a);
      } catch {}
  };

  const section = document.getElementById("tramites-busqueda");
  if (!section) {
    ixLog("No hay #tramites-busqueda, me salgo.");
    return;
  }

  // refs de la UI
  const form = section.querySelector("#form-tramite");
  const input = section.querySelector("#folio");
  const panel = section.querySelector(".ix-result");
  if (!form || !input || !panel) {
    ixLog("Faltan refs del formulario/panel, me salgo.");
    return;
  }

  window.IX_SEGUIMIENTO = Object.assign(
    {
      steps: [
        "Solicitud",
        "Revisión",
        "Asignación",
        "En proceso",
        "Finalizado",
      ],
      forceIndex: 1, //  pon 0..steps.length-1 para forzar un estado concreto; null = automático
      autoCycle: true, //  si true, corre el ciclo automáticamente tras buscar
      cycleMs: 2000, //  cada cuánto avanza (ms)
      cycleResetTo: 0, //  a qué índice regresa cuando se pasa del último (normalmente 0)
      persistLastFolio: true, //  guarda último folio en sessionStorage para rehidratar
    },
    window.IX_SEGUIMIENTO || {}
  );
  const CFG = window.IX_SEGUIMIENTO;

  const REQS = [
    "Fuga de agua",
    "Alumbrado público",
    "Bache en calle",
    "Recolección de residuos",
    "Árbol caído",
    "Drenaje tapado",
  ];
  const CALLES = [
    "Francisco I. Madero",
    "Av. Hidalgo",
    "Juárez",
    "Morelos",
    "Independencia",
    "Allende",
    "Niños Héroes",
  ];
  const SOLICITANTES = [
    "Juan Pablo",
    "María López",
    "Carlos Ramírez",
    "Ana Torres",
    "Luis García",
  ];

  const toAMPM = (h, m) => {
    const ampm = h >= 12 ? "pm" : "am";
    const hh = ((h + 11) % 12) + 1;
    const mm = String(m).padStart(2, "0");
    return `${hh}:${mm} ${ampm}`;
  };
  const pad2 = (n) => String(n).padStart(2, "0");
  const fmtFecha = (d) =>
    `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  const fmtHora = (d) => toAMPM(d.getHours(), d.getMinutes());

  const FOLIO_RE = /^ID\d{5,}$/;
  const normalizaFolio = (s) => (s || "").toUpperCase().trim();

  const seedFromFolio = (folio) => {
    const nums = folio.match(/\d+/)?.[0] || "0";
    let seed = 0;
    for (let i = 0; i < nums.length; i++)
      seed = (seed * 31 + (nums.charCodeAt(i) - 48)) % 1_000_000;
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
    if (ov !== null) return ov; // 1) mapping por folio
    if (typeof CFG.forceIndex === "number" && Number.isFinite(CFG.forceIndex)) {
      return clampIndex(CFG.forceIndex); // 2) forzado global
    }
    const seed = seedFromFolio(folio);
    return clampIndex(seed % CFG.steps.length); // 3) automático por seed
  };

  // genera ticket fake estable según folio (y el índice calculado)
  const simulaTicket = (folio, forcedIdx = null) => {
    const seed = seedFromFolio(folio);
    const estadoIdx =
      typeof forcedIdx === "number"
        ? clampIndex(forcedIdx)
        : computeIndex(folio);

    const req = REQS[seed % REQS.length];
    const calle = CALLES[(seed >> 3) % CALLES.length];
    const col = ["Centro", "Col. CP", "Barrio Alto", "San Juan", "Las Flores"][
      (seed >> 5) % 5
    ];
    const num = (seed % 120) + 1;
    const sol = SOLICITANTES[(seed >> 7) % SOLICITANTES.length];

    const d = new Date(2025, seed % 12, (seed % 27) + 1, seed % 24, seed % 60);
    const fechaTexto = fmtFecha(d);
    const horaTexto = fmtHora(d);

    const DESCS = {
      "Fuga de agua": `Quiero reportar una fuga de agua que se encuentra en la calle ${calle}, justo frente al número #${num}. Desde hace aproximadamente 1 hora, se observa que el agua brota de la banqueta y la calle, formando un charco que corre hacia el drenaje. La fuga es constante y parece venir de una línea principal.`,
      "Alumbrado público": `Luminaria apagada cerca de ${calle}, ${col}. La zona queda muy oscura por la noche y representa un riesgo para peatones y vehículos. Solicito revisión y reposición del servicio.`,
      "Bache en calle": `Se reporta bache pronunciado en ${calle} #${num}, ${col}. Dificulta el paso de vehículos y puede causar accidentes. Se solicita reparación y señalización temporal.`,
      "Recolección de residuos": `Retraso en la recolección de residuos en ${calle}, ${col}. Las bolsas llevan dos días sin ser levantadas. Se solicita apoyo para evitar acumulación y fauna nociva.`,
      "Árbol caído": `Árbol caído/derramado en ${calle} #${num}, ${col}. Obstruye parcialmente la banqueta y pone en riesgo a peatones. Se solicita poda o retiro.`,
      "Drenaje tapado": `Posible obstrucción de drenaje en ${calle}, ${col}. Se percibe mal olor y el agua se estanca cuando llueve. Se solicita inspección y desazolve.`,
    };
    const descLarga =
      DESCS[req] || `Descripción del requerimiento en ${calle}, ${col}.`;

    return {
      folio,
      estadoIdx,
      estadoTxt: CFG.steps[estadoIdx],
      requerimiento: req,
      direccion: `${calle}, ${col}`,
      solicitante: sol,
      descripcion: descLarga,
      fecha: fechaTexto,
      hora: horaTexto,
    };
  };

  const renderTicket = (t) => {
    const descShort =
      t.descripcion.length > 280
        ? t.descripcion.slice(0, 277) + "..."
        : t.descripcion;

    const stepsHtml = CFG.steps
      .map((label, i) => {
        const status =
          i < t.estadoIdx ? "done" : i === t.estadoIdx ? "current" : "pending";
        return `
        <li class="ix-step ${status}">
          <span class="ix-step-dot" aria-hidden="true"></span>
          <span class="ix-step-label">${label}</span>
        </li>
      `;
      })
      .join("");

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

  const renderMsg = (texto) => {
    panel.innerHTML = `<p>${texto}</p>`;
  };
  const setLoading = (is) => {
    section.classList.toggle("is-loading", !!is);
  };

  // =======================
  // Estado interno del simulador (para el ciclo)
  // =======================
  let currentTicket = null; // ← último ticket pintado
  let currentIndex = null; // ← índice del paso actual
  let cycleTimer = null; // ← handler del setInterval

  const stopCycle = () => {
    if (cycleTimer) {
      clearInterval(cycleTimer);
      cycleTimer = null;
    }
  };
  const startCycle = () => {
    if (!currentTicket) return;
    stopCycle();
    if (typeof currentIndex !== "number")
      currentIndex = currentTicket.estadoIdx;

    cycleTimer = setInterval(() => {
      currentIndex = currentIndex + 1;
      if (currentIndex >= CFG.steps.length) {
        currentIndex = clampIndex(CFG.cycleResetTo);
      }
      const t2 = simulaTicket(currentTicket.folio, currentIndex);
      renderTicket(t2);
      currentTicket = t2;
    }, Math.max(500, Number(CFG.cycleMs) || 2000));
  };

  // Hooks públicos (control manual desde consola)              <<<<<----------------------------------------- IMPORTANTE PARA LA DEMO
  // - ixSegStart(): arranca el ciclo
  // - ixSegStop(): detiene el ciclo
  // - ixSegSet(n): fija el estado en n (0..steps-1) y pinta
  // - ixSegNext(): avanza un paso (con wrap)
  window.ixSegStart = () => {
    CFG.autoCycle = true;
    startCycle();
    ixLog("autoCycle ON");
  };
  window.ixSegStop = () => {
    CFG.autoCycle = false;
    stopCycle();
    ixLog("autoCycle OFF");
  };
  window.ixSegSet = (n) => {
    stopCycle();
    currentIndex = clampIndex(Number(n) || 0);
    if (currentTicket) {
      currentTicket = simulaTicket(currentTicket.folio, currentIndex);
      renderTicket(currentTicket);
    }
    CFG.forceIndex = currentIndex;
    ixLog("set estadoIdx →", currentIndex);
  };
  window.ixSegNext = () =>
    window.ixSegSet((typeof currentIndex === "number" ? currentIndex : -1) + 1);

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();

    const raw = input.value;
    const folio = normalizaFolio(raw);
    if (folio !== raw) input.value = folio;

    if (!FOLIO_RE.test(folio)) {
      renderMsg(
        "El folio no es válido. Usa el formato: ID seguido de 5 o más dígitos, por ejemplo: ID00001."
      );
      return;
    }

    setLoading(true);
    stopCycle(); // por si ya había un ciclo dando vueltas
    setTimeout(() => {
      currentIndex = computeIndex(folio);
      currentTicket = simulaTicket(folio, currentIndex);
      renderTicket(currentTicket);
      setLoading(false);
      ixLog("ticket simulado:", currentTicket);

      if (CFG.persistLastFolio) {
        try {
          sessionStorage.setItem("ix_last_folio", folio);
        } catch {}
      }
      if (CFG.autoCycle) startCycle();
    }, 300);
  });

  input.addEventListener("input", () => {
    const val = normalizaFolio(input.value);
    if (val !== input.value) input.value = val;
  });

  try {
    const last = CFG.persistLastFolio
      ? sessionStorage.getItem("ix_last_folio")
      : null;
    if (last && FOLIO_RE.test(last)) {
      input.value = last;
      currentIndex = computeIndex(last);
      currentTicket = simulaTicket(last, currentIndex);
      renderTicket(currentTicket);
      if (CFG.autoCycle) startCycle();
    }
  } catch {}

  window.IX_STATUS_BY_FOLIO = window.IX_STATUS_BY_FOLIO || {
    ID00001: 2, // arrancará en el paso #3
    ID00002: 4, // arrancará en el paso #5
  };
})();

//-------------------------------------------------- fin del bloque de seguimiento de tramites
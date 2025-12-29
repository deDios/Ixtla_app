/* Dashboard de Requerimientos (v2)
   - Chips por Departamento usando ixtla01_c_departamentos.php (POST JSON)
   - Tabla por trámite (POST JSON a req_stats_by_tramite.php)
   - Tarjetas por estatus (GET con ?departamento_id=&month= a req_stats_by_status.php)
   - Donut Abiertos vs Cerrados (GET con ?departamento_id=&month= a req_stats_open_closed.php)
*/
(function () {
  // ======= Endpoints =======
  const API = {
    departamentos: "/db/web/ixtla01_c_departamentos.php",   // POST JSON
    byTramite:     "/db/web/req_stats_by_tramite.php",       // POST JSON
    byStatus:      "/db/web/req_stats_by_status.php",        // GET ?departamento_id=&month=
    openClosed:    "/db/web/req_stats_open_closed.php",      // GET ?departamento_id=&month=
  };

  // ======= DOM =======
  const $chipsWrap  = document.querySelector("#chips-departamentos");
  const $monthInput = document.querySelector("#filtro-mes");

  // Tabla por trámite
  const $tblBody    = document.querySelector("#tbl-tramites-body");

  // Tarjetas por estatus
  const $cardsEstatus = document.querySelector("#cards-estatus");
  const STATUS_LABELS = [
    "Solicitud", "Revisión", "Asignación", "En proceso",
    "Pausado", "Cancelado", "Finalizado"
  ];

  // Donut abiertos vs cerrados
  const $donutCanvas = document.querySelector("#donut-open-close");
  const $legendOC    = document.querySelector("#legend-open-close");

  // ======= Estado de filtros =======
  let currentDept  = null;   // null = Todos
  let currentMonth = null;   // "YYYY-MM" o null

  // ======= Utils =======
  async function fetchJSON(url, opts = undefined) {
    const method  = (opts && opts.method) || "GET";
    const hasBody = opts && "body" in opts;
    const r = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(opts && opts.headers),
      },
      body: hasBody ? JSON.stringify(opts.body) : undefined,
      credentials: "include",
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "(sin cuerpo)");
      throw new Error(`HTTP ${r.status} en ${url} :: ${t}`);
    }
    return r.json();
  }

  function escapeHTML(s) {
    if (s == null) return "";
    return String(s)
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  function qs(params) {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k,v]) => {
      if (v !== null && v !== undefined && v !== "") sp.append(k, String(v));
    });
    return sp.toString();
  }

  // ======= Chips Departamentos =======
  function buildDeptChips(list) {
    $chipsWrap.innerHTML = "";

    const makeChip = (id, label, selected=false) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ix-chip";
      b.setAttribute("role","tab");
      b.setAttribute("aria-selected", selected ? "true" : "false");
      b.dataset.dept = id == null ? "" : String(id);
      b.textContent = label;
      b.addEventListener("click", () => {
        // actualizar selección visual
        $chipsWrap.querySelectorAll(".ix-chip").forEach(x => x.setAttribute("aria-selected","false"));
        b.setAttribute("aria-selected","true");
        // actualizar filtro y recargar
        currentDept = (id == null ? null : String(id));
        reloadAll();
      });
      return b;
    };

    // chip "Todos"
    $chipsWrap.appendChild(makeChip(null, "Todos", true));

    if (Array.isArray(list)) {
      list.forEach(d => $chipsWrap.appendChild(makeChip(d.id, d.nombre, false)));
    }
  }

  async function initDepartments() {
    try {
      // Tu API de departamentos espera POST con JSON
      const resp = await fetchJSON(API.departamentos, {
        method: "POST",
        body: { all:true, status:1, per_page:500 }
      });
      const list = Array.isArray(resp?.data)
        ? resp.data.map(d => ({ id: d.id, nombre: d.nombre }))
        : [];
      buildDeptChips(list);
    } catch (e) {
      console.error("[dashboard] departamentos:", e);
      buildDeptChips([]);
    }
  }

  // ======= Tabla: por trámite =======
  function renderTable(rows) {
    $tblBody.innerHTML = "";
    if (!Array.isArray(rows) || !rows.length) return;
    const frag = document.createDocumentFragment();
    rows.forEach(r => {
      const row = document.createElement("div");
      row.className = "ix-row";
      row.innerHTML = `
        <div>${escapeHTML(r.tramite)}</div>
        <div class="ta-right">${Number(r.total || 0)}</div>
      `;
      frag.appendChild(row);
    });
    $tblBody.appendChild(frag);
  }

  async function loadByTramite() {
    const body = {
      departamento_id: currentDept ? Number(currentDept) : null,
      month: currentMonth || null,
    };
    const resp = await fetchJSON(API.byTramite, { method: "POST", body });
    renderTable(Array.isArray(resp?.data) ? resp.data : []);
  }

  // ======= Tarjetas por estatus =======
  function ensureStatusCards() {
    if ($cardsEstatus.dataset.built === "1") return;
    $cardsEstatus.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (let i = 0; i <= 6; i++) {
      const card = document.createElement("div");
      card.className = "ix-badge";
      card.innerHTML = `
        <div>${STATUS_LABELS[i]}</div>
        <div class="n" id="stat_${i}">0</div>
      `;
      frag.appendChild(card);
    }
    $cardsEstatus.appendChild(frag);
    $cardsEstatus.dataset.built = "1";
  }

  function renderStatus(map) {
    ensureStatusCards();
    for (let i = 0; i <= 6; i++) {
      const el = document.querySelector(`#stat_${i}`);
      if (el) el.textContent = String(Number(map?.[i] || 0));
    }
  }

  async function loadByStatus() {
    // Este endpoint en tu código actual es GET con querystring
    const url = `${API.byStatus}?${qs({
      departamento_id: currentDept ? Number(currentDept) : null,
      month: currentMonth || ""
    })}`;
    const resp = await fetchJSON(url);
    // El endpoint devuelve un array indexado 0..6 o un objeto; normalizamos:
    const map = Array.isArray(resp)
      ? resp.reduce((acc, v, idx) => (acc[idx]=v, acc), {})
      : resp;
    renderStatus(map || {});
  }

  // ======= Abiertos vs Cerrados (donut) =======
  let donutCache = { abiertos:0, cerrados:0 };

  function drawDonut(abiertos, cerrados) {
    if (!$donutCanvas) return;
    const ctx = $donutCanvas.getContext("2d");
    const w = $donutCanvas.width, h = $donutCanvas.height;
    const cx = w/2, cy = h/2, r = Math.min(w,h)/2 - 8, inner = r * 0.6;

    ctx.clearRect(0,0,w,h);

    const total = Math.max(0, (abiertos||0) + (cerrados||0));
    const aFrac = total ? (abiertos/total) : 0;
    const cFrac = total ? (cerrados/total) : 0;

    // helper arco
    const arc = (start, frac, color) => {
      const end = start + frac * Math.PI*2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      return end;
    };

    let angle = -Math.PI/2;
    angle = arc(angle, aFrac, "#22c55e"); // abiertos
    arc(angle, cFrac, "#475569");         // cerrados

    // agujero
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI*2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // etiqueta central
    ctx.fillStyle = "#0f172a";
    ctx.font = "700 22px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(total), cx, cy);

    // leyenda
    if ($legendOC) {
      $legendOC.innerHTML = `
        <div><span class="ix-dot open"></span>Abiertos: <strong>${abiertos||0}</strong></div>
        <div><span class="ix-dot closed"></span>Cerrados: <strong>${cerrados||0}</strong></div>
      `;
    }
  }

  function renderOpenClosed(payload) {
    // Tus APIs devuelven { abiertos, cerrados }
    const abiertos = Number(payload?.abiertos || 0);
    const cerrados = Number(payload?.cerrados || 0);
    donutCache = { abiertos, cerrados };
    drawDonut(abiertos, cerrados);
  }

  async function loadOpenClosed() {
    // Este endpoint en tu código actual es GET con querystring
    const url = `${API.openClosed}?${qs({
      departamento_id: currentDept ? Number(currentDept) : null,
      month: currentMonth || ""
    })}`;
    const resp = await fetchJSON(url);
    renderOpenClosed(resp || {});
  }

  // ======= Recarga completa =======
  async function reloadAll() {
    try {
      await Promise.all([loadByTramite(), loadByStatus(), loadOpenClosed()]);
    } catch (e) {
      console.error("[dashboard] reloadAll:", e);
    }
  }

  // ======= Init =======
  document.addEventListener("DOMContentLoaded", async () => {
    // filtro mes
    if ($monthInput) {
      $monthInput.addEventListener("change", () => {
        const v = ($monthInput.value || "").trim();   // YYYY-MM
        currentMonth = v || null;
        reloadAll();
      });
    }
    // pintar chips + primera carga
    await initDepartments();
    await reloadAll();

    // redibujar donut si cambia el tamaño de la ventana
    window.addEventListener("resize", () => drawDonut(donutCache.abiertos, donutCache.cerrados));
  });
})();

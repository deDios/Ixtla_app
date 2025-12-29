/* Dashboard de Requerimientos
   - Chips por Departamento (filtro)
   - Tabla: requerimientos por trámite
   - Tarjetas por Estatus (0..6, siempre con ceros)
   - Abiertos vs Cerrados
   - SIN modificar ixtla01_c_departamentos.php: se llama por POST con body JSON
*/
(function () {
  // ======= Config =======
  const API = {
    // Tu endpoint ya existente (NO modificado)
    departamentos: "/db/web/ixtla01_c_departamentos.php",
    // Nuevos endpoints de estadísticas
    byTramite: "/db/web/req_stats_by_tramite.php",
    byStatus: "/db/web/req_stats_by_status.php",
    openClosed: "/db/web/req_stats_open_closed.php",
  };

  // Elementos del DOM esperados
  const $chipsWrap   = document.querySelector("#chip-dept-container");
  const $monthInput  = document.querySelector("#filtro-mes"); // <input type="month" id="filtro-mes">

  // Tabla por trámite
  const $tblBody     = document.querySelector("#tbl-tramites-body");

  // Estatus (0..6)
  const STATUS_IDS = {
    0: "#stat_0",
    1: "#stat_1",
    2: "#stat_2",
    3: "#stat_3",
    4: "#stat_4",
    5: "#stat_5",
    6: "#stat_6",
  };

  // Abiertos vs cerrados
  const $open   = document.querySelector("#kpi_open");
  const $closed = document.querySelector("#kpi_closed");

  // Estado de filtro
  let currentDept  = null;     // null = Todos
  let currentMonth = null;     // "YYYY-MM" o null

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

  function escapeHTML(str) {
    if (str == null) return "";
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setActiveChip(id) {
    const chips = $chipsWrap.querySelectorAll(".chip");
    chips.forEach(c => c.classList.remove("is-active"));
    const target = id === null
      ? $chipsWrap.querySelector('[data-dept=""]')
      : $chipsWrap.querySelector(`[data-dept="${id}"]`);
    if (target) target.classList.add("is-active");
  }

  function clearTable() {
    if ($tblBody) $tblBody.innerHTML = "";
  }

  function renderTable(rows) {
    clearTable();
    if (!Array.isArray(rows) || !rows.length) return;
    const frag = document.createDocumentFragment();
    rows.forEach(r => {
      const tr = document.createElement("div");
      tr.className = "exp-row";
      tr.innerHTML = `
        <div>${escapeHTML(r.tramite)}</div>
        <div class="ta-right">${Number(r.total || 0)}</div>
      `;
      frag.appendChild(tr);
    });
    $tblBody.appendChild(frag);
  }

  function renderStatus(map) {
    for (let i = 0; i <= 6; i++) {
      const el = document.querySelector(STATUS_IDS[i]);
      if (el) el.textContent = String(Number(map?.[i] || 0));
    }
  }

  function renderOpenClosed(data) {
    if ($open)   $open.textContent   = String(Number(data?.open   || 0));
    if ($closed) $closed.textContent = String(Number(data?.closed || 0));
  }

  function buildDeptChips(depts) {
    $chipsWrap.innerHTML = "";

    // Chip "Todos"
    const all = document.createElement("button");
    all.type = "button";
    all.className = "chip is-active";
    all.dataset.dept = "";
    all.textContent = "Todos";
    all.addEventListener("click", () => {
      currentDept = null;
      setActiveChip(null);
      reloadAll();
    });
    $chipsWrap.appendChild(all);

    if (Array.isArray(depts)) {
      depts.forEach(d => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.dataset.dept = String(d.id);
        b.textContent = d.nombre;
        b.addEventListener("click", () => {
          currentDept = String(d.id);
          setActiveChip(d.id);
          reloadAll();
        });
        $chipsWrap.appendChild(b);
      });
    }
  }

  // ======= Cargas =======
  async function initDepartments() {
    try {
      // IMPORTANTe: Usamos POST y body JSON para tu API existente
      // (sin cambiarla): pedimos activos (status=1), all=true, per_page grande.
      const resp = await fetchJSON(API.departamentos, {
        method: "POST",
        body: { all: true, status: 1, per_page: 500 }
      });

      const list = Array.isArray(resp?.data)
        ? resp.data.map(d => ({ id: String(d.id), nombre: d.nombre }))
        : [];

      buildDeptChips(list);
    } catch (e) {
      console.error("[dashboard] departamentos:", e);
      buildDeptChips([]);
    }
  }

  async function loadByTramite() {
    const body = {
      departamento_id: currentDept ? Number(currentDept) : null,
      month: currentMonth || null,
    };
    const resp = await fetchJSON(API.byTramite, { method: "POST", body });
    renderTable(Array.isArray(resp?.data) ? resp.data : []);
  }

  async function loadByStatus() {
    const body = {
      departamento_id: currentDept ? Number(currentDept) : null,
      month: currentMonth || null,
    };
    const resp = await fetchJSON(API.byStatus, { method: "POST", body });
    renderStatus(resp?.data || {});
  }

  async function loadOpenClosed() {
    const body = {
      departamento_id: currentDept ? Number(currentDept) : null,
      month: currentMonth || null,
    };
    const resp = await fetchJSON(API.openClosed, { method: "POST", body });
    renderOpenClosed(resp?.data || {});
  }

  async function reloadAll() {
    try {
      await Promise.all([loadByTramite(), loadByStatus(), loadOpenClosed()]);
    } catch (e) {
      console.error("[dashboard] reloadAll:", e);
    }
  }

  // ======= Init =======
  document.addEventListener("DOMContentLoaded", async () => {
    if ($monthInput) {
      $monthInput.addEventListener("change", () => {
        const val = ($monthInput.value || "").trim(); // "YYYY-MM"
        currentMonth = val || null;
        reloadAll();
      });
    }
    await initDepartments();
    await reloadAll();
  });
})();

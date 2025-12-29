/* Dashboard de Requerimientos
   - Chips por Departamento (filtro)
   - Tabla: requerimientos por trámite
   - Tarjetas por Estatus (0..6, siempre con ceros)
   - Abiertos vs Cerrados
*/

(function () {
  // ======= Config =======
  const API = {
    departamentos: "/db/web/ixtla01_c_departamentos.php",
    byTramite: "/db/web/req_stats_by_tramite.php",
    byStatus: "/db/web/req_stats_by_status.php",
    openClosed: "/db/web/req_stats_open_closed.php",
  };

  // Elementos del DOM (ids esperados en el HTML)
  const $chipsWrap = document.querySelector("#chip-dept-container");
  const $monthInput = document.querySelector("#filtro-mes"); // type="month" (YYYY-MM)

  // Tabla por trámite
  const $tblBody = document.querySelector("#tbl-tramites-body");

  // Estatus (totales 0..6): coloca spans con estos ids en el HTML
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
  const $open = document.querySelector("#kpi_open");
  const $closed = document.querySelector("#kpi_closed");

  // Estado del filtro
  let currentDept = null; // null => Todos
  let currentMonth = null; // "YYYY-MM" o null

  // ======= Utils =======
  async function fetchJSON(url, opts = undefined) {
    const r = await fetch(url, {
      method: (opts && opts.method) || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(opts && opts.headers),
      },
      body: opts && opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: "include",
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "(sin cuerpo)");
      throw new Error(`HTTP ${r.status} en ${url} :: ${t}`);
    }
    return r.json();
  }

  function setActiveChip(id) {
    const chips = $chipsWrap.querySelectorAll(".chip");
    chips.forEach((c) => c.classList.remove("is-active"));
    const sel =
      id === null ? $chipsWrap.querySelector('[data-dept=""]') : $chipsWrap.querySelector(`[data-dept="${id}"]`);
    if (sel) sel.classList.add("is-active");
  }

  function clearTable() {
    if ($tblBody) $tblBody.innerHTML = "";
  }

  function renderTable(rows) {
    clearTable();
    if (!Array.isArray(rows) || !rows.length) return;
    const frag = document.createDocumentFragment();
    rows.forEach((r) => {
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

  function escapeHTML(str) {
    if (str == null) return "";
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderStatus(statsObj) {
    // Asegura 0..6 con ceros
    for (let i = 0; i <= 6; i++) {
      const val = Number(statsObj?.[i] || 0);
      const el = document.querySelector(STATUS_IDS[i]);
      if (el) el.textContent = String(val);
    }
  }

  function renderOpenClosed(data) {
    if ($open) $open.textContent = String(Number(data?.open || 0));
    if ($closed) $closed.textContent = String(Number(data?.closed || 0));
  }

  function buildDeptChips(depts) {
    // Limpia
    $chipsWrap.innerHTML = "";

    // Chip "Todos"
    const all = document.createElement("button");
    all.type = "button";
    all.className = "chip is-active";
    all.textContent = "Todos";
    all.dataset.dept = "";
    all.addEventListener("click", () => {
      currentDept = null;
      setActiveChip(null);
      reloadAll();
    });
    $chipsWrap.appendChild(all);

    // Chips por depto
    if (Array.isArray(depts)) {
      depts.forEach((d) => {
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
      const resp = await fetchJSON(API.departamentos);
      const list = Array.isArray(resp?.data)
        ? resp.data.map((d) => ({ id: String(d.id), nombre: d.nombre }))
        : [];
      buildDeptChips(list);
    } catch (e) {
      console.error("[dashboard] departamentos:", e);
      buildDeptChips([]);
    }
  }

  async function loadByTramite() {
    const body = { departamento_id: currentDept ? Number(currentDept) : null, month: currentMonth || null };
    const resp = await fetchJSON(API.byTramite, { method: "POST", body });
    const rows = Array.isArray(resp?.data) ? resp.data : [];
    renderTable(rows);
  }

  async function loadByStatus() {
    const body = { departamento_id: currentDept ? Number(currentDept) : null, month: currentMonth || null };
    const resp = await fetchJSON(API.byStatus, { method: "POST", body });
    // resp.data = { "0":n0, "1":n1, ... "6":n6 }
    renderStatus(resp?.data || {});
  }

  async function loadOpenClosed() {
    const body = { departamento_id: currentDept ? Number(currentDept) : null, month: currentMonth || null };
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

  // ======= Inicialización =======
  document.addEventListener("DOMContentLoaded", async () => {
    // mes
    if ($monthInput) {
      $monthInput.addEventListener("change", () => {
        const val = ($monthInput.value || "").trim(); // espera "YYYY-MM"
        currentMonth = val || null;
        reloadAll();
      });
    }
    await initDepartments();
    await reloadAll();
  });
})();

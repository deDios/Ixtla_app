// /JS/ui/table.js
import { $, toggle, escapeHtml } from "../core/dom.js";

export function createTable({
  bodySel = "#tbl-body",
  wrapSel = "#tbl-wrap",
  emptySel = "#tbl-empty",
  pagSel = "#tbl-pag",
  pageSize = 8,
  columns = [],
  pagerFancy = true,          // <— NUEVO: paginación con elipsis/prev/next
  onRender = null,            // <— NUEVO: callback tras render
  tag = "[Table]"             // <— NUEVO: logs
} = {}) {
  const body = $(bodySel);
  const wrap = $(wrapSel);
  const empty = $(emptySel);
  const pag = $(pagSel);
  const thead = body?.closest("table")?.querySelector("thead");

  // ---- Estado interno ----
  let _rawRows = [];        // dataset actual (mapeado desde home)
  let raw = [];             // filas "visibles" (filtradas y ordenadas)
  let _pageRawRows = [];    // objetos crudos de la página actual (.__raw si existe)
  let page = 1;
  let sort = { key: null, dir: 1 };

  /* ====================== Header con sort ======================= */
  function initHeader() {
    if (!thead) return;
    const ths = Array.from(thead.querySelectorAll("th"));
    ths.forEach((th, idx) => {
      const col = columns[idx];
      if (!col) return;
      th.innerHTML = escapeHtml(col.title || th.textContent || "");
      if (!col.sortable) return;
      th.style.cursor = "pointer";
      th.dataset.sortKey = col.key;
      th.addEventListener("click", () => {
        const key = th.dataset.sortKey;
        if (sort.key === key) sort.dir = -sort.dir;
        else { sort.key = key; sort.dir = 1; }
        console.log(tag, "sort change", sort);
        render();
      });
    });
  }

  /* ======================== API pública ========================= */
  function setData(rows = []) {
    raw = Array.isArray(rows) ? rows.slice() : [];
    _rawRows = raw.slice();
    page = 1;
    console.log(tag, "setData()", { total: raw.length, pageSize });
    render();
  }
  function setPage(p) { page = Math.max(1, p | 0 || 1); render(); }
  function setSort(key, dir = 1) { sort = { key, dir: dir >= 0 ? 1 : -1 }; render(); }
  function getSort() { return { ...sort }; }
  function setPageSize(n) { pageSize = Math.max(1, parseInt(n, 10) || pageSize); page = 1; render(); }

  function getPageRawRows() { return _pageRawRows.slice(); }
  const getRawRows = getPageRawRows; // compat con tu home viejo

  /* ====================== Ordenamiento ========================== */
  function sortedData() {
    if (!sort.key) return raw;
    const col = columns.find(c => c.key === sort.key);
    if (!col) return raw;
    const acc = col.accessor || (r => r[sort.key]);
    const cmp = col.compare || defaultCompare;
    const arr = raw.map((r, i) => [acc(r, i, r), i, r]);
    arr.sort((A, B) => {
      const res = cmp(A[0], B[0]);
      if (res === 0) return A[1] - B[1];
      return sort.dir * res;
    });
    return arr.map(x => x[2]);
  }

  /* ======================== Render fila ========================= */
  function renderRow(r, iInPage) {
    const tds = columns.map(col => {
      const acc = col.accessor || (row => row[col.key]);
      const val = acc(r);
      const html = col.render ? col.render(val, r) : escapeHtml(val ?? "—");
      return `<td>${html}</td>`;
    }).join("");
    return `<tr data-row-idx="${iInPage}">${tds}</tr>`;
  }

  /* ======================= Render completo ====================== */
  function render() {
    if (!raw.length) {
      toggle(wrap, false);
      toggle(empty, true);
      if (pag) pag.innerHTML = "";
      _pageRawRows = [];
      if (body) body.innerHTML = "";
      paintSortIndicators();
      onRender?.({ page, total: 0, pages: 0 });
      return;
    }

    toggle(empty, false);
    toggle(wrap, true);

    const data = sortedData();
    const pages = Math.max(1, Math.ceil(data.length / pageSize));
    if (page > pages) page = pages;

    const start = (page - 1) * pageSize;
    const pageItems = data.slice(start, start + pageSize);

    // Cache crudos de esta página (.__raw si existe)
    _pageRawRows = pageItems.map(r => r?.__raw ?? r);

    // Pintar body
    if (body) body.innerHTML = pageItems.map((r, i) => renderRow(r, i)).join("");

    // Paginación
    if (pag) {
      pag.innerHTML = pagerFancy
        ? buildFancyPager({ page, pages })
        : buildSimplePager({ page, pages });

      // handlers
      pag.querySelectorAll("[data-p]").forEach(b =>
        b.addEventListener("click", () => setPage(parseInt(b.dataset.p, 10)))
      );
      const go = pag.querySelector("[data-goto]");
      const goBtn = pag.querySelector("[data-go]");
      if (go && goBtn) {
        goBtn.addEventListener("click", () => {
          const n = parseInt(go.value, 10);
          if (Number.isFinite(n)) setPage(n);
        });
      }
    }

    paintSortIndicators();
    console.log(tag, "render()", { page, pages, pageSize, showing: pageItems.length, total: raw.length });
    onRender?.({ page, pages, pageSize, showing: pageItems.length, total: raw.length });
  }

  /* ================ Indicadores de sort en <th> ================= */
  function paintSortIndicators() {
    if (!thead) return;
    const ths = Array.from(thead.querySelectorAll("th"));
    ths.forEach((th, idx) => {
      const col = columns[idx];
      if (!col || !col.sortable) {
        th.dataset.sort = "";
        th.title = "";
        th.innerHTML = escapeHtml(col?.title || th.textContent || "");
        return;
      }
      if (sort.key === col.key) {
        th.dataset.sort = sort.dir === 1 ? "asc" : "desc";
        th.title = `Ordenado ${sort.dir === 1 ? "ascendente" : "descendente"}`;
        th.innerHTML = `${escapeHtml(col.title)} ${sort.dir === 1 ? "▲" : "▼"}`;
      } else {
        th.dataset.sort = "";
        th.title = "Click para ordenar";
        th.innerHTML = escapeHtml(col.title);
      }
    });
  }

  /* ========================= Paginadores ======================== */
  function buildSimplePager({ page, pages }) {
    let html = "";
    for (let i = 1; i <= pages; i++) {
      html += `<button class="btn ${i === page ? "primary" : ""}" data-p="${i}">${i}</button>`;
    }
    return html;
  }

  function buildFancyPager({ page, pages }) {
    // similar al screenshot: « ‹ … 5 6 [7] 8 9 … › »
    const parts = [];

    const btn = (p, label = String(p), cls = "") =>
      `<button class="btn ${cls}" data-p="${p}" ${p < 1 || p > pages ? "disabled" : ""}>${label}</button>`;

    // resumen izquierda (opcional):  "151–175 de 300"
    // -> si quieres mostrarlo fuera, quítalo
    // parts.push(`<span class="muted">${startIdx(page, pageSize)+1}–${endIdx(page, pageSize, pages)} de ${raw.length}</span>`);

    // prevs
    parts.push(btn(1, "«"));
    parts.push(btn(page - 1, "‹"));

    // ventana de números
    const windowSize = 5;
    const half = Math.floor(windowSize / 2);
    let start = Math.max(1, page - half);
    let end = Math.min(pages, start + windowSize - 1);
    if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);

    if (start > 1) parts.push(`<span class="muted">…</span>`);
    for (let i = start; i <= end; i++) {
      parts.push(btn(i, String(i), i === page ? "primary" : ""));
    }
    if (end < pages) parts.push(`<span class="muted">…</span>`);

    // nexts
    parts.push(btn(page + 1, "›"));
    parts.push(btn(pages, "»"));

    // "Ir a: [ ] (Ir)"
    parts.push(`<span class="muted" style="margin-left:.75rem;">Ir a:</span>
      <input type="number" min="1" max="${pages}" value="${page}" data-goto
        style="width:4rem;margin:0 .25rem;" />
      <button class="btn" data-go>Ir</button>`);

    return parts.join(" ");
  }

  // Helper opcional si quieres el rango mostrado
  function startIdx(p, ps) { return (p - 1) * ps; }
  function endIdx(p, ps, pages) { return Math.min(p * ps, raw.length); }

  function destroy() { /* noop */ }

  initHeader();
  return {
    setData, setPage, setSort, getSort, setPageSize, destroy,
    getPageRawRows, getRawRows
  };
}

/* ========================= Comparadores ========================= */
function defaultCompare(a, b) {
  const A = normalize(a), B = normalize(b);
  if (A < B) return -1; if (A > B) return 1; return 0;
}
function normalize(v) {
  if (v == null) return "";
  if (typeof v === "number") return v;
  return String(v).trim().toLowerCase();
}

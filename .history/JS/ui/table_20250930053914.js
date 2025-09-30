// /JS/ui/table.js
import { $, toggle, escapeHtml } from "../core/dom.js";

export function createTable({
  bodySel = "#tbl-body",
  wrapSel = "#tbl-wrap",
  emptySel = "#tbl-empty",
  pagSel = "#tbl-pag",
  pageSize = 8,
  columns = []
} = {}) {
  const body = $(bodySel);
  const wrap = $(wrapSel);
  const empty = $(emptySel);
  const pag = $(pagSel);
  const thead = body?.closest("table")?.querySelector("thead");

  // ---- Estado interno ----
  let _rawRows = [];        
  let raw = [];             // filas "visibles" 
  let _pageRawRows = [];    // objetos crudos 
  let page = 1;
  let sort = { key: null, dir: 1 };

  // ---- Header con sort ----
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
        render();
      });
    });
  }

  // ---- API publica ----
  function setData(rows = []) {
    raw = Array.isArray(rows) ? rows.slice() : [];
    _rawRows = raw.slice();     // copia por conveniencia
    page = 1;
    render();
  }
  function setPage(p) { page = Math.max(1, p | 0 || 1); render(); }
  function setSort(key, dir = 1) { sort = { key, dir: dir >= 0 ? 1 : -1 }; render(); }
  function getSort() { return { ...sort }; }
  function setPageSize(n) { pageSize = Math.max(1, parseInt(n, 10) || pageSize); page = 1; render(); }
  
  function getPageRawRows() { return _pageRawRows.slice(); }
  const getRawRows = getPageRawRows;

  // ---- Ordenamiento ----
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

  // ---- Render de fila ----
  function renderRow(r, iInPage) {
    const tds = columns.map(col => {
      const acc = col.accessor || (row => row[col.key]);
      const val = acc(r);
      const html = col.render ? col.render(val, r) : escapeHtml(val ?? "—");
      return `<td>${html}</td>`;
    }).join("");
    return `<tr data-row-idx="${iInPage}">${tds}</tr>`;
  }

  // ---- Render completo ----
  function render() {
    if (!raw.length) {
      toggle(wrap, false);
      toggle(empty, true);
      if (pag) pag.innerHTML = "";
      _pageRawRows = [];
      if (body) body.innerHTML = "";
      paintSortIndicators();
      return;
    }

    toggle(empty, false);
    toggle(wrap, true);

    const data = sortedData();
    const pages = Math.max(1, Math.ceil(data.length / pageSize));
    if (page > pages) page = pages;

    const start = (page - 1) * pageSize;
    const pageItems = data.slice(start, start + pageSize);

    // Cache de objetos crudos de esta página (.__raw si existe, si no el row ya mapeado)
    _pageRawRows = pageItems.map(r => r?.__raw ?? r);

    // Pintar body
    if (body) {
      body.innerHTML = pageItems.map((r, i) => renderRow(r, i)).join("");
    }

    // Paginación
    if (pag) {
      let html = "";
      for (let i = 1; i <= pages; i++) {
        html += `<button class="btn ${i === page ? "primary" : ""}" data-p="${i}">${i}</button>`;
      }
      pag.innerHTML = html;
      pag.querySelectorAll("button").forEach(b =>
        b.addEventListener("click", () => setPage(parseInt(b.dataset.p, 10)))
      );
    }

    paintSortIndicators();
  }

  // ---- Indicadores de sort en <th> ----
  function paintSortIndicators() {
    if (!thead) return;
    const ths = Array.from(thead.querySelectorAll("th"));
    ths.forEach((th, idx) => {
      const col = columns[idx];
      if (!col || !col.sortable) { th.dataset.sort = ""; th.title = ""; th.innerHTML = escapeHtml(col?.title || th.textContent || ""); return; }
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

  function destroy() { }

  initHeader();
  return {
    setData, setPage, setSort, getSort, setPageSize, destroy,
    // nuevos getters:
    getPageRawRows,
    getRawRows
  };
}

function defaultCompare(a, b) {
  const A = normalize(a), B = normalize(b);
  if (A < B) return -1; if (A > B) return 1; return 0;
}
function normalize(v) {
  if (v == null) return "";
  if (typeof v === "number") return v;
  return String(v).trim().toLowerCase();
}

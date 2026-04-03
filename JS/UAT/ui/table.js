// /JS/ui/table.js
"use strict";

// ======================= Config / Debug =======================
const TABLE_DEBUG = false;
const TLOG = (...a) => { if (TABLE_DEBUG) console.log("[Table@Home]", ...a); };

// ======================= Utils DOM ============================
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const escapeHtml = (s) => (s == null) ? "" : String(s)
  .replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ======================= Tabla ================================
export function createTable({
  bodySel = "#tbl-body",
  wrapSel = "#tbl-wrap",
  emptySel = null,                 // si quieres ocultar/mostrar un contenedor vacío externo 
  pagSel = "#tbl-pag",
  pageSize = 7,                    // <- default 7
  columns = [],
  showEmptyRow = true,             // muestra una fila de “sin datos” dentro de la tabla
  emptyRowMessage = "No hay requerimientos asignados de momento",
  fillWithBlanks = true,           // completa la página con celdas en blanco
  disableHoverOnBlanks = true,     // quita hover en filas vacías
  onRowClick = null,               // callback(row) cuando la fila tiene datos
  rowClass = null                  // callback(row) -> string de clases extra por fila de datos
} = {}) {
  const body = $(bodySel);
  const wrap = $(wrapSel);
  const pag  = $(pagSel);
  const emptyBox = emptySel ? $(emptySel) : null;
  const thead = body?.closest("table")?.querySelector("thead");

  // ---- Estado interno ----
  let _rawRows = [];        // filas visibles (ya mapeadas por la app)
  let _pageRawRows = [];    // objetos crudos en la página actual (para onRowClick)
  let page = 1;
  let sort = { key: null, dir: 1 };

  // ---- Header con sort (mantiene compatibilidad) ----
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

  // ================= API pública =================
  function setData(rows = []) {
    _rawRows = Array.isArray(rows) ? rows.slice() : [];
    page = 1;
    render();
  }
  function setPage(p) { page = Math.max(1, p | 0 || 1); render(); }
  function setSort(key, dir = 1) { sort = { key, dir: dir >= 0 ? 1 : -1 }; render(); }
  function getSort() { return { ...sort }; }
  function setPageSize(n) { pageSize = Math.max(1, parseInt(n, 10) || pageSize); page = 1; render(); }

  function getPageRawRows() { return _pageRawRows.slice(); }
  const getRawRows = getPageRawRows;

  // ================= Ordenamiento =================
  function defaultCompare(a, b) {
    const A = normalize(a), B = normalize(b);
    if (A < B) return -1; if (A > B) return 1; return 0;
  }
  function normalize(v) {
    if (v == null) return "";
    if (typeof v === "number") return v;
    return String(v).trim().toLowerCase();
  }
  function sortedData() {
    if (!sort.key) return _rawRows;
    const col = columns.find(c => c.key === sort.key);
    if (!col) return _rawRows;
    const acc = col.accessor || (r => r[sort.key]);
    const cmp = col.compare || defaultCompare;
    const arr = _rawRows.map((r, i) => [acc(r, i, r), i, r]);
    arr.sort((A, B) => {
      const res = cmp(A[0], B[0]);
      if (res === 0) return A[1] - B[1];
      return sort.dir * res;
    });
    return arr.map(x => x[2]);
  }

  // ================= Render fila ==================
  function renderRow(r, iInPage) {
    const cls = typeof rowClass === "function" ? (rowClass(r) || "") : "";
    const tds = columns.map(col => {
      const acc = col.accessor || (row => row[col.key]);
      const val = acc(r);
      const html = col.render ? col.render(val, r) : escapeHtml(val ?? "—");
      return `<td>${html}</td>`;
    }).join("");
    return `<tr class="${cls}" data-row-idx="${iInPage}">${tds}</tr>`;
  }
  function renderBlankRow(colspan) {
    const cls = disableHoverOnBlanks ? "is-blank no-hover" : "is-blank";
    return `<tr class="${cls}" aria-hidden="true" data-row-idx="-1"><td colspan="${colspan}">&nbsp;</td></tr>`;
  }
  function renderEmptyRow(colspan, msg) {
    // Fila de “sin datos” dentro de la tabla (no interactiva)
    const cls = "is-empty no-hover";
    return `<tr class="${cls}" aria-hidden="true" data-row-idx="-1"><td colspan="${colspan}">${escapeHtml(msg)}</td></tr>`;
  }

  // ================= Render principal ==============
  function render() {
    const table = body?.closest("table");
    const colsCount = table?.querySelectorAll("thead th")?.length || (columns?.length || 1);

    const all = sortedData();
    const total = all.length;

    // Siempre mostramos la tabla; el contenedor empty externo es opcional
    if (emptyBox) {
      if (total === 0) { emptyBox.hidden = false; }
      else { emptyBox.hidden = true; }
    }

    // Paginado
    const pages = Math.max(1, Math.ceil(Math.max(1, total) / pageSize));
    if (page > pages) page = pages;
    const start = (page - 1) * pageSize;
    const pageItems = all.slice(start, start + pageSize);

    _pageRawRows = pageItems.map(r => r?.__raw ?? r);

    // Cuerpo
    if (body) {
      if (total === 0) {
        const parts = [];
        if (showEmptyRow) parts.push(renderEmptyRow(colsCount, emptyRowMessage));
        if (fillWithBlanks) {
          // Rellena toda la página con blanks
          const blanks = Math.max(0, pageSize - parts.length);
          for (let i = 0; i < blanks; i++) parts.push(renderBlankRow(colsCount));
          TLOG("placeholder blanks (empty):", blanks);
        }
        body.innerHTML = parts.join("");
      } else {
        const rowsHtml = pageItems.map((r, i) => renderRow(r, i)).join("");
        let blanksHtml = "";
        if (fillWithBlanks) {
          const blanks = Math.max(0, pageSize - pageItems.length);
          for (let i = 0; i < blanks; i++) blanksHtml += renderBlankRow(colsCount);
          TLOG("placeholder blanks (page):", blanks);
        }
        body.innerHTML = rowsHtml + blanksHtml;
      }
    }

    // Clicks (solo filas con data-row-idx >= 0)
    if (body && typeof onRowClick === "function") {
      body.querySelectorAll("tr[data-row-idx]").forEach(tr => {
        const idx = parseInt(tr.dataset.rowIdx, 10);
        tr.onclick = null;
        if (Number.isFinite(idx) && idx >= 0) {
          tr.addEventListener("click", () => {
            const raw = _pageRawRows[idx];
            if (raw) onRowClick(raw, idx);
          });
          tr.classList.add("row-clickable");
          tr.setAttribute("tabindex", "0");
          tr.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tr.click(); }});
        } else {
          tr.classList.remove("row-clickable");
          tr.removeAttribute("tabindex");
          tr.style.pointerEvents = "none";
        }
      });
    }

    // Paginación
    if (pag) {
      let html = "";
      for (let i = 1; i <= pages; i++) {
        html += `<button class="btn ${i === page ? "primary" : ""}" data-p="${i}" ${i===page?'aria-current="page"':''}>${i}</button>`;
      }
      pag.innerHTML = html;
      pag.querySelectorAll("button").forEach(b =>
        b.addEventListener("click", () => setPage(parseInt(b.dataset.p, 10)))
      );
    }

    paintSortIndicators();
  }

  // ---- Indicadores sort en <th> ----
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

  function destroy() {  }

  initHeader();
  return { setData, setPage, setSort, getSort, setPageSize, destroy, getPageRawRows, getRawRows };
}

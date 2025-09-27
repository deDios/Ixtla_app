// /JS/ui/table.js
import { $, toggle, escapeHtml } from "../core/dom.js";

export function createTable({
  bodySel = "#tbl-body",
  wrapSel = "#tbl-wrap",
  emptySel = "#tbl-empty",
  pagSel = "#tbl-pag",
  pageSize = 8,
  columns = [
    // { key:"tramite", title:"Trámites", sortable:true, accessor:(row)=>row.tramite, compare:(a,b)=>a.localeCompare(b) }
  ]
} = {}) {
  const body = $(bodySel);
  const wrap = $(wrapSel);
  const empty = $(emptySel);
  const pag = $(pagSel);

  // Detecta thead si quieres pintar indicadores ▲▼ (opcional)
  const thead = body?.closest("table")?.querySelector("thead");

  let raw = [];      // data completa (rows listos para pintar)
  let page = 1;
  let sort = { key: null, dir: 1 }; // 1 asc, -1 desc

  // Renderiza encabezados con listeners de sort
  function initHeader() {
    if (!thead) return;
    const ths = Array.from(thead.querySelectorAll("th"));
    // Emparejamos en orden con columns
    ths.forEach((th, idx) => {
      const col = columns[idx];
      if (!col || !col.sortable) return;
      th.style.cursor = "pointer";
      th.dataset.sortKey = col.key;
      th.addEventListener("click", () => {
        const key = th.dataset.sortKey;
        if (sort.key === key) {
          sort.dir = -sort.dir; // toggle
        } else {
          sort.key = key;
          sort.dir = 1; // asc por default
        }
        render();
      });
    });
  }

  // API pública
  function setData(rows = []) {
    raw = Array.isArray(rows) ? rows.slice() : [];
    page = 1;
    render();
  }

  function setPage(p) {
    page = Math.max(1, p | 0 || 1);
    render();
  }

  function setSort(key, dir = 1) {
    sort = { key, dir: dir >= 0 ? 1 : -1 };
    render();
  }

  function getSort() { return { ...sort }; }

  function sortedData() {
    if (!sort.key) return raw;
    const col = columns.find(c => c.key === sort.key);
    if (!col) return raw;

    // construimos pares [value, index, row] para un sort estable
    const acc = col.accessor || ((r) => r[sort.key]);
    const cmp = col.compare || defaultCompare;

    const arr = raw.map((r, i) => [acc(r, i, r), i, r]);
    arr.sort((A, B) => {
      const res = cmp(A[0], B[0]);
      if (res === 0) return A[1] - B[1]; // estable
      return sort.dir * res;
    });
    return arr.map(x => x[2]);
  }

  function render() {
    // Estado vacío
    if (!raw.length) {
      toggle(wrap, false); toggle(empty, true);
      if (pag) pag.innerHTML = "";
      paintSortIndicators();
      return;
    }
    toggle(empty, false); toggle(wrap, true);

    const data = sortedData();

    const start = (page - 1) * pageSize;
    const pageItems = data.slice(start, start + pageSize);

    body.innerHTML = pageItems.map(r => `
      <tr>
        <td>${escapeHtml(r.tramite ?? "—")}</td>
        <td>${escapeHtml(r.asignado ?? "—")}</td>
        <td>${escapeHtml(r.fecha ?? "—")}</td>
        <td>${escapeHtml(r.status ?? "—")}</td>
      </tr>
    `).join("");

    // Paginación
    if (pag) {
      const pages = Math.max(1, Math.ceil(data.length / pageSize));
      let html = "";
      for (let i = 1; i <= pages; i++) {
        html += `<button class="btn ${i === page ? "primary" : ""}" data-p="${i}">${i}</button>`;
      }
      pag.innerHTML = html;
      pag.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
        setPage(parseInt(b.dataset.p, 10));
      }));
    }

    paintSortIndicators();
  }

  function paintSortIndicators() {
    if (!thead) return;
    const ths = Array.from(thead.querySelectorAll("th"));
    ths.forEach((th, idx) => {
      const col = columns[idx];
      if (!col || !col.sortable) {
        th.dataset.sort = "";
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

  function destroy() { /* no-op */ }

  // Inicializa encabezado si existe
  initHeader();

  return { setData, setPage, setSort, getSort, destroy };
}

// Comparador por defecto (strings/nums/fechas en ISO o DD/MM/YYYY)
function defaultCompare(a, b) {
  // normalizar
  const A = normalize(a);
  const B = normalize(b);
  if (A < B) return -1;
  if (A > B) return 1;
  return 0;
}

function normalize(v) {
  if (v == null) return "";
  if (typeof v === "number") return v;
  let s = String(v).trim();

  // dd/mm/yyyy -> yyyy-mm-dd
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) s = `${m[3]}-${m[2]}-${m[1]}`;

  return s.toLowerCase();
}

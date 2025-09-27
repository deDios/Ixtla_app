// /JS/ui/table.js
import { $, toggle, escapeHtml } from "../core/dom.js";

export function createTable({
  bodySel = "#tbl-body",
  wrapSel = "#tbl-wrap",
  emptySel = "#tbl-empty",
  pagSel = "#tbl-pag",
  pageSize = 8
} = {}) {
  const body = $(bodySel);
  const wrap = $(wrapSel);
  const empty = $(emptySel);
  const pag = $(pagSel);

  let data = [];
  let page = 1;

  function setData(rows = []) {
    data = Array.isArray(rows) ? rows : [];
    page = 1;
    render();
  }

  function setPage(p) {
    page = Math.max(1, p | 0 || 1);
    render();
  }

  function render() {
    if (!data.length) {
      toggle(wrap, false); toggle(empty, true);
      if (pag) pag.innerHTML = "";
      return;
    }
    toggle(empty, false); toggle(wrap, true);

    const start = (page - 1) * pageSize;
    const pageItems = data.slice(start, start + pageSize);

    body.innerHTML = pageItems.map(r => `
      <tr>
        <td>${escapeHtml(r.tramite ?? r.asunto ?? "—")}</td>
        <td>${escapeHtml(r.asignado ?? "—")}</td>
        <td>${escapeHtml(r.fecha ?? "—")}</td>
        <td>${escapeHtml(r.status ?? r.estatus ?? "—")}</td>
      </tr>
    `).join("");

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
  }

  function destroy() { /* no-op */ }

  return { setData, setPage, destroy };
}

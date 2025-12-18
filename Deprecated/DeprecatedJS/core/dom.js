// /JS/core/dom.js
export const $  = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

export function toggle(el, show = true) {
  if (!el) return; el.hidden = !show;
}

export function mountSkeletonList(el, rows = 6) {
  if (!el) return;
  el.innerHTML = "";
  for (let i = 0; i < rows; i++) {
    const d = document.createElement("div");
    el.appendChild(d);
  }
}

export function escapeHtml(s) {
  return (s ?? "").toString().replace(/[&<>"']/g, m => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
  ));
}

export function fmtDateISOtoMX(iso) {
  if (!iso) return "—";
  const d = new Date((iso || "").replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// /JS/ui/sidebar.js
"use strict";

const DEBUG = false;
const SLOG = (...a) => { if (DEBUG) console.log("[Sidebar]", ...a); };

const VALID_KEYS = ["todos","pendientes","en_proceso","terminados","cancelados","pausados"];

export function createSidebar({
  groupSel = "#hs-states",
  itemSel  = "#hs-states .item",
  initial  = "todos",
  onChange = () => {}
} = {}) {
  const group = document.querySelector(groupSel);
  const items = Array.from(document.querySelectorAll(itemSel));
  if (!group || !items.length) {
    console.warn("[Sidebar] No se encontró contenedor o items", { groupSel, itemSel });
    return {
      getActive: () => initial,
      setActive: () => {},
      setCounts: () => {},
      destroy: () => {}
    };
  }

  // ARIA
  group.setAttribute("role", "radiogroup");
  items.forEach((btn, i) => {
    btn.setAttribute("role", "radio");
    btn.setAttribute("tabindex", i === 0 ? "0" : "-1");
    const key = btn.dataset.status || "";
    if (!VALID_KEYS.includes(key)) console.warn("[Sidebar] item sin data-status válido:", btn);
  });

  function activate(btn) {
    items.forEach(b => { b.classList.remove("is-active"); b.setAttribute("aria-checked", "false"); b.tabIndex = -1; });
    btn.classList.add("is-active");
    btn.setAttribute("aria-checked", "true");
    btn.tabIndex = 0;
    const k = btn.dataset.status || "todos";
    SLOG("changed ->", k);
    onChange(k);
  }

  // Click
  items.forEach(btn => btn.addEventListener("click", () => activate(btn)));

  // Teclado
  group.addEventListener("keydown", (e) => {
    const cur = document.activeElement.closest(".item");
    const idx = Math.max(0, items.indexOf(cur));
    let nextIdx = idx;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") nextIdx = (idx + 1) % items.length;
    if (e.key === "ArrowUp"   || e.key === "ArrowLeft")  nextIdx = (idx - 1 + items.length) % items.length;
    if (nextIdx !== idx) { items[nextIdx].focus(); e.preventDefault(); }
    if (e.key === " " || e.key === "Enter") { activate(items[nextIdx]); e.preventDefault(); }
  });

  // Estado inicial
  const start = items.find(b => (b.dataset.status || "") === initial) || items[0];
  if (start) activate(start);

  // API
  function getActive() {
    const act = items.find(b => b.classList.contains("is-active"));
    return act?.dataset.status || initial;
  }

  function setActive(key) {
    const btn = items.find(b => (b.dataset.status || "") === key);
    if (btn) activate(btn);
  }

  // Escribe conteos dentro de cada .count (o por id #cnt-<key> si existe)
  function setCounts(counts = {}) {
    for (const k of VALID_KEYS) {
      const txt = `(${counts[k] ?? 0})`;
      const byId = document.querySelector(`#cnt-${k}`);
      if (byId) byId.textContent = txt;
      // si no hay #cnt-<key>, busca el .count del botón
      const btn = items.find(b => (b.dataset.status || "") === k);
      const span = btn?.querySelector(".count");
      if (span) span.textContent = txt;
    }
  }

  function destroy() {
    // (opcional) remover listeners si lo necesitas
  }

  return { getActive, setActive, setCounts, destroy };
}

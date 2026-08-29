const STORAGE_KEY = "ixtla_insights_dashboard_session_v1";
const PERIOD_LABELS = {
  all: "Todo el historial",
  last_7: "Últimos 7 días",
  last_30: "Últimos 30 días",
  this_month: "Este mes",
};
const VISIBILITY_LABELS = {
  private: "Privada",
  departments: "Departamentos",
  department: "Departamento",
  organization: "Organización",
};
const COLORS = ["#176b87", "#2d8ca6", "#5aaebd", "#86c6cf", "#0f4c81", "#73a5d1"];

const grid = document.querySelector("#dashboard-grid");
const empty = document.querySelector("#dashboard-empty");
const count = document.querySelector("#dashboard-widget-count");
const status = document.querySelector("#dashboard-status");
const clearButton = document.querySelector("#dashboard-clear");
const refreshButton = document.querySelector("#dashboard-refresh");
const confirmDialog = document.querySelector("#dashboard-confirm");

let widgets = readWidgets();
let draggedIndex = null;

function clean(value) {
  return String(value ?? "").trim();
}

function readWidgets() {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item?.spec && item?.preview).slice(0, 24) : [];
  } catch {
    return [];
  }
}

function persistWidgets() {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(widgets.slice(0, 24)));
    return true;
  } catch {
    status.textContent = "No fue posible conservar los cambios en esta sesión.";
    return false;
  }
}

function number(value, options = {}) {
  return (Number(value) || 0).toLocaleString("es-MX", options);
}

function itemRows(preview) {
  return (Array.isArray(preview?.items) ? preview.items : []).map((item) => ({
    label: clean(item?.label) || "Sin especificar",
    value: Number(item?.value) || 0,
  }));
}

function dimensionRows(preview) {
  const categories = (Array.isArray(preview?.categories) ? preview.categories : []).map((item) => ({
    id: item?.id ?? null,
    label: clean(item?.label) || "Sin especificar",
    total: Number(item?.total) || 0,
  }));
  const series = (Array.isArray(preview?.series) ? preview.series : []).map((item) => ({
    id: item?.id ?? null,
    label: clean(item?.label) || "Sin especificar",
    total: Number(item?.total) || 0,
    values: Array.isArray(item?.values) ? item.values.map((value) => Number(value) || 0) : [],
  }));
  return { categories, series };
}

function totalFor(preview, items) {
  if (preview?.value !== null && preview?.value !== undefined) return Number(preview.value) || 0;
  return items.reduce((sum, item) => sum + item.value, 0);
}

function appendState(container, title, detail) {
  const state = document.createElement("div");
  state.className = "ixtla-dashboard-state";
  const strong = document.createElement("strong"); strong.textContent = title;
  const span = document.createElement("span"); span.textContent = detail;
  state.append(strong, span); container.append(state);
}

function renderKpi(container, preview, items) {
  const kpi = document.createElement("div"); kpi.className = "ixtla-dashboard-kpi";
  const value = document.createElement("strong"); value.textContent = number(totalFor(preview, items), { maximumFractionDigits: 2 });
  const label = document.createElement("span"); label.textContent = clean(preview.valueLabel) || "Total";
  kpi.append(value, label); container.append(kpi);
}

function renderBars(container, items) {
  const maximum = Math.max(1, ...items.map((item) => item.value));
  items.forEach((item) => {
    const row = document.createElement("div"); row.className = "ixtla-dashboard-bar";
    const label = document.createElement("span"); label.textContent = item.label; label.title = item.label;
    const track = document.createElement("div");
    const fill = document.createElement("i"); fill.style.width = `${Math.max(2, (item.value / maximum) * 100)}%`;
    track.append(fill);
    const value = document.createElement("strong"); value.textContent = number(item.value);
    row.append(label, track, value); container.append(row);
  });
}

function renderDonut(container, items) {
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  const visible = items.length > 5
    ? [...items.slice(0, 4), { label: "Otros", value: items.slice(4).reduce((sum, item) => sum + item.value, 0) }]
    : items;
  let cursor = 0;
  const stops = visible.map((item, index) => {
    const start = cursor; cursor += (item.value / total) * 100;
    return `${COLORS[index % COLORS.length]} ${start}% ${cursor}%`;
  });
  const wrap = document.createElement("div"); wrap.className = "ixtla-dashboard-donut-wrap";
  const donut = document.createElement("div"); donut.className = "ixtla-dashboard-donut"; donut.style.background = `conic-gradient(${stops.join(",")})`;
  const value = document.createElement("strong"); value.textContent = number(total);
  const label = document.createElement("span"); label.textContent = "Total"; donut.append(value, label);
  const legend = document.createElement("ul"); legend.className = "ixtla-dashboard-legend";
  visible.forEach((item, index) => {
    const entry = document.createElement("li");
    const name = document.createElement("span");
    const dot = document.createElement("i"); dot.style.background = COLORS[index % COLORS.length];
    name.append(dot, document.createTextNode(item.label));
    const itemValue = document.createElement("strong"); itemValue.textContent = `${number(item.value)} · ${number((item.value / total) * 100, { maximumFractionDigits: 1 })}%`;
    entry.append(name, itemValue); legend.append(entry);
  });
  wrap.append(donut, legend); container.append(wrap);
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function renderLine(container, items, area = false) {
  const width = 620, height = 230, pad = { top: 18, right: 20, bottom: 42, left: 48 };
  const maximum = Math.max(1, ...items.map((item) => item.value));
  const plotWidth = width - pad.left - pad.right, plotHeight = height - pad.top - pad.bottom;
  const coordinates = items.map((item, index) => ({
    x: pad.left + (items.length === 1 ? plotWidth / 2 : index * (plotWidth / (items.length - 1))),
    y: height - pad.bottom - (item.value / maximum) * plotHeight,
  }));
  const points = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}`, class: "ixtla-dashboard-line", role: "img", "aria-label": "Gráfica temporal" });
  [0, .5, 1].forEach((ratio) => {
    const y = height - pad.bottom - ratio * plotHeight;
    svg.append(svgElement("line", { x1: pad.left, x2: width - pad.right, y1: y, y2: y, class: "ixtla-dashboard-line-grid" }));
    const text = svgElement("text", { x: pad.left - 8, y: y + 4, "text-anchor": "end", class: "ixtla-dashboard-line-axis" });
    text.textContent = number(Math.round(maximum * ratio)); svg.append(text);
  });
  if (area && points) svg.append(svgElement("polygon", { points: `${pad.left},${height - pad.bottom} ${points} ${width - pad.right},${height - pad.bottom}`, class: "area" }));
  svg.append(svgElement("polyline", { points }));
  const tickIndexes = new Set([0, Math.floor((items.length - 1) / 2), items.length - 1]);
  items.forEach((item, index) => {
    const point = svgElement("circle", { cx: coordinates[index].x, cy: coordinates[index].y, r: index === items.length - 1 ? 4.5 : 3.5, class: "ixtla-dashboard-line-point" });
    const title = svgElement("title"); title.textContent = `${item.label}: ${number(item.value)}`; point.append(title); svg.append(point);
    if (tickIndexes.has(index)) {
      const text = svgElement("text", { x: coordinates[index].x, y: height - 13, "text-anchor": index === 0 ? "start" : index === items.length - 1 ? "end" : "middle", class: "ixtla-dashboard-line-axis" });
      text.textContent = item.label; svg.append(text);
    }
  });
  container.append(svg);
}

function renderMultiLine(container, categories, series) {
  const width = 620, height = 250, pad = { top: 18, right: 20, bottom: 42, left: 48 };
  const maximum = Math.max(1, ...series.flatMap((item) => item.values));
  const plotWidth = width - pad.left - pad.right, plotHeight = height - pad.top - pad.bottom;
  const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}`, class: "ixtla-dashboard-line", role: "img", "aria-label": "Gráfica temporal con varias series" });
  [0, .5, 1].forEach((ratio) => {
    const y = height - pad.bottom - ratio * plotHeight;
    svg.append(svgElement("line", { x1: pad.left, x2: width - pad.right, y1: y, y2: y, class: "ixtla-dashboard-line-grid" }));
    const label = svgElement("text", { x: pad.left - 8, y: y + 4, "text-anchor": "end", class: "ixtla-dashboard-line-axis" });
    label.textContent = number(Math.round(maximum * ratio)); svg.append(label);
  });
  series.forEach((item, seriesIndex) => {
    const coordinates = categories.map((category, index) => ({
      x: pad.left + (categories.length === 1 ? plotWidth / 2 : index * (plotWidth / (categories.length - 1))),
      y: height - pad.bottom - ((item.values[index] || 0) / maximum) * plotHeight,
    }));
    const points = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
    svg.append(svgElement("polyline", { points, style: `stroke:${COLORS[seriesIndex % COLORS.length]}` }));
    coordinates.forEach((point, index) => {
      const circle = svgElement("circle", { cx: point.x, cy: point.y, r: 3, style: `stroke:${COLORS[seriesIndex % COLORS.length]}` });
      const title = svgElement("title"); title.textContent = `${categories[index].label} · ${item.label}: ${number(item.values[index])}`;
      circle.append(title); svg.append(circle);
    });
  });
  const tickIndexes = new Set([0, Math.floor((categories.length - 1) / 2), categories.length - 1]);
  categories.forEach((category, index) => {
    if (!tickIndexes.has(index)) return;
    const x = pad.left + (categories.length === 1 ? plotWidth / 2 : index * (plotWidth / (categories.length - 1)));
    const label = svgElement("text", { x, y: height - 13, "text-anchor": index === 0 ? "start" : index === categories.length - 1 ? "end" : "middle", class: "ixtla-dashboard-line-axis" });
    label.textContent = category.label; svg.append(label);
  });
  const legend = document.createElement("div"); legend.className = "ixtla-dashboard-series-legend";
  series.forEach((item, index) => {
    const entry = document.createElement("span"); const dot = document.createElement("i"); dot.style.background = COLORS[index % COLORS.length];
    entry.append(dot, document.createTextNode(`${item.label} (${number(item.total)})`)); legend.append(entry);
  });
  container.append(svg, legend);
}

function renderMatrix(container, categories, series) {
  const maximum = Math.max(1, ...series.flatMap((item) => item.values));
  const wrap = document.createElement("div"); wrap.className = "ixtla-dashboard-matrix-wrap";
  const table = document.createElement("table"); table.className = "ixtla-dashboard-matrix";
  const head = document.createElement("thead"); const headRow = document.createElement("tr");
  ["Categoría", ...series.map((item) => item.label), "Total"].forEach((text) => { const th = document.createElement("th"); th.textContent = text; headRow.append(th); });
  head.append(headRow);
  const body = document.createElement("tbody");
  categories.forEach((category, categoryIndex) => {
    const row = document.createElement("tr"); const label = document.createElement("th"); label.scope = "row"; label.textContent = category.label; row.append(label);
    series.forEach((item) => {
      const value = Number(item.values[categoryIndex]) || 0; const cell = document.createElement("td"); cell.textContent = number(value);
      cell.style.backgroundColor = `rgba(45, 140, 166, ${(.08 + Math.max(.06, value / maximum) * .46).toFixed(3)})`;
      cell.title = `${category.label} · ${item.label}: ${number(value)}`; row.append(cell);
    });
    const total = document.createElement("td"); total.className = "ixtla-dashboard-matrix__total"; total.textContent = number(category.total); row.append(total); body.append(row);
  });
  table.append(head, body); wrap.append(table); container.append(wrap);
}

function renderTable(container, items) {
  const wrap = document.createElement("div"); wrap.className = "ixtla-dashboard-table-wrap";
  const table = document.createElement("table"); table.className = "ixtla-dashboard-table";
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Categoría", "Valor"].forEach((text) => { const th = document.createElement("th"); th.textContent = text; headRow.append(th); });
  head.append(headRow);
  const body = document.createElement("tbody");
  items.forEach((item) => {
    const row = document.createElement("tr");
    const label = document.createElement("td"); label.textContent = item.label; label.title = item.label;
    const value = document.createElement("td"); value.textContent = number(item.value);
    row.append(label, value); body.append(row);
  });
  table.append(head, body); wrap.append(table); container.append(wrap);
}

function renderVisualization(container, preview) {
  const items = itemRows(preview);
  const { categories, series } = dimensionRows(preview);
  if (preview.chart !== "kpi" && !items.length) {
    appendState(container, "Sin datos disponibles", "Vuelve al asistente para ajustar el periodo o los filtros.");
    return;
  }
  if (preview.chart === "kpi") renderKpi(container, preview, items);
  else if (preview.chart === "donut") renderDonut(container, items);
  else if (preview.chart === "matrix" && categories.length && series.length) renderMatrix(container, categories, series);
  else if ((preview.chart === "line" || preview.chart === "area") && categories.length && series.length) renderMultiLine(container, categories, series);
  else if (preview.chart === "line" || preview.chart === "area") renderLine(container, items, preview.chart === "area");
  else if (preview.chart === "table") renderTable(container, items);
  else renderBars(container, items);
}

function visibilityFor(spec) {
  const value = clean(spec?.control?.visibility || spec?.visibility || "private");
  return VISIBILITY_LABELS[value] || VISIBILITY_LABELS.private;
}

function createCard(widget, index) {
  const spec = widget.spec || {};
  const preview = widget.preview || {};
  const wide = ["line", "area", "table", "matrix"].includes(preview.chart);
  const card = document.createElement("article");
  card.className = `ixtla-dashboard-card${wide ? " ixtla-dashboard-card--wide" : ""}`;
  card.draggable = true; card.dataset.index = String(index);
  const header = document.createElement("header"); header.className = "ixtla-dashboard-card__header";
  const heading = document.createElement("div");
  const kind = document.createElement("p"); kind.textContent = preview.chart === "kpi" ? "Indicador" : "Visualización";
  const title = document.createElement("h2"); title.textContent = clean(preview.title || spec.title) || "Gráfica de requerimientos";
  const period = document.createElement("div"); period.className = "ixtla-dashboard-card__period";
  period.textContent = `${PERIOD_LABELS[spec.period] || PERIOD_LABELS.all} · ${clean(preview.scopeLabel || spec.scopeLabel) || "Vista autorizada"}`;
  heading.append(kind, title, period);
  const tools = document.createElement("div"); tools.className = "ixtla-dashboard-card__tools";
  const visibility = document.createElement("span"); visibility.className = "ixtla-dashboard-card__visibility"; visibility.textContent = visibilityFor(spec);
  const drag = document.createElement("button"); drag.type = "button"; drag.className = "ixtla-dashboard-drag"; drag.textContent = "⠿"; drag.title = "Arrastrar para ordenar"; drag.setAttribute("aria-label", "Arrastrar para ordenar");
  tools.append(visibility, drag); header.append(heading, tools);
  const narrative = document.createElement("div"); narrative.className = "ixtla-dashboard-card__narrative";
  const narrativeTitle = document.createElement("strong"); narrativeTitle.textContent = "Lo más importante";
  const narrativeText = document.createElement("span"); narrativeText.textContent = clean(preview.insight) || "Visualización preparada por Ixtla Insights.";
  narrative.append(narrativeTitle, narrativeText);
  const content = document.createElement("div"); content.className = "ixtla-dashboard-card__content";
  renderVisualization(content, preview);
  const footer = document.createElement("footer"); footer.className = "ixtla-dashboard-card__footer";
  const updated = document.createElement("span");
  const date = new Date(preview.generatedAt || Date.now());
  updated.textContent = Number.isNaN(date.getTime()) ? "Preparada en esta sesión" : `Actualizada ${date.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}`;
  const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Quitar"; remove.dataset.remove = String(index); remove.setAttribute("aria-label", `Quitar ${title.textContent}`);
  footer.append(updated, remove); card.append(header, narrative, content, footer);
  return card;
}

function render() {
  grid.replaceChildren();
  widgets.forEach((widget, index) => grid.append(createCard(widget, index)));
  count.textContent = String(widgets.length);
  empty.hidden = widgets.length > 0;
  grid.hidden = widgets.length === 0;
  clearButton.disabled = widgets.length === 0;
  status.textContent = widgets.length
    ? "Arrastra las tarjetas para cambiar su orden. Los cambios se conservan durante esta sesión."
    : "Las gráficas se conservan durante esta sesión del navegador.";
}

grid.addEventListener("click", (event) => {
  const remove = event.target.closest("[data-remove]");
  if (!remove) return;
  const index = Number(remove.dataset.remove);
  if (!Number.isInteger(index) || !widgets[index]) return;
  widgets.splice(index, 1); persistWidgets(); render();
});

grid.addEventListener("dragstart", (event) => {
  const card = event.target.closest(".ixtla-dashboard-card");
  if (!card) return;
  draggedIndex = Number(card.dataset.index); card.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
});
grid.addEventListener("dragover", (event) => {
  const card = event.target.closest(".ixtla-dashboard-card");
  if (!card || draggedIndex === null) return;
  event.preventDefault();
  grid.querySelectorAll(".is-drag-over").forEach((item) => item.classList.remove("is-drag-over"));
  card.classList.add("is-drag-over");
});
grid.addEventListener("drop", (event) => {
  const card = event.target.closest(".ixtla-dashboard-card");
  if (!card || draggedIndex === null) return;
  event.preventDefault();
  const targetIndex = Number(card.dataset.index);
  if (Number.isInteger(targetIndex) && targetIndex !== draggedIndex) {
    const [moved] = widgets.splice(draggedIndex, 1); widgets.splice(targetIndex, 0, moved); persistWidgets();
  }
  draggedIndex = null; render();
});
grid.addEventListener("dragend", () => { draggedIndex = null; render(); });

refreshButton.addEventListener("click", () => { widgets = readWidgets(); render(); });
clearButton.addEventListener("click", () => {
  if (typeof confirmDialog.showModal === "function") confirmDialog.showModal();
  else if (window.confirm("¿Quitar todas las visualizaciones de esta sesión?")) { widgets = []; persistWidgets(); render(); }
});
confirmDialog.addEventListener("close", () => {
  if (confirmDialog.returnValue !== "confirm") return;
  widgets = []; persistWidgets(); render();
});

render();

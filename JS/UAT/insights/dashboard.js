import {
  addVisualizationToTemporaryDashboard,
  addTemporaryWidget,
  clearTemporaryDashboard,
  getWidgetCatalog,
  loadTemporaryDashboard,
  moveTemporaryWidget,
  removeTemporaryWidget,
} from "/JS/UAT/insights/dashboard-store.js";

const STATUS_LABELS = {
  solicitud: "Solicitud",
  revision: "Revision",
  asignacion: "Asignacion",
  proceso: "En proceso",
  pausado: "Pausado",
  cancelado: "Cancelado",
  finalizado: "Finalizado",
};
const STATUS_COLORS = { solicitud: "#64748b", revision: "#0f4c81", "revisión": "#0f4c81", asignacion: "#7c3aed", "asignación": "#7c3aed", proceso: "#0ea5a4", "en proceso": "#0ea5a4", pausado: "#f59e0b", cancelado: "#dc2626", finalizado: "#16a34a" };
const COLORS = ["#0f4c81", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444", "#64748b", "#22c55e"];
const ANALYTICS_URL = "/db/ixtla_insights/analytics.php";
const INTERNAL_SCROLL_LIMITS = { bar: 6, table: 8, funnel: 6 };
const analyticsCache = new Map();
const PERIOD_LABELS = { all: "Todo el historial", last_7: "Últimos 7 días", last_30: "Últimos 30 días", this_month: "Este mes" };
const clean = (value) => String(value ?? "").trim();
const escapeHtml = (value) => clean(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

function departmentColor(name) {
  const normalized = clean(name).toLocaleLowerCase("es-MX");
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) hash = ((hash << 5) - hash) + normalized.charCodeAt(index);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function entryColor(label, index, widget) {
  if (widget?.dimension === "estatus") return STATUS_COLORS[clean(label).toLocaleLowerCase("es-MX")] || COLORS[index % COLORS.length];
  return widget?.dimension === "departamento" ? departmentColor(label) : COLORS[index % COLORS.length];
}

function dayOf(value) {
  const raw = clean(value);
  if (!raw) return "Sin fecha";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw.slice(0, 10) : date.toISOString().slice(0, 10);
}

function rowsForPeriod(rows, period) {
  if (!period || period === "all") return rows;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  if (period === "last_7") start.setDate(start.getDate() - 6);
  else if (period === "last_30") start.setDate(start.getDate() - 29);
  else if (period === "this_month") start.setDate(1);
  else return rows;
  return rows.filter((row) => {
    const created = new Date(row?.creado);
    return !Number.isNaN(created.getTime()) && created >= start;
  });
}

function sourceRows(rows, widget) {
  const selectedDepartments = (Array.isArray(widget.filters) ? widget.filters : [])
    .filter((filter) => filter?.field === "departamento" && clean(filter?.value))
    .map((filter) => clean(filter.value).toLocaleLowerCase("es-MX"));
  const scopedRows = selectedDepartments.length
    ? rows.filter((row) => selectedDepartments.includes(clean(row?.departamento).toLocaleLowerCase("es-MX")))
    : rows;
  const periodRows = rowsForPeriod(scopedRows, widget.period);
  if (widget.metric === "finalizados") return periodRows.filter((row) => row.estatus === "finalizado");
  if (widget.metric === "abiertos") return periodRows.filter((row) => !["finalizado", "cancelado"].includes(row.estatus));
  if (widget.metric === "pausados") return periodRows.filter((row) => row.estatus === "pausado");
  if (widget.metric === "cancelados") return periodRows.filter((row) => row.estatus === "cancelado");
  if (widget.metric === "pausados_cancelados") return periodRows.filter((row) => ["pausado", "cancelado"].includes(row.estatus));
  if (widget.metric === "cerrados") return periodRows.filter((row) => ["finalizado", "cancelado"].includes(row.estatus));
  if (["promedio_semanal", "tiempo_resolucion"].includes(widget.metric)) return [];
  return periodRows;
}

function groupRows(rows, widget) {
  return sourceRows(rows, widget).reduce((groups, row) => {
    const raw = widget.dimension === "departamento"
      ? row.departamento
      : widget.dimension === "tramite"
        ? row.tramite
        : widget.dimension === "fecha"
          ? dayOf(row.creado)
          : row.estatus;
    const fallback = widget.dimension === "departamento" ? "Sin departamento" : "Sin tramite";
    const key = widget.dimension === "estatus" ? (STATUS_LABELS[raw] || raw || "Sin estatus") : (raw || fallback);
    groups[key] = (groups[key] || 0) + 1;
    return groups;
  }, {});
}

function entriesFor(rows, widget) {
  const entries = Object.entries(groupRows(rows, widget));
  return widget.dimension === "fecha"
    ? entries.sort(([left], [right]) => left.localeCompare(right))
    : entries.sort((left, right) => right[1] - left[1]);
}

function renderBar(target, entries, widget) {
  const max = Math.max(...entries.map(([, value]) => value), 1);
  target.innerHTML = entries.length
    ? entries.map(([label, value], index) => `<div class="ixtla-dashboard-bar"><span title="${escapeHtml(label)}">${escapeHtml(label)}</span><div><i style="width:${Math.round((value / max) * 100)}%;background:${entryColor(label, index, widget)}"></i></div><strong>${value}</strong></div>`).join("")
    : '<p class="ixtla-dashboard-empty-message">No hay datos para esta visualizacion.</p>';
}

function renderDonut(target, entries, widget) {
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  let cursor = 0;
  const segments = entries.map(([, value], index) => {
    const start = cursor;
    cursor += (value / total) * 100;
    return `${entryColor(entries[index][0], index, widget)} ${start}% ${cursor}%`;
  });
  target.innerHTML = total
    ? `<div class="ixtla-dashboard-donut-wrap"><div class="ixtla-dashboard-donut" style="background:conic-gradient(${segments.join(",")})"><strong>${total}</strong><span>Total</span></div><ul class="ixtla-dashboard-legend">${entries.map(([label, value], index) => `<li><span><i style="background:${entryColor(label, index, widget)}"></i>${escapeHtml(label)}</span><strong>${value}</strong></li>`).join("")}</ul></div>`
    : '<p class="ixtla-dashboard-empty-message">No hay datos para esta visualizacion.</p>';
}

function renderKpi(target, total, widget) {
  const labels = {
    total: "Requerimientos visibles",
    abiertos: "Requerimientos abiertos",
    finalizados: "Requerimientos finalizados",
    pausados_cancelados: "Requerimientos pausados/cancelados",
    pausados: "Requerimientos pausados",
    cancelados: "Requerimientos cancelados",
    cerrados: "Requerimientos cerrados",
    promedio_semanal: "Promedio de requerimientos por semana",
    tiempo_resolucion: "Días promedio para resolver",
  };
  const value = Number.isFinite(total) && !Number.isInteger(total) ? total.toFixed(1) : total;
  target.innerHTML = `<div class="ixtla-dashboard-kpi"><strong>${value}</strong><span>${labels[widget.metric] || "Requerimientos visibles"}</span></div>`;
}

function renderLine(target, entries) {
  const values = entries.slice(-7);
  if (!values.length) {
    target.innerHTML = '<p class="ixtla-dashboard-empty-message">No hay datos para esta visualizacion.</p>';
    return;
  }
  const max = Math.max(...values.map(([, value]) => value), 1);
  const width = 460;
  const height = 150;
  const step = values.length === 1 ? 0 : width / (values.length - 1);
  const points = values.map(([, value], index) => [index * step, height - ((value / max) * 112) - 12]);
  const line = points.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `0,${height} ${line} ${width},${height}`;
  target.innerHTML = `<svg class="ixtla-dashboard-line" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="Tendencia"><polygon class="area" points="${area}"></polygon><polyline points="${line}"></polyline>${points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4"></circle>`).join("")}</svg><div class="ixtla-dashboard-line-labels">${values.map(([label]) => `<span title="${escapeHtml(label)}">${escapeHtml(label)}</span>`).join("")}</div>`;
}

function renderTable(target, entries) {
  target.innerHTML = entries.length
    ? `<table class="ixtla-dashboard-table"><thead><tr><th>${entries.length > 1 ? "Categoria" : "Resultado"}</th><th>Total</th></tr></thead><tbody>${entries.map(([label, value]) => `<tr><td title="${escapeHtml(label)}">${escapeHtml(label)}</td><td><strong>${value}</strong></td></tr>`).join("")}</tbody></table>`
    : '<p class="ixtla-dashboard-empty-message">No hay datos para esta visualizacion.</p>';
}

function renderFunnel(target, entries) {
  const max = Math.max(...entries.map(([, value]) => value), 1);
  target.innerHTML = entries.length
    ? `<div class="ixtla-dashboard-funnel">${entries.map(([label, value]) => `<div class="ixtla-dashboard-funnel__step" style="width:${Math.max(24, Math.round((value / max) * 100))}%"><span title="${escapeHtml(label)}">${escapeHtml(label)}</span><strong>${value}</strong></div>`).join("")}</div>`
    : '<p class="ixtla-dashboard-empty-message">No hay datos para esta visualizacion.</p>';
}

function scrollStrategy(chart, entryCount) {
  if (chart === "donut") return "legend";
  const limit = INTERNAL_SCROLL_LIMITS[chart];
  return Number.isInteger(limit) && entryCount > limit ? "content" : "none";
}

function cardSize(chart) {
  if (chart === "kpi") return "ixtla-dashboard-card--small";
  if (chart === "line" || chart === "area" || chart === "table") return "ixtla-dashboard-card--wide";
  return "";
}

function metricLabel(widget) {
  if (widget.metric === "pausados_cancelados") return "Metrica: pausados/cancelados";
  const labels = {
    total: "Métrica: total",
    abiertos: "Métrica: abiertos",
    finalizados: "Métrica: finalizados",
    pausados: "Métrica: pausados",
    cancelados: "Métrica: cancelados",
    cerrados: "Métrica: cerrados",
    promedio_semanal: "Indicador: promedio semanal",
    tiempo_resolucion: "Indicador: tiempo de resolución",
  };
  return labels[widget.metric] || "Métrica de requerimientos";
}

function widgetDepartments(widget) {
  return (Array.isArray(widget.filters) ? widget.filters : [])
    .filter((filter) => filter?.field === "departamento" && clean(filter?.value))
    .map((filter) => clean(filter.value));
}

function widgetScopeLabel(widget, dashboardScope) {
  const selectedDepartments = widgetDepartments(widget);
  if (selectedDepartments.length === 1) return `Alcance: ${selectedDepartments[0]}`;
  if (selectedDepartments.length > 1) return `Alcance: ${selectedDepartments.length} departamentos seleccionados`;
  const departments = (Array.isArray(widget.filters) ? widget.filters : [])
    .filter((filter) => filter?.field === "departamento" && clean(filter?.value))
    .map((filter) => clean(filter.value));
  if (departments.length) return `Alcance: ${departments.join(" · ")}`;
  return clean(dashboardScope) ? `Alcance: ${dashboardScope}` : "Alcance: Todos los departamentos autorizados";
}

function widgetScopeMarkup(widget, dashboardScope) {
  const label = widgetScopeLabel(widget, dashboardScope);
  const departments = widgetDepartments(widget);
  if (departments.length < 2) {
    return `<span class="ixtla-dashboard-card__scope" title="${escapeHtml(label)}">${escapeHtml(label)}</span>`;
  }
  const items = departments.map((department) => `<li>${escapeHtml(department)}</li>`).join("");
  return `<details class="ixtla-dashboard-card__scope-details"><summary class="ixtla-dashboard-card__scope"><span>${escapeHtml(label)}</span><b>Ver lista</b></summary><ul>${items}</ul></details>`;
}

function widgetPeriodLabel(widget) {
  return PERIOD_LABELS[clean(widget?.period)] || PERIOD_LABELS.all;
}

function widgetUpdatedLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Datos locales";
  return `Actualizado: ${date.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}`;
}

function analyticsPlan(widget) {
  return {
    kind: widget.chart,
    metric: widget.metric,
    dimension: widget.dimension,
    period: widget.period || "all",
    filters: Array.isArray(widget.filters) ? widget.filters : [],
    sort: widget.sort,
    limit: widget.limit,
  };
}

async function fetchAnalytics(widget) {
  const plan = analyticsPlan(widget);
  const key = JSON.stringify(plan);
  if (analyticsCache.has(key)) return analyticsCache.get(key);
  const request = fetch(ANALYTICS_URL, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ plan }),
  }).then(async (response) => {
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || "No fue posible cargar la agregación.");
    return {
      total: Number(payload.total) || 0,
      entries: Array.isArray(payload.items) ? payload.items.map((item) => [clean(item?.label), Number(item?.value) || 0]) : [],
      aggregatedAt: clean(payload.aggregated_at),
    };
  });
  analyticsCache.set(key, request);
  try {
    return await request;
  } catch (error) {
    analyticsCache.delete(key);
    throw error;
  }
}

function markScrollable(card, target, chart, entries) {
  if (scrollStrategy(chart, entries.length) !== "content") return;
  card.classList.add("ixtla-dashboard-card--scrollable");
  target.classList.add("ixtla-dashboard-widget--scrollable");
  target.tabIndex = 0;
  target.setAttribute("aria-label", "Lista de resultados desplazable");
}

function renderWidget(target, widget, entries, total) {
  if (widget.chart !== "kpi" && total === 0) {
    target.innerHTML = `<div class="ixtla-dashboard-state"><strong>No hay requerimientos para este alcance y periodo.</strong><span>Prueba con otro periodo o modifica los departamentos seleccionados.</span></div>`;
    return;
  }
  if (widget.chart === "donut") renderDonut(target, entries, widget);
  else if (widget.chart === "line" || widget.chart === "area") renderLine(target, entries);
  else if (widget.chart === "table") renderTable(target, entries);
  else if (widget.chart === "kpi") renderKpi(target, total, widget);
  else if (widget.chart === "funnel") renderFunnel(target, entries);
  else renderBar(target, entries, widget);
}

async function renderDashboard(dashboard) {
  document.getElementById("ixtla-dashboard-scope").textContent = dashboard.scopeLabel;
  const grid = document.getElementById("ixtla-dashboard-grid");
  grid.replaceChildren();
  const tasks = dashboard.widgets.map(async (widget) => {
    const card = document.createElement("article");
    card.className = `ixtla-dashboard-card ${cardSize(widget.chart)}`;
    card.draggable = true;
    card.dataset.widgetId = widget.id;
    card.innerHTML = `<header class="ixtla-dashboard-card__header"><div><p>${metricLabel(widget)}</p><h2>${escapeHtml(widget.title)}</h2><span class="ixtla-dashboard-card__scope">${escapeHtml(widgetScopeLabel(widget, dashboard.scopeLabel))}</span></div><div class="ixtla-dashboard-card__tools"><button class="ixtla-dashboard-drag" type="button" aria-label="Arrastrar widget" title="Arrastrar widget">&#8281;</button><button class="ixtla-dashboard-remove" type="button" aria-label="Eliminar widget" title="Eliminar widget">&times;</button></div></header><div class="ixtla-dashboard-widget"></div>`;
    card.querySelector(".ixtla-dashboard-card__scope").outerHTML = widgetScopeMarkup(widget, dashboard.scopeLabel);
    const meta = document.createElement("p");
    meta.className = "ixtla-dashboard-card__meta";
    meta.textContent = `Periodo: ${widgetPeriodLabel(widget)} · Cargando datos…`;
    card.querySelector(".ixtla-dashboard-card__header > div").appendChild(meta);
    const target = card.querySelector(".ixtla-dashboard-widget");
    target.setAttribute("aria-busy", "true");
    target.innerHTML = '<p class="ixtla-dashboard-empty-message">Cargando datos autorizados…</p>';
    grid.appendChild(card);
    try {
      const result = await fetchAnalytics(widget);
      meta.textContent = `Periodo: ${widgetPeriodLabel(widget)} · ${widgetUpdatedLabel(result.aggregatedAt)}`;
      markScrollable(card, target, widget.chart, result.entries);
      renderWidget(target, widget, result.entries, result.total);
    } catch (error) {
      console.error("[IxtlaInsightsDashboard]", error);
      if (!Array.isArray(dashboard.rows) || !dashboard.rows.length) {
        meta.textContent = `Periodo: ${widgetPeriodLabel(widget)} · No se pudo actualizar`;
        target.innerHTML = '<div class="ixtla-dashboard-state ixtla-dashboard-state--error"><strong>No fue posible cargar este widget.</strong><span>Intenta actualizar el dashboard o revisa tu conexión.</span></div>';
        target.removeAttribute("aria-busy");
        return;
      }
      const entries = entriesFor(dashboard.rows || [], widget);
      const total = ["promedio_semanal", "tiempo_resolucion"].includes(widget.metric)
        ? 0
        : sourceRows(dashboard.rows || [], widget).length;
      meta.textContent = `Periodo: ${widgetPeriodLabel(widget)} · Datos locales`;
      markScrollable(card, target, widget.chart, entries);
      renderWidget(target, widget, entries, total);
    }
    target.removeAttribute("aria-busy");
  });
  await Promise.all(tasks);
}

document.addEventListener("DOMContentLoaded", () => {
  const dashboardId = new URLSearchParams(window.location.search).get("dashboard");
  let dashboard = loadTemporaryDashboard(dashboardId);
  const empty = document.getElementById("ixtla-dashboard-empty");
  const grid = document.getElementById("ixtla-dashboard-grid");
  const modal = document.getElementById("ixtla-dashboard-modal");

  if (!dashboard) {
    empty.hidden = false;
    document.getElementById("ixtla-dashboard-add").hidden = true;
    document.getElementById("ixtla-dashboard-clear").hidden = true;
    return;
  }

  function refresh(nextDashboard = loadTemporaryDashboard(dashboard.id)) {
    dashboard = nextDashboard;
    if (!dashboard) {
      grid.replaceChildren();
      empty.hidden = false;
      return;
    }
    empty.hidden = dashboard.widgets.length > 0;
    renderDashboard(dashboard);
    document.dispatchEvent(new CustomEvent("ixtla-insights:context", { detail: getInsightsContext() }));
  }

  function getInsightsContext() {
    return {
      domain: "requerimientos",
      scopeLabel: dashboard.scopeLabel,
      rows: dashboard.rows || [],
    };
  }

  window.IxtlaInsightsDashboard = {
    getContext: getInsightsContext,
    addVisualization({ question, context, spec }) {
      const next = addVisualizationToTemporaryDashboard(dashboard.id, { question, context, spec });
      refresh(next);
      return next;
    },
  };
  document.dispatchEvent(new CustomEvent("ixtla-insights:dashboard-ready", { detail: window.IxtlaInsightsDashboard }));

  function openModal() {
    const catalog = document.getElementById("ixtla-dashboard-catalog");
    catalog.replaceChildren();
    let currentSection = "";
    getWidgetCatalog().forEach((widget) => {
      if (widget.section && widget.section !== currentSection) {
        currentSection = widget.section;
        const heading = document.createElement("h3");
        heading.className = "ixtla-dashboard-catalog__section";
        heading.textContent = currentSection;
        catalog.appendChild(heading);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = `<strong>${escapeHtml(widget.title)}</strong><span>${escapeHtml(widget.chart)} · ${escapeHtml(widget.metric)}</span>`;
      button.addEventListener("click", () => {
        refresh(addTemporaryWidget(dashboard.id, widget));
        modal.hidden = true;
      });
      catalog.appendChild(button);
    });
    modal.hidden = false;
  }

  let draggedId = null;
  grid.addEventListener("dragstart", (event) => {
    const card = event.target.closest(".ixtla-dashboard-card");
    if (!card) return;
    draggedId = card.dataset.widgetId;
    card.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
  });
  grid.addEventListener("dragover", (event) => {
    event.preventDefault();
    const card = event.target.closest(".ixtla-dashboard-card");
    grid.querySelectorAll(".is-drag-over").forEach((item) => item.classList.remove("is-drag-over"));
    if (card && card.dataset.widgetId !== draggedId) card.classList.add("is-drag-over");
  });
  grid.addEventListener("drop", (event) => {
    event.preventDefault();
    const target = event.target.closest(".ixtla-dashboard-card");
    if (draggedId && target) refresh(moveTemporaryWidget(dashboard.id, draggedId, target.dataset.widgetId));
  });
  grid.addEventListener("dragend", () => {
    draggedId = null;
    grid.querySelectorAll(".is-dragging, .is-drag-over").forEach((item) => item.classList.remove("is-dragging", "is-drag-over"));
  });
  grid.addEventListener("click", (event) => {
    const remove = event.target.closest(".ixtla-dashboard-remove");
    if (!remove) return;
    const card = remove.closest(".ixtla-dashboard-card");
    refresh(removeTemporaryWidget(dashboard.id, card.dataset.widgetId));
  });

  document.getElementById("ixtla-dashboard-add").addEventListener("click", openModal);
  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-ixtla-close-modal]")) modal.hidden = true;
  });
  document.getElementById("ixtla-dashboard-clear").addEventListener("click", () => {
    if (!window.confirm("Se eliminaran los widgets temporales de este dashboard. Deseas continuar?")) return;
    clearTemporaryDashboard(dashboard.id);
    grid.replaceChildren();
    empty.hidden = false;
    document.getElementById("ixtla-dashboard-add").hidden = true;
    document.getElementById("ixtla-dashboard-clear").hidden = true;
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") modal.hidden = true; });
  refresh(dashboard);
});

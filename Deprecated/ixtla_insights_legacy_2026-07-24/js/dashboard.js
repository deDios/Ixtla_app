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
const isInsightsDebugEnabled = () => {
  try {
    return new URLSearchParams(window.location.search).get("insights_debug") === "1"
      || window.localStorage.getItem("ixtla_insights_debug") === "1";
  } catch {
    return false;
  }
};
const insightsDebug = (event, detail = {}) => {
  if (isInsightsDebugEnabled()) console.info("[IxtlaInsights debug]", event, detail);
};
const createAnalyticsRequestId = () => typeof globalThis.crypto?.randomUUID === "function"
  ? `ix-dashboard-${globalThis.crypto.randomUUID()}`
  : `ix-dashboard-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

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
  const clientRequestId = createAnalyticsRequestId();
  insightsDebug("analytics.request.started", { requestId: clientRequestId, url: ANALYTICS_URL, kind: plan.kind, metric: plan.metric, dimension: plan.dimension });
  const request = fetch(ANALYTICS_URL, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-Ixtla-Insights-Request-Id": clientRequestId },
    body: JSON.stringify({ plan }),
  }).then(async (response) => {
    const raw = await response.text();
    const payload = (() => { try { return JSON.parse(raw); } catch { return null; } })();
    const responseDebug = {
      requestId: clean(payload?.request_id) || clean(response.headers.get("X-Ixtla-Insights-Request-Id")) || clientRequestId,
      status: response.status,
      responseUrl: clean(response.url),
      contentType: clean(response.headers.get("content-type")),
      endpointHandled: Boolean(response.headers.get("X-Ixtla-Insights-Request-Id")),
      buildId: clean(response.headers.get("X-Ixtla-Insights-Build")),
      serverStage: clean(response.headers.get("X-Ixtla-Insights-Debug-Stage")),
    };
    insightsDebug("analytics.request.completed", responseDebug);
    if (!response.ok || !payload?.ok) {
      const error = new Error(payload?.error || "No fue posible cargar la agregación.");
      error.status = response.status || 0;
      error.requestId = clean(payload?.request_id) || clean(response.headers.get("X-Ixtla-Insights-Request-Id")) || clientRequestId;
      error.errorCode = clean(payload?.error_code);
      error.endpointHandled = Boolean(response.headers.get("X-Ixtla-Insights-Request-Id"));
      error.endpointVersion = clean(response.headers.get("X-Ixtla-Insights-Version"));
      error.buildId = responseDebug.buildId;
      error.serverStage = responseDebug.serverStage;
      throw error;
    }
    return {
      total: Number(payload.total) || 0,
      entries: Array.isArray(payload.items) ? payload.items.map((item) => [clean(item?.label), Number(item?.value) || 0]) : [],
    };
  }).catch((error) => {
    if (!clean(error?.requestId)) error.requestId = clientRequestId;
    throw error;
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
    const period = document.createElement("p");
    period.className = "ixtla-dashboard-card__period";
    period.textContent = `Periodo: ${widgetPeriodLabel(widget)}`;
    card.querySelector(".ixtla-dashboard-card__header > div").appendChild(period);
    const target = card.querySelector(".ixtla-dashboard-widget");
    target.setAttribute("aria-busy", "true");
    target.innerHTML = '<p class="ixtla-dashboard-empty-message">Cargando datos autorizados…</p>';
    grid.appendChild(card);
    try {
      const result = await fetchAnalytics(widget);
      markScrollable(card, target, widget.chart, result.entries);
      renderWidget(target, widget, result.entries, result.total);
    } catch (error) {
      console.error("[IxtlaInsightsDashboard]", {
        status: error?.status,
        errorCode: error?.errorCode,
        requestId: error?.requestId,
        endpointVersion: error?.endpointVersion,
        endpointHandled: error?.endpointHandled,
        detail: error?.message,
      });
      const trace = clean(error?.requestId);
      const diagnostic = trace ? `<span>Código de diagnóstico: ${escapeHtml(trace)}</span>` : "";
      target.innerHTML = `<div class="ixtla-dashboard-state ixtla-dashboard-state--error"><strong>No fue posible cargar este widget.</strong><span>Los resultados se muestran únicamente cuando el servidor puede recalcularlos con tu alcance autorizado.</span>${diagnostic}</div>`;
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

  function refreshAnalytics() {
    analyticsCache.clear();
    refresh(dashboard);
  }

  function scheduleDailyRefresh() {
    const nextDay = new Date();
    nextDay.setHours(24, 0, 5, 0);
    const delay = Math.max(1000, nextDay.getTime() - Date.now());
    window.setTimeout(() => {
      refreshAnalytics();
      scheduleDailyRefresh();
    }, delay);
  }

  function getInsightsContext() {
    return {
      domain: "requerimientos",
      scopeLabel: dashboard.scopeLabel,
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
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshAnalytics();
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") modal.hidden = true; });
  refresh(dashboard);
  scheduleDailyRefresh();
});

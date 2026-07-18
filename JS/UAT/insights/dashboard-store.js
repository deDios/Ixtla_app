const STORAGE_PREFIX = "ixtla-insights:temporary-dashboard:";
const ACTIVE_DASHBOARD_KEY = "ixtla-insights:active-dashboard";

const clean = (value) => String(value ?? "").trim();

function statusOf(row) {
  return clean(row?.estatus?.key ?? row?.estatus_key ?? row?.estatus ?? row?.status).toLowerCase();
}

function createId(prefix) {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function compactRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row?.id ?? null,
    tramite: clean(row?.tramite ?? row?.tipo_tramite ?? row?.categoria) || "Sin tramite",
    estatus: statusOf(row),
    departamento: clean(row?.departamento ?? row?.depto ?? row?.departamento_nombre) || "Sin departamento",
    creado: row?.creado ?? row?.created_at ?? row?.fecha_creacion ?? null,
  }));
}

function normalizeDashboard(raw, id) {
  if (!raw || !Array.isArray(raw.widgets)) return null;
  return {
    id: clean(raw.id) || id,
    version: 2,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
    question: clean(raw.question),
    scopeLabel: clean(raw.scopeLabel) || "Vista autorizada actual",
    widgets: raw.widgets.map((widget) => ({ ...widget, id: clean(widget?.id) || createId("widget") })),
    rows: compactRows(raw.rows),
  };
}

function persistDashboard(dashboard) {
  dashboard.updatedAt = new Date().toISOString();
  localStorage.setItem(`${STORAGE_PREFIX}${dashboard.id}`, JSON.stringify(dashboard));
  localStorage.setItem(ACTIVE_DASHBOARD_KEY, dashboard.id);
  return dashboard;
}

export function buildVisualizationSpec(question, context = {}) {
  const prompt = clean(question).toLocaleLowerCase("es-MX");
  let dimension = /departamento|depto/.test(prompt)
    ? "departamento"
    : /tramite|categor/.test(prompt)
      ? "tramite"
      : "estatus";
  let chart = "bar";
  if (/dona|pastel/.test(prompt)) chart = "donut";
  if (/linea|tendencia|evolucion/.test(prompt)) {
    chart = "line";
    dimension = "fecha";
  }
  if (/tabla|listado/.test(prompt)) chart = "table";
  if (/\bkpi\b|indicador|total de requerimientos/.test(prompt)) chart = "kpi";
  const metric = /finaliz/.test(prompt) ? "finalizados" : "total";

  return {
    id: createId("widget"),
    title: chart === "line"
      ? "Tendencia diaria de requerimientos"
      : metric === "finalizados"
        ? `Finalizados por ${dimension}`
        : `Requerimientos por ${dimension}`,
    chart,
    metric,
    dimension,
    filters: [],
    sort: dimension === "fecha" ? "chronological" : "desc",
    limit: chart === "kpi" ? 1 : 10,
    domain: "requerimientos",
    scopeLabel: clean(context.scopeLabel) || "Vista autorizada actual",
  };
}

export function getWidgetCatalog() {
  return [
    { chart: "kpi", metric: "total", dimension: "estatus", title: "Total de requerimientos", filters: [], sort: "desc", limit: 1 },
    { chart: "bar", metric: "total", dimension: "estatus", title: "Requerimientos por estatus", filters: [], sort: "desc", limit: 10 },
    { chart: "donut", metric: "total", dimension: "estatus", title: "Distribucion por estatus", filters: [], sort: "desc", limit: 10 },
    { chart: "donut", metric: "total", dimension: "departamento", title: "Requerimientos por departamento", filters: [], sort: "desc", limit: 10 },
    { chart: "bar", metric: "total", dimension: "departamento", title: "Carga por departamento", filters: [], sort: "desc", limit: 10 },
    { chart: "line", metric: "total", dimension: "fecha", title: "Tendencia diaria de requerimientos", filters: [], sort: "chronological", limit: 50 },
    { chart: "table", metric: "total", dimension: "tramite", title: "Requerimientos por tramite", filters: [], sort: "desc", limit: 50 },
  ].map((widget) => ({ ...widget, id: createId("widget"), domain: "requerimientos" }));
}

export function loadTemporaryDashboard(id) {
  const dashboardId = clean(id);
  if (!dashboardId) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${dashboardId}`) || "null");
    return normalizeDashboard(parsed, dashboardId);
  } catch {
    return null;
  }
}

export function saveTemporaryDashboard({ question, context, spec }) {
  const activeId = clean(localStorage.getItem(ACTIVE_DASHBOARD_KEY));
  const existing = loadTemporaryDashboard(activeId);
  const dashboard = existing || {
    id: createId("dashboard"),
    version: 2,
    createdAt: new Date().toISOString(),
    question: "",
    scopeLabel: "Vista autorizada actual",
    widgets: [],
    rows: [],
  };

  return appendVisualization(dashboard, { question, context, spec });
}

function appendVisualization(dashboard, { question, context, spec }) {
  dashboard.question = clean(question) || dashboard.question;
  dashboard.scopeLabel = clean(context?.scopeLabel) || dashboard.scopeLabel;
  dashboard.rows = compactRows(context?.rows);
  dashboard.widgets.push({ ...spec, id: clean(spec?.id) || createId("widget") });
  return persistDashboard(dashboard);
}

export function addVisualizationToTemporaryDashboard(id, { question, context, spec }) {
  const dashboard = loadTemporaryDashboard(id);
  if (!dashboard) return null;
  return appendVisualization(dashboard, { question, context, spec });
}

export function addTemporaryWidget(id, widget) {
  const dashboard = loadTemporaryDashboard(id);
  if (!dashboard) return null;
  dashboard.widgets.push({ ...widget, id: createId("widget") });
  return persistDashboard(dashboard);
}

export function removeTemporaryWidget(id, widgetId) {
  const dashboard = loadTemporaryDashboard(id);
  if (!dashboard) return null;
  dashboard.widgets = dashboard.widgets.filter((widget) => widget.id !== widgetId);
  return persistDashboard(dashboard);
}

export function moveTemporaryWidget(id, sourceId, targetId) {
  const dashboard = loadTemporaryDashboard(id);
  if (!dashboard || sourceId === targetId) return dashboard;
  const sourceIndex = dashboard.widgets.findIndex((widget) => widget.id === sourceId);
  const targetIndex = dashboard.widgets.findIndex((widget) => widget.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return dashboard;
  const [source] = dashboard.widgets.splice(sourceIndex, 1);
  dashboard.widgets.splice(targetIndex, 0, source);
  return persistDashboard(dashboard);
}

export function clearTemporaryDashboard(id) {
  const dashboardId = clean(id);
  if (!dashboardId) return;
  localStorage.removeItem(`${STORAGE_PREFIX}${dashboardId}`);
  if (localStorage.getItem(ACTIVE_DASHBOARD_KEY) === dashboardId) localStorage.removeItem(ACTIVE_DASHBOARD_KEY);
}

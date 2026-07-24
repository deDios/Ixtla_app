import { saveTemporaryDashboard } from "/JS/UAT/insights/dashboard-store.js";

const CONTEXT_EVENT = "ixtla-insights:context";
const HISTORY_LIMIT = 6;
const START_ACTIONS = [{
  label: "Crear un gráfico",
  description: "Elige paso a paso qué deseas visualizar.",
  primary: true,
  action: { type: "visualization_start" },
}];
const MEASUREMENT_CHOICES = [
  {
    label: "Total de requerimientos",
    description: "Mide toda la carga dentro del alcance seleccionado.",
    action: { type: "visualization_measurement", metric: "total" },
  },
  {
    label: "Requerimientos abiertos",
    description: "Mide los requerimientos que aún necesitan atención.",
    action: { type: "visualization_measurement", metric: "abiertos" },
  },
  {
    label: "Requerimientos finalizados",
    description: "Mide los requerimientos concluidos.",
    action: { type: "visualization_measurement", metric: "finalizados" },
  },
  {
    label: "Requerimientos pausados/cancelados",
    description: "Revisa casos detenidos o cancelados que requieren seguimiento.",
    action: { type: "visualization_measurement", metric: "pausados_cancelados" },
  },
  {
    label: "Tiempos de resolución",
    description: "Indicador promedio en días de los requerimientos finalizados.",
    action: { type: "visualization_kpi", metric: "tiempo_resolucion" },
  },
  {
    label: "Indicadores clave",
    description: "Agrega KPIs operativos al dashboard.",
    action: { type: "visualization_kpi_kit" },
  },
];
const SEPARATION_CHOICES = [
  { label: "Resumen en un indicador", description: "Un solo valor para el alcance elegido.", action: { type: "visualization_separation", label: "Resumen en un indicador", chart: "kpi", dimension: "estatus" } },
  { label: "Separar por departamento", description: "Compara la carga entre departamentos.", action: { type: "visualization_separation", label: "Separar por departamento", dimension: "departamento" } },
  { label: "Separar por trámite", description: "Identifica los trámites con mayor volumen.", action: { type: "visualization_separation", label: "Separar por trámite", dimension: "tramite" } },
  { label: "Separar por estatus", description: "Muestra solicitud, proceso, pausa y finalización.", action: { type: "visualization_separation", label: "Separar por estatus", dimension: "estatus" } },
  { label: "Separar por fecha", description: "Muestra la evolución y tendencia en el tiempo.", action: { type: "visualization_separation", label: "Separar por fecha", dimension: "fecha" } },
];
const KPI_CHOICES = [
  { label: "Total de requerimientos", description: "Todos los requerimientos del alcance autorizado.", action: { type: "visualization_kpi", metric: "total" } },
  { label: "Requerimientos abiertos", description: "En solicitud, revisión, asignación, proceso o pausa.", action: { type: "visualization_kpi", metric: "abiertos" } },
  { label: "Requerimientos finalizados", description: "Con estatus finalizado.", action: { type: "visualization_kpi", metric: "finalizados" } },
  { label: "Requerimientos pausados/cancelados", description: "Con estatus pausado o cancelado.", action: { type: "visualization_kpi", metric: "pausados_cancelados" } },
  { label: "Promedio semanal", description: "Promedio de requerimientos creados por semana.", action: { type: "visualization_kpi", metric: "promedio_semanal" } },
  { label: "Tiempo de resolución", description: "Promedio de días entre creación y cierre finalizado.", action: { type: "visualization_kpi", metric: "tiempo_resolucion" } },
];
const DEPARTMENT_SCOPE_CHOICES = [
  {
    label: "Todos los departamentos",
    description: "Calcula el resultado con todos los departamentos permitidos por tu alcance.",
    action: { type: "department_scope", scope: "all" },
  },
  {
    label: "Elegir departamentos",
    description: "Selecciona uno o varios departamentos activos de una lista.",
    action: { type: "department_scope", scope: "selected" },
  },
];
const PERIOD_CHOICES = [
  { label: "Últimos 7 días", description: "Incluye hoy y los seis días anteriores.", action: { type: "visualization_period", period: "last_7" } },
  { label: "Últimos 30 días", description: "Incluye hoy y los 29 días anteriores.", action: { type: "visualization_period", period: "last_30" } },
  { label: "Este mes", description: "Desde el primer día del mes actual.", action: { type: "visualization_period", period: "this_month" } },
  { label: "Todo el historial", description: "No limita los requerimientos por fecha.", action: { type: "visualization_period", period: "all" } },
];
const PERIOD_LABELS = {
  last_7: "Últimos 7 días",
  last_30: "Últimos 30 días",
  this_month: "Este mes",
  all: "Todo el historial",
};
const DIMENSION_LABELS = {
  estatus: "estatus",
  tramite: "trámite",
  departamento: "departamento",
  fecha: "fecha",
};
const CHART_LABELS = {
  bar: "Barras",
  donut: "Pastel",
  line: "Línea",
  area: "Área",
  table: "Tabla",
  kpi: "Indicador",
  funnel: "Embudo",
};
const METRIC_LABELS = {
  total: "Total",
  abiertos: "Abiertos",
  finalizados: "Finalizados",
  pausados_cancelados: "Pausados/cancelados",
  pausados: "Pausados",
  cancelados: "Cancelados",
  cerrados: "Cerrados",
  promedio_semanal: "Promedio semanal",
  tiempo_resolucion: "Tiempo de resolución",
};

function hasFixedStatusMetric(metric) {
  return catalogValues("metric_rules", {}).fixed_status?.includes(clean(metric)) || false;
}

function separationChoices(metric) {
  return SEPARATION_CHOICES.filter((choice) => {
    const action = choice.action || {};
    const supportedDimension = !action.dimension || catalogValues("dimensions", Object.keys(DIMENSION_LABELS)).includes(action.dimension);
    const supportedChart = !action.chart || catalogValues("widget_kinds", Object.keys(CHART_LABELS)).includes(action.chart);
    return supportedDimension && supportedChart && (!hasFixedStatusMetric(metric) || action.chart === "kpi" || action.dimension !== "estatus");
  });
}

function periodChoices() {
  return PERIOD_CHOICES.filter((choice) => catalogValues("periods", Object.keys(PERIOD_LABELS)).includes(choice?.action?.period));
}

function kpiChoices() {
  return KPI_CHOICES.filter((choice) => catalogValues("metrics", Object.keys(METRIC_LABELS)).includes(choice?.action?.metric));
}

const clean = (value) => String(value ?? "").trim();
let serverCatalog = null;
let catalogRequest = null;

function catalogValues(key, fallback = []) {
  return serverCatalog?.[key] ?? fallback;
}

async function ensureCatalog(url) {
  if (serverCatalog) return serverCatalog;
  if (!catalogRequest) {
    catalogRequest = fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload?.catalog?.version) throw new Error("No fue posible cargar el contrato de Insights.");
        serverCatalog = payload.catalog;
        return serverCatalog;
      })
      .catch((error) => { catalogRequest = null; throw error; });
  }
  return catalogRequest;
}

class InsightsRequestError extends Error {
  constructor(status, detail, diagnostic = {}) {
    super(detail);
    this.name = "InsightsRequestError";
    this.status = status;
    Object.assign(this, diagnostic);
  }
}

function createInsightsRequestId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return `ix-web-${globalThis.crypto.randomUUID()}`;
  return `ix-web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function widgetTitle(chart, metric, dimension) {
  const group = DIMENSION_LABELS[dimension] || "estatus";
  if (chart === "kpi" && METRIC_LABELS[metric]) return METRIC_LABELS[metric];
  if (chart === "line") return "Tendencia de requerimientos por fecha";
  if (chart === "area") return "Tendencia acumulada de requerimientos";
  if (chart === "table") return metric === "finalizados" ? `Ranking de finalizados por ${group}` : `Ranking de requerimientos por ${group}`;
  if (chart === "funnel") return "Embudo de requerimientos por estatus";
  return metric === "finalizados" ? `Finalizados por ${group}` : `Requerimientos por ${group}`;
}

export function mountIxtlaInsights(options = {}) {
  if (window.__ixtlaInsightsInstance) return window.__ixtlaInsightsInstance;

  const config = {
    title: "Ixtla Insights",
    subtitle: "Asistente de requerimientos",
    quickQuestions: START_ACTIONS,
    dashboardUrl: "/VIEWS/UAT/insightsDashboard.php",
    apiUrl: "/db/ixtla_insights/chat.php",
    catalogUrl: "/db/ixtla_insights/catalog.php",
    draftUrl: "/db/ixtla_insights/draft.php",
    departmentsUrl: "/db/ixtla_insights/departments.php",
    visualizationHandler: null,
    ...options,
  };
  let context = config.context || window.__ixtlaInsightsContext || null;
  let pendingVisualization = null;
  let draftPersistQueue = Promise.resolve();
  const history = [];

  const root = document.createElement("div");
  root.className = "ixtla-insights";
  root.innerHTML = `
    <button class="ixtla-insights-fab" type="button" aria-label="Abrir ${config.title}"><span class="ixtla-insights-fab__icon" aria-hidden="true">✦</span><span class="ixtla-insights-fab__label">${config.title}</span></button>
    <div class="ixtla-insights-overlay" aria-hidden="true"></div>
    <aside class="ixtla-insights-drawer" aria-label="${config.subtitle}" aria-hidden="true">
      <header class="ixtla-insights-head"><span class="ixtla-insights-head__mark" aria-hidden="true">✦</span><div><h2>${config.title}</h2><p>${config.subtitle}</p></div><button class="ixtla-insights-clear" type="button">Limpiar chat</button><button class="ixtla-insights-close" type="button" aria-label="Cerrar">×</button></header>
      <div class="ixtla-insights-messages" aria-live="polite"></div>
      <div class="ixtla-insights-footer"><div class="ixtla-insights-chips"></div><form class="ixtla-insights-form"><textarea class="ixtla-insights-input" rows="1" placeholder="Pregunta sobre los requerimientos…"></textarea><button class="ixtla-insights-send" type="submit" aria-label="Enviar">↑</button></form></div>
    </aside>`;
  document.body.appendChild(root);

  const fab = root.querySelector(".ixtla-insights-fab");
  const overlay = root.querySelector(".ixtla-insights-overlay");
  const drawer = root.querySelector(".ixtla-insights-drawer");
  const close = root.querySelector(".ixtla-insights-close");
  const clear = root.querySelector(".ixtla-insights-clear");
  const messages = root.querySelector(".ixtla-insights-messages");
  const chips = root.querySelector(".ixtla-insights-chips");
  const form = root.querySelector(".ixtla-insights-form");
  const input = root.querySelector(".ixtla-insights-input");
  const send = root.querySelector(".ixtla-insights-send");

  function addMessage(text, role = "assistant") {
    const item = document.createElement("div");
    item.className = `ixtla-insights-message ixtla-insights-message--${role}`;
    item.textContent = text;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  }

  function renderReport(report) {
    const items = Array.isArray(report?.items) ? report.items : [];
    if (!items.length) return;
    const card = document.createElement("section");
    card.className = "ixtla-insights-report";
    const title = document.createElement("h3");
    title.textContent = clean(report?.title) || "Reporte de requerimientos";
    const meta = document.createElement("p");
    const period = PERIOD_LABELS[clean(report?.period)] || PERIOD_LABELS.all;
    meta.textContent = `${items.length} resultado(s) · ${period}`;
    const list = document.createElement("dl");
    items.slice(0, 12).forEach((item) => {
      const label = clean(item?.label) || "Sin especificar";
      const value = Number(item?.value ?? 0);
      const term = document.createElement("dt");
      term.textContent = label;
      const detail = document.createElement("dd");
      detail.textContent = Number.isFinite(value) ? value.toLocaleString("es-MX", { maximumFractionDigits: 1 }) : "0";
      list.append(term, detail);
    });
    card.append(title, meta, list);
    messages.appendChild(card);
    messages.scrollTop = messages.scrollHeight;
  }

  function renderQuickQuestions(questions) {
    chips.replaceChildren();
    (Array.isArray(questions) ? questions : []).slice(0, 10).forEach((item) => {
      const text = clean(typeof item === "string" ? item : item?.label);
      if (!text) return;
      const chip = document.createElement("button");
      chip.type = "button";
      const isChoice = ["visualization_measurement", "visualization_separation", "department_scope", "visualization_period", "visualization_kpi", "visualization_kpi_kit", "visualization_confirm", "visualization_edit_period", "visualization_edit_scope", "visualization_cancel"].includes(item?.action?.type);
      chip.className = `ixtla-insights-chip${item?.primary ? " ixtla-insights-chip--primary" : ""}${isChoice ? " ixtla-insights-chip--choice" : ""}`;
      const label = document.createElement("span");
      label.className = "ixtla-insights-chip__label";
      label.textContent = text;
      chip.appendChild(label);
      const description = clean(item?.description);
      if (description) {
        const detail = document.createElement("span");
        detail.className = "ixtla-insights-chip__detail";
        detail.textContent = description;
        chip.appendChild(detail);
      }
      chip.addEventListener("click", async () => {
        const action = item && typeof item === "object" ? item.action || {} : {};
        const visualizationAction = ["visualization_start", "visualization_measurement", "visualization_separation", "visualization_kpi_kit", "visualization_kpi", "department_scope", "visualization_period", "visualization_chart", "visualization_dimension", "visualization_metric", "visualization_confirm", "visualization_edit_period", "visualization_edit_scope", "visualization_cancel"].includes(action.type);
        if (visualizationAction) {
          try {
            await ensureCatalog(config.catalogUrl);
          } catch (error) {
            console.error("[IxtlaInsights catalog]", error);
            addMessage("No pude cargar el catálogo autorizado para crear esta visualización. Intenta de nuevo.");
            return;
          }
        }
        if (action.type === "visualization_start") return startGuidedVisualization();
        if (action.type === "visualization_measurement") return chooseVisualizationMeasurement(action.metric);
        if (action.type === "visualization_separation") return chooseVisualizationSeparation(action);
        if (action.type === "visualization_kpi_kit") return startKpiKit();
        if (action.type === "visualization_kpi") return startKpi(action.metric);
        if (action.type === "department_scope") return chooseDepartmentScope(action.scope);
        if (action.type === "visualization_period") return chooseVisualizationPeriod(action.period);
        if (action.type === "visualization_chart") return chooseVisualizationChart(action.chart);
        if (action.type === "visualization_dimension") return chooseVisualizationDimension(action.dimension);
        if (action.type === "visualization_metric") return chooseVisualizationMetric(action.metric);
        if (action.type === "visualization_confirm") return confirmVisualization();
        if (action.type === "visualization_edit_period") return editVisualizationPeriod();
        if (action.type === "visualization_edit_scope") return editVisualizationScope();
        if (action.type === "visualization_cancel") return cancelVisualization();
        ask(clean(item?.prompt || text));
      });
      chips.appendChild(chip);
    });
  }

  function recommendedChart(request = pendingVisualization) {
    if (request?.chart === "kpi" || ["promedio_semanal", "tiempo_resolucion"].includes(request?.metric)) return "kpi";
    if (request?.dimension === "fecha" || request?.goal === "request_trend") return "line";
    if (["departamento", "tramite"].includes(request?.dimension)) return "bar";
    return "bar";
  }

  function chartChoices(goal = "") {
    const charts = pendingVisualization?.dimension === "fecha" || goal === "request_trend"
      ? ["line", "area", "table"]
      : ["bar", "donut", "line", "area", "table", "kpi"];
    const recommended = recommendedChart(pendingVisualization);
    return charts
      .filter((chart) => catalogValues("widget_kinds", Object.keys(CHART_LABELS)).includes(chart))
      .sort((left, right) => Number(right === recommended) - Number(left === recommended)).map((chart) => ({
      label: CHART_LABELS[chart],
      description: chart === recommended ? "Recomendado para esta medición." : "",
      primary: chart === recommended,
      action: { type: "visualization_chart", chart },
    }));
  }

  function dimensionChoices(chart) {
    const dimensions = chart === "line" || chart === "area"
      ? ["fecha"]
      : chart === "funnel"
        ? ["estatus"]
        : ["estatus", "tramite", "departamento", "fecha"];
    const prefix = CHART_LABELS[chart] || "Gráfica";
    return dimensions
      .filter((dimension) => catalogValues("dimensions", Object.keys(DIMENSION_LABELS)).includes(dimension))
      .filter((dimension) => !hasFixedStatusMetric(pendingVisualization?.metric) || dimension !== "estatus")
      .map((dimension) => ({
      label: `${prefix} por ${DIMENSION_LABELS[dimension]}`,
      action: { type: "visualization_dimension", dimension },
      }));
  }

  function metricChoices() {
    const metrics = pendingVisualization?.chart === "kpi"
      ? Object.keys(METRIC_LABELS)
      : ["total", "abiertos", "finalizados", "pausados_cancelados", "cerrados"];
    return metrics
      .filter((metric) => catalogValues("metrics", Object.keys(METRIC_LABELS)).includes(metric))
      .filter((metric) => pendingVisualization?.chart === "kpi" || !catalogValues("metric_rules", {}).kpi_only?.includes(metric))
      .map((metric) => ({
      label: METRIC_LABELS[metric],
      action: { type: "visualization_metric", metric },
    }));
  }

  function remoteWidgetSpec(widget) {
    const chart = clean(widget?.kind || widget?.chart);
    if (!catalogValues("widget_kinds").includes(chart)) return null;
    const metric = catalogValues("metrics").includes(clean(widget?.metric))
      ? clean(widget.metric)
      : "total";
    const dimension = catalogValues("dimensions").includes(clean(widget?.dimension))
      ? clean(widget.dimension)
      : "estatus";
    const period = catalogValues("periods").includes(clean(widget?.period))
      ? clean(widget.period)
      : "";
    const scope = clean(widget?.scope) === "selected" ? "selected" : clean(widget?.scope) === "all" ? "all" : "";
    return {
      id: `remote-widget-${Date.now()}`,
      title: clean(widget?.title) || widgetTitle(chart, metric, dimension),
      chart,
      metric,
      dimension,
      period,
      scope,
      filters: Array.isArray(widget?.filters)
        ? widget.filters.filter((filter) => ["departamento", "tramite", "estatus"].includes(clean(filter?.field)) && clean(filter?.value)).slice(0, 3)
        : [],
      sort: ["desc", "asc", "chronological"].includes(clean(widget?.sort)) ? clean(widget.sort) : (dimension === "fecha" ? "chronological" : "desc"),
      limit: Math.min(50, Math.max(1, Number(widget?.limit) || 10)),
      domain: "requerimientos",
      scopeLabel: clean(widget?.scope_label) || clean(context?.scopeLabel) || "Vista autorizada actual",
    };
  }

  async function addVisualization(question, spec) {
    if (typeof config.visualizationHandler === "function") {
      const result = await config.visualizationHandler({ question, context, spec });
      if (!result) throw new Error("No fue posible agregar el widget al dashboard.");
      addMessage("Listo. Agregué la visualización al dashboard actual.");
      return true;
    }
    const dashboard = saveTemporaryDashboard({ question, context, spec });
    const dashboardUrl = new URL(config.dashboardUrl, window.location.origin);
    dashboardUrl.searchParams.set("dashboard", dashboard.id);
    addMessage("Preparé un dashboard temporal con la visualización solicitada. Lo abrí en una nueva ventana para que conserves esta conversación.");
    window.open(dashboardUrl.toString(), "ixtla-insights-dashboard", "noopener");
    return true;
  }

  function requiresDimension(chart) {
    return chart !== "kpi";
  }

  function continueGuidedVisualization() {
    const request = pendingVisualization;
    if (!request) return;
    if (!request.chart) {
      addMessage("¿Qué formato prefieres para este análisis?");
      renderQuickQuestions(chartChoices(request.goal));
      return;
    }
    if (!requiresDimension(request.chart)) request.dimension = "estatus";
    if (request.chart === "line" || request.chart === "area") request.dimension = "fecha";
    if (request.chart === "funnel") request.dimension = "estatus";
    if (requiresDimension(request.chart) && !request.dimension) {
      addMessage("¿Cómo deseas agrupar los requerimientos?");
      renderQuickQuestions(dimensionChoices(request.chart));
      return;
    }
    if (!request.metric) {
      addMessage("¿Qué métrica deseas visualizar?");
      renderQuickQuestions(metricChoices());
      return;
    }
    finalizeVisualization();
  }

  async function finalizeVisualization() {
    if (!pendingVisualization?.chart || !pendingVisualization?.metric) return;
    const request = pendingVisualization;
    if (request.reviewSpec) return;
    renderQuickQuestions([]);
    const dimension = request.dimension || "estatus";
    const spec = {
      id: `guided-widget-${Date.now()}`,
      title: clean(request.title) || widgetTitle(request.chart, request.metric, dimension),
      chart: request.chart,
      metric: request.metric,
      dimension,
      filters: Array.isArray(request.filters) ? request.filters : [],
      period: PERIOD_LABELS[request.period] ? request.period : "all",
      sort: dimension === "fecha" ? "chronological" : "desc",
      limit: request.chart === "kpi" ? 1 : 10,
      domain: "requerimientos",
      scopeLabel: clean(context?.scopeLabel) || "Vista autorizada actual",
    };
    request.reviewSpec = spec;
    queueDraftPersist();
    showVisualizationReview(request, spec);
    return;

    try {
      await addVisualization(request.question, spec);
      renderQuickQuestions(config.quickQuestions);
    } catch (error) {
      console.error("[IxtlaInsights]", error);
      addMessage("No fue posible agregar la visualización al dashboard. Intenta de nuevo.");
    }
  }

  function visualizationScopeSummary(filters) {
    const departments = (Array.isArray(filters) ? filters : []).filter((filter) => filter?.field === "departamento" && clean(filter?.value));
    if (!departments.length) return "Todos los departamentos autorizados";
    return departments.length === 1 ? clean(departments[0].value) : `${departments.length} departamentos seleccionados`;
  }

  function showVisualizationReview(request, spec) {
    const chart = CHART_LABELS[spec.chart] || spec.chart;
    const metric = METRIC_LABELS[spec.metric] || spec.metric;
    const dimension = DIMENSION_LABELS[spec.dimension] || spec.dimension;
    const period = PERIOD_LABELS[spec.period] || PERIOD_LABELS.all;
    addMessage(`Revisa antes de crear: ${metric} · ${visualizationScopeSummary(spec.filters)} · ${period} · ${chart} por ${dimension}.`);
    renderQuickQuestions([
      { label: "Crear visualización", description: "Agrega el widget al dashboard actual.", primary: true, action: { type: "visualization_confirm" } },
      { label: "Editar periodo", description: period, action: { type: "visualization_edit_period" } },
      { label: "Editar departamentos", description: visualizationScopeSummary(spec.filters), action: { type: "visualization_edit_scope" } },
      { label: "Cancelar", description: "Descarta esta visualización.", action: { type: "visualization_cancel" } },
    ]);
  }

  async function confirmVisualization() {
    const request = pendingVisualization;
    const spec = request?.reviewSpec;
    if (!request || !spec) return;
    pendingVisualization = null;
    discardDraft();
    renderQuickQuestions([]);
    try {
      await addVisualization(request.question, spec);
      renderQuickQuestions(config.quickQuestions);
    } catch (error) {
      console.error("[IxtlaInsights]", error);
      addMessage("No fue posible agregar la visualización al dashboard. Intenta de nuevo.");
      renderQuickQuestions(START_ACTIONS);
    }
  }

  function editVisualizationPeriod() {
    if (!pendingVisualization?.reviewSpec) return;
    addMessage("¿Qué periodo deseas analizar?");
    renderQuickQuestions(periodChoices());
  }

  function editVisualizationScope() {
    if (!pendingVisualization?.reviewSpec) return;
    addMessage("¿Qué departamentos deseas usar?");
    renderQuickQuestions(DEPARTMENT_SCOPE_CHOICES);
  }

  function cancelVisualization() {
    pendingVisualization = null;
    discardDraft();
    addMessage("Visualización cancelada.");
    renderQuickQuestions(START_ACTIONS);
  }

  function chooseVisualizationChart(chart) {
    if (!pendingVisualization || !CHART_LABELS[chart] || !catalogValues("widget_kinds", Object.keys(CHART_LABELS)).includes(chart)) return;
    pendingVisualization.chart = chart;
    queueDraftPersist();
    addMessage(`Tipo de visualización: ${CHART_LABELS[chart]}`, "user");
    continueGuidedVisualization();
  }

  function chooseVisualizationDimension(dimension) {
    if (!pendingVisualization || !DIMENSION_LABELS[dimension] || !catalogValues("dimensions", Object.keys(DIMENSION_LABELS)).includes(dimension)) return;
    if (dimension === "estatus" && hasFixedStatusMetric(pendingVisualization.metric)) return;
    pendingVisualization.dimension = dimension;
    queueDraftPersist();
    addMessage(`Agrupar por ${DIMENSION_LABELS[dimension]}`, "user");
    continueGuidedVisualization();
  }

  function chooseVisualizationMetric(metric) {
    if (!pendingVisualization || !METRIC_LABELS[metric] || !catalogValues("metrics", Object.keys(METRIC_LABELS)).includes(metric)) return;
    pendingVisualization.metric = metric;
    queueDraftPersist();
    addMessage(`Métrica: ${METRIC_LABELS[metric]}`, "user");
    continueGuidedVisualization();
  }

  function beginDepartmentScope(mode, metric = null, state = {}) {
    pendingVisualization = {
      ...state,
      mode,
      metric: metric ?? state.metric ?? "",
      filters: Array.isArray(state.filters) ? state.filters : [],
      period: clean(state.period),
    };
    queueDraftPersist();
    addMessage("¿Para qué departamento o departamentos deseas calcularlo?");
    renderQuickQuestions(DEPARTMENT_SCOPE_CHOICES);
  }

  function startKpiKit() {
    addMessage("Indicadores clave", "user");
    beginDepartmentScope("kpi_kit");
  }

  function startKpi(metric) {
    if (!METRIC_LABELS[metric] || !catalogValues("metrics", Object.keys(METRIC_LABELS)).includes(metric)) return;
    if (pendingVisualization?.mode === "kpi_kit") {
      const filters = Array.isArray(pendingVisualization.filters) ? pendingVisualization.filters : [];
      const period = clean(pendingVisualization.period) || "all";
      pendingVisualization = null;
      addMessage(METRIC_LABELS[metric], "user");
      addKpi(metric, filters, period);
      return;
    }
    addMessage(METRIC_LABELS[metric], "user");
    beginDepartmentScope("single_kpi", metric);
  }

  async function addKpi(metric, filters = [], period = "all") {
    if (!METRIC_LABELS[metric]) return;
    const spec = {
      id: `kpi-widget-${Date.now()}`,
      title: METRIC_LABELS[metric],
      chart: "kpi",
      metric,
      dimension: "estatus",
      filters,
      period: PERIOD_LABELS[period] ? period : "all",
      sort: "desc",
      limit: 1,
      domain: "requerimientos",
      scopeLabel: clean(context?.scopeLabel) || "Vista autorizada actual",
    };
    pendingVisualization = {
      mode: "single_kpi",
      question: `Agregar KPI: ${METRIC_LABELS[metric]}`,
      chart: "kpi",
      metric,
      dimension: "estatus",
      filters,
      period: spec.period,
      title: spec.title,
      reviewSpec: spec,
    };
    queueDraftPersist();
    showVisualizationReview(pendingVisualization, spec);
  }

  function startGuidedVisualization() {
    addMessage("Crear un gráfico", "user");
    beginDepartmentScope("guided");
  }

  function chooseVisualizationMeasurement(metric) {
    if (!pendingVisualization || !METRIC_LABELS[metric] || !catalogValues("metrics", Object.keys(METRIC_LABELS)).includes(metric)) return;
    pendingVisualization.metric = metric;
    pendingVisualization.question = `Crear una visualización de ${METRIC_LABELS[metric].toLocaleLowerCase("es-MX")}`;
    queueDraftPersist();
    addMessage(`Medición: ${METRIC_LABELS[metric]}`, "user");
    if (["promedio_semanal", "tiempo_resolucion"].includes(metric)) {
      pendingVisualization.chart = "kpi";
      pendingVisualization.dimension = "fecha";
      finalizeVisualization();
      return;
    }
    addMessage("¿Cómo deseas separar la información?");
    renderQuickQuestions(separationChoices(metric));
  }

  function chooseVisualizationSeparation(action) {
    if (!pendingVisualization) return;
    const dimension = clean(action?.dimension);
    if (!DIMENSION_LABELS[dimension] || !catalogValues("dimensions", Object.keys(DIMENSION_LABELS)).includes(dimension)) return;
    if (dimension === "estatus" && clean(action?.chart) !== "kpi" && hasFixedStatusMetric(pendingVisualization.metric)) return;
    pendingVisualization.dimension = dimension;
    if (clean(action?.chart) === "kpi") pendingVisualization.chart = "kpi";
    queueDraftPersist();
    addMessage(clean(action?.label) || `Separar por ${DIMENSION_LABELS[dimension]}`, "user");
    continueGuidedVisualization();
  }

  function chooseDepartmentScope(scope) {
    if (!pendingVisualization) return;
    if (scope === "all") {
      pendingVisualization.filters = [];
      queueDraftPersist();
      addMessage("Todos los departamentos autorizados", "user");
      continueAfterDepartmentScope();
      return;
    }
    if (scope === "selected") showDepartmentChecklist();
  }

  function continueAfterDepartmentScope() {
    if (!pendingVisualization) return;
    if (pendingVisualization.reviewSpec) {
      delete pendingVisualization.reviewSpec;
      finalizeVisualization();
      return;
    }
    if (!pendingVisualization.period) {
      addMessage("¿Qué periodo deseas analizar?");
      renderQuickQuestions(periodChoices());
      return;
    }
    continueAfterPeriod();
  }

  function chooseVisualizationPeriod(period) {
    if (!pendingVisualization || !PERIOD_LABELS[period] || !catalogValues("periods", Object.keys(PERIOD_LABELS)).includes(period)) return;
    pendingVisualization.period = period;
    queueDraftPersist();
    addMessage(`Periodo: ${PERIOD_LABELS[period]}`, "user");
    if (pendingVisualization.reviewSpec) {
      delete pendingVisualization.reviewSpec;
      finalizeVisualization();
      return;
    }
    continueAfterPeriod();
  }

  function continueAfterPeriod() {
    if (!pendingVisualization) return;
    if (pendingVisualization.mode === "kpi_kit") {
      addMessage("Elige el indicador que deseas agregar al dashboard.");
      renderQuickQuestions(kpiChoices());
      return;
    }
    if (pendingVisualization.mode === "single_kpi") {
      const { metric, filters, period } = pendingVisualization;
      pendingVisualization = null;
      addKpi(metric, filters, period);
      return;
    }
    if (pendingVisualization.mode === "free_visualization") {
      continueGuidedVisualization();
      return;
    }
    if (pendingVisualization.mode === "remote_visualization") {
      const { question, remoteSpec, filters, period } = pendingVisualization;
      pendingVisualization = {
        ...pendingVisualization,
        mode: "guided",
        question,
        title: remoteSpec.title,
        chart: remoteSpec.chart,
        metric: remoteSpec.metric,
        dimension: remoteSpec.dimension,
        filters,
        period,
      };
      finalizeVisualization();
      return;
    }
    addMessage("¿Qué deseas medir?");
    renderQuickQuestions(MEASUREMENT_CHOICES);
  }

  async function showDepartmentChecklist() {
    if (!config.departmentsUrl) return;
    chips.replaceChildren();
    const loading = document.createElement("p");
    loading.className = "ixtla-insights-department-loading";
    loading.textContent = "Cargando departamentos activos…";
    chips.appendChild(loading);
    try {
      const response = await fetch(config.departmentsUrl, { credentials: "same-origin", headers: { Accept: "application/json" } });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !Array.isArray(payload.departments)) throw new Error("No fue posible cargar los departamentos.");
      renderDepartmentChecklist(payload.departments);
    } catch (error) {
      console.error("[IxtlaInsights]", error);
      addMessage("No pude cargar los departamentos activos. Intenta de nuevo o selecciona todos los departamentos.");
      renderQuickQuestions(DEPARTMENT_SCOPE_CHOICES);
    }
  }

  function renderDepartmentChecklist(departments) {
    chips.replaceChildren();
    const selectedNames = new Set((Array.isArray(pendingVisualization?.filters) ? pendingVisualization.filters : [])
      .filter((filter) => filter?.field === "departamento")
      .map((filter) => clean(filter?.value)));
    const form = document.createElement("fieldset");
    form.className = "ixtla-insights-department-checklist";
    const legend = document.createElement("legend");
    legend.textContent = "Selecciona uno o más departamentos";
    form.appendChild(legend);
    departments.forEach((department) => {
      const name = clean(department?.nombre);
      if (!name) return;
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "ixtla-insights-department";
      input.value = name;
      input.checked = selectedNames.has(name);
      label.append(input, document.createTextNode(name));
      form.appendChild(label);
    });
    const actions = document.createElement("div");
    actions.className = "ixtla-insights-department-actions";
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "Volver";
    back.addEventListener("click", () => renderQuickQuestions(DEPARTMENT_SCOPE_CHOICES));
    const apply = document.createElement("button");
    apply.type = "button";
    apply.textContent = "Usar departamentos seleccionados";
    apply.addEventListener("click", () => {
      const selected = [...form.querySelectorAll('input[name="ixtla-insights-department"]:checked')].map((input) => clean(input.value)).filter(Boolean);
      if (!selected.length) {
        addMessage("Selecciona al menos un departamento o elige todos los departamentos.");
        return;
      }
      pendingVisualization.filters = selected.slice(0, 50).map((value) => ({ field: "departamento", value }));
      queueDraftPersist();
      addMessage(`Departamentos: ${selected.join(", ")}`, "user");
      continueAfterDepartmentScope();
    });
    actions.append(back, apply);
    chips.append(form, actions);
  }

  function startRemoteVisualizationScope(question, spec) {
    const departments = (Array.isArray(spec.filters) ? spec.filters : []).filter((filter) => filter?.field === "departamento" && clean(filter?.value));
    if (spec.scope === "selected" && departments.length) {
      addMessage(`Departamentos: ${departments.map((filter) => clean(filter.value)).join(", ")}`, "user");
      beginDepartmentScope("remote_visualization", null, { question, remoteSpec: spec, filters: spec.filters, period: spec.period });
      continueAfterDepartmentScope();
      return;
    }
    if (spec.scope === "all") {
      addMessage("Todos los departamentos autorizados", "user");
      beginDepartmentScope("remote_visualization", null, { question, remoteSpec: spec, filters: [], period: spec.period });
      continueAfterDepartmentScope();
      return;
    }
    addMessage("Antes de crear la visualización, define su alcance por departamento.");
    beginDepartmentScope("remote_visualization", null, { question, remoteSpec: spec });
  }

  async function requestRemoteAnswer(prompt) {
    const clientRequestId = createInsightsRequestId();
    let response;
    try {
      response = await fetch(config.apiUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Ixtla-Insights-Request-Id": clientRequestId,
        },
        body: JSON.stringify({ question: prompt, history: history.slice(-HISTORY_LIMIT), dashboard_id: clean(config.dashboardId) }),
      });
    } catch {
      throw new InsightsRequestError(0, "No fue posible contactar el servicio Insights.", {
        requestId: clientRequestId,
        url: config.apiUrl,
        endpointHandled: false,
      });
    }
    const raw = await response.text();
    const payload = (() => { try { return JSON.parse(raw); } catch { return null; } })();
    if (!response.ok || !payload?.ok) {
      throw new InsightsRequestError(response.status || 0, clean(payload?.error) || "El servicio Insights no respondió correctamente.", {
        requestId: clean(payload?.request_id) || clean(response.headers.get("X-Ixtla-Insights-Request-Id")) || clientRequestId,
        errorCode: clean(payload?.error_code),
        endpointVersion: clean(response.headers.get("X-Ixtla-Insights-Version")),
        url: clean(response.url) || config.apiUrl,
        contentType: clean(response.headers.get("content-type")),
        endpointHandled: Boolean(response.headers.get("X-Ixtla-Insights-Request-Id")),
      });
    }
    return payload;
  }

  function diagnosticMessage(error) {
    const trace = clean(error?.requestId);
    const suffix = trace ? ` Código de diagnóstico: ${trace}.` : "";
    const status = Number(error?.status || 0);
    if (status === 200 && !clean(error?.contentType).includes("application/json")) {
      return `La solicitud fue redirigida fuera de Insights, normalmente por sesión expirada. Actualiza la página e inicia sesión nuevamente.${suffix}`;
    }
    if (status === 401 || status === 403) return `Tu sesión o permisos cambiaron. Actualiza la página e inicia sesión nuevamente si es necesario.${suffix}`;
    if (status === 404) {
      return error?.endpointHandled
        ? `Insights respondió 404 desde la aplicación. Revisa los logs con el código de diagnóstico.${suffix}`
        : `La solicitud no llegó al endpoint actual de Insights; puede existir un proxy, caché o despliegue mezclado.${suffix}`;
    }
    if (status === 422) return `No se pudo validar la consulta solicitada. Ajusta los datos indicados y vuelve a intentarlo.${suffix}`;
    if (status === 429) return `Insights está recibiendo demasiadas solicitudes. Espera un momento y vuelve a intentarlo.${suffix}`;
    if (status === 502) return `El proveedor de IA no pudo procesar esta consulta. Puedes reintentar sin perder tu contexto.${suffix}`;
    if (status === 503) return `Insights no está disponible temporalmente; puede ser la base de datos, configuración o un servicio dependiente.${suffix}`;
    if (status === 0) return `No fue posible contactar Insights. Revisa conectividad, proxy o disponibilidad del servidor.${suffix}`;
    return `No se pudo completar la consulta (${status || "sin estado"}).${suffix}`;
  }

  function setContext(next) { context = next && typeof next === "object" ? next : null; }
  function open() { drawer.classList.add("is-open"); overlay.classList.add("is-open"); drawer.setAttribute("aria-hidden", "false"); input.focus(); }
  function closeDrawer() { drawer.classList.remove("is-open"); overlay.classList.remove("is-open"); drawer.setAttribute("aria-hidden", "true"); }

  async function ask(question) {
    const prompt = clean(question);
    if (!prompt) return;
    addMessage(prompt, "user");
    input.value = "";
    send.disabled = true;
    try {
      await ensureCatalog(config.catalogUrl);
      const payload = await requestRemoteAnswer(prompt);
      const answer = clean(payload.answer) || "No pude generar una respuesta para esa consulta.";
      addMessage(answer);
      renderReport(payload.report);
      history.push({ role: "user", content: prompt }, { role: "assistant", content: answer });
      const suggestions = Array.isArray(payload.suggestions)
        ? payload.suggestions.map((suggestion) => clean(suggestion)).filter(Boolean).slice(0, 5)
        : [];
      renderQuickQuestions(suggestions.length ? suggestions : config.quickQuestions);
      const action = Array.isArray(payload.actions) ? payload.actions.find((item) => item?.type === "widget_preview") : null;
      const spec = remoteWidgetSpec(action?.widget);
      if (spec) startRemoteVisualizationScope(prompt, spec);
    } catch (error) {
      console.error("[IxtlaInsights]", error instanceof InsightsRequestError ? {
        status: error.status,
        errorCode: error.errorCode,
        requestId: error.requestId,
        endpointVersion: error.endpointVersion,
        endpointHandled: error.endpointHandled,
        url: error.url,
        contentType: error.contentType,
        detail: error.message,
      } : error);
      if (error instanceof InsightsRequestError) {
        addMessage(diagnosticMessage(error), "assistant");
      } else {
        addMessage("No fue posible analizar los requerimientos. Intenta de nuevo.");
      }
    } finally {
      send.disabled = false;
      input.focus();
    }
  }

  async function persistDraft() {
    if (!pendingVisualization) return;
    const response = await fetch(config.draftUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ action: "save", draft: pendingVisualization }),
    });
    if (!response.ok) throw new Error("No fue posible guardar el borrador.");
  }

  function queueDraftPersist() {
    draftPersistQueue = draftPersistQueue
      .then(() => persistDraft())
      .catch((error) => console.warn("[IxtlaInsights draft]", error));
  }

  function discardDraft() {
    draftPersistQueue = draftPersistQueue
      .then(() => fetch(config.draftUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      }))
      .catch(() => {});
  }

  renderQuickQuestions(config.quickQuestions);
  fab.addEventListener("click", open);
  close.addEventListener("click", closeDrawer);
  clear.addEventListener("click", () => { messages.replaceChildren(); history.length = 0; pendingVisualization = null; discardDraft(); renderQuickQuestions(config.quickQuestions); });
  overlay.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDrawer(); });
  document.addEventListener(CONTEXT_EVENT, (event) => setContext(event.detail));
  form.addEventListener("submit", (event) => { event.preventDefault(); ask(input.value); });

  addMessage("Hola. Usa “Crear un gráfico” para armar una visualización paso a paso, o escribe una consulta específica.");
  fetch(config.draftUrl, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ action: "get" }) })
    .then((response) => response.json())
    .then((payload) => {
      if (!payload?.ok || !payload.draft?.mode) return;
      pendingVisualization = payload.draft;
      addMessage("Recuperé tu borrador de visualización.");
      continueAfterDepartmentScope();
    }).catch(() => {});
  const api = { open, close: closeDrawer, ask, setContext };
  window.__ixtlaInsightsInstance = api;
  window.IxtlaInsights = api;
  return api;
}

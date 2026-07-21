import { Session } from "/JS/UAT/auth/session.js";
import { saveTemporaryDashboard } from "/JS/UAT/insights/dashboard-store.js";

const CONTEXT_EVENT = "ixtla-insights:context";
const HISTORY_LIMIT = 6;
const START_ACTIONS = [{
  label: "Crear un gráfico",
  description: "Elige paso a paso qué deseas visualizar.",
  primary: true,
  action: { type: "visualization_start" },
}];
const ANALYSIS_CHOICES = [
  {
    label: "Requerimientos por departamento",
    description: "Compara la carga entre departamentos autorizados.",
    action: { type: "visualization_goal", goal: "department_requests", dimension: "departamento", label: "Requerimientos por departamento" },
  },
  {
    label: "Estado de requerimientos",
    description: "Consulta abiertos, finalizados y otros estatus.",
    action: { type: "visualization_goal", goal: "status_requests", dimension: "estatus", label: "Estado de requerimientos" },
  },
  {
    label: "Requerimientos por trámite",
    description: "Identifica los trámites con mayor carga.",
    action: { type: "visualization_goal", goal: "procedure_requests", dimension: "tramite", label: "Requerimientos por trámite" },
  },
  {
    label: "Tendencia de requerimientos",
    description: "Visualiza la evolución por fecha.",
    action: { type: "visualization_goal", goal: "request_trend", dimension: "fecha", label: "Tendencia de requerimientos" },
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
const KPI_CHOICES = [
  { label: "Total de requerimientos", description: "Todos los requerimientos del alcance autorizado.", action: { type: "visualization_kpi", metric: "total" } },
  { label: "Requerimientos abiertos", description: "En solicitud, revisión, asignación, proceso o pausa.", action: { type: "visualization_kpi", metric: "abiertos" } },
  { label: "Requerimientos finalizados", description: "Con estatus finalizado.", action: { type: "visualization_kpi", metric: "finalizados" } },
  { label: "Requerimientos pausados", description: "Con estatus pausado.", action: { type: "visualization_kpi", metric: "pausados" } },
  { label: "Requerimientos cancelados", description: "Con estatus cancelado.", action: { type: "visualization_kpi", metric: "cancelados" } },
  { label: "Promedio semanal", description: "Promedio de requerimientos creados por semana.", action: { type: "visualization_kpi", metric: "promedio_semanal" } },
  { label: "Tiempo de resolución", description: "Promedio de días entre creación y cierre finalizado.", action: { type: "visualization_kpi", metric: "tiempo_resolucion" } },
];
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
  pausados: "Pausados",
  cancelados: "Cancelados",
  cerrados: "Cerrados",
  promedio_semanal: "Promedio semanal",
  tiempo_resolucion: "Tiempo de resolución",
};

const clean = (value) => String(value ?? "").trim();

class InsightsRequestError extends Error {
  constructor(status, detail) {
    super(detail);
    this.name = "InsightsRequestError";
    this.status = status;
  }
}

function statusOf(row) {
  return clean(row?.estatus?.key ?? row?.estatus_key ?? row?.estatus ?? row?.status).toLowerCase();
}

function countBy(rows, getKey) {
  return rows.reduce((counts, row) => {
    const key = clean(getKey(row)) || "Sin especificar";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function answerFromContext(question, context) {
  const rows = Array.isArray(context?.rows) ? context.rows : [];
  if (!rows.length) return "Aún no hay requerimientos disponibles en la vista actual. Espera a que termine de cargar o ajusta los filtros.";

  const status = countBy(rows, statusOf);
  const finalizados = status.finalizado || 0;
  const cancelados = status.cancelado || 0;
  const pausados = status.pausado || 0;
  const abiertos = rows.length - finalizados - cancelados;
  const tramites = countBy(rows, (row) => row?.tramite ?? row?.tipo_tramite ?? row?.categoria);
  const topTramite = Object.entries(tramites).sort((left, right) => right[1] - left[1])[0];
  const text = clean(question).toLocaleLowerCase("es-MX");
  const scope = clean(context?.scopeLabel) || "la vista actual autorizada";

  if (/finaliz/.test(text)) return `Hay ${finalizados} requerimiento(s) finalizado(s) en ${scope}.`;
  if (/cancel/.test(text)) return `Hay ${cancelados} requerimiento(s) cancelado(s) en ${scope}.`;
  if (/paus/.test(text)) return `Hay ${pausados} requerimiento(s) pausado(s) en ${scope}.`;
  if (/trámite|tramite|pendient|mayor|más carga|mas carga/.test(text) && topTramite) {
    return `El trámite con mayor carga visible es “${topTramite[0]}”, con ${topTramite[1]} requerimiento(s). Hay ${abiertos} abierto(s) en total.`;
  }
  return `En ${scope} hay ${rows.length} requerimiento(s): ${abiertos} abierto(s), ${finalizados} finalizado(s), ${pausados} pausado(s) y ${cancelados} cancelado(s).`;
}

function chartFromQuestion(question) {
  const text = clean(question).toLocaleLowerCase("es-MX");
  if (/(tiempo.*resol|resol.*tiempo|promedio semanal)/.test(text)) return "kpi";
  if (/dona|pastel/.test(text)) return "donut";
  if (/embudo/.test(text)) return "funnel";
  if (/área|area/.test(text)) return "area";
  if (/barras?/.test(text)) return "bar";
  if (/línea|linea|tendencia|evolución|evolucion/.test(text)) return "line";
  if (/tabla|listado/.test(text)) return "table";
  if (/\bkpi\b|indicador/.test(text)) return "kpi";
  return "";
}

function dimensionFromQuestion(question) {
  const text = clean(question).toLocaleLowerCase("es-MX");
  if (/departamento|departamentos|depto/.test(text)) return "departamento";
  if (/trámite|tramite|categor/.test(text)) return "tramite";
  if (/fecha|día|dia|seman|mes|tendencia|evolución|evolucion/.test(text)) return "fecha";
  if (/estatus|estado/.test(text)) return "estatus";
  return "";
}

function metricFromQuestion(question) {
  const text = clean(question).toLocaleLowerCase("es-MX");
  if (/(tiempo.*resol|resol.*tiempo)/.test(text)) return "tiempo_resolucion";
  if (/promedio semanal/.test(text)) return "promedio_semanal";
  if (/cancel/.test(text)) return "cancelados";
  if (/paus/.test(text)) return "pausados";
  if (/cerrad/.test(text)) return "cerrados";
  if (/finaliz/.test(text)) return "finalizados";
  if (/abiert|pendient/.test(text)) return "abiertos";
  if (/total/.test(text)) return "total";
  return "";
}

function isContextQuestion(question) {
  return /finaliz|cancel|paus|trámite|tramite|pendient|mayor|más carga|mas carga|resume|carga actual|cuántos|cuantos/i.test(question);
}

function isVisualizationRequest(question) {
  return /graf|visualiz|ranking|\btop\b|compar|listado|tabla|indicador|\bkpi\b|embudo|promedio semanal|tiempo.*resol|resol.*tiempo/i.test(question);
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
    analyticsUrl: "/db/ixtla_insights/analytics.php",
    visualizationHandler: null,
    answer: null,
    ...options,
  };
  let context = config.context || window.__ixtlaInsightsContext || null;
  let pendingVisualization = null;
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

  function renderQuickQuestions(questions) {
    chips.replaceChildren();
    (Array.isArray(questions) ? questions : []).slice(0, 6).forEach((item) => {
      const text = clean(typeof item === "string" ? item : item?.label);
      if (!text) return;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `ixtla-insights-chip${item?.primary ? " ixtla-insights-chip--primary" : ""}${item?.action?.type === "visualization_goal" ? " ixtla-insights-chip--choice" : ""}`;
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
      chip.addEventListener("click", () => {
        const action = item && typeof item === "object" ? item.action || {} : {};
        if (action.type === "visualization_start") return startGuidedVisualization();
        if (action.type === "visualization_goal") return chooseVisualizationGoal(action);
        if (action.type === "visualization_kpi_kit") return startKpiKit();
        if (action.type === "visualization_kpi") return addKpi(action.metric);
        if (action.type === "visualization_chart") return chooseVisualizationChart(action.chart);
        if (action.type === "visualization_dimension") return chooseVisualizationDimension(action.dimension);
        if (action.type === "visualization_metric") return chooseVisualizationMetric(action.metric);
        ask(clean(item?.prompt || text));
      });
      chips.appendChild(chip);
    });
  }

  function chartChoices(goal = "") {
    const charts = goal === "request_trend"
      ? ["line", "area", "table"]
      : ["bar", "donut", "line", "area", "table", "kpi"];
    return charts.map((chart) => ({
      label: CHART_LABELS[chart],
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
    return dimensions.map((dimension) => ({
      label: `${prefix} por ${DIMENSION_LABELS[dimension]}`,
      action: { type: "visualization_dimension", dimension },
    }));
  }

  function metricChoices() {
    const metrics = pendingVisualization?.chart === "kpi"
      ? Object.keys(METRIC_LABELS)
      : ["total", "abiertos", "finalizados", "pausados", "cancelados", "cerrados"];
    return metrics.map((metric) => ({
      label: METRIC_LABELS[metric],
      action: { type: "visualization_metric", metric },
    }));
  }

  function remoteWidgetSpec(widget) {
    const chart = clean(widget?.kind || widget?.chart);
    if (!new Set(["kpi", "bar", "donut", "line", "area", "table", "funnel"]).has(chart)) return null;
    const metric = ["total", "abiertos", "finalizados", "pausados", "cancelados", "cerrados", "promedio_semanal", "tiempo_resolucion"].includes(clean(widget?.metric))
      ? clean(widget.metric)
      : "total";
    const dimension = ["estatus", "tramite", "departamento", "fecha"].includes(clean(widget?.dimension))
      ? clean(widget.dimension)
      : "estatus";
    return {
      id: `remote-widget-${Date.now()}`,
      title: clean(widget?.title) || widgetTitle(chart, metric, dimension),
      chart,
      metric,
      dimension,
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
    if ((!Array.isArray(context?.rows) || !context.rows.length) && !config.analyticsUrl) {
      addMessage("La visualización está lista, pero no hay requerimientos visibles para representarla.");
      return false;
    }
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
    pendingVisualization = null;
    renderQuickQuestions([]);
    const dimension = request.dimension || "estatus";
    const spec = {
      id: `guided-widget-${Date.now()}`,
      title: widgetTitle(request.chart, request.metric, dimension),
      chart: request.chart,
      metric: request.metric,
      dimension,
      filters: [],
      sort: dimension === "fecha" ? "chronological" : "desc",
      limit: request.chart === "kpi" ? 1 : 10,
      domain: "requerimientos",
      scopeLabel: clean(context?.scopeLabel) || "Vista autorizada actual",
    };
    try {
      await addVisualization(request.question, spec);
      renderQuickQuestions(config.quickQuestions);
    } catch (error) {
      console.error("[IxtlaInsights]", error);
      addMessage("No fue posible agregar la visualización al dashboard. Intenta de nuevo.");
    }
  }

  function chooseVisualizationChart(chart) {
    if (!pendingVisualization || !CHART_LABELS[chart]) return;
    pendingVisualization.chart = chart;
    addMessage(`Tipo de visualización: ${CHART_LABELS[chart]}`, "user");
    continueGuidedVisualization();
  }

  function chooseVisualizationDimension(dimension) {
    if (!pendingVisualization || !DIMENSION_LABELS[dimension]) return;
    pendingVisualization.dimension = dimension;
    addMessage(`Agrupar por ${DIMENSION_LABELS[dimension]}`, "user");
    continueGuidedVisualization();
  }

  function chooseVisualizationMetric(metric) {
    if (!pendingVisualization || !METRIC_LABELS[metric]) return;
    pendingVisualization.metric = metric;
    addMessage(`Métrica: ${METRIC_LABELS[metric]}`, "user");
    continueGuidedVisualization();
  }

  function startKpiKit() {
    pendingVisualization = null;
    addMessage("Indicadores clave", "user");
    addMessage("Elige el indicador que deseas agregar al dashboard.");
    renderQuickQuestions(KPI_CHOICES);
  }

  async function addKpi(metric) {
    if (!METRIC_LABELS[metric]) return;
    const spec = {
      id: `kpi-widget-${Date.now()}`,
      title: METRIC_LABELS[metric],
      chart: "kpi",
      metric,
      dimension: "estatus",
      filters: [],
      sort: "desc",
      limit: 1,
      domain: "requerimientos",
      scopeLabel: clean(context?.scopeLabel) || "Vista autorizada actual",
    };
    addMessage(METRIC_LABELS[metric], "user");
    renderQuickQuestions([]);
    try {
      await addVisualization(`Agregar KPI: ${METRIC_LABELS[metric]}`, spec);
      renderQuickQuestions(START_ACTIONS);
    } catch (error) {
      console.error("[IxtlaInsights]", error);
      addMessage("No fue posible agregar el indicador al dashboard. Intenta de nuevo.");
      renderQuickQuestions(KPI_CHOICES);
    }
  }

  function startGuidedVisualization() {
    pendingVisualization = null;
    addMessage("Crear un gráfico", "user");
    addMessage("¿Qué deseas analizar?");
    renderQuickQuestions(ANALYSIS_CHOICES);
  }

  function chooseVisualizationGoal(action) {
    const dimension = clean(action?.dimension);
    if (!DIMENSION_LABELS[dimension]) return;
    pendingVisualization = {
      chart: "",
      dimension,
      metric: "",
      goal: clean(action.goal),
      question: `Crear una visualización de ${clean(action?.label) || DIMENSION_LABELS[dimension]}`,
    };
    addMessage(clean(action?.label) || `Requerimientos por ${DIMENSION_LABELS[dimension]}`, "user");
    continueGuidedVisualization();
  }

  function beginVisualization(question) {
    const chart = chartFromQuestion(question);
    if (!chart && !isVisualizationRequest(question)) return false;
    pendingVisualization = {
      chart,
      dimension: dimensionFromQuestion(question),
      metric: metricFromQuestion(question),
      question,
    };
    continueGuidedVisualization();
    return true;
  }

  async function requestRemoteAnswer(prompt) {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ question: prompt, history: history.slice(-HISTORY_LIMIT), dashboard_id: clean(config.dashboardId) }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw new InsightsRequestError(response.status || 0, clean(payload?.error) || "El servicio Insights no respondió correctamente.");
    }
    return payload;
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
      if (beginVisualization(prompt)) return;
      if (isContextQuestion(prompt)) {
        addMessage(answerFromContext(prompt, context));
        renderQuickQuestions(config.quickQuestions);
        return;
      }
      if (config.apiUrl) {
        const payload = await requestRemoteAnswer(prompt);
        const answer = clean(payload.answer) || "No pude generar una respuesta para esa consulta.";
        addMessage(answer);
        history.push({ role: "user", content: prompt }, { role: "assistant", content: answer });
        renderQuickQuestions(config.quickQuestions);
        const action = Array.isArray(payload.actions) ? payload.actions.find((item) => item?.type === "widget_preview") : null;
        const spec = remoteWidgetSpec(action?.widget);
        if (spec) await addVisualization(prompt, spec);
        return;
      }
      const response = config.answer
        ? await config.answer({ question: prompt, context, session: Session.get() })
        : answerFromContext(prompt, context);
      addMessage(clean(response) || "No pude generar una respuesta para esa consulta.");
    } catch (error) {
      console.error("[IxtlaInsights]", error);
      if (error instanceof InsightsRequestError) {
        const code = error.status ? `Error ${error.status}` : "Error de servicio";
        addMessage(`${code}: ${clean(error.message)}.`, "assistant");
      } else {
        addMessage("No fue posible analizar los requerimientos. Intenta de nuevo.");
      }
    } finally {
      send.disabled = false;
      input.focus();
    }
  }

  renderQuickQuestions(config.quickQuestions);
  fab.addEventListener("click", open);
  close.addEventListener("click", closeDrawer);
  clear.addEventListener("click", () => { messages.replaceChildren(); history.length = 0; pendingVisualization = null; renderQuickQuestions(config.quickQuestions); });
  overlay.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDrawer(); });
  document.addEventListener(CONTEXT_EVENT, (event) => setContext(event.detail));
  form.addEventListener("submit", (event) => { event.preventDefault(); ask(input.value); });

  addMessage("Hola. Usa “Crear un gráfico” para armar una visualización paso a paso, o escribe una consulta específica.");
  const api = { open, close: closeDrawer, ask, setContext };
  window.__ixtlaInsightsInstance = api;
  window.IxtlaInsights = api;
  return api;
}

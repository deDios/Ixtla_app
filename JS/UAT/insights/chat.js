const DASHBOARD_STORAGE_KEY = "ixtla_insights_dashboard_session_v1";

function readTemporaryDashboardWidgets() {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(DASHBOARD_STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter((item) => item?.spec && item?.preview).slice(0, 24) : [];
  } catch {
    return [];
  }
}

function writeTemporaryDashboardWidgets(widgets) {
  try {
    window.sessionStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(widgets.slice(0, 24)));
    return true;
  } catch {
    return false;
  }
}

function saveTemporaryDashboard(widget) {
  const widgets = readTemporaryDashboardWidgets();
  widgets.push(widget);
  return writeTemporaryDashboardWidgets(widgets) ? { id: "session" } : null;
}

const CONTEXT_EVENT = "ixtla-insights:context";
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
const START_ACTIONS = [{
  label: "Crear un gráfico",
  description: "Cuéntame qué necesitas o elige una opción.",
  primary: true,
  action: { type: "visualization_start" },
}, {
  label: "Explorar visualizaciones",
  description: "Descubre qué formato te ayuda a responder cada pregunta.",
  action: { type: "visualization_explore" },
}];
const VISUALIZATION_EXPLORER = [
  { label: "Comparar categorías", description: "Barras para comparar departamentos, trámites o estatus.", prompt: "Crea una gráfica de barras para comparar el total de requerimientos por trámite." },
  { label: "Ver evolución", description: "Una o varias líneas para entender cambios en el tiempo.", action: { type: "visualization_explorer_format", chart: "line" } },
  { label: "Entender proporciones", description: "Pastel para pocas categorías que forman un total.", prompt: "Crea una gráfica de pastel con la proporción de requerimientos por estatus." },
  { label: "Cruzar dos categorías", description: "Matriz para consultar cada combinación con valores exactos.", action: { type: "visualization_explorer_format", chart: "matrix" } },
  { label: "Consultar valores exactos", description: "Tabla ordenada para revisar categorías y cantidades.", prompt: "Crea una tabla con el total de requerimientos por trámite." },
  { label: "Resumir un dato", description: "Indicador para destacar una cifra principal.", prompt: "Crea un indicador con el total de requerimientos." },
];
const LINE_SERIES_CHOICES = [
  { label: "Una línea con el total", description: "Muestra la evolución general sin separar categorías.", action: { type: "visualization_line_series", series_dimension: "" } },
  { label: "Una línea por departamento", description: "Compara la evolución de cada departamento.", action: { type: "visualization_line_series", series_dimension: "departamento" } },
  { label: "Una línea por estatus", description: "Compara cómo cambia cada estatus.", action: { type: "visualization_line_series", series_dimension: "estatus" } },
  { label: "Una línea por tipo de requerimiento", description: "Compara la evolución de los principales trámites.", action: { type: "visualization_line_series", series_dimension: "tramite" } },
];
const MATRIX_PAIR_CHOICES = [
  { label: "Departamentos × estatus", description: "Filas por departamento y columnas por estatus.", action: { type: "visualization_matrix_pair", dimension: "departamento", series_dimension: "estatus" } },
  { label: "Departamentos × trámites", description: "Filas por departamento y columnas por tipo de requerimiento.", action: { type: "visualization_matrix_pair", dimension: "departamento", series_dimension: "tramite" } },
  { label: "Trámites × estatus", description: "Filas por trámite y columnas por estatus.", action: { type: "visualization_matrix_pair", dimension: "tramite", series_dimension: "estatus" } },
];
const VISUALIZATION_TOPICS = [
  { label: "Carga y pendientes", description: "Compara trámites o departamentos por volumen.", action: { type: "visualization_preset", preset: "workload" } },
  { label: "Tendencia en el tiempo", description: "Muestra cómo cambia la demanda por fecha.", action: { type: "visualization_preset", preset: "trend" } },
  { label: "Estatus de requerimientos", description: "Compara solicitud, proceso, pausa y finalización.", action: { type: "visualization_preset", preset: "status" } },
  { label: "Retroalimentaciones", description: "Visualiza calificaciones y respuesta ciudadana.", action: { type: "visualization_preset", preset: "feedback" } },
  { label: "Indicadores clave", description: "Prepara tarjetas KPI con los principales valores.", action: { type: "visualization_preset", preset: "kpis" } },
];
const VISUALIZATION_PRESETS = {
  workload: { domain: "requerimientos", metric: "abiertos", dimension: "tramite", chart: "bar", title: "Requerimientos pendientes por trámite" },
  trend: { domain: "requerimientos", metric: "total", dimension: "fecha", chart: "line", title: "Tendencia de requerimientos" },
  status: { domain: "requerimientos", metric: "total", dimension: "estatus", chart: "bar", title: "Requerimientos por estatus" },
  feedback: { domain: "retroalimentaciones", metric: "retro_total", dimension: "calificacion", chart: "bar", title: "Retroalimentaciones por calificación" },
  kpis: { domain: "requerimientos", metric: "total", dimension: "estatus", chart: "kpi", title: "Indicadores clave" },
};
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
  calificacion: "calificación",
  estado_retro: "estado de respuesta",
};
const CHART_LABELS = {
  bar: "Barras",
  donut: "Pastel",
  line: "Línea",
  area: "Área",
  table: "Tabla",
  matrix: "Matriz",
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
  retro_total: "Retroalimentaciones",
  tasa_respuesta: "Tasa de respuesta",
  promedio_calificacion: "Promedio de calificación",
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
    catalogRequest = fetchInsightsJson(url)
      .then((payload) => {
        if (!payload?.catalog?.version) throw new Error("No fue posible cargar el contrato de Insights.");
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

function insightsResponseError(response, payload, url, clientRequestId) {
  const contentType = clean(response.headers.get("content-type"));
  const endpointHandled = Boolean(response.headers.get("X-Ixtla-Insights-Request-Id"));
  const requestId = clean(payload?.request_id) || clean(response.headers.get("X-Ixtla-Insights-Request-Id")) || clientRequestId;
  let detail = clean(payload?.error);
  if (!detail && response.status === 404 && !endpointHandled) detail = "El endpoint no existe en la publicación actual de UAT.";
  else if (!detail && (response.status === 401 || response.redirected || (response.status === 200 && !contentType.includes("application/json")))) detail = "Tu sesión terminó. Recarga la página para continuar.";
  else if (!detail && !contentType.includes("application/json")) detail = `El endpoint devolvió una respuesta no JSON (${response.status || "sin estado"}).`;
  else if (!detail) detail = `El endpoint respondió sin el contrato esperado (${response.status || "sin estado"}).`;
  return new InsightsRequestError(response.status || 0, detail, {
    requestId,
    errorCode: clean(payload?.error_code),
    endpointVersion: clean(response.headers.get("X-Ixtla-Insights-Version")),
    buildId: clean(response.headers.get("X-Ixtla-Insights-Build")),
    instanceId: clean(response.headers.get("X-Ixtla-Insights-Instance")),
    serverStage: clean(response.headers.get("X-Ixtla-Insights-Debug-Stage")),
    url: clean(response.url) || url,
    contentType,
    endpointHandled,
    redirected: response.redirected,
  });
}

async function fetchInsightsJson(url, options = {}) {
  const clientRequestId = clean(options.requestId) || createInsightsRequestId();
  const { requestId: _requestId, ...fetchOptions } = options;
  const headers = new Headers(options.headers || {});
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  headers.set("X-Ixtla-Insights-Request-Id", clientRequestId);
  let response;
  try {
    response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...fetchOptions, headers });
  } catch {
    throw new InsightsRequestError(0, "No fue posible contactar el endpoint de Insights.", {
      requestId: clientRequestId, url, endpointHandled: false, contentType: "",
    });
  }
  const raw = await response.text();
  const payload = (() => { try { return JSON.parse(raw); } catch { return null; } })();
  if (!response.ok || !payload || payload.ok !== true) {
    throw insightsResponseError(response, payload, url, clientRequestId);
  }
  return payload;
}

function widgetTitle(chart, metric, dimension, domain = "requerimientos", seriesDimension = "") {
  const group = DIMENSION_LABELS[dimension] || "estatus";
  const seriesGroup = DIMENSION_LABELS[seriesDimension] || "serie";
  const requirementSubjects = {
    total: "Requerimientos",
    abiertos: "Requerimientos abiertos",
    finalizados: "Requerimientos finalizados",
    pausados_cancelados: "Requerimientos pausados o cancelados",
    pausados: "Requerimientos pausados",
    cancelados: "Requerimientos cancelados",
    cerrados: "Requerimientos cerrados",
  };
  const subject = domain === "retroalimentaciones"
    ? (METRIC_LABELS[metric] || "Retroalimentaciones")
    : (requirementSubjects[metric] || "Requerimientos");
  if (chart === "kpi") return subject;
  if (chart === "matrix") return `Matriz de ${subject.toLocaleLowerCase("es-MX")} por ${group} y ${seriesGroup}`;
  if (domain === "retroalimentaciones") {
    if (dimension === "fecha") return `Tendencia de ${subject.toLocaleLowerCase("es-MX")}`;
    return `${subject} por ${group}`;
  }
  if (dimension === "fecha") return `Tendencia de ${subject.toLocaleLowerCase("es-MX")}${seriesDimension ? ` por ${seriesGroup}` : ""}`;
  if (chart === "funnel") return "Embudo de requerimientos por estatus";
  return `${subject} por ${group}`;
}

function visualizationRecommendation(spec) {
  const group = DIMENSION_LABELS[spec.dimension] || "categoría";
  if (spec.chart === "kpi") return "Usé un indicador porque resume el valor principal de forma directa.";
  if (spec.chart === "matrix") return `Usé una matriz porque permite cruzar ${group} con ${DIMENSION_LABELS[spec.series_dimension] || "otra dimensión"} y consultar valores exactos.`;
  if (spec.chart === "line") return spec.series_dimension
    ? `Usé varias líneas para comparar cómo cambia cada ${DIMENSION_LABELS[spec.series_dimension] || "serie"} a través del tiempo.`
    : "Usé una línea porque permite seguir con claridad los cambios a través del tiempo.";
  if (spec.chart === "area") return "Usé un área porque permite ver la evolución y la magnitud a través del tiempo.";
  if (spec.chart === "donut") return `Usé un gráfico de pastel para mostrar qué proporción representa cada ${group}.`;
  if (spec.chart === "table") return `Usé una tabla para que puedas consultar los valores exactos por ${group}.`;
  return `Usé barras porque facilita comparar los valores entre cada ${group}.`;
}

function normalizeVisualizationSpec(spec = {}) {
  const normalized = { ...spec };
  const originalChart = clean(normalized.chart);
  const originalDimension = clean(normalized.dimension);
  normalized.domain = normalized.domain === "retroalimentaciones" ? "retroalimentaciones" : "requerimientos";
  normalized.dimension = clean(normalized.dimension) || (normalized.domain === "retroalimentaciones" ? "calificacion" : "tramite");
  normalized.chart = originalChart || (normalized.dimension === "fecha" ? "line" : "bar");
  normalized.series_dimension = clean(normalized.series_dimension);
  normalized.date_grain = ["day", "week", "month"].includes(clean(normalized.date_grain))
    ? clean(normalized.date_grain)
    : (normalized.period === "all" ? "month" : "day");
  normalized.series_limit = Math.min(7, Math.max(1, Number(normalized.series_limit) || 5));
  if (normalized.domain !== "requerimientos" && normalized.chart === "matrix") normalized.chart = "bar";
  if (["tasa_respuesta", "promedio_calificacion"].includes(normalized.metric)) normalized.chart = "kpi";
  if (normalized.dimension === "fecha" && normalized.chart === "donut") normalized.chart = "line";
  if (normalized.domain === "requerimientos" && normalized.dimension !== "fecha" && ["line", "area"].includes(normalized.chart)) {
    if (!normalized.series_dimension) normalized.series_dimension = normalized.dimension;
    normalized.dimension = "fecha";
  }
  if (normalized.chart === "matrix") {
    if (normalized.dimension === "fecha") normalized.dimension = "departamento";
    if (!normalized.series_dimension || normalized.series_dimension === normalized.dimension) normalized.series_dimension = normalized.dimension === "estatus" ? "departamento" : "estatus";
  } else if (!["line", "area"].includes(normalized.chart)) normalized.series_dimension = "";
  if (normalized.domain !== "requerimientos") normalized.series_dimension = "";
  normalized.title = widgetTitle(normalized.chart, normalized.metric, normalized.dimension, normalized.domain, normalized.series_dimension);
  normalized.compatibilityAdjusted = Boolean(normalized.compatibilityAdjusted || (originalChart && originalChart !== normalized.chart) || (originalDimension && originalDimension !== normalized.dimension));
  return normalized;
}

export function mountIxtlaInsights(options = {}) {
  if (window.__ixtlaInsightsInstance) return window.__ixtlaInsightsInstance;

  const config = {
    title: "Ixtla Insights",
    subtitle: "Asistente de requerimientos",
    quickQuestions: [
      {
        label: "Diagnóstico del mes",
        description: "Estatus y trámites con mayor carga.",
        prompt: "Elabora un diagnóstico operativo de este mes: total de requerimientos, desglose por estatus y los cinco trámites con mayor volumen. Usa sólo datos reales de mi alcance autorizado.",
        primary: true,
      },
      {
        label: "Pendientes +30 días",
        prompt: "Muéstrame los 10 requerimientos activos con más de 30 días, incluyendo ID, trámite, antigüedad, estatus y responsable, dentro de mi alcance autorizado.",
      },
      {
        label: "Tendencia 30 días",
        prompt: "Analiza la tendencia diaria de requerimientos creados durante los últimos 30 días dentro de mi alcance autorizado e indica si la carga aumentó, disminuyó o se mantuvo estable.",
      },
      {
        label: "Trámites con más carga",
        prompt: "¿Cuáles son los cinco trámites con mayor volumen de requerimientos este mes dentro de mi alcance autorizado? No inventes cifras.",
      },
      {
        label: "Resumen de retros",
        prompt: "Dame un resumen de las retroalimentaciones dentro de mi alcance autorizado: total, contestadas, no contestadas, caducadas, inhabilitadas, tasa de respuesta y promedio de calificación.",
      },
      {
        label: "¿Qué puedo consultar?",
        prompt: "¿Qué tipos de reportes y datos puedo consultar dentro de mi alcance autorizado? Dame ejemplos breves.",
      },
    ],
    dashboardUrl: "/VIEWS/UAT/insightsDashboard.php",
    apiUrl: "/db/UAT/ixtla_insights/gpt_probe.php",
    welcomeUrl: "/db/UAT/ixtla_insights/welcome_report.php",
    catalogUrl: "/db/UAT/ixtla_insights/catalog.php",
    draftUrl: "/db/UAT/ixtla_insights/draft.php",
    departmentsUrl: "/db/UAT/ixtla_insights/departments.php",
    exportUrl: "/db/UAT/ixtla_insights/query_export.php",
    previewUrl: "/db/UAT/ixtla_insights/dataset_preview.php",
    visualizationPlanUrl: "/db/UAT/ixtla_insights/plan_visualization.php",
    simpleMode: true,
    visualizationHandler: null,
    ...options,
  };
  let context = config.context || window.__ixtlaInsightsContext || null;
  let pendingVisualization = null;
  let lastVisualizationSpec = null;
  const dashboardQueue = readTemporaryDashboardWidgets();
  let draftPersistQueue = Promise.resolve();
  const history = [];
  let lastResultQuery = null;

  const root = document.createElement("div");
  root.className = "ixtla-insights";
  root.innerHTML = `
    <button class="ixtla-insights-fab" type="button" aria-label="Abrir ${config.title}"><span class="ixtla-insights-fab__icon" aria-hidden="true">✦</span><span class="ixtla-insights-fab__label">${config.title}</span></button>
    <div class="ixtla-insights-overlay" aria-hidden="true"></div>
    <aside class="ixtla-insights-drawer" aria-label="${config.subtitle}" aria-hidden="true">
      <header class="ixtla-insights-head"><span class="ixtla-insights-head__mark" aria-hidden="true">✦</span><div><h2>${config.title}</h2><p>${config.subtitle}</p></div><a class="ixtla-insights-dashboard" href="${config.dashboardUrl}">Dashboard</a><button class="ixtla-insights-clear" type="button">Limpiar chat</button><button class="ixtla-insights-close" type="button" aria-label="Cerrar">×</button></header>
      <div class="ixtla-insights-messages" aria-live="polite"></div>
      <div class="ixtla-insights-footer"><div class="ixtla-insights-chips"><div class="ixtla-insights-chips__primary"></div><div class="ixtla-insights-chips__scroller" role="region" aria-label="Preguntas y acciones rápidas" tabindex="0"></div><div class="ixtla-insights-chips__custom"></div></div><form class="ixtla-insights-form"><textarea class="ixtla-insights-input" rows="1" placeholder="Pregunta por datos o pide una gráfica…"></textarea><button class="ixtla-insights-send" type="submit" aria-label="Enviar">↑</button></form></div>
    </aside>`;
  document.body.appendChild(root);

  const fab = root.querySelector(".ixtla-insights-fab");
  const overlay = root.querySelector(".ixtla-insights-overlay");
  const drawer = root.querySelector(".ixtla-insights-drawer");
  const close = root.querySelector(".ixtla-insights-close");
  const clear = root.querySelector(".ixtla-insights-clear");
  const messages = root.querySelector(".ixtla-insights-messages");
  const primaryChips = root.querySelector(".ixtla-insights-chips__primary");
  const secondaryChips = root.querySelector(".ixtla-insights-chips__scroller");
  const customChips = root.querySelector(".ixtla-insights-chips__custom");
  secondaryChips.addEventListener("wheel", (event) => {
    if (secondaryChips.scrollWidth <= secondaryChips.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    secondaryChips.scrollLeft += event.deltaY;
  }, { passive: false });
  secondaryChips.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    secondaryChips.scrollBy({ left: event.key === "ArrowLeft" ? -180 : 180, behavior: "smooth" });
  });
  const form = root.querySelector(".ixtla-insights-form");
  const input = root.querySelector(".ixtla-insights-input");
  const send = root.querySelector(".ixtla-insights-send");
  input.setAttribute("aria-label", "Mensaje para Ixtla Insights");
  input.title = "Enter para enviar; Ctrl+Enter o Shift+Enter para agregar una línea";

  function appendInlineMarkdown(target, value) {
    const text = String(value ?? "");
    const pattern = /(\*\*([^*]+)\*\*|\*([^*\n]+)\*|`([^`]+)`)/g;
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index > cursor) target.append(document.createTextNode(text.slice(cursor, match.index)));
      const element = document.createElement(match[2] !== undefined ? "strong" : match[3] !== undefined ? "em" : "code");
      element.textContent = match[2] ?? match[3] ?? match[4] ?? "";
      target.append(element);
      cursor = match.index + match[0].length;
    }
    if (cursor < text.length) target.append(document.createTextNode(text.slice(cursor)));
  }

  function markdownTableCells(line) {
    return String(line).trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
  }

  function renderAssistantMarkdown(target, value) {
    const lines = String(value ?? "").replace(/\r\n?/g, "\n").split("\n");
    const fragment = document.createDocumentFragment();
    const isHeading = (line) => /^(#{1,4})\s+/.test(line.trim());
    const isList = (line) => /^\s*(?:[-*•]|\d+\.)\s+/.test(line);
    const isTable = (index) => index + 1 < lines.length
      && lines[index].includes("|")
      && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1]);
    let index = 0;
    while (index < lines.length) {
      const line = lines[index].trim();
      if (!line) { index += 1; continue; }

      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        const level = heading[1].length <= 2 ? 3 : 4;
        const element = document.createElement(`h${level}`);
        if (/recomendaci[oó]n/i.test(heading[2])) element.classList.add("ixtla-insights-markdown__recommendation");
        appendInlineMarkdown(element, heading[2]);
        fragment.append(element);
        index += 1;
        continue;
      }

      if (isTable(index)) {
        const wrapper = document.createElement("div");
        wrapper.className = "ixtla-insights-markdown__table-wrap";
        const table = document.createElement("table");
        const head = document.createElement("thead");
        const headRow = document.createElement("tr");
        markdownTableCells(lines[index]).forEach((cell) => {
          const th = document.createElement("th");
          appendInlineMarkdown(th, cell);
          headRow.append(th);
        });
        head.append(headRow);
        table.append(head);
        index += 2;
        const body = document.createElement("tbody");
        while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
          const row = document.createElement("tr");
          markdownTableCells(lines[index]).forEach((cell) => {
            const td = document.createElement("td");
            appendInlineMarkdown(td, cell);
            row.append(td);
          });
          body.append(row);
          index += 1;
        }
        table.append(body);
        wrapper.append(table);
        fragment.append(wrapper);
        continue;
      }

      if (isList(lines[index])) {
        const ordered = /^\s*\d+\.\s+/.test(lines[index]);
        const list = document.createElement(ordered ? "ol" : "ul");
        while (index < lines.length && isList(lines[index]) && /^\s*\d+\.\s+/.test(lines[index]) === ordered) {
          const item = document.createElement("li");
          appendInlineMarkdown(item, lines[index].replace(/^\s*(?:[-*•]|\d+\.)\s+/, ""));
          list.append(item);
          index += 1;
        }
        fragment.append(list);
        continue;
      }

      const paragraphLines = [];
      while (index < lines.length && lines[index].trim() && !isHeading(lines[index]) && !isList(lines[index]) && !isTable(index)) {
        paragraphLines.push(lines[index].trim());
        index += 1;
      }
      const paragraph = document.createElement("p");
      const paragraphText = paragraphLines.join(" ");
      if (/b[uú]squeda.+parcial|lista.+parcial|m[aá]s resultados/i.test(paragraphText)) {
        paragraph.className = "ixtla-insights-markdown__notice";
      }
      appendInlineMarkdown(paragraph, paragraphText);
      fragment.append(paragraph);
    }
    target.replaceChildren(fragment);
  }

  function addMessage(text, role = "assistant") {
    const item = document.createElement("div");
    item.className = `ixtla-insights-message ixtla-insights-message--${role}`;
    if (role === "assistant") {
      item.classList.add("ixtla-insights-markdown");
      renderAssistantMarkdown(item, text);
    } else {
      item.textContent = text;
    }
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  }

  /**
   * Muestra una señal efímera mientras el endpoint consulta el modelo y sus
   * herramientas. No forma parte del historial ni se conserva como respuesta.
   */
  function showThinkingIndicator(initialLabel = "") {
    const item = document.createElement("div");
    item.className = "ixtla-insights-message ixtla-insights-message--thinking";
    item.setAttribute("role", "status");
    item.setAttribute("aria-live", "polite");

    const label = document.createElement("span");
    label.className = "ixtla-insights-thinking__label";
    const dots = document.createElement("span");
    dots.className = "ixtla-insights-thinking__dots";
    dots.setAttribute("aria-hidden", "true");
    dots.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
    item.append(label, dots);
    messages.appendChild(item);

    const stages = clean(initialLabel) ? [
      clean(initialLabel),
      "Validando métricas y dimensiones…",
      "Organizando la propuesta…",
    ] : [
      "Analizando tu consulta…",
      "Consultando datos autorizados…",
      "Preparando una respuesta clara…",
    ];
    const update = (text) => {
      label.textContent = text;
      messages.scrollTop = messages.scrollHeight;
    };
    update(clean(initialLabel) || stages[0]);
    const timers = [
      window.setTimeout(() => update(stages[1]), 1200),
      window.setTimeout(() => update(stages[2]), 4200),
    ];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      item.remove();
    };
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

  function reportEvidenceLabel(resultQuery) {
    const total = Number(resultQuery?.total_matching);
    const returned = Number(resultQuery?.returned);
    if (Number.isFinite(total) && total >= 0) {
      if (Number.isFinite(returned) && returned >= 0 && returned < total) {
        return `Datos consultados: ${total.toLocaleString("es-MX")} resultado(s); la lista mostrada puede ser parcial.`;
      }
      return `Datos consultados: ${total.toLocaleString("es-MX")} resultado(s) dentro de tu alcance autorizado.`;
    }
    return "Datos consultados dentro de tu alcance autorizado.";
  }

  function renderReportEvidence(resultQuery) {
    if (!resultQuery || typeof resultQuery !== "object") return;
    const details = document.createElement("details");
    details.className = "ixtla-insights-evidence";
    const summary = document.createElement("summary");
    summary.textContent = "Ver datos y alcance de esta respuesta";
    const body = document.createElement("p");
    body.textContent = reportEvidenceLabel(resultQuery);
    details.append(summary, body);
    messages.appendChild(details);
    messages.scrollTop = messages.scrollHeight;
  }

  function reportFollowUps(prompt, resultQuery) {
    const text = normalizedVisualizationText(prompt);
    const followUps = [];
    const isTrend = /\b(tendencia|evolucion|dia|semana|mes)\b/.test(text);
    const isRanking = /\b(mayor|mas|ranking|top|carga)\b/.test(text);
    const isDetail = /\b(folio|detalle|listado|requerimiento)\b/.test(text);
    followUps.push({
      label: "Convertir este reporte en gráfica",
      description: "Usa el mismo contexto; podrás elegir el formato.",
      primary: true,
      prompt: `Crea una gráfica a partir del reporte anterior. Conserva el mismo periodo y filtros${isTrend ? "; muestra la tendencia en el tiempo" : ""}.`,
    });
    if (!isTrend) followUps.push({ label: "Ver tendencia", prompt: "Muestra la tendencia del resultado anterior por fecha. Conserva exactamente los mismos filtros, alcance y periodo." });
    if (!isRanking) followUps.push({ label: "Ver principales causas", prompt: "Desglosa el resultado anterior por trámite para identificar los principales contribuyentes." });
    if (!isDetail && resultQuery?.query_id) followUps.push({ label: "Ver casos relacionados", prompt: "Muéstrame los requerimientos relacionados con el resultado anterior, dentro del mismo alcance." });
    followUps.push({ label: "Comparar con periodo anterior", prompt: "Compara el resultado anterior con el periodo equivalente previo y explica solamente las diferencias respaldadas por los datos." });
    return followUps.slice(0, 4);
  }

  function renderQuickQuestions(questions) {
    primaryChips.replaceChildren();
    secondaryChips.replaceChildren();
    customChips.replaceChildren();
    secondaryChips.scrollLeft = 0;
    (Array.isArray(questions) ? questions : []).slice(0, 10).forEach((item) => {
      const text = clean(typeof item === "string" ? item : item?.label);
      if (!text) return;
      const chip = document.createElement("button");
      chip.type = "button";
      const isChoice = ["visualization_preset", "visualization_measurement", "visualization_separation", "department_scope", "visualization_period", "visualization_kpi", "visualization_kpi_kit", "visualization_confirm", "visualization_change_chart", "visualization_edit_period", "visualization_edit_scope", "visualization_explore", "visualization_explorer_format", "visualization_line_series", "visualization_matrix_pair", "visualization_cancel"].includes(item?.action?.type);
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
        if (action.type === "visualization_cancel") return cancelVisualization();
        const visualizationAction = ["visualization_start", "visualization_preset", "visualization_measurement", "visualization_separation", "visualization_kpi_kit", "visualization_kpi", "department_scope", "visualization_period", "visualization_chart", "visualization_dimension", "visualization_metric", "visualization_confirm", "visualization_change_chart", "visualization_edit_period", "visualization_edit_scope", "visualization_explore", "visualization_explorer_format", "visualization_line_series", "visualization_matrix_pair"].includes(action.type);
        if (visualizationAction) {
          try {
            if (!config.simpleMode) await ensureCatalog(config.catalogUrl);
          } catch (error) {
            console.error("[IxtlaInsights catalog]", error);
            addMessage("No pude cargar el catálogo autorizado para crear esta visualización. Intenta de nuevo.");
            return;
          }
        }
        if (action.type === "visualization_start") return startGuidedVisualization();
        if (action.type === "visualization_explore") return exploreVisualizationTypes();
        if (action.type === "visualization_explorer_format") return chooseExplorerFormat(action.chart);
        if (action.type === "visualization_line_series") return chooseLineSeries(action.series_dimension);
        if (action.type === "visualization_matrix_pair") return chooseMatrixPair(action.dimension, action.series_dimension);
        if (action.type === "visualization_preset") return chooseVisualizationPreset(action.preset);
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
        if (action.type === "visualization_change_chart") return changeVisualizationChart();
        if (action.type === "visualization_edit_period") return editVisualizationPeriod();
        if (action.type === "visualization_edit_scope") return editVisualizationScope();
        ask(clean(item?.prompt || text));
      });
      (item?.primary ? primaryChips : secondaryChips).appendChild(chip);
    });
  }

  function renderMainMenu() {
    renderQuickQuestions([...START_ACTIONS, ...config.quickQuestions]);
  }

  // Las decisiones del recorrido pertenecen a la conversación. El menú del
  // pie permanece estable y no pierde sus accesos originales.
  function renderConversationQuestions(questions) {
    renderQuickQuestions(Array.isArray(questions) ? questions : []);
    const group = document.createElement("div");
    group.className = "ixtla-insights-conversation-choices";
    [...primaryChips.children, ...secondaryChips.children].forEach((button) => group.append(button));
    if (group.childElementCount) {
      group.addEventListener("click", (event) => {
        if (!event.target.closest("button")) return;
        group.classList.add("is-resolved");
        window.setTimeout(() => group.querySelectorAll("button").forEach((button) => { button.disabled = true; }), 0);
      });
      messages.append(group);
      messages.scrollTop = messages.scrollHeight;
    }
    renderMainMenu();
  }

  function renderWorkflowQuestions(questions) {
    const cancel = {
      label: "Cancelar creación",
      description: "Descarta este gráfico y vuelve a las consultas.",
      action: { type: "visualization_cancel" },
    };
    renderConversationQuestions([...(Array.isArray(questions) ? questions : []), cancel]);
  }

  function isVisualizationCancellationIntent(value) {
    if (!pendingVisualization) return false;
    const text = clean(value).toLocaleLowerCase("es-MX").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (/\b(olvida|olvidar|descarta|descartar)\b/.test(text)) return true;
    const cancellation = /\b(cancela|cancelar|deten|detener|abandona|abandonar)\b/.test(text);
    const visualization = /\b(grafico|grafica|visualizacion|widget|creacion|proceso)\b/.test(text);
    const stop = /\b(no quiero|ya no|no continuar)\b/.test(text);
    return (cancellation && visualization) || (stop && visualization);
  }

  function normalizedVisualizationText(value) {
    return clean(value).toLocaleLowerCase("es-MX").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function visualizationIntent(value) {
    const text = normalizedVisualizationText(value);
    // El chat es primero un asistente de reportes. Solo activamos el flujo
    // gráfico cuando la persona lo pide de forma explícita.
    const explicit = /\b(grafica|grafico|visualizacion|chart)\b/.test(text);
    const editsPrevious = Boolean(lastVisualizationSpec)
      && /\b(cambiala|cambialo|hazla|hazlo|ponla|ponlo)\b/.test(text)
      && /\b(este mes|ultim[oa]s? 7 dias|ultim[oa]s? 30 dias|periodo anterior|historial|departamento|tramite|tipo de requerimiento|estatus|status|calificacion)\b/.test(text);
    return explicit || editsPrevious;
  }

  function parseVisualizationRequest(value) {
    const text = normalizedVisualizationText(value);
    if (!visualizationIntent(text)) return null;
    const refersToPrevious = /\b(esto|eso|lo anterior|reporte anterior|los mismos datos|mismo periodo|mismos filtros|esta informacion|estos resultados|cambiala|cambialo|hazla|hazlo|ponla|ponlo)\b/.test(text)
      || (Boolean(lastVisualizationSpec) && /\b(ahora|mejor|usa)\b/.test(text));
    let domain = /\b(retro|retros|retroalimentacion|retroalimentaciones|encuesta|encuestas|calificacion|calificaciones|satisfaccion)\b/.test(text)
      ? "retroalimentaciones" : "";
    if (!domain && refersToPrevious && clean(lastResultQuery?.tool).includes("feedback")) domain = "retroalimentaciones";
    if (!domain && /\b(requerimiento|requerimientos|pendiente|pendientes|tramite|tramites|estatus|status|carga)\b/.test(text)) domain = "requerimientos";

    let chart = "";
    if (/\b(kpi|indicador|indicadores|tarjeta|tarjetas)\b/.test(text)) chart = "kpi";
    else if (/\b(linea|tendencia|evolucion)\b/.test(text)) chart = "line";
    else if (/\b(dona|pastel)\b/.test(text)) chart = "donut";
    else if (/\b(matriz|tabla dinamica|tabla pivot|mapa de calor)\b/.test(text)) chart = "matrix";
    else if (/\b(tabla|listado)\b/.test(text)) chart = "table";
    else if (/\b(barra|barras)\b/.test(text)) chart = "bar";

    let dimension = "";
    if (/\bpor (?:el )?departamento|departamentos\b/.test(text)) dimension = "departamento";
    else if (/\bpor (?:el )?tramite|tramites|tipos? de requerimientos?\b/.test(text)) dimension = "tramite";
    else if (/\bpor (?:el )?(?:estatus|status)|estados? de (?:los )?requerimientos\b/.test(text)) dimension = "estatus";
    else if (/\bcalificacion|calificaciones\b/.test(text)) dimension = "calificacion";
    else if (/\bcontestadas|no contestadas|caducadas|inhabilitadas|estado de respuesta\b/.test(text)) dimension = "estado_retro";
    else if (/\bfecha|dia|dias|semana|semanas|mes|meses|tendencia|evolucion\b/.test(text)) dimension = "fecha";
    const mentionedDimensions = [
      ["departamento", /\bdepartamentos?\b/], ["tramite", /\btramites?|tipos? de requerimientos?\b/], ["estatus", /\bestatus|status|estados? de (?:los )?requerimientos\b/],
    ].map(([name, pattern]) => [name, text.search(pattern)]).filter(([, index]) => index >= 0).sort((left, right) => left[1] - right[1]).map(([name]) => name);
    let seriesDimension = "";
    if (chart === "matrix" && mentionedDimensions.length > 1) {
      dimension = mentionedDimensions[0];
      seriesDimension = mentionedDimensions.find((item) => item !== dimension) || "";
    }

    let metric = "";
    if (domain === "retroalimentaciones") {
      if (/\btasa de respuesta\b/.test(text)) metric = "tasa_respuesta";
      else if (/\bpromedio(?: de)? calificacion\b/.test(text)) metric = "promedio_calificacion";
      else metric = "retro_total";
    } else if (/\bfinalizad[oa]s?|cerrad[oa]s?\b/.test(text)) metric = "finalizados";
    else if (/\bpausad[oa]s?|cancelad[oa]s?\b/.test(text)) metric = "pausados_cancelados";
    else if (/\babiert[oa]s?|activ[oa]s?|pendientes?\b/.test(text)) metric = "abiertos";
    else if (domain === "requerimientos" || refersToPrevious) metric = "total";

    let period = "";
    if (/\beste mes\b/.test(text)) period = "this_month";
    else if (/\bultim[oa]s? 7 dias\b/.test(text)) period = "last_7";
    else if (/\bultim[oa]s? 30 dias\b/.test(text)) period = "last_30";
    else if (/\btodo el historial|historico|todos los datos\b/.test(text)) period = "all";
    if (!period && refersToPrevious) period = clean(lastResultQuery?.filters?.period);
    const comparison = /\b(periodo anterior|contra (?:el )?periodo anterior)\b/.test(text) ? "previous_period" : "";

    return { text, refersToPrevious, domain, chart, dimension, seriesDimension, metric, period, comparison };
  }

  function beginNaturalVisualization(prompt, parsed) {
    const previousSpec = parsed.refersToPrevious && lastVisualizationSpec ? lastVisualizationSpec : null;
    const hasUsefulContext = parsed.refersToPrevious && (lastResultQuery || previousSpec);
    if (!parsed.domain && !hasUsefulContext && !parsed.chart && !parsed.dimension && !parsed.metric) {
      startGuidedVisualization(false);
      return;
    }
    const domain = parsed.domain || clean(previousSpec?.domain) || (clean(lastResultQuery?.tool).includes("feedback") ? "retroalimentaciones" : "requerimientos");
    const metric = parsed.metric || clean(previousSpec?.metric) || (domain === "retroalimentaciones" ? "retro_total" : "total");
    const previousGroup = clean(lastResultQuery?.filters?.group_by);
    const previousDimension = DIMENSION_LABELS[previousGroup] ? previousGroup : previousGroup === "rating" ? "calificacion" : previousGroup === "status" ? (domain === "retroalimentaciones" ? "estado_retro" : "estatus") : "";
    const dimension = parsed.dimension || clean(previousSpec?.dimension) || previousDimension || (parsed.chart === "line" ? "fecha" : domain === "retroalimentaciones" ? "calificacion" : "tramite");
    const chart = parsed.chart || clean(previousSpec?.chart) || (dimension === "fecha" ? "line" : metric === "tasa_respuesta" || metric === "promedio_calificacion" ? "kpi" : "bar");
    pendingVisualization = normalizeVisualizationSpec({
      mode: "natural_visualization",
      question: prompt,
      domain,
      metric,
      dimension,
      series_dimension: parsed.seriesDimension || clean(previousSpec?.series_dimension),
      date_grain: clean(previousSpec?.date_grain),
      series_limit: Number(previousSpec?.series_limit) || 5,
      chart,
      filters: Array.isArray(previousSpec?.filters) ? previousSpec.filters.map((filter) => ({ ...filter })) : (hasUsefulContext && Array.isArray(lastResultQuery?.filters?.filters) ? lastResultQuery.filters.filters : []),
      period: parsed.period || clean(previousSpec?.period),
      comparison: parsed.comparison || clean(previousSpec?.comparison),
    });
    if (pendingVisualization.comparison === "previous_period" && pendingVisualization.period === "all") pendingVisualization.period = "";
    addMessage(`Entendí que quieres visualizar ${METRIC_LABELS[metric]?.toLocaleLowerCase("es-MX") || "los resultados"}. ${visualizationRecommendation(pendingVisualization)}`);
    if (!pendingVisualization.period) {
      addMessage("¿Qué periodo deseas analizar?");
      renderWorkflowQuestions(periodChoices());
      return;
    }
    finalizeVisualization();
  }

  function handlePendingVisualizationText(value) {
    if (!pendingVisualization) return false;
    const text = normalizedVisualizationText(value);
    if (pendingVisualization.mode === "explorer_menu") {
      pendingVisualization = null;
      return false;
    }
    if (pendingVisualization.mode === "topic_selection") {
      if (/\bretro|retroalimentacion|calificacion|satisfaccion\b/.test(text)) chooseVisualizationPreset("feedback", false);
      else if (/\btendencia|tiempo|evolucion\b/.test(text)) chooseVisualizationPreset("trend", false);
      else if (/\bestatus|estado de requerimientos\b/.test(text)) chooseVisualizationPreset("status", false);
      else if (/\bkpi|indicadores?\b/.test(text)) chooseVisualizationPreset("kpis", false);
      else if (/\bcarga|pendientes?|tramites?|departamentos?\b/.test(text)) chooseVisualizationPreset("workload", false);
      else return false;
      return true;
    }
    const period = /\beste mes\b/.test(text) ? "this_month"
      : /\bultim[oa]s? 7 dias\b/.test(text) ? "last_7"
        : /\bultim[oa]s? 30 dias\b/.test(text) ? "last_30"
          : /\btodo el historial|historico|todos los datos\b/.test(text) ? "all" : "";
    if (period) {
      pendingVisualization.period = period;
      if (pendingVisualization.reviewSpec) delete pendingVisualization.reviewSpec;
      continueAfterPeriod();
      return true;
    }
    const chart = /\blinea\b/.test(text) ? "line"
      : /\bdona|pastel\b/.test(text) ? "donut"
        : /\bmatriz|tabla dinamica|tabla pivot|mapa de calor\b/.test(text) ? "matrix"
        : /\btabla\b/.test(text) ? "table"
          : /\bkpi|indicador\b/.test(text) ? "kpi"
            : /\bbarra|barras\b/.test(text) ? "bar" : "";
    if (chart) {
      pendingVisualization.chart = chart;
      if (chart === "line" && !pendingVisualization.dimension) pendingVisualization.dimension = "fecha";
      if (pendingVisualization.reviewSpec) delete pendingVisualization.reviewSpec;
      continueGuidedVisualization();
      return true;
    }
    return false;
  }

  async function requestStructuredVisualizationPlan(question) {
    const payload = await fetchInsightsJson(config.visualizationPlanUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ question, previous_spec: lastVisualizationSpec }),
    });
    if (!payload?.plan) throw new Error("El planificador respondió sin un plan gráfico.");
    return payload.plan;
  }

  function applyStructuredVisualizationPlan(question, plan) {
    if (!plan || plan.intent === "not_visualization") return false;
    const inferredDomain = clean(plan.domain);
    const normalizedQuestion = normalizedVisualizationText(question);
    const hasExplicitRequirementMetric = /\b(abiertos?|activos?|pendientes?|finalizados?|cerrados?|pausados?|cancelados?|tiempo de resolucion|promedio semanal)\b/.test(normalizedQuestion);
    const canUseDefaultTotal = inferredDomain === "requerimientos" && clean(plan.chart) && clean(plan.dimension) && !hasExplicitRequirementMetric;
    if ((inferredDomain && !clean(plan.metric)) || canUseDefaultTotal) {
      plan.metric = inferredDomain === "retroalimentaciones" ? "retro_total" : "total";
      plan.needs_clarification = false;
      if (plan.intent === "clarify") plan.intent = "create";
    }
    if (plan.needs_clarification || plan.intent === "clarify" || !clean(plan.domain)) {
      const hasPartialPlan = Boolean(clean(plan.domain));
      pendingVisualization = hasPartialPlan
        ? { mode: "planner_clarification", question, ...plan }
        : { mode: "topic_selection", filters: [], period: "" };
      addMessage(clean(plan.clarification_question) || "¿Qué te gustaría visualizar?");
      if (!hasPartialPlan) renderWorkflowQuestions(VISUALIZATION_TOPICS);
      else renderConversationQuestions([{ label: "Cancelar", action: { type: "visualization_cancel" } }]);
      return true;
    }
    const domain = clean(plan.domain);
    const metric = clean(plan.metric) || (domain === "retroalimentaciones" ? "retro_total" : "total");
    const dimension = clean(plan.dimension) || (domain === "retroalimentaciones" ? "calificacion" : "tramite");
    const chart = clean(plan.chart) || (dimension === "fecha" ? "line" : "bar");
    pendingVisualization = normalizeVisualizationSpec({
      mode: "structured_visualization",
      question,
      domain,
      metric,
      dimension,
      chart,
      series_dimension: clean(plan.series_dimension),
      date_grain: clean(plan.date_grain),
      series_limit: Math.min(7, Math.max(1, Number(plan.series_limit) || 5)),
      period: clean(plan.period),
      comparison: clean(plan.comparison),
      filters: Array.isArray(plan.filters) ? plan.filters.map((filter) => ({ ...filter })) : [],
      limit: Math.min(50, Math.max(1, Number(plan.limit) || 10)),
      plannerReason: clean(plan.reason),
    });
    const reason = visualizationRecommendation(pendingVisualization);
    addMessage(`Preparé un plan para **${pendingVisualization.title}**. ${reason}`);
    if (!pendingVisualization.period) {
      addMessage("¿Qué periodo deseas analizar?");
      renderWorkflowQuestions(periodChoices());
      return true;
    }
    finalizeVisualization();
    return true;
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
      : ["bar", "donut", "matrix", "table", "kpi"];
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
      : chart === "matrix"
        ? ["estatus", "tramite", "departamento"]
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
    return normalizeVisualizationSpec({
      id: `remote-widget-${Date.now()}`,
      chart,
      metric,
      dimension,
      series_dimension: clean(widget?.series_dimension),
      date_grain: clean(widget?.date_grain),
      series_limit: Math.min(7, Math.max(1, Number(widget?.series_limit) || 5)),
      period,
      scope,
      filters: Array.isArray(widget?.filters)
        ? widget.filters.filter((filter) => ["departamento", "tramite", "estatus"].includes(clean(filter?.field)) && clean(filter?.value)).slice(0, 3)
        : [],
      sort: ["desc", "asc", "chronological"].includes(clean(widget?.sort)) ? clean(widget.sort) : (dimension === "fecha" ? "chronological" : "desc"),
      limit: Math.min(50, Math.max(1, Number(widget?.limit) || 10)),
      domain: "requerimientos",
      scopeLabel: clean(widget?.scope_label) || clean(context?.scopeLabel) || "Vista autorizada actual",
    });
  }

  function previewToolRequest(spec, dateRange = null) {
    const period = dateRange ? "all" : (PERIOD_LABELS[spec.period] ? spec.period : "all");
    const dateFrom = clean(dateRange?.date_from) || null;
    const dateTo = clean(dateRange?.date_to) || null;
    const filters = Array.isArray(spec.filters) ? spec.filters : [];
    const idsFor = (field) => [...new Set(filters
      .filter((filter) => clean(filter?.field) === field && Number.isInteger(Number(filter?.id)))
      .map((filter) => Number(filter.id)))];
    const departmentIds = idsFor("departamento");
    const departmentNames = filters
      .filter((filter) => clean(filter?.field) === "departamento" && !Number.isInteger(Number(filter?.id)))
      .map((filter) => clean(filter?.value)).filter(Boolean);
    const tramiteIds = idsFor("tramite");
    const requirementStatusIds = idsFor("estatus");
    if (spec.domain === "retroalimentaciones") {
      const common = {
        status_ids: idsFor("estado_retro"), rating_ids: idsFor("calificacion"), department_ids: departmentIds, tramite_ids: tramiteIds, requirement_status_ids: requirementStatusIds,
        channel_ids: [], assignee_ids: [], assignee_state: "any", period, date_from: dateFrom, date_to: dateTo,
      };
      if (spec.chart === "kpi" || ["tasa_respuesta", "promedio_calificacion"].includes(spec.metric)) {
        return { tool: "get_feedback_overview", arguments: common };
      }
      const groupMap = { calificacion: "rating", estado_retro: "status", departamento: "department", tramite: "tramite", fecha: "date" };
      return { tool: "aggregate_feedback", arguments: { ...common, group_by: groupMap[spec.dimension] || "rating", limit: spec.dimension === "fecha" ? 50 : (spec.limit || 10) } };
    }
    const groupMap = { estatus: "status", departamento: "department", tramite: "tramite", fecha: "date" };
    const statusMap = { abiertos: [0, 1, 2, 3], finalizados: [6], cerrados: [6], pausados_cancelados: [4, 5], pausados: [4], cancelados: [5] };
    const metricStatusIds = statusMap[spec.metric] || [];
    const requirementCommon = {
      period, department_id: 0, department_ids: departmentIds, department_names: departmentNames, assignee_id: 0, assignee_ids: [],
      tramite_ids: tramiteIds, status_ids: requirementStatusIds.length ? requirementStatusIds : metricStatusIds, channel_ids: [], assignee_state: "any",
      date_field: "created_at", date_from: dateFrom, date_to: dateTo,
    };
    if (spec.chart === "kpi" && !filters.length && !metricStatusIds.length) {
      return { tool: "get_requirements_overview", arguments: { refresh: false, period, date_field: "created_at", date_from: dateFrom, date_to: dateTo } };
    }
    if (spec.series_dimension && ["line", "area", "matrix"].includes(spec.chart)) {
      return {
        tool: "aggregate_requirement_dimensions",
        arguments: {
          ...requirementCommon,
          group_by: groupMap[spec.dimension] || "department",
          series_by: groupMap[spec.series_dimension] || "status",
          date_grain: ["day", "week", "month"].includes(spec.date_grain) ? spec.date_grain : (period === "all" ? "month" : "day"),
          category_limit: spec.dimension === "fecha" ? 50 : Math.min(50, Math.max(1, Number(spec.limit) || 10)),
          series_limit: Math.min(7, Math.max(1, Number(spec.series_limit) || 5)),
          include_other: true,
        },
      };
    }
    return {
      tool: "aggregate_requirements",
      arguments: {
        ...requirementCommon,
        group_by: spec.chart === "kpi" ? "status" : (groupMap[spec.dimension] || "tramite"),
        sort: spec.dimension === "fecha" ? "asc" : (["asc", "desc"].includes(spec.sort) ? spec.sort : "desc"),
        limit: spec.chart === "kpi" ? 7 : (spec.dimension === "fecha" ? 50 : (spec.limit || 10)),
      },
    };
  }

  function normalizePreviewData(spec, data, sourceTool = "") {
    let items = Array.isArray(data?.items) ? data.items.map((item) => ({
      label: clean(item?.label || item?.name || item?.date) || "Sin especificar",
      value: Number(item?.value || 0),
    })) : [];
    let value = null;
    let valueLabel = METRIC_LABELS[spec.metric] || "Total";
    const readableDateBucket = (value) => {
      const raw = clean(value); const match = raw.match(/(\d{4})-(\d{2})(?:-(\d{2}))?/);
      if (!match || spec.dimension !== "fecha") return raw || "Sin especificar";
      const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3] || 1)));
      const formatted = date.toLocaleDateString("es-MX", spec.date_grain === "month"
        ? { month: "short", year: "numeric", timeZone: "UTC" }
        : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
      return raw.startsWith("Semana del ") ? `Semana del ${formatted}` : formatted;
    };
    const categories = Array.isArray(data?.categories) ? data.categories.map((item) => ({
      id: item?.id ?? null, label: readableDateBucket(item?.label), total: Number(item?.total || 0),
    })) : [];
    const series = Array.isArray(data?.series) ? data.series.map((serie) => ({
      id: serie?.id ?? null, label: clean(serie?.label) || "Sin especificar", total: Number(serie?.total || 0),
      values: Array.isArray(serie?.values) ? serie.values.map((item) => Number(item || 0)) : [],
    })) : [];
    if (categories.length) items = categories.map((item) => ({ label: item.label, value: item.total }));
    if (spec.domain === "retroalimentaciones" && !items.length) {
      if (spec.metric === "tasa_respuesta") { value = Number(data?.response_rate_percent || 0); valueLabel = "Tasa de respuesta"; }
      else if (spec.metric === "promedio_calificacion") { value = Number(data?.average_rating || 0); valueLabel = "Promedio de calificación"; }
      else { value = Number(data?.total || 0); valueLabel = "Retroalimentaciones"; }
    } else if (!items.length && data?.counts) {
      const keyMap = { total: "total", abiertos: "active", finalizados: "finalized", cerrados: "finalized", pausados: "paused", cancelados: "cancelled" };
      if (spec.metric === "pausados_cancelados") value = Number(data.counts.paused || 0) + Number(data.counts.cancelled || 0);
      else value = Number(data.counts[keyMap[spec.metric] || "total"] || 0);
    }
    if (spec.chart === "kpi" && value === null && items.length) value = items.reduce((sum, item) => sum + item.value, 0);
    if (spec.dimension === "fecha") items.sort((left, right) => left.label.localeCompare(right.label));
    items = items.slice(0, spec.dimension === "fecha" ? 50 : Math.max(1, Number(spec.limit) || 10));
    const top = [...items].sort((a, b) => b.value - a.value)[0];
    const topSeries = [...series].sort((a, b) => b.total - a.total)[0];
    return {
      previewId: `preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: spec.title,
      chart: spec.chart,
      metric: spec.metric,
      dimension: spec.dimension,
      series_dimension: clean(spec.series_dimension),
      date_grain: clean(spec.date_grain),
      items,
      categories,
      series,
      value,
      valueLabel,
      scopeLabel: clean(typeof data?.scope === "object" ? data.scope?.label : data?.scope) || spec.scopeLabel,
      generatedAt: clean(data?.generated_at) || new Date().toISOString(),
      sourceTool,
      totalMatching: data?.total_matching === undefined ? null : Number(data.total_matching || 0),
      filters: Array.isArray(spec.filters) ? spec.filters.map((filter) => ({ ...filter })) : [],
      insight: topSeries
        ? `${topSeries.label} acumula el mayor valor entre las series (${topSeries.total.toLocaleString("es-MX")}).`
        : top ? `${top.label} presenta el valor más alto (${top.value.toLocaleString("es-MX")}).` : `${valueLabel}: ${Number(value || 0).toLocaleString("es-MX", { maximumFractionDigits: 2 })}.`,
    };
  }

  function previousVisualizationPeriod(period) {
    const end = new Date();
    end.setHours(12, 0, 0, 0);
    let start = new Date(end);
    if (period === "last_7") {
      end.setDate(end.getDate() - 7);
      start = new Date(end); start.setDate(start.getDate() - 6);
    } else if (period === "last_30") {
      end.setDate(end.getDate() - 30);
      start = new Date(end); start.setDate(start.getDate() - 29);
    } else if (period === "this_month") {
      const currentDay = end.getDate();
      start = new Date(end.getFullYear(), end.getMonth() - 1, 1, 12);
      const lastDayPreviousMonth = new Date(end.getFullYear(), end.getMonth(), 0, 12).getDate();
      end.setFullYear(end.getFullYear(), end.getMonth() - 1, Math.min(currentDay, lastDayPreviousMonth));
    } else return null;
    const isoDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { date_from: isoDate(start), date_to: isoDate(end), label: "Periodo anterior" };
  }

  function previewTotal(preview) {
    if (["aggregate_requirements", "aggregate_requirement_dimensions", "aggregate_feedback"].includes(preview.sourceTool) && typeof preview.totalMatching === "number" && Number.isFinite(preview.totalMatching)) return preview.totalMatching;
    if (preview.value !== null && preview.value !== undefined) return Number(preview.value) || 0;
    return preview.items.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  }

  async function fetchVisualizationPreview(spec, dateRange = null) {
    const request = previewToolRequest(spec, dateRange);
    const payload = await fetchInsightsJson(config.previewUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(request),
    });
    if (!payload?.data) throw new Error("El endpoint respondió sin datos para la gráfica.");
    return normalizePreviewData(spec, payload.data, request.tool);
  }

  async function requestVisualizationPreview(spec) {
    const preview = await fetchVisualizationPreview(spec);
    if (spec.comparison !== "previous_period") return preview;
    const previousPeriod = previousVisualizationPeriod(spec.period);
    if (!previousPeriod) return preview;
    const previous = await fetchVisualizationPreview(spec, previousPeriod);
    const currentValue = previewTotal(preview);
    const previousValue = previewTotal(previous);
    const difference = currentValue - previousValue;
    const percentage = previousValue === 0 ? null : (difference / previousValue) * 100;
    preview.comparison = { label: previousPeriod.label, value: previousValue, difference, percentage };
    const sign = difference > 0 ? "+" : "";
    const percentageLabel = percentage === null ? "sin base comparable" : `${sign}${percentage.toLocaleString("es-MX", { maximumFractionDigits: 1 })}%`;
    preview.insight = `${preview.insight} Frente al periodo anterior: ${sign}${difference.toLocaleString("es-MX", { maximumFractionDigits: 2 })} (${percentageLabel}).`;
    return preview;
  }

  function previewSourceLabel(tool) {
    return ({
      aggregate_requirements: "Agregado autorizado de requerimientos",
      aggregate_requirement_dimensions: "Agregado multidimensional autorizado de requerimientos",
      get_requirements_overview: "Resumen autorizado de requerimientos",
      aggregate_feedback: "Agregado autorizado de retroalimentaciones",
      get_feedback_overview: "Resumen autorizado de retroalimentaciones",
    })[clean(tool)] || "Datos autorizados de Ixtla Insights";
  }

  function previewFiltersLabel(preview, spec) {
    const filters = Array.isArray(preview.filters) ? preview.filters : [];
    const visible = filters.map((filter) => `${clean(filter?.field)}: ${clean(filter?.value)}`).filter((value) => !value.endsWith(":"));
    return visible.length ? visible.join(" · ") : `${PERIOD_LABELS[spec.period] || PERIOD_LABELS.all} · Sin filtros adicionales`;
  }

  function formatPreviewDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Actualización reciente" : `Actualizado ${date.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}`;
  }

  function chartColor(index) {
    return ["#176b87", "#2d8ca6", "#5aaebd", "#86c6cf", "#0f4c81", "#73a5d1"][index % 6];
  }

  function previewDisplayItems(preview) {
    if (preview.chart !== "donut" || preview.items.length <= 5) return preview.items;
    const leading = preview.items.slice(0, 4);
    const other = preview.items.slice(4).reduce((sum, item) => sum + item.value, 0);
    return [...leading, { label: "Otros", value: other }];
  }

  function previewNarrative(preview) {
    const items = preview.items;
    if (preview.chart === "kpi") return `${preview.valueLabel}: ${Number(preview.value || 0).toLocaleString("es-MX", { maximumFractionDigits: 2 })}.`;
    if (!items.length) return "No hay datos suficientes para interpretar esta visualización.";
    const total = previewTotal(preview);
    const maximum = [...items].sort((left, right) => right.value - left.value)[0];
    if (preview.series?.length) {
      const leading = [...preview.series].sort((left, right) => right.total - left.total)[0];
      return `${leading.label} acumula el mayor volumen entre las series, con ${leading.total.toLocaleString("es-MX")} registros.`;
    }
    if (preview.chart === "line" || preview.chart === "area") {
      const first = items[0];
      const last = items[items.length - 1];
      const difference = last.value - first.value;
      const direction = difference > 0 ? "aumentó" : difference < 0 ? "disminuyó" : "se mantuvo";
      return `La serie ${direction} de ${first.value.toLocaleString("es-MX")} a ${last.value.toLocaleString("es-MX")}; el pico fue ${maximum.value.toLocaleString("es-MX")} el ${maximum.label}.`;
    }
    const percentage = total > 0 ? (maximum.value / total) * 100 : 0;
    return `${maximum.label} concentra ${maximum.value.toLocaleString("es-MX")} (${percentage.toLocaleString("es-MX", { maximumFractionDigits: 1 })}%) del total.`;
  }

  function renderPreviewMetrics(preview) {
    const metrics = document.createElement("dl");
    metrics.className = "ixtla-chart-preview__metrics";
    const total = previewTotal(preview);
    const items = preview.items;
    const maximum = items.length ? [...items].sort((left, right) => right.value - left.value)[0] : null;
    const entries = [{ label: "Total", value: total.toLocaleString("es-MX") }];
    if (maximum) entries.push({ label: "Valor más alto", value: `${maximum.value.toLocaleString("es-MX")} · ${maximum.label}` });
    if ((preview.chart === "line" || preview.chart === "area") && items.length > 1) {
      entries.push({ label: "Último valor", value: items[items.length - 1].value.toLocaleString("es-MX") });
    } else if (maximum && total > 0) {
      entries.push({ label: "Participación principal", value: `${((maximum.value / total) * 100).toLocaleString("es-MX", { maximumFractionDigits: 1 })}%` });
    }
    if (preview.comparison) {
      const sign = preview.comparison.difference > 0 ? "+" : "";
      entries.push({ label: "Vs. periodo previo", value: `${sign}${preview.comparison.difference.toLocaleString("es-MX")}` });
    }
    entries.slice(0, 4).forEach((entry) => {
      const term = document.createElement("dt"); term.textContent = entry.label;
      const detail = document.createElement("dd"); detail.textContent = entry.value;
      metrics.append(term, detail);
    });
    return metrics;
  }

  function renderChartBody(container, preview) {
    if (preview.chart !== "kpi" && !preview.items.length) {
      container.className += " ixtla-chart-preview__body--empty";
      const empty = document.createElement("div");
      empty.innerHTML = "<strong>Sin datos para visualizar</strong><span>Prueba otro periodo o ajusta los filtros.</span>";
      container.append(empty);
      return;
    }
    if (preview.chart === "kpi") {
      container.className += " ixtla-chart-preview__body--kpi";
      const value = document.createElement("strong");
      value.className = "ixtla-chart-preview__kpi-value";
      value.textContent = Number(preview.value || 0).toLocaleString("es-MX", { maximumFractionDigits: 2 });
      const label = document.createElement("span");
      label.textContent = preview.valueLabel;
      container.append(value, label);
      return;
    }
    if (preview.chart === "table") {
      const table = document.createElement("table");
      table.innerHTML = "<thead><tr><th>Categoría</th><th>Valor</th></tr></thead>";
      const tbody = document.createElement("tbody");
      preview.items.forEach((item) => {
        const row = document.createElement("tr");
        const label = document.createElement("td"); label.textContent = item.label;
        const value = document.createElement("td"); value.textContent = item.value.toLocaleString("es-MX");
        row.append(label, value); tbody.append(row);
      });
      table.append(tbody); container.append(table); return;
    }
    if (preview.chart === "matrix" && preview.categories?.length && preview.series?.length) {
      const wrap = document.createElement("div"); wrap.className = "ixtla-chart-preview__matrix-wrap";
      const table = document.createElement("table"); table.className = "ixtla-chart-preview__matrix";
      const thead = document.createElement("thead"); const head = document.createElement("tr");
      const corner = document.createElement("th"); corner.textContent = DIMENSION_LABELS[preview.dimension] || "Categoría"; head.append(corner);
      preview.series.forEach((serie) => { const th = document.createElement("th"); th.textContent = serie.label; head.append(th); });
      const totalHead = document.createElement("th"); totalHead.textContent = "Total"; head.append(totalHead); thead.append(head);
      const tbody = document.createElement("tbody");
      const maximum = Math.max(1, ...preview.series.flatMap((serie) => serie.values));
      preview.categories.forEach((category, categoryIndex) => {
        const row = document.createElement("tr"); const label = document.createElement("th"); label.scope = "row"; label.textContent = category.label; row.append(label);
        preview.series.forEach((serie) => {
          const value = Number(serie.values[categoryIndex] || 0); const cell = document.createElement("td"); cell.textContent = value.toLocaleString("es-MX");
          const intensity = Math.max(.06, value / maximum);
          cell.style.backgroundColor = `rgba(45, 140, 166, ${(.08 + intensity * .46).toFixed(3)})`;
          cell.title = `${category.label} · ${serie.label}: ${value.toLocaleString("es-MX")}`;
          row.append(cell);
        });
        const total = document.createElement("td"); total.className = "ixtla-chart-preview__matrix-total"; total.textContent = category.total.toLocaleString("es-MX"); row.append(total); tbody.append(row);
      });
      table.append(thead, tbody); wrap.append(table); container.append(wrap); return;
    }
    if (preview.chart === "donut") {
      const displayItems = previewDisplayItems(preview);
      const total = displayItems.reduce((sum, item) => sum + item.value, 0) || 1;
      let cursor = 0;
      const stops = displayItems.map((item, index) => {
        const start = cursor; cursor += (item.value / total) * 100;
        return `${chartColor(index)} ${start}% ${cursor}%`;
      });
      const donut = document.createElement("div"); donut.className = "ixtla-chart-preview__donut";
      donut.style.background = `conic-gradient(${stops.join(",")})`;
      const donutValue = document.createElement("strong"); donutValue.className = "ixtla-chart-preview__donut-value";
      donutValue.textContent = total.toLocaleString("es-MX"); donut.append(donutValue);
      const legend = document.createElement("div"); legend.className = "ixtla-chart-preview__legend";
      displayItems.forEach((item, index) => {
        const entry = document.createElement("span"); entry.innerHTML = `<i style="background:${chartColor(index)}"></i>`;
        const percent = (item.value / total) * 100;
        entry.append(document.createTextNode(`${item.label}: ${item.value.toLocaleString("es-MX")} (${percent.toLocaleString("es-MX", { maximumFractionDigits: 1 })}%)`)); legend.append(entry);
      });
      container.append(donut, legend); return;
    }
    if ((preview.chart === "line" || preview.chart === "area") && preview.categories?.length && preview.series?.length) {
      const width = 520, height = 240, pad = { top: 18, right: 20, bottom: 40, left: 42 };
      const values = preview.series.flatMap((serie) => serie.values);
      const max = Math.max(1, ...values); const plotWidth = width - pad.left - pad.right, plotHeight = height - pad.top - pad.bottom;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", preview.title);
      [0, .5, 1].forEach((ratio) => {
        const y = height - pad.bottom - ratio * plotHeight;
        const grid = document.createElementNS(svg.namespaceURI, "line"); grid.setAttribute("x1", String(pad.left)); grid.setAttribute("x2", String(width - pad.right)); grid.setAttribute("y1", String(y)); grid.setAttribute("y2", String(y)); grid.setAttribute("class", "ixtla-chart-preview__grid"); svg.append(grid);
        const label = document.createElementNS(svg.namespaceURI, "text"); label.setAttribute("x", String(pad.left - 7)); label.setAttribute("y", String(y + 4)); label.setAttribute("text-anchor", "end"); label.setAttribute("class", "ixtla-chart-preview__axis-label"); label.textContent = Math.round(max * ratio).toLocaleString("es-MX"); svg.append(label);
      });
      preview.series.forEach((serie, seriesIndex) => {
        const coordinates = preview.categories.map((category, index) => ({
          x: pad.left + (preview.categories.length <= 1 ? plotWidth / 2 : index * (plotWidth / (preview.categories.length - 1))),
          y: height - pad.bottom - (Number(serie.values[index] || 0) / max) * plotHeight,
        }));
        const points = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
        const polyline = document.createElementNS(svg.namespaceURI, "polyline"); polyline.setAttribute("points", points); polyline.setAttribute("fill", "none"); polyline.setAttribute("stroke", chartColor(seriesIndex)); polyline.setAttribute("stroke-width", "3"); polyline.setAttribute("stroke-linecap", "round"); polyline.setAttribute("stroke-linejoin", "round"); svg.append(polyline);
        coordinates.forEach((point, index) => { const circle = document.createElementNS(svg.namespaceURI, "circle"); circle.setAttribute("cx", String(point.x)); circle.setAttribute("cy", String(point.y)); circle.setAttribute("r", "3"); circle.setAttribute("fill", "#fff"); circle.setAttribute("stroke", chartColor(seriesIndex)); const title = document.createElementNS(svg.namespaceURI, "title"); title.textContent = `${preview.categories[index].label} · ${serie.label}: ${Number(serie.values[index] || 0).toLocaleString("es-MX")}`; circle.append(title); svg.append(circle); });
      });
      const tickIndexes = [...new Set([0, Math.floor((preview.categories.length - 1) / 2), preview.categories.length - 1])];
      tickIndexes.forEach((index) => { const x = pad.left + (preview.categories.length <= 1 ? plotWidth / 2 : index * (plotWidth / (preview.categories.length - 1))); const label = document.createElementNS(svg.namespaceURI, "text"); label.setAttribute("x", String(x)); label.setAttribute("y", String(height - 12)); label.setAttribute("text-anchor", index === 0 ? "start" : index === preview.categories.length - 1 ? "end" : "middle"); label.setAttribute("class", "ixtla-chart-preview__axis-label"); label.textContent = preview.categories[index].label; svg.append(label); });
      const legend = document.createElement("div"); legend.className = "ixtla-chart-preview__series-legend";
      preview.series.forEach((serie, index) => { const item = document.createElement("span"); const dot = document.createElement("i"); dot.style.background = chartColor(index); item.append(dot, document.createTextNode(`${serie.label} (${serie.total.toLocaleString("es-MX")})`)); legend.append(item); });
      container.append(svg, legend); return;
    }
    if (preview.chart === "line" || preview.chart === "area") {
      const width = 520, height = 220, pad = { top: 18, right: 20, bottom: 38, left: 42 };
      const max = Math.max(1, ...preview.items.map((item) => item.value));
      const plotWidth = width - pad.left - pad.right, plotHeight = height - pad.top - pad.bottom;
      const points = preview.items.map((item, index) => {
        const x = pad.left + (preview.items.length <= 1 ? plotWidth / 2 : index * (plotWidth / (preview.items.length - 1)));
        const y = height - pad.bottom - (item.value / max) * plotHeight;
        return `${x},${y}`;
      }).join(" ");
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", preview.title);
      [0, .5, 1].forEach((ratio) => {
        const y = height - pad.bottom - ratio * plotHeight;
        const grid = document.createElementNS(svg.namespaceURI, "line");
        grid.setAttribute("x1", String(pad.left)); grid.setAttribute("x2", String(width - pad.right)); grid.setAttribute("y1", String(y)); grid.setAttribute("y2", String(y)); grid.setAttribute("class", "ixtla-chart-preview__grid"); svg.append(grid);
        const label = document.createElementNS(svg.namespaceURI, "text");
        label.setAttribute("x", String(pad.left - 7)); label.setAttribute("y", String(y + 4)); label.setAttribute("text-anchor", "end"); label.setAttribute("class", "ixtla-chart-preview__axis-label"); label.textContent = Math.round(max * ratio).toLocaleString("es-MX"); svg.append(label);
      });
      if (preview.chart === "area" && points) {
        const polygon = document.createElementNS(svg.namespaceURI, "polygon");
        polygon.setAttribute("points", `${pad.left},${height - pad.bottom} ${points} ${width - pad.right},${height - pad.bottom}`); polygon.setAttribute("fill", "rgba(23,107,135,.18)"); svg.append(polygon);
      }
      const polyline = document.createElementNS(svg.namespaceURI, "polyline");
      polyline.setAttribute("points", points); polyline.setAttribute("fill", "none"); polyline.setAttribute("stroke", "#176b87"); polyline.setAttribute("stroke-width", "4"); polyline.setAttribute("stroke-linecap", "round"); polyline.setAttribute("stroke-linejoin", "round"); svg.append(polyline);
      const tickIndexes = [...new Set([0, Math.floor((preview.items.length - 1) / 2), preview.items.length - 1])];
      preview.items.forEach((item, index) => {
        const x = pad.left + (preview.items.length <= 1 ? plotWidth / 2 : index * (plotWidth / (preview.items.length - 1)));
        const y = height - pad.bottom - (item.value / max) * plotHeight;
        const point = document.createElementNS(svg.namespaceURI, "circle"); point.setAttribute("cx", String(x)); point.setAttribute("cy", String(y)); point.setAttribute("r", index === preview.items.length - 1 ? "4.5" : "3"); point.setAttribute("class", "ixtla-chart-preview__point");
        const pointTitle = document.createElementNS(svg.namespaceURI, "title"); pointTitle.textContent = `${item.label}: ${item.value.toLocaleString("es-MX")}`; point.append(pointTitle); svg.append(point);
        if (tickIndexes.includes(index)) { const label = document.createElementNS(svg.namespaceURI, "text"); label.setAttribute("x", String(x)); label.setAttribute("y", String(height - 12)); label.setAttribute("text-anchor", index === 0 ? "start" : index === preview.items.length - 1 ? "end" : "middle"); label.setAttribute("class", "ixtla-chart-preview__axis-label"); label.textContent = item.label; svg.append(label); }
      });
      container.append(svg); return;
    }
    const max = Math.max(1, ...preview.items.map((item) => item.value));
    const bars = document.createElement("div"); bars.className = "ixtla-chart-preview__bars";
    preview.items.forEach((item, index) => {
      const row = document.createElement("div"); row.className = "ixtla-chart-preview__bar-row";
      const label = document.createElement("span"); label.className = "ixtla-chart-preview__bar-label"; label.textContent = item.label;
      const track = document.createElement("span"); track.className = "ixtla-chart-preview__bar-track";
      const fill = document.createElement("i"); fill.style.width = `${Math.max(2, (item.value / max) * 100)}%`; fill.style.background = chartColor(index); track.append(fill);
      const value = document.createElement("strong"); value.textContent = item.value.toLocaleString("es-MX");
      row.append(label, track, value); bars.append(row);
    });
    container.append(bars);
  }

  function addVisualizationPreview(preview, spec) {
    const card = document.createElement("article"); card.className = "ixtla-chart-preview"; card.dataset.previewId = preview.previewId;
    card.setAttribute("aria-label", `Preview: ${preview.title}`);
    const heading = document.createElement("div"); heading.className = "ixtla-chart-preview__heading";
    const title = document.createElement("h3"); title.textContent = preview.title;
    const meta = document.createElement("p"); meta.textContent = `${PERIOD_LABELS[spec.period] || PERIOD_LABELS.all} · ${preview.scopeLabel}`;
    heading.append(title, meta);
    const narrative = document.createElement("section"); narrative.className = "ixtla-chart-preview__narrative";
    const narrativeLabel = document.createElement("strong"); narrativeLabel.textContent = "Lo más importante";
    const narrativeText = document.createElement("p"); narrativeText.textContent = previewNarrative(preview);
    narrative.append(narrativeLabel, narrativeText);
    const metrics = renderPreviewMetrics(preview);
    const body = document.createElement("div"); body.className = "ixtla-chart-preview__body";
    body.setAttribute("role", "group"); body.setAttribute("aria-label", `${CHART_LABELS[preview.chart] || "Visualización"}: ${preview.insight}`);
    renderChartBody(body, preview);
    const insight = document.createElement("p"); insight.className = "ixtla-chart-preview__insight"; insight.textContent = preview.insight;
    const evidence = document.createElement("details"); evidence.className = "ixtla-chart-preview__evidence";
    const evidenceSummary = document.createElement("summary"); evidenceSummary.textContent = "Cómo se obtuvo";
    const evidenceBody = document.createElement("div");
    const source = document.createElement("p"); source.innerHTML = "<strong>Fuente:</strong> "; source.append(document.createTextNode(previewSourceLabel(preview.sourceTool)));
    const filters = document.createElement("p"); filters.innerHTML = "<strong>Filtros:</strong> "; filters.append(document.createTextNode(previewFiltersLabel(preview, spec)));
    const updated = document.createElement("p"); updated.innerHTML = "<strong>Actualización:</strong> "; updated.append(document.createTextNode(formatPreviewDate(preview.generatedAt)));
    evidenceBody.append(source, filters, updated); evidence.append(evidenceSummary, evidenceBody);
    const actions = document.createElement("div"); actions.className = "ixtla-chart-preview__actions";
    const add = document.createElement("button"); add.type = "button"; add.className = "ixtla-chart-preview__add";
    add.textContent = "＋ Agregar al dashboard";
    add.title = "Al hacer clic agregarás esta gráfica a tu dashboard";
    add.setAttribute("aria-label", "Agregar esta gráfica a tu dashboard");
    const change = document.createElement("button"); change.type = "button"; change.className = "ixtla-chart-preview__change"; change.textContent = "Cambiar tipo";
    const explore = document.createElement("button"); explore.type = "button"; explore.className = "ixtla-chart-preview__explore";
    explore.textContent = preview.dimension === "fecha" ? "Explicar el pico" : "Ver datos en tabla";
    const undo = document.createElement("button"); undo.type = "button"; undo.className = "ixtla-chart-preview__undo"; undo.textContent = "Deshacer"; undo.hidden = true;
    const openDashboard = document.createElement("a"); openDashboard.className = "ixtla-chart-preview__dashboard-link";
    openDashboard.href = config.dashboardUrl; openDashboard.textContent = "Ver dashboard"; openDashboard.hidden = true;
    add.addEventListener("click", () => {
      if (dashboardQueue.some((item) => item.previewId === preview.previewId)) return;
      add.disabled = true; add.textContent = "Agregando…";
      setTimeout(() => {
        dashboardQueue.push({ previewId: preview.previewId, spec: { ...spec }, preview: { ...preview, items: preview.items.map((item) => ({ ...item })) } });
        writeTemporaryDashboardWidgets(dashboardQueue);
        add.textContent = "✓ Agregado al dashboard";
        undo.hidden = false; openDashboard.hidden = false;
        addMessage("La gráfica quedó preparada para tu dashboard. Conservé su métrica, agrupación, periodo y alcance.");
      }, 180);
    });
    undo.addEventListener("click", () => {
      const index = dashboardQueue.findIndex((item) => item.previewId === preview.previewId);
      if (index >= 0) dashboardQueue.splice(index, 1);
      writeTemporaryDashboardWidgets(dashboardQueue);
      add.disabled = false; add.textContent = "＋ Agregar al dashboard"; undo.hidden = true; openDashboard.hidden = true;
      addMessage("Listo. Quité esta gráfica de la preparación del dashboard.");
    });
    change.addEventListener("click", () => {
      pendingVisualization = { ...spec, mode: "preview_edit", reviewSpec: { ...spec } };
      changeVisualizationChart();
    });
    explore.addEventListener("click", () => {
      const prompt = preview.dimension === "fecha"
        ? `Explica el valor más alto de la gráfica "${preview.title}" y muestra los requerimientos relacionados dentro del mismo periodo y alcance.`
        : `Muéstrame los datos en tabla de la gráfica "${preview.title}", conservando el mismo periodo y filtros.`;
      ask(prompt);
    });
    actions.append(add, change, explore, openDashboard, undo); card.append(heading, narrative, metrics, body, insight, evidence, actions); messages.append(card); messages.scrollTop = messages.scrollHeight;
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
      renderWorkflowQuestions(chartChoices(request.goal));
      return;
    }
    if (!requiresDimension(request.chart)) request.dimension = "estatus";
    if ((request.chart === "line" || request.chart === "area") && !request.dimension) request.dimension = "fecha";
    if (request.chart === "funnel") request.dimension = "estatus";
    if (requiresDimension(request.chart) && !request.dimension) {
      addMessage("¿Cómo deseas agrupar los requerimientos?");
      renderWorkflowQuestions(dimensionChoices(request.chart));
      return;
    }
    if (!request.metric) {
      addMessage("¿Qué métrica deseas visualizar?");
      renderWorkflowQuestions(metricChoices());
      return;
    }
    finalizeVisualization();
  }

  async function finalizeVisualization() {
    if (!pendingVisualization?.chart || !pendingVisualization?.metric) return;
    const request = pendingVisualization;
    if (request.reviewSpec) return;
    const dimension = request.dimension || "estatus";
    const spec = normalizeVisualizationSpec({
      id: `guided-widget-${Date.now()}`,
      chart: request.chart,
      metric: request.metric,
      dimension,
      series_dimension: clean(request.series_dimension),
      date_grain: clean(request.date_grain),
      series_limit: Math.min(7, Math.max(1, Number(request.series_limit) || 5)),
      filters: Array.isArray(request.filters) ? request.filters : [],
      period: PERIOD_LABELS[request.period] ? request.period : "all",
      comparison: request.comparison === "previous_period" ? "previous_period" : "",
      sort: dimension === "fecha" ? "chronological" : "desc",
      limit: request.chart === "kpi" ? 1 : Math.min(50, Math.max(1, Number(request.limit) || 10)),
      domain: request.domain === "retroalimentaciones" ? "retroalimentaciones" : "requerimientos",
      scopeLabel: clean(context?.scopeLabel) || "Vista autorizada actual",
    });
    request.chart = spec.chart;
    request.dimension = spec.dimension;
    request.title = spec.title;
    request.reviewSpec = spec;
    queueDraftPersist();
    showVisualizationReview(request, spec);
    return;

    try {
      await addVisualization(request.question, spec);
      renderMainMenu();
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
    const series = DIMENSION_LABELS[spec.series_dimension] || "";
    const period = PERIOD_LABELS[spec.period] || PERIOD_LABELS.all;
    const adjustment = spec.compatibilityAdjusted
      ? ` Ajusté el formato a ${chart.toLocaleLowerCase("es-MX")} para conservar el análisis por ${dimension}.`
      : "";
    const seriesSummary = series ? ` · una serie por ${series}` : "";
    addMessage(`Configuración propuesta: **${spec.title}**\n\n${metric} · ${visualizationScopeSummary(spec.filters)} · ${period} · ${chart} por ${dimension}${seriesSummary}.\n\n${visualizationRecommendation(spec)}${adjustment}`);
    renderConversationQuestions([
      { label: "Dejar configuración lista", description: "Confirma esta propuesta para la siguiente etapa.", primary: true, action: { type: "visualization_confirm" } },
      { label: "Cambiar tipo", description: `Recomendado: ${chart}.`, action: { type: "visualization_change_chart" } },
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
    if (!config.simpleMode) discardDraft();
    if (config.simpleMode) {
      const hideThinkingIndicator = showThinkingIndicator();
      try {
        const preview = await requestVisualizationPreview(spec);
        lastVisualizationSpec = { ...spec, filters: Array.isArray(spec.filters) ? spec.filters.map((filter) => ({ ...filter })) : [] };
        addVisualizationPreview(preview, spec);
    } catch (error) {
      console.error("[IxtlaInsights preview]", error);
      const detail = endpointDiagnosticMessage(error);
      addMessage(`No pude generar la preview. ${detail}`);
      } finally {
        hideThinkingIndicator();
        renderMainMenu();
      }
      return;
    }
    try {
      await addVisualization(request.question, spec);
      renderMainMenu();
    } catch (error) {
      console.error("[IxtlaInsights]", error);
      addMessage("No fue posible agregar la visualización al dashboard. Intenta de nuevo.");
      renderMainMenu();
    }
  }

  function editVisualizationPeriod() {
    if (!pendingVisualization?.reviewSpec) return;
    addMessage("¿Qué periodo deseas analizar?");
    renderWorkflowQuestions(periodChoices());
  }

  function editVisualizationScope() {
    if (!pendingVisualization?.reviewSpec) return;
    addMessage("¿Qué departamentos deseas usar?");
    renderWorkflowQuestions(DEPARTMENT_SCOPE_CHOICES);
  }

  function cancelVisualization(message = "Visualización cancelada.") {
    pendingVisualization = null;
    discardDraft();
    addMessage(message);
    renderMainMenu();
  }

  function exploreVisualizationTypes() {
    addMessage("Explorar visualizaciones", "user");
    pendingVisualization = { mode: "explorer_menu", filters: [], period: "" };
    addMessage("No necesitas conocer los nombres técnicos. Elige qué quieres entender y te propondré el formato y un ejemplo que puedes ajustar.");
    renderWorkflowQuestions(VISUALIZATION_EXPLORER);
  }

  function chooseExplorerFormat(chart) {
    if (!catalogValues("widget_kinds", Object.keys(CHART_LABELS)).includes(chart)) return;
    if (chart === "line") {
      addMessage("Ver evolución", "user");
      pendingVisualization = {
        mode: "explorer_visualization", question: "Crear una tendencia de requerimientos", domain: "requerimientos",
        chart: "line", metric: "total", dimension: "fecha", series_dimension: "", filters: [], period: "",
      };
      addMessage("Una línea muestra el total en el tiempo; varias líneas permiten comparar categorías. ¿Cómo deseas verla?");
      renderWorkflowQuestions(LINE_SERIES_CHOICES);
      return;
    }
    if (chart === "matrix") {
      addMessage("Cruzar dos categorías", "user");
      pendingVisualization = {
        mode: "explorer_visualization", question: "Crear una matriz de requerimientos", domain: "requerimientos",
        chart: "matrix", metric: "total", dimension: "departamento", series_dimension: "estatus", series_limit: 7, filters: [], period: "",
      };
      addMessage("Una matriz cruza dos categorías: una se muestra en filas y otra en columnas. Cada celda contiene la cantidad de requerimientos. ¿Qué deseas cruzar?");
      renderWorkflowQuestions(MATRIX_PAIR_CHOICES);
    }
  }

  function askExplorerPeriod() {
    queueDraftPersist();
    addMessage("Usaré el total de requerimientos como medición. ¿Qué periodo deseas analizar?");
    renderWorkflowQuestions(periodChoices());
  }

  function chooseLineSeries(seriesDimension) {
    if (!pendingVisualization || pendingVisualization.chart !== "line") return;
    if (seriesDimension && !["departamento", "estatus", "tramite"].includes(seriesDimension)) return;
    pendingVisualization.series_dimension = seriesDimension;
    pendingVisualization.series_limit = seriesDimension === "estatus" ? 7 : 5;
    const label = seriesDimension ? `Una línea por ${DIMENSION_LABELS[seriesDimension]}` : "Una línea con el total";
    pendingVisualization.question = `Crear una tendencia con ${label.toLocaleLowerCase("es-MX")}`;
    addMessage(label, "user");
    askExplorerPeriod();
  }

  function chooseMatrixPair(dimension, seriesDimension) {
    if (!pendingVisualization || pendingVisualization.chart !== "matrix") return;
    if (!["departamento", "estatus", "tramite"].includes(dimension)
        || !["departamento", "estatus", "tramite"].includes(seriesDimension)
        || dimension === seriesDimension) return;
    pendingVisualization.dimension = dimension;
    pendingVisualization.series_dimension = seriesDimension;
    pendingVisualization.series_limit = seriesDimension === "estatus" ? 7 : 5;
    pendingVisualization.question = `Crear una matriz por ${DIMENSION_LABELS[dimension]} y ${DIMENSION_LABELS[seriesDimension]}`;
    addMessage(`${DIMENSION_LABELS[dimension]} × ${DIMENSION_LABELS[seriesDimension]}`, "user");
    askExplorerPeriod();
  }

  function chooseVisualizationChart(chart) {
    if (!pendingVisualization || !CHART_LABELS[chart] || !catalogValues("widget_kinds", Object.keys(CHART_LABELS)).includes(chart)) return;
    pendingVisualization.chart = chart;
    if (pendingVisualization.dimension) pendingVisualization = normalizeVisualizationSpec(pendingVisualization);
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
    renderWorkflowQuestions(DEPARTMENT_SCOPE_CHOICES);
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

  function startGuidedVisualization(echoUser = true) {
    if (echoUser) addMessage("Crear un gráfico", "user");
    pendingVisualization = { mode: "topic_selection", filters: [], period: "" };
    addMessage("Claro. ¿Qué te gustaría visualizar? También puedes escribirlo con tus propias palabras, por ejemplo: “Necesito una gráfica de pendientes por departamento este mes”.");
    renderWorkflowQuestions(VISUALIZATION_TOPICS);
  }

  function changeVisualizationChart() {
    if (!pendingVisualization?.reviewSpec) return;
    delete pendingVisualization.reviewSpec;
    addMessage("Elige otro formato. La opción recomendada aparece primero.");
    renderWorkflowQuestions(chartChoices(pendingVisualization.goal));
  }

  function chooseVisualizationPreset(presetName, echoUser = true) {
    const preset = VISUALIZATION_PRESETS[clean(presetName)];
    if (!preset) return;
    if (echoUser) addMessage(VISUALIZATION_TOPICS.find((item) => item.action.preset === presetName)?.label || preset.title, "user");
    pendingVisualization = {
      mode: "preset_visualization",
      question: `Crear ${preset.title}`,
      ...preset,
      filters: [],
      period: "",
    };
    addMessage(`Te recomiendo ${CHART_LABELS[preset.chart].toLocaleLowerCase("es-MX")} porque ${preset.dimension === "fecha" ? "muestra claramente la evolución en el tiempo" : preset.chart === "kpi" ? "resume los valores principales de forma directa" : `permite comparar por ${DIMENSION_LABELS[preset.dimension]}`}.`);
    addMessage("¿Qué periodo deseas analizar?");
    renderWorkflowQuestions(periodChoices());
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
    renderWorkflowQuestions(separationChoices(metric));
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
      renderWorkflowQuestions(periodChoices());
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
    if (["preset_visualization", "natural_visualization", "structured_visualization", "explorer_visualization"].includes(pendingVisualization.mode)) {
      finalizeVisualization();
      return;
    }
    if (pendingVisualization.mode === "kpi_kit") {
      addMessage("Elige el indicador que deseas agregar al dashboard.");
      renderWorkflowQuestions(kpiChoices());
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
    renderWorkflowQuestions(MEASUREMENT_CHOICES);
  }

  async function showDepartmentChecklist() {
    if (!config.departmentsUrl) return;
    const loading = document.createElement("p");
    loading.className = "ixtla-insights-department-loading";
    loading.textContent = "Cargando departamentos activos…";
    messages.appendChild(loading);
    messages.scrollTop = messages.scrollHeight;
    try {
      const payload = await fetchInsightsJson(config.departmentsUrl);
      if (!Array.isArray(payload.departments)) throw new Error("El endpoint respondió sin el catálogo de departamentos.");
      loading.remove();
      renderDepartmentChecklist(payload.departments);
    } catch (error) {
      loading.remove();
      console.error("[IxtlaInsights]", error);
      const detail = error instanceof InsightsRequestError ? endpointDiagnosticMessage(error) : "No pude cargar los departamentos activos.";
      addMessage(`${detail} Puedes intentar nuevamente o seleccionar todos los departamentos.`);
      renderWorkflowQuestions(DEPARTMENT_SCOPE_CHOICES);
    }
  }

  function renderDepartmentChecklist(departments) {
    const panel = document.createElement("div");
    panel.className = "ixtla-insights-conversation-form";
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
      input.dataset.departmentId = String(Number(department?.id) || "");
      input.checked = selectedNames.has(name);
      label.append(input, document.createTextNode(name));
      form.appendChild(label);
    });
    const actions = document.createElement("div");
    actions.className = "ixtla-insights-department-actions";
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "Volver";
    back.addEventListener("click", () => {
      panel.remove();
      renderWorkflowQuestions(DEPARTMENT_SCOPE_CHOICES);
    });
    const apply = document.createElement("button");
    apply.type = "button";
    apply.textContent = "Usar departamentos seleccionados";
    apply.addEventListener("click", () => {
      const selected = [...form.querySelectorAll('input[name="ixtla-insights-department"]:checked')].map((input) => ({
        id: Number(input.dataset.departmentId) || null,
        value: clean(input.value),
      })).filter((item) => item.value);
      if (!selected.length) {
        addMessage("Selecciona al menos un departamento o elige todos los departamentos.");
        return;
      }
      pendingVisualization.filters = selected.slice(0, 50).map((item) => ({ field: "departamento", value: item.value, ...(item.id ? { id: item.id } : {}) }));
      queueDraftPersist();
      panel.querySelectorAll("button, input").forEach((control) => { control.disabled = true; });
      addMessage(`Departamentos: ${selected.map((item) => item.value).join(", ")}`, "user");
      continueAfterDepartmentScope();
    });
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancelar creación";
    cancel.addEventListener("click", () => cancelVisualization());
    actions.append(back, cancel, apply);
    panel.append(form, actions);
    messages.append(panel);
    messages.scrollTop = messages.scrollHeight;
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
    const requestBody = JSON.stringify({ question: prompt, dashboard_id: clean(config.dashboardId) });
    insightsDebug("chat.request.started", {
      requestId: clientRequestId,
      url: config.apiUrl,
      questionLength: prompt.length,
      localHistoryMessages: history.length,
      requestBytes: new TextEncoder().encode(requestBody).byteLength,
    });
    let response;
    let payload = null;
    let attempt = 1;
    for (; attempt <= 2; attempt += 1) {
      try {
        response = await fetch(config.apiUrl, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-Ixtla-Insights-Request-Id": clientRequestId,
            "X-Ixtla-Insights-Frontend-Build": clean(config.frontendBuild) || "unknown",
            "X-Ixtla-Insights-Attempt": String(attempt),
          },
          body: requestBody,
        });
      } catch {
        insightsDebug("chat.request.network_error", { requestId: clientRequestId, url: config.apiUrl, attempt });
        throw new InsightsRequestError(0, "No fue posible contactar el servicio Insights.", {
          requestId: clientRequestId,
          url: config.apiUrl,
          endpointHandled: false,
          attempt,
        });
      }
      const raw = await response.text();
      payload = (() => { try { return JSON.parse(raw); } catch { return null; } })();
      const endpointHandled = Boolean(response.headers.get("X-Ixtla-Insights-Request-Id"));
      if (response.status !== 404 || endpointHandled || attempt === 2) break;
      insightsDebug("chat.request.retry_scheduled", {
        requestId: clientRequestId,
        url: clean(response.url) || config.apiUrl,
        status: response.status,
        attempt,
        nextAttempt: attempt + 1,
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const responseDebug = {
      requestId: clean(payload?.request_id) || clean(response.headers.get("X-Ixtla-Insights-Request-Id")) || clientRequestId,
      status: response.status,
      responseUrl: clean(response.url),
      contentType: clean(response.headers.get("content-type")),
      endpointHandled: Boolean(response.headers.get("X-Ixtla-Insights-Request-Id")),
      buildId: clean(response.headers.get("X-Ixtla-Insights-Build")),
      instanceId: clean(response.headers.get("X-Ixtla-Insights-Instance")),
      serverStage: clean(response.headers.get("X-Ixtla-Insights-Debug-Stage")),
      attempt,
    };
    insightsDebug("chat.request.completed", responseDebug);
    if (!response.ok || !payload?.ok) {
      throw new InsightsRequestError(response.status || 0, clean(payload?.error) || "El servicio Insights no respondió correctamente.", {
        requestId: clean(payload?.request_id) || clean(response.headers.get("X-Ixtla-Insights-Request-Id")) || clientRequestId,
        errorCode: clean(payload?.error_code),
        endpointVersion: clean(response.headers.get("X-Ixtla-Insights-Version")),
        buildId: responseDebug.buildId,
        instanceId: responseDebug.instanceId,
        serverStage: responseDebug.serverStage,
        url: clean(response.url) || config.apiUrl,
        contentType: clean(response.headers.get("content-type")),
        endpointHandled: Boolean(response.headers.get("X-Ixtla-Insights-Request-Id")),
        attempt,
      });
    }
    return payload;
  }

  function diagnosticMessage(error) {
    const trace = clean(error?.requestId);
    const suffix = trace ? ` Código de diagnóstico: ${trace}.` : "";
    const status = Number(error?.status || 0);
    if (status === 200 && !clean(error?.contentType).includes("application/json")) {
      return `Tu sesión terminó. Recarga esta página para continuar.${suffix}`;
    }
    if (status === 401) return `Tu sesión terminó. Recarga esta página para continuar.${suffix}`;
    if (status === 403) return `No tienes permiso para realizar esta consulta. Si tus permisos cambiaron recientemente, recarga la página.${suffix}`;
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

  function endpointDiagnosticMessage(error) {
    if (!(error instanceof InsightsRequestError)) return clean(error?.message) || "La consulta no estuvo disponible.";
    const trace = clean(error.requestId);
    const suffix = trace ? ` Código de diagnóstico: ${trace}.` : "";
    if (Number(error.status) === 422 && clean(error.message)) return `El endpoint rechazó la solicitud: ${clean(error.message)}${suffix}`;
    if (Number(error.status) >= 500 && clean(error.message)) return `${clean(error.message)}${suffix}`;
    return diagnosticMessage(error);
  }

  function setContext(next) { context = next && typeof next === "object" ? next : null; }
  function open() { drawer.classList.add("is-open"); overlay.classList.add("is-open"); drawer.setAttribute("aria-hidden", "false"); input.focus(); }
  function closeDrawer() { drawer.classList.remove("is-open"); overlay.classList.remove("is-open"); drawer.setAttribute("aria-hidden", "true"); }

  async function ask(question) {
    const prompt = clean(question);
    if (!prompt) return;
    messages.querySelectorAll(".ixtla-insights-conversation-choices:not(.is-resolved)").forEach((group) => {
      group.classList.add("is-resolved");
      group.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    });
    addMessage(prompt, "user");
    input.value = "";
    if (isVisualizationCancellationIntent(prompt)) {
      cancelVisualization("De acuerdo. Cancelé la creación del gráfico. ¿Qué dato o reporte quieres consultar?");
      return;
    }
    let visualizationPrompt = prompt;
    const plannerClarification = pendingVisualization?.mode === "planner_clarification" ? pendingVisualization : null;
    if (plannerClarification) {
      visualizationPrompt = `${clean(plannerClarification.question)}. Aclaración del usuario: ${prompt}`;
      pendingVisualization = null;
    } else if (handlePendingVisualizationText(prompt)) return;
    const parsedVisualization = parseVisualizationRequest(visualizationPrompt);
    if (parsedVisualization) {
      send.disabled = true;
      const hidePlanningIndicator = showThinkingIndicator("Preparando la mejor visualización…");
      try {
        const plan = await requestStructuredVisualizationPlan(visualizationPrompt);
        if (!applyStructuredVisualizationPlan(visualizationPrompt, plan)) beginNaturalVisualization(visualizationPrompt, parsedVisualization);
      } catch (error) {
        console.warn("[IxtlaInsights planner] usando respaldo local", error);
        beginNaturalVisualization(visualizationPrompt, parsedVisualization);
      } finally {
        hidePlanningIndicator();
        send.disabled = false;
        input.focus();
      }
      return;
    }
    send.disabled = true;
    const hideThinkingIndicator = showThinkingIndicator();
    try {
      if (!config.simpleMode) await ensureCatalog(config.catalogUrl);
      const payload = await requestRemoteAnswer(prompt);
      const answer = clean(payload.answer) || "No pude generar una respuesta para esa consulta.";
      addMessage(answer);
      if (clean(payload?.result_query?.query_id)) {
        lastResultQuery = payload.result_query;
      }
      renderReportEvidence(payload?.result_query);
      if (!config.simpleMode) renderReport(payload.report);
      history.push({ role: "user", content: prompt }, { role: "assistant", content: answer });
      const suggestions = Array.isArray(payload.suggestions)
        ? payload.suggestions.map((suggestion) => clean(suggestion)).filter(Boolean).slice(0, 5)
        : [];
      const defaultActions = payload?.result_query
        ? reportFollowUps(prompt, payload.result_query)
        : [...START_ACTIONS, ...config.quickQuestions];
      renderConversationQuestions(suggestions.length ? suggestions : defaultActions);
      if (!config.simpleMode) {
        const action = Array.isArray(payload.actions) ? payload.actions.find((item) => item?.type === "widget_preview") : null;
        const spec = remoteWidgetSpec(action?.widget);
        if (spec) startRemoteVisualizationScope(prompt, spec);
      }
    } catch (error) {
      console.error("[IxtlaInsights]", error instanceof InsightsRequestError ? {
        status: error.status,
        errorCode: error.errorCode,
        requestId: error.requestId,
        endpointVersion: error.endpointVersion,
        buildId: error.buildId,
        instanceId: error.instanceId,
        serverStage: error.serverStage,
        endpointHandled: error.endpointHandled,
        url: error.url,
        contentType: error.contentType,
        attempt: error.attempt,
        detail: error.message,
      } : error);
      if (error instanceof InsightsRequestError) {
        addMessage(diagnosticMessage(error), "assistant");
      } else {
        addMessage("No fue posible analizar los requerimientos. Intenta de nuevo.");
      }
    } finally {
      hideThinkingIndicator();
      send.disabled = false;
      input.focus();
    }
  }

  async function persistDraft() {
    if (!pendingVisualization) return;
    await fetchInsightsJson(config.draftUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ action: "save", draft: pendingVisualization }),
    });
  }

  function queueDraftPersist() {
    if (config.simpleMode) return;
    draftPersistQueue = draftPersistQueue
      .then(() => persistDraft())
      .catch((error) => console.warn("[IxtlaInsights draft]", error));
  }

  function discardDraft() {
    if (config.simpleMode) return;
    draftPersistQueue = draftPersistQueue
      .then(() => fetchInsightsJson(config.draftUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action: "delete" }),
      }))
      .catch(() => {});
  }

  function clearServerConversation() {
    return fetchInsightsJson(config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ action: "clear_conversation" }),
    }).catch(() => {
      // La limpieza visual no debe quedar bloqueada si el servidor no responde.
    });
  }

  function lastQuery() {
    return lastResultQuery ? { ...lastResultQuery, filters: { ...(lastResultQuery.filters || {}) } } : null;
  }

  async function exportCSV(queryId = "") {
    const selectedQueryId = clean(queryId) || clean(lastResultQuery?.query_id);
    if (!selectedQueryId) throw new Error("No hay una consulta exportable. Realiza primero una búsqueda de requerimientos en el asistente.");
    const clientRequestId = createInsightsRequestId();
    const response = await fetch(config.exportUrl, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "text/csv, application/json", "X-Ixtla-Insights-Request-Id": clientRequestId },
      body: JSON.stringify({ query_id: selectedQueryId }),
    });
    const contentType = clean(response.headers.get("content-type"));
    if (!response.ok || !contentType.includes("text/csv")) {
      const raw = await response.text();
      const payload = (() => { try { return JSON.parse(raw); } catch { return null; } })();
      throw insightsResponseError(response, payload, config.exportUrl, clientRequestId);
    }
    const blob = await response.blob();
    const disposition = clean(response.headers.get("content-disposition"));
    const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
    const filename = filenameMatch?.[1] || `ixtla-requerimientos-${selectedQueryId}.csv`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { queryId: selectedQueryId, filename, bytes: blob.size };
  }

  function formatWelcomeReport(report) {
    const number = (value) => Number(value || 0).toLocaleString("es-MX");
    const counts = report?.counts || {};
    const trend = report?.trend || {};
    const top = Array.isArray(report?.top_tramites) ? report.top_tramites : [];
    const topText = top.length
      ? top.map((item, index) => `${index + 1}. ${clean(item?.name) || "Sin nombre"} (${number(item?.value)})`).join("\n")
      : "Sin datos suficientes para identificar trámites con mayor carga.";
    const change = trend?.percentage_change;
    const trendText = change === null || change === undefined
      ? "Sin periodo previo comparable."
      : `${Number(change) > 0 ? "+" : ""}${Number(change).toLocaleString("es-MX", { maximumFractionDigits: 1 })}% frente a los 30 días previos.`;

    return [
      clean(report?.title) || "Dataset de: Usuario actual",
      `Rol: ${clean(report?.role_label) || "Empleado"} · Alcance: ${clean(report?.scope?.label) || "Vista autorizada"}.`,
      `Informe operativo · ${clean(report?.period_label) || "Mes en curso"}.`,
      "",
      "KPIs",
      `• Total: ${number(counts.total)}`,
      `• Activos: ${number(counts.active)}`,
      `• Promedio semanal de requerimientos creados (últimos 30 días): ${Number(report?.average_weekly || 0).toLocaleString("es-MX", { maximumFractionDigits: 1 })}`,
      `• Finalizados: ${number(counts.finalized)}`,
      `• Pausados: ${number(counts.paused)} · Cancelados: ${number(counts.cancelled)}`,
      `• Sin asignar: ${number(counts.unassigned)}`,
      "",
      "Mayor incidencia por trámite",
      topText,
      "",
      `Tendencia de carga (últimos 30 días): ${trendText}`,
      "Puedes pedirme folios recientes, detalles de un requerimiento, filtros por estatus, departamento o responsable, o un reporte más amplio.",
    ].join("\n");
  }

  async function showWelcomeReport() {
    try {
      const payload = await fetchInsightsJson(config.welcomeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: "{}",
      });
      if (!payload?.report) throw new Error("El endpoint respondió sin el informe inicial.");
      addMessage(formatWelcomeReport(payload.report));
    } catch (error) {
      console.warn("[IxtlaInsights] welcome report", error);
      const detail = error instanceof InsightsRequestError ? diagnosticMessage(error) : "No fue posible cargar el informe inicial.";
      addMessage(`${detail} Puedes consultar requerimientos específicos desde el chat.`);
    }
  }

  renderMainMenu();
  fab.addEventListener("click", open);
  close.addEventListener("click", closeDrawer);
  clear.addEventListener("click", () => {
    messages.replaceChildren();
    history.length = 0;
    lastResultQuery = null;
    lastVisualizationSpec = null;
    pendingVisualization = null;
    void clearServerConversation();
    if (!config.simpleMode) discardDraft();
    renderMainMenu();
    if (config.simpleMode) void showWelcomeReport();
  });
  overlay.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDrawer(); });
  document.addEventListener(CONTEXT_EVENT, (event) => setContext(event.detail));
  form.addEventListener("submit", (event) => { event.preventDefault(); ask(input.value); });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    if (!send.disabled && clean(input.value)) form.requestSubmit();
  });

  addMessage("Hola. Usa “Crear un gráfico” para armar una visualización paso a paso, o escribe una consulta específica.");
  if (!config.simpleMode) fetchInsightsJson(config.draftUrl, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ action: "get" }) })
    .then((payload) => {
      if (config.simpleMode) return;
      if (!payload?.ok || !payload.draft?.mode) return;
      pendingVisualization = payload.draft;
      addMessage("Recuperé tu borrador de visualización.");
      continueAfterDepartmentScope();
    }).catch(() => {});
  if (config.simpleMode) {
    messages.replaceChildren();
    void showWelcomeReport();
  }
  const lastVisualization = () => lastVisualizationSpec ? { ...lastVisualizationSpec, filters: lastVisualizationSpec.filters.map((filter) => ({ ...filter })) } : null;
  const pendingDashboardWidgets = () => dashboardQueue.map((item) => ({ ...item, spec: { ...item.spec }, preview: { ...item.preview, items: item.preview.items.map((row) => ({ ...row })) } }));
  const api = { open, close: closeDrawer, ask, setContext, lastQuery, lastVisualization, pendingDashboardWidgets, exportCSV };
  window.__ixtlaInsightsInstance = api;
  window.IxtlaInsights = api;
  return api;
}

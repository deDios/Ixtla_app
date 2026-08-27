// El dashboard visual permanece fuera del alcance productivo del chat simple.
const saveTemporaryDashboard = () => null;

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
}];
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

function widgetTitle(chart, metric, dimension, domain = "requerimientos") {
  const group = DIMENSION_LABELS[dimension] || "estatus";
  if (chart === "kpi" && METRIC_LABELS[metric]) return METRIC_LABELS[metric];
  if (domain === "retroalimentaciones") {
    if (chart === "line") return "Evolución de retroalimentaciones";
    return `Retroalimentaciones por ${group}`;
  }
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
    subtitle: "Asistente de requerimientos y retros",
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
    simpleMode: true,
    visualizationHandler: null,
    ...options,
  };
  let context = config.context || window.__ixtlaInsightsContext || null;
  let pendingVisualization = null;
  let lastVisualizationSpec = null;
  let draftPersistQueue = Promise.resolve();
  const history = [];
  let lastResultQuery = null;

  const root = document.createElement("div");
  root.className = "ixtla-insights";
  root.innerHTML = `
    <button class="ixtla-insights-fab" type="button" aria-label="Abrir ${config.title}"><span class="ixtla-insights-fab__icon" aria-hidden="true">✦</span><span class="ixtla-insights-fab__label">${config.title}</span></button>
    <div class="ixtla-insights-overlay" aria-hidden="true"></div>
    <aside class="ixtla-insights-drawer" aria-label="${config.subtitle}" aria-hidden="true">
      <header class="ixtla-insights-head"><span class="ixtla-insights-head__mark" aria-hidden="true">✦</span><div><h2>${config.title}</h2><p>${config.subtitle}</p></div><button class="ixtla-insights-clear" type="button">Limpiar chat</button><button class="ixtla-insights-close" type="button" aria-label="Cerrar">×</button></header>
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
  function showThinkingIndicator() {
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

    const stages = [
      "Analizando tu consulta…",
      "Consultando datos autorizados…",
      "Preparando una respuesta clara…",
    ];
    const update = (text) => {
      label.textContent = text;
      messages.scrollTop = messages.scrollHeight;
    };
    update(stages[0]);
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
      const isChoice = ["visualization_preset", "visualization_measurement", "visualization_separation", "department_scope", "visualization_period", "visualization_kpi", "visualization_kpi_kit", "visualization_confirm", "visualization_change_chart", "visualization_edit_period", "visualization_edit_scope", "visualization_cancel"].includes(item?.action?.type);
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
        const visualizationAction = ["visualization_start", "visualization_preset", "visualization_measurement", "visualization_separation", "visualization_kpi_kit", "visualization_kpi", "department_scope", "visualization_period", "visualization_chart", "visualization_dimension", "visualization_metric", "visualization_confirm", "visualization_change_chart", "visualization_edit_period", "visualization_edit_scope"].includes(action.type);
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

  function renderWorkflowQuestions(questions) {
    const cancel = {
      label: "Cancelar creación",
      description: "Descarta este gráfico y vuelve a las consultas.",
      action: { type: "visualization_cancel" },
    };
    renderQuickQuestions([...(Array.isArray(questions) ? questions : []), cancel]);
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
    const explicit = /\b(grafica|grafico|visualiza|visualizar|visualizacion|chart|kpi|indicador(?:es)?|barras?|linea|dona|pastel)\b/.test(text);
    const natural = /\b(muestrame|quiero ver|necesito ver|comparar|comparame)\b/.test(text)
      && /\b(tendencia|evolucion|distribucion|por departamento|por tramite|por estatus|calificaciones?)\b/.test(text);
    return explicit || natural;
  }

  function parseVisualizationRequest(value) {
    const text = normalizedVisualizationText(value);
    if (!visualizationIntent(text)) return null;
    const refersToPrevious = /\b(esto|eso|lo anterior|los mismos datos|esta informacion|estos resultados)\b/.test(text);
    let domain = /\b(retro|retros|retroalimentacion|retroalimentaciones|encuesta|encuestas|calificacion|calificaciones|satisfaccion)\b/.test(text)
      ? "retroalimentaciones" : "";
    if (!domain && refersToPrevious && clean(lastResultQuery?.tool).includes("feedback")) domain = "retroalimentaciones";
    if (!domain && /\b(requerimiento|requerimientos|pendiente|pendientes|tramite|tramites|estatus|carga)\b/.test(text)) domain = "requerimientos";

    let chart = "";
    if (/\b(kpi|indicador|indicadores|tarjeta|tarjetas)\b/.test(text)) chart = "kpi";
    else if (/\b(linea|tendencia|evolucion)\b/.test(text)) chart = "line";
    else if (/\b(dona|pastel)\b/.test(text)) chart = "donut";
    else if (/\b(tabla|listado)\b/.test(text)) chart = "table";
    else if (/\b(barra|barras)\b/.test(text)) chart = "bar";

    let dimension = "";
    if (/\bpor (?:el )?departamento|departamentos\b/.test(text)) dimension = "departamento";
    else if (/\bpor (?:el )?tramite|tramites\b/.test(text)) dimension = "tramite";
    else if (/\bpor (?:el )?estatus|estados? de (?:los )?requerimientos\b/.test(text)) dimension = "estatus";
    else if (/\bcalificacion|calificaciones\b/.test(text)) dimension = "calificacion";
    else if (/\bcontestadas|no contestadas|caducadas|inhabilitadas|estado de respuesta\b/.test(text)) dimension = "estado_retro";
    else if (/\bfecha|dia|dias|semana|semanas|mes|meses|tendencia|evolucion\b/.test(text)) dimension = "fecha";

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

    return { text, refersToPrevious, domain, chart, dimension, metric, period };
  }

  function beginNaturalVisualization(prompt, parsed) {
    const hasUsefulContext = parsed.refersToPrevious && lastResultQuery;
    if (!parsed.domain && !hasUsefulContext && !parsed.chart && !parsed.dimension && !parsed.metric) {
      startGuidedVisualization(false);
      return;
    }
    const domain = parsed.domain || (clean(lastResultQuery?.tool).includes("feedback") ? "retroalimentaciones" : "requerimientos");
    const metric = parsed.metric || (domain === "retroalimentaciones" ? "retro_total" : "total");
    const previousGroup = clean(lastResultQuery?.filters?.group_by);
    const previousDimension = DIMENSION_LABELS[previousGroup] ? previousGroup : previousGroup === "rating" ? "calificacion" : previousGroup === "status" ? (domain === "retroalimentaciones" ? "estado_retro" : "estatus") : "";
    const dimension = parsed.dimension || previousDimension || (parsed.chart === "line" ? "fecha" : domain === "retroalimentaciones" ? "calificacion" : "tramite");
    const chart = parsed.chart || (dimension === "fecha" ? "line" : metric === "tasa_respuesta" || metric === "promedio_calificacion" ? "kpi" : "bar");
    pendingVisualization = {
      mode: "natural_visualization",
      question: prompt,
      domain,
      metric,
      dimension,
      chart,
      filters: hasUsefulContext && Array.isArray(lastResultQuery?.filters?.filters) ? lastResultQuery.filters.filters : [],
      period: parsed.period,
    };
    addMessage(`Entendí que quieres visualizar ${METRIC_LABELS[metric]?.toLocaleLowerCase("es-MX") || "los resultados"}. ${CHART_LABELS[chart]} es una buena opción para agrupar por ${DIMENSION_LABELS[dimension] || dimension}.`);
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
        : /\btabla\b/.test(text) ? "table"
          : /\bkpi|indicador\b/.test(text) ? "kpi"
            : /\bbarra|barras\b/.test(text) ? "bar" : "";
    if (chart) {
      pendingVisualization.chart = chart;
      if (chart === "line") pendingVisualization.dimension = "fecha";
      if (pendingVisualization.reviewSpec) delete pendingVisualization.reviewSpec;
      continueGuidedVisualization();
      return true;
    }
    return false;
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
      renderWorkflowQuestions(chartChoices(request.goal));
      return;
    }
    if (!requiresDimension(request.chart)) request.dimension = "estatus";
    if (request.chart === "line" || request.chart === "area") request.dimension = "fecha";
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
    renderQuickQuestions([]);
    const dimension = request.dimension || "estatus";
    const spec = {
      id: `guided-widget-${Date.now()}`,
      title: clean(request.title) || widgetTitle(request.chart, request.metric, dimension, request.domain),
      chart: request.chart,
      metric: request.metric,
      dimension,
      filters: Array.isArray(request.filters) ? request.filters : [],
      period: PERIOD_LABELS[request.period] ? request.period : "all",
      sort: dimension === "fecha" ? "chronological" : "desc",
      limit: request.chart === "kpi" ? 1 : 10,
      domain: request.domain === "retroalimentaciones" ? "retroalimentaciones" : "requerimientos",
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
    addMessage(`Configuración propuesta: **${spec.title}**\n\n${metric} · ${visualizationScopeSummary(spec.filters)} · ${period} · ${chart} por ${dimension}.`);
    renderQuickQuestions([
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
    renderQuickQuestions([]);
    if (config.simpleMode) {
      lastVisualizationSpec = { ...spec, filters: Array.isArray(spec.filters) ? spec.filters.map((filter) => ({ ...filter })) : [] };
      addMessage(`Configuración lista: **${spec.title}**. Guardé la intención, métrica, agrupación y periodo dentro de esta conversación. El renderizado del componente gráfico se conectará en la siguiente etapa.`);
      renderQuickQuestions(START_ACTIONS);
      return;
    }
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
    if (["preset_visualization", "natural_visualization"].includes(pendingVisualization.mode)) {
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
    primaryChips.replaceChildren();
    secondaryChips.replaceChildren();
    customChips.replaceChildren();
    const loading = document.createElement("p");
    loading.className = "ixtla-insights-department-loading";
    loading.textContent = "Cargando departamentos activos…";
    customChips.appendChild(loading);
    try {
      const response = await fetch(config.departmentsUrl, { credentials: "same-origin", headers: { Accept: "application/json" } });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !Array.isArray(payload.departments)) throw new Error("No fue posible cargar los departamentos.");
      renderDepartmentChecklist(payload.departments);
    } catch (error) {
      console.error("[IxtlaInsights]", error);
      addMessage("No pude cargar los departamentos activos. Intenta de nuevo o selecciona todos los departamentos.");
      renderWorkflowQuestions(DEPARTMENT_SCOPE_CHOICES);
    }
  }

  function renderDepartmentChecklist(departments) {
    primaryChips.replaceChildren();
    secondaryChips.replaceChildren();
    customChips.replaceChildren();
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
    back.addEventListener("click", () => renderWorkflowQuestions(DEPARTMENT_SCOPE_CHOICES));
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
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancelar creación";
    cancel.addEventListener("click", () => cancelVisualization());
    actions.append(back, cancel, apply);
    customChips.append(form, actions);
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

  function setContext(next) { context = next && typeof next === "object" ? next : null; }
  function open() { drawer.classList.add("is-open"); overlay.classList.add("is-open"); drawer.setAttribute("aria-hidden", "false"); input.focus(); }
  function closeDrawer() { drawer.classList.remove("is-open"); overlay.classList.remove("is-open"); drawer.setAttribute("aria-hidden", "true"); }

  async function ask(question) {
    const prompt = clean(question);
    if (!prompt) return;
    addMessage(prompt, "user");
    input.value = "";
    if (isVisualizationCancellationIntent(prompt)) {
      cancelVisualization("De acuerdo. Cancelé la creación del gráfico. ¿Qué dato o reporte quieres consultar?");
      return;
    }
    if (handlePendingVisualizationText(prompt)) return;
    const parsedVisualization = parseVisualizationRequest(prompt);
    if (parsedVisualization) {
      beginNaturalVisualization(prompt, parsedVisualization);
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
      if (!config.simpleMode) renderReport(payload.report);
      history.push({ role: "user", content: prompt }, { role: "assistant", content: answer });
      const suggestions = Array.isArray(payload.suggestions)
        ? payload.suggestions.map((suggestion) => clean(suggestion)).filter(Boolean).slice(0, 5)
        : [];
      renderQuickQuestions(suggestions.length ? suggestions : [...START_ACTIONS, ...config.quickQuestions]);
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
    const response = await fetch(config.draftUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ action: "save", draft: pendingVisualization }),
    });
    if (!response.ok) throw new Error("No fue posible guardar el borrador.");
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
      .then(() => fetch(config.draftUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      }))
      .catch(() => {});
  }

  function clearServerConversation() {
    return fetch(config.apiUrl, {
      method: "POST",
      credentials: "same-origin",
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
    const response = await fetch(config.exportUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "text/csv, application/json" },
      body: JSON.stringify({ query_id: selectedQueryId }),
    });
    const contentType = clean(response.headers.get("content-type"));
    if (!response.ok || !contentType.includes("text/csv")) {
      const payload = await response.json().catch(() => null);
      throw new Error(clean(payload?.error) || `No fue posible exportar la consulta (${response.status || "respuesta no válida"}).`);
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
      const response = await fetch(config.welcomeUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: "{}",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !payload?.report) throw new Error("No se recibió el informe inicial.");
      addMessage(formatWelcomeReport(payload.report));
    } catch (error) {
      console.warn("[IxtlaInsights] welcome report", error);
      addMessage("No fue posible cargar el informe inicial. Puedes consultar requerimientos específicos desde el chat.");
    }
  }

  renderQuickQuestions([...START_ACTIONS, ...config.quickQuestions]);
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
    renderQuickQuestions([...START_ACTIONS, ...config.quickQuestions]);
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
  if (!config.simpleMode) fetch(config.draftUrl, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ action: "get" }) })
    .then((response) => response.json())
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
  const api = { open, close: closeDrawer, ask, setContext, lastQuery, lastVisualization, exportCSV };
  window.__ixtlaInsightsInstance = api;
  window.IxtlaInsights = api;
  return api;
}

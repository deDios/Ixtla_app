import { Session } from "/JS/UAT/auth/session.js";
import { saveTemporaryDashboard } from "/JS/UAT/insights/dashboard-store.js";

const CONTEXT_EVENT = "ixtla-insights:context";
const HISTORY_LIMIT = 6;
const QUICK_QUESTIONS = [
  "¿Cuántos requerimientos están finalizados?",
  "¿Cuál es el trámite con más pendientes?",
  "Resume la carga actual",
  "Crear una gráfica de pastel",
];
const DIMENSION_LABELS = {
  estatus: "estatus",
  tramite: "trámite",
  departamento: "departamento",
  fecha: "fecha",
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
  if (/dona|pastel/.test(text)) return "donut";
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

function isContextQuestion(question) {
  return /finaliz|cancel|paus|trámite|tramite|pendient|mayor|más carga|mas carga|resume|carga actual|cuántos|cuantos/i.test(question);
}

function widgetTitle(chart, metric, dimension) {
  const group = DIMENSION_LABELS[dimension] || "estatus";
  if (chart === "line") return "Tendencia de requerimientos por fecha";
  if (chart === "kpi") return metric === "finalizados" ? "Requerimientos finalizados" : "Total de requerimientos";
  return metric === "finalizados" ? `Finalizados por ${group}` : `Requerimientos por ${group}`;
}

export function mountIxtlaInsights(options = {}) {
  if (window.__ixtlaInsightsInstance) return window.__ixtlaInsightsInstance;

  const config = {
    title: "Ixtla Insights",
    subtitle: "Asistente de requerimientos",
    quickQuestions: QUICK_QUESTIONS,
    dashboardUrl: "/VIEWS/UAT/insightsDashboard.php",
    apiUrl: "/db/ixtla_insights/chat.php",
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
      chip.className = "ixtla-insights-chip";
      chip.textContent = text;
      chip.addEventListener("click", () => {
        if (item && typeof item === "object" && item.action?.type === "visualization_dimension") {
          chooseVisualizationDimension(item.action.dimension);
          return;
        }
        ask(clean(item?.prompt || text));
      });
      chips.appendChild(chip);
    });
  }

  function dimensionChoices(chart) {
    return ["estatus", "tramite", "departamento", "fecha"].map((dimension) => ({
      label: `${chart === "donut" ? "Pastel" : "Gráfica"} por ${DIMENSION_LABELS[dimension]}`,
      action: { type: "visualization_dimension", dimension },
    }));
  }

  function remoteWidgetSpec(widget) {
    const chart = clean(widget?.kind || widget?.chart);
    if (!new Set(["kpi", "bar", "donut", "line", "table"]).has(chart)) return null;
    const metric = clean(widget?.metric) === "finalizados" ? "finalizados" : "total";
    const dimension = ["estatus", "tramite", "departamento", "fecha"].includes(clean(widget?.dimension))
      ? clean(widget.dimension)
      : "estatus";
    return {
      id: `remote-widget-${Date.now()}`,
      title: clean(widget?.title) || widgetTitle(chart, metric, dimension),
      chart,
      metric,
      dimension,
      domain: "requerimientos",
      scopeLabel: clean(widget?.scope_label) || clean(context?.scopeLabel) || "Vista autorizada actual",
    };
  }

  async function addVisualization(question, spec) {
    if (!Array.isArray(context?.rows) || !context.rows.length) {
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

  async function chooseVisualizationDimension(dimension) {
    if (!pendingVisualization || !DIMENSION_LABELS[dimension]) return;
    const request = pendingVisualization;
    pendingVisualization = null;
    addMessage(`${request.chart === "donut" ? "Pastel" : "Gráfica"} por ${DIMENSION_LABELS[dimension]}`, "user");
    renderQuickQuestions([]);
    const spec = {
      id: `guided-widget-${Date.now()}`,
      title: widgetTitle(request.chart, request.metric, dimension),
      chart: request.chart,
      metric: request.metric,
      dimension,
      domain: "requerimientos",
      scopeLabel: clean(context?.scopeLabel) || "Vista autorizada actual",
    };
    try {
      await addVisualization(request.question, spec);
    } catch (error) {
      console.error("[IxtlaInsights]", error);
      addMessage("No fue posible agregar la visualización al dashboard. Intenta de nuevo.");
    }
  }

  function beginVisualization(question) {
    const chart = chartFromQuestion(question);
    if (!chart) return false;
    const dimension = dimensionFromQuestion(question);
    const metric = /finaliz/i.test(question) ? "finalizados" : "total";
    if (dimension) {
      const spec = {
        id: `guided-widget-${Date.now()}`,
        title: widgetTitle(chart, metric, dimension),
        chart,
        metric,
        dimension,
        domain: "requerimientos",
        scopeLabel: clean(context?.scopeLabel) || "Vista autorizada actual",
      };
      addVisualization(question, spec).catch((error) => {
        console.error("[IxtlaInsights]", error);
        addMessage("No fue posible agregar la visualización al dashboard. Intenta de nuevo.");
      });
      return true;
    }
    pendingVisualization = { chart, metric, question };
    addMessage(`Puedo mostrar una visualización de tipo ${chart === "donut" ? "pastel" : "gráfica"}. ¿Cómo deseas agrupar los requerimientos?`);
    renderQuickQuestions(dimensionChoices(chart));
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
        renderQuickQuestions(payload.suggestions || config.quickQuestions);
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

  addMessage("Hola. Puedo resumir los requerimientos que ya puedes ver en esta pantalla. Prueba una pregunta sugerida.");
  const api = { open, close: closeDrawer, ask, setContext };
  window.__ixtlaInsightsInstance = api;
  window.IxtlaInsights = api;
  return api;
}

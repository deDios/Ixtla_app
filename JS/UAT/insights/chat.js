import { Session } from "/JS/UAT/auth/session.js";

const CONTEXT_EVENT = "ixtla-insights:context";
const QUICK_QUESTIONS = [
  "¿Cuántos requerimientos están finalizados?",
  "¿Cuál es el trámite con más pendientes?",
  "Resume la carga actual",
];

const clean = (value) => String(value ?? "").trim();

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
  if (/tr[aá]mite|pendient|mayor|m[aá]s carga/.test(text) && topTramite) {
    return `El trámite con mayor carga visible es “${topTramite[0]}”, con ${topTramite[1]} requerimiento(s). Hay ${abiertos} abierto(s) en total.`;
  }
  return `En ${scope} hay ${rows.length} requerimiento(s): ${abiertos} abierto(s), ${finalizados} finalizado(s), ${pausados} pausado(s) y ${cancelados} cancelado(s).`;
}

export function mountIxtlaInsights(options = {}) {
  if (window.__ixtlaInsightsInstance) return window.__ixtlaInsightsInstance;

  const config = {
    title: "Ixtla Insights",
    subtitle: "Asistente de requerimientos",
    quickQuestions: QUICK_QUESTIONS,
    answer: null,
    ...options,
  };
  let context = window.__ixtlaInsightsContext || null;

  const root = document.createElement("div");
  root.className = "ixtla-insights";
  root.innerHTML = `
    <button class="ixtla-insights-fab" type="button" aria-label="Abrir ${config.title}"><span class="ixtla-insights-fab__icon" aria-hidden="true">✦</span><span class="ixtla-insights-fab__label">${config.title}</span></button>
    <div class="ixtla-insights-overlay" aria-hidden="true"></div>
    <aside class="ixtla-insights-drawer" aria-label="${config.subtitle}" aria-hidden="true">
      <header class="ixtla-insights-head"><span class="ixtla-insights-head__mark" aria-hidden="true">✦</span><div><h2>${config.title}</h2><p>${config.subtitle}</p></div><button class="ixtla-insights-close" type="button" aria-label="Cerrar">×</button></header>
      <div class="ixtla-insights-messages" aria-live="polite"></div>
      <div class="ixtla-insights-footer"><div class="ixtla-insights-chips"></div><form class="ixtla-insights-form"><textarea class="ixtla-insights-input" rows="1" placeholder="Pregunta sobre los requerimientos…"></textarea><button class="ixtla-insights-send" type="submit" aria-label="Enviar">↑</button></form></div>
    </aside>`;
  document.body.appendChild(root);

  const fab = root.querySelector(".ixtla-insights-fab");
  const overlay = root.querySelector(".ixtla-insights-overlay");
  const drawer = root.querySelector(".ixtla-insights-drawer");
  const close = root.querySelector(".ixtla-insights-close");
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
      const response = config.answer
        ? await config.answer({ question: prompt, context, session: Session.get() })
        : answerFromContext(prompt, context);
      addMessage(clean(response) || "No pude generar una respuesta para esa consulta.");
    } catch (error) {
      console.error("[IxtlaInsights]", error);
      addMessage("No fue posible analizar los requerimientos. Intenta de nuevo.");
    } finally {
      send.disabled = false;
      input.focus();
    }
  }

  config.quickQuestions.forEach((question) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "ixtla-insights-chip";
    chip.textContent = question;
    chip.addEventListener("click", () => ask(question));
    chips.appendChild(chip);
  });

  fab.addEventListener("click", open);
  close.addEventListener("click", closeDrawer);
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

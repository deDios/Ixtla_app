const STORAGE_KEY = "ixtla-insights:temporary-dashboard";

function clean(value) {
  return String(value ?? "").trim();
}

function statusOf(row) {
  return clean(row?.estatus?.key ?? row?.estatus_key ?? row?.estatus ?? row?.status).toLowerCase();
}

function compactRows(rows) {
  return (Array.isArray(rows) ? rows : []).slice(0, 500).map((row) => ({
    id: row?.id ?? null,
    tramite: clean(row?.tramite ?? row?.tipo_tramite ?? row?.categoria) || "Sin trámite",
    estatus: statusOf(row),
    departamento: clean(row?.departamento ?? row?.depto ?? row?.departamento_nombre) || "Sin departamento",
    creado: row?.creado ?? row?.created_at ?? row?.fecha_creacion ?? null,
  }));
}

export function buildVisualizationSpec(question, context = {}) {
  const prompt = clean(question).toLocaleLowerCase("es-MX");
  const dimension = /tr[aá]mite|categor[ií]a/.test(prompt) ? "tramite" : "estatus";
  const chart = /dona|pastel/.test(prompt) ? "donut" : "bar";
  const metric = /finaliz/.test(prompt) ? "finalizados" : "total";

  return {
    id: `visual-${Date.now()}`,
    title: metric === "finalizados"
      ? `Finalizados por ${dimension}`
      : `Requerimientos por ${dimension}`,
    chart,
    metric,
    dimension,
    domain: "requerimientos",
    scopeLabel: clean(context.scopeLabel) || "Vista autorizada actual",
  };
}

export function saveTemporaryDashboard({ question, context, spec }) {
  const dashboard = {
    version: 1,
    createdAt: new Date().toISOString(),
    question: clean(question),
    scopeLabel: clean(context?.scopeLabel) || "Vista autorizada actual",
    widgets: [spec],
    rows: compactRows(context?.rows),
  };

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dashboard));
  return dashboard;
}

export function loadTemporaryDashboard() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    return parsed && parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function clearTemporaryDashboard() {
  sessionStorage.removeItem(STORAGE_KEY);
}

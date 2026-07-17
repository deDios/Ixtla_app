import { clearTemporaryDashboard, loadTemporaryDashboard } from "/JS/UAT/insights/dashboard-store.js";

const STATUS_LABELS = {
  solicitud: "Solicitud",
  revision: "Revisión",
  asignacion: "Asignación",
  proceso: "En proceso",
  pausado: "Pausado",
  cancelado: "Cancelado",
  finalizado: "Finalizado",
};

function groupRows(rows, widget) {
  const source = widget.metric === "finalizados"
    ? rows.filter((row) => row.estatus === "finalizado")
    : rows;
  return source.reduce((groups, row) => {
    const raw = widget.dimension === "tramite" ? row.tramite : row.estatus;
    const key = widget.dimension === "estatus" ? (STATUS_LABELS[raw] || raw || "Sin estatus") : (raw || "Sin trámite");
    groups[key] = (groups[key] || 0) + 1;
    return groups;
  }, {});
}

function renderBar(target, groups) {
  const entries = Object.entries(groups).sort((left, right) => right[1] - left[1]);
  const max = Math.max(...entries.map(([, value]) => value), 1);
  target.innerHTML = entries.length
    ? entries.map(([label, value]) => `<div class="ixtla-dashboard-bar"><span>${label}</span><div><i style="width:${Math.round((value / max) * 100)}%"></i></div><strong>${value}</strong></div>`).join("")
    : '<p class="ixtla-dashboard-empty">No hay datos para esta visualización.</p>';
}

function renderDonut(target, groups) {
  const entries = Object.entries(groups).sort((left, right) => right[1] - left[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  target.innerHTML = total
    ? `<div class="ixtla-dashboard-donut" style="position:relative;--percent:${Math.min(100, Math.round(((entries[0]?.[1] || 0) / total) * 100))}%"><strong>${total}</strong><span>Total</span></div><ul>${entries.map(([label, value]) => `<li><span>${label}</span><strong>${value}</strong></li>`).join("")}</ul>`
    : '<p class="ixtla-dashboard-empty">No hay datos para esta visualización.</p>';
}

function renderDashboard(dashboard) {
  document.getElementById("ixtla-dashboard-scope").textContent = dashboard.scopeLabel;
  document.getElementById("ixtla-dashboard-question").textContent = dashboard.question || "Dashboard temporal";
  const grid = document.getElementById("ixtla-dashboard-grid");
  grid.replaceChildren();

  dashboard.widgets.forEach((widget) => {
    const card = document.createElement("article");
    card.className = "ixtla-dashboard-card";
    card.innerHTML = `<header><p>${widget.metric === "finalizados" ? "Métrica: finalizados" : "Métrica: total"}</p><h2>${widget.title}</h2></header><div class="ixtla-dashboard-widget"></div>`;
    const groups = groupRows(dashboard.rows || [], widget);
    const target = card.querySelector(".ixtla-dashboard-widget");
    widget.chart === "donut" ? renderDonut(target, groups) : renderBar(target, groups);
    grid.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const dashboardId = new URLSearchParams(window.location.search).get("dashboard");
  const dashboard = loadTemporaryDashboard(dashboardId);
  if (!dashboard) {
    document.getElementById("ixtla-dashboard-empty").hidden = false;
    return;
  }

  renderDashboard(dashboard);
  document.getElementById("ixtla-dashboard-clear").addEventListener("click", () => {
    clearTemporaryDashboard(dashboard.id);
    window.close();
  });
});

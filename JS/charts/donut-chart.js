// /JS/charts/donut-chart.js
export function DonutChart(canvas) {
  const ctx = canvas.getContext("2d");
  let data = [];

  function clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); }
  function drawStub() {
    clear();
    ctx.save();
    ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillStyle = "#9aa4af";
    ctx.fillText("DonutChart listo (F3: sectores/leyenda/hover)", 10, 22);
    ctx.restore();
  }

  function mount(opts) { data = opts?.data || []; drawStub(); }
  function update(opts) { data = opts?.data || data; drawStub(); }
  function destroy() { /* no-op */ }

  return { mount, update, destroy };
}

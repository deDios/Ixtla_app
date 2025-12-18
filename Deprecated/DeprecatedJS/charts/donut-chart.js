// /JS/charts/donut-chart.js
export function DonutChart(canvas) {
  const ctx = canvas.getContext("2d");
  let data = []; // [{ label, value, color }]
  let ro;
  let dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));

  function attach() {
    ro = new ResizeObserver(scale);
    ro.observe(canvas);
    scale();
  }
  function detach() { ro?.disconnect?.(); }

  function scale() {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const r = Math.min(w, h) * 0.38;
    const inner = r * 0.6;

    const total = data.reduce((a, b) => a + (b.value || 0), 0);
    if (total <= 0) {
      // rótulo vacío
      ctx.save();
      ctx.fillStyle = "#9aa4af";
      ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Sin datos", cx, cy + 4);
      ctx.restore();
      return;
    }

    // sectores
    let ang = -Math.PI / 2;
    data.forEach(d => {
      const frac = (d.value || 0) / total;
      const a2 = ang + frac * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.fillStyle = d.color || "#4f6b95";
      ctx.arc(cx, cy, r, ang, a2);
      ctx.closePath();
      ctx.fill();
      ang = a2;
    });

    // agujero
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath(); ctx.arc(cx, cy, inner, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // texto central
    ctx.save();
    ctx.fillStyle = "#111827";
    ctx.font = "18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(total), cx, cy - 2);
    ctx.fillStyle = "#6b7280";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText("Total del mes", cx, cy + 14);
    ctx.restore();

    // etiquetas % (pequeñas)
    ang = -Math.PI / 2;
    ctx.save();
    ctx.fillStyle = "#111827";
    ctx.font = "11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "center";
    data.forEach(d => {
      if (!d.value) return;
      const frac = d.value / total;
      const aMid = ang + frac * Math.PI * 2 / 2;
      const rx = cx + Math.cos(aMid) * (inner + (r - inner) * 0.6);
      const ry = cy + Math.sin(aMid) * (inner + (r - inner) * 0.6);
      const pct = Math.round(frac * 100) + "%";
      ctx.fillText(pct, rx, ry + 3);
      ang += frac * Math.PI * 2;
    });
    ctx.restore();
  }

  function mount(opts) { data = opts?.data || []; attach(); }
  function update(opts) { data = opts?.data || data; draw(); }
  function destroy() { detach(); }

  return { mount, update, destroy };
}


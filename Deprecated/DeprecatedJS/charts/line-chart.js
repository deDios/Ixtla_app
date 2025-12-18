// /JS/charts/line-chart.js
export function LineChart(canvas) {
  const ctx = canvas.getContext("2d");
  let data = new Array(12).fill(0);
  let ro; // ResizeObserver
  let dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  const pad = { t: 16, r: 16, b: 28, l: 36 };
  const months = ["E","F","M","A","M","J","J","A","S","O","N","D"];

  function attach() {
    ro = new ResizeObserver(scale);
    ro.observe(canvas);
    scale();
  }

  function detach() {
    ro?.disconnect?.();
  }

  function scale() {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function niceMax(n) {
    if (n <= 5) return 5;
    const p = Math.pow(10, Math.floor(Math.log10(n)));
    const q = Math.ceil(n / p);
    if (q <= 2) return 2 * p;
    if (q <= 5) return 5 * p;
    return 10 * p;
  }

  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;

    // plot area
    const x0 = pad.l, y0 = pad.t, x1 = w - pad.r, y1 = h - pad.b;
    const pw = x1 - x0, ph = y1 - y0;

    // axes
    ctx.beginPath();
    ctx.moveTo(x0, y1); ctx.lineTo(x1, y1);
    ctx.moveTo(x0, y0); ctx.lineTo(x0, y1);
    ctx.stroke();

    // scales
    const maxVal = Math.max(0, ...data);
    const yMax = niceMax(maxVal);
    const yTicks = 4;
    const yStep = yMax / yTicks;

    // y ticks + labels
    for (let i = 0; i <= yTicks; i++) {
      const v = i * yStep;
      const y = y1 - (v / yMax) * ph;
      ctx.strokeStyle = "#f3f4f6";
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.fillStyle = "#6b7280";
      ctx.fillText(String(Math.round(v)), 4, y + 4);
    }

    // x labels
    const n = data.length;
    for (let i = 0; i < n; i++) {
      const x = x0 + (i / (n - 1)) * pw;
      ctx.fillStyle = "#6b7280";
      ctx.fillText(months[i], x - 4, h - 8);
    }

    // line
    if (maxVal > 0) {
      ctx.strokeStyle = "#4f6b95";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = x0 + (i / (n - 1)) * pw;
        const y = y1 - (data[i] / yMax) * ph;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // points
      ctx.fillStyle = "#4f6b95";
      for (let i = 0; i < n; i++) {
        const x = x0 + (i / (n - 1)) * pw;
        const y = y1 - (data[i] / yMax) * ph;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      }
    }

    ctx.restore();
  }

  function mount(opts) { data = opts?.data || data; attach(); }
  function update(opts) { data = opts?.data || data; draw(); }
  function destroy() { detach(); }

  return { mount, update, destroy };
}


// /JS/charts/donut-chart.js
export class DonutChart {
  constructor(canvas, opts = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d");
    this.wrap = canvas.parentElement;
    this.tip = this.wrap.querySelector(".chart-tip") || this._createTip();

    const dpr = window.devicePixelRatio || 1;
    this.c.width = this.c.clientWidth * dpr;
    this.c.height = this.c.clientHeight * dpr;
    this.ctx.scale(dpr, dpr);
    // DonutChart: redibujo en resize
    const ro = new ResizeObserver(() => {
      const dpr2 = window.devicePixelRatio || 1;
      this.c.width = this.c.clientWidth * dpr2;
      this.c.height = this.c.clientHeight * dpr2;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr2, dpr2);
      this.draw();
    });
    ro.observe(this.c);


    const ds = canvas.dataset || {};
    let dataFromDS = [];
    try { dataFromDS = ds.donut ? JSON.parse(ds.donut) : []; } catch { }

    this.data = Array.isArray(opts.data) && opts.data.length ? opts.data : dataFromDS;
    this.colors = Array.isArray(opts.colors) && opts.colors.length ? opts.colors : [
      "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#6366f1",
      "#10b981", "#06b6d4", "#eab308", "#f97316", "#a855f7"
    ];
    this.total = Number.isFinite(opts.total) ? opts.total : this.data.reduce((a, b) => a + (b.value || 0), 0);

    this.legendEl = opts.legendEl || null;
    this.legendBullets = opts.legendBullets !== false;
    this.showPercLabels = opts.showPercLabels !== false;

    this.cx = this.c.clientWidth / 2;
    this.cy = this.c.clientHeight / 2;
    this.outerR = Math.min(this.c.clientWidth, this.c.clientHeight) * 0.42;
    this.innerR = this.outerR * 0.58;

    // pre-cálculo de segmentos
    this._segments = [];
    this._hoverIdx = -1;

    this._bind();
    this.draw();
    this.renderLegend();
  }

  _createTip() {
    const d = document.createElement("div");
    d.className = "chart-tip";
    d.style.cssText = "position:absolute;pointer-events:none;padding:.35rem .5rem;border-radius:.5rem;background:#1f2937;color:#fff;font:12px/1.2 system-ui;opacity:0;transform:translate(-50%,-120%);transition:opacity .12s;";
    this.wrap.appendChild(d);
    return d;
  }

  _bind() {
    this.c.addEventListener("mousemove", (e) => {
      if (!this._segments.length) return;
      const rect = this.c.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const dx = mx - this.cx;
      const dy = my - this.cy;
      const r = Math.hypot(dx, dy);
      if (r < this.innerR || r > this.outerR * 1.15) {
        this._hoverIdx = -1;
        this.tip.style.opacity = "0";
        this.draw();
        return;
      }
      let ang = Math.atan2(dy, dx);
      if (ang < -Math.PI / 2) ang += Math.PI * 2; // normaliza relativo a -PI/2
      // los segmentos están medidos desde start = -PI/2 en sentido horario
      const hit = this._segments.findIndex(s => ang >= s.start && ang < s.end);
      this._hoverIdx = hit;
      if (hit >= 0) {
        const seg = this._segments[hit];
        const pct = Math.round((seg.value / this.total) * 100);
        this.tip.textContent = `${seg.label}: ${seg.value} (${pct}%)`;
        this.tip.style.left = `${mx}px`;
        this.tip.style.top = `${my}px`;
        this.tip.style.opacity = "1";
      } else {
        this.tip.style.opacity = "0";
      }
      this.draw();
    });
    this.c.addEventListener("mouseleave", () => {
      this._hoverIdx = -1;
      this.tip.style.opacity = "0";
      this.draw();
    });
  }

  _computeSegments() {
    this._segments = [];
    if (!this.data?.length || this.total <= 0) return;
    let start = -Math.PI / 2;
    this.data.forEach((item, i) => {
      const value = Number(item.value || 0);
      if (value <= 0) return;
      const ang = (value / this.total) * Math.PI * 2;
      this._segments.push({
        i,
        label: item.label || "—",
        value,
        color: this.colors[i % this.colors.length],
        start,
        end: start + ang
      });
      start += ang;
    });
  }

  draw() {
    const ctx = this.ctx;
    const w = this.c.clientWidth;
    const h = this.c.clientHeight;
    this.cx = w / 2; this.cy = h / 2;
    this.outerR = Math.min(w, h) * 0.42;
    this.innerR = this.outerR * 0.58;

    ctx.clearRect(0, 0, w, h);

    if (!this.data?.length || this.total <= 0) {
      ctx.fillStyle = "#e8eef5";
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, this.outerR, 0, Math.PI * 2);
      ctx.fill();
      this._drawCenter("0", "Total del mes");
      this._segments = [];
      return;
    }

    this._computeSegments();

    // pinta segmentos (con “hover grow” sutil)
    this._segments.forEach((s, idx) => {
      const isHover = idx === this._hoverIdx;
      const rOuter = isHover ? this.outerR * 1.06 : this.outerR;
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.fillStyle = s.color;
      ctx.arc(this.cx, this.cy, rOuter, s.start, s.end);
      ctx.closePath();
      ctx.fill();

      // porcentaje sobre anillo
      if (this.showPercLabels) {
        const mid = (s.start + s.end) / 2;
        const rx = this.cx + Math.cos(mid) * (this.innerR + (this.outerR - this.innerR) * 0.65);
        const ry = this.cy + Math.sin(mid) * (this.innerR + (this.outerR - this.innerR) * 0.65);
        const pct = Math.round((s.value / this.total) * 100);
        ctx.fillStyle = "#111827";
        ctx.font = "12px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${pct}%`, rx, ry);
      }
    });

    // recorte inner
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.innerR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    this._drawCenter(String(this.total), "Total del mes");
  }

  _drawCenter(big, small) {
    const ctx = this.ctx;
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(big, this.cx, this.cy - 8);

    ctx.fillStyle = "#6b7280";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(small, this.cx, this.cy + 14);
  }

  renderLegend() {
    if (!this.legendEl) return;
    const total = this.total || 1;
    this.legendEl.querySelectorAll("li").forEach(li => li.remove());
    this.data.forEach((item, i) => {
      const li = document.createElement("li");
      li.style.display = "flex";
      li.style.alignItems = "center";
      li.style.gap = ".5rem";
      const dot = document.createElement("span");
      dot.className = "bullet";
      dot.style.cssText = `display:inline-block;width:.75rem;height:.75rem;border-radius:999px;background:${this.colors[i % this.colors.length]};`;
      const t = document.createElement("span");
      t.className = "t";
      t.textContent = item.label || "—";
      const pct = document.createElement("span");
      pct.className = "pct";
      pct.textContent = ` ${Math.round((item.value / total) * 100)}%`;
      li.appendChild(dot);
      li.appendChild(t);
      li.appendChild(pct);
      this.legendEl.appendChild(li);
    });
  }
}

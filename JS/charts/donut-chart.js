// /JS/charts/donut-chart.js
export class DonutChart {
  constructor(canvas, opts = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d");
    this.wrap = canvas.parentElement;
    this.tip = this.wrap.querySelector(".chart-tip") || this._createTip();

    // Estado
    this.data = Array.isArray(opts.data) ? opts.data.slice() : [];
    this.total = Number.isFinite(opts.total)
      ? opts.total
      : this.data.reduce((a, b) => a + (Number(b.value) || 0), 0);

    // Paleta “más azules” por defecto (puedes pasar colors en opts)
    this.colors = Array.isArray(opts.colors) && opts.colors.length
      ? opts.colors.slice()
      : ["#1d4ed8","#2563eb","#3b82f6","#60a5fa","#93c5fd",
         "#0ea5e9","#06b6d4","#22d3ee","#67e8f9","#38bdf8"];

    this.legendEl = opts.legendEl || null;
    this.showPercLabels = opts.showPercLabels !== false;

    // Canvas DPR + resize
    const dpr = window.devicePixelRatio || 1;
    this.c.width  = this.c.clientWidth  * dpr;
    this.c.height = this.c.clientHeight * dpr;
    this.ctx.scale(dpr, dpr);

    this._ro = new ResizeObserver(() => {
      const dpr2 = window.devicePixelRatio || 1;
      this.c.width  = this.c.clientWidth  * dpr2;
      this.c.height = this.c.clientHeight * dpr2;
      this.ctx.setTransform(1,0,0,1,0,0);
      this.ctx.scale(dpr2, dpr2);
      this._measure();
      this._computeSegments();
      this.draw();
      this.renderLegend();
    });
    this._ro.observe(this.c);

    // Medidas y estado hover
    this._segments = [];
    this._hoverIdx = -1;

    this._measure();
    this._bind();
    this._computeSegments();
    this.draw();
    this.renderLegend();
  }

  /* ========================= API pública ========================= */
  /** Actualiza datos/paleta sin reinstanciar */
  update({ data, total, colors, legendEl, showPercLabels } = {}) {
    if (Array.isArray(data)) this.data = data.slice();
    if (Number.isFinite(total)) this.total = total;
    if (Array.isArray(colors) && colors.length) this.colors = colors.slice();
    if (legendEl) this.legendEl = legendEl;
    if (typeof showPercLabels === "boolean") this.showPercLabels = showPercLabels;

    this._computeSegments();
    this.draw();
    this.renderLegend();
  }

  destroy() {
    try { this._ro?.disconnect?.(); } catch {}
  }

  /* ========================= Internals =========================== */
  _createTip() {
    const d = document.createElement("div");
    d.className = "chart-tip";
    d.style.cssText = "position:absolute;pointer-events:none;padding:.35rem .5rem;border-radius:.5rem;background:#1f2937;color:#fff;font:12px/1.2 system-ui;opacity:0;transform:translate(-50%,-120%);transition:opacity .12s;";
    this.wrap.appendChild(d);
    return d;
  }

  _measure() {
    const w = this.c.clientWidth, h = this.c.clientHeight;
    this.cx = w / 2;
    this.cy = h / 2;
    this.outerR = Math.min(w, h) * 0.42;
    this.innerR = this.outerR * 0.58;
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

      // fuera del anillo → sin hover
      if (r < this.innerR || r > this.outerR * 1.15) {
        this._hoverIdx = -1;
        this.tip.style.opacity = "0";
        this.draw();
        return;
      }

      // Ángulo relativo a -90° (arriba), en sentido horario
      let ang = Math.atan2(dy, dx);         // [-PI, PI]
      ang = (ang + 2*Math.PI) % (2*Math.PI);
      // Offset para que 0 arranque arriba
      ang = (ang - Math.PI/2 + 2*Math.PI) % (2*Math.PI);

      const idx = this._segments.findIndex(s => ang >= s.start && ang < s.end);
      this._hoverIdx = idx;
      if (idx >= 0) {
        const seg = this._segments[idx];
        const pct = this.total > 0 ? Math.round(seg.value * 100 / this.total) : 0;
        this.tip.textContent = `${seg.label}: ${seg.value} (${pct}%)`;
        this.tip.style.left = `${mx}px`;
        this.tip.style.top  = `${my}px`;
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
    if (!this.data?.length || !(this.total > 0)) return;
    let start = 0; // ya normalizamos el ángulo para que 0 sea arriba
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
    const w = this.c.clientWidth, h = this.c.clientHeight;

    ctx.clearRect(0, 0, w, h);

    if (!this.data?.length || !(this.total > 0)) {
      // base vacía
      ctx.fillStyle = "#e8eef5";
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, this.outerR, 0, Math.PI * 2);
      ctx.fill();
      this._drawCenter("0", "Total");
      this._segments = [];
      return;
    }

    // segmentos
    this._segments.forEach((s, idx) => {
      const isHover = idx === this._hoverIdx;
      const rOuter = isHover ? this.outerR * 1.06 : this.outerR;

      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.fillStyle = s.color;
      // convertimos a sistema canvas (0 = derecha) → sumamos -90° para arrancar arriba
      ctx.arc(this.cx, this.cy, rOuter, s.start - Math.PI/2, s.end - Math.PI/2);
      ctx.closePath();
      ctx.fill();

      // etiqueta de porcentaje sobre el anillo
      if (this.showPercLabels) {
        const mid = (s.start + s.end) / 2;
        const rx = this.cx + Math.cos(mid - Math.PI/2) * (this.innerR + (this.outerR - this.innerR) * 0.65);
        const ry = this.cy + Math.sin(mid - Math.PI/2) * (this.innerR + (this.outerR - this.innerR) * 0.65);
        const pct = Math.round((s.value / this.total) * 100);
        ctx.fillStyle = "#111827";
        ctx.font = "12px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${pct}%`, rx, ry);
      }
    });

    // recorte interior (agujero)
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.innerR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    this._drawCenter(String(this.total), "Total");
  }

  _drawCenter(big, small) {
    const ctx = this.ctx;
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(big, this.cx, this.cy - 7);

    ctx.fillStyle = "#6b7280";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(small, this.cx, this.cy + 13);
  }

  renderLegend() {
    if (!this.legendEl) return;
    const total = this.total || 1;

    // limpiar
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
      pct.textContent = ` ${Math.round((Number(item.value||0) / total) * 100)}%`;

      li.appendChild(dot);
      li.appendChild(t);
      li.appendChild(pct);
      this.legendEl.appendChild(li);
    });
  }
}

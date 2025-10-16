// /JS/charts/line-chart.js
export class LineChart {
  constructor(canvas, opts = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d");
    this.wrap = canvas.parentElement;
    this.tip = this.wrap.querySelector(".chart-tip") || this._createTip();

    const dpr = window.devicePixelRatio || 1;
    this.c.width  = this.c.clientWidth  * dpr;
    this.c.height = this.c.clientHeight * dpr;
    this.ctx.scale(dpr, dpr);

    // Datos desde opciones o data-*
    const ds = canvas.dataset || {};
    let labelsFromDS = null;
    let seriesFromDS = null;
    try { labelsFromDS = ds.labelsYear ? JSON.parse(ds.labelsYear) : null; } catch {}
    try { seriesFromDS = ds.seriesYear ? JSON.parse(ds.seriesYear) : null; } catch {}

    this.labels  = Array.isArray(opts.labels) ? opts.labels
                 : Array.isArray(labelsFromDS) ? labelsFromDS : [];
    this.series  = Array.isArray(opts.series) ? opts.series
                 : Array.isArray(seriesFromDS) ? seriesFromDS : [];

    // Opciones visuales
    this.showDots  = opts.showDots !== false;
    this.showGrid  = opts.showGrid !== false;      // grid horizontal
    this.headroom  = Number.isFinite(opts.headroom) ? opts.headroom : 0.10; // +10% top
    this.yTicks    = Number.isFinite(opts.yTicks) ? opts.yTicks : 5;
    this.maxYHint  = Number.isFinite(opts.maxY) ? opts.maxY : null;

    // Colores
    this.colorAxis = "#cbd5e1";
    this.colorGrid = "rgba(203,213,225,.5)";
    this.colorLine = "#2f495f";
    this.colorDot  = "#2f495f";
    this.colorHover= "#1f2f3f";

    // Estado hover
    this._pts = [];
    this._hoverIdx = -1;

    this._bind();
    this.draw();
  }

  // === API pública para actualizar dinámicamente ===
  update({ labels, series, maxY, headroom, yTicks, showGrid, showDots } = {}) {
    if (Array.isArray(labels)) this.labels = labels.slice();
    if (Array.isArray(series)) this.series = series.slice();
    if (Number.isFinite(maxY)) this.maxYHint = maxY;
    if (Number.isFinite(headroom)) this.headroom = headroom;
    if (Number.isFinite(yTicks)) this.yTicks = yTicks;
    if (typeof showGrid === "boolean") this.showGrid = showGrid;
    if (typeof showDots === "boolean") this.showDots = showDots;

    // Recalcular canvas por si el tamaño cambió
    const dpr = window.devicePixelRatio || 1;
    this.c.width  = this.c.clientWidth  * dpr;
    this.c.height = this.c.clientHeight * dpr;
    this.ctx.setTransform(1,0,0,1,0,0);
    this.ctx.scale(dpr, dpr);

    this._hoverIdx = -1;
    this.tip.style.opacity = "0";
    this.draw();
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
      if (!this._pts.length) return;
      const rect = this.c.getBoundingClientRect();
      const x = e.clientX - rect.left;
      let idx = 0, best = Infinity;
      for (let i=0;i<this._pts.length;i++){
        const dx = Math.abs(this._pts[i].x - x);
        if (dx < best){ best = dx; idx = i; }
      }
      this._hoverIdx = idx;
      const p = this._pts[idx];
      this.tip.textContent = `${p.label}: ${p.val}`;
      this.tip.style.left = `${p.x}px`;
      this.tip.style.top  = `${p.y}px`;
      this.tip.style.opacity = "1";
      this.draw(true);
    });

    this.c.addEventListener("mouseleave", ()=>{
      this._hoverIdx = -1;
      this.tip.style.opacity = "0";
      this.draw();
    });

    // Redibuja si cambia el tamaño
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      this.c.width  = this.c.clientWidth  * dpr;
      this.c.height = this.c.clientHeight * dpr;
      this.ctx.setTransform(1,0,0,1,0,0);
      this.ctx.scale(dpr, dpr);
      this.draw();
    });
    ro.observe(this.c);
  }

  // === Utils para escala “bonita” 1-2-5 ===
  _niceNum(range, round) {
    const exp = Math.floor(Math.log10(range || 1));
    const f   = range / Math.pow(10, exp);
    let nf;
    if (round) {
      if (f < 1.5)      nf = 1;
      else if (f < 3)   nf = 2;
      else if (f < 7)   nf = 5;
      else              nf = 10;
    } else {
      if (f <= 1)       nf = 1;
      else if (f <= 2)  nf = 2;
      else if (f <= 5)  nf = 5;
      else              nf = 10;
    }
    return nf * Math.pow(10, exp);
  }

  _niceScale(min, max, ticks) {
    const range   = this._niceNum(max - min, false);
    const step    = this._niceNum(range / Math.max(1, (ticks - 1)), true);
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil (max / step) * step;
    return { niceMin, niceMax, step };
  }

  draw() {
    const ctx = this.ctx;
    const w = this.c.clientWidth;
    const h = this.c.clientHeight;

    const pad = { top: 18, right: 10, bottom: 28, left: 32 };

    ctx.clearRect(0, 0, w, h);

    // Eje X base
    ctx.strokeStyle = this.colorAxis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, h - pad.bottom);
    ctx.lineTo(w - pad.right, h - pad.bottom);
    ctx.stroke();

    if (!this.series?.length) return;

    // === Escala Y inteligente con headroom ===
    const rawMax = Math.max(0, ...this.series);
    const hinted = this.maxYHint != null ? this.maxYHint : rawMax;
    const withHeadroom = hinted * (1 + Math.max(0, this.headroom)); // p.ej. +10%
    const { niceMin, niceMax, step } = this._niceScale(0, withHeadroom, this.yTicks);
    const yMax = Math.max(1, niceMax); // nunca 0

    // funciones de mapeo
    const toX = (i) => {
      const n = Math.max(1, this.series.length - 1);
      return pad.left + (i * (w - pad.left - pad.right)) / n;
    };
    const toY = (v) => {
      const usable = h - pad.top - pad.bottom;
      const clamped = Math.max(0, Math.min(v, yMax));
      return pad.top + (usable * (1 - (clamped / yMax)));
    };

    // Grid horizontal 
    if (this.showGrid && step > 0) {
      ctx.strokeStyle = this.colorGrid;
      ctx.lineWidth = 1;
      for (let yv = niceMin; yv <= yMax + 1e-9; yv += step) {
        const yPix = toY(yv);
        ctx.beginPath();
        ctx.moveTo(pad.left, yPix);
        ctx.lineTo(w - pad.right, yPix);
        ctx.stroke();
      }
    }

    // puntos mapeados
    this._pts = this.series.map((v,i)=>({
      x: toX(i),
      y: toY(v),
      val: v,
      label: this.labels?.[i] ?? `#${i+1}`
    }));

    // línea
    ctx.strokeStyle = this.colorLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    this._pts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // puntos (con hover)
    if (this.showDots) {
      this._pts.forEach((p, i) => {
        ctx.fillStyle = (i === this._hoverIdx) ? this.colorHover : this.colorDot;
        const r = (i === this._hoverIdx) ? 4.5 : 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI*2);
        ctx.fill();
      });
    }

    // guía vertical en hover
    if (this._hoverIdx >= 0) {
      const p = this._pts[this._hoverIdx];
      ctx.strokeStyle = "rgba(31,41,55,.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, pad.top);
      ctx.lineTo(p.x, h - pad.bottom);
      ctx.stroke();
    }

    // labels X
    if (this.labels?.length) {
      ctx.fillStyle = "#334155";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      this.labels.forEach((lab, i) => {
        const x = toX(i), y = h - pad.bottom + 6;
        // puedes cambiar a lab completo si caben:
        ctx.fillText(String(lab).substring(0, 1), x, y);
      });
    }
  }
}

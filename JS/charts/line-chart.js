// /JS/charts/line-chart.js
export class LineChart {
  constructor(canvas, opts = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d");
    this.wrap = canvas.parentElement;
    this.tip = this.wrap.querySelector(".chart-tip") || this._createTip();

    const dpr = window.devicePixelRatio || 1;
    // usa el tamaño CSS para render nítido
    this.c.width  = this.c.clientWidth  * dpr;
    this.c.height = this.c.clientHeight * dpr;
    this.ctx.scale(dpr, dpr);

    // Fallback a data-* si no vienen opciones
    const ds = canvas.dataset || {};
    const labelsFromDS = ds.labelsYear ? JSON.parse(ds.labelsYear) : null;
    const seriesFromDS = ds.seriesYear ? JSON.parse(ds.seriesYear) : null;

    this.labels  = Array.isArray(opts.labels) ? opts.labels
                 : Array.isArray(labelsFromDS) ? labelsFromDS : [];
    this.series  = Array.isArray(opts.series) ? opts.series
                 : Array.isArray(seriesFromDS) ? seriesFromDS : [];
    this.showDots = opts.showDots !== false;
    this.smooth   = !!opts.smooth;

    // estilos
    this.colorAxis = "#cbd5e1";
    this.colorLine = "#2f495f";
    this.colorDot  = "#2f495f";
    this.colorHover= "#1f2f3f";

    // estado hover
    this._pts = [];        // [{x,y,val,label}]
    this._hoverIdx = -1;

    // listeners
    this._bind();

    // draw
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
      // el punto más cercano en X
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
  }

  draw(fromHover = false) {
    const ctx = this.ctx;
    const w = this.c.clientWidth;
    const h = this.c.clientHeight;

    const pad = { top: 12, right: 10, bottom: 28, left: 26 };

    // limpiar
    ctx.clearRect(0, 0, w, h);

    // eje X (línea base)
    ctx.strokeStyle = this.colorAxis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, h - pad.bottom);
    ctx.lineTo(w - pad.right, h - pad.bottom);
    ctx.stroke();

    if (!this.series?.length) return;

    // escala
    const maxY = Math.max(5, ...this.series);
    const toX = (i) => {
      const n = Math.max(1, this.series.length - 1);
      return pad.left + (i * (w - pad.left - pad.right)) / n;
    };
    const toY = (v) => {
      const usable = h - pad.top - pad.bottom;
      return pad.top + (usable * (1 - (v / maxY)));
    };

    // pre-calcula puntos mapeados
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

    // puntos
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

    // labels X (primera letra)
    if (this.labels?.length) {
      ctx.fillStyle = "#334155";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      this.labels.forEach((lab, i) => {
        const x = toX(i), y = h - pad.bottom + 6;
        ctx.fillText(String(lab).substring(0, 1), x, y);
      });
    }
  }
}

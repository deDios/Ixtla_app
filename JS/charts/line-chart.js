// /JS/charts/line-chart.js
export class LineChart {
  constructor(canvas, opts = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    // autoscale para nitidez
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

    // colores
    this.colorAxis = "#cbd5e1";  // gris claro
    this.colorLine = "#3b556e";  // azul grisáceo
    this.colorDot  = "#3b556e";

    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const w = this.c.clientWidth;
    const h = this.c.clientHeight;

    // padding de área de gráfico
    const pad = { top: 12, right: 10, bottom: 28, left: 26 };

    // limpiar
    ctx.clearRect(0, 0, w, h);

    // ejes (solo guía horizontal)
    ctx.strokeStyle = this.colorAxis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, h - pad.bottom);
    ctx.lineTo(w - pad.right, h - pad.bottom);
    ctx.stroke();

    if (!this.series?.length) return;

    // escala Y dinámica
    const maxY = Math.max(5, ...this.series);
    const toX = (i) => {
      const n = Math.max(1, this.series.length - 1);
      return pad.left + (i * (w - pad.left - pad.right)) / n;
    };
    const toY = (v) => {
      const usable = h - pad.top - pad.bottom;
      return pad.top + (usable * (1 - (v / maxY)));
    };

    // línea
    ctx.strokeStyle = this.colorLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.series.forEach((v, i) => {
      const x = toX(i), y = toY(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // puntos
    if (this.showDots) {
      ctx.fillStyle = this.colorDot;
      this.series.forEach((v, i) => {
        const x = toX(i), y = toY(v);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // labels X (meses abreviados si existen)
    if (this.labels?.length) {
      ctx.fillStyle = "#334155";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      this.labels.forEach((lab, i) => {
        const x = toX(i), y = h - pad.bottom + 6;
        const t = String(lab).substring(0, 1); // primera letra (E F M A …)
        ctx.fillText(t, x, y);
      });
    }
  }
}
